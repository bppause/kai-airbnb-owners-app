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
  (also bilingual). Areas, descriptions and owner notes are shown in the
  viewer's language — the owner's app setting, or the language picked on
  the cleaning-service page (which opens in Spanish) — with the other
  language as the smaller line under it. The add/edit form asks for the
  viewer's language first. Either language may be left blank; the screen
  falls back to the one that was filled in.
- **Two counts per item.** The *baseline* is what the owner says should
  be there. The *current count* is what was last counted. Counting never
  changes the baseline.
- **Counted at every checkout (★).** The list is first of all the
  owner's record of everything in the unit. The owner flags the items
  the cleaning service must count at every checkout (`count_required`);
  nothing is flagged by default. Flagged items carry a ★ on both
  screens. Once anything is flagged, the cleaning-service page opens on
  just those items, with a switch to see everything; unflagged items
  stay on the list and can still be counted. The owner flags one item
  with its ☆ / ★ button or a whole area at once, and can set it in the
  add form or a CSV `required` column. Flagging changes no count, so it
  goes to the audit log, not the count history.
- **Duplicate.** Next to Edit, an item's ⧉ Duplicate opens the add form
  filled in from it (area, description, owner note, baseline count, ★)
  so a similar item ("Bath towel" → "Hand towel") only needs what
  differs. Saving adds a new item; the original is untouched and its
  photos are not copied.
- **Both languages stay in sync.** In the item form (add, edit,
  duplicate) the owner types the area, description and note in their
  own language (the app's language setting). While translation is on,
  the other language's fields are read-only, filled in by translation a
  moment after the owner stops typing, and say "🌐 Translated from
  English. To change it, edit the English." (or the Spanish equivalent).
  Clearing a field clears its translation. An item that has only the
  other language (e.g. proposed by the cleaning service in Spanish) gets
  the owner's language filled in when the form opens, marked "check it".
  An area the unit already has is matched to its existing name in the
  other language instead of translated. Saving waits for a translation
  still on its way. If a translation fails, that field says why and
  becomes editable so it can be typed by hand. Translation uses the
  Claude API (`server/modules/unit-inventory/translate.js`, model
  `claude-opus-5-5` at low effort, with the API's refusal fallback on)
  and is on only when `ANTHROPIC_API_KEY` is set; without it both
  languages are editable as before. Answers are cached in memory, so
  retyping the same text costs nothing.
- **Count notes in both languages.** The note left on an item when
  counting (by the cleaning service or the owner) is translated into the
  other language when it is saved, using the language of the page it was
  typed on, and stored with it (`current_note_lang`,
  `current_note_translation`). Each person reads it in their own
  language: the note box shows the note in the viewer's language (the
  translation, if it was written in the other one) and the other
  language sits underneath, read-only — "🌐 In Spanish (automatic
  translation): …" or "🌐 In Spanish (original): …". So with Spanish
  preferred, the box is Spanish and the English is read-only, and the
  other way round. A note only shown in translation is never sent back:
  changing just the count keeps the original. Editing the note saves it
  in the editor's language and translates it again. The checkout report
  shows notes the same way. The read-only line is hidden while the note
  is being changed, cleared with the note, and absent when translation
  is off or failed — the note is saved either way. A database without
  the two columns keeps saving counts without them.
- **Back to the item.** After editing or duplicating (saved or closed),
  the list scrolls back to the item (the copy, once saved) and briefly
  highlights it, so the owner doesn't lose their place in a long list.
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
- **Example photos.** The owner can attach up to 3 example photos to
  an item, showing the cleaning service what it looks like. Every item
  on the owner's screen has a "📷 Foto" button at its top right, next to
  the ★ — in view even when the item is folded on a phone — that opens
  the camera or photo library and saves the photo to the item straight
  away ("Foto de ejemplo guardada."). The add-item form takes them
  before the item exists, and the edit form shows the item's photos to
  add or delete there. The card shows "📷 Fotos de ejemplo (n)", which
  opens them (to view full screen or delete); the 📷 button goes once an
  item has 3. The cleaning service sees "📷 Fotos de ejemplo (n)" and
  can only look. Photos are shrunk in the browser and stored as JPEG
  data URLs.
- **Camera or gallery.** On a phone every "add photo" button (example
  photos, the add-item form, damage reports) asks first: "📷 Tomar
  foto" opens the camera, "🖼️ Elegir de la galería" the photo library —
  some phones offer no camera from a plain image picker. A computer
  opens the file picker straight away; the cleaning service's optional
  item photo at checkout goes straight to the camera.
- **Item photos at checkout (optional).** The cleaning service may
  photograph any item at a checkout — offered on the ★ items and on any
  item that is off its count or has a note, since that is where a photo
  helps most (missing or damaged). The camera opens directly; each photo
  is shrunk to 720px and saved at once to `unit_inventory_count_photos`,
  then attached to that checkout's report, where the owner opens them
  item by item. Up to 3 per item per visit; kept for a unit's 12 most
  recent completed counts.
- **Checkout video (required).** After cleaning, the cleaning service
  records a short walk through the apartment (at most 3 minutes). The
  page records it itself where the phone allows (camera + MediaRecorder
  at about 1 Mbit/s, so ~25 MB for 3 minutes); otherwise the phone's own
  camera app is used, with a 50 MB limit. The file goes straight from the
  phone to Supabase Storage (private bucket `inventory-videos`) through a
  signed upload URL, with a progress bar; the server records it in
  `unit_inventory_videos` once it has arrived. Count complete is refused —
  in the page and by the server — until there is a video from this
  visit. The owner watches it from the checkout report through a link
  that lasts an hour. The owner's own count asks for none.
- **The video is evidence for Airbnb damage claims.** The cleaning
  service records it after every turnover cleaning — it shows damage the
  last guest left and is the "before check-in" proof for the next one.
  The task card, video box and guide tell them so: walk slowly, good
  light, show furniture, walls, floors, doors and appliances. In the
  checkout report the owner sees when it was recorded, can **⬇ Download
  video** (a link that saves it as `inventario-apto-317-2026-11-22-1452.mp4`,
  Colombia time) or **📤 Share (WhatsApp…)** it, to attach in Airbnb's
  Resolution Center or send to anyone. On a phone that can share files,
  the first tap fetches the video and the second ("📤 Send video") opens
  the share sheet with the file itself — phones only allow sharing right
  after a tap. Elsewhere, or if fetching fails, WhatsApp opens with the
  message and a download link that works for 7 days. Claims are
  filed within 14 days of the guest's checkout — and can mark it
  **📌 Keep as evidence** while a claim is open (`keep`, `kept_by`,
  `kept_at`; audited as keep_video / release_video).
- **Video storage is recycled — never recent or kept evidence.** Videos
  are kept until all of them together (every unit) would pass a size
  limit — 800 MB by default, under Supabase's free 1 GB; set
  `INVENTORY_VIDEO_STORAGE_MB` to change it. When a new upload would
  pass it, the oldest videos of completed counts are deleted (row and
  file), oldest first and only as many as needed — but never a video
  under 30 days old, one kept as evidence, or one from a visit still
  under way. If those alone pass the limit nothing more is deleted: the
  upload goes ahead and the reports tab warns that storage is over. The
  report of a count whose video was recycled still says it had one and
  explains why it's gone. The reports tab shows how much is used
  ("🎥 Video storage: 320 MB of 800 MB (40%)…", highlighted from 90%).
  Uploads abandoned for a day are dropped when a count is completed.
- **Damage reports.** The cleaning service can report damage: what is
  damaged, where (an area, the item if it concerns one, a free-text
  spot) and up to 4 photos. Photos are shrunk in the browser and stored
  with the row as JPEG data URLs, like incident photos; lists never
  carry them. The owner is told (alert + email, once per visit), sees
  open reports at the top of the panel, and marks them resolved; reports
  are never deleted.
- **The checkout report.** A completed count is the unit's inventory for
  that checkout. Its row in `unit_inventory_checks` is dated and keeps
  the result as it stood — every item that was off its baseline or
  carried a note — and the damage reported during that visit (the 12
  hours before) is attached to it. The owner's **Checkout reports** tab
  lists them newest first and opens any one, photos included; a report
  does not change when the inventory later does. When the cleaning
  service completes a count the owner gets its result as an alert and an
  email.
- **Used after each checkout cleaning.** The cleaning service opens the
  link each time Airbnb guests check out, once the apartment is cleaned,
  so the count and the video show it ready for the next guest. The
  share message, the welcome card, the task card ("Al terminar la
  limpieza de esta salida"), the guide (which opens with "Cuándo
  usarlo") and the owner's link help all say so.
- **Help for the cleaning service.** The first time the link is opened
  on a phone, a short welcome card says what the page is and what to do
  at each checkout ("Entendido" hides it for good on that phone,
  `kai_inventory_intro_seen`). A "❓ Ayuda" button in the header opens a
  step-by-step guide any time: name, counting (★, areas, − / +,
  colours), missing or damaged items (0, note, optional photo), damage
  reports, proposing an item, saving (and that unsaved counts survive a
  dropped signal), the checkout video, finishing, and what to do if the
  camera or upload fails. It follows the page's language and leaves out
  steps that don't apply to the unit (no ★ items, no video). The text is
  in `components/CleanerHelp.jsx`; the message shared with the link
  mentions the ❓ button.
- **Asked before finishing.** On the cleaning-service page, Count
  complete is two steps: it states what finishing confirms and asks
  whether there is damage to report before the count can be closed. The
  page opens with a three-step card saying exactly what to count.
- **Unflagged items still get reported.** Items without ★ don't need
  counting one by one, but the cleaning service is told everywhere it
  looks — list hint, task card ("Reporta cualquier daño o faltante que
  veas, también en artículos sin ★", with how: search, correct the
  number and leave a note, or ⚠️ Reportar daño), welcome card, guide and
  the finish prompt — that anything they notice missing or damaged must
  still be reported.
- **Descriptions are the owner's.** The cleaning service can change
  only an item's count and the note on that count (plus photos, damage
  reports and the video). Areas, descriptions, owner notes, baselines,
  ★ and deleting are owner-only: the /shared routes ignore those fields.
  The cleaning-service guide says so and tells them to put a wrong
  description in a note.
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
| Report damage, with photos | — | yes |
| Take photos of items at checkout (optional) | — | yes |
| Record the checkout video (required to finish) | — | yes |
| See checkout reports and damage photos; mark damage resolved | yes | no |
| Approve or reject a proposed item | yes | no |
| Add, edit, delete, import items | yes | no |
| Flag items to count at every checkout | yes | no |
| Add or delete an item's photos | yes | no |
| See an item's photos | yes | yes |
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

Nine tables and one storage bucket, all in `supabase/schema.sql`.

To set up or update them, paste `supabase/unit_inventory.sql` into the
Supabase SQL Editor and click Run. It is safe to run again: it only adds what
is missing. That file is generated from the inventory section of
`schema.sql`, so change the tables in `schema.sql`, then run
`npm run inventory-sql` and commit both files
(`npm run inventory-sql -- --check` fails if they have drifted).


| Table | Holds |
| --- | --- |
| `unit_inventory_items` | One row per item: bilingual area / description / owner note, `baseline_count`, `current_count`, the latest count note, who counted last. |
| `unit_inventory_item_photos` | The owner's photos of an item (JPEG data URLs). Deleted with the item. A missing table leaves everything else working; only photos fail. |
| `unit_inventory_events` | Append-only history: `created`, `edited`, `count`, `rebaseline`, `deleted`. An `edited` event stores the before/after of each descriptive field that changed in `changes`; an edit that changes nothing writes no event. |
| `unit_inventory_checks` | One row per completed count: who, when, the unit's totals against baseline at that moment, the items that were off or noted (`results`) and how many damage reports came with it. If the newer columns are missing the count is still recorded without them. If this table is missing (schema not re-run since it was added) the screens still load and report no complete count; only marking one fails. |
| `unit_inventory_videos` | The checkout video: where it is in the `inventory-videos` storage bucket, type, size, length, who, `uploading` / `ready`, and the completed count it belongs to. `keep` / `kept_by` / `kept_at`: kept as evidence by the owner. Kept until all videos together pass the storage limit; then the oldest of completed counts are deleted (row and file) to make room — never one under 30 days old or kept as evidence. A missing table means no video is asked for. The bucket is created by `schema.sql`, or by the server on first use. |
| `unit_inventory_count_photos` | Optional item photos at a checkout: unattached while the visit is under way, then tied to the completed count (`check_id`). Pruned to the 12 most recent counts per unit. A missing table means photos aren't asked for and counts complete as before. |
| `unit_inventory_damages` | Damage reports: description, area / item / spot, photos (JPEG data URLs), who and when, the completed count they belong to (`check_id`), `open` or `resolved`. A missing table reads as no damage; only reporting fails. |
| `unit_inventory_proposals` | Items proposed through the share link: `pending`, `approved` (with the `item_id` created) or `rejected`. Decided rows are kept. A missing table reads as no proposals; only proposing fails. |
| `unit_inventory_links` | One share link per unit: token and whether it is enabled. Kept off `listings` because listing rows are returned to every signed-in user. |

## API

Mounted at `/api/m/unit-inventory`.

| Route | Who | Does |
| --- | --- | --- |
| `GET /units/:listingId?ownerUid=` | owner | Items, the share link, the last complete count and pending proposals |
| `POST /units/:listingId/items` | owner | Add one or many items (CSV import sends the whole file) |
| `POST /units/:listingId/videos/:videoId/keep` | owner | `{ keep: true\|false }`: keep a completed count's video as evidence (never recycled) or release it |
| `PUT /items/:id` | owner | Edit an item's area, description, owner note |
| `POST /units/:listingId/translate` | owner | `{ text, to: es\|en, field: area\|name\|note }` → `{ text }`. 503 when `ANTHROPIC_API_KEY` is not set |
| `DELETE /items/:id` | owner | Delete an item (history kept) |
| `POST /units/:listingId/counts` | owner | Update counts and notes |
| `GET /units/:listingId/items/:itemId/photos?ownerUid=` | owner | An item's photos |
| `POST /units/:listingId/items/:itemId/photos` | owner | Add a photo to an item (at most 3) |
| `DELETE /units/:listingId/items/:itemId/photos/:photoId` | owner | Delete one photo |
| `POST /units/:listingId/required` | owner | Flag or unflag items (one, or a whole area) as counted at every checkout |
| `POST /units/:listingId/rebaseline` | owner | Accept current counts as the baseline |
| `GET /units/:listingId/history?ownerUid=` | owner | Item changes and completed counts, newest first |
| `POST /units/:listingId/checks` | owner | Mark the count complete (optionally saving `updates` first) |
| `GET /units/:listingId/checks?ownerUid=` | owner | The dated list of completed counts |
| `GET /units/:listingId/checks/:checkId?ownerUid=` | owner | One checkout's report: results and damage, with photos |
| `GET /units/:listingId/checks/:checkId/items/:itemId/photos?ownerUid=` | owner | One item's photos at one checkout |
| `GET /units/:listingId/checks/:checkId/videos?ownerUid=` | owner | The checkout's video, with a link to watch it (1 hour) |
| `GET /units/:listingId/damages/:damageId?ownerUid=` | owner | One damage report with its photos |
| `POST /damages/:id/status` | owner | Mark a damage report `resolved` (or `open` again) |
| `POST /proposals/:id/decision` | owner | `approve` (creates the item) or `reject` a proposed item |
| `POST /units/:listingId/link` | owner | `enable`, `disable` or `regenerate` the share link |
| `GET /shared/:token` | link holder | The unit's label, items, last complete count and pending proposals |
| `GET /shared/:token/items/:itemId/photos` | link holder | An item's photos (view only) |
| `GET /shared/:token/items/:itemId/proof` | link holder | This visit's photos of an item |
| `POST /shared/:token/items/:itemId/proof` | link holder | Add a photo (at most 3 per item per visit) |
| `DELETE /shared/:token/items/:itemId/proof/:photoId` | link holder | Remove one taken this visit |
| `POST /shared/:token/videos` | link holder | Ask to upload the checkout video → a signed upload URL |
| `POST /shared/:token/videos/:videoId/done` | link holder | The upload has finished; the server checks the file is there |
| `DELETE /shared/:token/videos/:videoId` | link holder | Remove this visit's video (to record again) |
| `POST /shared/:token/counts` | link holder | Update counts and notes |
| `POST /shared/:token/checks` | link holder | Mark the count complete (optionally saving `updates` first) |
| `POST /shared/:token/proposals` | link holder | Propose an item for the owner to approve |
| `POST /shared/:token/damages` | link holder | Report damage, with photos |

## UI

- **Owner:** My Units → 📦 Inventory on a unit opens
  `components/UnitInventoryModal.jsx`.
- **Cleaning service:** `views/SharedInventoryView.jsx`, rendered by
  `client/src/main.jsx` in place of the app when the URL carries
  `?inventory=`. Opens in Spanish whatever the phone's language or the
  app's language setting; the person can switch it to English, and that
  choice is remembered for this page only.
- Both render their items through `components/ItemList.jsx`.

### On a phone

Counting happens on a phone, standing in the unit, and a furnished unit
runs to a couple of hundred items. Both screens are built around that:

- **Areas fold.** A list of more than 40 items opens with its areas
  folded, each showing its item count and "n changed". One button opens
  or closes them all; a search, or the owner's changed-only filter, opens
  whatever it matches.
- **Compact items.** Below 640px an item shows its name, the expected
  count and a − / + stepper. The note (and the owner's Edit / Duplicate / Delete /
  Accept as baseline) sits behind a toggle and opens by itself as soon
  as the item has a note or its count leaves the baseline.
- **Damage is one tap away.** On the cleaning-service page every item
  carries a red "⚠️ Daño" button at its top right, in view even when the
  item is folded on a phone, so reporting damage on an item never means
  opening its note first. It opens the damage form for that item.
  Damage elsewhere (walls, doors, furniture) uses "⚠️ Reportar un daño"
  below the list.
- **Nothing scrolls out of reach.** The owner's title bar and close
  button, the search box (with a ★ chip that flips between the
  every-checkout items and everything), the area being scrolled
  through, and the save bar stay pinned.
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

- The video shows that a walk-through was recorded at that checkout;
  nothing checks what is in it.
- Photos live in the database, as incident photos do; videos live in
  Supabase Storage. Supabase's free plan has 1 GB of storage; the
  videos may use up to `INVENTORY_VIDEO_STORAGE_MB` (800 MB by default,
  about 50 videos at ~15 MB) before the oldest are recycled. On a paid
  plan, raise it to keep more history.
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
