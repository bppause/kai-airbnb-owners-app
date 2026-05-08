// Admin — platform module manifest.
// Cross-cutting global-admin endpoints (admin context, app config, user
// management, role delegation). The naming is "admin" because that's how
// the legacy URL space named them (/api/admin/*); long-term this folder
// could split into app-config/ and user-admin/. See
// docs/PLATFORM_ARCHITECTURE.md §4.

const createRouter = require('./routes');

module.exports = {
  area: 'admin',
  name: 'Platform Admin',
  version: '1.0.0',
  createRouter,
};
