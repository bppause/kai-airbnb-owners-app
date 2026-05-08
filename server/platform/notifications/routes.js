// Notifications — platform-level cross-module notification fan-out.
//
// Mounted by server.js at:
//   /api/platform/notifications/*    (canonical)
//   /api/notifications/*             (legacy alias)
//
// Lifted verbatim from server.js stage 3c.

const express = require('express');

module.exports = function createNotificationsRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
    notificationFromDb,
  } = deps;

  const router = express.Router();

  // GET /                — current user's notifications in the active community
  router.get('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const ownerUid = String(req.query.ownerUid || '').trim();
    const communityId = getCommunityId(req);
    if (!ownerUid) return res.status(400).json({ error: 'ownerUid is required.' });
    const { data, error } = await supabase.from('notifications').select('*').eq('community_id', communityId).eq('owner_uid', ownerUid).order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    res.json((data || []).map(notificationFromDb));
  });

  // PATCH /:id/read       — mark one notification read
  router.patch('/:id/read', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid } = req.body || {};
    if (!ownerUid) return res.status(400).json({ error: 'ownerUid is required.' });
    const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('owner_uid', ownerUid).select('*').single();
    if (error) return sendSupabaseError(res, error);
    res.json(notificationFromDb(data));
  });

  // PATCH /read-all       — mark all caller's notifications read
  router.patch('/read-all', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid } = req.body || {};
    if (!ownerUid) return res.status(400).json({ error: 'ownerUid is required.' });
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('owner_uid', ownerUid).eq('is_read', false);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  return router;
};
