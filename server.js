const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { log, warn, error } = require('./logger');

// ─── CORE HELPERS (extracted in stage 4a) ────────────────────────────────────
// Pure utilities and DB converters live in server/core/. Modules destructure
// these names from deps; server.js re-binds them at module scope here.
const {
  safeJsonObject, normalizeRole, normalizeRecipients,
  escapeHtml, publicAppUrl, normalizeLanguage, addHoursIso, normalizeApt,
  isThreeDigitApt, isValidEmail, isValidOptionalUrl,
  parseCoOwners, validateListingInput,
} = require('./server/core/utils');
const {
  listingFromDb, listingToDb,
  incidentFromDb, incidentToDb,
  notificationFromDb, notificationToDb,
  registrationFromListingRows,
} = require('./server/core/db-converters');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── SUPABASE STORAGE ONLY ──────────────────────────────────────────────────
// All app data is loaded from and saved to Supabase tables. There is no test/demo
// data and no JSON/local fallback.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. App data storage requires Supabase.');
}

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key',
  { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } }
);

// Audit helpers (extracted in stage 4b) — bound to the supabase client created above.
// See server/core/audit.js and docs/PLATFORM_ARCHITECTURE.md §11.
const { auditEvent, auditLog } = require('./server/core/audit')(supabase);

const requireSupabaseEnv = (res) => {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) return true;
  res.status(500).json({ error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  return false;
};

// ─── OPTIONAL EMAIL NOTIFICATIONS VIA RESEND ────────────────────────────────
// Render often times out with SMTP on free instances. This app uses Resend's
// HTTPS API instead, which is more reliable from Render.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'Propietarios Airbnb KAI <onboarding@resend.dev>';
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();

const resend = (EMAIL_PROVIDER === 'resend' && RESEND_API_KEY) ? new Resend(RESEND_API_KEY) : null;
const emailConfigured = Boolean(resend && EMAIL_FROM);

// Per email-type routing defaults — matches current workflow behaviour exactly.
// owner   = listing owner / registrant   operator       = listing operator
// globalAdmin = env GLOBAL_ADMIN_EMAILS + escalation CC   delegateAdmin  = role-gated platform-wide
// communityAdmin = community_memberships admins for this community (community-scoped group)



// ─── EDITABLE EMAIL TEMPLATES ───────────────────────────────────────────────
// Defaults moved to server/templates/email-defaults.js — see docs/PLATFORM_ARCHITECTURE.md §11.
const { DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN } = require('./server/templates/email-defaults');



// ─── EMAIL HELPERS (extracted in stage 4c) ───────────────────────────────────
// Generic primitives (sendSpanishEmail, getEmailTemplates, sendTemplatedEmail,
// sendSplitEmail) live in server/core/email.js. Per-module senders moved into
// each module's email-senders.js in stage 4g (factory binders below).

// ─── CONFIG HELPERS (extracted in stage 4e) ──────────────────────────────────
// App config + email notification config + SLA defaults + getCommunity lookup
// live in server/core/config.js. Module-mount blocks below pull constants from
// here too. See docs/PLATFORM_ARCHITECTURE.md §11.
const {
  DEFAULT_EMAIL_NOTIFICATION_CONFIG, DEFAULT_SLA_HOURS, DEFAULT_ESCALATION_CC_EMAILS,
  OVERRIDABLE_COMMUNITY_KEYS,
  getCommunity, getAppConfig, getSlaHours, getEscalationCcEmails, getEmailNotificationConfig,
} = require('./server/core/config')(supabase, { EMAIL_FROM });
const { sendSpanishEmail, getEmailTemplates, sendTemplatedEmail, sendSplitEmail } =
  require('./server/core/email')({ supabase, resend, emailConfigured, EMAIL_FROM, getAppConfig });

// ─── ROLE/PERMISSION HELPERS (extracted in stage 4d) ─────────────────────────
// All role resolution and the small DB lookup helpers (getCommunityAdminEmails,
// getReporterEmail, …) live in server/core/roles.js. getCommunity moved to
// core/config.js in stage 4e. Constants come back too so existing module-mount
// blocks below don't change.
const {
  DEFAULT_DELEGATE_PERMISSIONS, DEFAULT_STANDARD_MENU_PERMISSIONS, COMMUNITY_ADMIN_PERM_DEFAULTS,
  getUserRole, isGlobalAdmin, isCommunityAdmin, hasCommunityAdminPerm, canManageRegistrations,
  getUserPermissions, hasDelegatePermission,
  canUpdateGlobalListing, canDeleteGlobalListing, canUpdateGlobalIncident, canDeleteGlobalIncident,
  getAppPermissionsConfig, getDelegateAdminsWithPermission,
  getCommunityAdminEmails, getCommunityEscalationEmails, getUserCommunities,
  getApprovedUser, getReporterEmail, getReporterName,
  getGlobalAdminEmails, isEnvGlobalAdminEmail,
} = require('./server/core/roles')({ supabase, getAppConfig, getEscalationCcEmails });
// Separate owner-only vs operator-only recipient getters (used by config-aware send functions)

const getCommunityId = (req) => {
  const val = String(req?.headers?.['x-community-id'] || req?.query?.communityId || '').trim().toLowerCase();
  return val || 'kai';
};
// Returns community admin emails from the DB, falling back to app_config escalation_cc_emails
// when no community admins have been registered yet (backwards-compatible).
// Lookup reporter email by UID from app_users (reporter != always listing owner)
// ── Split recipient builder ─────────────────────────────────────────────────
// Returns two separate lists so individual recipients (reporter, owner, operator)
// each receive a private email addressed only to them, while admin groups receive
// a single combined email.  This prevents any recipient from seeing another's address.







// Validate and sanitize co-owners array (max 3, each needs firstName+lastName, optional whatsapp)









// ─── UNITS DB HELPERS (extracted in stage 4f) ────────────────────────────────
// findApartmentConflict + validateApartmentUniqueness live in
// server/platform/units/db.js. See docs/PLATFORM_ARCHITECTURE.md §11.
const { findApartmentConflict, validateApartmentUniqueness } =
  require('./server/platform/units/db')(supabase);

// ─── PER-MODULE EMAIL SENDERS (extracted in stage 4g) ────────────────────────
// Each module/area owns its event-specific senders. They share a deps bundle
// because all of them call the same generic primitives + role lookups.
const senderDeps = {
  sendSplitEmail, sendTemplatedEmail,
  getEmailNotificationConfig, getCommunity,
  getReporterEmail, getReporterName,
  getCommunityAdminEmails, getCommunityEscalationEmails,
  getDelegateAdminsWithPermission, getGlobalAdminEmails,
  emailConfigured,
};
const {
  sendIncidentEmail, sendIncidentVerifiedEmail,
  sendIncidentResolutionAddedEmail, sendIncidentResolvedEmail,
  sendGeneralIncidentSlaEmail,
} = require('./server/modules/incidents/email-senders')(senderDeps);
const { sendListingChangeEmail } =
  require('./server/platform/units/email-senders')(senderDeps);
const {
  sendRegistrationSubmittedEmail, sendRegistrationStatusEmail, sendRegistrationReviewerEmail,
} = require('./server/platform/registrations/email-senders')(senderDeps);


const sendSupabaseError = (res, error, status = 500) => {
  console.error('Supabase error:', error);
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  return res.status(status).json({ error: parts.join(' | ') || 'Supabase error' });
};

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '15mb' })); // photos stored as base64: 3 × ≤600KB each ≈ ≤2MB total

// Serve built React app
const DIST = path.join(__dirname, 'client', 'dist');
app.use(express.static(DIST));


// v39 client-side diagnostics endpoint: logs UI/Admin errors from browser to Render logs.
app.post('/api/client-log', (req, res) => {
  try {
    const body = req.body || {};
    warn('[CLIENT_LOG] ' + JSON.stringify({ section:body.section, message:body.message, status:body.status, url:body.url, ts:body.ts || new Date().toISOString() }).slice(0, 2000));
    if (body.stack) warn('[CLIENT_LOG_STACK] ' + String(body.stack).slice(0, 3000));
  } catch(e) { warn('[CLIENT_LOG_ERROR] ' + (e?.message || e)); }
  res.json({ ok:true });
});


// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const configured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
  const result = { ok: false, configured, storage: 'supabase', tables: ['listings', 'incidents', 'notifications', 'listing_audit_events', 'audit_logs'], time: new Date().toISOString() };

  if (!configured) {
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
  result.emailProvider = EMAIL_PROVIDER;
  result.emailConfigured = emailConfigured;
  result.emailFrom = EMAIL_FROM;
  result.counts = { listings: listingsCheck.count || 0, incidents: incidentsCheck.count || 0, notifications: notificationsCheck.count || 0, auditEvents: auditCheck.count || 0 };
  res.json(result);
});

app.get('/api/version', (req, res) => {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(DIST, 'build-meta.json'), 'utf8'));
    res.json({ buildTime: meta.buildTime || '' });
  } catch(e) {
    res.json({ buildTime: '' });
  }
});

app.get('/api/branding', async (req, res) => {
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

// ─── API: REGISTRATION / APPROVAL WORKFLOW ──────────────────────────────────

// Legacy alias: /api/apartments/check → /api/platform/units/check
// (canonical handler lives in server/platform/units/routes.js)
app.get('/api/apartments/check', (req, res, next) => {
  const queryIdx = req.url.indexOf('?');
  req.url = '/check' + (queryIdx >= 0 ? req.url.slice(queryIdx) : '');
  unitsRouter(req, res, next);
});

// ─── API: REGISTRATIONS (mounted from server/platform/registrations) ─────────
// Canonical: /api/platform/registrations/*   Legacy alias: /api/registrations/*
// Handler bodies live in server/platform/registrations/routes.js — see
// docs/PLATFORM_ARCHITECTURE.md §11 stage 3b.
const registrationsModule = require('./server/platform/registrations');
const registrationsRouter = registrationsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  isValidEmail, validateListingInput, validateApartmentUniqueness,
  listingToDb, listingFromDb, notificationToDb, registrationFromListingRows,
  normalizeLanguage, normalizeRecipients,
  getCommunity, publicAppUrl, auditEvent,
  sendRegistrationStatusEmail, sendRegistrationSubmittedEmail, sendRegistrationReviewerEmail,
  sendTemplatedEmail, getEmailNotificationConfig,
  getGlobalAdminEmails, getDelegateAdminsWithPermission, getCommunityAdminEmails,
  canManageRegistrations, getUserRole,
});
app.use('/api/platform/registrations', registrationsRouter);
app.use('/api/registrations', registrationsRouter); // legacy alias — drop after client migrates

// ─── API: UNITS (mounted from server/platform/units) ─────────────────────────
// Canonical: /api/platform/units/*   Legacy alias: /api/listings/*
// /api/apartments/check forwards to /check on this router (registered above).
// Handler bodies live in server/platform/units/routes.js — see
// docs/PLATFORM_ARCHITECTURE.md §11 stages 3a–3b.
const unitsModule = require('./server/platform/units');
const unitsRouter = unitsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  listingFromDb, listingToDb,
  isThreeDigitApt, isValidEmail, isValidOptionalUrl, parseCoOwners,
  findApartmentConflict, validateApartmentUniqueness,
  getCommunity, auditEvent, auditLog, publicAppUrl, sendListingChangeEmail,
  canUpdateGlobalListing, canDeleteGlobalListing, hasCommunityAdminPerm,
});
app.use('/api/platform/units', unitsRouter);
app.use('/api/listings', unitsRouter); // legacy alias — drop after client migrates

// ─── API: INCIDENTS (mounted from server/modules/incidents) ──────────────────
// Canonical: /api/m/incidents/*   Legacy alias: /api/incidents/*
// Handler bodies live in server/modules/incidents/routes.js — see
// docs/PLATFORM_ARCHITECTURE.md §11 stage 2.
const incidentsModule = require('./server/modules/incidents');
const incidentsRouter = incidentsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  incidentFromDb, incidentToDb, listingFromDb, notificationToDb,
  publicAppUrl, getSlaHours, addHoursIso, auditLog,
  getGlobalAdminEmails, getEmailNotificationConfig, getReporterEmail, getReporterName,
  getCommunityEscalationEmails, getDelegateAdminsWithPermission, getCommunityAdminEmails,
  normalizeRecipients, sendTemplatedEmail,
  sendIncidentEmail, sendIncidentVerifiedEmail, sendIncidentResolutionAddedEmail, sendIncidentResolvedEmail,
  isGlobalAdmin, hasDelegatePermission, hasCommunityAdminPerm,
  canDeleteGlobalIncident,
  emailConfigured,
});
app.use('/api/m/incidents', incidentsRouter);
app.use('/api/incidents', incidentsRouter); // legacy alias — drop after client migrates



// ─── API: USERS (mounted from server/platform/users) ────────────────────────
// Canonical: /api/platform/users/*   Legacy alias: /api/users/*
// Includes: /preference, /profile (GET+PUT), /reputation. See
// docs/PLATFORM_ARCHITECTURE.md §11 stage 3d.
const usersModule = require('./server/platform/users');
const usersRouter = usersModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError,
  isValidEmail,
});
app.use('/api/platform/users', usersRouter);
app.use('/api/users', usersRouter); // legacy alias — drop after client migrates

// ─── API: EMAIL ADMIN (mounted from server/platform/email) ───────────────────
// Canonical: /api/platform/email/*
// Legacy aliases (URL-rewrite below): /api/admin/email-templates,
//   /api/admin/email-notification-config, /api/contact/send-email.
const emailModule = require('./server/platform/email');
const emailRouter = emailModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, log,
  isGlobalAdmin, isCommunityAdmin,
  normalizeLanguage, normalizeRecipients,
  getEmailTemplates, getEmailNotificationConfig,
  DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_NOTIFICATION_CONFIG,
  auditLog,
  escapeHtml, sendSpanishEmail,
});
app.use('/api/platform/email', emailRouter);
function forwardToEmailRouter(targetPath) {
  return (req, res, next) => {
    const queryIdx = req.url.indexOf('?');
    req.url = targetPath + (queryIdx >= 0 ? req.url.slice(queryIdx) : '');
    emailRouter(req, res, next);
  };
}
app.get('/api/admin/email-templates',           forwardToEmailRouter('/templates'));
app.put('/api/admin/email-templates',           forwardToEmailRouter('/templates'));
app.get('/api/admin/email-notification-config', forwardToEmailRouter('/notification-config'));
app.put('/api/admin/email-notification-config', forwardToEmailRouter('/notification-config'));
app.post('/api/contact/send-email',             forwardToEmailRouter('/contact'));

// ─── API: PLATFORM ADMIN (mounted from server/platform/admin) ────────────────
// Canonical: /api/platform/admin/*
// Legacy aliases (URL-rewrite below): /api/admin/{me,config,users,delegate}.
const platformAdminModule = require('./server/platform/admin');
const platformAdminRouter = platformAdminModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, log,
  isGlobalAdmin, getUserRole, normalizeRole,
  getCommunityId, getAppConfig, getUserPermissions, getUserCommunities,
  getAppPermissionsConfig, hasCommunityAdminPerm,
  safeJsonObject, normalizeLanguage, normalizeRecipients,
  getGlobalAdminEmails, getApprovedUser,
  auditLog,
  DEFAULT_DELEGATE_PERMISSIONS, DEFAULT_STANDARD_MENU_PERMISSIONS, COMMUNITY_ADMIN_PERM_DEFAULTS,
});
app.use('/api/platform/admin', platformAdminRouter);
function forwardToPlatformAdminRouter(targetPath) {
  return (req, res, next) => {
    const queryIdx = req.url.indexOf('?');
    req.url = targetPath + (queryIdx >= 0 ? req.url.slice(queryIdx) : '');
    platformAdminRouter(req, res, next);
  };
}
app.get('/api/admin/me',       forwardToPlatformAdminRouter('/me'));
app.put('/api/admin/config',   forwardToPlatformAdminRouter('/config'));
app.get('/api/admin/users',    forwardToPlatformAdminRouter('/users'));
app.post('/api/admin/delegate', forwardToPlatformAdminRouter('/delegate'));

// ─── API: AUDIT LOGS (mounted from server/platform/audit) ────────────────────
// Canonical: /api/platform/audit/logs   Legacy alias: /api/admin/audit-logs
// See docs/PLATFORM_ARCHITECTURE.md §11 stage 3c.
const auditModule = require('./server/platform/audit');
const auditRouter = auditModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError,
  isGlobalAdmin, log,
});
app.use('/api/platform/audit', auditRouter);
// Legacy alias: /api/admin/audit-logs → /api/platform/audit/logs
app.get('/api/admin/audit-logs', (req, res, next) => {
  const queryIdx = req.url.indexOf('?');
  req.url = '/logs' + (queryIdx >= 0 ? req.url.slice(queryIdx) : '');
  auditRouter(req, res, next);
});



// ─── API: NOTIFICATIONS (mounted from server/platform/notifications) ─────────
// Canonical: /api/platform/notifications/*   Legacy alias: /api/notifications/*
// See docs/PLATFORM_ARCHITECTURE.md §11 stage 3c.
const notificationsModule = require('./server/platform/notifications');
const notificationsRouter = notificationsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  notificationFromDb,
});
app.use('/api/platform/notifications', notificationsRouter);
app.use('/api/notifications', notificationsRouter); // legacy alias — drop after client migrates



const runSlaEscalations = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !emailConfigured) return;
  try {
    const now = new Date().toISOString();
    // Fire for: open (Step 1 pending) OR verified-without-resolution (Step 2 pending)
    // next_sla_reminder_at is kept active until both steps are complete.
    const { data: rows, error } = await supabase
      .from('incidents')
      .select('*, listings(*)')
      .neq('status', 'resolved')
      .not('next_sla_reminder_at', 'is', null)
      .lte('next_sla_reminder_at', now)
      .order('next_sla_reminder_at', { ascending:true })
      .limit(10);
    if (error) { warn('SLA escalation query failed: ' + error.message); return; }
    for (const row of rows || []) {
      const listing = row.listings;
      if (!listing) {
        // General incident — no unit owner; alert admins to assign or close it.
        if (row.is_general) {
          try {
            const inc = incidentFromDb(row);
            const slaHours = Number(row.sla_hours || await getSlaHours() || 24);
            await sendGeneralIncidentSlaEmail(inc, slaHours, publicAppUrl(), row.community_id || 'kai');
            await supabase.from('incidents').update({ sla_cycle_count: Number(row.sla_cycle_count||0)+1, next_sla_reminder_at: addHoursIso(now, slaHours) }).eq('id', row.id);
          } catch(e) {
            warn('General incident SLA email failed for ' + row.id + ': ' + (e?.message || e));
            await supabase.from('incidents').update({ next_sla_reminder_at: addHoursIso(now, 1) }).eq('id', row.id);
          }
        }
        continue;
      }
      // Skip verified+resolved-resolution (both steps done — next_sla should already be null, but guard here)
      if (row.status === 'verified' && String(row.owner_resolution || '').trim()) {
        await supabase.from('incidents').update({ next_sla_reminder_at: null }).eq('id', row.id);
        continue;
      }
      const inc = incidentFromDb(row);
      const slaHours = Number(row.sla_hours || await getSlaHours() || 24);
      // Add context so email templates can explain exactly what step is pending
      const pendingStep = row.status === 'open'
        ? 'step1' // Needs: verify + guest info + action
        : 'step2'; // Needs: resolution text
      const pendingStepLabel = pendingStep === 'step1'
        ? 'Step 1: Verify the incident — confirm guest details and document your immediate action'
        : 'Step 2: Add your resolution — describe how you resolved this so admin can close it';
      const pendingStepLabelEs = pendingStep === 'step1'
        ? 'Paso 1: Verifica el incidente — confirma los datos del huésped y documenta tu acción inmediata'
        : 'Paso 2: Agrega tu respuesta — describe cómo resolviste el incidente para que el admin pueda cerrarlo';
      try {
        await sendIncidentEmail({ listing: listingFromDb(listing), incident: { ...inc, pendingStep, pendingStepLabel, pendingStepLabelEs }, appUrl: publicAppUrl(), includeEscalationCc:true, isEscalation:true });
        await supabase.from('incidents').update({ sla_cycle_count: Number(row.sla_cycle_count || 0) + 1, next_sla_reminder_at: addHoursIso(now, slaHours) }).eq('id', row.id);
      } catch(e) {
        warn('SLA escalation email failed for ' + row.id + ': ' + (e?.message || e));
        await supabase.from('incidents').update({ next_sla_reminder_at: addHoursIso(now, 1) }).eq('id', row.id);
      }
    }
  } catch(e) { warn('SLA escalation cycle failed: ' + (e?.message || e)); }
};
setInterval(runSlaEscalations, Number(process.env.SLA_CHECK_INTERVAL_MS || 15 * 60 * 1000));
setTimeout(runSlaEscalations, 15000);


// ─── API: ANALYTICS (mounted from server/platform/analytics) ─────────────────
// Canonical: /api/platform/analytics/  +  /api/platform/analytics/goals/:id
// Legacy aliases (URL-rewrite below):
//   /api/analytics, /api/admin/analytics → /
//   /api/communities/:id/goals          → /goals/:id
// See docs/PLATFORM_ARCHITECTURE.md §11 stage 4h.
const analyticsModule = require('./server/platform/analytics');
const analyticsRouter = analyticsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  isGlobalAdmin, isCommunityAdmin,
  getAppConfig,
});
app.use('/api/platform/analytics', analyticsRouter);
function forwardToAnalyticsRouter(targetPath) {
  return (req, res, next) => {
    const queryIdx = req.url.indexOf('?');
    req.url = targetPath + (queryIdx >= 0 ? req.url.slice(queryIdx) : '');
    analyticsRouter(req, res, next);
  };
}
app.get('/api/analytics',       forwardToAnalyticsRouter('/'));
app.get('/api/admin/analytics', forwardToAnalyticsRouter('/'));
app.get('/api/communities/:id/goals', (req, res, next) => {
  const queryIdx = req.url.indexOf('?');
  req.url = '/goals/' + encodeURIComponent(req.params.id) + (queryIdx >= 0 ? req.url.slice(queryIdx) : '');
  analyticsRouter(req, res, next);
});

// ─── API: COMMUNITIES (mounted from server/platform/communities) ─────────────
// Canonical: /api/platform/communities/*
// Legacy aliases: /api/communities/*, plus URL-rewrite forwarders for
//   /api/admin/communities, /api/admin/communities/filter-options,
//   /api/me/communities. See docs/PLATFORM_ARCHITECTURE.md §11 stage 3e.
const communitiesModule = require('./server/platform/communities');
const communitiesRouter = communitiesModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError,
  isGlobalAdmin, isCommunityAdmin,
  getCommunity, getUserCommunities,
  getAppConfig, getAppPermissionsConfig, getEmailNotificationConfig,
  safeJsonObject, normalizeRecipients,
  getGlobalAdminEmails,
  auditLog,
  COMMUNITY_ADMIN_PERM_DEFAULTS, OVERRIDABLE_COMMUNITY_KEYS,
});
app.use('/api/platform/communities', communitiesRouter);
app.use('/api/communities', communitiesRouter); // legacy alias — drop after client migrates
function forwardToCommunitiesRouter(targetPath) {
  return (req, res, next) => {
    const queryIdx = req.url.indexOf('?');
    req.url = targetPath + (queryIdx >= 0 ? req.url.slice(queryIdx) : '');
    communitiesRouter(req, res, next);
  };
}
app.get('/api/admin/communities/filter-options', forwardToCommunitiesRouter('/admin/filter-options'));
app.get('/api/admin/communities',                forwardToCommunitiesRouter('/admin'));
app.get('/api/me/communities',                   forwardToCommunitiesRouter('/me'));




// ─── CATCH-ALL → React ────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const idx = path.join(DIST, 'index.html');
  if (fs.existsSync(idx)) return res.sendFile(idx);
  res.send(`<html><body style="font:16px sans-serif;padding:32px;background:#07141e;color:#dff0f5">
    <h2>⚠️ React build not found</h2>
    <p>Build command may have failed. Check Render build logs.</p>
    <p>Looking for: <code>${idx}</code></p>
    <p>Dist exists: <strong>${fs.existsSync(DIST)}</strong></p>
    <p>__dirname: <code>${__dirname}</code></p>
    <p>ls client/: <code>${fs.existsSync(path.join(__dirname,'client')) ? fs.readdirSync(path.join(__dirname,'client')).join(', ') : 'folder missing'}</code></p>
  </body></html>`);
});
app.listen(PORT, () => {
  // Production-safe logging: detailed filesystem/static path logs are disabled
  // unless DEBUG=true. This avoids noisy logs and prevents path disclosure.
  log(`\nPropietarios Airbnb KAI running on port ${PORT}`);
  if (process.env.DEBUG === 'true') log(`Static: ${DIST} | exists: ${fs.existsSync(DIST)}`);
  log('Storage: Supabase tables only');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) warn('Supabase environment variables are missing. API calls will fail until configured.');
});
