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
    sendIncidentEmail, sendGeneralIncidentSlaEmail,
  } = deps;

  const run = async () => {
    if (!isSupabaseConfigured || !emailConfigured) return;
    try {
      const now = new Date().toISOString();
      // Fire for: open (Step 1 pending) OR verified-without-resolution (Step 2 pending)
      // next_sla_reminder_at is kept active until both steps are complete.
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
        if (!listing) {
          // General incident — no unit owner; alert admins to assign or close it.
          if (row.is_general) {
            try {
              const inc = incidentFromDb(row);
              const slaHours = Number(row.sla_hours || await getSlaHours() || 24);
              await sendGeneralIncidentSlaEmail(inc, slaHours, publicAppUrl(), row.community_id || 'kai');
              await supabase.from('incidents').update({ sla_cycle_count: Number(row.sla_cycle_count||0)+1, next_sla_reminder_at: addHoursIso(now, slaHours) }).eq('id', row.id);
            } catch(e) {
              warn('General incident SLA email failed for ' + row.id + ': ' + (e?.message || e));
              await supabase.from('incidents').update({ next_sla_reminder_at: addHoursIso(now, 1) }).eq('id', row.id);
            }
          }
          continue;
        }
        // Skip verified+resolved-resolution (both steps done — next_sla should already be null, but guard here)
        if (row.status === 'verified' && String(row.owner_resolution || '').trim()) {
          await supabase.from('incidents').update({ next_sla_reminder_at: null }).eq('id', row.id);
          continue;
        }
        const inc = incidentFromDb(row);
        const slaHours = Number(row.sla_hours || await getSlaHours() || 24);
        // Add context so email templates can explain exactly what step is pending
        const pendingStep = row.status === 'open'
          ? 'step1' // Needs: verify + guest info + action
          : 'step2'; // Needs: resolution text
        const pendingStepLabel = pendingStep === 'step1'
          ? 'Step 1: Verify the incident — confirm guest details and document your immediate action'
          : 'Step 2: Add your resolution — describe how you resolved this so admin can close it';
        const pendingStepLabelEs = pendingStep === 'step1'
          ? 'Paso 1: Verifica el incidente — confirma los datos del huésped y documenta tu acción inmediata'
          : 'Paso 2: Agrega tu respuesta — describe cómo resolviste el incidente para que el admin pueda cerrarlo';
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
