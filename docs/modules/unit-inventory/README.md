# `unit-inventory` — Module Documentation

> **Status:** live
> **Slug:** `unit-inventory`
> **Server code:** `server/modules/unit-inventory/`
> **Client code:** `client/src/modules/unit-inventory/`

## Purpose

Lets the owner of a unit keep an inventory of what belongs in the
apartment — furniture, kitchenware, linens, remotes — and lets the
cleaning service report what they actually find after each stay, so
missing or damaged items show up as a difference instead of going
unnoticed.

## How it works

- **Items** are described in English and Spanish and grouped by area
  (also bilingual). Either language may be left blank; the screen falls
  back to the other one.
- **Two counts per item.** The *baseline* is what the owner says should
  be there. The *current count* is what was last counted. Counting never
  changes the baseline.
- **Re-baseline.** When the owner accepts that the counts have changed
  for good (items replaced, retired, added), they re-baseline: the
  current counts become the new baseline, for one item or for every item
  that has drifted. This is the only way a baseline moves after an item
  is created.
- **Changes stand out.** An item whose count is below its baseline is
  painted red with a "▼ n missing" badge; above it, blue with "▲ n
  extra". Colour is never the only signal. A summary above the list
  says how many items differ, each area header carries its own "n
  changed" badge (visible while the area is folded), and the owner can
  narrow the list to changed items only. The marks follow the count as
  it is typed, on both the owner's panel and the cleaning-service page.
- **History.** Every change to a count, a note or a baseline is appended
  to `unit_inventory_events` with who made it and the before and after
  values. Rows are never updated or deleted, and they carry the item's
  names, so the history of a deleted item stays readable.

## Who can do what

| Action | Unit owner | Cleaning service (share link) |
| --- | --- | --- |
| See the items and their baseline | yes | yes |
| Update counts and notes | yes | yes |
| Add, edit, delete, import items | yes | no |
| Re-baseline | yes | no |
| See the change history | yes | no |
| Create, turn off, or replace the share link | yes | no |

"Unit owner" is `listings.owner_uid`. Co-owners, operators and admins
have no access in this version.

### The share link

The cleaning service does not sign in. The owner creates a link for the
unit (`/?inventory=<token>`) and sends it to them. The random token is
the only credential:

- Anyone holding the link can read that unit's inventory and change
  counts and notes. Treat it like a key.
- The name the person types is saved with their changes so the owner can
  see who counted. It is not verified.
- The owner can turn the link off, or replace it with a new one, which
  stops the old link working immediately.

Like the rest of this app, the owner routes trust the `ownerUid` the
client sends; there is no server-side session behind it.

## Data model

Three tables, all in `supabase/schema.sql`:

| Table | Holds |
| --- | --- |
| `unit_inventory_items` | One row per item: bilingual area / description / owner note, `baseline_count`, `current_count`, the latest count note, who counted last. |
| `unit_inventory_events` | Append-only history: `created`, `edited`, `count`, `rebaseline`, `deleted`. An `edited` event stores the before/after of each descriptive field that changed in `changes`; an edit that changes nothing writes no event. |
| `unit_inventory_links` | One share link per unit: token and whether it is enabled. Kept off `listings` because listing rows are returned to every signed-in user. |

## API

Mounted at `/api/m/unit-inventory`.

| Route | Who | Does |
| --- | --- | --- |
| `GET /units/:listingId?ownerUid=` | owner | Items and the share link |
| `POST /units/:listingId/items` | owner | Add one or many items (CSV import sends the whole file) |
| `PUT /items/:id` | owner | Edit an item's area, description, owner note |
| `DELETE /items/:id` | owner | Delete an item (history kept) |
| `POST /units/:listingId/counts` | owner | Update counts and notes |
| `POST /units/:listingId/rebaseline` | owner | Accept current counts as the baseline |
| `GET /units/:listingId/history?ownerUid=` | owner | Change history, newest first |
| `POST /units/:listingId/link` | owner | `enable`, `disable` or `regenerate` the share link |
| `GET /shared/:token` | link holder | The unit's label and items |
| `POST /shared/:token/counts` | link holder | Update counts and notes |

## UI

- **Owner:** My Units → 📦 Inventory on a unit opens
  `components/UnitInventoryModal.jsx`.
- **Cleaning service:** `views/SharedInventoryView.jsx`, rendered by
  `client/src/main.jsx` in place of the app when the URL carries
  `?inventory=`. Phone-first, Spanish or English.

### CSV import

A long starting list can be imported instead of typed. Header row, in any
order: `area_en, area_es, name_en, name_es, count, note_en, note_es`.
Only one of the two name columns is required; a blank count means 1.

## Known gaps

- No photos per item.
- Counts are whole numbers; a consumable kept "assorted" is tracked as 1
  with a note.
- No notification to the owner when a count drops below the baseline.
- The share link is not tied to a person and does not expire on its own.
