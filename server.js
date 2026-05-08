const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { log, warn, error } = require('./logger');
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
const GLOBAL_ADMIN_EMAILS = String(process.env.GLOBAL_ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const getGlobalAdminEmails = () => String(process.env.GLOBAL_ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAILS || '').split(',').map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
const isEnvGlobalAdminEmail = (email='') => getGlobalAdminEmails().includes(String(email || '').trim().toLowerCase());

const DEFAULT_DELEGATE_PERMISSIONS = {
  canApproveRegistrations: true,
  canResolveIncidents: true,
  canUpdateGlobalListings: false,
  canDeleteGlobalListings: false,
  canUpdateGlobalIncidents: false,
  canDeleteGlobalIncidents: false
};
// Per email-type routing defaults — matches current workflow behaviour exactly.
// owner   = listing owner / registrant   operator       = listing operator
// globalAdmin = env GLOBAL_ADMIN_EMAILS + escalation CC   delegateAdmin  = role-gated platform-wide
// communityAdmin = community_memberships admins for this community (community-scoped group)
const DEFAULT_EMAIL_NOTIFICATION_CONFIG = {
  incident_new:              { enabled:true,  reporter:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  incident_sla_notification: { enabled:true,  reporter:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  incident_sla_reminder:     { enabled:true,  reporter:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  incident_sla:              { enabled:true,  reporter:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  incident_verified:         { enabled:true,  reporter:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  incident_resolution_added: { enabled:true,  reporter:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  incident_resolved:         { enabled:true,  reporter:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  incident_general_sla:      { enabled:true,  reporter:false, owner:false, operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  registration_submitted:    { enabled:true,  owner:true,  operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  registration_approved:     { enabled:true,  owner:true,  operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  registration_declined:     { enabled:true,  owner:true,  operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  registration_status_admin: { enabled:true,  owner:false, operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  registration_reviewer:     { enabled:true,  owner:true,  operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  listing_created:           { enabled:true,  owner:true,  operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  listing_updated:           { enabled:true,  owner:true,  operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
  listing_deleted:           { enabled:true,  owner:true,  operator:false, globalAdmin:true,  delegateAdmin:true,  communityAdmin:true  },
};
const DEFAULT_STANDARD_MENU_PERMISSIONS = {
  dashboard: true,
  listings: true,
  incidents: true,
  notifications: true,
  about: true,
  my: true,
  analytics: false
};
function safeJsonObject(v, fallback={}) {
  if (!v) return { ...fallback };
  if (typeof v === 'object' && !Array.isArray(v)) return { ...fallback, ...v };
  try { const o = JSON.parse(String(v)); return (o && typeof o === 'object' && !Array.isArray(o)) ? { ...fallback, ...o } : { ...fallback }; } catch(e) { return { ...fallback }; }
}
function normalizeRole(role='user') { return ['user','delegate_admin','global_admin'].includes(role) ? role : 'user'; }
async function getAppPermissionsConfig() {
  const cfg = await getAppConfig();
  return {
    standardMenuPermissions: safeJsonObject(cfg.standard_menu_permissions, DEFAULT_STANDARD_MENU_PERMISSIONS),
    defaultDelegatePermissions: safeJsonObject(cfg.default_delegate_permissions, DEFAULT_DELEGATE_PERMISSIONS),
    defaultCommunityAdminPermissions: safeJsonObject(cfg.default_community_admin_permissions, COMMUNITY_ADMIN_PERM_DEFAULTS)
  };
}
async function getUserPermissions({ uid='', email='' }={}) {
  const role = await getUserRole({ uid, email });
  const cfg = await getAppPermissionsConfig();
  let row = null;
  if (uid) {
    try { const { data } = await supabase.from('app_users').select('permissions').eq('uid', uid).maybeSingle(); row = data || null; } catch(e) {}
  }
  const stored = safeJsonObject(row?.permissions, {});
  if (role === 'global_admin') {
    return { role, menu: Object.fromEntries(Object.keys(DEFAULT_STANDARD_MENU_PERMISSIONS).map(k => [k, true])), delegate: { canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:true, canDeleteGlobalListings:true, canUpdateGlobalIncidents:true, canDeleteGlobalIncidents:true } };
  }
  if (role === 'delegate_admin') {
    return { role, menu: { ...cfg.standardMenuPermissions, approvals:true }, delegate: { ...cfg.defaultDelegatePermissions, ...stored } };
  }
  return { role, menu: { ...cfg.standardMenuPermissions }, delegate: { ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false } };
}
async function hasDelegatePermission(uid, email, permission) {
  const perms = await getUserPermissions({ uid, email });
  return perms.role === 'global_admin' || !!perms.delegate?.[permission];
}
async function canUpdateGlobalListing(uid, email) { return hasDelegatePermission(uid, email, 'canUpdateGlobalListings'); }
async function canDeleteGlobalListing(uid, email) { return hasDelegatePermission(uid, email, 'canDeleteGlobalListings'); }
async function canUpdateGlobalIncident(uid, email) { return hasDelegatePermission(uid, email, 'canUpdateGlobalIncidents'); }
async function canDeleteGlobalIncident(uid, email) { return hasDelegatePermission(uid, email, 'canDeleteGlobalIncidents'); }
async function getDelegateAdminsWithPermission(permission) {
  try {
    const { data, error } = await supabase.from('app_users').select('email,permissions').eq('role', 'delegate_admin');
    if (error || !data) return [];
    const cfg = await getAppPermissionsConfig();
    return normalizeRecipients(
      data.filter(u => {
        const stored = safeJsonObject(u.permissions, {});
        const effective = { ...cfg.defaultDelegatePermissions, ...stored };
        return !!effective[permission];
      }).map(u => u.email)
    );
  } catch(e) { warn('getDelegateAdminsWithPermission failed: ' + (e?.message || e)); return []; }
}
const DEFAULT_SLA_HOURS = Number(process.env.DEFAULT_SLA_HOURS || 24);
const DEFAULT_ESCALATION_CC_EMAILS = String(process.env.DEFAULT_ESCALATION_CC_EMAILS || process.env.SLA_CC_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const normalizeRecipients = (emails) => [...new Set((Array.isArray(emails) ? emails : [emails]).map(e => String(e || '').trim()).filter(Boolean).map(e => e.toLowerCase()))];

const escapeHtml = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
const publicAppUrl = (req) => (process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || (req ? `${req.protocol}://${req.get('host')}` : '')).replace(/\/$/, '');
const buttonHtml = (href, label) => '<p style="margin:18px 0"><a href="' + escapeHtml(href) + '" style="background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700">' + escapeHtml(label) + '</a></p>';
const getEffectiveEmailFrom = async (lang='es-CO') => {
  try {
    const cfg = await getAppConfig();
    const isEn = normalizeLanguage(lang) === 'en';
    const addr = ((isEn ? cfg.email_from_address_en : cfg.email_from_address) || '').trim();
    if (!addr) return EMAIL_FROM;
    // Explicit override wins; otherwise derive from community name
    const explicitName = ((isEn ? cfg.email_from_name_en : cfg.email_from_name) || '').trim();
    const communityName = ((isEn ? cfg.complex_name_en : cfg.complex_name_es) || '').trim();
    const name = explicitName || (communityName
      ? (isEn ? `${communityName} Community` : `Comunidad ${communityName}`)
      : '');
    return name ? `${name} <${addr}>` : addr;
  } catch(e) { /* fall through */ }
  return EMAIL_FROM;
};

const sendSpanishEmail = async ({ to, subject, text, html, lang='es-CO' }) => {
  if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render.' };
  const recipients = normalizeRecipients(to);
  if (!recipients.length) return { sent:false, skipped:true, reason:'Recipient email is missing.' };
  const from = await getEffectiveEmailFrom(lang);
  const { data, error: resendError } = await resend.emails.send({ from, to:recipients, subject, text, html });
  if (resendError) throw new Error(resendError.message || JSON.stringify(resendError));
  return { sent:true, skipped:false, id:data?.id || '' };
};


// ─── EDITABLE EMAIL TEMPLATES ───────────────────────────────────────────────
// Defaults moved to server/templates/email-defaults.js — see docs/PLATFORM_ARCHITECTURE.md §11.
const { DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN } = require('./server/templates/email-defaults');

const normalizeLanguage = (language='es-CO') => String(language || 'es-CO').toLowerCase().startsWith('en') ? 'en' : 'es-CO';

const getUserLanguageByEmail = async (email='') => {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return 'es-CO';
  try {
    const { data } = await supabase.from('app_users').select('language_preference').eq('email', em).maybeSingle();
    return normalizeLanguage(data?.language_preference || 'es-CO');
  } catch(e) { return 'es-CO'; }
};
const getEmailTemplates = async (language='es-CO', communityId='__global__') => {
  const lang = normalizeLanguage(language);
  const merged = { ...(lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES) };
  const applyRows = (rows) => (rows||[]).forEach(t => {
    if (merged[t.key]) merged[t.key] = { ...merged[t.key], label:t.label || merged[t.key].label, subject:t.subject || merged[t.key].subject, text:t.text || merged[t.key].text, html:t.html || merged[t.key].html };
  });
  try {
    const { data: globalData, error: ge } = await supabase.from('email_templates').select('key,label,subject,text,html,language').eq('language', lang).eq('community_id', '__global__');
    if (ge) warn('Email template read failed: ' + ge.message);
    else applyRows(globalData);
    if (communityId && communityId !== '__global__') {
      const { data: communityData } = await supabase.from('email_templates').select('key,label,subject,text,html,language').eq('language', lang).eq('community_id', communityId);
      applyRows(communityData);
    }
  } catch(e) { warn('Email template read failed: ' + (e?.message || e)); }
  return merged;
};

const renderTemplate = (template, vars = {}) => String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
  const value = vars[key] ?? '';
  // Variables ending in Html are intentionally trusted server-generated snippets.
  return /Html$/.test(key) ? String(value || '') : escapeHtml(value);
});
const logEmailDelivery = async ({ eventType='', recipients=[], subject='', status='', errorMessage='', relatedEntity='', relatedId='' }) => {
  try {
    await supabase.from('email_delivery_logs').insert({
      id:'eml_' + uuidv4().slice(0,10),
      event_type:String(eventType||''), recipients:normalizeRecipients(recipients), subject:String(subject||''),
      status:String(status||''), error_message:String(errorMessage||''), related_entity:String(relatedEntity||''), related_id:String(relatedId||''),
      created_at:new Date().toISOString()
    });
  } catch(e) { warn('Email delivery log failed: ' + (e?.message || e)); }
};
const sendTemplatedEmail = async ({ key, to, vars={}, language='auto', relatedEntity='', relatedId='', communityId='__global__' }) => {
  const recipients = normalizeRecipients(to);
  if (!recipients.length) {
    await logEmailDelivery({ eventType:key, recipients, subject:'', status:'skipped', errorMessage:'No recipient email provided', relatedEntity, relatedId });
    return { sent:false, skipped:true, reason:'Recipient email is missing.' };
  }
  const groups = {};
  if (language && language !== 'auto') {
    groups[normalizeLanguage(language)] = [...recipients];
  } else {
    for (const r of recipients) {
      const lang = await getUserLanguageByEmail(r);
      groups[lang] = groups[lang] || [];
      groups[lang].push(r);
    }
  }
  // Apply community email routing CC overrides
  if (communityId && communityId !== '__global__') {
    try {
      const { data: routingRow } = await supabase.from('community_config').select('value').eq('community_id', communityId).eq('key', 'community_email_routing').maybeSingle();
      if (routingRow?.value) {
        const routing = safeJsonObject(routingRow.value, {});
        const eventCc = normalizeRecipients((routing[key] || {}).cc || []);
        for (const cc of eventCc) {
          const ccLang = await getUserLanguageByEmail(cc);
          groups[ccLang] = groups[ccLang] || [];
          if (!groups[ccLang].includes(cc)) groups[ccLang].push(cc);
        }
      }
    } catch(e) { warn('Community email routing failed: ' + (e?.message || e)); }
  }
  const results = [];
  for (const [lang, recips] of Object.entries(groups)) {
    const templates = await getEmailTemplates(lang, communityId);
    const defaults = lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES;
    const t = templates[key] || defaults[key];
    if (!t) throw new Error('Email template not found: ' + key);
    const subject = renderTemplate(t.subject, vars);
    const text = renderTemplate(t.text, vars);
    const html = renderTemplate(t.html, vars);
    try {
      const result = await sendSpanishEmail({ to:recips, subject, text, html, lang });
      await logEmailDelivery({ eventType:key, recipients:recips, subject, status:result.sent ? 'sent' : 'skipped', errorMessage:result.reason || '', relatedEntity, relatedId });
      results.push(result);
    } catch(e) {
      await logEmailDelivery({ eventType:key, recipients:recips, subject, status:'failed', errorMessage:e?.message || String(e), relatedEntity, relatedId });
      throw e;
    }
  }
  return { sent: results.some(r=>r.sent), skipped: results.every(r=>r.skipped), grouped:true };
};

const getAppConfig = async (communityId='kai') => {
  const cfg = {
    sla_hours:String(DEFAULT_SLA_HOURS||24),
    escalation_cc_emails:DEFAULT_ESCALATION_CC_EMAILS.join(','),
    complex_name_es: 'Propietarios Airbnb KAI',
    complex_name_en: 'KAI Airbnb Owners',
    complex_location: 'Serena del Mar · Cartagena 🇨🇴',
    complex_logo: '',
    complex_bg: '/morros-kai-bg.jpg',
    email_from_name: 'Comunidad Morros KAI',
    email_from_address: (EMAIL_FROM.match(/<([^>]+)>/) || [])[1]?.trim() || EMAIL_FROM,
    email_from_name_en: 'Morros KAI Community',
    email_from_address_en: (EMAIL_FROM.match(/<([^>]+)>/) || [])[1]?.trim() || EMAIL_FROM,
    mission_title_es:'Misión y normas de la comunidad',
    mission_body_es:'Crear una comunidad organizada, informada y proactiva que proteja el valor de nuestras propiedades y eleve la experiencia en Morros KAI.',
    mission_title_en:'Mission and community rules',
    mission_body_en:'Create an organized, informed, and proactive community that protects property value and improves the Morros KAI guest experience.',
    mission_sections_es:'{"title": "Misión y normas de la comunidad", "subtitle": "Referencia para propietarios aprobados · Propietarios Airbnb KAI", "sectionLabel": "Nuestra misión", "heading": "Crear una comunidad organizada, informada y proactiva.", "body": "La aplicación ayuda a proteger el valor de nuestras propiedades, mejorar la coordinación entre propietarios y elevar la experiencia de los huéspedes en Morros KAI.", "cards": [{"icon": "🏡", "title": "Gestión centralizada", "text": "Organizar apartamentos, contactos, emails de notificación y enlaces importantes en un solo lugar."}, {"icon": "⚠️", "title": "Reportes transparentes", "text": "Documentar incidentes de manera rápida para que el propietario correcto reciba aviso y pueda tomar acción."}, {"icon": "🤝", "title": "Colaboración comunitaria", "text": "Compartir información útil entre propietarios aprobados para operar mejor y prevenir problemas repetidos."}, {"icon": "📊", "title": "Mejora continua", "text": "Usar datos y tendencias para elevar la calidad del servicio, la comunicación y la experiencia del huésped."}], "participationTitle": "📌 Reglas de participación", "participationRules": ["Reportar incidentes con información clara, objetiva y verificable.", "Incluir detalles útiles: apartamento, huésped, fecha, tipo de incidente y descripción.", "Mantener respeto y confidencialidad en los comentarios.", "No publicar contenido ofensivo, especulativo o no relacionado con la operación.", "Usar los reportes para prevenir, corregir y mejorar; no para conflictos personales."], "accessTitle": "🔐 Acceso y responsabilidad", "accessRules": ["El acceso requiere Google Sign-In.", "Cada apartamento solo puede pertenecer a una cuenta aprobada.", "Los nuevos registros quedan pendientes hasta revisión.", "Los propietarios aprobados pueden revisar solicitudes pendientes y aprobar o rechazar con motivo.", "Las notificaciones se envían al email de Google y al email del listing cuando son diferentes."]}'
  };
  // Layer 1: global app_config overrides
  try { const { data, error } = await supabase.from('app_config').select('key,value'); if (!error) (data||[]).forEach(r=>cfg[r.key]=r.value); }
  catch(e) { warn('App config read failed: ' + (e?.message || e)); }
  // Layer 2: per-community config overrides (community_config table)
  if (communityId) {
    try {
      const { data } = await supabase.from('community_config').select('key,value').eq('community_id', communityId);
      (data||[]).forEach(r=>cfg[r.key]=r.value);
    } catch(e) { warn('Community config read failed: ' + (e?.message || e)); }
    // Layer 3: community table branding fields override matching config keys
    try {
      const community = await getCommunity(communityId);
      if (community) {
        if (community.name) cfg.complex_name_es = community.name;
        if (community.name_en) cfg.complex_name_en = community.name_en;
        if (community.logo_url) cfg.complex_logo = community.logo_url;
        if (community.background_url) cfg.complex_bg = community.background_url;
        if (community.city && community.country) cfg.complex_location = `${community.city} · ${community.country}`;
        if (community.tower) cfg.community_tower = community.tower;
      }
    } catch(e) { warn('Community branding override failed: ' + (e?.message || e)); }
  }
  cfg.mission_title = cfg.mission_title_es;
  cfg.mission_body = cfg.mission_body_es;
  return cfg;
};
const getSlaHours = async () => { const cfg = await getAppConfig(); const h = Number(cfg.sla_hours || DEFAULT_SLA_HOURS || 24); return Number.isFinite(h) && h > 0 ? h : 24; };
const getEscalationCcEmails = async () => normalizeRecipients(String((await getAppConfig()).escalation_cc_emails || '').split(','));
const getEmailNotificationConfig = async () => {
  const cfg = await getAppConfig();
  const raw = safeJsonObject(cfg.email_notification_config, {});
  const result = {};
  for (const [key, def] of Object.entries(DEFAULT_EMAIL_NOTIFICATION_CONFIG)) {
    const stored = (raw[key] && typeof raw[key] === 'object') ? raw[key] : {};
    // Stored admin config overrides defaults; defaults are all-on so any fresh
    // deployment gets globalAdmin+delegateAdmin enabled without extra setup.
    result[key] = { ...def, ...stored };
  }
  return result;
};
// Separate owner-only vs operator-only recipient getters (used by config-aware send functions)
const getListingOwnerEmails = (listing) => normalizeRecipients([listing?.email, listing?.user_email, listing?.userEmail]);
const getListingOperatorEmails = (listing) => normalizeRecipients([listing?.operator_email, listing?.operatorEmail]);
const getUserRole = async ({ uid='', email='' } = {}) => {
  const em = String(email || '').trim().toLowerCase();
  if (em && isEnvGlobalAdminEmail(em)) return 'global_admin';
  try {
    let q = supabase.from('app_users').select('role,email').limit(1);
    if (uid) q = q.eq('uid', uid); else if (em) q = q.eq('email', em); else return 'user';
    const { data, error } = await q.maybeSingle();
    if (!error && data?.role) return data.role;
  } catch(e) { warn('Role lookup failed: ' + (e?.message || e)); }
  return 'user';
};
const canManageRegistrations = async (uid, email='', communityId='kai') =>
  (await getUserRole({uid,email})) === 'global_admin' ||
  await hasDelegatePermission(uid, email, 'canApproveRegistrations') ||
  await hasCommunityAdminPerm(uid, email, communityId, 'canApproveRegistrations');
const isGlobalAdmin = async (uid, email='') => (await getUserRole({uid,email})) === 'global_admin';

// ─── MULTI-COMMUNITY HELPERS (v80) ───────────────────────────────────────────
const getCommunityId = (req) => {
  const val = String(req?.headers?.['x-community-id'] || req?.query?.communityId || '').trim().toLowerCase();
  return val || 'kai';
};
const getCommunity = async (communityId='kai') => {
  try {
    const { data } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle();
    return data || null;
  } catch(e) { warn('getCommunity failed: ' + (e?.message || e)); return null; }
};
const getCommunityAdminEmails = async (communityId='kai') => {
  try {
    const { data } = await supabase.from('community_memberships').select('user_email').eq('community_id', communityId).eq('role','community_admin');
    return normalizeRecipients((data||[]).map(r=>r.user_email));
  } catch(e) { return []; }
};
// Returns community admin emails from the DB, falling back to app_config escalation_cc_emails
// when no community admins have been registered yet (backwards-compatible).
const getCommunityEscalationEmails = async (communityId='kai') => {
  const admins = await getCommunityAdminEmails(communityId);
  if (admins.length) return admins;
  return getEscalationCcEmails();
};
const isCommunityAdmin = async (uid='', email='', communityId='kai') => {
  const role = await getUserRole({ uid, email });
  if (role === 'global_admin') return true;
  if (!uid) return false;
  try {
    const { data } = await supabase.from('community_memberships').select('role').eq('community_id', communityId).eq('user_uid', uid).maybeSingle();
    return data?.role === 'community_admin';
  } catch(e) { return false; }
};
const COMMUNITY_ADMIN_PERM_DEFAULTS = { canApproveRegistrations:true, canResolveIncidents:true, canManageListings:false };
const OVERRIDABLE_COMMUNITY_KEYS = ['mission_title_es','mission_body_es','mission_title_en','mission_body_en','mission_sections_es','mission_sections_en','escalation_cc_emails','community_admin_default_permissions','tooltips_es','tooltips_en','ui_labels_es','ui_labels_en'];
const hasCommunityAdminPerm = async (uid='', email='', communityId='kai', permKey='') => {
  if (!uid && !email) return false;
  try {
    let q = supabase.from('community_memberships').select('role,permissions').eq('community_id', communityId).eq('role','community_admin');
    if (uid) q = q.eq('user_uid', uid);
    else q = q.eq('user_email', String(email).trim().toLowerCase());
    const { data } = await q.maybeSingle();
    if (!data) return false;
    const perms = safeJsonObject(data.permissions, {});
    return !!(perms[permKey] ?? COMMUNITY_ADMIN_PERM_DEFAULTS[permKey] ?? false);
  } catch(e) { return false; }
};
const getUserCommunities = async (uid='', email='') => {
  const role = await getUserRole({ uid, email });
  if (role === 'global_admin') {
    try {
      const { data } = await supabase.from('communities').select('*').order('name');
      return data || [];
    } catch(e) { return []; }
  }
  if (!uid) return [];
  try {
    // Communities where user has approved listings (primary membership)
    const { data: listings } = await supabase.from('listings').select('community_id').eq('user_uid', uid).eq('status', 'approved');
    const approvedCommunityIds = [...new Set((listings||[]).map(l => l.community_id).filter(Boolean))];
    // Communities where user is a community admin (may not have approved listing, e.g. global-delegated)
    const { data: memberships } = await supabase.from('community_memberships').select('community_id, role').eq('user_uid', uid);
    const adminCommunityIds = (memberships||[]).map(m => m.community_id).filter(Boolean);
    const allCommunityIds = [...new Set([...approvedCommunityIds, ...adminCommunityIds])];
    if (!allCommunityIds.length) return [];
    const { data: communities } = await supabase.from('communities').select('*').in('id', allCommunityIds).eq('is_active', true).order('name');
    return (communities||[]).map(c => {
      const membership = (memberships||[]).find(m => m.community_id === c.id);
      return { ...c, memberRole: membership?.role || 'member' };
    });
  } catch(e) { return []; }
};
const addHoursIso = (iso, hours) => new Date(new Date(iso).getTime() + Number(hours || 24)*3600000).toISOString();
const getIncidentRecipients = async (listing, { includeEscalationCc=false } = {}) => {
  const base = [listing?.email, listing?.user_email, listing?.userEmail, listing?.operator_email, listing?.operatorEmail];
  if (includeEscalationCc) base.push(...await getEscalationCcEmails());
  return normalizeRecipients(base);
};
// Lookup reporter email by UID from app_users (reporter != always listing owner)
const getReporterEmail = async (reporterUid='') => {
  if (!reporterUid) return '';
  try {
    const { data } = await supabase.from('app_users').select('email').eq('uid', reporterUid).maybeSingle();
    return String(data?.email || '').trim().toLowerCase();
  } catch(e) { return ''; }
};
const getReporterName = async (reporterUid='') => {
  if (!reporterUid) return '';
  try {
    const { data } = await supabase.from('app_users').select('name').eq('uid', reporterUid).maybeSingle();
    return String(data?.name || '').trim();
  } catch(e) { return ''; }
};
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
const sendSplitEmail = async ({ key, individual, group, vars, relatedEntity, relatedId, communityId='__global__' }) => {
  if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured.' };
  const results = [];

  // One email per individual — addressed privately to that person only
  for (const email of individual) {
    try {
      const lang = await getUserLanguageByEmail(email);
      const templates = await getEmailTemplates(lang, communityId);
      const defaults = lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES;
      const t = templates[key] || defaults[key];
      if (!t) continue;
      const subject = renderTemplate(t.subject, vars);
      const text    = renderTemplate(t.text,    vars);
      const html    = renderTemplate(t.html,    vars);
      const result  = await sendSpanishEmail({ to:[email], subject, text, html, lang });
      await logEmailDelivery({ eventType:key, recipients:[email], subject, status:result.sent?'sent':'skipped', errorMessage:result.reason||'', relatedEntity, relatedId });
      results.push(result);
    } catch(e) { warn(`Individual email (${key}) to ${email} failed: ${e?.message||e}`); }
  }

  // One combined email for the admin group (includes community routing CC)
  if (group.length) {
    try {
      const result = await sendTemplatedEmail({ key, to:group, vars, relatedEntity, relatedId, communityId });
      results.push(result);
    } catch(e) { warn(`Group email (${key}) failed: ${e?.message||e}`); }
  }

  const sent = results.some(r => r?.sent);
  const skipped = results.length > 0 && results.every(r => r?.skipped);
  return { sent, skipped, results };
};

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

const isThreeDigitApt = (apt) => /^[0-9]{3}$/.test(String(apt || '').trim());
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
const isValidOptionalUrl = (url) => !String(url || '').trim() || /^https?:\/\/.+/i.test(String(url || '').trim());
const isValidWhatsApp = (v) => { const raw = String(v || '').trim(); if (!raw) return true; return raw.startsWith('+') && raw.replace(/[^0-9]/g, '').length >= 10; };

// Validate and sanitize co-owners array (max 3, each needs firstName+lastName, optional whatsapp)
const parseCoOwners = (raw) => {
  if (!Array.isArray(raw)) return { ok: true, coOwners: [] };
  if (raw.length > 3) return { ok: false, error: 'Maximum 3 co-owners allowed.' };
  const coOwners = [];
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i] || {};
    const firstName = String(o.firstName || '').trim();
    const middleName = String(o.middleName || '').trim();
    const lastName = String(o.lastName || '').trim();
    const wa = String(o.whatsapp || '').trim();
    if (!firstName) return { ok: false, error: `Co-owner ${i + 1}: first name is required.` };
    if (!lastName) return { ok: false, error: `Co-owner ${i + 1}: last name is required.` };
    if (wa && !isValidWhatsApp(wa)) return { ok: false, error: `Co-owner ${i + 1}: WhatsApp must start with + and country code.` };
    coOwners.push({ firstName, middleName, lastName, whatsapp: wa });
  }
  return { ok: true, coOwners };
};

// ─── FIELD MAPPERS ───────────────────────────────────────────────────────────
const listingFromDb = (r) => ({
  id: r.id,
  communityId: r.community_id || 'kai',
  ownerUid: r.owner_uid,
  owner: r.owner,
  userEmail: r.user_email || '',
  registrationId: r.registration_id || '',
  status: r.status || 'approved',
  reason: r.reason || '',
  reviewedByUid: r.reviewed_by_uid || '',
  reviewedByName: r.reviewed_by_name || '',
  reviewedAt: r.reviewed_at || '',
  apt: r.apt,
  tower: r.tower,
  rooms: r.rooms,
  guests: r.guests,
  operator: r.operator || '',
  operatorEmail: r.operator_email || '',
  operatorWhatsapp: r.operator_whatsapp || '',
  contact: r.contact || '',
  email: r.email || '',
  airbnb: r.airbnb || '',
  coOwners: Array.isArray(r.co_owners) ? r.co_owners : [],
  createdAt: (r.created_at || '').slice(0, 10),
});

const listingToDb = (l, communityId='kai') => ({
  id: l.id,
  community_id: l.communityId || communityId || 'kai',
  owner_uid: l.ownerUid,
  owner: l.owner,
  user_email: String(l.userEmail || l.email || '').trim(),
  registration_id: l.registrationId || null,
  status: l.status || 'approved',
  reason: l.reason || '',
  reviewed_by_uid: l.reviewedByUid || '',
  reviewed_by_name: l.reviewedByName || '',
  reviewed_at: l.reviewedAt || null,
  apt: String(l.apt || '').trim(),
  tower: l.tower || 'KAI',
  rooms: String(l.rooms || ''),
  guests: Number(l.guests || 0),
  operator: l.operator || '',
  operator_email: String(l.operatorEmail || l.operator_email || '').trim(),
  operator_whatsapp: String(l.operatorWhatsapp || l.operator_whatsapp || '').trim(),
  contact: String(l.contact || '').trim(),
  email: String(l.email || l.userEmail || '').trim(),
  airbnb: String(l.airbnb || '').trim(),
  co_owners: Array.isArray(l.coOwners) ? l.coOwners : [],
  created_at: l.createdAt || new Date().toISOString(),
});

const incidentFromDb = (r) => ({
  id: r.id,
  reporterUid: r.reporter_uid,
  reporterName: r.reporter_name,
  aptId: r.apt_id,
  aptLabel: r.apt_label,
  guestName: r.guest_name,
  guestCity: r.guest_city || '',
  guestState: r.guest_state || '',
  guestCountry: r.guest_country || '',
  date: r.incident_date,
  type: r.type,
  category: r.category,
  desc: r.description,
  status: r.status,
  ownerGuestNames: r.owner_guest_names || '',
  ownerGuestCity: r.owner_guest_city || '',
  ownerGuestCountry: r.owner_guest_country || '',
  ownerGuests: Array.isArray(r.owner_guests) ? r.owner_guests : [],
  ownerComments: r.owner_comments || '',
  ownerResolution: r.owner_resolution || '',
  ownerResolutionAt: r.owner_resolution_at || '',
  ownerVerifiedAt: r.owner_verified_at || '',
  resolvedAt: r.resolved_at || '',
  resolvedBy: r.resolved_by || '',
  resolutionComments: r.resolution_comments || '',
  ownerViewedAt: r.owner_viewed_at || '',
  ownerEmailOpenedAt: r.owner_email_opened_at || '',
  slaHours: r.sla_hours || 24,
  nextSlaReminderAt: r.next_sla_reminder_at || '',
  slaCycleCount: r.sla_cycle_count || 0,
  createdAt: (r.created_at || '').slice(0, 10),
  createdAtFull: r.created_at || '',
  isGeneral: Boolean(r.is_general),
  photos: Array.isArray(r.photos) ? r.photos : [],
  communityId: r.community_id || 'kai',
});

const incidentToDb = (i, communityId='kai') => ({
  id: i.id,
  community_id: i.communityId || communityId || 'kai',
  reporter_uid: i.reporterUid,
  reporter_name: i.reporterName,
  apt_id: i.aptId,
  apt_label: i.aptLabel,
  guest_name: i.guestName,
  guest_city: i.guestCity || '',
  guest_state: i.guestState || '',
  guest_country: i.guestCountry || '',
  incident_date: i.date || new Date().toISOString().slice(0, 10),
  type: i.type || 'other',
  category: i.category || 'minor',
  description: i.desc,
  status: i.status || 'open',
  owner_guest_names: i.ownerGuestNames || '',
  owner_guest_city: i.ownerGuestCity || '',
  owner_guest_country: i.ownerGuestCountry || '',
  owner_guests: Array.isArray(i.ownerGuests) ? i.ownerGuests : [],
  owner_comments: i.ownerComments || '',
  owner_resolution_at: i.ownerResolutionAt || null,
  owner_verified_at: i.ownerVerifiedAt || null,
  resolved_at: i.resolvedAt || null,
  resolved_by: i.resolvedBy || '',
  resolution_comments: i.resolutionComments || '',
  owner_viewed_at: i.ownerViewedAt || null,
  owner_email_opened_at: i.ownerEmailOpenedAt || null,
  sla_hours: i.slaHours || 24,
  next_sla_reminder_at: i.nextSlaReminderAt || null,
  sla_cycle_count: i.slaCycleCount || 0,
  created_at: i.createdAt || new Date().toISOString(),
  is_general: Boolean(i.isGeneral),
  photos: Array.isArray(i.photos) ? i.photos : [],
});

const notificationFromDb = (r) => ({
  id: r.id,
  communityId: r.community_id || 'kai',
  ownerUid: r.owner_uid,
  listingId: r.listing_id,
  incidentId: r.incident_id,
  title: r.title,
  message: r.message,
  isRead: Boolean(r.is_read),
  emailSent: Boolean(r.email_sent),
  emailError: r.email_error || '',
  createdAt: r.created_at,
  kind: r.kind || 'incident',
  registrationId: r.registration_id || '',
});

const notificationToDb = (n, communityId='kai') => ({
  id: n.id,
  community_id: n.communityId || communityId || 'kai',
  owner_uid: n.ownerUid,
  listing_id: n.listingId || null,
  incident_id: n.incidentId || null,
  title: n.title,
  message: n.message,
  is_read: Boolean(n.isRead),
  email_sent: Boolean(n.emailSent),
  email_error: n.emailError || '',
  created_at: n.createdAt || new Date().toISOString(),
  kind: n.kind || 'incident',
  registration_id: n.registrationId || null,
});

const registrationFromListingRows = (rows=[]) => {
  if (!rows.length) return { status:'none' };
  const first = rows[0];
  return {
    id: first.registration_id || first.id,
    communityId: first.community_id || 'kai',
    userUid: first.owner_uid,
    userName: first.owner,
    userEmail: first.user_email || first.email || '',
    status: first.status,
    reason: first.reason || '',
    reviewedByUid: first.reviewed_by_uid || '',
    reviewedByName: first.reviewed_by_name || '',
    reviewedAt: first.reviewed_at || '',
    createdAt: first.created_at,
    listings: rows.map(listingFromDb),
  };
};

const auditEvent = async ({ listingId, registrationId, actorUid, actorName, action, reason='', before=null, after=null }) => {
  try {
    await supabase.from('listing_audit_events').insert({
      id: 'aud_' + uuidv4().slice(0,8),
      listing_id: listingId || null,
      registration_id: registrationId || null,
      actor_uid: actorUid || '',
      actor_name: actorName || '',
      action,
      reason: String(reason || ''),
      before_data: before || null,
      after_data: after || null,
      created_at: new Date().toISOString(),
    });
  } catch(e) { warn('Audit event save failed: ' + (e?.message || e)); }
};

const auditLog = async ({ entity, entityId='', action, actorUid='', actorEmail='', actorName='', before=null, after=null, reason='' }) => {
  try {
    await supabase.from('audit_logs').insert({
      id: 'log_' + uuidv4().slice(0,10),
      entity: String(entity || ''),
      entity_id: String(entityId || ''),
      action: String(action || ''),
      actor_uid: String(actorUid || ''),
      actor_email: String(actorEmail || '').toLowerCase(),
      actor_name: String(actorName || ''),
      reason: String(reason || ''),
      before_data: before || null,
      after_data: after || null,
      created_at: new Date().toISOString(),
    });
  } catch(e) { warn('Audit log save failed: ' + (e?.message || e)); }
};


const normalizeApt = (apt) => String(apt || '').trim();

const findApartmentConflict = async (apt, { excludeListingId = '', allowedOwnerUid = '', includePending = true, communityId = 'kai' } = {}) => {
  const normalized = normalizeApt(apt);
  if (!normalized) return null;
  const activeStatuses = includePending ? ['approved', 'pending'] : ['approved'];
  const { data: rows, error: qError } = await supabase
    .from('listings')
    .select('id, apt, tower, owner_uid, owner, email, user_email, status')
    .eq('community_id', communityId)
    .eq('apt', normalized)
    .in('status', activeStatuses)
    .limit(5);
  if (qError) throw qError;
  const conflict = (rows || []).find(r => r.id !== excludeListingId && (!allowedOwnerUid || r.owner_uid !== allowedOwnerUid || r.status === 'approved'));
  if (!conflict) return null;
  const isPending = conflict.status === 'pending';
  const towerLabel = conflict.tower || 'KAI';
  return {
    type: isPending ? 'pending' : 'approved',
    message: isPending
      ? `El apartamento ${towerLabel} ${normalized} ya está en una solicitud pendiente de aprobación. No se puede registrar el mismo apartamento con otra cuenta de Google.`
      : `El apartamento ${towerLabel} ${normalized} ya está registrado. Cada apartamento solo puede estar asociado a una cuenta de Google.`,
    apt: normalized,
    owner: conflict.owner || '',
    email: conflict.email || conflict.user_email || '',
  };
};

const validateApartmentUniqueness = async (listings, { ownerUid = '', excludeListingId = '', includePending = true, communityId = 'kai' } = {}) => {
  const seen = new Set();
  for (const l of listings || []) {
    const apt = normalizeApt(l.apt);
    if (seen.has(apt)) {
      return { type: 'duplicate_in_request', message: `El apartamento ${apt} está repetido en la solicitud. Cada apartamento solo puede registrarse una vez.` };
    }
    seen.add(apt);
    const conflict = await findApartmentConflict(apt, { excludeListingId, allowedOwnerUid: ownerUid, includePending, communityId });
    if (conflict) return conflict;
  }
  return null;
};

const getApprovedUser = async (uid) => {
  const { data, error } = await supabase.from('listings').select('*').eq('owner_uid', uid).eq('status','approved').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
};
const validateListingInput = (l) => {
  if (!l || !l.apt || !l.rooms || !l.guests) return 'Apartamento, habitaciones y huéspedes son requeridos.';
  if (!isThreeDigitApt(l.apt)) return 'El apartamento debe tener exactamente 3 dígitos. Ejemplo: 000.';
  if ((l.operatorEmail || l.operator_email) && !isValidEmail(l.operatorEmail || l.operator_email)) return 'Ingrese un email válido para el operador.';
  if (!isValidOptionalUrl(l.airbnb)) return 'El URL de Airbnb debe comenzar con http:// o https:// cuando se ingrese.';
  return '';
};
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



app.get('/api/admin/email-templates', async (req, res) => {
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

app.put('/api/admin/email-templates', async (req, res) => {
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

app.get('/api/admin/email-notification-config', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error:'Global admin only.' });
  res.json({ config: await getEmailNotificationConfig(), defaults: DEFAULT_EMAIL_NOTIFICATION_CONFIG });
});

app.put('/api/admin/email-notification-config', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, config } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Global admin only.' });
  if (!config || typeof config !== 'object') return res.status(400).json({ error:'config object required.' });
  // Merge submitted config with defaults — only known keys, boolean values only
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

app.post('/api/contact/send-email', async (req, res) => {
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

app.put('/api/users/preference', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email, name, language } = req.body || {};
  if (!uid || !email) return res.status(400).json({ error:'uid and email are required.' });
  const lang = ['es-CO','en'].includes(language) ? language : 'es-CO';
  const { error } = await supabase.from('app_users').upsert({ uid, email:String(email).toLowerCase(), name:name||'', language_preference:lang, updated_at:new Date().toISOString() }, { onConflict:'uid' });
  if (error) return sendSupabaseError(res, error);
  res.json({ ok:true, language:lang });
});

app.get('/api/users/profile', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const uid = String(req.query.uid || '').trim();
  if (!uid) return res.status(400).json({ error:'uid is required.' });
  // Try with notification_email; fall back to base columns if column not yet in schema cache
  let { data, error } = await supabase.from('app_users').select('whatsapp,country,notification_email').eq('uid', uid).maybeSingle();
  if (error && String(error.message || '').includes('notification_email')) {
    ({ data, error } = await supabase.from('app_users').select('whatsapp,country').eq('uid', uid).maybeSingle());
  }
  if (error) return sendSupabaseError(res, error);
  res.json({ whatsapp: data?.whatsapp || '', country: data?.country || 'Colombia', notificationEmail: data?.notification_email || '' });
});

app.put('/api/users/profile', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email, whatsapp, country, notificationEmail } = req.body || {};
  if (!uid || !email) return res.status(400).json({ error:'uid and email are required.' });
  const waRaw = String(whatsapp || '').trim();
  // Auto-normalize: prepend + if the number has 10+ digits but no country code prefix
  const waDigits = waRaw.replace(/[^0-9]/g, '');
  const wa = waRaw ? (waRaw.startsWith('+') ? waRaw : (waDigits.length >= 10 ? '+' + waDigits : waRaw)) : '';
  const em = String(email).toLowerCase();
  const countryVal = String(country || 'Colombia').trim();
  const notifEmailRaw = String(notificationEmail || '').trim().toLowerCase();
  const notifEmail = notifEmailRaw && isValidEmail(notifEmailRaw) ? notifEmailRaw : '';
  // Email used for notifications: notification_email if set and valid, otherwise Google email
  const effectiveEmail = notifEmail || em;
  // Core upsert without notification_email — safe even before schema migration runs
  const { error } = await supabase.from('app_users').upsert({
    uid, email: em, whatsapp: wa, country: countryVal, updated_at: new Date().toISOString()
  }, { onConflict: 'uid' });
  if (error) return sendSupabaseError(res, error);
  // Save notification_email separately so a missing column never breaks the main profile save
  const { error: neErr } = await supabase.from('app_users').update({ notification_email: notifEmail }).eq('uid', uid);
  if (neErr) warn('notification_email save failed (run schema migration): ' + (neErr.message || neErr));
  // Propagate contact info to all of this owner's listings so notifications stay in sync
  if (wa || effectiveEmail) {
    await supabase.from('listings').update({ contact: wa, email: effectiveEmail }).eq('owner_uid', uid).in('status', ['approved', 'pending']);
  }
  res.json({ ok: true, whatsapp: wa, country: countryVal, notificationEmail: notifEmail });
});

app.get('/api/admin/me', async (req, res) => {
  log('[ADMIN] me requested by ' + String(req.query?.email || ''));
  if (!requireSupabaseEnv(res)) return;
  const uid = String(req.query.uid || '').trim();
  const email = String(req.query.email || '').trim().toLowerCase();
  const name = String(req.query.name || '').trim();
  const clientLang = normalizeLanguage(req.query.lang || 'es-CO');
  const role = await getUserRole({ uid, email });
  let languagePreference = clientLang;
  try {
    if (uid && email) {
      // Check for existing row so we can preserve a stored language preference
      const { data: existing } = await supabase.from('app_users').select('language_preference').eq('uid', uid).maybeSingle();
      if (existing) {
        languagePreference = normalizeLanguage(existing.language_preference || clientLang);
        const row = { uid, email, name, updated_at: new Date().toISOString() };
        if (role === 'global_admin') row.role = 'global_admin';
        await supabase.from('app_users').update(row).eq('uid', uid);
      } else {
        languagePreference = clientLang;
        const row = { uid, email, name, language_preference: clientLang, updated_at: new Date().toISOString() };
        if (role === 'global_admin') row.role = 'global_admin';
        await supabase.from('app_users').insert(row);
      }
    }
  } catch(e) { warn('app_users upsert in /api/admin/me failed: ' + (e?.message || e)); }
  const communityId = getCommunityId(req);
  const config = await getAppConfig(communityId);
  const permissions = await getUserPermissions({ uid, email });
  const communities = await getUserCommunities(uid, email);
  let communityAdminOf = [];
  if (uid) {
    try {
      const { data: caMemberships } = await supabase.from('community_memberships')
        .select('community_id,permissions').eq('user_uid', uid).eq('role','community_admin');
      communityAdminOf = (caMemberships||[]).map(m => ({
        communityId: m.community_id,
        permissions: safeJsonObject(m.permissions, COMMUNITY_ADMIN_PERM_DEFAULTS)
      }));
    } catch(e) { communityAdminOf = []; }
  }
  const isCommunityAdminFlag = communityAdminOf.length > 0;
  const canManageRegs = role === 'global_admin' || !!permissions.delegate?.canApproveRegistrations ||
    await hasCommunityAdminPerm(uid, email, communityId, 'canApproveRegistrations');
  res.json({ role, isGlobalAdmin: role === 'global_admin', canManageRegistrations: canManageRegs, languagePreference, config, permissions, communityId, communities, communityAdminOf, isCommunityAdmin: isCommunityAdminFlag });
});

app.put('/api/admin/config', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, slaHours, escalationCcEmails, analyticsEnabled, missionTitle, missionBody, missionTitleEs, missionBodyEs, missionTitleEn, missionBodyEn, missionSectionsEs, missionSectionsEn, standardMenuPermissions, defaultDelegatePermissions, communityAdminDefaultPermissions, tooltipsEs, tooltipsEn, uiLabelsEs, uiLabelsEn, complexNameEs, complexNameEn, complexLocation, complexLogo, complexBg, emailFromName, emailFromAddress, emailFromNameEn, emailFromAddressEn, nav_config, communityFeatureEnabled, defaultCommunityId } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede cambiar la configuración.' });
  const before = await getAppConfig();
  const rows = [];
  if (slaHours !== undefined) rows.push({ key:'sla_hours', value:String(Math.max(1, Number(slaHours || 24))) });
  if (escalationCcEmails !== undefined) rows.push({ key:'escalation_cc_emails', value:normalizeRecipients(String(escalationCcEmails || '').split(',')).join(',') });
  if (analyticsEnabled !== undefined) rows.push({ key:'analytics_enabled', value:(analyticsEnabled === true || String(analyticsEnabled) === 'true') ? 'true' : 'false' });
  if (missionTitle !== undefined) rows.push({ key:'mission_title_es', value:String(missionTitle || '') });
  if (missionBody !== undefined) rows.push({ key:'mission_body_es', value:String(missionBody || '') });
  if (missionTitleEs !== undefined) rows.push({ key:'mission_title_es', value:String(missionTitleEs || '') });
  if (missionBodyEs !== undefined) rows.push({ key:'mission_body_es', value:String(missionBodyEs || '') });
  if (missionTitleEn !== undefined) rows.push({ key:'mission_title_en', value:String(missionTitleEn || '') });
  if (missionBodyEn !== undefined) rows.push({ key:'mission_body_en', value:String(missionBodyEn || '') });
  if (missionSectionsEs !== undefined) rows.push({ key:'mission_sections_es', value: typeof missionSectionsEs === 'string' ? missionSectionsEs : JSON.stringify(missionSectionsEs) });
  if (missionSectionsEn !== undefined) rows.push({ key:'mission_sections_en', value: typeof missionSectionsEn === 'string' ? missionSectionsEn : JSON.stringify(missionSectionsEn) });
  if (standardMenuPermissions !== undefined) rows.push({ key:'standard_menu_permissions', value: JSON.stringify(safeJsonObject(standardMenuPermissions, DEFAULT_STANDARD_MENU_PERMISSIONS)) });
  if (defaultDelegatePermissions !== undefined) rows.push({ key:'default_delegate_permissions', value: JSON.stringify(safeJsonObject(defaultDelegatePermissions, DEFAULT_DELEGATE_PERMISSIONS)) });
  if (communityAdminDefaultPermissions !== undefined) rows.push({ key:'default_community_admin_permissions', value: JSON.stringify(safeJsonObject(communityAdminDefaultPermissions, COMMUNITY_ADMIN_PERM_DEFAULTS)) });
  if (tooltipsEs !== undefined) rows.push({ key:'tooltips_es', value: typeof tooltipsEs === 'string' ? tooltipsEs : JSON.stringify(safeJsonObject(tooltipsEs, {})) });
  if (tooltipsEn !== undefined) rows.push({ key:'tooltips_en', value: typeof tooltipsEn === 'string' ? tooltipsEn : JSON.stringify(safeJsonObject(tooltipsEn, {})) });
  if (uiLabelsEs !== undefined) rows.push({ key:'ui_labels_es', value: typeof uiLabelsEs === 'string' ? uiLabelsEs : JSON.stringify(safeJsonObject(uiLabelsEs, {})) });
  if (uiLabelsEn !== undefined) rows.push({ key:'ui_labels_en', value: typeof uiLabelsEn === 'string' ? uiLabelsEn : JSON.stringify(safeJsonObject(uiLabelsEn, {})) });
  if (complexNameEs !== undefined) rows.push({ key:'complex_name_es', value:String(complexNameEs||'') });
  if (complexNameEn !== undefined) rows.push({ key:'complex_name_en', value:String(complexNameEn||'') });
  if (complexLocation !== undefined) rows.push({ key:'complex_location', value:String(complexLocation||'') });
  if (complexLogo !== undefined) rows.push({ key:'complex_logo', value:String(complexLogo||'') });
  if (complexBg !== undefined) rows.push({ key:'complex_bg', value:String(complexBg||'') });
  if (emailFromName !== undefined) rows.push({ key:'email_from_name', value:String(emailFromName||'') });
  if (emailFromAddress !== undefined) rows.push({ key:'email_from_address', value:String(emailFromAddress||'').toLowerCase().trim() });
  if (emailFromNameEn !== undefined) rows.push({ key:'email_from_name_en', value:String(emailFromNameEn||'') });
  if (emailFromAddressEn !== undefined) rows.push({ key:'email_from_address_en', value:String(emailFromAddressEn||'').toLowerCase().trim() });
  if (nav_config !== undefined) rows.push({ key:'nav_config', value: typeof nav_config === 'string' ? nav_config : JSON.stringify(safeJsonObject(nav_config, {})) });
  if (communityFeatureEnabled !== undefined) rows.push({ key:'community_feature_enabled', value: communityFeatureEnabled === true || String(communityFeatureEnabled) === 'true' ? 'true' : 'false' });
  if (defaultCommunityId !== undefined) rows.push({ key:'default_community_id', value: String(defaultCommunityId||'kai') });
  for (const row of rows) {
    const { error } = await supabase.from('app_config').upsert(row, { onConflict:'key' });
    if (error) return sendSupabaseError(res, error);
  }
  const after = await getAppConfig();
  await auditLog({ entity:'app_config', entityId:'global', action:'update', actorUid, actorEmail, before, after });
  res.json({ ok:true, config: after });
});

app.get('/api/admin/users', async (req, res) => {
  log('[ADMIN] users requested by ' + String(req.query?.email || ''));
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error:'Solo un administrador global puede ver usuarios.' });
  const { data: rows, error } = await supabase.from('app_users').select('*').order('email', { ascending:true });
  if (error) return sendSupabaseError(res, error);
  const { data: approvedListings, error: lerr } = await supabase.from('listings').select('owner_uid,community_id').eq('status','approved');
  if (lerr) return sendSupabaseError(res, lerr);
  const approved = new Set((approvedListings || []).map(x => x.owner_uid).filter(Boolean));
  const communityByUid = {};
  (approvedListings||[]).forEach(l => { if(l.owner_uid && l.community_id) { if(!communityByUid[l.owner_uid]) communityByUid[l.owner_uid]=[]; if(!communityByUid[l.owner_uid].includes(l.community_id)) communityByUid[l.owner_uid].push(l.community_id); } });
  const globalEmails = getGlobalAdminEmails();
  const permsCfg = await getAppPermissionsConfig();
  // Fetch all community memberships and community names in one pass
  const { data: memberships } = await supabase.from('community_memberships').select('user_uid,community_id,role,permissions');
  const { data: communityRows } = await supabase.from('communities').select('id,name,name_en');
  const communityNameMap = {};
  (communityRows||[]).forEach(c => { communityNameMap[c.id] = { name:c.name, nameEn:c.name_en||c.name }; });
  // Group memberships by user_uid
  const membershipByUid = {};
  (memberships||[]).forEach(m => {
    if (!membershipByUid[m.user_uid]) membershipByUid[m.user_uid] = [];
    membershipByUid[m.user_uid].push({ communityId:m.community_id, role:m.role, permissions:safeJsonObject(m.permissions, COMMUNITY_ADMIN_PERM_DEFAULTS), communityName:communityNameMap[m.community_id]?.name||m.community_id, communityNameEn:communityNameMap[m.community_id]?.nameEn||m.community_id });
  });
  const users = (rows || []).filter(u => approved.has(u.uid) || globalEmails.includes(String(u.email || '').trim().toLowerCase())).map(u => {
    const envGlobal = globalEmails.includes(String(u.email || '').trim().toLowerCase());
    const role = envGlobal ? 'global_admin' : normalizeRole(u.role || 'user');
    const storedPerms = safeJsonObject(u.permissions, {});
    const permissions = role === 'global_admin'
      ? { ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:true, canDeleteGlobalListings:true, canUpdateGlobalIncidents:true, canDeleteGlobalIncidents:true }
      : role === 'delegate_admin' ? { ...permsCfg.defaultDelegatePermissions, ...storedPerms } : {};
    const communityMemberships = membershipByUid[u.uid] || [];
    return { uid:u.uid, email:u.email, name:u.name || '', role, permissions, languagePreference:u.language_preference || 'es-CO', approved: approved.has(u.uid), envGlobal, communityMemberships, communityIds: communityByUid[u.uid] || [] };
  });
  res.json({ users, standardMenuPermissions: permsCfg.standardMenuPermissions, defaultDelegatePermissions: permsCfg.defaultDelegatePermissions, defaultCommunityAdminPermissions: permsCfg.defaultCommunityAdminPermissions });
});

app.post('/api/admin/delegate', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, uid, email, name, role, permissions } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede delegar administradores.' });
  if (!uid || !email || !['user','delegate_admin','global_admin'].includes(role)) return res.status(400).json({ error:'uid, email and role are required.' });
  if (role === 'delegate_admin' || role === 'global_admin') {
    const approved = await getApprovedUser(uid);
    if (!approved && role !== 'global_admin') return res.status(400).json({ error:'Solo usuarios registrados y aprobados pueden ser delegados para aprobar/rechazar registros.' });
  }
  const beforeRole = await getUserRole({ uid, email });
  const normalizedPermissions = role === 'delegate_admin' ? safeJsonObject(permissions, DEFAULT_DELEGATE_PERMISSIONS) : {};
  const { error } = await supabase.from('app_users').upsert({ uid, email:String(email).toLowerCase(), name:name||'', role, permissions: normalizedPermissions, updated_at:new Date().toISOString() }, { onConflict:'uid' });
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'user_role', entityId:uid, action:'delegate_update', actorUid, actorEmail, before:{ role: beforeRole }, after:{ uid, email, name, role, permissions: normalizedPermissions } });
  res.json({ ok:true });
});

// ── Audit log viewer (global admin only) ─────────────────────────────────────
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
app.get('/api/communities', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  try {
    const communities = await getUserCommunities(uid, email);
    res.json({ communities });
  } catch(e) { sendSupabaseError(res, e); }
});

// GET /api/admin/communities/filter-options — distinct city/state/country for filter dropdowns
app.get('/api/admin/communities/filter-options', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error: 'Forbidden.' });
  try {
    const { data, error } = await supabase.from('communities').select('city,state,country').order('name');
    if (error) return sendSupabaseError(res, error);
    const rows = data || [];
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    res.json({
      cities:    uniq(rows.map(r => r.city)),
      states:    uniq(rows.map(r => r.state)),
      countries: uniq(rows.map(r => r.country)),
    });
  } catch(e) { sendSupabaseError(res, e); }
});

// GET /api/admin/communities — returns all communities including inactive; paginated + filtered
app.get('/api/admin/communities', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email, q='', city='', state='', country='', active='', page='1', limit='20' } = req.query || {};
  if (!(await isGlobalAdmin(uid, email))) return res.json({ communities: [], total: 0 });
  try {
    let query = supabase.from('communities').select('*', { count: 'exact' }).order('name');
    if (q)       query = query.or(`name.ilike.%${q}%,id.ilike.%${q}%,name_en.ilike.%${q}%`);
    if (city)    query = query.ilike('city', `%${city}%`);
    if (state)   query = query.ilike('state', `%${state}%`);
    if (country) query = query.ilike('country', `%${country}%`);
    if (active === 'true')  query = query.eq('is_active', true);
    if (active === 'false') query = query.eq('is_active', false);
    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    query = query.range((pageNum - 1) * pageSize, pageNum * pageSize - 1);
    const { data, error, count } = await query;
    if (error) return sendSupabaseError(res, error);
    const communities = data || [];
    if (communities.length) {
      const { data: cfgRows } = await supabase.from('community_config')
        .select('community_id,value').eq('key', 'config_overrides_enabled')
        .in('community_id', communities.map(c => c.id));
      const overridesMap = {};
      (cfgRows || []).forEach(r => { overridesMap[r.community_id] = r.value === 'true'; });
      communities.forEach(c => { c.overridesEnabled = !!overridesMap[c.id]; });
    }
    res.json({ communities, total: count ?? communities.length });
  } catch(e) { sendSupabaseError(res, e); }
});

// POST /api/communities — global admin only
app.post('/api/communities', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, id, name, nameEn='', tower='', city='', state='', country='Colombia', logoUrl='', backgroundUrl='/morros-kai-bg.jpg', description='', descriptionEn='' } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede crear comunidades.' });
  if (!id || !name) return res.status(400).json({ error:'id and name are required.' });
  if (!/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ error:'Community id must be lowercase letters, numbers, and hyphens only.' });
  const row = { id, name, name_en:nameEn, tower, city, state, country, logo_url:logoUrl, background_url:backgroundUrl, description, description_en:descriptionEn, is_active:true, created_by_uid:actorUid||'', created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
  const { data, error } = await supabase.from('communities').insert(row).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'community', entityId:id, action:'create', actorUid:actorUid||'', actorEmail:actorEmail||'', after:data });
  res.json(data);
});

// GET /api/communities/public — unauthenticated; returns active communities for login picker
app.get('/api/communities/public', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  try {
    const cfg = await getAppConfig();
    const communityFeatureEnabled = cfg.community_feature_enabled !== 'false';
    const defaultCommunityId = cfg.default_community_id || 'kai';
    if (!communityFeatureEnabled) {
      return res.json({ communitiesEnabled: false, defaultCommunityId });
    }
    const { data, error } = await supabase
      .from('communities')
      .select('id,name,name_en,logo_url,background_url,city,country,tower')
      .eq('is_active', true)
      .order('name');
    if (error) return sendSupabaseError(res, error);
    res.json({ communitiesEnabled: true, communities: data || [], defaultCommunityId });
  } catch(e) { sendSupabaseError(res, e); }
});

// GET /api/communities/:id
app.get('/api/communities/:id', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { data, error } = await supabase.from('communities').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return sendSupabaseError(res, error);
  if (!data) return res.status(404).json({ error:'Community not found.' });
  res.json(data);
});

// PUT /api/communities/:id — global admin or community admin
app.put('/api/communities/:id', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, name, nameEn, tower, city, state, country, logoUrl, backgroundUrl, description, descriptionEn, isActive } = req.body || {};
  if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador global o admin de esta comunidad puede actualizar la comunidad.' });
  const before = await getCommunity(req.params.id);
  if (!before) return res.status(404).json({ error:'Community not found.' });
  const update = {};
  if (name !== undefined) update.name = String(name);
  if (nameEn !== undefined) update.name_en = String(nameEn);
  if (tower !== undefined) update.tower = String(tower);
  if (city !== undefined) update.city = String(city);
  if (state !== undefined) update.state = String(state);
  if (country !== undefined) update.country = String(country);
  if (logoUrl !== undefined) update.logo_url = String(logoUrl);
  if (backgroundUrl !== undefined) update.background_url = String(backgroundUrl);
  if (description !== undefined) update.description = String(description);
  if (descriptionEn !== undefined) update.description_en = String(descriptionEn);
  if (isActive !== undefined) update.is_active = Boolean(isActive);
  update.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('communities').update(update).eq('id', req.params.id).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'community', entityId:req.params.id, action:'update', actorUid:actorUid||'', actorEmail:actorEmail||'', before, after:data });
  res.json(data);
});

// DELETE /api/communities/:id — global admin only
app.delete('/api/communities/:id', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede eliminar comunidades.' });
  if (req.params.id === 'kai') return res.status(400).json({ error:'No se puede eliminar la comunidad predeterminada.' });
  const before = await getCommunity(req.params.id);
  if (!before) return res.status(404).json({ error:'Community not found.' });
  const { error } = await supabase.from('communities').delete().eq('id', req.params.id);
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'community', entityId:req.params.id, action:'delete', actorUid:actorUid||'', actorEmail:actorEmail||'', before });
  res.json({ ok:true });
});

// GET /api/communities/:id/config — read community config overrides
app.get('/api/communities/:id/config', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  if (!(await isCommunityAdmin(uid, email, req.params.id))) return res.status(403).json({ error:'Community admin access required.' });
  const globalCfg = await getAppConfig(); // global only (no community overlay)
  const { data: overrideRows } = await supabase.from('community_config')
    .select('key,value').eq('community_id', req.params.id);
  const communityOverrides = {};
  let overridesEnabled = false;
  (overrideRows||[]).forEach(r => {
    if (r.key === 'config_overrides_enabled') overridesEnabled = r.value === 'true';
    else if (OVERRIDABLE_COMMUNITY_KEYS.includes(r.key)) communityOverrides[r.key] = r.value;
  });
  const globalValues = {};
  OVERRIDABLE_COMMUNITY_KEYS.forEach(k => { globalValues[k] = globalCfg[k] || ''; });
  res.json({ globalValues, communityOverrides, overridesEnabled, overridableKeys: OVERRIDABLE_COMMUNITY_KEYS });
});

// PUT /api/communities/:id/config — write community config overrides
app.put('/api/communities/:id/config', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, overrides } = req.body || {};
  const isGA = await isGlobalAdmin(actorUid, actorEmail);
  if (!isGA && !(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Forbidden.' });
  if (!isGA) {
    const { data: flagRow } = await supabase.from('community_config').select('value')
      .eq('community_id', req.params.id).eq('key','config_overrides_enabled').maybeSingle();
    if (flagRow?.value !== 'true') return res.status(403).json({ error:'Config overrides are not enabled for this community.' });
  }
  const allowedKeys = new Set(OVERRIDABLE_COMMUNITY_KEYS);
  for (const [key, value] of Object.entries(overrides || {})) {
    if (!allowedKeys.has(key)) continue;
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    if (strVal === '') {
      await supabase.from('community_config').delete().eq('community_id', req.params.id).eq('key', key);
    } else {
      const { error: uErr } = await supabase.from('community_config').upsert(
        { community_id: req.params.id, key, value: strVal, updated_at: new Date().toISOString() },
        { onConflict: 'community_id,key' }
      );
      if (uErr) return sendSupabaseError(res, uErr);
    }
  }
  await auditLog({ entity:'community_config', entityId:req.params.id, action:'update_overrides', actorUid:actorUid||'', actorEmail:actorEmail||'', after:overrides });
  res.json({ ok:true });
});

// PUT /api/communities/:id/config/overrides-enabled — global admin toggle
app.put('/api/communities/:id/config/overrides-enabled', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, enabled } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Global admin only.' });
  const { error: upsertErr } = await supabase.from('community_config').upsert(
    { community_id: req.params.id, key: 'config_overrides_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
    { onConflict: 'community_id,key' }
  );
  if (upsertErr) return sendSupabaseError(res, upsertErr);
  await auditLog({ entity:'community_config', entityId:req.params.id, action:'set_overrides_enabled', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ enabled } });
  res.json({ ok:true });
});

// GET /api/communities/:id/members — approved listing owners are members; community_memberships tracks admin status
app.get('/api/communities/:id/members', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  if (!(await isCommunityAdmin(uid, email, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede ver los miembros de la comunidad.' });
  // Derive members from approved listings (listings uses owner_uid / email, not user_uid / user_email)
  const { data: listings, error: lErr } = await supabase.from('listings').select('owner_uid,email,registration_id,created_at,apt,operator_whatsapp').eq('community_id', req.params.id).eq('status','approved').order('created_at', { ascending:true });
  if (lErr) return sendSupabaseError(res, lErr);
  // Collect unique users (one entry per owner_uid; a user may own multiple listings)
  const seen = new Set();
  const uniqueUsers = [];
  const ownerApts = {};
  for (const l of (listings||[])) {
    const key = l.owner_uid || l.email;
    if (!key) continue;
    if (l.apt) { if (!ownerApts[key]) ownerApts[key]=[]; ownerApts[key].push(l.apt); }
    if (!seen.has(key)) { seen.add(key); uniqueUsers.push(l); }
  }
  // Overlay community_memberships to get community_admin status
  const { data: admins } = await supabase.from('community_memberships').select('*').eq('community_id', req.params.id);
  const adminMap = {};
  (admins||[]).forEach(a => { adminMap[a.user_uid] = a; });
  // Enrich with app_users for display name, whatsapp and platform role
  const uids = uniqueUsers.map(u => u.owner_uid).filter(Boolean);
  let userMap = {};
  if (uids.length) {
    const { data: appUsers } = await supabase.from('app_users').select('uid,name,language_preference,role,whatsapp').in('uid', uids);
    (appUsers||[]).forEach(u => { userMap[u.uid] = u; });
  }
  const globalAdminSet = new Set(getGlobalAdminEmails());
  const members = uniqueUsers.map(u => {
    const key = u.owner_uid || u.email;
    const communityAdminEntry = u.owner_uid ? adminMap[u.owner_uid] : null;
    const appUser = u.owner_uid ? userMap[u.owner_uid] : null;
    const memberEmail = (u.email || appUser?.email || '').toLowerCase();
    const isGlobalAdmin = !!(memberEmail && globalAdminSet.has(memberEmail));
    const platformRole = isGlobalAdmin ? 'global_admin' : (appUser?.role || 'user');
    return {
      userUid: u.owner_uid,
      userEmail: u.email,
      name: appUser?.name || '',
      whatsapp: appUser?.whatsapp || u.operator_whatsapp || '',
      apts: ownerApts[key] || [],
      languagePreference: appUser?.language_preference || 'es-CO',
      platformRole,
      joinedAt: u.created_at,
      isCommunityAdmin: !!communityAdminEntry,
      adminPermissions: communityAdminEntry ? safeJsonObject(communityAdminEntry.permissions, COMMUNITY_ADMIN_PERM_DEFAULTS) : COMMUNITY_ADMIN_PERM_DEFAULTS,
    };
  });
  res.json({ members });
});

// POST /api/communities/:id/members/:uid/promote — promote an approved member to community admin
app.post('/api/communities/:id/members/:uid/promote', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, userEmail, permissions } = req.body || {};
  if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede promover miembros.' });
  if (!req.params.uid) return res.status(400).json({ error:'uid is required.' });
  const permsCfg = await getAppPermissionsConfig();
  const effectivePerms = safeJsonObject(permissions, permsCfg.defaultCommunityAdminPermissions);
  const row = { id:'mbr_'+uuidv4().slice(0,8), community_id:req.params.id, user_uid:req.params.uid, user_email:String(userEmail||'').toLowerCase(), role:'community_admin', permissions:effectivePerms, invited_by_uid:actorUid||'', joined_at:new Date().toISOString() };
  const { data, error } = await supabase.from('community_memberships').upsert(row, { onConflict:'community_id,user_uid' }).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'community_membership', entityId:req.params.id, action:'promote_admin', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ userUid:req.params.uid, userEmail } });
  res.json({ ok:true });
});

// DELETE /api/communities/:id/members/:uid/promote — demote community admin back to regular member
app.delete('/api/communities/:id/members/:uid/promote', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail } = req.body || {};
  if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede cambiar roles.' });
  const { error } = await supabase.from('community_memberships').delete().eq('community_id', req.params.id).eq('user_uid', req.params.uid);
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'community_membership', entityId:req.params.id, action:'demote_admin', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ demotedUid:req.params.uid } });
  res.json({ ok:true });
});

// PATCH /api/communities/:id/members/:uid/permissions — update community admin permissions
app.patch('/api/communities/:id/members/:uid/permissions', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, permissions } = req.body || {};
  if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede cambiar permisos.' });
  const perms = safeJsonObject(permissions, COMMUNITY_ADMIN_PERM_DEFAULTS);
  const { data, error } = await supabase.from('community_memberships').update({ permissions:perms }).eq('community_id', req.params.id).eq('user_uid', req.params.uid).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'community_membership', entityId:req.params.id, action:'update_permissions', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ uid:req.params.uid, permissions:perms } });
  res.json({ ok:true, permissions:perms });
});

// GET /api/communities/:id/email-routing — returns global notification config + community CC overrides
app.get('/api/communities/:id/email-routing', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  const communityId = req.params.id;
  if (!(await isCommunityAdmin(uid, email, communityId))) return res.status(403).json({ error:'Community admin or global admin required.' });
  const globalConfig = await getEmailNotificationConfig();
  let communityRouting = {};
  try {
    const { data } = await supabase.from('community_config').select('value').eq('community_id', communityId).eq('key', 'community_email_routing').maybeSingle();
    if (data?.value) communityRouting = safeJsonObject(data.value, {});
  } catch(e) { warn('community email routing load failed: ' + (e?.message || e)); }
  res.json({ globalConfig, communityRouting, eventKeys: Object.keys(globalConfig) });
});

// PUT /api/communities/:id/email-routing — community admin saves CC overrides per event type
app.put('/api/communities/:id/email-routing', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, routing } = req.body || {};
  const communityId = req.params.id;
  if (!(await isCommunityAdmin(actorUid, actorEmail, communityId))) return res.status(403).json({ error:'Community admin or global admin required.' });
  const globalAdmin = await isGlobalAdmin(actorUid, actorEmail);
  if (!globalAdmin) {
    const { data: oeRow } = await supabase.from('community_config').select('value').eq('community_id', communityId).eq('key', 'config_overrides_enabled').maybeSingle();
    if (oeRow?.value !== 'true') return res.status(403).json({ error:'Los overrides no están habilitados para esta comunidad.' });
  }
  if (!routing || typeof routing !== 'object') return res.status(400).json({ error:'routing object required.' });
  const sanitized = {};
  const globalConfig = await getEmailNotificationConfig();
  for (const [key, val] of Object.entries(routing)) {
    if (!globalConfig[key]) continue;
    const cc = normalizeRecipients(Array.isArray(val?.cc) ? val.cc : String(val?.cc || '').split(',').map(e=>e.trim()));
    if (cc.length) sanitized[key] = { cc };
  }
  await supabase.from('community_config').delete().eq('community_id', communityId).eq('key', 'community_email_routing');
  if (Object.keys(sanitized).length) {
    const { error } = await supabase.from('community_config').insert({ community_id:communityId, key:'community_email_routing', value:JSON.stringify(sanitized) });
    if (error) return sendSupabaseError(res, error);
  }
  await auditLog({ entity:'community_email_routing', entityId:communityId, action:'update', actorUid:actorUid||'', actorEmail:actorEmail||'', after:sanitized });
  res.json({ ok:true, communityRouting:sanitized });
});

// GET /api/me/communities — communities the calling user belongs to
app.get('/api/me/communities', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const uid = String(req.query.uid || '').trim();
  const email = String(req.query.email || '').trim();
  if (!uid && !email) return res.status(400).json({ error:'uid or email is required.' });
  try {
    const communities = await getUserCommunities(uid, email);
    res.json({ communities });
  } catch(e) { sendSupabaseError(res, e); }
});

// ─── REPUTATION ────────────────────────────────────────────────────────────────
// GET /api/users/reputation — compute trust score for a user
app.get('/api/users/reputation', async (req, res) => {
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

    // Profile completeness (0-20 pts)
    const profilePts = (!appUser ? 0 : (appUser.whatsapp ? 10 : 0) + (appUser.name ? 10 : 0));

    // Reports submitted (5 pts each, max 50)
    const reportCount = asReporter.length;
    const reportPts = Math.min(reportCount * 5, 50);

    // Resolved reports ratio (0-30 pts)
    const resolvedReports = asReporter.filter(i => i.status === 'resolved').length;
    const resolvedRatio = reportCount > 0 ? resolvedReports / reportCount : 0;
    const resolvedPts = Math.round(resolvedRatio * 30);

    // Fast response as owner: avg hours to add resolution, < 24h = full pts (0-20 pts)
    let responsePts = 0;
    if (asOwner.length > 0) {
      const avgHrs = asOwner.reduce((sum, i) => {
        const hrs = (new Date(i.owner_resolution_at) - new Date(i.created_at)) / 3600000;
        return sum + (isNaN(hrs) ? 48 : hrs);
      }, 0) / asOwner.length;
      responsePts = avgHrs <= 24 ? 20 : avgHrs <= 48 ? 12 : avgHrs <= 72 ? 6 : 0;
    }

    // Tenure (2 pts per 30 days, max 20 pts)
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
