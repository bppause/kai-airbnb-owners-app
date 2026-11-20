// Items the cleaning service proposes — shared pieces for both screens.
//
// The cleaning service can't add to a unit's inventory directly. When
// they find something that isn't on the list they propose it here; it
// waits, shown apart from the inventory, until the owner approves or
// rejects it. Deleting stays with the owner: an item that is gone is
// counted as zero.

import React, { useEffect, useRef, useState } from "react";
import { tr, primaryText, secondaryText, formatWhen, parseCountInput } from "../strings";

const OTHER_AREA = '\u0000other';

// The form the cleaning service fills in. `areas` are the unit's areas
// (from groupByArea) so the item lands in an existing one by default;
// "another area" takes a typed name. What is typed is stored under the
// language the page is in — the owner can add the other on approval.
// `onSend(item)` resolves true when the proposal was accepted, and the
// form then clears, keeping the area: things are added a room at a time.
export function ProposeItemForm({ lang, areas, busy, onSend, onCancel }) {
  const T = (k, v) => tr(lang, k, v);
  const english = String(lang || '').toLowerCase().startsWith('en');
  const [name, setName] = useState('');
  const [areaKey, setAreaKey] = useState(areas.length ? areas[0].key : OTHER_AREA);
  const [newArea, setNewArea] = useState('');
  const [count, setCount] = useState('1');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const boxRef = useRef(null);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollIntoView({ block: 'start' }); }, []);

  const step = (delta) => setCount(String(Math.max(0, (parseCountInput(count) ?? 1) + delta)));
  const send = async () => {
    if (!name.trim()) { setProblem(T('proposeNameNeeded')); return; }
    const n = parseCountInput(count);
    if (n == null) { setProblem(T('countInvalid')); return; }
    setProblem('');
    const area = areas.find(a => a.key === areaKey);
    const typedArea = newArea.trim();
    const item = {
      areaEn: area ? area.areaEn : (english ? typedArea : ''),
      areaEs: area ? area.areaEs : (english ? '' : typedArea),
      nameEn: english ? name.trim() : '',
      nameEs: english ? '' : name.trim(),
      note: note.trim(),
      count: n,
    };
    if (await onSend(item)) { setName(''); setCount('1'); setNote(''); }
  };

  return (
    <div className="uinv-box uinv-propose" ref={boxRef}>
      <h2>{T('proposeTitle')}</h2>
      <p className="uinv-help">{T('proposeHelp')}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label className="uinv-field">{T('proposeName')}
          <input value={name} maxLength={300} enterKeyHint="next" onChange={e => { setName(e.target.value); setProblem(''); }} />
        </label>
        <label className="uinv-field">{T('proposeArea')}
          <select className="uinv-select" value={areaKey} onChange={e => setAreaKey(e.target.value)}>
            {areas.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            <option value={OTHER_AREA}>{T('proposeAreaOther')}</option>
          </select>
        </label>
        {areaKey === OTHER_AREA && (
          <label className="uinv-field">{T('proposeAreaNew')}
            <input value={newArea} maxLength={120} onChange={e => setNewArea(e.target.value)} />
          </label>
        )}
        <div className="uinv-field">{T('proposeCount')}
          <div className="uinv-step">
            <button type="button" disabled={busy} onClick={() => step(-1)} aria-label={T('oneLess')}>−</button>
            <input className="uinv-num" inputMode="numeric" pattern="[0-9]*" value={count} disabled={busy}
              onFocus={e => e.target.select()} onChange={e => { setCount(e.target.value); setProblem(''); }} aria-label={T('proposeCount')} />
            <button type="button" disabled={busy} onClick={() => step(1)} aria-label={T('oneMore')}>+</button>
          </div>
        </div>
        <label className="uinv-field">{T('note')}
          <input value={note} maxLength={1000} enterKeyHint="done" onChange={e => setNote(e.target.value)} />
        </label>
      </div>
      {problem && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: '10px 0 0' }}>{problem}</div>}
      <div className="uinv-row" style={{ marginTop: 12 }}>
        <button type="button" className="uinv-btn uinv-btn-p" style={{ flex: '1 1 160px' }} disabled={busy} onClick={send}>{busy ? T('saving') : T('proposeSend')}</button>
        <button type="button" className="uinv-btn" disabled={busy} onClick={onCancel}>{T('close')}</button>
      </div>
    </div>
  );
}

// The proposals still waiting. `actionsFor(proposal)` (owner only)
// returns the Approve / Reject buttons; without it the list is read-only.
export function PendingProposals({ lang, proposals, owner = false, actionsFor }) {
  if (!proposals || !proposals.length) return null;
  const T = (k, v) => tr(lang, k, v);
  return (
    <div className="uinv-box uinv-pending">
      <h2>🆕 {T(owner ? 'pendingOwner' : 'pendingShared', { n: proposals.length })}</h2>
      <p className="uinv-help" style={{ marginBottom: 0 }}>{T(owner ? 'pendingOwnerHelp' : 'pendingSharedHelp')}</p>
      {proposals.map(p => {
        const area = primaryText(p.areaEn, p.areaEs);
        const other = secondaryText(p.nameEn, p.nameEs);
        return (
          <div key={p.id} className="uinv-prop">
            <div className="uinv-name">{primaryText(p.nameEn, p.nameEs)}</div>
            {other && <div className="uinv-other">{other}</div>}
            <div>{[area, T('proposedQty', { n: p.count })].filter(Boolean).join(' · ')}</div>
            {p.note && <div className="uinv-onote">{p.note}</div>}
            <div className="uinv-meta">{T('proposedBy', { who: p.proposedBy, when: formatWhen(p.createdAt, lang) })}</div>
            {actionsFor && <div className="uinv-prop-actions">{actionsFor(p)}</div>}
          </div>
        );
      })}
    </div>
  );
}
