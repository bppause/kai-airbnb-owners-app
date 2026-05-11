import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

export default function PortalFiling({ filingId }) {
  const { locale, t } = useT();
  const { fbUser, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [state, setState] = useState({ kind: 'loading', data: null });
  const [values, setValues] = useState({});
  const [notes, setNotes] = useState('');
  const [submitState, setSubmitState] = useState({ kind: 'idle', message: '' });

  useEffect(() => {
    if (!fbUser || !community) return;
    let cancelled = false;
    setState({ kind: 'loading', data: null });
    taxApi.getFiling(auth, filingId)
      .then(data => { if (!cancelled) setState({ kind: 'ready', data }); })
      .catch(err => {
        if (cancelled) return;
        setState({ kind: err?.status === 404 ? 'not-found' : 'error', data: null, error: err?.message || '' });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community, filingId]);

  const portalBase = community ? `/tax/${community.id}/portal` : '#';

  if (state.kind === 'loading') return <PortalShell community={community}><p>{t('loading')}</p></PortalShell>;
  if (state.kind === 'not-found') return <PortalShell community={community}><div className="tax-msg tax-msg--error">{t('portal.filing.notFound')}</div></PortalShell>;
  if (state.kind === 'error') return <PortalShell community={community}><div className="tax-msg tax-msg--error">{t('error.loadFailed')}</div></PortalShell>;

  const { period, schedule, checklist, alreadyReceived } = state.data;
  const filingName = pickI18n(schedule?.name_i18n, locale).value;

  const success = submitState.kind === 'success';
  if (alreadyReceived || success) {
    return (
      <PortalShell community={community} active="dashboard">
        <a href={portalBase} style={{ fontSize: 14, color: 'var(--tax-muted)' }}>← {t('portal.filing.back')}</a>
        <h2>{filingName}</h2>
        <p style={{ color: 'var(--tax-muted)' }}>{period.period_label} • {t('portal.dashboard.due')} {period.due_date}</p>
        <div className="tax-msg tax-msg--success">
          <strong>{t(success ? 'respond.success.heading' : 'respond.alreadyReceived.heading')}</strong>
          <div style={{ marginTop: 6 }}>{t(success ? 'respond.success.body' : 'respond.alreadyReceived.body')}</div>
        </div>
      </PortalShell>
    );
  }

  const onChange = (key, v) => setValues(p => ({ ...p, [key]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitState.kind === 'submitting') return;
    const missing = (checklist || []).filter(it => it.required).filter(it => {
      const v = values[it.key];
      return v === undefined || v === null || String(v).trim() === '';
    });
    if (missing.length) {
      setSubmitState({ kind: 'error', message: t('respond.error.missingFields') });
      return;
    }
    setSubmitState({ kind: 'submitting', message: '' });
    try {
      await taxApi.submitFiling(auth, filingId, { data: values, notes });
      setSubmitState({ kind: 'success', message: '' });
    } catch (err) {
      setSubmitState({ kind: 'error', message: err?.message || t('respond.error.generic') });
    }
  };

  return (
    <PortalShell community={community} active="dashboard">
      <a href={portalBase} style={{ fontSize: 14, color: 'var(--tax-muted)' }}>← {t('portal.filing.back')}</a>
      <h2 style={{ marginTop: 8 }}>{filingName}</h2>
      <p className="tax-section__lede">
        {t('respond.subtitle', { filingName, periodLabel: period.period_label, dueDate: period.due_date })}
      </p>

      <form className="tax-form" onSubmit={onSubmit} noValidate>
        {(checklist || []).map(item => {
          const label = pickI18n(item.label_i18n, locale).value || item.key;
          const fieldId = `pf-${item.key}`;
          const inputType = item.type === 'number' || item.type === 'currency' ? 'number' : (item.type === 'text' ? 'textarea' : 'text');
          return (
            <div key={item.key}>
              <label htmlFor={fieldId}>
                {label}
                {!item.required && <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>{t('respond.optional')}</span>}
              </label>
              {inputType === 'textarea' ? (
                <textarea id={fieldId} rows={3} value={values[item.key] || ''} onChange={e => onChange(item.key, e.target.value)} />
              ) : (
                <input id={fieldId} type={inputType}
                       inputMode={inputType === 'number' ? 'decimal' : undefined}
                       step={item.type === 'currency' ? '0.01' : undefined}
                       value={values[item.key] || ''} onChange={e => onChange(item.key, e.target.value)} />
              )}
            </div>
          );
        })}

        <div>
          <label htmlFor="pf-notes">{t('respond.notes')}</label>
          <textarea id="pf-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {submitState.kind === 'error' && <div className="tax-msg tax-msg--error" role="alert">{submitState.message}</div>}

        <button type="submit" className="tax-btn tax-btn--primary tax-btn--block"
                disabled={submitState.kind === 'submitting'}>
          {submitState.kind === 'submitting' ? t('respond.submitting') : t('respond.submit')}
        </button>
      </form>
    </PortalShell>
  );
}
