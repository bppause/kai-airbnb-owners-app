// Registrations — platform module manifest.
// See docs/platform/PLATFORM_ARCHITECTURE.md §4.

const createRouter = require('./routes');
const { PERMISSIONS, LEGACY_ALIASES } = require('./permissions');

module.exports = {
  area: 'registrations',
  name: 'Registrations',
  version: '1.0.0',
  createRouter,
  permissions: PERMISSIONS,
  legacyPermissionAliases: LEGACY_ALIASES,
  auditEntities: ['platform.registration'],
};
