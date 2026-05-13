// Shared urgency-color helper. Drives the colored due-date treatment
// on the Tasks list, Calendar pips, and Kanban cards — same visual
// language everywhere.
//
// Two thresholds per community drive the model:
//   urgent_days — due within N days → RED (matches the "overdue"
//                 color so the brain reads "act today")
//   soon_days   — due within N days → ORANGE
// Anything past today is always overdue (red), and anything farther
// out than soon_days has NO color so the operator's eye stays on
// the items that need attention right now.

const DEFAULTS = { urgent: 2, soon: 7 };

export function resolveThresholds(community) {
  return {
    urgent: Number(community?.tax_task_urgent_days ?? DEFAULTS.urgent),
    soon:   Number(community?.tax_task_soon_days   ?? DEFAULTS.soon),
  };
}

// Returns one of:
//   'overdue' — strictly before today (red)
//   'urgent'  — today + within urgent_days (red)
//   'soon'    — within soon_days (orange)
//   'later'   — farther out, or no due date (NO color)
export function urgencyOf(dueDate, thresholds, todayIso) {
  if (!dueDate) return 'later';
  const today = todayIso || new Date().toISOString().slice(0, 10);
  if (dueDate < today) return 'overdue';
  const days = Math.round((Date.parse(dueDate) - Date.parse(today)) / 86400000);
  const th = thresholds || DEFAULTS;
  if (days <= th.urgent) return 'urgent';
  if (days <= th.soon)   return 'soon';
  return 'later';
}

// Color tokens by bucket. 'later' renders transparent so it visually
// disappears — the point is to make the operator's eye land on red
// and orange items only.
export const URGENCY_COLORS = {
  overdue: { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626', bar: '#dc2626' },
  urgent:  { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626', bar: '#dc2626' },
  soon:    { bg: '#ffedd5', fg: '#9a3412', dot: '#ea580c', bar: '#ea580c' },
  later:   { bg: 'transparent', fg: 'var(--tax-muted)', dot: 'transparent', bar: 'transparent' },
};

export function colorOf(urgency) {
  return URGENCY_COLORS[urgency] || URGENCY_COLORS.later;
}

export const URGENCY_LABEL_KEY = {
  overdue: 'owner.tasks.urgency.overdue',
  urgent:  'owner.tasks.urgency.urgent',
  soon:    'owner.tasks.urgency.soon',
  later:   'owner.tasks.urgency.later',
};
