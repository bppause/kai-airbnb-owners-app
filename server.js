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
// owner   = listing owner / registrant   operator    = listing operator
// globalAdmin = env GLOBAL_ADMIN_EMAILS + escalation CC   delegateAdmin = role-gated per type
const DEFAULT_EMAIL_NOTIFICATION_CONFIG = {
  incident_new:              { enabled:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true  },
  incident_sla_notification: { enabled:true,  owner:true,  operator:true,  globalAdmin:false, delegateAdmin:false },
  incident_sla_reminder:     { enabled:true,  owner:true,  operator:true,  globalAdmin:false, delegateAdmin:false },
  incident_sla:              { enabled:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:false },
  incident_verified:         { enabled:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true  },
  incident_resolved:         { enabled:true,  owner:true,  operator:true,  globalAdmin:true,  delegateAdmin:true  },
  registration_submitted:    { enabled:true,  owner:true,  operator:false, globalAdmin:false, delegateAdmin:false },
  registration_approved:     { enabled:true,  owner:true,  operator:false, globalAdmin:false, delegateAdmin:false },
  registration_declined:     { enabled:true,  owner:true,  operator:false, globalAdmin:false, delegateAdmin:false },
  registration_status_admin: { enabled:true,  owner:false, operator:false, globalAdmin:true,  delegateAdmin:true  },
  registration_reviewer:     { enabled:true,  owner:true,  operator:false, globalAdmin:false, delegateAdmin:false },
  listing_created:           { enabled:true,  owner:true,  operator:false, globalAdmin:false, delegateAdmin:false },
  listing_updated:           { enabled:true,  owner:true,  operator:false, globalAdmin:false, delegateAdmin:false },
  listing_deleted:           { enabled:true,  owner:true,  operator:false, globalAdmin:false, delegateAdmin:false },
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
const sendSpanishEmail = async ({ to, subject, text, html }) => {
  if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render.' };
  const recipients = normalizeRecipients(to);
  if (!recipients.length) return { sent:false, skipped:true, reason:'Recipient email is missing.' };
  const { data, error: resendError } = await resend.emails.send({ from: EMAIL_FROM, to:recipients, subject, text, html });
  if (resendError) throw new Error(resendError.message || JSON.stringify(resendError));
  return { sent:true, skipped:false, id:data?.id || '' };
};


// ─── EDITABLE EMAIL TEMPLATES ───────────────────────────────────────────────
const DEFAULT_EMAIL_TEMPLATES = {"incident_new": {"label": "Incidente nuevo al propietario", "subject": "Nuevo incidente reportado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe reportó un nuevo incidente en tu listing.\n\nApartamento: {{apt}} - Torre KAI\nPropietario: {{owner}}\nOperador: {{operator}}\nFecha: {{date}}\nTipo: {{type}}\nCategoría: {{category}}\n\nDescripción:\n{{desc}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Nuevo incidente reportado</h2><p>Se reportó un nuevo incidente en tu listing.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Fecha:</strong> {{date}}<br/><strong>Tipo:</strong> {{type}}<br/><strong>Categoría:</strong> {{category}}</p><p><strong>Descripción:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{desc}}</p><p><strong>Acción requerida:</strong> el propietario debe verificar el incidente indicando nombre(s) de huésped(es), ciudad, país y un mensaje opcional.</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver y verificar incidente</a></p></div>"}, "incident_sla_notification": {"label": "Notificación inicial SLA", "subject": "SLA iniciado: incidente pendiente - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe inició el ciclo SLA para un incidente pendiente de verificación.\n\nApartamento: {{apt}}\nPropietario: {{owner}}\nOperador: {{operator}}\nSLA: {{slaHours}} horas\nFecha: {{date}}\nTipo: {{type}}\nCategoría: {{category}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">SLA iniciado</h2><p>Se inició el ciclo SLA para un incidente pendiente de verificación.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>SLA:</strong> {{slaHours}} horas</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver incidente</a></p></div>"}, "incident_sla_reminder": {"label": "Recordatorio SLA de incidente", "subject": "Recordatorio SLA: incidente pendiente - Apto {{apt}} Torre KAI", "text": "Hola,\n\nRecordatorio de SLA: el incidente sigue pendiente de verificación por el propietario.\n\nApartamento: {{apt}}\nPropietario: {{owner}}\nOperador: {{operator}}\nCiclo SLA: {{slaCycleCount}}\nFecha: {{date}}\nTipo: {{type}}\nCategoría: {{category}}\n\nDescripción:\n{{desc}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Recordatorio SLA: incidente pendiente</h2><p>El incidente sigue pendiente de verificación por el propietario.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Ciclo SLA:</strong> {{slaCycleCount}}</p><p><strong>Descripción:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{desc}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver incidente pendiente</a></p></div>"}, "incident_sla": {"label": "Recordatorio SLA de incidente", "subject": "Recordatorio SLA: incidente pendiente - Apto {{apt}} Torre KAI", "text": "Hola,\n\nRecordatorio SLA. Ver incidente: {{incidentLink}}\n", "html": "<div><h2>Recordatorio SLA</h2><p><a href=\"{{incidentLink}}\">Ver incidente</a></p></div>"}, "incident_verified": {"label": "Incidente verificado", "subject": "Incidente verificado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nEl propietario verificó el incidente.\n\nApartamento: {{apt}}\nHuésped(es): {{ownerGuestNames}}\nCiudad: {{ownerGuestCity}}\nPaís: {{ownerGuestCountry}}\nComentarios: {{ownerComments}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incidente verificado</h2><p>El propietario verificó el incidente y completó la información requerida.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Huésped(es):</strong> {{ownerGuestNames}}<br/><strong>Ciudad:</strong> {{ownerGuestCity}}<br/><strong>País:</strong> {{ownerGuestCountry}}</p><p><strong>Comentarios:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{ownerComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver incidente</a></p></div>"}, "registration_submitted": {"label": "Registro enviado al usuario", "subject": "Registro recibido - Propietarios Airbnb KAI", "text": "Hola {{userName}},\n\nRecibimos tu solicitud de registro. Tu registro está pendiente de aprobación.\n\nVer estado: {{registrationLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro recibido</h2><p>Hola {{userName}},</p><p>Recibimos tu solicitud de registro. Tu registro está <strong>pendiente de aprobación</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{registrationLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver estado</a></p></div>"}, "registration_approved": {"label": "Registro aprobado al usuario", "subject": "Registro aprobado - Propietarios Airbnb KAI", "text": "Hola {{userName}},\n\nTu registro fue aprobado.\n\nEntrar: {{dashboardLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro aprobado</h2><p>Hola {{userName}}, tu registro fue <strong>aprobado</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{dashboardLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Entrar a la aplicación</a></p></div>"}, "registration_declined": {"label": "Registro rechazado al usuario", "subject": "Registro rechazado - Propietarios Airbnb KAI", "text": "Hola {{userName}},\n\nTu registro fue rechazado.\n{{reasonLine}}\n\nVer estado: {{registrationLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro rechazado</h2><p>Hola {{userName}}, tu registro fue <strong>rechazado</strong>.</p>{{reasonHtml}}<p style=\"margin:18px 0\"><a href=\"{{registrationLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver estado</a></p></div>"}, "registration_status_admin": {"label": "Aviso admin: registro aprobado/rechazado", "subject": "Registro {{registrationStatus}} - {{userName}}", "text": "Hola,\n\nUn registro fue {{registrationStatus}}.\n\nUsuario: {{userName}} ({{userEmail}})\nRevisor: {{reviewerName}}\nMotivo: {{reason}}\n\nVer registros: {{approvalsLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Registro {{registrationStatus}}</h2><p><strong>Usuario:</strong> {{userName}} ({{userEmail}})<br/><strong>Revisor:</strong> {{reviewerName}}<br/><strong>Motivo:</strong> {{reason}}</p><p style=\"margin:18px 0\"><a href=\"{{approvalsLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver registros</a></p></div>"}, "registration_reviewer": {"label": "Aviso admin: registro pendiente", "subject": "Nuevo registro pendiente - Propietarios Airbnb KAI", "text": "Hola {{reviewerName}},\n\nHay un nuevo registro pendiente para revisar: {{userName}} ({{userEmail}}).\n\nRevisar: {{approvalsLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Nuevo registro pendiente</h2><p>Hay una nueva solicitud para revisar.</p><p><strong>Usuario:</strong> {{userName}}<br/><strong>Email:</strong> {{userEmail}}</p><p style=\"margin:18px 0\"><a href=\"{{approvalsLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Revisar registro</a></p></div>"}, "listing_created": {"label": "Listing creado al usuario", "subject": "Nuevo listing agregado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe agregó el listing del Apto {{apt}}.\n\nVer listing: {{listingLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Nuevo listing agregado</h2><p>Se agregó el listing del <strong>Apto {{apt}} · Torre KAI</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{listingLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver listing</a></p></div>"}, "listing_updated": {"label": "Listing actualizado al usuario", "subject": "Listing actualizado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe actualizó la información del Apto {{apt}}.\n\nVer listing: {{listingLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Listing actualizado</h2><p>Se actualizó la información del <strong>Apto {{apt}} · Torre KAI</strong>.</p><p style=\"margin:18px 0\"><a href=\"{{listingLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver listing</a></p></div>"}, "listing_deleted": {"label": "Listing eliminado al usuario", "subject": "Listing eliminado - Apto {{apt}} Torre KAI", "text": "Hola,\n\nSe eliminó el listing del Apto {{apt}}.\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Listing eliminado</h2><p>Se eliminó el listing del <strong>Apto {{apt}} · Torre KAI</strong>.</p></div>"}, "incident_resolved": {"label": "Incidente resuelto", "subject": "Incidente resuelto - Apto {{apt}} Torre KAI", "text": "Hola,\n\nEl incidente en el Apto {{apt}} ha sido resuelto.\n\nApartamento: {{apt}}\nPropietario: {{owner}}\nOperador: {{operator}}\nResuelto por: {{resolvedBy}}\nComentarios de resolución: {{resolutionComments}}\n\nVer incidente: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incidente resuelto ✅</h2><p>El incidente en el listing ha sido marcado como resuelto.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Resuelto por:</strong> {{resolvedBy}}</p><p><strong>Comentarios de resolución:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #2F4F3A;padding:12px\">{{resolutionComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">Ver incidente</a></p></div>"}};

const DEFAULT_EMAIL_TEMPLATES_EN = {"incident_new": {"label": "New incident to owner", "subject": "New incident reported - Apt {{apt}} Tower KAI", "text": "Hello,\n\nA new incident was reported on your listing.\n\nApartment: {{apt}}\nOwner: {{owner}}\nOperator: {{operator}}\nDate: {{date}}\nType: {{type}}\nCategory: {{category}}\n\nDescription:\n{{desc}}\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">New incident reported</h2><p>A new incident was reported on your listing.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>Date:</strong> {{date}}<br/><strong>Type:</strong> {{type}}<br/><strong>Category:</strong> {{category}}</p><p><strong>Description:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{desc}}</p><p><strong>Action required:</strong> the owner must verify the incident with guest name(s), city, country, and optional response.</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View and verify incident</a></p></div>"}, "incident_sla_notification": {"label": "Initial SLA notification", "subject": "SLA started: pending incident - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe SLA cycle started for a pending incident.\n\nApartment: {{apt}}\nOwner: {{owner}}\nOperator: {{operator}}\nSLA: {{slaHours}} hours\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">SLA started</h2><p>The SLA cycle started for a pending incident.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>SLA:</strong> {{slaHours}} hours</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View incident</a></p></div>"}, "incident_sla_reminder": {"label": "Incident SLA reminder", "subject": "SLA reminder: pending incident - Apt {{apt}} Tower KAI", "text": "Hello,\n\nSLA reminder: this incident is still pending owner verification.\n\nApartment: {{apt}}\nOwner: {{owner}}\nOperator: {{operator}}\nSLA cycle: {{slaCycleCount}}\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">SLA reminder: pending incident</h2><p>This incident is still pending owner verification.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>SLA cycle:</strong> {{slaCycleCount}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View pending incident</a></p></div>"}, "incident_sla": {"label": "Incident SLA reminder", "subject": "SLA reminder: pending incident - Apt {{apt}} Tower KAI", "text": "Hello,\n\nSLA reminder. View incident: {{incidentLink}}\n", "html": "<div><h2>SLA reminder</h2><p><a href=\"{{incidentLink}}\">View incident</a></p></div>"}, "incident_verified": {"label": "Incident verified", "subject": "Incident verified - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe owner verified the incident.\n\nApartment: {{apt}}\nGuest(s): {{ownerGuestNames}}\nCity: {{ownerGuestCity}}\nCountry: {{ownerGuestCountry}}\nComments: {{ownerComments}}\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incident verified</h2><p>The owner verified the incident.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Guest(s):</strong> {{ownerGuestNames}}<br/><strong>City:</strong> {{ownerGuestCity}}<br/><strong>Country:</strong> {{ownerGuestCountry}}</p><p><strong>Comments:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px\">{{ownerComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View incident</a></p></div>"}, "registration_submitted": {"label": "Registration submitted to user", "subject": "Registration received - Airbnb KAI Owners", "text": "Hello {{userName}},\n\nWe received your registration request. It is pending approval.\n\nView status: {{registrationLink}}\n", "html": "<div><h2>Registration received</h2><p>Hello {{userName}}, your registration is pending approval.</p><p><a href=\"{{registrationLink}}\">View status</a></p></div>"}, "registration_approved": {"label": "Registration approved to user", "subject": "Registration approved - Airbnb KAI Owners", "text": "Hello {{userName}},\n\nYour registration was approved.\n\nOpen app: {{dashboardLink}}\n", "html": "<div><h2>Registration approved</h2><p>Hello {{userName}}, your registration was approved.</p><p><a href=\"{{dashboardLink}}\">Open app</a></p></div>"}, "registration_declined": {"label": "Registration denied to user", "subject": "Registration denied - Airbnb KAI Owners", "text": "Hello {{userName}},\n\nYour registration was denied.\n{{reasonLine}}\n\nView status: {{registrationLink}}\n", "html": "<div><h2>Registration denied</h2><p>Hello {{userName}}, your registration was denied.</p>{{reasonHtml}}<p><a href=\"{{registrationLink}}\">View status</a></p></div>"}, "registration_status_admin": {"label": "Admin notice: registration approved/denied", "subject": "Registration {{registrationStatus}} - {{userName}}", "text": "Hello,\n\nA registration was {{registrationStatus}}.\n\nUser: {{userName}} ({{userEmail}})\nReviewer: {{reviewerName}}\nReason: {{reason}}\n\nView registrations: {{approvalsLink}}\n", "html": "<div><h2>Registration {{registrationStatus}}</h2><p><strong>User:</strong> {{userName}} ({{userEmail}})<br/><strong>Reviewer:</strong> {{reviewerName}}<br/><strong>Reason:</strong> {{reason}}</p><p><a href=\"{{approvalsLink}}\">View registrations</a></p></div>"}, "registration_reviewer": {"label": "Admin notice: pending registration", "subject": "New registration pending - Airbnb KAI Owners", "text": "Hello {{reviewerName}},\n\nA new registration is pending review: {{userName}} ({{userEmail}}).\n\nReview: {{approvalsLink}}\n", "html": "<div><h2>New registration pending</h2><p><strong>User:</strong> {{userName}}<br/><strong>Email:</strong> {{userEmail}}</p><p><a href=\"{{approvalsLink}}\">Review registration</a></p></div>"}, "listing_created": {"label": "Listing created to user", "subject": "New listing added - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe listing for Apt {{apt}} was added.\n\nView listing: {{listingLink}}\n", "html": "<div><h2>New listing added</h2><p>The listing for <strong>Apt {{apt}} · Tower KAI</strong> was added.</p><p><a href=\"{{listingLink}}\">View listing</a></p></div>"}, "listing_updated": {"label": "Listing updated to user", "subject": "Listing updated - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe information for Apt {{apt}} was updated.\n\nView listing: {{listingLink}}\n", "html": "<div><h2>Listing updated</h2><p>The listing for <strong>Apt {{apt}} · Tower KAI</strong> was updated.</p><p><a href=\"{{listingLink}}\">View listing</a></p></div>"}, "listing_deleted": {"label": "Listing deleted to user", "subject": "Listing deleted - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe listing for Apt {{apt}} was deleted.\n", "html": "<div><h2>Listing deleted</h2><p>The listing for <strong>Apt {{apt}} · Tower KAI</strong> was deleted.</p></div>"}, "incident_resolved": {"label": "Incident resolved", "subject": "Incident resolved - Apt {{apt}} Tower KAI", "text": "Hello,\n\nThe incident in Apt {{apt}} has been resolved.\n\nApartment: {{apt}}\nOwner: {{owner}}\nOperator: {{operator}}\nResolved by: {{resolvedBy}}\nResolution comments: {{resolutionComments}}\n\nView incident: {{incidentLink}}\n", "html": "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#17313a\"><h2 style=\"color:#2F4F3A\">Incident resolved ✅</h2><p>The incident on this listing has been marked as resolved.</p><p><strong>Apartment:</strong> {{apt}} · Tower KAI<br/><strong>Owner:</strong> {{owner}}<br/><strong>Operator:</strong> {{operator}}<br/><strong>Resolved by:</strong> {{resolvedBy}}</p><p><strong>Resolution comments:</strong></p><p style=\"background:#f6f1e7;border-left:4px solid #2F4F3A;padding:12px\">{{resolutionComments}}</p><p style=\"margin:18px 0\"><a href=\"{{incidentLink}}\" style=\"background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700\">View incident</a></p></div>"}};

const normalizeLanguage = (language='es-CO') => String(language || 'es-CO').toLowerCase().startsWith('en') ? 'en' : 'es-CO';

const getUserLanguageByEmail = async (email='') => {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return 'es-CO';
  try {
    const { data } = await supabase.from('app_users').select('language_preference').eq('email', em).maybeSingle();
    return normalizeLanguage(data?.language_preference || 'es-CO');
  } catch(e) { return 'es-CO'; }
};
const getEmailTemplates = async (language='es-CO') => {
  const lang = normalizeLanguage(language);
  const merged = { ...(lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES) };
  try {
    const { data, error } = await supabase.from('email_templates').select('key,label,subject,text,html,language').eq('language', lang);
    if (!error) (data||[]).forEach(t => {
      if (merged[t.key]) merged[t.key] = { ...merged[t.key], label:t.label || merged[t.key].label, subject:t.subject || merged[t.key].subject, text:t.text || merged[t.key].text, html:t.html || merged[t.key].html };
    });
    if (error) warn('Email template read failed: ' + error.message);
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
const sendTemplatedEmail = async ({ key, to, vars={}, language='auto', relatedEntity='', relatedId='' }) => {
  const recipients = normalizeRecipients(to);
  if (!recipients.length) {
    await logEmailDelivery({ eventType:key, recipients, subject:'', status:'skipped', errorMessage:'No recipient email provided', relatedEntity, relatedId });
    return { sent:false, skipped:true, reason:'Recipient email is missing.' };
  }
  const groups = {};
  if (language && language !== 'auto') {
    groups[normalizeLanguage(language)] = recipients;
  } else {
    for (const r of recipients) {
      const lang = await getUserLanguageByEmail(r);
      groups[lang] = groups[lang] || [];
      groups[lang].push(r);
    }
  }
  const results = [];
  for (const [lang, recips] of Object.entries(groups)) {
    const templates = await getEmailTemplates(lang);
    const defaults = lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES;
    const t = templates[key] || defaults[key];
    if (!t) throw new Error('Email template not found: ' + key);
    const subject = renderTemplate(t.subject, vars);
    const text = renderTemplate(t.text, vars);
    const html = renderTemplate(t.html, vars);
    try {
      const result = await sendSpanishEmail({ to:recips, subject, text, html });
      await logEmailDelivery({ eventType:key, recipients:recips, subject, status:result.sent ? 'sent' : 'skipped', errorMessage:result.reason || '', relatedEntity, relatedId });
      results.push(result);
    } catch(e) {
      await logEmailDelivery({ eventType:key, recipients:recips, subject, status:'failed', errorMessage:e?.message || String(e), relatedEntity, relatedId });
      throw e;
    }
  }
  return { sent: results.some(r=>r.sent), skipped: results.every(r=>r.skipped), grouped:true };
};

const getAppConfig = async () => {
  const cfg = {
    sla_hours:String(DEFAULT_SLA_HOURS||24),
    escalation_cc_emails:DEFAULT_ESCALATION_CC_EMAILS.join(','),
    mission_title_es:'Misión y normas de la comunidad',
    mission_body_es:'Crear una comunidad organizada, informada y proactiva que proteja el valor de nuestras propiedades y eleve la experiencia en Morros KAI.',
    mission_title_en:'Mission and community rules',
    mission_body_en:'Create an organized, informed, and proactive community that protects property value and improves the Morros KAI guest experience.',
    mission_sections_es:'{"title": "Misión y normas de la comunidad", "subtitle": "Referencia para propietarios aprobados · Propietarios Airbnb KAI", "sectionLabel": "Nuestra misión", "heading": "Crear una comunidad organizada, informada y proactiva.", "body": "La aplicación ayuda a proteger el valor de nuestras propiedades, mejorar la coordinación entre propietarios y elevar la experiencia de los huéspedes en Morros KAI.", "cards": [{"icon": "🏡", "title": "Gestión centralizada", "text": "Organizar apartamentos, contactos, emails de notificación y enlaces importantes en un solo lugar."}, {"icon": "⚠️", "title": "Reportes transparentes", "text": "Documentar incidentes de manera rápida para que el propietario correcto reciba aviso y pueda tomar acción."}, {"icon": "🤝", "title": "Colaboración comunitaria", "text": "Compartir información útil entre propietarios aprobados para operar mejor y prevenir problemas repetidos."}, {"icon": "📊", "title": "Mejora continua", "text": "Usar datos y tendencias para elevar la calidad del servicio, la comunicación y la experiencia del huésped."}], "participationTitle": "📌 Reglas de participación", "participationRules": ["Reportar incidentes con información clara, objetiva y verificable.", "Incluir detalles útiles: apartamento, huésped, fecha, tipo de incidente y descripción.", "Mantener respeto y confidencialidad en los comentarios.", "No publicar contenido ofensivo, especulativo o no relacionado con la operación.", "Usar los reportes para prevenir, corregir y mejorar; no para conflictos personales."], "accessTitle": "🔐 Acceso y responsabilidad", "accessRules": ["El acceso requiere Google Sign-In.", "Cada apartamento solo puede pertenecer a una cuenta aprobada.", "Los nuevos registros quedan pendientes hasta revisión.", "Los propietarios aprobados pueden revisar solicitudes pendientes y aprobar o rechazar con motivo.", "Las notificaciones se envían al email de Google y al email del listing cuando son diferentes."]}'
  };
  try { const { data, error } = await supabase.from('app_config').select('key,value'); if (!error) (data||[]).forEach(r=>cfg[r.key]=r.value); }
  catch(e) { warn('App config read failed: ' + (e?.message || e)); }
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
const canManageRegistrations = async (uid, email='') => (await getUserRole({uid,email})) === 'global_admin' || await hasDelegatePermission(uid, email, 'canApproveRegistrations');
const isGlobalAdmin = async (uid, email='') => (await getUserRole({uid,email})) === 'global_admin';
const addHoursIso = (iso, hours) => new Date(new Date(iso).getTime() + Number(hours || 24)*3600000).toISOString();
const getIncidentRecipients = async (listing, { includeEscalationCc=false } = {}) => {
  const base = [listing?.email, listing?.user_email, listing?.userEmail, listing?.operator_email, listing?.operatorEmail];
  if (includeEscalationCc) base.push(...await getEscalationCcEmails());
  return normalizeRecipients(base);
};
// Build recipients list for an incident email type based on admin notification config.
const buildIncidentRecipients = async (key, listing, typeCfg) => {
  const recips = [];
  if (typeCfg.owner)        recips.push(...getListingOwnerEmails(listing));
  if (typeCfg.operator)     recips.push(...getListingOperatorEmails(listing));
  if (typeCfg.globalAdmin)  recips.push(...getGlobalAdminEmails(), ...await getEscalationCcEmails());
  if (typeCfg.delegateAdmin) {
    const perm = key === 'incident_resolved' ? 'canResolveIncidents' : 'canUpdateGlobalIncidents';
    recips.push(...await getDelegateAdminsWithPermission(perm));
  }
  return normalizeRecipients(recips);
};

const sendIncidentEmail = async ({ listing, incident, appUrl, to, isEscalation=false }) => {
  if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render.' };
  const key = isEscalation ? 'incident_sla' : 'incident_new';
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg[key];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:`Email type '${key}' is disabled.` };
  const recipients = to ? normalizeRecipients(to) : await buildIncidentRecipients(key, listing, typeCfg);
  if (!recipients.length) return { sent:false, skipped:true, reason:'No recipients for this incident email.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  return sendTemplatedEmail({ key, to: recipients, vars: { apt, owner: listing.owner || '', operator: listing.operator || 'No indicado', operatorEmail: listing.operatorEmail || listing.operator_email || '', guestName: incident.guestName || '', date: incident.date || '', type: incident.type || '', category: incident.category || '', status: incident.status || 'open', desc: incident.desc || '', incidentLink, slaCycleCount: String(incident.slaCycleCount || incident.sla_cycle_count || '') } });
};

const sendIncidentVerifiedEmail = async ({ listing, incident, appUrl }) => {
  if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render.' };
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['incident_verified'];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:'Email type \'incident_verified\' is disabled.' };
  const recipients = await buildIncidentRecipients('incident_verified', listing, typeCfg);
  if (!recipients.length) return { sent:false, skipped:true, reason:'No recipients for verified email.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  return sendTemplatedEmail({ key:'incident_verified', to:recipients, vars:{ apt, owner:listing.owner || '', operator:listing.operator || 'No indicado', operatorEmail:listing.operatorEmail || listing.operator_email || '', ownerGuestNames:incident.ownerGuestNames || '', ownerGuestCity:incident.ownerGuestCity || '', ownerGuestCountry:incident.ownerGuestCountry || '', ownerComments:incident.ownerComments || '', incidentLink } });
};

const sendIncidentResolvedEmail = async ({ listing, incident, appUrl }) => {
  if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render.' };
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['incident_resolved'];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:'Email type \'incident_resolved\' is disabled.' };
  const recipients = await buildIncidentRecipients('incident_resolved', listing, typeCfg);
  if (!recipients.length) return { sent:false, skipped:true, reason:'No recipients for resolved email.' };
  const apt = listing.apt || String(incident.aptLabel || '').replace(/[^0-9]/g,'');
  const incidentLink = appUrl + '/?view=incidents&incident=' + incident.id;
  return sendTemplatedEmail({ key:'incident_resolved', to:recipients, vars:{ apt, owner:listing.owner || '', operator:listing.operator || 'No indicado', operatorEmail:listing.operatorEmail || listing.operator_email || '', resolvedBy:incident.resolvedBy || incident.resolved_by || '', resolutionComments:incident.resolutionComments || incident.resolution_comments || '', date:incident.date || '', type:incident.type || '', category:incident.category || '', incidentLink }, relatedEntity:'incident', relatedId:incident.id });
};

const getListingRecipients = (listing) => normalizeRecipients([listing?.email, listing?.user_email, listing?.userEmail]);
const sendListingChangeEmail = async ({ listing, action, appUrl }) => {
  const key = action === 'created' ? 'listing_created' : action === 'updated' ? 'listing_updated' : 'listing_deleted';
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg[key];
  if (!typeCfg.enabled) return { sent:false, skipped:true, reason:`Email type '${key}' is disabled.` };
  const recips = [];
  if (typeCfg.owner)        recips.push(...getListingOwnerEmails(listing));
  if (typeCfg.operator)     recips.push(...getListingOperatorEmails(listing));
  if (typeCfg.globalAdmin)  recips.push(...getGlobalAdminEmails());
  if (typeCfg.delegateAdmin) recips.push(...await getDelegateAdminsWithPermission('canUpdateGlobalListings'));
  const recipients = normalizeRecipients(recips);
  if (!recipients.length) return { sent:false, skipped:true, reason:'No recipients for listing change email.' };
  return sendTemplatedEmail({ key, to: recipients, vars: { apt: listing.apt || '', owner: listing.owner || '', listingEmail: listing.email || listing.user_email || '', listingLink: appUrl + '/?view=listings' } });
};

const isThreeDigitApt = (apt) => /^[0-9]{3}$/.test(String(apt || '').trim());
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
const isValidOptionalUrl = (url) => !String(url || '').trim() || /^https?:\/\/.+/i.test(String(url || '').trim());

// ─── FIELD MAPPERS ───────────────────────────────────────────────────────────
const listingFromDb = (r) => ({
  id: r.id,
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
  createdAt: (r.created_at || '').slice(0, 10),
});

const listingToDb = (l) => ({
  id: l.id,
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
});

const incidentToDb = (i) => ({
  id: i.id,
  reporter_uid: i.reporterUid,
  reporter_name: i.reporterName,
  apt_id: i.aptId,
  apt_label: i.aptLabel,
  guest_name: i.guestName,
  guest_city: i.guestCity || '',
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
});

const notificationFromDb = (r) => ({
  id: r.id,
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

const notificationToDb = (n) => ({
  id: n.id,
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

const findApartmentConflict = async (apt, { excludeListingId = '', allowedOwnerUid = '', includePending = true } = {}) => {
  const normalized = normalizeApt(apt);
  if (!normalized) return null;
  const activeStatuses = includePending ? ['approved', 'pending'] : ['approved'];
  const { data: rows, error: qError } = await supabase
    .from('listings')
    .select('id, apt, tower, owner_uid, owner, email, user_email, status')
    .eq('apt', normalized)
    .in('status', activeStatuses)
    .limit(5);
  if (qError) throw qError;
  const conflict = (rows || []).find(r => r.id !== excludeListingId && (!allowedOwnerUid || r.owner_uid !== allowedOwnerUid || r.status === 'approved'));
  if (!conflict) return null;
  const isPending = conflict.status === 'pending';
  return {
    type: isPending ? 'pending' : 'approved',
    message: isPending
      ? `El apartamento KAI ${normalized} ya está en una solicitud pendiente de aprobación. No se puede registrar el mismo apartamento con otra cuenta de Google.`
      : `El apartamento KAI ${normalized} ya está registrado. Cada apartamento solo puede estar asociado a una cuenta de Google.`,
    apt: normalized,
    owner: conflict.owner || '',
    email: conflict.email || conflict.user_email || '',
  };
};

const validateApartmentUniqueness = async (listings, { ownerUid = '', excludeListingId = '', includePending = true } = {}) => {
  const seen = new Set();
  for (const l of listings || []) {
    const apt = normalizeApt(l.apt);
    if (seen.has(apt)) {
      return { type: 'duplicate_in_request', message: `El apartamento KAI ${apt} está repetido en la solicitud. Cada apartamento solo puede registrarse una vez.` };
    }
    seen.add(apt);
    const conflict = await findApartmentConflict(apt, { excludeListingId, allowedOwnerUid: ownerUid, includePending });
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
  if (!l || !l.apt || !l.rooms || !l.guests || !l.contact || !l.email) return 'Apartamento, habitaciones, huéspedes, WhatsApp del propietario y email del listing son requeridos.';
  if (!isThreeDigitApt(l.apt)) return 'El apartamento debe tener exactamente 3 dígitos. Ejemplo: 000.';
  if (!isValidEmail(l.email)) return 'Ingrese un email válido para cada listing.';
  if ((l.operatorEmail || l.operator_email) && !isValidEmail(l.operatorEmail || l.operator_email)) return 'Ingrese un email válido para el operador.';
  if (!isValidOptionalUrl(l.airbnb)) return 'El URL de Airbnb debe comenzar con http:// o https:// cuando se ingrese.';
  return '';
};
const sendRegistrationSubmittedEmail = async ({ registration, appUrl }) => {
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['registration_submitted'];
  if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:'Registration submitted email is disabled.' };
  return sendTemplatedEmail({ key:'registration_submitted', to: registration.userEmail, vars: { userName:registration.userName || '', userEmail:registration.userEmail || '', registrationLink: appUrl + '/?view=registration' } });
};
const sendRegistrationStatusEmail = async ({ registration, appUrl }) => {
  const approved = registration.status === 'approved';
  const key = approved ? 'registration_approved' : 'registration_declined';
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg[key];
  if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:`Registration ${key} email is disabled.` };
  const link = appUrl + (approved ? '/?view=dashboard' : '/?view=registration');
  const reason = String(registration.reason || '').trim();
  // Also notify admins if configured
  const recips = [registration.userEmail];
  const admCfg = notifCfg['registration_status_admin'];
  if (admCfg?.enabled) {
    if (admCfg.globalAdmin) recips.push(...getGlobalAdminEmails());
    if (admCfg.delegateAdmin) recips.push(...await getDelegateAdminsWithPermission('canApproveRegistrations'));
  }
  return sendTemplatedEmail({ key, to: normalizeRecipients(recips), vars: { userName:registration.userName || '', userEmail:registration.userEmail || '', reason, reasonLine: reason ? 'Motivo/nota: ' + reason : '', reasonHtml: reason ? '<p><strong>Motivo/nota:</strong> ' + reason + '</p>' : '', dashboardLink:link, registrationLink:link } });
};
const sendRegistrationReviewerEmail = async ({ reviewer, registration, appUrl }) => {
  const notifCfg = await getEmailNotificationConfig();
  const typeCfg = notifCfg['registration_reviewer'];
  if (!typeCfg.enabled || !typeCfg.owner) return { sent:false, skipped:true, reason:'Registration reviewer email is disabled.' };
  return sendTemplatedEmail({ key:'registration_reviewer', to: reviewer.user_email, vars: { reviewerName: reviewer.user_name || 'propietario', userName:registration.userName || '', userEmail:registration.userEmail || '', approvalsLink: appUrl + '/?view=approvals' } });
};

const sendSupabaseError = (res, error, status = 500) => {
  console.error('Supabase error:', error);
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  return res.status(status).json({ error: parts.join(' | ') || 'Supabase error' });
};

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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

// ─── API: REGISTRATION / APPROVAL WORKFLOW ──────────────────────────────────

app.get('/api/apartments/check', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const apt = String(req.query.apt || '').trim();
  const ownerUid = String(req.query.ownerUid || '').trim();
  const excludeListingId = String(req.query.excludeListingId || '').trim();
  if (!apt) return res.status(400).json({ error:'apt is required.' });
  if (!isThreeDigitApt(apt)) return res.json({ available:false, valid:false, message:'El apartamento debe tener exactamente 3 dígitos. Ejemplo: 000.' });
  try {
    const conflict = await findApartmentConflict(apt, { allowedOwnerUid: ownerUid, excludeListingId, includePending: true });
    if (conflict) return res.json({ available:false, valid:true, conflict, message: conflict.message });
    res.json({ available:true, valid:true, message:'Apartamento disponible.' });
  } catch(e) { return sendSupabaseError(res, e); }
});

app.get('/api/registrations/status', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const uid = String(req.query.uid || '').trim();
  if (!uid) return res.status(400).json({ error: 'uid is required.' });
  const { data: latest, error } = await supabase.from('listings').select('*').eq('owner_uid', uid).in('status', ['pending','approved','declined']).order('created_at', { ascending:false }).limit(1).maybeSingle();
  if (error) return sendSupabaseError(res, error);
  if (!latest) return res.json({ status:'none' });
  const regId = latest.registration_id;
  const query = supabase.from('listings').select('*').eq('owner_uid', uid).eq('status', latest.status).order('apt', { ascending:true });
  const { data: rows, error: rowError } = regId ? await query.eq('registration_id', regId) : await query;
  if (rowError) return sendSupabaseError(res, rowError);
  res.json(registrationFromListingRows(rows || [latest]));
});

app.post('/api/registrations', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { userUid, userName, userEmail, listings } = req.body || {};
  if (!userUid || !userName || !userEmail || !isValidEmail(userEmail)) return res.status(400).json({ error:'Google login name and email are required.' });
  if (!Array.isArray(listings) || listings.length < 1) return res.status(400).json({ error:'Debe registrar al menos un listing propio.' });
  for (const l of listings) { const msg = validateListingInput({ ...l, email: l.email || userEmail }); if (msg) return res.status(400).json({ error: msg }); }
  try {
    const conflict = await validateApartmentUniqueness(listings, { ownerUid: userUid, includePending: true });
    if (conflict) return res.status(409).json({ error: conflict.message, conflict });
  } catch(e) { return sendSupabaseError(res, e); }

  const { data: existingApproved, error: approvedError } = await supabase.from('listings').select('id').eq('owner_uid', userUid).eq('status','approved').limit(1).maybeSingle();
  if (approvedError) return sendSupabaseError(res, approvedError);
  if (existingApproved) return res.status(400).json({ error:'Este usuario ya está aprobado.' });

  const { data: existingPending, error: pendingError } = await supabase.from('listings').select('id').eq('owner_uid', userUid).eq('status','pending').limit(1).maybeSingle();
  if (pendingError) return sendSupabaseError(res, pendingError);
  if (existingPending) return res.status(400).json({ error:'Ya tienes un registro pendiente de aprobación.' });

  const registrationId = 'reg_' + uuidv4().slice(0,8);
  const rows = listings.map(l => listingToDb({
    id:'lst_' + uuidv4().slice(0,8), registrationId, ownerUid:userUid, owner:String(userName||'').trim(), userEmail:String(userEmail||'').trim(),
    apt:l.apt, tower:'KAI', rooms:l.rooms, guests:l.guests, operator:l.operator, operatorEmail:l.operatorEmail || l.operator_email, operatorWhatsapp:l.operatorWhatsapp || l.operator_whatsapp, contact:l.contact, email:l.email || userEmail, airbnb:l.airbnb,
    status:'pending', reason:'', createdAt:new Date().toISOString()
  }));
  let { data: savedRows, error: rowsError } = await supabase.from('listings').insert(rows).select('*');
  if (rowsError) return sendSupabaseError(res, rowsError);

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
      if (result.status === 'approved') await sendRegistrationStatusEmail({ registration: result, appUrl });
      else await sendRegistrationSubmittedEmail({ registration: result, appUrl });
    } catch(e) { warn('Registration submitted/status email failed: ' + (e?.message || e)); }
    try {
      if (result.status !== 'pending') return;
      const { data: reviewerRows } = await supabase.from('listings').select('owner_uid,owner,user_email,email').eq('status','approved');
      const seen = new Set();
      for (const r of reviewerRows || []) {
        if (seen.has(r.owner_uid)) continue; seen.add(r.owner_uid);
        const reviewer = { user_uid:r.owner_uid, user_name:r.owner, user_email:r.user_email || r.email };
        const note = { id:'not_' + uuidv4().slice(0,8), ownerUid: reviewer.user_uid, listingId:null, incidentId:null, title:'Nuevo registro pendiente', message:`${result.userName} solicita acceso con ${(savedRows||[]).length} listing(s).`, isRead:false, emailSent:false, emailError:'', createdAt:new Date().toISOString(), kind:'registration', registrationId: result.id };
        await supabase.from('notifications').insert(notificationToDb(note));
        try { await sendRegistrationReviewerEmail({ reviewer, registration: result, appUrl }); } catch(mailErr) { warn('Reviewer registration email failed: ' + (mailErr?.message || mailErr)); }
      }
    } catch(e) { warn('Registration reviewer notification failed: ' + (e?.message || e)); }
  });
});

app.get('/api/registrations/pending', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const reviewerUid = String(req.query.reviewerUid || '').trim();
  if (!reviewerUid) return res.status(400).json({ error:'reviewerUid is required.' });
  try { if (!(await canManageRegistrations(reviewerUid, req.query.reviewerEmail))) return res.status(403).json({ error:'Solo administradores globales o delegados pueden revisar registros pendientes.' }); } catch(e) { return sendSupabaseError(res, e); }
  const { data: rows, error } = await supabase.from('listings').select('*').eq('status','pending').order('created_at', { ascending:true }).order('apt', { ascending:true });
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
  if (!reviewerUid) return res.status(400).json({ error:'reviewerUid is required.' });
  try {
    if (!(await canManageRegistrations(reviewerUid, req.query.reviewerEmail))) {
      return res.status(403).json({ error:'Solo administradores globales o delegados pueden ver registros activos.' });
    }
  } catch(e) { return sendSupabaseError(res, e); }

  const { data: rows, error } = await supabase
    .from('listings')
    .select('*')
    .in('status',['approved','declined'])
    .order('owner', { ascending:true })
    .order('apt', { ascending:true });
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
  try { if (!(await canManageRegistrations(reviewerUid, req.body?.reviewerEmail))) return res.status(403).json({ error:'Solo administradores globales o delegados pueden aprobar o rechazar registros.' }); } catch(e) { return sendSupabaseError(res, e); }
  const registrationId = req.params.id;
  const { data: pendingRows, error: findErr } = await supabase.from('listings').select('*').eq('registration_id', registrationId).eq('status','pending').order('apt', { ascending:true });
  if (findErr) return sendSupabaseError(res, findErr);
  if (!pendingRows || !pendingRows.length) return res.status(404).json({ error:'Registro pendiente no encontrado o ya revisado.' });

  if (status === 'approved') {
    try {
      const conflict = await validateApartmentUniqueness(pendingRows, { ownerUid: pendingRows[0].owner_uid, includePending: false });
      if (conflict) return res.status(409).json({ error: conflict.message, conflict });
    } catch(e) { return sendSupabaseError(res, e); }
  }
  const review = { status, reason:String(reason || '').trim(), reviewed_by_uid:reviewerUid, reviewed_by_name:reviewerName || '', reviewed_at:new Date().toISOString() };
  const { data: updated, error: updErr } = await supabase.from('listings').update(review).eq('registration_id', registrationId).eq('status','pending').select('*');
  if (updErr) return sendSupabaseError(res, updErr);
  for (const row of updated || []) await auditEvent({ listingId:row.id, registrationId, actorUid:reviewerUid, actorName:reviewerName, action: status === 'approved' ? 'registration_approved' : 'registration_declined', reason:review.reason, before:pendingRows.find(x => x.id === row.id), after:row });
  const result = registrationFromListingRows(updated || []);
  res.json(result);
  setImmediate(async () => { try { await sendRegistrationStatusEmail({ registration: result, appUrl: publicAppUrl(req) }); } catch(e) { warn('Registration status email failed: ' + (e?.message || e)); } });
};
app.post('/api/registrations/:id/approve', (req, res) => reviewRegistration(req, res, 'approved'));
app.post('/api/registrations/:id/decline', (req, res) => reviewRegistration(req, res, 'declined'));

// ─── API: LISTINGS ────────────────────────────────────────────────────────────
app.get('/api/listings', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { data, error } = await supabase.from('listings').select('*').eq('status','approved').order('apt', { ascending: true });
  if (error) return sendSupabaseError(res, error);
  res.json((data || []).map(listingFromDb));
});

app.post('/api/listings', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { ownerUid, owner, userEmail, apt, rooms, guests, operator, operatorEmail, operatorWhatsapp, contact, email, airbnb } = req.body;
  if (!ownerUid || !owner || !apt || !rooms || !guests || !contact || !email) return res.status(400).json({ error: 'Missing required fields: owner, apartment, rooms, guests, owner WhatsApp, and listing email are required.' });
  if (!isThreeDigitApt(apt)) return res.status(400).json({ error: 'Apartment number must be exactly 3 digits, for example 000.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email address is required.' });
  if (operatorEmail && !isValidEmail(operatorEmail)) return res.status(400).json({ error: 'A valid operator email is required.' });
  if (!isValidOptionalUrl(airbnb)) return res.status(400).json({ error: 'Airbnb URL must start with http:// or https:// when provided.' });
  try {
    const conflict = await validateApartmentUniqueness([{ apt }], { ownerUid, includePending: true });
    if (conflict) return res.status(409).json({ error: conflict.message, conflict });
  } catch(e) { return sendSupabaseError(res, e); }

  const item = { id:'lst_'+uuidv4().slice(0,8), ownerUid, owner:String(owner||'').trim(), userEmail:String(userEmail || email || '').trim(), apt:String(apt).trim(), tower:'KAI', rooms, guests:Number(guests), operator:operator||'', operatorEmail:operatorEmail||'', operatorWhatsapp:operatorWhatsapp||'', contact:String(contact||'').trim(), email:String(email||userEmail||'').trim(), airbnb:String(airbnb||'').trim(), status:'approved', reviewedByUid:ownerUid, reviewedByName:owner, reviewedAt:new Date().toISOString(), createdAt:new Date().toISOString() };
  const { data, error } = await supabase.from('listings').insert(listingToDb(item)).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditEvent({ listingId:data.id, registrationId:data.registration_id, actorUid:ownerUid, actorName:owner, action:'listing_created', after:data });
  await auditLog({ entity:'listing', entityId:data.id, action:'create', actorUid:ownerUid, actorEmail:userEmail || email, actorName:owner, after:data });
  setImmediate(() => sendListingChangeEmail({ listing: listingFromDb(data), action:'created', appUrl: publicAppUrl(req) }).catch(e => warn('Listing created email failed: ' + (e?.message || e))));
  res.json(listingFromDb(data));
});

app.put('/api/listings/:id', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { ownerUid, actorEmail, apt, rooms, guests, operator, operatorEmail, operatorWhatsapp, contact, email, airbnb } = req.body;

  const { data: existing, error: findError } = await supabase.from('listings').select('*').eq('id', req.params.id).single();
  if (findError || !existing) return res.status(404).json({ error: 'Not found' });
  if (existing.owner_uid !== ownerUid && !(await canUpdateGlobalListing(ownerUid, actorEmail))) return res.status(403).json({ error: 'Forbidden' });

  if (!apt || !rooms || !guests || !contact || !email) return res.status(400).json({ error: 'Missing required fields: apartment, rooms, guests, owner WhatsApp, and listing email are required.' });
  if (!isThreeDigitApt(apt)) return res.status(400).json({ error: 'Apartment number must be exactly 3 digits, for example 000.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email address is required.' });
  if (operatorEmail && !isValidEmail(operatorEmail)) return res.status(400).json({ error: 'A valid operator email is required.' });
  if (!isValidOptionalUrl(airbnb)) return res.status(400).json({ error: 'Airbnb URL must start with http:// or https:// when provided.' });
  try {
    const conflict = await validateApartmentUniqueness([{ apt }], { ownerUid, excludeListingId: req.params.id, includePending: true });
    if (conflict) return res.status(409).json({ error: conflict.message, conflict });
  } catch(e) { return sendSupabaseError(res, e); }

  const update = { apt:String(apt).trim(), tower:'KAI', rooms:String(rooms||''), guests:Number(guests||0), operator:operator||'', operator_email:String(operatorEmail||'').trim(), operator_whatsapp:String(operatorWhatsapp||'').trim(), contact:String(contact||'').trim(), email:String(email||'').trim(), airbnb:String(airbnb||'').trim() };
  const { data, error } = await supabase.from('listings').update(update).eq('id', req.params.id).select('*').single();
  if (error) return sendSupabaseError(res, error);
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
  if (existing.owner_uid !== ownerUid && !(await canDeleteGlobalListing(ownerUid, actorEmail))) return res.status(403).json({ error: 'Forbidden' });

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
  const { data, error } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
  if (error) return sendSupabaseError(res, error);
  res.json((data || []).map(incidentFromDb));
});

app.post('/api/incidents', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { reporterUid, reporterName, aptId, aptLabel, date, type, category, desc } = req.body;
  if (!reporterUid || !aptId || !date || !type || !category || !String(desc || '').trim()) return res.status(400).json({ error: 'Apartamento, fecha, tipo, categoría y descripción son requeridos.' });

  const { data: listing, error: listingError } = await supabase.from('listings').select('*').eq('id', aptId).eq('status','approved').single();
  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found for selected apartment.' });

  const appUrl = publicAppUrl(req);
  const slaHours = await getSlaHours();
  const nowIso = new Date().toISOString();
  const item = { id:'inc_'+uuidv4().slice(0,8), reporterUid, reporterName, aptId, aptLabel: aptLabel || ('Apto ' + listing.apt), guestName:'', guestCity:'', guestCountry:'', date, type, category, desc, status:'open', slaHours, nextSlaReminderAt:addHoursIso(nowIso, slaHours), slaCycleCount:0, createdAt:nowIso };
  const { data, error } = await supabase.from('incidents').insert(incidentToDb(item)).select('*').single();
  if (error) return sendSupabaseError(res, error);

  const savedIncident = incidentFromDb(data);
  await auditLog({ entity:'incident', entityId:data.id, action:'create', actorUid:reporterUid, actorName:reporterName, after:data });
  const notification = {
    id: 'not_' + uuidv4().slice(0, 8),
    ownerUid: listing.owner_uid,
    listingId: listing.id,
    incidentId: savedIncident.id,
    title: 'Nuevo incidente abierto - Apto ' + listing.apt,
    message: String(savedIncident.desc || '').slice(0, 160),
    isRead: false,
    emailSent: false,
    emailError: '',
    createdAt: new Date().toISOString(),
  };

  // Save the in-app notification first, then respond immediately.
  // Email is sent in the background so a slow SMTP provider never leaves the user
  // stuck on "Guardando en servidor...".
  const { error: notificationError } = await supabase.from('notifications').insert(notificationToDb(notification));
  if (notificationError) warn('Notification save failed: ' + notificationError.message);

  res.json({
    ...savedIncident,
    notificationSaved: !notificationError,
    emailQueued: Boolean(emailConfigured),
    emailSent: false,
    emailError: emailConfigured ? '' : 'Resend email is not configured in Render.',
  });

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
      const { error: updateEmailError } = await supabase
        .from('notifications')
        .update(emailStatus)
        .eq('id', notification.id);
      if (updateEmailError) warn('Notification email status update failed: ' + updateEmailError.message);
    }
  });
});


app.get('/api/admin/email-templates', async (req, res) => {
  log('[ADMIN] email-templates requested by ' + String(req.query?.email || ''));
  if (!requireSupabaseEnv(res)) return;
  const { uid, email } = req.query || {};
  const language = String(req.query.language || 'es-CO');
  if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error:'Solo un administrador global puede ver plantillas de email.' });
  res.json({ templates: await getEmailTemplates(language), variables: {
    incident_new:['apt','owner','operator','operatorEmail','guestName','date','type','category','status','desc','incidentLink'],
    incident_sla:['apt','owner','operator','operatorEmail','guestName','date','type','category','status','desc','incidentLink','slaCycleCount'],
    incident_resolved:['apt','owner','operator','operatorEmail','resolvedBy','resolutionComments','date','type','category','incidentLink'],
    registration_submitted:['userName','userEmail','registrationLink'],
    registration_approved:['userName','userEmail','dashboardLink'],
    registration_declined:['userName','userEmail','reason','reasonLine','reasonHtml','registrationLink'],
    registration_reviewer:['reviewerName','userName','userEmail','approvalsLink'],
    listing_created:['apt','owner','listingEmail','listingLink'],
    listing_updated:['apt','owner','listingEmail','listingLink'],
    listing_deleted:['apt','owner','listingEmail']
  }});
});

app.put('/api/admin/email-templates', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, templates } = req.body || {};
  const language = normalizeLanguage(req.body?.language || 'es-CO');
  if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede actualizar plantillas de email.' });
  if (!templates || typeof templates !== 'object') return res.status(400).json({ error:'templates is required.' });
  for (const [key, t] of Object.entries(templates)) {
    if (!DEFAULT_EMAIL_TEMPLATES[key]) continue;
    const row = { key, language:String(language || 'es-CO'), label:String(t.label || DEFAULT_EMAIL_TEMPLATES[key].label || key), subject:String(t.subject || DEFAULT_EMAIL_TEMPLATES[key].subject || ''), text:String(t.text || DEFAULT_EMAIL_TEMPLATES[key].text || ''), html:String(t.html || DEFAULT_EMAIL_TEMPLATES[key].html || ''), updated_at:new Date().toISOString(), updated_by_email:String(actorEmail || '').toLowerCase() };
    const { error } = await supabase.from('email_templates').upsert(row, { onConflict:'key,language' });
    if (error) return sendSupabaseError(res, error);
  }
  await auditLog({ entity:'email_templates', entityId:String(language || 'es-CO'), action:'update', actorUid:actorUid, actorEmail:actorEmail, after:templates });
  res.json({ ok:true, templates: await getEmailTemplates(language) });
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

app.get('/api/admin/me', async (req, res) => {
  log('[ADMIN] me requested by ' + String(req.query?.email || ''));
  if (!requireSupabaseEnv(res)) return;
  const uid = String(req.query.uid || '').trim();
  const email = String(req.query.email || '').trim().toLowerCase();
  const name = String(req.query.name || '').trim();
  const role = await getUserRole({ uid, email });
  try {
    if (uid && email) {
      const row = { uid, email, name, updated_at:new Date().toISOString() };
      if (role === 'global_admin') row.role = 'global_admin';
      await supabase.from('app_users').upsert(row, { onConflict:'uid' });
    }
  } catch(e) { warn('app_users upsert in /api/admin/me failed: ' + (e?.message || e)); }
  let languagePreference = 'es-CO';
  try {
    const { data } = await supabase.from('app_users').select('language_preference').eq('uid', uid).maybeSingle();
    languagePreference = data?.language_preference || 'es-CO';
  } catch(e) {}
  const config = await getAppConfig();
  const permissions = await getUserPermissions({ uid, email });
  res.json({ role, isGlobalAdmin: role === 'global_admin', canManageRegistrations: role === 'global_admin' || !!permissions.delegate?.canApproveRegistrations, languagePreference, config, permissions });
});

app.put('/api/admin/config', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid, actorEmail, slaHours, escalationCcEmails, analyticsEnabled, missionTitle, missionBody, missionTitleEs, missionBodyEs, missionTitleEn, missionBodyEn, missionSectionsEs, standardMenuPermissions, defaultDelegatePermissions, tooltipsEs, tooltipsEn } = req.body || {};
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
  const users = (rows || []).filter(u => approved.has(u.uid) || globalEmails.includes(String(u.email || '').trim().toLowerCase())).map(u => {
    const envGlobal = globalEmails.includes(String(u.email || '').trim().toLowerCase());
    const role = envGlobal ? 'global_admin' : normalizeRole(u.role || 'user');
    const storedPerms = safeJsonObject(u.permissions, {});
    const permissions = role === 'global_admin'
      ? { ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:true, canDeleteGlobalListings:true, canUpdateGlobalIncidents:true, canDeleteGlobalIncidents:true }
      : role === 'delegate_admin' ? { ...permsCfg.defaultDelegatePermissions, ...storedPerms } : {};
    return { uid:u.uid, email:u.email, name:u.name || '', role, permissions, languagePreference:u.language_preference || 'es-CO', approved: approved.has(u.uid), envGlobal };
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
    country: String(g?.country || '').trim(),
  })).filter(g => g.firstName || g.middleName || g.lastName || g.city || g.country);
}
function ownerGuestFullName(g) { return [g.firstName, g.middleName, g.lastName].filter(Boolean).join(' ').trim(); }

app.patch('/api/incidents/:id/verify', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { ownerUid, guests, guestNames, guestCity, guestCountry, ownerComments } = req.body || {};
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
  if (!ownerCommentText) return res.status(400).json({ error:'La respuesta del propietario es requerida.' });
  const upd = { status:'verified', owner_guests: ownerGuests, owner_guest_names:names, owner_guest_city:cities, owner_guest_country:countries, owner_comments:ownerCommentText, owner_verified_at:new Date().toISOString(), next_sla_reminder_at:null };
  const { data, error } = await supabase.from('incidents').update(upd).eq('id', req.params.id).select('*').single();
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'incident', entityId:data.id, action:'verify', actorUid:ownerUid, before:inc, after:data });
  const verifiedIncident = incidentFromDb(data);
  setImmediate(() => sendIncidentVerifiedEmail({ listing: listingFromDb(inc.listings), incident: verifiedIncident, appUrl: publicAppUrl(req) }).catch(e => warn('Incident verified email failed: ' + (e?.message || e))));
  res.json(verifiedIncident);
});

app.patch('/api/incidents/:id/resolve', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const { actorUid='', actorEmail='', actorName='', resolutionComments='' } = req.body || {};
  const comments = String(resolutionComments || '').trim();
  if (!comments) return res.status(400).json({ error:'Los comentarios de resolución son requeridos.' });
  const { data: existing, error: findError } = await supabase.from('incidents').select('*, listings(*)').eq('id', req.params.id).single();
  if (findError || !existing) return res.status(404).json({ error: 'Not found' });
  const ownerUid = existing.listings?.owner_uid || '';
  if (!(await hasDelegatePermission(actorUid, actorEmail, 'canResolveIncidents'))) return res.status(403).json({ error:'Only global admins or delegates with resolve permission can resolve incidents.' });
  const ownerGuests = Array.isArray(existing.owner_guests) ? existing.owner_guests : [];
  if (existing.status !== 'verified' || !existing.owner_verified_at || !ownerGuests.length || !String(existing.owner_comments || '').trim()) {
    return res.status(400).json({ error:'Owner must verify the incident with guest(s), city, country, and comments before resolution.' });
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
  if (existing.reporter_uid !== reporterUid && !(await canDeleteGlobalIncident(reporterUid, actorEmail))) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await supabase.from('incidents').delete().eq('id', req.params.id);
  if (error) return sendSupabaseError(res, error);
  await auditLog({ entity:'incident', entityId:existing.id, action:'delete', actorUid:reporterUid, actorEmail, before:existing });
  res.json({ ok: true });
});


// ─── API: OWNER NOTIFICATIONS ────────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  if (!requireSupabaseEnv(res)) return;
  const ownerUid = String(req.query.ownerUid || '').trim();
  if (!ownerUid) return res.status(400).json({ error: 'ownerUid is required.' });
  const { data, error } = await supabase.from('notifications').select('*').eq('owner_uid', ownerUid).order('created_at', { ascending: false });
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


const runSlaEscalations = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !emailConfigured) return;
  try {
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from('incidents')
      .select('*, listings(*)')
      .neq('status', 'verified')
      .neq('status', 'resolved')
      .not('next_sla_reminder_at', 'is', null)
      .lte('next_sla_reminder_at', now)
      .order('next_sla_reminder_at', { ascending:true })
      .limit(10);
    if (error) { warn('SLA escalation query failed: ' + error.message); return; }
    for (const row of rows || []) {
      const listing = row.listings;
      if (!listing) continue;
      const inc = incidentFromDb(row);
      const slaHours = Number(row.sla_hours || await getSlaHours() || 24);
      try {
        await sendIncidentEmail({ listing: listingFromDb(listing), incident: inc, appUrl: publicAppUrl(), includeEscalationCc:true, isEscalation:true });
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
  const cfg = await getAppConfig();
  const global = await isGlobalAdmin(uid, email);
  const enabledForAll = String(cfg.analytics_enabled || 'false') === 'true';
  if (!global && !enabledForAll) return res.status(403).json({ error:'Las analíticas están disponibles solo para administrador global.' });
  const now = new Date();
  const days = Math.max(1, Math.min(365, Number(req.query.days || 90)));
  const since = new Date(now.getTime() - days * 24 * 3600000).toISOString();
  const { data: incidentsRaw, error: incErr } = await supabase.from('incidents').select('*, listings(*)').gte('created_at', since).order('created_at', { ascending:false });
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
  res.json({ windowDays:days, generatedAt:now.toISOString(), summary:{ totalIncidents:incidents.length, openIncidents:active.length, verifiedIncidents:verified.length, resolvedIncidents:incidents.filter(i=>i.status==='resolved').length, breachedSla:breached.length, dueSoon24h:dueSoon.length, avgResponseHours:Number(avgResponseHours.toFixed(1)), maxResponseHours:Number(maxResponseHours.toFixed(1)), escalationCycles:incidents.reduce((sum,i)=>sum+Number(i.sla_cycle_count||0),0) }, breachRows, rankings:{ byApartment:toRank(aptCounts).slice(0,12), byOperator:toRank(operatorCounts).slice(0,12), byType:toRank(typeCounts), byCategory:toRank(categoryCounts), byStatus:toRank(statusCounts), byMonth:toRank(monthCounts).sort((a,b)=>a.name.localeCompare(b.name)) } });
};
app.get('/api/analytics', analyticsHandler);
app.get('/api/admin/analytics', analyticsHandler);

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
