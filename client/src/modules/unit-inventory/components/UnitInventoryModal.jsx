// UnitInventoryModal — the owner's inventory screen for one unit, opened
// from My Units. Lists the items by area with their baseline and current
// counts, and is the only place items are added, edited, deleted,
// imported from CSV, or re-baselined. Also manages the no-login link the
// cleaning service counts through, and shows the change history.
//
// The server enforces that only the unit's owner reaches any of this;
// see server/modules/unit-inventory/routes.js.
//
// On a phone it fills the screen. The title bar with its close button
// stays pinned, as do the area being scrolled through and the save bar;
// messages appear pinned at the bottom so they are seen wherever the
// list is scrolled to.

import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../../core/app-state";
import { api } from "../../../core/api";
import { aptDisplay } from "../../../core/i18n/app-text";
import { tr, primaryText, secondaryText, formatWhen, parseCountInput, diffFromBaseline, tallyDiffs, API_BASE } from "../strings";
import { DiffSummary } from "./DiffMarks";
import { ItemList, Toast, useAreaFolding, areaKey } from "./ItemList";
import { itemsFromCsv } from "../csv";
import { UINV_CSS } from "../styles";

// The descriptive fields of an item, in form order (Spanish first). Each
// is also the key of its label in strings.js and of its entry in an edit
// event's changes.
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
        const other = secondaryText(ev.itemNameEn, ev.itemNameEs);
        return (
          <div key={ev.id} className="uinv-hist">
            <div className="uinv-name">{primaryText(ev.itemNameEn, ev.itemNameEs)}</div>
            {other && <div className="uinv-other">{other}</div>}
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
  const [linkOptions, setLinkOptions] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [search, setSearch] = useState('');
  const folding = useAreaFolding();
  const fileRef = useRef(null);
  const formRef = useRef(null);
  const importRef = useRef(null);

  const load = async () => {
    const d = await api.get(`${unitBase}?ownerUid=${encodeURIComponent(user.uid)}`);
    setItems(d.items || []);
    setLink(d.link || null);
    folding.decide((d.items || []).length);
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

  // The add/edit form and the import preview open above the list, which
  // may be far from where Edit was tapped — bring them into view (at
  // once: an animated scroll across a couple of hundred items drags).
  const formOpen = !!form;
  const formItemId = form ? form.id || '' : '';
  useEffect(() => {
    if (formOpen && formRef.current) formRef.current.scrollIntoView({ block: 'start' });
  }, [formOpen, formItemId]);
  const importOpen = !!importState;
  useEffect(() => {
    if (importOpen && importRef.current) importRef.current.scrollIntoView({ block: 'start' });
  }, [importOpen]);

  // A success message clears itself; an error stays until dismissed.
  useEffect(() => {
    if (!msg || msg.err) return undefined;
    const id = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(id);
  }, [msg]);

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
  const narrowing = onlyChanged && tally.changed > 0;
  const needle = search.trim().toLowerCase();
  const shown = list
    .filter(it => !narrowing || diffOf(it) !== 0 || isDirty(it))
    .filter(it => !needle || `${it.nameEn} ${it.nameEs} ${it.areaEn} ${it.areaEs}`.toLowerCase().includes(needle));
  const setTyped = (it, field, value) => {
    if (msg && msg.err) setMsg(null);
    setDraft(prev => ({ ...prev, [it.id]: { ...typed(it), [field]: value } }));
  };

  const close = () => {
    if (dirtyItems.length && !window.confirm(T('unsavedClose', { n: dirtyItems.length }))) return;
    onClose();
  };

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

  const openForm = (next) => { setImportState(null); setForm(next); };

  const saveForm = () => {
    if (!form.nameEn.trim() && !form.nameEs.trim()) { setMsg({ err: true, text: T('nameRequired') }); return; }
    // Show the item where it lands, even if its area was folded.
    const landsIn = areaKey(form.areaEn.trim(), form.areaEs.trim());
    if (form.id) {
      run(async () => {
        await api.put(`${API_BASE}/items/${encodeURIComponent(form.id)}`, { ...who, ...form });
        setForm(null);
        folding.open(landsIn);
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
      folding.open(landsIn);
      await load();
    }, T('saved'));
  };

  const onCsvChosen = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setForm(null); setImportState(itemsFromCsv(String(reader.result || ''))); };
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
  // The phone's own share sheet (WhatsApp, Messages…), where there is one.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareLink = async () => {
    try { await navigator.share({ title: T('title'), text: T('linkShareText', { apt: listing.apt || '' }), url: linkUrl }); }
    catch (_e) { /* the person closed the share sheet */ }
  };

  const areaOptions = (field) => Array.from(new Set(list.map(it => it[field]).filter(Boolean)));

  const actionsFor = (it) => (
    <>
      {it.baselineCount !== it.currentCount && (
        <button type="button" className="uinv-btn uinv-btn-sm uinv-btn-warn" disabled={busy} title={T('rebaselineHint')} onClick={() => rebaseline([it.id])}>{T('rebaselineOne')}</button>
      )}
      <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy}
        onClick={() => openForm({ id: it.id, areaEn: it.areaEn, areaEs: it.areaEs, nameEn: it.nameEn, nameEs: it.nameEs, noteEn: it.noteEn, noteEs: it.noteEs, count: '' })}>✏️ {T('edit')}</button>
      <button type="button" className="uinv-btn uinv-btn-sm uinv-btn-danger" disabled={busy} onClick={() => removeItem(it)}>🗑️ {T('delete')}</button>
    </>
  );

  return (
    <div className="uinv uinv-overlay" onClick={e => e.target === e.currentTarget && close()}>
      <style>{UINV_CSS}</style>
      <div className="uinv-panel" role="dialog" aria-modal="true">
        <div className="uinv-head">
          <h1>📦 {T('title')} · {aptDisplay(listing.apt, lang)}</h1>
          <button type="button" className="uinv-x" onClick={close} aria-label={T('close')}>✕</button>
        </div>
        <div className="uinv-tabs">
          <button type="button" className={`uinv-tab${tab === 'items' ? ' uinv-tab-on' : ''}`} onClick={() => setTab('items')}>{T('tabItems')}</button>
          <button type="button" className={`uinv-tab${tab === 'history' ? ' uinv-tab-on' : ''}`} onClick={() => setTab('history')}>{T('tabHistory')}</button>
        </div>

        {tab === 'history' && <HistoryList events={history} lang={lang} />}

        {tab === 'items' && items === null && <p className="uinv-sub">{T('loading')}</p>}
        {tab === 'items' && items !== null && (
          <>
            <div className="uinv-box">
              <div className="uinv-row" style={{ justifyContent: 'space-between' }}>
                <h2>🔗 {T('linkTitle')}</h2>
                {link && <span className={`uinv-badge ${link.enabled ? 'uinv-badge-on' : 'uinv-badge-off'}`}>{T(link.enabled ? 'linkOnBadge' : 'linkOffBadge')}</span>}
              </div>
              {!link && (
                <>
                  <p className="uinv-help">{T('linkHelp')}</p>
                  <button type="button" className="uinv-btn" disabled={busy} onClick={() => linkAction('enable')}>{T('linkCreate')}</button>
                </>
              )}
              {link && !link.enabled && (
                <div className="uinv-row" style={{ marginTop: 8 }}>
                  <span className="uinv-help" style={{ margin: 0, flex: '1 1 160px' }}>{T('linkOff')}</span>
                  <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => linkAction('enable')}>{T('linkEnable')}</button>
                </div>
              )}
              {link && link.enabled && (
                <>
                  <div className="uinv-row" style={{ marginTop: 8 }}>
                    {canShare && <button type="button" className="uinv-btn uinv-btn-sm uinv-btn-p" onClick={shareLink}>{T('linkShare')}</button>}
                    <button type="button" className="uinv-btn uinv-btn-sm" onClick={copyLink}>{copied ? T('linkCopied') : T('linkCopy')}</button>
                    <button type="button" className="uinv-btn uinv-btn-sm" aria-expanded={linkOptions} onClick={() => setLinkOptions(v => !v)}>{T('linkOptions')} {linkOptions ? '▴' : '▾'}</button>
                  </div>
                  {linkOptions && (
                    <div style={{ marginTop: 8 }}>
                      <p className="uinv-help">{T('linkHelp')}</p>
                      <input className="uinv-link" readOnly value={linkUrl} onFocus={e => e.target.select()} aria-label={T('linkTitle')} />
                      <div className="uinv-row" style={{ marginTop: 8 }}>
                        <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => linkAction('disable')}>{T('linkDisable')}</button>
                        <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => linkAction('regenerate')}>{T('linkRegenerate')}</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="uinv-row" style={{ marginBottom: 10 }}>
              <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={() => openForm({ ...EMPTY_FORM })}>{T('addItem')}</button>
              <button type="button" className="uinv-btn" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>{T('importCsv')}</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onCsvChosen} />
              {drifted.length > 0 && (
                <button type="button" className="uinv-btn uinv-btn-warn" disabled={busy} title={T('rebaselineHint')} onClick={() => rebaseline(null)}>
                  {T('rebaselineAll', { n: drifted.length })}
                </button>
              )}
            </div>

            {importState && (
              <div className="uinv-box" ref={importRef}>
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
                  <button type="button" className="uinv-btn uinv-btn-p" disabled={busy || !importState.items.length || importState.problems.length > 0} onClick={confirmImport}>
                    {T('importConfirm', { n: importState.items.length })}
                  </button>
                  <button type="button" className="uinv-btn" disabled={busy} onClick={() => setImportState(null)}>{T('cancel')}</button>
                </div>
              </div>
            )}

            {form && (
              <div className="uinv-box" ref={formRef}>
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
                    : <label className="uinv-field">{T('startCount')}<input className="uinv-num" inputMode="numeric" pattern="[0-9]*" value={form.count} onFocus={e => e.target.select()} onChange={e => setForm({ ...form, count: e.target.value })} /></label>}
                </div>
                <div className="uinv-row" style={{ marginTop: 10 }}>
                  <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={saveForm}>{busy ? T('saving') : T('save')}</button>
                  <button type="button" className="uinv-btn" disabled={busy} onClick={() => setForm(null)}>{T('close')}</button>
                </div>
              </div>
            )}

            {list.length === 0 && <div className="uinv-box"><strong>{T('empty')}</strong><p className="uinv-help">{T('emptyHint')}</p></div>}
            {list.length > 0 && (
              <>
                <input className="uinv-input" type="search" value={search} placeholder={T('search')} enterKeyHint="search" onChange={e => setSearch(e.target.value)} />
                <DiffSummary lang={lang} total={list.length} tally={tally} onlyChanged={onlyChanged} onToggle={() => setOnlyChanged(v => !v)} />
                {shown.length === 0 && <p className="uinv-sub" style={{ marginTop: 12 }}>{T('noMatches')}</p>}
                {/* A search or the changed-only filter opens every area it leaves. */}
                <ItemList items={shown} lang={lang} folding={folding} forceOpen={!!needle || narrowing} busy={busy} expectedLabel={T('baseline')}
                  valueOf={typed} diffOf={diffOf} isDirty={isDirty} onChange={setTyped} actionsFor={actionsFor} />
              </>
            )}

            {dirtyItems.length > 0 && (
              <div className="uinv-bar">
                <button type="button" className="uinv-btn" disabled={busy} onClick={() => setDraft({})}>{T('cancel')}</button>
                <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={saveCounts}>{busy ? T('saving') : T('saveCounts', { n: dirtyItems.length })}</button>
              </div>
            )}
          </>
        )}

        <Toast msg={msg} raised={tab === 'items' && dirtyItems.length > 0} lang={lang} onDismiss={() => setMsg(null)} />
      </div>
    </div>
  );
}
