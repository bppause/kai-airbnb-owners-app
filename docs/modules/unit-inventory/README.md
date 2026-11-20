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

- **Items** are described in Spanish and English and grouped by area
  (also bilingual). Spanish is always the main line and English the
  smaller one under it, whatever language the screen's labels are in:
  the people counting work in Spanish, and a fixed order means the owner
  and the cleaning service read the same line. Either language may be
  left blank; the screen falls back to the one that was filled in.
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
- **Count complete.** Saving counts only records what changed, so a pass
  that found everything in place would leave no trace. At the end of the
  list either audience can mark the count as complete: that writes one
  row to `unit_inventory_checks` (who, when, how many items, how many
  below and above baseline), saves any counts still unsaved on the
  screen in the same request, and moves every item's "last counted" to
  now. Both screens show the last complete count under the summary; the
  owner's History tab lists them in the same timeline as item changes.
  It never changes a baseline.
- **Proposed items.** The cleaning service cannot add to the inventory,
  but can propose an item that isn't on the list (description, area,
  quantity, note). A proposal waits in `unit_inventory_proposals`, shown
  apart from the inventory on both screens; it has no baseline and is
  not counted. The owner is told — an in-app alert, plus an email where
  email is configured, once per visit rather than once per item — and
  approves or rejects it. Approval creates a normal item with the
  proposed quantity as its baseline; the history entry names who
  proposed it. At most 50 proposals wait per unit.
- **Deleting stays with the owner.** If the cleaning service finds an
  item gone, they count it as 0 and leave a note; the owner decides
  whether to delete it or re-baseline.

## Who can do what

| Action | Unit owner | Cleaning service (share link) |
| --- | --- | --- |
| See the items and their baseline | yes | yes |
| Update counts and notes | yes | yes |
| Mark a count as complete | yes | yes |
| Propose an item that isn't on the list | — | yes |
| Approve or reject a proposed item | yes | no |
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

Five tables, all in `supabase/schema.sql`:

| Table | Holds |
| --- | --- |
| `unit_inventory_items` | One row per item: bilingual area / description / owner note, `baseline_count`, `current_count`, the latest count note, who counted last. |
| `unit_inventory_events` | Append-only history: `created`, `edited`, `count`, `rebaseline`, `deleted`. An `edited` event stores the before/after of each descriptive field that changed in `changes`; an edit that changes nothing writes no event. |
| `unit_inventory_checks` | One row per completed count: who, when, and the unit's totals against baseline at that moment. If this table is missing (schema not re-run since it was added) the screens still load and report no complete count; only marking one fails. |
| `unit_inventory_proposals` | Items proposed through the share link: `pending`, `approved` (with the `item_id` created) or `rejected`. Decided rows are kept. A missing table reads as no proposals; only proposing fails. |
| `unit_inventory_links` | One share link per unit: token and whether it is enabled. Kept off `listings` because listing rows are returned to every signed-in user. |

## API

Mounted at `/api/m/unit-inventory`.

| Route | Who | Does |
| --- | --- | --- |
| `GET /units/:listingId?ownerUid=` | owner | Items, the share link, the last complete count and pending proposals |
| `POST /units/:listingId/items` | owner | Add one or many items (CSV import sends the whole file) |
| `PUT /items/:id` | owner | Edit an item's area, description, owner note |
| `DELETE /items/:id` | owner | Delete an item (history kept) |
| `POST /units/:listingId/counts` | owner | Update counts and notes |
| `POST /units/:listingId/rebaseline` | owner | Accept current counts as the baseline |
| `GET /units/:listingId/history?ownerUid=` | owner | Item changes and completed counts, newest first |
| `POST /units/:listingId/checks` | owner | Mark the count complete (optionally saving `updates` first) |
| `POST /proposals/:id/decision` | owner | `approve` (creates the item) or `reject` a proposed item |
| `POST /units/:listingId/link` | owner | `enable`, `disable` or `regenerate` the share link |
| `GET /shared/:token` | link holder | The unit's label, items, last complete count and pending proposals |
| `POST /shared/:token/counts` | link holder | Update counts and notes |
| `POST /shared/:token/checks` | link holder | Mark the count complete (optionally saving `updates` first) |
| `POST /shared/:token/proposals` | link holder | Propose an item for the owner to approve |

## UI

- **Owner:** My Units → 📦 Inventory on a unit opens
  `components/UnitInventoryModal.jsx`.
- **Cleaning service:** `views/SharedInventoryView.jsx`, rendered by
  `client/src/main.jsx` in place of the app when the URL carries
  `?inventory=`. Spanish or English.
- Both render their items through `components/ItemList.jsx`.

### On a phone

Counting happens on a phone, standing in the unit, and a furnished unit
runs to a couple of hundred items. Both screens are built around that:

- **Areas fold.** A list of more than 40 items opens with its areas
  folded, each showing its item count and "n changed". One button opens
  or closes them all; a search, or the owner's changed-only filter, opens
  whatever it matches.
- **Compact items.** Below 640px an item shows its name, the expected
  count and a − / + stepper. The note (and the owner's Edit / Delete /
  Accept as baseline) sits behind a toggle and opens by itself as soon
  as the item has a note or its count leaves the baseline.
- **Nothing scrolls out of reach.** The owner's title bar and close
  button, the area being scrolled through, and the save bar stay pinned.
  Messages appear pinned at the bottom rather than at the top of the
  list. Saving without a name on the cleaning-service page brings the
  name box into view.
- **Unsaved counts survive.** The cleaning-service page keeps unsaved
  counts in the browser (`localStorage`, per link, 24 hours) and restores
  them after a reload or a dropped tab. The owner's panel asks before
  closing with unsaved counts.
- **Touch sizes.** Everything tapped is at least 44px tall and every
  text box is 16px, so iOS does not zoom the page on focus.
- **Sharing.** Where the browser has a share sheet, the owner gets a
  Share button that hands the link to WhatsApp, Messages and so on.

On the owner's panel the dialog fills the screen below 640px.

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
- A proposal is approved or rejected as sent; to change its description
  or add the English text the owner approves it and then edits the item.
- The owner's alert about a proposal does not open the inventory; they
  go to My Units → Inventory.
- "Count complete" is the counter's word that they checked everything;
  nothing verifies that each area was opened.
