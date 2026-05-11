import { useEffect, useMemo, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

// Customer help center. Articles fall into two buckets:
//   - General portal-usage articles (relationship_type_id IS NULL)
//   - Service-tailored articles for the customer's tagged relationships
// The category sidebar lets the customer jump around; the body pane shows
// the selected article. A "Tailored for your services" badge surfaces the
// relationship-specific articles distinctly so customers understand why
// they're seeing those specifically.

const CATEGORY_KEY = {
  getting_started: 'portal.help.cat.gettingStarted',
  documents:       'portal.help.cat.documents',
  messages:        'portal.help.cat.messages',
  filings:         'portal.help.cat.filings',
  profile:         'portal.help.cat.profile',
  notifications:   'portal.help.cat.notifications',
  service:         'portal.help.cat.service',
  admin:           'portal.help.cat.admin',
};

export default function PortalHelp() {
  const { locale, t } = useT();
  const { fbUser, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [articles, setArticles] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!fbUser || !community) return;
    taxApi.getHelp(auth)
      .then(d => {
        const list = d.articles || [];
        setArticles(list);
        if (list.length && !selectedId) setSelectedId(list[0].id);
      })
      .catch(e => setErr(e?.message || t('error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  // Group articles by category in stable display_order.
  const grouped = useMemo(() => {
    if (!articles) return null;
    const groups = new Map();
    for (const a of articles) {
      const key = a.category || 'general';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    }
    // Stable category order: getting_started → documents → messages →
    // filings → notifications → profile → service → admin.
    const order = ['getting_started', 'documents', 'messages', 'filings', 'notifications', 'profile', 'service', 'admin'];
    return order
      .map(cat => ({ category: cat, items: groups.get(cat) || [] }))
      .filter(g => g.items.length > 0);
  }, [articles]);

  const selected = (articles || []).find(a => a.id === selectedId) || null;

  return (
    <PortalShell community={community} active="help">
      <h2 style={{ marginTop: 0 }}>{t('portal.help.title')}</h2>
      <p className="tax-section__lede">{t('portal.help.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {articles === null ? <p>{t('loading')}</p>
        : articles.length === 0 ? <p style={{ color: 'var(--tax-muted)' }}>{t('portal.help.empty')}</p>
        : <div style={{
            display: 'grid', gap: 24,
            gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)',
            alignItems: 'start',
          }}>
            <aside>
              {grouped.map(g => (
                <div key={g.category} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: '.7px',
                    color: 'var(--tax-muted)', fontWeight: 700, marginBottom: 6,
                  }}>{t(CATEGORY_KEY[g.category] || 'portal.help.cat.service')}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                    {g.items.map(a => {
                      const active = a.id === selectedId;
                      return (
                        <li key={a.id}>
                          <button type="button" onClick={() => setSelectedId(a.id)}
                                  style={{
                                    width: '100%', textAlign: 'left',
                                    background: active ? 'color-mix(in srgb, var(--tax-brand-primary) 10%, #fff)' : 'transparent',
                                    border: '1px solid', borderColor: active ? 'color-mix(in srgb, var(--tax-brand-primary) 30%, #fff)' : 'var(--tax-border)',
                                    color: active ? 'var(--tax-brand-primary)' : 'var(--tax-text)',
                                    padding: '8px 10px', borderRadius: 6,
                                    fontSize: 13, lineHeight: 1.35, fontWeight: active ? 600 : 500,
                                    cursor: 'pointer',
                                  }}>
                            {pickI18n(a.title_i18n, locale).value}
                            {a.relationship_type_id && (
                              <div style={{ fontSize: 11, color: 'var(--tax-muted)', fontWeight: 400, marginTop: 2 }}>
                                {pickI18n(a.type?.name_i18n, locale).value}
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </aside>

            <article>
              {selected ? (
                <div className="tax-contact-item" style={{ padding: 24 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                    {pickI18n(selected.title_i18n, locale).value}
                  </h3>
                  {selected.relationship_type_id && (
                    <div style={{
                      display: 'inline-block',
                      padding: '3px 10px', borderRadius: 999,
                      background: 'color-mix(in srgb, var(--tax-brand-primary) 10%, #fff)',
                      color: 'var(--tax-brand-primary)', fontSize: 11, fontWeight: 700,
                      letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 12,
                    }}>
                      {t('portal.help.tailoredBadge')} · {pickI18n(selected.type?.name_i18n, locale).value}
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.65 }}>
                    {pickI18n(selected.body_i18n, locale).value}
                  </div>
                  {selected.source_note && (
                    <div style={{
                      marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--tax-border)',
                      color: 'var(--tax-muted)', fontSize: 12,
                    }}>
                      {t('portal.help.source')}: {selected.source_note}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--tax-muted)' }}>{t('portal.help.pickArticle')}</p>
              )}

              <p style={{ marginTop: 16, color: 'var(--tax-muted)', fontSize: 12 }}>
                {t('portal.help.disclaimer')}
              </p>
            </article>
          </div>}
    </PortalShell>
  );
}
