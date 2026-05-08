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

const buttonHtml = (href, label) => '<p style="margin:18px 0"><a href="' + escapeHtml(href) + '" style="background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700">' + escapeHtml(label) + '</a></p>';


// ─── EDITABLE EMAIL TEMPLATES ───────────────────────────────────────────────
// Defaults moved to server/templates/email-defaults.js — see docs/PLATFORM_ARCHITECTURE.md §11.
const { DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN } = require('./server/templates/email-defaults');



// ─── EMAIL HELPERS (extracted in stage 4c) ───────────────────────────────────
// Generic primitives (sendSpanishEmail, getEmailTemplates, sendTemplatedEmail,
// sendSplitEmail) live in server/core/email.js. Per-module senders below still
// live in this file and consume these via local destructure.

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
const getListingOwnerEmails = (listing) => normalizeRecipients([listing?.email, listing?.user_email, listing?.userEmail]);
const getListingOperatorEmails = (listing) => normalizeRecipients([listing?.operator_email, listing?.operatorEmail]);

const getCommunityId = (req) => {
  const val = String(req?.headers?.['x-community-id'] || req?.query?.communityId || '').trim().toLowerCase();
  return val || 'kai';
};
// Returns community admin emails from the DB, falling back to app_config escalation_cc_emails
// when no community admins have been registered yet (backwards-compatible).
const getIncidentRecipients = async (listing, { includeEscalationCc=false } = {}) => {
  const base = [listing?.email, listing?.user_email, listing?.userEmail, listing?.operator_email, listing?.operatorEmail];
  if (includeEscalationCc) base.push(...await getEscalationCcEmails());
  return normalizeRecipients(base);
};
// Lookup reporter email by UID from app_users (reporter != always listing owner)
// ── Split recipient builder ─────────────────────────────────────────────────
// Returns two separate lists so individual recipients (reporter, owner, operator)
// each receive a private email addressed only to them, while admin groups receive
// a single combined email.  This prevents any recipient from seeing another's address.
const buildSplitRecipients = async (typeCfg, listing, reporterEmail='', communityId='kai') => {
  // Individual recipients — specific people involved in this incident/listing
  const individual = normalizeRecipients([
    typeCfg.reporter !== false && reporterEmail ? reporterEmail : '',
    typeCfg.owner    ? getListingOwnerEmails(listing)    : [],
    typeCfg.operator ? getListingOperatorEmails(listing) : [],
  ].flat());

  // Group recipients — admin roles receive together as a coordinating team
  const groupList = [];
  if (typeCfg.globalAdmin)   groupList.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(communityId));
  if (typeCfg.delegateAdmin) groupList.push(...await getDelegateAdminsWithPermission('canResolveIncidents'));
  // communityAdmin: community-scoped admins for this specific community.
  // Default true when key is absent (backwards compat with saved configs that predate this field).
  if (typeCfg.communityAdmin ?? true) groupList.push(...await getCommunityAdminEmails(communityId));
  const group = normalizeRecipients(groupList);

  return { individual, group };
};

// Send individual private emails + one group admin email for an incident event.
// Each individual (reporter/owner/operator) gets their own private email so they
// cannot see who else was notified.  Admin group receives one combined email.
const sendIncidentEmail = async ({ listing, incident, appUrl, isEscalation=false }) => {
  const key = isEscalation ? 'incident_sla' : 'incident_new';
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg[key];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:`Email type '${key}' is disabled.` };
  const communityId = listing.community_id || '__global__';
  const reporterEmail = await getReporterEmail(incident.reporterUid);
  const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
  if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  const pendingStepLabel   = incident.pendingStepLabel   || (incident.status==='open' ? 'Step 1: Verify the incident — confirm guest details and document your immediate action' : 'Step 2: Add your resolution — describe how you resolved this so admin can close it');
  const pendingStepLabelEs = incident.pendingStepLabelEs || (incident.status==='open' ? 'Paso 1: Verifica el incidente — confirma los datos del huésped y documenta tu acción inmediata' : 'Paso 2: Agrega tu respuesta — describe cómo resolviste el incidente para que el admin pueda cerrarlo');
  const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', guestName:incident.guestName||'', date:incident.date||'', type:incident.type||'', category:incident.category||'', status:incident.status||'open', desc:incident.desc||'', incidentLink, slaCycleCount:String(incident.slaCycleCount||incident.sla_cycle_count||''), pendingStep:incident.pendingStep||(incident.status==='open'?'step1':'step2'), pendingStepLabel, pendingStepLabelEs };
  return sendSplitEmail({ key, individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
};

const sendIncidentVerifiedEmail = async ({ listing, incident, appUrl }) => {
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['incident_verified'];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:"Email type 'incident_verified' is disabled." };
  const communityId = listing.community_id || '__global__';
  const reporterEmail = await getReporterEmail(incident.reporterUid);
  const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
  if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', ownerGuestNames:incident.ownerGuestNames||'', ownerGuestCity:incident.ownerGuestCity||'', ownerGuestCountry:incident.ownerGuestCountry||'', ownerComments:incident.ownerComments||'', ownerAnswer:incident.ownerResolution||'', incidentLink };
  return sendSplitEmail({ key:'incident_verified', individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
};

// Step 2 complete: owner added resolution — notifies all parties that incident is ready to close.
const sendIncidentResolutionAddedEmail = async ({ listing, incident, appUrl }) => {
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['incident_resolution_added'] || { enabled:true, reporter:true, owner:true, operator:true, globalAdmin:true, delegateAdmin:true };
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:"Email type 'incident_resolution_added' is disabled." };
  const communityId = listing.community_id || '__global__';
  const reporterEmail = await getReporterEmail(incident.reporterUid);
  const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
  if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', ownerGuestNames:incident.ownerGuestNames||'', ownerGuestCity:incident.ownerGuestCity||'', ownerGuestCountry:incident.ownerGuestCountry||'', ownerComments:incident.ownerComments||'', ownerAnswer:incident.ownerResolution||'', incidentLink };
  return sendSplitEmail({ key:'incident_resolution_added', individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
};

const sendIncidentResolvedEmail = async ({ listing, incident, appUrl }) => {
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['incident_resolved'];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:"Email type 'incident_resolved' is disabled." };
  const communityId = listing.community_id || '__global__';
  const reporterEmail = await getReporterEmail(incident.reporterUid);
  const reporterName = incident.reporterName || await getReporterName(incident.reporterUid);
  const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
  if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', resolvedBy:incident.resolvedBy||incident.resolved_by||'', resolutionComments:incident.resolutionComments||incident.resolution_comments||'', ownerAnswer:incident.ownerResolution||'', date:incident.date||'', type:incident.type||'', category:incident.category||'', incidentLink, reporterName };
  return sendSplitEmail({ key:'incident_resolved', individual, group, vars, relatedEntity:'incident', relatedId:incident.id, communityId });
};

const sendListingChangeEmail = async ({ listing, action, appUrl }) => {
  const key = action === 'created' ? 'listing_created' : action === 'updated' ? 'listing_updated' : 'listing_deleted';
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg[key];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:`Email type '${key}' is disabled.` };
  // Individual: owner + operator of this specific listing (each gets their own email)
  const individual = normalizeRecipients([
    typeCfg.owner    ? getListingOwnerEmails(listing)    : [],
    typeCfg.operator ? getListingOperatorEmails(listing) : [],
  ].flat());
  // Group: admin roles
  const listingCommunityId = listing.communityId || 'kai';
  const groupList = [];
  if (typeCfg.globalAdmin)   groupList.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(listingCommunityId));
  if (typeCfg.delegateAdmin) groupList.push(...await getDelegateAdminsWithPermission('canUpdateGlobalListings'));
  if (typeCfg.communityAdmin ?? true) groupList.push(...await getCommunityAdminEmails(listingCommunityId));
  const group = normalizeRecipients(groupList);
  if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients for listing change email.' };
  const vars = { apt:listing.apt||'', owner:listing.owner||'', listingEmail:listing.email||listing.user_email||'', listingLink:appUrl+'/?view=listings' };
  return sendSplitEmail({ key, individual, group, vars, relatedEntity:'listing', relatedId:listing.id });
};


// Validate and sanitize co-owners array (max 3, each needs firstName+lastName, optional whatsapp)









// ─── UNITS DB HELPERS (extracted in stage 4f) ────────────────────────────────
// findApartmentConflict + validateApartmentUniqueness live in
// server/platform/units/db.js. See docs/PLATFORM_ARCHITECTURE.md §11.
const { findApartmentConflict, validateApartmentUniqueness } =
  require('./server/platform/units/db')(supabase);

const sendRegistrationSubmittedEmail = async ({ registration, appUrl }) => {
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['registration_submitted'];
  if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:'Registration submitted email is disabled.' };
  const communityId = registration.communityId || 'kai';
  const community = await getCommunity(communityId);
  const communityName = community?.name || communityId;
  return sendTemplatedEmail({ key:'registration_submitted', to: registration.userEmail, vars: { userName:registration.userName || '', userEmail:registration.userEmail || '', registrationLink: appUrl + '/?view=registration', communityName }, communityId });
};
const sendRegistrationStatusEmail = async ({ registration, appUrl, communityId='kai' }) => {
  const approved = registration.status === 'approved';
  const key = approved ? 'registration_approved' : 'registration_declined';
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg[key];
  if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:`Registration ${key} email is disabled.` };
  const link = appUrl + (approved ? '/?view=dashboard' : '/?view=registration');
  const reason = String(registration.reason || '').trim();
  const community = await getCommunity(communityId);
  const communityName = community?.name || communityId;
  // Also notify admins if configured
  const recips = [registration.userEmail];
  const admCfg = notifCfg['registration_status_admin'];
  if (admCfg?.enabled) {
    if (admCfg.globalAdmin) recips.push(...getGlobalAdminEmails());
    if (admCfg.delegateAdmin) recips.push(...await getDelegateAdminsWithPermission('canApproveRegistrations'));
    if (admCfg.communityAdmin ?? true) recips.push(...await getCommunityAdminEmails(communityId));
  }
  return sendTemplatedEmail({ key, to: normalizeRecipients(recips), vars: { userName:registration.userName || '', userEmail:registration.userEmail || '', reason, reasonLine: reason ? 'Motivo/nota: ' + reason : '', reasonHtml: reason ? '<p><strong>Motivo/nota:</strong> ' + reason + '</p>' : '', reasonLineEn: reason ? 'Reason/note: ' + reason : '', reasonHtmlEn: reason ? '<p><strong>Reason/note:</strong> ' + reason + '</p>' : '', dashboardLink:link, registrationLink:link, communityName }, communityId });
};
const sendRegistrationReviewerEmail = async ({ reviewer, registration, appUrl }) => {
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['registration_reviewer'];
  if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:'Registration reviewer email is disabled.' };
  const communityId = registration.communityId || 'kai';
  const community = await getCommunity(communityId);
  const communityName = community?.name || communityId;
  return sendTemplatedEmail({ key:'registration_reviewer', to: reviewer.user_email, vars: { reviewerName: reviewer.user_name || 'propietario', userName:registration.userName || '', userEmail:registration.userEmail || '', approvalsLink: appUrl + '/?view=approvals', communityName }, communityId });
};

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


const sendGeneralIncidentSlaEmail = async (inc, slaHours, appUrl, communityId='kai') => {
  if (!emailConfigured) return;
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['incident_general_sla'] || { enabled:true, globalAdmin:true, delegateAdmin:true };
  if (!typeCfg.enabled) return;
  const recips = [];
  if (typeCfg.globalAdmin  !== false) recips.push(...getGlobalAdminEmails(), ...await getCommunityEscalationEmails(communityId));
  if (typeCfg.delegateAdmin !== false) recips.push(...await getDelegateAdminsWithPermission('canResolveIncidents'));
  if (typeCfg.communityAdmin ?? true) recips.push(...await getCommunityAdminEmails(communityId));
  const recipients = normalizeRecipients(recips);
  if (!recipients.length) return;
  const incidentLink = appUrl + '/?view=incidents&incident=' + inc.id;
  // Use incident_sla template if incident_general_sla template not set; fallback to inline text
  return sendTemplatedEmail({
    key: 'incident_general_sla',
    to: recipients,
    vars: { apt:'General', owner:'', operator:'No indicado', operatorEmail:'', guestName:'', date:inc.date||'', type:inc.type||'', category:inc.category||'', status:'open', desc:inc.desc||'', incidentLink, slaCycleCount:String(inc.slaCycleCount||0), slaHours:String(slaHours), pendingStep:'assign-or-close', pendingStepLabel:'Assign this general incident to a unit or close it directly', pendingStepLabelEs:'Asigna este incidente general a una unidad o ciérralo directamente' },
    relatedEntity: 'incident',
    relatedId: inc.id,
  });
};

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


// ─── API: GLOBAL ADMIN ANALYTICS / SLA BREACH DASHBOARD ─────────────────────
const analyticsHandler = async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  const communityId = getCommunityId(req);
  const cfg = await getAppConfig(communityId);
  const global = await isGlobalAdmin(uid, email);
  const enabledForAll = String(cfg.analytics_enabled || 'false') === 'true';
  if (!global && !enabledForAll) return res.status(403).json({ error:'Las analíticas están disponibles solo para administrador global.' });
  const now = new Date();
  const daysParam = String(req.query.days || '90').trim();
  const startParam = String(req.query.start || '').trim();
  const endParam   = String(req.query.end   || '').trim();

  // Determine date window: all-time, custom range, or preset rolling window
  let since = null;
  let until = null;
  let windowLabel = `${daysParam} days`;

  if (startParam && endParam) {
    // Custom date range — accept YYYY-MM-DD
    const s = new Date(startParam); const e = new Date(endParam + 'T23:59:59.999Z');
    if (!isNaN(s.getTime())) since = s.toISOString();
    if (!isNaN(e.getTime())) until = e.toISOString();
    windowLabel = `${startParam} – ${endParam}`;
  } else if (daysParam === 'all') {
    since = null; until = null; windowLabel = 'all time';
  } else {
    const days = Math.max(1, Math.min(3650, Number(daysParam) || 90));
    since = new Date(now.getTime() - days * 24 * 3600000).toISOString();
    windowLabel = `${days} days`;
  }

  let q = supabase.from('incidents').select('*, listings(*)').eq('community_id', communityId).order('created_at', { ascending:false });
  if (since) q = q.gte('created_at', since);
  if (until) q = q.lte('created_at', until);
  const { data: incidentsRaw, error: incErr } = await q;
  if (incErr) return sendSupabaseError(res, incErr);
  const incidents = incidentsRaw || [];
  const active = incidents.filter(i => !['verified','resolved'].includes(i.status));
  const breached = active.filter(i => i.next_sla_reminder_at && new Date(i.next_sla_reminder_at) <= now);
  const dueSoon = active.filter(i => i.next_sla_reminder_at && new Date(i.next_sla_reminder_at) > now && new Date(i.next_sla_reminder_at) <= new Date(now.getTime()+24*3600000));
  const verified = incidents.filter(i => i.status === 'verified' && i.owner_verified_at && i.created_at);
  const responseHours = verified.map(i => (new Date(i.owner_verified_at) - new Date(i.created_at)) / 3600000).filter(v => Number.isFinite(v) && v >= 0);
  const avgResponseHours = responseHours.length ? responseHours.reduce((a,b)=>a+b,0)/responseHours.length : 0;
  const maxResponseHours = responseHours.length ? Math.max(...responseHours) : 0;
  const countBy = (arr, fn) => arr.reduce((acc, x) => { const k = fn(x) || 'Sin dato'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const toRank = (obj) => Object.entries(obj).map(([name,count]) => ({ name, count })).sort((a,b)=>b.count-a.count);
  const typeCounts = countBy(incidents, i => i.type || 'other');
  const categoryCounts = countBy(incidents, i => i.category || 'minor');
  const statusCounts = countBy(incidents, i => i.status || 'open');
  const aptCounts = countBy(incidents, i => i.listings?.apt || String(i.apt_label || '').replace(/[^0-9]/g,'') || 'Sin apto');
  const operatorCounts = countBy(incidents, i => i.listings?.operator || 'Sin operador');
  const monthCounts = countBy(incidents, i => String(i.created_at || '').slice(0,7));
  const breachRows = breached.map(i => { const listing = i.listings || {}; const hoursOverdue = i.next_sla_reminder_at ? Math.max(0, (now - new Date(i.next_sla_reminder_at))/3600000) : 0; return { id:i.id, apt:listing.apt || String(i.apt_label || '').replace(/[^0-9]/g,'') || '', owner:listing.owner || '', ownerEmail:listing.user_email || '', listingEmail:listing.email || '', operator:listing.operator || '', operatorEmail:listing.operator_email || '', status:i.status, type:i.type, category:i.category, createdAt:i.created_at, incidentDate:i.incident_date, nextSlaReminderAt:i.next_sla_reminder_at, slaHours:i.sla_hours || 24, slaCycleCount:i.sla_cycle_count || 0, hoursOverdue:Number(hoursOverdue.toFixed(1)), description:i.description || '' }; }).sort((a,b)=>b.hoursOverdue-a.hoursOverdue);
  res.json({ windowDays: daysParam, windowLabel, startDate: since, endDate: until, generatedAt:now.toISOString(), summary:{ totalIncidents:incidents.length, openIncidents:active.length, verifiedIncidents:verified.length, resolvedIncidents:incidents.filter(i=>i.status==='resolved').length, breachedSla:breached.length, dueSoon24h:dueSoon.length, avgResponseHours:Number(avgResponseHours.toFixed(1)), maxResponseHours:Number(maxResponseHours.toFixed(1)), escalationCycles:incidents.reduce((sum,i)=>sum+Number(i.sla_cycle_count||0),0) }, breachRows, rankings:{ byApartment:toRank(aptCounts).slice(0,12), byOperator:toRank(operatorCounts).slice(0,12), byType:toRank(typeCounts), byCategory:toRank(categoryCounts), byStatus:toRank(statusCounts), byMonth:toRank(monthCounts).sort((a,b)=>a.name.localeCompare(b.name)) } });
};
app.get('/api/analytics', analyticsHandler);
app.get('/api/admin/analytics', analyticsHandler);

// ─── API: COMMUNITIES (v80) ──────────────────────────────────────────────────

// GET /api/communities — global admin sees all; user sees their own
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



// ─── COMMUNITY GOALS ──────────────────────────────────────────────────────────
// GET /api/communities/:id/goals — quarterly engagement + resolution metrics
app.get('/api/communities/:id/goals', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const cid = req.params.id;
  const { uid, email } = req.query;
  // Accessible to any authenticated member (community admins and global admins)
  const authed = await isGlobalAdmin(uid, email) || await isCommunityAdmin(uid, email, cid);
  // Standard users can see their own community's goals too (public stats)
  // so we just require a valid uid/community pairing
  try {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
    const [allRes, qRes, membersRes] = await Promise.all([
      supabase.from('incidents').select('id,status,created_at,resolved_at,sla_hours').eq('community_id', cid).not('is_general','eq',true),
      supabase.from('incidents').select('id,status,created_at,resolved_at,sla_hours').eq('community_id', cid).not('is_general','eq',true).gte('created_at', qStart),
      supabase.from('listings').select('owner_uid').eq('community_id', cid).eq('status','approved'),
    ]);
    const qInc = qRes.data || [];
    const allInc = allRes.data || [];
    const totalQ = qInc.length;
    const resolvedQ = qInc.filter(i => i.status === 'resolved').length;

    const withinSla = qInc.filter(i => {
      if (i.status !== 'resolved' || !i.resolved_at) return false;
      const slaMs = (i.sla_hours || 72) * 3600000;
      return (new Date(i.resolved_at) - new Date(i.created_at)) <= slaMs;
    }).length;

    const openPastSla = qInc.filter(i => {
      if (i.status === 'resolved') return false;
      const slaMs = (i.sla_hours || 72) * 3600000;
      return (Date.now() - new Date(i.created_at)) > slaMs;
    }).length;

    const resolutionRate = totalQ > 0 ? Math.round((resolvedQ / totalQ) * 100) : null;
    const slaRate = resolvedQ > 0 ? Math.round((withinSla / resolvedQ) * 100) : null;
    const goalTarget = 90; // 90% resolution rate goal
    const uniqueOwners = new Set((membersRes.data||[]).map(r => r.owner_uid).filter(Boolean)).size;

    const uniqueReporters = new Set(qInc.map(i => i.reporter_uid).filter(Boolean)).size;
    const engagementRate = uniqueOwners > 0 ? Math.round((uniqueReporters / uniqueOwners) * 100) : null;

    res.json({
      quarterStart: qStart,
      totalQ, resolvedQ, withinSla, openPastSla,
      resolutionRate, slaRate, goalTarget,
      goalMet: resolutionRate !== null && resolutionRate >= goalTarget,
      allTimeResolved: allInc.filter(i => i.status === 'resolved').length,
      allTimeTotal: allInc.length,
      memberCount: uniqueOwners,
      engagementRate,
      uniqueReporters,
    });
  } catch(e) { warn('Goals calc failed: ' + (e?.message || e)); res.status(500).json({ error: e?.message || String(e) }); }
});

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
