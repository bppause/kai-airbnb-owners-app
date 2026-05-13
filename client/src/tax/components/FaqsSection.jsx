import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { taxApi } from '../api';

// Public FAQ section on the landing page. Pulls the community's
// effective FAQ set (defaults + community overrides + customs) and
// renders an accordion grouped by relationship type. Hidden entirely
// when no community has any FAQs.
export default function FaqsSection({ communitySlug }) {
  const { locale, t } = useT();
  const [groups, setGroups] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    taxApi.getCommunityFaqs(communitySlug)
      .then(d => { if (!cancelled) setGroups(d.groups || []); })
      .catch(() => { if (!cancelled) setGroups([]); });
    return () => { cancelled = true; };
  }, [communitySlug]);

  if (groups === null) return null;
  // Only render groups with at least one FAQ — empty types are noise.
  const populated = groups.filter(g => g.faqs && g.faqs.length > 0);
  if (populated.length === 0) return null;

  return (
    <section className="tax-section" id="faqs" style={{ background: 'var(--tax-bg-alt)' }}>
      <div className="tax-container">
        <h2>{t('landing.faqs.heading')}</h2>
        <p className="tax-section__lede">{t('landing.faqs.subheading')}</p>

        <div style={{ display: 'grid', gap: 22, marginTop: 18 }}>
          {populated.map(group => (
            <div key={group.type.id}>
              <h3 style={{ margin: '0 0 10px', fontSize: 18 }}>
                {pickI18n(group.type.name_i18n, locale).value || group.type.slug}
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {group.faqs.map(faq => {
                  const id = `${group.type.id}:${faq.id}`;
                  const open = openId === id;
                  const q = pickI18n(faq.question_i18n, locale).value;
                  const a = pickI18n(faq.answer_i18n, locale).value;
                  return (
                    <div key={id} style={{
                      border: '1px solid var(--tax-border)', borderRadius: 8,
                      background: '#fff', overflow: 'hidden',
                    }}>
                      <button type="button"
                              onClick={() => setOpenId(open ? null : id)}
                              aria-expanded={open}
                              style={{
                                width: '100%', textAlign: 'left',
                                padding: '12px 16px', border: 0, background: 'transparent',
                                cursor: 'pointer', fontSize: 15, fontWeight: 600,
                                display: 'flex', justifyContent: 'space-between', gap: 12,
                              }}>
                        <span style={{ flex: 1, minWidth: 0 }}>{q}</span>
                        <span aria-hidden="true" style={{
                          fontSize: 14, color: 'var(--tax-muted)',
                          transform: open ? 'rotate(180deg)' : 'rotate(0)',
                          transition: 'transform .12s ease',
                        }}>▾</span>
                      </button>
                      {open && a && (
                        <div style={{ padding: '0 16px 14px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
