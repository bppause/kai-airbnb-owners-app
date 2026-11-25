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
import { tr, primaryText, secondaryText, groupByArea, formatWhen, parseCountInput, diffClass, tallyDiffs, noteForViewer } from "../strings";
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
    close: (key) => setFolded(f => ({ ...f, [key]: true })),
    setAll: (keys, value) => setFolded(Object.fromEntries(keys.map(k => [k, value]))),
  };
}

// The key groupByArea gives an item's area — for opening the area an
// item was just added to.
export const areaKey = (areaEn, areaEs) => `${areaEn || ''}\u0001${areaEs || ''}`;

// A count note in the other language, read-only, e.g. "🌐 In Spanish
// (automatic translation): Falta una" — or, when the viewer is reading a
// translation, the note as it was typed: "🌐 In English (original): …".
// `view` comes from noteForViewer. Nothing when there is no other language.
export function NoteTranslation({ lang, view }) {
  if (!view || !view.other) return null;
  const label = tr(lang, view.otherIsOriginal ? 'noteOrigLabel' : 'noteTrLabel', { lang: tr(lang, view.otherLang === 'en' ? 'langEn' : 'langEs') });
  return (
    <div className="uinv-note-tr" role="note">
      <span className="uinv-note-tr-label">{label}</span> {view.other}
    </div>
  );
}

// `value` is { count, note } as typed. `actions` (owner only) are the
// buttons shown with the note. `expectedLabel` names the baseline box.
// `onRequired` (owner only) flips whether the item must be counted at
// every checkout; without it the ★ is only shown.
function ItemCard({ item, lang, value, diff, dirty, busy, expectedLabel, opened, onToggle, onChange, actions, onRequired, moreLabel, photos, proof, flash, headAction, badge, ack }) {
  const T = (k, v) => tr(lang, k, v);
  const noteView = noteForViewer(lang, item);
  const other = secondaryText(lang, item.nameEn, item.nameEs);
  const ownerNote = primaryText(lang, item.noteEn, item.noteEs);
  const ownerNoteOther = secondaryText(lang, item.noteEn, item.noteEs);
  // An item with something to say is never folded away.
  const forcedOpen = !!value.note || diff !== 0 || dirty;
  const open = forcedOpen || opened;
  const step = (delta) => {
    const current = parseCountInput(value.count);
    onChange('count', String(Math.max(0, (current == null ? item.currentCount : current) + delta)));
  };
  return (
    <div id={`uinv-item-${item.id}`} className={`uinv-item${diffClass(diff)}${dirty ? ' uinv-item-dirty' : ''}${open ? ' uinv-item-open' : ''}${flash ? ' uinv-item-flash' : ''}`}>
      <div className="uinv-item-head">
        <div className="uinv-item-text">
          <div className="uinv-name">
            {primaryText(lang, item.nameEn, item.nameEs)}
            {item.photoCount > 0 && <> <span className="uinv-cam" role="img" aria-label={T('photoHas')}>📷</span></>}
            {item.countRequired && <> <span className="uinv-badge uinv-badge-req">{T('reqBadge')}</span></>}
            {' '}<DiffBadge diff={diff} lang={lang} />
          </div>
          {other && <div className="uinv-other">{other}</div>}
          {badge}
          {ownerNote && <div className="uinv-onote">{ownerNote}{ownerNoteOther && <span className="uinv-onote-other"> · {ownerNoteOther}</span>}</div>}
          {photos}
          {proof}
        </div>
        {headAction}
        {onRequired && (
          <button type="button" className={`uinv-star${item.countRequired ? ' uinv-star-on' : ''}`} aria-pressed={item.countRequired}
            aria-label={T(item.countRequired ? 'reqTurnOff' : 'reqTurnOn')} title={T(item.countRequired ? 'reqTurnOff' : 'reqTurnOn')}
            onClick={() => onRequired(!item.countRequired)}>{item.countRequired ? '★' : '☆'}</button>
        )}
      </div>
      {ack}
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
              aria-label={open ? T('less') : (moreLabel || !actions ? undefined : T('more'))}>
              {open ? '▴' : (moreLabel || (actions ? '⋯' : T('addNote')))}
            </button>
          )}
        </div>
        <div className="uinv-extra">
          <label className="uinv-field">{T('note')}
            <input value={value.note} maxLength={1000} disabled={busy} enterKeyHint="done" placeholder={T('notePlaceholder')} onChange={e => onChange('note', e.target.value)} />
          </label>
          {/* The saved note in the other language, read-only. Hidden while
              the note is being changed: it would no longer match. */}
          {value.note === noteView.text && <NoteTranslation lang={lang} view={noteView} />}
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
// returns an item's buttons, shown with its note; `moreLabel` words the
// toggle that reveals them on a narrow screen (default: ⋯ when there are
// actions, "＋ Note" when there are none). `onRequired(items, required)`
// (owner only) flags one item or a whole area for every checkout.
// `photosFor(item)` returns the item's photo control (see ItemPhotos);
// `proofFor(item)` the cleaning service's proof-photo control for it.
// `flashId` briefly highlights one item (the one just edited or added).
// `onRenameArea(group)` (owner) adds "✏️ Rename area" to an open area's
// bar; `areaExtra(group)` is shown under that bar (the rename form).
// `headActionFor(item)` returns a button kept in view at the top right of
// the item even when it is folded on a phone (the cleaning service's
// ⚠️ Damage).
export function ItemList({ items, lang, folding, forceOpen = false, busy, expectedLabel, valueOf, diffOf, isDirty, onChange, actionsFor, onRequired, moreLabel, photosFor, proofFor, flashId, headActionFor, onRenameArea, areaExtra, areaBadge, areaFooter, badgeFor, ackFor }) {
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
        const required = group.items.filter(it => it.countRequired).length;
        return (
          <section key={group.key} className="uinv-group" id={`uinv-area-${encodeURIComponent(group.key)}`}>
            <h2 className="uinv-area-h">
              <button type="button" className="uinv-area" aria-expanded={!folded} onClick={() => folding.toggle(group.key)}>
                <span className="uinv-area-caret" aria-hidden="true">{folded ? '▸' : '▾'}</span>
                <span className="uinv-area-text">
                  <span className="uinv-area-name">{group.label}</span>
                  {group.other && <span className="uinv-area-other">{group.other}</span>}
                </span>
                {required > 0 && <span className="uinv-badge uinv-badge-req">{T('areaReqCount', { n: required })}</span>}
                {changed > 0 && <span className="uinv-badge uinv-badge-chg">{T('areaChanged', { n: changed })}</span>}
                {areaBadge && areaBadge(group)}
                <span className="uinv-area-count" title={T('itemsInArea', { n: group.items.length })}>{group.items.length}</span>
              </button>
            </h2>
            {!folded && onRequired && (
              <div className="uinv-row uinv-areabar">
                <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy || required === group.items.length} onClick={() => onRequired(group.items, true)}>{T('areaReqAll')}</button>
                <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy || required === 0} onClick={() => onRequired(group.items, false)}>{T('areaReqNone')}</button>
                {onRenameArea && (group.areaEn || group.areaEs) && (
                  <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => onRenameArea(group)}>{T('areaRename')}</button>
                )}
              </div>
            )}
            {!folded && areaExtra && areaExtra(group)}
            {!folded && group.items.map(it => (
              <ItemCard key={it.id} item={it} lang={lang} value={valueOf(it)} diff={diffOf(it)} dirty={isDirty(it)} busy={busy}
                expectedLabel={expectedLabel} opened={!!openedItems[it.id]}
                onToggle={() => setOpenedItems(o => ({ ...o, [it.id]: !o[it.id] }))}
                onChange={(field, value) => onChange(it, field, value)}
                actions={actionsFor ? actionsFor(it) : null} moreLabel={moreLabel}
                photos={photosFor ? photosFor(it) : null} proof={proofFor ? proofFor(it) : null} flash={flashId === it.id}
                headAction={headActionFor ? headActionFor(it) : null} badge={badgeFor ? badgeFor(it) : null} ack={ackFor ? ackFor(it) : null}
                onRequired={onRequired ? (required) => onRequired([it], required) : undefined} />
            ))}
            {!folded && areaFooter && areaFooter(group)}
          </section>
        );
      })}
    </>
  );
}

// The search box, pinned under the header so the list can be narrowed
// from wherever it is scrolled to. Beside it, once the owner has flagged
// anything, a ★ chip that flips between the every-checkout items and
// everything — the same choice as ViewSwitch, within thumb's reach.
export function FilterBar({ lang, search, onSearch, required, view, onView }) {
  return (
    <div className="uinv-filterbar">
      <input className="uinv-input" type="search" value={search} placeholder={tr(lang, 'search')} enterKeyHint="search" onChange={e => onSearch(e.target.value)} />
      {required > 0 && (
        <button type="button" className={`uinv-chip${view === 'required' ? ' uinv-chip-on' : ''}`} aria-pressed={view === 'required'}
          aria-label={tr(lang, 'filterRequired')} title={tr(lang, 'filterRequired')}
          onClick={() => onView(view === 'required' ? 'all' : 'required')}>★ {required}</button>
      )}
    </div>
  );
}

// Switches the list between the items flagged for every checkout and
// everything in the unit. Shown only when something is flagged; `hint`
// says what the ★ means to whoever is looking.
export function ViewSwitch({ lang, view, onChange, required, total, hint }) {
  if (!required) return null;
  return (
    <>
      <div className="uinv-switch" role="group">
        <button type="button" className={view === 'required' ? 'uinv-switch-on' : ''} aria-pressed={view === 'required'} onClick={() => onChange('required')}>{tr(lang, 'viewRequired', { n: required })}</button>
        <button type="button" className={view === 'all' ? 'uinv-switch-on' : ''} aria-pressed={view === 'all'} onClick={() => onChange('all')}>{tr(lang, 'viewAll', { n: total })}</button>
      </div>
      <p className="uinv-help">{hint}</p>
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
