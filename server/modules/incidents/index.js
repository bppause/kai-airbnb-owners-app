// Incidents module manifest.
// See docs/PLATFORM_ARCHITECTURE.md §8.

'use strict';

const createRouter = require('./routes');
const { PERMISSIONS, LEGACY_ALIASES } = require('./permissions');

module.exports = {
  slug: 'incidents',
  name: 'Incident Management',
  version: '1.0.0',
  createRouter,
  permissions: PERMISSIONS,
  legacyPermissionAliases: LEGACY_ALIASES,
  auditEntities: ['incidents.incident'],
};
