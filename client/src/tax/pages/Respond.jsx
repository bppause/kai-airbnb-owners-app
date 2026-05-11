import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { taxApi } from '../api';
import LocaleSwitcher from '../components/LocaleSwitcher';

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
    return (
      <Shell community={community} brandStyle={brandStyle}>
        <div className="tax-msg tax-msg--success">
          <strong>{t(alreadyReceived ? 'respond.alreadyReceived.heading' : 'respond.success.heading')}</strong>
          <div style={{ marginTop: 6 }}>{t(alreadyReceived ? 'respond.alreadyReceived.body' : 'respond.success.body')}</div>
        </div>
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
          {checklist.map(item => {
            const label = pickI18n(item.label_i18n, locale).value || item.key;
            const fieldId = `r-${item.key}`;
            const inputType = item.type === 'number' || item.type === 'currency' ? 'number' : (item.type === 'text' ? 'textarea' : 'text');
            return (
              <div key={item.key}>
                <label htmlFor={fieldId}>
                  {label}
                  {!item.required && (
                    <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                      {t('respond.optional')}
                    </span>
                  )}
                </label>
                {inputType === 'textarea' ? (
                  <textarea
                    id={fieldId}
                    rows={3}
                    value={values[item.key] || ''}
                    onChange={e => onChange(item.key, e.target.value)}
                  />
                ) : (
                  <input
                    id={fieldId}
                    type={inputType}
                    inputMode={inputType === 'number' ? 'decimal' : undefined}
                    step={item.type === 'currency' ? '0.01' : undefined}
                    value={values[item.key] || ''}
                    onChange={e => onChange(item.key, e.target.value)}
                  />
                )}
              </div>
            );
          })}

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

          <button
            type="submit"
            className="tax-btn tax-btn--primary tax-btn--block"
            disabled={submitState.kind === 'submitting'}
          >
            {submitState.kind === 'submitting' ? t('respond.submitting') : t('respond.submit')}
          </button>
        </form>
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
