import { useEffect, useState } from 'react';
import LocaleSwitcher from './LocaleSwitcher';
import { useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';

// Chrome shared by every portal page: brand header, locale switcher,
// nav to dashboard/profile, and sign-out. Inherits brand colors from the
// `--tax-brand-*` CSS vars set on the outer .tax-app wrapper.
export default function PortalShell({ community, active, children }) {
  const { t } = useT();
  const { fbUser, customer, signOut } = useTaxAuth();
  const initials = (community?.name || 'TAX')
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
  const base = community ? `/tax/${community.id}/portal` : '#';

  // Unread-message badge for the Messages nav link. Polls /portal/threads
  // once on mount per shell instance; messaging itself doesn't push, so a
  // light refetch on each navigation is fine for v1.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!fbUser || !community) return;
    let cancelled = false;
    taxApi.getThreads({ uid: fbUser.uid, email: fbUser.email, communitySlug: community.id })
      .then(d => { if (!cancelled) setUnread((d.threads || []).filter(th => th.customer_unread).length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fbUser, community]);

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
            <a href={`${base}/messages`} className={active === 'messages' ? 'active' : ''}>
              {t('portal.nav.messages')}
              {unread > 0 && (
                <span style={{
                  marginLeft: 6, padding: '2px 7px', borderRadius: 999,
                  background: 'var(--tax-brand-secondary)', color: '#fff',
                  fontSize: 11, fontWeight: 700, lineHeight: 1.4,
                }}>{unread}</span>
              )}
            </a>
            <a href={`${base}/documents`} className={active === 'documents' ? 'active' : ''}>{t('portal.nav.documents')}</a>
            <a href={`${base}/faqs`} className={active === 'faqs' ? 'active' : ''}>{t('portal.nav.faqs')}</a>
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
