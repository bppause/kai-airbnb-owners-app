// Unit inventory module manifest.
// See docs/modules/unit-inventory/README.md and
// docs/platform/PLATFORM_ARCHITECTURE.md §8.

'use strict';

const createRouter = require('./routes');

module.exports = {
  slug: 'unit-inventory',
  name: 'Unit Inventory',
  version: '1.0.0',
  createRouter,
  permissions: {},
  auditEntities: ['unit_inventory'],
};
