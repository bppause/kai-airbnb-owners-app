// Analytics + community-goals routes.
//
// Mounted by server.js at:
//   /api/platform/analytics/        (canonical — global admin / SLA dashboard)
//   /api/platform/analytics/goals/:id (canonical — quarterly community goals)
//
// Legacy alias forwarders (URL rewrite in server.js) cover:
//   /api/analytics                  → /
//   /api/admin/analytics            → /
//   /api/communities/:id/goals      → /goals/:id
//
// Lifted byte-identical from server.js stage 4h.

'use strict';

const express = require('express');
const { warn } = require('../../../logger');

module.exports = function createAnalyticsRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError, getCommunityId,
    isGlobalAdmin, isCommunityAdmin,
    getAppConfig,
  } = deps;

  const router = express.Router();

  // GET /                         — global admin analytics / SLA breach dashboard
  router.get('/', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { uid, email } = req.query || {};
    const communityId = getCommunityId(req);
    const cfg = await getAppConfig(communityId);
    const global = await isGlobalAdmin(uid, email);
    const enabledForAll = String(cfg.analytics_enabled || 'false') === 'true';
    if (!global && !enabledForAll) return res.status(403).json({ error:'Las analíticas están disponibles solo para administrador global.' });
    const now = new Date();
    const daysParam = String(req.query.days || '90').trim();
    const startParam = String(req.query.start || '').trim();
    const endParam   = String(req.query.end   || '').trim();

    let since = null;
    let until = null;
    let windowLabel = `${daysParam} days`;

    if (startParam && endParam) {
      const s = new Date(startParam); const e = new Date(endParam + 'T23:59:59.999Z');
      if (!isNaN(s.getTime())) since = s.toISOString();
      if (!isNaN(e.getTime())) until = e.toISOString();
      windowLabel = `${startParam} – ${endParam}`;
    } else if (daysParam === 'all') {
      since = null; until = null; windowLabel = 'all time';
    } else {
      const days = Math.max(1, Math.min(3650, Number(daysParam) || 90));
      since = new Date(now.getTime() - days * 24 * 3600000).toISOString();
      windowLabel = `${days} days`;
    }

    let q = supabase.from('incidents').select('*, listings(*)').eq('community_id', communityId).order('created_at', { ascending:false });
    if (since) q = q.gte('created_at', since);
    if (until) q = q.lte('created_at', until);
    const { data: incidentsRaw, error: incErr } = await q;
    if (incErr) return sendSupabaseError(res, incErr);
    const incidents = incidentsRaw || [];
    const active = incidents.filter(i => !['verified','resolved'].includes(i.status));
    const breached = active.filter(i => i.next_sla_reminder_at && new Date(i.next_sla_reminder_at) <= now);
    const dueSoon = active.filter(i => i.next_sla_reminder_at && new Date(i.next_sla_reminder_at) > now && new Date(i.next_sla_reminder_at) <= new Date(now.getTime()+24*3600000));
    const verified = incidents.filter(i => i.status === 'verified' && i.owner_verified_at && i.created_at);
    const responseHours = verified.map(i => (new Date(i.owner_verified_at) - new Date(i.created_at)) / 3600000).filter(v => Number.isFinite(v) && v >= 0);
    const avgResponseHours = responseHours.length ? responseHours.reduce((a,b)=>a+b,0)/responseHours.length : 0;
    const maxResponseHours = responseHours.length ? Math.max(...responseHours) : 0;
    const countBy = (arr, fn) => arr.reduce((acc, x) => { const k = fn(x) || 'Sin dato'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const toRank = (obj) => Object.entries(obj).map(([name,count]) => ({ name, count })).sort((a,b)=>b.count-a.count);
    const typeCounts = countBy(incidents, i => i.type || 'other');
    const categoryCounts = countBy(incidents, i => i.category || 'minor');
    const statusCounts = countBy(incidents, i => i.status || 'open');
    const aptCounts = countBy(incidents, i => i.listings?.apt || String(i.apt_label || '').replace(/[^0-9]/g,'') || 'Sin apto');
    const operatorCounts = countBy(incidents, i => i.listings?.operator || 'Sin operador');
    const monthCounts = countBy(incidents, i => String(i.created_at || '').slice(0,7));
    const breachRows = breached.map(i => { const listing = i.listings || {}; const hoursOverdue = i.next_sla_reminder_at ? Math.max(0, (now - new Date(i.next_sla_reminder_at))/3600000) : 0; return { id:i.id, apt:listing.apt || String(i.apt_label || '').replace(/[^0-9]/g,'') || '', owner:listing.owner || '', ownerEmail:listing.user_email || '', listingEmail:listing.email || '', operator:listing.operator || '', operatorEmail:listing.operator_email || '', status:i.status, type:i.type, category:i.category, createdAt:i.created_at, incidentDate:i.incident_date, nextSlaReminderAt:i.next_sla_reminder_at, slaHours:i.sla_hours || 24, slaCycleCount:i.sla_cycle_count || 0, hoursOverdue:Number(hoursOverdue.toFixed(1)), description:i.description || '' }; }).sort((a,b)=>b.hoursOverdue-a.hoursOverdue);
    res.json({ windowDays: daysParam, windowLabel, startDate: since, endDate: until, generatedAt:now.toISOString(), summary:{ totalIncidents:incidents.length, openIncidents:active.length, verifiedIncidents:verified.length, resolvedIncidents:incidents.filter(i=>i.status==='resolved').length, breachedSla:breached.length, dueSoon24h:dueSoon.length, avgResponseHours:Number(avgResponseHours.toFixed(1)), maxResponseHours:Number(maxResponseHours.toFixed(1)), escalationCycles:incidents.reduce((sum,i)=>sum+Number(i.sla_cycle_count||0),0) }, breachRows, rankings:{ byApartment:toRank(aptCounts).slice(0,12), byOperator:toRank(operatorCounts).slice(0,12), byType:toRank(typeCounts), byCategory:toRank(categoryCounts), byStatus:toRank(statusCounts), byMonth:toRank(monthCounts).sort((a,b)=>a.name.localeCompare(b.name)) } });
  });

  // GET /goals/:id                — quarterly engagement + resolution metrics
  router.get('/goals/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const cid = req.params.id;
    const { uid, email } = req.query;
    // Accessible to any authenticated member (community admins and global admins)
    const authed = await isGlobalAdmin(uid, email) || await isCommunityAdmin(uid, email, cid);
    // Standard users can see their own community's goals too (public stats)
    // so we just require a valid uid/community pairing
    try {
      const now = new Date();
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
      const [allRes, qRes, membersRes] = await Promise.all([
        supabase.from('incidents').select('id,status,created_at,resolved_at,sla_hours').eq('community_id', cid).not('is_general','eq',true),
        supabase.from('incidents').select('id,status,created_at,resolved_at,sla_hours').eq('community_id', cid).not('is_general','eq',true).gte('created_at', qStart),
        supabase.from('listings').select('owner_uid').eq('community_id', cid).eq('status','approved'),
      ]);
      const qInc = qRes.data || [];
      const allInc = allRes.data || [];
      const totalQ = qInc.length;
      const resolvedQ = qInc.filter(i => i.status === 'resolved').length;

      const withinSla = qInc.filter(i => {
        if (i.status !== 'resolved' || !i.resolved_at) return false;
        const slaMs = (i.sla_hours || 72) * 3600000;
        return (new Date(i.resolved_at) - new Date(i.created_at)) <= slaMs;
      }).length;

      const openPastSla = qInc.filter(i => {
        if (i.status === 'resolved') return false;
        const slaMs = (i.sla_hours || 72) * 3600000;
        return (Date.now() - new Date(i.created_at)) > slaMs;
      }).length;

      const resolutionRate = totalQ > 0 ? Math.round((resolvedQ / totalQ) * 100) : null;
      const slaRate = resolvedQ > 0 ? Math.round((withinSla / resolvedQ) * 100) : null;
      const goalTarget = 90; // 90% resolution rate goal
      const uniqueOwners = new Set((membersRes.data||[]).map(r => r.owner_uid).filter(Boolean)).size;

      const uniqueReporters = new Set(qInc.map(i => i.reporter_uid).filter(Boolean)).size;
      const engagementRate = uniqueOwners > 0 ? Math.round((uniqueReporters / uniqueOwners) * 100) : null;

      res.json({
        quarterStart: qStart,
        totalQ, resolvedQ, withinSla, openPastSla,
        resolutionRate, slaRate, goalTarget,
        goalMet: resolutionRate !== null && resolutionRate >= goalTarget,
        allTimeResolved: allInc.filter(i => i.status === 'resolved').length,
        allTimeTotal: allInc.length,
        memberCount: uniqueOwners,
        engagementRate,
        uniqueReporters,
      });
    } catch(e) { warn('Goals calc failed: ' + (e?.message || e)); res.status(500).json({ error: e?.message || String(e) }); }
  });

  return router;
};
