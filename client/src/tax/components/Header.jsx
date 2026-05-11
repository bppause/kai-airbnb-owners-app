import { useT } from '../i18n';
import LocaleSwitcher from './LocaleSwitcher';

export default function Header({ community }) {
  const { t } = useT();
  const initials = (community?.name || 'TAX')
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();

  return (
    <header className="tax-header">
      <div className="tax-container tax-header__row">
        <a href="#top" className="tax-brand">
          {community?.logo_url
            ? <img src={community.logo_url} alt="" height="38" />
            : <span className="tax-brand__mark">{initials}</span>}
          <span className="tax-brand__name">{community?.name || 'Tax Services'}</span>
        </a>
        <nav className="tax-nav" aria-label="Main">
          <a href="#services">{t('nav.services')}</a>
          <a href="#contact">{t('nav.contact')}</a>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
