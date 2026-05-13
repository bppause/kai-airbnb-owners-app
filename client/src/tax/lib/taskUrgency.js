// Shared urgency-color helper. Drives the colored due-date pills on
// the Tasks list, the day-cell pips on the Calendar, and the card
// borders on the Kanban — same visual language everywhere.
//
// Thresholds come from the community row (tax_task_urgent_days,
// tax_task_soon_days, tax_task_upcoming_days). Pass the whole
// community object or just an overrides object; defaults fall back
// to 3 / 7 / 30 days.

const DEFAULTS = { urgent: 3, soon: 7, upcoming: 30 };

export function resolveThresholds(community) {
  return {
    urgent:   Number(community?.tax_task_urgent_days   ?? DEFAULTS.urgent),
    soon:     Number(community?.tax_task_soon_days     ?? DEFAULTS.soon),
    upcoming: Number(community?.tax_task_upcoming_days ?? DEFAULTS.upcoming),
  };
}

// Compute the urgency bucket for a due date. Returns one of:
//   'overdue'  — strictly before today
//   'urgent'   — today + within urgent_days
//   'soon'     — within soon_days
//   'upcoming' — within upcoming_days
//   'later'    — farther out, or no due date
export function urgencyOf(dueDate, thresholds, todayIso) {
  if (!dueDate) return 'later';
  const today = todayIso || new Date().toISOString().slice(0, 10);
  if (dueDate < today) return 'overdue';
  const days = Math.round((Date.parse(dueDate) - Date.parse(today)) / 86400000);
  const th = thresholds || DEFAULTS;
  if (days <= th.urgent)   return 'urgent';
  if (days <= th.soon)     return 'soon';
  if (days <= th.upcoming) return 'upcoming';
  return 'later';
}

// Color tokens by bucket. bg = chip background, fg = chip text,
// dot = small colored circle for calendar pips, bar = card-left
// accent for Kanban.
export const URGENCY_COLORS = {
  overdue:  { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626', bar: '#dc2626' },
  urgent:   { bg: '#ffedd5', fg: '#9a3412', dot: '#ea580c', bar: '#ea580c' },
  soon:     { bg: '#fef3c7', fg: '#92400e', dot: '#d97706', bar: '#d97706' },
  upcoming: { bg: '#dbeafe', fg: '#1e40af', dot: '#2563eb', bar: '#2563eb' },
  later:    { bg: '#f3f4f6', fg: '#6b7280', dot: '#9ca3af', bar: '#d1d5db' },
};

export function colorOf(urgency) {
  return URGENCY_COLORS[urgency] || URGENCY_COLORS.later;
}

// Label key for a urgency bucket — caller passes through t().
export const URGENCY_LABEL_KEY = {
  overdue:  'owner.tasks.urgency.overdue',
  urgent:   'owner.tasks.urgency.urgent',
  soon:     'owner.tasks.urgency.soon',
  upcoming: 'owner.tasks.urgency.upcoming',
  later:    'owner.tasks.urgency.later',
};
