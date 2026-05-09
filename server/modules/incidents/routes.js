// Incidents module — HTTP routes.
//
// Mounted at /api/m/incidents/* (canonical) and /api/incidents/* (legacy alias)
// from server.js. Handler bodies were lifted verbatim from server.js during
// stage 2 of the platform refactor; the only mechanical changes were:
//   • path strings: '/api/incidents/...' → relative ('/...') for the router
//   • all server-scope helpers are now received via the `deps` object
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 2.

'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../../logger');

function normalizeOwnerGuestsPayload(guests) {
  if (!Array.isArray(guests)) return [];
  return guests.map(g => ({
    firstName: String(g?.firstName || g?.first_name || '').trim(),
    middleName: String(g?.middleName || g?.middle_name || '').trim(),
    lastName: String(g?.lastName || g?.last_name || '').trim(),
    city: String(g?.city || '').trim(),
    state: String(g?.state || '').trim(),
    country: String(g?.country || '').trim(),
  })).filter(g => g.firstName || g.middleName || g.lastName || g.city || g.country);
}
function ownerGuestFullName(g) { return [g.firstName, g.middleName, g.lastName].filter(Boolean).join(' ').trim(); }

module.exports = function createIncidentsRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
    incidentFromDb, incidentToDb, listingFromDb, notificationToDb,
    publicAppUrl, getSlaHours, getSlaPolicy, addHoursIso, auditLog,
    getGlobalAdminEmails, getEmailNotificationConfig, getReporterEmail, getReporterName,
    getCommunityEscalationEmails, getDelegateAdminsWithPermission, getCommunityAdminEmails,
    normalizeRecipients, sendTemplatedEmail,
    sendIncidentEmail, sendIncidentVerifiedEmail, sendIncidentResolutionAddedEmail, sendIncidentResolvedEmail,
    hasDelegatePermission, hasCommunityAdminPerm,
    canDeleteGlobalIncident,
    emailConfigured,
  } = deps;

  const router = express.Router();

  router.get('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const communityId = getCommunityId(req);
    const { data, error } = await supabase.from('incidents').select('*').eq('community_id', communityId).order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    res.json((data || []).map(incidentFromDb));
  });

  router.post('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const communityId = getCommunityId(req);
    const { reporterUid, reporterName, aptId, aptLabel, date, type, category, desc, isGeneral=false, photos=[] } = req.body;
    if (!reporterUid || !date || !type || !category || !String(desc || '').trim())
      return res.status(400).json({ error: 'Fecha, tipo, categoría y descripción son requeridos.' });
    if (!Array.isArray(photos) || photos.length > 3)
      return res.status(400).json({ error: 'Se permiten máximo 3 fotos.' });
    const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
    for (const p of photos) {
      if (!p || typeof p.data !== 'string' || p.data.length > MAX_PHOTO_BYTES)
        return res.status(400).json({ error: 'Cada foto debe ser base64 de máximo 2 MB. Reduce el tamaño de la imagen.' });
    }

    const appUrl = publicAppUrl(req);
    const step1Policy = await getSlaPolicy('step1_verify', communityId);
    const slaHours = step1Policy.hours;
    const nowIso = new Date().toISOString();

    if (isGeneral) {
      const item = { id:'inc_'+uuidv4().slice(0,8), communityId, reporterUid, reporterName, aptId:null, aptLabel:'', guestName:'', guestCity:'', guestState:'', guestCountry:'', date, type, category, desc, status:'open', isGeneral:true, photos, slaHours, slaEvent:'step1_verify', nextSlaReminderAt:addHoursIso(nowIso, slaHours), slaCycleCount:0, createdAt:nowIso };
      const { data, error } = await supabase.from('incidents').insert(incidentToDb(item, communityId)).select('*').single();
      if (error) return sendSupabaseError(res, error);
      const savedIncident = incidentFromDb(data);
      await auditLog({ entity:'incident', entityId:data.id, action:'create', actorUid:reporterUid, actorName:reporterName, after:data });
      const adminEmails = getGlobalAdminEmails();
      const generalNote = adminEmails.length ? { id:'not_'+uuidv4().slice(0,8), communityId, ownerUid:null, listingId:null, incidentId:savedIncident.id, title:'Nuevo incidente general reportado', message:String(savedIncident.desc||'').slice(0,160), isRead:false, emailSent:false, emailError:'', createdAt:nowIso } : null;
      let generalNoteError = null;
      if (generalNote) {
        const { error: ne } = await supabase.from('notifications').insert(notificationToDb(generalNote));
        if (ne) { generalNoteError = ne; warn('General incident notification save failed: ' + ne.message); }
      }
      res.json({ ...savedIncident, notificationSaved:!generalNoteError, emailQueued:Boolean(emailConfigured), emailSent:false, emailError:emailConfigured?'':'Resend email is not configured in Render.' });
      setImmediate(async () => {
        if (!emailConfigured) return;
        try {
          const notifCfg = await getEmailNotificationConfig();
          const typeCfg = notifCfg['incident_new'] || {};
          const reporterEmail = await getReporterEmail(reporterUid);
          const recips = [];
          if (typeCfg.globalAdmin  !== false) recips.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(communityId));
          if (typeCfg.delegateAdmin !== false) recips.push(...await getDelegateAdminsWithPermission('canResolveIncidents'));
          if (typeCfg.communityAdmin ?? true) recips.push(...await getCommunityAdminEmails(communityId));
          if (typeCfg.reporter !== false && reporterEmail) recips.push(reporterEmail);
          const recipients = normalizeRecipients(recips);
          if (recipients.length) {
            const incidentLink = appUrl + '/?view=incidents&incident=' + savedIncident.id;
            await sendTemplatedEmail({ key:'incident_new', to:recipients, vars:{ apt:'General (sin unidad)', owner:'', operator:'No indicado', operatorEmail:'', guestName:'', date:savedIncident.date||'', type:savedIncident.type||'', category:savedIncident.category||'', status:'open', desc:savedIncident.desc||'', incidentLink, slaCycleCount:'0', pendingStep:'step1', pendingStepLabel:'Admin action required on general incident', pendingStepLabelEs:'Se requiere acción del admin en incidente general' }, relatedEntity:'incident', relatedId:savedIncident.id });
          }
          if (generalNote) await supabase.from('notifications').update({ email_sent:true, email_error:'' }).eq('id', generalNote.id);
        } catch(mailError) {
          warn('General incident email failed: ' + (mailError?.message || mailError));
          if (generalNote) await supabase.from('notifications').update({ email_sent:false, email_error:mailError?.message||'Email failed' }).eq('id', generalNote.id);
        }
      });
      return;
    }

    if (!aptId) return res.status(400).json({ error: 'Apartamento es requerido para incidentes de unidad.' });
    const { data: listing, error: listingError } = await supabase.from('listings').select('*').eq('id', aptId).eq('status','approved').single();
    if (listingError || !listing) return res.status(404).json({ error: 'Listing not found for selected apartment.' });

    const incCommunityId = listing.community_id || communityId;
    // Re-resolve policy with the listing's community in case it differs from the request's.
    const incStep1Policy = incCommunityId === communityId ? step1Policy : await getSlaPolicy('step1_verify', incCommunityId);
    const incSlaHours = incStep1Policy.hours;
    const item = { id:'inc_'+uuidv4().slice(0,8), communityId:incCommunityId, reporterUid, reporterName, aptId, aptLabel: aptLabel || ('Apto ' + listing.apt), guestName:'', guestCity:'', guestState:'', guestCountry:'', date, type, category, desc, status:'open', isGeneral:false, photos, slaHours: incSlaHours, slaEvent:'step1_verify', nextSlaReminderAt:addHoursIso(nowIso, incSlaHours), slaCycleCount:0, createdAt:nowIso };
    const { data, error } = await supabase.from('incidents').insert(incidentToDb(item, incCommunityId)).select('*').single();
    if (error) return sendSupabaseError(res, error);
    const savedIncident = incidentFromDb(data);
    await auditLog({ entity:'incident', entityId:data.id, action:'create', actorUid:reporterUid, actorName:reporterName, after:data });
    const notification = { id:'not_'+uuidv4().slice(0,8), communityId:incCommunityId, ownerUid:listing.owner_uid, listingId:listing.id, incidentId:savedIncident.id, title:'Nuevo incidente abierto - Apto '+listing.apt, message:String(savedIncident.desc||'').slice(0,160), isRead:false, emailSent:false, emailError:'', createdAt:new Date().toISOString() };
    const { error: notificationError } = await supabase.from('notifications').insert(notificationToDb(notification));
    if (notificationError) warn('Notification save failed: ' + notificationError.message);
    res.json({ ...savedIncident, notificationSaved:!notificationError, emailQueued:Boolean(emailConfigured), emailSent:false, emailError:emailConfigured?'':'Resend email is not configured in Render.' });
    setImmediate(async () => {
      const emailStatus = { email_sent: false, email_error: '' };
      try {
        const emailResult = await Promise.race([
          sendIncidentEmail({ listing: listingFromDb(listing), incident: savedIncident, appUrl }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timed out after 12 seconds')), 12000)),
        ]);
        emailStatus.email_sent = Boolean(emailResult.sent);
        emailStatus.email_error = emailResult.sent ? '' : (emailResult.reason || 'Email not sent');
      } catch (mailError) {
        warn('Incident email failed: ' + (mailError?.message || mailError));
        emailStatus.email_sent = false;
        emailStatus.email_error = mailError?.message || 'Email failed';
      }
      if (!notificationError) {
        const { error: updateEmailError } = await supabase.from('notifications').update(emailStatus).eq('id', notification.id);
        if (updateEmailError) warn('Notification email status update failed: ' + updateEmailError.message);
      }
    });
  });

  router.patch('/:id/viewed', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid } = req.body || {};
    const { data: inc, error: findErr } = await supabase.from('incidents').select('*, listings(owner_uid)').eq('id', req.params.id).single();
    if (findErr || !inc) return res.status(404).json({ error:'Incidente no encontrado.' });
    if (inc.listings?.owner_uid !== ownerUid) return res.status(403).json({ error:'Solo el propietario puede marcar visto.' });
    const { data, error } = await supabase.from('incidents').update({ owner_viewed_at:new Date().toISOString() }).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    res.json(incidentFromDb(data));
  });

  router.patch('/:id/verify', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, guests, guestNames, guestCity, guestCountry, ownerComments, ownerResolution } = req.body || {};
    if (!ownerUid) return res.status(400).json({ error:'ownerUid is required.' });
    let ownerGuests = normalizeOwnerGuestsPayload(guests);
    if (!ownerGuests.length && String(guestNames || '').trim()) {
      ownerGuests = String(guestNames).split(',').map(x => x.trim()).filter(Boolean).map(name => {
        const parts = name.split(/\s+/);
        return { firstName: parts[0] || name, middleName: parts.length > 2 ? parts.slice(1,-1).join(' ') : '', lastName: parts.length > 1 ? parts[parts.length-1] : '', city:String(guestCity||'').trim(), country:String(guestCountry||'').trim() };
      });
    }
    if (!ownerGuests.length) return res.status(400).json({ error:'Debe indicar al menos un huésped.' });
    for (const [idx, g] of ownerGuests.entries()) {
      if (!g.firstName) return res.status(400).json({ error:`Debe indicar el nombre del huésped #${idx+1}.` });
      if (!g.lastName) return res.status(400).json({ error:`Debe indicar el apellido del huésped #${idx+1}.` });
      if (!g.city) return res.status(400).json({ error:`Debe indicar la ciudad del huésped #${idx+1}.` });
      if (!g.country) return res.status(400).json({ error:`Debe indicar el país del huésped #${idx+1}.` });
    }
    const { data: inc, error: findErr } = await supabase.from('incidents').select('*, listings(*)').eq('id', req.params.id).single();
    if (findErr || !inc) return res.status(404).json({ error:'Incidente no encontrado.' });
    if (inc.listings?.owner_uid !== ownerUid) return res.status(403).json({ error:'Solo el propietario puede verificar este incidente.' });
    const names = ownerGuests.map(ownerGuestFullName).filter(Boolean).join(', ');
    const cities = [...new Set(ownerGuests.map(g=>g.city).filter(Boolean))].join(', ');
    const countries = [...new Set(ownerGuests.map(g=>g.country).filter(Boolean))].join(', ');
    const ownerCommentText = String(ownerComments || '').trim();
    if (!ownerCommentText) return res.status(400).json({ error:'La acción inmediata del propietario es requerida.' });
    const ownerResolutionText = String(ownerResolution || '').trim();
    const nowIso = new Date().toISOString();
    const incCommunityId = inc.community_id || 'kai';
    // After verify: if owner already provided their Step 2 resolution, start
    // the admin_close clock; otherwise wait on step2_resolve.
    const nextSlaEvent = ownerResolutionText ? 'admin_close' : 'step2_resolve';
    const nextSlaPolicy = await getSlaPolicy(nextSlaEvent, incCommunityId);
    const upd = { status:'verified', owner_guests: ownerGuests, owner_guest_names:names, owner_guest_city:cities, owner_guest_country:countries, owner_comments:ownerCommentText, owner_resolution:ownerResolutionText, owner_resolution_at: ownerResolutionText ? nowIso : null, owner_verified_at:nowIso, sla_event: nextSlaEvent, sla_hours: nextSlaPolicy.hours, sla_cycle_count: 0, next_sla_reminder_at: addHoursIso(nowIso, nextSlaPolicy.hours) };
    const { data, error } = await supabase.from('incidents').update(upd).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'incident', entityId:data.id, action:'verify', actorUid:ownerUid, before:inc, after:data });
    const verifiedIncident = incidentFromDb(data);
    setImmediate(() => sendIncidentVerifiedEmail({ listing: listingFromDb(inc.listings), incident: verifiedIncident, appUrl: publicAppUrl(req) }).catch(e => warn('Incident verified email failed: ' + (e?.message || e))));
    res.json(verifiedIncident);
  });

  router.patch('/:id/add-resolution', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, ownerResolution } = req.body || {};
    if (!ownerUid) return res.status(400).json({ error:'ownerUid is required.' });
    const resText = String(ownerResolution || '').trim();
    if (!resText) return res.status(400).json({ error:'La respuesta del propietario es requerida.' });
    const { data: inc, error: findErr } = await supabase.from('incidents').select('*, listings(*)').eq('id', req.params.id).single();
    if (findErr || !inc) return res.status(404).json({ error:'Incidente no encontrado.' });
    if (inc.listings?.owner_uid !== ownerUid) return res.status(403).json({ error:'Solo el propietario puede agregar la resolución.' });
    if (inc.status !== 'verified') return res.status(400).json({ error:'Solo se puede agregar resolución a incidentes verificados.' });
    // Owner has done Step 2 — switch the SLA clock to admin_close so admins
    // are bounded too. Cycle count resets for the new event.
    const arNowIso = new Date().toISOString();
    const arCommunityId = inc.community_id || 'kai';
    const adminClosePolicy = await getSlaPolicy('admin_close', arCommunityId);
    const { data, error } = await supabase.from('incidents').update({ owner_resolution: resText, owner_resolution_at: arNowIso, sla_event: 'admin_close', sla_hours: adminClosePolicy.hours, sla_cycle_count: 0, next_sla_reminder_at: addHoursIso(arNowIso, adminClosePolicy.hours) }).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'incident', entityId:data.id, action:'add-resolution', actorUid:ownerUid, before:inc, after:data });
    const updatedIncident = incidentFromDb(data);
    setImmediate(() => sendIncidentResolutionAddedEmail({ listing: listingFromDb(inc.listings), incident: updatedIncident, appUrl: publicAppUrl(req) }).catch(e => warn('Add-resolution email failed: ' + (e?.message || e))));
    res.json(updatedIncident);
  });

  router.patch('/:id/assign', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid='', actorEmail='', aptId='' } = req.body || {};
    if (!actorUid || !actorEmail || !aptId) return res.status(400).json({ error:'actorUid, actorEmail y aptId son requeridos.' });
    if (!(await deps.isGlobalAdmin(actorUid, actorEmail)) && !(await hasDelegatePermission(actorUid, actorEmail, 'canResolveIncidents')))
      return res.status(403).json({ error:'Solo administradores con permiso canResolveIncidents pueden asignar incidentes.' });
    const { data: existing, error: findError } = await supabase.from('incidents').select('*').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error:'Incident not found.' });
    if (!existing.is_general) return res.status(400).json({ error:'Solo los incidentes generales pueden asignarse a una unidad.' });
    const { data: listing, error: listingError } = await supabase.from('listings').select('*').eq('id', aptId).eq('status','approved').single();
    if (listingError || !listing) return res.status(404).json({ error:'Listing not found for selected apartment.' });
    const { data, error } = await supabase.from('incidents').update({ apt_id:aptId, apt_label:'Apto '+listing.apt, is_general:false }).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'incident', entityId:data.id, action:'assign', actorUid, actorEmail, before:existing, after:data });
    const updatedIncident = incidentFromDb(data);
    if (listing.owner_uid) {
      try {
        const note = { id:'not_'+uuidv4().slice(0,8), ownerUid:listing.owner_uid, listingId:listing.id, incidentId:data.id, title:'Incidente asignado a tu unidad - Apto '+listing.apt, message:String(existing.description||'').slice(0,160), isRead:false, emailSent:false, emailError:'', createdAt:new Date().toISOString() };
        await supabase.from('notifications').insert(notificationToDb(note));
      } catch(e) { warn('Assign notification insert failed: ' + (e?.message || e)); }
    }
    setImmediate(() => sendIncidentEmail({ listing:listingFromDb(listing), incident:updatedIncident, appUrl:publicAppUrl(req) }).catch(e => warn('Assign incident email failed: ' + (e?.message || e))));
    res.json(updatedIncident);
  });

  router.patch('/:id/close-general', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid='', actorEmail='', action:closingAction='', resolution='', resolutionComments='' } = req.body || {};
    if (!actorUid || !actorEmail) return res.status(400).json({ error:'actorUid y actorEmail son requeridos.' });
    if (!String(closingAction||'').trim() || !String(resolution||'').trim()) return res.status(400).json({ error:'action y resolution son requeridos.' });
    const { data: existing, error: findError } = await supabase.from('incidents').select('*').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error:'Incident not found.' });
    if (!existing.is_general) return res.status(400).json({ error:'Este endpoint solo cierra incidentes generales.' });
    const incCommunityId = existing.community_id || getCommunityId(req);
    const canClose = await hasDelegatePermission(actorUid, actorEmail, 'canResolveIncidents') ||
      await hasCommunityAdminPerm(actorUid, actorEmail, incCommunityId, 'canResolveIncidents');
    if (!canClose)
      return res.status(403).json({ error:'Solo administradores con permiso canResolveIncidents pueden cerrar incidentes generales.' });
    if (existing.status === 'resolved') return res.status(400).json({ error:'El incidente ya está resuelto.' });
    const nowIso = new Date().toISOString();
    const upd = { status:'resolved', owner_comments:String(closingAction).trim(), owner_resolution:String(resolution).trim(), resolution_comments:String(resolutionComments||'').trim(), resolved_at:nowIso, resolved_by:actorEmail, sla_event:null, next_sla_reminder_at:null };
    const { data, error } = await supabase.from('incidents').update(upd).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'incident', entityId:data.id, action:'close-general', actorUid, actorEmail, before:existing, after:data });
    const resolvedIncident = incidentFromDb(data);
    setImmediate(async () => {
      if (!emailConfigured) return;
      try {
        const closeCommunityId = existing.community_id || 'kai';
        const notifCfg = await getEmailNotificationConfig();
        const typeCfg = notifCfg['incident_resolved'] || {};
        const reporterEmail = await getReporterEmail(existing.reporter_uid);
        const recips = [];
        if (typeCfg.globalAdmin  !== false) recips.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(closeCommunityId));
        if (typeCfg.delegateAdmin !== false) recips.push(...await getDelegateAdminsWithPermission('canResolveIncidents'));
        if (typeCfg.communityAdmin ?? true) recips.push(...await getCommunityAdminEmails(closeCommunityId));
        if (typeCfg.reporter !== false && reporterEmail) recips.push(reporterEmail);
        const recipients = normalizeRecipients(recips);
        if (recipients.length) {
          const incidentLink = publicAppUrl() + '/?view=incidents&incident=' + resolvedIncident.id;
          const reporterName = existing.reporter_name || await getReporterName(existing.reporter_uid);
          await sendTemplatedEmail({ key:'incident_resolved', to:recipients, vars:{ apt:'General', owner:'', operator:'No indicado', operatorEmail:'', resolvedBy:actorEmail, resolutionComments:String(resolutionComments||'').trim(), ownerAnswer:String(resolution).trim(), date:resolvedIncident.date||'', type:resolvedIncident.type||'', category:resolvedIncident.category||'', incidentLink, reporterName }, relatedEntity:'incident', relatedId:resolvedIncident.id });
        }
      } catch(e) { warn('Close-general resolved email failed: ' + (e?.message || e)); }
    });
    res.json(resolvedIncident);
  });

  router.patch('/:id/resolve', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid='', actorEmail='', actorName='', resolutionComments='' } = req.body || {};
    const comments = String(resolutionComments || '').trim();
    if (!comments) return res.status(400).json({ error:'Los comentarios de resolución son requeridos.' });
    const { data: existing, error: findError } = await supabase.from('incidents').select('*, listings(*)').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error: 'Not found' });
    const ownerUid = existing.listings?.owner_uid || '';
    const communityId = existing.community_id || getCommunityId(req);
    const canResolve = await hasDelegatePermission(actorUid, actorEmail, 'canResolveIncidents') ||
      await hasCommunityAdminPerm(actorUid, actorEmail, communityId, 'canResolveIncidents');
    if (!canResolve) return res.status(403).json({ error:'Only global admins or delegates with resolve permission can resolve incidents.' });
    const ownerGuests = Array.isArray(existing.owner_guests) ? existing.owner_guests : [];
    if (!existing.is_general) {
      if (existing.status !== 'verified' || !existing.owner_verified_at || !ownerGuests.length || !String(existing.owner_comments || '').trim()) {
        return res.status(400).json({ error:'Owner must verify the incident with guest(s), city, country, and immediate action before resolution.' });
      }
      if (!String(existing.owner_resolution || '').trim()) {
        return res.status(400).json({ error:'Owner must provide their answer before this incident can be closed.' });
      }
    } else if (existing.status === 'resolved') {
      return res.status(400).json({ error:'El incidente ya está resuelto.' });
    }
    const upd = { status: 'resolved', resolution_comments: comments, resolved_at: new Date().toISOString(), resolved_by: actorEmail || actorName || actorUid, sla_event: null, next_sla_reminder_at: null };
    const { data, error } = await supabase.from('incidents').update(upd).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'incident', entityId:data.id, action:'resolve', actorUid, actorEmail, actorName, before:existing, after:data });
    if (ownerUid) {
      try {
        const note = { id:'not_'+uuidv4().slice(0,8), ownerUid, listingId:existing.apt_id||null, incidentId:data.id, title:'Incidente resuelto - Apto '+(existing.listings?.apt||''), message:`Tu incidente fue resuelto por ${actorName||actorEmail||'un administrador'}.`, isRead:false, emailSent:false, emailError:'', createdAt:new Date().toISOString() };
        await supabase.from('notifications').insert(notificationToDb(note));
      } catch(e) { warn('Resolved notification insert failed: ' + (e?.message || e)); }
    }
    const resolvedIncident = incidentFromDb(data);
    setImmediate(() => sendIncidentResolvedEmail({ listing: listingFromDb(existing.listings), incident: resolvedIncident, appUrl: publicAppUrl(req) }).catch(e => warn('Incident resolved email failed: ' + (e?.message || e))));
    res.json(resolvedIncident);
  });

  router.delete('/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { reporterUid, actorEmail } = req.body;
    const { data: existing, error: findError } = await supabase.from('incidents').select('*').eq('id', req.params.id).single();
    if (findError || !existing) return res.status(404).json({ error: 'Not found' });
    if (!(await canDeleteGlobalIncident(reporterUid, actorEmail)))
      return res.status(403).json({ error: 'Solo administradores globales o delegados con permiso "Eliminar incidentes" pueden eliminar incidentes.' });
    const { error } = await supabase.from('incidents').delete().eq('id', req.params.id);
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'incident', entityId:existing.id, action:'delete', actorUid:reporterUid, actorEmail, before:existing });
    res.json({ ok: true });
  });

  return router;
};
