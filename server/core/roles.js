// Role / permission resolution + small lookup helpers that depend on
// supabase + app_config. Lifted byte-identical from server.js stage 4d.
//
// Public exports (returned by the factory):
//   constants — DEFAULT_DELEGATE_PERMISSIONS, DEFAULT_STANDARD_MENU_PERMISSIONS,
//               COMMUNITY_ADMIN_PERM_DEFAULTS
//   role helpers — getUserRole, isGlobalAdmin, isCommunityAdmin,
//                  hasCommunityAdminPerm, canManageRegistrations
//   permission helpers — getUserPermissions, hasDelegatePermission,
//                        canUpdateGlobalListing, canDeleteGlobalListing,
//                        canUpdateGlobalIncident, canDeleteGlobalIncident,
//                        getAppPermissionsConfig, getDelegateAdminsWithPermission
//   community lookups — getCommunity, getCommunityAdminEmails,
//                       getCommunityEscalationEmails, getUserCommunities
//   user lookups — getApprovedUser, getReporterEmail, getReporterName
//   env helpers — getGlobalAdminEmails, isEnvGlobalAdminEmail
//
// The factory takes the supabase client and two server-scope getters
// (getAppConfig, getEscalationCcEmails) which are kept in server.js
// because they overlap with general app configuration. Stage 4e will
// push those into core/config.js too.
//
// See docs/PLATFORM_ARCHITECTURE.md §11.

'use strict';

const { warn } = require('../../logger');
const { safeJsonObject, normalizeRecipients, normalizeRole } = require('./utils');

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_DELEGATE_PERMISSIONS = {
  canApproveRegistrations: true,
  canResolveIncidents: true,
  canUpdateGlobalListings: false,
  canDeleteGlobalListings: false,
  canUpdateGlobalIncidents: false,
  canDeleteGlobalIncidents: false
};

const DEFAULT_STANDARD_MENU_PERMISSIONS = {
  dashboard: true,
  listings: true,
  incidents: true,
  notifications: true,
  about: true,
  my: true,
  analytics: false
};

const COMMUNITY_ADMIN_PERM_DEFAULTS = { canApproveRegistrations:true, canResolveIncidents:true, canManageListings:false };

// ─── Env-driven global admin readers (stateless; safe to expose directly) ────
const getGlobalAdminEmails = () => String(process.env.GLOBAL_ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAILS || '').split(',').map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
const isEnvGlobalAdminEmail = (email='') => getGlobalAdminEmails().includes(String(email || '').trim().toLowerCase());

module.exports = function createRoleHelpers({ supabase, getAppConfig, getEscalationCcEmails }) {
  const getAppPermissionsConfig = async () => {
    const cfg = await getAppConfig();
    return {
      standardMenuPermissions: safeJsonObject(cfg.standard_menu_permissions, DEFAULT_STANDARD_MENU_PERMISSIONS),
      defaultDelegatePermissions: safeJsonObject(cfg.default_delegate_permissions, DEFAULT_DELEGATE_PERMISSIONS),
      defaultCommunityAdminPermissions: safeJsonObject(cfg.default_community_admin_permissions, COMMUNITY_ADMIN_PERM_DEFAULTS)
    };
  };

  const getUserPermissions = async ({ uid='', email='' }={}) => {
    const role = await getUserRole({ uid, email });
    const cfg = await getAppPermissionsConfig();
    let row = null;
    if (uid) {
      try { const { data } = await supabase.from('app_users').select('permissions').eq('uid', uid).maybeSingle(); row = data || null; } catch(e) {}
    }
    const stored = safeJsonObject(row?.permissions, {});
    if (role === 'global_admin') {
      return { role, menu: Object.fromEntries(Object.keys(DEFAULT_STANDARD_MENU_PERMISSIONS).map(k => [k, true])), delegate: { canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:true, canDeleteGlobalListings:true, canUpdateGlobalIncidents:true, canDeleteGlobalIncidents:true } };
    }
    if (role === 'delegate_admin') {
      return { role, menu: { ...cfg.standardMenuPermissions, approvals:true }, delegate: { ...cfg.defaultDelegatePermissions, ...stored } };
    }
    return { role, menu: { ...cfg.standardMenuPermissions }, delegate: { ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false } };
  };

  const hasDelegatePermission = async (uid, email, permission) => {
    const perms = await getUserPermissions({ uid, email });
    return perms.role === 'global_admin' || !!perms.delegate?.[permission];
  };

  const canUpdateGlobalListing = async (uid, email) => hasDelegatePermission(uid, email, 'canUpdateGlobalListings');
  const canDeleteGlobalListing = async (uid, email) => hasDelegatePermission(uid, email, 'canDeleteGlobalListings');
  const canUpdateGlobalIncident = async (uid, email) => hasDelegatePermission(uid, email, 'canUpdateGlobalIncidents');
  const canDeleteGlobalIncident = async (uid, email) => hasDelegatePermission(uid, email, 'canDeleteGlobalIncidents');

  const getDelegateAdminsWithPermission = async (permission) => {
    try {
      const { data, error } = await supabase.from('app_users').select('email,permissions').eq('role', 'delegate_admin');
      if (error || !data) return [];
      const cfg = await getAppPermissionsConfig();
      return normalizeRecipients(
        data.filter(u => {
          const stored = safeJsonObject(u.permissions, {});
          const effective = { ...cfg.defaultDelegatePermissions, ...stored };
          return !!effective[permission];
        }).map(u => u.email)
      );
    } catch(e) { warn('getDelegateAdminsWithPermission failed: ' + (e?.message || e)); return []; }
  };

  const getUserRole = async ({ uid='', email='' } = {}) => {
    const em = String(email || '').trim().toLowerCase();
    if (em && isEnvGlobalAdminEmail(em)) return 'global_admin';
    try {
      let q = supabase.from('app_users').select('role,email').limit(1);
      if (uid) q = q.eq('uid', uid); else if (em) q = q.eq('email', em); else return 'user';
      const { data, error } = await q.maybeSingle();
      if (!error && data?.role) return data.role;
    } catch(e) { warn('Role lookup failed: ' + (e?.message || e)); }
    return 'user';
  };

  const canManageRegistrations = async (uid, email='', communityId='kai') =>
    (await getUserRole({uid,email})) === 'global_admin' ||
    await hasDelegatePermission(uid, email, 'canApproveRegistrations') ||
    await hasCommunityAdminPerm(uid, email, communityId, 'canApproveRegistrations');

  const isGlobalAdmin = async (uid, email='') => (await getUserRole({uid,email})) === 'global_admin';

  const getCommunity = async (communityId='kai') => {
    try {
      const { data } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle();
      return data || null;
    } catch(e) { warn('getCommunity failed: ' + (e?.message || e)); return null; }
  };

  const getCommunityAdminEmails = async (communityId='kai') => {
    try {
      const { data } = await supabase.from('community_memberships').select('user_email').eq('community_id', communityId).eq('role','community_admin');
      return normalizeRecipients((data||[]).map(r=>r.user_email));
    } catch(e) { return []; }
  };

  const getCommunityEscalationEmails = async (communityId='kai') => {
    const admins = await getCommunityAdminEmails(communityId);
    if (admins.length) return admins;
    return getEscalationCcEmails();
  };

  const isCommunityAdmin = async (uid='', email='', communityId='kai') => {
    const role = await getUserRole({ uid, email });
    if (role === 'global_admin') return true;
    if (!uid) return false;
    try {
      const { data } = await supabase.from('community_memberships').select('role').eq('community_id', communityId).eq('user_uid', uid).maybeSingle();
      return data?.role === 'community_admin';
    } catch(e) { return false; }
  };

  const hasCommunityAdminPerm = async (uid='', email='', communityId='kai', permKey='') => {
    if (!uid && !email) return false;
    try {
      let q = supabase.from('community_memberships').select('role,permissions').eq('community_id', communityId).eq('role','community_admin');
      if (uid) q = q.eq('user_uid', uid);
      else q = q.eq('user_email', String(email).trim().toLowerCase());
      const { data } = await q.maybeSingle();
      if (!data) return false;
      const perms = safeJsonObject(data.permissions, {});
      return !!(perms[permKey] ?? COMMUNITY_ADMIN_PERM_DEFAULTS[permKey] ?? false);
    } catch(e) { return false; }
  };

  const getUserCommunities = async (uid='', email='') => {
    const role = await getUserRole({ uid, email });
    if (role === 'global_admin') {
      try {
        const { data } = await supabase.from('communities').select('*').order('name');
        return data || [];
      } catch(e) { return []; }
    }
    if (!uid) return [];
    try {
      const { data: listings } = await supabase.from('listings').select('community_id').eq('user_uid', uid).eq('status', 'approved');
      const approvedCommunityIds = [...new Set((listings||[]).map(l => l.community_id).filter(Boolean))];
      const { data: memberships } = await supabase.from('community_memberships').select('community_id, role').eq('user_uid', uid);
      const adminCommunityIds = (memberships||[]).map(m => m.community_id).filter(Boolean);
      const allCommunityIds = [...new Set([...approvedCommunityIds, ...adminCommunityIds])];
      if (!allCommunityIds.length) return [];
      const { data: communities } = await supabase.from('communities').select('*').in('id', allCommunityIds).eq('is_active', true).order('name');
      return (communities||[]).map(c => {
        const membership = (memberships||[]).find(m => m.community_id === c.id);
        return { ...c, memberRole: membership?.role || 'member' };
      });
    } catch(e) { return []; }
  };

  const getApprovedUser = async (uid) => {
    const { data, error } = await supabase.from('listings').select('*').eq('owner_uid', uid).eq('status','approved').order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  };

  const getReporterEmail = async (reporterUid='') => {
    if (!reporterUid) return '';
    try {
      const { data } = await supabase.from('app_users').select('email').eq('uid', reporterUid).maybeSingle();
      return String(data?.email || '').trim().toLowerCase();
    } catch(e) { return ''; }
  };

  const getReporterName = async (reporterUid='') => {
    if (!reporterUid) return '';
    try {
      const { data } = await supabase.from('app_users').select('name').eq('uid', reporterUid).maybeSingle();
      return String(data?.name || '').trim();
    } catch(e) { return ''; }
  };

  return {
    // constants
    DEFAULT_DELEGATE_PERMISSIONS,
    DEFAULT_STANDARD_MENU_PERMISSIONS,
    COMMUNITY_ADMIN_PERM_DEFAULTS,
    // role + permission helpers
    getUserRole, isGlobalAdmin, isCommunityAdmin, hasCommunityAdminPerm, canManageRegistrations,
    getUserPermissions, hasDelegatePermission,
    canUpdateGlobalListing, canDeleteGlobalListing, canUpdateGlobalIncident, canDeleteGlobalIncident,
    getAppPermissionsConfig, getDelegateAdminsWithPermission,
    // community lookups
    getCommunity, getCommunityAdminEmails, getCommunityEscalationEmails, getUserCommunities,
    // user lookups
    getApprovedUser, getReporterEmail, getReporterName,
    // env helpers
    getGlobalAdminEmails, isEnvGlobalAdminEmail,
    // re-exported for callers that want the unwrapped version
    normalizeRole,
  };
};

// Also expose the constants and env helpers as top-level imports so callers
// who don't need the supabase-bound helpers can avoid the factory.
module.exports.DEFAULT_DELEGATE_PERMISSIONS = DEFAULT_DELEGATE_PERMISSIONS;
module.exports.DEFAULT_STANDARD_MENU_PERMISSIONS = DEFAULT_STANDARD_MENU_PERMISSIONS;
module.exports.COMMUNITY_ADMIN_PERM_DEFAULTS = COMMUNITY_ADMIN_PERM_DEFAULTS;
module.exports.getGlobalAdminEmails = getGlobalAdminEmails;
module.exports.isEnvGlobalAdminEmail = isEnvGlobalAdminEmail;
