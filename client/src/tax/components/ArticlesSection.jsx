import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { taxApi } from '../api';

// Public articles section on the landing page. Pulls every active
// customer-audience article for the community (defaults + community
// overrides + customs). Renders as a stack of cards with an expand-
// in-place toggle so the long form copy doesn't push the rest of the
// page below the fold. Hidden when no articles exist.
export default function ArticlesSection({ communitySlug }) {
  const { locale, t } = useT();
  const [articles, setArticles] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    taxApi.getCommunityArticles(communitySlug)
      .then(d => { if (!cancelled) setArticles(d.articles || []); })
      .catch(() => { if (!cancelled) setArticles([]); });
    return () => { cancelled = true; };
  }, [communitySlug]);

  if (articles === null) return null;
  if (!articles.length) return null;

  return (
    <section className="tax-section" id="articles">
      <div className="tax-container">
        <h2>{t('landing.articles.heading')}</h2>
        <p className="tax-section__lede">{t('landing.articles.subheading')}</p>

        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {articles.map(a => {
            const title = pickI18n(a.title_i18n, locale).value;
            const body = pickI18n(a.body_i18n, locale).value;
            const open = openId === a.id;
            const preview = body ? (body.length > 240 ? `${body.slice(0, 240)}…` : body) : '';
            return (
              <article key={a.id} style={{
                border: '1px solid var(--tax-border)', borderRadius: 10,
                background: 'var(--tax-bg)', padding: 18,
              }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
                {a.category && (
                  <div style={{
                    marginTop: 4, fontSize: 11, fontWeight: 700,
                    color: 'var(--tax-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
                  }}>
                    {t(`landing.articles.cat.${a.category}`, { _: a.category })}
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {open ? body.split(/\n{2,}/).map((para, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0' }}>{para}</p>
                  )) : preview}
                </div>
                {body && body.length > 240 && (
                  <button type="button"
                          onClick={() => setOpenId(open ? null : a.id)}
                          aria-expanded={open}
                          style={{
                            marginTop: 8, padding: '4px 0',
                            border: 0, background: 'transparent',
                            color: 'var(--tax-brand-primary)', fontWeight: 600, fontSize: 13,
                            cursor: 'pointer',
                          }}>
                    {open ? t('landing.articles.collapse') : t('landing.articles.expand')}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
