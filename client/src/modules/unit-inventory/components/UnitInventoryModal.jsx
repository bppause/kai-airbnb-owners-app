// UnitInventoryModal — the owner's inventory screen for one unit, opened
// from My Units. Lists the items by area with their baseline and current
// counts, and is the only place items are added, edited, deleted,
// imported from CSV, or re-baselined. Also manages the no-login link the
// cleaning service counts through, and shows the change history.
//
// The server enforces that only the unit's owner reaches any of this;
// see server/modules/unit-inventory/routes.js.

import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../../core/app-state";
import { api } from "../../../core/api";
import { aptDisplay } from "../../../core/i18n/app-text";
import { tr, primaryText, secondaryText, groupByArea, formatWhen, parseCountInput, diffFromBaseline, diffClass, tallyDiffs, API_BASE } from "../strings";
import { DiffBadge, DiffSummary } from "./DiffMarks";
import { itemsFromCsv } from "../csv";
import { UINV_CSS } from "../styles";

// The descriptive fields of an item, in form order (Spanish first). Each is also the key
// of its label in strings.js and of its entry in an edit event's changes.
const EDIT_FIELDS = ['areaEs', 'areaEn', 'nameEs', 'nameEn', 'noteEs', 'noteEn'];

const EMPTY_FORM = { areaEn: '', areaEs: '', nameEn: '', nameEs: '', noteEn: '', noteEs: '', count: '1' };

function HistoryList({ events, lang }) {
  if (events === null) return <p className="uinv-sub">{tr(lang, 'loading')}</p>;
  if (!events.length) return <p className="uinv-sub">{tr(lang, 'histEmpty')}</p>;
  return (
    <div>
      {events.map(ev => {
        const lines = [];
        if (ev.type === 'created') lines.push(tr(lang, 'histCreated', { n: ev.countAfter }));
        if (ev.type === 'deleted') lines.push(tr(lang, 'histDeleted', { n: ev.countBefore, b: ev.baselineBefore }));
        if (ev.type === 'edited') {
          // One line per field the edit changed, labelled as in the form.
          const changed = EDIT_FIELDS.filter(f => ev.changes && ev.changes[f]);
          if (!changed.length) lines.push(tr(lang, 'histEdited'));
          for (const f of changed) lines.push(tr(lang, 'histField', { field: tr(lang, f), a: ev.changes[f].before, b: ev.changes[f].after }));
        }
        if (ev.type === 'rebaseline') lines.push(tr(lang, 'histRebaseline', { a: ev.baselineBefore, b: ev.baselineAfter }));
        if (ev.type === 'count') {
          if (ev.countBefore !== ev.countAfter) lines.push(tr(lang, 'histCount', { a: ev.countBefore, b: ev.countAfter }));
          if (ev.noteBefore !== ev.noteAfter) lines.push(tr(lang, 'histNote', { a: ev.noteBefore, b: ev.noteAfter }));
        }
        const actor = `${tr(lang, ev.actorType === 'cleaner' ? 'actorCleaner' : 'actorOwner')}${ev.actorName ? ` · ${ev.actorName}` : ''}`;
        return (
          <div key={ev.id} className="uinv-hist">
            <div className="uinv-name">{primaryText(ev.itemNameEn, ev.itemNameEs)}</div>
            {secondaryText(ev.itemNameEn, ev.itemNameEs) && <div className="uinv-other">{secondaryText(ev.itemNameEn, ev.itemNameEs)}</div>}
            {lines.map((l, i) => <div key={i}>{l}</div>)}
            <div className="uinv-hist-when">{formatWhen(ev.createdAt, lang)} · {actor}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function UnitInventoryModal({ listing, user, onClose }) {
  const { lang } = useApp();
  const T = (k, v) => tr(lang, k, v);
  const who = { ownerUid: user.uid, actorName: user.name || user.email || '' };
  const unitBase = `${API_BASE}/units/${encodeURIComponent(listing.id)}`;

  const [items, setItems] = useState(null);
  const [link, setLink] = useState(null);
  // Counts and notes as typed, keyed by item id, until saved.
  const [draft, setDraft] = useState({});
  const [tab, setTab] = useState('items');
  const [form, setForm] = useState(null);
  const [importState, setImportState] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [onlyChanged, setOnlyChanged] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const d = await api.get(`${unitBase}?ownerUid=${encodeURIComponent(user.uid)}`);
    setItems(d.items || []);
    setLink(d.link || null);
  };
  useEffect(() => {
    load().catch(e => { setItems([]); setMsg({ err: true, text: e?.message || String(e) }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);
  useEffect(() => {
    if (tab !== 'history') return;
    setHistory(null);
    api.get(`${unitBase}/history?ownerUid=${encodeURIComponent(user.uid)}`)
      .then(d => setHistory(d.events || []))
      .catch(e => { setHistory([]); setMsg({ err: true, text: e?.message || String(e) }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { await fn(); if (okText) setMsg({ text: okText }); }
    catch (e) { setMsg({ err: true, text: e?.message || String(e) }); }
    finally { setBusy(false); }
  };

  const list = items || [];
  const typed = (it) => draft[it.id] || { count: String(it.currentCount), note: it.currentNote };
  const isDirty = (it) => {
    const v = draft[it.id];
    return !!v && (v.count !== String(it.currentCount) || v.note !== it.currentNote);
  };
  const dirtyItems = list.filter(isDirty);
  const drifted = list.filter(it => it.baselineCount !== it.currentCount);
  // What's on screen is judged by the count as typed, so a row lights up
  // the moment its number leaves the baseline; `drifted` above stays on
  // saved counts because that is what re-baselining acts on.
  const diffOf = (it) => diffFromBaseline(it, draft[it.id]?.count);
  const tally = tallyDiffs(list, diffOf);
  // Rows being edited stay in the narrowed list even if typed back to the
  // baseline, so they don't vanish mid-edit. With nothing changed the
  // narrowing is ignored rather than leaving an empty list.
  const shown = onlyChanged && tally.changed > 0 ? list.filter(it => diffOf(it) !== 0 || isDirty(it)) : list;
  const setTyped = (it, field, value) => setDraft(prev => ({ ...prev, [it.id]: { ...typed(it), [field]: value } }));

  const saveCounts = () => {
    const updates = [];
    for (const it of dirtyItems) {
      const count = parseCountInput(draft[it.id].count);
      if (count == null) { setMsg({ err: true, text: T('countInvalid') }); return; }
      updates.push({ itemId: it.id, count, note: draft[it.id].note });
    }
    run(async () => {
      await api.post(`${unitBase}/counts`, { ...who, updates });
      setDraft({});
      await load();
    }, T('saved'));
  };

  const rebaseline = (itemIds) => {
    if (dirtyItems.length) { setMsg({ err: true, text: T('unsavedFirst') }); return; }
    const n = itemIds ? itemIds.length : drifted.length;
    if (!n || !window.confirm(T('rebaselineConfirm', { n }))) return;
    run(async () => {
      await api.post(`${unitBase}/rebaseline`, { ...who, ...(itemIds ? { itemIds } : {}) });
      await load();
    }, T('saved'));
  };

  const removeItem = (it) => {
    if (!window.confirm(T('deleteConfirm', { name: primaryText(it.nameEn, it.nameEs) }))) return;
    run(async () => {
      await api.del(`${API_BASE}/items/${encodeURIComponent(it.id)}`, who);
      setDraft(prev => { const next = { ...prev }; delete next[it.id]; return next; });
      await load();
    });
  };

  const saveForm = () => {
    if (!form.nameEn.trim() && !form.nameEs.trim()) { setMsg({ err: true, text: T('nameRequired') }); return; }
    if (form.id) {
      run(async () => {
        await api.put(`${API_BASE}/items/${encodeURIComponent(form.id)}`, { ...who, ...form });
        setForm(null);
        await load();
      }, T('saved'));
      return;
    }
    const count = parseCountInput(form.count);
    if (count == null) { setMsg({ err: true, text: T('countInvalid') }); return; }
    run(async () => {
      await api.post(`${unitBase}/items`, { ...who, items: [{ ...form, count }] });
      // Keep the area filled in: items are usually added a room at a time.
      setForm({ ...EMPTY_FORM, areaEn: form.areaEn, areaEs: form.areaEs });
      await load();
    }, T('saved'));
  };

  const onCsvChosen = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportState(itemsFromCsv(String(reader.result || '')));
    reader.onerror = () => setMsg({ err: true, text: String(reader.error || 'read failed') });
    reader.readAsText(file);
  };
  const confirmImport = () => run(async () => {
    await api.post(`${unitBase}/items`, { ...who, items: importState.items });
    setImportState(null);
    await load();
  }, T('saved'));

  const linkAction = (action) => {
    if (action === 'regenerate' && !window.confirm(T('linkRegenConfirm'))) return;
    run(async () => {
      const d = await api.post(`${unitBase}/link`, { ...who, action });
      setLink(d.link || null);
    });
  };
  const linkUrl = link ? `${window.location.origin}/?inventory=${encodeURIComponent(link.token)}` : '';
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(linkUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch (_e) { window.prompt(T('linkCopy'), linkUrl); }
  };

  const areaOptions = (field) => Array.from(new Set(list.map(it => it[field]).filter(Boolean)));

  return (
    <div className="uinv uinv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{UINV_CSS}</style>
      <div className="uinv-panel" role="dialog" aria-modal="true">
        <button className="uinv-x" onClick={onClose} aria-label={T('close')}>✕</button>
        <h1>📦 {T('title')} · {aptDisplay(listing.apt, lang)}</h1>
        <div className="uinv-tabs">
          <button className={`uinv-tab${tab === 'items' ? ' uinv-tab-on' : ''}`} onClick={() => setTab('items')}>{T('tabItems')}</button>
          <button className={`uinv-tab${tab === 'history' ? ' uinv-tab-on' : ''}`} onClick={() => setTab('history')}>{T('tabHistory')}</button>
        </div>

        {msg && <div className={`uinv-msg ${msg.err ? 'uinv-msg-err' : 'uinv-msg-ok'}`}>{msg.text}</div>}

        {tab === 'history' && <HistoryList events={history} lang={lang} />}

        {tab === 'items' && items === null && <p className="uinv-sub">{T('loading')}</p>}
        {tab === 'items' && items !== null && (
          <>
            <div className="uinv-box">
              <h2>{T('linkTitle')}</h2>
              <p className="uinv-help">{T('linkHelp')}</p>
              {!link && <button className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => linkAction('enable')}>{T('linkCreate')}</button>}
              {link && (
                <div className="uinv-row">
                  {link.enabled
                    ? <input className="uinv-link" readOnly value={linkUrl} onFocus={e => e.target.select()} />
                    : <span className="uinv-help" style={{ margin: 0 }}>{T('linkOff')}</span>}
                  {link.enabled && <button className="uinv-btn uinv-btn-sm" onClick={copyLink}>{copied ? T('linkCopied') : T('linkCopy')}</button>}
                  <button className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => linkAction(link.enabled ? 'disable' : 'enable')}>{link.enabled ? T('linkDisable') : T('linkEnable')}</button>
                  <button className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => linkAction('regenerate')}>{T('linkRegenerate')}</button>
                </div>
              )}
            </div>

            <div className="uinv-row" style={{ marginBottom: 10 }}>
              <button className="uinv-btn uinv-btn-p" disabled={busy} onClick={() => { setImportState(null); setForm({ ...EMPTY_FORM }); }}>{T('addItem')}</button>
              <button className="uinv-btn" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>{T('importCsv')}</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onCsvChosen} />
              {drifted.length > 0 && (
                <button className="uinv-btn uinv-btn-warn" disabled={busy} title={T('rebaselineHint')} onClick={() => rebaseline(null)}>
                  {T('rebaselineAll', { n: drifted.length })}
                </button>
              )}
            </div>

            {importState && (
              <div className="uinv-box">
                <h2>{T('importTitle')}</h2>
                <p className="uinv-help">{T('importHelp')}</p>
                {importState.problems.map((p, i) => (
                  <div key={i} className="uinv-msg uinv-msg-err">
                    {p.code === 'noHeader' ? T('importNoHeader')
                      : T('importBadRow', { row: p.row, problem: T(p.code === 'badCount' ? 'importBadCount' : 'importNeedName') })}
                  </div>
                ))}
                {importState.items.length === 0 && importState.problems.length === 0 && <p className="uinv-help">{T('importNoRows')}</p>}
                {importState.items.length > 0 && <p className="uinv-help">{T('importPreview', { n: importState.items.length })}</p>}
                <div className="uinv-row">
                  <button className="uinv-btn uinv-btn-p" disabled={busy || !importState.items.length || importState.problems.length > 0} onClick={confirmImport}>
                    {T('importConfirm', { n: importState.items.length })}
                  </button>
                  <button className="uinv-btn" disabled={busy} onClick={() => setImportState(null)}>{T('cancel')}</button>
                </div>
              </div>
            )}

            {form && (
              <div className="uinv-box">
                <h2 style={{ marginBottom: 8 }}>{form.id ? T('formEdit') : T('formAdd')}</h2>
                <div className="uinv-form">
                  <label className="uinv-field">{T('areaEs')}<input list="uinv-areas-es" value={form.areaEs} maxLength={120} onChange={e => setForm({ ...form, areaEs: e.target.value })} /></label>
                  <label className="uinv-field">{T('areaEn')}<input list="uinv-areas-en" value={form.areaEn} maxLength={120} onChange={e => setForm({ ...form, areaEn: e.target.value })} /></label>
                  <datalist id="uinv-areas-en">{areaOptions('areaEn').map(a => <option key={a} value={a} />)}</datalist>
                  <datalist id="uinv-areas-es">{areaOptions('areaEs').map(a => <option key={a} value={a} />)}</datalist>
                  <label className="uinv-field">{T('nameEs')}<input value={form.nameEs} maxLength={300} onChange={e => setForm({ ...form, nameEs: e.target.value })} /></label>
                  <label className="uinv-field">{T('nameEn')}<input value={form.nameEn} maxLength={300} onChange={e => setForm({ ...form, nameEn: e.target.value })} /></label>
                  <label className="uinv-field">{T('noteEs')}<input value={form.noteEs} maxLength={1000} onChange={e => setForm({ ...form, noteEs: e.target.value })} /></label>
                  <label className="uinv-field">{T('noteEn')}<input value={form.noteEn} maxLength={1000} onChange={e => setForm({ ...form, noteEn: e.target.value })} /></label>
                  {form.id
                    ? <p className="uinv-help uinv-full">{T('baselineLocked')}</p>
                    : <label className="uinv-field">{T('startCount')}<input className="uinv-num" inputMode="numeric" value={form.count} onChange={e => setForm({ ...form, count: e.target.value })} /></label>}
                </div>
                <div className="uinv-row" style={{ marginTop: 10 }}>
                  <button className="uinv-btn uinv-btn-p" disabled={busy} onClick={saveForm}>{busy ? T('saving') : T('save')}</button>
                  <button className="uinv-btn" disabled={busy} onClick={() => setForm(null)}>{T('close')}</button>
                </div>
              </div>
            )}

            {list.length === 0
              ? <div className="uinv-box"><strong>{T('empty')}</strong><p className="uinv-help">{T('emptyHint')}</p></div>
              : <DiffSummary lang={lang} total={list.length} tally={tally} onlyChanged={onlyChanged} onToggle={() => setOnlyChanged(v => !v)} />}

            {groupByArea(shown, lang).map(group => {
              const areaChanged = tallyDiffs(group.items, diffOf).changed;
              return (
              <div key={group.key}>
                <div className="uinv-area" onClick={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}>
                  <h2>{collapsed[group.key] ? '▸' : '▾'} {group.label}{group.other && <span className="uinv-area-other"> · {group.other}</span>}</h2>
                  <small>{T('itemsInArea', { n: group.items.length })}</small>
                  {areaChanged > 0 && <span className="uinv-badge uinv-badge-chg">{T('areaChanged', { n: areaChanged })}</span>}
                </div>
                {!collapsed[group.key] && group.items.map(it => {
                  const v = typed(it);
                  const diff = diffOf(it);
                  const other = secondaryText(it.nameEn, it.nameEs);
                  const ownerNote = primaryText(it.noteEn, it.noteEs);
                  const ownerNoteOther = secondaryText(it.noteEn, it.noteEs);
                  return (
                    <div key={it.id} className={`uinv-item${diffClass(diff)}${isDirty(it) ? ' uinv-item-dirty' : ''}`}>
                      <div>
                        <div className="uinv-name">{primaryText(it.nameEn, it.nameEs)} <DiffBadge diff={diff} lang={lang} /></div>
                        {other && <div className="uinv-other">{other}</div>}
                        {ownerNote && <div className="uinv-onote">{ownerNote}{ownerNoteOther && <span className="uinv-onote-other"> · {ownerNoteOther}</span>}</div>}
                      </div>
                      <div className="uinv-fields">
                        <div className="uinv-field">{T('baseline')}<div className="uinv-base">{it.baselineCount}</div></div>
                        <label className="uinv-field">{T('count')}
                          <input className="uinv-num" inputMode="numeric" value={v.count} disabled={busy} onChange={e => setTyped(it, 'count', e.target.value)} />
                        </label>
                        <label className="uinv-field uinv-grow">{T('note')}
                          <input value={v.note} maxLength={1000} disabled={busy} placeholder={T('notePlaceholder')} onChange={e => setTyped(it, 'note', e.target.value)} />
                        </label>
                      </div>
                      <div className="uinv-row">
                        <span className="uinv-meta" style={{ flex: '1 1 auto' }}>
                          {it.countUpdatedAt
                            ? T('lastCounted', { when: formatWhen(it.countUpdatedAt, lang), who: it.countUpdatedBy })
                            : T('neverCounted')}
                        </span>
                        {it.baselineCount !== it.currentCount && (
                          <button className="uinv-btn uinv-btn-sm uinv-btn-warn" disabled={busy} title={T('rebaselineHint')} onClick={() => rebaseline([it.id])}>{T('rebaselineOne')}</button>
                        )}
                        <button className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => { setImportState(null); setForm({ id: it.id, areaEn: it.areaEn, areaEs: it.areaEs, nameEn: it.nameEn, nameEs: it.nameEs, noteEn: it.noteEn, noteEs: it.noteEs, count: '' }); }}>✏️ {T('edit')}</button>
                        <button className="uinv-btn uinv-btn-sm uinv-btn-danger" disabled={busy} onClick={() => removeItem(it)}>🗑️ {T('delete')}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })}

            {dirtyItems.length > 0 && (
              <div className="uinv-bar">
                <button className="uinv-btn" disabled={busy} onClick={() => setDraft({})}>{T('cancel')}</button>
                <button className="uinv-btn uinv-btn-p" disabled={busy} onClick={saveCounts}>{busy ? T('saving') : T('saveCounts', { n: dirtyItems.length })}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
