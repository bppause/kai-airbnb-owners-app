// Tax module — client-side helpers for structured person names.
//
// Mirrors server/modules/tax/names.js so we can fall back to parsing
// `name` for older payloads that haven't been backfilled yet.

export function titleCaseName(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  const hasUpper = /[A-Z]/.test(v);
  const hasLower = /[a-z]/.test(v);
  if (hasUpper && hasLower) return v;
  const lower = v.toLowerCase();
  return lower
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (_, ch) => 'Mc' + ch.toUpperCase());
}

export function parsePersonName(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return { first: '', middle: '', last: '' };
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

// Display name for a person record. Prefers stored parts, falls back to
// `name`, then the email localpart. Title-cases shouty values.
export function displayPersonName(p) {
  if (!p) return '';
  const parts = [p.first_name, p.middle_name, p.last_name]
    .map(s => titleCaseName(String(s || '').trim()))
    .filter(Boolean);
  if (parts.length) return parts.join(' ');
  const n = titleCaseName(String(p.name || '').trim());
  if (n) return n;
  const email = String(p.email || '').trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return '';
}

// Display name OR email if no name parts at all (common in lists).
export function displayPersonNameOrEmail(p) {
  return displayPersonName(p) || String(p?.email || '').trim();
}

// First name for greetings ("Hi {{firstName}}"). Returns '' when nothing
// usable is available; callers can fall back to a localized "there".
export function firstNameOf(p) {
  if (!p) return '';
  const stored = titleCaseName(String(p.first_name || '').trim());
  if (stored) return stored;
  return titleCaseName(parsePersonName(p.name).first);
}
