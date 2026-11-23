// What passes between the owner and the cleaning service, besides the
// counts:
//
// - PeopleLinks: each person of the cleaning service gets a link of their
//   own, which the owner sends them (WhatsApp or copy); what they do
//   through it carries their name.
// - OwnerTasks / CleanerTasks: the owner's notes for the next visit
//   ("Cambié las pilas del control Niños, verifica"), ticked off by the
//   cleaning service; the cleaner's box also shows how the owner closed
//   recent damage reports.
// - ResolveDamage: the owner closes a damage report saying how
//   (repaired / replaced / other), optionally answering, and — when the
//   item was replaced — putting its count back to what is expected.
// - PendingInbox: everything waiting for the owner, in one box.

import React, { useState } from "react";
import { tr, primaryText, noteForViewer, formatWhen } from "../strings";

const taskView = (lang, t) => noteForViewer(lang, { currentNote: t.text, currentNoteLang: t.textLang, currentNoteTranslation: t.textTranslation });
const itemName = (lang, items, id) => {
  const it = id ? items.find(x => x.id === id) : null;
  return it ? primaryText(lang, it.nameEn, it.nameEs) : '';
};
// Digits for a wa.me link ("+57 300 123 4567" → "573001234567").
const waDigits = (phone) => String(phone || '').replace(/\D/g, '');

// ── People and their links (owner) ──────────────────────────────────

// `urlFor(person)` is the person's link; `onAdd({ name, phone })` and
// `onAction(person, action, fields?)` resolve true when done.
export function PeopleLinks({ lang, people, unitName, busy, urlFor, onAdd, onAction }) {
  const T = (k, v) => tr(lang, k, v);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState('');
  const [fields, setFields] = useState({ name: '', phone: '' });
  const [copied, setCopied] = useState('');
  const message = (p) => tr('es-CO', 'personShareText', { name: p.name, apt: unitName, url: urlFor(p) });
  const copy = async (p) => {
    try { await navigator.clipboard.writeText(urlFor(p)); setCopied(p.id); setTimeout(() => setCopied(''), 1800); }
    catch (_e) { window.prompt(T('linkCopy'), urlFor(p)); }
  };
  const waHref = (p) => `https://wa.me/${waDigits(p.phone)}?text=${encodeURIComponent(message(p))}`;
  const startEdit = (p) => { setAdding(false); setEditing(p ? p.id : ''); setFields({ name: p ? p.name : '', phone: p ? p.phone : '' }); };
  const form = (onSave) => (
    <div className="uinv-person-form">
      <div className="uinv-task-form">
        <label className="uinv-field">{T('personName')}
          <input value={fields.name} maxLength={120} autoCapitalize="words" onChange={e => setFields(f => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="uinv-field">{T('personPhone')}
          <input value={fields.phone} maxLength={40} inputMode="tel" placeholder="+57 300 123 4567" onChange={e => setFields(f => ({ ...f, phone: e.target.value }))} />
        </label>
      </div>
      <div className="uinv-row" style={{ marginTop: 8 }}>
        <button type="button" className="uinv-btn uinv-btn-p" disabled={busy || !fields.name.trim()} onClick={onSave}>{T('save')}</button>
        <button type="button" className="uinv-btn" disabled={busy} onClick={() => { setAdding(false); setEditing(''); }}>{T('cancel')}</button>
      </div>
    </div>
  );
  return (
    <div className="uinv-people" id="uinv-people">
      <h3>{T('peopleTitle')}</h3>
      <p className="uinv-help">{T('peopleHelp')}</p>
      {people.map(p => (
        <div key={p.id} className={`uinv-person${p.enabled ? '' : ' uinv-person-off'}`}>
          <div className="uinv-person-head">
            <strong>{p.name}</strong>
            <span className="uinv-meta">
              {p.enabled ? (p.lastSeenAt ? T('personSeen', { when: formatWhen(p.lastSeenAt, lang) }) : T('personNeverSeen')) : T('personOff')}
              {p.phone ? ` · ${p.phone}` : ''}
            </span>
          </div>
          {editing === p.id ? form(async () => { if (await onAction(p, 'update', fields)) setEditing(''); }) : (
            <div className="uinv-row">
              {p.enabled && <a className="uinv-btn uinv-btn-sm uinv-btn-p" href={waHref(p)} target="_blank" rel="noopener noreferrer">{T('personWhatsapp')}</a>}
              {p.enabled && <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => copy(p)}>{copied === p.id ? T('linkCopied') : T('linkCopy')}</button>}
              <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => startEdit(p)}>{T('edit')}</button>
              <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy}
                onClick={() => (p.enabled ? window.confirm(T('personOffConfirm', { name: p.name })) && onAction(p, 'disable') : onAction(p, 'enable'))}>
                {T(p.enabled ? 'personDisable' : 'personEnable')}
              </button>
              {p.enabled && (
                <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy}
                  onClick={() => window.confirm(T('personNewLinkConfirm', { name: p.name })) && onAction(p, 'regenerate')}>{T('personNewLink')}</button>
              )}
            </div>
          )}
        </div>
      ))}
      {adding ? form(async () => { if (await onAdd(fields)) setAdding(false); })
        : <button type="button" className="uinv-btn" disabled={busy} onClick={() => { startEdit(null); setAdding(true); }}>{T('personAdd')}</button>}
    </div>
  );
}

// ── Notes for the next visit ────────────────────────────────────────

// The owner's side: write a note (optionally about one item), see which
// were done, by whom, then file them away. `onAdd({ text, itemId })` and
// `onAction(task, 'archive' | 'reopen' | 'delete')` resolve true when done.
export function OwnerTasks({ lang, tasks, items, busy, onAdd, onAction }) {
  const T = (k, v) => tr(lang, k, v);
  const [text, setText] = useState('');
  const [itemId, setItemId] = useState('');
  const open = tasks.filter(t => t.status === 'open');
  const done = tasks.filter(t => t.status === 'done');
  const sorted = [...items].sort((a, b) => primaryText(lang, a.nameEn, a.nameEs).localeCompare(primaryText(lang, b.nameEn, b.nameEs)));
  const add = async () => { if (await onAdd({ text: text.trim(), itemId })) { setText(''); setItemId(''); } };
  const line = (t) => {
    const view = taskView(lang, t);
    const about = itemName(lang, items, t.itemId);
    return (
      <div className="uinv-task-text">
        <span>{view.text}</span>
        {about && <span className="uinv-meta">{T('fnItem', { name: about })}</span>}
      </div>
    );
  };
  return (
    <div className="uinv-box uinv-tasks" id="uinv-tasks">
      <h2>{T('tasksTitle')}</h2>
      <p className="uinv-help">{T('tasksHelp')}</p>
      {done.length > 0 && (
        <>
          <h3>{T('tasksDoneTitle', { n: done.length })}</h3>
          {done.map(t => (
            <div key={t.id} className="uinv-task-row uinv-task-done">
              {line(t)}
              <div className="uinv-meta">{T('taskDoneBy', { who: t.doneBy, when: formatWhen(t.doneAt, lang) })}{t.doneNote ? ` · “${t.doneNote}”` : ''}</div>
              <div className="uinv-row">
                <button type="button" className="uinv-btn uinv-btn-sm uinv-btn-p" disabled={busy} onClick={() => onAction(t, 'archive')}>{T('taskArchive')}</button>
                <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => onAction(t, 'reopen')}>{T('taskReopen')}</button>
              </div>
            </div>
          ))}
        </>
      )}
      {open.length > 0 && <h3>{T('tasksOpenTitle', { n: open.length })}</h3>}
      {open.map(t => (
        <div key={t.id} className="uinv-task-row">
          {line(t)}
          <div className="uinv-row">
            <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} aria-label={T('taskDeleteAria', { text: t.text })}
              onClick={() => onAction(t, 'delete')}>{T('taskDelete')}</button>
          </div>
        </div>
      ))}
      <div className="uinv-task-form">
        <label className="uinv-field">{T('taskNew')}
          <textarea className="uinv-textarea" value={text} maxLength={500} placeholder={T('taskNewPh')} onChange={e => setText(e.target.value)} />
        </label>
        <label className="uinv-field">{T('fnItemPick')}
          <select className="uinv-select" value={itemId} onChange={e => setItemId(e.target.value)}>
            <option value="">{T('fnItemNone')}</option>
            {sorted.map(it => <option key={it.id} value={it.id}>{primaryText(lang, it.nameEn, it.nameEs)}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className="uinv-btn uinv-btn-p" style={{ marginTop: 8 }} disabled={busy || !text.trim()} onClick={add}>{T('taskAdd')}</button>
    </div>
  );
}

const RESOLUTION_KEYS = { repaired: 'resRepaired', replaced: 'resReplaced', other: 'resOther' };

// The cleaning service's side: the owner's notes, each ticked "✓ Hecho"
// (with an optional word), and what the owner did about recent damage.
// `onToggle(task, done, note)` resolves true when saved.
export function CleanerTasks({ lang, tasks, damageNews, items, busy, onToggle }) {
  const T = (k, v) => tr(lang, k, v);
  const [noting, setNoting] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState('');
  if (!tasks.length && !damageNews.length) return null;
  const open = tasks.filter(t => t.status === 'open');
  const toggle = async (t, done, withNote) => {
    setSaving(t.id);
    try { if (await onToggle(t, done, withNote || '')) { setNoting(''); setNote(''); } } finally { setSaving(''); }
  };
  return (
    <div className="uinv-box uinv-owner-notes" id="uinv-owner-notes">
      <h2>{T('ownerNotesTitle')}</h2>
      {tasks.length > 0 && <p className="uinv-help">{open.length ? T('ownerNotesHelp', { n: open.length }) : T('ownerNotesAllDone')}</p>}
      {tasks.map(t => {
        const view = taskView(lang, t);
        const about = itemName(lang, items, t.itemId);
        const done = t.status === 'done';
        return (
          <div key={t.id} className={`uinv-task-row${done ? ' uinv-task-done' : ''}`}>
            <div className="uinv-task-text">
              <span>{done ? '✓ ' : '📝 '}{view.text}</span>
              {view.other && <span className="uinv-area-other">{view.other}</span>}
              {about && <span className="uinv-meta">{T('fnItem', { name: about })}</span>}
              {done && <span className="uinv-meta">{T('taskDoneBy', { who: t.doneBy, when: formatWhen(t.doneAt, lang) })}{t.doneNote ? ` · “${t.doneNote}”` : ''}</span>}
            </div>
            {done ? (
              <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy || !!saving} onClick={() => toggle(t, false)}>{T('taskUndo')}</button>
            ) : noting === t.id ? (
              <div className="uinv-task-note">
                <input className="uinv-input" value={note} maxLength={300} placeholder={T('taskNotePh')} aria-label={T('taskNotePh')} onChange={e => setNote(e.target.value)} />
                <div className="uinv-row">
                  <button type="button" className="uinv-btn uinv-btn-p" disabled={busy || !!saving} onClick={() => toggle(t, true, note.trim())}>{T('taskDone')}</button>
                  <button type="button" className="uinv-btn" disabled={!!saving} onClick={() => { setNoting(''); setNote(''); }}>{T('cancel')}</button>
                </div>
              </div>
            ) : (
              <div className="uinv-row">
                <button type="button" className="uinv-btn uinv-btn-p" disabled={busy || !!saving} onClick={() => toggle(t, true)}>{saving === t.id ? '…' : T('taskDone')}</button>
                <button type="button" className="uinv-btn" disabled={busy || !!saving} onClick={() => { setNoting(t.id); setNote(''); }}>{T('taskDoneWithNote')}</button>
              </div>
            )}
          </div>
        );
      })}
      {damageNews.length > 0 && (
        <>
          <h3>{T('damageNewsTitle')}</h3>
          {damageNews.map(d => (
            <div key={d.id} className="uinv-task-row uinv-task-done">
              <div className="uinv-task-text">
                <span>✓ {d.description}</span>
                <span className="uinv-meta">
                  {[d.resolution ? T(RESOLUTION_KEYS[d.resolution]) : T('resResolved'), primaryText(lang, d.itemNameEn, d.itemNameEs), formatWhen(d.resolvedAt, lang)].filter(Boolean).join(' · ')}
                </span>
                {d.ownerReply && <span className="uinv-owner-reply">💬 {d.ownerReply}</span>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Closing a damage report (owner) ─────────────────────────────────

// `item` is the report's item (if still on the list). `onResolve({
// resolution, reply, restoreCount })` resolves true when done.
export function ResolveDamage({ lang, damage, item, busy, onResolve }) {
  const T = (k, v) => tr(lang, k, v);
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [reply, setReply] = useState('');
  const short = item && item.currentCount < item.baselineCount;
  const [restore, setRestore] = useState(false);
  const pick = (r) => { setResolution(r); if (r === 'replaced' && short) setRestore(true); };
  if (!open) return <button type="button" className="uinv-btn" disabled={busy} onClick={() => setOpen(true)}>{T('damageResolve')}</button>;
  return (
    <div className="uinv-resolve">
      <div className="uinv-field">{T('resHow')}
        <div className="uinv-row" role="radiogroup" aria-label={T('resHow')}>
          {['repaired', 'replaced', 'other'].map(r => (
            <button key={r} type="button" role="radio" aria-checked={resolution === r} className={`uinv-btn uinv-btn-sm${resolution === r ? ' uinv-on' : ''}`} onClick={() => pick(r)}>{T(RESOLUTION_KEYS[r])}</button>
          ))}
        </div>
      </div>
      {short && (
        <label className="uinv-check">
          <input type="checkbox" checked={restore} onChange={e => setRestore(e.target.checked)} />
          <span>{T('resRestore', { name: primaryText(lang, item.nameEn, item.nameEs), a: item.currentCount, b: item.baselineCount })}</span>
        </label>
      )}
      <label className="uinv-field">{T('resReply')}
        <textarea className="uinv-textarea" value={reply} maxLength={1000} placeholder={T('resReplyPh')} onChange={e => setReply(e.target.value)} />
      </label>
      <div className="uinv-row">
        <button type="button" className="uinv-btn uinv-btn-p" disabled={busy}
          onClick={async () => { if (await onResolve({ resolution, reply: reply.trim(), restoreCount: !!(short && restore) })) setOpen(false); }}>{T('resSave')}</button>
        <button type="button" className="uinv-btn" disabled={busy} onClick={() => setOpen(false)}>{T('cancel')}</button>
      </div>
    </div>
  );
}

// ── What waits for the owner ────────────────────────────────────────

// `rows`: [{ key, icon, label, n }] with n > 0; `onJump(key)`.
export function PendingInbox({ lang, rows, onJump }) {
  const T = (k, v) => tr(lang, k, v);
  const shown = rows.filter(r => r.n > 0);
  return (
    <div className={`uinv-box uinv-inbox${shown.length ? '' : ' uinv-inbox-clear'}`}>
      <h2>{T('inboxTitle', { n: shown.reduce((s, r) => s + r.n, 0) })}</h2>
      {!shown.length && <p className="uinv-help" style={{ margin: 0 }}>{T('inboxClear')}</p>}
      {shown.length > 0 && (
        <div className="uinv-inbox-rows">
          {shown.map(r => (
            <button key={r.key} type="button" className="uinv-inbox-row" onClick={() => onJump(r.key)}>
              <span aria-hidden="true">{r.icon}</span>
              <span className="uinv-inbox-label">{r.label}</span>
              <span className="uinv-area-count">{r.n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
