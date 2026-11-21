// SharedInventoryView — the cleaning service's page, reached from the
// unit's share link (/?inventory=<token>) with no login. Shows the unit's
// items by area with the expected (baseline) count, and lets the person
// correct the count and leave a note per item. Nothing else: no adding,
// deleting, history or owner details — the server's /shared routes don't
// offer them. Something found that isn't on the list can be proposed; it
// joins the inventory only if the owner approves it. Damage can be
// reported with photos, and finishing the count asks about it first.
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
import { tr, parseCountInput, diffFromBaseline, tallyDiffs, groupByArea, API_BASE } from "../strings";
import { DiffSummary } from "../components/DiffMarks";
import { ItemList, Toast, ViewSwitch, FilterBar, useAreaFolding } from "../components/ItemList";
import { CountComplete, LastCheckLine } from "../components/CountComplete";
import { ProposeItemForm, PendingProposals } from "../components/Proposals";
import { DamageForm, DamageList } from "../components/Damages";
import { ItemPhotos, ProofPhotos } from "../components/Photos";
import { VideoRecorder, formatDuration, formatMb, MAX_VIDEO_SECONDS } from "../components/Video";
import { UINV_CSS } from "../styles";

const NAME_KEY = 'kai_inventory_name';
// This page's own language choice. Deliberately not the app's `kai_lang`:
// an owner who uses the app in English and opens the link on the same
// phone must not turn the cleaning service's page English.
const LANG_KEY = 'kai_inventory_lang';
const DRAFT_KEY = 'kai_inventory_draft:';
// Unsaved counts older than this are dropped rather than restored: the
// unit has likely been counted again since.
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const readStored = (key) => { try { return localStorage.getItem(key) || ''; } catch (_e) { return ''; } };
const writeStored = (key, value) => { try { localStorage.setItem(key, value); } catch (_e) { /* ignore */ } };
const dropStored = (key) => { try { localStorage.removeItem(key); } catch (_e) { /* ignore */ } };

// Spanish unless the person has switched this page to English before.
// The phone's own language is not consulted: the people who count work
// in Spanish, whatever their phone is set to.
const initialLang = () => (readStored(LANG_KEY) === 'en' ? 'en' : 'es-CO');

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
  const [proposing, setProposing] = useState(false);
  // The damage form: null when closed, else { preset } — the item it was
  // opened from, if any. `seq` remounts it for each opening.
  const [damaging, setDamaging] = useState(null);
  // Which items to list: null until the person picks, which means "the
  // ones to count at every checkout, if the owner flagged any".
  const [view, setView] = useState(null);
  const folding = useAreaFolding();
  const nameRef = useRef(null);
  // Set once the first load has put any restored draft in place; until
  // then the empty starting draft must not overwrite the stored one.
  const hydrated = useRef(false);

  const load = async () => {
    const d = await api.get(base);
    const items = d.items || [];
    setState({ kind: 'ready', unit: d.unit || {}, items, lastCheck: d.lastCheck || null, proposals: d.proposals || [], damages: d.damages || [],
      // Whether the server takes item photos (optional), and how many each
      // item already has from this visit.
      proofEnabled: d.proofEnabled === true, proofCounts: d.proofCounts || {},
      // Whether a video of the apartment is required to finish, and this
      // visit's video(s).
      videoRequired: d.videoRequired === true, videos: d.videos || [] });
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

  const { unit, items, lastCheck, proposals, damages, proofEnabled, proofCounts, videoRequired, videos } = state;
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

  // Everything sent from this page carries the person's name. False,
  // with the name box brought into view, when it hasn't been filled in.
  const haveName = () => {
    if (name.trim()) return true;
    setMsg({ err: true, text: T('nameNeeded') });
    // The name box is at the top, usually far off screen by now.
    if (nameRef.current) { nameRef.current.scrollIntoView({ block: 'center' }); nameRef.current.focus({ preventScroll: true }); }
    return false;
  };
  // The unsaved counts as the server takes them, or null (with the
  // reason shown) when the name is missing or a count isn't a number.
  const pendingUpdates = () => {
    if (!haveName()) return null;
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
  // Marks the count as complete, saving anything unsaved with it. The
  // Count complete box has already asked about damage by the time this
  // runs; the server attaches this visit's damage reports to the record.
  const complete = () => {
    const updates = pendingUpdates();
    return updates ? send('checks', { updates }, T('countDoneSaved')) : undefined;
  };
  // Sends a damage report (with its photos) to the owner. Unsaved counts
  // are left as they are.
  const reportDamage = async (damage) => {
    if (!haveName()) return false;
    setBusy(true); setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      const d = await api.post(`${base}/damages`, { name: name.trim(), damage });
      setState(prev => ({ ...prev, damages: [d.damage, ...(prev.damages || [])] }));
      setMsg({ text: T('damageSent') });
      return true;
    } catch (e) {
      setMsg({ err: true, text: e?.message || String(e) });
      return false;
    } finally { setBusy(false); }
  };
  // The owner's photos of an item, to recognise it by. View only here.
  const photoStore = { load: async (it) => (await api.get(`${base}/items/${encodeURIComponent(it.id)}/photos`)).photos || [] };
  const photosFor = (it) => (it.photoCount > 0
    ? <ItemPhotos lang={lang} item={it} store={photoStore} showLabel="photosShowRef" onCount={() => {}} onError={e => setMsg({ err: true, text: e?.message || String(e) })} />
    : null);

  // Item photos, taken at this checkout: optional, offered on the ★ items
  // and on any item that is off its count or has a note — the missing or
  // damaged ones a photo helps most with. Saved as each is taken.
  const proofUrl = (it) => `${base}/items/${encodeURIComponent(it.id)}/proof`;
  const proofStore = {
    load: async (it) => (await api.get(proofUrl(it))).photos || [],
    add: (it, data) => api.post(proofUrl(it), { name: name.trim(), photo: data }),
    remove: (it, photo) => api.del(`${proofUrl(it)}/${encodeURIComponent(photo.id)}`, {}),
  };
  const setProofCount = (it, n) => setState(prev => ({ ...prev, proofCounts: { ...prev.proofCounts, [it.id]: n } }));
  // Remounted after each completed count, so the next visit starts empty.
  const proofFor = (it) => (proofEnabled && (it.countRequired || diffOf(it) !== 0 || !!typed(it).note || (proofCounts[it.id] || 0) > 0)
    ? <ProofPhotos key={`${it.id}:${lastCheck ? lastCheck.id : ''}`} lang={lang} item={it} count={proofCounts[it.id] || 0} store={proofStore}
        onCount={setProofCount} onError={e => setMsg({ err: true, text: e?.message || String(e) })} />
    : null);

  // The checkout video: required to finish when the server asks for it.
  const videosUrl = `${base}/videos`;
  const videoStart = (meta) => api.post(videosUrl, { name: name.trim(), ...meta });
  const videoFinish = async (id) => (await api.post(`${videosUrl}/${encodeURIComponent(id)}/done`, {})).video;
  const videoUploaded = (video) => {
    writeStored(NAME_KEY, name.trim());
    setState(prev => ({ ...prev, videos: [...(prev.videos || []), video] }));
    setMsg({ text: T('videoSent') });
  };
  const removeVideo = async (video) => {
    if (!window.confirm(T('videoDeleteConfirm'))) return;
    try {
      await api.del(`${videosUrl}/${encodeURIComponent(video.id)}`, {});
      setState(prev => ({ ...prev, videos: (prev.videos || []).filter(v => v.id !== video.id) }));
    } catch (e) { setMsg({ err: true, text: e?.message || String(e) }); }
  };
  const videoDone = !videoRequired || videos.length > 0;
  // True when the video is in (or not asked for). Otherwise says so and
  // takes the person to the video box.
  const haveVideo = () => {
    if (videoDone) return true;
    setMsg({ err: true, text: T('videoMissing') });
    const el = document.getElementById('uinv-video');
    if (el) el.scrollIntoView({ block: 'start' });
    return false;
  };
  const openDamage = (preset) => setDamaging({ preset: preset || null, seq: Date.now() });
  // Sends an item that isn't on the list to the owner for approval.
  // Unsaved counts are left as they are: this doesn't touch the list.
  const propose = async (item) => {
    if (!haveName()) return false;
    setBusy(true); setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      const d = await api.post(`${base}/proposals`, { name: name.trim(), item });
      setState(prev => ({ ...prev, proposals: [...(prev.proposals || []), d.proposal] }));
      setMsg({ text: T('proposeSent') });
      return true;
    } catch (e) {
      setMsg({ err: true, text: e?.message || String(e) });
      return false;
    } finally { setBusy(false); }
  };
  const discard = () => {
    if (window.confirm(T('discardConfirm', { n: dirtyItems.length }))) { setDraft({}); setMsg(null); }
  };

  const requiredItems = items.filter(it => it.countRequired);
  const showing = requiredItems.length ? (view || 'required') : 'all';
  // A search looks through everything in the unit, whichever view is on.
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? items.filter(it => `${it.nameEn} ${it.nameEs} ${it.areaEn} ${it.areaEs}`.toLowerCase().includes(needle))
    : (showing === 'required' ? requiredItems : items);

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
      <div className="uinv-box uinv-task">
        <h2>{T('taskTitle')}</h2>
        <ol>
          <li>
            <strong>{requiredItems.length ? T('taskCountReq', { n: requiredItems.length }) : T('taskCountAll', { n: items.length })}</strong>
            <small>{T('taskCountHow')}{proofEnabled ? ` ${T('taskPhotoOptional')}` : ''}</small>
          </li>
          <li><strong>{T('taskDamage')}</strong></li>
          {videoRequired && (
            <li>
              <strong>{T('taskVideo')}</strong>
              <div className={`uinv-progress${videoDone ? ' uinv-progress-done' : ''}`}>{T(videoDone ? 'taskVideoDone' : 'taskVideoPending')}</div>
            </li>
          )}
          <li><strong>{T('taskFinish')}</strong></li>
        </ol>
      </div>

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
          <FilterBar lang={lang} search={search} onSearch={setSearch} required={requiredItems.length} view={showing} onView={setView} />
          <DiffSummary lang={lang} total={items.length} tally={tallyDiffs(items, diffOf)} shared />
          <LastCheckLine lang={lang} lastCheck={lastCheck} />
          <ViewSwitch lang={lang} view={showing} onChange={setView} required={requiredItems.length} total={items.length} hint={T('reqHintShared')} />
          {visible.length === 0 && <p className="uinv-sub" style={{ marginTop: 12 }}>{T('noMatches')}</p>}
          {/* A search opens every area that has a match, whatever was folded. */}
          <ItemList items={visible} lang={lang} folding={folding} forceOpen={!!needle} busy={busy} expectedLabel={T('expected')}
            valueOf={typed} diffOf={diffOf} isDirty={isDirty} onChange={setTyped} moreLabel={T('addNote')} photosFor={photosFor} proofFor={proofFor}
            actionsFor={it => <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => openDamage(it)}>{T('damageBtnItem')}</button>} />
        </>
      )}

      {proposing
        ? <ProposeItemForm lang={lang} areas={groupByArea(items, lang).filter(g => g.areaEn || g.areaEs)} busy={busy} onSend={propose} onCancel={() => setProposing(false)} />
        : <div className="uinv-action"><button type="button" className="uinv-btn uinv-propose-open" disabled={busy} onClick={() => setProposing(true)}>{T('proposeBtn')}</button></div>}
      <PendingProposals lang={lang} proposals={proposals} />

      {damaging
        ? <DamageForm key={damaging.seq} lang={lang} areas={groupByArea(items, lang).filter(g => g.areaEn || g.areaEs)} preset={damaging.preset} busy={busy} onSend={reportDamage} onCancel={() => setDamaging(null)} />
        : <div className="uinv-action"><button type="button" className="uinv-btn uinv-btn-danger uinv-propose-open" disabled={busy} onClick={() => openDamage(null)}>{T('damageBtn')}</button></div>}
      <DamageList lang={lang} title={T('damagesVisit', { n: damages.length })} damages={damages} />

      {videoRequired && (
        <div className="uinv-box uinv-video" id="uinv-video">
          <h2>{T('videoTitle')}</h2>
          <p className="uinv-help">{T('videoHelp', { n: MAX_VIDEO_SECONDS / 60 })}</p>
          {videos.map(v => (
            <div key={v.id} className="uinv-video-done">
              <span>{T('videoUploaded', { dur: formatDuration(v.durationSeconds), mb: formatMb(v.sizeBytes) })}</span>
              <button type="button" className="uinv-btn uinv-btn-sm" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => removeVideo(v)}>{T('videoDelete')}</button>
            </div>
          ))}
          {/* Remounted after each completed count, so the next visit starts fresh. */}
          {videos.length === 0 && (
            <VideoRecorder key={lastCheck ? lastCheck.id : 'first'} lang={lang} canBegin={haveName}
              start={videoStart} finish={videoFinish} onUploaded={videoUploaded} />
          )}
        </div>
      )}

      {items.length > 0 && (
        <CountComplete lang={lang} unsaved={dirtyItems.length} busy={busy} onComplete={complete}
          canStart={() => pendingUpdates() !== null && haveVideo()}
          damagePrompt={{
            covers: (requiredItems.length
              ? T('finishCoversReq', { n: requiredItems.length })
              : T('finishCoversAll', { n: items.length })) + (videoRequired ? ` ${T('finishVideo')}` : ''),
            reported: damages.length,
            onReport: () => openDamage(null),
          }} />
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
