// Registrations — community-membership applications.
//
// Mounted by server.js at:
//   /api/platform/registrations/*    (canonical)
//   /api/registrations/*             (legacy alias)
//
// Lifted verbatim from server.js stage 3b. Registrations are platform-level
// (every module's "membership in this community" flow uses them); the DB
// rows live in the `listings` table with status='pending|approved|declined'
// — that conflation will be cleaned up in a later schema stage.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../../logger');

module.exports = function createRegistrationsRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
    isValidEmail, validateListingInput, validateApartmentUniqueness,
    listingToDb, listingFromDb, notificationToDb, registrationFromListingRows,
    normalizeLanguage, normalizeRecipients,
    getCommunity, publicAppUrl, auditEvent,
    sendRegistrationStatusEmail, sendRegistrationSubmittedEmail, sendRegistrationReviewerEmail,
    sendTemplatedEmail, getEmailNotificationConfig,
    getGlobalAdminEmails, getDelegateAdminsWithPermission, getCommunityAdminEmails,
    canManageRegistrations, getUserRole,
  } = deps;

  // Internal helper — handles approve/decline flow. Was top-level in server.js.
  const reviewRegistration = async (req, res, status) => {
    if (!requireSupabaseEnv(res)) return;
    const { reviewerUid, reviewerName, reason } = req.body || {};
    if (!reviewerUid) return res.status(400).json({ error:'reviewerUid is required.' });
    const registrationId = req.params.id;
    const { data: pendingRows, error: findErr } = await supabase.from('listings').select('*').eq('registration_id', registrationId).eq('status','pending').order('apt', { ascending:true });
    if (findErr) return sendSupabaseError(res, findErr);
    if (!pendingRows || !pendingRows.length) return res.status(404).json({ error:'Registro pendiente no encontrado o ya revisado.' });
    const communityId = pendingRows[0].community_id || getCommunityId(req);
    try { if (!(await canManageRegistrations(reviewerUid, req.body?.reviewerEmail, communityId))) return res.status(403).json({ error:'Solo administradores globales o delegados pueden aprobar o rechazar registros.' }); } catch(e) { return sendSupabaseError(res, e); }

    if (status === 'approved') {
      try {
        const conflict = await validateApartmentUniqueness(pendingRows, { ownerUid: pendingRows[0].owner_uid, includePending: false });
        if (conflict) return res.status(409).json({ error: conflict.message, conflict });
      } catch(e) { return sendSupabaseError(res, e); }
    }
    const review = { status, reason:String(reason || '').trim(), reviewed_by_uid:reviewerUid, reviewed_by_name:reviewerName || '', reviewed_at:new Date().toISOString() };
    const { data: updated, error: updErr } = await supabase.from('listings').update(review).eq('registration_id', registrationId).eq('community_id', communityId).eq('status','pending').select('*');
    if (updErr) return sendSupabaseError(res, updErr);
    for (const row of updated || []) await auditEvent({ listingId:row.id, registrationId, actorUid:reviewerUid, actorName:reviewerName, action: status === 'approved' ? 'registration_approved' : 'registration_declined', reason:review.reason, before:pendingRows.find(x => x.id === row.id), after:row });
    const result = registrationFromListingRows(updated || []);
    res.json(result);
    setImmediate(async () => { try { await sendRegistrationStatusEmail({ registration: result, appUrl: publicAppUrl(req), communityId }); } catch(e) { warn('Registration status email failed: ' + (e?.message || e)); } });
  };

  const router = express.Router();

  // GET /status                        — current user's most-recent registration
  router.get('/status', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const uid = String(req.query.uid || '').trim();
    if (!uid) return res.status(400).json({ error: 'uid is required.' });
    const communityId = getCommunityId(req);
    const { data: latest, error } = await supabase.from('listings').select('*').eq('owner_uid', uid).eq('community_id', communityId).in('status', ['pending','approved','declined']).order('created_at', { ascending:false }).limit(1).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!latest) return res.json({ status:'none' });
    const regId = latest.registration_id;
    const query = supabase.from('listings').select('*').eq('owner_uid', uid).eq('community_id', communityId).eq('status', latest.status).order('apt', { ascending:true });
    const { data: rows, error: rowError } = regId ? await query.eq('registration_id', regId) : await query;
    if (rowError) return sendSupabaseError(res, rowError);
    res.json(registrationFromListingRows(rows || [latest]));
  });

  // POST /                             — submit a new registration
  router.post('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { userUid, userName, userEmail, listings, profileWhatsapp, profileCountry, language } = req.body || {};
    const communityId = getCommunityId(req);
    if (!userUid || !userName || !userEmail || !isValidEmail(userEmail)) return res.status(400).json({ error:'Google login name and email are required.' });
    if (!profileWhatsapp || String(profileWhatsapp).replace(/[^0-9]/g,'').length < 10) return res.status(400).json({ error:'WhatsApp del propietario es requerido con código de país (mín. 10 dígitos).' });
    if (!Array.isArray(listings) || listings.length < 1) return res.status(400).json({ error:'Debe registrar al menos un listing propio.' });
    for (const l of listings) { const msg = validateListingInput(l); if (msg) return res.status(400).json({ error: msg }); }
    try {
      const conflict = await validateApartmentUniqueness(listings, { ownerUid: userUid, includePending: true, communityId });
      if (conflict) return res.status(409).json({ error: conflict.message, conflict });
    } catch(e) { return sendSupabaseError(res, e); }

    const { data: existingApproved, error: approvedError } = await supabase.from('listings').select('id').eq('owner_uid', userUid).eq('community_id', communityId).eq('status','approved').limit(1).maybeSingle();
    if (approvedError) return sendSupabaseError(res, approvedError);
    if (existingApproved) return res.status(400).json({ error:'Este usuario ya está aprobado.' });

    const { data: existingPending, error: pendingError } = await supabase.from('listings').select('id').eq('owner_uid', userUid).eq('community_id', communityId).eq('status','pending').limit(1).maybeSingle();
    if (pendingError) return sendSupabaseError(res, pendingError);
    if (existingPending) return res.status(400).json({ error:'Ya tienes un registro pendiente de aprobación.' });

    const registrationId = 'reg_' + uuidv4().slice(0,8);
    const ownerContact = String(profileWhatsapp || '').trim();
    const ownerEmail   = String(userEmail || '').trim().toLowerCase();
    const community = await getCommunity(communityId);
    const towerLabel = community?.tower || 'KAI';
    const rows = listings.map(l => listingToDb({
      id:'lst_' + uuidv4().slice(0,8), communityId, registrationId, ownerUid:userUid, owner:String(userName||'').trim(), userEmail:ownerEmail,
      apt:l.apt, tower:towerLabel, rooms:l.rooms, guests:l.guests, operator:l.operator, operatorEmail:l.operatorEmail || l.operator_email, operatorWhatsapp:l.operatorWhatsapp || l.operator_whatsapp,
      contact:ownerContact, email:ownerEmail, airbnb:l.airbnb,
      status:'pending', reason:'', createdAt:new Date().toISOString()
    }, communityId));
    let { data: savedRows, error: rowsError } = await supabase.from('listings').insert(rows).select('*');
    if (rowsError) return sendSupabaseError(res, rowsError);

    try {
      const regLang = normalizeLanguage(language || 'es-CO');
      const { data: existingLangRow } = await supabase.from('app_users').select('language_preference').eq('uid', userUid).maybeSingle();
      const profileRow = { uid: userUid, email: String(userEmail).toLowerCase(), name: userName || '', whatsapp: ownerContact, country: String(profileCountry || 'Colombia').trim(), updated_at: new Date().toISOString() };
      if (!existingLangRow) profileRow.language_preference = regLang;
      await supabase.from('app_users').upsert(profileRow, { onConflict: 'uid' });
    } catch(e) { warn('Profile whatsapp save on registration failed: ' + (e?.message || e)); }

    const appUrl = publicAppUrl(req);
    const bootstrapEmails = String(process.env.BOOTSTRAP_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    const { count: approvedCount } = await supabase.from('listings').select('id', { count:'exact', head:true }).eq('status','approved');
    const shouldBootstrapApprove = bootstrapEmails.includes(String(userEmail).toLowerCase()) && (approvedCount || 0) === 0;
    if (shouldBootstrapApprove) {
      const review = { status:'approved', reason:'Aprobación inicial automática', reviewed_by_uid:userUid, reviewed_by_name:userName, reviewed_at:new Date().toISOString() };
      const upd = await supabase.from('listings').update(review).eq('registration_id', registrationId).select('*');
      if (upd.error) return sendSupabaseError(res, upd.error);
      savedRows = upd.data || savedRows;
      for (const row of savedRows || []) await auditEvent({ listingId:row.id, registrationId, actorUid:userUid, actorName:userName, action:'registration_auto_approved', reason:review.reason, after:row });
    } else {
      for (const row of savedRows || []) await auditEvent({ listingId:row.id, registrationId, actorUid:userUid, actorName:userName, action:'registration_submitted', after:row });
    }
    const result = registrationFromListingRows(savedRows || []);
    res.json(result);

    setImmediate(async () => {
      try {
        if (result.status === 'approved') await sendRegistrationStatusEmail({ registration: result, appUrl, communityId });
        else await sendRegistrationSubmittedEmail({ registration: result, appUrl });
      } catch(e) { warn('Registration submitted/status email failed: ' + (e?.message || e)); }
      try {
        if (result.status !== 'pending') return;
        const { data: reviewerRows } = await supabase.from('listings').select('owner_uid,owner,user_email,email').eq('community_id', communityId).eq('status','approved');
        const seen = new Set();
        for (const r of reviewerRows || []) {
          if (seen.has(r.owner_uid)) continue; seen.add(r.owner_uid);
          const reviewer = { user_uid:r.owner_uid, user_name:r.owner, user_email:r.user_email || r.email };
          const note = { id:'not_' + uuidv4().slice(0,8), communityId, ownerUid: reviewer.user_uid, listingId:null, incidentId:null, title:'Nuevo registro pendiente', message:`${result.userName} solicita acceso con ${(savedRows||[]).length} listing(s).`, isRead:false, emailSent:false, emailError:'', createdAt:new Date().toISOString(), kind:'registration', registrationId: result.id };
          await supabase.from('notifications').insert(notificationToDb(note));
          try { await sendRegistrationReviewerEmail({ reviewer, registration: result, appUrl }); } catch(mailErr) { warn('Reviewer registration email failed: ' + (mailErr?.message || mailErr)); }
        }
        try {
          const notifCfg = await getEmailNotificationConfig();
          const revCfg = notifCfg['registration_reviewer'];
          if (revCfg?.enabled) {
            const adminRecips = [];
            if (revCfg.globalAdmin) adminRecips.push(...getGlobalAdminEmails());
            if (revCfg.delegateAdmin) adminRecips.push(...await getDelegateAdminsWithPermission('canApproveRegistrations'));
            if (revCfg.communityAdmin ?? true) adminRecips.push(...await getCommunityAdminEmails(communityId));
            const normalized = normalizeRecipients(adminRecips);
            if (normalized.length) {
              const comm = await getCommunity(communityId);
              const communityName = comm?.name || communityId;
              await sendTemplatedEmail({ key:'registration_reviewer', to: normalized, vars: { reviewerName:'Admin', userName:result.userName||'', userEmail:result.userEmail||'', approvalsLink: appUrl+'/?view=approvals', communityName } });
            }
          }
        } catch(e) { warn('Admin registration reviewer email failed: ' + (e?.message || e)); }
      } catch(e) { warn('Registration reviewer notification failed: ' + (e?.message || e)); }
    });
  });

  // GET /pending                       — pending registrations for review
  router.get('/pending', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const reviewerUid = String(req.query.reviewerUid || '').trim();
    const communityId = getCommunityId(req);
    if (!reviewerUid) return res.status(400).json({ error:'reviewerUid is required.' });
    try { if (!(await canManageRegistrations(reviewerUid, req.query.reviewerEmail, communityId))) return res.status(403).json({ error:'Solo administradores globales o delegados pueden revisar registros pendientes.' }); } catch(e) { return sendSupabaseError(res, e); }
    const isGlobal = (await getUserRole({ uid:reviewerUid, email:req.query.reviewerEmail||'' })) === 'global_admin';
    let pendingQuery = supabase.from('listings').select('*').eq('status','pending').order('created_at', { ascending:true }).order('apt', { ascending:true });
    if (!isGlobal) pendingQuery = pendingQuery.eq('community_id', communityId);
    const { data: rows, error } = await pendingQuery;
    if (error) return sendSupabaseError(res, error);
    const groups = new Map();
    for (const row of rows || []) {
      const key = row.registration_id || row.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    res.json([...groups.values()].map(registrationFromListingRows));
  });

  // GET /active                        — approved/declined registrations grouped by owner
  router.get('/active', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const reviewerUid = String(req.query.reviewerUid || '').trim();
    const communityId = getCommunityId(req);
    if (!reviewerUid) return res.status(400).json({ error:'reviewerUid is required.' });
    try {
      if (!(await canManageRegistrations(reviewerUid, req.query.reviewerEmail, communityId))) {
        return res.status(403).json({ error:'Solo administradores globales o delegados pueden ver registros activos.' });
      }
    } catch(e) { return sendSupabaseError(res, e); }

    const isGlobalA = (await getUserRole({ uid:reviewerUid, email:req.query.reviewerEmail||'' })) === 'global_admin';
    let activeQuery = supabase.from('listings').select('*').in('status',['approved','declined']).order('owner', { ascending:true }).order('apt', { ascending:true });
    if (!isGlobalA) activeQuery = activeQuery.eq('community_id', communityId);
    const { data: rows, error } = await activeQuery;
    if (error) return sendSupabaseError(res, error);

    const groups = new Map();
    for (const row of rows || []) {
      const key = row.owner_uid || row.user_email || row.email || row.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    const active = [...groups.values()].map(group => {
      const first = group[0];
      return {
        id: first.owner_uid || first.id,
        userUid: first.owner_uid,
        userName: first.owner,
        userEmail: first.user_email || first.email || '',
        status: first.status || 'approved',
        reason: first.reason || '',
        reviewedByUid: first.reviewed_by_uid || '',
        reviewedByName: first.reviewed_by_name || '',
        reviewedAt: first.reviewed_at || '',
        createdAt: group.map(x => x.created_at).filter(Boolean).sort()[0] || first.created_at,
        listings: group.map(listingFromDb),
      };
    });
    res.json(active);
  });

  // POST /:id/approve  POST /:id/decline
  router.post('/:id/approve', (req, res) => reviewRegistration(req, res, 'approved'));
  router.post('/:id/decline', (req, res) => reviewRegistration(req, res, 'declined'));

  return router;
};
