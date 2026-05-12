import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

// Phase 4n.24: customer-facing sign page. Customer reads the title +
// description, types their legal name into the input, ticks the consent
// box, and submits. The server stamps the name + IP + timestamp and the
// consent text snapshot. Status flips to 'signed' and we redirect to a
// thank-you state.
export default function PortalSignatureRequest({ requestId }) {
  const { locale, t } = useT();
  const { fbUser, customer, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [state, setState] = useState({ kind: 'loading' });
  const [signerName, setSignerName] = useState('');
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function load() {
    setErr('');
    setState({ kind: 'loading' });
    taxApi.getPortalSignatureRequest(auth, requestId)
      .then(d => setState({ kind: 'ready', request: d.request }))
      .catch(e => setState({ kind: 'error', error: e?.message || '' }));
  }
  useEffect(() => {
    if (!fbUser || !community) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community, requestId]);

  // Pre-fill the typed name from the customer's profile so they can sign
  // in one click most of the time. They can still edit before signing.
  useEffect(() => {
    if (!customer || signerName) return;
    setSignerName(customer.name || '');
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e) {
    e.preventDefault();
    if (!signerName.trim() || !consented) return;
    setBusy(true); setErr('');
    try {
      await taxApi.signPortalSignatureRequest(auth, requestId, {
        signerName: signerName.trim(),
        consented: true,
      });
      load();
    } catch (e2) { setErr(e2?.message || t('respond.error.generic')); }
    finally { setBusy(false); }
  }

  async function onDecline() {
    if (!window.confirm(t('portal.signature.confirmDecline'))) return;
    setBusy(true); setErr('');
    try {
      await taxApi.declinePortalSignatureRequest(auth, requestId);
      load();
    } catch (e2) { setErr(e2?.message || t('respond.error.generic')); }
    finally { setBusy(false); }
  }

  const portalBase = community ? `/tax/${community.id}/portal` : '#';

  if (state.kind === 'loading') {
    return <PortalShell community={community}><p>{t('loading')}</p></PortalShell>;
  }
  if (state.kind === 'error') {
    return <PortalShell community={community}>
      <div className="tax-msg tax-msg--error">{state.error || t('error.loadFailed')}</div>
    </PortalShell>;
  }
  const r = state.request;
  const isPending = r.status === 'pending';
  const isSigned = r.status === 'signed';
  const isClosed = !isPending && !isSigned;
  const consentText = r.consent_text || t('portal.signature.defaultConsent');

  return (
    <PortalShell community={community} active="dashboard">
      <a href={portalBase} style={{ fontSize: 14, color: 'var(--tax-muted)' }}>
        ← {t('portal.filing.back')}
      </a>
      <h2 style={{ marginTop: 8 }}>{r.title}</h2>
      <p style={{ color: 'var(--tax-muted)', fontSize: 13 }}>
        {t('portal.signature.requestedBy', {
          name: r.requested_by_name || community?.name || '',
        })}
      </p>

      {r.description && (
        <div style={{
          margin: '16px 0', padding: 16, borderRadius: 10,
          background: 'var(--tax-bg-alt)', border: '1px solid var(--tax-border)',
          whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5,
        }}>{r.description}</div>
      )}

      {isSigned && (
        <div className="tax-msg tax-msg--success" style={{ marginTop: 16 }}>
          <strong>{t('portal.signature.signedTitle')}</strong>
          <div style={{ marginTop: 6 }}>
            {t('portal.signature.signedBody', {
              name: r.signer_name,
              date: new Date(r.signed_at).toLocaleString(locale === 'en' ? 'en-US' : 'es-ES'),
            })}
          </div>
        </div>
      )}

      {isClosed && !isSigned && (
        <div className="tax-msg tax-msg--error" style={{ marginTop: 16 }}>
          {t(`portal.signature.closed.${r.status}`)}
        </div>
      )}

      {isPending && (
        <form onSubmit={onSubmit} style={{ marginTop: 20, display: 'grid', gap: 14 }}>
          <div>
            <label htmlFor="sig-name" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
              {t('portal.signature.nameLabel')}
            </label>
            <input id="sig-name" type="text" value={signerName}
                   onChange={e => setSignerName(e.target.value)}
                   placeholder={t('portal.signature.namePlaceholder')}
                   style={{ width: '100%', padding: '10px 12px',
                            border: '1px solid var(--tax-border)', borderRadius: 8,
                            fontSize: 18, fontFamily: 'Georgia, "Times New Roman", serif',
                            fontStyle: 'italic' }} />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--tax-muted)' }}>
              {t('portal.signature.nameHint')}
            </p>
          </div>

          <label style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: 12, borderRadius: 8, background: 'var(--tax-bg-alt)',
            border: '1px solid var(--tax-border)', cursor: 'pointer',
          }}>
            <input type="checkbox" checked={consented}
                   onChange={e => setConsented(e.target.checked)}
                   style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{consentText}</span>
          </label>

          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="tax-btn tax-btn--primary"
                    disabled={busy || !signerName.trim() || !consented}>
              {busy ? t('lead.submitting') : t('portal.signature.signBtn')}
            </button>
            <button type="button" className="tax-btn tax-btn--ghost"
                    disabled={busy} onClick={onDecline}
                    style={{ color: '#b91c1c', borderColor: '#b91c1c' }}>
              {t('portal.signature.declineBtn')}
            </button>
          </div>
        </form>
      )}
    </PortalShell>
  );
}
