import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

const STATUS_VALUES = ['new', 'contacted', 'converted', 'closed'];

export default function OwnerLeads() {
  const { t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [leads, setLeads] = useState(null);
  const [filter, setFilter] = useState('open'); // 'open' = new|contacted, 'all', or specific status
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
                         communitySlug={community.id} t={t} />
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

function LeadRow({ lead, auth, onChange, communitySlug, t }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
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

  // "Convert to customer" deep-links into the customer-create form on
  // /tax/{slug}/employee/customers — using URL fragments to prefill the
  // form is over-engineering for v1, so we just navigate there and the
  // owner clicks Add manually with the lead info in mind.
  const convertHref = `/tax/${communitySlug}/employee/customers`;

  return (
    <div className="tax-contact-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {lead.name || lead.email}
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
            {lead.product_slug ? <> • {lead.product_slug}</> : null}
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
              <a href={convertHref} className="tax-btn tax-btn--ghost tax-btn--sm"
                 style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
                {t('owner.leads.action.convert')}
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
    </div>
  );
}
