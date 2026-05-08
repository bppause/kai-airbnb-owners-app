// Users — platform module manifest.
// Owns the end-user side of `app_users`: profile, language preference,
// reputation score. Admin-side user management lives in
// server/platform/admin/. See docs/PLATFORM_ARCHITECTURE.md §4.

const createRouter = require('./routes');

module.exports = {
  area: 'users',
  name: 'Users',
  version: '1.0.0',
  createRouter,
  auditEntities: ['platform.user'],
};
