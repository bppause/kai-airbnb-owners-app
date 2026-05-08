// Small HTTP/request helpers — pure functions, no I/O, no closures over
// server-scope state. Lifted byte-identical from server.js stage 4i.
//
// Public exports:
//   getCommunityId   — read the active community from the request (header or
//                      query param, defaulting to 'kai').
//   sendSupabaseError — Supabase error → JSON response with message+details
//                      flattened, plus stderr log for Render.

'use strict';

const getCommunityId = (req) => {
  const val = String(req?.headers?.['x-community-id'] || req?.query?.communityId || '').trim().toLowerCase();
  return val || 'kai';
};

const sendSupabaseError = (res, error, status = 500) => {
  console.error('Supabase error:', error);
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  return res.status(status).json({ error: parts.join(' | ') || 'Supabase error' });
};

module.exports = { getCommunityId, sendSupabaseError };
