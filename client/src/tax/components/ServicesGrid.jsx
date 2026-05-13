import { pickI18n, useT } from '../i18n';

const ICON_LETTER = {
  receipt: 'IR', briefcase: 'BT', 'id-card': 'ID', book: 'BK', wallet: 'PR',
  building: 'BF', stamp: 'NT', globe: 'TR', scales: 'IRS', calculator: 'ST',
};

export default function ServicesGrid({ products, onRequestService }) {
  const { locale, t } = useT();

  const onRequest = (slug) => {
    if (typeof onRequestService === 'function') onRequestService(slug);
  };

  return (
    <section className="tax-section" id="services">
      <div className="tax-container">
        <h2>{t('services.heading')}</h2>
        <p className="tax-section__lede">{t('services.subheading')}</p>
        <div style={{ display: 'grid', gap: 16 }}>
          {products.map(p => (
            <ServiceListItem key={p.id} product={p} locale={locale} t={t}
                             onRequest={() => onRequest(p.slug)} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Inline service entry. Replaces the old icon-card-plus-modal pattern:
// long descriptions live directly on the landing page so visitors don't
// have to click to read what each service involves. Required-document
// bullets and the "Request this service" CTA come along for the ride.
function ServiceListItem({ product: p, locale, t, onRequest }) {
  const name = pickI18n(p.name_i18n, locale).value;
  const desc = pickI18n(p.description_i18n, locale).value;
  const longDesc = pickI18n(p.long_description_i18n, locale).value;
  const categoryLabel = t(`services.category.${p.category}`);
  const requires = Array.isArray(p.required_documents) ? p.required_documents : [];
  const requiresLabels = requires.map(d => {
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object') return pickI18n(d.name_i18n || d.label_i18n || d, locale).value || d.name || d.label || '';
    return '';
  }).filter(Boolean);

  return (
    <article style={{
      display: 'grid', gap: 12, gridTemplateColumns: '64px 1fr',
      padding: 20, border: '1px solid var(--tax-border)', borderRadius: 12,
      background: 'var(--tax-bg)',
    }} id={`service-${p.slug}`}>
      <div className="tax-service-card__icon"
           style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ICON_LETTER[p.icon] || '•'}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
          <h3 style={{ margin: 0 }}>{name}</h3>
          <span className="tax-service-card__category">{categoryLabel}</span>
        </div>
        {desc && (
          <p style={{ margin: '8px 0 0', color: 'var(--tax-muted)', fontSize: 15 }}>{desc}</p>
        )}
        {longDesc && (
          <div style={{ marginTop: 12, fontSize: 15, lineHeight: 1.55 }}>
            {longDesc.split(/\n{2,}/).map((para, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0' }}>{para}</p>
            ))}
          </div>
        )}
        {requiresLabels.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--tax-muted)' }}>
              {t('services.modal.requires')}
            </h4>
            <ul style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: 'var(--tax-text)' }}>
              {requiresLabels.map((r, i) => <li key={i} style={{ marginTop: 4 }}>{r}</li>)}
            </ul>
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <button type="button" className="tax-btn tax-btn--primary"
                  onClick={onRequest}>
            {t('services.modal.requestCta')}
          </button>
        </div>
      </div>
    </article>
  );
}
