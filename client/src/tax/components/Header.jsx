import { useState } from 'react';
import { useT } from '../i18n';
import LocaleSwitcher from './LocaleSwitcher';

export default function Header({ community }) {
  const { t } = useT();
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = (community?.name || 'TAX')
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
  const showLogo = Boolean(community?.logo_url) && !logoFailed;

  return (
    <header className="tax-header">
      <div className="tax-container tax-header__row">
        <a href="#top" className="tax-brand" aria-label={community?.name || 'Tax Services'}>
          {showLogo ? (
            <img
              src={community.logo_url}
              alt={community?.name || 'Tax Services'}
              className="tax-brand__logo"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <>
              <span className="tax-brand__mark">{initials}</span>
              <span className="tax-brand__name">{community?.name || 'Tax Services'}</span>
            </>
          )}
        </a>
        <nav className="tax-nav" aria-label="Main">
          <a href="#services">{t('nav.services')}</a>
          <a href="#about">{t('nav.about')}</a>
          <a href="#contact">{t('nav.contact')}</a>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
