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

      <CommunityContactSection settings={settings} auth={auth} community={community}
                               t={t} onSaved={load} />
    </EmployeeShell>
  );
}

// Phase 4n.14: contact-card editor. Phone, WhatsApp, contact email, and
// address fields drive the public landing page "Visit us" card + the map
// embed. Name and default locale stay read-only here — they live on the
// platform community editor for now.
function CommunityContactSection({ settings, auth, community, t, onSaved }) {
  const [form, setForm] = useState({
    contact_email: '', phone: '', whatsapp: '',
    address_line1: '', address_line2: '',
    city: '', state: '', postal_code: '', country: '',
  });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  useEffect(() => {
    if (!settings) return;
    setForm({
      contact_email: settings.contact_email || '',
      phone: settings.phone || '',
      whatsapp: settings.whatsapp || '',
      address_line1: settings.address_line1 || '',
      address_line2: settings.address_line2 || '',
      city: settings.city || '',
      state: settings.state || '',
      postal_code: settings.postal_code || '',
      country: settings.country || '',
    });
  }, [settings]);

  const onField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const onSave = async () => {
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      await taxApi.adminUpdateCommunityContact(auth, {
        communitySlug: community.id,
        contact_email: form.contact_email.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        address_line1: form.address_line1.trim(),
        address_line2: form.address_line2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
        country: form.country.trim(),
      });
      setMsg({ kind: 'success', text: t('owner.settings.saved') });
      setEditing(false);
      onSaved();
    } catch (e) {
      setMsg({ kind: 'error', text: e?.message || t('respond.error.generic') });
    } finally { setBusy(false); }
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>{t('owner.settings.community.title')}</h3>
          <p style={{ color: 'var(--tax-muted)', marginTop: 0, marginBottom: 12, fontSize: 14 }}>
            {t('owner.settings.community.subtitle')}
          </p>
        </div>
        {!editing && (
          <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                  onClick={() => setEditing(true)}>
            {t('owner.settings.community.editBtn')}
          </button>
        )}
      </div>

      {msg.text && (
        <div className={`tax-msg tax-msg--${msg.kind === 'error' ? 'error' : 'success'}`}
             style={{ marginBottom: 12 }}>{msg.text}</div>
      )}

      {!editing ? (
        <div className="tax-contact-grid">
          <ReadRow label={t('owner.settings.community.name')}         value={settings.name} />
          <ReadRow label={t('owner.settings.community.contactEmail')} value={settings.contact_email} />
          <ReadRow label={t('owner.settings.community.phone')}        value={settings.phone} />
          <ReadRow label={t('owner.settings.community.whatsapp')}     value={settings.whatsapp} />
          <ReadRow label={t('owner.settings.community.address')}      value={[settings.address_line1, settings.address_line2, settings.city, settings.state, settings.postal_code, settings.country].filter(Boolean).join(', ')} />
          <ReadRow label={t('owner.settings.community.defaultLocale')} value={settings.default_locale === 'en' ? 'English' : 'Español'} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
          <Field id="cs-email" label={t('owner.settings.community.contactEmail')}
                 type="email" value={form.contact_email}
                 onChange={v => onField('contact_email', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field id="cs-phone" label={t('owner.settings.community.phone')}
                   type="tel" value={form.phone} onChange={v => onField('phone', v)} />
            <Field id="cs-wa" label={t('owner.settings.community.whatsapp')}
                   placeholder="+14155551234"
                   hint={t('owner.settings.community.whatsappHint')}
                   value={form.whatsapp} onChange={v => onField('whatsapp', v)} />
          </div>
          <Field id="cs-a1" label={t('owner.settings.community.addressLine1')}
                 value={form.address_line1} onChange={v => onField('address_line1', v)} />
          <Field id="cs-a2" label={t('owner.settings.community.addressLine2')}
                 value={form.address_line2} onChange={v => onField('address_line2', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <Field id="cs-city" label={t('owner.settings.community.city')}
                   value={form.city} onChange={v => onField('city', v)} />
            <Field id="cs-state" label={t('owner.settings.community.state')}
                   value={form.state} onChange={v => onField('state', v)} />
            <Field id="cs-zip" label={t('owner.settings.community.postalCode')}
                   value={form.postal_code} onChange={v => onField('postal_code', v)} />
          </div>
          <Field id="cs-country" label={t('owner.settings.community.country')}
                 value={form.country} onChange={v => onField('country', v)} />

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                    disabled={busy} onClick={onSave}>
              {busy ? t('lead.submitting') : t('owner.settings.community.saveBtn')}
            </button>
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    disabled={busy} onClick={() => setEditing(false)}>
              {t('preview.close')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ReadRow({ label, value }) {
  return (
    <div className="tax-contact-item">
      <div className="tax-contact-item__label">{label}</div>
      <div className="tax-contact-item__value">{value || '—'}</div>
    </div>
  );
}

function Field({ id, label, type, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{label}</label>
      <input id={id} type={type || 'text'} value={value || ''}
             placeholder={placeholder || ''}
             onChange={e => onChange(e.target.value)}
             style={{ width: '100%' }} />
      {hint && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tax-muted)' }}>{hint}</p>}
    </div>
  );
}
