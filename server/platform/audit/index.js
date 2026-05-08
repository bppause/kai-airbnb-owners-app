// Audit — platform module manifest.
// See docs/PLATFORM_ARCHITECTURE.md §4 and §9.

const createRouter = require('./routes');

module.exports = {
  area: 'audit',
  name: 'Audit Logs',
  version: '1.0.0',
  createRouter,
};
