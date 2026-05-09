// Platform meta — module manifest.
// Owns endpoints that don't belong to a feature module:
//   /api/client-log, /api/health, /api/version, /api/branding
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 4k.

const createRouter = require('./routes');

module.exports = {
  area: 'meta',
  name: 'Platform Meta',
  version: '1.0.0',
  createRouter,
};
