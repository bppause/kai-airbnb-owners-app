import { useT } from '../i18n';

export default function About() {
  const { t } = useT();
  return (
    <section className="tax-section" id="about">
      <div className="tax-container">
        <h2>{t('about.heading')}</h2>
        <p className="tax-section__lede" style={{ maxWidth: 720 }}>{t('about.body')}</p>
        <ul className="tax-about-list">
          <li>{t('about.point1')}</li>
          <li>{t('about.point2')}</li>
          <li>{t('about.point3')}</li>
        </ul>
      </div>
    </section>
  );
}
