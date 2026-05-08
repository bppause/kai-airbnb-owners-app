// Pure utilities — no DB, no I/O, no closures over server-scope state.
// Lifted byte-identical from server.js stage 4a. Safe to require from any
// module without dep injection. See docs/PLATFORM_ARCHITECTURE.md §11.

'use strict';

function safeJsonObject(v, fallback={}) {
  if (!v) return { ...fallback };
  if (typeof v === 'object' && !Array.isArray(v)) return { ...fallback, ...v };
  try { const o = JSON.parse(String(v)); return (o && typeof o === 'object' && !Array.isArray(o)) ? { ...fallback, ...o } : { ...fallback }; } catch(e) { return { ...fallback }; }
}

function normalizeRole(role='user') { return ['user','delegate_admin','global_admin'].includes(role) ? role : 'user'; }

const normalizeRecipients = (emails) => [...new Set((Array.isArray(emails) ? emails : [emails]).map(e => String(e || '').trim()).filter(Boolean).map(e => e.toLowerCase()))];

const escapeHtml = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');

const publicAppUrl = (req) => (process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || (req ? `${req.protocol}://${req.get('host')}` : '')).replace(/\/$/, '');

const normalizeLanguage = (language='es-CO') => String(language || 'es-CO').toLowerCase().startsWith('en') ? 'en' : 'es-CO';

const addHoursIso = (iso, hours) => new Date(new Date(iso).getTime() + Number(hours || 24)*3600000).toISOString();

const normalizeApt = (apt) => String(apt || '').trim();

const isThreeDigitApt = (apt) => /^[0-9]{3}$/.test(String(apt || '').trim());
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
const isValidOptionalUrl = (url) => !String(url || '').trim() || /^https?:\/\/.+/i.test(String(url || '').trim());
const isValidWhatsApp = (v) => { const raw = String(v || '').trim(); if (!raw) return true; return raw.startsWith('+') && raw.replace(/[^0-9]/g, '').length >= 10; };

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

const validateListingInput = (l) => {
  if (!l || !l.apt || !l.rooms || !l.guests) return 'Apartamento, habitaciones y huéspedes son requeridos.';
  if (!isThreeDigitApt(l.apt)) return 'El apartamento debe tener exactamente 3 dígitos. Ejemplo: 000.';
  if ((l.operatorEmail || l.operator_email) && !isValidEmail(l.operatorEmail || l.operator_email)) return 'Ingrese un email válido para el operador.';
  if (!isValidOptionalUrl(l.airbnb)) return 'El URL de Airbnb debe comenzar con http:// o https:// cuando se ingrese.';
  return '';
};

module.exports = {
  safeJsonObject,
  normalizeRole,
  normalizeRecipients,
  escapeHtml,
  publicAppUrl,
  normalizeLanguage,
  addHoursIso,
  normalizeApt,
  isThreeDigitApt,
  isValidEmail,
  isValidOptionalUrl,
  isValidWhatsApp,
  parseCoOwners,
  validateListingInput,
};
