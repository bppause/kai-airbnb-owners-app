import { useEffect, useRef, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';
import OwnerSubscriptionsSection from '../components/OwnerSubscriptionsSection';

const CATEGORY_KEY = {
  business: 'portal.profile.category.business',
  individual: 'portal.profile.category.individual',
  general: 'portal.profile.category.general',
  audit: 'portal.profile.category.audit',
};

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
    taxApi.adminListRelationshipTypes(auth)
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
      <h2 style={{ marginTop: 8, marginBottom: 4 }}>{c.name || c.email}</h2>
      <p style={{ color: 'var(--tax-muted)', marginTop: 0, fontSize: 13 }}>
        {c.email}{c.phone ? ` • ${c.phone}` : ''}{c.whatsapp ? ` • WhatsApp ${c.whatsapp}` : ''}
        {' • '}{c.locale === 'en' ? 'English' : 'Español'}
      </p>

      <ProfileSection customer={c} t={t} />

      <RelationshipsSection
        data={data} types={types} auth={auth} customerId={customerId}
        onChange={load} locale={locale} t={t} />

      <DocumentsSection
        data={data} auth={auth} customerId={customerId} onChange={load} t={t} />

      <ThreadsSection data={data} threadsBase={threadsBase} t={t} />

      <OwnerSubscriptionsSection
        customer={data.customer}
        subscriptions={data.subscriptions}
        auth={auth}
        onChange={load}
        locale={locale}
        t={t} />

      <AssignmentsSection data={data} t={t} />
    </EmployeeShell>
  );
}

function ProfileSection({ customer: c, t }) {
  const a = c.address || {};
  return (
    <section style={{ marginTop: 24 }}>
      <h3>{t('owner.customer.section.profile')}</h3>
      <div className="tax-contact-grid">
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={typeId} onChange={e => setTypeId(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--tax-border)', borderRadius: 8, minWidth: 240 }}>
              <option value="">{t('owner.customer.relationship.choose')}</option>
              {available.map(tp => (
                <option key={tp.id} value={tp.id}>
                  {pickI18n(tp.name_i18n, locale).value} ({tp.category})
                </option>
              ))}
            </select>
            <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                    onClick={onAdd} disabled={!typeId || busy}>
              {busy ? t('lead.submitting') : t('owner.customer.relationship.confirm')}
            </button>
          </div>
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
