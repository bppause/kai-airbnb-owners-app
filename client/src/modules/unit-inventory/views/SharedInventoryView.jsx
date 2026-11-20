// SharedInventoryView — the cleaning service's page, reached from the
// unit's share link (/?inventory=<token>) with no login. Shows the unit's
// items by area with the expected (baseline) count, and lets the person
// correct the count and leave a note per item. Nothing else: no adding,
// deleting, history or owner details — the server's /shared routes don't
// offer them.
//
// Rendered by main.jsx instead of the app, so it carries its own styles
// and language switch and must not use useApp() or anything else that
// needs the app shell.
//
// This page is used on a phone, standing in the apartment, usually in
// one long pass. So: counts that haven't been saved are kept in the
// browser and restored if the page is reloaded or the phone drops the
// tab; messages appear pinned at the bottom, where they are seen however
// far the list is scrolled; and the Save button only appears when there
// is something to save.

import React, { useEffect, useRef, useState } from "react";
import { api } from "../../../core/api";
import { tr, parseCountInput, diffFromBaseline, tallyDiffs, API_BASE } from "../strings";
import { DiffSummary } from "../components/DiffMarks";
import { ItemList, Toast, useAreaFolding } from "../components/ItemList";
import { CountComplete, LastCheckLine } from "../components/CountComplete";
import { UINV_CSS } from "../styles";

const NAME_KEY = 'kai_inventory_name';
const LANG_KEY = 'kai_lang';
const DRAFT_KEY = 'kai_inventory_draft:';
// Unsaved counts older than this are dropped rather than restored: the
// unit has likely been counted again since.
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const readStored = (key) => { try { return localStorage.getItem(key) || ''; } catch (_e) { return ''; } };
const writeStored = (key, value) => { try { localStorage.setItem(key, value); } catch (_e) { /* ignore */ } };
const dropStored = (key) => { try { localStorage.removeItem(key); } catch (_e) { /* ignore */ } };

const initialLang = () => {
  const saved = readStored(LANG_KEY);
  if (saved) return saved.startsWith('en') ? 'en' : 'es-CO';
  return String(navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es-CO';
};

// The unsaved counts kept for this link, limited to items that still
// exist and still differ from what the server has.
const restoreDraft = (token, items) => {
  let stored;
  try { stored = JSON.parse(readStored(DRAFT_KEY + token) || 'null'); } catch (_e) { stored = null; }
  if (!stored || !stored.draft || Date.now() - Date.parse(stored.at) > DRAFT_MAX_AGE_MS) return {};
  const kept = {};
  for (const it of items) {
    const v = stored.draft[it.id];
    if (!v || typeof v.count !== 'string' || typeof v.note !== 'string') continue;
    if (v.count !== String(it.currentCount) || v.note !== it.currentNote) kept[it.id] = { count: v.count, note: v.note };
  }
  return kept;
};

export default function SharedInventoryView({ token }) {
  const [lang, setLang] = useState(initialLang);
  const T = (k, v) => tr(lang, k, v);
  const base = `${API_BASE}/shared/${encodeURIComponent(token)}`;

  const [state, setState] = useState({ kind: 'loading' });
  // Counts and notes as typed, keyed by item id, until saved.
  const [draft, setDraft] = useState({});
  const [name, setName] = useState(() => readStored(NAME_KEY));
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const folding = useAreaFolding();
  const nameRef = useRef(null);
  // Set once the first load has put any restored draft in place; until
  // then the empty starting draft must not overwrite the stored one.
  const hydrated = useRef(false);

  const load = async () => {
    const d = await api.get(base);
    const items = d.items || [];
    setState({ kind: 'ready', unit: d.unit || {}, items, lastCheck: d.lastCheck || null });
    folding.decide(items.length);
    return items;
  };
  useEffect(() => {
    load().then(items => {
      const kept = restoreDraft(token, items);
      const n = Object.keys(kept).length;
      hydrated.current = true;
      if (n) { setDraft(kept); setMsg({ text: tr(lang, 'draftRestored', { n }) }); }
    }).catch(e => setState({ kind: 'error', notFound: e?.status === 404, text: e?.message || String(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep unsaved counts in the browser as they are typed.
  useEffect(() => {
    if (!hydrated.current) return;
    if (Object.keys(draft).length) writeStored(DRAFT_KEY + token, JSON.stringify({ at: new Date().toISOString(), draft }));
    else dropStored(DRAFT_KEY + token);
  }, [draft, token]);

  // A success message clears itself; an error stays until dismissed.
  useEffect(() => {
    if (!msg || msg.err) return undefined;
    const id = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(id);
  }, [msg]);

  const changeLang = (next) => { setLang(next); writeStored(LANG_KEY, next); };

  const shell = (children) => (
    <div className="uinv uinv-page">
      {/* The app's global stylesheet isn't loaded on this page, so the
          browser's default body margin is reset here. */}
      <style>{`body{margin:0;background:#f7f3e9}${UINV_CSS}`}</style>
      <div className="uinv-page-inner">{children}</div>
    </div>
  );

  if (state.kind === 'loading') return shell(<p className="uinv-sub">{T('loading')}</p>);
  if (state.kind === 'error') {
    return shell(<div className="uinv-msg uinv-msg-err">{state.notFound ? T('linkInactive') : state.text}</div>);
  }

  const { unit, items, lastCheck } = state;
  const typed = (it) => draft[it.id] || { count: String(it.currentCount), note: it.currentNote };
  const isDirty = (it) => {
    const v = draft[it.id];
    return !!v && (v.count !== String(it.currentCount) || v.note !== it.currentNote);
  };
  const dirtyItems = items.filter(isDirty);
  // Judged by the count as typed, so a row lights up as soon as its
  // number leaves the expected one.
  const diffOf = (it) => diffFromBaseline(it, draft[it.id]?.count);
  const setTyped = (it, field, value) => {
    if (msg && msg.err) setMsg(null);
    setDraft(prev => ({ ...prev, [it.id]: { ...typed(it), [field]: value } }));
  };

  // The unsaved counts as the server takes them, or null (with the
  // reason shown) when the name is missing or a count isn't a number.
  const pendingUpdates = () => {
    if (!name.trim()) {
      setMsg({ err: true, text: T('nameNeeded') });
      // The name box is at the top, usually far off screen by now.
      if (nameRef.current) { nameRef.current.scrollIntoView({ block: 'center' }); nameRef.current.focus({ preventScroll: true }); }
      return null;
    }
    const updates = [];
    for (const it of dirtyItems) {
      const count = parseCountInput(draft[it.id].count);
      if (count == null) { setMsg({ err: true, text: T('countInvalid') }); return null; }
      updates.push({ itemId: it.id, count, note: draft[it.id].note });
    }
    return updates;
  };
  const send = async (path, body, okText) => {
    setBusy(true); setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      await api.post(`${base}/${path}`, { name: name.trim(), ...body });
      setDraft({});
      await load();
      setMsg({ text: okText });
    } catch (e) {
      setMsg({ err: true, text: e?.message || String(e) });
    } finally { setBusy(false); }
  };
  const save = () => {
    const updates = pendingUpdates();
    if (updates) send('counts', { updates }, T('sharedSaved'));
  };
  // Marks the whole unit as counted, saving anything unsaved with it.
  const complete = () => {
    const updates = pendingUpdates();
    if (!updates || !window.confirm(T('countDoneConfirm', { n: items.length }))) return;
    send('checks', { updates }, T('countDoneSaved'));
  };
  const discard = () => {
    if (window.confirm(T('discardConfirm', { n: dirtyItems.length }))) { setDraft({}); setMsg(null); }
  };

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? items.filter(it => `${it.nameEn} ${it.nameEs} ${it.areaEn} ${it.areaEs}`.toLowerCase().includes(needle))
    : items;

  return shell(
    <>
      <div className="uinv-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1>📦 {T('title')}</h1>
          <p className="uinv-sub">{[unit.tower, `${T('apt')} ${unit.apt || ''}`].filter(Boolean).join(' · ')}</p>
        </div>
        <select className="uinv-lang" value={lang} onChange={e => changeLang(e.target.value)} aria-label="Idioma / Language">
          <option value="es-CO">Español</option>
          <option value="en">English</option>
        </select>
      </div>
      <p className="uinv-sub">{T('sharedSubtitle')}</p>

      <div className="uinv-box">
        <label className="uinv-field">{T('yourName')}
          <input ref={nameRef} value={name} maxLength={120} autoComplete="name" autoCapitalize="words" enterKeyHint="done"
            onChange={e => { setName(e.target.value); if (msg && msg.err) setMsg(null); }} />
        </label>
        <p className="uinv-help" style={{ marginBottom: 0 }}>{T('yourNameHint')}</p>
      </div>

      {items.length === 0 && <p className="uinv-sub" style={{ marginTop: 12 }}>{T('empty')}</p>}
      {items.length > 0 && (
        <>
          <input className="uinv-input" type="search" value={search} placeholder={T('search')} enterKeyHint="search" onChange={e => setSearch(e.target.value)} />
          <DiffSummary lang={lang} total={items.length} tally={tallyDiffs(items, diffOf)} shared />
          <LastCheckLine lang={lang} lastCheck={lastCheck} />
          {visible.length === 0 && <p className="uinv-sub" style={{ marginTop: 12 }}>{T('noMatches')}</p>}
          {/* A search opens every area that has a match, whatever was folded. */}
          <ItemList items={visible} lang={lang} folding={folding} forceOpen={!!needle} busy={busy} expectedLabel={T('expected')}
            valueOf={typed} diffOf={diffOf} isDirty={isDirty} onChange={setTyped} />
          <CountComplete lang={lang} unsaved={dirtyItems.length} busy={busy} onComplete={complete} />
        </>
      )}

      <Toast msg={msg} raised={dirtyItems.length > 0} lang={lang} onDismiss={() => setMsg(null)} />

      {dirtyItems.length > 0 && (
        <div className="uinv-bar">
          <button type="button" className="uinv-btn" disabled={busy} onClick={discard}>{T('discard')}</button>
          <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={save}>
            {busy ? T('saving') : T('saveCounts', { n: dirtyItems.length })}
          </button>
        </div>
      )}
    </>
  );
}
