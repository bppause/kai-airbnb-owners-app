// Pure frontend utilities — no React, no state, no API, no closure over App.jsx.
// Lifted byte-identical from App.jsx in stage F2.
//
// Browser-API helpers (compressImage uses FileReader + canvas) live here too;
// they're still pure functions that take inputs and return outputs without
// touching app state.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F2.

// ─── Phone / contact ─────────────────────────────────────────────────────────

// Replace existing dial-code prefix with a new one, keeping the subscriber digits.
export const applyDialCode = (current='', newCode='') => {
  const stripped = String(current || '').trim().replace(/^\+\d+\s*/, '');
  return newCode ? (newCode + (stripped ? ' ' + stripped : '')).trim() : stripped;
};

export const normalizePhoneForWhatsApp = (v='') => {
  const digits = String(v || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits : '';
};

export const validateWhatsApp = (v='', lang='es-CO') => {
  const raw = String(v || '').trim();
  if (!raw) return ''; // field is optional — blank is fine
  // Must start with + (country code required)
  if (!raw.startsWith('+')) return lang === 'en'
    ? 'Must start with + and country code — e.g. +57 300 000 0000 (Colombia)'
    : 'Debe comenzar con + y código de país — ej. +57 300 000 0000 (Colombia)';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 10) return lang === 'en'
    ? 'Number too short — include country code, e.g. +57 300 000 0000'
    : 'Número muy corto — incluya código de país, ej. +57 300 000 0000';
  return '';
};

export const validateEmail = (v='') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

// ─── JSON parsing ────────────────────────────────────────────────────────────

export const parseJsonObject = (v, fallback={}) => {
  try {
    return typeof v === 'string'
      ? JSON.parse(v || '{}')
      : (v && typeof v === 'object' ? v : fallback);
  } catch(e) { return fallback; }
};

// ─── SLA computation ─────────────────────────────────────────────────────────

// For an incident in `verified` status with no owner resolution yet, compute
// the SLA deadline + breach state. Returns null when SLA isn't applicable.
export const slaResInfo = (inc) => {
  if (inc.status !== 'verified' || String(inc.ownerResolution||'').trim()) return null;
  const verifiedAt = inc.ownerVerifiedAt ? new Date(inc.ownerVerifiedAt) : null;
  if (!verifiedAt) return null;
  const slaHours = inc.slaHours || 24;
  const deadline = new Date(verifiedAt.getTime() + slaHours * 3600000);
  const now = new Date();
  const hoursLeft = Math.round((deadline - now) / 3600000);
  return {
    deadline,
    isBreached: hoursLeft < 0,
    hoursLeft,          // negative = overdue
    cycleCount: inc.slaCycleCount || 0,
    slaHours,
  };
};

// ─── Image compression ───────────────────────────────────────────────────────

// Compress a File into a JPEG data URL bounded by ~500KB. Uses canvas.
export const compressImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) { reject(new Error('Only image files (JPEG, PNG, WebP, HEIC) are allowed.')); return; }
  if (file.size > 10 * 1024 * 1024) { reject(new Error('Image too large — max 10 MB before compression.')); return; }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.onload = (e) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not decode image'));
    img.onload = () => {
      const MAX_PX = 900;
      let {width, height} = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
        else { width = Math.round(width * MAX_PX / height); height = MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      let dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      // If still > 500 KB (base64 ~667 KB string) after first pass, compress harder
      if (dataUrl.length > 667 * 1024) dataUrl = canvas.toDataURL('image/jpeg', 0.38);
      resolve({ data: dataUrl, name: file.name, size: Math.round(dataUrl.length * 0.75) });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// ─── Bilingual literal helper ────────────────────────────────────────────────

// Tiny helper for help-topic objects with es+en strings; used heavily in
// HELP_TOPICS and similar config arrays.
export const HL = (es, en) => ({ es, en });

// ─── Floor / apartment helpers ───────────────────────────────────────────────

const FLOOR_PALETTE = ['#0b7f8c','#0b7f4f','#8a6a0a','#4a6fa5','#7a4a2a','#5a7a2a','#6a4a8a'];
export const floorColor = (f) => FLOOR_PALETTE[f % FLOOR_PALETTE.length];
export const getFloorNum = (apt) => Math.floor(parseInt(apt||'0')/100);

// ─── Owner-guests normalizer ─────────────────────────────────────────────────

// Accept either the structured `ownerGuests` array or the legacy flat
// `ownerGuestNames` / city / country fields and produce a uniform array of
// guest objects.
export const normalizeOwnerGuests = (incident={}) => {
  if (Array.isArray(incident.ownerGuests) && incident.ownerGuests.length) {
    return incident.ownerGuests.map(g => ({
      firstName: String(g.firstName || g.first_name || '').trim(),
      middleName: String(g.middleName || g.middle_name || '').trim(),
      lastName: String(g.lastName || g.last_name || '').trim(),
      city: String(g.city || '').trim(),
      state: String(g.state || '').trim(),
      country: String(g.country || '').trim(),
    })).filter(g => g.firstName || g.lastName || g.city || g.country);
  }
  if (incident.ownerGuestNames || incident.ownerGuestCity || incident.ownerGuestCountry) {
    return String(incident.ownerGuestNames || '').split(',').map(x => x.trim()).filter(Boolean).map(name => {
      const parts = name.split(/\s+/);
      return { firstName: parts[0] || name, middleName: parts.length > 2 ? parts.slice(1,-1).join(' ') : '', lastName: parts.length > 1 ? parts[parts.length-1] : '', city: incident.ownerGuestCity || '', state: '', country: incident.ownerGuestCountry || '' };
    });
  }
  return [];
};

export const guestFullName = (g={}) => [g.firstName, g.middleName, g.lastName].map(x=>String(x||'').trim()).filter(Boolean).join(' ');
// Location includes city, state (if present), and country
export const guestLocation = (g={}) => [g.city, g.state, g.country].map(x=>String(x||'').trim()).filter(Boolean).join(', ');

// ─── Date / time formatting (extracted in stage F7) ──────────────────────────

// "DD MMM YYYY" with Spanish month abbreviations.
// Accepts ISO date or "YYYY-MM-DD" strings.
export const fmtDate = d => {
  if (!d) return "";
  const [y, m, day] = String(d).split("T")[0].split("-");
  return `${parseInt(day)} ${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][parseInt(m)-1]} ${y}`;
};

// Locale-aware "DD MMM YYYY HH:MM" via toLocaleString.
export const fmtDateTime = (iso, lang='es-CO') => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(lang==='en'?'en-US':'es-CO',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch(e) { return String(iso).slice(0,16).replace('T',' '); }
};

// Today's date as "YYYY-MM-DD" (UTC).
export const today = () => new Date().toISOString().split("T")[0];
