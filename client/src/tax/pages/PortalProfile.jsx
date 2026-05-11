import { useState } from 'react';
import { useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

export default function PortalProfile() {
  const { t } = useT();
  const { fbUser, customer, community, prefs, refreshMe } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const allowChange = Boolean(prefs?.allowChange);
  const initial = prefs?.channels || ['email', 'in_app'];
  const [email, setEmail] = useState(initial.includes('email'));
  const [inApp, setInApp] = useState(initial.includes('in_app'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  const onSave = async () => {
    const channels = [];
    if (email) channels.push('email');
    if (inApp) channels.push('in_app');
    if (!channels.length) {
      setMsg({ kind: 'error', text: t('portal.profile.atLeastOne') });
      return;
    }
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      await taxApi.updatePreferences(auth, { channels });
      setMsg({ kind: 'success', text: t('portal.profile.saved') });
      refreshMe();
    } catch (err) {
      setMsg({ kind: 'error', text: err?.message || t('respond.error.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalShell community={community} active="profile">
      <h2 style={{ marginTop: 0 }}>{t('portal.profile.title')}</h2>

      <div className="tax-contact-grid" style={{ marginBottom: 32 }}>
        <div className="tax-contact-item">
          <div className="tax-contact-item__label">{t('portal.profile.name')}</div>
          <div className="tax-contact-item__value">{customer?.name || '—'}</div>
        </div>
        <div className="tax-contact-item">
          <div className="tax-contact-item__label">{t('portal.profile.email')}</div>
          <div className="tax-contact-item__value">{customer?.email || '—'}</div>
        </div>
        <div className="tax-contact-item">
          <div className="tax-contact-item__label">{t('portal.profile.phone')}</div>
          <div className="tax-contact-item__value">{customer?.phone || '—'}</div>
        </div>
        <div className="tax-contact-item">
          <div className="tax-contact-item__label">{t('portal.profile.language')}</div>
          <div className="tax-contact-item__value">{customer?.locale === 'en' ? 'English' : 'Español'}</div>
        </div>
      </div>

      <h3>{t('portal.profile.notifications')}</h3>
      <p className="tax-section__lede" style={{ marginBottom: 16 }}>
        {allowChange ? t('portal.profile.notifications.editable') : t('portal.profile.notifications.locked')}
      </p>

      <div className="tax-form" style={{ maxWidth: 480 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: allowChange ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={email} disabled={!allowChange}
                 onChange={e => setEmail(e.target.checked)} />
          <span>{t('portal.profile.channel.email')}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: allowChange ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={inApp} disabled={!allowChange}
                 onChange={e => setInApp(e.target.checked)} />
          <span>{t('portal.profile.channel.inApp')}</span>
        </label>

        {msg.text && (
          <div className={`tax-msg tax-msg--${msg.kind === 'error' ? 'error' : 'success'}`}>{msg.text}</div>
        )}

        {allowChange && (
          <button type="button" className="tax-btn tax-btn--primary" onClick={onSave} disabled={busy}>
            {busy ? t('lead.submitting') : t('portal.profile.save')}
          </button>
        )}
      </div>

      <p style={{ marginTop: 32, color: 'var(--tax-muted)', fontSize: 14 }}>
        {t('portal.profile.contactToChange')} {community?.contact_email && (
          <a href={`mailto:${community.contact_email}`}>{community.contact_email}</a>
        )}
      </p>
    </PortalShell>
  );
}
