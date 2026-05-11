import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

const WHATSAPP_E164 = /^\+[1-9]\d{6,14}$/;
function normalizeWhatsappForCheck(raw) {
  const trimmed = String(raw || '').trim();
  return '+' + trimmed.replace(/^\+/, '').replace(/\D+/g, '');
}

// Employee profile editor. Mirrors the customer-side fields plus a key v3
// addition: notification channel preferences — defaulting to portal-only
// per the owner spec, switchable to "portal + email" via the checkboxes.
export default function EmployeeProfile() {
  const { t } = useT();
  const { fbUser, employee, community, refreshMe } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [form, setForm] = useState({
    name: '', phone: '', whatsapp: '', preferredEmail: '',
    addr: { line1: '', line2: '', city: '', state: '', postal_code: '', country: 'US' },
    inApp: true, email: false,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  useEffect(() => {
    if (!employee) return;
    const a = employee.address || {};
    const ch = Array.isArray(employee.notificationChannels) ? employee.notificationChannels : ['in_app'];
    setForm({
      name: employee.name || '',
      phone: employee.phone || '',
      whatsapp: employee.whatsapp || '',
      preferredEmail: employee.preferredCommunicationEmail || '',
      addr: {
        line1: a.line1 || '', line2: a.line2 || '',
        city: a.city || '', state: a.state || '',
        postal_code: a.postal_code || '',
        country: a.country || 'US',
      },
      inApp: ch.includes('in_app'),
      email: ch.includes('email'),
    });
  }, [employee]);

  const onField = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const onAddr  = (k, v) => setForm(p => ({ ...p, addr: { ...p.addr, [k]: v } }));

  const whatsappNormalized = form.whatsapp ? normalizeWhatsappForCheck(form.whatsapp) : '';
  const whatsappValid = !form.whatsapp || WHATSAPP_E164.test(whatsappNormalized);
  const waLink = whatsappValid && whatsappNormalized.length > 1
    ? `https://wa.me/${whatsappNormalized.replace(/^\+/, '')}` : '';

  const onSave = async (e) => {
    e?.preventDefault?.();
    if (form.whatsapp && !whatsappValid) {
      setMsg({ kind: 'error', text: t('portal.profile.whatsapp.invalid') });
      return;
    }
    if (!form.inApp && !form.email) {
      setMsg({ kind: 'error', text: t('employee.profile.channels.atLeastOne') });
      return;
    }
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      const address = {};
      for (const k of ['line1', 'line2', 'city', 'state', 'postal_code', 'country']) {
        const v = String(form.addr[k] || '').trim();
        if (v) address[k] = v;
      }
      const channels = [];
      if (form.inApp) channels.push('in_app');
      if (form.email) channels.push('email');
      await taxApi.updateEmployeeProfile(auth, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        address,
        preferredCommunicationEmail: form.preferredEmail.trim(),
        notificationChannels: channels,
      });
      setMsg({ kind: 'success', text: t('portal.profile.saved') });
      refreshMe();
    } catch (err) {
      setMsg({ kind: 'error', text: err?.message || t('respond.error.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmployeeShell community={community} active="profile">
      <h2 style={{ marginTop: 0 }}>{t('employee.profile.title')}</h2>

      <form className="tax-form" onSubmit={onSave} noValidate style={{ maxWidth: 720 }}>
        <div className="tax-form__row2">
          <div>
            <label htmlFor="ep-name">{t('portal.profile.name')}</label>
            <input id="ep-name" type="text" value={form.name}
                   onChange={e => onField('name', e.target.value)} maxLength={200} />
          </div>
          <div>
            <label htmlFor="ep-login">
              {t('portal.profile.email')}
              <span style={{ color: 'var(--tax-muted)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
                ({t('portal.profile.email.readonly')})
              </span>
            </label>
            <input id="ep-login" type="email" value={employee?.email || ''} readOnly
                   style={{ background: 'var(--tax-bg-alt)', color: 'var(--tax-muted)' }} />
          </div>
        </div>

        <div className="tax-form__row2">
          <div>
            <label htmlFor="ep-phone">{t('portal.profile.phone')}</label>
            <input id="ep-phone" type="tel" value={form.phone}
                   placeholder="(415) 555-1234"
                   onChange={e => onField('phone', e.target.value)} maxLength={40} />
          </div>
          <div>
            <label htmlFor="ep-whatsapp">
              {t('portal.profile.whatsapp')}
              <span style={{ color: 'var(--tax-muted)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
                {t('portal.profile.whatsapp.format')}
              </span>
            </label>
            <input id="ep-whatsapp" type="tel" value={form.whatsapp}
                   placeholder="+14155551234"
                   onChange={e => onField('whatsapp', e.target.value)} maxLength={20}
                   style={form.whatsapp && !whatsappValid ? { borderColor: 'var(--tax-error)' } : undefined} />
            {form.whatsapp && !whatsappValid && (
              <div style={{ color: 'var(--tax-error)', fontSize: 12, marginTop: 4 }}>
                {t('portal.profile.whatsapp.invalid')}
              </div>
            )}
            {waLink && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tax-brand-primary)' }}>
                  {t('portal.profile.whatsapp.preview')} {whatsappNormalized}
                </a>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="ep-pref-email">
            {t('portal.profile.preferredEmail')}
            <span style={{ color: 'var(--tax-muted)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
              {t('portal.profile.preferredEmail.hint')}
            </span>
          </label>
          <input id="ep-pref-email" type="email" value={form.preferredEmail}
                 placeholder={employee?.email || ''}
                 onChange={e => onField('preferredEmail', e.target.value)} maxLength={200} />
        </div>

        <fieldset style={{ border: '1px solid var(--tax-border)', borderRadius: 8, padding: 16, margin: 0 }}>
          <legend style={{ padding: '0 8px', fontWeight: 600, fontSize: 14 }}>{t('portal.profile.address')}</legend>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label htmlFor="ep-addr1">{t('portal.profile.address.line1')}</label>
              <input id="ep-addr1" type="text" value={form.addr.line1}
                     onChange={e => onAddr('line1', e.target.value)} maxLength={200} />
            </div>
            <div>
              <label htmlFor="ep-addr2">{t('portal.profile.address.line2')}</label>
              <input id="ep-addr2" type="text" value={form.addr.line2}
                     placeholder={t('portal.profile.address.line2.placeholder')}
                     onChange={e => onAddr('line2', e.target.value)} maxLength={200} />
            </div>
            <div className="tax-form__row2">
              <div>
                <label htmlFor="ep-city">{t('portal.profile.address.city')}</label>
                <input id="ep-city" type="text" value={form.addr.city}
                       onChange={e => onAddr('city', e.target.value)} maxLength={120} />
              </div>
              <div>
                <label htmlFor="ep-state">{t('portal.profile.address.state')}</label>
                <input id="ep-state" type="text" value={form.addr.state}
                       onChange={e => onAddr('state', e.target.value)} maxLength={80} />
              </div>
            </div>
            <div className="tax-form__row2">
              <div>
                <label htmlFor="ep-postal">{t('portal.profile.address.postal')}</label>
                <input id="ep-postal" type="text" value={form.addr.postal_code}
                       onChange={e => onAddr('postal_code', e.target.value)} maxLength={20} />
              </div>
              <div>
                <label htmlFor="ep-country">{t('portal.profile.address.country')}</label>
                <input id="ep-country" type="text" value={form.addr.country}
                       onChange={e => onAddr('country', e.target.value)} maxLength={4}
                       placeholder="US" />
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid var(--tax-border)', borderRadius: 8, padding: 16, margin: 0 }}>
          <legend style={{ padding: '0 8px', fontWeight: 600, fontSize: 14 }}>
            {t('employee.profile.channels.title')}
          </legend>
          <p style={{ color: 'var(--tax-muted)', fontSize: 13, margin: '0 0 12px' }}>
            {t('employee.profile.channels.hint')}
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={form.inApp}
                   onChange={e => onField('inApp', e.target.checked)} />
            <span>{t('employee.profile.channels.inApp')}</span>
            <span style={{ color: 'var(--tax-muted)', fontSize: 12, marginLeft: 4 }}>
              {t('employee.profile.channels.inAppHint')}
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.email}
                   onChange={e => onField('email', e.target.checked)} />
            <span>{t('employee.profile.channels.email')}</span>
            <span style={{ color: 'var(--tax-muted)', fontSize: 12, marginLeft: 4 }}>
              {t('employee.profile.channels.emailHint')}
            </span>
          </label>
        </fieldset>

        {msg.text && (
          <div className={`tax-msg tax-msg--${msg.kind === 'error' ? 'error' : 'success'}`}>{msg.text}</div>
        )}

        <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
          {busy ? t('lead.submitting') : t('portal.profile.save')}
        </button>
      </form>
    </EmployeeShell>
  );
}
