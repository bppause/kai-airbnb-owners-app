const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { log, warn, error } = require('./logger');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
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
  { auth: { persistSession: false, autoRefreshToken: false } }
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
    defaultDelegatePermissions: safeJsonObject(cfg.default_delegate_permissions, DEFAULT_DELEGATE_PERMISSIONS)
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
const DEFAULT_EMAIL_TEMPLATES = {"incident_new": {"label": "Incidente nuevo al propietario", "subject": "⚠️ Acción requerida — Incidente Apto {{apt}} Torre KAI", "text": "Hola,\n\nACCIÓN REQUERIDA (Paso 1 de 2)\nSe reportó un nuevo incidente en el Apto {{apt}}.\n\nPor favor abre el enlace de abajo, inicia sesión con Google y toca el botón verde \"Verificar ahora\" para:\n1. Confirmar los datos del huésped\n2. Documentar la acción que tomaste\n\nVerificar incidente: {{incidentLink}}\n\n---\nDetalle del incidente:\nApartamento: {{apt}} - Torre KAI\nPropietario: {{owner}}\nOperador: {{operator}}\nFecha: {{date}}\nTipo: {{type}}\nCategoría: {{category}}\n\nDescripción:\n{{desc}}\n\nNota: Después de verificar (Paso 1), también deberás agregar tu respuesta (Paso 2) para que el administrador pueda cerrar el incidente.\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#17313a;max-width:600px\"><div style=\"background:#fff3e0;border:2px solid #e65100;border-radius:12px;padding:18px;margin-bottom:20px\"><p style=\"margin:0 0 8px;font-size:1.1em;font-weight:bold;color:#bf360c\">⚠️ Se requiere tu acción — Paso 1 de 2</p><p style=\"margin:0 0 14px;color:#5d3400\">Se reportó un incidente en el <strong>Apto {{apt}}</strong>. Necesitas confirmar los datos del huésped y documentar la acción que tomaste.</p><a href=\"{{incidentLink}}\" style=\"background:#e65100;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;display:inline-block;font-weight:bold;font-size:1.05em\">① Verificar incidente ahora →</a></div><hr style=\"border:none;border-top:1px solid #ddd;margin:0 0 18px\"/><h3 style=\"color:#2F4F3A;margin:0 0 10px;font-size:1em\">Detalle del incidente</h3><p style=\"margin:0 0 12px\"><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Fecha:</strong> {{date}}<br/><strong>Tipo:</strong> {{type}}<br/><strong>Categoría:</strong> {{category}}</p><p style=\"margin:0 0 6px\"><strong>Descripción:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px;margin:0 0 14px\">{{desc}}</p><p style=\"color:#888;font-size:.9em;margin:0\">Después de verificar (Paso 1), también deberás agregar tu respuesta (Paso 2) para que el administrador pueda cerrar el incidente.</p></div>"}, "incident_sla_notification": {"label": "Notificación inicial SLA", "subject": "SLA iniciado: incidente pendiente - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe inició el ciclo SLA para un incidente pendiente de verificación.\n\nApartamento: {{apt}}\nPropietario: {{owner}}\nOperador: {{operator}}\nSLA: {{slaHours}} horas\nFecha: {{date}}\nTipo: {{type}}\nCategoría: {{category}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">SLA iniciado</h2><p>Se inició el ciclo SLA para un incidente pendiente de verificación.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>SLA:</strong> {{slaHours}} horas</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver incidente</a></p></div>"}, "incident_sla_reminder": {"label": "Recordatorio SLA de incidente", "subject": "🔴 Recordatorio urgente — Incidente Apto {{apt}} sin verificar", "text": "Hola,\n\nRECORDATORIO URGENTE (Paso 1 de 2 pendiente)\nEste incidente del Apto {{apt}} sigue sin ser verificado.\n\nPor favor abre el enlace, inicia sesión con Google y toca \"Verificar ahora\":\n{{incidentLink}}\n\n---\nApartamento: {{apt}} - Torre KAI\nPropietario: {{owner}}\nOperador: {{operator}}\nCiclo SLA: {{slaCycleCount}}\n\nDescripción:\n{{desc}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#17313a;max-width:600px\"><div style=\"background:#fce4ec;border:2px solid #c62828;border-radius:12px;padding:18px;margin-bottom:20px\"><p style=\"margin:0 0 8px;font-size:1.1em;font-weight:bold;color:#b71c1c\">🔴 Recordatorio urgente — Verificación pendiente</p><p style=\"margin:0 0 14px;color:#6d0000\">Este incidente del <strong>Apto {{apt}}</strong> todavía no ha sido verificado. Por favor completa el Paso 1 lo antes posible.</p><a href=\"{{incidentLink}}\" style=\"background:#c62828;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;display:inline-block;font-weight:bold;font-size:1.05em\">① Verificar incidente ahora →</a></div><hr style=\"border:none;border-top:1px solid #ddd;margin:0 0 18px\"/><p style=\"margin:0 0 12px\"><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Ciclo SLA:</strong> {{slaCycleCount}}</p><p style=\"margin:0 0 6px\"><strong>Descripción:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px;margin:0\">{{desc}}</p></div>"}, "incident_sla": {"label": "Recordatorio SLA de incidente", "subject": "Recordatorio SLA: incidente pendiente - Apto {{apt}} Torre KAI", "text": "Hola,\n\nRecordatorio SLA. Ver incidente: {{incidentLink}}\n", "html": "<div><h2>Recordatorio SLA</h2><p><a href=\"{{incidentLink}}\">Ver incidente</a></p></div>"}, "incident_verified": {"label": "Incidente verificado", "subject": "Incidente verificado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nEl propietario verificó el incidente.\n\nApartamento: {{apt}}\nHuésped(es): {{ownerGuestNames}}\nCiudad: {{ownerGuestCity}}\nPaís: {{ownerGuestCountry}}\nComentarios: {{ownerComments}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incidente verificado</h2><p>El propietario verificó el incidente y completó la información requerida.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Huésped(es):</strong> {{ownerGuestNames}}<br/><strong>Ciudad:</strong> {{ownerGuestCity}}<br/><strong>País:</strong> {{ownerGuestCountry}}</p><p><strong>Comentarios:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{ownerComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver incidente</a></p></div>"}, "registration_submitted": {"label": "Registro enviado al usuario", "subject": "Registro recibido - {{communityName}}", "text": "Hola {{userName}},\n\nRecibimos tu solicitud de registro. Tu registro está pendiente de aprobación.\n\nVer estado: {{registrationLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro recibido</h2><p>Hola {{userName}},</p><p>Recibimos tu solicitud de registro. Tu registro está <strong>pendiente de aprobación</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{registrationLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver estado</a></p></div>"}, "registration_approved": {"label": "Registro aprobado al usuario", "subject": "Registro aprobado - {{communityName}}", "text": "Hola {{userName}},\n\nTu registro fue aprobado.\n\nEntrar: {{dashboardLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro aprobado</h2><p>Hola {{userName}}, tu registro fue <strong>aprobado</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{dashboardLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Entrar a la aplicación</a></p></div>"}, "registration_declined": {"label": "Registro rechazado al usuario", "subject": "Registro rechazado - {{communityName}}", "text": "Hola {{userName}},\n\nTu registro fue rechazado.\n{{reasonLine}}\n\nVer estado: {{registrationLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro rechazado</h2><p>Hola {{userName}}, tu registro fue <strong>rechazado</strong>.</p>{{reasonHtml}}<p style=\"margin:18px 0\"><a href=\"{{registrationLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver estado</a></p></div>"}, "registration_status_admin": {"label": "Aviso admin: registro aprobado/rechazado", "subject": "Registro {{registrationStatus}} - {{userName}}", "text": "Hola,\n\nUn registro fue {{registrationStatus}}.\n\nUsuario: {{userName}} ({{userEmail}})\nRevisor: {{reviewerName}}\nMotivo: {{reason}}\n\nVer registros: {{approvalsLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro {{registrationStatus}}</h2><p><strong>Usuario:</strong> {{userName}} ({{userEmail}})<br/><strong>Revisor:</strong> {{reviewerName}}<br/><strong>Motivo:</strong> {{reason}}</p><p style=\"margin:18px 0\"><a href=\"{{approvalsLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver registros</a></p></div>"}, "registration_reviewer": {"label": "Aviso admin: registro pendiente", "subject": "Nuevo registro pendiente - {{communityName}}", "text": "Hola {{reviewerName}},\n\nHay un nuevo registro pendiente para revisar: {{userName}} ({{userEmail}}).\n\nRevisar: {{approvalsLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Nuevo registro pendiente</h2><p>Hay una nueva solicitud para revisar.</p><p><strong>Usuario:</strong> {{userName}}<br/><strong>Email:</strong> {{userEmail}}</p><p style=\"margin:18px 0\"><a href=\"{{approvalsLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Revisar registro</a></p></div>"}, "listing_created": {"label": "Listing creado al usuario", "subject": "Nuevo listing agregado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe agregó el listing del Apto {{apt}}.\n\nVer listing: {{listingLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Nuevo listing agregado</h2><p>Se agregó el listing del <strong>Apto {{apt}} · Torre KAI</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{listingLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver listing</a></p></div>"}, "listing_updated": {"label": "Listing actualizado al usuario", "subject": "Listing actualizado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe actualizó la información del Apto {{apt}}.\n\nVer listing: {{listingLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Listing actualizado</h2><p>Se actualizó la información del <strong>Apto {{apt}} · Torre KAI</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{listingLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver listing</a></p></div>"}, "listing_deleted": {"label": "Listing eliminado al usuario", "subject": "Listing eliminado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe eliminó el listing del Apto {{apt}}.\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Listing eliminado</h2><p>Se eliminó el listing del <strong>Apto {{apt}} · Torre KAI</strong>.</p></div>"}, "incident_resolution_added": {"label": "Propietario agregó respuesta — listo para cerrar", "subject": "✅ Respuesta agregada — Apto {{apt}} listo para cerrar", "text": "Hola,\n\nEl propietario completó el Paso 2 y agregó su respuesta. El incidente en el Apto {{apt}} está listo para ser cerrado por el administrador.\n\nApartamento: {{apt}} - Torre KAI\nPropietario: {{owner}}\nOperador: {{operator}}\nHuésped(es): {{ownerGuestNames}}\n\nAcción tomada (Paso 1):\n{{ownerComments}}\n\nRespuesta del propietario (Paso 2):\n{{ownerAnswer}}\n\nVer y cerrar incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">✅ Respuesta agregada — listo para cerrar</h2><p>El propietario completó <strong>ambos pasos</strong>. El incidente está listo para ser cerrado formalmente.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Huésped(es):</strong> {{ownerGuestNames}}</p><p><strong>Acción tomada (Paso 1):</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{ownerComments}}</p><p><strong>Respuesta del propietario (Paso 2):</strong></p><p style=\"background:#eaf6f0;border-left:4px solid #2F4F3A;padding:12px\">{{ownerAnswer}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver y cerrar incidente</a></p></div>"},
"incident_resolved": {"label": "Incidente resuelto", "subject": "Incidente resuelto - Apto {{apt}} Torre KAI", "text": "Hola,\n\nEl incidente en el Apto {{apt}} ha sido resuelto.\n\nApartamento: {{apt}}\nPropietario: {{owner}}\nOperador: {{operator}}\nResuelto por: {{resolvedBy}}\nComentarios de resolución: {{resolutionComments}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incidente resuelto ✅</h2><p>El incidente en el listing ha sido marcado como resuelto.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Resuelto por:</strong> {{resolvedBy}}</p><p><strong>Comentarios de resolución:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #2F4F3A;padding:12px\">{{resolutionComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver incidente</a></p></div>"}};

const DEFAULT_EMAIL_TEMPLATES_EN = {"incident_new": {"label": "New incident to owner", "subject": "⚠️ Action required — Incident Apt {{apt}} Tower KAI", "text": "Hello,\n\nACTION REQUIRED (Step 1 of 2)\nA new incident was reported for Apt {{apt}}.\n\nPlease open the link below, sign in with Google, and tap the green \"Verify now\" button to:\n1. Confirm guest details\n2. Document the action you took\n\nVerify incident: {{incidentLink}}\n\n---\nIncident details:\nApartment: {{apt}} - Tower KAI\nOwner: {{owner}}\nOperator: {{operator}}\nDate: {{date}}\nType: {{type}}\nCategory: {{category}}\n\nDescription:\n{{desc}}\n\nNote: After verifying (Step 1), you will still need to add your resolution (Step 2) before the admin can close the incident.\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#17313a;max-width:600px\"><div style=\"background:#fff3e0;border:2px solid #e65100;border-radius:12px;padding:18px;margin-bottom:20px\"><p style=\"margin:0 0 8px;font-size:1.1em;font-weight:bold;color:#bf360c\">⚠️ Your action is required — Step 1 of 2</p><p style=\"margin:0 0 14px;color:#5d3400\">An incident was reported for <strong>Apt {{apt}}</strong>. You need to confirm who your guest was and document what you did about it.</p><a href=\"{{incidentLink}}\" style=\"background:#e65100;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;display:inline-block;font-weight:bold;font-size:1.05em\">① Verify incident now →</a></div><hr style=\"border:none;border-top:1px solid #ddd;margin:0 0 18px\"/><h3 style=\"color:#2F4F3A;margin:0 0 10px;font-size:1em\">Incident details</h3><p style=\"margin:0 0 12px\"><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>Date:</strong> {{date}}<br/><strong>Type:</strong> {{type}}<br/><strong>Category:</strong> {{category}}</p><p style=\"margin:0 0 6px\"><strong>Description:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px;margin:0 0 14px\">{{desc}}</p><p style=\"color:#888;font-size:.9em;margin:0\">After verifying (Step 1), you will still need to add your resolution (Step 2) before the admin can close the incident.</p></div>"}, "incident_sla_notification": {"label": "Initial SLA notification", "subject": "SLA started: pending incident - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe SLA cycle started for a pending incident.\n\nApartment: {{apt}}\nOwner: {{owner}}\nOperator: {{operator}}\nSLA: {{slaHours}} hours\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">SLA started</h2><p>The SLA cycle started for a pending incident.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>SLA:</strong> {{slaHours}} hours</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View incident</a></p></div>"}, "incident_sla_reminder": {"label": "Incident SLA reminder", "subject": "🔴 Urgent reminder — Incident Apt {{apt}} not yet verified", "text": "Hello,\n\nURGENT REMINDER (Step 1 of 2 pending)\nThis incident for Apt {{apt}} has still not been verified.\n\nPlease open the link, sign in with Google, and tap \"Verify now\":\n{{incidentLink}}\n\n---\nApartment: {{apt}} - Tower KAI\nOwner: {{owner}}\nOperator: {{operator}}\nSLA cycle: {{slaCycleCount}}\n\nDescription:\n{{desc}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#17313a;max-width:600px\"><div style=\"background:#fce4ec;border:2px solid #c62828;border-radius:12px;padding:18px;margin-bottom:20px\"><p style=\"margin:0 0 8px;font-size:1.1em;font-weight:bold;color:#b71c1c\">🔴 Urgent reminder — Verification still pending</p><p style=\"margin:0 0 14px;color:#6d0000\">This incident for <strong>Apt {{apt}}</strong> has not been verified yet. Please complete Step 1 as soon as possible.</p><a href=\"{{incidentLink}}\" style=\"background:#c62828;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;display:inline-block;font-weight:bold;font-size:1.05em\">① Verify incident now →</a></div><hr style=\"border:none;border-top:1px solid #ddd;margin:0 0 18px\"/><p style=\"margin:0 0 12px\"><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>SLA cycle:</strong> {{slaCycleCount}}</p><p style=\"margin:0 0 6px\"><strong>Description:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px;margin:0\">{{desc}}</p></div>"}, "incident_sla": {"label": "Incident SLA reminder", "subject": "SLA reminder: pending incident - Apt {{apt}} Tower KAI", "text": "Hello,\n\nSLA reminder. View incident: {{incidentLink}}\n", "html": "<div><h2>SLA reminder</h2><p><a href=\"{{incidentLink}}\">View incident</a></p></div>"}, "incident_verified": {"label": "Incident verified", "subject": "Incident verified - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe owner verified the incident.\n\nApartment: {{apt}}\nGuest(s): {{ownerGuestNames}}\nCity: {{ownerGuestCity}}\nCountry: {{ownerGuestCountry}}\nComments: {{ownerComments}}\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incident verified</h2><p>The owner verified the incident.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Guest(s):</strong> {{ownerGuestNames}}<br/><strong>City:</strong> {{ownerGuestCity}}<br/><strong>Country:</strong> {{ownerGuestCountry}}</p><p><strong>Comments:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{ownerComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View incident</a></p></div>"}, "registration_submitted": {"label": "Registration submitted to user", "subject": "Registration received - {{communityName}}", "text": "Hello {{userName}},\n\nWe received your registration request. It is pending approval.\n\nView status: {{registrationLink}}\n", "html": "<div><h2>Registration received</h2><p>Hello {{userName}}, your registration is pending approval.</p><p><a href=\"{{registrationLink}}\">View status</a></p></div>"}, "registration_approved": {"label": "Registration approved to user", "subject": "Registration approved - {{communityName}}", "text": "Hello {{userName}},\n\nYour registration was approved.\n\nOpen app: {{dashboardLink}}\n", "html": "<div><h2>Registration approved</h2><p>Hello {{userName}}, your registration was approved.</p><p><a href=\"{{dashboardLink}}\">Open app</a></p></div>"}, "registration_declined": {"label": "Registration denied to user", "subject": "Registration denied - {{communityName}}", "text": "Hello {{userName}},\n\nYour registration was denied.\n{{reasonLineEn}}\n\nView status: {{registrationLink}}\n", "html": "<div><h2>Registration denied</h2><p>Hello {{userName}}, your registration was denied.</p>{{reasonHtmlEn}}<p><a href=\"{{registrationLink}}\">View status</a></p></div>"}, "registration_status_admin": {"label": "Admin notice: registration approved/denied", "subject": "Registration {{registrationStatus}} - {{userName}}", "text": "Hello,\n\nA registration was {{registrationStatus}}.\n\nUser: {{userName}} ({{userEmail}})\nReviewer: {{reviewerName}}\nReason: {{reason}}\n\nView registrations: {{approvalsLink}}\n", "html": "<div><h2>Registration {{registrationStatus}}</h2><p><strong>User:</strong> {{userName}} ({{userEmail}})<br/><strong>Reviewer:</strong> {{reviewerName}}<br/><strong>Reason:</strong> {{reason}}</p><p><a href=\"{{approvalsLink}}\">View registrations</a></p></div>"}, "registration_reviewer": {"label": "Admin notice: pending registration", "subject": "New registration pending - {{communityName}}", "text": "Hello {{reviewerName}},\n\nA new registration is pending review: {{userName}} ({{userEmail}}).\n\nReview: {{approvalsLink}}\n", "html": "<div><h2>New registration pending</h2><p><strong>User:</strong> {{userName}}<br/><strong>Email:</strong> {{userEmail}}</p><p><a href=\"{{approvalsLink}}\">Review registration</a></p></div>"}, "listing_created": {"label": "Listing created to user", "subject": "New listing added - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe listing for Apt {{apt}} was added.\n\nView listing: {{listingLink}}\n", "html": "<div><h2>New listing added</h2><p>The listing for <strong>Apt {{apt}} · Tower KAI</strong> was added.</p><p><a href=\"{{listingLink}}\">View listing</a></p></div>"}, "listing_updated": {"label": "Listing updated to user", "subject": "Listing updated - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe information for Apt {{apt}} was updated.\n\nView listing: {{listingLink}}\n", "html": "<div><h2>Listing updated</h2><p>The listing for <strong>Apt {{apt}} · Tower KAI</strong> was updated.</p><p><a href=\"{{listingLink}}\">View listing</a></p></div>"}, "listing_deleted": {"label": "Listing deleted to user", "subject": "Listing deleted - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe listing for Apt {{apt}} was deleted.\n", "html": "<div><h2>Listing deleted</h2><p>The listing for <strong>Apt {{apt}} · Tower KAI</strong> was deleted.</p></div>"}, "incident_resolution_added": {"label": "Owner added resolution — ready to close", "subject": "✅ Resolution added — Apt {{apt}} ready to close", "text": "Hello,\n\nThe owner completed Step 2 and added their resolution. The incident in Apt {{apt}} is ready to be closed by the administrator.\n\nApartment: {{apt}} - Tower KAI\nOwner: {{owner}}\nOperator: {{operator}}\nGuest(s): {{ownerGuestNames}}\n\nAction taken (Step 1):\n{{ownerComments}}\n\nOwner resolution (Step 2):\n{{ownerAnswer}}\n\nView and close incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">✅ Resolution added — ready to close</h2><p>The owner completed <strong>both steps</strong>. The incident is ready to be formally closed.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>Guest(s):</strong> {{ownerGuestNames}}</p><p><strong>Action taken (Step 1):</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{ownerComments}}</p><p><strong>Owner resolution (Step 2):</strong></p><p style=\"background:#eaf6f0;border-left:4px solid #2F4F3A;padding:12px\">{{ownerAnswer}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View and close incident</a></p></div>"},
"incident_resolved": {"label": "Incident resolved", "subject": "Incident resolved - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe incident in Apt {{apt}} has been resolved.\n\nApartment: {{apt}}\nOwner: {{owner}}\nOperator: {{operator}}\nResolved by: {{resolvedBy}}\nResolution comments: {{resolutionComments}}\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incident resolved ✅</h2><p>The incident on this listing has been marked as resolved.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>Resolved by:</strong> {{resolvedBy}}</p><p><strong>Resolution comments:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #2F4F3A;padding:12px\">{{resolutionComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View incident</a></p></div>"}};

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
const OVERRIDABLE_COMMUNITY_KEYS = ['mission_title_es','mission_body_es','mission_title_en','mission_body_en','mission_sections_es','escalation_cc_emails','community_admin_default_permissions','tooltips_es','tooltips_en','ui_labels_es','ui_labels_en'];
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
      const { data } = await supabase.from('communities').select('*').eq('is_active', true).order('name');
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
  const { individual, group } = await buildSplitRecipients(typeCfg, listing, reporterEmail, communityId);
  if (!individual.length && !group.length) return { sent:false, skipped:true, reason:'No recipients.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  const vars = { apt, owner:listing.owner||'', operator:listing.operator||'No indicado', operatorEmail:listing.operatorEmail||listing.operator_email||'', resolvedBy:incident.resolvedBy||incident.resolved_by||'', resolutionComments:incident.resolutionComments||incident.resolution_comments||'', ownerAnswer:incident.ownerResolution||'', date:incident.date||'', type:incident.type||'', category:incident.category||'', incidentLink };
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

app.get('/api/apartments/check', async (req, res) => {
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

app.get('/api/registrations/status', async (req, res) => {
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

app.post('/api/registrations', async (req, res) => {
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

  // Save owner WhatsApp to profile; also set language_preference for users who have none yet
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
      // Also email global admins + delegate admins (canApproveRegistrations) who are
      // not already listing owners (seen set avoids duplicates by uid; email list dedup handles rest)
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

app.get('/api/registrations/pending', async (req, res) => {
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


app.get('/api/registrations/active', async (req, res) => {
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

const reviewRegistration = async (req, res, status) => {
  if (!requireSupabaseEnv(res)) return;
  const { reviewerUid, reviewerName, reason } = req.body || {};
  if (!reviewerUid) return res.status(400).json({ error:'reviewerUid is required.' });
  const registrationId = req.params.id;
  // Look up the registration's own community — don't rely on the request header
  // so global admins can approve across communities regardless of their current context
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
app.post('/api/registrations/:id/approve', (req, res) => reviewRegistration(req, res, 'approved'));
app.post('/api/registrations/:id/decline', (req, res) => reviewRegistration(req, res, 'declined'));

// ─── API: LISTINGS ────────────────────────────────────────────────────────────
app.get('/api/listings', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const communityId = getCommunityId(req);
  const { data, error } = await supabase.from('listings').select('*').eq('community_id', communityId).eq('status','approved').order('apt', { ascending: true });
  if (error) return sendSupabaseError(res, error);
  res.json((data || []).map(listingFromDb));
});

app.post('/api/listings', async (req, res) => {
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

  // Use owner's profile whatsapp and Google email as contact details
  const { data: profileRow } = await supabase.from('app_users').select('whatsapp,notification_email').eq('uid', ownerUid).maybeSingle();
  const ownerContact = String(profileRow?.whatsapp || '').trim();
  const googleEmail  = String(userEmail || '').trim().toLowerCase();
  const ownerEmail   = (profileRow?.notification_email || googleEmail);

  const community = await getCommunity(communityId);
  const towerLabel = community?.tower || 'KAI';
  const item = { id:'lst_'+uuidv4().slice(0,8), communityId, ownerUid, owner:String(owner||'').trim(), userEmail:googleEmail, apt:String(apt).trim(), tower:towerLabel, rooms, guests:Number(guests), operator:operator||'', operatorEmail:operatorEmail||'', operatorWhatsapp:operatorWhatsapp||'', contact:ownerContact, email:ownerEmail, airbnb:String(airbnb||'').trim(), coOwners:[], status:'approved', reviewedByUid:ownerUid, reviewedByName:owner, reviewedAt:new Date().toISOString(), createdAt:new Date().toISOString() };
  const { data, error } = await supabase.from('listings').insert(listingToDb(item, communityId)).select('*').single();
  if (error) return sendSupabaseError(res, error);
  // Save co_owners separately so a missing column (schema cache not yet refreshed) never breaks the main save
  if (coOwnersParsed.coOwners.length > 0) {
    const { error: coErr } = await supabase.from('listings').update({ co_owners: coOwnersParsed.coOwners }).eq('id', data.id);
    if (coErr) warn('co_owners save failed (run schema migration): ' + (coErr.message || coErr));
    else data.co_owners = coOwnersParsed.coOwners;
  }
  await auditEvent({ listingId:data.id, registrationId:data.registration_id, actorUid:ownerUid, actorName:owner, action:'listing_created', after:data });
  await auditLog({ entity:'listing', entityId:data.id, action:'create', actorUid:ownerUid, actorEmail:userEmail || email, actorName:owner, after:data });
  setImmediate(() => sendListingChangeEmail({ listing: listingFromDb(data), action:'created', appUrl: publicAppUrl(req) }).catch(e => warn('Listing created email failed: ' + (e?.message || e))));
  res.json(listingFromDb(data));
});

app.put('/api/listings/:id', async (req, res) => {
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

  // Re-sync contact/email from owner profile (keeps listings in sync with profile)
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
  // Save co_owners separately so a missing column (schema cache not yet refreshed) never breaks the main save
  const { error: coErr } = await supabase.from('listings').update({ co_owners: coOwnersParsed.coOwners }).eq('id', req.params.id);
  if (coErr) warn('co_owners save failed (run schema migration): ' + (coErr.message || coErr));
  else data.co_owners = coOwnersParsed.coOwners;
  await auditEvent({ listingId:data.id, registrationId:data.registration_id, actorUid:ownerUid, actorName:existing.owner, action:'listing_updated', before:existing, after:data });
  await auditLog({ entity:'listing', entityId:data.id, action:'update', actorUid:ownerUid, actorEmail:actorEmail, actorName:existing.owner, before:existing, after:data });
  setImmediate(() => sendListingChangeEmail({ listing: listingFromDb(data), action:'updated', appUrl: publicAppUrl(req) }).catch(e => warn('Listing updated email failed: ' + (e?.message || e))));
  res.json(listingFromDb(data));
});

app.delete('/api/listings/:id', async (req, res) => {
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

// ─── API: INCIDENTS ───────────────────────────────────────────────────────────
app.get('/api/incidents', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const communityId = getCommunityId(req);
  const { data, error } = await supabase.from('incidents').select('*').eq('community_id', communityId).order('created_at', { ascending: false });
  if (error) return sendSupabaseError(res, error);
  res.json((data || []).map(incidentFromDb));
});

app.post('/api/incidents', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const communityId = getCommunityId(req);
  const { reporterUid, reporterName, aptId, aptLabel, date, type, category, desc, isGeneral=false, photos=[] } = req.body;
  if (!reporterUid || !date || !type || !category || !String(desc || '').trim())
    return res.status(400).json({ error: 'Fecha, tipo, categoría y descripción son requeridos.' });
  // Validate photos: max 3, each base64 data URI must be under 2MB
  if (!Array.isArray(photos) || photos.length > 3)
    return res.status(400).json({ error: 'Se permiten máximo 3 fotos.' });
  const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
  for (const p of photos) {
    if (!p || typeof p.data !== 'string' || p.data.length > MAX_PHOTO_BYTES)
      return res.status(400).json({ error: 'Cada foto debe ser base64 de máximo 2 MB. Reduce el tamaño de la imagen.' });
  }

  const appUrl = publicAppUrl(req);
  const slaHours = await getSlaHours();
  const nowIso = new Date().toISOString();

  // ── General incident (not tied to a specific unit) ────────────────────────
  if (isGeneral) {
    const item = { id:'inc_'+uuidv4().slice(0,8), communityId, reporterUid, reporterName, aptId:null, aptLabel:'', guestName:'', guestCity:'', guestState:'', guestCountry:'', date, type, category, desc, status:'open', isGeneral:true, photos, slaHours, nextSlaReminderAt:addHoursIso(nowIso, slaHours), slaCycleCount:0, createdAt:nowIso };
    const { data, error } = await supabase.from('incidents').insert(incidentToDb(item, communityId)).select('*').single();
    if (error) return sendSupabaseError(res, error);
    const savedIncident = incidentFromDb(data);
    await auditLog({ entity:'incident', entityId:data.id, action:'create', actorUid:reporterUid, actorName:reporterName, after:data });
    // Notify admins in-app
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

  // ── Normal incident (tied to a unit) ─────────────────────────────────────
  if (!aptId) return res.status(400).json({ error: 'Apartamento es requerido para incidentes de unidad.' });
  const { data: listing, error: listingError } = await supabase.from('listings').select('*').eq('id', aptId).eq('status','approved').single();
  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found for selected apartment.' });

  const incCommunityId = listing.community_id || communityId;
  const item = { id:'inc_'+uuidv4().slice(0,8), communityId:incCommunityId, reporterUid, reporterName, aptId, aptLabel: aptLabel || ('Apto ' + listing.apt), guestName:'', guestCity:'', guestState:'', guestCountry:'', date, type, category, desc, status:'open', isGeneral:false, photos, slaHours, nextSlaReminderAt:addHoursIso(nowIso, slaHours), slaCycleCount:0, createdAt:nowIso };
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
    incident_resolved:['apt','owner','operator','operatorEmail','resolvedBy','resolutionComments','ownerAnswer','date','type','category','incidentLink'],
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
  const { actorUid, actorEmail, slaHours, escalationCcEmails, analyticsEnabled, missionTitle, missionBody, missionTitleEs, missionBodyEs, missionTitleEn, missionBodyEn, missionSectionsEs, standardMenuPermissions, defaultDelegatePermissions, tooltipsEs, tooltipsEn, uiLabelsEs, uiLabelsEn, complexNameEs, complexNameEn, complexLocation, complexLogo, complexBg, emailFromName, emailFromAddress, emailFromNameEn, emailFromAddressEn, nav_config, communityFeatureEnabled, defaultCommunityId } = req.body || {};
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
  if (standardMenuPermissions !== undefined) rows.push({ key:'standard_menu_permissions', value: JSON.stringify(safeJsonObject(standardMenuPermissions, DEFAULT_STANDARD_MENU_PERMISSIONS)) });
  if (defaultDelegatePermissions !== undefined) rows.push({ key:'default_delegate_permissions', value: JSON.stringify(safeJsonObject(defaultDelegatePermissions, DEFAULT_DELEGATE_PERMISSIONS)) });
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
  const { data: approvedListings, error: lerr } = await supabase.from('listings').select('owner_uid').eq('status','approved');
  if (lerr) return sendSupabaseError(res, lerr);
  const approved = new Set((approvedListings || []).map(x => x.owner_uid).filter(Boolean));
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
    return { uid:u.uid, email:u.email, name:u.name || '', role, permissions, languagePreference:u.language_preference || 'es-CO', approved: approved.has(u.uid), envGlobal, communityMemberships };
  });
  res.json({ users, standardMenuPermissions: permsCfg.standardMenuPermissions, defaultDelegatePermissions: permsCfg.defaultDelegatePermissions });
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
app.get('/api/admin/audit-logs', async (req, res) => {
  log('[ADMIN] audit-logs requested by ' + String(req.query?.email || ''));
  if (!requireSupabaseEnv(res)) return;
  const { uid, email, entity, actor, dateFrom, dateTo, limit: limitParam, offset: offsetParam } = req.query || {};
  if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error: 'Solo un administrador global puede ver los logs de auditoría.' });
  let query = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (entity && entity !== 'all') query = query.eq('entity', entity);
  if (actor) query = query.ilike('actor_email', `%${actor}%`);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59Z');
  const pageLimit = Math.min(parseInt(limitParam) || 50, 200);
  const pageOffset = parseInt(offsetParam) || 0;
  query = query.range(pageOffset, pageOffset + pageLimit - 1);
  const { data, error, count } = await query;
  if (error) return sendSupabaseError(res, error);
  res.json({ logs: data || [], total: count || 0 });
});

app.patch('/api/incidents/:id/viewed', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { ownerUid } = req.body || {};
  const { data: inc, error: findErr } = await supabase.from('incidents').select('*, listings(owner_uid)').eq('id', req.params.id).single();
  if (findErr || !inc) return res.status(404).json({ error:'Incidente no encontrado.' });
  if (inc.listings?.owner_uid !== ownerUid) return res.status(403).json({ error:'Solo el propietario puede marcar visto.' });
  const { data, error } = await supabase.from('incidents').update({ owner_viewed_at:new Date().toISOString() }).eq('id', req.params.id).select('*').single();
  if (error) return sendSupabaseError(res, error);
  res.json(incidentFromDb(data));
});


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

app.patch('/api/incidents/:id/verify', async (req, res) => {
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
  const slaHoursForVerify = await getSlaHours();
  // Keep SLA running if owner hasn't added resolution yet — reminders continue until Step 2 complete
  const nextSlaAfterVerify = ownerResolutionText ? null : addHoursIso(nowIso, slaHoursForVerify);
  const upd = { status:'verified', owner_guests: ownerGuests, owner_guest_names:names, owner_guest_city:cities, owner_guest_country:countries, owner_comments:ownerCommentText, owner_resolution:ownerResolutionText, owner_resolution_at: ownerResolutionText ? nowIso : null, owner_verified_at:nowIso, next_sla_reminder_at: nextSlaAfterVerify };
  const { data, error } = await supabase.from('incidents').update(upd).eq('id', req.params.id).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'incident', entityId:data.id, action:'verify', actorUid:ownerUid, before:inc, after:data });
  const verifiedIncident = incidentFromDb(data);
  // Notify admins when owner verifies — they need to be aware it is pending resolution
  setImmediate(() => sendIncidentVerifiedEmail({ listing: listingFromDb(inc.listings), incident: verifiedIncident, appUrl: publicAppUrl(req) }).catch(e => warn('Incident verified email failed: ' + (e?.message || e))));
  res.json(verifiedIncident);
});

// Owner adds/updates resolution on a verified incident → notifies admins it is ready to close
app.patch('/api/incidents/:id/add-resolution', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { ownerUid, ownerResolution } = req.body || {};
  if (!ownerUid) return res.status(400).json({ error:'ownerUid is required.' });
  const resText = String(ownerResolution || '').trim();
  if (!resText) return res.status(400).json({ error:'La respuesta del propietario es requerida.' });
  const { data: inc, error: findErr } = await supabase.from('incidents').select('*, listings(*)').eq('id', req.params.id).single();
  if (findErr || !inc) return res.status(404).json({ error:'Incidente no encontrado.' });
  if (inc.listings?.owner_uid !== ownerUid) return res.status(403).json({ error:'Solo el propietario puede agregar la resolución.' });
  if (inc.status !== 'verified') return res.status(400).json({ error:'Solo se puede agregar resolución a incidentes verificados.' });
  // Stop SLA reminders — owner has completed both steps; admin can now close
  const { data, error } = await supabase.from('incidents').update({ owner_resolution: resText, owner_resolution_at: new Date().toISOString(), next_sla_reminder_at: null }).eq('id', req.params.id).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'incident', entityId:data.id, action:'add-resolution', actorUid:ownerUid, before:inc, after:data });
  const updatedIncident = incidentFromDb(data);
  // Notify all parties — owner completed Step 2, incident is ready for admin to close
  setImmediate(() => sendIncidentResolutionAddedEmail({ listing: listingFromDb(inc.listings), incident: updatedIncident, appUrl: publicAppUrl(req) }).catch(e => warn('Add-resolution email failed: ' + (e?.message || e))));
  res.json(updatedIncident);
});

// ── Assign a general incident to a specific unit ─────────────────────────────
app.patch('/api/incidents/:id/assign', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid='', actorEmail='', aptId='' } = req.body || {};
  if (!actorUid || !actorEmail || !aptId) return res.status(400).json({ error:'actorUid, actorEmail y aptId son requeridos.' });
  if (!(await isGlobalAdmin(actorUid, actorEmail)) && !(await hasDelegatePermission(actorUid, actorEmail, 'canResolveIncidents')))
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

// ── Close a general incident without assigning to a unit ─────────────────────
app.patch('/api/incidents/:id/close-general', async (req, res) => {
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
  const upd = { status:'resolved', owner_comments:String(closingAction).trim(), owner_resolution:String(resolution).trim(), resolution_comments:String(resolutionComments||'').trim(), resolved_at:nowIso, resolved_by:actorEmail, next_sla_reminder_at:null };
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
        await sendTemplatedEmail({ key:'incident_resolved', to:recipients, vars:{ apt:'General', owner:'', operator:'No indicado', operatorEmail:'', resolvedBy:actorEmail, resolutionComments:String(resolutionComments||'').trim(), ownerAnswer:String(resolution).trim(), date:resolvedIncident.date||'', type:resolvedIncident.type||'', category:resolvedIncident.category||'', incidentLink }, relatedEntity:'incident', relatedId:resolvedIncident.id });
      }
    } catch(e) { warn('Close-general resolved email failed: ' + (e?.message || e)); }
  });
  res.json(resolvedIncident);
});

app.patch('/api/incidents/:id/resolve', async (req, res) => {
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
  // General incidents (is_general=true) skip owner verification steps — admins close directly.
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
  const upd = { status: 'resolved', resolution_comments: comments, resolved_at: new Date().toISOString(), resolved_by: actorEmail || actorName || actorUid };
  const { data, error } = await supabase.from('incidents').update(upd).eq('id', req.params.id).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'incident', entityId:data.id, action:'resolve', actorUid, actorEmail, actorName, before:existing, after:data });
  // In-app notification for the listing owner
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

app.delete('/api/incidents/:id', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { reporterUid, actorEmail } = req.body;

  const { data: existing, error: findError } = await supabase.from('incidents').select('*').eq('id', req.params.id).single();
  if (findError || !existing) return res.status(404).json({ error: 'Not found' });
  // Only global admins and delegate admins with canDeleteGlobalIncidents can delete incidents.
  // Reporters and standard owners cannot delete — incidents are permanent audit records.
  if (!(await canDeleteGlobalIncident(reporterUid, actorEmail)))
    return res.status(403).json({ error: 'Solo administradores globales o delegados con permiso "Eliminar incidentes" pueden eliminar incidentes.' });

  const { error } = await supabase.from('incidents').delete().eq('id', req.params.id);
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'incident', entityId:existing.id, action:'delete', actorUid:reporterUid, actorEmail, before:existing });
  res.json({ ok: true });
});


// ─── API: OWNER NOTIFICATIONS ────────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const ownerUid = String(req.query.ownerUid || '').trim();
  const communityId = getCommunityId(req);
  if (!ownerUid) return res.status(400).json({ error: 'ownerUid is required.' });
  const { data, error } = await supabase.from('notifications').select('*').eq('community_id', communityId).eq('owner_uid', ownerUid).order('created_at', { ascending: false });
  if (error) return sendSupabaseError(res, error);
  res.json((data || []).map(notificationFromDb));
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { ownerUid } = req.body || {};
  if (!ownerUid) return res.status(400).json({ error: 'ownerUid is required.' });
  const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('owner_uid', ownerUid).select('*').single();
  if (error) return sendSupabaseError(res, error);
  res.json(notificationFromDb(data));
});

app.patch('/api/notifications/read-all', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { ownerUid } = req.body || {};
  if (!ownerUid) return res.status(400).json({ error: 'ownerUid is required.' });
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('owner_uid', ownerUid).eq('is_read', false);
  if (error) return sendSupabaseError(res, error);
  res.json({ ok: true });
});


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

// POST /api/communities — global admin only
app.post('/api/communities', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, id, name, nameEn='', tower='', city='', country='Colombia', logoUrl='', backgroundUrl='/morros-kai-bg.jpg', description='', descriptionEn='' } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede crear comunidades.' });
  if (!id || !name) return res.status(400).json({ error:'id and name are required.' });
  if (!/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ error:'Community id must be lowercase letters, numbers, and hyphens only.' });
  const row = { id, name, name_en:nameEn, tower, city, country, logo_url:logoUrl, background_url:backgroundUrl, description, description_en:descriptionEn, is_active:true, created_by_uid:actorUid||'', created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
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
  const { actorUid, actorEmail, name, nameEn, tower, city, country, logoUrl, backgroundUrl, description, descriptionEn, isActive } = req.body || {};
  if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador global o admin de esta comunidad puede actualizar la comunidad.' });
  const before = await getCommunity(req.params.id);
  if (!before) return res.status(404).json({ error:'Community not found.' });
  const update = {};
  if (name !== undefined) update.name = String(name);
  if (nameEn !== undefined) update.name_en = String(nameEn);
  if (tower !== undefined) update.tower = String(tower);
  if (city !== undefined) update.city = String(city);
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
    await supabase.from('community_config').delete().eq('community_id', req.params.id).eq('key', key);
    if (strVal !== '') await supabase.from('community_config').insert({ community_id: req.params.id, key, value: strVal });
  }
  await auditLog({ entity:'community_config', entityId:req.params.id, action:'update_overrides', actorUid:actorUid||'', actorEmail:actorEmail||'', after:overrides });
  res.json({ ok:true });
});

// PUT /api/communities/:id/config/overrides-enabled — global admin toggle
app.put('/api/communities/:id/config/overrides-enabled', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, enabled } = req.body || {};
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Global admin only.' });
  await supabase.from('community_config').delete().eq('community_id', req.params.id).eq('key','config_overrides_enabled');
  await supabase.from('community_config').insert({ community_id: req.params.id, key:'config_overrides_enabled', value: enabled ? 'true' : 'false' });
  await auditLog({ entity:'community_config', entityId:req.params.id, action:'set_overrides_enabled', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ enabled } });
  res.json({ ok:true });
});

// GET /api/communities/:id/members — approved listing owners are members; community_memberships tracks admin status
app.get('/api/communities/:id/members', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  if (!(await isCommunityAdmin(uid, email, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede ver los miembros de la comunidad.' });
  // Derive members from approved listings (listings uses owner_uid / email, not user_uid / user_email)
  const { data: listings, error: lErr } = await supabase.from('listings').select('owner_uid,email,registration_id,created_at,name').eq('community_id', req.params.id).eq('status','approved').order('created_at', { ascending:true });
  if (lErr) return sendSupabaseError(res, lErr);
  // Collect unique users (one entry per owner_uid; a user may own multiple listings)
  const seen = new Set();
  const uniqueUsers = [];
  for (const l of (listings||[])) {
    const key = l.owner_uid || l.email;
    if (key && !seen.has(key)) { seen.add(key); uniqueUsers.push(l); }
  }
  // Overlay community_memberships to get community_admin status
  const { data: admins } = await supabase.from('community_memberships').select('*').eq('community_id', req.params.id);
  const adminMap = {};
  (admins||[]).forEach(a => { adminMap[a.user_uid] = a; });
  // Enrich with app_users for display name and platform role (delegate_admin etc.)
  const uids = uniqueUsers.map(u => u.owner_uid).filter(Boolean);
  let userMap = {};
  if (uids.length) {
    const { data: appUsers } = await supabase.from('app_users').select('uid,name,language_preference,role').in('uid', uids);
    (appUsers||[]).forEach(u => { userMap[u.uid] = u; });
  }
  const globalAdminSet = new Set(getGlobalAdminEmails());
  const members = uniqueUsers.map(u => {
    const communityAdminEntry = u.owner_uid ? adminMap[u.owner_uid] : null;
    const appUser = u.owner_uid ? userMap[u.owner_uid] : null;
    const memberEmail = (u.email || appUser?.email || '').toLowerCase();
    const isGlobalAdmin = !!(memberEmail && globalAdminSet.has(memberEmail));
    const platformRole = isGlobalAdmin ? 'global_admin' : (appUser?.role || 'user');
    return {
      userUid: u.owner_uid,
      userEmail: u.email,
      name: appUser?.name || '',
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
  const effectivePerms = safeJsonObject(permissions, COMMUNITY_ADMIN_PERM_DEFAULTS);
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
