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
    sendTaxDocumentEmail,
    sendTaxMessageEmail,
    sendTaxMessagePracticeEmail,
    sendTaxMessageEmployeeEmail,
    publicAppUrl,
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

  // Admin gate (Phase 4d: requireGlobalAdmin retired — all /admin/* now
  // use requireOwnerAdmin below). Accepts EITHER auth path:
  //   (a) Global admin via x-admin-email header matching GLOBAL_ADMIN_EMAILS
  //       (legacy curl flows from Phases 1.5–3b stay working unchanged)
  //   (b) Firebase auth from a tax_employees row with role='admin' for the
  //       targeted community (the dashboard logged-in path; lets additional
  //       admin employees use the dashboard without being in the env var).
  // Returns { email, source, employee? } on success; writes 403 + returns
  // null on failure. Always await this.
  async function requireOwnerAdmin(req, res) {
    if (!requireSupabaseEnv(res)) return null;
    // (a) Global admin email header (legacy curl callers).
    const headerEmail = trim(req.get('x-admin-email') || req.query.adminEmail || '', 200).toLowerCase();
    if (headerEmail && typeof isGlobalAdmin === 'function' && isGlobalAdmin(headerEmail)) {
      return { email: headerEmail, source: 'global' };
    }
    // (b) role='admin' employee with Firebase headers (same triple as
    // requireTaxEmployee). Community match is enforced via x-tax-community.
    const uid = trim(req.get('x-firebase-uid') || '', 200);
    const email = trim(req.get('x-firebase-email') || '', 200).toLowerCase();
    const communitySlug = trim(req.get('x-tax-community') || '', 200);
    if (uid && email && communitySlug) {
      const { data: emp } = await supabase.from('tax_employees')
        .select('id, community_id, email, role, status, firebase_uid')
        .eq('email', email).eq('community_id', communitySlug).maybeSingle();
      if (emp && emp.status === 'active' && emp.role === 'admin' &&
          (!emp.firebase_uid || emp.firebase_uid === uid)) {
        return { email, source: 'employee', employee: emp };
      }
    }
    res.status(403).json({ error: 'Admin authentication required.' });
    return null;
  }

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

  // Phase 4b: lead inbox lives at /admin/leads — see below. /leads stays
  // 501 so legacy callers don't accidentally hit it without auth.
  router.get('/leads', (_req, res) => {
    res.status(501).json({ error: 'Use /admin/leads (admin-authenticated).' });
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
    if (!(await requireOwnerAdmin(req, res))) return;
    if (typeof runReminderCron !== 'function') {
      return res.status(503).json({ error: 'Reminder cron not configured.' });
    }
    const result = await runReminderCron();
    res.json({ ok: true, result });
  });

  router.get('/admin/customers', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const communitySlug = trim(req.query.communitySlug || '', 200);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });

    const { data: customers, error } = await supabase
      .from('tax_customers')
      .select(`
        id, email, name, phone, whatsapp, locale, status, created_at,
        tax_subscriptions ( id, product_id, status, active_schedule_slugs, reminder_channels, reminder_offsets_days )
      `)
      .eq('community_id', communitySlug)
      .order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    res.json({ customers: customers || [] });
  });

  // ── POST /admin/customers ── (Phase 4a)
  // Creates a customer row. The portal can then magic-link them in (Phase 1.5)
  // or they can self-link by signing in (Phase 2a). No subscription is
  // created — owner adds those via SQL/curl until Phase 4b ships subscription UI.
  router.post('/admin/customers', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const body = req.body || {};
    const communitySlug = trim(body.communitySlug, 200);
    const email = trim(body.email, 200).toLowerCase();
    const name = trim(body.name, MAX_NAME_LEN);
    const phone = trim(body.phone, MAX_PHONE_LEN);
    const locale = (body.locale === 'en') ? 'en' : 'es';
    if (!communitySlug || !email) return res.status(400).json({ error: 'communitySlug and email required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email is not valid.' });

    // Reject if a customer with this email already exists in the community —
    // the unique constraint would catch it, but a friendlier error helps.
    const { data: existing } = await supabase.from('tax_customers')
      .select('id').eq('community_id', communitySlug).eq('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'A customer with this email already exists in this community.' });

    const id = 'cust_' + uuidv4().slice(0, 16);
    const { error } = await supabase.from('tax_customers').insert({
      id, community_id: communitySlug, email, name, phone, locale, status: 'active',
    });
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true, id });
  });

  // ── GET /admin/customers/:id ── (Phase 4a)
  // Single-customer detail view: profile + active relationships + active
  // subscriptions + counts for documents and threads. The dashboard composes
  // these into the customer detail page in one round trip.
  router.get('/admin/customers/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const id = trim(req.params.id, 200);
    const { data: cust, error: cErr } = await supabase.from('tax_customers')
      .select('id, community_id, email, name, phone, whatsapp, address, preferred_communication_email, locale, status, notes, firebase_uid, created_at, updated_at')
      .eq('id', id).maybeSingle();
    if (cErr) return sendSupabaseError(res, cErr);
    if (!cust) return res.status(404).json({ error: 'Customer not found.' });

    const [rels, subs, docs, threads, assignments, periods] = await Promise.all([
      supabase.from('tax_customer_relationships')
        .select(`
          id, relationship_type_id, notes, active, created_at,
          type:tax_relationship_types ( id, category, slug, name_i18n, display_order )
        `).eq('customer_id', id).eq('active', true),
      supabase.from('tax_subscriptions')
        .select('id, product_id, status, reminder_channels, reminder_offsets_days, active_schedule_slugs, start_date, created_at')
        .eq('customer_id', id),
      supabase.from('tax_documents')
        .select('id, source, kind, file_name, mime_type, size_bytes, status, uploaded_at, uploaded_by_role, uploaded_by_email, created_at')
        .eq('customer_id', id).is('deleted_at', null).eq('status', 'uploaded')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('tax_message_threads')
        .select('id, subject, status, last_message_at, last_message_preview, last_message_by_role, practice_unread, created_at')
        .eq('customer_id', id)
        .order('last_message_at', { ascending: false, nullsFirst: false }).limit(50),
      supabase.from('tax_employee_customer_assignments')
        .select(`
          id, is_primary, created_at,
          employee:tax_employees ( id, email, name, role )
        `).eq('customer_id', id).eq('active', true),
      // Phase 4d: include filing periods so the owner detail page can render
      // a Filings section with per-period status overrides without an extra
      // round trip. Window: next 12 due plus most recent 12 by due_date.
      supabase.from('tax_filing_periods')
        .select(`
          id, period_label, period_start, period_end, due_date,
          status, info_received_at, filed_at, created_at,
          schedule:tax_filing_schedules ( id, slug, jurisdiction, cadence, name_i18n )
        `)
        .eq('customer_id', id)
        .order('due_date', { ascending: false }).limit(24),
    ]);

    res.json({
      customer: cust,
      relationships: rels.data || [],
      subscriptions: subs.data || [],
      documents: docs.data || [],
      threads: threads.data || [],
      periods: periods.data || [],
      assignments: assignments.data || [],
    });
  });

  router.get('/admin/periods', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
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

  // ── PUT /admin/periods/:id ── (Phase 4d)
  // Manual override of a filing period's status. Common owner action: mark
  // a period 'skipped' when the customer's business was closed that month,
  // or advance to 'filed' after submitting through agency portal. The
  // reminder cron respects status — periods in 'filed' or 'skipped' stop
  // generating reminders.
  router.put('/admin/periods/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const periodId = trim(req.params.id, 200);
    const body = req.body || {};
    const update = { updated_at: new Date().toISOString() };

    if (body.status !== undefined) {
      const s = String(body.status);
      if (!['pending', 'info_requested', 'info_received', 'in_prep', 'filed', 'skipped'].includes(s)) {
        return res.status(400).json({
          error: 'status must be pending|info_requested|info_received|in_prep|filed|skipped.',
        });
      }
      update.status = s;
      // Auto-stamp the timestamp for entry into terminal states. Owner can
      // also pass infoReceivedAt / filedAt explicitly to override the stamp.
      const nowIso = new Date().toISOString();
      if (s === 'info_received' && body.infoReceivedAt === undefined) update.info_received_at = nowIso;
      if (s === 'filed' && body.filedAt === undefined) update.filed_at = nowIso;
    }
    if (body.infoReceivedAt !== undefined) {
      update.info_received_at = body.infoReceivedAt ? new Date(body.infoReceivedAt).toISOString() : null;
    }
    if (body.filedAt !== undefined) {
      update.filed_at = body.filedAt ? new Date(body.filedAt).toISOString() : null;
    }

    if (Object.keys(update).length === 1) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    const { error } = await supabase.from('tax_filing_periods').update(update).eq('id', periodId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── PUT /admin/customers/:id ── (Phase 4d)
  // Admin override of customer profile fields. The customer self-serves
  // these via /portal/profile (Phase 2e); this endpoint exists so the
  // owner can fix typos / fill in fields before the customer has signed
  // in. The login email is NOT editable here — it's the Firebase auth
  // identity. Schema for changing the login email lives in Phase 5 with
  // a proper re-link flow.
  router.put('/admin/customers/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const customerId = trim(req.params.id, 200);
    const body = req.body || {};
    const update = { updated_at: new Date().toISOString() };

    if (body.name !== undefined)  update.name  = trim(body.name, MAX_NAME_LEN);
    if (body.phone !== undefined) update.phone = trim(body.phone, MAX_PHONE_LEN);

    if (body.whatsapp !== undefined) {
      const raw = String(body.whatsapp || '').trim();
      if (raw === '') update.whatsapp = '';
      else {
        const norm = normalizeWhatsapp(raw);
        if (!norm) {
          return res.status(400).json({ error: 'whatsapp_invalid',
            message: 'WhatsApp must be in international format starting with + and country code.' });
        }
        update.whatsapp = norm;
      }
    }
    if (body.address !== undefined) update.address = sanitizeAddress(body.address);

    if (body.preferredCommunicationEmail !== undefined) {
      const raw = String(body.preferredCommunicationEmail || '').trim().toLowerCase();
      if (raw === '') update.preferred_communication_email = '';
      else if (!isValidEmail(raw)) {
        return res.status(400).json({ error: 'preferred_email_invalid' });
      } else update.preferred_communication_email = raw.slice(0, MAX_NAME_LEN);
    }
    if (body.locale !== undefined) {
      update.locale = (body.locale === 'en') ? 'en' : 'es';
    }
    if (body.status !== undefined) {
      const s = String(body.status);
      if (!['active', 'paused', 'archived'].includes(s)) {
        return res.status(400).json({ error: 'status must be active|paused|archived.' });
      }
      update.status = s;
    }
    if (body.notes !== undefined) update.notes = trim(body.notes, MAX_TEXT_LEN);

    if (Object.keys(update).length === 1) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    const { error } = await supabase.from('tax_customers').update(update).eq('id', customerId);
    if (error) return sendSupabaseError(res, error);

    try {
      await auditLog({
        entity: 'tax.customer', entityId: customerId, action: 'admin_update_profile',
        actorEmail: trim(req.get('x-admin-email') || req.get('x-firebase-email') || '', 200).toLowerCase(),
        after: Object.keys(update).filter(k => k !== 'updated_at'),
      });
    } catch (_e) {}
    res.json({ ok: true });
  });

  router.put('/admin/community-settings/notif-lock', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const communitySlug = trim(req.body?.communitySlug, 200);
    const allowChange = Boolean(req.body?.allowCustomerChange);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });
    const { error } = await supabase.from('communities')
      .update({ tax_allow_customer_notif_pref_change: allowChange, updated_at: new Date().toISOString() })
      .eq('id', communitySlug).eq('business_type', TAX_BUSINESS_TYPE);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true, allowCustomerChange: allowChange });
  });

  // ── Phase 4b admin endpoints ───────────────────────────────────────────────

  // GET /admin/community-settings?communitySlug=  — companion read for the
  // PUT /admin/community-settings/notif-lock that exists since Phase 2a.
  router.get('/admin/community-settings', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const communitySlug = trim(req.query.communitySlug, 200);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });
    const { data, error } = await supabase.from('communities')
      .select('id, name, tax_allow_customer_notif_pref_change, contact_email, phone, default_locale')
      .eq('id', communitySlug).eq('business_type', TAX_BUSINESS_TYPE).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!data) return res.status(404).json({ error: 'Community not found.' });
    res.json({ settings: data });
  });

  // GET /admin/products?communitySlug=  — products with their schedules.
  // Used by the OwnerCustomerDetail subscription editor to populate the
  // product + schedule pickers.
  router.get('/admin/products', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const communitySlug = trim(req.query.communitySlug, 200);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });
    const { data, error } = await supabase.from('tax_products')
      .select(`
        id, slug, category, display_order, name_i18n, description_i18n,
        schedules:tax_filing_schedules ( id, slug, jurisdiction, cadence, enabled, name_i18n )
      `)
      .eq('community_id', communitySlug)
      .order('display_order', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    res.json({ products: data || [] });
  });

  // POST /admin/customers/:id/subscriptions — body { productId,
  // activeScheduleSlugs?, status?, startDate? }. Defaults: status='active',
  // active_schedule_slugs=null (= all schedules), reminder_offsets_days &
  // reminder_channels use platform defaults from the column DEFAULTs.
  router.post('/admin/customers/:id/subscriptions', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const customerId = trim(req.params.id, 200);
    const body = req.body || {};
    const productId = trim(body.productId, 200);
    if (!productId) return res.status(400).json({ error: 'productId required.' });

    const { data: cust } = await supabase.from('tax_customers')
      .select('id, community_id').eq('id', customerId).maybeSingle();
    if (!cust) return res.status(404).json({ error: 'Customer not found.' });
    // Sanity: product must exist in the same community.
    const { data: product } = await supabase.from('tax_products')
      .select('id, community_id').eq('id', productId).maybeSingle();
    if (!product || product.community_id !== cust.community_id) {
      return res.status(400).json({ error: 'Product not available in this community.' });
    }
    // Duplicate guard: tax_subscriptions has unique (customer_id, product_id).
    const { data: existing } = await supabase.from('tax_subscriptions')
      .select('id').eq('customer_id', customerId).eq('product_id', productId).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Customer already has this subscription.' });

    const activeScheduleSlugs = Array.isArray(body.activeScheduleSlugs) && body.activeScheduleSlugs.length
      ? body.activeScheduleSlugs.map(s => String(s).slice(0, 80)) : null;
    const status = (body.status === 'paused' || body.status === 'cancelled') ? body.status : 'active';
    const startDate = trim(body.startDate, 32) || null;

    const id = 'sub_' + uuidv4().slice(0, 16);
    const { error } = await supabase.from('tax_subscriptions').insert({
      id,
      community_id: cust.community_id,
      customer_id: customerId,
      product_id: productId,
      active_schedule_slugs: activeScheduleSlugs,
      status,
      start_date: startDate,
    });
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true, id });
  });

  // PUT /admin/subscriptions/:id — body { status?, activeScheduleSlugs?,
  // reminderOffsetsDays?, reminderChannels?, startDate? }. Each field is
  // optional; only provided ones are updated.
  router.put('/admin/subscriptions/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const subId = trim(req.params.id, 200);
    const body = req.body || {};
    const update = { updated_at: new Date().toISOString() };

    if (body.status !== undefined) {
      const s = String(body.status);
      if (!['active', 'paused', 'cancelled'].includes(s)) {
        return res.status(400).json({ error: 'status must be active|paused|cancelled.' });
      }
      update.status = s;
    }
    if (body.activeScheduleSlugs !== undefined) {
      // null/empty array means "all schedules under this product".
      const arr = Array.isArray(body.activeScheduleSlugs) ? body.activeScheduleSlugs : null;
      update.active_schedule_slugs = (arr && arr.length) ? arr.map(s => String(s).slice(0, 80)) : null;
    }
    if (Array.isArray(body.reminderOffsetsDays)) {
      const ints = body.reminderOffsetsDays
        .map(n => Number(n)).filter(Number.isFinite).map(n => Math.trunc(n))
        .filter(n => n >= -120 && n <= 30);
      if (!ints.length) return res.status(400).json({ error: 'reminderOffsetsDays must contain at least one valid offset.' });
      update.reminder_offsets_days = ints;
    }
    if (Array.isArray(body.reminderChannels)) {
      const channels = body.reminderChannels.map(c => String(c).toLowerCase())
        .filter(c => c === 'email' || c === 'in_app');
      if (!channels.length) return res.status(400).json({ error: 'reminderChannels must include at least one channel.' });
      update.reminder_channels = ['email', 'in_app'].filter(c => channels.includes(c));
    }
    if (body.startDate !== undefined) {
      update.start_date = trim(body.startDate, 32) || null;
    }

    if (Object.keys(update).length === 1) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const { error } = await supabase.from('tax_subscriptions').update(update).eq('id', subId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // DELETE /admin/subscriptions/:id — soft cancel via status='cancelled'.
  // Hard delete would cascade-delete filing_periods which we want to keep
  // for the audit trail. If the owner truly needs to purge a subscription,
  // they can do it via SQL.
  router.delete('/admin/subscriptions/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const subId = trim(req.params.id, 200);
    const { error } = await supabase.from('tax_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', subId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // GET /admin/leads?communitySlug=&status= — lead inbox.
  // Status values come from the schema check constraint:
  //   new | contacted | converted | closed
  router.get('/admin/leads', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const communitySlug = trim(req.query.communitySlug, 200);
    if (!communitySlug) return res.status(400).json({ error: 'communitySlug required.' });
    let q = supabase.from('tax_leads')
      .select('id, name, email, phone, product_slug, message, preferred_locale, status, notes, contacted_at, created_at')
      .eq('community_id', communitySlug)
      .order('created_at', { ascending: false }).limit(500);
    const statusFilter = trim(req.query.status, 40);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) return sendSupabaseError(res, error);
    res.json({ leads: data || [] });
  });

  // PUT /admin/leads/:id — body { status?, notes? }. Setting status to
  // 'contacted' for the first time stamps contacted_at; transitioning to
  // any other status leaves the existing stamp in place.
  router.put('/admin/leads/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const leadId = trim(req.params.id, 200);
    const body = req.body || {};
    const update = { updated_at: new Date().toISOString() };

    if (body.status !== undefined) {
      const s = String(body.status);
      if (!['new', 'contacted', 'converted', 'closed'].includes(s)) {
        return res.status(400).json({ error: 'status must be new|contacted|converted|closed.' });
      }
      update.status = s;
      if (s === 'contacted') {
        // Only stamp the first transition to contacted; preserve later edits.
        const { data: cur } = await supabase.from('tax_leads')
          .select('contacted_at').eq('id', leadId).maybeSingle();
        if (cur && !cur.contacted_at) update.contacted_at = new Date().toISOString();
      }
    }
    if (body.notes !== undefined) update.notes = trim(body.notes, MAX_TEXT_LEN);

    if (Object.keys(update).length === 1) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    const { error } = await supabase.from('tax_leads').update(update).eq('id', leadId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
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

    // Impersonation path: if the admin has an active session targeting a
    // customer, the session token replaces Firebase auth. The middleware
    // resolves the target customer and stamps req.impersonation so
    // downstream handlers can attribute actions to the real admin.
    const imp = await loadImpersonationFromRequest(req, res, 'customer');
    if (imp === false) return null;            // invalid/expired token, 401 already sent
    if (imp) {
      const { data: customer, error } = await supabase.from('tax_customers')
        .select('id, community_id, email, name, phone, whatsapp, address, preferred_communication_email, locale, status, firebase_uid')
        .eq('id', imp.target_id).maybeSingle();
      if (error) { sendSupabaseError(res, error); return null; }
      if (!customer) { res.status(404).json({ error: 'Impersonation target not found.' }); return null; }
      req.impersonation = imp;
      return customer;
    }

    // Normal Firebase auth path.
    const uid = trim(req.get('x-firebase-uid') || '', 200);
    const email = trim(req.get('x-firebase-email') || '', 200).toLowerCase();
    const communitySlug = trim(req.get('x-tax-community') || '', 200);
    if (!uid || !email || !communitySlug) {
      res.status(401).json({ error: 'Authentication required.' });
      return null;
    }
    const { data: customer, error } = await supabase.from('tax_customers')
      .select('id, community_id, email, name, phone, whatsapp, address, preferred_communication_email, locale, status, firebase_uid')
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

  // ── PUT /portal/profile ── (Phase 2e)
  // Customer-editable profile fields. Login `email` stays read-only (it's the
  // Firebase auth identity) and goes through /auth/link when a new account
  // links. Everything else here is at the customer's discretion.
  router.put('/portal/profile', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const body = req.body || {};

    const update = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) {
      update.name = trim(body.name, MAX_NAME_LEN);
    }
    if (body.phone !== undefined) {
      update.phone = trim(body.phone, MAX_PHONE_LEN);
    }
    if (body.whatsapp !== undefined) {
      const raw = String(body.whatsapp || '').trim();
      if (raw === '') {
        update.whatsapp = '';
      } else {
        const normalized = normalizeWhatsapp(raw);
        if (!normalized) {
          return res.status(400).json({ error: 'whatsapp_invalid',
            message: 'WhatsApp must be in international format starting with + and country code, e.g., +14155551234.' });
        }
        update.whatsapp = normalized;
      }
    }
    if (body.address !== undefined) {
      update.address = sanitizeAddress(body.address);
    }
    if (body.preferredCommunicationEmail !== undefined) {
      const raw = String(body.preferredCommunicationEmail || '').trim().toLowerCase();
      if (raw === '') {
        update.preferred_communication_email = '';
      } else if (!isValidEmail(raw)) {
        return res.status(400).json({ error: 'preferred_email_invalid',
          message: 'Preferred communication email is not valid.' });
      } else {
        update.preferred_communication_email = raw.slice(0, MAX_NAME_LEN);
      }
    }

    const { error } = await supabase.from('tax_customers')
      .update(update).eq('id', customer.id);
    if (error) return sendSupabaseError(res, error);

    try {
      await auditLog({
        entity: 'tax.customer', entityId: customer.id,
        action: 'update_profile', actorEmail: customer.email, actorName: customer.name,
        after: Object.keys(update).filter(k => k !== 'updated_at'),
      });
    } catch (_e) {}

    const { data: refreshed } = await supabase.from('tax_customers')
      .select('id, email, name, phone, whatsapp, address, preferred_communication_email, locale, status')
      .eq('id', customer.id).maybeSingle();
    res.json({ ok: true, customer: refreshed });
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

  // ── GET /portal/help ── (Phase 4c, auth-gated)
  // Returns active customer-audience help articles filtered to:
  //   relationship_type_id IS NULL  (general portal-usage articles)
  //   OR relationship_type_id matches one of the customer's active
  //   relationships. Grouped by category for the help-center UI.
  router.get('/portal/help', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const typeIds = await activeTypeIdsForCustomer(customer.id);

    let q = supabase.from('tax_help_articles')
      .select(`
        id, audience, relationship_type_id, category, display_order,
        title_i18n, body_i18n, source_note,
        type:tax_relationship_types ( id, category, slug, name_i18n )
      `)
      .eq('audience', 'customer').eq('active', true)
      .order('display_order', { ascending: true });
    // Postgres "is null OR in (…)" via Supabase's `or()`.
    if (typeIds.length) {
      const inList = typeIds.map(id => `"${id}"`).join(',');
      q = q.or(`relationship_type_id.is.null,relationship_type_id.in.(${inList})`);
    } else {
      q = q.is('relationship_type_id', null);
    }
    const { data, error } = await q;
    if (error) return sendSupabaseError(res, error);
    res.json({ articles: data || [] });
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
    if (!(await requireOwnerAdmin(req, res))) return;
    const { data, error } = await supabase.from('tax_relationship_types')
      .select('id, category, slug, name_i18n, description_i18n, display_order, active')
      .eq('active', true).order('display_order', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    res.json({ types: data || [] });
  });

  // ── GET /admin/customers/:id/relationships ── (global admin)
  router.get('/admin/customers/:id/relationships', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
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
    if (!(await requireOwnerAdmin(req, res))) return;
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
    if (!(await requireOwnerAdmin(req, res))) return;
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
    if (!(await requireOwnerAdmin(req, res))) return;
    const communityId = trim(req.params.slug, 200);
    const data = await loadEffectiveFaqs({ communityId, filterTypeIds: null });
    res.json(data);
  });

  // ── PUT /admin/communities/:slug/faqs/override/:defaultFaqId ── (global admin)
  // Owner overrides a default FAQ for this community. Body:
  //   { questionI18n, answerI18n, visible }
  // If `visible:false`, the default is hidden for this community.
  router.put('/admin/communities/:slug/faqs/override/:defaultFaqId', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
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
    if (!(await requireOwnerAdmin(req, res))) return;
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
    if (!(await requireOwnerAdmin(req, res))) return;
    const communityId = trim(req.params.slug, 200);
    const overrideId = trim(req.params.overrideId, 200);
    const { error } = await supabase.from('tax_relationship_faqs')
      .delete().eq('id', overrideId).eq('community_id', communityId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Phase 2d: customer documents
  //
  // Files live in the private `tax-documents` Supabase Storage bucket. The
  // server holds the service role key and signs upload/download URLs that
  // the client uses directly — no file bytes pass through the Node tier.
  // ────────────────────────────────────────────────────────────────────────────
  const DOCS_BUCKET = 'tax-documents';
  const MAX_DOC_BYTES = 25 * 1024 * 1024;
  const DOC_MIME_ALLOWLIST = new Set([
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
  ]);
  const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

  function sanitizeFileName(name) {
    const s = String(name || '').trim().replace(/[\\/]/g, '_').replace(/\x00/g, '');
    return s.slice(0, 255) || 'file';
  }
  function pathFor(communityId, customerId, docId) {
    return `${encodeURIComponent(communityId)}/${encodeURIComponent(customerId)}/${docId}`;
  }
  function isAllowedMime(m) { return DOC_MIME_ALLOWLIST.has(String(m || '').toLowerCase()); }

  // ── POST /portal/documents/upload-url ── (auth-gated customer)
  // Creates a draft document row and returns a signed upload URL. Client then
  // PUTs the file directly to Supabase Storage and calls /finalize.
  router.post('/portal/documents/upload-url', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const body = req.body || {};
    const fileName = sanitizeFileName(body.fileName);
    const mimeType = trim(body.mimeType, 200).toLowerCase();
    const sizeBytes = Number(body.sizeBytes);
    const kind = trim(body.kind, 80) || 'general';
    if (!fileName || !mimeType) return res.status(400).json({ error: 'fileName and mimeType required.' });
    if (!isAllowedMime(mimeType)) return res.status(415).json({ error: 'File type not supported.' });
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DOC_BYTES) {
      return res.status(413).json({ error: 'File exceeds the 25 MB size limit.' });
    }

    const docId = 'tdoc_' + uuidv4().slice(0, 16);
    const path = pathFor(customer.community_id, customer.id, docId);
    const { data: signed, error: sErr } = await supabase.storage
      .from(DOCS_BUCKET).createSignedUploadUrl(path);
    if (sErr) {
      warn('[tax-docs] createSignedUploadUrl failed', sErr.message);
      return res.status(500).json({ error: 'Could not prepare upload. Please retry.' });
    }

    const { error: iErr } = await supabase.from('tax_documents').insert({
      id: docId,
      community_id: customer.community_id,
      customer_id: customer.id,
      source: 'customer',
      kind,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      storage_path: path,
      status: 'draft',
      uploaded_by_role: 'customer',
      uploaded_by_email: customer.email,
    });
    if (iErr) return sendSupabaseError(res, iErr);

    res.json({ id: docId, signedUrl: signed.signedUrl, path, expiresInSeconds: 7200 });
  });

  // ── POST /portal/documents/:id/finalize ── (auth-gated customer)
  // Flips the doc status to 'uploaded' after the PUT succeeds. We trust the
  // client here; if the file did not actually upload, the download URL will
  // 404 when used. A future cleanup job can sweep abandoned drafts.
  router.post('/portal/documents/:id/finalize', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const docId = trim(req.params.id, 200);
    const { data: doc } = await supabase.from('tax_documents')
      .select('id, customer_id, source, status').eq('id', docId).maybeSingle();
    if (!doc || doc.customer_id !== customer.id) return res.status(404).json({ error: 'Document not found.' });
    if (doc.source !== 'customer') return res.status(403).json({ error: 'Not allowed.' });
    if (doc.status === 'uploaded') return res.json({ ok: true });
    const { error } = await supabase.from('tax_documents')
      .update({ status: 'uploaded', uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', docId);
    if (error) return sendSupabaseError(res, error);
    try {
      await auditLog({ entity: 'tax.document', entityId: docId, action: 'upload_customer',
        actorEmail: customer.email, actorName: customer.name });
    } catch (_e) {}
    res.json({ ok: true });
  });

  // ── GET /portal/documents ── (auth-gated customer)
  router.get('/portal/documents', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const { data, error } = await supabase.from('tax_documents')
      .select('id, source, kind, file_name, mime_type, size_bytes, status, uploaded_at, uploaded_by_role, created_at, period_id')
      .eq('customer_id', customer.id).is('deleted_at', null).eq('status', 'uploaded')
      .order('created_at', { ascending: false }).limit(500);
    if (error) return sendSupabaseError(res, error);
    res.json({ documents: data || [] });
  });

  // ── GET /portal/documents/:id/download-url ── (auth-gated customer)
  router.get('/portal/documents/:id/download-url', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const docId = trim(req.params.id, 200);
    const { data: doc } = await supabase.from('tax_documents')
      .select('id, customer_id, storage_path, file_name, status, deleted_at')
      .eq('id', docId).maybeSingle();
    if (!doc || doc.customer_id !== customer.id || doc.deleted_at) return res.status(404).json({ error: 'Document not found.' });
    if (doc.status !== 'uploaded') return res.status(409).json({ error: 'Document not ready.' });
    const { data: signed, error } = await supabase.storage
      .from(DOCS_BUCKET).createSignedUrl(doc.storage_path, DOWNLOAD_URL_TTL_SECONDS, { download: doc.file_name });
    if (error) { warn('[tax-docs] createSignedUrl failed', error.message); return res.status(500).json({ error: 'Could not prepare download.' }); }
    res.json({ signedUrl: signed.signedUrl, fileName: doc.file_name, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
  });

  // ── DELETE /portal/documents/:id ── (auth-gated customer, soft delete)
  router.delete('/portal/documents/:id', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const docId = trim(req.params.id, 200);
    const { data: doc } = await supabase.from('tax_documents')
      .select('id, customer_id, source').eq('id', docId).maybeSingle();
    if (!doc || doc.customer_id !== customer.id) return res.status(404).json({ error: 'Document not found.' });
    // Customers can only delete docs THEY uploaded. Practice-uploaded docs are
    // considered records of work performed and must be removed by the owner.
    if (doc.source !== 'customer') return res.status(403).json({ error: 'Contact your tax practice to remove this document.' });
    const { error } = await supabase.from('tax_documents')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', docId);
    if (error) return sendSupabaseError(res, error);
    try {
      await auditLog({ entity: 'tax.document', entityId: docId, action: 'delete_customer',
        actorEmail: customer.email, actorName: customer.name });
    } catch (_e) {}
    res.json({ ok: true });
  });

  // ── GET /admin/customers/:id/documents ── (global admin)
  router.get('/admin/customers/:id/documents', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const customerId = trim(req.params.id, 200);
    const { data, error } = await supabase.from('tax_documents')
      .select('id, community_id, source, kind, file_name, mime_type, size_bytes, status, uploaded_at, uploaded_by_role, uploaded_by_email, period_id, created_at')
      .eq('customer_id', customerId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(500);
    if (error) return sendSupabaseError(res, error);
    res.json({ documents: data || [] });
  });

  // ── POST /admin/customers/:id/documents/upload-url ── (global admin)
  // Owner uploads a document FOR the customer (completed return, etc.). On
  // finalize the customer gets an in-app + email notification.
  router.post('/admin/customers/:id/documents/upload-url', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const customerId = trim(req.params.id, 200);
    const body = req.body || {};
    const fileName = sanitizeFileName(body.fileName);
    const mimeType = trim(body.mimeType, 200).toLowerCase();
    const sizeBytes = Number(body.sizeBytes);
    const kind = trim(body.kind, 80) || 'general';
    const periodId = trim(body.periodId, 200) || null;
    if (!fileName || !mimeType) return res.status(400).json({ error: 'fileName and mimeType required.' });
    if (!isAllowedMime(mimeType)) return res.status(415).json({ error: 'File type not supported.' });
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DOC_BYTES) {
      return res.status(413).json({ error: 'File exceeds the 25 MB size limit.' });
    }
    const { data: cust } = await supabase.from('tax_customers')
      .select('id, community_id').eq('id', customerId).maybeSingle();
    if (!cust) return res.status(404).json({ error: 'Customer not found.' });

    const docId = 'tdoc_' + uuidv4().slice(0, 16);
    const path = pathFor(cust.community_id, cust.id, docId);
    const { data: signed, error: sErr } = await supabase.storage
      .from(DOCS_BUCKET).createSignedUploadUrl(path);
    if (sErr) {
      warn('[tax-docs] createSignedUploadUrl failed', sErr.message);
      return res.status(500).json({ error: 'Could not prepare upload. Please retry.' });
    }
    const actor = trim(req.get('x-admin-email') || '', 200).toLowerCase();
    const { error: iErr } = await supabase.from('tax_documents').insert({
      id: docId,
      community_id: cust.community_id,
      customer_id: cust.id,
      period_id: periodId,
      source: 'practice',
      kind,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      storage_path: path,
      status: 'draft',
      uploaded_by_role: 'practice',
      uploaded_by_email: actor,
    });
    if (iErr) return sendSupabaseError(res, iErr);
    res.json({ id: docId, signedUrl: signed.signedUrl, path, expiresInSeconds: 7200 });
  });

  // ── POST /admin/documents/:id/finalize ── (global admin)
  // Flips to uploaded + notifies the customer.
  router.post('/admin/documents/:id/finalize', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const docId = trim(req.params.id, 200);
    const { data: doc } = await supabase.from('tax_documents')
      .select('id, community_id, customer_id, source, status, file_name, kind')
      .eq('id', docId).maybeSingle();
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    if (doc.source !== 'practice') return res.status(403).json({ error: 'Only practice uploads finalize through admin.' });
    if (doc.status === 'uploaded') return res.json({ ok: true });

    const { error } = await supabase.from('tax_documents')
      .update({ status: 'uploaded', uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', docId);
    if (error) return sendSupabaseError(res, error);

    // Notify the customer (in-app + email when configured).
    try { await notifyCustomerOfDocument(doc); } catch (e) { warn('[tax-docs] notify failed', e?.message || e); }
    try {
      await auditLog({ entity: 'tax.document', entityId: docId, action: 'upload_practice',
        actorEmail: trim(req.get('x-admin-email') || '', 200).toLowerCase() || 'admin' });
    } catch (_e) {}
    res.json({ ok: true });
  });

  // ── GET /admin/documents/:id/download-url ── (global admin)
  router.get('/admin/documents/:id/download-url', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const docId = trim(req.params.id, 200);
    const { data: doc } = await supabase.from('tax_documents')
      .select('id, storage_path, file_name, status, deleted_at').eq('id', docId).maybeSingle();
    if (!doc || doc.deleted_at) return res.status(404).json({ error: 'Document not found.' });
    if (doc.status !== 'uploaded') return res.status(409).json({ error: 'Document not ready.' });
    const { data: signed, error } = await supabase.storage
      .from(DOCS_BUCKET).createSignedUrl(doc.storage_path, DOWNLOAD_URL_TTL_SECONDS, { download: doc.file_name });
    if (error) return res.status(500).json({ error: 'Could not prepare download.' });
    res.json({ signedUrl: signed.signedUrl, fileName: doc.file_name, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
  });

  // ── DELETE /admin/documents/:id ── (global admin, hard delete)
  // Removes the storage object AND the metadata row. Use this for sensitive
  // data the practice doesn't want lingering. Use the soft-delete on the
  // customer endpoint when keeping the audit trail matters more.
  router.delete('/admin/documents/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const docId = trim(req.params.id, 200);
    const { data: doc } = await supabase.from('tax_documents')
      .select('id, storage_path').eq('id', docId).maybeSingle();
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    const { error: rErr } = await supabase.storage.from(DOCS_BUCKET).remove([doc.storage_path]);
    if (rErr) warn('[tax-docs] storage remove failed (continuing)', rErr.message);
    const { error } = await supabase.from('tax_documents').delete().eq('id', docId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // Helper: drop an in-app notification + email when a practice-uploaded
  // document becomes available to a customer.
  async function notifyCustomerOfDocument(doc) {
    const [{ data: cust }, { data: community }] = await Promise.all([
      supabase.from('tax_customers').select('id, email, name, locale, preferred_communication_email').eq('id', doc.customer_id).maybeSingle(),
      supabase.from('communities').select('id, name, contact_email').eq('id', doc.community_id).maybeSingle(),
    ]);
    if (!cust) return;
    const portalUrl = `${(typeof publicAppUrl === 'function' ? publicAppUrl() : '')}/tax/${doc.community_id}/portal`;
    await supabase.from('tax_notifications').insert({
      id: 'tnotif_' + uuidv4().slice(0, 12),
      community_id: doc.community_id,
      customer_id: cust.id,
      type: 'document_uploaded',
      title_i18n: {
        es: `Nuevo documento disponible: ${doc.file_name}`,
        en: `New document available: ${doc.file_name}`,
      },
      body_i18n: {
        es: `Su oficina de impuestos cargó un documento nuevo en su portal. Inicie sesión para revisarlo y descargarlo.`,
        en: `Your tax practice uploaded a new document to your portal. Sign in to review and download it.`,
      },
      payload: { documentId: doc.id, fileName: doc.file_name, kind: doc.kind },
    });
    if (typeof sendTaxDocumentEmail === 'function') {
      try { await sendTaxDocumentEmail({ cust, community, doc, portalUrl }); }
      catch (e) { warn('[tax-docs] document email failed', e?.message || e); }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Phase 2f: customer ↔ practice messaging
  //
  // Thread-per-conversation, denormalized last_message_* + unread flags on the
  // thread row so the list query is O(1). Customer endpoints are auth-gated;
  // owner endpoints sit behind requireOwnerAdmin. The owner UI lands with
  // Phase 4a — until then, the practice replies via these endpoints directly.
  // ────────────────────────────────────────────────────────────────────────────
  const MAX_MESSAGE_BODY = 4000;
  const MAX_SUBJECT_LEN  = 240;
  const PREVIEW_LEN      = 200;

  function previewOf(body) {
    const s = String(body || '').replace(/\s+/g, ' ').trim();
    return s.length > PREVIEW_LEN ? (s.slice(0, PREVIEW_LEN - 1) + '…') : s;
  }

  // ── GET /portal/threads ── (customer)
  router.get('/portal/threads', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const { data, error } = await supabase.from('tax_message_threads')
      .select('id, subject, status, last_message_at, last_message_preview, last_message_by_role, customer_unread, created_at')
      .eq('customer_id', customer.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) return sendSupabaseError(res, error);
    res.json({ threads: data || [] });
  });

  // ── POST /portal/threads ── (customer creates thread + sends first message)
  // Body: { subject, body, relatedPeriodId?, relatedDocumentId? }
  router.post('/portal/threads', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const body = req.body || {};
    const subject = trim(body.subject, MAX_SUBJECT_LEN);
    const messageBody = trim(body.body, MAX_MESSAGE_BODY);
    if (!messageBody) return res.status(400).json({ error: 'Message body required.' });

    const threadId = 'tthr_' + uuidv4().slice(0, 16);
    const now = new Date().toISOString();
    const { error: tErr } = await supabase.from('tax_message_threads').insert({
      id: threadId,
      community_id: customer.community_id,
      customer_id: customer.id,
      subject: subject || (lang => lang === 'en' ? 'Question for your tax practice' : 'Pregunta para su contador')(customer.locale),
      related_period_id: trim(body.relatedPeriodId, 200) || null,
      related_document_id: trim(body.relatedDocumentId, 200) || null,
      status: 'open',
      created_by_role: 'customer',
      created_by_email: customer.email,
      last_message_at: now,
      last_message_preview: previewOf(messageBody),
      last_message_by_role: 'customer',
      customer_unread: false,
      practice_unread: true,
    });
    if (tErr) return sendSupabaseError(res, tErr);

    const msgId = await insertMessage({
      threadId,
      communityId: customer.community_id,
      customerId: customer.id,
      role: 'customer',
      email: customer.email,
      name: customer.name,
      body: messageBody,
    });

    notifyPracticeOfCustomerMessage(threadId, customer.id).catch(e => warn('[tax-msg] practice notify failed', e?.message || e));
    try {
      await auditLog({ entity: 'tax.message_thread', entityId: threadId, action: 'create_customer',
        actorEmail: customer.email, actorName: customer.name });
    } catch (_e) {}
    res.json({ ok: true, threadId, messageId: msgId });
  });

  // ── GET /portal/threads/:id ── (customer; returns + flips customer_unread to false)
  router.get('/portal/threads/:id', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const id = trim(req.params.id, 200);
    const { data: thread } = await supabase.from('tax_message_threads')
      .select('id, customer_id, subject, status, related_period_id, related_document_id, last_message_at, customer_unread, created_at')
      .eq('id', id).maybeSingle();
    if (!thread || thread.customer_id !== customer.id) return res.status(404).json({ error: 'Thread not found.' });

    const { data: messages, error } = await supabase.from('tax_messages')
      .select('id, author_role, author_email, author_name, body, attachments, created_at')
      .eq('thread_id', id).order('created_at', { ascending: true });
    if (error) return sendSupabaseError(res, error);

    if (thread.customer_unread) {
      await supabase.from('tax_message_threads')
        .update({ customer_unread: false, updated_at: new Date().toISOString() })
        .eq('id', id);
    }
    res.json({ thread, messages: messages || [] });
  });

  // ── POST /portal/threads/:id/messages ── (customer reply)
  router.post('/portal/threads/:id/messages', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const id = trim(req.params.id, 200);
    const messageBody = trim(req.body?.body, MAX_MESSAGE_BODY);
    if (!messageBody) return res.status(400).json({ error: 'Message body required.' });

    const { data: thread } = await supabase.from('tax_message_threads')
      .select('id, customer_id, community_id, status').eq('id', id).maybeSingle();
    if (!thread || thread.customer_id !== customer.id) return res.status(404).json({ error: 'Thread not found.' });
    if (thread.status === 'closed') return res.status(409).json({ error: 'This thread is closed.' });

    const msgId = await insertMessage({
      threadId: id,
      communityId: thread.community_id,
      customerId: customer.id,
      role: 'customer',
      email: customer.email,
      name: customer.name,
      body: messageBody,
    });
    notifyPracticeOfCustomerMessage(id, customer.id).catch(e => warn('[tax-msg] practice notify failed', e?.message || e));
    res.json({ ok: true, messageId: msgId });
  });

  // ── POST /portal/threads/:id/read ── (customer mark-as-read)
  router.post('/portal/threads/:id/read', async (req, res) => {
    const customer = await requireTaxCustomer(req, res); if (!customer) return;
    const id = trim(req.params.id, 200);
    const { error } = await supabase.from('tax_message_threads')
      .update({ customer_unread: false, updated_at: new Date().toISOString() })
      .eq('id', id).eq('customer_id', customer.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── ADMIN: GET /admin/threads ── (owner; optionally filtered)
  router.get('/admin/threads', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const communitySlug = trim(req.query.communitySlug, 200);
    let q = supabase.from('tax_message_threads')
      .select(`
        id, subject, status, last_message_at, last_message_preview, last_message_by_role,
        practice_unread, customer_unread, created_at, customer_id, related_period_id, related_document_id,
        customer:tax_customers ( id, email, name )
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(500);
    if (communitySlug) q = q.eq('community_id', communitySlug);
    if (req.query.unreadOnly === 'true') q = q.eq('practice_unread', true);
    const { data, error } = await q;
    if (error) return sendSupabaseError(res, error);
    res.json({ threads: data || [] });
  });

  // ── ADMIN: GET /admin/threads/:id ── (owner; returns + flips practice_unread to false)
  router.get('/admin/threads/:id', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const id = trim(req.params.id, 200);
    const { data: thread } = await supabase.from('tax_message_threads')
      .select(`
        id, customer_id, community_id, subject, status, related_period_id, related_document_id,
        last_message_at, practice_unread, customer_unread, created_at,
        customer:tax_customers ( id, email, name, locale, phone, whatsapp, preferred_communication_email )
      `).eq('id', id).maybeSingle();
    if (!thread) return res.status(404).json({ error: 'Thread not found.' });

    const { data: messages, error } = await supabase.from('tax_messages')
      .select('id, author_role, author_email, author_name, body, attachments, created_at')
      .eq('thread_id', id).order('created_at', { ascending: true });
    if (error) return sendSupabaseError(res, error);

    if (thread.practice_unread) {
      await supabase.from('tax_message_threads')
        .update({ practice_unread: false, updated_at: new Date().toISOString() }).eq('id', id);
    }
    res.json({ thread, messages: messages || [] });
  });

  // ── ADMIN: POST /admin/threads/:id/messages ── (owner reply)
  router.post('/admin/threads/:id/messages', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const id = trim(req.params.id, 200);
    const messageBody = trim(req.body?.body, MAX_MESSAGE_BODY);
    if (!messageBody) return res.status(400).json({ error: 'Message body required.' });

    const { data: thread } = await supabase.from('tax_message_threads')
      .select('id, customer_id, community_id, status').eq('id', id).maybeSingle();
    if (!thread) return res.status(404).json({ error: 'Thread not found.' });
    if (thread.status === 'closed') return res.status(409).json({ error: 'This thread is closed.' });

    const actor = trim(req.get('x-admin-email') || '', 200).toLowerCase();
    const msgId = await insertMessage({
      threadId: id,
      communityId: thread.community_id,
      customerId: thread.customer_id,
      role: 'practice',
      email: actor,
      name: '',
      body: messageBody,
    });
    notifyCustomerOfPracticeMessage(id, thread.customer_id, msgId).catch(e => warn('[tax-msg] customer notify failed', e?.message || e));
    res.json({ ok: true, messageId: msgId });
  });

  // ── ADMIN: POST /admin/threads/:id/read ──
  router.post('/admin/threads/:id/read', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const id = trim(req.params.id, 200);
    const { error } = await supabase.from('tax_message_threads')
      .update({ practice_unread: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── Messaging helpers ──────────────────────────────────────────────────
  // Inserts a row in tax_messages and updates the thread's denormalized
  // last_message_* + opposite-party unread flag. Returns the new message id.
  async function insertMessage({ threadId, communityId, customerId, role, email, name, body }) {
    const id = 'tmsg_' + uuidv4().slice(0, 16);
    const now = new Date().toISOString();
    await supabase.from('tax_messages').insert({
      id, thread_id: threadId, community_id: communityId, customer_id: customerId,
      author_role: role, author_email: email || '', author_name: name || '',
      body, attachments: [], created_at: now,
    });
    const threadPatch = {
      last_message_at: now,
      last_message_preview: previewOf(body),
      last_message_by_role: role,
      updated_at: now,
    };
    if (role === 'practice') threadPatch.customer_unread = true;
    else threadPatch.practice_unread = true;
    await supabase.from('tax_message_threads').update(threadPatch).eq('id', threadId);
    return id;
  }

  async function notifyCustomerOfPracticeMessage(threadId, customerId, messageId) {
    const [{ data: thread }, { data: cust }, { data: msg }] = await Promise.all([
      supabase.from('tax_message_threads')
        .select('id, subject, community_id').eq('id', threadId).maybeSingle(),
      supabase.from('tax_customers')
        .select('id, email, name, locale, preferred_communication_email').eq('id', customerId).maybeSingle(),
      supabase.from('tax_messages')
        .select('id, body, created_at').eq('id', messageId).maybeSingle(),
    ]);
    if (!thread || !cust || !msg) return;
    const { data: community } = await supabase.from('communities')
      .select('id, name, contact_email').eq('id', thread.community_id).maybeSingle();

    await supabase.from('tax_notifications').insert({
      id: 'tnotif_' + uuidv4().slice(0, 12),
      community_id: thread.community_id,
      customer_id: cust.id,
      type: 'message',
      title_i18n: {
        es: `Nuevo mensaje${thread.subject ? `: ${thread.subject}` : ''}`,
        en: `New message${thread.subject ? `: ${thread.subject}` : ''}`,
      },
      body_i18n: {
        es: previewOf(msg.body),
        en: previewOf(msg.body),
      },
      payload: { threadId: thread.id, messageId: msg.id },
    });

    if (typeof sendTaxMessageEmail === 'function') {
      const portalUrl = `${(typeof publicAppUrl === 'function' ? publicAppUrl() : '')}/tax/${thread.community_id}/portal/messages/${encodeURIComponent(thread.id)}`;
      try { await sendTaxMessageEmail({ cust, community, thread, message: msg, portalUrl }); }
      catch (e) { warn('[tax-msg] customer email failed', e?.message || e); }
    }
  }

  async function notifyPracticeOfCustomerMessage(threadId, customerId) {
    const [{ data: thread }, { data: cust }] = await Promise.all([
      supabase.from('tax_message_threads')
        .select('id, subject, community_id, last_message_at, last_message_preview').eq('id', threadId).maybeSingle(),
      supabase.from('tax_customers')
        .select('id, email, name').eq('id', customerId).maybeSingle(),
    ]);
    if (!thread || !cust) return;
    const { data: community } = await supabase.from('communities')
      .select('id, name, contact_email').eq('id', thread.community_id).maybeSingle();

    // Fan out (Phase 3b): admins always get notified for any customer in
    // their community; staff get notified ONLY for customers they're
    // assigned to. The two sets are merged + deduped before delivery.
    const [{ data: admins }, { data: assignedRows }] = await Promise.all([
      supabase.from('tax_employees')
        .select('id, email, name, locale, notification_channels, preferred_communication_email, role, status')
        .eq('community_id', thread.community_id).eq('status', 'active').eq('role', 'admin'),
      supabase.from('tax_employee_customer_assignments')
        .select(`
          id,
          employee:tax_employees ( id, email, name, locale, notification_channels, preferred_communication_email, role, status )
        `)
        .eq('customer_id', customerId).eq('active', true),
    ]);
    const recipientById = new Map();
    for (const emp of admins || []) recipientById.set(emp.id, emp);
    for (const row of assignedRows || []) {
      const emp = row.employee;
      if (emp && emp.status === 'active' && emp.role === 'staff') {
        recipientById.set(emp.id, emp);
      }
    }
    const empList = [...recipientById.values()];

    for (const emp of empList) {
      // In-app notification row, regardless of email preference.
      await supabase.from('tax_employee_notifications').insert({
        id: 'tenot_' + uuidv4().slice(0, 12),
        community_id: thread.community_id,
        employee_id: emp.id,
        type: 'message',
        title_i18n: {
          es: `Nuevo mensaje del cliente${cust.name ? ` (${cust.name})` : ''}`,
          en: `New customer message${cust.name ? ` (${cust.name})` : ''}`,
        },
        body_i18n: {
          es: thread.last_message_preview || '',
          en: thread.last_message_preview || '',
        },
        payload: { threadId: thread.id, customerId: cust.id },
      });

      // Email when the employee opted in. Default is portal-only.
      const channels = Array.isArray(emp.notification_channels) ? emp.notification_channels : [];
      if (channels.includes('email') && typeof sendTaxMessageEmployeeEmail === 'function') {
        try {
          await sendTaxMessageEmployeeEmail({
            community, customer: cust, employee: emp, thread,
            message: { body: thread.last_message_preview, created_at: thread.last_message_at },
          });
        } catch (e) { warn('[tax-msg] employee email failed', e?.message || e); }
      }
    }

    // Fallback: when no employees exist yet, alert the practice contact_email.
    // Once at least one employee is on-staff, individual employee emails take
    // over and this fallback goes silent.
    if (empList.length === 0 && typeof sendTaxMessagePracticeEmail === 'function') {
      try {
        await sendTaxMessagePracticeEmail({
          community, customer: cust, thread,
          message: { body: thread.last_message_preview, created_at: thread.last_message_at },
        });
      } catch (e) { warn('[tax-msg] practice email failed', e?.message || e); }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 3: employee portal
  //
  // Mirrors the Phase 2a customer auth pattern. Frontend sends
  //   x-firebase-uid, x-firebase-email, x-tax-community
  // on every employee-portal request. The middleware looks them up against
  // tax_employees. SECURITY NOTE: same caveat as Phase 2a — trust the
  // frontend-asserted headers in v1; harden with firebase-admin ID-token
  // verification before exposing beyond a trusted pilot.
  // ════════════════════════════════════════════════════════════════════════════

  async function requireTaxEmployee(req, res) {
    if (!requireSupabaseEnv(res)) return null;

    // Impersonation path mirrors requireTaxCustomer above. Used when an
    // admin previews an employee's view (different from previewing a
    // customer's view).
    const imp = await loadImpersonationFromRequest(req, res, 'employee');
    if (imp === false) return null;
    if (imp) {
      const { data: emp, error } = await supabase.from('tax_employees')
        .select('id, community_id, email, name, phone, whatsapp, address, preferred_communication_email, locale, notification_channels, role, status, firebase_uid')
        .eq('id', imp.target_id).maybeSingle();
      if (error) { sendSupabaseError(res, error); return null; }
      if (!emp) { res.status(404).json({ error: 'Impersonation target not found.' }); return null; }
      req.impersonation = imp;
      return emp;
    }

    const uid = trim(req.get('x-firebase-uid') || '', 200);
    const email = trim(req.get('x-firebase-email') || '', 200).toLowerCase();
    const communitySlug = trim(req.get('x-tax-community') || '', 200);
    if (!uid || !email || !communitySlug) {
      res.status(401).json({ error: 'Authentication required.' });
      return null;
    }
    const { data: emp, error } = await supabase.from('tax_employees')
      .select('id, community_id, email, name, phone, whatsapp, address, preferred_communication_email, locale, notification_channels, role, status, firebase_uid')
      .eq('email', email).eq('community_id', communitySlug).maybeSingle();
    if (error) { sendSupabaseError(res, error); return null; }
    if (!emp) {
      res.status(403).json({ error: 'Account not provisioned. Contact your practice administrator.' });
      return null;
    }
    if (emp.status !== 'active') {
      res.status(403).json({ error: 'Account is not active.' });
      return null;
    }
    if (emp.firebase_uid && emp.firebase_uid !== uid) {
      res.status(403).json({ error: 'Account collision. Contact your practice administrator.' });
      return null;
    }
    return emp;
  }

  function pickEmployee(e) {
    return {
      id: e.id, email: e.email, name: e.name, phone: e.phone,
      whatsapp: e.whatsapp || '',
      address: e.address || {},
      preferredCommunicationEmail: e.preferred_communication_email || '',
      locale: e.locale, role: e.role, status: e.status,
      notificationChannels: Array.isArray(e.notification_channels) ? e.notification_channels : ['in_app'],
    };
  }

  // ── POST /employee/auth/link ──
  router.post('/employee/auth/link', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const body = req.body || {};
    const uid = trim(body.uid, 200);
    const email = trim(body.email, 200).toLowerCase();
    const communitySlug = trim(body.communitySlug, 200);
    if (!uid || !email || !communitySlug) {
      return res.status(400).json({ error: 'uid, email, and communitySlug required.' });
    }
    const { data: emp, error } = await supabase.from('tax_employees')
      .select('id, community_id, email, name, locale, status, firebase_uid, role')
      .eq('email', email).eq('community_id', communitySlug).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!emp) return res.status(403).json({ error: 'Account not provisioned. Contact your practice administrator.' });
    if (emp.status !== 'active') return res.status(403).json({ error: 'Account is not active.' });
    if (emp.firebase_uid && emp.firebase_uid !== uid) {
      return res.status(403).json({ error: 'Account collision. Contact your practice administrator.' });
    }
    if (!emp.firebase_uid) {
      const { error: uErr } = await supabase.from('tax_employees')
        .update({ firebase_uid: uid, updated_at: new Date().toISOString() }).eq('id', emp.id);
      if (uErr) return sendSupabaseError(res, uErr);
      try {
        await auditLog({
          entity: 'tax.employee', entityId: emp.id, action: 'link_firebase',
          actorEmail: email, actorName: emp.name, after: { firebaseUidLinked: true },
        });
      } catch (_e) {}
    }
    res.json({ ok: true, employee: { ...emp, firebase_uid: uid } });
  });

  // ── GET /employee/me ──
  router.get('/employee/me', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const [{ data: community }, assignments] = await Promise.all([
      supabase.from('communities')
        .select('id, name, logo_url, brand_primary_color, brand_secondary_color, default_locale, contact_email, phone')
        .eq('id', emp.community_id).maybeSingle(),
      // Only fetch assignments for staff; for admin the list would be ALL
      // customers which is a different display ("All customers in this
      // community" — handled in the frontend on role=admin).
      emp.role === 'staff'
        ? supabase.from('tax_employee_customer_assignments')
            .select(`
              id, is_primary, created_at,
              customer:tax_customers ( id, email, name, phone, whatsapp, locale )
            `).eq('employee_id', emp.id).eq('active', true)
        : Promise.resolve({ data: [] }),
    ]);
    res.json({
      employee: pickEmployee(emp),
      community,
      // Always include the array (empty for admin) so the frontend
      // can always destructure it without branching.
      assignments: (assignments?.data || []),
    });
  });

  // ── PUT /employee/profile ──
  // Editable: name, phone, WhatsApp (E.164), address, preferredCommunicationEmail,
  //           notificationChannels (subset of ['in_app','email'], at least one).
  router.put('/employee/profile', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const body = req.body || {};
    const update = { updated_at: new Date().toISOString() };

    if (body.name !== undefined)  update.name  = trim(body.name, MAX_NAME_LEN);
    if (body.phone !== undefined) update.phone = trim(body.phone, MAX_PHONE_LEN);

    if (body.whatsapp !== undefined) {
      const raw = String(body.whatsapp || '').trim();
      if (raw === '') update.whatsapp = '';
      else {
        const norm = normalizeWhatsapp(raw);
        if (!norm) {
          return res.status(400).json({ error: 'whatsapp_invalid',
            message: 'WhatsApp must be in international format starting with + and country code, e.g., +14155551234.' });
        }
        update.whatsapp = norm;
      }
    }
    if (body.address !== undefined) update.address = sanitizeAddress(body.address);

    if (body.preferredCommunicationEmail !== undefined) {
      const raw = String(body.preferredCommunicationEmail || '').trim().toLowerCase();
      if (raw === '') update.preferred_communication_email = '';
      else if (!isValidEmail(raw)) {
        return res.status(400).json({ error: 'preferred_email_invalid',
          message: 'Preferred communication email is not valid.' });
      } else update.preferred_communication_email = raw.slice(0, MAX_NAME_LEN);
    }

    if (body.notificationChannels !== undefined) {
      const channels = (Array.isArray(body.notificationChannels) ? body.notificationChannels : [])
        .map(c => String(c).toLowerCase()).filter(c => c === 'email' || c === 'in_app');
      if (!channels.length) {
        return res.status(400).json({ error: 'channels_empty',
          message: 'Select at least one notification channel.' });
      }
      // Dedupe while preserving stable order in_app, email.
      update.notification_channels = ['in_app', 'email'].filter(c => channels.includes(c));
    }

    const { error } = await supabase.from('tax_employees').update(update).eq('id', emp.id);
    if (error) return sendSupabaseError(res, error);

    try {
      await auditLog({
        entity: 'tax.employee', entityId: emp.id, action: 'update_profile',
        actorEmail: emp.email, actorName: emp.name,
        after: Object.keys(update).filter(k => k !== 'updated_at'),
      });
    } catch (_e) {}

    const { data: refreshed } = await supabase.from('tax_employees')
      .select('id, community_id, email, name, phone, whatsapp, address, preferred_communication_email, locale, notification_channels, role, status, firebase_uid')
      .eq('id', emp.id).maybeSingle();
    res.json({ ok: true, employee: pickEmployee(refreshed) });
  });

  // ── Phase 3b visibility helper ──────────────────────────────────────────
  // Returns:
  //   null              → employee sees ALL customers in the community
  //                       (role === 'admin')
  //   string[]          → exact set of customer IDs the employee may see
  //                       (role === 'staff' with assignments — possibly empty)
  // Callers should treat [] as "nothing visible" and short-circuit lists.
  async function getVisibleCustomerIdsForEmployee(emp) {
    if (emp.role === 'admin') return null;
    const { data } = await supabase.from('tax_employee_customer_assignments')
      .select('customer_id').eq('employee_id', emp.id).eq('active', true);
    return (data || []).map(r => r.customer_id);
  }

  // Sugar: returns true when emp can see this customer (admin always can).
  async function canEmployeeSeeCustomer(emp, customerId) {
    if (emp.role === 'admin') return true;
    const { data } = await supabase.from('tax_employee_customer_assignments')
      .select('id').eq('employee_id', emp.id).eq('customer_id', customerId)
      .eq('active', true).maybeSingle();
    return Boolean(data);
  }

  // ── GET /employee/threads ── (scoped by assignments for staff role)
  router.get('/employee/threads', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const visible = await getVisibleCustomerIdsForEmployee(emp);
    if (Array.isArray(visible) && visible.length === 0) return res.json({ threads: [] });

    let q = supabase.from('tax_message_threads')
      .select(`
        id, subject, status, last_message_at, last_message_preview, last_message_by_role,
        practice_unread, created_at, customer_id,
        customer:tax_customers ( id, email, name )
      `)
      .eq('community_id', emp.community_id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(500);
    if (Array.isArray(visible)) q = q.in('customer_id', visible);
    if (req.query.unreadOnly === 'true') q = q.eq('practice_unread', true);
    const { data, error } = await q;
    if (error) return sendSupabaseError(res, error);
    res.json({ threads: data || [] });
  });

  // ── GET /employee/threads/:id ── (404 when staff isn't assigned)
  router.get('/employee/threads/:id', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const id = trim(req.params.id, 200);
    const { data: thread } = await supabase.from('tax_message_threads')
      .select(`
        id, customer_id, community_id, subject, status, related_period_id, related_document_id,
        last_message_at, practice_unread, customer_unread, created_at,
        customer:tax_customers ( id, email, name, locale, phone, whatsapp, preferred_communication_email )
      `).eq('id', id).maybeSingle();
    if (!thread || thread.community_id !== emp.community_id) {
      return res.status(404).json({ error: 'Thread not found.' });
    }
    if (!(await canEmployeeSeeCustomer(emp, thread.customer_id))) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const { data: messages, error } = await supabase.from('tax_messages')
      .select('id, author_role, author_email, author_name, body, attachments, created_at')
      .eq('thread_id', id).order('created_at', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    if (thread.practice_unread) {
      await supabase.from('tax_message_threads')
        .update({ practice_unread: false, updated_at: new Date().toISOString() }).eq('id', id);
    }
    res.json({ thread, messages: messages || [] });
  });

  // ── POST /employee/threads/:id/messages ──
  router.post('/employee/threads/:id/messages', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const id = trim(req.params.id, 200);
    const messageBody = trim(req.body?.body, MAX_MESSAGE_BODY);
    if (!messageBody) return res.status(400).json({ error: 'Message body required.' });

    const { data: thread } = await supabase.from('tax_message_threads')
      .select('id, customer_id, community_id, status').eq('id', id).maybeSingle();
    if (!thread || thread.community_id !== emp.community_id) {
      return res.status(404).json({ error: 'Thread not found.' });
    }
    if (!(await canEmployeeSeeCustomer(emp, thread.customer_id))) {
      return res.status(403).json({ error: 'You are not assigned to this customer.' });
    }
    if (thread.status === 'closed') return res.status(409).json({ error: 'This thread is closed.' });

    const msgId = await insertMessage({
      threadId: id,
      communityId: thread.community_id,
      customerId: thread.customer_id,
      role: 'practice',
      email: emp.email,
      name: emp.name,
      body: messageBody,
    });
    notifyCustomerOfPracticeMessage(id, thread.customer_id, msgId)
      .catch(e => warn('[tax-msg] customer notify failed', e?.message || e));
    res.json({ ok: true, messageId: msgId });
  });

  // ── POST /employee/threads/:id/read ──
  router.post('/employee/threads/:id/read', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const id = trim(req.params.id, 200);
    const { data: thread } = await supabase.from('tax_message_threads')
      .select('id, community_id, customer_id').eq('id', id).maybeSingle();
    if (!thread || thread.community_id !== emp.community_id) return res.status(404).json({ error: 'Thread not found.' });
    if (!(await canEmployeeSeeCustomer(emp, thread.customer_id))) {
      return res.status(404).json({ error: 'Thread not found.' });
    }
    const { error } = await supabase.from('tax_message_threads')
      .update({ practice_unread: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── GET /employee/notifications ──
  router.get('/employee/notifications', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const { data, error } = await supabase.from('tax_employee_notifications')
      .select('id, type, title_i18n, body_i18n, payload, read_at, created_at')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false }).limit(50);
    if (error) return sendSupabaseError(res, error);
    res.json({ notifications: data || [] });
  });

  // ── GET /employee/help ── (Phase 4c)
  // Employee-audience help articles. No per-relationship filtering for v1 —
  // employees see all employee articles regardless of role. (Admin tools
  // article is shown to staff too; the article text itself explains the
  // role gating.)
  router.get('/employee/help', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const { data, error } = await supabase.from('tax_help_articles')
      .select('id, category, display_order, title_i18n, body_i18n, source_note')
      .eq('audience', 'employee').eq('active', true)
      .order('display_order', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    res.json({ articles: data || [] });
  });

  // ── POST /employee/notifications/:id/read ──
  router.post('/employee/notifications/:id/read', async (req, res) => {
    const emp = await requireTaxEmployee(req, res); if (!emp) return;
    const id = trim(req.params.id, 200);
    const { error } = await supabase.from('tax_employee_notifications')
      .update({ read_at: new Date().toISOString() }).eq('id', id).eq('employee_id', emp.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // ── ADMIN: list / add employees (owner-side seeding until Phase 4a UI) ────
  router.get('/admin/employees', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const communitySlug = trim(req.query.communitySlug, 200);
    let q = supabase.from('tax_employees')
      .select('id, community_id, email, name, role, status, notification_channels, created_at, firebase_uid')
      .order('created_at', { ascending: false }).limit(200);
    if (communitySlug) q = q.eq('community_id', communitySlug);
    const { data, error } = await q;
    if (error) return sendSupabaseError(res, error);
    res.json({ employees: data || [] });
  });

  router.post('/admin/employees', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const body = req.body || {};
    const communitySlug = trim(body.communitySlug, 200);
    const email = trim(body.email, 200).toLowerCase();
    const name = trim(body.name, MAX_NAME_LEN);
    const role = (body.role === 'admin') ? 'admin' : 'staff';
    const locale = (body.locale === 'es') ? 'es' : 'en';
    if (!communitySlug || !email) return res.status(400).json({ error: 'communitySlug and email required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email is not valid.' });

    const id = 'emp_' + uuidv4().slice(0, 12);
    const { error } = await supabase.from('tax_employees').insert({
      id, community_id: communitySlug, email, name, role, locale,
    });
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true, id });
  });

  // ── ADMIN: impersonation (admin-only "view as") ─────────────────────────

  const IMPERSONATION_TTL_MS = 60 * 60 * 1000; // 1 hour
  const IMP_TOKEN_HEADER = 'x-impersonation-token';

  // Reads the impersonation token from the request and returns the active
  // session row if valid AND the target type matches; null when no token
  // is present (so callers can fall through to Firebase auth); false when a
  // token IS present but invalid (caller should bail — 401 already sent).
  async function loadImpersonationFromRequest(req, res, expectedTargetType) {
    const token = trim(req.get(IMP_TOKEN_HEADER) || '', 200);
    if (!token) return null;
    const { data: session, error } = await supabase.from('tax_impersonation_sessions')
      .select('id, community_id, admin_employee_id, admin_email, target_type, target_id, target_email, target_name, expires_at, ended_at')
      .eq('id', token).maybeSingle();
    if (error) { sendSupabaseError(res, error); return false; }
    if (!session) {
      res.status(401).json({ error: 'Impersonation session invalid.' });
      return false;
    }
    if (session.ended_at) {
      res.status(401).json({ error: 'Impersonation session ended.' });
      return false;
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      res.status(401).json({ error: 'Impersonation session expired.' });
      return false;
    }
    if (session.target_type !== expectedTargetType) {
      res.status(403).json({ error: 'Impersonation target type mismatch.' });
      return false;
    }
    return session;
  }

  // POST /admin/impersonation/start
  // Body { communitySlug, targetType: 'customer'|'employee', targetId }
  // Returns { token, target, expiresAt }.
  router.post('/admin/impersonation/start', async (req, res) => {
    const auth = await requireOwnerAdmin(req, res); if (!auth) return;
    const body = req.body || {};
    const communitySlug = trim(body.communitySlug, 200);
    const targetType = trim(body.targetType, 40);
    const targetId = trim(body.targetId, 200);
    if (!communitySlug || !targetId || !['customer', 'employee'].includes(targetType)) {
      return res.status(400).json({ error: 'communitySlug, targetType (customer|employee), and targetId required.' });
    }

    // The admin must be a role='admin' employee in this community. Global
    // admin (env header) callers can impersonate too — they look up the
    // first admin employee row for the community as the "admin_employee_id"
    // for the audit row. If none exists, the impersonation is rejected to
    // avoid orphaned audit trails.
    let adminEmployeeId = auth.employee?.id;
    let adminEmail = auth.email;
    if (!adminEmployeeId) {
      const { data: anyAdmin } = await supabase.from('tax_employees')
        .select('id, email').eq('community_id', communitySlug)
        .eq('role', 'admin').eq('status', 'active').limit(1).maybeSingle();
      if (!anyAdmin) {
        return res.status(409).json({ error: 'No admin employee exists in this community; create one before impersonating.' });
      }
      adminEmployeeId = anyAdmin.id;
    }

    let targetEmail = '';
    let targetName = '';
    if (targetType === 'customer') {
      const { data: cust } = await supabase.from('tax_customers')
        .select('id, community_id, email, name, status').eq('id', targetId).maybeSingle();
      if (!cust || cust.community_id !== communitySlug) return res.status(404).json({ error: 'Customer not found in this community.' });
      if (cust.status !== 'active') return res.status(409).json({ error: 'Customer is not active.' });
      targetEmail = cust.email; targetName = cust.name || '';
    } else {
      const { data: emp } = await supabase.from('tax_employees')
        .select('id, community_id, email, name, status').eq('id', targetId).maybeSingle();
      if (!emp || emp.community_id !== communitySlug) return res.status(404).json({ error: 'Employee not found in this community.' });
      if (emp.status !== 'active') return res.status(409).json({ error: 'Employee is not active.' });
      targetEmail = emp.email; targetName = emp.name || '';
    }

    const token = 'imp_' + crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MS).toISOString();
    const { error } = await supabase.from('tax_impersonation_sessions').insert({
      id: token,
      community_id: communitySlug,
      admin_employee_id: adminEmployeeId,
      admin_email: adminEmail,
      target_type: targetType,
      target_id: targetId,
      target_email: targetEmail,
      target_name: targetName,
      expires_at: expiresAt,
    });
    if (error) return sendSupabaseError(res, error);

    try {
      await auditLog({
        entity: 'tax.impersonation', entityId: token,
        action: 'start', actorEmail: adminEmail,
        after: { targetType, targetId, targetEmail, expiresAt },
      });
    } catch (_e) {}

    res.json({
      token,
      target: { type: targetType, id: targetId, email: targetEmail, name: targetName, communitySlug },
      expiresAt,
    });
  });

  // POST /admin/impersonation/:token/end
  router.post('/admin/impersonation/:token/end', async (req, res) => {
    // We allow ANY authenticated admin in the community to end any session
    // — practical for revoking sessions of departing admins. The session's
    // own community_id gates the action.
    const auth = await requireOwnerAdmin(req, res); if (!auth) return;
    const token = trim(req.params.token, 200);
    const { data: session } = await supabase.from('tax_impersonation_sessions')
      .select('id, community_id, target_id, target_type, admin_email').eq('id', token).maybeSingle();
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    await supabase.from('tax_impersonation_sessions')
      .update({ ended_at: new Date().toISOString() }).eq('id', token);
    try {
      await auditLog({
        entity: 'tax.impersonation', entityId: token,
        action: 'end', actorEmail: auth.email,
        after: { endedBy: auth.email, originalAdmin: session.admin_email },
      });
    } catch (_e) {}
    res.json({ ok: true });
  });

  // ── ADMIN: employee↔customer assignment management (Phase 3b) ────────────

  // GET /admin/employees/:id/assignments — list a staff member's roster
  router.get('/admin/employees/:id/assignments', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const empId = trim(req.params.id, 200);
    const { data, error } = await supabase.from('tax_employee_customer_assignments')
      .select(`
        id, employee_id, customer_id, is_primary, active, created_at, assigned_by_email,
        customer:tax_customers ( id, email, name, phone, status )
      `)
      .eq('employee_id', empId).eq('active', true).order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    res.json({ assignments: data || [] });
  });

  // POST /admin/employees/:id/assignments — assign a customer to an employee
  // Body: { customerId, isPrimary? }
  router.post('/admin/employees/:id/assignments', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const empId = trim(req.params.id, 200);
    const customerId = trim(req.body?.customerId, 200);
    const isPrimary = Boolean(req.body?.isPrimary);
    if (!customerId) return res.status(400).json({ error: 'customerId required.' });

    const [{ data: emp }, { data: cust }] = await Promise.all([
      supabase.from('tax_employees').select('id, community_id').eq('id', empId).maybeSingle(),
      supabase.from('tax_customers').select('id, community_id').eq('id', customerId).maybeSingle(),
    ]);
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });
    if (!cust) return res.status(404).json({ error: 'Customer not found.' });
    if (emp.community_id !== cust.community_id) {
      return res.status(400).json({ error: 'Employee and customer belong to different communities.' });
    }

    const id = 'asn_' + uuidv4().slice(0, 12);
    const actor = trim(req.get('x-admin-email') || '', 200).toLowerCase();
    // Upsert reactivates a previously soft-deleted row in place.
    const { error } = await supabase.from('tax_employee_customer_assignments').upsert({
      id,
      community_id: emp.community_id,
      employee_id: empId,
      customer_id: customerId,
      is_primary: isPrimary,
      assigned_by_email: actor || null,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_id,customer_id' });
    if (error) return sendSupabaseError(res, error);
    try {
      await auditLog({
        entity: 'tax.employee_assignment', entityId: `${empId}:${customerId}`,
        action: 'assign', actorEmail: actor || 'admin',
        after: { employeeId: empId, customerId, isPrimary },
      });
    } catch (_e) {}
    res.json({ ok: true });
  });

  // DELETE /admin/employees/:id/assignments/:customerId — soft delete
  router.delete('/admin/employees/:id/assignments/:customerId', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const empId = trim(req.params.id, 200);
    const customerId = trim(req.params.customerId, 200);
    const { error } = await supabase.from('tax_employee_customer_assignments')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('employee_id', empId).eq('customer_id', customerId);
    if (error) return sendSupabaseError(res, error);
    res.json({ ok: true });
  });

  // GET /admin/customers/:id/assignments — list employees on a customer
  router.get('/admin/customers/:id/assignments', async (req, res) => {
    if (!(await requireOwnerAdmin(req, res))) return;
    const customerId = trim(req.params.id, 200);
    const { data, error } = await supabase.from('tax_employee_customer_assignments')
      .select(`
        id, employee_id, customer_id, is_primary, active, created_at, assigned_by_email,
        employee:tax_employees ( id, email, name, role, status )
      `)
      .eq('customer_id', customerId).eq('active', true).order('is_primary', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    res.json({ assignments: data || [] });
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
    return {
      id: c.id, email: c.email, name: c.name,
      phone: c.phone, whatsapp: c.whatsapp || '',
      address: c.address || {},
      preferredCommunicationEmail: c.preferred_communication_email || '',
      locale: c.locale, status: c.status,
    };
  }

  // ── Phase 2e helpers ───────────────────────────────────────────────────────
  // Strip every character except digits and a leading +, then verify the
  // result is valid E.164: starts with +, first digit 1-9, total 7-15 digits.
  // Returns the normalized string (e.g. "+14155551234") or null on failure.
  function normalizeWhatsapp(raw) {
    const trimmed = String(raw || '').trim();
    // Keep only digits and a single leading +.
    const cleaned = '+' + trimmed.replace(/^\+/, '').replace(/\D+/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) return null;
    return cleaned;
  }

  // Sanitize an address payload into the canonical { line1, line2, city,
  // state, postal_code, country } shape. Drops unknown keys, trims strings,
  // and caps each to MAX_NAME_LEN. country defaults to 'US' when an address
  // line is present.
  function sanitizeAddress(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const fields = ['line1', 'line2', 'city', 'state', 'postal_code', 'country'];
    const out = {};
    for (const k of fields) {
      const v = input[k];
      if (typeof v === 'string') {
        const t = v.trim().slice(0, MAX_NAME_LEN);
        if (t) out[k] = t;
      }
    }
    if (out.line1 && !out.country) out.country = 'US';
    return out;
  }

  return router;
};
