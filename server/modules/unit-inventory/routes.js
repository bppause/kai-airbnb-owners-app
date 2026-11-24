// Unit inventory — HTTP routes.
//
// Mounted by server/index.js at /api/m/unit-inventory/*.
//
// A unit's inventory is the list of things that belong in the apartment
// (described in English and Spanish, grouped by area) with a count each.
// Two audiences:
//
//   Owner   — the unit's owner (listings.owner_uid). The only one who can
//             add, edit or delete items, see the change history, manage
//             the cleaning-service link, and re-baseline.
//   Cleaner — whoever holds the unit's share link. No login: the random
//             token in the link is the only credential. Can read the list,
//             update counts and notes, mark a count complete, and propose
//             an item that isn't on the list. Never adds to the list
//             directly and never deletes: an item they believe is gone is
//             counted as zero.
//
// Every item keeps two counts. `baseline_count` is what the owner says
// should be there; `current_count` is what was last counted. Counting
// never touches the baseline — only the owner's re-baseline does, by
// accepting the current counts as the new baseline. Every change to a
// count, a note or a baseline is appended to unit_inventory_events, which
// is never updated or deleted from, so the history survives item deletes.
//
// Either audience can also mark a count as complete. That writes one row
// to unit_inventory_checks — who went through the unit, when, and how it
// stood against the baseline — so a pass that found nothing changed
// still leaves a record.
//
// Not every item has to be counted every time. The inventory is first of
// all the owner's record of everything in the unit; the owner flags the
// items that must be counted at every checkout (count_required). The
// rest stay on the list, and can still be counted, but aren't asked for.
// Nothing is flagged by default.
//
// A proposed item waits in unit_inventory_proposals. The owner is told
// (an in-app alert, and an email where email is configured) and either
// approves it — it becomes a normal item, its count the baseline — or
// rejects it. Until then it is not part of the inventory: it has no
// baseline, is not counted, and doesn't figure in any total.
//
// The cleaning service can also report damage: what, where (an area, a
// free-text spot, and the item if it concerns one) and photos. Damage is
// stored in unit_inventory_damages and the owner is told.
//
// A completed count is the unit's inventory for that checkout. Its row in
// unit_inventory_checks is dated and keeps the result as it stood — the
// items that were off their baseline or carried a note — and the damage
// reported during that visit is attached to it, so the owner can open any
// checkout and see what was found.
//
// The owner can attach photos to an item — a picture of what it is, for
// their own record and so the cleaning service can recognise it. They
// live in unit_inventory_item_photos, apart from the item rows, so the
// lists both screens load stay small; an item's photos are fetched when
// someone opens them. The item carries only how many it has.
//
// At a checkout the cleaning service may photograph any item — useful
// above all when something is missing or damaged. Those photos go to
// unit_inventory_count_photos as they are taken and join the count's
// record when it is completed. They are optional, kept for the unit's
// most recent checkouts only (PROOF_KEEP_CHECKS), and stored in the
// database.
//
// What is required is a video: after cleaning, the cleaning service
// records a short walk through the apartment. Videos are too large for
// the database, so they go to Supabase Storage (bucket VIDEO_BUCKET): the
// server hands the page a signed upload URL, the phone uploads the file
// straight to storage, and the server records it in unit_inventory_videos
// once it is there. A count cannot be completed through the share link
// without a video from this visit; completing attaches it to the count.
// The video is the owner's evidence for Airbnb damage claims (filed
// within 14 days of the guest's checkout). Videos are kept until the
// bucket nears its size limit (videoStorageLimit(),
// INVENTORY_VIDEO_STORAGE_MB, default 800 MB under Supabase's free 1 GB):
// then the oldest videos of completed counts, of any unit, are deleted to
// make room — but never one under VIDEO_PROTECT_DAYS old, nor one the
// owner marked "keep as evidence".
//
// The owner also keeps a list of working checks — things to test at
// every visit, such as each burner of the stove, each TV and A/C with its
// remote, the A/C switching off when a door is opened
// (unit_inventory_function_checks). Through the share link each must be
// answered "works" or "doesn't work" before the count can be completed;
// the answers become part of the count's record. A "doesn't work" is
// reported as damage by the page, so the owner is told.
//
// Each person of the cleaning service can have a link of their own
// (unit_inventory_people), which the owner sends them: what they do
// through it carries their name, and the owner can switch one person off.
// The unit's general link keeps working beside them. The owner can also
// leave notes for the next visit (unit_inventory_tasks), which the
// cleaning service ticks off, and answer a damage report when closing it
// (how it was solved, a reply), which the cleaning service sees.
//
// Like the rest of this app the owner routes trust the ownerUid the
// client sends (see server/platform/units/routes.js); there is no
// server-side session to check it against.

'use strict';

const crypto = require('crypto');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { translate, translateEnabled, TranslateError } = require('./translate');
const { suggestItems, SuggestError } = require('./suggest');

const MAX_NAME = 300;
const MAX_AREA = 120;
const MAX_NOTE = 1000;
const MAX_ACTOR = 120;
const MAX_COUNT = 100000;
const MAX_BULK_ITEMS = 1000;
const MAX_COUNT_UPDATES = 1000;
// How many proposed items may wait for one unit's owner at a time. The
// share link has no login, so this bounds what a stray link can pile up.
const MAX_PENDING_PROPOSALS = 50;
// Proposals arriving within this long of the previous one for the same
// unit are one visit: the owner is told once, not once per item.
const PROPOSAL_NOTIFY_GAP_MS = 30 * 60 * 1000;
// Damage reports: photos are JPEG data URLs the page has already shrunk
// (see compressImage in client/src/core/utils.js), stored with the row
// like incident photos.
const MAX_DAMAGE_PHOTOS = 4;
const MAX_PHOTO_CHARS = 2 * 1024 * 1024;
const MAX_OPEN_DAMAGES = 100;
const MAX_ITEM_PHOTOS = 3;
// Proof photos: how many the cleaning service may attach to one item in
// one visit, and for how many of a unit's latest completed counts they
// are kept. Older counts keep their numbers and notes; only the pictures
// go, so the database doesn't grow without bound.
const MAX_PROOF_PHOTOS = 3;
const PROOF_KEEP_CHECKS = 12;
// The checkout video. The page records at about 1 Mbit/s, so three minutes
// is ~25 MB; 50 MB is also Supabase's per-file limit on its free plan.
const VIDEO_BUCKET = 'inventory-videos';
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 180;
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const MAX_VISIT_VIDEOS = 3;
// How much the inventory-videos bucket may hold. Default 800 MB: room
// under the 1 GB of Supabase's free plan for the rest of storage.
const DEFAULT_VIDEO_STORAGE_MB = 800;
const videoStorageLimit = () => {
  const mb = Number(process.env.INVENTORY_VIDEO_STORAGE_MB);
  return Math.round((Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_VIDEO_STORAGE_MB) * 1024 * 1024);
};
// Videos this recent are never recycled, whatever the storage: Airbnb
// takes damage claims for 14 days after checkout; 30 leaves margin.
const VIDEO_PROTECT_DAYS = 30;
// How long a link sent with a video (e.g. over WhatsApp) keeps working.
const VIDEO_SHARE_SECONDS = 7 * 24 * 60 * 60;
// Damage-photo suggestions a unit's share link may ask for per hour.
const SUGGEST_PER_HOUR = 30;
// How long a link to watch a video works.
const VIDEO_URL_SECONDS = 60 * 60;
const MAX_LOCATION = 200;
// Damage reported this long before a count is completed belongs to that
// visit and is attached to its record; older unattached reports stand
// on their own.
const DAMAGE_VISIT_WINDOW_MS = 12 * 60 * 60 * 1000;
// The cleaning service's people with their own link, and the owner's
// notes for the next visit.
const MAX_PEOPLE = 20;
const MAX_PHONE = 40;
const MAX_TASK_TEXT = 500;
const MAX_OPEN_TASKS = 50;
// How long the cleaning service sees how the owner closed a damage report.
const DAMAGE_NEWS_DAYS = 7;
const RESOLUTIONS = ['repaired', 'replaced', 'other'];
// Working checks: how many a unit may have, and their text sizes.
const MAX_FUNCTION_CHECKS = 60;
const MAX_FUNCTION_LABEL = 200;
const MAX_FUNCTION_HOW = 300;
const MAX_FUNCTION_NOTE = 500;
// How many off-baseline / noted items a completed count keeps.
const MAX_CHECK_RESULTS = 500;
// Every damage column except the photos, for lists.
const DAMAGE_LIST_COLUMNS = 'id, listing_id, check_id, item_id, item_name_en, item_name_es, area_en, area_es, location, description, photo_count, reported_by, actor_type, status, created_at, resolved_at, resolved_by';

const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// A count is a whole number from 0 to MAX_COUNT. Returns null for
// anything else so callers can reject it rather than store a guess.
const parseCount = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_COUNT) return null;
  return n;
};

const itemFromDb = (r) => ({
  id: r.id,
  listingId: r.listing_id,
  areaEn: r.area_en || '',
  areaEs: r.area_es || '',
  nameEn: r.name_en || '',
  nameEs: r.name_es || '',
  noteEn: r.note_en || '',
  noteEs: r.note_es || '',
  baselineCount: r.baseline_count,
  baselineSetAt: r.baseline_set_at,
  currentCount: r.current_count,
  currentNote: r.current_note || '',
  // The count note in the other language, translated when it was saved
  // (empty when translation is off or failed). currentNoteLang is the
  // language it was written in: 'es' or 'en'.
  currentNoteLang: r.current_note_lang || '',
  currentNoteTranslation: r.current_note_translation || '',
  countUpdatedAt: r.count_updated_at,
  countUpdatedBy: r.count_updated_by || '',
  countRequired: !!r.count_required,
  photoCount: r.photo_count || 0,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
});

const eventFromDb = (r) => ({
  id: r.id,
  itemId: r.item_id,
  itemNameEn: r.item_name_en || '',
  itemNameEs: r.item_name_es || '',
  type: r.event_type,
  countBefore: r.count_before,
  countAfter: r.count_after,
  baselineBefore: r.baseline_before,
  baselineAfter: r.baseline_after,
  noteBefore: r.note_before || '',
  noteAfter: r.note_after || '',
  changes: r.changes || {},
  actorType: r.actor_type,
  actorName: r.actor_name || '',
  createdAt: r.created_at,
});

const checkFromDb = (r) => ({
  id: r.id,
  actorType: r.actor_type,
  actorName: r.actor_name || '',
  itemsTotal: r.items_total,
  itemsMissing: r.items_missing,
  itemsExtra: r.items_extra,
  itemsRequired: r.items_required || 0,
  damagesCount: r.damages_count || 0,
  photosCount: r.photos_count || 0,
  videosCount: r.videos_count || 0,
  // The working checks answered at this count: [{ id, labelEn, labelEs, status, note, by }].
  functionResults: Array.isArray(r.function_results) ? r.function_results : [],
  functionsFailed: r.functions_failed || 0,
  createdAt: r.created_at,
});

const functionFromDb = (r) => ({
  id: r.id,
  labelEn: r.label_en || '',
  labelEs: r.label_es || '',
  howEn: r.how_en || '',
  howEs: r.how_es || '',
  itemId: r.item_id || '',
  // Runs on batteries: the cleaning service may answer "worked after changing them".
  usesBatteries: !!r.uses_batteries,
});

const videoFromDb = (r) => ({
  id: r.id,
  checkId: r.check_id || '',
  contentType: r.content_type || '',
  sizeBytes: r.size_bytes || 0,
  durationSeconds: r.duration_seconds || 0,
  takenBy: r.taken_by || '',
  createdAt: r.created_at,
  // Marked by the owner as evidence for a claim: never recycled.
  keep: !!r.keep,
  keptBy: r.kept_by || '',
});

// `withPhotos` only where one report is opened: lists never carry them.
const damageFromDb = (r, withPhotos = false) => ({
  id: r.id,
  checkId: r.check_id || '',
  itemId: r.item_id || '',
  itemNameEn: r.item_name_en || '',
  itemNameEs: r.item_name_es || '',
  areaEn: r.area_en || '',
  areaEs: r.area_es || '',
  location: r.location || '',
  description: r.description || '',
  photoCount: r.photo_count || 0,
  ...(withPhotos ? { photos: Array.isArray(r.photos) ? r.photos : [] } : {}),
  reportedBy: r.reported_by || '',
  actorType: r.actor_type || 'cleaner',
  status: r.status || 'open',
  createdAt: r.created_at,
  resolvedAt: r.resolved_at || null,
  resolvedBy: r.resolved_by || '',
  // How the owner closed it and what they answered (newer columns).
  resolution: r.resolution || '',
  ownerReply: r.owner_reply || '',
});

const personFromDb = (r) => ({
  id: r.id,
  name: r.name || '',
  phone: r.phone || '',
  token: r.token,
  enabled: !!r.enabled,
  lastSeenAt: r.last_seen_at || null,
});

const taskFromDb = (r) => ({
  id: r.id,
  text: r.text || '',
  textLang: r.text_lang || '',
  textTranslation: r.text_translation || '',
  itemId: r.item_id || '',
  status: r.status,
  createdBy: r.created_by || '',
  createdAt: r.created_at,
  doneBy: r.done_by || '',
  doneAt: r.done_at || null,
  doneNote: r.done_note || '',
});

const proposalFromDb = (r) => ({
  id: r.id,
  areaEn: r.area_en || '',
  areaEs: r.area_es || '',
  nameEn: r.name_en || '',
  nameEs: r.name_es || '',
  note: r.note || '',
  count: r.count,
  proposedBy: r.proposed_by || '',
  createdAt: r.created_at,
});

// A photo as it arrives — a data URL, bare or as { data } — if it is an
// image of an allowed type and size; null otherwise. The share link has
// no login and the owner's uid is taken on trust, so nothing else is let
// into a column that pages later put in an <img>.
const cleanPhoto = (p) => {
  const data = typeof p === 'string' ? p : p?.data;
  return typeof data === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(data) && data.length <= MAX_PHOTO_CHARS ? data : null;
};

const itemPhotoFromDb = (r) => ({ id: r.id, data: r.data, createdAt: r.created_at });

// The fields of an item the owner writes. Either name may be left blank
// (it falls back to the other language on screen) but not both.
const parseItemFields = (raw) => {
  const f = {
    area_en: text(raw?.areaEn, MAX_AREA),
    area_es: text(raw?.areaEs, MAX_AREA),
    name_en: text(raw?.nameEn, MAX_NAME),
    name_es: text(raw?.nameEs, MAX_NAME),
    note_en: text(raw?.noteEn, MAX_NOTE),
    note_es: text(raw?.noteEs, MAX_NOTE),
  };
  if (!f.name_en && !f.name_es) return { error: 'An item needs a description in English or Spanish.' };
  return { fields: f };
};

// Which descriptive fields an edit changed, as the history stores them:
// { areaEn: { before, after }, … } keyed the way the client names fields.
const EDITABLE_FIELDS = {
  area_en: 'areaEn', area_es: 'areaEs',
  name_en: 'nameEn', name_es: 'nameEs',
  note_en: 'noteEn', note_es: 'noteEs',
};
const describeEdit = (before, after) => {
  const changes = {};
  for (const [column, key] of Object.entries(EDITABLE_FIELDS)) {
    const a = before[column] || '';
    const b = after[column] || '';
    if (a !== b) changes[key] = { before: a, after: b };
  }
  return changes;
};

// "inventario-apto-317-2026-11-22-1452.mp4": the unit and when the video
// was recorded, in Colombia time, for the file the owner downloads.
const videoFileName = (listing, v) => {
  const ext = String(v.path || '').split('.').pop() || 'mp4';
  const apt = String(listing.apt || listing.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unidad';
  let stamp = '';
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(v.created_at)).map(p => [p.type, p.value]));
    stamp = `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
  } catch (_e) { stamp = String(v.created_at || '').slice(0, 16).replace(/[^0-9]/g, ''); }
  return `inventario-apto-${apt}-${stamp}.${ext}`;
};

module.exports = function createUnitInventoryRouter(deps) {
  // Photo suggestions asked per unit in the last hour (timestamps), to cap
  // what a share link can spend on the Claude API.
  const suggestLog = new Map();
  const { supabase, requireSupabaseEnv, sendSupabaseError, auditLog } = deps;
  // Telling the owner about a proposed item. All optional: without them a
  // proposal is still saved and shows on the owner's inventory screen.
  const { notificationToDb, sendSpanishEmail, getListingOwnerEmails, publicAppUrl, escapeHtml, warn = () => {} } = deps;

  const router = express.Router();

  // Resolves the unit and checks the caller owns it. Writes the error
  // response itself and returns null when the caller may not proceed.
  const requireOwnedUnit = async (res, listingId, ownerUid) => {
    const { data, error } = await supabase.from('listings')
      .select('id, owner_uid, owner, community_id, apt, tower')
      .eq('id', listingId).maybeSingle();
    if (error) { sendSupabaseError(res, error); return null; }
    if (!data) { res.status(404).json({ error: 'Unit not found.' }); return null; }
    if (!ownerUid || data.owner_uid !== String(ownerUid)) {
      res.status(403).json({ error: 'Only the owner of this unit can manage its inventory.' });
      return null;
    }
    return data;
  };

  const loadItems = async (listingId) => supabase.from('unit_inventory_items')
    .select('*').eq('listing_id', listingId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });

  const insertEvents = async (rows) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('unit_inventory_events').insert(rows.slice(i, i + 500));
      if (error) return error;
    }
    return null;
  };

  const eventRow = (item, listing, fields) => ({
    id: 'uiv_' + uuidv4().slice(0, 12),
    listing_id: listing.id,
    community_id: listing.community_id || 'kai',
    item_id: item.id,
    item_name_en: item.name_en || '',
    item_name_es: item.name_es || '',
    count_before: null, count_after: null,
    baseline_before: null, baseline_after: null,
    note_before: '', note_after: '',
    actor_uid: '',
    ...fields,
  });

  // Applies count/note updates from either audience. Each update is
  // { itemId, count?, note? }; a field left out is left alone. Items that
  // end up unchanged are skipped, so re-saving a screen adds no history.
  // Returns { changed } or { error, status }.
  // Translates a count note into the other language of `lang` (the
  // language of the page it was typed on). Returns { lang, translation };
  // the translation is '' when translation is off, fails, or comes back
  // unchanged. Never throws: a note is saved whether or not it translates.
  const translateNote = async (note, lang) => {
    const from = String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'es';
    if (!note || !translateEnabled()) return { lang: from, translation: '' };
    try {
      const out = await translate({ text: note, to: from === 'en' ? 'es' : 'en', kind: 'note' });
      return { lang: from, translation: out && out.trim() !== note.trim() ? out : '' };
    } catch (e) {
      warn('Inventory note translation failed: ' + (e && e.message));
      return { lang: from, translation: '' };
    }
  };
  // Set once the database turns out not to have the note-translation
  // columns (schema.sql not re-run): counts are then saved without them.
  let noteTranslationColumns = true;

  const applyCountUpdates = async ({ listing, updates, actorType, actorName, actorUid, lang }) => {
    if (!Array.isArray(updates) || !updates.length) return { error: 'No changes to save.', status: 400 };
    if (updates.length > MAX_COUNT_UPDATES) return { error: 'Too many changes in one save.', status: 400 };
    const { data: rows, error } = await loadItems(listing.id);
    if (error) return { supabaseError: error };
    const byId = new Map((rows || []).map(r => [r.id, r]));

    const now = new Date().toISOString();
    const plans = [];
    for (const u of updates) {
      const item = byId.get(String(u?.itemId || ''));
      if (!item) return { error: 'One of the items no longer exists. Reload and try again.', status: 409 };
      let count = item.current_count;
      if (u.count !== undefined) {
        count = parseCount(u.count);
        if (count == null) return { error: `Counts must be whole numbers from 0 to ${MAX_COUNT}.`, status: 400 };
      }
      const note = u.note !== undefined ? text(u.note, MAX_NOTE) : (item.current_note || '');
      if (count === item.current_count && note === (item.current_note || '')) continue;
      plans.push({ item, count, note });
    }

    // Notes that changed get their translation, a few at a time.
    const noteChanged = plans.filter(pl => pl.note !== (pl.item.current_note || ''));
    for (let i = 0; i < noteChanged.length; i += 4) {
      await Promise.all(noteChanged.slice(i, i + 4).map(async (pl) => { pl.tr = await translateNote(pl.note, lang); }));
    }

    const events = [];
    for (const { item, count, note, tr } of plans) {
      const base = {
        current_count: count, current_note: note,
        count_updated_at: now, count_updated_by: actorName, updated_at: now,
      };
      const withTr = tr && noteTranslationColumns
        ? { ...base, current_note_lang: note ? tr.lang : '', current_note_translation: tr.translation }
        : base;
      let { error: uErr } = await supabase.from('unit_inventory_items').update(withTr).eq('id', item.id);
      if (uErr && withTr !== base) {
        // Most likely the columns aren't there yet: save the count anyway.
        const retry = await supabase.from('unit_inventory_items').update(base).eq('id', item.id);
        if (!retry.error) { noteTranslationColumns = false; uErr = null; }
      }
      if (uErr) return { supabaseError: uErr };
      events.push(eventRow(item, listing, {
        event_type: 'count',
        count_before: item.current_count, count_after: count,
        note_before: item.current_note || '', note_after: note,
        actor_type: actorType, actor_name: actorName, actor_uid: actorUid || '',
        created_at: now,
      }));
    }
    const evErr = await insertEvents(events);
    if (evErr) return { supabaseError: evErr };
    return { changed: plans.length };
  };

  // The most recent completed count, or null. A database that doesn't have
  // unit_inventory_checks yet (schema.sql not re-run since the table was
  // added) reads as "never completed" instead of failing the whole screen.
  const loadLastCheck = async (listingId) => {
    const { data, error } = await supabase.from('unit_inventory_checks')
      .select('*').eq('listing_id', listingId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return error || !data ? null : checkFromDb(data);
  };

  const visitSince = () => new Date(Date.now() - DAMAGE_VISIT_WINDOW_MS).toISOString();

  const videoStore = () => (supabase.storage ? supabase.storage.from(VIDEO_BUCKET) : null);

  // The videos uploaded during the current visit and not yet part of a
  // completed count. Null when the table isn't there yet (schema.sql not
  // re-run): then no video is asked for and counts complete as before.
  const visitVideos = async (listingId) => {
    const { data, error } = await supabase.from('unit_inventory_videos')
      .select('*').eq('listing_id', listingId).eq('status', 'ready')
      .is('check_id', null).gte('created_at', visitSince())
      .order('created_at', { ascending: true });
    return error ? null : (data || []);
  };

  // Removes video rows and their files. Files first: a row whose file is
  // gone is harmless, a file nothing points to is lost space.
  const dropVideos = async (rows) => {
    if (!rows.length) return;
    const store = videoStore();
    if (store) {
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await store.remove(rows.slice(i, i + 100).map(r => r.path));
        if (error) { warn('Inventory video removal failed: ' + error.message); return; }
      }
    }
    for (let i = 0; i < rows.length; i += 100) {
      await supabase.from('unit_inventory_videos').delete().in('id', rows.slice(i, i + 100).map(r => r.id));
    }
  };

  // Abandoned uploads (never attached to a completed count, older than a
  // day) are dropped. Best effort, after a cleaner completes a count.
  const pruneVideos = async (listingId) => {
    try {
      const stale = new Date(Date.now() - 2 * DAMAGE_VISIT_WINDOW_MS).toISOString();
      const { data: rows } = await supabase.from('unit_inventory_videos').select('id, path, check_id, created_at')
        .eq('listing_id', listingId).is('check_id', null).lt('created_at', stale);
      await dropVideos(rows || []);
    } catch (e) {
      warn('Inventory video clean-up failed: ' + (e?.message || e));
    }
  };

  // What the videos take up, all units together: { used, limit } in bytes.
  // `size_bytes` is the declared size while uploading, the real one after.
  const videoStorageUse = async () => {
    const { data, error } = await supabase.from('unit_inventory_videos').select('size_bytes').limit(20000);
    if (error) return null;
    const used = (data || []).reduce((n, r) => n + (Number(r.size_bytes) || 0), 0);
    const limit = videoStorageLimit();
    return { used, limit, over: used > limit, protectDays: VIDEO_PROTECT_DAYS };
  };

  // Makes room for `incoming` more bytes: when the videos would pass the
  // limit, the oldest videos of completed counts — any unit — are deleted
  // until they fit. Never touched: videos of a visit still under way,
  // videos under VIDEO_PROTECT_DAYS old, and videos kept as evidence. If
  // those alone pass the limit, nothing more goes (the owner sees the
  // storage is over). Best effort: a failure is logged, the upload goes ahead.
  const makeVideoRoom = async (incoming) => {
    try {
      const limit = videoStorageLimit();
      let { data: rows, error } = await supabase.from('unit_inventory_videos')
        .select('id, path, size_bytes, check_id, created_at, keep').limit(20000);
      if (error) {
        // No `keep` column yet (schema.sql not re-run): nothing is kept.
        ({ data: rows, error } = await supabase.from('unit_inventory_videos')
          .select('id, path, size_bytes, check_id, created_at').limit(20000));
      }
      if (error || !rows) return;
      let used = rows.reduce((n, r) => n + (Number(r.size_bytes) || 0), 0);
      if (used + incoming <= limit) return;
      const protectSince = new Date(Date.now() - VIDEO_PROTECT_DAYS * 24 * 3600 * 1000).toISOString();
      const oldest = rows.filter(r => r.check_id && !r.keep && String(r.created_at) < protectSince)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      const drop = [];
      for (const r of oldest) {
        if (used + incoming <= limit) break;
        drop.push(r);
        used -= Number(r.size_bytes) || 0;
      }
      if (used + incoming > limit) warn(`Inventory videos: over the ${Math.round(limit / 1048576)} MB limit; the rest are under ${VIDEO_PROTECT_DAYS} days old or kept as evidence.`);
      if (!drop.length) return;
      await dropVideos(drop);
      warn(`Inventory videos: deleted the ${drop.length} oldest to stay under ${Math.round(limit / 1048576)} MB.`);
    } catch (e) {
      warn('Inventory video recycling failed: ' + (e?.message || e));
    }
  };

  // The proof photos taken during the current visit and not yet part of
  // a completed count, without the pictures: [{ id, item_id }]. Null when
  // the table isn't there yet (schema.sql not re-run), in which case
  // photos can't be asked for and nothing is enforced.
  const visitProofs = async (listingId) => {
    const { data, error } = await supabase.from('unit_inventory_count_photos')
      .select('id, item_id, created_at').eq('listing_id', listingId)
      .is('check_id', null).gte('created_at', visitSince())
      .order('created_at', { ascending: true }).limit(5000);
    return error ? null : (data || []);
  };

  // The unit's working checks in order, or null when the table isn't
  // there yet (schema.sql not re-run): then none are asked for.
  const loadFunctions = async (listingId) => {
    const { data, error } = await supabase.from('unit_inventory_function_checks')
      .select('*').eq('listing_id', listingId).order('position', { ascending: true }).limit(MAX_FUNCTION_CHECKS);
    return error ? null : (data || []);
  };
  // This visit's answers, the latest for each check: { [checkId]: row }.
  const visitFunctionAnswers = async (listingId) => {
    const { data, error } = await supabase.from('unit_inventory_function_results')
      .select('*').eq('listing_id', listingId).gte('created_at', visitSince())
      .order('created_at', { ascending: true }).limit(1000);
    const out = {};
    for (const r of (error ? [] : data || [])) out[r.function_check_id] = r;
    return out;
  };
  const answerFromDb = (r) => ({ status: r.status, note: r.note || '', by: r.answered_by || '', at: r.created_at, batteries: !!r.batteries });

  // Drops the proof photos of counts older than the unit's latest
  // PROOF_KEEP_CHECKS, and those of visits that were never completed.
  // Best effort, after a count is completed.
  const pruneProofPhotos = async (listingId) => {
    try {
      const { data: checks } = await supabase.from('unit_inventory_checks').select('id').eq('listing_id', listingId)
        .order('created_at', { ascending: false }).limit(PROOF_KEEP_CHECKS + 500);
      const old = (checks || []).slice(PROOF_KEEP_CHECKS).map(c => c.id);
      for (let i = 0; i < old.length; i += 100) {
        await supabase.from('unit_inventory_count_photos').delete().eq('listing_id', listingId).in('check_id', old.slice(i, i + 100));
      }
      await supabase.from('unit_inventory_count_photos').delete().eq('listing_id', listingId)
        .is('check_id', null).lt('created_at', new Date(Date.now() - 2 * DAMAGE_VISIT_WINDOW_MS).toISOString());
    } catch (e) {
      warn('Inventory proof-photo clean-up failed: ' + (e?.message || e));
    }
  };

  // Records that someone went through the whole unit. `updates` are the
  // counts still unsaved on their screen, applied first so the record
  // describes the unit as they left it. Every item's "last counted" then
  // moves to now, changed or not: the pass confirmed all of them. Where
  // the owner has flagged the items to count at every checkout, the pass
  // covered those, so only they are stamped and the record says how many.
  // The record also keeps the result as it stood (every flagged item,
  // and any other item off baseline or with a note) and takes in the
  // damage reported and the proof photos taken during the visit. Through
  // the share link, a flagged item without a proof photo stops it.
  // Returns { check, changed } or { error, status } / { supabaseError }.
  const completeCount = async ({ listing, updates, actorType, actorName, actorUid, req, lang }) => {
    // The video first, before anything is written: the cleaning service
    // can't complete a count without one from this visit. (The owner's
    // own count asks for none.) Item photos are optional.
    const proofs = actorType === 'cleaner' ? await visitProofs(listing.id) : [];
    const videos = actorType === 'cleaner' ? await visitVideos(listing.id) : [];
    if (actorType === 'cleaner' && videos && !videos.length) {
      return {
        error: 'The video of the apartment is missing. Record a short walk through the apartment after cleaning, then finish.',
        status: 400, videoMissing: true,
      };
    }
    // Every working check needs an answer from this visit.
    const functions = (await loadFunctions(listing.id)) || [];
    const answers = functions.length ? await visitFunctionAnswers(listing.id) : {};
    if (actorType === 'cleaner') {
      const unanswered = functions.filter(f => !answers[f.id]);
      if (unanswered.length) {
        return {
          error: `Answer the working checks first (${unanswered.length} left): does each one work?`,
          status: 400, functionsMissing: unanswered.map(f => f.id),
        };
      }
    }
    let changed = 0;
    if (Array.isArray(updates) && updates.length) {
      const result = await applyCountUpdates({ listing, updates, actorType, actorName, actorUid, lang });
      if (result.supabaseError || result.error) return result;
      changed = result.changed;
    }
    const { data: rows, error } = await loadItems(listing.id);
    if (error) return { supabaseError: error };
    if (!rows || !rows.length) return { error: 'This unit has no inventory to count yet.', status: 400 };
    const now = new Date().toISOString();
    const required = rows.filter(r => r.count_required).length;
    const row = {
      id: 'uic_' + uuidv4().slice(0, 12),
      listing_id: listing.id,
      community_id: listing.community_id || 'kai',
      actor_type: actorType, actor_name: actorName, actor_uid: actorUid || '',
      items_total: rows.length,
      items_missing: rows.filter(r => r.current_count < r.baseline_count).length,
      items_extra: rows.filter(r => r.current_count > r.baseline_count).length,
      // Left out when nothing is flagged, so a database whose checks
      // table predates this column keeps working for such units.
      ...(required ? { items_required: required } : {}),
      created_at: now,
    };
    const taken = proofs || [];
    const photosOf = (id) => taken.filter(ph => ph.item_id === id).length;
    const results = rows
      .filter(r => r.count_required || r.current_count !== r.baseline_count || (r.current_note || '') || photosOf(r.id))
      .slice(0, MAX_CHECK_RESULTS)
      .map(r => ({
        itemId: r.id, nameEn: r.name_en || '', nameEs: r.name_es || '', areaEn: r.area_en || '', areaEs: r.area_es || '',
        baseline: r.baseline_count, count: r.current_count, note: r.current_note || '', required: !!r.count_required,
        ...(r.current_note && r.current_note_translation ? { noteLang: r.current_note_lang || '', noteTranslation: r.current_note_translation } : {}),
        photos: photosOf(r.id),
      }));
    const damages = await visitDamages(listing.id);
    // The result and the damage count are newer columns: if the database
    // doesn't have them yet, the count is still recorded without them.
    const filmed = videos || [];
    // The working checks as answered, in the owner's order.
    const functionResults = functions.filter(f => answers[f.id]).map(f => ({
      id: f.id, labelEn: f.label_en || '', labelEs: f.label_es || '', itemId: f.item_id || '',
      status: answers[f.id].status, note: answers[f.id].note || '', by: answers[f.id].answered_by || '',
      ...(answers[f.id].batteries ? { batteries: true } : {}),
    }));
    const functionsFailed = functionResults.filter(f => f.status === 'fail').length;
    const full = {
      ...row, results, damages_count: damages.length, photos_count: taken.length, videos_count: filmed.length,
      ...(functionResults.length ? { function_results: functionResults, functions_failed: functionsFailed } : {}),
    };
    let saved = full;
    let { error: cErr } = await supabase.from('unit_inventory_checks').insert(full);
    if (cErr && (results.length || damages.length || taken.length || filmed.length || functionResults.length)) {
      saved = row;
      ({ error: cErr } = await supabase.from('unit_inventory_checks').insert(row));
    }
    if (cErr) return { supabaseError: cErr };
    if (damages.length) {
      const { error: dErr } = await supabase.from('unit_inventory_damages')
        .update({ check_id: row.id }).eq('listing_id', listing.id).in('id', damages.map(d => d.id));
      if (dErr) return { supabaseError: dErr };
    }
    let stamp = supabase.from('unit_inventory_items')
      .update({ count_updated_at: now, count_updated_by: actorName }).eq('listing_id', listing.id);
    if (required) stamp = stamp.eq('count_required', true);
    const { error: uErr } = await stamp;
    if (uErr) return { supabaseError: uErr };
    // The owner's own count needs no message to the owner.
    // The visit's proof photos now belong to this count.
    for (let i = 0; i < taken.length; i += 100) {
      const { error: pErr } = await supabase.from('unit_inventory_count_photos')
        .update({ check_id: row.id }).eq('listing_id', listing.id).in('id', taken.slice(i, i + 100).map(ph => ph.id));
      if (pErr) return { supabaseError: pErr };
    }
    // And so does its video.
    if (filmed.length) {
      const { error: vErr } = await supabase.from('unit_inventory_videos')
        .update({ check_id: row.id }).eq('listing_id', listing.id).in('id', filmed.map(v => v.id));
      if (vErr) return { supabaseError: vErr };
    }
    // The visit's answers are in the record now (and stale ones go too).
    if (functions.length) {
      const { error: fErr } = await supabase.from('unit_inventory_function_results').delete().eq('listing_id', listing.id);
      if (fErr) warn('Inventory working-check clean-up failed: ' + fErr.message);
    }
    if (actorType === 'cleaner') {
      const tasks = (await loadTasks(listing.id, ['open', 'done'])) || [];
      const tasksDone = tasks.filter(t => t.status === 'done' && t.done_at && t.done_at >= visitSince());
      const tasksOpen = tasks.filter(t => t.status === 'open');
      setImmediate(() => notifyOwnerOfCheck({ listing, check: saved, results, damages, functionResults, tasksDone, tasksOpen, req }));
      setImmediate(() => pruneProofPhotos(listing.id));
      setImmediate(() => pruneVideos(listing.id));
    }
    return { check: checkFromDb(saved), changed };
  };

  // Items waiting for the owner's decision, oldest first. As with
  // loadLastCheck, a database without the table yet reads as none.
  const loadPendingProposals = async (listingId) => {
    const { data, error } = await supabase.from('unit_inventory_proposals')
      .select('*').eq('listing_id', listingId).eq('status', 'pending')
      .order('created_at', { ascending: true });
    return error || !data ? [] : data.map(proposalFromDb);
  };

  // Tells the unit's owner something happened on their inventory: an
  // alert in the app, then an email if email is set up. `lines` are the
  // email's paragraphs. Never throws — whatever it reports is already
  // saved and shows on the owner's inventory screen either way.
  const notifyOwner = async ({ listing, title, message, lines, req }) => {
    try {
      if (!listing.owner_uid || !notificationToDb) return;
      const note = {
        id: 'not_' + uuidv4().slice(0, 8), communityId: listing.community_id || 'kai',
        ownerUid: listing.owner_uid, listingId: listing.id, incidentId: null,
        title, message: String(message).slice(0, 300), isRead: false, emailSent: false, emailError: '',
        createdAt: new Date().toISOString(), kind: 'inventory',
      };
      const { error } = await supabase.from('notifications').insert(notificationToDb(note));
      if (error) { warn('Inventory alert failed: ' + error.message); return; }
      const recipients = getListingOwnerEmails ? getListingOwnerEmails(listing) : [];
      if (!sendSpanishEmail || !recipients.length) return;
      const appUrl = publicAppUrl ? publicAppUrl(req) : '';
      const esc = escapeHtml || ((v) => String(v));
      const result = await sendSpanishEmail({
        to: recipients, subject: title,
        text: lines.join('\n') + (appUrl ? `\n\n${appUrl}` : ''),
        html: lines.map(l => (l ? `<p>${esc(l)}</p>` : '')).join('') + (appUrl ? `<p><a href="${esc(appUrl)}">${esc(appUrl)}</a></p>` : ''),
      });
      await supabase.from('notifications').update({ email_sent: !!result.sent, email_error: result.sent ? '' : (result.reason || '') }).eq('id', note.id);
    } catch (e) {
      warn('Inventory notification failed: ' + (e?.message || e));
    }
  };

  const notifyOwnerOfProposal = ({ listing, proposal, req }) => {
    const itemName = proposal.name_es || proposal.name_en;
    return notifyOwner({
      listing, req,
      title: `Inventario: artículo por aprobar - Apto ${listing.apt}`,
      message: `${proposal.proposed_by} (servicio de limpieza) propuso agregar: ${itemName} (${proposal.count}). Revísalo en Mis unidades → Inventario.`,
      lines: [
        `${proposal.proposed_by} (servicio de limpieza) propuso agregar un artículo al inventario del apartamento ${listing.apt}:`,
        `${itemName} — cantidad ${proposal.count}${proposal.note ? ` — nota: ${proposal.note}` : ''}`,
        'No hace parte del inventario hasta que lo apruebes. Para aprobarlo o rechazarlo, abre la aplicación: Mis unidades → Inventario.',
        '',
        `${proposal.proposed_by} (cleaning service) proposed adding an item to the inventory of apartment ${listing.apt}. It is not part of the inventory until you approve it: open the app, My Units → Inventory.`,
      ],
    });
  };

  // Where a damage report points, as one phrase: "Baño · Tapete de baño ·
  // junto a la ducha".
  const damageWhere = (d) => [d.area_es || d.area_en, d.item_name_es || d.item_name_en, d.location].filter(Boolean).join(' · ');

  const notifyOwnerOfDamage = ({ listing, damage, req }) => {
    const where = damageWhere(damage);
    return notifyOwner({
      listing, req,
      title: `Inventario: daño reportado - Apto ${listing.apt}`,
      message: `${damage.reported_by} (servicio de limpieza) reportó un daño${where ? ` en ${where}` : ''}: ${damage.description}`,
      lines: [
        `${damage.reported_by} (servicio de limpieza) reportó un daño en el apartamento ${listing.apt}:`,
        damage.description,
        ...(where ? [`Lugar: ${where}`] : []),
        ...(damage.photo_count ? [`Fotos adjuntas en la aplicación: ${damage.photo_count}`] : []),
        'Para ver el reporte y las fotos, abre la aplicación: Mis unidades → Inventario.',
        '',
        `${damage.reported_by} (cleaning service) reported damage in apartment ${listing.apt}. To see the report and its photos open the app: My Units → Inventory.`,
      ],
    });
  };

  // The completed count, told to the owner as that checkout's result.
  const notifyOwnerOfCheck = ({ listing, check, results, damages, functionResults = [], tasksDone = [], tasksOpen = [], req }) => {
    const failed = functionResults.filter(f => f.status === 'fail');
    const batteries = functionResults.filter(f => f.batteries);
    const parts = [
      check.items_required ? `${check.items_required} artículos de cada salida revisados` : `${check.items_total} artículos revisados`,
      check.items_missing ? `${check.items_missing} con faltantes` : '',
      check.items_extra ? `${check.items_extra} con sobrantes` : '',
      !check.items_missing && !check.items_extra ? 'todo coincide' : '',
      damages.length ? `${damages.length} daño(s) reportado(s)` : 'sin daños reportados',
      functionResults.length ? (failed.length ? `${failed.length} de ${functionResults.length} pruebas de funcionamiento fallaron` : `${functionResults.length} pruebas de funcionamiento OK`) : '',
      check.photos_count ? `${check.photos_count} foto(s)` : '',
      check.videos_count ? `video del apartamento incluido` : '',
    ].filter(Boolean).join(' · ');
    const off = results.filter(r => r.count !== r.baseline);
    return notifyOwner({
      listing, req,
      title: `Inventario de salida completado - Apto ${listing.apt}`,
      message: `${check.actor_name} (servicio de limpieza) completó el inventario: ${parts}.`,
      lines: [
        `${check.actor_name} (servicio de limpieza) completó el inventario de salida del apartamento ${listing.apt}.`,
        parts,
        ...(off.length ? ['Artículos con diferencia:', ...off.slice(0, 40).map(r => `• ${r.nameEs || r.nameEn}: esperado ${r.baseline}, contado ${r.count}${r.note ? ` — ${r.note}` : ''}`)] : []),
        ...(tasksDone.length ? ['Tus pendientes hechos:', ...tasksDone.map(t => `• ${t.text}${t.done_note ? ` — ${t.done_note}` : ''} (${t.done_by})`)] : []),
        ...(tasksOpen.length ? [`Pendientes sin hacer: ${tasksOpen.length}`] : []),
        ...(batteries.length ? [`Pilas cambiadas (compra repuestos): ${batteries.length}`, ...batteries.map(f => `• ${f.labelEs || f.labelEn}`)] : []),
        ...(failed.length ? ['No funciona:', ...failed.map(f => `• ${f.labelEs || f.labelEn}${f.note ? ` — ${f.note}` : ''}`)] : []),
        ...(damages.length ? ['Daños reportados:', ...damages.slice(0, 20).map(d => `• ${[damageWhere(d), d.description].filter(Boolean).join(': ')}${d.photo_count ? ` (${d.photo_count} foto(s))` : ''}`)] : []),
        'El reporte completo, con fotos y video, está en la aplicación: Mis unidades → Inventario → Reportes de salida.',
        '',
        `${check.actor_name} (cleaning service) completed the checkout inventory of apartment ${listing.apt}. The full report, with photos and video, is in the app: My Units → Inventory → Checkout reports.`,
      ],
    });
  };

  // Whether the damages table has the owner's resolution / reply columns
  // (schema.sql re-run); found out on the first read that lacks them.
  let damageReplyColumns = true;
  const damageColumns = () => DAMAGE_LIST_COLUMNS + (damageReplyColumns ? ', resolution, owner_reply' : '');
  // Damage reports without their photos, newest first, narrowed by
  // `narrow(query)`. A database without the table yet reads as none.
  const loadDamages = async (listingId, narrow) => {
    const run = (cols) => narrow(supabase.from('unit_inventory_damages')
      .select(cols).eq('listing_id', listingId))
      .order('created_at', { ascending: false }).limit(MAX_OPEN_DAMAGES);
    let { data, error } = await run(damageColumns());
    // A database without the reply columns yet: read without them.
    if (error && damageReplyColumns && /resolution|owner_reply/.test(error.message || '')) {
      damageReplyColumns = false;
      ({ data, error } = await run(damageColumns()));
    }
    return error || !data ? [] : data;
  };
  // Reported during the current visit and not yet part of a completed count.
  const visitDamages = (listingId) => loadDamages(listingId,
    q => q.is('check_id', null).gte('created_at', new Date(Date.now() - DAMAGE_VISIT_WINDOW_MS).toISOString()));

  // Saves a damage report. `raw` is { description, areaEn, areaEs,
  // location, itemId, photos }. Returns { row } or { error, status } /
  // { supabaseError }.
  const saveDamage = async ({ listing, raw, actorType, actorName }) => {
    const description = text(raw?.description, MAX_NOTE);
    if (!description) return { error: 'Describe the damage.', status: 400 };
    const photos = raw?.photos === undefined ? [] : raw.photos;
    if (!Array.isArray(photos) || photos.length > MAX_DAMAGE_PHOTOS) return { error: `Attach at most ${MAX_DAMAGE_PHOTOS} photos.`, status: 400 };
    const cleanPhotos = [];
    for (const p of photos) {
      const data = cleanPhoto(p);
      if (!data) return { error: 'Each photo must be an image of at most 2 MB.', status: 400 };
      cleanPhotos.push({ data });
    }
    // The item it concerns, if any — one of this unit's, its names copied
    // so the report still reads if the item is later deleted.
    let item = null;
    const itemId = text(raw?.itemId, 60);
    if (itemId) {
      const { data, error } = await supabase.from('unit_inventory_items')
        .select('*').eq('id', itemId).eq('listing_id', listing.id).maybeSingle();
      if (error) return { supabaseError: error };
      if (!data) return { error: 'That item no longer exists. Reload and try again.', status: 409 };
      item = data;
    }
    const { data: open, error: oErr } = await supabase.from('unit_inventory_damages')
      .select('id').eq('listing_id', listing.id).eq('status', 'open').limit(MAX_OPEN_DAMAGES);
    if (oErr) return { supabaseError: oErr };
    if ((open || []).length >= MAX_OPEN_DAMAGES) return { error: 'Too many damage reports are open for this unit. Ask the owner to review them first.', status: 400 };
    const row = {
      id: 'uid_' + uuidv4().slice(0, 12),
      listing_id: listing.id,
      community_id: listing.community_id || 'kai',
      check_id: null,
      item_id: item ? item.id : null,
      item_name_en: item ? item.name_en || '' : '',
      item_name_es: item ? item.name_es || '' : '',
      area_en: text(raw?.areaEn, MAX_AREA) || (item ? item.area_en || '' : ''),
      area_es: text(raw?.areaEs, MAX_AREA) || (item ? item.area_es || '' : ''),
      location: text(raw?.location, MAX_LOCATION),
      description,
      photos: cleanPhotos, photo_count: cleanPhotos.length,
      reported_by: actorName, actor_type: actorType,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('unit_inventory_damages').insert(row);
    if (error) return { supabaseError: error };
    return { row };
  };

  const loadLink = async (listingId) => {
    const { data } = await supabase.from('unit_inventory_links')
      .select('token, enabled, updated_at').eq('listing_id', listingId).maybeSingle();
    return data ? { token: data.token, enabled: !!data.enabled, updatedAt: data.updated_at } : null;
  };

  // The unit's people with their own link, oldest first; null when the
  // table isn't there yet (schema.sql not re-run).
  const loadPeople = async (listingId) => {
    const { data, error } = await supabase.from('unit_inventory_people')
      .select('*').eq('listing_id', listingId).order('created_at', { ascending: true }).limit(MAX_PEOPLE + 50);
    return error ? null : (data || []);
  };
  // The owner's notes for the next visit, oldest first. `statuses` picks
  // which; null when the table isn't there yet.
  const loadTasks = async (listingId, statuses) => {
    const { data, error } = await supabase.from('unit_inventory_tasks')
      .select('*').eq('listing_id', listingId).in('status', statuses)
      .order('created_at', { ascending: true }).limit(200);
    return error ? null : (data || []);
  };
  const newToken = () => crypto.randomBytes(24).toString('base64url');

  // ── Owner ────────────────────────────────────────────────────────────

  // GET /units/:listingId?ownerUid= — the unit's items, its share link,
  // its last completed count, and the items waiting for approval.
  router.get('/units/:listingId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const { data, error } = await loadItems(listing.id);
    if (error) return sendSupabaseError(res, error);
    res.json({
      items: (data || []).map(itemFromDb), link: await loadLink(listing.id),
      lastCheck: await loadLastCheck(listing.id), proposals: await loadPendingProposals(listing.id),
      openDamages: (await loadDamages(listing.id, q => q.eq('status', 'open'))).map(r => damageFromDb(r)),
      // Whether the item form can translate between the two languages.
      translate: translateEnabled(),
      // The working checks; null when the table isn't there yet.
      functionChecks: ((fs) => (fs ? fs.map(functionFromDb) : null))(await loadFunctions(listing.id)),
      // The cleaning service's people and their links; null without the table.
      people: ((ps) => (ps ? ps.map(personFromDb) : null))(await loadPeople(listing.id)),
      // Notes for the next visit, open and done (not archived); null without the table.
      tasks: ((ts) => (ts ? ts.map(taskFromDb) : null))(await loadTasks(listing.id, ['open', 'done'])),
    });
  });

  // POST /units/:listingId/people — body: { ownerUid, actorName, name,
  // phone? }. Adds a person of the cleaning service with a link of their
  // own. → { person }.
  router.post('/units/:listingId/people', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const name = text(req.body?.name, MAX_ACTOR);
    if (!name) return res.status(400).json({ error: 'Write the person\'s name.' });
    const people = await loadPeople(listing.id);
    if (people === null) return res.status(503).json({ error: 'Personal links need the latest database update: run supabase/unit_inventory.sql in the Supabase SQL Editor.' });
    if (people.length >= MAX_PEOPLE) return res.status(400).json({ error: `At most ${MAX_PEOPLE} people per unit.` });
    const now = new Date().toISOString();
    const row = {
      id: 'uip_' + uuidv4().slice(0, 12), listing_id: listing.id, community_id: listing.community_id || 'kai',
      name, phone: text(req.body?.phone, MAX_PHONE), token: newToken(), enabled: true, created_at: now, updated_at: now,
    };
    const { error } = await supabase.from('unit_inventory_people').insert(row);
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity: 'unit_inventory', entityId: listing.id, action: 'person_add', actorUid: String(ownerUid), actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner', after: { name } });
    res.json({ person: personFromDb(row) });
  });

  // POST /people/:id — body: { ownerUid, actorName, action: 'update' |
  // 'disable' | 'enable' | 'regenerate', name?, phone? }. Renames a
  // person, switches their link off or on, or gives them a new link (the
  // old one stops working). → { person }.
  router.post('/people/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, action } = req.body || {};
    const { data: person, error: pErr } = await supabase.from('unit_inventory_people').select('*').eq('id', req.params.id).maybeSingle();
    if (pErr) return sendSupabaseError(res, pErr);
    if (!person) return res.status(404).json({ error: 'Person not found.' });
    const listing = await requireOwnedUnit(res, person.listing_id, ownerUid);
    if (!listing) return;
    const patch = { updated_at: new Date().toISOString() };
    if (action === 'update') {
      const name = text(req.body?.name, MAX_ACTOR);
      if (!name) return res.status(400).json({ error: 'Write the person\'s name.' });
      patch.name = name; patch.phone = text(req.body?.phone, MAX_PHONE);
    } else if (action === 'disable' || action === 'enable') patch.enabled = action === 'enable';
    else if (action === 'regenerate') { patch.token = newToken(); patch.enabled = true; }
    else return res.status(400).json({ error: 'Unknown action.' });
    const { error } = await supabase.from('unit_inventory_people').update(patch).eq('id', person.id);
    if (error) return sendSupabaseError(res, error);
    await auditLog({ entity: 'unit_inventory', entityId: listing.id, action: 'person_' + action, actorUid: String(ownerUid), actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner', before: { name: person.name }, after: { name: patch.name || person.name } });
    res.json({ person: personFromDb({ ...person, ...patch }) });
  });

  // POST /units/:listingId/tasks — body: { ownerUid, actorName, text,
  // itemId?, lang }. A note for the next visit, in the owner's language
  // (`lang`), translated into the other when translation is on. → { task }.
  router.post('/units/:listingId/tasks', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const body = text(req.body?.text, MAX_TASK_TEXT);
    if (!body) return res.status(400).json({ error: 'Write what to do.' });
    const open = await loadTasks(listing.id, ['open']);
    if (open === null) return res.status(503).json({ error: 'Notes for the next visit need the latest database update: run supabase/unit_inventory.sql in the Supabase SQL Editor.' });
    if (open.length >= MAX_OPEN_TASKS) return res.status(400).json({ error: `At most ${MAX_OPEN_TASKS} open notes. Remove some first.` });
    let itemId = null;
    if (req.body?.itemId) {
      const { data: it } = await supabase.from('unit_inventory_items').select('id').eq('listing_id', listing.id).eq('id', String(req.body.itemId)).maybeSingle();
      itemId = it ? it.id : null;
    }
    const tr = await translateNote(body, req.body?.lang);
    const row = {
      id: 'uit_' + uuidv4().slice(0, 12), listing_id: listing.id, community_id: listing.community_id || 'kai',
      text: body, text_lang: tr.lang, text_translation: tr.translation, item_id: itemId, status: 'open',
      created_by: text(actorName, MAX_ACTOR) || listing.owner || 'Owner', created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('unit_inventory_tasks').insert(row);
    if (error) return sendSupabaseError(res, error);
    res.json({ task: taskFromDb(row) });
  });

  // POST /tasks/:id — body: { ownerUid, action: 'archive' | 'delete' |
  // 'reopen' }. The owner files away a done note, deletes one, or puts a
  // done one back on the list. → { task } (null when deleted).
  router.post('/tasks/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, action } = req.body || {};
    const { data: task, error: tErr } = await supabase.from('unit_inventory_tasks').select('*').eq('id', req.params.id).maybeSingle();
    if (tErr) return sendSupabaseError(res, tErr);
    if (!task) return res.status(404).json({ error: 'Note not found.' });
    const listing = await requireOwnedUnit(res, task.listing_id, ownerUid);
    if (!listing) return;
    if (action === 'delete') {
      const { error } = await supabase.from('unit_inventory_tasks').delete().eq('id', task.id);
      if (error) return sendSupabaseError(res, error);
      return res.json({ task: null });
    }
    const patch = action === 'archive' ? { status: 'archived' }
      : action === 'reopen' ? { status: 'open', done_by: '', done_at: null, done_note: '' } : null;
    if (!patch) return res.status(400).json({ error: 'Unknown action.' });
    const { error } = await supabase.from('unit_inventory_tasks').update(patch).eq('id', task.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ task: taskFromDb({ ...task, ...patch }) });
  });

  // PUT /units/:listingId/functions — body: { ownerUid, actorName,
  // checks: [{ id?, labelEn, labelEs, howEn, howEs, itemId }] }. Replaces
  // the unit's working checks with this list, in this order: checks
  // without an id are added, ones left out are removed. → { checks }.
  router.put('/units/:listingId/functions', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const raw = req.body?.checks;
    if (!Array.isArray(raw)) return res.status(400).json({ error: 'Send the list of checks.' });
    if (raw.length > MAX_FUNCTION_CHECKS) return res.status(400).json({ error: `At most ${MAX_FUNCTION_CHECKS} working checks per unit.` });
    const before = await loadFunctions(listing.id);
    if (before === null) return res.status(503).json({ error: 'Working checks need the latest database update: run supabase/unit_inventory.sql in the Supabase SQL Editor.' });
    const { data: itemRows, error: iErr } = await supabase.from('unit_inventory_items').select('id').eq('listing_id', listing.id);
    if (iErr) return sendSupabaseError(res, iErr);
    const itemIds = new Set((itemRows || []).map(r => r.id));
    const known = new Set(before.map(f => f.id));
    const now = new Date().toISOString();
    const rows = [];
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i] || {};
      const row = {
        id: known.has(c.id) ? c.id : 'uif_' + uuidv4().slice(0, 12),
        listing_id: listing.id, community_id: listing.community_id || 'kai',
        label_en: text(c.labelEn, MAX_FUNCTION_LABEL), label_es: text(c.labelEs, MAX_FUNCTION_LABEL),
        how_en: text(c.howEn, MAX_FUNCTION_HOW), how_es: text(c.howEs, MAX_FUNCTION_HOW),
        item_id: itemIds.has(c.itemId) ? c.itemId : null,
        uses_batteries: !!c.usesBatteries,
        position: i, updated_at: now,
      };
      if (!row.label_en && !row.label_es) return res.status(400).json({ error: `Check ${i + 1} needs a name in English or Spanish.` });
      rows.push(row);
    }
    const keep = new Set(rows.map(r => r.id));
    const gone = before.filter(f => !keep.has(f.id)).map(f => f.id);
    if (gone.length) {
      const { error } = await supabase.from('unit_inventory_function_checks').delete().eq('listing_id', listing.id).in('id', gone);
      if (error) return sendSupabaseError(res, error);
    }
    if (rows.length) {
      const full = rows.map(r => (known.has(r.id) ? r : { ...r, created_at: now }));
      let { error } = await supabase.from('unit_inventory_function_checks').upsert(full);
      // A database without the batteries column yet: save without it,
      // unless a check needs it.
      if (error && /uses_batteries/.test(error.message || '')) {
        if (rows.some(r => r.uses_batteries)) return res.status(503).json({ error: '“Uses batteries” needs the latest database update: run supabase/unit_inventory.sql in the Supabase SQL Editor.' });
        ({ error } = await supabase.from('unit_inventory_function_checks').upsert(full.map(({ uses_batteries, ...r }) => r)));
      }
      if (error) return sendSupabaseError(res, error);
    }
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: 'set_function_checks',
      actorUid: String(ownerUid), actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner',
      before: { checks: before.map(f => f.label_es || f.label_en) }, after: { checks: rows.map(r => r.label_es || r.label_en) },
    });
    res.json({ checks: ((await loadFunctions(listing.id)) || []).map(functionFromDb) });
  });

  // POST /units/:listingId/translate — body: { ownerUid, text, to: 'es' |
  // 'en', field: 'area' | 'name' | 'note' } → { text }. Fills in the other
  // language of a field the owner just changed in the item form. 503 when
  // translation isn't set up (no ANTHROPIC_API_KEY).
  router.post('/units/:listingId/translate', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, text: source, to, field } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    try {
      res.json({ text: await translate({ text: source, to, kind: field }) });
    } catch (e) {
      if (e instanceof TranslateError) return res.status(e.status).json({ error: e.message });
      console.warn('[unit-inventory] translate failed:', e && e.message);
      res.status(500).json({ error: 'Translation failed.' });
    }
  });

  // POST /units/:listingId/items — body: { ownerUid, actorName, items: [
  // { areaEn, areaEs, nameEn, nameEs, noteEn, noteEs, count,
  // countRequired? } ] }. Adds
  // one item or many (the CSV import sends the whole file). The count
  // given becomes both the baseline and the current count.
  router.post('/units/:listingId/items', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, items } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'No items to add.' });
    if (items.length > MAX_BULK_ITEMS) return res.status(400).json({ error: `Add at most ${MAX_BULK_ITEMS} items at a time.` });

    const { data: last } = await supabase.from('unit_inventory_items')
      .select('sort_order').eq('listing_id', listing.id)
      .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let sortOrder = (last?.sort_order || 0);

    const now = new Date().toISOString();
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';
    const rows = [];
    for (let i = 0; i < items.length; i++) {
      const parsed = parseItemFields(items[i]);
      if (parsed.error) return res.status(400).json({ error: `Item ${i + 1}: ${parsed.error}` });
      const count = parseCount(items[i]?.count ?? 0);
      if (count == null) return res.status(400).json({ error: `Item ${i + 1}: the count must be a whole number from 0 to ${MAX_COUNT}.` });
      sortOrder += 10;
      rows.push({
        id: 'uii_' + uuidv4().slice(0, 12),
        listing_id: listing.id,
        community_id: listing.community_id || 'kai',
        ...parsed.fields,
        baseline_count: count, baseline_set_at: now,
        current_count: count, current_note: '',
        // Sent only when set: an item is not required by default, and
        // leaving the column out keeps adding items working on a database
        // that doesn't have it yet.
        ...(items[i]?.countRequired === true ? { count_required: true } : {}),
        sort_order: sortOrder,
        created_at: now, updated_at: now,
      });
    }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('unit_inventory_items').insert(rows.slice(i, i + 500));
      if (error) return sendSupabaseError(res, error);
    }
    const evErr = await insertEvents(rows.map(r => eventRow(r, listing, {
      event_type: 'created',
      count_after: r.current_count, baseline_after: r.baseline_count,
      actor_type: 'owner', actor_name: actor, actor_uid: String(ownerUid), created_at: now,
    })));
    if (evErr) return sendSupabaseError(res, evErr);
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: 'add_items',
      actorUid: String(ownerUid), actorName: actor, after: { listingId: listing.id, added: rows.length },
    });
    res.json({ items: rows.map(itemFromDb) });
  });

  // PUT /items/:id — body: { ownerUid, actorName, areaEn, …, noteEs }.
  // Edits how an item is described. Counts are not changed here: the
  // current count goes through /counts and the baseline through
  // /rebaseline, so each has one path and one kind of history entry.
  router.put('/items/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName } = req.body || {};
    const { data: item, error: fErr } = await supabase.from('unit_inventory_items')
      .select('*').eq('id', req.params.id).maybeSingle();
    if (fErr) return sendSupabaseError(res, fErr);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    const listing = await requireOwnedUnit(res, item.listing_id, ownerUid);
    if (!listing) return;
    const parsed = parseItemFields(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    // Saving the form without changing anything is not an edit: nothing
    // is written and the history gets no empty entry.
    const changes = describeEdit(item, parsed.fields);
    if (!Object.keys(changes).length) return res.json({ item: itemFromDb(item) });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('unit_inventory_items')
      .update({ ...parsed.fields, updated_at: now }).eq('id', item.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    const evErr = await insertEvents([eventRow(data, listing, {
      event_type: 'edited',
      changes,
      actor_type: 'owner', actor_name: text(actorName, MAX_ACTOR) || listing.owner || 'Owner',
      actor_uid: String(ownerUid), created_at: now,
    })]);
    if (evErr) return sendSupabaseError(res, evErr);
    res.json({ item: itemFromDb(data) });
  });

  // POST /units/:listingId/areas/rename — body: { ownerUid, actorName,
  // fromEn, fromEs, toEn, toEs }. Renames an area: every item of the unit
  // filed under exactly (fromEn, fromEs) moves to (toEn, toEs). Naming it
  // like an area that already exists merges the two. Each item gets an
  // `edited` history entry; the rename itself goes to the audit log.
  router.post('/units/:listingId/areas/rename', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const from = { area_en: text(req.body?.fromEn, MAX_AREA), area_es: text(req.body?.fromEs, MAX_AREA) };
    const to = { area_en: text(req.body?.toEn, MAX_AREA), area_es: text(req.body?.toEs, MAX_AREA) };
    if (!to.area_en && !to.area_es) return res.status(400).json({ error: 'The area needs a name in English or Spanish.' });
    if (to.area_en === from.area_en && to.area_es === from.area_es) return res.json({ changed: 0 });
    const { data: rows, error: lErr } = await supabase.from('unit_inventory_items').select('*')
      .eq('listing_id', listing.id).eq('area_en', from.area_en).eq('area_es', from.area_es);
    if (lErr) return sendSupabaseError(res, lErr);
    if (!rows || !rows.length) return res.status(404).json({ error: 'That area has no items any more. Reload and try again.' });
    const now = new Date().toISOString();
    const { error } = await supabase.from('unit_inventory_items').update({ ...to, updated_at: now })
      .eq('listing_id', listing.id).eq('area_en', from.area_en).eq('area_es', from.area_es);
    if (error) return sendSupabaseError(res, error);
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';
    const evErr = await insertEvents(rows.map(r => eventRow({ ...r, ...to }, listing, {
      event_type: 'edited', changes: describeEdit(r, { ...r, ...to }),
      actor_type: 'owner', actor_name: actor, actor_uid: String(ownerUid), created_at: now,
    })));
    if (evErr) return sendSupabaseError(res, evErr);
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: 'rename_area',
      actorUid: String(ownerUid), actorName: actor,
      before: { areaEn: from.area_en, areaEs: from.area_es }, after: { areaEn: to.area_en, areaEs: to.area_es, items: rows.length },
    });
    res.json({ changed: rows.length });
  });

  // POST /units/:listingId/items/move — body: { ownerUid, actorName,
  // itemIds, toEn, toEs }. Moves some of the unit's items to an area —
  // an existing one or a new name — e.g. to split an area in two. Each
  // moved item gets an `edited` history entry; the move goes to the audit log.
  router.post('/units/:listingId/items/move', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const ids = Array.isArray(req.body?.itemIds) ? [...new Set(req.body.itemIds.map(String))] : [];
    if (!ids.length) return res.status(400).json({ error: 'Choose the items to move.' });
    if (ids.length > MAX_BULK_ITEMS) return res.status(400).json({ error: 'Too many items at once.' });
    const to = { area_en: text(req.body?.toEn, MAX_AREA), area_es: text(req.body?.toEs, MAX_AREA) };
    if (!to.area_en && !to.area_es) return res.status(400).json({ error: 'The area needs a name in English or Spanish.' });
    const { data: rows, error: lErr } = await supabase.from('unit_inventory_items').select('*')
      .eq('listing_id', listing.id).in('id', ids);
    if (lErr) return sendSupabaseError(res, lErr);
    if (!rows || rows.length !== ids.length) return res.status(409).json({ error: 'One of the items no longer exists. Reload and try again.' });
    const moving = rows.filter(r => (r.area_en || '') !== to.area_en || (r.area_es || '') !== to.area_es);
    if (!moving.length) return res.json({ changed: 0 });
    const now = new Date().toISOString();
    const { error } = await supabase.from('unit_inventory_items').update({ ...to, updated_at: now })
      .eq('listing_id', listing.id).in('id', moving.map(r => r.id));
    if (error) return sendSupabaseError(res, error);
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';
    const evErr = await insertEvents(moving.map(r => eventRow({ ...r, ...to }, listing, {
      event_type: 'edited', changes: describeEdit(r, { ...r, ...to }),
      actor_type: 'owner', actor_name: actor, actor_uid: String(ownerUid), created_at: now,
    })));
    if (evErr) return sendSupabaseError(res, evErr);
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: 'move_items',
      actorUid: String(ownerUid), actorName: actor,
      after: { areaEn: to.area_en, areaEs: to.area_es, items: moving.map(r => r.id) },
    });
    res.json({ changed: moving.length });
  });

  // DELETE /items/:id — body: { ownerUid, actorName }. The item's history
  // stays: events carry the item's names and are not tied to the row.
  router.delete('/items/:id', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName } = req.body || {};
    const { data: item, error: fErr } = await supabase.from('unit_inventory_items')
      .select('*').eq('id', req.params.id).maybeSingle();
    if (fErr) return sendSupabaseError(res, fErr);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    const listing = await requireOwnedUnit(res, item.listing_id, ownerUid);
    if (!listing) return;
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';
    const { error } = await supabase.from('unit_inventory_items').delete().eq('id', item.id);
    if (error) return sendSupabaseError(res, error);
    // Its photos go with it (best effort: the table may not exist yet).
    await supabase.from('unit_inventory_item_photos').delete().eq('item_id', item.id);
    const evErr = await insertEvents([eventRow(item, listing, {
      event_type: 'deleted',
      count_before: item.current_count, baseline_before: item.baseline_count,
      note_before: item.current_note || '',
      actor_type: 'owner', actor_name: actor, actor_uid: String(ownerUid),
      created_at: new Date().toISOString(),
    })]);
    if (evErr) return sendSupabaseError(res, evErr);
    await auditLog({
      entity: 'unit_inventory', entityId: item.id, action: 'delete_item',
      actorUid: String(ownerUid), actorName: actor, before: item,
    });
    res.json({ ok: true });
  });

  // POST /units/:listingId/counts — body: { ownerUid, actorName, updates }.
  // The owner counting their own unit; same rules as the cleaner's save.
  router.post('/units/:listingId/counts', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, updates } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const result = await applyCountUpdates({
      listing, updates, actorType: 'owner', lang: req.body?.lang,
      actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner', actorUid: String(ownerUid),
    });
    if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ changed: result.changed });
  });

  // An item of this unit, or null with the 404 already sent.
  const itemOfUnit = async (res, listing, itemId) => {
    const { data, error } = await supabase.from('unit_inventory_items')
      .select('*').eq('id', itemId).eq('listing_id', listing.id).maybeSingle();
    if (error) { sendSupabaseError(res, error); return null; }
    if (!data) { res.status(404).json({ error: 'Item not found.' }); return null; }
    return data;
  };
  // `first`: only the item's primary photo (the first one added), which
  // the item's card shows as a thumbnail.
  const loadItemPhotos = async (itemId, first = false) => {
    const q = supabase.from('unit_inventory_item_photos')
      .select('*').eq('item_id', itemId).order('created_at', { ascending: true });
    return first ? q.limit(1) : q;
  };
  // Sets the item's photo_count from what is actually stored.
  const recountItemPhotos = async (itemId) => {
    const { data, error } = await supabase.from('unit_inventory_item_photos').select('id').eq('item_id', itemId);
    if (error) return { error };
    const { error: uErr } = await supabase.from('unit_inventory_items').update({ photo_count: data.length }).eq('id', itemId);
    return { error: uErr, count: data.length };
  };

  // GET /units/:listingId/items/:itemId/photos?ownerUid= — an item's photos
  // (`&first=1`: only the primary one).
  router.get('/units/:listingId/items/:itemId/photos', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const item = await itemOfUnit(res, listing, req.params.itemId);
    if (!item) return;
    const { data, error } = await loadItemPhotos(item.id, req.query.first === '1');
    if (error) return sendSupabaseError(res, error);
    res.json({ photos: (data || []).map(itemPhotoFromDb) });
  });

  // POST /units/:listingId/items/:itemId/photos — body: { ownerUid,
  // actorName, photo }. The owner adds a photo of the item. `photo` is a
  // JPEG data URL the page has already shrunk.
  router.post('/units/:listingId/items/:itemId/photos', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, photo } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const item = await itemOfUnit(res, listing, req.params.itemId);
    if (!item) return;
    const data = cleanPhoto(photo);
    if (!data) return res.status(400).json({ error: 'The photo must be an image of at most 2 MB.' });
    const { data: existing, error: eErr } = await supabase.from('unit_inventory_item_photos').select('id').eq('item_id', item.id);
    if (eErr) return sendSupabaseError(res, eErr);
    if ((existing || []).length >= MAX_ITEM_PHOTOS) return res.status(400).json({ error: `An item can have at most ${MAX_ITEM_PHOTOS} photos. Delete one first.` });
    const row = {
      id: 'uph_' + uuidv4().slice(0, 12),
      listing_id: listing.id, community_id: listing.community_id || 'kai', item_id: item.id,
      data, created_by: text(actorName, MAX_ACTOR) || listing.owner || 'Owner',
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('unit_inventory_item_photos').insert(row);
    if (error) return sendSupabaseError(res, error);
    const counted = await recountItemPhotos(item.id);
    if (counted.error) return sendSupabaseError(res, counted.error);
    res.json({ photo: itemPhotoFromDb(row), photoCount: counted.count });
  });

  // DELETE /units/:listingId/items/:itemId/photos/:photoId — body:
  // { ownerUid }. The owner removes one photo.
  router.delete('/units/:listingId/items/:itemId/photos/:photoId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.body?.ownerUid);
    if (!listing) return;
    const item = await itemOfUnit(res, listing, req.params.itemId);
    if (!item) return;
    const { data: gone, error } = await supabase.from('unit_inventory_item_photos')
      .delete().eq('id', req.params.photoId).eq('item_id', item.id).select('id');
    if (error) return sendSupabaseError(res, error);
    if (!gone || !gone.length) return res.status(404).json({ error: 'Photo not found.' });
    const counted = await recountItemPhotos(item.id);
    if (counted.error) return sendSupabaseError(res, counted.error);
    res.json({ photoCount: counted.count });
  });

  // POST /units/:listingId/required — body: { ownerUid, actorName,
  // itemIds, required }. Flags (or unflags) items as ones to count at
  // every checkout — one item, or a whole area at once. It changes what
  // is asked of the cleaning service, not any count, so it is recorded in
  // the audit log rather than in each item's count history.
  router.post('/units/:listingId/required', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, itemIds, required } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    if (typeof required !== 'boolean') return res.status(400).json({ error: 'Say whether the items are required or not.' });
    if (!Array.isArray(itemIds) || !itemIds.length) return res.status(400).json({ error: 'No items selected.' });
    if (itemIds.length > MAX_BULK_ITEMS) return res.status(400).json({ error: `Change at most ${MAX_BULK_ITEMS} items at a time.` });
    const { data: rows, error } = await loadItems(listing.id);
    if (error) return sendSupabaseError(res, error);
    const wanted = new Set(itemIds.map(String));
    // Only this unit's items, and only those the change actually moves.
    const targets = (rows || []).filter(r => wanted.has(r.id) && !!r.count_required !== required).map(r => r.id);
    const now = new Date().toISOString();
    for (let i = 0; i < targets.length; i += 100) {
      const { error: uErr } = await supabase.from('unit_inventory_items')
        .update({ count_required: required, updated_at: now })
        .eq('listing_id', listing.id).in('id', targets.slice(i, i + 100));
      if (uErr) return sendSupabaseError(res, uErr);
    }
    if (targets.length) {
      await auditLog({
        entity: 'unit_inventory', entityId: listing.id, action: 'set_required',
        actorUid: String(ownerUid), actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner',
        after: { required, changed: targets.length, itemIds: targets.slice(0, 200) },
      });
    }
    res.json({ changed: targets.length });
  });

  // POST /units/:listingId/rebaseline — body: { ownerUid, actorName,
  // itemIds? }. Accepts the current counts as the new baseline, for the
  // listed items or — with no list — every item whose count has drifted.
  // The owner's only way to move a baseline once an item exists.
  router.post('/units/:listingId/rebaseline', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, itemIds } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const { data: rows, error } = await loadItems(listing.id);
    if (error) return sendSupabaseError(res, error);
    const only = Array.isArray(itemIds) && itemIds.length ? new Set(itemIds.map(String)) : null;
    const targets = (rows || []).filter(r => r.baseline_count !== r.current_count && (!only || only.has(r.id)));
    if (!targets.length) return res.json({ changed: 0 });

    const now = new Date().toISOString();
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';
    for (const item of targets) {
      const { error: uErr } = await supabase.from('unit_inventory_items')
        .update({ baseline_count: item.current_count, baseline_set_at: now, updated_at: now })
        .eq('id', item.id);
      if (uErr) return sendSupabaseError(res, uErr);
    }
    const evErr = await insertEvents(targets.map(item => eventRow(item, listing, {
      event_type: 'rebaseline',
      baseline_before: item.baseline_count, baseline_after: item.current_count,
      count_before: item.current_count, count_after: item.current_count,
      actor_type: 'owner', actor_name: actor, actor_uid: String(ownerUid), created_at: now,
    })));
    if (evErr) return sendSupabaseError(res, evErr);
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: 'rebaseline',
      actorUid: String(ownerUid), actorName: actor, after: { listingId: listing.id, items: targets.length },
    });
    res.json({ changed: targets.length });
  });

  // GET /units/:listingId/history?ownerUid=&itemId= — most recent first.
  router.get('/units/:listingId/history', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    let q = supabase.from('unit_inventory_events').select('*').eq('listing_id', listing.id)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(500);
    const itemId = text(req.query.itemId, 60);
    if (itemId) q = q.eq('item_id', itemId);
    const { data, error } = await q;
    if (error) return sendSupabaseError(res, error);
    // Completed counts belong to the unit, not to one item, so they are
    // left out when the history is narrowed to an item. As in
    // loadLastCheck, a missing table reads as none.
    let checks = [];
    if (!itemId) {
      const { data: checkRows } = await supabase.from('unit_inventory_checks').select('*').eq('listing_id', listing.id)
        .order('created_at', { ascending: false }).limit(200);
      checks = (checkRows || []).map(checkFromDb);
    }
    res.json({ events: (data || []).map(eventFromDb), checks });
  });

  // POST /units/:listingId/checks — body: { ownerUid, actorName,
  // updates? }. The owner marks their own count of the unit as complete.
  router.post('/units/:listingId/checks', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, updates } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const result = await completeCount({
      listing, updates, req, actorType: 'owner', lang: req.body?.lang,
      actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner', actorUid: String(ownerUid),
    });
    if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  });

  // GET /units/:listingId/checks?ownerUid= — the unit's completed counts,
  // newest first: one per checkout, each dated.
  router.get('/units/:listingId/checks', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const { data } = await supabase.from('unit_inventory_checks').select('*').eq('listing_id', listing.id)
      .order('created_at', { ascending: false }).limit(200);
    res.json({ checks: (data || []).map(checkFromDb), videoStorage: await videoStorageUse() });
  });

  // GET /units/:listingId/checks/:checkId?ownerUid= — one checkout's
  // report: the count as it stood and the damage reported with it, photos
  // included.
  router.get('/units/:listingId/checks/:checkId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const { data: check, error } = await supabase.from('unit_inventory_checks')
      .select('*').eq('id', req.params.checkId).eq('listing_id', listing.id).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!check) return res.status(404).json({ error: 'Report not found.' });
    const { data: damages } = await supabase.from('unit_inventory_damages')
      .select('*').eq('listing_id', listing.id).eq('check_id', check.id).order('created_at', { ascending: true });
    res.json({
      check: checkFromDb(check),
      results: Array.isArray(check.results) ? check.results : [],
      damages: (damages || []).map(r => damageFromDb(r, true)),
    });
  });

  // GET /units/:listingId/checks/:checkId/items/:itemId/photos?ownerUid=
  // — the proof photos of one item at one checkout. Empty once that
  // checkout is older than the ones photos are kept for.
  router.get('/units/:listingId/checks/:checkId/items/:itemId/photos', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const { data, error } = await supabase.from('unit_inventory_count_photos')
      .select('*').eq('listing_id', listing.id).eq('check_id', req.params.checkId).eq('item_id', req.params.itemId)
      .order('created_at', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    res.json({ photos: (data || []).map(itemPhotoFromDb) });
  });

  // GET /units/:listingId/checks/:checkId/videos?ownerUid= — the
  // checkout's video(s), each with a link to watch it that works for an
  // hour. Empty once the checkout is older than the ones videos are kept
  // for.
  router.get('/units/:listingId/checks/:checkId/videos', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const { data, error } = await supabase.from('unit_inventory_videos')
      .select('*').eq('listing_id', listing.id).eq('check_id', req.params.checkId).eq('status', 'ready')
      .order('created_at', { ascending: true });
    if (error) return sendSupabaseError(res, error);
    const store = videoStore();
    const videos = [];
    for (const v of data || []) {
      const { data: link, error: lErr } = store ? await store.createSignedUrl(v.path, VIDEO_URL_SECONDS) : { error: true };
      // A second link that downloads the file, named with the unit and the
      // time it was recorded — ready to attach to an Airbnb claim.
      const name = videoFileName(listing, v);
      const { data: dl, error: dErr } = store ? await store.createSignedUrl(v.path, VIDEO_URL_SECONDS, { download: name }) : { error: true };
      // For sharing where a phone can't send the file itself: a download
      // link that lasts a week.
      const { data: sh, error: sErr } = store ? await store.createSignedUrl(v.path, VIDEO_SHARE_SECONDS, { download: name }) : { error: true };
      videos.push({
        ...videoFromDb(v), url: lErr || !link ? '' : link.signedUrl, downloadUrl: dErr || !dl ? '' : dl.signedUrl,
        shareUrl: sErr || !sh ? '' : sh.signedUrl, shareDays: VIDEO_SHARE_SECONDS / 86400, fileName: name,
      });
    }
    res.json({ videos });
  });

  // POST /units/:listingId/videos/:videoId/keep — body: { ownerUid,
  // actorName, keep }. Marks a completed count's video as evidence (for a
  // claim), so storage recycling never deletes it; `keep: false` releases it.
  router.post('/units/:listingId/videos/:videoId/keep', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, keep } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    const { data: video, error: fErr } = await supabase.from('unit_inventory_videos')
      .select('*').eq('id', req.params.videoId).eq('listing_id', listing.id).maybeSingle();
    if (fErr) return sendSupabaseError(res, fErr);
    if (!video || !video.check_id) return res.status(404).json({ error: 'Video not found.' });
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';
    const patch = keep === true ? { keep: true, kept_by: actor, kept_at: new Date().toISOString() } : { keep: false, kept_by: '', kept_at: null };
    const { error } = await supabase.from('unit_inventory_videos').update(patch).eq('id', video.id);
    if (error) {
      if (/keep|kept_/.test(error.message || '')) return res.status(400).json({ error: 'Keeping videos needs the latest database update: run supabase/unit_inventory.sql.' });
      return sendSupabaseError(res, error);
    }
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: keep === true ? 'keep_video' : 'release_video',
      actorUid: String(ownerUid), actorName: actor, after: { videoId: video.id, checkId: video.check_id },
    });
    res.json({ video: videoFromDb({ ...video, ...patch }) });
  });

  // GET /units/:listingId/damages/:damageId?ownerUid= — one damage report
  // with its photos.
  router.get('/units/:listingId/damages/:damageId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const { data, error } = await supabase.from('unit_inventory_damages')
      .select('*').eq('id', req.params.damageId).eq('listing_id', listing.id).maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!data) return res.status(404).json({ error: 'Damage report not found.' });
    res.json({ damage: damageFromDb(data, true) });
  });

  // POST /damages/:id/status — body: { ownerUid, actorName, status:
  // 'resolved' | 'open' }. The owner closes a damage report once it is
  // dealt with (or reopens it). The report itself is never deleted.
  router.post('/damages/:id/status', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, status } = req.body || {};
    const { data: damage, error: dErr } = await supabase.from('unit_inventory_damages')
      .select(DAMAGE_LIST_COLUMNS).eq('id', req.params.id).maybeSingle();
    const resolution = RESOLUTIONS.includes(req.body?.resolution) ? req.body.resolution : '';
    const reply = text(req.body?.reply, MAX_NOTE);
    if (dErr) return sendSupabaseError(res, dErr);
    if (!damage) return res.status(404).json({ error: 'Damage report not found.' });
    const listing = await requireOwnedUnit(res, damage.listing_id, ownerUid);
    if (!listing) return;
    if (!['resolved', 'open'].includes(status)) return res.status(400).json({ error: 'Unknown status.' });
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';
    const patch = status === 'resolved'
      ? { status, resolved_at: new Date().toISOString(), resolved_by: actor }
      : { status, resolved_at: null, resolved_by: '' };
    // How it was solved and the owner's answer, where the columns exist.
    const extra = status === 'resolved' ? { resolution, owner_reply: reply } : { resolution: '', owner_reply: '' };
    let { error } = await supabase.from('unit_inventory_damages').update({ ...patch, ...extra }).eq('id', damage.id);
    if (error && /resolution|owner_reply/.test(error.message || '')) {
      if (resolution || reply) return res.status(503).json({ error: 'Replies need the latest database update: run supabase/unit_inventory.sql in the Supabase SQL Editor.' });
      ({ error } = await supabase.from('unit_inventory_damages').update(patch).eq('id', damage.id));
    }
    if (error) return sendSupabaseError(res, error);
    // Replaced: the item is back, so its count returns to what is expected.
    let restored = false;
    if (status === 'resolved' && req.body?.restoreCount && damage.item_id) {
      const { data: item } = await supabase.from('unit_inventory_items').select('id, baseline_count, current_count')
        .eq('listing_id', listing.id).eq('id', damage.item_id).maybeSingle();
      if (item && item.current_count !== item.baseline_count) {
        const result = await applyCountUpdates({ listing, updates: [{ itemId: item.id, count: item.baseline_count }], actorType: 'owner', actorName: actor, actorUid: String(ownerUid) });
        if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
        restored = !result.error;
      }
    }
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: status === 'resolved' ? 'resolve_damage' : 'reopen_damage',
      actorUid: String(ownerUid), actorName: actor, after: { damageId: damage.id, description: damage.description },
    });
    res.json({ damage: damageFromDb({ ...damage, ...patch, ...extra }), restored });
  });

  // POST /proposals/:id/decision — body: { ownerUid, actorName, action:
  // 'approve' | 'reject' }. Approving turns the proposal into an item:
  // the proposed count becomes its baseline and current count, and the
  // cleaner's note its count note. Rejecting only closes the proposal.
  router.post('/proposals/:id/decision', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, action } = req.body || {};
    const { data: proposal, error: pErr } = await supabase.from('unit_inventory_proposals')
      .select('*').eq('id', req.params.id).maybeSingle();
    if (pErr) return sendSupabaseError(res, pErr);
    if (!proposal) return res.status(404).json({ error: 'Proposed item not found.' });
    const listing = await requireOwnedUnit(res, proposal.listing_id, ownerUid);
    if (!listing) return;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Unknown action.' });
    if (proposal.status !== 'pending') return res.status(409).json({ error: 'This item was already decided. Reload to see the current list.' });
    const now = new Date().toISOString();
    const actor = text(actorName, MAX_ACTOR) || listing.owner || 'Owner';

    let item = null;
    if (action === 'approve') {
      const { data: last } = await supabase.from('unit_inventory_items')
        .select('sort_order').eq('listing_id', listing.id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
      item = {
        id: 'uii_' + uuidv4().slice(0, 12),
        listing_id: listing.id,
        community_id: listing.community_id || 'kai',
        area_en: proposal.area_en || '', area_es: proposal.area_es || '',
        name_en: proposal.name_en || '', name_es: proposal.name_es || '',
        note_en: '', note_es: '',
        baseline_count: proposal.count, baseline_set_at: now,
        current_count: proposal.count, current_note: proposal.note || '',
        count_updated_at: proposal.created_at, count_updated_by: proposal.proposed_by || '',
        sort_order: (last?.sort_order || 0) + 10,
        created_at: now, updated_at: now,
      };
      const { error: iErr } = await supabase.from('unit_inventory_items').insert(item);
      if (iErr) return sendSupabaseError(res, iErr);
      const evErr = await insertEvents([eventRow(item, listing, {
        event_type: 'created',
        count_after: proposal.count, baseline_after: proposal.count,
        note_after: proposal.note || '',
        // Who asked for it; the actor is the owner who let it in.
        changes: { proposedBy: proposal.proposed_by || '' },
        actor_type: 'owner', actor_name: actor, actor_uid: String(ownerUid), created_at: now,
      })]);
      if (evErr) return sendSupabaseError(res, evErr);
    }
    const { error: uErr } = await supabase.from('unit_inventory_proposals').update({
      status: action === 'approve' ? 'approved' : 'rejected',
      decided_at: now, decided_by: actor, item_id: item ? item.id : null,
    }).eq('id', proposal.id);
    if (uErr) return sendSupabaseError(res, uErr);
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: action === 'approve' ? 'approve_item' : 'reject_item',
      actorUid: String(ownerUid), actorName: actor,
      after: { proposalId: proposal.id, proposedBy: proposal.proposed_by || '', name: proposal.name_es || proposal.name_en, count: proposal.count, itemId: item ? item.id : null },
    });
    res.json({ item: item ? itemFromDb(item) : null });
  });

  // POST /units/:listingId/link — body: { ownerUid, actorName, action:
  // 'enable' | 'disable' | 'regenerate' }. Enabling creates the link the
  // first time. Regenerating replaces the token, which is how the owner
  // cuts off someone who already has the old link.
  router.post('/units/:listingId/link', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const { ownerUid, actorName, action } = req.body || {};
    const listing = await requireOwnedUnit(res, req.params.listingId, ownerUid);
    if (!listing) return;
    if (!['enable', 'disable', 'regenerate'].includes(action)) return res.status(400).json({ error: 'Unknown action.' });
    const now = new Date().toISOString();
    const existing = await loadLink(listing.id);
    const row = {
      listing_id: listing.id,
      community_id: listing.community_id || 'kai',
      token: (!existing || action === 'regenerate') ? crypto.randomBytes(24).toString('base64url') : existing.token,
      enabled: action === 'disable' ? false : (action === 'enable' ? true : (existing ? existing.enabled : true)),
      updated_at: now,
    };
    const { error } = await supabase.from('unit_inventory_links').upsert(row, { onConflict: 'listing_id' });
    if (error) return sendSupabaseError(res, error);
    await auditLog({
      entity: 'unit_inventory', entityId: listing.id, action: 'link_' + action,
      actorUid: String(ownerUid), actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner',
    });
    res.json({ link: { token: row.token, enabled: row.enabled, updatedAt: now } });
  });

  // ── Cleaning service (share link, no login) ──────────────────────────

  // The unit a link opens: the unit's general link, or a person's own
  // link — then the listing carries `person` ({ id, name }, not
  // enumerable, so it never ends up in a row), whose name is used for
  // everything done through it.
  const unitForToken = async (res, token) => {
    const t = String(token || '');
    let { data: link, error } = await supabase.from('unit_inventory_links')
      .select('listing_id, enabled').eq('token', t).maybeSingle();
    if (error) { sendSupabaseError(res, error); return null; }
    let person = null;
    if (!link && t) {
      // A database without the people table reads as no such person.
      const { data: p } = await supabase.from('unit_inventory_people')
        .select('id, listing_id, name, enabled').eq('token', t).maybeSingle();
      if (p) { person = { id: p.id, name: p.name || '' }; link = { listing_id: p.listing_id, enabled: p.enabled }; }
    }
    // One answer for an unknown link and a switched-off one, so the
    // response doesn't confirm which tokens ever existed.
    if (!link || !link.enabled) { res.status(404).json({ error: 'This inventory link is not active. Ask the owner for a new one.' }); return null; }
    // The whole row: proposing an item needs the owner's uid and email to
    // notify them. None of it is sent back to the link holder.
    const { data: listing, error: lErr } = await supabase.from('listings')
      .select('*').eq('id', link.listing_id).maybeSingle();
    if (lErr) { sendSupabaseError(res, lErr); return null; }
    if (!listing) { res.status(404).json({ error: 'This inventory link is not active. Ask the owner for a new one.' }); return null; }
    if (person) Object.defineProperty(listing, 'person', { value: person, enumerable: false });
    return listing;
  };
  // Who did something through a link: the person whose link it is, or
  // the name typed on the page.
  const cleanerName = (req, listing) => (listing.person && listing.person.name) || text(req.body?.name, MAX_ACTOR) || 'Cleaning service';

  // GET /shared/:token — what the cleaner's page shows: the unit's label,
  // its items, when it was last counted in full, and the items proposed
  // through the link that still wait for the owner. Nothing about the
  // owner or the history.
  router.get('/shared/:token', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    // When the owner last saw this person use their link. Best effort.
    if (listing.person) {
      supabase.from('unit_inventory_people').update({ last_seen_at: new Date().toISOString() }).eq('id', listing.person.id)
        .then(() => {}, () => {});
    }
    const { data, error } = await loadItems(listing.id);
    if (error) return sendSupabaseError(res, error);
    res.json({
      unit: { apt: listing.apt, tower: listing.tower || '' }, items: (data || []).map(itemFromDb),
      lastCheck: await loadLastCheck(listing.id), proposals: await loadPendingProposals(listing.id),
      damages: (await visitDamages(listing.id)).map(r => damageFromDb(r)),
      ...(await (async () => {
        // How many proof photos each item has from this visit, and whether
        // the server can ask for them at all.
        const proofs = await visitProofs(listing.id);
        const proofCounts = {};
        for (const ph of proofs || []) proofCounts[ph.item_id] = (proofCounts[ph.item_id] || 0) + 1;
        // Item photos are optional; the flag says the page may offer them.
        return { proofEnabled: proofs !== null, proofCounts };
      })()),
      ...(await (async () => {
        // This visit's video(s), and whether one is required to finish.
        const videos = await visitVideos(listing.id);
        return { videoRequired: videos !== null, videos: (videos || []).map(videoFromDb) };
      })()),
      // Whether a damage photo can suggest which item it shows.
      suggestEnabled: translateEnabled(),
      // Whose link this is (their name is used for everything they do).
      person: listing.person ? { name: listing.person.name } : null,
      // Every open damage report (so nothing is reported twice) and those
      // the owner closed in the last week, with how and their answer.
      openDamages: (await loadDamages(listing.id, q => q.eq('status', 'open'))).map(r => damageFromDb(r)),
      damageNews: (await loadDamages(listing.id, q => q.eq('status', 'resolved')
        .gte('resolved_at', new Date(Date.now() - DAMAGE_NEWS_DAYS * 86400000).toISOString()))).map(r => damageFromDb(r)),
      // The owner's notes: open ones, and those done during this visit.
      tasks: (((await loadTasks(listing.id, ['open', 'done'])) || [])
        .filter(t => t.status === 'open' || (t.done_at && t.done_at >= visitSince()))).map(taskFromDb),
      // The working checks to answer, and this visit's answers so far.
      ...(await (async () => {
        const fs = (await loadFunctions(listing.id)) || [];
        if (!fs.length) return { functionChecks: [], functionAnswers: {} };
        const answers = await visitFunctionAnswers(listing.id);
        const out = {};
        for (const f of fs) if (answers[f.id]) out[f.id] = answerFromDb(answers[f.id]);
        return { functionChecks: fs.map(functionFromDb), functionAnswers: out };
      })()),
    });
  });

  // GET /shared/:token/items/:itemId/photos — an item's photos (`?first=1`:
  // only the primary one, for the card's thumbnail), so the
  // cleaning service can see what it is. View only.
  router.get('/shared/:token/items/:itemId/photos', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const item = await itemOfUnit(res, listing, req.params.itemId);
    if (!item) return;
    const { data, error } = await loadItemPhotos(item.id, req.query.first === '1');
    if (error) return sendSupabaseError(res, error);
    res.json({ photos: (data || []).map(itemPhotoFromDb) });
  });

  // The checkout video. Recording happens on the phone; the file goes
  // straight to Supabase Storage through a signed upload URL, so it never
  // passes through this server. Three steps: ask for the URL (a row is
  // created as 'uploading'), upload, then say it is done (the server
  // checks the file is there and marks the row 'ready').

  // A video row of this unit, unattached to any count, or null with the
  // response already sent.
  const visitVideo = async (res, listing, videoId) => {
    const { data, error } = await supabase.from('unit_inventory_videos')
      .select('*').eq('id', videoId).eq('listing_id', listing.id).maybeSingle();
    if (error) { sendSupabaseError(res, error); return null; }
    if (!data || data.check_id) { res.status(404).json({ error: 'Video not found.' }); return null; }
    return data;
  };

  // POST /shared/:token/videos — body: { name, contentType, size,
  // duration }. Returns { video: { id }, uploadUrl }: the page PUTs the
  // file to uploadUrl with that Content-Type.
  router.post('/shared/:token/videos', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const store = videoStore();
    if (!store) return res.status(500).json({ error: 'Video storage is not available.' });
    const contentType = String(req.body?.contentType || '').split(';')[0].trim().toLowerCase();
    const ext = VIDEO_TYPES[contentType];
    if (!ext) return res.status(400).json({ error: 'The video must be MP4, WebM or MOV.' });
    const size = Number(req.body?.size);
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'The video is empty.' });
    if (size > MAX_VIDEO_BYTES) return res.status(400).json({ error: `The video is too large (at most ${Math.round(MAX_VIDEO_BYTES / 1048576)} MB). Record a shorter one.` });
    const duration = Math.max(0, Math.round(Number(req.body?.duration) || 0));
    if (duration > MAX_VIDEO_SECONDS + 15) return res.status(400).json({ error: `The video is too long (at most ${MAX_VIDEO_SECONDS / 60} minutes).` });
    const { data: visit, error: vErr } = await supabase.from('unit_inventory_videos')
      .select('id').eq('listing_id', listing.id).is('check_id', null).gte('created_at', visitSince()).limit(MAX_VISIT_VIDEOS * 3);
    if (vErr) return sendSupabaseError(res, vErr);
    if ((visit || []).length >= MAX_VISIT_VIDEOS * 3) return res.status(400).json({ error: 'Too many videos for this visit. Delete one first.' });
    // Full? The oldest videos make way for this one.
    await makeVideoRoom(Math.round(size));
    const id = 'uvd_' + uuidv4().slice(0, 12);
    const path = `${listing.id}/${id}.${ext}`;
    let signed = await store.createSignedUploadUrl(path);
    // The bucket is created by schema.sql; if that wasn't run, make it now.
    if (signed.error && /bucket not found|not found/i.test(signed.error.message || '')) {
      await supabase.storage.createBucket(VIDEO_BUCKET, { public: false, fileSizeLimit: MAX_VIDEO_BYTES, allowedMimeTypes: Object.keys(VIDEO_TYPES) });
      signed = await store.createSignedUploadUrl(path);
    }
    if (signed.error) return sendSupabaseError(res, signed.error);
    const row = {
      id, listing_id: listing.id, community_id: listing.community_id || 'kai',
      check_id: null, path, content_type: contentType, size_bytes: Math.round(size), duration_seconds: duration,
      status: 'uploading', taken_by: cleanerName(req, listing),
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('unit_inventory_videos').insert(row);
    if (error) return sendSupabaseError(res, error);
    res.json({ video: { id }, uploadUrl: signed.data.signedUrl, contentType });
  });

  // POST /shared/:token/videos/:videoId/done — the upload has finished.
  router.post('/shared/:token/videos/:videoId/done', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const video = await visitVideo(res, listing, req.params.videoId);
    if (!video) return;
    const store = videoStore();
    const [folder, file] = video.path.split('/');
    const { data: found, error } = await store.list(folder, { search: file, limit: 5 });
    if (error) return sendSupabaseError(res, error);
    const object = (found || []).find(o => o.name === file);
    if (!object) return res.status(400).json({ error: 'The video did not arrive. Try sending it again.' });
    const size = Number(object.metadata?.size) || video.size_bytes;
    if (size > MAX_VIDEO_BYTES) {
      await dropVideos([video]);
      return res.status(400).json({ error: 'The video is too large. Record a shorter one.' });
    }
    const { error: uErr } = await supabase.from('unit_inventory_videos').update({ status: 'ready', size_bytes: size }).eq('id', video.id);
    if (uErr) return sendSupabaseError(res, uErr);
    // The real size can differ from the one declared: check the limit again.
    if (size > video.size_bytes) setImmediate(() => makeVideoRoom(0));
    res.json({ video: videoFromDb({ ...video, status: 'ready', size_bytes: size }) });
  });

  // DELETE /shared/:token/videos/:videoId — removes a video taken this
  // visit (to record it again). Once the count is completed it stays.
  router.delete('/shared/:token/videos/:videoId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const video = await visitVideo(res, listing, req.params.videoId);
    if (!video) return;
    await dropVideos([video]);
    res.json({ ok: true });
  });

  // Proof photos: the cleaning service's pictures of an item at this
  // checkout. Each is saved as it is taken, unattached, and joins the
  // count's record when the count is completed.

  // This visit's unattached proof photos of one item.
  const itemVisitProofs = (listing, itemId) => supabase.from('unit_inventory_count_photos')
    .select('*').eq('listing_id', listing.id).eq('item_id', itemId)
    .is('check_id', null).gte('created_at', visitSince()).order('created_at', { ascending: true });

  // GET /shared/:token/items/:itemId/proof — the photos taken of this
  // item during this visit.
  router.get('/shared/:token/items/:itemId/proof', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const item = await itemOfUnit(res, listing, req.params.itemId);
    if (!item) return;
    const { data, error } = await itemVisitProofs(listing, item.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ photos: (data || []).map(itemPhotoFromDb) });
  });

  // POST /shared/:token/items/:itemId/proof — body: { name, photo }.
  router.post('/shared/:token/items/:itemId/proof', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const item = await itemOfUnit(res, listing, req.params.itemId);
    if (!item) return;
    const data = cleanPhoto(req.body?.photo);
    if (!data) return res.status(400).json({ error: 'The photo must be an image of at most 2 MB.' });
    const { data: existing, error: eErr } = await itemVisitProofs(listing, item.id);
    if (eErr) return sendSupabaseError(res, eErr);
    if ((existing || []).length >= MAX_PROOF_PHOTOS) return res.status(400).json({ error: `At most ${MAX_PROOF_PHOTOS} photos per item. Delete one first.` });
    const row = {
      id: 'ucp_' + uuidv4().slice(0, 12),
      listing_id: listing.id, community_id: listing.community_id || 'kai',
      item_id: item.id, check_id: null, data,
      taken_by: cleanerName(req, listing),
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('unit_inventory_count_photos').insert(row);
    if (error) return sendSupabaseError(res, error);
    res.json({ photo: itemPhotoFromDb(row), proofCount: (existing || []).length + 1 });
  });

  // DELETE /shared/:token/items/:itemId/proof/:photoId — removes a photo
  // taken this visit (a blurred one, say). Once the count is completed
  // its photos can no longer be removed through the link.
  router.delete('/shared/:token/items/:itemId/proof/:photoId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const item = await itemOfUnit(res, listing, req.params.itemId);
    if (!item) return;
    const { data: gone, error } = await supabase.from('unit_inventory_count_photos')
      .delete().eq('id', req.params.photoId).eq('listing_id', listing.id).eq('item_id', item.id).is('check_id', null).select('id');
    if (error) return sendSupabaseError(res, error);
    if (!gone || !gone.length) return res.status(404).json({ error: 'Photo not found.' });
    const { data: left } = await itemVisitProofs(listing, item.id);
    res.json({ proofCount: (left || []).length });
  });

  // POST /shared/:token/counts — body: { name, updates }. `name` is
  // whatever the person typed; it is recorded with the change so the
  // owner can see who counted, but it is not verified.
  router.post('/shared/:token/counts', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const result = await applyCountUpdates({
      listing, updates: req.body?.updates, actorType: 'cleaner', lang: req.body?.lang,
      actorName: cleanerName(req, listing), actorUid: '',
    });
    if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ changed: result.changed });
  });

  // POST /shared/:token/checks — body: { name, updates? }. The cleaning
  // service marks the count as complete, saving any counts still unsaved
  // on their screen in the same request.
  router.post('/shared/:token/checks', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const result = await completeCount({
      listing, updates: req.body?.updates, req, actorType: 'cleaner', lang: req.body?.lang,
      actorName: cleanerName(req, listing), actorUid: '',
    });
    if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
    // A refusal for missing proof photos says which items, so the page can take the person to them.
    if (result.error) {
      return res.status(result.status).json({
        error: result.error, ...(result.videoMissing ? { videoMissing: true } : {}),
        ...(result.functionsMissing ? { functionsMissing: result.functionsMissing } : {}),
      });
    }
    res.json(result);
  });

  // POST /shared/:token/tasks/:taskId — body: { name, done: true |
  // false, note? }. The cleaning service ticks off one of the owner's notes
  // (or unticks one it ticked during this visit). → { task }.
  router.post('/shared/:token/tasks/:taskId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const { data: task, error: tErr } = await supabase.from('unit_inventory_tasks').select('*')
      .eq('listing_id', listing.id).eq('id', req.params.taskId).maybeSingle();
    if (tErr) return sendSupabaseError(res, tErr);
    if (!task || task.status === 'archived') return res.status(404).json({ error: 'That note is no longer on the list. Reload the page.' });
    let patch;
    if (req.body?.done === false) {
      if (task.status !== 'done' || !task.done_at || task.done_at < visitSince()) return res.status(400).json({ error: 'Only a note ticked during this visit can be unticked.' });
      patch = { status: 'open', done_by: '', done_at: null, done_note: '' };
    } else {
      patch = { status: 'done', done_by: cleanerName(req, listing), done_at: new Date().toISOString(), done_note: text(req.body?.note, MAX_NOTE) };
    }
    const { error } = await supabase.from('unit_inventory_tasks').update(patch).eq('id', task.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ task: taskFromDb({ ...task, ...patch }) });
  });

  // POST /shared/:token/functions/:checkId — body: { name, status: 'ok' |
  // 'fail', note?, batteries? } (batteries: changed to make it work). The cleaning service says whether a working check
  // works at this visit; a new answer replaces the visit's earlier one.
  router.post('/shared/:token/functions/:checkId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const status = req.body?.status;
    if (!['ok', 'fail'].includes(status)) return res.status(400).json({ error: 'Say whether it works.' });
    const { data: fc, error: fErr } = await supabase.from('unit_inventory_function_checks')
      .select('id').eq('listing_id', listing.id).eq('id', req.params.checkId).maybeSingle();
    if (fErr) return sendSupabaseError(res, fErr);
    if (!fc) return res.status(404).json({ error: 'That check is no longer on the list. Reload the page.' });
    const { error: dErr } = await supabase.from('unit_inventory_function_results').delete()
      .eq('listing_id', listing.id).eq('function_check_id', fc.id);
    if (dErr) return sendSupabaseError(res, dErr);
    const row = {
      id: 'uifr_' + uuidv4().slice(0, 12), listing_id: listing.id, community_id: listing.community_id || 'kai',
      function_check_id: fc.id, status, note: text(req.body?.note, MAX_FUNCTION_NOTE),
      answered_by: cleanerName(req, listing), created_at: new Date().toISOString(),
      batteries: !!req.body?.batteries,
    };
    let { error } = await supabase.from('unit_inventory_function_results').insert(row);
    // Without the batteries column yet, say it in the note instead.
    if (error && /batteries/.test(error.message || '')) {
      const { batteries, ...bare } = row;
      if (batteries) bare.note = ('🔋 Pilas cambiadas. ' + bare.note).trim();
      ({ error } = await supabase.from('unit_inventory_function_results').insert(bare));
    }
    if (error) return sendSupabaseError(res, error);
    res.json({ answer: answerFromDb(row) });
  });

  // POST /shared/:token/proposals — body: { name, item: { areaEn, areaEs,
  // nameEn, nameEs, note, count } }. The cleaning service proposes an
  // item that isn't on the list. It is saved as pending and the owner is
  // told; nothing is added to the inventory here.
  router.post('/shared/:token/proposals', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const raw = req.body?.item || {};
    const parsed = parseItemFields(raw);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const count = parseCount(raw.count ?? 1);
    if (count == null) return res.status(400).json({ error: `The count must be a whole number from 0 to ${MAX_COUNT}.` });

    const { data: waiting, error: wErr } = await supabase.from('unit_inventory_proposals')
      .select('id').eq('listing_id', listing.id).eq('status', 'pending').limit(MAX_PENDING_PROPOSALS);
    if (wErr) return sendSupabaseError(res, wErr);
    if ((waiting || []).length >= MAX_PENDING_PROPOSALS) {
      return res.status(400).json({ error: 'Too many items are already waiting for the owner. Ask the owner to review them first.' });
    }
    // The unit's latest proposal of any status, to tell one visit from the next.
    const { data: latest } = await supabase.from('unit_inventory_proposals')
      .select('created_at').eq('listing_id', listing.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const now = new Date();
    const row = {
      id: 'uip_' + uuidv4().slice(0, 12),
      listing_id: listing.id,
      community_id: listing.community_id || 'kai',
      area_en: parsed.fields.area_en, area_es: parsed.fields.area_es,
      name_en: parsed.fields.name_en, name_es: parsed.fields.name_es,
      note: text(raw.note, MAX_NOTE),
      count,
      status: 'pending',
      proposed_by: cleanerName(req, listing),
      created_at: now.toISOString(),
    };
    const { error } = await supabase.from('unit_inventory_proposals').insert(row);
    if (error) return sendSupabaseError(res, error);
    res.json({ proposal: proposalFromDb(row) });
    const previous = latest ? Date.parse(latest.created_at) : 0;
    if (now.getTime() - previous >= PROPOSAL_NOTIFY_GAP_MS) setImmediate(() => notifyOwnerOfProposal({ listing, proposal: row, req }));
  });

  // POST /shared/:token/damages — body: { name, damage: { description,
  // areaEn, areaEs, location, itemId, photos } }. The cleaning service
  // reports damage. The owner is told once per visit; everything reported
  // is then part of that visit's completed count.
  // POST /shared/:token/damages/suggest — body: { name, photo?,
  // description? } (at least one). Which of the unit's items the damage
  // report is most likely about: { seenEs, seenEn, matches: [{ itemId,
  // confidence }] } (up to 3, best first; none when nothing fits;
  // `seenEs`/`seenEn` say what it is about). Only a suggestion for the
  // person to pick from. At most SUGGEST_PER_HOUR per unit; 503 without
  // ANTHROPIC_API_KEY.
  router.post('/shared/:token/damages/suggest', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const rawPhoto = req.body?.photo;
    const photo = rawPhoto ? cleanPhoto(rawPhoto) : '';
    if (rawPhoto && !photo) return res.status(400).json({ error: 'That photo could not be used.' });
    const description = text(req.body?.description, 1000);
    if (!photo && !description) return res.status(400).json({ error: 'Take a photo or describe the damage first.' });
    const now = Date.now();
    const recent = (suggestLog.get(listing.id) || []).filter(t => now - t < 3600 * 1000);
    if (recent.length >= SUGGEST_PER_HOUR) return res.status(429).json({ error: 'Too many suggestions for now. Find the item in the list instead.' });
    suggestLog.set(listing.id, [...recent, now]);
    const { data: rows, error } = await loadItems(listing.id);
    if (error) return sendSupabaseError(res, error);
    try {
      res.json(await suggestItems({ photo, description, rows: rows || [] }));
    } catch (e) {
      if (e instanceof SuggestError) return res.status(e.status).json({ error: e.message });
      warn('Inventory damage suggestion failed: ' + (e && e.message));
      res.status(500).json({ error: 'The suggestion failed. Find the item in the list instead.' });
    }
  });

  router.post('/shared/:token/damages', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const { data: latest } = await supabase.from('unit_inventory_damages')
      .select('created_at').eq('listing_id', listing.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const result = await saveDamage({
      listing, raw: req.body?.damage, actorType: 'cleaner',
      actorName: cleanerName(req, listing),
    });
    if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ damage: damageFromDb(result.row) });
    const previous = latest ? Date.parse(latest.created_at) : 0;
    if (Date.now() - previous >= PROPOSAL_NOTIFY_GAP_MS) setImmediate(() => notifyOwnerOfDamage({ listing, damage: result.row, req }));
  });

  return router;
};
