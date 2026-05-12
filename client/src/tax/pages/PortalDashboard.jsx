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
  const [signatures, setSignatures] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!fbUser || !community) return;
    Promise.all([
      taxApi.getFilings(auth),
      taxApi.getThreads(auth).catch(() => ({ threads: [] })),
      taxApi.getDocuments(auth).catch(() => ({ documents: [] })),
      taxApi.getNotifications(auth).catch(() => ({ notifications: [] })),
      taxApi.getTips(auth).catch(() => ({ groups: [] })),
      taxApi.getPortalSignatureRequests(auth).catch(() => ({ requests: [] })),
    ])
      .then(([f, th, d, n, tg, sg]) => {
        setFilings(f.filings || []);
        setThreads(th.threads || []);
        setDocuments(d.documents || []);
        setNotifications(n.notifications || []);
        setTipGroups(tg.groups || []);
        setSignatures(sg.requests || []);
      })
      .catch(e => setErr(e?.message || t('error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  const portalBase = community ? `/tax/${community.id}/portal` : '#';
  const today = new Date().toISOString().slice(0, 10);

  // Phase 4n.6: prefer the workflow's name/slug/category over the schedule's
  // when both are present. After the cron flip, relationship-driven periods
  // arrive with `workflow` populated and `schedule` null; legacy periods are
  // the opposite. Picking up the relationship as the category gives the
  // customer a "this is from your Payroll service" hint per card.
  function displayFor(f) {
    return {
      nameI18n: f.workflow?.name_i18n || f.schedule?.name_i18n || {},
      descI18n: f.workflow?.description_i18n || f.schedule?.description_i18n || {},
      slug: f.workflow?.filing_schedule_slug || f.schedule?.slug || '',
      category: (f.relationship && pickI18n(f.relationship.name_i18n, locale).value)
        || f.schedule?.jurisdiction || '',
    };
  }

  // Phase 4n.7: four buckets keyed off (status, daysLeft). One filing lands
  // in exactly one bucket. Past-due pending periods stay in "action" so the
  // customer notices them — they're not historical, they're overdue.
  //   action     — pending / info_requested AND daysLeft <= 14 (or overdue)
  //   upcoming   — pending / info_requested AND daysLeft > 14
  //   inHand     — info_received / in_prep   (we've got it, customer waits)
  //   completed  — filed                      (done; customer can review)
  // `past` (historical view at the bottom) is everything that's filed OR
  // overdue + skipped — kept separate from the buckets for the collapsible.
  const buckets = useMemo(() => {
    const out = { action: [], upcoming: [], inHand: [], completed: [], past: [] };
    for (const f of filings || []) {
      const dleft = daysBetween(f.due_date, today);
      const status = f.status;
      const withDays = { ...f, daysLeft: dleft };
      if (status === 'filed') { out.completed.push(withDays); out.past.push(withDays); continue; }
      if (status === 'skipped') { out.past.push(withDays); continue; }
      if (status === 'info_received' || status === 'in_prep') { out.inHand.push(withDays); continue; }
      // pending / info_requested:
      if (dleft != null && dleft <= URGENT_DAYS) out.action.push(withDays);
      else out.upcoming.push(withDays);
    }
    out.action.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
    out.upcoming.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
    out.inHand.sort((a, b) => a.due_date.localeCompare(b.due_date));
    out.completed.sort((a, b) => b.due_date.localeCompare(a.due_date));
    return out;
  }, [filings, today]);

  const [activeBucket, setActiveBucket] = useState('action');
  // Sub-filter for the Coming-up bucket: limit to next N days or "all".
  const [upcomingWindow, setUpcomingWindow] = useState(90);

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
  const pendingSignatures = useMemo(() =>
    (signatures || []).filter(s => s.status === 'pending'), [signatures]);
  const hasInbox = unreadThreads.length > 0 || recentPracticeDocs.length > 0 || pendingSignatures.length > 0;
  const counts = {
    action: buckets.action.length,
    upcoming: buckets.upcoming.length,
    inHand: buckets.inHand.length,
    completed: buckets.completed.length,
  };
  const visibleItems = useMemo(() => {
    if (activeBucket !== 'upcoming') return buckets[activeBucket] || [];
    if (upcomingWindow === 'all') return buckets.upcoming;
    return buckets.upcoming.filter(f => (f.daysLeft ?? 999) <= upcomingWindow);
  }, [buckets, activeBucket, upcomingWindow]);

  return (
    <PortalShell community={community} active="dashboard">
      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {/* ── Your filings ──────────────────────────────────────────────
            Bucket-driven layout — Action is the default so the customer
            sees what they owe before anything else. "In our hands" and
            "Completed" surface so the customer can confirm what's been
            received without scrolling through history. */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>{t('portal.dashboard.nextTitle')}</h2>
        <p className="tax-section__lede" style={{ marginTop: 0 }}>
          {t('portal.dashboard.nextSubtitle')}
        </p>

        {!allLoaded && <p>{t('loading')}</p>}

        {allLoaded && (
          <>
            <BucketChips
              active={activeBucket}
              counts={counts}
              onChange={setActiveBucket}
              t={t}
            />

            {activeBucket === 'action' && hasInbox && (
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                {pendingSignatures.length > 0 && pendingSignatures.map(s => (
                  <ActionCard key={s.id} tone="warn" icon="✎"
                    title={t('portal.dashboard.signatureTitle', { title: s.title })}
                    subtitle={t('portal.dashboard.signatureSubtitle', {
                      name: s.requested_by_name || community?.name || '',
                    })}
                    cta={t('portal.dashboard.ctaSign')}
                    href={`${portalBase}/sign/${encodeURIComponent(s.id)}`} />
                ))}
                {unreadThreads.length > 0 && (
                  <ActionCard tone="info" icon="✉"
                    title={t('portal.dashboard.unreadMessagesTitle', { count: unreadThreads.length })}
                    subtitle={t('portal.dashboard.unreadMessagesSubtitle')}
                    cta={t('portal.dashboard.ctaOpenMessages')}
                    href={`${portalBase}/messages`} />
                )}
                {recentPracticeDocs.length > 0 && (
                  <ActionCard tone="info" icon="📄"
                    title={t('portal.dashboard.newDocsTitle', { count: recentPracticeDocs.length })}
                    subtitle={t('portal.dashboard.newDocsSubtitle')}
                    cta={t('portal.dashboard.ctaOpenDocuments')}
                    href={`${portalBase}/documents`} />
                )}
              </div>
            )}

            {activeBucket === 'upcoming' && buckets.upcoming.length > 0 && (
              <WindowFilter value={upcomingWindow} onChange={setUpcomingWindow} t={t} />
            )}

            <FilingsByRelationship
              items={visibleItems}
              activeBucket={activeBucket}
              portalBase={portalBase}
              displayFor={displayFor}
              hasInbox={hasInbox}
              locale={locale}
              t={t}
            />
          </>
        )}
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

      {buckets.past.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {t('portal.dashboard.pastFilings', { count: buckets.past.length })}
          </summary>
          <ul style={{ marginTop: 12 }}>
            {buckets.past.map(f => {
              const disp = displayFor(f);
              return (
                <li key={f.id} style={{ color: 'var(--tax-muted)' }}>
                  {pickI18n(disp.nameI18n, locale).value || disp.slug} — {f.period_label} — {t(STATUS_KEY[f.status] || 'portal.status.filed')}
                </li>
              );
            })}
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

// Phase 4n.7: bucket selector. Chip per bucket with a count pill; the count
// pill is highlighted when the bucket is active. Counts are 0-safe — we
// still render the chip (greyed out) so the customer sees the categories
// even when one is empty.
function BucketChips({ active, counts, onChange, t }) {
  const order = ['action', 'upcoming', 'inHand', 'completed'];
  const labelKey = {
    action: 'portal.dashboard.bucket.action',
    upcoming: 'portal.dashboard.bucket.upcoming',
    inHand: 'portal.dashboard.bucket.inHand',
    completed: 'portal.dashboard.bucket.completed',
  };
  const tone = {
    action: '#b91c1c',
    upcoming: 'var(--tax-brand-primary)',
    inHand: '#047857',
    completed: '#475569',
  };
  return (
    <div role="tablist" aria-label="filings buckets"
         style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 16px' }}>
      {order.map(key => {
        const isActive = active === key;
        const count = counts[key] || 0;
        const accent = tone[key];
        return (
          <button key={key} type="button" role="tab" aria-selected={isActive}
                  onClick={() => onChange(key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 999,
                    border: `1px solid ${isActive ? accent : 'var(--tax-border)'}`,
                    background: isActive ? `color-mix(in srgb, ${accent} 12%, #fff)` : '#fff',
                    color: isActive ? accent : 'var(--tax-text)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: count === 0 && !isActive ? 0.55 : 1,
                  }}>
            <span>{t(labelKey[key])}</span>
            <span style={{
              minWidth: 22, padding: '0 8px', borderRadius: 999, fontSize: 12,
              background: isActive ? accent : 'var(--tax-bg-alt)',
              color: isActive ? '#fff' : 'var(--tax-muted)',
              textAlign: 'center', lineHeight: '18px',
            }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// Sub-filter inside the Coming-up bucket so the customer can ignore the
// long tail and focus on the next month / quarter.
function WindowFilter({ value, onChange, t }) {
  const options = [
    { v: 30,  k: 'portal.dashboard.window.30' },
    { v: 90,  k: 'portal.dashboard.window.90' },
    { v: 365, k: 'portal.dashboard.window.365' },
    { v: 'all', k: 'portal.dashboard.window.all' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--tax-muted)', alignSelf: 'center', marginRight: 4 }}>
        {t('portal.dashboard.window.label')}
      </span>
      {options.map(opt => {
        const isActive = value === opt.v;
        return (
          <button key={opt.v} type="button" onClick={() => onChange(opt.v)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${isActive ? 'var(--tax-brand-primary)' : 'var(--tax-border)'}`,
                    background: isActive ? 'var(--tax-brand-primary)' : '#fff',
                    color: isActive ? '#fff' : 'var(--tax-text)',
                    cursor: 'pointer',
                  }}>{t(opt.k)}</button>
        );
      })}
    </div>
  );
}

// Groups items by relationship name (falls back to "Other" when missing).
// Renders each group as a labelled section with a grid of filing cards.
function FilingsByRelationship({ items, activeBucket, portalBase, displayFor, hasInbox, locale, t }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const f of items) {
      const relName = f.relationship
        ? (pickI18n(f.relationship.name_i18n, locale).value || f.relationship.slug || '')
        : '';
      const key = relName || '__other__';
      let g = map.get(key);
      if (!g) { g = { key, label: relName || t('portal.dashboard.bucket.unassigned'), items: [] }; map.set(key, g); }
      g.items.push(f);
    }
    return Array.from(map.values());
  }, [items, locale, t]);

  if (items.length === 0) {
    // The Action bucket may still have inbox-style cards above the filings
    // grid; only show the "all caught up" banner when truly nothing's here.
    if (activeBucket === 'action' && hasInbox) return null;
    return <EmptyBucket bucket={activeBucket} t={t} />;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {groups.map(g => (
        <div key={g.key}>
          <h3 style={{
            fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em',
            color: 'var(--tax-muted)', margin: '0 0 8px',
          }}>{g.label}</h3>
          <div className="tax-services-grid">
            {g.items.map(f => (
              <FilingCard key={f.id} f={f} portalBase={portalBase}
                          displayFor={displayFor} activeBucket={activeBucket} locale={locale} t={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilingCard({ f, portalBase, displayFor, activeBucket, locale, t }) {
  const disp = displayFor(f);
  const overdue = (f.daysLeft ?? 999) < 0 && (f.status === 'pending' || f.status === 'info_requested');
  const STATUS_KEY = {
    pending: 'portal.status.pending',
    info_requested: 'portal.status.infoRequested',
    info_received: 'portal.status.infoReceived',
    in_prep: 'portal.status.inPrep',
    filed: 'portal.status.filed',
    skipped: 'portal.status.skipped',
  };
  const statusColor = activeBucket === 'completed' ? '#047857'
                    : activeBucket === 'inHand'    ? '#047857'
                    : overdue                       ? '#b91c1c'
                    : 'var(--tax-brand-primary)';
  return (
    <a href={`${portalBase}/filings/${encodeURIComponent(f.id)}`}
       className="tax-service-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className="tax-service-card__category">{disp.category}</span>
      <h3 style={{ margin: '4px 0' }}>{pickI18n(disp.nameI18n, locale).value || disp.slug}</h3>
      <p style={{ margin: '4px 0', color: 'var(--tax-muted)', fontSize: 14 }}>
        {f.period_label} • {t('portal.dashboard.due')} {f.due_date}
      </p>
      {(activeBucket === 'action' || activeBucket === 'upcoming') && f.daysLeft != null && (
        <p style={{ margin: '4px 0', fontSize: 12, color: overdue ? '#b91c1c' : 'var(--tax-muted)' }}>
          {overdue
            ? t('portal.dashboard.overdueBy', { days: Math.abs(f.daysLeft) })
            : f.daysLeft === 0
              ? t('portal.dashboard.dueTodayShort')
              : t('portal.dashboard.dueInDays', { days: f.daysLeft })}
        </p>
      )}
      <p style={{ marginTop: 8 }}>
        <span style={{
          display: 'inline-block', padding: '4px 10px', borderRadius: 999,
          background: `color-mix(in srgb, ${statusColor} 12%, #fff)`,
          color: statusColor, fontSize: 12, fontWeight: 600,
        }}>{t(STATUS_KEY[f.status] || 'portal.status.pending')}</span>
      </p>
    </a>
  );
}

function EmptyBucket({ bucket, t }) {
  const map = {
    action: 'portal.dashboard.empty.action',
    upcoming: 'portal.dashboard.empty.upcoming',
    inHand: 'portal.dashboard.empty.inHand',
    completed: 'portal.dashboard.empty.completed',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'color-mix(in srgb, var(--tax-success) 8%, #fff)',
      border: '1px solid var(--tax-success)', color: 'var(--tax-success)',
      padding: '16px 18px', borderRadius: 10,
    }}>
      <span style={{ fontSize: 24 }}>✓</span>
      <div>
        <div style={{ fontWeight: 700 }}>{t(map[bucket] || 'portal.dashboard.empty')}</div>
      </div>
    </div>
  );
}
