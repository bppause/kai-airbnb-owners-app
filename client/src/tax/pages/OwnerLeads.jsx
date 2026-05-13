import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';
import { displayPersonName } from '../lib/personName';

const STATUS_VALUES = ['new', 'contacted', 'converted', 'closed'];

export default function OwnerLeads() {
  const { locale, t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [leads, setLeads] = useState(null);
  const [filter, setFilter] = useState('open'); // 'open' = new|contacted, 'all', or specific status
  const [products, setProducts] = useState([]);
  const [relTypes, setRelTypes] = useState([]);
  const [err, setErr] = useState('');

  const load = () => {
    if (!fbUser || !community) return;
    const opts = {};
    // 'open' is a virtual bucket — fetch all and filter client-side.
    if (STATUS_VALUES.includes(filter)) opts.status = filter;
    taxApi.adminListLeads(auth, community.id, opts)
      .then(d => setLeads(d.leads || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };
  useEffect(load, [fbUser, community, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Products + relationship types — needed by the convert dialog to
  // suggest relationships based on the lead's requested services.
  useEffect(() => {
    if (!fbUser || !community) return;
    Promise.all([
      taxApi.adminListProducts(auth, community.id).catch(() => ({ products: [] })),
      taxApi.adminListRelationshipTypes(auth, { communitySlug: community.id }).catch(() => ({ types: [] })),
    ]).then(([p, r]) => {
      setProducts(p.products || []);
      setRelTypes((r.types || []).filter(rt => rt.active !== false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  if (employee && employee.role !== 'admin') {
    return <EmployeeShell community={community}>
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }

  const shown = !leads ? null
    : (filter === 'open' ? leads.filter(l => l.status === 'new' || l.status === 'contacted') : leads);

  return (
    <EmployeeShell community={community} active="leads">
      <h2 style={{ marginTop: 0 }}>{t('owner.leads.title')}</h2>
      <p className="tax-section__lede">{t('owner.leads.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { id: 'open',      labelKey: 'owner.leads.filter.open' },
          { id: 'new',       labelKey: 'owner.leads.filter.new' },
          { id: 'contacted', labelKey: 'owner.leads.filter.contacted' },
          { id: 'converted', labelKey: 'owner.leads.filter.converted' },
          { id: 'closed',    labelKey: 'owner.leads.filter.closed' },
          { id: 'all',       labelKey: 'owner.leads.filter.all' },
        ].map(f => (
          <button key={f.id} type="button"
                  className={`tax-btn tax-btn--sm ${filter === f.id ? 'tax-btn--primary' : 'tax-btn--ghost'}`}
                  onClick={() => setFilter(f.id)}
                  style={filter !== f.id ? { color: 'var(--tax-text)', borderColor: 'var(--tax-border)' } : undefined}>
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {shown === null ? <p>{t('loading')}</p>
        : shown.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.leads.empty')}</p>
          : <div style={{ display: 'grid', gap: 8 }}>
              {shown.map(lead => (
                <LeadRow key={lead.id} lead={lead} auth={auth} onChange={load}
                         communitySlug={community.id}
                         products={products} relTypes={relTypes}
                         locale={locale} t={t} />
              ))}
            </div>}
    </EmployeeShell>
  );
}

function statusBadge(status) {
  if (status === 'new')        return { bg: '#dbeafe', fg: '#1e40af' };
  if (status === 'contacted')  return { bg: '#fef3c7', fg: '#92400e' };
  if (status === 'converted')  return { bg: '#dcfce7', fg: '#166534' };
  return { bg: '#f3f4f6', fg: '#4b5563' };
}

function LeadRow({ lead, auth, onChange, communitySlug, products, relTypes, locale, t }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const b = statusBadge(lead.status);

  const setStatus = async (next) => {
    setBusy(true); setErr('');
    try {
      await taxApi.adminUpdateLead(auth, lead.id, { status: next });
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };
  const saveNotes = async () => {
    setBusy(true); setErr('');
    try {
      await taxApi.adminUpdateLead(auth, lead.id, { notes });
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  // Open the convert dialog. The dialog pre-selects relationships
  // based on the lead's requested product_slugs (translated via the
  // products list → linked relationship_types) and lets the owner
  // confirm/adjust before submitting. The server then creates the
  // customer, attaches relationships, and kicks off task generation
  // in a single request.
  const onConvert = () => setConvertOpen(true);

  return (
    <div className="tax-contact-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {displayPersonName(lead) || lead.email}
            <span style={{
              marginLeft: 8, padding: '1px 8px', borderRadius: 999,
              background: b.bg, color: b.fg, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            }}>{lead.status}</span>
            {lead.preferred_locale && (
              <span style={{ marginLeft: 6, color: 'var(--tax-muted)', fontSize: 11 }}>
                {lead.preferred_locale === 'en' ? 'EN' : 'ES'}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 2 }}>
            <a href={`mailto:${lead.email}`}>{lead.email}</a>
            {lead.phone ? <> • {lead.phone}</> : null}
            {(() => {
              const services = Array.isArray(lead.product_slugs) && lead.product_slugs.length
                ? lead.product_slugs
                : (lead.product_slug ? [lead.product_slug] : []);
              return services.length ? <> • {services.join(', ')}</> : null;
            })()}
            <> • {new Date(lead.created_at).toLocaleDateString()}</>
          </div>
        </div>
        <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                onClick={() => setExpanded(x => !x)}
                style={{ color: 'var(--tax-text)' }}>
          {expanded ? t('owner.leads.collapse') : t('owner.leads.expand')}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--tax-bg-alt)', borderRadius: 8 }}>
          {lead.message && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)', marginBottom: 4 }}>
                {t('owner.leads.message')}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55 }}>{lead.message}</div>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor={`ln-${lead.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)', display: 'block', marginBottom: 4 }}>
              {t('owner.leads.notes')}
            </label>
            <textarea id={`ln-${lead.id}`} rows={3} value={notes}
                      onChange={e => setNotes(e.target.value)} maxLength={4000}
                      style={{
                        width: '100%', padding: 10, border: '1px solid var(--tax-border)',
                        borderRadius: 8, font: 'inherit', fontSize: 14,
                      }} />
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" disabled={busy}
                    onClick={saveNotes}
                    style={{ marginTop: 6, color: 'var(--tax-text)' }}>
              {t('owner.leads.saveNotes')}
            </button>
          </div>

          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {lead.status === 'new' && (
              <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                      onClick={() => setStatus('contacted')} disabled={busy}>
                {t('owner.leads.action.markContacted')}
              </button>
            )}
            {lead.status !== 'converted' && (
              <button type="button" onClick={onConvert} disabled={busy}
                      className="tax-btn tax-btn--ghost tax-btn--sm"
                      style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
                {t('owner.leads.action.convert')}
              </button>
            )}
            {lead.status === 'converted' && lead.converted_customer_id && (
              <a href={`/tax/${communitySlug}/employee/customers/${encodeURIComponent(lead.converted_customer_id)}`}
                 className="tax-btn tax-btn--ghost tax-btn--sm"
                 style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
                {t('owner.leads.action.viewCustomer')}
              </a>
            )}
            {lead.status !== 'converted' && (
              <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                      onClick={() => setStatus('converted')} disabled={busy}
                      style={{ color: 'var(--tax-text)' }}>
                {t('owner.leads.action.markConverted')}
              </button>
            )}
            {lead.status !== 'closed' && (
              <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                      onClick={() => setStatus('closed')} disabled={busy}
                      style={{ color: 'var(--tax-muted)' }}>
                {t('owner.leads.action.close')}
              </button>
            )}
            {lead.status !== 'new' && lead.status !== 'converted' && (
              <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                      onClick={() => setStatus('new')} disabled={busy}
                      style={{ color: 'var(--tax-muted)' }}>
                {t('owner.leads.action.reopen')}
              </button>
            )}
          </div>
        </div>
      )}
      {convertOpen && (
        <ConvertLeadModal lead={lead} auth={auth}
                          communitySlug={communitySlug}
                          products={products} relTypes={relTypes}
                          locale={locale} t={t}
                          onClose={() => setConvertOpen(false)}
                          onDone={(customerId) => {
                            window.location.href =
                              `/tax/${communitySlug}/employee/customers/${encodeURIComponent(customerId)}`;
                          }} />
      )}
    </div>
  );
}

// Lead → Customer conversion dialog. Pre-selects relationship tags
// derived from the lead's product_slugs (each slug → tax_products
// row → linked tax_relationship_types row). Owner confirms or
// adjusts, then the convert endpoint creates the customer, attaches
// the relationships, and kicks off task generation in one call.
function ConvertLeadModal({ lead, auth, communitySlug, products, relTypes, locale, t, onClose, onDone }) {
  // Phase 4n.48: direct service tagging on lead convert. Map the
  // lead's requested product_slugs to product_ids and pre-select
  // them in the picker. No relationship hop.
  const requestedSlugs = Array.isArray(lead.product_slugs) && lead.product_slugs.length
    ? lead.product_slugs : (lead.product_slug ? [lead.product_slug] : []);
  const initialProductIds = (products || [])
    .filter(p => requestedSlugs.includes(p.slug))
    .map(p => p.id);

  const [selected, setSelected] = useState(new Set(initialProductIds));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setBusy(true); setErr('');
    try {
      const r = await taxApi.adminConvertLead(auth, lead.id, {
        productIds: Array.from(selected),
      });
      onDone(r.customerId);
    } catch (e) {
      setErr(e?.message || t('respond.error.generic'));
    } finally { setBusy(false); }
  };

  return (
    <div className="tax-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tax-modal__panel" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <button type="button" className="tax-modal__close"
                onClick={onClose} aria-label={t('preview.close')}>×</button>
        <h3 className="tax-modal__title">
          {t('owner.leads.convert.title', { name: displayPersonName(lead) || lead.email })}
        </h3>

        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--tax-muted)' }}>
          {t('owner.leads.convert.identity')}: <strong>{lead.email}</strong>
          {lead.phone ? <> · {lead.phone}</> : null}
        </div>

        <form onSubmit={onSubmit} className="tax-form" style={{ boxShadow: 'none', padding: 0, border: 0 }}>
          <div>
            <label style={{ fontWeight: 600 }}>{t('owner.leads.convert.services')}</label>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--tax-muted)' }}>
              {t('owner.leads.convert.servicesHint')}
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {(products || []).length === 0 && (
                <p style={{ color: 'var(--tax-muted)' }}>
                  {t('owner.leads.convert.noServices')}
                </p>
              )}
              {(products || []).filter(p => p.enabled !== false).map(p => {
                const isChecked = selected.has(p.id);
                const wasRequested = initialProductIds.includes(p.id);
                return (
                  <label key={p.id} style={{
                    display: 'flex', gap: 10, padding: '8px 10px',
                    border: '1px solid var(--tax-border)', borderRadius: 6,
                    background: isChecked
                      ? 'color-mix(in srgb, var(--tax-brand-primary) 7%, #fff)'
                      : '#fff',
                    cursor: 'pointer',
                  }}>
                    <input type="checkbox" checked={isChecked} disabled={busy}
                           onChange={() => toggle(p.id)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>
                        {pickI18n(p.name_i18n, locale).value || p.slug}
                        {wasRequested && (
                          <span style={{
                            marginLeft: 8, padding: '1px 8px', borderRadius: 999,
                            background: 'color-mix(in srgb, var(--tax-brand-primary) 14%, #fff)',
                            color: 'var(--tax-brand-primary)',
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                          }}>{t('owner.leads.convert.requested')}</span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
              {busy ? t('lead.submitting') : t('owner.leads.convert.submit')}
            </button>
            <button type="button" className="tax-btn tax-btn--ghost"
                    onClick={onClose} disabled={busy} style={{ color: 'var(--tax-text)' }}>
              {t('preview.close')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
