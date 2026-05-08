// Users — platform-level user profile + reputation routes.
//
// Mounted by server.js at:
//   /api/platform/users/*    (canonical)
//   /api/users/*             (legacy alias)
//
// Lifted verbatim from server.js stage 3d. Owns the `app_users` table
// reads/writes for end-user profile concerns. Admin-side user management
// (delegate role assignment, listing all users) lives in
// server/platform/admin/.

const express = require('express');
const { warn } = require('../../../logger');

module.exports = function createUsersRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError,
    isValidEmail,
  } = deps;

  const router = express.Router();

  // PUT /preference     — language preference
  router.put('/preference', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email, name, language } = req.body || {};
    if (!uid || !email) return res.status(400).json({ error:'uid and email are required.' });
    const lang = ['es-CO','en'].includes(language) ? language : 'es-CO';
    const { error } = await supabase.from('app_users').upsert({ uid, email:String(email).toLowerCase(), name:name||'', language_preference:lang, updated_at:new Date().toISOString() }, { onConflict:'uid' });
    if (error) return sendSupabaseError(res, error);
    res.json({ ok:true, language:lang });
  });

  // GET /profile        — owner profile (whatsapp, country, notification email)
  router.get('/profile', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const uid = String(req.query.uid || '').trim();
    if (!uid) return res.status(400).json({ error:'uid is required.' });
    let { data, error } = await supabase.from('app_users').select('whatsapp,country,notification_email').eq('uid', uid).maybeSingle();
    if (error && String(error.message || '').includes('notification_email')) {
      ({ data, error } = await supabase.from('app_users').select('whatsapp,country').eq('uid', uid).maybeSingle());
    }
    if (error) return sendSupabaseError(res, error);
    res.json({ whatsapp: data?.whatsapp || '', country: data?.country || 'Colombia', notificationEmail: data?.notification_email || '' });
  });

  // PUT /profile        — update owner profile + propagate to listings
  router.put('/profile', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email, whatsapp, country, notificationEmail } = req.body || {};
    if (!uid || !email) return res.status(400).json({ error:'uid and email are required.' });
    const waRaw = String(whatsapp || '').trim();
    const waDigits = waRaw.replace(/[^0-9]/g, '');
    const wa = waRaw ? (waRaw.startsWith('+') ? waRaw : (waDigits.length >= 10 ? '+' + waDigits : waRaw)) : '';
    const em = String(email).toLowerCase();
    const countryVal = String(country || 'Colombia').trim();
    const notifEmailRaw = String(notificationEmail || '').trim().toLowerCase();
    const notifEmail = notifEmailRaw && isValidEmail(notifEmailRaw) ? notifEmailRaw : '';
    const effectiveEmail = notifEmail || em;
    const { error } = await supabase.from('app_users').upsert({
      uid, email: em, whatsapp: wa, country: countryVal, updated_at: new Date().toISOString()
    }, { onConflict: 'uid' });
    if (error) return sendSupabaseError(res, error);
    const { error: neErr } = await supabase.from('app_users').update({ notification_email: notifEmail }).eq('uid', uid);
    if (neErr) warn('notification_email save failed (run schema migration): ' + (neErr.message || neErr));
    if (wa || effectiveEmail) {
      await supabase.from('listings').update({ contact: wa, email: effectiveEmail }).eq('owner_uid', uid).in('status', ['approved', 'pending']);
    }
    res.json({ ok: true, whatsapp: wa, country: countryVal, notificationEmail: notifEmail });
  });

  // GET /reputation     — community-reputation score (5-axis breakdown)
  router.get('/reputation', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const uid = String(req.query.uid || '').trim();
    if (!uid) return res.status(400).json({ error:'uid required' });
    try {
      const [appUserRes, incAsReporterRes, incAsOwnerRes, listingsRes] = await Promise.all([
        supabase.from('app_users').select('uid,name,whatsapp,email,created_at').eq('uid', uid).maybeSingle(),
        supabase.from('incidents').select('id,status,created_at').eq('reporter_uid', uid),
        supabase.from('incidents').select('id,status,created_at,owner_resolution_at').eq('owner_uid', uid).not('owner_resolution_at','is',null),
        supabase.from('listings').select('id,apt,status').eq('owner_uid', uid),
      ]);
      const appUser = appUserRes.data;
      const asReporter = incAsReporterRes.data || [];
      const asOwner = incAsOwnerRes.data || [];

      const profilePts = (!appUser ? 0 : (appUser.whatsapp ? 10 : 0) + (appUser.name ? 10 : 0));

      const reportCount = asReporter.length;
      const reportPts = Math.min(reportCount * 5, 50);

      const resolvedReports = asReporter.filter(i => i.status === 'resolved').length;
      const resolvedRatio = reportCount > 0 ? resolvedReports / reportCount : 0;
      const resolvedPts = Math.round(resolvedRatio * 30);

      let responsePts = 0;
      if (asOwner.length > 0) {
        const avgHrs = asOwner.reduce((sum, i) => {
          const hrs = (new Date(i.owner_resolution_at) - new Date(i.created_at)) / 3600000;
          return sum + (isNaN(hrs) ? 48 : hrs);
        }, 0) / asOwner.length;
        responsePts = avgHrs <= 24 ? 20 : avgHrs <= 48 ? 12 : avgHrs <= 72 ? 6 : 0;
      }

      const joinedAt = appUser?.created_at ? new Date(appUser.created_at) : new Date();
      const tenureDays = Math.max(0, (Date.now() - joinedAt) / 86400000);
      const tenurePts = Math.min(Math.floor(tenureDays / 30) * 2, 20);

      const total = profilePts + reportPts + resolvedPts + responsePts + tenurePts;
      const maxPts = 140;
      const score = Math.round((total / maxPts) * 100);

      const tier = score >= 71 ? 'pillar' : score >= 36 ? 'active' : 'resident';
      const tierEs = tier === 'pillar' ? 'Pilar de la Comunidad' : tier === 'active' ? 'Miembro Activo' : 'Residente';
      const tierEn = tier === 'pillar' ? 'Community Pillar' : tier === 'active' ? 'Active Member' : 'Resident';

      res.json({
        score, tier, tierEs, tierEn,
        breakdown: { profilePts, reportPts, resolvedPts, responsePts, tenurePts, total, maxPts },
        stats: { reportCount, resolvedReports, responseCount: asOwner.length, tenureDays: Math.floor(tenureDays), listingCount: (listingsRes.data||[]).length },
      });
    } catch(e) { warn('Reputation calc failed: ' + (e?.message || e)); res.status(500).json({ error: e?.message || String(e) }); }
  });

  return router;
};
