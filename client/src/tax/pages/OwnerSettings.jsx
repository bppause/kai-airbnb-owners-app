import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

// Owner-facing community settings. v1 only carries the Phase 2a
// notification-preference lock toggle, which was curl-only until now.
// Additional community-level toggles (e.g., default reminder offsets,
// outbound-from name) can be added here over time without route changes.
export default function OwnerSettings() {
  const { t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [settings, setSettings] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  const load = () => {
    if (!fbUser || !community) return;
    taxApi.adminGetCommunitySettings(auth, community.id)
      .then(d => setSettings(d.settings))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };
  useEffect(load, [fbUser, community]); // eslint-disable-line react-hooks/exhaustive-deps

  if (employee && employee.role !== 'admin') {
    return <EmployeeShell community={community}>
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }

  const onToggleNotifLock = async (allowChange) => {
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      await taxApi.adminSetNotifLock(auth, { communitySlug: community.id, allowCustomerChange: allowChange });
      setMsg({ kind: 'success', text: t('owner.settings.saved') });
      load();
    } catch (e) {
      setMsg({ kind: 'error', text: e?.message || t('respond.error.generic') });
    } finally {
      setBusy(false);
    }
  };

  if (err) return <EmployeeShell community={community} active="settings"><div className="tax-msg tax-msg--error">{err}</div></EmployeeShell>;
  if (!settings) return <EmployeeShell community={community} active="settings"><p>{t('loading')}</p></EmployeeShell>;

  const allowChange = Boolean(settings.tax_allow_customer_notif_pref_change);

  return (
    <EmployeeShell community={community} active="settings">
      <h2 style={{ marginTop: 0 }}>{t('owner.settings.title')}</h2>
      <p className="tax-section__lede">{t('owner.settings.subtitle')}</p>

      {msg.text && (
        <div className={`tax-msg tax-msg--${msg.kind === 'error' ? 'error' : 'success'}`}
             style={{ marginBottom: 16 }}>{msg.text}</div>
      )}

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 4 }}>{t('owner.settings.notifLock.title')}</h3>
        <p style={{ color: 'var(--tax-muted)', marginTop: 0, marginBottom: 12, fontSize: 14 }}>
          {t('owner.settings.notifLock.subtitle')}
        </p>

        <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
          <label style={{
            display: 'flex', gap: 12, padding: 14, border: '1px solid var(--tax-border)', borderRadius: 8,
            cursor: busy ? 'wait' : 'pointer',
            background: !allowChange ? 'color-mix(in srgb, var(--tax-brand-primary) 6%, #fff)' : '#fff',
          }}>
            <input type="radio" name="notif-lock" disabled={busy}
                   checked={!allowChange} onChange={() => onToggleNotifLock(false)}
                   style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{t('owner.settings.notifLock.locked')}</div>
              <div style={{ color: 'var(--tax-muted)', fontSize: 13, marginTop: 4 }}>
                {t('owner.settings.notifLock.lockedHint')}
              </div>
            </div>
          </label>
          <label style={{
            display: 'flex', gap: 12, padding: 14, border: '1px solid var(--tax-border)', borderRadius: 8,
            cursor: busy ? 'wait' : 'pointer',
            background: allowChange ? 'color-mix(in srgb, var(--tax-brand-primary) 6%, #fff)' : '#fff',
          }}>
            <input type="radio" name="notif-lock" disabled={busy}
                   checked={allowChange} onChange={() => onToggleNotifLock(true)}
                   style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{t('owner.settings.notifLock.unlocked')}</div>
              <div style={{ color: 'var(--tax-muted)', fontSize: 13, marginTop: 4 }}>
                {t('owner.settings.notifLock.unlockedHint')}
              </div>
            </div>
          </label>
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: 4 }}>{t('owner.settings.community.title')}</h3>
        <p style={{ color: 'var(--tax-muted)', marginTop: 0, marginBottom: 12, fontSize: 14 }}>
          {t('owner.settings.community.subtitle')}
        </p>
        <div className="tax-contact-grid">
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('owner.settings.community.name')}</div>
            <div className="tax-contact-item__value">{settings.name}</div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('owner.settings.community.contactEmail')}</div>
            <div className="tax-contact-item__value">{settings.contact_email || '—'}</div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('owner.settings.community.phone')}</div>
            <div className="tax-contact-item__value">{settings.phone || '—'}</div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('owner.settings.community.defaultLocale')}</div>
            <div className="tax-contact-item__value">{settings.default_locale === 'en' ? 'English' : 'Español'}</div>
          </div>
        </div>
      </section>
    </EmployeeShell>
  );
}
