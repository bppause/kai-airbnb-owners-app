import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { taxApi } from '../api';

// Phase 4n: renders the actual email (subject + HTML + plaintext) the
// customer would receive. Used by the Email templates page and the
// Workflows page. Server does the rendering so unsaved edits hit the
// same applyOverride() path the real send uses.
//
// Props:
//   open           — boolean
//   onClose        — () => void
//   auth           — { uid, email, communitySlug }
//   communitySlug  — string
//   templateKey    — 'reminder' (others render only the override)
//   lang           — 'en' | 'es'
//   override       — { subject, body_text, body_html } to preview unsaved
//                    edits (pass null to preview whatever's persisted)
//   extraDocs      — optional [{ key, label_i18n, type, required }]
//   offsetDays     — optional number (which offset to label in the subject)
export default function EmailPreviewModal({
  open, onClose, auth, communitySlug, templateKey, lang,
  override = null, extraDocs = null, offsetDays = 14,
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('html');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true); setErr(''); setData(null);
    taxApi.adminPreviewEmailTemplate(auth, {
      communitySlug, key: templateKey, lang,
      useUnsaved: !!override,
      ...(override || {}),
      extraDocs, offsetDays,
    })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e?.message || 'Preview failed'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, communitySlug, templateKey, lang, override, extraDocs, offsetDays]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--tax-bg)', borderRadius: 12, maxWidth: 840, width: '100%',
        maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--tax-shadow-md)',
        border: '1px solid var(--tax-border)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--tax-border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{t('preview.title')}</strong>
          <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={onClose}>
            {t('preview.close')}
          </button>
        </div>

        {busy && <p style={{ padding: 20 }}>{t('loading')}</p>}
        {err && <p className="tax-msg tax-msg--error" style={{ margin: 16 }}>{err}</p>}

        {data && (
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--tax-muted)' }}>
              {t('preview.note')}
              {data.partial && (
                <span style={{ display: 'block', marginTop: 4 }}>
                  {t('preview.partialNote')}
                </span>
              )}
            </div>

            <div style={{ marginBottom: 16, padding: 10, background: 'var(--tax-bg-alt)',
                          borderRadius: 6, border: '1px solid var(--tax-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--tax-muted)' }}>{t('preview.subject')}</div>
              <div style={{ fontWeight: 600 }}>{data.subject || <em>{t('preview.empty')}</em>}</div>
            </div>

            <div style={{ display: 'inline-flex', gap: 8, marginBottom: 12 }}>
              <button type="button"
                      className={`tax-btn tax-btn--sm ${tab === 'html' ? 'tax-btn--primary' : 'tax-btn--ghost'}`}
                      onClick={() => setTab('html')}>{t('preview.tabHtml')}</button>
              <button type="button"
                      className={`tax-btn tax-btn--sm ${tab === 'text' ? 'tax-btn--primary' : 'tax-btn--ghost'}`}
                      onClick={() => setTab('text')}>{t('preview.tabText')}</button>
            </div>

            {tab === 'html' && (
              <iframe
                title="email-preview-html"
                srcDoc={data.html || ''}
                style={{
                  width: '100%', minHeight: 480, border: '1px solid var(--tax-border)',
                  borderRadius: 6, background: '#fff',
                }}
              />
            )}
            {tab === 'text' && (
              <pre style={{
                whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13,
                background: 'var(--tax-bg-alt)', padding: 12, borderRadius: 6,
                border: '1px solid var(--tax-border)', minHeight: 200,
              }}>{data.text || ''}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
