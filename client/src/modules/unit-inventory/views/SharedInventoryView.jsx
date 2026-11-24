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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../core/api";
import { tr, primaryText, parseCountInput, diffFromBaseline, tallyDiffs, groupByArea, noteForViewer, API_BASE } from "../strings";
import { DiffSummary } from "../components/DiffMarks";
import { ItemList, Toast, ViewSwitch, FilterBar, useAreaFolding } from "../components/ItemList";
import { CountComplete, LastCheckLine } from "../components/CountComplete";
import { ProposeItemForm, PendingProposals } from "../components/Proposals";
import { DamageForm, DamageList } from "../components/Damages";
import { ItemPhotos, ProofPhotos } from "../components/Photos";
import { VideoRecorder, formatDuration, formatMb, MAX_VIDEO_SECONDS } from "../components/Video";
import { CleanerIntro, CleanerHelp } from "../components/CleanerHelp";
import { FunctionCheckList } from "../components/FunctionChecks";
import { CleanerTasks } from "../components/OwnerService";
import { UINV_CSS } from "../styles";

const NAME_KEY = 'kai_inventory_name';
// The areas marked "✓ Todo bien" during the visit under way, per link.
const REVIEWED_KEY = 'kai_inventory_reviewed_';
// This page's own language choice. Deliberately not the app's `kai_lang`:
// an owner who uses the app in English and opens the link on the same
// phone must not turn the cleaning service's page English.
const LANG_KEY = 'kai_inventory_lang';
// Set once the welcome card has been closed on this phone.
const INTRO_KEY = 'kai_inventory_intro_seen';
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
    // A note counts as edited if it was marked so, or (older drafts)
    // differs from both languages of the saved note.
    const edited = v.noteEdited === true
      || (v.noteEdited === undefined && v.note !== it.currentNote && v.note !== (it.currentNoteTranslation || ''));
    if (v.count !== String(it.currentCount) || edited) kept[it.id] = { count: v.count, note: v.note, noteEdited: edited };
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
  // The areas marked "✓ Todo bien" in this visit: { visit, keys }, where
  // `visit` is the last completed count's id (a new count starts afresh).
  const [reviewed, setReviewed] = useState(() => {
    try { return JSON.parse(readStored(REVIEWED_KEY + token) || 'null') || { visit: '', keys: [] }; } catch (_e) { return { visit: '', keys: [] }; }
  });
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
      videoRequired: d.videoRequired === true, videos: d.videos || [], suggestEnabled: d.suggestEnabled === true,
      // The owner's working checks, and this visit's answers ({ [id]: { status, note, by } }).
      functionChecks: d.functionChecks || [], functionAnswers: d.functionAnswers || {},
      // A personal link's person ({ name }) or null; every open damage
      // report; how the owner closed recent ones; the owner's notes.
      person: d.person || null, openDamages: d.openDamages || [], damageNews: d.damageNews || [], tasks: d.tasks || [] });
    if (d.person && d.person.name) setName(d.person.name);
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
  // First visit on this phone: a short welcome. The full guide opens from
  // the ❓ button any time.
  const [showIntro, setShowIntro] = useState(() => !readStored(INTRO_KEY));
  const [helpOpen, setHelpOpen] = useState(false);
  const dismissIntro = () => { setShowIntro(false); writeStored(INTRO_KEY, '1'); };
  const closeHelp = useCallback(() => setHelpOpen(false), []);

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

  const { unit, items, lastCheck, proposals, damages, proofEnabled, proofCounts, videoRequired, videos, suggestEnabled, functionChecks, functionAnswers, person, openDamages, damageNews, tasks } = state;
  // The note box shows the note in this person's language (see
  // noteForViewer). Only a note they actually changed is sent back, so a
  // note merely shown in translation is never overwritten by it.
  const baseNote = (it) => noteForViewer(lang, it).text;
  const typed = (it) => {
    const d = draft[it.id];
    if (!d) return { count: String(it.currentCount), note: baseNote(it) };
    return d.noteEdited ? d : { ...d, note: baseNote(it) };
  };
  const noteChanged = (it) => { const d = draft[it.id]; return !!d && !!d.noteEdited && d.note !== baseNote(it); };
  const isDirty = (it) => {
    const v = draft[it.id];
    return !!v && (v.count !== String(it.currentCount) || noteChanged(it));
  };
  const dirtyItems = items.filter(isDirty);
  // Judged by the count as typed, so a row lights up as soon as its
  // number leaves the expected one.
  const diffOf = (it) => diffFromBaseline(it, draft[it.id]?.count);
  const setTyped = (it, field, value) => {
    if (msg && msg.err) setMsg(null);
    // A note typed back to what is saved is no longer an edit.
    setDraft(prev => ({ ...prev, [it.id]: { ...typed(it), [field]: value, ...(field === 'note' ? { noteEdited: value !== baseNote(it) } : {}) } }));
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
      updates.push({ itemId: it.id, count, ...(noteChanged(it) ? { note: draft[it.id].note } : {}) });
    }
    return updates;
  };
  const send = async (path, body, okText) => {
    setBusy(true); setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      // The page language tells the server which language notes are in.
      await api.post(`${base}/${path}`, { name: name.trim(), lang, ...body });
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
  const photoStore = {
    load: async (it) => (await api.get(`${base}/items/${encodeURIComponent(it.id)}/photos`)).photos || [],
    // Just the primary photo, shown on the card.
    loadFirst: async (it) => (await api.get(`${base}/items/${encodeURIComponent(it.id)}/photos?first=1`)).photos || [],
  };
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
  const openDamage = (preset, description) => setDamaging({ preset: preset || null, description: description || '', seq: Date.now() });
  // The owner's notes: ticked done (with an optional word) or unticked.
  const toggleTask = async (task, done, note) => {
    if (!haveName()) return false;
    setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      const d = await api.post(`${base}/tasks/${encodeURIComponent(task.id)}`, { name: name.trim(), done, note });
      setState(prev => ({ ...prev, tasks: prev.tasks.map(t => (t.id === task.id ? d.task : t)) }));
      return true;
    } catch (e) {
      setMsg({ err: true, text: e?.message || String(e) });
      return false;
    }
  };
  const openDamageOf = (it) => openDamages.find(d => d.itemId === it.id) || damages.find(d => d.itemId === it.id && d.status !== 'resolved');
  // Working checks: each answered "works" / "doesn't work" (saved at once).
  const fnLeft = functionChecks.filter(c => !functionAnswers[c.id]);
  const answerFunction = async (check, status, batteries = false) => {
    if (!haveName()) return false;
    setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      const d = await api.post(`${base}/functions/${encodeURIComponent(check.id)}`, { name: name.trim(), status, ...(batteries ? { batteries: true } : {}) });
      setState(prev => ({ ...prev, functionAnswers: { ...prev.functionAnswers, [check.id]: d.answer } }));
      return true;
    } catch (e) {
      setMsg({ err: true, text: e?.message || String(e) });
      return false;
    }
  };
  // True when every working check has an answer. Otherwise says so and
  // takes the person to the first one left.
  const haveFunctions = () => {
    if (!fnLeft.length) return true;
    setMsg({ err: true, text: T('fnMissing', { n: fnLeft.length }) });
    const el = document.getElementById('uinv-functions');
    if (el) el.scrollIntoView({ block: 'start' });
    return false;
  };
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

  // "✓ Todo bien en esta área": everything expected is there. Untouched
  // items in the area take their expected count, the area folds with a
  // ✓, and the next area still to check opens. Kept on the phone for
  // this visit, so the person can pick up where they left off.
  const visitKey = lastCheck ? lastCheck.id : 'none';
  const listGroups = groupByArea(showing === 'required' ? requiredItems : items, lang);
  const reviewedKeys = reviewed.visit === visitKey ? reviewed.keys : [];
  const isReviewed = (key) => reviewedKeys.includes(key);
  const nextArea = listGroups.find(g => !isReviewed(g.key));
  const goToArea = (key) => {
    folding.open(key);
    setTimeout(() => { const el = document.getElementById('uinv-area-' + encodeURIComponent(key)); if (el) el.scrollIntoView({ block: 'start' }); }, 0);
  };
  const allGood = (group) => {
    if (msg && msg.err) setMsg(null);
    setDraft(prev => {
      const next = { ...prev };
      for (const it of group.items) {
        if (isDirty(it) || it.currentCount === it.baselineCount) continue;
        next[it.id] = { ...typed(it), count: String(it.baselineCount) };
      }
      return next;
    });
    const keys = [...new Set([...reviewedKeys, group.key])];
    setReviewed({ visit: visitKey, keys });
    writeStored(REVIEWED_KEY + token, JSON.stringify({ visit: visitKey, keys }));
    folding.close(group.key);
    const next = listGroups.find(g => !keys.includes(g.key));
    if (next) goToArea(next.key);
  };

  return shell(
    <>
      <div className="uinv-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1>📦 {T('title')}</h1>
          <p className="uinv-sub">{[unit.tower, `${T('apt')} ${unit.apt || ''}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="uinv-head-tools">
          <button type="button" className="uinv-btn uinv-help-btn" onClick={() => setHelpOpen(true)}>{T('helpBtn')}</button>
          <select className="uinv-lang" value={lang} onChange={e => changeLang(e.target.value)} aria-label="Idioma / Language">
            <option value="es-CO">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      {showIntro && (
        <CleanerIntro lang={lang} videoRequired={videoRequired}
          onDismiss={dismissIntro} onHelp={() => { dismissIntro(); setHelpOpen(true); }} />
      )}
      {helpOpen && (
        <CleanerHelp lang={lang} required={requiredItems.length} videoRequired={videoRequired} proofEnabled={proofEnabled} functions={functionChecks.length}
          onClose={closeHelp} />
      )}
      <div className="uinv-box uinv-task">
        <h2>{T('taskTitle')}</h2>
        <ol>
          <li>
            <strong>{requiredItems.length ? T('taskCountReq', { n: requiredItems.length }) : T('taskCountAll', { n: items.length })}</strong>
            <small>{T('taskCountHow')}{proofEnabled ? ` ${T('taskPhotoOptional')}` : ''}</small>
            {listGroups.length > 1 && (
              <div className="uinv-areas-progress">
                <span className={`uinv-progress${nextArea ? '' : ' uinv-progress-done'}`} style={{ margin: 0 }}>
                  {nextArea ? T('areasProgress', { done: listGroups.filter(g => isReviewed(g.key)).length, n: listGroups.length }) : T('areasAllDone')}
                </span>
                {nextArea && reviewedKeys.length > 0 && (
                  <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => goToArea(nextArea.key)}>{T('areasContinue', { area: nextArea.label })}</button>
                )}
              </div>
            )}
          </li>
          <li>
            <strong>{T('taskDamage')}</strong>
            {requiredItems.length > 0 && <small>{T('taskDamageHow')}</small>}
          </li>
          {functionChecks.length > 0 && (
            <li>
              <strong>{T('taskFunctions', { n: functionChecks.length })}</strong>
              <div className={`uinv-progress${!fnLeft.length ? ' uinv-progress-done' : ''}`}>{T('fnProgress', { done: functionChecks.length - fnLeft.length, n: functionChecks.length })}</div>
            </li>
          )}
          {videoRequired && (
            <li>
              <strong>{T('taskVideo')}</strong>
              <div className={`uinv-progress${videoDone ? ' uinv-progress-done' : ''}`}>{T(videoDone ? 'taskVideoDone' : 'taskVideoPending')}</div>
            </li>
          )}
          <li><strong>{T('taskFinish')}</strong></li>
        </ol>
      </div>

      {person ? (
        <div className="uinv-box uinv-hello">
          <h2 style={{ margin: 0 }}>{T('sharedHello', { name: person.name })}</h2>
          <p className="uinv-help" style={{ marginBottom: 0 }}>{T('sharedHelloHint')}</p>
        </div>
      ) : (
        <div className="uinv-box">
          <label className="uinv-field">{T('yourName')}
            <input ref={nameRef} value={name} maxLength={120} autoComplete="name" autoCapitalize="words" enterKeyHint="done"
              onChange={e => { setName(e.target.value); if (msg && msg.err) setMsg(null); }} />
          </label>
          <p className="uinv-help" style={{ marginBottom: 0 }}>{T('yourNameHint')}</p>
        </div>
      )}

      <CleanerTasks lang={lang} tasks={tasks} damageNews={damageNews} items={items} busy={busy} onToggle={toggleTask} />

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
            badgeFor={it => (openDamageOf(it)
              ? <span className="uinv-dmg-already" title={T('damageAlreadyAria')}>{T('damageAlready')}</span> : null)}
            areaBadge={g => (isReviewed(g.key) ? <span className="uinv-area-done">{T('areaReviewed')}</span> : null)}
            areaFooter={needle ? undefined : (g => (
              <div className="uinv-area-foot">
                <button type="button" className="uinv-btn uinv-btn-ok" title={T('areaAllGoodAria', { area: g.label })} onClick={() => allGood(g)}>{T('areaAllGood')}</button>
              </div>
            ))}
            headActionFor={it => (
              <button type="button" className="uinv-btn uinv-btn-sm uinv-btn-danger uinv-dmg-quick" disabled={busy}
                aria-label={T('damageQuickAria', { name: primaryText(lang, it.nameEn, it.nameEs) })} onClick={() => openDamage(it)}>{T('damageQuick')}</button>
            )} />
        </>
      )}

      {proposing
        ? <ProposeItemForm lang={lang} areas={groupByArea(items, lang).filter(g => g.areaEn || g.areaEs)} busy={busy} onSend={propose} onCancel={() => setProposing(false)} />
        : <div className="uinv-action"><button type="button" className="uinv-btn uinv-propose-open" disabled={busy} onClick={() => setProposing(true)}>{T('proposeBtn')}</button></div>}
      <PendingProposals lang={lang} proposals={proposals} />

      {damaging
        ? <DamageForm key={damaging.seq} lang={lang} areas={groupByArea(items, lang)} preset={damaging.preset} presetDescription={damaging.description} openDamages={[...openDamages, ...damages.filter(d => !openDamages.some(o => o.id === d.id))]} busy={busy} onSend={reportDamage} onCancel={() => setDamaging(null)}
            loadFirst={photoStore.loadFirst}
            suggest={suggestEnabled ? (photo, description) => api.post(`${base}/damages/suggest`, { name: name.trim(), photo: photo || undefined, description }) : undefined} />
        : <div className="uinv-action"><button type="button" className="uinv-btn uinv-btn-danger uinv-propose-open" disabled={busy} onClick={() => openDamage(null)}>{T('damageBtn')}</button></div>}
      <DamageList lang={lang} title={T('damagesVisit', { n: damages.length })} damages={damages} />

      {functionChecks.length > 0 && (
        <FunctionCheckList lang={lang} checks={functionChecks} answers={functionAnswers} items={items} busy={busy} loadFirst={photoStore.loadFirst}
          onAnswer={answerFunction}
          onBroken={(check, item) => openDamage(item, T('fnFailDesc', { label: primaryText(lang, check.labelEn, check.labelEs) }))} />
      )}

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
          canStart={() => pendingUpdates() !== null && haveFunctions() && haveVideo()}
          damagePrompt={{
            covers: (requiredItems.length
              ? T('finishCoversReq', { n: requiredItems.length })
              : T('finishCoversAll', { n: items.length })) + (functionChecks.length ? ` ${T('finishFunctions', { n: functionChecks.length })}` : '') + (videoRequired ? ` ${T('finishVideo')}` : '')
              + (requiredItems.length ? ` ${T('finishAlsoUnflagged')}` : ''),
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
