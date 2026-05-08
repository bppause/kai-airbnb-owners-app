// Notifications — platform module manifest.
// Cross-module: every module fans out into this table. See
// docs/PLATFORM_ARCHITECTURE.md §4.

const createRouter = require('./routes');

module.exports = {
  area: 'notifications',
  name: 'Notifications',
  version: '1.0.0',
  createRouter,
  auditEntities: ['platform.notification'],
};
