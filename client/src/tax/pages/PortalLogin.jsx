import { useState } from 'react';
import { useT } from '../i18n';
import LocaleSwitcher from '../components/LocaleSwitcher';
import {
  firebaseReady,
  signInWithGoogle,
  signInWithEmail,
  createEmailAccount,
  sendPasswordReset,
  firebaseErrorMessage,
} from '../auth/firebase';

// Standalone login page (no AuthProvider context dependency — the provider
// only mounts after the user is signed in).
export default function PortalLogin({ community }) {
  const { locale, t } = useT();
  const [mode, setMode] = useState('signin');   // signin | create | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const initials = (community?.name || 'TAX')
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
  const brandStyle = community ? {
    '--tax-brand-primary': community.brand_primary_color || undefined,
    '--tax-brand-secondary': community.brand_secondary_color || undefined,
  } : {};

  const onGoogle = async () => {
    setBusy(true); setErr(''); setInfo('');
    try { await signInWithGoogle(); }
    catch (e) { setErr(firebaseErrorMessage(e, locale)); }
    finally { setBusy(false); }
  };

  const onEmailSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setInfo('');
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else if (mode === 'create') {
        await createEmailAccount(email.trim(), password);
      } else if (mode === 'reset') {
        await sendPasswordReset(email.trim());
        setInfo(t('portal.login.resetSent'));
        setMode('signin');
      }
    } catch (e) {
      setErr(firebaseErrorMessage(e, locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tax-app" style={brandStyle}>
      <header className="tax-header">
        <div className="tax-container tax-header__row">
          <div className="tax-brand">
            {community?.logo_url
              ? <img src={community.logo_url} alt={community?.name || ''} className="tax-brand__logo" />
              : <span className="tax-brand__mark">{initials}</span>}
          </div>
          <div className="tax-nav"><LocaleSwitcher /></div>
        </div>
      </header>

      <section className="tax-section" style={{ maxWidth: 460, margin: '0 auto' }}>
        <h2 style={{ marginTop: 24 }}>{t('portal.login.title')}</h2>
        <p className="tax-section__lede">{t('portal.login.subtitle')}</p>

        {!firebaseReady && (
          <div className="tax-msg tax-msg--error" role="alert">{t('portal.login.notConfigured')}</div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          <button
            type="button"
            className="tax-btn tax-btn--primary tax-btn--block"
            onClick={onGoogle}
            disabled={busy || !firebaseReady}
          >{t('portal.login.google')}</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0', color: 'var(--tax-muted)' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--tax-border)' }} />
            <span style={{ fontSize: 13 }}>{t('portal.login.or')}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--tax-border)' }} />
          </div>

          <form className="tax-form" onSubmit={onEmailSubmit} noValidate>
            <div>
              <label htmlFor="p-email">{t('portal.login.email')}</label>
              <input id="p-email" type="email" autoComplete="email"
                     value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {mode !== 'reset' && (
              <div>
                <label htmlFor="p-pass">{t('portal.login.password')}</label>
                <input id="p-pass" type="password"
                       autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                       value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            {err && <div className="tax-msg tax-msg--error" role="alert">{err}</div>}
            {info && <div className="tax-msg tax-msg--success" role="status">{info}</div>}
            <button type="submit" className="tax-btn tax-btn--primary tax-btn--block"
                    disabled={busy || !firebaseReady}>
              {busy ? t('portal.login.working')
                : (mode === 'signin' ? t('portal.login.signinBtn')
                   : mode === 'create' ? t('portal.login.createBtn')
                   : t('portal.login.resetBtn'))}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            {mode === 'signin' && (
              <>
                <a href="#" onClick={e => { e.preventDefault(); setMode('create'); setErr(''); setInfo(''); }}>
                  {t('portal.login.firstTime')}
                </a>
                <a href="#" onClick={e => { e.preventDefault(); setMode('reset'); setErr(''); setInfo(''); }}>
                  {t('portal.login.forgot')}
                </a>
              </>
            )}
            {(mode === 'create' || mode === 'reset') && (
              <a href="#" onClick={e => { e.preventDefault(); setMode('signin'); setErr(''); setInfo(''); }}>
                {t('portal.login.backToSignin')}
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
