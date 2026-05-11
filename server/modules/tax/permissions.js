// Capability keys for the tax module.
// Phase 1 declares the owner/employee permissions even though the
// portals don't exist yet — keeps the namespace stable for Phase 2+.

const PERMISSIONS = Object.freeze({
  LEADS_VIEW: 'tax:leads:view',
  LEADS_MANAGE: 'tax:leads:manage',
  PRODUCTS_MANAGE: 'tax:products:manage',
  ENGAGEMENTS_VIEW: 'tax:engagements:view',
  ENGAGEMENTS_ASSIGN: 'tax:engagements:assign',
});

module.exports = { PERMISSIONS };
