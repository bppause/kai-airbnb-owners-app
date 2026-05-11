import { useEffect, useMemo, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

const STATUS_KEY = {
  pending: 'portal.status.pending',
  info_requested: 'portal.status.infoRequested',
  info_received: 'portal.status.infoReceived',
  in_prep: 'portal.status.inPrep',
  filed: 'portal.status.filed',
  skipped: 'portal.status.skipped',
};

// Phase 4n: "what's next" dashboard. The top of the page is a prioritized
// action queue (filings due soon, unread messages, recent practice
// documents) so the customer's first decision is "do this now" rather
// than "where do I navigate". Everything below is reference material.
//
// Action priorities (highest first):
//   1. Filings due ≤ 14 days where status is still pending / info_requested
//   2. Unread messages on any thread
//   3. Documents the practice uploaded for them in the last 14 days
//      (we use uploaded_at recency since there's no per-doc read flag yet)
const URGENT_DAYS = 14;
const RECENT_DOC_DAYS = 14;

function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) return null;
  const a = new Date(isoA + (isoA.length === 10 ? 'T00:00:00Z' : '')).getTime();
  const b = new Date(isoB + (isoB.length === 10 ? 'T00:00:00Z' : '')).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86400000);
}

export default function PortalDashboard() {
  const { locale, t } = useT();
  const { fbUser, customer, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [filings, setFilings] = useState(null);
  const [threads, setThreads] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [tipGroups, setTipGroups] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!fbUser || !community) return;
    Promise.all([
      taxApi.getFilings(auth),
      taxApi.getThreads(auth).catch(() => ({ threads: [] })),
      taxApi.getDocuments(auth).catch(() => ({ documents: [] })),
      taxApi.getNotifications(auth).catch(() => ({ notifications: [] })),
      taxApi.getTips(auth).catch(() => ({ groups: [] })),
    ])
      .then(([f, th, d, n, tg]) => {
        setFilings(f.filings || []);
        setThreads(th.threads || []);
        setDocuments(d.documents || []);
        setNotifications(n.notifications || []);
        setTipGroups(tg.groups || []);
      })
      .catch(e => setErr(e?.message || t('error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  const portalBase = community ? `/tax/${community.id}/portal` : '#';
  const today = new Date().toISOString().slice(0, 10);

  // Split filings: urgent (due ≤ 14d, action still required), upcoming
  // (everything else not filed), and historical.
  const { urgent, laterUpcoming, past } = useMemo(() => {
    const u = [], l = [], p = [];
    for (const f of filings || []) {
      if (f.status === 'filed' || f.due_date < today) { p.push(f); continue; }
      const dleft = daysBetween(f.due_date, today);
      const needsCustomerAction = f.status === 'pending' || f.status === 'info_requested';
      if (needsCustomerAction && dleft != null && dleft <= URGENT_DAYS) u.push({ ...f, daysLeft: dleft });
      else l.push(f);
    }
    u.sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));
    return { urgent: u, laterUpcoming: l, past: p };
  }, [filings, today]);

  const unreadThreads = useMemo(() =>
    (threads || []).filter(th => th.customer_unread), [threads]);

  const recentPracticeDocs = useMemo(() => {
    if (!documents) return [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - RECENT_DOC_DAYS);
    return documents.filter(d => {
      if (d.source !== 'practice') return false;
      if (!d.uploaded_at) return false;
      return new Date(d.uploaded_at).getTime() >= cutoff.getTime();
    });
  }, [documents]);

  const allLoaded = filings !== null && threads !== null && documents !== null;
  const hasActions = urgent.length > 0 || unreadThreads.length > 0 || recentPracticeDocs.length > 0;

  return (
    <PortalShell community={community} active="dashboard">
      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {/* ── Action queue ──────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>{t('portal.dashboard.nextTitle')}</h2>
        <p className="tax-section__lede" style={{ marginTop: 0 }}>
          {t('portal.dashboard.nextSubtitle')}
        </p>

        {!allLoaded && <p>{t('loading')}</p>}

        {allLoaded && !hasActions && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'color-mix(in srgb, var(--tax-success) 8%, #fff)',
            border: '1px solid var(--tax-success)',
            color: 'var(--tax-success)',
            padding: '16px 18px', borderRadius: 10,
          }}>
            <span style={{ fontSize: 24 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700 }}>{t('portal.dashboard.allCaughtUp')}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                {t('portal.dashboard.allCaughtUpSubtitle')}
              </div>
            </div>
          </div>
        )}

        {allLoaded && hasActions && (
          <div style={{ display: 'grid', gap: 10 }}>
            {urgent.map(f => {
              const daysWord = Math.abs(f.daysLeft) === 1
                ? t('portal.dashboard.day') : t('portal.dashboard.days');
              const overdueOrToday = f.daysLeft <= 0;
              return (
                <ActionCard
                  key={f.id}
                  tone={overdueOrToday ? 'danger' : 'warn'}
                  icon="!"
                  title={pickI18n(f.schedule?.name_i18n, locale).value || f.schedule?.slug || t('portal.dashboard.filing')}
                  subtitle={overdueOrToday
                    ? t('portal.dashboard.dueToday', { period: f.period_label })
                    : t('portal.dashboard.dueIn', { days: f.daysLeft, daysWord, period: f.period_label })}
                  cta={t('portal.dashboard.ctaSubmitInfo')}
                  href={`${portalBase}/filings/${encodeURIComponent(f.id)}`}
                />
              );
            })}
            {unreadThreads.length > 0 && (
              <ActionCard
                tone="info"
                icon="✉"
                title={t('portal.dashboard.unreadMessagesTitle', { count: unreadThreads.length })}
                subtitle={t('portal.dashboard.unreadMessagesSubtitle')}
                cta={t('portal.dashboard.ctaOpenMessages')}
                href={`${portalBase}/messages`}
              />
            )}
            {recentPracticeDocs.length > 0 && (
              <ActionCard
                tone="info"
                icon="📄"
                title={t('portal.dashboard.newDocsTitle', { count: recentPracticeDocs.length })}
                subtitle={t('portal.dashboard.newDocsSubtitle')}
                cta={t('portal.dashboard.ctaOpenDocuments')}
                href={`${portalBase}/documents`}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Upcoming filings (> 14 days out, or already moved past the
            customer-action statuses). Kept as cards for parity with the
            previous layout, but no longer the page hero. ────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>{t('portal.dashboard.upcoming')}</h2>
        {filings === null ? <p>{t('loading')}</p>
          : laterUpcoming.length === 0
            ? <p style={{ color: 'var(--tax-muted)' }}>{t('portal.dashboard.empty')}</p>
            : <div className="tax-services-grid">
                {laterUpcoming.map(f => (
                  <a key={f.id} href={`${portalBase}/filings/${encodeURIComponent(f.id)}`}
                     className="tax-service-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="tax-service-card__category">{f.schedule?.jurisdiction}</span>
                    <h3>{pickI18n(f.schedule?.name_i18n, locale).value}</h3>
                    <p>{f.period_label} • {t('portal.dashboard.due')} {f.due_date}</p>
                    <p style={{ marginTop: 8 }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 999,
                        background: 'color-mix(in srgb, var(--tax-brand-primary) 10%, #fff)',
                        color: 'var(--tax-brand-primary)', fontSize: 12, fontWeight: 600,
                      }}>{t(STATUS_KEY[f.status] || 'portal.status.pending')}</span>
                    </p>
                  </a>
                ))}
              </div>
        }
      </section>

      {tipGroups && tipGroups.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 4 }}>{t('portal.dashboard.tips')}</h2>
          <p style={{ color: 'var(--tax-muted)', marginTop: 0, marginBottom: 16, fontSize: 14 }}>
            {t('portal.dashboard.tipsHint')}
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {tipGroups.map(g => (
              <div key={g.type.id} style={{
                background: '#f4f7fb',
                borderLeft: '3px solid var(--tax-brand-primary)',
                borderRadius: 8, padding: '14px 16px',
              }}>
                <div style={{
                  fontSize: 12, textTransform: 'uppercase', letterSpacing: '.6px',
                  color: 'var(--tax-muted)', marginBottom: 6,
                }}>
                  {pickI18n(g.type.name_i18n, locale).value}
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
                  {g.tips.map(tip => (
                    <li key={tip.id} style={{ fontSize: 14, lineHeight: 1.55 }}>
                      {pickI18n(tip.tip_i18n, locale).value}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>{t('portal.dashboard.notifications')}</h2>
        {notifications === null ? <p>{t('loading')}</p>
          : notifications.length === 0
            ? <p style={{ color: 'var(--tax-muted)' }}>{t('portal.dashboard.noNotifications')}</p>
            : <div style={{ display: 'grid', gap: 8 }}>
                {notifications.slice(0, 10).map(n => {
                  const title = pickI18n(n.title_i18n, locale).value;
                  const body = pickI18n(n.body_i18n, locale).value;
                  const unread = !n.read_at;
                  return (
                    <div key={n.id} className="tax-contact-item"
                         style={{ borderLeft: unread ? '3px solid var(--tax-brand-secondary)' : '3px solid transparent' }}>
                      <div style={{ fontWeight: unread ? 700 : 500 }}>{title}</div>
                      {body && <div style={{ color: 'var(--tax-muted)', fontSize: 14, marginTop: 4 }}>{body}</div>}
                    </div>
                  );
                })}
              </div>
        }
      </section>

      {past.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {t('portal.dashboard.pastFilings', { count: past.length })}
          </summary>
          <ul style={{ marginTop: 12 }}>
            {past.map(f => (
              <li key={f.id} style={{ color: 'var(--tax-muted)' }}>
                {pickI18n(f.schedule?.name_i18n, locale).value} — {f.period_label} — {t(STATUS_KEY[f.status] || 'portal.status.filed')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </PortalShell>
  );
}

// Single action-queue row. Tone drives the left-rail color: danger (red)
// for overdue/today, warn (amber) for urgent, info (brand-primary) for
// awareness items like unread messages and new documents.
function ActionCard({ tone, icon, title, subtitle, cta, href }) {
  const palette = {
    danger: { bar: 'var(--tax-error)',          chip: '#fee', chipText: '#a00' },
    warn:   { bar: 'var(--tax-brand-secondary)', chip: 'color-mix(in srgb, var(--tax-brand-secondary) 14%, #fff)', chipText: 'var(--tax-brand-secondary)' },
    info:   { bar: 'var(--tax-brand-primary)',  chip: 'color-mix(in srgb, var(--tax-brand-primary) 10%, #fff)', chipText: 'var(--tax-brand-primary)' },
  }[tone] || { bar: 'var(--tax-brand-primary)', chip: '#fff', chipText: 'var(--tax-text)' };

  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px 14px 18px',
      borderRadius: 10, textDecoration: 'none', color: 'inherit',
      background: '#fff', border: '1px solid var(--tax-border)',
      borderLeft: `4px solid ${palette.bar}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: palette.chip, color: palette.chipText,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <span className="tax-btn tax-btn--primary tax-btn--sm" style={{ flexShrink: 0 }}>{cta}</span>
    </a>
  );
}
