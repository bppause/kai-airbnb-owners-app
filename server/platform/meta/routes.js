// Platform meta routes — bootstrap-time concerns that don't belong to any
// feature module:
//   POST /api/client-log   (browser-side error reports)
//   GET  /api/health       (DB + email reachability)
//   GET  /api/version      (build timestamp from client/dist/build-meta.json)
//   GET  /api/branding     (community-aware branding bundle for the SPA shell)
//
// Lifted byte-identical from server.js stage 4k. Mounted by server.js at the
// canonical paths (no /api/platform/meta/ prefix — these endpoints have been
// at /api/* forever and the SPA hits them by their bare names).

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { warn } = require('../../../logger');

module.exports = function createMetaRouter(deps) {
  const {
    supabase, isSupabaseConfigured,
    emailConfigured, emailProvider, emailFrom,
    distPath,
    getCommunityId, getAppConfig,
  } = deps;

  const router = express.Router();

  // POST /client-log — browser diagnostics → Render logs
  router.post('/client-log', (req, res) => {
    try {
      const body = req.body || {};
      warn('[CLIENT_LOG] ' + JSON.stringify({ section:body.section, message:body.message, status:body.status, url:body.url, ts:body.ts || new Date().toISOString() }).slice(0, 2000));
      if (body.stack) warn('[CLIENT_LOG_STACK] ' + String(body.stack).slice(0, 3000));
    } catch(e) { warn('[CLIENT_LOG_ERROR] ' + (e?.message || e)); }
    res.json({ ok:true });
  });

  // GET /health — Supabase + email reachability
  router.get('/health', async (req, res) => {
    const result = { ok: false, configured: isSupabaseConfigured, storage: 'supabase', tables: ['listings', 'incidents', 'notifications', 'listing_audit_events', 'audit_logs'], time: new Date().toISOString() };

    if (!isSupabaseConfigured) {
      result.error = 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Render Environment.';
      return res.status(500).json(result);
    }

    const listingsCheck = await supabase.from('listings').select('id', { count: 'exact', head: true });
    const incidentsCheck = await supabase.from('incidents').select('id', { count: 'exact', head: true });
    const notificationsCheck = await supabase.from('notifications').select('id', { count: 'exact', head: true });
    const auditCheck = await supabase.from('listing_audit_events').select('id', { count: 'exact', head: true });
    const auditLogsCheck = await supabase.from('audit_logs').select('id', { count: 'exact', head: true });

    if (listingsCheck.error || incidentsCheck.error || notificationsCheck.error || auditCheck.error || auditLogsCheck.error) {
      result.error = listingsCheck.error?.message || incidentsCheck.error?.message || notificationsCheck.error?.message || auditCheck.error?.message || auditLogsCheck.error?.message;
      result.listings = listingsCheck.error ? 'error' : 'ok';
      result.incidents = incidentsCheck.error ? 'error' : 'ok';
      result.notifications = notificationsCheck.error ? 'error' : 'ok';
      result.auditTrail = auditCheck.error ? 'error' : 'ok';
      return res.status(500).json(result);
    }

    result.ok = true;
    result.listings = 'ok';
    result.incidents = 'ok';
    result.notifications = 'ok';
    result.auditTrail = 'ok';
    result.emailProvider = emailProvider;
    result.emailConfigured = emailConfigured;
    result.emailFrom = emailFrom;
    result.counts = { listings: listingsCheck.count || 0, incidents: incidentsCheck.count || 0, notifications: notificationsCheck.count || 0, auditEvents: auditCheck.count || 0 };
    res.json(result);
  });

  // GET /version — build timestamp from client/dist/build-meta.json
  router.get('/version', (req, res) => {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(distPath, 'build-meta.json'), 'utf8'));
      res.json({ buildTime: meta.buildTime || '' });
    } catch(e) {
      res.json({ buildTime: '' });
    }
  });

  // GET /branding — community-aware branding bundle for the SPA shell
  router.get('/branding', async (req, res) => {
    try {
      const communityId = getCommunityId(req);
      const cfg = await getAppConfig(communityId);
      res.json({
        communityId,
        complexNameEs: cfg.complex_name_es || 'Propietarios Airbnb KAI',
        complexNameEn: cfg.complex_name_en || 'KAI Airbnb Owners',
        complexLocation: cfg.complex_location || 'Serena del Mar · Cartagena 🇨🇴',
        complexLogo: cfg.complex_logo || '',
        complexBg: cfg.complex_bg || '/morros-kai-bg.jpg',
      });
    } catch(e) { res.json({ communityId:'kai', complexNameEs:'Propietarios Airbnb KAI', complexNameEn:'KAI Airbnb Owners', complexLocation:'Serena del Mar · Cartagena 🇨🇴', complexLogo:'', complexBg:'/morros-kai-bg.jpg' }); }
  });

  return router;
};
