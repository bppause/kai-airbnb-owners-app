import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { taxApi } from '../api';
import LocaleSwitcher from '../components/LocaleSwitcher';
import ChecklistField from '../components/ChecklistField';

// Customer-facing magic-link response page. No login required — the URL
// token IS the bearer credential. Renders the filing's info checklist and
// captures structured field values.
export default function Respond({ token }) {
  const { locale, t } = useT();
  const [state, setState] = useState({ kind: 'loading', data: null });
  const [values, setValues] = useState({});
  const [notes, setNotes] = useState('');
  const [submitState, setSubmitState] = useState({ kind: 'idle', message: '' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading', data: null });
    taxApi.getResponse(token)
      .then(data => { if (!cancelled) setState({ kind: 'ready', data }); })
      .catch(err => {
        if (cancelled) return;
        if (err?.status === 410) setState({ kind: 'used', data: null });
        else if (err?.status === 404) setState({ kind: 'invalid', data: null });
        else setState({ kind: 'error', data: null });
      });
    return () => { cancelled = true; };
  }, [token]);

  // Apply branding from the embedded community record.
  const community = state.data?.community;
  const brandStyle = community ? {
    '--tax-brand-primary': community.brand_primary_color || undefined,
    '--tax-brand-secondary': community.brand_secondary_color || undefined,
  } : {};

  if (state.kind === 'loading') {
    return <Shell><p>{t('loading')}</p></Shell>;
  }
  if (state.kind === 'invalid') {
    return <Shell><div className="tax-msg tax-msg--error">{t('respond.error.invalidLink')}</div></Shell>;
  }
  if (state.kind === 'used') {
    return <Shell><div className="tax-msg tax-msg--error">{t('respond.error.usedLink')}</div></Shell>;
  }
  if (state.kind === 'error') {
    return <Shell><div className="tax-msg tax-msg--error">{t('error.loadFailed')}</div></Shell>;
  }

  const { customer, period, schedule, checklist, alreadyReceived } = state.data;
  const filingName = pickI18n(schedule.name_i18n, locale).value;

  if (alreadyReceived || submitState.kind === 'success') {
    // Continuity: instead of dead-ending on a success card, surface CTAs
    // back into the portal. Deep link to this filing so the customer can
    // see status updates (status flips info_received → in_prep → filed
    // as the practice works through it). Generic "open my portal" link
    // covers them seeing all their other filings, messages, documents.
    const portalUrl = community ? `/tax/${community.id}/portal` : '#';
    const filingDeepLink = (community && period?.id)
      ? `/tax/${community.id}/portal/filings/${encodeURIComponent(period.id)}`
      : portalUrl;
    return (
      <Shell community={community} brandStyle={brandStyle}>
        <section className="tax-section" style={{ paddingTop: 32 }}>
          <div className="tax-msg tax-msg--success">
            <strong>{t(alreadyReceived ? 'respond.alreadyReceived.heading' : 'respond.success.heading')}</strong>
            <div style={{ marginTop: 6 }}>{t(alreadyReceived ? 'respond.alreadyReceived.body' : 'respond.success.body')}</div>
          </div>

          {community && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ margin: '0 0 6px' }}>{t('respond.continue.title')}</h3>
              <p style={{ margin: '0 0 16px', color: 'var(--tax-muted)', fontSize: 14 }}>
                {t('respond.continue.subtitle', { email: customer?.email || '' })}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a href={filingDeepLink} className="tax-btn tax-btn--primary">
                  {t('respond.continue.viewStatus')}
                </a>
                <a href={portalUrl} className="tax-btn tax-btn--ghost"
                   style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
                  {t('respond.continue.openPortal')}
                </a>
              </div>
              <ul style={{ marginTop: 16, paddingLeft: 18, color: 'var(--tax-muted)', fontSize: 13 }}>
                <li>{t('respond.continue.bulletStatus')}</li>
                <li>{t('respond.continue.bulletMessages')}</li>
                <li>{t('respond.continue.bulletDocuments')}</li>
              </ul>
            </div>
          )}
        </section>
      </Shell>
    );
  }

  const onChange = (key, v) => setValues(prev => ({ ...prev, [key]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitState.kind === 'submitting') return;
    // Client-side required-fields check (server re-verifies).
    const missing = checklist.filter(it => it.required).filter(it => {
      const v = values[it.key];
      return v === undefined || v === null || String(v).trim() === '';
    });
    if (missing.length) {
      setSubmitState({ kind: 'error', message: t('respond.error.missingFields') });
      return;
    }
    setSubmitState({ kind: 'submitting', message: '' });
    try {
      await taxApi.submitResponse(token, { data: values, notes });
      setSubmitState({ kind: 'success', message: '' });
    } catch (err) {
      setSubmitState({ kind: 'error', message: err?.message || t('respond.error.generic') });
    }
  };

  return (
    <Shell community={community} brandStyle={brandStyle}>
      <section className="tax-section" style={{ paddingTop: 32 }}>
        <h2>{t('respond.title')}</h2>
        <p className="tax-section__lede">
          {t('respond.subtitle', { filingName, periodLabel: period.period_label, dueDate: period.due_date })}
        </p>

        <form className="tax-form" onSubmit={onSubmit} noValidate>
          {checklist.map(item => (
            <ChecklistField key={item.key} item={item} fieldIdPrefix="r"
                            value={values[item.key]}
                            onChange={(v) => onChange(item.key, v)}
                            auth={null} supportsFileUpload={false} />
          ))}

          <div>
            <label htmlFor="r-notes">{t('respond.notes')}</label>
            <textarea
              id="r-notes" rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {submitState.kind === 'error' && (
            <div className="tax-msg tax-msg--error" role="alert">{submitState.message}</div>
          )}

          <div className="tax-sticky-cta">
            <button
              type="submit"
              className="tax-btn tax-btn--primary tax-btn--block"
              disabled={submitState.kind === 'submitting'}
            >
              {submitState.kind === 'submitting' ? t('respond.submitting') : t('respond.submit')}
            </button>
          </div>
        </form>

        {/* Quiet footer link for customers who'd rather submit from inside
            the portal (where they can attach documents, see other filings,
            and message the practice). Magic-link form is still the path
            of least resistance for one-off customers without an account. */}
        {community && (
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--tax-muted)' }}>
            {t('respond.havePortal')}{' '}
            <a href={`/tax/${community.id}/portal`}
               style={{ color: 'var(--tax-brand-primary)', fontWeight: 600 }}>
              {t('respond.openPortalLink')}
            </a>
          </p>
        )}
      </section>
    </Shell>
  );
}

// Minimal shell shared by all render states. Includes header (logo + locale
// switcher) but skips the marketing nav links that exist on the landing.
function Shell({ children, community, brandStyle }) {
  const initials = (community?.name || 'TAX')
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
  return (
    <div className="tax-app" style={brandStyle || {}}>
      <header className="tax-header">
        <div className="tax-container tax-header__row">
          <div className="tax-brand">
            {community?.logo_url
              ? <img src={community.logo_url} alt={community?.name || 'Tax Services'} className="tax-brand__logo" />
              : <>
                  <span className="tax-brand__mark">{initials}</span>
                  <span className="tax-brand__name">{community?.name || 'Tax Services'}</span>
                </>}
          </div>
          <div className="tax-nav" aria-label="Language">
            <LocaleSwitcher />
          </div>
        </div>
      </header>
      <div className="tax-container" style={{ paddingTop: 8 }}>
        {children}
      </div>
    </div>
  );
}
