// Audit helpers — write side of the cross-module audit trail.
//
// Two stores:
//   audit_logs            — generic platform audit (every module emits here)
//   listing_audit_events  — legacy per-listing audit trail (units/registrations)
//
// Lifted byte-identical from server.js stage 4b. Exposed as a factory so the
// supabase client doesn't have to be a global singleton — server.js builds
// these once at startup and passes the bound functions to modules via deps.
// Read side (admin GET /api/platform/audit/logs) lives in
// server/platform/audit/.

'use strict';

const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../logger');

module.exports = function createAuditHelpers(supabase) {
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

  return { auditEvent, auditLog };
};
