import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); } catch (_e) { return ''; }
}

export default function PortalDocuments() {
  const { t } = useT();
  const { fbUser, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };
  const fileRef = useRef(null);

  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ kind: 'idle', text: '' });

  const refresh = () => {
    if (!fbUser || !community) return;
    taxApi.getDocuments(auth)
      .then(d => setDocs(d.documents || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };
  useEffect(refresh, [fbUser, community]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUploadClick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      setUploadMsg({ kind: 'error', text: t('portal.documents.errUnsupported') });
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadMsg({ kind: 'error', text: t('portal.documents.errTooLarge') });
      return;
    }
    setUploading(true);
    setUploadMsg({ kind: 'idle', text: t('portal.documents.uploading', { name: file.name }) });
    try {
      const { id, signedUrl } = await taxApi.createDocumentUploadUrl(auth, {
        fileName: file.name, mimeType: file.type, sizeBytes: file.size,
      });
      // PUT directly to Supabase Storage signed URL — no file bytes through Node.
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'true' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      await taxApi.finalizeDocumentUpload(auth, id);
      setUploadMsg({ kind: 'success', text: t('portal.documents.uploadSuccess', { name: file.name }) });
      refresh();
    } catch (err) {
      setUploadMsg({ kind: 'error', text: err?.message || t('portal.documents.errGeneric') });
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (id) => {
    try {
      const { signedUrl } = await taxApi.getDocumentDownloadUrl(auth, id);
      window.location.href = signedUrl;
    } catch (err) {
      setUploadMsg({ kind: 'error', text: err?.message || t('portal.documents.errGeneric') });
    }
  };

  const onDelete = async (id, fileName) => {
    if (!window.confirm(t('portal.documents.confirmDelete', { name: fileName }))) return;
    try {
      await taxApi.deleteDocument(auth, id);
      refresh();
    } catch (err) {
      setUploadMsg({ kind: 'error', text: err?.message || t('portal.documents.errGeneric') });
    }
  };

  return (
    <PortalShell community={community} active="documents">
      <h2 style={{ marginTop: 0 }}>{t('portal.documents.title')}</h2>
      <p className="tax-section__lede">{t('portal.documents.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {community?.tax_customer_documents_enabled ? (
        <div style={{
          background: '#f4f7fb', borderRadius: 12, padding: 20, marginBottom: 24,
          border: '1px dashed color-mix(in srgb, var(--tax-brand-primary) 40%, #fff)',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 12px', color: 'var(--tax-muted)' }}>
            {t('portal.documents.uploadHint')}
          </p>
          <button type="button" className="tax-btn tax-btn--primary"
                  onClick={onUploadClick} disabled={uploading}>
            {uploading ? t('portal.documents.uploading_short') : t('portal.documents.uploadBtn')}
          </button>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onFile}
                 accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt" />
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--tax-muted)' }}>
            {t('portal.documents.limits')}
          </p>
        </div>
      ) : (
        <div className="tax-msg" style={{
          background: 'var(--tax-bg-alt)', color: 'var(--tax-muted)',
          padding: '12px 14px', marginBottom: 24, fontSize: 14,
        }}>
          {t('portal.documents.uploadsDisabled')}
        </div>
      )}

      {uploadMsg.text && (
        <div className={`tax-msg tax-msg--${uploadMsg.kind === 'error' ? 'error' : 'success'}`}
             style={{ marginBottom: 16 }}>
          {uploadMsg.text}
        </div>
      )}

      {docs === null ? <p>{t('loading')}</p>
        : docs.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>{t('portal.documents.empty')}</p>
          : <div style={{ display: 'grid', gap: 8 }}>
              {docs.map(d => (
                <div key={d.id} className="tax-contact-item"
                     style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.file_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 2 }}>
                      {d.source === 'practice' ? t('portal.documents.fromPractice') : t('portal.documents.fromYou')}
                      {' • '}{formatBytes(d.size_bytes)}{' • '}{formatDate(d.uploaded_at || d.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                            onClick={() => onDownload(d.id)} style={{ color: 'var(--tax-text)' }}>
                      {t('portal.documents.download')}
                    </button>
                    {d.source === 'customer' && (
                      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                              onClick={() => onDelete(d.id, d.file_name)}
                              style={{ color: 'var(--tax-error)', borderColor: 'var(--tax-error)' }}>
                        {t('portal.documents.delete')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
      }
    </PortalShell>
  );
}
