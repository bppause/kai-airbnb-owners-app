// SLA escalation cron loop for the incidents module.
//
// Walks pending incidents whose `next_sla_reminder_at` has elapsed, fires
// the appropriate escalation email (per-unit or general-incident), and
// either schedules the next reminder cycle or clears the timer when both
// owner steps are complete.
//
// Lifted byte-identical from server.js stage 4j.
//
// Public exports (returned by the factory):
//   run()        — execute one escalation cycle (also exposed for testing)
//   start({ intervalMs, initialDelayMs }) — kick off the recurring schedule

'use strict';

const { warn } = require('../../../logger');
const { addHoursIso, publicAppUrl } = require('../../core/utils');
const { incidentFromDb, listingFromDb } = require('../../core/db-converters');

module.exports = function createSlaCron(deps) {
  const {
    supabase,
    emailConfigured,
    isSupabaseConfigured,           // boolean snapshot (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
    getSlaHours,
    getSlaPolicy,
    sendIncidentEmail, sendGeneralIncidentSlaEmail,
  } = deps;

  // Resolve the active SLA event for a row. Older rows pre-migration may
  // have sla_event = NULL; infer from status/owner_resolution to keep them
  // firing until they're resolved.
  const resolveSlaEvent = (row) => {
    if (row.sla_event) return row.sla_event;
    if (row.status === 'resolved') return null;
    if (row.status === 'verified' && String(row.owner_resolution || '').trim()) return 'admin_close';
    if (row.status === 'verified') return 'step2_resolve';
    return 'step1_verify';
  };

  // Cap reached → stop firing. Returns true if the row was just capped.
  const enforceCap = async (row, policy) => {
    const cycles = Number(row.sla_cycle_count || 0);
    const cap = Number(policy?.maxReminders);
    if (Number.isFinite(cap) && cap >= 0 && cycles >= cap) {
      await supabase.from('incidents').update({ next_sla_reminder_at: null }).eq('id', row.id);
      return true;
    }
    return false;
  };

  const run = async () => {
    if (!isSupabaseConfigured || !emailConfigured) return;
    try {
      const now = new Date().toISOString();
      // Fire for any incident with an active reminder timer that has elapsed.
      // sla_event indicates which clock is active; null = terminal.
      const { data: rows, error } = await supabase
        .from('incidents')
        .select('*, listings(*)')
        .neq('status', 'resolved')
        .not('next_sla_reminder_at', 'is', null)
        .lte('next_sla_reminder_at', now)
        .order('next_sla_reminder_at', { ascending:true })
        .limit(10);
      if (error) { warn('SLA escalation query failed: ' + error.message); return; }
      for (const row of rows || []) {
        const listing = row.listings;
        const event = resolveSlaEvent(row);
        if (!event) { await supabase.from('incidents').update({ next_sla_reminder_at: null }).eq('id', row.id); continue; }
        const policy = await getSlaPolicy(event, row.community_id || 'kai');
        const slaHours = Number(row.sla_hours || policy.hours || await getSlaHours() || 24);
        if (await enforceCap(row, policy)) continue;
        if (!listing) {
          // General incident — no unit owner; alert admins to assign or close it.
          if (row.is_general) {
            try {
              const inc = incidentFromDb(row);
              await sendGeneralIncidentSlaEmail(inc, slaHours, publicAppUrl(), row.community_id || 'kai');
              await supabase.from('incidents').update({ sla_cycle_count: Number(row.sla_cycle_count||0)+1, next_sla_reminder_at: addHoursIso(now, slaHours) }).eq('id', row.id);
            } catch(e) {
              warn('General incident SLA email failed for ' + row.id + ': ' + (e?.message || e));
              await supabase.from('incidents').update({ next_sla_reminder_at: addHoursIso(now, 1) }).eq('id', row.id);
            }
          }
          continue;
        }
        const inc = incidentFromDb(row);
        // Map the SLA event onto the existing email vars consumers expect.
        // step1_verify → step1; step2_resolve / admin_close → step2 (the
        // owner's perspective on admin_close is "your case is awaiting admin
        // closure" but the email body still highlights step2 context).
        const pendingStep = event === 'step1_verify' ? 'step1' : 'step2';
        const pendingStepLabel = event === 'step1_verify'
          ? 'Step 1: Verify the incident — confirm guest details and document your immediate action'
          : (event === 'admin_close'
              ? 'Awaiting admin closure — your resolution is in; an admin will formally close the incident'
              : 'Step 2: Add your resolution — describe how you resolved this so admin can close it');
        const pendingStepLabelEs = event === 'step1_verify'
          ? 'Paso 1: Verifica el incidente — confirma los datos del huésped y documenta tu acción inmediata'
          : (event === 'admin_close'
              ? 'Esperando cierre del admin — tu respuesta ya está; un admin cerrará formalmente el incidente'
              : 'Paso 2: Agrega tu respuesta — describe cómo resolviste el incidente para que el admin pueda cerrarlo');
        try {
          await sendIncidentEmail({ listing: listingFromDb(listing), incident: { ...inc, pendingStep, pendingStepLabel, pendingStepLabelEs }, appUrl: publicAppUrl(), includeEscalationCc:true, isEscalation:true });
          await supabase.from('incidents').update({ sla_cycle_count: Number(row.sla_cycle_count || 0) + 1, next_sla_reminder_at: addHoursIso(now, slaHours) }).eq('id', row.id);
        } catch(e) {
          warn('SLA escalation email failed for ' + row.id + ': ' + (e?.message || e));
          await supabase.from('incidents').update({ next_sla_reminder_at: addHoursIso(now, 1) }).eq('id', row.id);
        }
      }
    } catch(e) { warn('SLA escalation cycle failed: ' + (e?.message || e)); }
  };

  const start = ({
    intervalMs = Number(process.env.SLA_CHECK_INTERVAL_MS || 15 * 60 * 1000),
    initialDelayMs = 15000,
  } = {}) => {
    setInterval(run, intervalMs);
    setTimeout(run, initialDelayMs);
  };

  return { run, start };
};
