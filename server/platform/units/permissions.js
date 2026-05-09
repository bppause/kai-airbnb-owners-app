// Capability keys for the units (apartments) area.
// "Units" is the platform-level term (a unit lives in a community). The DB
// column is currently `listings`; rename will land in a later stage. See
// docs/platform/PLATFORM_ARCHITECTURE.md §4 and §11.

const PERMISSIONS = Object.freeze({
  MANAGE: 'units:manage',
  UPDATE: 'units:update',
  DELETE: 'units:delete',
});

const LEGACY_ALIASES = Object.freeze({
  canManageListings: PERMISSIONS.MANAGE,
  canUpdateGlobalListings: PERMISSIONS.UPDATE,
  canDeleteGlobalListings: PERMISSIONS.DELETE,
});

module.exports = { PERMISSIONS, LEGACY_ALIASES };
