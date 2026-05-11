import { useEffect, useMemo, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

// Phase 4j: for each (relationship_type, filing_schedule) the owner can
// configure custom reminder offsets (positive days before due-date) and
// extra required documents. These layer between the per-customer override
// (tax_subscriptions.reminder_offsets_days / custom_info_checklist) and the
// per-schedule system default ([14, 7, 3] days and schedule.info_checklist).
//
// Required-docs editor: each extra doc has { key, label_i18n: {en, es},
// type, required }. Schema is the same as schedule.info_checklist so the
// reminder rendering loop doesn't need to branch.

const DOC_TYPES = ['text', 'amount', 'date', 'file', 'note'];

export default function OwnerRelationshipWorkflows() {
  const { locale, t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [types, setTypes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [rules, setRules] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeRel, setActiveRel] = useState('');     // relationship_type_id
  // Editor state per (relTypeId, scheduleSlug): { offsetsInput, docs[] }.
  const [editor, setEditor] = useState({});           // key = `${rel}|${slug}`
  const [busy, setBusy] = useState({});               // same key → bool
  const [msg, setMsg] = useState({});                 // same key → {kind,text}

  const load = () => {
    if (!fbUser || !community) return;
    setLoading(true); setErr('');
    Promise.all([
      taxApi.adminListRelationshipTypes(auth, { communitySlug: community.id }),
      taxApi.adminListFilingSchedules(auth, community.id),
      taxApi.adminListRelationshipWorkflowRules(auth, community.id),
    ])
      .then(([rT, rS, rR]) => {
        const ts = (rT.types || []).filter(x => x.active !== false);
        setTypes(ts);
        setSchedules(rS.schedules || []);
        setRules(rR.rules || []);
        if (!activeRel && ts.length) setActiveRel(ts[0].id);
      })
      .catch(e => setErr(e?.message || t('error.loadFailed')))
      .finally(() => setLoading(false));
  };
  useEffect(load, [fbUser, community]); // eslint-disable-line react-hooks/exhaustive-deps

  const enabledSchedules = useMemo(() =>
    schedules.filter(s => s.enabled !== false), [schedules]);

  const ruleFor = (relId, slug) =>
    rules.find(r => r.relationship_type_id === relId && r.filing_schedule_slug === slug) || null;

  // Pull current editor state, falling back to whatever is stored.
  const getEditState = (relId, slug) => {
    const k = `${relId}|${slug}`;
    if (editor[k]) return editor[k];
    const r = ruleFor(relId, slug);
    return {
      offsetsInput: Array.isArray(r?.reminder_offsets_days) ? r.reminder_offsets_days.join(', ') : '',
      docs: Array.isArray(r?.required_documents) ? r.required_documents : [],
    };
  };
  const setEditState = (relId, slug, patch) => {
    const k = `${relId}|${slug}`;
    setEditor(prev => ({ ...prev, [k]: { ...getEditState(relId, slug), ...patch } }));
  };

  const onSave = async (relId, slug) => {
    const k = `${relId}|${slug}`;
    const st = getEditState(relId, slug);
    setBusy(p => ({ ...p, [k]: true }));
    setMsg(p => ({ ...p, [k]: { kind: 'idle', text: '' } }));
    try {
      // Parse "14, 7, 2" or "14 7 2" or "14;7;2"
      const offsets = String(st.offsetsInput || '')
        .split(/[\s,;]+/).map(s => parseInt(s, 10))
        .filter(n => Number.isFinite(n) && n >= 0 && n <= 365);
      await taxApi.adminUpdateRelationshipWorkflowRule(auth, relId, slug, {
        communitySlug: community.id,
        reminderOffsetsDays: offsets,
        requiredDocuments: st.docs,
        active: true,
      });
      setMsg(p => ({ ...p, [k]: { kind: 'success', text: t('owner.workflows.saved') } }));
      // Clear editor cache for this key so next render shows DB state.
      setEditor(prev => { const n = { ...prev }; delete n[k]; return n; });
      load();
    } catch (e) {
      setMsg(p => ({ ...p, [k]: { kind: 'error', text: e?.message || t('respond.error.generic') } }));
    } finally {
      setBusy(p => ({ ...p, [k]: false }));
    }
  };

  const onReset = async (relId, slug) => {
    if (!window.confirm(t('owner.workflows.resetConfirm'))) return;
    const k = `${relId}|${slug}`;
    setBusy(p => ({ ...p, [k]: true }));
    setMsg(p => ({ ...p, [k]: { kind: 'idle', text: '' } }));
    try {
      await taxApi.adminDeleteRelationshipWorkflowRule(auth, relId, slug, community.id);
      setEditor(prev => { const n = { ...prev }; delete n[k]; return n; });
      setMsg(p => ({ ...p, [k]: { kind: 'success', text: t('owner.workflows.resetDone') } }));
      load();
    } catch (e) {
      setMsg(p => ({ ...p, [k]: { kind: 'error', text: e?.message || t('respond.error.generic') } }));
    } finally {
      setBusy(p => ({ ...p, [k]: false }));
    }
  };

  const addDoc = (relId, slug) => {
    const st = getEditState(relId, slug);
    setEditState(relId, slug, {
      docs: [...st.docs, { key: '', label_i18n: { en: '', es: '' }, type: 'text', required: true }],
    });
  };
  const updateDoc = (relId, slug, idx, patch) => {
    const st = getEditState(relId, slug);
    const next = st.docs.slice();
    next[idx] = { ...next[idx], ...patch };
    setEditState(relId, slug, { docs: next });
  };
  const removeDoc = (relId, slug, idx) => {
    const st = getEditState(relId, slug);
    setEditState(relId, slug, { docs: st.docs.filter((_, i) => i !== idx) });
  };

  if (employee && employee.role !== 'admin') {
    return <EmployeeShell community={community} active="workflows">
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }

  return (
    <EmployeeShell community={community} active="workflows">
      <h2 style={{ marginTop: 0 }}>{t('owner.workflows.title')}</h2>
      <p className="tax-section__lede">{t('owner.workflows.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}
      {loading && <p>{t('loading')}</p>}

      {types.length === 0 && !loading && (
        <p style={{ color: 'var(--tax-muted)' }}>{t('owner.workflows.noRelationships')}</p>
      )}

      {types.length > 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="wkfl-rel" style={{ display: 'block', fontSize: 13, color: 'var(--tax-muted)', marginBottom: 4 }}>
              {t('owner.workflows.relationship')}
            </label>
            <select id="wkfl-rel" value={activeRel} onChange={e => setActiveRel(e.target.value)}>
              {types.map(rt => (
                <option key={rt.id} value={rt.id}>
                  {rt.category} — {pickI18n(rt.name_i18n, locale).value || rt.slug}
                </option>
              ))}
            </select>
          </div>

          {enabledSchedules.length === 0 && (
            <p style={{ color: 'var(--tax-muted)' }}>{t('owner.workflows.noSchedules')}</p>
          )}

          <div style={{ display: 'grid', gap: 16 }}>
            {enabledSchedules.map(sch => {
              const k = `${activeRel}|${sch.slug}`;
              const st = getEditState(activeRel, sch.slug);
              const r = ruleFor(activeRel, sch.slug);
              const isOverride = !!r;
              const mkey = msg[k];
              return (
                <section key={sch.id} style={{
                  border: '1px solid var(--tax-border)', borderRadius: 8, padding: 16,
                  background: 'var(--tax-bg)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{pickI18n(sch.name_i18n, locale).value || sch.slug}</div>
                      <div style={{ fontSize: 12, color: 'var(--tax-muted)' }}>
                        <code>{sch.slug}</code> · {sch.cadence}
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      background: isOverride ? 'var(--tax-brand-primary)' : 'var(--tax-bg-alt)',
                      color: isOverride ? '#fff' : 'var(--tax-muted)',
                    }}>
                      {isOverride ? t('owner.workflows.statusOverride') : t('owner.workflows.statusDefault')}
                    </span>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label htmlFor={`off-${k}`} style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                      {t('owner.workflows.offsetsLabel')}
                    </label>
                    <input id={`off-${k}`} type="text" value={st.offsetsInput}
                           placeholder="14, 7, 2"
                           onChange={e => setEditState(activeRel, sch.slug, { offsetsInput: e.target.value })}
                           style={{ width: 220 }} />
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tax-muted)' }}>
                      {t('owner.workflows.offsetsHint')}
                    </p>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t('owner.workflows.docsLabel')}</span>
                      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                              onClick={() => addDoc(activeRel, sch.slug)}>
                        + {t('owner.workflows.addDoc')}
                      </button>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--tax-muted)' }}>
                      {t('owner.workflows.docsHint')}
                    </p>
                    {st.docs.length === 0 && (
                      <p style={{ color: 'var(--tax-muted)', fontSize: 13 }}>{t('owner.workflows.docsEmpty')}</p>
                    )}
                    {st.docs.map((d, i) => (
                      <div key={i} style={{
                        display: 'grid', gap: 8, padding: 8, marginTop: 8,
                        gridTemplateColumns: '1fr 1fr 1fr 110px 60px 32px',
                        alignItems: 'center', border: '1px dashed var(--tax-border)', borderRadius: 6,
                      }}>
                        <input type="text" value={d.key} placeholder={t('owner.workflows.docKey')}
                               onChange={e => updateDoc(activeRel, sch.slug, i, { key: e.target.value })} />
                        <input type="text" value={d.label_i18n?.en || ''} placeholder={t('owner.workflows.docLabelEn')}
                               onChange={e => updateDoc(activeRel, sch.slug, i, { label_i18n: { ...(d.label_i18n || {}), en: e.target.value } })} />
                        <input type="text" value={d.label_i18n?.es || ''} placeholder={t('owner.workflows.docLabelEs')}
                               onChange={e => updateDoc(activeRel, sch.slug, i, { label_i18n: { ...(d.label_i18n || {}), es: e.target.value } })} />
                        <select value={d.type || 'text'} onChange={e => updateDoc(activeRel, sch.slug, i, { type: e.target.value })}>
                          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <input type="checkbox" checked={d.required !== false}
                                 onChange={e => updateDoc(activeRel, sch.slug, i, { required: e.target.checked })} />
                          {t('owner.workflows.docRequired')}
                        </label>
                        <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                                onClick={() => removeDoc(activeRel, sch.slug, i)}
                                aria-label={t('owner.workflows.removeDoc')}>×</button>
                      </div>
                    ))}
                  </div>

                  {mkey?.text && (
                    <div className={`tax-msg tax-msg--${mkey.kind === 'error' ? 'error' : 'success'}`} style={{ marginTop: 12 }}>
                      {mkey.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                            disabled={!!busy[k]} onClick={() => onSave(activeRel, sch.slug)}>
                      {busy[k] ? t('lead.submitting') : t('owner.workflows.saveBtn')}
                    </button>
                    {isOverride && (
                      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                              disabled={!!busy[k]} onClick={() => onReset(activeRel, sch.slug)}>
                        {t('owner.workflows.resetBtn')}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </EmployeeShell>
  );
}
