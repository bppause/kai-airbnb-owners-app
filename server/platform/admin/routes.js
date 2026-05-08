// Admin — platform-level admin endpoints (cross-cutting):
//   GET  /me           — admin context (role, config, permissions, communities)
//   PUT  /config       — global admin config writer
//   GET  /users        — list all platform users with their memberships
//   POST /delegate     — assign delegate / global-admin role
//
// Mounted by server.js at:
//   /api/platform/admin/*    (canonical)
//
// Legacy alias forwarders cover:
//   /api/admin/me        → /api/platform/admin/me
//   /api/admin/config    → /api/platform/admin/config
//   /api/admin/users     → /api/platform/admin/users
//   /api/admin/delegate  → /api/platform/admin/delegate
//
// Lifted verbatim from server.js stage 3d.

const express = require('express');
const { warn } = require('../../../logger');

module.exports = function createAdminRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError,
    log,
    isGlobalAdmin, getUserRole, normalizeRole,
    getCommunityId, getAppConfig, getUserPermissions, getUserCommunities,
    getAppPermissionsConfig, hasCommunityAdminPerm,
    safeJsonObject, normalizeLanguage, normalizeRecipients,
    getGlobalAdminEmails, getApprovedUser,
    auditLog,
    DEFAULT_DELEGATE_PERMISSIONS, DEFAULT_STANDARD_MENU_PERMISSIONS, COMMUNITY_ADMIN_PERM_DEFAULTS,
  } = deps;

  const router = express.Router();

  // GET /me              — admin context bundle
  router.get('/me', async (req, res) => {
    log('[ADMIN] me requested by ' + String(req.query?.email || ''));
    if (!requireSupabaseEnv(res)) return;
    const uid = String(req.query.uid || '').trim();
    const email = String(req.query.email || '').trim().toLowerCase();
    const name = String(req.query.name || '').trim();
    const clientLang = normalizeLanguage(req.query.lang || 'es-CO');
    const role = await getUserRole({ uid, email });
    let languagePreference = clientLang;
    try {
      if (uid && email) {
        const { data: existing } = await supabase.from('app_users').select('language_preference').eq('uid', uid).maybeSingle();
        if (existing) {
          languagePreference = normalizeLanguage(existing.language_preference || clientLang);
          const row = { uid, email, name, updated_at: new Date().toISOString() };
          if (role === 'global_admin') row.role = 'global_admin';
          await supabase.from('app_users').update(row).eq('uid', uid);
        } else {
          languagePreference = clientLang;
          const row = { uid, email, name, language_preference: clientLang, updated_at: new Date().toISOString() };
          if (role === 'global_admin') row.role = 'global_admin';
          await supabase.from('app_users').insert(row);
        }
      }
    } catch(e) { warn('app_users upsert in /api/admin/me failed: ' + (e?.message || e)); }
    const communityId = getCommunityId(req);
    const config = await getAppConfig(communityId);
    const permissions = await getUserPermissions({ uid, email });
    const communities = await getUserCommunities(uid, email);
    let communityAdminOf = [];
    if (uid) {
      try {
        const { data: caMemberships } = await supabase.from('community_memberships')
          .select('community_id,permissions').eq('user_uid', uid).eq('role','community_admin');
        communityAdminOf = (caMemberships||[]).map(m => ({
          communityId: m.community_id,
          permissions: safeJsonObject(m.permissions, COMMUNITY_ADMIN_PERM_DEFAULTS)
        }));
      } catch(e) { communityAdminOf = []; }
    }
    const isCommunityAdminFlag = communityAdminOf.length > 0;
    const canManageRegs = role === 'global_admin' || !!permissions.delegate?.canApproveRegistrations ||
      await hasCommunityAdminPerm(uid, email, communityId, 'canApproveRegistrations');
    res.json({ role, isGlobalAdmin: role === 'global_admin', canManageRegistrations: canManageRegs, languagePreference, config, permissions, communityId, communities, communityAdminOf, isCommunityAdmin: isCommunityAdminFlag });
  });

  // PUT /config          — global admin config writer
  router.put('/config', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, slaHours, escalationCcEmails, analyticsEnabled, missionTitle, missionBody, missionTitleEs, missionBodyEs, missionTitleEn, missionBodyEn, missionSectionsEs, missionSectionsEn, standardMenuPermissions, defaultDelegatePermissions, communityAdminDefaultPermissions, tooltipsEs, tooltipsEn, uiLabelsEs, uiLabelsEn, complexNameEs, complexNameEn, complexLocation, complexLogo, complexBg, emailFromName, emailFromAddress, emailFromNameEn, emailFromAddressEn, nav_config, communityFeatureEnabled, defaultCommunityId, emailKillSwitch } = req.body || {};
    if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede cambiar la configuración.' });
    const before = await getAppConfig();
    const rows = [];
    if (slaHours !== undefined) rows.push({ key:'sla_hours', value:String(Math.max(1, Number(slaHours || 24))) });
    if (escalationCcEmails !== undefined) rows.push({ key:'escalation_cc_emails', value:normalizeRecipients(String(escalationCcEmails || '').split(',')).join(',') });
    if (analyticsEnabled !== undefined) rows.push({ key:'analytics_enabled', value:(analyticsEnabled === true || String(analyticsEnabled) === 'true') ? 'true' : 'false' });
    if (missionTitle !== undefined) rows.push({ key:'mission_title_es', value:String(missionTitle || '') });
    if (missionBody !== undefined) rows.push({ key:'mission_body_es', value:String(missionBody || '') });
    if (missionTitleEs !== undefined) rows.push({ key:'mission_title_es', value:String(missionTitleEs || '') });
    if (missionBodyEs !== undefined) rows.push({ key:'mission_body_es', value:String(missionBodyEs || '') });
    if (missionTitleEn !== undefined) rows.push({ key:'mission_title_en', value:String(missionTitleEn || '') });
    if (missionBodyEn !== undefined) rows.push({ key:'mission_body_en', value:String(missionBodyEn || '') });
    if (missionSectionsEs !== undefined) rows.push({ key:'mission_sections_es', value: typeof missionSectionsEs === 'string' ? missionSectionsEs : JSON.stringify(missionSectionsEs) });
    if (missionSectionsEn !== undefined) rows.push({ key:'mission_sections_en', value: typeof missionSectionsEn === 'string' ? missionSectionsEn : JSON.stringify(missionSectionsEn) });
    if (standardMenuPermissions !== undefined) rows.push({ key:'standard_menu_permissions', value: JSON.stringify(safeJsonObject(standardMenuPermissions, DEFAULT_STANDARD_MENU_PERMISSIONS)) });
    if (defaultDelegatePermissions !== undefined) rows.push({ key:'default_delegate_permissions', value: JSON.stringify(safeJsonObject(defaultDelegatePermissions, DEFAULT_DELEGATE_PERMISSIONS)) });
    if (communityAdminDefaultPermissions !== undefined) rows.push({ key:'default_community_admin_permissions', value: JSON.stringify(safeJsonObject(communityAdminDefaultPermissions, COMMUNITY_ADMIN_PERM_DEFAULTS)) });
    if (tooltipsEs !== undefined) rows.push({ key:'tooltips_es', value: typeof tooltipsEs === 'string' ? tooltipsEs : JSON.stringify(safeJsonObject(tooltipsEs, {})) });
    if (tooltipsEn !== undefined) rows.push({ key:'tooltips_en', value: typeof tooltipsEn === 'string' ? tooltipsEn : JSON.stringify(safeJsonObject(tooltipsEn, {})) });
    if (uiLabelsEs !== undefined) rows.push({ key:'ui_labels_es', value: typeof uiLabelsEs === 'string' ? uiLabelsEs : JSON.stringify(safeJsonObject(uiLabelsEs, {})) });
    if (uiLabelsEn !== undefined) rows.push({ key:'ui_labels_en', value: typeof uiLabelsEn === 'string' ? uiLabelsEn : JSON.stringify(safeJsonObject(uiLabelsEn, {})) });
    if (complexNameEs !== undefined) rows.push({ key:'complex_name_es', value:String(complexNameEs||'') });
    if (complexNameEn !== undefined) rows.push({ key:'complex_name_en', value:String(complexNameEn||'') });
    if (complexLocation !== undefined) rows.push({ key:'complex_location', value:String(complexLocation||'') });
    if (complexLogo !== undefined) rows.push({ key:'complex_logo', value:String(complexLogo||'') });
    if (complexBg !== undefined) rows.push({ key:'complex_bg', value:String(complexBg||'') });
    if (emailFromName !== undefined) rows.push({ key:'email_from_name', value:String(emailFromName||'') });
    if (emailFromAddress !== undefined) rows.push({ key:'email_from_address', value:String(emailFromAddress||'').toLowerCase().trim() });
    if (emailFromNameEn !== undefined) rows.push({ key:'email_from_name_en', value:String(emailFromNameEn||'') });
    if (emailFromAddressEn !== undefined) rows.push({ key:'email_from_address_en', value:String(emailFromAddressEn||'').toLowerCase().trim() });
    if (nav_config !== undefined) rows.push({ key:'nav_config', value: typeof nav_config === 'string' ? nav_config : JSON.stringify(safeJsonObject(nav_config, {})) });
    if (communityFeatureEnabled !== undefined) rows.push({ key:'community_feature_enabled', value: communityFeatureEnabled === true || String(communityFeatureEnabled) === 'true' ? 'true' : 'false' });
    if (defaultCommunityId !== undefined) rows.push({ key:'default_community_id', value: String(defaultCommunityId||'kai') });
    if (emailKillSwitch !== undefined) rows.push({ key:'email_kill_switch', value: emailKillSwitch === true || String(emailKillSwitch) === 'true' ? 'true' : 'false' });
    for (const row of rows) {
      const { error } = await supabase.from('app_config').upsert(row, { onConflict:'key' });
      if (error) return sendSupabaseError(res, error);
    }
    const after = await getAppConfig();
    await auditLog({ entity:'app_config', entityId:'global', action:'update', actorUid, actorEmail, before, after });
    res.json({ ok:true, config: after });
  });

  // GET /users           — list all platform users with memberships
  router.get('/users', async (req, res) => {
    log('[ADMIN] users requested by ' + String(req.query?.email || ''));
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error:'Solo un administrador global puede ver usuarios.' });
    const { data: rows, error } = await supabase.from('app_users').select('*').order('email', { ascending:true });
    if (error) return sendSupabaseError(res, error);
    const { data: approvedListings, error: lerr } = await supabase.from('listings').select('owner_uid,community_id').eq('status','approved');
    if (lerr) return sendSupabaseError(res, lerr);
    const approved = new Set((approvedListings || []).map(x => x.owner_uid).filter(Boolean));
    const communityByUid = {};
    (approvedListings||[]).forEach(l => { if(l.owner_uid && l.community_id) { if(!communityByUid[l.owner_uid]) communityByUid[l.owner_uid]=[]; if(!communityByUid[l.owner_uid].includes(l.community_id)) communityByUid[l.owner_uid].push(l.community_id); } });
    const globalEmails = getGlobalAdminEmails();
    const permsCfg = await getAppPermissionsConfig();
    const { data: memberships } = await supabase.from('community_memberships').select('user_uid,community_id,role,permissions');
    const { data: communityRows } = await supabase.from('communities').select('id,name,name_en');
    const communityNameMap = {};
    (communityRows||[]).forEach(c => { communityNameMap[c.id] = { name:c.name, nameEn:c.name_en||c.name }; });
    const membershipByUid = {};
    (memberships||[]).forEach(m => {
      if (!membershipByUid[m.user_uid]) membershipByUid[m.user_uid] = [];
      membershipByUid[m.user_uid].push({ communityId:m.community_id, role:m.role, permissions:safeJsonObject(m.permissions, COMMUNITY_ADMIN_PERM_DEFAULTS), communityName:communityNameMap[m.community_id]?.name||m.community_id, communityNameEn:communityNameMap[m.community_id]?.nameEn||m.community_id });
    });
    const users = (rows || []).filter(u => approved.has(u.uid) || globalEmails.includes(String(u.email || '').trim().toLowerCase())).map(u => {
      const envGlobal = globalEmails.includes(String(u.email || '').trim().toLowerCase());
      const role = envGlobal ? 'global_admin' : normalizeRole(u.role || 'user');
      const storedPerms = safeJsonObject(u.permissions, {});
      const permissions = role === 'global_admin'
        ? { ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:true, canDeleteGlobalListings:true, canUpdateGlobalIncidents:true, canDeleteGlobalIncidents:true }
        : role === 'delegate_admin' ? { ...permsCfg.defaultDelegatePermissions, ...storedPerms } : {};
      const communityMemberships = membershipByUid[u.uid] || [];
      return { uid:u.uid, email:u.email, name:u.name || '', role, permissions, languagePreference:u.language_preference || 'es-CO', approved: approved.has(u.uid), envGlobal, communityMemberships, communityIds: communityByUid[u.uid] || [] };
    });
    res.json({ users, standardMenuPermissions: permsCfg.standardMenuPermissions, defaultDelegatePermissions: permsCfg.defaultDelegatePermissions, defaultCommunityAdminPermissions: permsCfg.defaultCommunityAdminPermissions });
  });

  // POST /delegate       — assign delegate or global_admin role
  router.post('/delegate', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, uid, email, name, role, permissions } = req.body || {};
    if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede delegar administradores.' });
    if (!uid || !email || !['user','delegate_admin','global_admin'].includes(role)) return res.status(400).json({ error:'uid, email and role are required.' });
    if (role === 'delegate_admin' || role === 'global_admin') {
      const approved = await getApprovedUser(uid);
      if (!approved && role !== 'global_admin') return res.status(400).json({ error:'Solo usuarios registrados y aprobados pueden ser delegados para aprobar/rechazar registros.' });
    }
    const beforeRole = await getUserRole({ uid, email });
    const normalizedPermissions = role === 'delegate_admin' ? safeJsonObject(permissions, DEFAULT_DELEGATE_PERMISSIONS) : {};
    const { error } = await supabase.from('app_users').upsert({ uid, email:String(email).toLowerCase(), name:name||'', role, permissions: normalizedPermissions, updated_at:new Date().toISOString() }, { onConflict:'uid' });
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'user_role', entityId:uid, action:'delegate_update', actorUid, actorEmail, before:{ role: beforeRole }, after:{ uid, email, name, role, permissions: normalizedPermissions } });
    res.json({ ok:true });
  });

  return router;
};
