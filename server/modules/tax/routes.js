// Tax module — HTTP routes.
//
// Mounted at /api/m/tax/* from server/index.js.
//
// Phase 1 endpoints:
//   GET  /community/:slug          — public; community branding + enabled products for the landing page
//   POST /leads                    — public; anonymous contact-form submission
//   GET  /leads                    — owner-only (deferred to Phase 4); returns 501 for now
//
// Phase 1.5 endpoints (compliance reminders):
//   GET  /respond/:token           — public; verify magic-link token, return period info + checklist
//   POST /respond/:token           — public; accept customer response, mark info_received
//   POST /admin/cron/run           — global-admin; run one reminder cron cycle
//   GET  /admin/customers          — global-admin; list tax customers + subscriptions for a community
//
// Phase 2+ will add: /auth/*, /engagements/*, /documents/*, /messages/*, /products/*.

'use strict';

const crypto = require('crypto');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../../logger');
const { isValidEmail, normalizeLanguage } = require('../../core/utils');

const TAX_BUSINESS_TYPE = 'tax';
const MAX_TEXT_LEN = 4000;
const MAX_NAME_LEN = 200;
const MAX_PHONE_LEN = 40;
const MAX_TOKEN_LEN = 64;

const trim = (v, max) => String(v || '').trim().slice(0, max);
const localeOf = (v) => (normalizeLanguage(v) === 'en' ? 'en' : 'es');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

module.exports = function createTaxRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError,
    auditLog,
    sendTaxLeadEmail,
    isGlobalAdmin,
    runReminderCron,
  } = deps;

  const router = express.Router();

  // Admin gate: requires `x-admin-email` header that matches GLOBAL_ADMIN_EMAILS.
  // Phase 4a replaces this with full session auth + per-tenant owner role.
  const requireGlobalAdmin = (req, res) => {
    const email = trim(req.get('x-admin-email') || req.query.adminEmail || '', 200).toLowerCase();
    if (typeof isGlobalAdmin === 'function' && isGlobalAdmin(email)) return email;
    res.status(403).json({ error: 'Admin authentication required.' });
    return null;
  };

  // ── GET /community/:slug ────────────────────────────────────────────────────
  router.get('/community/:slug', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const slug = trim(req.params.slug, 200);
    if (!slug) return res.status(400).json({ error: 'Community slug required.' });

    const { data: community, error: cErr } = await supabase
      .from('communities')
      .select('*')
      .eq('id', slug)
      .eq('business_type', TAX_BUSINESS_TYPE)
      .maybeSingle();
    if (cErr) return sendSupabaseError(res, cErr);
    if (!community) return res.status(404).json({ error: 'Tax community not found.' });

    const { data: products, error: pErr } = await supabase
      .from('tax_products')
      .select('id, slug, category, enabled, display_order, name_i18n, description_i18n, icon')
      .eq('community_id', slug)
      .eq('enabled', true)
      .order('display_order', { ascending: true });
    if (pErr) return sendSupabaseError(res, pErr);

    res.json({ community, products: products || [] });
  });

  // ── POST /leads ─────────────────────────────────────────────────────────────
  router.post('/leads', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const body = req.body || {};
    const communitySlug = trim(body.communitySlug, 200);
    const name = trim(body.name, MAX_NAME_LEN);
    const email = trim(body.email, MAX_NAME_LEN).toLowerCase();
    const phone = trim(body.phone, MAX_PHONE_LEN);
    const productSlug = trim(body.productSlug, 200);
    const message = trim(body.message, MAX_TEXT_LEN);
    const preferredLocale = localeOf(body.locale);
    const userAgent = trim(req.get('user-agent') || '', 500);
    const ip = trim((req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0], 80);

    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });

    // Honeypot — bots fill the hidden field; real users never see it.
    if (trim(body.website, 200)) {
      return res.json({ ok: true });
    }

    const { data: community, error: cErr } = await supabase
      .from('communities')
      .select('id, name, contact_email, business_type')
      .eq('id', communitySlug)
      .eq('business_type', TAX_BUSINESS_TYPE)
      .maybeSingle();
    if (cErr) return sendSupabaseError(res, cErr);
    if (!community) return res.status(404).json({ error: 'Tax community not found.' });

    const lead = {
      id: 'lead_' + uuidv4().slice(0, 12),
      community_id: community.id,
      name, email, phone,
      product_slug: productSlug,
      message,
      preferred_locale: preferredLocale,
      status: 'new',
      source: 'landing',
      user_agent: userAgent,
      ip,
    };

    const { data: inserted, error: iErr } = await supabase
      .from('tax_leads').insert(lead).select('*').single();
    if (iErr) return sendSupabaseError(res, iErr);

    try {
      await auditLog({
        entity: 'tax.lead', entityId: inserted.id,
        action: 'create', actorEmail: email, actorName: name,
        after: { communityId: community.id, productSlug, preferredLocale },
      });
    } catch (e) { warn('[tax] audit log failed', e?.message || e); }

    if (typeof sendTaxLeadEmail === 'function') {
      try { await sendTaxLeadEmail({ community, lead: inserted }); }
      catch (e) { warn('[tax] lead notification email failed', e?.message || e); }
    }

    res.json({ ok: true, id: inserted.id });
  });

  router.get('/leads', (_req, res) => {
    res.status(501).json({ error: 'Lead inbox not implemented yet (Phase 4).' });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Phase 1.5: customer magic-link response endpoints
  // ────────────────────────────────────────────────────────────────────────────

  // ── GET /respond/:token ──
  // Public. Verifies token, returns the period + checklist for the customer.
  // No PII is leaked: only the customer's own name/email + the filing details
  // the token is bound to.
  router.get('/respond/:token', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const raw = trim(req.params.token, MAX_TOKEN_LEN);
    if (!raw) return res.status(400).json({ error: 'Token required.' });

    const tokenRow = await fetchValidToken(raw);
    if (!tokenRow.ok) return res.status(tokenRow.status).json({ error: tokenRow.error });

    res.json({
      community: tokenRow.community,
      customer: tokenRow.customer,   // restricted set, see fetchValidToken
      period: tokenRow.period,
      schedule: tokenRow.schedule,
      checklist: tokenRow.checklist,
      alreadyReceived: tokenRow.period.status === 'info_received'
        || tokenRow.period.status === 'in_prep'
        || tokenRow.period.status === 'filed',
    });
  });

  // ── POST /respond/:token ──
  // Public. Accepts a `data` object of checklist responses + optional notes,
  // saves the response, marks the period info_received, invalidates the token.
  router.post('/respond/:token', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const raw = trim(req.params.token, MAX_TOKEN_LEN);
    if (!raw) return res.status(400).json({ error: 'Token required.' });

    const body = req.body || {};
    const data = (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) ? body.data : {};
    const notes = trim(body.notes, MAX_TEXT_LEN);
    const userAgent = trim(req.get('user-agent') || '', 500);
    const ip = trim((req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0], 80);

    const tokenRow = await fetchValidToken(raw);
    if (!tokenRow.ok) return res.status(tokenRow.status).json({ error: tokenRow.error });
    if (tokenRow.period.status === 'filed') {
      return res.status(409).json({ error: 'This filing has already been completed.' });
    }

    // Validate required fields per checklist.
    const missing = [];
    for (const item of tokenRow.checklist) {
      if (!item.required) continue;
      const v = data[item.key];
      if (v === undefined || v === null || String(v).trim() === '') missing.push(item.key);
    }
    if (missing.length) return res.status(400).json({ error: 'Missing required fields', missing });

    const respId = 'tresp_' + uuidv4().slice(0, 12);
    const { error: rErr } = await supabase.from('tax_filing_responses').insert({
      id: respId,
      period_id: tokenRow.period.id,
      customer_id: tokenRow.customer.id,
      data, notes, ip, user_agent: userAgent,
    });
    if (rErr) return sendSupabaseError(res, rErr);

    await supabase.from('tax_filing_periods')
      .update({
        status: 'info_received',
        info_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.period.id);

    await supabase.from('tax_response_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.tokenId);

    try {
      await auditLog({
        entity: 'tax.filing_response', entityId: respId,
        action: 'create', actorEmail: tokenRow.customer.email, actorName: tokenRow.customer.name,
        after: { periodId: tokenRow.period.id, scheduleSlug: tokenRow.schedule.slug },
      });
    } catch (_e) {}

    res.json({ ok: true, id: respId });
  });

  // Internal helper — validates a magic-link token and returns the joined
  // record. Limits what's returned to what the customer is allowed to see.
  async function fetchValidToken(raw) {
    const tokenHash = sha256(raw);
    const { data: t, error: tErr } = await supabase
      .from('tax_response_tokens')
      .select('id, period_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (tErr) return { ok: false, status: 500, error: tErr.message };
    if (!t) return { ok: false, status: 404, error: 'Invalid or expired link.' };
    if (t.used_at) return { ok: false, status: 410, error: 'This link has already been used.' };
    if (new Date(t.expires_at) < new Date()) {
      return { ok: false, status: 410, error: 'This link has expired.' };
    }

    const { data: period, error: pErr } = await supabase
      .from('tax_filing_periods')
      .select('id, community_id, subscription_id, customer_id, schedule_id, status, period_label, period_start, period_end, due_date')
      .eq('id', t.period_id).maybeSingle();
    if (pErr) return { ok: false, status: 500, error: pErr.message };
    if (!period) return { ok: false, status: 404, error: 'Filing period not found.' };

    const [{ data: customer }, { data: schedule }, { data: subscription }, { data: community }] = await Promise.all([
      supabase.from('tax_customers').select('id, email, name, locale').eq('id', period.customer_id).maybeSingle(),
      supabase.from('tax_filing_schedules')
        .select('id, slug, jurisdiction, cadence, info_checklist, name_i18n, description_i18n')
        .eq('id', period.schedule_id).maybeSingle(),
      supabase.from('tax_subscriptions').select('id, custom_info_checklist').eq('id', period.subscription_id).maybeSingle(),
      supabase.from('communities')
        .select('id, name, logo_url, brand_primary_color, brand_secondary_color, default_locale, tagline, tagline_en, contact_email')
        .eq('id', period.community_id).maybeSingle(),
    ]);
    if (!customer || !schedule || !community) {
      return { ok: false, status: 404, error: 'Filing not available.' };
    }

    const checklist = (Array.isArray(subscription?.custom_info_checklist) && subscription.custom_info_checklist.length)
      ? subscription.custom_info_checklist
      : (Array.isArray(schedule.info_checklist) ? schedule.info_checklist : []);

    return {
      ok: true,
      tokenId: t.id,
      community, customer, period, schedule, checklist,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Phase 1.5: admin endpoints (minimal — full UI in Phase 4a)
  // ────────────────────────────────────────────────────────────────────────────

  router.post('/admin/cron/run', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (typeof runReminderCron !== 'function') {
      return res.status(503).json({ error: 'Reminder cron not configured.' });
    }
    const result = await runReminderCron();
    res.json({ ok: true, result });
  });

  router.get('/admin/customers', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const communitySlug = trim(req.query.communitySlug || '', 200);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });

    const { data: customers, error } = await supabase
      .from('tax_customers')
      .select(`
        id, email, name, locale, status, created_at,
        tax_subscriptions ( id, product_id, status, active_schedule_slugs, reminder_channels, reminder_offsets_days )
      `)
      .eq('community_id', communitySlug)
      .order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    res.json({ customers: customers || [] });
  });

  router.get('/admin/periods', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const communitySlug = trim(req.query.communitySlug || '', 200);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });

    const { data, error } = await supabase
      .from('tax_filing_periods')
      .select(`
        id, period_label, due_date, status, info_received_at, filed_at,
        customer:tax_customers ( id, email, name ),
        schedule:tax_filing_schedules ( id, slug, name_i18n, jurisdiction )
      `)
      .eq('community_id', communitySlug)
      .order('due_date', { ascending: true })
      .limit(200);
    if (error) return sendSupabaseError(res, error);
    res.json({ periods: data || [] });
  });

  return router;
};
