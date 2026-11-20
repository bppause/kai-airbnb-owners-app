// The item list both inventory screens share: areas that fold, and one
// card per item with its expected count, a − / + stepper and a note.
//
// Built for a phone first, because that is where counting happens: a
// furnished unit runs to a couple of hundred items, so areas start folded
// on a long list, their headers stay pinned while you scroll through
// them, and on a narrow screen an item shows only what counting needs —
// the note and the owner's actions sit behind a toggle until the item has
// a note, differs from its baseline, or is opened.

import React, { useState } from "react";
import { tr, primaryText, secondaryText, groupByArea, formatWhen, parseCountInput, diffClass, tallyDiffs } from "../strings";
import { DiffBadge } from "./DiffMarks";

// A list longer than this opens with its areas folded.
const FOLD_FROM = 40;

// Which areas are folded. The default (folded or not) is decided once,
// when the list first loads, so adding the item that crosses the
// threshold doesn't suddenly fold everything.
export function useAreaFolding() {
  const [folded, setFolded] = useState({});
  const [foldDefault, setFoldDefault] = useState(null);
  const isFolded = (key) => (key in folded ? folded[key] : !!foldDefault);
  return {
    isFolded,
    decide: (itemCount) => setFoldDefault(prev => (prev === null ? itemCount > FOLD_FROM : prev)),
    toggle: (key) => setFolded(f => ({ ...f, [key]: !isFolded(key) })),
    open: (key) => setFolded(f => ({ ...f, [key]: false })),
    setAll: (keys, value) => setFolded(Object.fromEntries(keys.map(k => [k, value]))),
  };
}

// The key groupByArea gives an item's area — for opening the area an
// item was just added to.
export const areaKey = (areaEn, areaEs) => `${areaEn || ''}\u0001${areaEs || ''}`;

// `value` is { count, note } as typed. `actions` (owner only) are the
// buttons shown with the note. `expectedLabel` names the baseline box.
function ItemCard({ item, lang, value, diff, dirty, busy, expectedLabel, opened, onToggle, onChange, actions }) {
  const T = (k, v) => tr(lang, k, v);
  const other = secondaryText(item.nameEn, item.nameEs);
  const ownerNote = primaryText(item.noteEn, item.noteEs);
  const ownerNoteOther = secondaryText(item.noteEn, item.noteEs);
  // An item with something to say is never folded away.
  const forcedOpen = !!value.note || diff !== 0 || dirty;
  const open = forcedOpen || opened;
  const step = (delta) => {
    const current = parseCountInput(value.count);
    onChange('count', String(Math.max(0, (current == null ? item.currentCount : current) + delta)));
  };
  return (
    <div className={`uinv-item${diffClass(diff)}${dirty ? ' uinv-item-dirty' : ''}${open ? ' uinv-item-open' : ''}`}>
      <div>
        <div className="uinv-name">{primaryText(item.nameEn, item.nameEs)} <DiffBadge diff={diff} lang={lang} /></div>
        {other && <div className="uinv-other">{other}</div>}
        {ownerNote && <div className="uinv-onote">{ownerNote}{ownerNoteOther && <span className="uinv-onote-other"> · {ownerNoteOther}</span>}</div>}
      </div>
      <div className="uinv-body">
        <div className="uinv-fields">
          <div className="uinv-field">{expectedLabel}<div className="uinv-base">{item.baselineCount}</div></div>
          <div className="uinv-field">{T('count')}
            <div className="uinv-step">
              <button type="button" disabled={busy} onClick={() => step(-1)} aria-label={T('oneLess')}>−</button>
              <input className="uinv-num" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" value={value.count} disabled={busy}
                onFocus={e => e.target.select()} onChange={e => onChange('count', e.target.value)} aria-label={T('count')} />
              <button type="button" disabled={busy} onClick={() => step(1)} aria-label={T('oneMore')}>+</button>
            </div>
          </div>
          {!forcedOpen && (
            <button type="button" className="uinv-more" aria-expanded={open} onClick={onToggle}
              aria-label={open ? T('less') : (actions ? T('more') : undefined)}>
              {open ? '▴' : (actions ? '⋯' : T('addNote'))}
            </button>
          )}
        </div>
        <div className="uinv-extra">
          <label className="uinv-field">{T('note')}
            <input value={value.note} maxLength={1000} disabled={busy} enterKeyHint="done" placeholder={T('notePlaceholder')} onChange={e => onChange('note', e.target.value)} />
          </label>
          <div className="uinv-row">
            <span className="uinv-meta" style={{ flex: '1 1 auto' }}>
              {item.countUpdatedAt
                ? T('lastCounted', { when: formatWhen(item.countUpdatedAt, lang), who: item.countUpdatedBy })
                : T('neverCounted')}
            </span>
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}

// `forceOpen` shows every area whatever is folded (a search or a filter
// is narrowing the list). `valueOf` / `diffOf` / `isDirty` read the
// screen's draft; `onChange(item, field, value)` writes it. `actionsFor`
// (owner only) returns an item's buttons.
export function ItemList({ items, lang, folding, forceOpen = false, busy, expectedLabel, valueOf, diffOf, isDirty, onChange, actionsFor }) {
  const T = (k, v) => tr(lang, k, v);
  // Items opened by hand on a narrow screen, by id.
  const [openedItems, setOpenedItems] = useState({});
  const groups = groupByArea(items, lang);
  const keys = groups.map(g => g.key);
  const anyFolded = !forceOpen && keys.some(k => folding.isFolded(k));
  return (
    <>
      {groups.length > 1 && !forceOpen && (
        <div className="uinv-row uinv-listbar">
          <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => folding.setAll(keys, !anyFolded)}>
            {anyFolded ? `▾ ${T('openAll')}` : `▸ ${T('closeAll')}`}
          </button>
        </div>
      )}
      {groups.map(group => {
        const folded = !forceOpen && folding.isFolded(group.key);
        const changed = tallyDiffs(group.items, diffOf).changed;
        return (
          <section key={group.key} className="uinv-group">
            <h2 className="uinv-area-h">
              <button type="button" className="uinv-area" aria-expanded={!folded} onClick={() => folding.toggle(group.key)}>
                <span className="uinv-area-caret" aria-hidden="true">{folded ? '▸' : '▾'}</span>
                <span className="uinv-area-text">
                  <span className="uinv-area-name">{group.label}</span>
                  {group.other && <span className="uinv-area-other">{group.other}</span>}
                </span>
                {changed > 0 && <span className="uinv-badge uinv-badge-chg">{T('areaChanged', { n: changed })}</span>}
                <span className="uinv-area-count" title={T('itemsInArea', { n: group.items.length })}>{group.items.length}</span>
              </button>
            </h2>
            {!folded && group.items.map(it => (
              <ItemCard key={it.id} item={it} lang={lang} value={valueOf(it)} diff={diffOf(it)} dirty={isDirty(it)} busy={busy}
                expectedLabel={expectedLabel} opened={!!openedItems[it.id]}
                onToggle={() => setOpenedItems(o => ({ ...o, [it.id]: !o[it.id] }))}
                onChange={(field, value) => onChange(it, field, value)}
                actions={actionsFor ? actionsFor(it) : null} />
            ))}
          </section>
        );
      })}
    </>
  );
}

// A message pinned above the bottom edge, where it is seen wherever the
// list is scrolled to. `raised` lifts it clear of the save bar.
export function Toast({ msg, raised, lang, onDismiss }) {
  if (!msg) return null;
  return (
    <div className={`uinv-toast${raised ? ' uinv-toast-raised' : ''}`}>
      <div className={`uinv-msg ${msg.err ? 'uinv-msg-err' : 'uinv-msg-ok'}`} role={msg.err ? 'alert' : 'status'}>
        <span>{msg.text}</span>
        <button type="button" className="uinv-toast-x" onClick={onDismiss} aria-label={tr(lang, 'dismiss')}>✕</button>
      </div>
    </div>
  );
}
