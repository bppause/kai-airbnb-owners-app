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

  // ── GET /health ─────────────────────────────────────────────────────────────
  // Lightweight readiness probe for Render and uptime checks. Confirms the tax
  // module is mounted and Supabase env vars are present (no DB round-trip).
  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      module: 'tax',
      version: '0.1.5',
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      ts: new Date().toISOString(),
    });
  });

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

  router.put('/admin/community-settings/notif-lock', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const communitySlug = trim(req.body?.communitySlug, 200);
    const allowChange = Boolean(req.body?.allowCustomerChange);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });
    const { error } = await supabase.from('communities')
      .update({ tax_allow_customer_notif_pref_change: allowChange, updated_at: new Date().toISOString() })
      .eq('id', communitySlug).eq('business_type', TAX_BUSINESS_TYPE);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true, allowCustomerChange: allowChange });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Phase 2a: customer portal endpoints
  //
  // Auth approach for Phase 2a: the frontend signs in via Firebase (Google or
  // email/password), then sends `x-firebase-uid`, `x-firebase-email`, and
  // `x-tax-community` headers on every portal request. The middleware below
  // validates these against `tax_customers`. This matches the existing
  // platform pattern (server trusts the frontend-asserted identity).
  //
  // SECURITY NOTE: Tax data is more sensitive than the Airbnb listings the
  // existing platform handles. Before exposing this portal beyond a trusted
  // pilot, harden the middleware to verify the Firebase ID token signature
  // against Google's JWKS (firebase-admin SDK or hand-rolled JOSE). The
  // function shape stays the same; only the implementation hardens.
  // ────────────────────────────────────────────────────────────────────────────

  async function requireTaxCustomer(req, res) {
    if (!requireSupabaseEnv(res)) return null;
    const uid = trim(req.get('x-firebase-uid') || '', 200);
    const email = trim(req.get('x-firebase-email') || '', 200).toLowerCase();
    const communitySlug = trim(req.get('x-tax-community') || '', 200);
    if (!uid || !email || !communitySlug) {
      res.status(401).json({ error: 'Authentication required.' });
      return null;
    }
    const { data: customer, error } = await supabase.from('tax_customers')
      .select('id, community_id, email, name, phone, locale, status, firebase_uid')
      .eq('email', email).eq('community_id', communitySlug).maybeSingle();
    if (error) { sendSupabaseError(res, error); return null; }
    if (!customer) {
      res.status(403).json({ error: 'Account not provisioned. Contact your tax practice.' });
      return null;
    }
    if (customer.status !== 'active') {
      res.status(403).json({ error: 'Account is not active.' });
      return null;
    }
    if (customer.firebase_uid && customer.firebase_uid !== uid) {
      res.status(403).json({ error: 'Account collision. Contact your tax practice.' });
      return null;
    }
    return customer;
  }

  // ── POST /auth/link ────────────────────────────────────────────────────────
  // On first portal sign-in, links the Firebase UID to the existing
  // tax_customers row identified by (community_slug, email). Idempotent.
  router.post('/auth/link', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const body = req.body || {};
    const uid = trim(body.uid, 200);
    const email = trim(body.email, 200).toLowerCase();
    const communitySlug = trim(body.communitySlug, 200);
    if (!uid || !email || !communitySlug) {
      return res.status(400).json({ error: 'uid, email, and communitySlug required.' });
    }
    const { data: customer, error } = await supabase.from('tax_customers')
      .select('id, community_id, email, name, locale, status, firebase_uid')
      .eq('email', email).eq('community_id', communitySlug).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!customer) {
      return res.status(403).json({ error: 'Account not provisioned. Contact your tax practice.' });
    }
    if (customer.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active. Contact your tax practice.' });
    }
    if (customer.firebase_uid && customer.firebase_uid !== uid) {
      return res.status(403).json({ error: 'Account collision. Contact your tax practice.' });
    }
    if (!customer.firebase_uid) {
      const { error: uErr } = await supabase.from('tax_customers')
        .update({ firebase_uid: uid, updated_at: new Date().toISOString() })
        .eq('id', customer.id);
      if (uErr) return sendSupabaseError(res, uErr);
      try {
        await auditLog({
          entity: 'tax.customer', entityId: customer.id,
          action: 'link_firebase', actorEmail: email, actorName: customer.name,
          after: { firebaseUidLinked: true },
        });
      } catch (_e) {}
    }
    res.json({ ok: true, customer: { ...customer, firebase_uid: uid } });
  });

  // ── GET /portal/me ──
  router.get('/portal/me', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const [{ data: community }, { data: subs }, { data: rels }] = await Promise.all([
      supabase.from('communities')
        .select('id, name, logo_url, brand_primary_color, brand_secondary_color, default_locale, tax_allow_customer_notif_pref_change, contact_email, phone')
        .eq('id', customer.community_id).maybeSingle(),
      supabase.from('tax_subscriptions')
        .select('id, product_id, status, reminder_channels, reminder_offsets_days')
        .eq('customer_id', customer.id),
      supabase.from('tax_customer_relationships')
        .select(`
          id, relationship_type_id, active, created_at,
          type:tax_relationship_types ( id, category, slug, name_i18n, display_order )
        `)
        .eq('customer_id', customer.id).eq('active', true),
    ]);
    const allChannels = uniqueChannels(subs);
    res.json({
      customer: pickCustomer(customer),
      community,
      preferences: {
        channels: allChannels,
        allowChange: Boolean(community?.tax_allow_customer_notif_pref_change),
      },
      relationships: rels || [],
    });
  });

  // ── GET /portal/filings ──
  router.get('/portal/filings', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const { data, error } = await supabase.from('tax_filing_periods')
      .select(`
        id, period_label, period_start, period_end, due_date, status, info_received_at, filed_at,
        schedule:tax_filing_schedules ( id, slug, jurisdiction, cadence, name_i18n, description_i18n )
      `)
      .eq('customer_id', customer.id)
      .order('due_date', { ascending: true })
      .limit(100);
    if (error) return sendSupabaseError(res, error);
    res.json({ filings: data || [] });
  });

  // ── GET /portal/filings/:id ──
  router.get('/portal/filings/:id', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const id = trim(req.params.id, 200);
    const { data: period, error } = await supabase.from('tax_filing_periods')
      .select('id, community_id, subscription_id, schedule_id, customer_id, status, period_label, period_start, period_end, due_date, info_received_at, filed_at')
      .eq('id', id).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!period || period.customer_id !== customer.id) {
      return res.status(404).json({ error: 'Filing not found.' });
    }
    const [{ data: schedule }, { data: subscription }] = await Promise.all([
      supabase.from('tax_filing_schedules')
        .select('id, slug, jurisdiction, cadence, info_checklist, name_i18n, description_i18n')
        .eq('id', period.schedule_id).maybeSingle(),
      supabase.from('tax_subscriptions').select('id, custom_info_checklist').eq('id', period.subscription_id).maybeSingle(),
    ]);
    const checklist = (Array.isArray(subscription?.custom_info_checklist) && subscription.custom_info_checklist.length)
      ? subscription.custom_info_checklist
      : (Array.isArray(schedule?.info_checklist) ? schedule.info_checklist : []);
    res.json({
      period, schedule, checklist,
      alreadyReceived: ['info_received', 'in_prep', 'filed'].includes(period.status),
    });
  });

  // ── POST /portal/filings/:id/respond ──
  router.post('/portal/filings/:id/respond', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const id = trim(req.params.id, 200);
    const body = req.body || {};
    const data = (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) ? body.data : {};
    const notes = trim(body.notes, MAX_TEXT_LEN);

    const { data: period } = await supabase.from('tax_filing_periods')
      .select('id, status, schedule_id, subscription_id, customer_id')
      .eq('id', id).maybeSingle();
    if (!period || period.customer_id !== customer.id) {
      return res.status(404).json({ error: 'Filing not found.' });
    }
    if (period.status === 'filed') {
      return res.status(409).json({ error: 'This filing has already been completed.' });
    }

    const [{ data: schedule }, { data: subscription }] = await Promise.all([
      supabase.from('tax_filing_schedules').select('info_checklist').eq('id', period.schedule_id).maybeSingle(),
      supabase.from('tax_subscriptions').select('custom_info_checklist').eq('id', period.subscription_id).maybeSingle(),
    ]);
    const checklist = (Array.isArray(subscription?.custom_info_checklist) && subscription.custom_info_checklist.length)
      ? subscription.custom_info_checklist
      : (Array.isArray(schedule?.info_checklist) ? schedule.info_checklist : []);

    const missing = checklist.filter(it => it.required).filter(it => {
      const v = data[it.key];
      return v === undefined || v === null || String(v).trim() === '';
    }).map(it => it.key);
    if (missing.length) return res.status(400).json({ error: 'Missing required fields', missing });

    const respId = 'tresp_' + uuidv4().slice(0, 12);
    const { error: rErr } = await supabase.from('tax_filing_responses').insert({
      id: respId, period_id: period.id, customer_id: customer.id,
      data, notes,
      ip: trim((req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0], 80),
      user_agent: trim(req.get('user-agent') || '', 500),
    });
    if (rErr) return sendSupabaseError(res, rErr);

    await supabase.from('tax_filing_periods').update({
      status: 'info_received',
      info_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', period.id);

    try {
      await auditLog({
        entity: 'tax.filing_response', entityId: respId,
        action: 'create_via_portal', actorEmail: customer.email, actorName: customer.name,
        after: { periodId: period.id },
      });
    } catch (_e) {}
    res.json({ ok: true, id: respId });
  });

  // ── GET /portal/notifications ──
  router.get('/portal/notifications', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const { data, error } = await supabase.from('tax_notifications')
      .select('id, type, title_i18n, body_i18n, payload, read_at, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return sendSupabaseError(res, error);
    res.json({ notifications: data || [] });
  });

  // ── POST /portal/notifications/:id/read ──
  router.post('/portal/notifications/:id/read', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const id = trim(req.params.id, 200);
    const { error } = await supabase.from('tax_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id).eq('customer_id', customer.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── PUT /portal/preferences ──
  // Updates reminder_channels on ALL of the customer's subscriptions in this
  // community. Refused with 403 when the community lock is on.
  router.put('/portal/preferences', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const { data: community } = await supabase.from('communities')
      .select('tax_allow_customer_notif_pref_change')
      .eq('id', customer.community_id).maybeSingle();
    if (!community?.tax_allow_customer_notif_pref_change) {
      return res.status(403).json({ error: 'Notification preferences are managed by your tax practice.' });
    }
    const channels = (Array.isArray(req.body?.channels) ? req.body.channels : [])
      .map(c => String(c).toLowerCase()).filter(c => c === 'email' || c === 'in_app');
    if (!channels.length) {
      return res.status(400).json({ error: 'Select at least one notification channel.' });
    }
    const { error } = await supabase.from('tax_subscriptions')
      .update({ reminder_channels: channels, updated_at: new Date().toISOString() })
      .eq('customer_id', customer.id);
    if (error) return sendSupabaseError(res, error);
    try {
      await auditLog({
        entity: 'tax.customer', entityId: customer.id,
        action: 'update_preferences', actorEmail: customer.email, actorName: customer.name,
        after: { channels },
      });
    } catch (_e) {}
    res.json({ ok: true, channels });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Phase 2b: customer relationships + FAQ tailoring
  //
  // A customer can have many "relationships" with the business (LLC, ITIN,
  // Sales Tax Filing, etc.). The catalog lives in tax_relationship_types and
  // is platform-curated; each type carries default FAQs from public sources,
  // which communities may override or supplement via tax_relationship_faqs.
  // ────────────────────────────────────────────────────────────────────────────

  // ── GET /portal/relationships ── (auth-gated)
  router.get('/portal/relationships', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const { data, error } = await supabase.from('tax_customer_relationships')
      .select(`
        id, relationship_type_id, notes, active, created_at,
        type:tax_relationship_types ( id, category, slug, name_i18n, description_i18n, display_order )
      `)
      .eq('customer_id', customer.id).eq('active', true);
    if (error) return sendSupabaseError(res, error);
    res.json({ relationships: data || [] });
  });

  // ── GET /portal/tips ── (auth-gated)
  // Returns ALL tips (both contexts) for the customer's active relationship
  // types, grouped by relationship type so the dashboard can render them.
  router.get('/portal/tips', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const typeIds = await activeTypeIdsForCustomer(customer.id);
    if (!typeIds.length) return res.json({ groups: [] });
    const [{ data: types }, { data: tips }] = await Promise.all([
      supabase.from('tax_relationship_types')
        .select('id, category, slug, name_i18n, display_order')
        .in('id', typeIds).order('display_order', { ascending: true }),
      supabase.from('tax_relationship_default_tips')
        .select('id, relationship_type_id, context, display_order, tip_i18n, source_note')
        .in('relationship_type_id', typeIds)
        .order('display_order', { ascending: true }),
    ]);
    const byType = new Map();
    for (const t of tips || []) {
      const arr = byType.get(t.relationship_type_id) || [];
      arr.push(t); byType.set(t.relationship_type_id, arr);
    }
    const groups = (types || [])
      .map(t => ({ type: t, tips: byType.get(t.id) || [] }))
      .filter(g => g.tips.length > 0);
    res.json({ groups });
  });

  // ── GET /portal/faqs ── (auth-gated)
  // Returns effective FAQs (defaults + community overrides + custom additions)
  // for the customer's relationship types only.
  router.get('/portal/faqs', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const data = await loadEffectiveFaqs({
      communityId: customer.community_id,
      filterTypeIds: await activeTypeIdsForCustomer(customer.id),
    });
    res.json(data);
  });

  // ── GET /admin/relationship-types ── (global admin)
  router.get('/admin/relationship-types', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const { data, error } = await supabase.from('tax_relationship_types')
      .select('id, category, slug, name_i18n, description_i18n, display_order, active')
      .eq('active', true).order('display_order', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    res.json({ types: data || [] });
  });

  // ── GET /admin/customers/:id/relationships ── (global admin)
  router.get('/admin/customers/:id/relationships', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const id = trim(req.params.id, 200);
    const { data, error } = await supabase.from('tax_customer_relationships')
      .select(`
        id, relationship_type_id, notes, active, created_at, created_by_email,
        type:tax_relationship_types ( id, category, slug, name_i18n, display_order )
      `)
      .eq('customer_id', id);
    if (error) return sendSupabaseError(res, error);
    res.json({ relationships: data || [] });
  });

  // ── POST /admin/customers/:id/relationships ── (global admin)
  router.post('/admin/customers/:id/relationships', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const customerId = trim(req.params.id, 200);
    const typeId = trim(req.body?.relationshipTypeId, 200);
    const notes = trim(req.body?.notes, MAX_TEXT_LEN);
    if (!customerId || !typeId) return res.status(400).json({ error: 'customerId and relationshipTypeId required.' });
    const { data: cust } = await supabase.from('tax_customers').select('id, email').eq('id', customerId).maybeSingle();
    if (!cust) return res.status(404).json({ error: 'Customer not found.' });
    const { data: type } = await supabase.from('tax_relationship_types').select('id').eq('id', typeId).maybeSingle();
    if (!type) return res.status(404).json({ error: 'Relationship type not found.' });
    const relId = 'crel_' + uuidv4().slice(0, 12);
    const actor = trim(req.get('x-admin-email') || '', 200).toLowerCase();
    // Upsert-on-conflict: if the customer already has this relationship, reactivate it.
    const { error } = await supabase.from('tax_customer_relationships').upsert({
      id: relId,
      customer_id: customerId,
      relationship_type_id: typeId,
      notes: notes || null,
      active: true,
      created_by_email: actor || null,
    }, { onConflict: 'customer_id,relationship_type_id' });
    if (error) return sendSupabaseError(res, error);
    try {
      await auditLog({
        entity: 'tax.customer_relationship', entityId: relId,
        action: 'add', actorEmail: actor || 'system',
        after: { customerId, typeId },
      });
    } catch (_e) {}
    res.json({ ok: true });
  });

  // ── DELETE /admin/customers/:id/relationships/:relId ── (global admin)
  router.delete('/admin/customers/:id/relationships/:relId', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const customerId = trim(req.params.id, 200);
    const relId = trim(req.params.relId, 200);
    // Soft delete: mark inactive so we keep the audit trail.
    const { error } = await supabase.from('tax_customer_relationships')
      .update({ active: false })
      .eq('id', relId).eq('customer_id', customerId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── GET /admin/communities/:slug/faqs ── (global admin)
  // Returns the full effective FAQ set for the community across ALL relationship
  // types — what the customer would see if they had every relationship.
  // Owner-facing tooling will let them edit/override per-type.
  router.get('/admin/communities/:slug/faqs', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const communityId = trim(req.params.slug, 200);
    const data = await loadEffectiveFaqs({ communityId, filterTypeIds: null });
    res.json(data);
  });

  // ── PUT /admin/communities/:slug/faqs/override/:defaultFaqId ── (global admin)
  // Owner overrides a default FAQ for this community. Body:
  //   { questionI18n, answerI18n, visible }
  // If `visible:false`, the default is hidden for this community.
  router.put('/admin/communities/:slug/faqs/override/:defaultFaqId', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const communityId = trim(req.params.slug, 200);
    const defaultFaqId = trim(req.params.defaultFaqId, 200);
    const body = req.body || {};
    const { data: def } = await supabase.from('tax_relationship_default_faqs')
      .select('id, relationship_type_id, display_order').eq('id', defaultFaqId).maybeSingle();
    if (!def) return res.status(404).json({ error: 'Default FAQ not found.' });
    const overrideId = 'tfaq_' + uuidv4().slice(0, 12);
    const { error } = await supabase.from('tax_relationship_faqs').upsert({
      id: overrideId,
      community_id: communityId,
      relationship_type_id: def.relationship_type_id,
      default_faq_id: defaultFaqId,
      display_order: def.display_order,
      question_i18n: safeI18n(body.questionI18n),
      answer_i18n: safeI18n(body.answerI18n),
      visible: body.visible === false ? false : true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'community_id,relationship_type_id,default_faq_id' });
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── POST /admin/communities/:slug/faqs/custom ── (global admin)
  // Owner adds a community-specific FAQ for a relationship type. Body:
  //   { relationshipTypeId, displayOrder, questionI18n, answerI18n }
  router.post('/admin/communities/:slug/faqs/custom', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const communityId = trim(req.params.slug, 200);
    const typeId = trim(req.body?.relationshipTypeId, 200);
    if (!typeId) return res.status(400).json({ error: 'relationshipTypeId required.' });
    const customId = 'tfaq_' + uuidv4().slice(0, 12);
    const { error } = await supabase.from('tax_relationship_faqs').insert({
      id: customId,
      community_id: communityId,
      relationship_type_id: typeId,
      default_faq_id: null,
      display_order: Number(req.body?.displayOrder) || 1000,
      question_i18n: safeI18n(req.body?.questionI18n),
      answer_i18n: safeI18n(req.body?.answerI18n),
      visible: true,
    });
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true, id: customId });
  });

  // ── DELETE /admin/communities/:slug/faqs/:overrideId ── (global admin)
  // Hard-delete a community FAQ row — either an override (reverts to default)
  // or a custom FAQ (removes it).
  router.delete('/admin/communities/:slug/faqs/:overrideId', async (req, res) => {
    if (!requireGlobalAdmin(req, res)) return;
    if (!requireSupabaseEnv(res)) return;
    const communityId = trim(req.params.slug, 200);
    const overrideId = trim(req.params.overrideId, 200);
    const { error } = await supabase.from('tax_relationship_faqs')
      .delete().eq('id', overrideId).eq('community_id', communityId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function activeTypeIdsForCustomer(customerId) {
    const { data } = await supabase.from('tax_customer_relationships')
      .select('relationship_type_id').eq('customer_id', customerId).eq('active', true);
    return (data || []).map(r => r.relationship_type_id);
  }

  // Loads default FAQs + community overrides/customs, merges them into the
  // "effective" set, and groups by relationship type.
  //   filterTypeIds: null → all active types; array → only these types
  async function loadEffectiveFaqs({ communityId, filterTypeIds }) {
    const typeQ = supabase.from('tax_relationship_types')
      .select('id, category, slug, name_i18n, description_i18n, display_order')
      .eq('active', true);
    const types = await typeQ;
    if (types.error) throw new Error(types.error.message);
    let typeRows = types.data || [];
    if (Array.isArray(filterTypeIds)) {
      const allow = new Set(filterTypeIds);
      typeRows = typeRows.filter(t => allow.has(t.id));
    }
    typeRows.sort((a, b) => a.display_order - b.display_order);
    if (!typeRows.length) return { groups: [] };

    const typeIds = typeRows.map(t => t.id);
    const [defaults, overrides] = await Promise.all([
      supabase.from('tax_relationship_default_faqs')
        .select('id, relationship_type_id, display_order, question_i18n, answer_i18n, source_note')
        .in('relationship_type_id', typeIds),
      supabase.from('tax_relationship_faqs')
        .select('id, relationship_type_id, default_faq_id, display_order, question_i18n, answer_i18n, visible')
        .eq('community_id', communityId)
        .in('relationship_type_id', typeIds),
    ]);
    if (defaults.error) throw new Error(defaults.error.message);
    if (overrides.error) throw new Error(overrides.error.message);

    const overrideByDefault = new Map();
    const customsByType = new Map();
    for (const o of overrides.data || []) {
      if (o.default_faq_id) overrideByDefault.set(o.default_faq_id, o);
      else {
        const arr = customsByType.get(o.relationship_type_id) || [];
        arr.push(o); customsByType.set(o.relationship_type_id, arr);
      }
    }

    const groups = typeRows.map(t => {
      const items = [];
      for (const d of (defaults.data || []).filter(d => d.relationship_type_id === t.id)) {
        const ov = overrideByDefault.get(d.id);
        if (ov && ov.visible === false) continue;
        if (ov) {
          items.push({
            id: ov.id, source: 'override', defaultFaqId: d.id,
            display_order: ov.display_order ?? d.display_order,
            question_i18n: ov.question_i18n || d.question_i18n,
            answer_i18n: ov.answer_i18n || d.answer_i18n,
            source_note: d.source_note,
          });
        } else {
          items.push({
            id: d.id, source: 'default',
            display_order: d.display_order,
            question_i18n: d.question_i18n,
            answer_i18n: d.answer_i18n,
            source_note: d.source_note,
          });
        }
      }
      for (const c of customsByType.get(t.id) || []) {
        items.push({
          id: c.id, source: 'custom',
          display_order: c.display_order,
          question_i18n: c.question_i18n,
          answer_i18n: c.answer_i18n,
        });
      }
      items.sort((a, b) => a.display_order - b.display_order);
      return { type: t, faqs: items };
    });
    return { groups };
  }

  function safeI18n(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out = {};
    for (const k of ['en', 'es']) {
      if (typeof v[k] === 'string') out[k] = trim(v[k], MAX_TEXT_LEN);
    }
    return out;
  }

  function uniqueChannels(subs) {
    const set = new Set();
    for (const s of subs || []) {
      for (const c of s.reminder_channels || []) set.add(c);
    }
    if (!set.size) { set.add('email'); set.add('in_app'); }
    return [...set];
  }
  function pickCustomer(c) {
    return { id: c.id, email: c.email, name: c.name, phone: c.phone, locale: c.locale, status: c.status };
  }

  return router;
};
