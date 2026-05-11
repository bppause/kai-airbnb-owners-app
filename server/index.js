const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { log, warn, error } = require('../logger');

// ─── CORE HELPERS (extracted in stage 4a) ────────────────────────────────────
// Pure utilities and DB converters live in server/core/. Modules destructure
// these names from deps; server.js re-binds them at module scope here.
const {
  safeJsonObject, normalizeRole, normalizeRecipients,
  escapeHtml, publicAppUrl, normalizeLanguage, addHoursIso, normalizeApt,
  isThreeDigitApt, isValidEmail, isValidOptionalUrl,
  parseCoOwners, validateListingInput,
} = require('./core/utils');
const {
  listingFromDb, listingToDb,
  incidentFromDb, incidentToDb,
  notificationFromDb, notificationToDb,
  registrationFromListingRows,
} = require('./core/db-converters');
const { getCommunityId, sendSupabaseError } = require('./core/http');
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

// Audit helpers (extracted in stage 4b) — bound to supabase + getAppConfig
// (so the kill-switch can short-circuit before insert). getAppConfig is built
// further down at the CONFIG HELPERS block; audit no longer depends on it
// at construction so we can use a late-binding factory pattern.
// See server/core/audit.js and docs/platform/PLATFORM_ARCHITECTURE.md §11.

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
// Defaults moved to server/templates/email-defaults.js — see docs/platform/PLATFORM_ARCHITECTURE.md §11.
const { DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN } = require('./templates/email-defaults');



// ─── EMAIL HELPERS (extracted in stage 4c) ───────────────────────────────────
// Generic primitives (sendSpanishEmail, getEmailTemplates, sendTemplatedEmail,
// sendSplitEmail) live in server/core/email.js. Per-module senders moved into
// each module's email-senders.js in stage 4g (factory binders below).

// ─── CONFIG HELPERS (extracted in stage 4e) ──────────────────────────────────
// App config + email notification config + SLA defaults + getCommunity lookup
// live in server/core/config.js. Module-mount blocks below pull constants from
// here too. See docs/platform/PLATFORM_ARCHITECTURE.md §11.
const {
  DEFAULT_EMAIL_NOTIFICATION_CONFIG, DEFAULT_SLA_HOURS, DEFAULT_ESCALATION_CC_EMAILS,
  OVERRIDABLE_COMMUNITY_KEYS,
  KNOWN_AUDIT_EVENT_TYPES,
  getCommunity, getAppConfig, getSlaHours, getSlaPolicy, getSlaPolicies, getEscalationCcEmails, getEmailNotificationConfig,
} = require('./core/config')(supabase, { EMAIL_FROM });
const { auditEvent, auditLog } = require('./core/audit')(supabase, { getAppConfig });
const { sendSpanishEmail, getEmailTemplates, sendTemplatedEmail, sendSplitEmail } =
  require('./core/email')({ supabase, resend, emailConfigured, EMAIL_FROM, getAppConfig });

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
} = require('./core/roles')({ supabase, getAppConfig, getEscalationCcEmails });
// Separate owner-only vs operator-only recipient getters (used by config-aware send functions)

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
// server/platform/units/db.js. See docs/platform/PLATFORM_ARCHITECTURE.md §11.
const { findApartmentConflict, validateApartmentUniqueness } =
  require('./platform/units/db')(supabase);

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
} = require('./modules/incidents/email-senders')(senderDeps);
const { sendListingChangeEmail } =
  require('./platform/units/email-senders')(senderDeps);
const {
  sendRegistrationSubmittedEmail, sendRegistrationStatusEmail, sendRegistrationReviewerEmail,
} = require('./platform/registrations/email-senders')(senderDeps);



// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '15mb' })); // photos stored as base64: 3 × ≤600KB each ≈ ≤2MB total

// Serve built React app
const DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(DIST));
// ─── API: META (mounted from server/platform/meta) ──────────────────────────
// /api/client-log, /api/health, /api/version, /api/branding
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 4k.
const metaModule = require('./platform/meta');
const metaRouter = metaModule.createRouter({
  supabase,
  isSupabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
  emailConfigured, emailProvider: EMAIL_PROVIDER, emailFrom: EMAIL_FROM,
  distPath: DIST,
  getCommunityId, getAppConfig,
});
app.use('/api', metaRouter);


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
// docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 3b.
const registrationsModule = require('./platform/registrations');
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
// docs/platform/PLATFORM_ARCHITECTURE.md §11 stages 3a–3b.
const unitsModule = require('./platform/units');
const unitsRouter = unitsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  listingFromDb, listingToDb, notificationToDb, registrationFromListingRows,
  isThreeDigitApt, isValidEmail, isValidOptionalUrl, parseCoOwners,
  findApartmentConflict, validateApartmentUniqueness,
  getCommunity, auditEvent, auditLog, publicAppUrl, sendListingChangeEmail,
  sendRegistrationSubmittedEmail, sendRegistrationReviewerEmail,
  sendTemplatedEmail, getEmailNotificationConfig, normalizeRecipients,
  getGlobalAdminEmails, getDelegateAdminsWithPermission, getCommunityAdminEmails,
  canUpdateGlobalListing, canDeleteGlobalListing, hasCommunityAdminPerm,
});
app.use('/api/platform/units', unitsRouter);
app.use('/api/listings', unitsRouter); // legacy alias — drop after client migrates

// ─── API: INCIDENTS (mounted from server/modules/incidents) ──────────────────
// Canonical: /api/m/incidents/*   Legacy alias: /api/incidents/*
// Handler bodies live in server/modules/incidents/routes.js — see
// docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 2.
const incidentsModule = require('./modules/incidents');
const incidentsRouter = incidentsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  incidentFromDb, incidentToDb, listingFromDb, notificationToDb,
  publicAppUrl, getSlaHours, getSlaPolicy, addHoursIso, auditLog,
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
// docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 3d.
const usersModule = require('./platform/users');
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
const emailModule = require('./platform/email');
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
const platformAdminModule = require('./platform/admin');
const platformAdminRouter = platformAdminModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, log,
  isGlobalAdmin, getUserRole, normalizeRole,
  getCommunityId, getAppConfig, getUserPermissions, getUserCommunities,
  getAppPermissionsConfig, hasCommunityAdminPerm,
  safeJsonObject, normalizeLanguage, normalizeRecipients,
  getGlobalAdminEmails, getApprovedUser,
  auditLog,
  DEFAULT_DELEGATE_PERMISSIONS, DEFAULT_STANDARD_MENU_PERMISSIONS, COMMUNITY_ADMIN_PERM_DEFAULTS,
  KNOWN_AUDIT_EVENT_TYPES,
  DEFAULT_SLA_POLICIES: require('./core/config').DEFAULT_SLA_POLICIES,
  COMMUNITY_OVERRIDABLE_SLA_EVENTS: require('./core/config').COMMUNITY_OVERRIDABLE_SLA_EVENTS,
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
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 3c.
const auditModule = require('./platform/audit');
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
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 3c.
const notificationsModule = require('./platform/notifications');
const notificationsRouter = notificationsModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
  notificationFromDb,
});
app.use('/api/platform/notifications', notificationsRouter);
app.use('/api/notifications', notificationsRouter); // legacy alias — drop after client migrates



// ─── API: TAX (mounted from server/modules/tax) ──────────────────────────────
// Canonical: /api/m/tax/*
// Phase 1   endpoints: GET /health, GET /community/:slug, POST /leads.
// Phase 1.5 endpoints: GET/POST /respond/:token, /admin/cron/run, /admin/customers, /admin/periods.
// Reuses platform `communities` (business_type='tax') as the multi-tenant boundary.
const taxModule = require('./modules/tax');
const { sendTaxLeadEmail, sendTaxReminderEmail, sendTaxDocumentEmail } =
  require('./modules/tax/email-senders')({ sendSpanishEmail, emailConfigured });
const taxRemindersCron = require('./modules/tax/reminders')({
  supabase,
  isSupabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
  publicAppUrl: () => publicAppUrl(),
  emailConfigured,
  sendTaxReminderEmail,
  auditLog,
});
const taxRouter = taxModule.createRouter({
  supabase, requireSupabaseEnv, sendSupabaseError,
  auditLog,
  sendTaxLeadEmail,
  sendTaxDocumentEmail,
  publicAppUrl: () => publicAppUrl(),
  isGlobalAdmin,
  runReminderCron: taxRemindersCron.run,
});
app.use('/api/m/tax', taxRouter);
// Tax reminder cron — walks subscriptions, generates filing periods, fires
// reminders at the configured offsets. Daily cadence (12h interval) keeps
// it well within Render's free-tier restart window.
taxRemindersCron.start({ intervalMs: 12 * 60 * 60 * 1000, initialDelayMs: 60 * 1000 });

// Public SEO endpoint — lists active tax community landings. Lives at root
// (search-engine convention). robots.txt is static under client/public/.
app.get('/sitemap.xml', async (req, res) => {
  try {
    const base = (process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    let urls = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const { data } = await supabase
        .from('communities')
        .select('id, business_type, is_active, updated_at')
        .eq('is_active', true)
        .eq('business_type', 'tax');
      urls = (data || []).map(c => ({
        loc: `${base}/tax/${encodeURIComponent(c.id)}`,
        lastmod: c.updated_at ? new Date(c.updated_at).toISOString().slice(0, 10) : null,
      }));
    }
    const entries = urls.map(u =>
      `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`
    ).join('\n');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
    );
  } catch (e) {
    warn('[sitemap] failed', e?.message || e);
    res.status(500).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset/>');
  }
});

// ─── INCIDENTS SLA CRON (extracted in stage 4j) ──────────────────────────────
// Walks pending incidents whose next_sla_reminder_at has elapsed and fires the
// appropriate escalation email. Body lives in
// server/modules/incidents/sla-cron.js — see docs/platform/PLATFORM_ARCHITECTURE.md §11.
require('./modules/incidents/sla-cron')({
  supabase,
  emailConfigured,
  isSupabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
  getSlaHours, getSlaPolicy,
  sendIncidentEmail, sendGeneralIncidentSlaEmail,
}).start();


// ─── API: ANALYTICS (mounted from server/platform/analytics) ─────────────────
// Canonical: /api/platform/analytics/  +  /api/platform/analytics/goals/:id
// Legacy aliases (URL-rewrite below):
//   /api/analytics, /api/admin/analytics → /
//   /api/communities/:id/goals          → /goals/:id
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 4h.
const analyticsModule = require('./platform/analytics');
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
//   /api/me/communities. See docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 3e.
const communitiesModule = require('./platform/communities');
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
    <p>ls client/: <code>${fs.existsSync(path.join(__dirname,'..','client')) ? fs.readdirSync(path.join(__dirname,'..','client')).join(', ') : 'folder missing'}</code></p>
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
