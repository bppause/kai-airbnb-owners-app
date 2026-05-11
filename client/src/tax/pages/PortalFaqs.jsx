import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

// FAQ page shown to a signed-in customer. Filtered to FAQs that match the
// customer's tagged relationships, with community overrides taking precedence
// over the platform defaults.
//
// Rendering structure: one section per relationship type, an accordion of
// questions inside. If the customer has no relationships yet, we show a
// friendly empty state directing them to contact the practice.
export default function PortalFaqs() {
  const { locale, t } = useT();
  const { fbUser, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [groups, setGroups] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});  // { [faqId]: true }

  useEffect(() => {
    if (!fbUser || !community) return;
    taxApi.getFaqs(auth)
      .then(d => setGroups(d.groups || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  const toggle = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));

  return (
    <PortalShell community={community} active="faqs">
      <h2 style={{ marginTop: 0 }}>{t('portal.faqs.title')}</h2>
      <p className="tax-section__lede">{t('portal.faqs.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {groups === null ? <p>{t('loading')}</p>
        : groups.length === 0
          ? <EmptyState community={community} />
          : groups.map(g => (
              <section key={g.type.id} style={{ marginBottom: 32 }}>
                <h3 style={{ marginBottom: 4 }}>{pickI18n(g.type.name_i18n, locale).value}</h3>
                <p style={{ color: 'var(--tax-muted)', marginTop: 0, marginBottom: 12, fontSize: 14 }}>
                  {pickI18n(g.type.description_i18n, locale).value}
                </p>
                {g.faqs.length === 0
                  ? <p style={{ color: 'var(--tax-muted)' }}>{t('portal.faqs.noneForType')}</p>
                  : <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                      {g.faqs.map(f => {
                        const isOpen = !!open[f.id];
                        const q = pickI18n(f.question_i18n, locale).value;
                        const a = pickI18n(f.answer_i18n, locale).value;
                        return (
                          <li key={f.id} className="tax-contact-item" style={{ padding: 0 }}>
                            <button type="button" onClick={() => toggle(f.id)}
                                    style={{
                                      width: '100%', textAlign: 'left', background: 'transparent',
                                      border: 0, padding: '14px 16px', cursor: 'pointer',
                                      fontSize: 15, fontWeight: 600, color: 'var(--tax-text)',
                                      display: 'flex', justifyContent: 'space-between', gap: 12,
                                    }}>
                              <span>{q}</span>
                              <span aria-hidden="true" style={{ color: 'var(--tax-muted)' }}>{isOpen ? '−' : '+'}</span>
                            </button>
                            {isOpen && (
                              <div style={{ padding: '0 16px 16px', color: 'var(--tax-text)', fontSize: 14, lineHeight: 1.6 }}>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{a}</div>
                                {f.source === 'custom' && (
                                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--tax-muted)', fontStyle: 'italic' }}>
                                    {t('portal.faqs.customLabel')}
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                }
              </section>
            ))
      }

      <p style={{ marginTop: 24, color: 'var(--tax-muted)', fontSize: 13 }}>
        {t('portal.faqs.disclaimer')}
      </p>
    </PortalShell>
  );
}

function EmptyState({ community }) {
  const { t } = useT();
  return (
    <div className="tax-contact-item">
      <p>{t('portal.faqs.empty')}</p>
      {community?.contact_email && (
        <a href={`mailto:${community.contact_email}`} className="tax-btn tax-btn--primary" style={{ marginTop: 8 }}>
          {community.contact_email}
        </a>
      )}
    </div>
  );
}
