// Organizing the unit's areas: renaming one, combining two, or splitting
// one by moving some of its items elsewhere. Only the owner sees this.
//
// AreaNameForm is the name-an-area form shared by renaming (here and from
// an area's own bar in the list) and by "move to a new area": the name in
// the owner's language, the other translated read-only (see
// autoTranslate.js) — both typed when translation is off or fails — and a
// warning when the name is one the unit already uses.

import React, { useState } from "react";
import { tr, groupByArea } from "../strings";
import { useAutoTranslate } from "./autoTranslate";

const AREA_MAX = 120;
const isEn = (lang) => String(lang || '').toLowerCase().startsWith('en');
const same = (a, b) => (a.areaEn || '').trim().toLowerCase() === (b.areaEn || '').trim().toLowerCase()
  && (a.areaEs || '').trim().toLowerCase() === (b.areaEs || '').trim().toLowerCase();

// `areas` are the unit's area groups (for the "already exists" warning;
// `excludeKey` is the area being renamed). `onSave(to)` → true when done.
export function AreaNameForm({ lang, title, help, initial, areas, excludeKey, canTranslate, translate, knownArea, saveLabel, busy, onSave, onCancel }) {
  const T = (k, v) => tr(lang, k, v);
  const own = isEn(lang) ? 'En' : 'Es';
  const other = own === 'En' ? 'Es' : 'En';
  const [names, setNames] = useState({ areaEn: initial?.areaEn || '', areaEs: initial?.areaEs || '' });
  const [problem, setProblem] = useState('');
  const translator = useAutoTranslate({
    enabled: canTranslate, translate, knownArea,
    setField: (field, value) => setNames(prev => ({ ...prev, [field]: value })),
  });
  const merging = areas.find(g => g.key !== excludeKey && same(g, names));
  const save = async () => {
    setProblem('');
    if (translator.waiting()) await translator.flush();
    const to = { ...names, ...translator.applied() };
    if (!String(to.areaEn || '').trim() && !String(to.areaEs || '').trim()) { setProblem(T('areaNameNeeded')); return; }
    await onSave({ areaEn: String(to.areaEn || '').trim(), areaEs: String(to.areaEs || '').trim() });
  };
  return (
    <div className="uinv-box uinv-area-rename">
      {title && <h3 style={{ margin: '0 0 6px' }}>{title}</h3>}
      {help && <p className="uinv-help" style={{ marginTop: 0 }}>{help}</p>}
      <div className="uinv-form">
        {['area' + own, 'area' + other].map(field => {
          const st = translator.status[field];
          const ro = canTranslate && field.endsWith(other) && !(st && st.state === 'failed');
          const note = st && (st.state !== 'auto' || !ro)
            ? { cls: st.state, text: T(`tr_${st.state}`, { why: st.why || '' }) }
            : (ro ? { cls: 'ro', text: T('trReadonly', { from: T('lang' + own) }) } : null);
          return (
            <label key={field} className="uinv-field">{T(field)}
              <input value={names[field]} maxLength={AREA_MAX} readOnly={ro} aria-readonly={ro || undefined}
                className={ro ? 'uinv-ro' : undefined} tabIndex={ro ? -1 : undefined}
                onChange={e => { if (ro) return; const v = e.target.value; setNames(prev => ({ ...prev, [field]: v })); translator.onOwnerEdit(field, v); }} />
              {note && <span className={`uinv-tr uinv-tr-${note.cls}`} role="status">{note.text}</span>}
            </label>
          );
        })}
      </div>
      {merging && <div className="uinv-msg" style={{ marginTop: 8 }}>{T('areaRenameMerge', { name: merging.label, n: merging.items.length })}</div>}
      {problem && <div className="uinv-msg uinv-msg-err" role="alert" style={{ marginTop: 8 }}>{problem}</div>}
      <div className="uinv-row" style={{ marginTop: 10 }}>
        <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={save}>{busy ? T('saving') : saveLabel}</button>
        <button type="button" className="uinv-btn" disabled={busy} onClick={onCancel}>{T('cancel')}</button>
      </div>
    </div>
  );
}

// The "Organize areas" panel. `onRename(group, to)` renames an area (or,
// given another area's names, combines the two); `onMove(itemIds, to)`
// moves some items to an area. Both return true when done.
export function AreaOrganizer({ lang, items, busy, canTranslate, translate, knownArea, onRename, onMove, onClose }) {
  const T = (k, v) => tr(lang, k, v);
  const areas = groupByArea(items, lang);
  const named = areas.filter(g => g.areaEn || g.areaEs);
  // { key, mode: 'rename' | 'combine' | 'split' } — one action at a time.
  const [action, setAction] = useState(null);
  const [target, setTarget] = useState('');
  const [picked, setPicked] = useState({});
  const start = (group, mode) => {
    setPicked({}); setTarget('');
    setAction(action && action.key === group.key && action.mode === mode ? null : { key: group.key, mode });
  };
  const done = (ok) => { if (ok) { setAction(null); setPicked({}); setTarget(''); } };
  const nameOf = (g) => (g.other ? `${g.label} · ${g.other}` : g.label);

  return (
    <div className="uinv-box uinv-organizer">
      <div className="uinv-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{T('orgTitle')}</h2>
        <button type="button" className="uinv-btn uinv-btn-sm" onClick={onClose}>{T('close')}</button>
      </div>
      <p className="uinv-help">{T('orgHelp')}</p>
      {areas.map(group => {
        const open = action && action.key === group.key ? action.mode : null;
        const others = named.filter(g => g.key !== group.key);
        const chosen = Object.keys(picked).filter(id => picked[id] && group.items.some(it => it.id === id));
        const targetGroup = others.find(g => g.key === target);
        return (
          <section key={group.key} className="uinv-org-area">
            <div className="uinv-org-head">
              <div className="uinv-org-name">
                <strong>{group.label}</strong>
                {group.other && <span className="uinv-area-other">{group.other}</span>}
              </div>
              <span className="uinv-area-count">{group.items.length}</span>
            </div>
            <div className="uinv-row">
              {(group.areaEn || group.areaEs) && (
                <button type="button" className="uinv-btn uinv-btn-sm" aria-pressed={open === 'rename'} disabled={busy} onClick={() => start(group, 'rename')}>{T('orgRename')}</button>
              )}
              {others.length > 0 && (
                <button type="button" className="uinv-btn uinv-btn-sm" aria-pressed={open === 'combine'} disabled={busy} onClick={() => start(group, 'combine')}>{T('orgCombine')}</button>
              )}
              {group.items.length > 1 && (
                <button type="button" className="uinv-btn uinv-btn-sm" aria-pressed={open === 'split'} disabled={busy} onClick={() => start(group, 'split')}>{T('orgSplit')}</button>
              )}
            </div>

            {open === 'rename' && (
              <AreaNameForm lang={lang} title={T('areaRenameTitle')} help={T('areaRenameHelp', { n: group.items.length })}
                initial={group} areas={named} excludeKey={group.key} canTranslate={canTranslate} translate={translate} knownArea={knownArea}
                saveLabel={T('areaRenameSave', { n: group.items.length })} busy={busy}
                onSave={async (to) => done(await onRename(group, to))} onCancel={() => setAction(null)} />
            )}

            {open === 'combine' && (
              <div className="uinv-box uinv-area-rename">
                <label className="uinv-field">{T('orgCombineInto', { n: group.items.length })}
                  <select className="uinv-select" value={target} onChange={e => setTarget(e.target.value)}>
                    <option value="">{T('areaPickChoose')}</option>
                    {others.map(g => <option key={g.key} value={g.key}>{`${nameOf(g)} (${g.items.length})`}</option>)}
                  </select>
                </label>
                {targetGroup && <p className="uinv-help">{T('orgCombineHelp', { from: group.label, to: targetGroup.label, n: group.items.length + targetGroup.items.length })}</p>}
                <div className="uinv-row" style={{ marginTop: 8 }}>
                  <button type="button" className="uinv-btn uinv-btn-p" disabled={busy || !targetGroup}
                    onClick={async () => done(await onRename(group, { areaEn: targetGroup.areaEn, areaEs: targetGroup.areaEs }))}>
                    {targetGroup ? T('orgCombineSave', { n: group.items.length, to: targetGroup.label }) : T('orgCombineSaveNone')}
                  </button>
                  <button type="button" className="uinv-btn" disabled={busy} onClick={() => setAction(null)}>{T('cancel')}</button>
                </div>
              </div>
            )}

            {open === 'split' && (
              <div className="uinv-box uinv-area-rename">
                <p className="uinv-help" style={{ marginTop: 0 }}>{T('orgSplitHelp')}</p>
                <div className="uinv-org-items" role="group" aria-label={T('orgSplitPick')}>
                  {group.items.map(it => (
                    <label key={it.id} className="uinv-check uinv-org-item">
                      <input type="checkbox" checked={!!picked[it.id]} onChange={e => setPicked(p => ({ ...p, [it.id]: e.target.checked }))} />
                      <span>{isEn(lang) ? (it.nameEn || it.nameEs) : (it.nameEs || it.nameEn)} <span className="uinv-meta">× {it.baselineCount}</span></span>
                    </label>
                  ))}
                </div>
                <label className="uinv-field" style={{ marginTop: 10 }}>{T('orgSplitTo', { n: chosen.length })}
                  <select className="uinv-select" value={target} onChange={e => setTarget(e.target.value)}>
                    <option value="">{T('areaPickChoose')}</option>
                    {others.map(g => <option key={g.key} value={g.key}>{nameOf(g)}</option>)}
                    <option value="__new">{T('areaPickNew')}</option>
                  </select>
                </label>
                {target === '__new' ? (
                  <AreaNameForm lang={lang} title="" help={T('orgSplitNewHelp')} initial={{ areaEn: '', areaEs: '' }}
                    areas={named} excludeKey={group.key} canTranslate={canTranslate} translate={translate} knownArea={knownArea}
                    saveLabel={T('orgSplitSave', { n: chosen.length })} busy={busy || !chosen.length}
                    onSave={async (to) => done(await onMove(chosen, to))} onCancel={() => setAction(null)} />
                ) : (
                  <div className="uinv-row" style={{ marginTop: 8 }}>
                    <button type="button" className="uinv-btn uinv-btn-p" disabled={busy || !chosen.length || !targetGroup}
                      onClick={async () => done(await onMove(chosen, { areaEn: targetGroup.areaEn, areaEs: targetGroup.areaEs }))}>
                      {T('orgSplitSave', { n: chosen.length })}
                    </button>
                    <button type="button" className="uinv-btn" disabled={busy} onClick={() => setAction(null)}>{T('cancel')}</button>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
