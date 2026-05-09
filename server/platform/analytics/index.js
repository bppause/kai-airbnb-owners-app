// Analytics — platform module manifest.
// Cross-cutting: SLA breach dashboard, ranking views, quarterly community
// goals. See docs/platform/PLATFORM_ARCHITECTURE.md §4.

const createRouter = require('./routes');

module.exports = {
  area: 'analytics',
  name: 'Analytics',
  version: '1.0.0',
  createRouter,
};
