// Capability keys for the communities area.
// "Communities" are platform tenants — every module operates within a
// community. See docs/PLATFORM_ARCHITECTURE.md §2.

const PERMISSIONS = Object.freeze({
  CREATE: 'communities:create',
  UPDATE: 'communities:update',
  DELETE: 'communities:delete',
  MANAGE_MEMBERS: 'communities:manage-members',
  MANAGE_CONFIG: 'communities:manage-config',
});

module.exports = { PERMISSIONS };
