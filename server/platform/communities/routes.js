// Communities — platform-level tenant routes.
//
// A community is a single physical place (building, condo tower, gated
// neighborhood, resort, …) — see docs/PLATFORM_ARCHITECTURE.md §2.
//
// Mounted by server.js at:
//   /api/platform/communities/*    (canonical, includes admin/* sub-paths)
//   /api/communities/*             (legacy alias for member-facing reads/writes)
//   /api/admin/communities, /api/admin/communities/filter-options (URL-rewrite forwarders)
//   /api/me/communities (URL-rewrite forwarder → /me)
//
// Lifted verbatim from server.js stage 3e. 17 routes total covering CRUD,
// public listing, config overrides, memberships, and email-routing.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../../logger');

module.exports = function createCommunitiesRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError,
    isGlobalAdmin, isCommunityAdmin,
    getCommunity, getUserCommunities,
    getAppConfig, getAppPermissionsConfig, getEmailNotificationConfig,
    safeJsonObject, normalizeRecipients,
    getGlobalAdminEmails,
    auditLog,
    COMMUNITY_ADMIN_PERM_DEFAULTS, OVERRIDABLE_COMMUNITY_KEYS,
  } = deps;

  const router = express.Router();

  // GET /                            — caller's accessible communities (legacy /api/communities)
  router.get('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    try {
      const communities = await getUserCommunities(uid, email);
      res.json({ communities });
    } catch(e) { sendSupabaseError(res, e); }
  });

  // GET /admin/filter-options        — distinct city/state/country (global admin)
  router.get('/admin/filter-options', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error: 'Forbidden.' });
    try {
      const { data, error } = await supabase.from('communities').select('city,state,country').order('name');
      if (error) return sendSupabaseError(res, error);
      const rows = data || [];
      const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
      res.json({
        cities:    uniq(rows.map(r => r.city)),
        states:    uniq(rows.map(r => r.state)),
        countries: uniq(rows.map(r => r.country)),
      });
    } catch(e) { sendSupabaseError(res, e); }
  });

  // GET /admin                       — all communities (paginated/filtered) for global admin
  router.get('/admin', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email, q='', city='', state='', country='', active='', page='1', limit='20' } = req.query || {};
    if (!(await isGlobalAdmin(uid, email))) return res.json({ communities: [], total: 0 });
    try {
      let query = supabase.from('communities').select('*', { count: 'exact' }).order('name');
      if (q)       query = query.or(`name.ilike.%${q}%,id.ilike.%${q}%,name_en.ilike.%${q}%`);
      if (city)    query = query.ilike('city', `%${city}%`);
      if (state)   query = query.ilike('state', `%${state}%`);
      if (country) query = query.ilike('country', `%${country}%`);
      if (active === 'true')  query = query.eq('is_active', true);
      if (active === 'false') query = query.eq('is_active', false);
      const pageNum  = Math.max(1, parseInt(page)  || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
      query = query.range((pageNum - 1) * pageSize, pageNum * pageSize - 1);
      const { data, error, count } = await query;
      if (error) return sendSupabaseError(res, error);
      const communities = data || [];
      if (communities.length) {
        const { data: cfgRows } = await supabase.from('community_config')
          .select('community_id,value').eq('key', 'config_overrides_enabled')
          .in('community_id', communities.map(c => c.id));
        const overridesMap = {};
        (cfgRows || []).forEach(r => { overridesMap[r.community_id] = r.value === 'true'; });
        communities.forEach(c => { c.overridesEnabled = !!overridesMap[c.id]; });
      }
      res.json({ communities, total: count ?? communities.length });
    } catch(e) { sendSupabaseError(res, e); }
  });

  // POST /                           — create community (global admin)
  router.post('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, id, name, nameEn='', tower='', city='', state='', country='Colombia', logoUrl='', backgroundUrl='/morros-kai-bg.jpg', description='', descriptionEn='' } = req.body || {};
    if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede crear comunidades.' });
    if (!id || !name) return res.status(400).json({ error:'id and name are required.' });
    if (!/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ error:'Community id must be lowercase letters, numbers, and hyphens only.' });
    const row = { id, name, name_en:nameEn, tower, city, state, country, logo_url:logoUrl, background_url:backgroundUrl, description, description_en:descriptionEn, is_active:true, created_by_uid:actorUid||'', created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
    const { data, error } = await supabase.from('communities').insert(row).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'community', entityId:id, action:'create', actorUid:actorUid||'', actorEmail:actorEmail||'', after:data });
    res.json(data);
  });

  // GET /public                      — unauthenticated; for login picker
  router.get('/public', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    try {
      const cfg = await getAppConfig();
      const communityFeatureEnabled = cfg.community_feature_enabled !== 'false';
      const defaultCommunityId = cfg.default_community_id || 'kai';
      if (!communityFeatureEnabled) {
        return res.json({ communitiesEnabled: false, defaultCommunityId });
      }
      const { data, error } = await supabase
        .from('communities')
        .select('id,name,name_en,logo_url,background_url,city,country,tower')
        .eq('is_active', true)
        .order('name');
      if (error) return sendSupabaseError(res, error);
      res.json({ communitiesEnabled: true, communities: data || [], defaultCommunityId });
    } catch(e) { sendSupabaseError(res, e); }
  });

  // GET /me                          — caller's communities (legacy /api/me/communities)
  router.get('/me', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const uid = String(req.query.uid || '').trim();
    const email = String(req.query.email || '').trim();
    if (!uid && !email) return res.status(400).json({ error:'uid or email is required.' });
    try {
      const communities = await getUserCommunities(uid, email);
      res.json({ communities });
    } catch(e) { sendSupabaseError(res, e); }
  });

  // GET /:id                         — community detail
  router.get('/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { data, error } = await supabase.from('communities').select('*').eq('id', req.params.id).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!data) return res.status(404).json({ error:'Community not found.' });
    res.json(data);
  });

  // PUT /:id                         — update community
  router.put('/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, name, nameEn, tower, city, state, country, logoUrl, backgroundUrl, description, descriptionEn, isActive } = req.body || {};
    if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador global o admin de esta comunidad puede actualizar la comunidad.' });
    const before = await getCommunity(req.params.id);
    if (!before) return res.status(404).json({ error:'Community not found.' });
    const update = {};
    if (name !== undefined) update.name = String(name);
    if (nameEn !== undefined) update.name_en = String(nameEn);
    if (tower !== undefined) update.tower = String(tower);
    if (city !== undefined) update.city = String(city);
    if (state !== undefined) update.state = String(state);
    if (country !== undefined) update.country = String(country);
    if (logoUrl !== undefined) update.logo_url = String(logoUrl);
    if (backgroundUrl !== undefined) update.background_url = String(backgroundUrl);
    if (description !== undefined) update.description = String(description);
    if (descriptionEn !== undefined) update.description_en = String(descriptionEn);
    if (isActive !== undefined) update.is_active = Boolean(isActive);
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('communities').update(update).eq('id', req.params.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'community', entityId:req.params.id, action:'update', actorUid:actorUid||'', actorEmail:actorEmail||'', before, after:data });
    res.json(data);
  });

  // DELETE /:id                      — delete community (global admin; not "kai")
  router.delete('/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail } = req.body || {};
    if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Solo un administrador global puede eliminar comunidades.' });
    if (req.params.id === 'kai') return res.status(400).json({ error:'No se puede eliminar la comunidad predeterminada.' });
    const before = await getCommunity(req.params.id);
    if (!before) return res.status(404).json({ error:'Community not found.' });
    const { error } = await supabase.from('communities').delete().eq('id', req.params.id);
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'community', entityId:req.params.id, action:'delete', actorUid:actorUid||'', actorEmail:actorEmail||'', before });
    res.json({ ok:true });
  });

  // GET /:id/config                  — read community config overrides
  router.get('/:id/config', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    if (!(await isCommunityAdmin(uid, email, req.params.id))) return res.status(403).json({ error:'Community admin access required.' });
    const globalCfg = await getAppConfig();
    const { data: overrideRows } = await supabase.from('community_config')
      .select('key,value').eq('community_id', req.params.id);
    const communityOverrides = {};
    let overridesEnabled = false;
    (overrideRows||[]).forEach(r => {
      if (r.key === 'config_overrides_enabled') overridesEnabled = r.value === 'true';
      else if (OVERRIDABLE_COMMUNITY_KEYS.includes(r.key)) communityOverrides[r.key] = r.value;
    });
    const globalValues = {};
    OVERRIDABLE_COMMUNITY_KEYS.forEach(k => { globalValues[k] = globalCfg[k] || ''; });
    res.json({ globalValues, communityOverrides, overridesEnabled, overridableKeys: OVERRIDABLE_COMMUNITY_KEYS });
  });

  // PUT /:id/config                  — write community config overrides
  router.put('/:id/config', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, overrides } = req.body || {};
    const isGA = await isGlobalAdmin(actorUid, actorEmail);
    if (!isGA && !(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Forbidden.' });
    if (!isGA) {
      const { data: flagRow } = await supabase.from('community_config').select('value')
        .eq('community_id', req.params.id).eq('key','config_overrides_enabled').maybeSingle();
      if (flagRow?.value !== 'true') return res.status(403).json({ error:'Config overrides are not enabled for this community.' });
    }
    const allowedKeys = new Set(OVERRIDABLE_COMMUNITY_KEYS);
    for (const [key, value] of Object.entries(overrides || {})) {
      if (!allowedKeys.has(key)) continue;
      const strVal = typeof value === 'string' ? value : JSON.stringify(value);
      if (strVal === '') {
        await supabase.from('community_config').delete().eq('community_id', req.params.id).eq('key', key);
      } else {
        const { error: uErr } = await supabase.from('community_config').upsert(
          { community_id: req.params.id, key, value: strVal, updated_at: new Date().toISOString() },
          { onConflict: 'community_id,key' }
        );
        if (uErr) return sendSupabaseError(res, uErr);
      }
    }
    await auditLog({ entity:'community_config', entityId:req.params.id, action:'update_overrides', actorUid:actorUid||'', actorEmail:actorEmail||'', after:overrides });
    res.json({ ok:true });
  });

  // PUT /:id/config/overrides-enabled — toggle community-config-overrides flag (global admin)
  router.put('/:id/config/overrides-enabled', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, enabled } = req.body || {};
    if (!(await isGlobalAdmin(actorUid, actorEmail))) return res.status(403).json({ error:'Global admin only.' });
    const { error: upsertErr } = await supabase.from('community_config').upsert(
      { community_id: req.params.id, key: 'config_overrides_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
      { onConflict: 'community_id,key' }
    );
    if (upsertErr) return sendSupabaseError(res, upsertErr);
    await auditLog({ entity:'community_config', entityId:req.params.id, action:'set_overrides_enabled', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ enabled } });
    res.json({ ok:true });
  });

  // GET /:id/members                 — community members list (with admin overlay)
  router.get('/:id/members', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    if (!(await isCommunityAdmin(uid, email, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede ver los miembros de la comunidad.' });
    const { data: listings, error: lErr } = await supabase.from('listings').select('owner_uid,email,registration_id,created_at,apt,operator_whatsapp').eq('community_id', req.params.id).eq('status','approved').order('created_at', { ascending:true });
    if (lErr) return sendSupabaseError(res, lErr);
    const seen = new Set();
    const uniqueUsers = [];
    const ownerApts = {};
    for (const l of (listings||[])) {
      const key = l.owner_uid || l.email;
      if (!key) continue;
      if (l.apt) { if (!ownerApts[key]) ownerApts[key]=[]; ownerApts[key].push(l.apt); }
      if (!seen.has(key)) { seen.add(key); uniqueUsers.push(l); }
    }
    const { data: admins } = await supabase.from('community_memberships').select('*').eq('community_id', req.params.id);
    const adminMap = {};
    (admins||[]).forEach(a => { adminMap[a.user_uid] = a; });
    const uids = uniqueUsers.map(u => u.owner_uid).filter(Boolean);
    let userMap = {};
    if (uids.length) {
      const { data: appUsers } = await supabase.from('app_users').select('uid,name,language_preference,role,whatsapp').in('uid', uids);
      (appUsers||[]).forEach(u => { userMap[u.uid] = u; });
    }
    const globalAdminSet = new Set(getGlobalAdminEmails());
    const members = uniqueUsers.map(u => {
      const key = u.owner_uid || u.email;
      const communityAdminEntry = u.owner_uid ? adminMap[u.owner_uid] : null;
      const appUser = u.owner_uid ? userMap[u.owner_uid] : null;
      const memberEmail = (u.email || appUser?.email || '').toLowerCase();
      const isGlobalAdmin = !!(memberEmail && globalAdminSet.has(memberEmail));
      const platformRole = isGlobalAdmin ? 'global_admin' : (appUser?.role || 'user');
      return {
        userUid: u.owner_uid,
        userEmail: u.email,
        name: appUser?.name || '',
        whatsapp: appUser?.whatsapp || u.operator_whatsapp || '',
        apts: ownerApts[key] || [],
        languagePreference: appUser?.language_preference || 'es-CO',
        platformRole,
        joinedAt: u.created_at,
        isCommunityAdmin: !!communityAdminEntry,
        adminPermissions: communityAdminEntry ? safeJsonObject(communityAdminEntry.permissions, COMMUNITY_ADMIN_PERM_DEFAULTS) : COMMUNITY_ADMIN_PERM_DEFAULTS,
      };
    });
    res.json({ members });
  });

  // POST /:id/members/:uid/promote   — promote member to community admin
  router.post('/:id/members/:uid/promote', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, userEmail, permissions } = req.body || {};
    if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede promover miembros.' });
    if (!req.params.uid) return res.status(400).json({ error:'uid is required.' });
    const permsCfg = await getAppPermissionsConfig();
    const effectivePerms = safeJsonObject(permissions, permsCfg.defaultCommunityAdminPermissions);
    const row = { id:'mbr_'+uuidv4().slice(0,8), community_id:req.params.id, user_uid:req.params.uid, user_email:String(userEmail||'').toLowerCase(), role:'community_admin', permissions:effectivePerms, invited_by_uid:actorUid||'', joined_at:new Date().toISOString() };
    const { data, error } = await supabase.from('community_memberships').upsert(row, { onConflict:'community_id,user_uid' }).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'community_membership', entityId:req.params.id, action:'promote_admin', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ userUid:req.params.uid, userEmail } });
    res.json({ ok:true });
  });

  // DELETE /:id/members/:uid/promote — demote community admin
  router.delete('/:id/members/:uid/promote', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail } = req.body || {};
    if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede cambiar roles.' });
    const { error } = await supabase.from('community_memberships').delete().eq('community_id', req.params.id).eq('user_uid', req.params.uid);
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'community_membership', entityId:req.params.id, action:'demote_admin', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ demotedUid:req.params.uid } });
    res.json({ ok:true });
  });

  // PATCH /:id/members/:uid/permissions — update community-admin permissions
  router.patch('/:id/members/:uid/permissions', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, permissions } = req.body || {};
    if (!(await isCommunityAdmin(actorUid, actorEmail, req.params.id))) return res.status(403).json({ error:'Solo un administrador puede cambiar permisos.' });
    const perms = safeJsonObject(permissions, COMMUNITY_ADMIN_PERM_DEFAULTS);
    const { data, error } = await supabase.from('community_memberships').update({ permissions:perms }).eq('community_id', req.params.id).eq('user_uid', req.params.uid).select('*').single();
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity:'community_membership', entityId:req.params.id, action:'update_permissions', actorUid:actorUid||'', actorEmail:actorEmail||'', after:{ uid:req.params.uid, permissions:perms } });
    res.json({ ok:true, permissions:perms });
  });

  // GET /:id/email-routing           — global notif config + community CC overrides
  router.get('/:id/email-routing', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    const communityId = req.params.id;
    if (!(await isCommunityAdmin(uid, email, communityId))) return res.status(403).json({ error:'Community admin or global admin required.' });
    const globalConfig = await getEmailNotificationConfig();
    let communityRouting = {};
    try {
      const { data } = await supabase.from('community_config').select('value').eq('community_id', communityId).eq('key', 'community_email_routing').maybeSingle();
      if (data?.value) communityRouting = safeJsonObject(data.value, {});
    } catch(e) { warn('community email routing load failed: ' + (e?.message || e)); }
    res.json({ globalConfig, communityRouting, eventKeys: Object.keys(globalConfig) });
  });

  // PUT /:id/email-routing           — save CC overrides per event type
  router.put('/:id/email-routing', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { actorUid, actorEmail, routing } = req.body || {};
    const communityId = req.params.id;
    if (!(await isCommunityAdmin(actorUid, actorEmail, communityId))) return res.status(403).json({ error:'Community admin or global admin required.' });
    const globalAdmin = await isGlobalAdmin(actorUid, actorEmail);
    if (!globalAdmin) {
      const { data: oeRow } = await supabase.from('community_config').select('value').eq('community_id', communityId).eq('key', 'config_overrides_enabled').maybeSingle();
      if (oeRow?.value !== 'true') return res.status(403).json({ error:'Los overrides no están habilitados para esta comunidad.' });
    }
    if (!routing || typeof routing !== 'object') return res.status(400).json({ error:'routing object required.' });
    const sanitized = {};
    const globalConfig = await getEmailNotificationConfig();
    for (const [key, val] of Object.entries(routing)) {
      if (!globalConfig[key]) continue;
      const cc = normalizeRecipients(Array.isArray(val?.cc) ? val.cc : String(val?.cc || '').split(',').map(e=>e.trim()));
      if (cc.length) sanitized[key] = { cc };
    }
    await supabase.from('community_config').delete().eq('community_id', communityId).eq('key', 'community_email_routing');
    if (Object.keys(sanitized).length) {
      const { error } = await supabase.from('community_config').insert({ community_id:communityId, key:'community_email_routing', value:JSON.stringify(sanitized) });
      if (error) return sendSupabaseError(res, error);
    }
    await auditLog({ entity:'community_email_routing', entityId:communityId, action:'update', actorUid:actorUid||'', actorEmail:actorEmail||'', after:sanitized });
    res.json({ ok:true, communityRouting:sanitized });
  });

  return router;
};
