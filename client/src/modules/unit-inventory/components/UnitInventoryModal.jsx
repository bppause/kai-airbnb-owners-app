// UnitInventoryModal — the owner's inventory screen for one unit, opened
// from My Units. Lists the items by area with their baseline and current
// counts, and is the only place items are added, edited, deleted,
// imported from CSV, or re-baselined. Also manages the no-login link the
// cleaning service counts through, and shows the dated report of each
// checkout (counts and damage) and the change history.
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
import { tr, primaryText, secondaryText, formatWhen, parseCountInput, diffFromBaseline, tallyDiffs, checkSummary, noteForViewer, groupByArea, API_BASE } from "../strings";
import { DiffSummary } from "./DiffMarks";
import { ItemList, Toast, ViewSwitch, FilterBar, useAreaFolding, areaKey } from "./ItemList";
import { CountComplete, LastCheckLine } from "./CountComplete";
import { PendingProposals } from "./Proposals";
import { DamageList } from "./Damages";
import { ItemPhotos, PhotoPicker, PhotoButton, MAX_ITEM_PHOTOS } from "./Photos";
import { useAutoTranslate } from "./autoTranslate";
import { AreaNameForm, AreaOrganizer } from "./AreaOrganizer";
import CheckoutReports from "./Reports";
import { FunctionCheckEditor } from "./FunctionChecks";
import { itemsFromCsv } from "../csv";
import { UINV_CSS } from "../styles";

// The descriptive fields of an item. Each is also the key of its label in
// strings.js and of its entry in an edit event's changes. `editFields`
// puts the viewer's language first in each pair.
const FIELD_MAX = { area: 120, name: 300, note: 1000 };
const editFields = (lang) => {
  const [first, second] = String(lang || '').toLowerCase().startsWith('en') ? ['En', 'Es'] : ['Es', 'En'];
  return ['area', 'name', 'note'].flatMap(f => [f + first, f + second]);
};

const EMPTY_FORM = { areaEn: '', areaEs: '', nameEn: '', nameEs: '', noteEn: '', noteEs: '', count: '1', countRequired: false };

const actorLabel = (lang, type, name) => `${tr(lang, type === 'cleaner' ? 'actorCleaner' : 'actorOwner')}${name ? ` · ${name}` : ''}`;

// `history` is { events, checks }: item changes and completed counts,
// shown together in one timeline, newest first.
function HistoryList({ history, lang }) {
  if (history === null) return <p className="uinv-sub">{tr(lang, 'loading')}</p>;
  const entries = [
    ...history.events.map(ev => ({ at: ev.createdAt, ev })),
    ...history.checks.map(check => ({ at: check.createdAt, check })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!entries.length) return <p className="uinv-sub">{tr(lang, 'histEmpty')}</p>;
  return (
    <div>
      {entries.map(({ ev, check }) => {
        if (check) {
          return (
            <div key={check.id} className="uinv-hist uinv-hist-check">
              <div className="uinv-name">{tr(lang, 'histCheck')}</div>
              <div>{checkSummary(lang, check)}</div>
              <div className="uinv-hist-when">{formatWhen(check.createdAt, lang)} · {actorLabel(lang, check.actorType, check.actorName)}</div>
            </div>
          );
        }
        const lines = [];
        if (ev.type === 'created') {
          // An item the cleaning service proposed names who asked for it.
          const line = tr(lang, 'histCreated', { n: ev.countAfter });
          const proposedBy = ev.changes && ev.changes.proposedBy;
          lines.push(proposedBy ? tr(lang, 'histProposedBy', { line, who: proposedBy }) : line);
        }
        if (ev.type === 'deleted') lines.push(tr(lang, 'histDeleted', { n: ev.countBefore, b: ev.baselineBefore }));
        if (ev.type === 'edited') {
          // One line per field the edit changed, labelled as in the form.
          const changed = editFields(lang).filter(f => ev.changes && ev.changes[f]);
          if (!changed.length) lines.push(tr(lang, 'histEdited'));
          for (const f of changed) lines.push(tr(lang, 'histField', { field: tr(lang, f), a: ev.changes[f].before, b: ev.changes[f].after }));
        }
        if (ev.type === 'rebaseline') lines.push(tr(lang, 'histRebaseline', { a: ev.baselineBefore, b: ev.baselineAfter }));
        if (ev.type === 'count') {
          if (ev.countBefore !== ev.countAfter) lines.push(tr(lang, 'histCount', { a: ev.countBefore, b: ev.countAfter }));
          if (ev.noteBefore !== ev.noteAfter) lines.push(tr(lang, 'histNote', { a: ev.noteBefore, b: ev.noteAfter }));
        }
        const actor = actorLabel(lang, ev.actorType, ev.actorName);
        const other = secondaryText(lang, ev.itemNameEn, ev.itemNameEs);
        return (
          <div key={ev.id} className="uinv-hist">
            <div className="uinv-name">{primaryText(lang, ev.itemNameEn, ev.itemNameEs)}</div>
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
  const [lastCheck, setLastCheck] = useState(null);
  // Items the cleaning service proposed that still wait for a decision.
  const [proposals, setProposals] = useState([]);
  // Damage reports the owner hasn't marked resolved.
  const [openDamages, setOpenDamages] = useState([]);
  // The working checks the cleaning service answers at each visit; null
  // when the database doesn't have them yet. `fnEditing` shows the editor.
  const [fnChecks, setFnChecks] = useState([]);
  const [fnEditing, setFnEditing] = useState(false);
  // Counts and notes as typed, keyed by item id, until saved.
  const [draft, setDraft] = useState({});
  const [tab, setTab] = useState('items');
  const [form, setForm] = useState(null);
  // Whether the server can translate between the two languages.
  const [canTranslate, setCanTranslate] = useState(false);
  // The item to show again once the form closes (saved or not): the one
  // being edited or duplicated, or the copy just made. Set with a fresh
  // object each time so the same item can be returned to twice.
  const [returnTo, setReturnTo] = useState(null);
  // The item flashed after returning to it, briefly.
  const [flash, setFlash] = useState(null);
  // Photos picked in the add-item form, sent once the item exists.
  const [formPhotos, setFormPhotos] = useState([]);
  const [importState, setImportState] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [linkOptions, setLinkOptions] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [search, setSearch] = useState('');
  // 'all' or 'required' (only the items counted at every checkout).
  const [view, setView] = useState('all');
  const folding = useAreaFolding();
  const fileRef = useRef(null);
  const formRef = useRef(null);
  const importRef = useRef(null);

  const load = async () => {
    const d = await api.get(`${unitBase}?ownerUid=${encodeURIComponent(user.uid)}`);
    setItems(d.items || []);
    setLink(d.link || null);
    setLastCheck(d.lastCheck || null);
    setProposals(d.proposals || []);
    setOpenDamages(d.openDamages || []);
    setCanTranslate(!!d.translate);
    setFnChecks(d.functionChecks === undefined ? [] : d.functionChecks);
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
      .then(d => setHistory({ events: d.events || [], checks: d.checks || [] }))
      .catch(e => { setHistory({ events: [], checks: [] }); setMsg({ err: true, text: e?.message || String(e) }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // The add/edit form and the import preview open above the list, which
  // may be far from where Edit was tapped — bring them into view (at
  // once: an animated scroll across a couple of hundred items drags).
  const formOpen = !!form;
  const formItemId = form ? form.id || form.copyOf || '' : '';
  useEffect(() => {
    if (formOpen && formRef.current) formRef.current.scrollIntoView({ block: 'start' });
  }, [formOpen, formItemId]);
  const importOpen = !!importState;
  useEffect(() => {
    if (importOpen && importRef.current) importRef.current.scrollIntoView({ block: 'start' });
  }, [importOpen]);

  // Back to the item after the form closes: scroll it to the middle of the
  // screen and flash it so it is easy to spot among the others. Waits
  // for the reload, since a renamed or copied item may move. An item a
  // search or filter now hides is simply not scrolled to.
  useEffect(() => {
    if (!returnTo || form) return undefined;
    const el = document.getElementById(`uinv-item-${returnTo.id}`);
    if (!el) return undefined;
    el.scrollIntoView({ block: 'center' });
    setFlash({ id: returnTo.id });
    setReturnTo(null);
    return undefined;
  }, [returnTo, form, items]);
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

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
  const requiredCount = list.filter(it => it.countRequired).length;
  const showing = requiredCount ? view : 'all';
  // A search looks through everything in the unit, whichever view is on.
  const needle = search.trim().toLowerCase();
  const shown = list
    .filter(it => !narrowing || diffOf(it) !== 0 || isDirty(it))
    .filter(it => (needle
      ? `${it.nameEn} ${it.nameEs} ${it.areaEn} ${it.areaEs}`.toLowerCase().includes(needle)
      : showing === 'all' || it.countRequired));
  const setTyped = (it, field, value) => {
    if (msg && msg.err) setMsg(null);
    // A note typed back to what is saved is no longer an edit.
    setDraft(prev => ({ ...prev, [it.id]: { ...typed(it), [field]: value, ...(field === 'note' ? { noteEdited: value !== baseNote(it) } : {}) } }));
  };

  const close = () => {
    if (dirtyItems.length && !window.confirm(T('unsavedClose', { n: dirtyItems.length }))) return;
    onClose();
  };

  // The unsaved counts as the server takes them, or null (with the
  // reason shown) when one of them isn't a number.
  const pendingUpdates = () => {
    const updates = [];
    for (const it of dirtyItems) {
      const count = parseCountInput(draft[it.id].count);
      if (count == null) { setMsg({ err: true, text: T('countInvalid') }); return null; }
      updates.push({ itemId: it.id, count, ...(noteChanged(it) ? { note: draft[it.id].note } : {}) });
    }
    return updates;
  };
  const saveCounts = () => {
    const updates = pendingUpdates();
    if (!updates) return;
    run(async () => {
      await api.post(`${unitBase}/counts`, { ...who, lang, updates });
      setDraft({});
      await load();
    }, T('saved'));
  };
  // Marks the whole unit as counted, saving anything unsaved with it.
  const completeCount = () => {
    const updates = pendingUpdates();
    const sure = requiredCount ? T('countDoneConfirmReq', { n: requiredCount }) : T('countDoneConfirm', { n: list.length });
    if (!updates || !window.confirm(sure)) return;
    run(async () => {
      await api.post(`${unitBase}/checks`, { ...who, lang, updates });
      setDraft({});
      await load();
    }, T('countDoneSaved'));
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

  // Flags one item, or a whole area, as counted at every checkout. Shown
  // at once and sent behind it — flagging runs to dozens of taps on a
  // new inventory — and put right from the server if the save fails.
  const setRequired = (targets, required) => {
    const ids = targets.filter(it => !!it.countRequired !== required).map(it => it.id);
    if (!ids.length) return;
    const moved = new Set(ids);
    setItems(prev => (prev || []).map(it => (moved.has(it.id) ? { ...it, countRequired: required } : it)));
    api.post(`${unitBase}/required`, { ...who, itemIds: ids, required })
      .catch(e => { setMsg({ err: true, text: e?.message || String(e) }); return load().catch(() => {}); });
  };

  const removeItem = (it) => {
    if (!window.confirm(T('deleteConfirm', { name: primaryText(lang, it.nameEn, it.nameEs) }))) return;
    run(async () => {
      await api.del(`${API_BASE}/items/${encodeURIComponent(it.id)}`, who);
      setDraft(prev => { const next = { ...prev }; delete next[it.id]; return next; });
      await load();
    });
  };

  // Approving adds the proposed item to the list with its count as the
  // baseline; rejecting only closes the proposal.
  const decide = (proposal, action) => {
    const name = primaryText(lang, proposal.nameEn, proposal.nameEs);
    if (action === 'reject' && !window.confirm(T('rejectConfirm', { name }))) return;
    run(async () => {
      await api.post(`${API_BASE}/proposals/${encodeURIComponent(proposal.id)}/decision`, { ...who, action });
      if (action === 'approve') folding.open(areaKey(proposal.areaEn, proposal.areaEs));
      await load();
    }, T(action === 'approve' ? 'approvedMsg' : 'rejectedMsg'));
  };
  const proposalActions = (p) => (
    <>
      <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={() => decide(p, 'approve')}>{T('approve')}</button>
      <button type="button" className="uinv-btn uinv-btn-danger" disabled={busy} onClick={() => decide(p, 'reject')}>{T('reject')}</button>
    </>
  );

  // Lists don't carry photos: one report's are fetched when asked for.
  const loadDamagePhotos = async (damage) => {
    const d = await api.get(`${unitBase}/damages/${encodeURIComponent(damage.id)}?ownerUid=${encodeURIComponent(user.uid)}`);
    return (d.damage && d.damage.photos) || [];
  };
  const resolveDamage = (damage) => run(async () => {
    await api.post(`${API_BASE}/damages/${encodeURIComponent(damage.id)}/status`, { ...who, status: 'resolved' });
    await load();
  }, T('damageResolvedMsg'));

  // The owner types the area, description and note in their own language
  // (the app's language setting); the other language is translated from
  // it and shown read-only (see autoTranslate.js). Without translation, or
  // when a translation fails, both stay editable.
  const ownSuffix = String(lang || '').toLowerCase().startsWith('en') ? 'En' : 'Es';
  const otherSuffix = ownSuffix === 'En' ? 'Es' : 'En';
  const translator = useAutoTranslate({
    enabled: canTranslate,
    translate: async (text, to, field) => (await api.post(`${unitBase}/translate`, { ...who, text, to, field })).text,
    setField: (field, value) => setForm(prev => (prev ? { ...prev, [field]: value } : prev)),
    knownArea: (field, text) => {
      const other = field === 'areaEn' ? 'areaEs' : 'areaEn';
      const hit = (items || []).find(it => it[field].trim().toLowerCase() === text.toLowerCase() && it[other]);
      return hit ? hit[other] : null;
    },
  });
  const editField = (field, value) => {
    setForm(prev => (prev ? { ...prev, [field]: value } : prev));
    translator.onOwnerEdit(field, value);
  };

  const isReadOnly = (field) => canTranslate && field.endsWith(otherSuffix)
    && !(translator.status[field] && translator.status[field].state === 'failed');

  // The unit's areas, for the item form's Area list and renaming.
  const areaGroups = groupByArea(items || [], lang).filter(g => g.areaEn || g.areaEs);
  const sameArea = (a, b) => (a.areaEn || '').trim().toLowerCase() === (b.areaEn || '').trim().toLowerCase()
    && (a.areaEs || '').trim().toLowerCase() === (b.areaEs || '').trim().toLowerCase();

  // Renaming / combining areas and moving items between them (see
  // AreaOrganizer.jsx). `renamingKey` is the area whose own bar has its
  // rename form open; `organizing` shows the "Organize areas" panel.
  const [renamingKey, setRenamingKey] = useState(null);
  const [organizing, setOrganizing] = useState(false);
  const translateText = async (text, to, field) => (await api.post(`${unitBase}/translate`, { ...who, text, to, field })).text;
  const knownAreaName = (field, text) => {
    const other = field === 'areaEn' ? 'areaEs' : 'areaEn';
    const hit = (items || []).find(it => it[field].trim().toLowerCase() === text.toLowerCase() && it[other]);
    return hit ? hit[other] : null;
  };
  const saveFunctions = async (checks) => {
    setBusy(true); setMsg(null);
    try {
      const d = await api.put(`${unitBase}/functions`, { ...who, checks });
      setFnChecks(d.checks || []);
      setMsg({ text: T('fnSaved') });
      return true;
    } catch (e) { setMsg({ err: true, text: e?.message || String(e) }); return false; } finally { setBusy(false); }
  };
  // Both return true once saved (the forms then close).
  const renameArea = async (group, to) => {
    setBusy(true); setMsg(null);
    try {
      const d = await api.post(`${unitBase}/areas/rename`, { ...who, fromEn: group.areaEn, fromEs: group.areaEs, toEn: to.areaEn, toEs: to.areaEs });
      setRenamingKey(null);
      folding.open(areaKey(to.areaEn, to.areaEs));
      await load();
      setMsg({ text: T('areaRenamed', { n: d.changed || 0 }) });
      return true;
    } catch (e) { setMsg({ err: true, text: e?.message || String(e) }); return false; } finally { setBusy(false); }
  };
  const moveItems = async (itemIds, to) => {
    setBusy(true); setMsg(null);
    try {
      const d = await api.post(`${unitBase}/items/move`, { ...who, itemIds, toEn: to.areaEn, toEs: to.areaEs });
      folding.open(areaKey(to.areaEn, to.areaEs));
      await load();
      setMsg({ text: T('itemsMoved', { n: d.changed || 0 }) });
      return true;
    } catch (e) { setMsg({ err: true, text: e?.message || String(e) }); return false; } finally { setBusy(false); }
  };
  const openRename = (group) => setRenamingKey(k => (k === group.key ? null : group.key));
  const renameFor = (group) => (renamingKey === group.key ? (
    <AreaNameForm lang={lang} title={T('areaRenameTitle')} help={T('areaRenameHelp', { n: group.items.length })}
      initial={group} areas={areaGroups} excludeKey={group.key} canTranslate={canTranslate} translate={translateText} knownArea={knownAreaName}
      saveLabel={T('areaRenameSave', { n: group.items.length })} busy={busy}
      onSave={(to) => renameArea(group, to)} onCancel={() => setRenamingKey(null)} />
  ) : null);

  // The item form's Area list: an existing area, or a new one typed in.
  const areaChoice = (f) => {
    if (f.areaNew) return '__new';
    const hit = areaGroups.find(g => sameArea(g, f));
    if (hit) return hit.key;
    return (f.areaEn || f.areaEs) ? '__new' : '';
  };
  const chooseArea = (value) => {
    if (value === '__new') { setForm(prev => ({ ...prev, areaNew: true, areaEn: '', areaEs: '' })); return; }
    const g = areaGroups.find(x => x.key === value);
    setForm(prev => ({ ...prev, areaNew: false, areaEn: g ? g.areaEn : '', areaEs: g ? g.areaEs : '' }));
  };

  const openForm = (next) => {
    setImportState(null); setFormPhotos([]); setReturnTo(null); translator.reset(); setForm(next);
    // An item that only has the other language (e.g. proposed by the
    // cleaning service in Spanish) gets the owner's language filled in.
    for (const base of ['area', 'name', 'note']) {
      if (!String(next[base + ownSuffix] || '').trim() && String(next[base + otherSuffix] || '').trim()) {
        translator.fillFrom(base + otherSuffix, next[base + otherSuffix]);
      }
    }
  };
  // Closing without saving returns to the item the form was opened from.
  const closeForm = () => {
    const from = form && (form.id || form.copyOf);
    translator.reset();
    setForm(null);
    if (from) setReturnTo({ id: from });
  };
  // A copy starts as the same item — area, description, note, count and
  // ★ — for the owner to change what differs (e.g. "Bath towel" → "Hand
  // towel"). Photos stay with the original.
  const duplicateItem = (it) => openForm({
    copyOf: it.id,
    areaEn: it.areaEn, areaEs: it.areaEs, nameEn: it.nameEn, nameEs: it.nameEs, noteEn: it.noteEn, noteEs: it.noteEs,
    count: String(it.baselineCount), countRequired: !!it.countRequired,
  });

  // An item's photos: read when its card opens them; added and deleted
  // by the owner. The list only knows how many each item has.
  const itemPhotosUrl = (it) => `${unitBase}/items/${encodeURIComponent(it.id)}/photos`;
  const photoStore = {
    load: async (it) => (await api.get(`${itemPhotosUrl(it)}?ownerUid=${encodeURIComponent(user.uid)}`)).photos || [],
    loadFirst: async (it) => (await api.get(`${itemPhotosUrl(it)}?ownerUid=${encodeURIComponent(user.uid)}&first=1`)).photos || [],
    add: (it, data) => api.post(itemPhotosUrl(it), { ...who, photo: data }),
    remove: (it, photo) => api.del(`${itemPhotosUrl(it)}/${encodeURIComponent(photo.id)}`, who),
  };
  const setPhotoCount = (it, n) => setItems(prev => (prev || []).map(x => (x.id === it.id ? { ...x, photoCount: n } : x)));
  const photosFor = (it) => <ItemPhotos lang={lang} item={it} store={photoStore} onCount={setPhotoCount} noFirstAdd onError={e => setMsg({ err: true, text: e?.message || String(e) })} />;
  // The card's own 📷 button, always in view (even folded on a phone): an
  // example photo of the item, saved to it straight away.
  const addPhotoQuick = async (it, data) => {
    try {
      const d = await photoStore.add(it, data);
      setPhotoCount(it, d.photoCount);
      setMsg({ text: T('photoQuickSaved') });
    } catch (e) { setMsg({ err: true, text: e?.message || String(e) }); }
  };
  const photoButtonFor = (it) => ((it.photoCount || 0) < MAX_ITEM_PHOTOS
    ? <PhotoButton lang={lang} room={1} busyLabel={T('photoAdding')} label={T('photoQuick')} menuAlign="right" className="uinv-btn uinv-btn-sm uinv-photo-quick"
        ariaLabel={T('photoQuickAria', { name: primaryText(lang, it.nameEn, it.nameEs) })}
        onPhoto={data => addPhotoQuick(it, data)} onError={() => setMsg({ err: true, text: T('damagePhotoBad') })} />
    : null);

  const formState = form;
  const saveForm = async () => {
    // A translation still on its way is part of what is being saved.
    let form = formState;
    if (translator.waiting()) {
      setBusy(true);
      await translator.flush();
      setBusy(false);
    }
    form = { ...form, ...translator.applied() };
    if (!form.nameEn.trim() && !form.nameEs.trim()) { setMsg({ err: true, text: T('nameRequired') }); return; }
    // Show the item where it lands, even if its area was folded.
    const landsIn = areaKey(form.areaEn.trim(), form.areaEs.trim());
    if (form.id) {
      run(async () => {
        await api.put(`${API_BASE}/items/${encodeURIComponent(form.id)}`, { ...who, ...form });
        translator.reset();
        setForm(null);
        folding.open(landsIn);
        await load();
        setReturnTo({ id: form.id });
      }, T('saved'));
      return;
    }
    const count = parseCountInput(form.count);
    if (count == null) { setMsg({ err: true, text: T('countInvalid') }); return; }
    const { copyOf, ...fields } = form;
    run(async () => {
      const d = await api.post(`${unitBase}/items`, { ...who, items: [{ ...fields, count }] });
      // The item exists now; its photos follow. A photo that fails does
      // not undo the item — the owner is told and can add it again.
      const made = d.items && d.items[0];
      let photoProblem = '';
      for (const p of (made ? formPhotos : [])) {
        try { await photoStore.add(made, p.data); } catch (e) { photoProblem = e?.message || String(e); }
      }
      translator.reset();
      if (copyOf) {
        // A copy is done once saved: close and show it in the list.
        setForm(null);
      } else {
        // Keep the area filled in: items are usually added a room at a time.
        setForm({ ...EMPTY_FORM, areaEn: form.areaEn, areaEs: form.areaEs, countRequired: form.countRequired });
      }
      setFormPhotos([]);
      folding.open(landsIn);
      await load();
      if (copyOf) setReturnTo({ id: made ? made.id : copyOf });
      if (photoProblem) throw new Error(T('photoSomeFailed', { why: photoProblem }));
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
  // The message goes to the cleaning service, so it is in Spanish
  // whatever language the owner uses the app in.
  const shareLink = async () => {
    try { await navigator.share({ title: tr('es-CO', 'title'), text: tr('es-CO', 'linkShareText', { apt: listing.apt || '' }), url: linkUrl }); }
    catch (_e) { /* the person closed the share sheet */ }
  };

  const fieldOrder = editFields(lang);
  const areaOptions = (field) => Array.from(new Set(list.map(it => it[field]).filter(Boolean)));

  const actionsFor = (it) => (
    <>
      {it.baselineCount !== it.currentCount && (
        <button type="button" className="uinv-btn uinv-btn-sm uinv-btn-warn" disabled={busy} title={T('rebaselineHint')} onClick={() => rebaseline([it.id])}>{T('rebaselineOne')}</button>
      )}
      <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy}
        onClick={() => openForm({ id: it.id, areaEn: it.areaEn, areaEs: it.areaEs, nameEn: it.nameEn, nameEs: it.nameEs, noteEn: it.noteEn, noteEs: it.noteEs, count: '' })}>✏️ {T('edit')}</button>
      <button type="button" className="uinv-btn uinv-btn-sm" disabled={busy} title={T('duplicateHint')} onClick={() => duplicateItem(it)}>⧉ {T('duplicate')}</button>
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
          <button type="button" className={`uinv-tab${tab === 'reports' ? ' uinv-tab-on' : ''}`} onClick={() => setTab('reports')}>{T('tabReports')}</button>
          <button type="button" className={`uinv-tab${tab === 'history' ? ' uinv-tab-on' : ''}`} onClick={() => setTab('history')}>{T('tabHistory')}</button>
        </div>

        {tab === 'reports' && <CheckoutReports lang={lang} unitBase={unitBase} ownerUid={user.uid} unitName={aptDisplay(listing.apt, lang)} onError={e => setMsg({ err: true, text: e?.message || String(e) })} />}
        {tab === 'history' && <HistoryList history={history} lang={lang} />}

        {tab === 'items' && items === null && <p className="uinv-sub">{T('loading')}</p>}
        {tab === 'items' && items !== null && (
          <>
            <PendingProposals lang={lang} proposals={proposals} owner actionsFor={proposalActions} />
            <DamageList lang={lang} title={T('damagesOpen', { n: openDamages.length })} damages={openDamages} loadPhotos={loadDamagePhotos}
              actionsFor={d => <button type="button" className="uinv-btn" disabled={busy} onClick={() => resolveDamage(d)}>{T('damageResolve')}</button>} />

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
              {areaGroups.length > 0 && (
                <button type="button" className="uinv-btn" aria-pressed={organizing} disabled={busy} onClick={() => setOrganizing(v => !v)}>{T('orgOpen')}</button>
              )}
              <button type="button" className="uinv-btn" aria-pressed={fnEditing} disabled={busy}
                onClick={() => (fnChecks === null ? setMsg({ err: true, text: T('fnNeedsUpdate') }) : setFnEditing(v => !v))}>
                {T('fnOpen', { n: (fnChecks || []).length })}
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onCsvChosen} />
              {drifted.length > 0 && (
                <button type="button" className="uinv-btn uinv-btn-warn" disabled={busy} title={T('rebaselineHint')} onClick={() => rebaseline(null)}>
                  {T('rebaselineAll', { n: drifted.length })}
                </button>
              )}
            </div>

            {fnEditing && fnChecks !== null && (
              <FunctionCheckEditor lang={lang} checks={fnChecks} items={list} busy={busy} canTranslate={canTranslate} translate={translateText}
                onSave={saveFunctions} onClose={() => setFnEditing(false)} />
            )}

            {organizing && (
              <AreaOrganizer lang={lang} items={list} busy={busy} canTranslate={canTranslate} translate={translateText} knownArea={knownAreaName}
                onRename={renameArea} onMove={moveItems} onClose={() => setOrganizing(false)} />
            )}

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
                <h2 style={{ marginBottom: 8 }}>{form.id ? T('formEdit') : T(form.copyOf ? 'formDuplicate' : 'formAdd')}</h2>
                {form.copyOf && <p className="uinv-help">{T('formDuplicateHelp')}</p>}
                {canTranslate && <p className="uinv-help">{T('formTranslateHelp', { own: T('lang' + ownSuffix), other: T('lang' + otherSuffix) })}</p>}
                <div className="uinv-form">
                  <datalist id="uinv-areas-en">{areaOptions('areaEn').map(a => <option key={a} value={a} />)}</datalist>
                  <datalist id="uinv-areas-es">{areaOptions('areaEs').map(a => <option key={a} value={a} />)}</datalist>
                  {areaGroups.length > 0 && (
                    <label className="uinv-field uinv-full">{T('areaPick')}
                      <select className="uinv-select" value={areaChoice(form)} onChange={e => chooseArea(e.target.value)}>
                        {areaChoice(form) === '' && <option value="">{T('areaPickChoose')}</option>}
                        {areaGroups.map(g => <option key={g.key} value={g.key}>{g.other ? `${g.label} · ${g.other}` : g.label}</option>)}
                        <option value="__new">{T('areaPickNew')}</option>
                      </select>
                    </label>
                  )}
                  {/* Each pair asks for the owner's language first. The area
                      is typed only for a new one (or when there are none). */}
                  {fieldOrder.filter(field => !field.startsWith('area') || areaGroups.length === 0 || areaChoice(form) === '__new').map(field => {
                    const ro = isReadOnly(field);
                    const st = translator.status[field];
                    // A read-only translation says where it comes from unless
                    // it is being translated right now.
                    const note = st && (st.state !== 'auto' || !ro)
                      ? { cls: st.state, text: T(`tr_${st.state}`, { why: st.why || '' }) }
                      : (ro ? { cls: 'ro', text: T('trReadonly', { from: T('lang' + ownSuffix) }) } : null);
                    return (
                      <label key={field} className="uinv-field">{T(field)}
                        <input value={form[field]} maxLength={FIELD_MAX[field.slice(0, 4)]}
                          list={!ro && field.startsWith('area') ? `uinv-areas-${field.slice(4).toLowerCase()}` : undefined}
                          readOnly={ro} aria-readonly={ro || undefined} className={ro ? 'uinv-ro' : undefined}
                          tabIndex={ro ? -1 : undefined}
                          onChange={e => { if (!ro) editField(field, e.target.value); }} />
                        {note && <span className={`uinv-tr uinv-tr-${note.cls}`} role="status">{note.text}</span>}
                      </label>
                    );
                  })}
                  {form.id && (() => {
                    const editing = (items || []).find(x => x.id === form.id);
                    return editing ? (
                      <div className="uinv-field uinv-full">{T('formPhotos', { n: MAX_ITEM_PHOTOS })}
                        <span className="uinv-help" style={{ margin: 0, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>{T('formPhotosHelp')}</span>
                        <ItemPhotos lang={lang} item={editing} store={photoStore} onCount={setPhotoCount} alwaysOpen onError={e => setMsg({ err: true, text: e?.message || String(e) })} />
                      </div>
                    ) : null;
                  })()}
                  {form.id
                    ? <p className="uinv-help uinv-full">{T('baselineLocked')}</p>
                    : (
                      <>
                        <label className="uinv-field">{T('startCount')}<input className="uinv-num" inputMode="numeric" pattern="[0-9]*" value={form.count} onFocus={e => e.target.select()} onChange={e => setForm({ ...form, count: e.target.value })} /></label>
                        <label className="uinv-check"><input type="checkbox" checked={!!form.countRequired} onChange={e => setForm({ ...form, countRequired: e.target.checked })} />{T('formRequired')}</label>
                        <div className="uinv-field uinv-full">{T('formPhotos', { n: MAX_ITEM_PHOTOS })}
                          <span className="uinv-help" style={{ margin: 0, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>{T('formPhotosHelp')}</span>
                          <PhotoPicker lang={lang} photos={formPhotos} onChange={setFormPhotos} max={MAX_ITEM_PHOTOS} disabled={busy} />
                        </div>
                      </>
                    )}
                </div>
                <div className="uinv-row" style={{ marginTop: 10 }}>
                  <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={saveForm}>{busy ? T('saving') : T('save')}</button>
                  <button type="button" className="uinv-btn" disabled={busy} onClick={closeForm}>{T('close')}</button>
                </div>
              </div>
            )}

            {list.length === 0 && <div className="uinv-box"><strong>{T('empty')}</strong><p className="uinv-help">{T('emptyHint')}</p></div>}
            {list.length > 0 && (
              <>
                <FilterBar lang={lang} search={search} onSearch={setSearch} required={requiredCount} view={showing} onView={setView} />
                <DiffSummary lang={lang} total={list.length} tally={tally} onlyChanged={onlyChanged} onToggle={() => setOnlyChanged(v => !v)} />
                <LastCheckLine lang={lang} lastCheck={lastCheck} />
                {requiredCount > 0
                  ? <ViewSwitch lang={lang} view={showing} onChange={setView} required={requiredCount} total={list.length} hint={T('reqHintOwner')} />
                  : <p className="uinv-help" style={{ marginTop: 10 }}>{T('reqHintOwner')}</p>}
                {shown.length === 0 && <p className="uinv-sub" style={{ marginTop: 12 }}>{T('noMatches')}</p>}
                {/* A search or the changed-only filter opens every area it leaves. */}
                <ItemList items={shown} lang={lang} folding={folding} forceOpen={!!needle || narrowing} busy={busy} expectedLabel={T('baseline')}
                  valueOf={typed} diffOf={diffOf} isDirty={isDirty} onChange={setTyped} actionsFor={actionsFor} onRequired={setRequired} photosFor={photosFor} flashId={flash ? flash.id : null} headActionFor={photoButtonFor}
                  onRenameArea={openRename} areaExtra={renameFor} />
                <CountComplete lang={lang} unsaved={dirtyItems.length} busy={busy} onComplete={completeCount} />
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
