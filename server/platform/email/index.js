// Email — platform module manifest.
// Owns the admin-facing email surface: template editor, notification routing
// config, contact-form. The actual send helpers (sendTemplatedEmail etc.)
// stay in server.js for now and are passed into modules via deps. See
// docs/platform/PLATFORM_ARCHITECTURE.md §4.

const createRouter = require('./routes');

module.exports = {
  area: 'email',
  name: 'Email',
  version: '1.0.0',
  createRouter,
  auditEntities: ['platform.email_templates', 'platform.contact_email'],
};
