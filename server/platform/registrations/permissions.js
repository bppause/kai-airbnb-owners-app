// Capability keys for registrations (community-membership applications).
// See docs/platform/PLATFORM_ARCHITECTURE.md §5.

const PERMISSIONS = Object.freeze({
  APPROVE: 'registrations:approve',
  DECLINE: 'registrations:decline',
});

const LEGACY_ALIASES = Object.freeze({
  canApproveRegistrations: PERMISSIONS.APPROVE,
});

module.exports = { PERMISSIONS, LEGACY_ALIASES };
