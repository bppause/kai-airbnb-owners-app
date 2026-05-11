import { useT } from '../i18n';

export default function LocaleSwitcher() {
  const { locale, setLocale, t } = useT();
  return (
    <div className="tax-locale" role="group" aria-label="Language">
      <button
        type="button"
        className={locale === 'en' ? 'active' : ''}
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
      >EN</button>
      <button
        type="button"
        className={locale === 'es' ? 'active' : ''}
        onClick={() => setLocale('es')}
        aria-pressed={locale === 'es'}
      >ES</button>
      <span className="tax-sr-only" hidden>{t('locale.english')} / {t('locale.spanish')}</span>
    </div>
  );
}
