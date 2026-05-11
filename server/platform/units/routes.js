// Units (apartments) — platform-level HTTP routes.
//
// Mounted by server.js at:
//   /api/platform/units/*    (canonical, see docs/platform/PLATFORM_ARCHITECTURE.md §5)
//   /api/listings/*          (legacy alias — drop after frontend migrates)
//
// The uniqueness check lives at GET /check (canonical: /api/platform/units/check;
// legacy alias: /api/apartments/check, forwarded by server.js).
//
// Handler bodies were lifted verbatim from server.js; only path strings and
// dep injection changed. The DB column is still named `listings` — rename
// lands in a later stage.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../../logger');

module.exports = function createUnitsRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
    listingFromDb, listingToDb, notificationToDb, registrationFromListingRows,
    isThreeDigitApt, isValidEmail, isValidOptionalUrl, parseCoOwners,
    findApartmentConflict, validateApartmentUniqueness,
    getCommunity, auditEvent, auditLog, publicAppUrl, sendListingChangeEmail,
    sendRegistrationSubmittedEmail, sendRegistrationReviewerEmail,
    sendTemplatedEmail, getEmailNotificationConfig, normalizeRecipients,
    getGlobalAdminEmails, getDelegateAdminsWithPermission, getCommunityAdminEmails,
    canUpdateGlobalListing, canDeleteGlobalListing, hasCommunityAdminPerm,
  } = deps;

  const router = express.Router();

  // GET /check           — apartment-uniqueness check (legacy: /api/apartments/check)
  router.get('/check', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const apt = String(req.query.apt || '').trim();
    const ownerUid = String(req.query.ownerUid || '').trim();
    const excludeListingId = String(req.query.excludeListingId || '').trim();
    const communityId = getCommunityId(req);
    if (!apt) return res.status(400).json({ error:'apt is required.' });
    if (!isThreeDigitApt(apt)) return res.json({ available:false, valid:false, message:'El apartamento debe tener exactamente 3 dígitos. Ejemplo: 000.' });
    try {
      const conflict = await findApartmentConflict(apt, { allowedOwnerUid: ownerUid, excludeListingId, includePending: true, communityId });
      if (conflict) return res.json({ available:false, valid:true, conflict, message: conflict.message });
      res.json({ available:true, valid:true, message:'Apartamento disponible.' });
    } catch(e) { return sendSupabaseError(res, e); }
  });

  // GET /                — list approved units in the active community
  router.get('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const communityId = getCommunityId(req);
    const { data, error } = await supabase.from('listings').select('*').eq('community_id', communityId).eq('status','approved').order('apt', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    res.json((data || []).map(listingFromDb));
  });

  // POST /               — submit a new unit (goes through approval)
  //
  // An already-approved owner adding a unit follows the same approval
  // workflow as a first-time registration: the listing is inserted with
  // status='pending' under a fresh registration_id, owner gets the
  // submitted email, and admins / community reviewers get the reviewer
  // email + an in-app notification. The existing
  // POST /api/platform/registrations/:id/approve|decline endpoints
  // handle the review step because they key on registration_id.
  router.post('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, owner, userEmail, apt, rooms, guests, operator, operatorEmail, operatorWhatsapp, airbnb, coOwners: coOwnersRaw } = req.body;
    const communityId = getCommunityId(req);
    if (!ownerUid || !owner || !apt || !rooms || !guests) return res.status(400).json({ error: 'Missing required fields: owner, apartment, rooms, and guests are required.' });
    if (!isThreeDigitApt(apt)) return res.status(400).json({ error: 'Apartment number must be exactly 3 digits, for example 000.' });
    if (operatorEmail && !isValidEmail(operatorEmail)) return res.status(400).json({ error: 'A valid operator email is required.' });
    if (!isValidOptionalUrl(airbnb)) return res.status(400).json({ error: 'Airbnb URL must start with http:// or https:// when provided.' });
    const coOwnersParsed = parseCoOwners(coOwnersRaw || []);
    if (!coOwnersParsed.ok) return res.status(400).json({ error: coOwnersParsed.error });
    try {
      const conflict = await validateApartmentUniqueness([{ apt }], { ownerUid, includePending: true, communityId });
      if (conflict) return res.status(409).json({ error: conflict.message, conflict });
    } catch(e) { return sendSupabaseError(res, e); }

    // Guard: this endpoint is only for owners who already have at least one
    // approved listing in this community. First-time owners must go through
    // POST /api/platform/registrations so their initial unit(s) are reviewed
    // as part of the registration approval (no second approval needed).
    const { data: existingApproved, error: approvedCheckErr } = await supabase
      .from('listings').select('id')
      .eq('owner_uid', ownerUid).eq('community_id', communityId).eq('status','approved')
      .limit(1).maybeSingle();
    if (approvedCheckErr) return sendSupabaseError(res, approvedCheckErr);
    if (!existingApproved) return res.status(403).json({ error: 'You must complete the initial registration before adding more units.', code:'not_approved_yet' });

    const { data: profileRow } = await supabase.from('app_users').select('whatsapp,notification_email').eq('uid', ownerUid).maybeSingle();
    const ownerContact = String(profileRow?.whatsapp || '').trim();
    const googleEmail  = String(userEmail || '').trim().toLowerCase();
    const ownerEmail   = (profileRow?.notification_email || googleEmail);

    const community = await getCommunity(communityId);
    const towerLabel = community?.tower || 'KAI';
    const registrationId = 'reg_' + uuidv4().slice(0,8);
    const item = { id:'lst_'+uuidv4().slice(0,8), communityId, registrationId, ownerUid, owner:String(owner||'').trim(), userEmail:googleEmail, apt:String(apt).trim(), tower:towerLabel, rooms, guests:Number(guests), operator:operator||'', operatorEmail:operatorEmail||'', operatorWhatsapp:operatorWhatsapp||'', contact:ownerContact, email:ownerEmail, airbnb:String(airbnb||'').trim(), coOwners:[], status:'pending', reason:'', createdAt:new Date().toISOString() };
    const { data, error } = await supabase.from('listings').insert(listingToDb(item, communityId)).select('*').single();
    if (error) return sendSupabaseError(res, error);
    if (coOwnersParsed.coOwners.length > 0) {
      const { error: coErr } = await supabase.from('listings').update({ co_owners: coOwnersParsed.coOwners }).eq('id', data.id);
      if (coErr) warn('co_owners save failed (run schema migration): ' + (coErr.message || coErr));
      else data.co_owners = coOwnersParsed.coOwners;
    }
    await auditEvent({ listingId:data.id, registrationId, actorUid:ownerUid, actorName:owner, action:'registration_submitted', after:data });
    await auditLog({ entity:'listing', entityId:data.id, action:'create', actorUid:ownerUid, actorEmail:userEmail || '', actorName:owner, after:data });
    const result = registrationFromListingRows([data]);
    res.json(listingFromDb(data));
    setImmediate(async () => {
      const appUrl = publicAppUrl(req);
      try { await sendRegistrationSubmittedEmail({ registration: result, appUrl }); }
      catch(e) { warn('Add-unit submitted email failed: ' + (e?.message || e)); }
      try {
        const { data: reviewerRows } = await supabase.from('listings').select('owner_uid,owner,user_email,email').eq('community_id', communityId).eq('status','approved');
        const seen = new Set();
        for (const r of reviewerRows || []) {
          if (!r.owner_uid || seen.has(r.owner_uid)) continue;
          if (r.owner_uid === ownerUid) continue; // don't notify the owner about their own add
          seen.add(r.owner_uid);
          const reviewer = { user_uid:r.owner_uid, user_name:r.owner, user_email:r.user_email || r.email };
          const note = { id:'not_' + uuidv4().slice(0,8), communityId, ownerUid: reviewer.user_uid, listingId:null, incidentId:null, title:'Nueva unidad pendiente', message:`${owner} solicita agregar el apartamento ${apt}.`, isRead:false, emailSent:false, emailError:'', createdAt:new Date().toISOString(), kind:'registration', registrationId };
          await supabase.from('notifications').insert(notificationToDb(note));
          try { await sendRegistrationReviewerEmail({ reviewer, registration: result, appUrl }); }
          catch(mailErr) { warn('Add-unit reviewer email failed: ' + (mailErr?.message || mailErr)); }
        }
      } catch(e) { warn('Add-unit reviewer notification failed: ' + (e?.message || e)); }
      try {
        const notifCfg = await getEmailNotificationConfig();
        const revCfg = notifCfg['registration_reviewer'];
        if (!revCfg?.enabled) return;
        const adminRecips = [];
        if (revCfg.globalAdmin) adminRecips.push(...getGlobalAdminEmails());
        if (revCfg.delegateAdmin) adminRecips.push(...await getDelegateAdminsWithPermission('canApproveRegistrations'));
        if (revCfg.communityAdmin ?? true) adminRecips.push(...await getCommunityAdminEmails(communityId));
        const normalized = normalizeRecipients(adminRecips);
        if (!normalized.length) return;
        const comm = await getCommunity(communityId);
        const communityName = comm?.name || communityId;
        await sendTemplatedEmail({ key:'registration_reviewer', to: normalized, vars: { reviewerName:'Admin', userName: owner || '', userEmail: googleEmail, approvalsLink: appUrl+'/?view=approvals', communityName } });
      } catch(e) { warn('Add-unit admin reviewer email failed: ' + (e?.message || e)); }
    });
  });

  // PUT /:id             — update a unit
  router.put('/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorEmail, apt, rooms, guests, operator, operatorEmail, operatorWhatsapp, airbnb, coOwners: coOwnersRaw } = req.body;

    const { data: existing, error: findError } = await supabase.from('listings').select('*').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error: 'Not found' });
    if (existing.owner_uid !== ownerUid && !(await canUpdateGlobalListing(ownerUid, actorEmail)) && !(await hasCommunityAdminPerm(ownerUid, actorEmail, existing.community_id||'kai', 'canManageListings'))) return res.status(403).json({ error: 'Forbidden' });

    if (!apt || !rooms || !guests) return res.status(400).json({ error: 'Missing required fields: apartment, rooms, and guests are required.' });
    if (!isThreeDigitApt(apt)) return res.status(400).json({ error: 'Apartment number must be exactly 3 digits, for example 000.' });
    if (operatorEmail && !isValidEmail(operatorEmail)) return res.status(400).json({ error: 'A valid operator email is required.' });
    if (!isValidOptionalUrl(airbnb)) return res.status(400).json({ error: 'Airbnb URL must start with http:// or https:// when provided.' });
    const coOwnersParsed = parseCoOwners(coOwnersRaw || []);
    if (!coOwnersParsed.ok) return res.status(400).json({ error: coOwnersParsed.error });
    try {
      const conflict = await validateApartmentUniqueness([{ apt }], { ownerUid, excludeListingId: req.params.id, includePending: true, communityId: existing.community_id || 'kai' });
      if (conflict) return res.status(409).json({ error: conflict.message, conflict });
    } catch(e) { return sendSupabaseError(res, e); }

    const { data: profileRow } = await supabase.from('app_users').select('whatsapp,email,notification_email').eq('uid', existing.owner_uid).maybeSingle();
    const ownerContact = String(profileRow?.whatsapp || existing.contact || '').trim();
    const googleEmail  = String(existing.user_email || profileRow?.email || '').trim().toLowerCase();
    const ownerEmail   = profileRow?.notification_email || googleEmail;

    const existingCommunityId = existing.community_id || 'kai';
    const communityForUpdate = await getCommunity(existingCommunityId);
    const towerForUpdate = communityForUpdate?.tower || existing.tower || 'KAI';
    const update = { apt:String(apt).trim(), tower:towerForUpdate, rooms:String(rooms||''), guests:Number(guests||0), operator:operator||'', operator_email:String(operatorEmail||'').trim(), operator_whatsapp:String(operatorWhatsapp||'').trim(), contact:ownerContact, email:ownerEmail, airbnb:String(airbnb||'').trim() };
    const { data, error } = await supabase.from('listings').update(update).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    const { error: coErr } = await supabase.from('listings').update({ co_owners: coOwnersParsed.coOwners }).eq('id', req.params.id);
    if (coErr) warn('co_owners save failed (run schema migration): ' + (coErr.message || coErr));
    else data.co_owners = coOwnersParsed.coOwners;
    await auditEvent({ listingId:data.id, registrationId:data.registration_id, actorUid:ownerUid, actorName:existing.owner, action:'listing_updated', before:existing, after:data });
    await auditLog({ entity:'listing', entityId:data.id, action:'update', actorUid:ownerUid, actorEmail:actorEmail, actorName:existing.owner, before:existing, after:data });
    setImmediate(() => sendListingChangeEmail({ listing: listingFromDb(data), action:'updated', appUrl: publicAppUrl(req) }).catch(e => warn('Listing updated email failed: ' + (e?.message || e))));
    res.json(listingFromDb(data));
  });

  // DELETE /:id          — delete a unit
  router.delete('/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorEmail } = req.body;

    const { data: existing, error: findError } = await supabase.from('listings').select('*').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error: 'Not found' });
    if (existing.owner_uid !== ownerUid && !(await canDeleteGlobalListing(ownerUid, actorEmail)) && !(await hasCommunityAdminPerm(ownerUid, actorEmail, existing.community_id||'kai', 'canManageListings'))) return res.status(403).json({ error: 'Forbidden' });

    await auditEvent({ listingId:existing.id, registrationId:existing.registration_id, actorUid:ownerUid, actorName:existing.owner, action:'listing_deleted', before:existing });
    await auditLog({ entity:'listing', entityId:existing.id, action:'delete', actorUid:ownerUid, actorEmail:actorEmail, actorName:existing.owner, before:existing });
    const deletedListing = listingFromDb(existing);
    const { error } = await supabase.from('listings').delete().eq('id', req.params.id);
    if (error) return sendSupabaseError(res, error);
    setImmediate(() => sendListingChangeEmail({ listing: deletedListing, action:'deleted', appUrl: publicAppUrl(req) }).catch(e => warn('Listing deleted email failed: ' + (e?.message || e))));
    res.json({ ok: true });
  });

  return router;
};
