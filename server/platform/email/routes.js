// Email — platform-level email template administration + ad-hoc contact send.
//
// Mounted by server.js at:
//   /api/platform/email/*    (canonical)
//
// Legacy alias forwarders in server.js cover:
//   /api/admin/email-templates           → /api/platform/email/templates
//   /api/admin/email-notification-config → /api/platform/email/notification-config
//   /api/contact/send-email              → /api/platform/email/contact
//
// Lifted verbatim from server.js stage 3d. The actual email-send helpers
// (sendTemplatedEmail, sendIncidentEmail, …) stay in server.js and are
// passed into other modules via deps; this folder owns the *admin* surface
// for templates/config + the contact-form send path.

const express = require('express');
const { warn } = require('../../../logger');

module.exports = function createEmailRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError,
    log,
    isGlobalAdmin, isCommunityAdmin,
    normalizeLanguage, normalizeRecipients,
    getEmailTemplates, getEmailNotificationConfig,
    DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_NOTIFICATION_CONFIG,
    auditLog,
    escapeHtml, sendSpanishEmail,
  } = deps;

  const router = express.Router();

  // GET /templates              — read template defaults + community overrides
  router.get('/templates', async (req, res) => {
    log('[ADMIN] email-templates requested by ' + String(req.query?.email || ''));
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    const language = String(req.query.language || 'es-CO');
    const requestedCommunityId = String(req.query.communityId || '__global__').trim();
    const globalAdmin = await isGlobalAdmin(uid, email);
    if (!globalAdmin) {
      if (!uid) return res.status(403).json({ error:'Autenticación requerida.' });
      if (requestedCommunityId === '__global__') return res.status(403).json({ error:'Solo un administrador global puede ver plantillas globales.' });
      const communityAdminCheck = await isCommunityAdmin(uid, email, requestedCommunityId);
      if (!communityAdminCheck) return res.status(403).json({ error:'Solo un administrador global o de comunidad puede ver plantillas de email.' });
    }
    res.json({ templates: await getEmailTemplates(language, requestedCommunityId), communityId: requestedCommunityId, variables: {
      incident_new:['apt','owner','operator','operatorEmail','guestName','date','type','category','status','desc','incidentLink'],
      incident_sla:['apt','owner','operator','operatorEmail','guestName','date','type','category','status','desc','incidentLink','slaCycleCount','pendingStep','pendingStepLabel','pendingStepLabelEs'],
      incident_sla_notification:['apt','owner','operator','operatorEmail','guestName','date','type','category','status','desc','incidentLink','slaCycleCount','pendingStep','pendingStepLabel','pendingStepLabelEs'],
      incident_sla_reminder:['apt','owner','operator','operatorEmail','guestName','date','type','category','status','desc','incidentLink','slaCycleCount','pendingStep','pendingStepLabel','pendingStepLabelEs'],
      incident_verified:['apt','owner','operator','operatorEmail','ownerGuestNames','ownerGuestCity','ownerGuestCountry','ownerComments','ownerAnswer','incidentLink'],
      incident_resolution_added:['apt','owner','operator','operatorEmail','ownerGuestNames','ownerGuestCity','ownerGuestCountry','ownerComments','ownerAnswer','incidentLink'],
      incident_resolved:['apt','owner','operator','operatorEmail','resolvedBy','resolutionComments','ownerAnswer','date','type','category','incidentLink','reporterName'],
      registration_submitted:['userName','userEmail','registrationLink'],
      registration_approved:['userName','userEmail','dashboardLink'],
      registration_declined:['userName','userEmail','reason','reasonLine','reasonHtml','reasonLineEn','reasonHtmlEn','registrationLink'],
      registration_reviewer:['reviewerName','userName','userEmail','approvalsLink'],
      incident_general_sla:['apt','desc','type','category','slaCycleCount','slaHours','incidentLink','pendingStep','pendingStepLabel','pendingStepLabelEs'],
      listing_created:['apt','owner','listingEmail','listingLink'],
      listing_updated:['apt','owner','listingEmail','listingLink'],
      listing_deleted:['apt','owner','listingEmail']
    }});
  });

  // PUT /templates              — upsert template overrides for a community
  router.put('/templates', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, templates } = req.body || {};
    const language = normalizeLanguage(req.body?.language || 'es-CO');
    const requestedCommunityId = String(req.body?.communityId || '__global__').trim();
    const globalAdmin = await isGlobalAdmin(actorUid, actorEmail);
    if (!globalAdmin) {
      if (!actorUid) return res.status(403).json({ error:'Autenticación requerida.' });
      if (requestedCommunityId === '__global__') return res.status(403).json({ error:'Solo un administrador global puede actualizar plantillas globales.' });
      const caCheck = await isCommunityAdmin(actorUid, actorEmail, requestedCommunityId);
      if (!caCheck) return res.status(403).json({ error:'Solo un administrador global o de comunidad puede actualizar plantillas de email.' });
      const { data: oeRow } = await supabase.from('community_config').select('value').eq('community_id', requestedCommunityId).eq('key', 'config_overrides_enabled').maybeSingle();
      if (oeRow?.value !== 'true') return res.status(403).json({ error:'Los overrides no están habilitados para esta comunidad. Pide al admin global que los habilite.' });
    }
    const communityId = requestedCommunityId;
    if (!templates || typeof templates !== 'object') return res.status(400).json({ error:'templates is required.' });
    for (const [key, t] of Object.entries(templates)) {
      if (!DEFAULT_EMAIL_TEMPLATES[key]) continue;
      const row = { community_id:communityId, key, language:String(language || 'es-CO'), label:String(t.label || DEFAULT_EMAIL_TEMPLATES[key].label || key), subject:String(t.subject || DEFAULT_EMAIL_TEMPLATES[key].subject || ''), text:String(t.text || DEFAULT_EMAIL_TEMPLATES[key].text || ''), html:String(t.html || DEFAULT_EMAIL_TEMPLATES[key].html || ''), updated_at:new Date().toISOString(), updated_by_email:String(actorEmail || '').toLowerCase() };
      const { error } = await supabase.from('email_templates').upsert(row, { onConflict:'community_id,key,language' });
      if (error) return sendSupabaseError(res, error);
    }
    await auditLog({ entity:'email_templates', entityId:String(communityId + ':' + language), action:'update', actorUid:actorUid, actorEmail:actorEmail, after:templates });
    res.json({ ok:true, templates: await getEmailTemplates(language, communityId), communityId });
  });

  // GET /notification-config    — read notification routing matrix
  router.get('/notification-config', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error:'Global admin only.' });
    res.json({ config: await getEmailNotificationConfig(), defaults: DEFAULT_EMAIL_NOTIFICATION_CONFIG });
  });

  // PUT /notification-config    — write notification routing matrix
  router.put('/notification-config', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, config } = req.body || {};
    if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Global admin only.' });
    if (!config || typeof config !== 'object') return res.status(400).json({ error:'config object required.' });
    const merged = {};
    for (const [key, def] of Object.entries(DEFAULT_EMAIL_NOTIFICATION_CONFIG)) {
      const incoming = (config[key] && typeof config[key] === 'object') ? config[key] : {};
      merged[key] = { enabled: Boolean(incoming.enabled ?? def.enabled), owner: Boolean(incoming.owner ?? def.owner), operator: Boolean(incoming.operator ?? def.operator), globalAdmin: Boolean(incoming.globalAdmin ?? def.globalAdmin), delegateAdmin: Boolean(incoming.delegateAdmin ?? def.delegateAdmin) };
    }
    const { error } = await supabase.from('app_config').upsert({ key:'email_notification_config', value:JSON.stringify(merged) }, { onConflict:'key' });
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'app_config', entityId:'email_notification_config', action:'update', actorUid, actorEmail, after:merged });
    res.json({ ok:true, config: merged });
  });

  // POST /contact                — ad-hoc contact form (signed-in user → recipient)
  router.post('/contact', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, actorName, to, toName, subject, message } = req.body || {};
    const recipient = normalizeRecipients(to)[0];
    if (!actorUid || !actorEmail) return res.status(401).json({ error:'Debe iniciar sesión para enviar email.' });
    if (!recipient) return res.status(400).json({ error:'El email del destinatario es requerido.' });
    if (!String(subject || '').trim() || !String(message || '').trim()) return res.status(400).json({ error:'Asunto y mensaje son requeridos.' });
    try {
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#17313a"><h2 style="color:#2F4F3A">${escapeHtml(subject)}</h2><p>${escapeHtml(message).replace(/\n/g,'<br/>')}</p><hr/><p style="font-size:12px;color:#607063">Enviado desde Propietarios Airbnb KAI por ${escapeHtml(actorName || actorEmail)} (${escapeHtml(actorEmail)}).</p></div>`;
      const result = await sendSpanishEmail({ to:recipient, subject:String(subject).trim(), text:String(message || '') + `\n\nEnviado por ${actorName || actorEmail} (${actorEmail})`, html });
      await auditLog({ entity:'contact_email', entityId:recipient, action:'send', actorUid, actorEmail, after:{ to:recipient, toName, subject, sent:result.sent, skipped:result.skipped, reason:result.reason || '' } });
      res.json({ ok:true, email:result });
    } catch(e) {
      warn('Contact email failed: ' + (e?.message || e));
      res.status(500).json({ error:e?.message || 'No se pudo enviar el email.' });
    }
  });

  return router;
};
