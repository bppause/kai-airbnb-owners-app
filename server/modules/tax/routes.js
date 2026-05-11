// Tax module — HTTP routes (Phase 1).
//
// Mounted at /api/m/tax/* from server/index.js.
//
// Endpoints:
//   GET  /community/:slug          — public; community branding + enabled products for the landing page
//   POST /leads                    — public; anonymous contact-form submission
//   GET  /leads                    — owner-only (deferred to Phase 4); returns 501 for now
//
// Phase 2+ will add: /auth/*, /engagements/*, /documents/*, /messages/*, /products/*.

'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../../logger');
const { isValidEmail, normalizeLanguage } = require('../../core/utils');

const TAX_BUSINESS_TYPE = 'tax';
const MAX_TEXT_LEN = 4000;
const MAX_NAME_LEN = 200;
const MAX_PHONE_LEN = 40;

const trim = (v, max) => String(v || '').trim().slice(0, max);
const localeOf = (v) => (normalizeLanguage(v) === 'en' ? 'en' : 'es');

module.exports = function createTaxRouter(deps) {
  const {
    supabase, requireSupabaseEnv, sendSupabaseError,
    auditLog,
    sendTaxLeadEmail,
  } = deps;

  const router = express.Router();

  // ── GET /community/:slug ────────────────────────────────────────────────────
  // Returns the community record + ordered list of enabled products. Used by
  // the landing page to render branding, services, contact info.
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
  // Public, anonymous. Stores a lead and (best-effort) emails the community
  // contact address. Required: communitySlug, name, email. Optional: phone,
  // productSlug, message, locale.
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

    // Honeypot — if the hidden field is filled, silently accept and drop.
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
      try {
        await sendTaxLeadEmail({ community, lead: inserted });
      } catch (e) {
        warn('[tax] lead notification email failed', e?.message || e);
      }
    }

    res.json({ ok: true, id: inserted.id });
  });

  // ── GET /leads ──────────────────────────────────────────────────────────────
  // Owner-only inbox view. Auth + permission checks land in Phase 4 alongside
  // the owner dashboard. Stubbed now so the route name is reserved.
  router.get('/leads', (_req, res) => {
    res.status(501).json({ error: 'Lead inbox not implemented yet (Phase 4).' });
  });

  return router;
};
