// Units (apartments) — platform module manifest.
// Platform-level (cross-module) entity. See docs/PLATFORM_ARCHITECTURE.md §4.

const createRouter = require('./routes');
const { PERMISSIONS, LEGACY_ALIASES } = require('./permissions');

module.exports = {
  area: 'units',
  name: 'Units (Apartments)',
  version: '1.0.0',
  createRouter,
  permissions: PERMISSIONS,
  legacyPermissionAliases: LEGACY_ALIASES,
  auditEntities: ['platform.unit'],
  legacyTable: 'listings', // DB column name today; rename in a later stage
};
