import { useEffect, useState } from 'react';
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

export default function PortalDashboard() {
  const { locale, t } = useT();
  const { fbUser, customer, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [filings, setFilings] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [tipGroups, setTipGroups] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!fbUser || !community) return;
    Promise.all([
      taxApi.getFilings(auth),
      taxApi.getNotifications(auth),
      taxApi.getTips(auth),
    ])
      .then(([f, n, tg]) => {
        setFilings(f.filings || []);
        setNotifications(n.notifications || []);
        setTipGroups(tg.groups || []);
      })
      .catch(e => setErr(e?.message || t('error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  const portalBase = community ? `/tax/${community.id}/portal` : '#';
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (filings || []).filter(f => f.due_date >= today && f.status !== 'filed');
  const past = (filings || []).filter(f => f.due_date < today || f.status === 'filed');

  return (
    <PortalShell community={community} active="dashboard">
      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      <h2 style={{ marginTop: 0 }}>{t('portal.dashboard.upcoming')}</h2>
      {filings === null ? <p>{t('loading')}</p>
        : upcoming.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>{t('portal.dashboard.empty')}</p>
          : <div className="tax-services-grid">
              {upcoming.map(f => (
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

      {tipGroups && tipGroups.length > 0 && (
        <section style={{ marginTop: 40 }}>
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

      <h2 style={{ marginTop: 40 }}>{t('portal.dashboard.notifications')}</h2>
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

      {past.length > 0 && (
        <details style={{ marginTop: 40 }}>
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
