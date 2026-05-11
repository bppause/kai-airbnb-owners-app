import { useEffect, useMemo, useRef, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

// Customer browser. Surfaced inside the staff portal at
// /tax/{slug}/employee/customers and visible to BOTH admin and staff
// employees:
//   admin → uses adminListCustomers (whole community)
//   staff → uses listEmployeeCustomers (scoped to assigned customers)
//
// Search + filter behavior is identical for both roles. Admin-only
// surfaces (Add / Import) are gated by role.
//
// Search runs server-side via the q + relationshipTypeIds params on
// the underlying endpoint. The frontend debounces input changes by
// 300ms before refetching to keep typing responsive.
export default function OwnerCustomers() {
  const { locale, t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };
  const isAdmin = employee?.role === 'admin';

  const [customers, setCustomers] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');                 // debounced value
  const [relationshipFilter, setRelationshipFilter] = useState([]); // array of type ids
  const [allTypes, setAllTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Add-customer form state (admin only; staff sees no Add UI)
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', locale: 'es' });
  const [busyAdd, setBusyAdd] = useState(false);
  const [addMsg, setAddMsg] = useState({ kind: 'idle', text: '' });

  // Debounce the search input so we don't refetch on every keystroke.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const load = () => {
    if (!fbUser || !community) return;
    setLoading(true); setErr('');
    const opts = { q: search, relationshipTypeIds: relationshipFilter };
    const p = isAdmin
      ? taxApi.adminListCustomers(auth, community.id, opts)
      : taxApi.listEmployeeCustomers(auth, opts);
    p.then(d => setCustomers(d.customers || []))
     .catch(e => setErr(e?.message || t('error.loadFailed')))
     .finally(() => setLoading(false));
  };
  useEffect(load, [fbUser, community, search, relationshipFilter, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load relationship-type catalog once for the chip filter. Both admin
  // and staff need it; the endpoint sits behind requireOwnerAdmin so staff
  // would 403. Wrap in try/catch so a 403 doesn't blow up the page —
  // staff just won't see the chip filter (search still works fine).
  useEffect(() => {
    if (!fbUser || !community) return;
    taxApi.adminListRelationshipTypes(auth)
      .then(d => setAllTypes(d.types || []))
      .catch(() => setAllTypes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  const toggleRelationshipFilter = (typeId) =>
    setRelationshipFilter(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]);

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
      window.location.href = `/tax/${community.id}/employee/customers/${encodeURIComponent(r.id)}`;
    } catch (err) {
      setAddMsg({ kind: 'error', text: err?.message || t('respond.error.generic') });
    } finally {
      setBusyAdd(false);
    }
  };

  const base = community ? `/tax/${community.id}/employee/customers` : '#';

  return (
    <EmployeeShell community={community} active="customers">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('owner.customers.title')}</h2>
        {/* Admin-only actions. Staff sees the list + search/filter but no
            create or import controls — they manage relationships through
            the customer detail page (admin-only) or via the inbox flow. */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    onClick={() => { setImporting(im => !im); setAdding(false); }}
                    style={{ color: 'var(--tax-text)' }}>
              {importing ? t('owner.customers.cancelImport') : t('owner.customers.importBtn')}
            </button>
            <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                    onClick={() => { setAdding(a => !a); setImporting(false); }}>
              {adding ? t('owner.customers.cancelAdd') : t('owner.customers.addBtn')}
            </button>
          </div>
        )}
      </div>
      <p className="tax-section__lede">
        {isAdmin ? t('owner.customers.subtitle') : t('owner.customers.subtitleStaff')}
      </p>

      {isAdmin && importing && (
        <ImportCustomers auth={auth} community={community}
                         onDone={() => { setImporting(false); load(); }}
                         t={t} />
      )}

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {isAdmin && adding && (
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

      <div style={{ marginBottom: 12 }}>
        <input type="search" placeholder={t('owner.customers.searchPlaceholder')}
               value={searchInput} onChange={e => setSearchInput(e.target.value)}
               style={{
                 width: '100%', padding: '10px 12px',
                 border: '1px solid var(--tax-border)', borderRadius: 8, fontSize: 15,
               }} />
        <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 4 }}>
          {t('owner.customers.searchHint')}
        </div>
      </div>

      {allTypes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tax-muted)',
                        textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
            {t('owner.customers.filterRelationships')}
            {relationshipFilter.length > 0 && (
              <button type="button"
                      onClick={() => setRelationshipFilter([])}
                      style={{
                        marginLeft: 10, border: 0, background: 'transparent',
                        color: 'var(--tax-brand-primary)', cursor: 'pointer',
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      }}>
                {t('owner.customers.clearFilters')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allTypes.map(tp => {
              const active = relationshipFilter.includes(tp.id);
              return (
                <button key={tp.id} type="button"
                        onClick={() => toggleRelationshipFilter(tp.id)}
                        style={{
                          padding: '4px 10px', borderRadius: 999,
                          background: active
                            ? 'color-mix(in srgb, var(--tax-brand-primary) 12%, #fff)'
                            : '#fff',
                          color: active ? 'var(--tax-brand-primary)' : 'var(--tax-text)',
                          border: '1px solid',
                          borderColor: active
                            ? 'color-mix(in srgb, var(--tax-brand-primary) 35%, #fff)'
                            : 'var(--tax-border)',
                          fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                        }}>
                  {pickI18n(tp.name_i18n, locale).value || tp.slug}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {customers === null || (loading && !customers) ? <p>{t('loading')}</p>
        : customers.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>
              {search || relationshipFilter.length > 0
                ? t('owner.customers.noMatch')
                : t('owner.customers.empty')}
            </p>
          : <div style={{ display: 'grid', gap: 8, opacity: loading ? 0.6 : 1 }}>
              {customers.map(c => (
                <a key={c.id} href={`${base}/${encodeURIComponent(c.id)}`}
                   className="tax-contact-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{c.name || c.email}</div>
                      <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 2 }}>
                        {c.email}
                        {c.phone ? ` • ${c.phone}` : ''}
                        {c.whatsapp ? ` • WhatsApp ${c.whatsapp}` : ''}
                      </div>
                      {/* Address summary — first line + city when available */}
                      {(c.address?.line1 || c.address?.city) && (
                        <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 2 }}>
                          {[c.address.line1, c.address.city, c.address.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {/* Relationship chips */}
                      {Array.isArray(c.relationships) && c.relationships.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {c.relationships.map(r => (
                            <span key={r.relationship_type_id} style={{
                              padding: '1px 8px', borderRadius: 999,
                              background: 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)',
                              color: 'var(--tax-brand-primary)',
                              border: '1px solid color-mix(in srgb, var(--tax-brand-primary) 18%, #fff)',
                              fontSize: 11, fontWeight: 600,
                            }}>
                              {pickI18n(r.type?.name_i18n, locale).value || r.relationship_type_id}
                            </span>
                          ))}
                        </div>
                      )}
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

// CSV import dialog. Two-step UX:
//   1. Template download — generated client-side so no static asset deploy
//      is needed. Header row + 2 example rows + a comment row explaining
//      the relationship-tag format. Excel/Sheets/Numbers all open it.
//   2. Upload — owner pastes CSV or picks a file. Server parses, validates
//      per-row, returns { created, skipped, errors[] }. The dialog
//      displays the summary inline so the owner can fix problem rows and
//      re-upload (existing customers are skipped on re-run).
//
// Insert-only — duplicate emails report as 'skipped' rather than
// overwriting. To update existing customers, use the customer detail
// edit form (Phase 4d).
function ImportCustomers({ auth, community, onDone, t }) {
  const [csvText, setCsvText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const downloadTemplate = () => {
    // Sample rows show all supported columns. Comments aren't real CSV
    // (they start with '#') so the import will skip them as invalid
    // emails; we include them as inline documentation in the file the
    // owner downloads. Better than a separate README.
    const lines = [
      'email,name,phone,whatsapp,locale,address_line1,address_line2,city,state,postal_code,country,preferred_communication_email,notes,relationships',
      'sample.llc@example.com,Sample LLC Owner,+14155551234,+14155551234,en,123 Main St,Suite 4,San Francisco,CA,94103,US,billing@example.com,New client referred by Maria,"business.llc,business.bookkeeping,business.payroll"',
      'maria.gomez@example.com,Maria Gómez,(860) 555-2233,,es,742 Pine St,,Hartford,CT,06103,US,,Quarterly sales tax + annual 1040,"individual.taxes,business.sales_tax_filing"',
      '# Columns are case-insensitive. Required: email. Whatsapp must be E.164 (+countrycode+number) — leave blank if unknown.',
      '# locale: en or es (default es). country defaults to US when an address line is filled.',
      '# relationships: comma-separated ids from the catalog — see /tax/{slug}/employee/articles for the list.',
      '# Valid relationship ids: business.llc, business.s_corp, business.partnership_1065, business.sales_tax_filing,',
      '#                         business.business_formation, business.payroll, business.bookkeeping,',
      '#                         individual.taxes, individual.itin,',
      '#                         general.notary, general.translation, audit.irs, audit.drs',
      '# Duplicate emails (already in this community) are skipped.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-customer-import-${community.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.onerror = () => setErr(t('owner.customers.import.errFileRead'));
    reader.readAsText(f, 'utf-8');
  };

  const onSubmit = async () => {
    if (!csvText.trim()) { setErr(t('owner.customers.import.errEmpty')); return; }
    setBusy(true); setErr(''); setResult(null);
    try {
      const r = await taxApi.adminImportCustomers(auth, {
        communitySlug: community.id, csv: csvText,
      });
      setResult(r);
    } catch (e) {
      setErr(e?.message || t('respond.error.generic'));
    } finally { setBusy(false); }
  };

  const hardErrors = (result?.errors || []).filter(e => !e.skipped && !e.warning);
  const warnings   = (result?.errors || []).filter(e => e.warning);
  const skippedRows = (result?.errors || []).filter(e => e.skipped);

  return (
    <form className="tax-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600 }}>{t('owner.customers.import.title')}</div>
      <p style={{ color: 'var(--tax-muted)', fontSize: 13, margin: '0 0 8px' }}>
        {t('owner.customers.import.subtitle')}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                onClick={downloadTemplate}
                style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
          {t('owner.customers.import.downloadTemplate')}
        </button>
        <label className="tax-btn tax-btn--ghost tax-btn--sm"
               style={{ color: 'var(--tax-text)', cursor: 'pointer' }}>
          {t('owner.customers.import.pickFile')}
          <input type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }} onChange={onFile} />
        </label>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)', marginTop: 8, display: 'block' }}>
          {t('owner.customers.import.csvLabel')}
        </label>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
                  rows={10}
                  placeholder={t('owner.customers.import.csvPlaceholder')}
                  style={{
                    width: '100%', padding: 10, border: '1px solid var(--tax-border)',
                    borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
                  }} />
      </div>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {result && (
        <div style={{ background: 'var(--tax-bg-alt)', padding: 12, borderRadius: 8, display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>
            {t('owner.customers.import.summary', {
              created: result.created, skipped: result.skipped, errors: hardErrors.length,
            })}
          </div>
          {hardErrors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tax-error)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {t('owner.customers.import.errors')}
              </div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13 }}>
                {hardErrors.map((e, i) => (
                  <li key={i}>
                    {t('owner.customers.import.row', { row: e.row })}: <code>{e.email || '—'}</code> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a65b00', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {t('owner.customers.import.warnings')}
              </div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13 }}>
                {warnings.map((e, i) => (
                  <li key={i}>
                    {t('owner.customers.import.row', { row: e.row })}: <code>{e.email}</code> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {skippedRows.length > 0 && (
            <details>
              <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--tax-muted)', textTransform: 'uppercase', letterSpacing: '.5px', cursor: 'pointer' }}>
                {t('owner.customers.import.skipped', { count: skippedRows.length })}
              </summary>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 12 }}>
                {skippedRows.map((e, i) => (
                  <li key={i}><code>{e.email}</code></li>
                ))}
              </ul>
            </details>
          )}
          {result.created > 0 && (
            <div>
              <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                      onClick={onDone}>
                {t('owner.customers.import.done')}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="tax-btn tax-btn--primary tax-btn--sm" disabled={busy || !csvText.trim()}>
          {busy ? t('lead.submitting') : t('owner.customers.import.upload')}
        </button>
      </div>
    </form>
  );
}
