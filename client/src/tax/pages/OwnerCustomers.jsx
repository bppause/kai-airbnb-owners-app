import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

// Phase 4a — owner view of every customer in the community. Surfaced inside
// the staff portal at /tax/{slug}/employee/customers; the shell only shows
// the "Customers" tab when employee.role === 'admin' (gate-checked there).
export default function OwnerCustomers() {
  const { t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');

  // Add-customer form state (inline expand)
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', locale: 'es' });
  const [busyAdd, setBusyAdd] = useState(false);
  const [addMsg, setAddMsg] = useState({ kind: 'idle', text: '' });

  const load = () => {
    if (!fbUser || !community) return;
    taxApi.adminListCustomers(auth, community.id)
      .then(d => setCustomers(d.customers || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };
  useEffect(load, [fbUser, community]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!customers) return null;
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q));
  }, [customers, search]);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) { setAddMsg({ kind: 'error', text: t('owner.customers.errEmailRequired') }); return; }
    setBusyAdd(true); setAddMsg({ kind: 'idle', text: '' });
    try {
      const r = await taxApi.adminCreateCustomer(auth, {
        communitySlug: community.id,
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        locale: form.locale,
      });
      setAddMsg({ kind: 'success', text: t('owner.customers.addedSuccess') });
      setForm({ name: '', email: '', phone: '', locale: 'es' });
      // Jump straight into the new customer's detail page.
      window.location.href = `/tax/${community.id}/employee/customers/${encodeURIComponent(r.id)}`;
    } catch (err) {
      setAddMsg({ kind: 'error', text: err?.message || t('respond.error.generic') });
    } finally {
      setBusyAdd(false);
    }
  };

  if (employee && employee.role !== 'admin') {
    return <EmployeeShell community={community} active="customers">
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }

  const base = community ? `/tax/${community.id}/employee/customers` : '#';

  return (
    <EmployeeShell community={community} active="customers">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t('owner.customers.title')}</h2>
        <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                onClick={() => setAdding(a => !a)}>
          {adding ? t('owner.customers.cancelAdd') : t('owner.customers.addBtn')}
        </button>
      </div>
      <p className="tax-section__lede">{t('owner.customers.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {adding && (
        <form className="tax-form" onSubmit={onAdd} noValidate style={{ marginBottom: 24 }}>
          <div className="tax-form__row2">
            <div>
              <label htmlFor="oc-name">{t('owner.customers.fieldName')}</label>
              <input id="oc-name" type="text" value={form.name}
                     onChange={e => setForm(p => ({ ...p, name: e.target.value }))} maxLength={200} />
            </div>
            <div>
              <label htmlFor="oc-email">{t('owner.customers.fieldEmail')} *</label>
              <input id="oc-email" type="email" required value={form.email}
                     onChange={e => setForm(p => ({ ...p, email: e.target.value }))} maxLength={200} />
            </div>
          </div>
          <div className="tax-form__row2">
            <div>
              <label htmlFor="oc-phone">{t('owner.customers.fieldPhone')}</label>
              <input id="oc-phone" type="tel" value={form.phone}
                     onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} maxLength={40} />
            </div>
            <div>
              <label htmlFor="oc-locale">{t('owner.customers.fieldLocale')}</label>
              <select id="oc-locale" value={form.locale}
                      onChange={e => setForm(p => ({ ...p, locale: e.target.value }))}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          {addMsg.text && (
            <div className={`tax-msg tax-msg--${addMsg.kind === 'error' ? 'error' : 'success'}`}>{addMsg.text}</div>
          )}
          <button type="submit" className="tax-btn tax-btn--primary" disabled={busyAdd}>
            {busyAdd ? t('lead.submitting') : t('owner.customers.createBtn')}
          </button>
        </form>
      )}

      <div style={{ marginBottom: 16 }}>
        <input type="search" placeholder={t('owner.customers.searchPlaceholder')}
               value={search} onChange={e => setSearch(e.target.value)}
               style={{
                 width: '100%', padding: '10px 12px',
                 border: '1px solid var(--tax-border)', borderRadius: 8, fontSize: 15,
               }} />
      </div>

      {filtered === null ? <p>{t('loading')}</p>
        : filtered.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>
              {search ? t('owner.customers.noMatch') : t('owner.customers.empty')}
            </p>
          : <div style={{ display: 'grid', gap: 8 }}>
              {filtered.map(c => (
                <a key={c.id} href={`${base}/${encodeURIComponent(c.id)}`}
                   className="tax-contact-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{c.name || c.email}</div>
                      <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 2 }}>
                        {c.email}
                        {c.phone ? ` • ${c.phone}` : ''}
                        {c.tax_subscriptions?.length
                          ? ` • ${c.tax_subscriptions.length} ${t('owner.customers.subsLabel')}`
                          : ''}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--tax-muted)' }}>
                      {c.locale === 'en' ? 'EN' : 'ES'}
                    </div>
                  </div>
                </a>
              ))}
            </div>}
    </EmployeeShell>
  );
}
