import { useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

const CATEGORY_KEY = {
  business: 'portal.profile.category.business',
  individual: 'portal.profile.category.individual',
  general: 'portal.profile.category.general',
  audit: 'portal.profile.category.audit',
};

export default function PortalProfile() {
  const { locale, t } = useT();
  const { fbUser, customer, community, prefs, relationships, refreshMe } = useTaxAuth();
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

      <h3>{t('portal.profile.services')}</h3>
      <p className="tax-section__lede" style={{ marginBottom: 16 }}>
        {t('portal.profile.servicesHint')}
      </p>
      {relationships && relationships.length > 0 ? (
        <RelationshipChips relationships={relationships} locale={locale} t={t} />
      ) : (
        <p style={{ color: 'var(--tax-muted)', marginBottom: 32 }}>{t('portal.profile.noServices')}</p>
      )}

      <h3 style={{ marginTop: 32 }}>{t('portal.profile.notifications')}</h3>
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

function RelationshipChips({ relationships, locale, t }) {
  // Group by category so the chip list reads in a predictable order
  // (Business → Individual → General → Audit).
  const order = ['business', 'individual', 'general', 'audit'];
  const byCat = order.map(cat => ({
    category: cat,
    items: (relationships || [])
      .filter(r => r.type?.category === cat)
      .sort((a, b) => (a.type?.display_order || 0) - (b.type?.display_order || 0)),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ marginBottom: 16 }}>
      {byCat.map(g => (
        <div key={g.category} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.6px',
                        color: 'var(--tax-muted)', marginBottom: 6 }}>
            {t(CATEGORY_KEY[g.category])}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {g.items.map(r => (
              <span key={r.id} style={{
                display: 'inline-block', padding: '6px 12px', borderRadius: 999,
                background: 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)',
                color: 'var(--tax-brand-primary)',
                border: '1px solid color-mix(in srgb, var(--tax-brand-primary) 20%, #fff)',
                fontSize: 13, fontWeight: 600,
              }}>
                {pickI18n(r.type?.name_i18n, locale).value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
