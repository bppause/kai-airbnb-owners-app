// Capability keys declared by the incidents module.
// New format: namespaced "incidents:<verb>" — see docs/PLATFORM_ARCHITECTURE.md §5.
// Old flat keys (canResolveIncidents, canUpdateGlobalIncidents, canDeleteGlobalIncidents)
// remain in server.js helpers for now and are aliased to these during the
// migration window. Stage 4 will collapse them.

const PERMISSIONS = Object.freeze({
  RESOLVE: 'incidents:resolve',
  UPDATE: 'incidents:update',
  DELETE: 'incidents:delete',
  ASSIGN: 'incidents:assign',
});

const LEGACY_ALIASES = Object.freeze({
  canResolveIncidents: PERMISSIONS.RESOLVE,
  canUpdateGlobalIncidents: PERMISSIONS.UPDATE,
  canDeleteGlobalIncidents: PERMISSIONS.DELETE,
});

module.exports = { PERMISSIONS, LEGACY_ALIASES };
