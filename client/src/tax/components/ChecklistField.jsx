import { useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { taxApi } from '../api';

// Phase 4n.5: single source of truth for rendering one checklist item from a
// schedule's info_checklist. Used by both PortalFiling (signed-in portal)
// and Respond (magic-link). Supported `type` values:
//   currency → number input, $0.01 step, decimal keyboard
//   number   → number input
//   text     → multi-line textarea
//   date     → native date picker
//   file     → 3-step upload (createUploadUrl → PUT → finalize). Value
//              stored as { document_id, file_name }. Requires signed-in
//              customer (auth present); falls back to "sign in to upload"
//              copy on the magic-link Respond flow.
//   (anything else) → text input, for backwards compat with older
//                     `amount` / `note` rows still sitting in the DB.
export default function ChecklistField({ item, value, onChange, fieldIdPrefix = 'cf', auth, supportsFileUpload = true }) {
  const { locale, t } = useT();
  const label = pickI18n(item.label_i18n, locale).value || item.key;
  const fieldId = `${fieldIdPrefix}-${item.key}`;
  const type = item.type || 'text';

  return (
    <div>
      <label htmlFor={fieldId}>
        {label}
        {!item.required && (
          <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
            {t('respond.optional')}
          </span>
        )}
      </label>
      <FieldInput
        type={type} fieldId={fieldId} item={item}
        value={value} onChange={onChange}
        auth={auth} supportsFileUpload={supportsFileUpload}
      />
    </div>
  );
}

function FieldInput({ type, fieldId, item, value, onChange, auth, supportsFileUpload }) {
  if (type === 'text') {
    return (
      <textarea id={fieldId} rows={3} value={value || ''}
                onChange={e => onChange(e.target.value)} />
    );
  }
  if (type === 'date') {
    return (
      <input id={fieldId} type="date" value={value || ''}
             onChange={e => onChange(e.target.value)} />
    );
  }
  if (type === 'file') {
    return supportsFileUpload && auth
      ? <FileField fieldId={fieldId} value={value} onChange={onChange} auth={auth} />
      : <FileFieldSignInHint />;
  }
  if (type === 'number' || type === 'currency') {
    return (
      <input id={fieldId} type="number"
             inputMode="decimal"
             step={type === 'currency' ? '0.01' : undefined}
             value={value || ''}
             onChange={e => onChange(e.target.value)} />
    );
  }
  // Unknown types (legacy `amount`, `note`, anything else) → plain text input.
  return (
    <input id={fieldId} type="text" value={value || ''}
           onChange={e => onChange(e.target.value)} />
  );
}

function FileField({ fieldId, value, onChange, auth }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const stored = value && typeof value === 'object' ? value : null;

  async function uploadFile(file) {
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const { id, signedUrl } = await taxApi.createDocumentUploadUrl(auth, {
        fileName: file.name, mimeType: file.type, sizeBytes: file.size,
      });
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'true' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      await taxApi.finalizeDocumentUpload(auth, id);
      onChange({ document_id: id, file_name: file.name });
    } catch (e) {
      setErr(e?.message || 'Upload failed');
    } finally { setBusy(false); }
  }

  return (
    <div>
      {stored ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          background: 'var(--tax-bg-alt)', border: '1px solid var(--tax-border)',
          borderRadius: 6,
        }}>
          <span style={{ flex: 1, fontSize: 14 }}>📎 {stored.file_name}</span>
          <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                  onClick={() => onChange(null)}>
            {t('respond.fileField.replace')}
          </button>
        </div>
      ) : (
        <input id={fieldId} type="file"
               disabled={busy}
               onChange={e => uploadFile(e.target.files?.[0])} />
      )}
      {busy && <p style={{ fontSize: 12, color: 'var(--tax-muted)', margin: '4px 0 0' }}>{t('respond.fileField.uploading')}</p>}
      {err && <p style={{ fontSize: 12, color: 'var(--tax-error)', margin: '4px 0 0' }}>{err}</p>}
    </div>
  );
}

function FileFieldSignInHint() {
  const { t } = useT();
  return (
    <p style={{ fontSize: 13, color: 'var(--tax-muted)', margin: 0,
                padding: '8px 10px', background: 'var(--tax-bg-alt)',
                border: '1px dashed var(--tax-border)', borderRadius: 6 }}>
      {t('respond.fileField.signInToUpload')}
    </p>
  );
}
