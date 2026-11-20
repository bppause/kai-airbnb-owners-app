// SharedInventoryView — the cleaning service's page, reached from the
// unit's share link (/?inventory=<token>) with no login. Shows the unit's
// items by area with the expected (baseline) count, and lets the person
// correct the count and leave a note per item. Nothing else: no adding,
// deleting, history or owner details — the server's /shared routes don't
// offer them.
//
// Rendered by main.jsx instead of the app, so it carries its own styles
// and language switch and must not use useApp() or anything else that
// needs the app shell. Built for a phone held in one hand: big steppers,
// one sticky Save button.

import React, { useEffect, useState } from "react";
import { api } from "../../../core/api";
import { tr, pick, pickOther, groupByArea, formatWhen, parseCountInput, diffFromBaseline, diffClass, tallyDiffs, API_BASE } from "../strings";
import { DiffBadge, DiffSummary } from "../components/DiffMarks";
import { UINV_CSS } from "../styles";

const NAME_KEY = 'kai_inventory_name';
const LANG_KEY = 'kai_lang';

const readStored = (key) => { try { return localStorage.getItem(key) || ''; } catch (_e) { return ''; } };
const writeStored = (key, value) => { try { localStorage.setItem(key, value); } catch (_e) { /* ignore */ } };

const initialLang = () => {
  const saved = readStored(LANG_KEY);
  if (saved) return saved.startsWith('en') ? 'en' : 'es-CO';
  return String(navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es-CO';
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
  const [collapsed, setCollapsed] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const d = await api.get(base);
    setState({ kind: 'ready', unit: d.unit || {}, items: d.items || [] });
  };
  useEffect(() => {
    load().catch(e => setState({ kind: 'error', notFound: e?.status === 404, text: e?.message || String(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const { unit, items } = state;
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
    setMsg(null);
    setDraft(prev => ({ ...prev, [it.id]: { ...typed(it), [field]: value } }));
  };
  const step = (it, delta) => {
    const current = parseCountInput(typed(it).count);
    setTyped(it, 'count', String(Math.max(0, (current == null ? it.currentCount : current) + delta)));
  };

  const save = async () => {
    if (!name.trim()) { setMsg({ err: true, text: T('nameNeeded') }); return; }
    const updates = [];
    for (const it of dirtyItems) {
      const count = parseCountInput(draft[it.id].count);
      if (count == null) { setMsg({ err: true, text: T('countInvalid') }); return; }
      updates.push({ itemId: it.id, count, note: draft[it.id].note });
    }
    setBusy(true); setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      await api.post(`${base}/counts`, { name: name.trim(), updates });
      setDraft({});
      await load();
      setMsg({ text: T('sharedSaved') });
    } catch (e) {
      setMsg({ err: true, text: e?.message || String(e) });
    } finally { setBusy(false); }
  };

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? items.filter(it => `${it.nameEn} ${it.nameEs} ${it.areaEn} ${it.areaEs}`.toLowerCase().includes(needle))
    : items;

  return shell(
    <>
      <div className="uinv-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
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
          <input value={name} maxLength={120} onChange={e => { setName(e.target.value); setMsg(null); }} />
        </label>
        <p className="uinv-help" style={{ marginBottom: 0 }}>{T('yourNameHint')}</p>
      </div>

      <input className="uinv-input" type="search" value={search} placeholder={T('search')} onChange={e => setSearch(e.target.value)} />

      {msg && <div className={`uinv-msg ${msg.err ? 'uinv-msg-err' : 'uinv-msg-ok'}`} style={{ marginTop: 10 }}>{msg.text}</div>}
      {items.length === 0 && <p className="uinv-sub" style={{ marginTop: 12 }}>{T('empty')}</p>}
      {items.length > 0 && <DiffSummary lang={lang} total={items.length} tally={tallyDiffs(items, diffOf)} shared />}
      {items.length > 0 && visible.length === 0 && <p className="uinv-sub" style={{ marginTop: 12 }}>{T('noMatches')}</p>}

      {groupByArea(visible, lang).map(group => {
        // A search opens every area that has a match, whatever was folded.
        const folded = !needle && collapsed[group.key];
        const areaChanged = tallyDiffs(group.items, diffOf).changed;
        return (
          <div key={group.key}>
            <div className="uinv-area" onClick={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}>
              <h2>{folded ? '▸' : '▾'} {group.label}</h2>
              <small>{T('itemsInArea', { n: group.items.length })}</small>
              {areaChanged > 0 && <span className="uinv-badge uinv-badge-chg">{T('areaChanged', { n: areaChanged })}</span>}
            </div>
            {!folded && group.items.map(it => {
              const v = typed(it);
              const other = pickOther(lang, it.nameEn, it.nameEs);
              const ownerNote = pick(lang, it.noteEn, it.noteEs);
              const diff = diffOf(it);
              return (
                <div key={it.id} className={`uinv-item${diffClass(diff)}${isDirty(it) ? ' uinv-item-dirty' : ''}`}>
                  <div>
                    <div className="uinv-name">{pick(lang, it.nameEn, it.nameEs)} <DiffBadge diff={diff} lang={lang} /></div>
                    {other && <div className="uinv-other">{other}</div>}
                    {ownerNote && <div className="uinv-onote">{ownerNote}</div>}
                  </div>
                  <div className="uinv-fields">
                    <div className="uinv-field">{T('expected')}<div className="uinv-base">{it.baselineCount}</div></div>
                    <div className="uinv-field">{T('count')}
                      <div className="uinv-step">
                        <button type="button" disabled={busy} onClick={() => step(it, -1)} aria-label="−1">−</button>
                        <input className="uinv-num" inputMode="numeric" value={v.count} disabled={busy} onChange={e => setTyped(it, 'count', e.target.value)} aria-label={T('count')} />
                        <button type="button" disabled={busy} onClick={() => step(it, 1)} aria-label="+1">+</button>
                      </div>
                    </div>
                  </div>
                  <label className="uinv-field">{T('note')}
                    <input value={v.note} maxLength={1000} disabled={busy} placeholder={T('notePlaceholder')} onChange={e => setTyped(it, 'note', e.target.value)} />
                  </label>
                  {it.countUpdatedAt && (
                    <div className="uinv-meta">{T('lastCounted', { when: formatWhen(it.countUpdatedAt, lang), who: it.countUpdatedBy })}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {items.length > 0 && (
        <div className="uinv-bar">
          <button className="uinv-btn uinv-btn-p" disabled={busy || !dirtyItems.length} onClick={save}>
            {busy ? T('saving') : dirtyItems.length ? T('saveCounts', { n: dirtyItems.length }) : T('nothingToSave')}
          </button>
        </div>
      )}
    </>
  );
}
