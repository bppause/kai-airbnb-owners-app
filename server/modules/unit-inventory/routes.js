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
//             token in the link is the only credential. Can read the list
//             and update counts and notes, nothing else.
//
// Every item keeps two counts. `baseline_count` is what the owner says
// should be there; `current_count` is what was last counted. Counting
// never touches the baseline — only the owner's re-baseline does, by
// accepting the current counts as the new baseline. Every change to a
// count, a note or a baseline is appended to unit_inventory_events, which
// is never updated or deleted from, so the history survives item deletes.
//
// Like the rest of this app the owner routes trust the ownerUid the
// client sends (see server/platform/units/routes.js); there is no
// server-side session to check it against.

'use strict';

const crypto = require('crypto');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const MAX_NAME = 300;
const MAX_AREA = 120;
const MAX_NOTE = 1000;
const MAX_ACTOR = 120;
const MAX_COUNT = 100000;
const MAX_BULK_ITEMS = 1000;
const MAX_COUNT_UPDATES = 1000;

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
  countUpdatedAt: r.count_updated_at,
  countUpdatedBy: r.count_updated_by || '',
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
  actorType: r.actor_type,
  actorName: r.actor_name || '',
  createdAt: r.created_at,
});

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

module.exports = function createUnitInventoryRouter(deps) {
  const { supabase, requireSupabaseEnv, sendSupabaseError, auditLog } = deps;

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
  const applyCountUpdates = async ({ listing, updates, actorType, actorName, actorUid }) => {
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

    const events = [];
    for (const { item, count, note } of plans) {
      const { error: uErr } = await supabase.from('unit_inventory_items').update({
        current_count: count, current_note: note,
        count_updated_at: now, count_updated_by: actorName, updated_at: now,
      }).eq('id', item.id);
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

  const loadLink = async (listingId) => {
    const { data } = await supabase.from('unit_inventory_links')
      .select('token, enabled, updated_at').eq('listing_id', listingId).maybeSingle();
    return data ? { token: data.token, enabled: !!data.enabled, updatedAt: data.updated_at } : null;
  };

  // ── Owner ────────────────────────────────────────────────────────────

  // GET /units/:listingId?ownerUid= — the unit's items and its share link.
  router.get('/units/:listingId', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await requireOwnedUnit(res, req.params.listingId, req.query.ownerUid);
    if (!listing) return;
    const { data, error } = await loadItems(listing.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ items: (data || []).map(itemFromDb), link: await loadLink(listing.id) });
  });

  // POST /units/:listingId/items — body: { ownerUid, actorName, items: [
  // { areaEn, areaEs, nameEn, nameEs, noteEn, noteEs, count } ] }. Adds
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
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('unit_inventory_items')
      .update({ ...parsed.fields, updated_at: now }).eq('id', item.id).select('*').single();
    if (error) return sendSupabaseError(res, error);
    const evErr = await insertEvents([eventRow(data, listing, {
      event_type: 'edited',
      note_before: [item.name_en, item.name_es].filter(Boolean).join(' / '),
      note_after: [data.name_en, data.name_es].filter(Boolean).join(' / '),
      actor_type: 'owner', actor_name: text(actorName, MAX_ACTOR) || listing.owner || 'Owner',
      actor_uid: String(ownerUid), created_at: now,
    })]);
    if (evErr) return sendSupabaseError(res, evErr);
    res.json({ item: itemFromDb(data) });
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
      listing, updates, actorType: 'owner',
      actorName: text(actorName, MAX_ACTOR) || listing.owner || 'Owner', actorUid: String(ownerUid),
    });
    if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ changed: result.changed });
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
    res.json({ events: (data || []).map(eventFromDb) });
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

  const unitForToken = async (res, token) => {
    const { data: link, error } = await supabase.from('unit_inventory_links')
      .select('listing_id, enabled').eq('token', String(token || '')).maybeSingle();
    if (error) { sendSupabaseError(res, error); return null; }
    // One answer for an unknown link and a switched-off one, so the
    // response doesn't confirm which tokens ever existed.
    if (!link || !link.enabled) { res.status(404).json({ error: 'This inventory link is not active. Ask the owner for a new one.' }); return null; }
    const { data: listing, error: lErr } = await supabase.from('listings')
      .select('id, owner, community_id, apt, tower').eq('id', link.listing_id).maybeSingle();
    if (lErr) { sendSupabaseError(res, lErr); return null; }
    if (!listing) { res.status(404).json({ error: 'This inventory link is not active. Ask the owner for a new one.' }); return null; }
    return listing;
  };

  // GET /shared/:token — what the cleaner's page shows: the unit's label
  // and its items. Nothing about the owner or the history.
  router.get('/shared/:token', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const { data, error } = await loadItems(listing.id);
    if (error) return sendSupabaseError(res, error);
    res.json({ unit: { apt: listing.apt, tower: listing.tower || '' }, items: (data || []).map(itemFromDb) });
  });

  // POST /shared/:token/counts — body: { name, updates }. `name` is
  // whatever the person typed; it is recorded with the change so the
  // owner can see who counted, but it is not verified.
  router.post('/shared/:token/counts', async (req, res) => {
    if (!requireSupabaseEnv(res)) return;
    const listing = await unitForToken(res, req.params.token);
    if (!listing) return;
    const result = await applyCountUpdates({
      listing, updates: req.body?.updates, actorType: 'cleaner',
      actorName: text(req.body?.name, MAX_ACTOR) || 'Cleaning service', actorUid: '',
    });
    if (result.supabaseError) return sendSupabaseError(res, result.supabaseError);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ changed: result.changed });
  });

  return router;
};
