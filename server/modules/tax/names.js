// Tax module — structured person-name helpers.
//
// Person records in the tax module store first_name / middle_name (optional)
// / last_name as the source of truth, plus a denormalized `name` column kept
// in sync with the parts so existing queries and templates keep working.
//
// Helpers:
//   parsePersonName(raw)     → { first, middle, last } from a free-text name
//   composePersonName(parts) → "First M Last" with title-case normalization
//   normalizeNameParts(p)    → trimmed + title-cased parts (length-capped)
//   titleCaseName(s)         → normalized casing for a single token
//   firstNameOf(person)      → display first name (parts-aware, falls back to
//                              parsing `name`)
//   displayNameOf(person)    → composed display name from parts; falls back
//                              to `name`, then email-localpart, then ''.

'use strict';

const MAX_PART_LEN = 80;

// Lowercase a value but preserve obviously mixed-case input — e.g. "McGarry",
// "O'Neil", "JoãoCarlos" — by only normalizing when the input is all-upper
// or all-lower (the common "shouty" / "lazy" cases).
function titleCaseName(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  const hasUpper = /[A-Z]/.test(v);
  const hasLower = /[a-z]/.test(v);
  if (hasUpper && hasLower) return v; // user-styled, leave alone
  const lower = v.toLowerCase();
  // Cap each space- or hyphen-separated token, including Mc/Mac and O' prefixes.
  return lower
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (_, ch) => 'Mc' + ch.toUpperCase())
    .replace(/\bMac(\p{L}\p{L})/gu, (_, ch) => 'Mac' + ch[0].toUpperCase() + ch.slice(1));
}

// Split a free-text name into parts. Conservative heuristics:
//   ""                → all blank
//   "Maya"            → first=Maya
//   "Martha Pause"    → first=Martha, last=Pause
//   "Martha J Pause"  → first=Martha, middle=J, last=Pause
//   "Maria Del Carmen Vega" → first=Maria, middle=Del Carmen, last=Vega
// Trailing parentheticals ("(test)") are stripped.
function parsePersonName(raw) {
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

function normalizeNameParts({ first, middle, last } = {}) {
  return {
    first:  titleCaseName(String(first  || '').slice(0, MAX_PART_LEN)),
    middle: titleCaseName(String(middle || '').slice(0, MAX_PART_LEN)),
    last:   titleCaseName(String(last   || '').slice(0, MAX_PART_LEN)),
  };
}

function composePersonName(parts) {
  const p = normalizeNameParts(parts || {});
  return [p.first, p.middle, p.last].filter(Boolean).join(' ');
}

// Resolve the first name for a person record. Prefers `first_name` when
// stored, falls back to parsing `name`. Returns '' if nothing usable.
function firstNameOf(person) {
  if (!person) return '';
  const stored = String(person.first_name || '').trim();
  if (stored) return stored;
  return parsePersonName(person.name).first;
}

// Resolve a display name for a person record. Composes parts when present,
// falls back to `name`, then the email localpart, then ''.
function displayNameOf(person) {
  if (!person) return '';
  const composed = composePersonName({
    first:  person.first_name,
    middle: person.middle_name,
    last:   person.last_name,
  });
  if (composed) return composed;
  const n = String(person.name || '').trim();
  if (n) return n;
  const email = String(person.email || '').trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return '';
}

// Given an HTTP payload that may carry either {firstName, middleName, lastName}
// or a legacy {name} (or both), produce a coherent {first, middle, last, name}
// quadruple ready to write to the row. If parts are sent they win; otherwise
// the legacy `name` is parsed.
function resolveNamePayload(body) {
  const hasParts = ['firstName', 'middleName', 'lastName']
    .some(k => Object.prototype.hasOwnProperty.call(body || {}, k));
  if (hasParts) {
    const parts = normalizeNameParts({
      first:  body.firstName,
      middle: body.middleName,
      last:   body.lastName,
    });
    return { ...parts, name: [parts.first, parts.middle, parts.last].filter(Boolean).join(' ') };
  }
  const raw = String((body && body.name) || '').trim();
  const parsed = normalizeNameParts(parsePersonName(raw));
  return { ...parsed, name: [parsed.first, parsed.middle, parsed.last].filter(Boolean).join(' ') };
}

module.exports = {
  titleCaseName,
  parsePersonName,
  normalizeNameParts,
  composePersonName,
  firstNameOf,
  displayNameOf,
  resolveNamePayload,
};
