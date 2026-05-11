// Client-side mirror of server/modules/tax/schedule.js — pure functions that
// compute upcoming filing due-dates from a `tax_filing_schedules.anchor_rule`.
// Kept thin (no DB, no I/O) so the workflows page can render a "next N days"
// reminder preview without an extra round-trip. If the server's anchor-rule
// shapes ever change, mirror them here.

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function parseMmDd(s) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
  if (!m) return null;
  return { month: parseInt(m[1], 10), day: parseInt(m[2], 10) };
}

function toYmd(d) {
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function fixedQuarterly(rule, refIso, refYear, limit) {
  const parsed = (rule.dates || []).map(parseMmDd).filter(Boolean);
  if (!parsed.length) return [];
  const out = [];
  for (let y = refYear - 1; y < refYear + 3 && out.length < limit + 8; y++) {
    let prevMonth = -1;
    parsed.forEach((p) => {
      const dueYear = (prevMonth >= 0 && p.month < prevMonth) ? y + 1 : y;
      prevMonth = p.month;
      const day = Math.min(p.day, lastDayOfMonth(dueYear, p.month));
      out.push({ dueDate: ymd(dueYear, p.month, day) });
    });
  }
  return out
    .filter(p => p.dueDate >= refIso)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, limit);
}

function monthlyFollowing(rule, ref, refYear, limit) {
  const day = Math.max(1, Math.min(28, parseInt(rule.day, 10) || 20));
  const refIso = toYmd(ref);
  const out = [];
  let y = refYear;
  let m = ref.getUTCMonth() - 1;
  while (m < 0) { m += 12; y -= 1; }
  for (let i = 0; i < 36 && out.length < limit; i++) {
    const periodMonth = m + 1;
    const dueY = periodMonth === 12 ? y + 1 : y;
    const dueM = periodMonth === 12 ? 1 : periodMonth + 1;
    const dueD = Math.min(day, lastDayOfMonth(dueY, dueM));
    const due = ymd(dueY, dueM, dueD);
    if (due >= refIso) out.push({ dueDate: due });
    m += 1;
    if (m > 11) { m -= 12; y += 1; }
  }
  return out;
}

function annual(rule, refIso, refYear, limit) {
  const p = parseMmDd(rule.date);
  if (!p) return [];
  const out = [];
  for (let year = refYear; year < refYear + 4 && out.length < limit; year++) {
    const day = Math.min(p.day, lastDayOfMonth(year, p.month));
    const due = ymd(year, p.month, day);
    if (due >= refIso) out.push({ dueDate: due });
  }
  return out;
}

function quarterlyFollowing(rule, ref, refYear, limit) {
  const day = Math.max(1, Math.min(28, parseInt(rule.day, 10) || 15));
  const refIso = toYmd(ref);
  const out = [];
  const quarters = [
    { dueMonth: 4 }, { dueMonth: 7 }, { dueMonth: 10 }, { dueMonth: 1, off: 1 },
  ];
  for (let y = refYear - 1; y < refYear + 4 && out.length < limit + 4; y++) {
    quarters.forEach((cfg) => {
      const dueYear = y + (cfg.off || 0);
      const dueDay = Math.min(day, lastDayOfMonth(dueYear, cfg.dueMonth));
      const due = ymd(dueYear, cfg.dueMonth, dueDay);
      if (due >= refIso) out.push({ dueDate: due });
    });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, limit);
}

function weeklyFollowing(rule, ref, limit) {
  const dow = Math.max(1, Math.min(7, parseInt(rule.dayOfWeek, 10) || 5));
  const refIso = toYmd(ref);
  const out = [];
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const isoDay = (date) => { const js = date.getUTCDay(); return js === 0 ? 7 : js; };
  while (isoDay(d) !== dow) d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < limit; i++) {
    const due = toYmd(d);
    if (due >= refIso) out.push({ dueDate: due });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

export function generatePeriods(anchorRule, fromDate, limit = 8) {
  const ref = fromDate instanceof Date ? fromDate : new Date(fromDate || Date.now());
  const refIso = toYmd(ref);
  const refYear = ref.getUTCFullYear();
  const rule = anchorRule || {};
  if (rule.type === 'fixed_quarterly') return fixedQuarterly(rule, refIso, refYear, limit);
  if (rule.type === 'monthly_following') return monthlyFollowing(rule, ref, refYear, limit);
  if (rule.type === 'quarterly_following') return quarterlyFollowing(rule, ref, refYear, limit);
  if (rule.type === 'weekly_following') return weeklyFollowing(rule, ref, limit);
  if (rule.type === 'annual') return annual(rule, refIso, refYear, limit);
  return [];
}

export function shiftDays(dueDateIso, days) {
  const d = new Date(dueDateIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

// Given upcoming due dates and positive "days before due" offsets, returns
// each future reminder fire (>= todayIso) as { dateIso, dueDate, offset }.
export function upcomingReminderFires(periods, offsetsDaysBefore, todayIso, maxDays) {
  const out = [];
  const horizon = shiftDays(todayIso, maxDays);
  for (const p of periods) {
    for (const off of offsetsDaysBefore) {
      const fire = shiftDays(p.dueDate, -Math.abs(off));
      if (fire >= todayIso && fire <= horizon) {
        out.push({ dateIso: fire, dueDate: p.dueDate, offset: off });
      }
    }
  }
  return out.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

export function todayIsoUtc() {
  return toYmd(new Date());
}
