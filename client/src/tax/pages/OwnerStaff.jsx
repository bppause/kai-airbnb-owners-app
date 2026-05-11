import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

export default function OwnerStaff() {
  const { t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [employees, setEmployees] = useState(null);
  const [err, setErr] = useState('');

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff', locale: 'en' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  const load = () => {
    if (!fbUser || !community) return;
    taxApi.adminListEmployees(auth, community.id)
      .then(d => setEmployees(d.employees || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };
  useEffect(load, [fbUser, community]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAdd = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) { setMsg({ kind: 'error', text: t('owner.customers.errEmailRequired') }); return; }
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      await taxApi.adminCreateEmployee(auth, {
        communitySlug: community.id,
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        role: form.role,
        locale: form.locale,
      });
      setMsg({ kind: 'success', text: t('owner.staff.addedSuccess') });
      setForm({ name: '', email: '', role: 'staff', locale: 'en' });
      setAdding(false);
      load();
    } catch (err) {
      setMsg({ kind: 'error', text: err?.message || t('respond.error.generic') });
    } finally { setBusy(false); }
  };

  if (employee && employee.role !== 'admin') {
    return <EmployeeShell community={community}>
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }

  const base = community ? `/tax/${community.id}/employee/staff` : '#';

  return (
    <EmployeeShell community={community} active="staff">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{t('owner.staff.title')}</h2>
        <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                onClick={() => setAdding(a => !a)}>
          {adding ? t('owner.staff.cancelAdd') : t('owner.staff.addBtn')}
        </button>
      </div>
      <p className="tax-section__lede">{t('owner.staff.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {adding && (
        <form className="tax-form" onSubmit={onAdd} noValidate style={{ marginBottom: 24 }}>
          <div className="tax-form__row2">
            <div>
              <label htmlFor="os-name">{t('owner.staff.fieldName')}</label>
              <input id="os-name" type="text" value={form.name}
                     onChange={e => setForm(p => ({ ...p, name: e.target.value }))} maxLength={200} />
            </div>
            <div>
              <label htmlFor="os-email">{t('owner.staff.fieldEmail')} *</label>
              <input id="os-email" type="email" required value={form.email}
                     onChange={e => setForm(p => ({ ...p, email: e.target.value }))} maxLength={200} />
            </div>
          </div>
          <div className="tax-form__row2">
            <div>
              <label htmlFor="os-role">{t('owner.staff.fieldRole')}</label>
              <select id="os-role" value={form.role}
                      onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="staff">{t('owner.staff.role.staff')}</option>
                <option value="admin">{t('owner.staff.role.admin')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="os-locale">{t('owner.staff.fieldLocale')}</label>
              <select id="os-locale" value={form.locale}
                      onChange={e => setForm(p => ({ ...p, locale: e.target.value }))}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
          {msg.text && (
            <div className={`tax-msg tax-msg--${msg.kind === 'error' ? 'error' : 'success'}`}>{msg.text}</div>
          )}
          <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
            {busy ? t('lead.submitting') : t('owner.staff.createBtn')}
          </button>
        </form>
      )}

      {employees === null ? <p>{t('loading')}</p>
        : employees.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.staff.empty')}</p>
          : <div style={{ display: 'grid', gap: 8 }}>
              {employees.map(e => (
                <a key={e.id} href={`${base}/${encodeURIComponent(e.id)}`}
                   className="tax-contact-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {e.name || e.email}
                        <span style={{
                          marginLeft: 8, padding: '1px 8px', borderRadius: 999,
                          background: e.role === 'admin' ? 'var(--tax-brand-primary)' : 'var(--tax-bg-alt)',
                          color: e.role === 'admin' ? '#fff' : 'var(--tax-muted)',
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        }}>{e.role}</span>
                        {e.firebase_uid ? null : (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--tax-muted)' }}>
                            ({t('owner.staff.notSignedIn')})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 2 }}>
                        {e.email}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--tax-muted)' }}>
                      {(e.notification_channels || []).includes('email')
                        ? t('owner.staff.channelBoth') : t('owner.staff.channelPortal')}
                    </div>
                  </div>
                </a>
              ))}
            </div>}
    </EmployeeShell>
  );
}
