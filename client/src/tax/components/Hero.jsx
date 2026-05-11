import { useT } from '../i18n';

export default function Hero({ community }) {
  const { locale, t } = useT();
  const tagline = (locale === 'es'
    ? (community?.tagline || community?.tagline_en)
    : (community?.tagline_en || community?.tagline)
  ) || t('hero.tagline_fallback');

  return (
    <section className="tax-hero" id="top">
      <div className="tax-container">
        <h1>{tagline}</h1>
        <p>{t('hero.subtitle')}</p>
        <div className="tax-hero__ctas">
          <a className="tax-btn tax-btn--primary" href="#contact">{t('hero.cta_primary')}</a>
          <a className="tax-btn tax-btn--ghost" href="#services">{t('hero.cta_secondary')}</a>
        </div>
      </div>
    </section>
  );
}
