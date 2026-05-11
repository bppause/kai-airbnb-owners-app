// Thin fetch wrapper for /api/m/tax/* endpoints.
// Errors throw with .status and .body attached so callers can branch on 4xx/5xx.
//
// Portal calls take an `auth` object { uid, email, communitySlug } that
// becomes x-firebase-uid, x-firebase-email, x-tax-community headers. The
// server validates these against tax_customers on every request.

const BASE = '/api/m/tax';

function authHeaders(auth) {
  if (!auth || !auth.uid || !auth.email) return {};
  return {
    'x-firebase-uid': auth.uid,
    'x-firebase-email': auth.email,
    'x-tax-community': auth.communitySlug || '',
  };
}

// Phase 4a: owner-admin calls also need an x-admin-email header so the
// legacy /admin/* endpoints (still on requireGlobalAdmin) accept the call.
// The new endpoints accept either path via requireOwnerAdmin; sending the
// extra header is harmless on those too.
function adminAuthHeaders(auth) {
  return {
    ...authHeaders(auth),
    'x-admin-email': auth?.adminEmail || auth?.email || '',
  };
}

async function request(method, path, body, auth, { admin } = {}) {
  const headers = admin ? adminAuthHeaders(auth) : authHeaders(auth);
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  // Public (Phase 1 + 1.5)
  getCommunity(slug)              { return request('GET',  `/community/${encodeURIComponent(slug)}`); },
  submitLead(payload)             { return request('POST', '/leads', payload); },
  getResponse(token)              { return request('GET',  `/respond/${encodeURIComponent(token)}`); },
  submitResponse(token, payload)  { return request('POST', `/respond/${encodeURIComponent(token)}`, payload); },

  // Portal (Phase 2a) — `auth = { uid, email, communitySlug }`
  authLink(payload)               { return request('POST', '/auth/link', payload); },
  getMe(auth)                     { return request('GET',  '/portal/me', undefined, auth); },
  getFilings(auth)                { return request('GET',  '/portal/filings', undefined, auth); },
  getFiling(auth, id)             { return request('GET',  `/portal/filings/${encodeURIComponent(id)}`, undefined, auth); },
  submitFiling(auth, id, payload) { return request('POST', `/portal/filings/${encodeURIComponent(id)}/respond`, payload, auth); },
  getNotifications(auth)          { return request('GET',  '/portal/notifications', undefined, auth); },
  markNotificationRead(auth, id)  { return request('POST', `/portal/notifications/${encodeURIComponent(id)}/read`, {}, auth); },
  updatePreferences(auth, payload){ return request('PUT',  '/portal/preferences', payload, auth); },
  updateProfile(auth, payload)    { return request('PUT',  '/portal/profile', payload, auth); },

  // Portal (Phase 2b) — relationships + FAQs
  getRelationships(auth)          { return request('GET',  '/portal/relationships', undefined, auth); },
  getFaqs(auth)                   { return request('GET',  '/portal/faqs', undefined, auth); },

  // Portal (Phase 2c) — relationship-tailored tips
  getTips(auth)                   { return request('GET',  '/portal/tips', undefined, auth); },

  // Portal + employee (Phase 4c) — help center
  getHelp(auth)                   { return request('GET',  '/portal/help', undefined, auth); },
  getEmployeeHelp(auth)           { return request('GET',  '/employee/help', undefined, auth); },

  // Portal (Phase 2f) — messaging
  getThreads(auth)                              { return request('GET',  '/portal/threads', undefined, auth); },
  createThread(auth, payload)                   { return request('POST', '/portal/threads', payload, auth); },
  getThread(auth, id)                           { return request('GET',  `/portal/threads/${encodeURIComponent(id)}`, undefined, auth); },
  postMessage(auth, id, payload)                { return request('POST', `/portal/threads/${encodeURIComponent(id)}/messages`, payload, auth); },
  markThreadRead(auth, id)                      { return request('POST', `/portal/threads/${encodeURIComponent(id)}/read`, {}, auth); },

  // Portal (Phase 2d) — customer documents
  getDocuments(auth)                            { return request('GET',  '/portal/documents', undefined, auth); },
  createDocumentUploadUrl(auth, payload)        { return request('POST', '/portal/documents/upload-url', payload, auth); },
  finalizeDocumentUpload(auth, id)              { return request('POST', `/portal/documents/${encodeURIComponent(id)}/finalize`, {}, auth); },
  getDocumentDownloadUrl(auth, id)              { return request('GET',  `/portal/documents/${encodeURIComponent(id)}/download-url`, undefined, auth); },
  deleteDocument(auth, id)                      { return request('DELETE', `/portal/documents/${encodeURIComponent(id)}`, undefined, auth); },

  // Employee portal (Phase 3) — `auth = { uid, email, communitySlug }`
  employeeAuthLink(payload)                     { return request('POST', '/employee/auth/link', payload); },
  getEmployeeMe(auth)                           { return request('GET',  '/employee/me', undefined, auth); },
  updateEmployeeProfile(auth, payload)          { return request('PUT',  '/employee/profile', payload, auth); },
  getEmployeeThreads(auth)                      { return request('GET',  '/employee/threads', undefined, auth); },
  getEmployeeThread(auth, id)                   { return request('GET',  `/employee/threads/${encodeURIComponent(id)}`, undefined, auth); },
  postEmployeeMessage(auth, id, payload)        { return request('POST', `/employee/threads/${encodeURIComponent(id)}/messages`, payload, auth); },
  markEmployeeThreadRead(auth, id)              { return request('POST', `/employee/threads/${encodeURIComponent(id)}/read`, {}, auth); },
  getEmployeeNotifications(auth)                { return request('GET',  '/employee/notifications', undefined, auth); },
  markEmployeeNotificationRead(auth, id)        { return request('POST', `/employee/notifications/${encodeURIComponent(id)}/read`, {}, auth); },

  // Owner-admin (Phase 4a) — all admin endpoints. Pass auth =
  // { uid, email, communitySlug, adminEmail }. adminEmail is the address
  // that should match GLOBAL_ADMIN_EMAILS (legacy endpoints); when omitted
  // we fall back to auth.email.
  adminListCustomers(auth, communitySlug)       { return request('GET',  `/admin/customers?communitySlug=${encodeURIComponent(communitySlug)}`, undefined, auth, { admin: true }); },
  adminCreateCustomer(auth, payload)            { return request('POST', '/admin/customers', payload, auth, { admin: true }); },
  adminGetCustomer(auth, id)                    { return request('GET',  `/admin/customers/${encodeURIComponent(id)}`, undefined, auth, { admin: true }); },

  adminListRelationshipTypes(auth)              { return request('GET',  '/admin/relationship-types', undefined, auth, { admin: true }); },
  adminListCustomerRelationships(auth, customerId) { return request('GET', `/admin/customers/${encodeURIComponent(customerId)}/relationships`, undefined, auth, { admin: true }); },
  adminAddCustomerRelationship(auth, customerId, payload) { return request('POST', `/admin/customers/${encodeURIComponent(customerId)}/relationships`, payload, auth, { admin: true }); },
  adminRemoveCustomerRelationship(auth, customerId, relId) { return request('DELETE', `/admin/customers/${encodeURIComponent(customerId)}/relationships/${encodeURIComponent(relId)}`, undefined, auth, { admin: true }); },

  adminListCustomerDocuments(auth, customerId)  { return request('GET', `/admin/customers/${encodeURIComponent(customerId)}/documents`, undefined, auth, { admin: true }); },
  adminCustomerDocumentUploadUrl(auth, customerId, payload) { return request('POST', `/admin/customers/${encodeURIComponent(customerId)}/documents/upload-url`, payload, auth, { admin: true }); },
  adminFinalizeDocument(auth, docId)            { return request('POST', `/admin/documents/${encodeURIComponent(docId)}/finalize`, {}, auth, { admin: true }); },
  adminGetDocumentDownloadUrl(auth, docId)      { return request('GET',  `/admin/documents/${encodeURIComponent(docId)}/download-url`, undefined, auth, { admin: true }); },
  adminDeleteDocument(auth, docId)              { return request('DELETE', `/admin/documents/${encodeURIComponent(docId)}`, undefined, auth, { admin: true }); },

  adminListEmployees(auth, communitySlug)       { return request('GET',  `/admin/employees?communitySlug=${encodeURIComponent(communitySlug)}`, undefined, auth, { admin: true }); },
  adminCreateEmployee(auth, payload)            { return request('POST', '/admin/employees', payload, auth, { admin: true }); },

  adminListEmployeeAssignments(auth, empId)     { return request('GET', `/admin/employees/${encodeURIComponent(empId)}/assignments`, undefined, auth, { admin: true }); },
  adminAddEmployeeAssignment(auth, empId, payload) { return request('POST', `/admin/employees/${encodeURIComponent(empId)}/assignments`, payload, auth, { admin: true }); },
  adminRemoveEmployeeAssignment(auth, empId, customerId) { return request('DELETE', `/admin/employees/${encodeURIComponent(empId)}/assignments/${encodeURIComponent(customerId)}`, undefined, auth, { admin: true }); },
  adminListCustomerAssignments(auth, customerId) { return request('GET', `/admin/customers/${encodeURIComponent(customerId)}/assignments`, undefined, auth, { admin: true }); },

  // Phase 4b — subscriptions, leads, community settings
  adminGetCommunitySettings(auth, communitySlug) { return request('GET',  `/admin/community-settings?communitySlug=${encodeURIComponent(communitySlug)}`, undefined, auth, { admin: true }); },
  adminSetNotifLock(auth, payload)               { return request('PUT',  '/admin/community-settings/notif-lock', payload, auth, { admin: true }); },

  adminListProducts(auth, communitySlug)         { return request('GET',  `/admin/products?communitySlug=${encodeURIComponent(communitySlug)}`, undefined, auth, { admin: true }); },
  adminAddSubscription(auth, customerId, payload){ return request('POST', `/admin/customers/${encodeURIComponent(customerId)}/subscriptions`, payload, auth, { admin: true }); },
  adminUpdateSubscription(auth, subId, payload)  { return request('PUT',  `/admin/subscriptions/${encodeURIComponent(subId)}`, payload, auth, { admin: true }); },
  adminCancelSubscription(auth, subId)           { return request('DELETE', `/admin/subscriptions/${encodeURIComponent(subId)}`, undefined, auth, { admin: true }); },

  adminListLeads(auth, communitySlug, opts = {}) {
    const qs = new URLSearchParams({ communitySlug });
    if (opts.status) qs.set('status', opts.status);
    return request('GET',  `/admin/leads?${qs.toString()}`, undefined, auth, { admin: true });
  },
  adminUpdateLead(auth, leadId, payload)         { return request('PUT',  `/admin/leads/${encodeURIComponent(leadId)}`, payload, auth, { admin: true }); },
};
