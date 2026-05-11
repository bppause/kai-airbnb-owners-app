// Reminder cron + dispatcher for the tax compliance reminders feature.
//
// Per run, this:
//   1. For each active subscription, generates `tax_filing_periods` rows for
//      the next 12 months on each active schedule (idempotent via unique key).
//   2. For each pending/info_requested period, computes the reminder fire
//      dates (due_date + reminder_offsets_days) and fires today's reminders
//      across the subscription's configured channels (email, in_app, or both).
//   3. Logs each dispatch into `tax_reminder_log`. The unique-when-sent index
//      on (period_id, channel, offset_days) prevents double-firing across
//      restarts.
//
// Public exports:
//   run()                              — execute one cycle (testable)
//   start({ intervalMs, initialDelayMs }) — kick off the recurring schedule

'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../../logger');
const { generatePeriods, reminderFireDates, toYmd } = require('./schedule');

const PERIOD_LOOKAHEAD = 6;   // how many upcoming periods per schedule to keep populated
const DEFAULT_TOKEN_VALID_DAYS_AFTER_DUE = 14;

module.exports = function createTaxRemindersCron(deps) {
  const {
    supabase,
    isSupabaseConfigured,
    publicAppUrl,
    emailConfigured,
    sendTaxReminderEmail,
    auditLog,
  } = deps;

  const todayUtc = () => toYmd(new Date());

  // ── Step 1: generate upcoming filing periods for each active subscription ──
  async function ensureUpcomingPeriods() {
    const { data: subs, error } = await supabase
      .from('tax_subscriptions')
      .select('id, community_id, customer_id, product_id, active_schedule_slugs, status, start_date')
      .eq('status', 'active');
    if (error) { warn('[tax-cron] fetch subscriptions failed', error.message); return 0; }

    let created = 0;
    for (const sub of subs || []) {
      const { data: schedules, error: sErr } = await supabase
        .from('tax_filing_schedules')
        .select('id, slug, anchor_rule, enabled, community_id')
        .eq('product_id', sub.product_id)
        .eq('enabled', true);
      if (sErr) { warn('[tax-cron] fetch schedules failed', sErr.message); continue; }

      const activeSlugs = Array.isArray(sub.active_schedule_slugs) && sub.active_schedule_slugs.length
        ? new Set(sub.active_schedule_slugs)
        : null;

      const refDate = sub.start_date && sub.start_date > todayUtc() ? sub.start_date : todayUtc();

      for (const sch of schedules || []) {
        if (activeSlugs && !activeSlugs.has(sch.slug)) continue;
        const periods = generatePeriods(sch.anchor_rule, refDate, PERIOD_LOOKAHEAD, { lang: 'es' });
        for (const p of periods) {
          const id = 'tp_' + crypto.createHash('sha1')
            .update(`${sub.id}|${sch.id}|${p.dueDate}`).digest('hex').slice(0, 16);
          const row = {
            id,
            community_id: sub.community_id,
            subscription_id: sub.id,
            schedule_id: sch.id,
            customer_id: sub.customer_id,
            period_label: p.periodLabel,
            period_start: p.periodStart,
            period_end: p.periodEnd,
            due_date: p.dueDate,
            status: 'pending',
          };
          const { error: insErr } = await supabase
            .from('tax_filing_periods').insert(row);
          if (!insErr) created++;
          // Duplicate-key error is expected and ignored — periods are idempotent.
        }
      }
    }
    return created;
  }

  // ── Step 2: fire today's reminders ──────────────────────────────────────────
  async function fireReminders() {
    const today = todayUtc();

    // Pull periods due in the next ~21 days that haven't reached a terminal state.
    const { data: rows, error } = await supabase
      .from('tax_filing_periods')
      .select(`
        id, community_id, subscription_id, customer_id, schedule_id, status,
        period_label, period_start, period_end, due_date,
        tax_subscriptions!inner ( reminder_channels, reminder_offsets_days, custom_info_checklist ),
        tax_customers!inner ( id, email, name, locale ),
        tax_filing_schedules!inner ( id, slug, name_i18n, description_i18n, info_checklist )
      `)
      .in('status', ['pending', 'info_requested'])
      .gte('due_date', today)
      .lte('due_date', shiftDays(today, 30));
    if (error) { warn('[tax-cron] fetch periods failed', error.message); return 0; }

    let fired = 0;
    for (const row of rows || []) {
      const sub = row.tax_subscriptions;
      const cust = row.tax_customers;
      const sch = row.tax_filing_schedules;
      const offsets = Array.isArray(sub.reminder_offsets_days) && sub.reminder_offsets_days.length
        ? sub.reminder_offsets_days : [-14, -7, -3];
      const channels = Array.isArray(sub.reminder_channels) && sub.reminder_channels.length
        ? sub.reminder_channels : ['email', 'in_app'];

      const dates = reminderFireDates(row.due_date, offsets);
      for (let i = 0; i < offsets.length; i++) {
        if (dates[i] !== today) continue;
        for (const channel of channels) {
          const sent = await dispatchOne({ row, sub, cust, sch, channel, offsetDays: offsets[i] });
          if (sent) fired++;
        }
      }
    }
    return fired;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function dispatchOne({ row, sub, cust, sch, channel, offsetDays }) {
    // Pre-flight de-dup: skip if a sent log row already exists for this combo.
    const { data: existing } = await supabase
      .from('tax_reminder_log')
      .select('id')
      .eq('period_id', row.id).eq('channel', channel).eq('offset_days', offsetDays).eq('status', 'sent')
      .maybeSingle();
    if (existing?.id) return false;

    const token = await ensureResponseToken(row);
    const magicUrl = `${publicAppUrl()}/tax/respond/${token.raw}`;

    let result = { sent: false, reason: 'noop' };
    if (channel === 'email') {
      if (!emailConfigured) {
        result = { sent: false, reason: 'email_not_configured' };
      } else {
        try {
          await sendTaxReminderEmail({ row, cust, sch, sub, magicUrl, offsetDays });
          result = { sent: true };
        } catch (e) {
          result = { sent: false, reason: e?.message || 'send_failed' };
        }
      }
    } else if (channel === 'in_app') {
      const notif = {
        id: 'tnotif_' + uuidv4().slice(0, 12),
        community_id: row.community_id,
        customer_id: cust.id,
        type: 'reminder',
        title_i18n: {
          es: `Recordatorio: ${pickI18n(sch.name_i18n, 'es')} vence el ${row.due_date}`,
          en: `Reminder: ${pickI18n(sch.name_i18n, 'en')} due ${row.due_date}`,
        },
        body_i18n: {
          es: `Por favor proporcione la información requerida para ${row.period_label}.`,
          en: `Please provide the information needed for ${row.period_label}.`,
        },
        payload: { periodId: row.id, scheduleSlug: sch.slug, magicUrl, offsetDays },
      };
      const { error: nErr } = await supabase.from('tax_notifications').insert(notif);
      result = nErr ? { sent: false, reason: nErr.message } : { sent: true };
    }

    await supabase.from('tax_reminder_log').insert({
      id: 'trlog_' + uuidv4().slice(0, 12),
      period_id: row.id,
      channel,
      offset_days: offsetDays,
      status: result.sent ? 'sent' : 'failed',
      reason: result.sent ? '' : String(result.reason || '').slice(0, 500),
    });

    // First time we fire any reminder for this period, advance status.
    if (result.sent && row.status === 'pending') {
      await supabase.from('tax_filing_periods')
        .update({ status: 'info_requested', updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }
    if (result.sent && typeof auditLog === 'function') {
      try {
        await auditLog({
          entity: 'tax.reminder', entityId: row.id, action: 'send',
          actorEmail: '', actorName: 'tax-cron',
          after: { channel, offsetDays, scheduleSlug: sch.slug, dueDate: row.due_date },
        });
      } catch (_e) {}
    }
    return result.sent;
  }

  async function ensureResponseToken(period) {
    // Reuse a still-valid token if one exists, otherwise mint a new one.
    const { data: existing } = await supabase
      .from('tax_response_tokens')
      .select('id, token_hash, expires_at, used_at')
      .eq('period_id', period.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (existing?.id) {
      // We never store the raw token, so when reusing we need to mint a new
      // raw value and rotate the hash. Simpler: always mint fresh on reuse.
    }
    const raw = crypto.randomBytes(24).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() +
      DEFAULT_TOKEN_VALID_DAYS_AFTER_DUE +
      Math.max(0, Math.ceil((new Date(period.due_date) - new Date()) / 86400000)));
    await supabase.from('tax_response_tokens').insert({
      id: 'trtok_' + uuidv4().slice(0, 12),
      period_id: period.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });
    return { raw, hash: tokenHash };
  }

  function shiftDays(iso, days) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return toYmd(d);
  }

  function pickI18n(obj, locale) {
    if (obj && typeof obj === 'object') {
      const v = obj[locale];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof obj.en === 'string') return obj.en;
    }
    return '';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async function run() {
    if (!isSupabaseConfigured) return { skipped: true, reason: 'supabase_not_configured' };
    try {
      const created = await ensureUpcomingPeriods();
      const fired = await fireReminders();
      return { created, fired };
    } catch (e) {
      warn('[tax-cron] run failed', e?.message || e);
      return { error: e?.message || 'unknown' };
    }
  }

  function start({ intervalMs = 12 * 60 * 60 * 1000, initialDelayMs = 60 * 1000 } = {}) {
    setTimeout(() => {
      run().catch(e => warn('[tax-cron] initial run threw', e?.message || e));
      setInterval(() => {
        run().catch(e => warn('[tax-cron] interval run threw', e?.message || e));
      }, intervalMs);
    }, initialDelayMs);
  }

  return { run, start };
};
