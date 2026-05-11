// Thin fetch wrapper for /api/m/tax/* endpoints.
// Errors throw with .status and .body attached so callers can branch on 4xx/5xx.

const BASE = '/api/m/tax';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch (_e) { parsed = { raw: text }; }
  if (!res.ok) {
    const err = new Error((parsed && parsed.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

export const taxApi = {
  getCommunity(slug) { return request('GET', `/community/${encodeURIComponent(slug)}`); },
  submitLead(payload) { return request('POST', '/leads', payload); },
};
