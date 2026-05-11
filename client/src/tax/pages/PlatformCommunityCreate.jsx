import { useState } from 'react';
import { useT } from '../i18n';
import { useTaxPlatformAuth } from '../auth/PlatformAuthProvider';
import { taxApi } from '../api';
import LocaleSwitcher from '../components/LocaleSwitcher';

// Provisions a new tax community. Required: slug, name, contactEmail,
// ownerEmail. Optional: phone, brand colors, default locale, owner name.
// On success, links the platform admin into the new community's
// /employee URL so they can finish setup (relationships, schedules, etc.).
export default function PlatformCommunityCreate() {
  const { t } = useT();
  const { email, signOut } = useTaxPlatformAuth();
  const auth = { uid: '', email };

  const [form, setForm] = useState({
    id: '',
    name: '',
    contactEmail: '',
    phone: '',
    defaultLocale: 'es',
    brandPrimaryColor: '#1d3a6d',
    brandSecondaryColor: '#d62027',
    ownerEmail: '',
    ownerName: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-derive slug from name when slug field is blank — typing "Acme
  // Tax Pros" gives "acme-tax-pros". Owner can override.
  const onNameChange = (v) => {
    const slugified = v.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    setForm(p => ({ ...p, name: v, id: p.id || slugified }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.id || !form.name || !form.contactEmail || !form.ownerEmail) {
      setErr(t('platform.create.errRequired'));
      return;
    }
    setBusy(true); setErr('');
    try {
      const r = await taxApi.platformCreateCommunity(auth, form);
      // Send them straight into the new community's owner view.
      window.location.href = `/tax/${encodeURIComponent(r.communityId)}/employee`;
    } catch (e) {
      setErr(e?.message || t('respond.error.generic'));
      setBusy(false);
    }
  };

  return (
    <div className="tax-app">
      <header className="tax-header" style={{ borderBottom: '2px solid var(--tax-brand-primary)' }}>
        <div className="tax-container tax-header__row">
          <a href="/tax/_platform" className="tax-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="tax-brand__mark" style={{ background: '#1d3a6d' }}>TX</span>
            <span style={{
              marginLeft: 10, padding: '2px 8px', borderRadius: 4,
              background: '#1d3a6d', color: '#fff',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
            }}>{t('platform.badge')}</span>
          </a>
          <nav className="tax-nav">
            <LocaleSwitcher />
            <span style={{ color: 'var(--tax-muted)', fontSize: 13 }}>{email}</span>
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={signOut}>
              {t('portal.signout')}
            </button>
          </nav>
        </div>
      </header>

      <div className="tax-container" style={{ paddingTop: 24 }}>
        <a href="/tax/_platform" style={{ fontSize: 14, color: 'var(--tax-muted)' }}>← {t('platform.create.back')}</a>
        <h2 style={{ marginTop: 8 }}>{t('platform.create.title')}</h2>
        <p className="tax-section__lede">{t('platform.create.subtitle')}</p>

        <form className="tax-form" onSubmit={onSubmit} noValidate style={{ maxWidth: 720 }}>
          <div className="tax-form__row2">
            <div>
              <label htmlFor="pc-name">{t('platform.create.name')} *</label>
              <input id="pc-name" type="text" value={form.name}
                     onChange={e => onNameChange(e.target.value)} maxLength={200} required />
            </div>
            <div>
              <label htmlFor="pc-id">{t('platform.create.slug')} *</label>
              <input id="pc-id" type="text" value={form.id}
                     onChange={e => onChange('id', e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-'))}
                     placeholder="acme-tax-pros" maxLength={100} required
                     style={{ fontFamily: 'monospace' }} />
              <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 4 }}>
                {t('platform.create.slugHint')}
              </div>
            </div>
          </div>

          <div className="tax-form__row2">
            <div>
              <label htmlFor="pc-contact">{t('platform.create.contactEmail')} *</label>
              <input id="pc-contact" type="email" value={form.contactEmail}
                     onChange={e => onChange('contactEmail', e.target.value)} required maxLength={200} />
              <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 4 }}>
                {t('platform.create.contactEmailHint')}
              </div>
            </div>
            <div>
              <label htmlFor="pc-phone">{t('platform.create.phone')}</label>
              <input id="pc-phone" type="tel" value={form.phone}
                     onChange={e => onChange('phone', e.target.value)} maxLength={40} />
            </div>
          </div>

          <div className="tax-form__row2">
            <div>
              <label htmlFor="pc-locale">{t('platform.create.defaultLocale')}</label>
              <select id="pc-locale" value={form.defaultLocale}
                      onChange={e => onChange('defaultLocale', e.target.value)}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="tax-form__row2">
              <div>
                <label htmlFor="pc-primary">{t('platform.create.brandPrimary')}</label>
                <input id="pc-primary" type="color" value={form.brandPrimaryColor || '#1d3a6d'}
                       onChange={e => onChange('brandPrimaryColor', e.target.value)} style={{ height: 40 }} />
              </div>
              <div>
                <label htmlFor="pc-secondary">{t('platform.create.brandSecondary')}</label>
                <input id="pc-secondary" type="color" value={form.brandSecondaryColor || '#d62027'}
                       onChange={e => onChange('brandSecondaryColor', e.target.value)} style={{ height: 40 }} />
              </div>
            </div>
          </div>

          <fieldset style={{ border: '1px solid var(--tax-border)', borderRadius: 8, padding: 16, margin: 0 }}>
            <legend style={{ padding: '0 8px', fontWeight: 600, fontSize: 14 }}>
              {t('platform.create.ownerSection')}
            </legend>
            <p style={{ color: 'var(--tax-muted)', fontSize: 13, margin: '0 0 12px' }}>
              {t('platform.create.ownerHint')}
            </p>
            <div className="tax-form__row2">
              <div>
                <label htmlFor="pc-owner-email">{t('platform.create.ownerEmail')} *</label>
                <input id="pc-owner-email" type="email" value={form.ownerEmail}
                       onChange={e => onChange('ownerEmail', e.target.value)} required maxLength={200} />
              </div>
              <div>
                <label htmlFor="pc-owner-name">{t('platform.create.ownerName')}</label>
                <input id="pc-owner-name" type="text" value={form.ownerName}
                       onChange={e => onChange('ownerName', e.target.value)} maxLength={200} />
              </div>
            </div>
          </fieldset>

          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
            {busy ? t('lead.submitting') : t('platform.create.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
