// Tax module manifest.
//
// Phase 1: public landing page + lead capture + product catalog read.
// Phase 2+: customer/employee/owner portals, document handling, workflows.
//
// Reuses the platform `communities` table as the multi-tenant boundary
// (a tax practice is `business_type='tax'`). Owns `tax_products` and
// `tax_leads`. See supabase/schema.sql v85 and CLAUDE.md.

'use strict';

const createRouter = require('./routes');
const { PERMISSIONS } = require('./permissions');

module.exports = {
  slug: 'tax',
  name: 'Tax Services',
  version: '0.1.0',
  createRouter,
  permissions: PERMISSIONS,
  auditEntities: ['tax.lead', 'tax.product'],
};
