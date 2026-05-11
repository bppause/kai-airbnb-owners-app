import { pickI18n, useT } from '../i18n';

const ICON_LETTER = {
  receipt: 'IR', briefcase: 'BT', 'id-card': 'ID', book: 'BK', wallet: 'PR',
  building: 'BF', stamp: 'NT', globe: 'TR', scales: 'IRS', calculator: 'ST',
};

export default function ServicesGrid({ products }) {
  const { locale, t } = useT();
  return (
    <section className="tax-section" id="services">
      <div className="tax-container">
        <h2>{t('services.heading')}</h2>
        <p className="tax-section__lede">{t('services.subheading')}</p>
        <div className="tax-services-grid">
          {products.map(p => {
            const name = pickI18n(p.name_i18n, locale).value;
            const desc = pickI18n(p.description_i18n, locale).value;
            const categoryLabel = t(`services.category.${p.category}`);
            return (
              <article className="tax-service-card" key={p.id}>
                <div className="tax-service-card__icon">{ICON_LETTER[p.icon] || '•'}</div>
                <span className="tax-service-card__category">{categoryLabel}</span>
                <h3>{name}</h3>
                <p>{desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
