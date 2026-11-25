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
import { ItemList, Toast, ViewSwitch, FilterBar, useAreaFolding, areaKey } from "../components/ItemList";
import { CountComplete, LastCheckLine } from "../components/CountComplete";
import { ProposeItemForm, PendingProposals } from "../components/Proposals";
import { DamageForm, DamageList } from "../components/Damages";
import { ItemPhotos, ProofPhotos } from "../components/Photos";
import { VideoRecorder, formatDuration, formatMb, MAX_VIDEO_SECONDS } from "../components/Video";
import { CleanerIntro, CleanerHelp } from "../components/CleanerHelp";
import { FunctionCheckList } from "../components/FunctionChecks";
import { CleanerTasks } from "../components/OwnerService";
import CheckoutReports from "../components/Reports";
import { HistoryList } from "../components/History";
import { UINV_CSS } from "../styles";

const NAME_KEY = 'kai_inventory_name';
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
  // Areas whose every item is shown in the ★ view ("Ver todos los
  // artículos" by the area's button), by key. Off by default.
  const [shownAreas, setShownAreas] = useState(() => new Set());
  const toggleShownArea = (key) => setShownAreas(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
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
  // The history section: closed (''), 'reports' or 'changes'; and the
  // changes once fetched.
  const [histTab, setHistTab] = useState('');
  const [history, setHistory] = useState(null);
  // Fetched when "Todos los cambios" is open, and again after a count is
  // completed (it adds to the history).
  const lastCheckId = state.lastCheck ? state.lastCheck.id : '';
  useEffect(() => { setHistory(null); }, [lastCheckId]);
  useEffect(() => {
    if (histTab !== 'changes' || history !== null) return undefined;
    let live = true;
    api.get(`${base}/history`).then(d => { if (live) setHistory({ events: d.events || [], checks: d.checks || [] }); })
      .catch(e => { if (live) { setHistory({ events: [], checks: [] }); setMsg({ err: true, text: e?.message || String(e) }); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histTab, history]);
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
      functionChecks: d.functionChecks || [], functionAnswers: d.functionAnswers || {}, functionProofCounts: d.functionProofCounts || {},
      // A personal link's person ({ name }) or null; every open damage
      // report; how the owner closed recent ones; the owner's notes.
      person: d.person || null, openDamages: d.openDamages || [], damageNews: d.damageNews || [], tasks: d.tasks || [],
      // Confirmations of ★ items made since then belong to this visit.
      ackSince: d.ackSince || '',
      // Areas the owner let off confirming; every other must be.
      areasExempt: d.areasExempt || [] });
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

  const { unit, items, lastCheck, proposals, damages, proofEnabled, proofCounts, videoRequired, videos, suggestEnabled, functionChecks, functionAnswers, person, openDamages, damageNews, tasks, functionProofCounts, ackSince, areasExempt } = state;
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
  // A working check's photos: the owner's examples, and the ones taken now.
  const fnUrl = (s, part) => `${base}/functions/${encodeURIComponent(s.id.slice(3))}/${part}`;
  const fnPhotos = {
    load: async (s) => (await api.get(fnUrl(s, 'photos'))).photos || [],
    loadFirst: async (s) => (await api.get(`${fnUrl(s, 'photos')}?first=1`)).photos || [],
    proofLoad: async (s) => (await api.get(fnUrl(s, 'proof'))).photos || [],
    proofAdd: (s, data) => { if (!haveName()) return Promise.reject(new Error(T('nameNeeded'))); writeStored(NAME_KEY, name.trim()); return api.post(fnUrl(s, 'proof'), { name: name.trim(), photo: data }); },
    proofRemove: (s, photo) => api.del(`${fnUrl(s, 'proof')}/${encodeURIComponent(photo.id)}`, {}),
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
  // The owner's notes: answered done (with an optional word) or
  // couldn't-do (with the reason), or the answer taken back.
  const toggleTask = async (task, action, note) => {
    if (!haveName()) return false;
    setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      const body = action === 'undo' ? { done: false } : action === 'blocked' ? { blocked: true, note } : { done: true, note };
      const d = await api.post(`${base}/tasks/${encodeURIComponent(task.id)}`, { name: name.trim(), ...body });
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
  // ★ items: each must be confirmed this visit — counted and checked for
  // damage or missing — before the count can be finished. Confirming
  // saves the count (and note) as typed with it.
  const isAcked = (it) => !!it.checkedAt && (!ackSince || it.checkedAt >= ackSince);
  const unacked = items.filter(it => it.countRequired && !isAcked(it));
  const confirmItems = async (list, undo = false) => {
    if (!haveName()) return false;
    const payload = [];
    for (const { it, count } of list) {
      if (undo) { payload.push({ itemId: it.id }); continue; }
      // No count given: confirmed as it stands (nothing changed on it).
      const n = count === undefined ? undefined : parseCountInput(count);
      if (count !== undefined && n == null) { setMsg({ err: true, text: T('countInvalid') }); return false; }
      payload.push({ itemId: it.id, ...(n !== undefined ? { count: n } : {}), ...(noteChanged(it) ? { note: draft[it.id].note } : {}) });
    }
    setBusy(true); setMsg(null);
    try {
      writeStored(NAME_KEY, name.trim());
      const d = await api.post(`${base}/acks`, { name: name.trim(), lang, items: payload, ...(undo ? { undo: true } : {}) });
      const fresh = new Map((d.items || []).map(r => [r.id, r]));
      setState(prev => ({ ...prev, items: prev.items.map(r => fresh.get(r.id) || r) }));
      if (!undo) setDraft(prev => { const next = { ...prev }; for (const { it } of list) delete next[it.id]; return next; });
      return true;
    } catch (e) {
      setMsg({ err: true, text: e?.message || String(e) });
      return false;
    } finally { setBusy(false); }
  };
  const goToItem = (it) => {
    const k = areaKey(it.areaEn, it.areaEs);
    folding.open(k);
    setTimeout(() => { const el = document.getElementById(`uinv-item-${it.id}`); if (el) el.scrollIntoView({ block: 'center' }); }, 50);
  };
  const haveAcks = () => {
    if (!unacked.length) return true;
    setMsg({ err: true, text: T('ackMissing', { n: unacked.length }) });
    goToItem(unacked[0]);
    return false;
  };
  const ackFor = (it) => {
    if (!it.countRequired) return null;
    // Confirmed — unless the number or note was changed since: then the
    // button comes back to confirm the new one.
    if (isAcked(it) && !isDirty(it)) {
      const ok = it.checkedStatus === 'ok';
      return (
        <div className={`uinv-ack ${ok ? 'uinv-ack-ok' : 'uinv-ack-issue'}`}>
          <span>{T(ok ? 'ackDoneOk' : 'ackDoneIssue', { who: it.checkedBy })}</span>
          <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => confirmItems([{ it }], true)}>{T('taskUndo')}</button>
        </div>
      );
    }
    const allThere = diffOf(it) === 0 && !openDamageOf(it);
    return (
      <div className="uinv-ack">
        <button type="button" className={`uinv-btn uinv-ack-btn${allThere ? ' uinv-btn-ok' : ' uinv-btn-warn'}`} disabled={busy}
          onClick={() => confirmItems([{ it, count: typed(it).count }])}>{T(allThere ? 'ackBtnOk' : 'ackBtnIssue')}</button>
      </div>
    );
  };
  // The owner's notes still to answer; true when there are none (otherwise
  // says so and goes to them).
  const tasksLeft = tasks.filter(t => t.status === 'open');
  const haveTasks = () => {
    if (!tasksLeft.length) return true;
    setMsg({ err: true, text: T('tasksMissing', { n: tasksLeft.length }) });
    const el = document.getElementById('uinv-owner-notes');
    if (el) el.scrollIntoView({ block: 'start' });
    return false;
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
  // Every area must be confirmed at each visit ("✓ Todo bien en esta
  // área"), unless the owner let it off; confirming an area confirms all
  // its items. The ★ view shows only ★ items, but still lists such an
  // area when it has none (its heading and the button), so it can be
  // confirmed. Areas let off have no button.
  const allGroups = groupByArea(items, lang);
  const groupByKey = new Map(allGroups.map(g => [g.key, g]));
  const isExempt = (g) => areasExempt.some(x => (x.areaEn || '') === (g.areaEn || '') && (x.areaEs || '') === (g.areaEs || ''));
  const areaConfirmed = (key) => { const g = groupByKey.get(key); return !!g && g.items.every(isAcked); };
  const listGroups = allGroups.filter(g => !isExempt(g));
  const plainAreaKeys = new Set(listGroups.filter(g => !g.items.some(it => it.countRequired)).map(g => g.key));
  // A search looks through everything in the unit, whichever view is on.
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? items.filter(it => `${it.nameEn} ${it.nameEs} ${it.areaEn} ${it.areaEs}`.toLowerCase().includes(needle))
    : (showing === 'required' ? items.filter(it => it.countRequired || shownAreas.has(areaKey(it.areaEn, it.areaEs))) : items);

  const isReviewed = (key) => areaConfirmed(key);
  const nextArea = listGroups.find(g => !areaConfirmed(g.key));
  const areasLeft = listGroups.filter(g => !areaConfirmed(g.key));
  const haveAreas = () => {
    if (!areasLeft.length) return true;
    setMsg({ err: true, text: T('areasMissing', { n: areasLeft.length }) });
    goToArea(areasLeft[0].key);
    return false;
  };
  const goToArea = (key) => {
    folding.open(key);
    setTimeout(() => { const el = document.getElementById('uinv-area-' + encodeURIComponent(key)); if (el) el.scrollIntoView({ block: 'start' }); }, 0);
  };
  // Whether something in the area is off: a number typed that isn't the
  // expected one, or an open damage report.
  const areaHasIssue = (g) => g.items.some(it => (isDirty(it) && diffOf(it) !== 0) || !!openDamageOf(it)
    || (isAcked(it) && !isDirty(it) && it.checkedStatus && it.checkedStatus !== 'ok'));
  // "✓ Todo bien en esta área": everything there and undamaged — items
  // not changed take their expected count; or, when something is off,
  // "Área revisada": confirmed as typed. All the area's items (★ or not)
  // are confirmed and saved at once; the area folds with ✓ and the next
  // one to confirm opens.
  const allGood = async (shown) => {
    if (msg && msg.err) setMsg(null);
    const g = groupByKey.get(shown.key) || shown;
    const issue = areaHasIssue(g);
    // items already confirmed this visit keep their confirmation (and count)
    const todo = g.items.filter(it => isDirty(it) || !isAcked(it));
    if (!todo.length) { folding.close(g.key); return; }
    const ok = await confirmItems(todo.map(it => ({
      it, count: isDirty(it) ? typed(it).count : (issue || it.currentCount === it.baselineCount ? undefined : String(it.baselineCount)),
    })));
    if (!ok) return;
    folding.close(g.key);
    const next = listGroups.find(x => x.key !== g.key && !areaConfirmed(x.key));
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
            {requiredItems.length > 0 && (
              <div className={`uinv-progress${unacked.length ? '' : ' uinv-progress-done'}`}>{T('ackProgress', { done: requiredItems.length - unacked.length, n: requiredItems.length })}</div>
            )}
            {listGroups.length > 0 && (
              <div className="uinv-areas-progress">
                <span className={`uinv-progress${nextArea ? '' : ' uinv-progress-done'}`} style={{ margin: 0 }}>
                  {nextArea ? T('areasProgress', { done: listGroups.filter(g => isReviewed(g.key)).length, n: listGroups.length }) : T('areasAllDone')}
                </span>
                {nextArea && listGroups.some(g => areaConfirmed(g.key)) && (
                  <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => goToArea(nextArea.key)}>{T('areasContinue', { area: nextArea.label })}</button>
                )}
              </div>
            )}
          </li>
          <li>
            <strong>{T('taskDamage')}</strong>
            {requiredItems.length > 0 && <small>{T('taskDamageHow')}</small>}
          </li>
          {tasks.length > 0 && (
            <li>
              <strong>{T('taskStep', { n: tasks.length })}</strong>
              <div className={`uinv-progress${!tasksLeft.length ? ' uinv-progress-done' : ''}`}>{T('taskStepProgress', { done: tasks.length - tasksLeft.length, n: tasks.length })}</div>
            </li>
          )}
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

      {videoRequired && !videoDone && (
        <div className="uinv-box uinv-video-alert" role="note">
          <h2>{T('videoAlertTitle')}</h2>
          <p className="uinv-help" style={{ marginTop: 0 }}>{T('videoAlertBody')}</p>
          <button type="button" className="uinv-btn" onClick={() => { const el = document.getElementById('uinv-video'); if (el) el.scrollIntoView({ block: 'start' }); }}>{T('videoAlertGo')}</button>
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
            ackFor={ackFor}
            badgeFor={it => (openDamageOf(it)
              ? <span className="uinv-dmg-already" title={T('damageAlreadyAria')}>{T('damageAlready')}</span> : null)}
            areaBadge={g => (isReviewed(g.key) ? <span className="uinv-area-done">{T('areaReviewed')}</span> : null)}
            keepAreas={showing === 'required' && !needle ? plainAreaKeys : undefined} allItems={items}
            areaFooter={needle ? undefined : (g => {
              const full = groupByKey.get(g.key) || g;
              if (isExempt(full)) return null;
              if (areaConfirmed(g.key)) {
                const who = (full.items.find(it => it.checkedBy) || {}).checkedBy || '';
                return (
                  <div className="uinv-area-foot uinv-ack uinv-ack-ok">
                    <span>{T('areaDone', { who })}</span>
                    <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} onClick={() => confirmItems(full.items.map(it => ({ it })), true)}>{T('taskUndo')}</button>
                  </div>
                );
              }
              const issue = areaHasIssue(full);
              // In the ★ view: a switch to see everything that should be in
              // the area before saying it is all good (off by default).
              const canShowAll = showing === 'required' && full.items.some(it => !it.countRequired);
              const showAll = shownAreas.has(g.key);
              return (
                <div className="uinv-area-foot">
                  {plainAreaKeys.has(g.key) && showing === 'required' && <span className="uinv-meta" style={{ flex: '1 1 100%' }}>{T('areaNoStarsHint')}</span>}
                  {canShowAll && (
                    <button type="button" role="switch" aria-checked={showAll} className={`uinv-btn uinv-btn-sm uinv-area-showall${showAll ? ' uinv-on' : ''}`}
                      onClick={() => toggleShownArea(g.key)}>{T(showAll ? 'areaShowAllOn' : 'areaShowAllOff', { n: full.items.length })}</button>
                  )}
                  <button type="button" className={`uinv-btn ${issue ? 'uinv-btn-warn' : 'uinv-btn-ok'}`} disabled={busy} title={T('areaAllGoodAria', { area: g.label })}
                    onClick={() => allGood(g)}>{T(issue ? 'areaIssueBtn' : 'areaAllGood')}</button>
                </div>
              );
            })}
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
          photos={fnPhotos} proofCounts={functionProofCounts} visitKey={lastCheck ? lastCheck.id : ''}
          onProofCount={(id, n) => setState(prev => ({ ...prev, functionProofCounts: { ...prev.functionProofCounts, [id]: n } }))}
          onError={e => setMsg({ err: true, text: e?.message || String(e) })}
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
          missing={[
            ...(areasLeft.length ? [{ key: 'areas', text: T('areasMissingShort', { n: areasLeft.length }), action: T('areasMissingGo'), onAction: () => goToArea(areasLeft[0].key) }] : []),
            ...(unacked.length ? [{ key: 'acks', text: T('ackMissingShort', { n: unacked.length }), action: T('ackMissingGo'), onAction: () => goToItem(unacked[0]) }] : []),
            ...(tasksLeft.length ? [{ key: 'tasks', text: T('tasksMissingShort', { n: tasksLeft.length }), action: T('tasksMissingGo'), onAction: () => { const el = document.getElementById('uinv-owner-notes'); if (el) el.scrollIntoView({ block: 'start' }); } }] : []),
            ...(fnLeft.length ? [{ key: 'fn', text: T('fnMissingShort', { n: fnLeft.length }), action: T('fnMissingGo'), onAction: () => { const el = document.getElementById('uinv-functions'); if (el) el.scrollIntoView({ block: 'start' }); } }] : []),
            ...(!videoDone ? [{ key: 'video', text: T('videoMissingShort'), action: T('videoAlertGo'), onAction: () => { const el = document.getElementById('uinv-video'); if (el) el.scrollIntoView({ block: 'start' }); } }] : []),
          ]}
          canStart={() => pendingUpdates() !== null && haveAcks() && haveAreas() && haveTasks() && haveFunctions() && haveVideo()}
          damagePrompt={{
            covers: (requiredItems.length
              ? T('finishCoversReq', { n: requiredItems.length })
              : T('finishCoversAll', { n: items.length })) + (functionChecks.length ? ` ${T('finishFunctions', { n: functionChecks.length })}` : '') + (videoRequired ? ` ${T('finishVideo')}` : '')
              + (requiredItems.length ? ` ${T('finishAlsoUnflagged')}` : ''),
            reported: damages.length,
            onReport: () => openDamage(null),
          }} />
      )}

      {/* Looking back: every completed inventory and every change. */}
      <div className="uinv-box uinv-history" id="uinv-history">
        <h2>{T('histTitle')}</h2>
        <p className="uinv-help" style={{ marginTop: 0 }}>{T('histHelpShared')}</p>
        {!histTab ? (
          <button type="button" className="uinv-btn" onClick={() => setHistTab('reports')}>{T('histOpen')}</button>
        ) : (
          <>
            <div className="uinv-tabs">
              <button type="button" className={`uinv-tab${histTab === 'reports' ? ' uinv-tab-on' : ''}`} onClick={() => setHistTab('reports')}>{T('histTabReports')}</button>
              <button type="button" className={`uinv-tab${histTab === 'changes' ? ' uinv-tab-on' : ''}`}
                onClick={() => setHistTab('changes')}>{T('histTabChanges')}</button>
              <button type="button" className="uinv-tab" onClick={() => setHistTab('')}>{T('close')}</button>
            </div>
            {histTab === 'reports' && (
              <CheckoutReports key={lastCheck ? lastCheck.id : 'none'} lang={lang} unitBase={base} unitName={`${T('apt')} ${unit.apt || ''}`.trim()}
                onError={e => setMsg({ err: true, text: e?.message || String(e) })} />
            )}
            {histTab === 'changes' && <HistoryList history={history} lang={lang} />}
          </>
        )}
      </div>

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
