import { useEffect, useState } from 'react';
import LocaleSwitcher from './LocaleSwitcher';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import ImpersonationBanner from './ImpersonationBanner';

// Practice-side chrome. Visually distinguished from the customer portal by
// a "Staff" badge in the header, so an employee who is ALSO a customer
// (same Firebase login, different table row) never confuses the two views.
export default function EmployeeShell({ community, active, children }) {
  const { t } = useT();
  const { fbUser, employee, signOut, impersonation, exitImpersonation, customerAccess } = useEmployeeAuth();
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
      <ImpersonationBanner impersonation={impersonation} onExit={exitImpersonation} />
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
            {/* Customers tab is visible to ALL employees. Admins see the
                whole community; staff see only their assigned customers
                (scoping happens server-side). Detail-page actions stay
                admin-gated. */}
            {employee && (
              <a href={`${base}/customers`} className={active === 'customers' ? 'active' : ''}>
                {t('employee.nav.customers')}
              </a>
            )}
            {employee?.role === 'admin' && (
              <>
                <a href={`${base}/leads`} className={active === 'leads' ? 'active' : ''}>
                  {t('employee.nav.leads')}
                </a>
                <a href={`${base}/staff`} className={active === 'staff' ? 'active' : ''}>
                  {t('employee.nav.staff')}
                </a>
                <a href={`${base}/settings`} className={active === 'settings' ? 'active' : ''}>
                  {t('employee.nav.settings')}
                </a>
                <a href={`${base}/email-templates`} className={active === 'email-templates' ? 'active' : ''}>
                  {t('employee.nav.emailTemplates')}
                </a>
                <a href={`${base}/workflows`} className={active === 'workflows' ? 'active' : ''}>
                  {t('employee.nav.workflows')}
                </a>
                <a href={`${base}/articles`} className={active === 'articles' ? 'active' : ''}>
                  {t('employee.nav.articles')}
                </a>
                <a href={`${base}/faqs`} className={active === 'faqs' ? 'active' : ''}>
                  {t('employee.nav.faqsAdmin')}
                </a>
                <a href={`${base}/audit`} className={active === 'audit' ? 'active' : ''}>
                  {t('employee.nav.audit')}
                </a>
              </>
            )}
            <a href={`${base}/help`} className={active === 'help' ? 'active' : ''}>
              {t('employee.nav.help')}
            </a>
            <a href={`${base}/profile`} className={active === 'profile' ? 'active' : ''}>
              {t('employee.nav.profile')}
            </a>
            <LocaleSwitcher />
            {/* Dual-role switch — see PortalShell counterpart for rationale. */}
            {!impersonation && customerAccess?.hasCustomerRow && community && (
              <a href={`/tax/${community.id}/portal`} className="tax-btn tax-btn--ghost tax-btn--sm"
                 style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
                {t('employee.switchToCustomer')}
              </a>
            )}
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
