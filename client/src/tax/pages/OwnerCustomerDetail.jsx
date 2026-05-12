import { useEffect, useRef, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi, setImpersonation } from '../api';
import EmployeeShell from '../components/EmployeeShell';
import OwnerSubscriptionsSection from '../components/OwnerSubscriptionsSection';

// Phase 4n.17: humanize a last-sign-in timestamp for the page header.
// Never-signed-in returns a clear "hasn't signed in" string so the admin
// knows the account is still in invitation state.
function formatLastSignIn(iso, locale, t) {
  if (!iso) return t('owner.lastSignIn.never');
  try {
    const formatted = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      .format(new Date(iso));
    return t('owner.lastSignIn.recent', { date: formatted });
  } catch (_e) {
    return t('owner.lastSignIn.recent', { date: iso });
  }
}

const CATEGORY_KEY = {
  business: 'portal.profile.category.business',
  individual: 'portal.profile.category.individual',
  general: 'portal.profile.category.general',
  audit: 'portal.profile.category.audit',
};

// Match the order used by the customer-list filter (OwnerCustomers).
const CATEGORY_ORDER = ['business', 'individual', 'general', 'audit'];

function groupRelationshipsByCategory(types) {
  const buckets = new Map();
  for (const t of types) {
    const c = t.category || 'other';
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c).push(t);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }
  const known = CATEGORY_ORDER.filter(c => buckets.has(c));
  const extras = Array.from(buckets.keys())
    .filter(c => !CATEGORY_ORDER.includes(c)).sort();
  return [...known, ...extras].map(c => ({ category: c, types: buckets.get(c) }));
}

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
]);

function fmtBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); } catch (_e) { return ''; }
}

// Phase 4a owner detail page. Composes one /admin/customers/:id round trip
// for all the read-only data, then per-action mutations via the matching
// /admin/* endpoints. Each section is independently re-fetched on action so
// we don't reload unrelated chunks.
export default function OwnerCustomerDetail({ customerId }) {
  const { locale, t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [data, setData] = useState(null);
  const [types, setTypes] = useState([]);
  const [err, setErr] = useState('');

  const load = () => {
    if (!fbUser || !community) return;
    taxApi.adminGetCustomer(auth, customerId)
      .then(d => setData(d))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };
  useEffect(() => {
    load();
    taxApi.adminListRelationshipTypes(auth, { communitySlug: community.id })
      .then(d => setTypes(d.types || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community, customerId]);

  if (employee && employee.role !== 'admin') {
    return <EmployeeShell community={community}>
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }
  if (err) return <EmployeeShell community={community} active="customers"><div className="tax-msg tax-msg--error">{err}</div></EmployeeShell>;
  if (!data) return <EmployeeShell community={community} active="customers"><p>{t('loading')}</p></EmployeeShell>;

  const c = data.customer;
  const back = community ? `/tax/${community.id}/employee/customers` : '#';
  const threadsBase = community ? `/tax/${community.id}/employee/threads` : '#';

  return (
    <EmployeeShell community={community} active="customers">
      <a href={back} style={{ fontSize: 14, color: 'var(--tax-muted)' }}>← {t('owner.customer.back')}</a>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, marginBottom: 4 }}>{c.name || c.email}</h2>
          <p style={{ color: 'var(--tax-muted)', marginTop: 0, fontSize: 13 }}>
            {c.email}{c.phone ? ` • ${c.phone}` : ''}{c.whatsapp ? ` • WhatsApp ${c.whatsapp}` : ''}
            {' • '}{c.locale === 'en' ? 'English' : 'Español'}
            {' • '}{formatLastSignIn(c.last_sign_in_at, locale, t)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          <ImpersonateCustomerButton customer={c} auth={auth} community={community} t={t} />
          <SendWelcomeButton customer={c} auth={auth} t={t} />
          <PromoteToStaffButton customer={c} auth={auth} onChanged={load} t={t} />
          <ArchiveCustomerButton customer={c} auth={auth} onChanged={load} t={t} />
        </div>
      </div>

      {c.status === 'archived' && (
        <div className="tax-msg" style={{
          background: 'color-mix(in srgb, #b91c1c 8%, #fff)',
          borderLeft: '3px solid #b91c1c', color: '#7f1d1d',
          padding: '10px 14px', marginTop: 8,
        }}>
          <strong>{t('owner.customer.archivedBanner.title')}</strong>
          <div style={{ marginTop: 4, fontSize: 13 }}>
            {t('owner.customer.archivedBanner.body')}
          </div>
        </div>
      )}

      <ProfileSection customer={c} auth={auth} customerId={customerId} onChange={load} t={t} />

      <RelationshipsSection
        data={data} types={types} auth={auth} customerId={customerId}
        onChange={load} locale={locale} t={t} />

      <DocumentsSection
        data={data} auth={auth} customerId={customerId} onChange={load} t={t} />

      <ThreadsSection data={data} threadsBase={threadsBase} t={t} />

      <FilingsSection data={data} auth={auth} onChange={load} locale={locale} t={t} />

      <OwnerSubscriptionsSection
        customer={data.customer}
        subscriptions={data.subscriptions}
        auth={auth}
        onChange={load}
        locale={locale}
        t={t} />

      <ReminderActivitySection data={data} locale={locale} t={t} />

      <WorkflowOverridesSection
        auth={auth} customerId={customerId} locale={locale} t={t} />

      <AssignmentsSection data={data} t={t} />
    </EmployeeShell>
  );
}

// Phase 4n.8: per-customer workflow override editor. Lists every workflow
// active for this customer (resolved through their relationships) and
// shows whether an override row exists. Click "Customize" → modal with a
// checklist editor and optional reminder offsets; Save upserts the row.
// Reset deletes the row, falling back to the workflow rule's defaults.
function WorkflowOverridesSection({ auth, customerId, locale, t }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);     // { rule, override }
  const [err, setErr] = useState('');
  function load() {
    setErr('');
    taxApi.adminListCustomerWorkflowOverrides(auth, customerId)
      .then(d => setItems(d.workflows || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  }
  useEffect(load, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="tax-section" style={{ paddingTop: 0 }}>
      <h3>{t('owner.customer.section.workflowOverrides')}</h3>
      <p style={{ color: 'var(--tax-muted)', fontSize: 13, margin: '0 0 12px' }}>
        {t('owner.customer.workflowOverrides.note')}
      </p>
      {err && <div className="tax-msg tax-msg--error">{err}</div>}
      {items === null && <p>{t('loading')}</p>}
      {items !== null && items.length === 0 && (
        <p style={{ color: 'var(--tax-muted)' }}>
          {t('owner.customer.workflowOverrides.empty')}
        </p>
      )}
      {items !== null && items.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(w => {
            const name = pickI18n(w.rule.name_i18n, locale).value || w.rule.filing_schedule_slug;
            const hasOverride = !!w.override;
            const effectiveOffsets = hasOverride && Array.isArray(w.override.reminder_offsets_days) && w.override.reminder_offsets_days.length
              ? w.override.reminder_offsets_days
              : (Array.isArray(w.rule.reminder_offsets_days) ? w.rule.reminder_offsets_days : []);
            const effectiveDocs = hasOverride && Array.isArray(w.override.custom_info_checklist) && w.override.custom_info_checklist.length
              ? w.override.custom_info_checklist
              : (Array.isArray(w.rule.info_checklist) ? w.rule.info_checklist : []);
            return (
              <div key={w.rule.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
                padding: '10px 12px', border: '1px solid var(--tax-border)', borderRadius: 8,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--tax-muted)' }}>
                    <code>{w.rule.filing_schedule_slug}</code> · {w.rule.cadence || '—'} ·{' '}
                    {t('owner.customer.workflowOverrides.offsets', { offsets: effectiveOffsets.join(', ') || '—' })} ·{' '}
                    {t('owner.customer.workflowOverrides.docCount', { count: effectiveDocs.length })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {hasOverride && (
                    <span style={{
                      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      background: 'var(--tax-brand-primary)', color: '#fff',
                    }}>{t('owner.customer.workflowOverrides.badge')}</span>
                  )}
                  <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                          onClick={() => setEditing(w)}>
                    {hasOverride
                      ? t('owner.customer.workflowOverrides.editBtn')
                      : t('owner.customer.workflowOverrides.customizeBtn')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <WorkflowOverrideModal
          auth={auth} customerId={customerId} t={t} locale={locale}
          workflow={editing}
          onClose={() => setEditing(null)}
          onChange={() => { setEditing(null); load(); }}
        />
      )}
    </section>
  );
}

function WorkflowOverrideModal({ auth, customerId, workflow, locale, t, onClose, onChange }) {
  const rule = workflow.rule;
  const override = workflow.override;
  const startingOffsets = (override?.reminder_offsets_days && override.reminder_offsets_days.length)
    ? override.reminder_offsets_days
    : (rule.reminder_offsets_days || []);
  const startingDocs = (override?.custom_info_checklist && override.custom_info_checklist.length)
    ? override.custom_info_checklist
    : (rule.info_checklist || []);
  const [offsetsInput, setOffsetsInput] = useState(startingOffsets.join(', '));
  const [docs, setDocs] = useState(startingDocs.map(d => ({ ...d, label_i18n: { ...(d.label_i18n || {}) } })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ruleName = pickI18n(rule.name_i18n, locale).value || rule.filing_schedule_slug;

  function addDoc() {
    setDocs(prev => [...prev, { key: '', label_i18n: { en: '', es: '' }, type: 'text', required: true }]);
  }
  function updateDoc(idx, patch) {
    setDocs(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }
  function removeDoc(idx) { setDocs(prev => prev.filter((_, i) => i !== idx)); }

  async function save() {
    setBusy(true); setErr('');
    const offsets = String(offsetsInput || '').split(/[\s,;]+/).map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n) && n >= 0 && n <= 365);
    try {
      await taxApi.adminUpsertCustomerWorkflowOverride(auth, customerId, rule.id, {
        reminderOffsetsDays: offsets,
        customInfoChecklist: docs,
      });
      onChange();
    } catch (e) { setErr(e?.message || t('respond.error.generic')); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!override) { onClose(); return; }
    if (!window.confirm(t('owner.customer.workflowOverrides.resetConfirm'))) return;
    setBusy(true); setErr('');
    try {
      await taxApi.adminDeleteCustomerWorkflowOverride(auth, customerId, rule.id);
      onChange();
    } catch (e) { setErr(e?.message || t('respond.error.generic')); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 16, overflow: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--tax-bg)', borderRadius: 12, maxWidth: 720, width: '100%',
        margin: '40px 0', border: '1px solid var(--tax-border)',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--tax-border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{t('owner.customer.workflowOverrides.modalTitle', { name: ruleName })}</strong>
          <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={onClose}>
            {t('preview.close')}
          </button>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
              {t('owner.workflows.offsetsLabel')}
            </label>
            <input type="text" value={offsetsInput}
                   placeholder={t('owner.customer.workflowOverrides.offsetsPlaceholder')}
                   onChange={e => setOffsetsInput(e.target.value)}
                   style={{ width: 240 }} />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tax-muted)' }}>
              {t('owner.customer.workflowOverrides.offsetsHint', {
                offsets: (rule.reminder_offsets_days || []).join(', ') || '14, 7, 3' })}
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t('owner.workflows.docsLabel')}</span>
              <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={addDoc}>
                + {t('owner.workflows.addDoc')}
              </button>
            </div>
            {docs.length === 0 && (
              <p style={{ color: 'var(--tax-muted)', fontSize: 13 }}>{t('owner.workflows.docsEmpty')}</p>
            )}
            {docs.map((d, i) => (
              <div key={i} style={{
                display: 'grid', gap: 8, padding: 8, marginTop: 8,
                gridTemplateColumns: '1fr 1fr 1fr 110px 60px 32px',
                alignItems: 'center', border: '1px dashed var(--tax-border)', borderRadius: 6,
              }}>
                <input type="text" value={d.key} placeholder={t('owner.workflows.docKey')}
                       onChange={e => updateDoc(i, { key: e.target.value })} />
                <input type="text" value={d.label_i18n?.en || ''} placeholder={t('owner.workflows.docLabelEn')}
                       onChange={e => updateDoc(i, { label_i18n: { ...(d.label_i18n || {}), en: e.target.value } })} />
                <input type="text" value={d.label_i18n?.es || ''} placeholder={t('owner.workflows.docLabelEs')}
                       onChange={e => updateDoc(i, { label_i18n: { ...(d.label_i18n || {}), es: e.target.value } })} />
                <select value={d.type || 'text'} onChange={e => updateDoc(i, { type: e.target.value })}>
                  <option value="currency">currency</option>
                  <option value="number">number</option>
                  <option value="text">text</option>
                  <option value="date">date</option>
                  <option value="file">file</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={d.required !== false}
                         onChange={e => updateDoc(i, { required: e.target.checked })} />
                  {t('owner.workflows.docRequired')}
                </label>
                <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                        onClick={() => removeDoc(i)} aria-label={t('owner.workflows.removeDoc')}>×</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
            <div>
              {override && (
                <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                        disabled={busy} onClick={reset}>
                  {t('owner.customer.workflowOverrides.removeBtn')}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={onClose}>
                {t('preview.close')}
              </button>
              <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                      disabled={busy} onClick={save}>
                {busy ? t('lead.submitting') : t('owner.customer.workflowOverrides.saveBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Phase 4n: per-customer reminder send + open/click timeline. Engagement
// summary at the top + a colored pill per row makes "did this customer
// actually read it" answerable at a glance. Apple Mail Privacy caveat is
// shown inline so the team doesn't over-trust open counts.
function ReminderActivitySection({ data, locale, t }) {
  const logs = Array.isArray(data?.emailLogs) ? data.emailLogs : [];
  function fmt(iso, withTime = true) {
    if (!iso) return '—';
    try {
      const opts = withTime
        ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric' };
      return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', opts)
        .format(new Date(iso));
    } catch (_e) { return iso; }
  }

  const sent = logs.length;
  const opened = logs.filter(l => l.opened_at).length;
  const clicked = logs.filter(l => l.clicked_at).length;
  const pct = (n) => sent ? Math.round((n / sent) * 100) : 0;

  const Pill = ({ kind, label }) => {
    const colors = {
      ok:   { bg: '#dcfce7', fg: '#166534', border: '#bbf7d0' },  // green
      warn: { bg: '#fef9c3', fg: '#854d0e', border: '#fde68a' },  // amber
      muted:{ bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0' },  // gray
    }[kind] || { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0' };
    return (
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 999,
        background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`,
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      }}>{label}</span>
    );
  };

  return (
    <section className="tax-section" style={{ paddingTop: 0 }}>
      <h3>{t('owner.customer.section.reminderActivity')}</h3>

      {sent > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, margin: '0 0 12px',
        }}>
          <SummaryStat label={t('owner.customer.reminderActivity.sent')} value={sent} t={t} />
          <SummaryStat label={t('owner.customer.reminderActivity.opened')}
                       value={`${opened} (${pct(opened)}%)`}
                       accent={opened > 0 ? 'ok' : 'muted'} t={t} />
          <SummaryStat label={t('owner.customer.reminderActivity.clicked')}
                       value={`${clicked} (${pct(clicked)}%)`}
                       accent={clicked > 0 ? 'ok' : 'warn'} t={t} />
        </div>
      )}

      <p style={{ color: 'var(--tax-muted)', fontSize: 13, margin: '0 0 12px' }}>
        {t('owner.customer.reminderActivity.note')}
      </p>

      {logs.length === 0 ? (
        <p style={{ color: 'var(--tax-muted)' }}>{t('owner.customer.reminderActivity.empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--tax-border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--tax-bg-alt)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>{t('owner.customer.reminderActivity.sent')}</th>
                <th style={{ padding: '8px 10px' }}>{t('owner.customer.reminderActivity.subject')}</th>
                <th style={{ padding: '8px 10px' }}>{t('owner.customer.reminderActivity.engagement')}</th>
                <th style={{ padding: '8px 10px' }}>{t('owner.customer.reminderActivity.timeline')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => {
                const openedPill = l.opened_at
                  ? <Pill kind="ok" label={`${t('owner.customer.reminderActivity.openedShort')}${l.open_count > 1 ? ` ×${l.open_count}` : ''}`} />
                  : <Pill kind="muted" label={t('owner.customer.reminderActivity.notOpened')} />;
                const clickedPill = l.clicked_at
                  ? <Pill kind="ok" label={`${t('owner.customer.reminderActivity.clickedShort')}${l.click_count > 1 ? ` ×${l.click_count}` : ''}`} />
                  : <Pill kind="muted" label={t('owner.customer.reminderActivity.notClicked')} />;
                const deliveredPill = l.delivered_at
                  ? <Pill kind="muted" label={t('owner.customer.reminderActivity.deliveredShort')} />
                  : <Pill kind="warn" label={t('owner.customer.reminderActivity.pendingShort')} />;
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--tax-border)' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmt(l.created_at, false)}</td>
                    <td style={{ padding: '8px 10px' }}>{l.subject || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {deliveredPill}{openedPill}{clickedPill}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--tax-muted)' }}>
                      {l.opened_at && <div>{t('owner.customer.reminderActivity.opened')}: {fmt(l.opened_at)}</div>}
                      {l.clicked_at && <div>{t('owner.customer.reminderActivity.clicked')}: {fmt(l.clicked_at)}</div>}
                      {!l.opened_at && !l.clicked_at && '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SummaryStat({ label, value, accent }) {
  const ring = {
    ok:    'var(--tax-success)',
    warn:  '#d97706',
    muted: 'var(--tax-border)',
  }[accent] || 'var(--tax-border)';
  return (
    <div style={{
      padding: 12, borderRadius: 8, background: 'var(--tax-bg-alt)',
      border: `1px solid ${ring}`,
    }}>
      <div style={{ fontSize: 12, color: 'var(--tax-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// Phase 4d: profile is now editable from the admin side. The login email
// stays read-only — it's the Firebase identity. Customer self-serves the
// same fields via /portal/profile; this endpoint is for owner-side fixes
// (typos, fill-in before customer sign-in, etc.).
function ProfileSection({ customer: c, auth, customerId, onChange, t }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: c.name || '',
    phone: c.phone || '',
    whatsapp: c.whatsapp || '',
    preferredEmail: c.preferred_communication_email || '',
    locale: c.locale || 'es',
    status: c.status || 'active',
    addr: {
      line1: c.address?.line1 || '', line2: c.address?.line2 || '',
      city: c.address?.city || '', state: c.address?.state || '',
      postal_code: c.address?.postal_code || '',
      country: c.address?.country || 'US',
    },
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const a = c.address || {};

  if (!editing) {
    return (
      <section style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{t('owner.customer.section.profile')}</h3>
          <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                  onClick={() => setEditing(true)} style={{ color: 'var(--tax-text)' }}>
            {t('owner.customer.profile.edit')}
          </button>
        </div>
        <div className="tax-contact-grid">
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('portal.profile.phone')}</div>
            <div className="tax-contact-item__value">{c.phone || '—'}</div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('portal.profile.whatsapp')}</div>
            <div className="tax-contact-item__value">{c.whatsapp || '—'}</div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('portal.profile.preferredEmail')}</div>
            <div className="tax-contact-item__value">{c.preferred_communication_email || '—'}</div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('portal.profile.address')}</div>
            <div className="tax-contact-item__value" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {a.line1 || '—'}
              {a.line2 && <><br />{a.line2}</>}
              {(a.city || a.state || a.postal_code) && <><br />{[a.city, a.state, a.postal_code].filter(Boolean).join(', ')}</>}
              {a.country && <><br />{a.country}</>}
            </div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('owner.customer.status')}</div>
            <div className="tax-contact-item__value">{c.status}</div>
          </div>
          <div className="tax-contact-item">
            <div className="tax-contact-item__label">{t('owner.customer.signedIn')}</div>
            <div className="tax-contact-item__value">{c.firebase_uid ? t('owner.customer.yes') : t('owner.customer.no')}</div>
          </div>
        </div>
        <p style={{ color: 'var(--tax-muted)', fontSize: 13, marginTop: 8 }}>
          {t('owner.customer.profileEditHint')}
        </p>
      </section>
    );
  }

  const onSave = async (e) => {
    e?.preventDefault?.();
    setBusy(true); setErr('');
    const address = {};
    for (const k of ['line1', 'line2', 'city', 'state', 'postal_code', 'country']) {
      const v = String(form.addr[k] || '').trim();
      if (v) address[k] = v;
    }
    try {
      await taxApi.adminUpdateCustomer(auth, customerId, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        preferredCommunicationEmail: form.preferredEmail.trim(),
        locale: form.locale,
        status: form.status,
        address,
      });
      setEditing(false);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h3>{t('owner.customer.section.profile')}</h3>
      <form className="tax-form" onSubmit={onSave} noValidate style={{ maxWidth: 720 }}>
        <div className="tax-form__row2">
          <div>
            <label htmlFor="ocp-name">{t('portal.profile.name')}</label>
            <input id="ocp-name" type="text" value={form.name}
                   onChange={e => setForm(p => ({ ...p, name: e.target.value }))} maxLength={200} />
          </div>
          <div>
            <label htmlFor="ocp-status">{t('owner.customer.status')}</label>
            <select id="ocp-status" value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              <option value="active">{t('owner.customer.profile.status.active')}</option>
              <option value="paused">{t('owner.customer.profile.status.paused')}</option>
              <option value="archived">{t('owner.customer.profile.status.archived')}</option>
            </select>
          </div>
        </div>
        <div className="tax-form__row2">
          <div>
            <label htmlFor="ocp-phone">{t('portal.profile.phone')}</label>
            <input id="ocp-phone" type="tel" value={form.phone}
                   onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} maxLength={40} />
          </div>
          <div>
            <label htmlFor="ocp-whatsapp">
              {t('portal.profile.whatsapp')}
              <span style={{ color: 'var(--tax-muted)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
                {t('portal.profile.whatsapp.format')}
              </span>
            </label>
            <input id="ocp-whatsapp" type="tel" value={form.whatsapp}
                   placeholder="+14155551234"
                   onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} maxLength={20} />
          </div>
        </div>
        <div className="tax-form__row2">
          <div>
            <label htmlFor="ocp-pref-email">{t('portal.profile.preferredEmail')}</label>
            <input id="ocp-pref-email" type="email" value={form.preferredEmail}
                   placeholder={c.email}
                   onChange={e => setForm(p => ({ ...p, preferredEmail: e.target.value }))} maxLength={200} />
          </div>
          <div>
            <label htmlFor="ocp-locale">{t('owner.customers.fieldLocale')}</label>
            <select id="ocp-locale" value={form.locale}
                    onChange={e => setForm(p => ({ ...p, locale: e.target.value }))}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <fieldset style={{ border: '1px solid var(--tax-border)', borderRadius: 8, padding: 16, margin: 0 }}>
          <legend style={{ padding: '0 8px', fontWeight: 600, fontSize: 14 }}>{t('portal.profile.address')}</legend>
          <div style={{ display: 'grid', gap: 12 }}>
            <input type="text" placeholder={t('portal.profile.address.line1')} value={form.addr.line1}
                   onChange={e => setForm(p => ({ ...p, addr: { ...p.addr, line1: e.target.value } }))} maxLength={200} />
            <input type="text" placeholder={t('portal.profile.address.line2')} value={form.addr.line2}
                   onChange={e => setForm(p => ({ ...p, addr: { ...p.addr, line2: e.target.value } }))} maxLength={200} />
            <div className="tax-form__row2">
              <input type="text" placeholder={t('portal.profile.address.city')} value={form.addr.city}
                     onChange={e => setForm(p => ({ ...p, addr: { ...p.addr, city: e.target.value } }))} maxLength={120} />
              <input type="text" placeholder={t('portal.profile.address.state')} value={form.addr.state}
                     onChange={e => setForm(p => ({ ...p, addr: { ...p.addr, state: e.target.value } }))} maxLength={80} />
            </div>
            <div className="tax-form__row2">
              <input type="text" placeholder={t('portal.profile.address.postal')} value={form.addr.postal_code}
                     onChange={e => setForm(p => ({ ...p, addr: { ...p.addr, postal_code: e.target.value } }))} maxLength={20} />
              <input type="text" placeholder={t('portal.profile.address.country')} value={form.addr.country}
                     onChange={e => setForm(p => ({ ...p, addr: { ...p.addr, country: e.target.value } }))} maxLength={4} />
            </div>
          </div>
        </fieldset>
        {err && <div className="tax-msg tax-msg--error">{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
            {busy ? t('lead.submitting') : t('owner.customer.profile.save')}
          </button>
          <button type="button" className="tax-btn tax-btn--ghost"
                  onClick={() => setEditing(false)}
                  style={{ color: 'var(--tax-text)' }}>
            {t('owner.customer.profile.cancel')}
          </button>
        </div>
      </form>
    </section>
  );
}

function RelationshipsSection({ data, types, auth, customerId, onChange, locale, t }) {
  const rels = data.relationships || [];
  const [picking, setPicking] = useState(false);
  const [typeId, setTypeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Hide already-attached types from the picker.
  const attached = new Set(rels.map(r => r.relationship_type_id));
  const available = types.filter(tp => !attached.has(tp.id));

  const onAdd = async () => {
    if (!typeId) return;
    setBusy(true); setErr('');
    try {
      await taxApi.adminAddCustomerRelationship(auth, customerId, { relationshipTypeId: typeId });
      setTypeId(''); setPicking(false);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };
  const onAddType = async (id) => {
    if (!id || busy) return;
    setBusy(true); setErr('');
    try {
      await taxApi.adminAddCustomerRelationship(auth, customerId, { relationshipTypeId: id });
      setPicking(false);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };
  const onRemove = async (rel) => {
    if (!window.confirm(t('owner.customer.relationship.confirmRemove', { name: pickI18n(rel.type?.name_i18n, locale).value || '' }))) return;
    try {
      await taxApi.adminRemoveCustomerRelationship(auth, customerId, rel.id);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
  };

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{t('owner.customer.section.relationships')}</h3>
        {available.length > 0 && (
          <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                  onClick={() => setPicking(p => !p)}>
            {picking ? t('owner.customer.relationship.cancel') : t('owner.customer.relationship.addBtn')}
          </button>
        )}
      </div>

      {picking && (
        <div className="tax-contact-item" style={{ marginBottom: 12 }}>
          {available.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--tax-muted)' }}>{t('owner.customer.relationship.allAttached')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {groupRelationshipsByCategory(available).map(({ category, types }) => (
                <div key={category}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--tax-muted)',
                    textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4,
                  }}>
                    {t(`owner.customers.category.${category}`, { _: category })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {types.map(tp => (
                      <button key={tp.id} type="button"
                              onClick={() => onAddType(tp.id)}
                              disabled={busy}
                              style={{
                                padding: '4px 10px', borderRadius: 999,
                                background: '#fff', color: 'var(--tax-text)',
                                border: '1px solid var(--tax-border)',
                                fontSize: 12, fontWeight: 500, cursor: busy ? 'wait' : 'pointer',
                              }}>
                        + {pickI18n(tp.name_i18n, locale).value || tp.slug}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {rels.length === 0 ? (
        <p style={{ color: 'var(--tax-muted)' }}>{t('owner.customer.relationship.empty')}</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {rels.map(r => (
            <span key={r.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 6px 6px 12px', borderRadius: 999,
              background: 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)',
              color: 'var(--tax-brand-primary)',
              border: '1px solid color-mix(in srgb, var(--tax-brand-primary) 20%, #fff)',
              fontSize: 13, fontWeight: 600,
            }}>
              {pickI18n(r.type?.name_i18n, locale).value}
              <span style={{ fontSize: 11, color: 'var(--tax-muted)', fontWeight: 400 }}>
                ({t(CATEGORY_KEY[r.type?.category] || 'portal.profile.category.business')})
              </span>
              <button type="button" onClick={() => onRemove(r)} aria-label={t('owner.customer.relationship.removeAria')}
                      style={{
                        border: 'none', background: 'transparent', color: 'var(--tax-error)',
                        cursor: 'pointer', fontSize: 16, padding: '0 8px 0 2px',
                      }}>×</button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function DocumentsSection({ data, auth, customerId, onChange, t }) {
  const docs = data.documents || [];
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  const onUploadClick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      setMsg({ kind: 'error', text: t('portal.documents.errUnsupported') }); return;
    }
    if (file.size > MAX_BYTES) {
      setMsg({ kind: 'error', text: t('portal.documents.errTooLarge') }); return;
    }
    setUploading(true);
    setMsg({ kind: 'idle', text: t('portal.documents.uploading', { name: file.name }) });
    try {
      const { id, signedUrl } = await taxApi.adminCustomerDocumentUploadUrl(auth, customerId, {
        fileName: file.name, mimeType: file.type, sizeBytes: file.size,
      });
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'true' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      await taxApi.adminFinalizeDocument(auth, id);
      setMsg({ kind: 'success', text: t('owner.customer.document.uploadSuccess', { name: file.name }) });
      onChange();
    } catch (err) {
      setMsg({ kind: 'error', text: err?.message || t('portal.documents.errGeneric') });
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (id) => {
    try {
      const { signedUrl } = await taxApi.adminGetDocumentDownloadUrl(auth, id);
      window.location.href = signedUrl;
    } catch (e) { setMsg({ kind: 'error', text: e?.message || '' }); }
  };
  const onDelete = async (doc) => {
    if (!window.confirm(t('owner.customer.document.confirmDelete', { name: doc.file_name }))) return;
    try {
      await taxApi.adminDeleteDocument(auth, doc.id);
      onChange();
    } catch (e) { setMsg({ kind: 'error', text: e?.message || '' }); }
  };

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{t('owner.customer.section.documents')}</h3>
        <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                onClick={onUploadClick} disabled={uploading}>
          {uploading ? t('portal.documents.uploading_short') : t('owner.customer.document.uploadBtn')}
        </button>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onFile}
               accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt" />
      </div>
      <p style={{ color: 'var(--tax-muted)', fontSize: 13, margin: '0 0 12px' }}>
        {t('owner.customer.document.hint')}
      </p>

      {msg.text && (
        <div className={`tax-msg tax-msg--${msg.kind === 'error' ? 'error' : 'success'}`}
             style={{ marginBottom: 12 }}>{msg.text}</div>
      )}

      {docs.length === 0
        ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.customer.document.empty')}</p>
        : <div style={{ display: 'grid', gap: 8 }}>
            {docs.map(d => (
              <div key={d.id} className="tax-contact-item"
                   style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.file_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 2 }}>
                    {d.source === 'practice' ? t('owner.customer.document.byPractice', { who: d.uploaded_by_email || 'practice' })
                                             : t('owner.customer.document.byCustomer')}
                    {' • '}{fmtBytes(d.size_bytes)}{' • '}{fmtDate(d.uploaded_at || d.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                          onClick={() => onDownload(d.id)} style={{ color: 'var(--tax-text)' }}>
                    {t('portal.documents.download')}
                  </button>
                  <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                          onClick={() => onDelete(d)}
                          style={{ color: 'var(--tax-error)', borderColor: 'var(--tax-error)' }}>
                    {t('portal.documents.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
      }
    </section>
  );
}

function ThreadsSection({ data, threadsBase, t }) {
  const threads = data.threads || [];
  return (
    <section style={{ marginTop: 32 }}>
      <h3>{t('owner.customer.section.threads')}</h3>
      {threads.length === 0
        ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.customer.thread.empty')}</p>
        : <div style={{ display: 'grid', gap: 8 }}>
            {threads.map(th => (
              <a key={th.id} href={`${threadsBase}/${encodeURIComponent(th.id)}`}
                 className="tax-contact-item"
                 style={{
                   textDecoration: 'none', color: 'inherit',
                   borderLeft: th.practice_unread ? '3px solid var(--tax-brand-secondary)' : '3px solid transparent',
                 }}>
                <div style={{ fontWeight: th.practice_unread ? 700 : 600 }}>
                  {th.subject || t('portal.messages.untitled')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 4,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {th.last_message_preview || ''}
                </div>
              </a>
            ))}
          </div>
      }
    </section>
  );
}

// Phase 4d: per-period status override. Most filings auto-advance via the
// reminder cron (pending → info_requested when a reminder fires, →
// info_received when the customer submits via /respond or portal). Owner
// uses this to mark a period as 'skipped' (business was closed that
// month) or to manually flag as 'filed' after submitting through agency
// portal outside the platform.
function FilingsSection({ data, auth, onChange, locale, t }) {
  const periods = data.periods || [];
  const STATUS = ['pending', 'info_requested', 'info_received', 'in_prep', 'filed', 'skipped'];

  return (
    <section style={{ marginTop: 32 }}>
      <h3>{t('owner.customer.section.filings')}</h3>
      {periods.length === 0
        ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.customer.filings.empty')}</p>
        : <div style={{ display: 'grid', gap: 8 }}>
            {periods.map(p => (
              <FilingRow key={p.id} period={p} statuses={STATUS}
                         auth={auth} onChange={onChange} locale={locale} t={t} />
            ))}
          </div>}
      <p style={{ color: 'var(--tax-muted)', fontSize: 13, marginTop: 8 }}>
        {t('owner.customer.filings.hint')}
      </p>
    </section>
  );
}

function FilingRow({ period: p, statuses, auth, onChange, locale, t }) {
  const [status, setStatus] = useState(p.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Reset to server value when the parent reloads (e.g., after save).
  useEffect(() => { setStatus(p.status); }, [p.status]);

  const dirty = status !== p.status;
  const onSave = async () => {
    setBusy(true); setErr('');
    try {
      await taxApi.adminUpdatePeriod(auth, p.id, { status });
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  const filingName = pickI18n(p.workflow?.name_i18n || p.schedule?.name_i18n, locale).value
    || p.workflow?.filing_schedule_slug || p.schedule?.slug || '—';

  return (
    <div className="tax-contact-item" style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      opacity: (p.status === 'filed' || p.status === 'skipped') ? 0.75 : 1,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{filingName}</div>
        <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 2 }}>
          {p.period_label} • {t('portal.dashboard.due')} {p.due_date}
          {p.schedule?.jurisdiction ? ` • ${p.schedule.jurisdiction}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <select value={status} onChange={e => setStatus(e.target.value)}
                disabled={busy}
                style={{ padding: '6px 8px', border: '1px solid var(--tax-border)', borderRadius: 6, fontSize: 13 }}>
          {statuses.map(s => (
            <option key={s} value={s}>{t(`owner.customer.filings.status.${s}`)}</option>
          ))}
        </select>
        {dirty && (
          <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                  onClick={onSave} disabled={busy}>
            {busy ? t('lead.submitting') : t('owner.customer.filings.save')}
          </button>
        )}
        {err && <span style={{ color: 'var(--tax-error)', fontSize: 12 }}>{err}</span>}
      </div>
    </div>
  );
}

function AssignmentsSection({ data, t }) {
  const assignments = data.assignments || [];
  return (
    <section style={{ marginTop: 32, marginBottom: 32 }}>
      <h3>{t('owner.customer.section.assignments')}</h3>
      {assignments.length === 0
        ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.customer.assignment.empty')}</p>
        : <ul style={{ paddingLeft: 20, margin: 0 }}>
            {assignments.map(a => (
              <li key={a.id} style={{ marginBottom: 4 }}>
                {a.employee?.name || a.employee?.email}
                {a.employee?.role && (
                  <span style={{ color: 'var(--tax-muted)', fontSize: 12, marginLeft: 6 }}>({a.employee.role})</span>
                )}
                {a.is_primary && (
                  <span style={{
                    marginLeft: 8, padding: '1px 7px', borderRadius: 999,
                    background: 'var(--tax-brand-primary)', color: '#fff',
                    fontSize: 11, fontWeight: 700,
                  }}>{t('employee.profile.assignments.primary')}</span>
                )}
              </li>
            ))}
          </ul>
      }
      <p style={{ color: 'var(--tax-muted)', fontSize: 13, marginTop: 8 }}>
        {t('owner.customer.assignment.hint')}
      </p>
    </section>
  );
}

// "Impersonate" button — admin previews the customer portal as this user.
// Stores impersonation state in sessionStorage (tab-scoped) and navigates
// the same tab to /portal, where the customer-side AuthProvider detects
// the state and skips Firebase. The admin's real Firebase session stays
// intact and resumes when impersonation exits.
function ImpersonateCustomerButton({ customer, auth, community, t }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onClick = async () => {
    if (!window.confirm(t('impersonation.confirm.customer', { name: customer.name || customer.email }))) return;
    setBusy(true); setErr('');
    try {
      const r = await taxApi.adminStartImpersonation(auth, {
        communitySlug: community.id,
        targetType: 'customer',
        targetId: customer.id,
      });
      setImpersonation({
        token: r.token,
        targetType: 'customer',
        targetId: customer.id,
        targetEmail: customer.email,
        targetName: customer.name || customer.email,
        communitySlug: community.id,
        realAdminEmail: auth.adminEmail || auth.email,
        realAdminUid: auth.uid,
        expiresAt: r.expiresAt,
      });
      window.location.href = `/tax/${community.id}/portal`;
    } catch (e) {
      setErr(e?.message || '');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
              onClick={onClick} disabled={busy}
              style={{ color: '#b91c1c', borderColor: '#b91c1c', flexShrink: 0 }}>
        {busy ? t('impersonation.starting') : t('impersonation.viewAsCustomer')}
      </button>
      {err && <span style={{ color: 'var(--tax-error)', fontSize: 11 }}>{err}</span>}
    </div>
  );
}

// "Send welcome email" — manual resend of the bilingual portal-invite.
// Uses the customer's current locale + current relationships (so adding
// more services after the initial send + clicking this again will surface
// the new services in the email body).
function SendWelcomeButton({ customer: c, auth, t }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  const onClick = async () => {
    if (!window.confirm(t('owner.customer.welcome.confirm', {
      name: c.name || c.email, lang: c.locale === 'en' ? 'English' : 'Español',
    }))) return;
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      const result = await taxApi.adminSendWelcomeEmail(auth, c.id);
      if (result?.ok || result?.sent) {
        setMsg({ kind: 'success', text: t('owner.customer.welcome.sent') });
      } else if (result?.skipped) {
        setMsg({ kind: 'error', text: t('owner.customer.welcome.skipped', {
          reason: result.reason || 'unknown',
        }) });
      } else {
        setMsg({ kind: 'error', text: result?.error || t('respond.error.generic') });
      }
    } catch (e) {
      setMsg({ kind: 'error', text: e?.message || t('respond.error.generic') });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg({ kind: 'idle', text: '' }), 6000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
              onClick={onClick} disabled={busy}
              style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
        {busy ? t('owner.customer.welcome.sending') : t('owner.customer.welcome.button')}
      </button>
      {msg.text && (
        <span style={{
          fontSize: 11,
          color: msg.kind === 'success' ? 'var(--tax-success)' : 'var(--tax-error)',
        }}>{msg.text}</span>
      )}
    </div>
  );
}

// Phase 4n.15: promote an existing customer to staff/admin. Creates a
// tax_employees row keyed by the same email so the existing dual-role
// switch (staffAccess banner on the customer portal) lights up
// automatically. Sends the welcome email by default.
function PromoteToStaffButton({ customer: c, auth, onChanged, t }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });

  const onClick = async () => {
    const role = window.prompt(t('owner.customer.promote.rolePrompt'), 'staff');
    if (!role) return;
    const r = role.trim().toLowerCase();
    if (r !== 'staff' && r !== 'admin') {
      setMsg({ kind: 'error', text: t('owner.customer.promote.invalidRole') });
      return;
    }
    if (!window.confirm(t('owner.customer.promote.confirm', { name: c.name || c.email, role: r }))) return;
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      const result = await taxApi.adminPromoteCustomerToStaff(auth, c.id, { role: r });
      setMsg({ kind: 'success', text: t('owner.customer.promote.success', { role: r }) });
      onChanged && onChanged();
      return result;
    } catch (e) {
      if (e?.body?.error === 'already_employee') {
        setMsg({ kind: 'error', text: t('owner.customer.promote.alreadyEmployee') });
      } else {
        setMsg({ kind: 'error', text: e?.message || t('respond.error.generic') });
      }
    } finally {
      setBusy(false);
      setTimeout(() => setMsg({ kind: 'idle', text: '' }), 8000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
              onClick={onClick} disabled={busy}
              style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
        {busy ? t('lead.submitting') : t('owner.customer.promote.button')}
      </button>
      {msg.text && (
        <span style={{
          fontSize: 11,
          color: msg.kind === 'success' ? 'var(--tax-success)' : 'var(--tax-error)',
        }}>{msg.text}</span>
      )}
    </div>
  );
}

// Phase 4n.15: archive (status='archived') a customer. Records retained;
// relationships are deactivated so the cron stops generating periods.
// When already archived, swaps to a "Restore" affordance.
function ArchiveCustomerButton({ customer: c, auth, onChanged, t }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });
  const isArchived = c.status === 'archived';

  const onClick = async () => {
    if (!isArchived) {
      if (!window.confirm(t('owner.customer.archive.confirm', { name: c.name || c.email }))) return;
    }
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      await taxApi.adminSetCustomerStatus(auth, c.id, {
        status: isArchived ? 'active' : 'archived',
      });
      setMsg({ kind: 'success',
        text: isArchived ? t('owner.customer.archive.restored') : t('owner.customer.archive.done') });
      onChanged && onChanged();
    } catch (e) {
      setMsg({ kind: 'error', text: e?.message || t('respond.error.generic') });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg({ kind: 'idle', text: '' }), 6000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
              onClick={onClick} disabled={busy}
              style={{ color: '#b91c1c', borderColor: '#b91c1c' }}>
        {busy
          ? t('lead.submitting')
          : (isArchived ? t('owner.customer.archive.restoreBtn') : t('owner.customer.archive.button'))}
      </button>
      {msg.text && (
        <span style={{
          fontSize: 11,
          color: msg.kind === 'success' ? 'var(--tax-success)' : 'var(--tax-error)',
        }}>{msg.text}</span>
      )}
    </div>
  );
}
