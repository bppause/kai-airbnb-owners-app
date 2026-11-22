-- Unit inventory tables for the Airbnb owners app.
-- GENERATED from supabase/schema.sql by scripts/build-inventory-sql.js; do not edit by hand.
-- Change schema.sql, then run: npm run inventory-sql
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- Safe to run more than once: it only adds what is missing and changes no existing data.

-- ─────────────────────────────────────────────────────────────────────────────
-- UNIT INVENTORY (module: unit-inventory)
-- ─────────────────────────────────────────────────────────────────────────────
-- What belongs in a unit, described in English and Spanish and grouped by
-- area. baseline_count is what the owner says should be there;
-- current_count is what was last counted, by the owner or by the cleaning
-- service through the unit's share link. Counting never changes the
-- baseline — only the owner's re-baseline does. See
-- docs/modules/unit-inventory/README.md.
create table if not exists public.unit_inventory_items (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  area_en text not null default '',
  area_es text not null default '',
  name_en text not null default '',
  name_es text not null default '',
  note_en text not null default '',
  note_es text not null default '',
  baseline_count integer not null default 0 check (baseline_count >= 0),
  baseline_set_at timestamptz not null default now(),
  current_count integer not null default 0 check (current_count >= 0),
  current_note text not null default '',
  count_updated_at timestamptz,
  count_updated_by text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Whether the item must be counted at every checkout. Off by default: the
-- list is the owner's record of everything in the unit, and the owner
-- flags the items the cleaning service has to count each time.
alter table public.unit_inventory_items add column if not exists count_required boolean not null default false;
-- How many photos the owner has attached (kept in step with
-- unit_inventory_item_photos, below).
alter table public.unit_inventory_items add column if not exists photo_count integer not null default 0;
-- The count note in the other language, translated when it was saved
-- (empty when translation is off or failed), and the language the note
-- was written in ('es' / 'en'). Shown read-only under the note.
alter table public.unit_inventory_items add column if not exists current_note_lang text not null default '';
alter table public.unit_inventory_items add column if not exists current_note_translation text not null default '';
create index if not exists idx_unit_inventory_items_listing
  on public.unit_inventory_items(listing_id, sort_order);

-- Photos the owner attaches to an item: what it looks like, for their
-- own record and so the cleaning service can recognise it. JPEG data
-- URLs, like incident photos, in their own table so item lists stay
-- small — an item's photos are read only when someone opens them.
create table if not exists public.unit_inventory_item_photos (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  item_id text not null,
  data text not null,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_unit_inventory_item_photos_item
  on public.unit_inventory_item_photos(item_id, created_at);

-- Append-only history of every change to a count, a note or a baseline.
-- item_id deliberately has no foreign key, and the item's names are copied
-- onto each row, so the history of a deleted item stays readable.
create table if not exists public.unit_inventory_events (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  item_id text not null,
  item_name_en text not null default '',
  item_name_es text not null default '',
  event_type text not null check (event_type in ('created','edited','count','rebaseline','deleted')),
  count_before integer,
  count_after integer,
  baseline_before integer,
  baseline_after integer,
  note_before text not null default '',
  note_after text not null default '',
  -- For 'edited' events: the descriptive fields that changed, as
  -- { "nameEn": { "before": "…", "after": "…" }, … }.
  changes jsonb not null default '{}'::jsonb,
  actor_type text not null check (actor_type in ('owner','cleaner')),
  actor_name text not null default '',
  actor_uid text not null default '',
  created_at timestamptz not null default now()
);
alter table public.unit_inventory_events add column if not exists changes jsonb not null default '{}'::jsonb;
create index if not exists idx_unit_inventory_events_listing
  on public.unit_inventory_events(listing_id, created_at desc);
create index if not exists idx_unit_inventory_events_item
  on public.unit_inventory_events(item_id, created_at desc);

-- Completed counts: one row each time the owner or the cleaning service
-- marks a pass through the unit as complete, with how the unit stood
-- against its baseline at that moment. This is what records a count that
-- found nothing changed — unit_inventory_events only has rows for changes.
create table if not exists public.unit_inventory_checks (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  actor_type text not null check (actor_type in ('owner','cleaner')),
  actor_name text not null default '',
  actor_uid text not null default '',
  items_total integer not null default 0,
  items_missing integer not null default 0,
  items_extra integer not null default 0,
  created_at timestamptz not null default now()
);
-- How many items were flagged to count at every checkout when this count
-- was completed (0 = none flagged; the pass covered the whole list).
alter table public.unit_inventory_checks add column if not exists items_required integer not null default 0;
-- What a completed count found, kept as it stood: the items that were off
-- their baseline or carried a note ([{ itemId, nameEn, nameEs, areaEn,
-- areaEs, baseline, count, note, required }]), and how many damage
-- reports came with it. This is the unit's dated report for a checkout.
alter table public.unit_inventory_checks add column if not exists results jsonb not null default '[]'::jsonb;
alter table public.unit_inventory_checks add column if not exists damages_count integer not null default 0;
-- How many proof photos the cleaning service attached to this count.
alter table public.unit_inventory_checks add column if not exists photos_count integer not null default 0;
-- How many checkout videos came with this count.
alter table public.unit_inventory_checks add column if not exists videos_count integer not null default 0;
create index if not exists idx_unit_inventory_checks_listing
  on public.unit_inventory_checks(listing_id, created_at desc);

-- Item photos the cleaning service takes at a checkout (optional; useful
-- above all for an item that is missing or damaged). check_id is empty
-- while the visit is under way and set when its count is completed. JPEG
-- data URLs; kept only for the unit's most recent completed counts (the
-- server prunes older ones).
create table if not exists public.unit_inventory_count_photos (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  item_id text not null,
  check_id text,
  data text not null,
  taken_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_unit_inventory_count_photos_visit
  on public.unit_inventory_count_photos(listing_id, check_id, created_at);
create index if not exists idx_unit_inventory_count_photos_item
  on public.unit_inventory_count_photos(item_id, created_at);

-- The checkout video: after cleaning, the cleaning service records a
-- short walk through the apartment; a count can't be completed through
-- the share link without one. The file lives in Supabase Storage (bucket
-- inventory-videos, below) at `path`; this row records it. status is
-- 'uploading' until the server has seen the file arrive, then 'ready'.
-- check_id is set when the visit's count is completed. Kept for the
-- unit's latest 10 completed counts (the server prunes older ones).
create table if not exists public.unit_inventory_videos (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  check_id text,
  path text not null,
  content_type text not null default '',
  size_bytes bigint not null default 0,
  duration_seconds integer not null default 0,
  status text not null default 'uploading' check (status in ('uploading','ready')),
  taken_by text not null default '',
  created_at timestamptz not null default now()
);
-- Marked by the owner as evidence for an Airbnb damage claim: never
-- deleted by storage recycling until released.
alter table public.unit_inventory_videos add column if not exists keep boolean not null default false;
alter table public.unit_inventory_videos add column if not exists kept_by text not null default '';
alter table public.unit_inventory_videos add column if not exists kept_at timestamptz;
create index if not exists idx_unit_inventory_videos_visit
  on public.unit_inventory_videos(listing_id, check_id, created_at);

-- The private storage bucket the videos go in: 50 MB per file, video types
-- only. Only the server (service role) and signed links reach it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-videos', 'inventory-videos', false, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

-- Damage reported by the cleaning service: what, where (an area, a
-- free-text spot, and the item if it concerns one — its names copied so
-- the report survives the item) and photos, stored as JPEG data URLs
-- like incident photos. check_id is the completed count of the visit it
-- was reported in, once there is one. Reports are closed by the owner,
-- never deleted.
create table if not exists public.unit_inventory_damages (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  check_id text,
  item_id text,
  item_name_en text not null default '',
  item_name_es text not null default '',
  area_en text not null default '',
  area_es text not null default '',
  location text not null default '',
  description text not null default '',
  photos jsonb not null default '[]'::jsonb,
  photo_count integer not null default 0,
  reported_by text not null default '',
  actor_type text not null default 'cleaner' check (actor_type in ('owner','cleaner')),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text not null default ''
);
create index if not exists idx_unit_inventory_damages_listing
  on public.unit_inventory_damages(listing_id, status, created_at desc);
create index if not exists idx_unit_inventory_damages_check
  on public.unit_inventory_damages(check_id);

-- Items the cleaning service proposed through the share link. A proposal
-- is not part of the inventory: the owner approves it (it becomes a row
-- in unit_inventory_items, recorded in item_id, with `count` as its
-- baseline) or rejects it. Decided rows are kept as the record of what
-- was asked and what the owner answered.
create table if not exists public.unit_inventory_proposals (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  area_en text not null default '',
  area_es text not null default '',
  name_en text not null default '',
  name_es text not null default '',
  note text not null default '',
  count integer not null default 1 check (count >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  proposed_by text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text not null default '',
  item_id text
);
create index if not exists idx_unit_inventory_proposals_listing
  on public.unit_inventory_proposals(listing_id, status, created_at);

-- The cleaning service's no-login link, one per unit. The token is the
-- only credential, so it lives here rather than on listings, whose rows
-- are returned to every signed-in user.
create table if not exists public.unit_inventory_links (
  listing_id text primary key references public.listings(id) on delete cascade,
  community_id text not null default 'kai',
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row level security is off: the server uses the service role key.
alter table public.unit_inventory_items disable row level security;
alter table public.unit_inventory_events disable row level security;
alter table public.unit_inventory_links disable row level security;
alter table public.unit_inventory_checks disable row level security;
alter table public.unit_inventory_proposals disable row level security;
alter table public.unit_inventory_damages disable row level security;
alter table public.unit_inventory_item_photos disable row level security;
alter table public.unit_inventory_count_photos disable row level security;
alter table public.unit_inventory_videos disable row level security;
