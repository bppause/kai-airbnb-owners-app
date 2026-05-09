// Communities — platform module manifest.
// A community is a single physical place; every module operates within one.
// See docs/platform/PLATFORM_ARCHITECTURE.md §2 and §4.

const createRouter = require('./routes');
const { PERMISSIONS } = require('./permissions');

module.exports = {
  area: 'communities',
  name: 'Communities',
  version: '1.0.0',
  createRouter,
  permissions: PERMISSIONS,
  auditEntities: ['platform.community', 'platform.community_config', 'platform.community_membership', 'platform.community_email_routing'],
};
