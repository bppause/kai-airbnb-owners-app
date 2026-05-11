import { useEffect, useState } from 'react';
import LocaleSwitcher from './LocaleSwitcher';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';

// Practice-side chrome. Visually distinguished from the customer portal by
// a "Staff" badge in the header, so an employee who is ALSO a customer
// (same Firebase login, different table row) never confuses the two views.
export default function EmployeeShell({ community, active, children }) {
  const { t } = useT();
  const { fbUser, employee, signOut } = useEmployeeAuth();
  const base = community ? `/tax/${community.id}/employee` : '#';

  // Unread inbox badge — counts threads with practice_unread = true.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!fbUser || !community) return;
    let cancelled = false;
    taxApi.getEmployeeThreads({ uid: fbUser.uid, email: fbUser.email, communitySlug: community.id })
      .then(d => { if (!cancelled) setUnread((d.threads || []).filter(th => th.practice_unread).length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fbUser, community]);

  const initials = (community?.name || 'TAX')
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();

  return (
    <>
      <header className="tax-header" style={{ borderBottom: '2px solid var(--tax-brand-primary)' }}>
        <div className="tax-container tax-header__row">
          <a href={base} className="tax-brand" aria-label={community?.name || 'Tax Services'}>
            {community?.logo_url
              ? <img src={community.logo_url} alt={community?.name || ''} className="tax-brand__logo" />
              : <span className="tax-brand__mark">{initials}</span>}
            <span style={{
              marginLeft: 10, padding: '2px 8px', borderRadius: 4,
              background: 'var(--tax-brand-primary)', color: '#fff',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
            }}>{t('employee.staffBadge')}</span>
          </a>
          <nav className="tax-nav" aria-label="Staff">
            <a href={base} className={active === 'inbox' ? 'active' : ''}>
              {t('employee.nav.inbox')}
              {unread > 0 && (
                <span style={{
                  marginLeft: 6, padding: '2px 7px', borderRadius: 999,
                  background: 'var(--tax-brand-secondary)', color: '#fff',
                  fontSize: 11, fontWeight: 700, lineHeight: 1.4,
                }}>{unread}</span>
              )}
            </a>
            {employee?.role === 'admin' && (
              <>
                <a href={`${base}/customers`} className={active === 'customers' ? 'active' : ''}>
                  {t('employee.nav.customers')}
                </a>
                <a href={`${base}/leads`} className={active === 'leads' ? 'active' : ''}>
                  {t('employee.nav.leads')}
                </a>
                <a href={`${base}/staff`} className={active === 'staff' ? 'active' : ''}>
                  {t('employee.nav.staff')}
                </a>
                <a href={`${base}/settings`} className={active === 'settings' ? 'active' : ''}>
                  {t('employee.nav.settings')}
                </a>
              </>
            )}
            <a href={`${base}/profile`} className={active === 'profile' ? 'active' : ''}>
              {t('employee.nav.profile')}
            </a>
            <LocaleSwitcher />
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={signOut}>
              {t('portal.signout')}
            </button>
          </nav>
        </div>
      </header>
      <div className="tax-container" style={{ paddingTop: 24 }}>
        {employee && (
          <div style={{ color: 'var(--tax-muted)', fontSize: 14, marginBottom: 16 }}>
            {t('employee.greeting', { name: employee.name || employee.email })}
          </div>
        )}
        {children}
      </div>
    </>
  );
}
