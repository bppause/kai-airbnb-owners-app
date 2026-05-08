// Audit logs — admin-facing read API for the cross-module audit trail.
//
// Mounted by server.js at:
//   /api/platform/audit/logs    (canonical)
//   /api/admin/audit-logs       (legacy alias)
//
// The auditLog/auditEvent helpers (write side) currently live in server.js;
// they are passed into every module via deps. Moving the write helpers into
// this folder is deferred until a `core/` extraction stage so that all
// modules can import them directly. See docs/PLATFORM_ARCHITECTURE.md §11.

const express = require('express');

module.exports = function createAuditRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError,
    isGlobalAdmin, log,
  } = deps;

  const router = express.Router();

  // GET /logs            — global admin audit-log query (filter + paginate)
  router.get('/logs', async (req, res) => {
    log('[ADMIN] audit-logs requested by ' + String(req.query?.email || ''));
    if (!requireSupabaseEnv(res)) return;
    const { uid, email, entity, actor, dateFrom, dateTo, limit: limitParam, offset: offsetParam } = req.query || {};
    if (!(await isGlobalAdmin(uid, email))) return res.status(403).json({ error: 'Solo un administrador global puede ver los logs de auditoría.' });
    let query = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (entity && entity !== 'all') query = query.eq('entity', entity);
    if (actor) query = query.ilike('actor_email', `%${actor}%`);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59Z');
    const pageLimit = Math.min(parseInt(limitParam) || 50, 200);
    const pageOffset = parseInt(offsetParam) || 0;
    query = query.range(pageOffset, pageOffset + pageLimit - 1);
    const { data, error, count } = await query;
    if (error) return sendSupabaseError(res, error);
    res.json({ logs: data || [], total: count || 0 });
  });

  return router;
};
