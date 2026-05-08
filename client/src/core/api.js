// Frontend API client. All fetch calls flow through here so:
//   - the X-Community-Id request header is always set,
//   - non-2xx responses + JSON error bodies become rejected promises with
//     readable messages, and
//   - long Render cold starts have a generous timeout (35s).
//
// Lifted byte-identical from App.jsx in stage F3. The community-id
// initialization (URL ?community= → localStorage → 'kai') was previously a
// module-scope IIFE in App.jsx; it now lives inside this module, with a
// getter/setter that App.jsx uses to read or update the active community.
//
// Path-style note: routes are still the legacy paths the SPA has always
// used (/api/incidents, /api/listings, …). The server keeps URL-rewrite
// aliases for those; the future "switch to canonical /api/platform/*"
// migration is a single-file change here when ready.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F3.

let _communityId = (() => {
  try {
    const urlCid = new URLSearchParams(window.location.search).get('community');
    if (urlCid) { localStorage.setItem('kai_community', urlCid); return urlCid; }
    return localStorage.getItem('kai_community') || 'kai';
  } catch(e) { return 'kai'; }
})();

export const getCommunityId = () => _communityId;

// Update the in-memory community used for X-Community-Id headers. Callers
// decide whether to persist to localStorage; this setter only updates the
// in-memory value (matches the prior App.jsx behavior where some call sites
// wrote to localStorage and others didn't).
export const setCommunityId = (id) => { _communityId = id; };

const fetchT = (url, opts={}, ms=35000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  const headers = { ...(opts.headers||{}), 'X-Community-Id': _communityId };
  return fetch(url, { ...opts, headers, signal: ctrl.signal }).finally(() => clearTimeout(id));
};

const parseResponse = async (r) => {
  const raw = await r.text().catch(() => '');
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch(e) { data = { raw }; }
  if (!r.ok || data?.error) {
    const msg = data?.error || data?.message || raw || `Request failed: ${r.status}`;
    const err = new Error(msg);
    err.status = r.status; err.details = data; err.url = r.url;
    console.error('[KAI_API_ERROR]', { url:r.url, status:r.status, msg, data });
    throw err;
  }
  return data;
};

export const api = {
  get:   (p)    => fetchT(p).then(parseResponse),
  post:  (p, b) => fetchT(p, { method:'POST',   headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }).then(parseResponse),
  put:   (p, b) => fetchT(p, { method:'PUT',    headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }).then(parseResponse),
  patch: (p, b) => fetchT(p, { method:'PATCH',  headers:{'Content-Type':'application/json'}, body:JSON.stringify(b||{}) }).then(parseResponse),
  del:   (p, b) => fetchT(p, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }).then(parseResponse),
};

export const checkApartmentUnique = ({ apt, ownerUid, excludeListingId='' }) => {
  const q = new URLSearchParams({ apt:String(apt||'').trim(), ownerUid:String(ownerUid||''), excludeListingId:String(excludeListingId||'') });
  return api.get('/api/apartments/check?' + q.toString());
};
