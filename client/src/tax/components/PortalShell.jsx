import LocaleSwitcher from './LocaleSwitcher';
import { useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';

// Chrome shared by every portal page: brand header, locale switcher,
// nav to dashboard/profile, and sign-out. Inherits brand colors from the
// `--tax-brand-*` CSS vars set on the outer .tax-app wrapper.
export default function PortalShell({ community, active, children }) {
  const { t } = useT();
  const { customer, signOut } = useTaxAuth();
  const initials = (community?.name || 'TAX')
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
  const base = community ? `/tax/${community.id}/portal` : '#';

  return (
    <>
      <header className="tax-header">
        <div className="tax-container tax-header__row">
          <a href={base} className="tax-brand" aria-label={community?.name || 'Tax Services'}>
            {community?.logo_url
              ? <img src={community.logo_url} alt={community?.name || ''} className="tax-brand__logo" />
              : <span className="tax-brand__mark">{initials}</span>}
          </a>
          <nav className="tax-nav" aria-label="Portal">
            <a href={base} className={active === 'dashboard' ? 'active' : ''}>{t('portal.nav.dashboard')}</a>
            <a href={`${base}/profile`} className={active === 'profile' ? 'active' : ''}>{t('portal.nav.profile')}</a>
            <LocaleSwitcher />
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={signOut}>
              {t('portal.signout')}
            </button>
          </nav>
        </div>
      </header>
      <div className="tax-container" style={{ paddingTop: 24 }}>
        {customer && (
          <div style={{ color: 'var(--tax-muted)', fontSize: 14, marginBottom: 16 }}>
            {t('portal.greeting', { name: customer.name || customer.email })}
          </div>
        )}
        {children}
      </div>
    </>
  );
}
