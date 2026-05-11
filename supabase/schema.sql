-- Supabase schema for Propietarios Airbnb KAI
-- v80: multi-community foundation — adds communities, community_memberships, community_config tables;
--      adds community_id column to listings, incidents, notifications, audit_logs, email_delivery_logs;
--      adds community_id to email_templates with updated composite PK (community_id, key, language);
--      per-community unique index on listings(community_id, apt).
--      Previous: v74: notification_email on app_users; co_owners JSONB on listings; owner directory search.
--      v73: owner_resolution_at on incidents; SLA continues through verified-without-resolution;
--      ui_labels_es / ui_labels_en in app_config for admin-editable UI text; guest_state field.
--      Older: v45 owner WhatsApp, v43 role/permission controls, v42 multi-guest jsonb,
--      v37 guest city/country, v34 email delivery logs, v27 audit_logs, v26 analytics indexes.
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run on an existing database — all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- No demo/test data is inserted.

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMUNITIES (v80)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.communities (
  id text primary key,                     -- slug, e.g. 'kai', 'sol-caribe'
  name text not null,                      -- display name
  name_en text not null default '',
  tower text not null default '',          -- building identifier (e.g. 'KAI')
  city text not null default '',
  state text not null default '',
  country text not null default 'Colombia',
  logo_url text not null default '',
  background_url text not null default '/morros-kai-bg.jpg',
  description text not null default '',
  description_en text not null default '',
  is_active boolean not null default true,
  created_by_uid text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- v83: state field for filtering communities by state/province
alter table public.communities add column if not exists state text not null default '';

-- Seed the default KAI community
insert into public.communities (id, name, name_en, tower, city, country, background_url, description, description_en) values (
  'kai',
  'Propietarios Airbnb KAI',
  'KAI Airbnb Owners',
  'KAI',
  'Cartagena',
  'Colombia',
  '/morros-kai-bg.jpg',
  'Crear una comunidad organizada, informada y proactiva que proteja el valor de nuestras propiedades y eleve la experiencia en Morros KAI.',
  'Create an organized, informed, and proactive community that protects property value and improves the Morros KAI guest experience.'
) on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMUNITY MEMBERSHIPS (v80)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.community_memberships (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  user_uid text not null,
  user_email text not null default '',
  role text not null default 'member' check (role in ('member', 'community_admin')),
  invited_by_uid text not null default '',
  joined_at timestamptz not null default now(),
  unique (community_id, user_uid)
);

-- Phase 5: per-community-admin permission flags (v81)
alter table public.community_memberships add column if not exists permissions jsonb not null default '{"canApproveRegistrations":true,"canResolveIncidents":true,"canManageListings":false}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMUNITY CONFIG (v80)
-- Per-community overrides for app_config keys; server falls back to app_config
-- for any missing community_config keys.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.community_config (
  community_id text not null references public.communities(id) on delete cascade,
  key text not null,
  value text not null default '',
  updated_at timestamptz not null default now(),
  primary key (community_id, key)
);

-- No initial rows needed; server falls back to app_config for missing community_config keys.

-- ─────────────────────────────────────────────────────────────────────────────
-- LISTINGS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.listings (
  id text primary key,
  community_id text not null default 'kai' references public.communities(id),
  owner_uid text not null,
  owner text,
  user_email text not null default '',
  registration_id text,
  status text not null default 'approved' check (status in ('pending','approved','declined')),
  reason text not null default '',
  reviewed_by_uid text not null default '',
  reviewed_by_name text not null default '',
  reviewed_at timestamptz,
  apt text not null,
  tower text not null default 'KAI',
  rooms text not null,
  guests integer not null default 0,
  operator text default '',
  operator_email text not null default '',
  operator_whatsapp text not null default '',
  contact text not null default '',
  email text not null default '',
  airbnb text default '',
  co_owners jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.listings add column if not exists community_id text not null default 'kai' references public.communities(id);
alter table public.listings add column if not exists user_email text not null default '';
alter table public.listings add column if not exists registration_id text;
alter table public.listings add column if not exists status text not null default 'approved';
alter table public.listings add column if not exists reason text not null default '';
alter table public.listings add column if not exists reviewed_by_uid text not null default '';
alter table public.listings add column if not exists reviewed_by_name text not null default '';
alter table public.listings add column if not exists reviewed_at timestamptz;
alter table public.listings add column if not exists email text not null default '';
alter table public.listings add column if not exists operator_email text not null default '';
alter table public.listings add column if not exists operator_whatsapp text not null default '';
alter table public.listings alter column contact set default '';
alter table public.listings alter column contact set not null;
alter table public.listings add column if not exists co_owners jsonb not null default '[]'::jsonb;

-- Constraint guards
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_status_valid') then
    alter table public.listings add constraint listings_status_valid check (status in ('pending','approved','declined')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listings_apt_three_digits') then
    alter table public.listings add constraint listings_apt_three_digits check (apt ~ '^[0-9]{3}$') not valid;
  end if;
end $$;

-- If v15/v16 registration tables already exist, migrate their rows into listings.
-- After this, server.js reads/writes registration state only from public.listings.
do $$
begin
  if to_regclass('public.registrations') is not null and to_regclass('public.registration_listings') is not null then
    insert into public.listings (
      id, owner_uid, owner, user_email, registration_id, status, reason,
      reviewed_by_uid, reviewed_by_name, reviewed_at,
      apt, tower, rooms, guests, operator, operator_email, operator_whatsapp, contact, email, airbnb, created_at
    )
    select
      rl.id,
      r.user_uid,
      r.user_name,
      r.user_email,
      r.id,
      case when r.status = 'approved' then 'approved' when r.status = 'declined' then 'declined' else 'pending' end,
      coalesce(r.reason,''),
      coalesce(r.reviewed_by_uid,''),
      coalesce(r.reviewed_by_name,''),
      r.reviewed_at,
      rl.apt,
      coalesce(rl.tower,'KAI'),
      rl.rooms,
      rl.guests,
      coalesce(rl.operator,''),
      '',
      '',
      coalesce(rl.contact,''),
      coalesce(nullif(rl.email,''), r.user_email),
      coalesce(rl.airbnb,''),
      r.created_at
    from public.registration_listings rl
    join public.registrations r on r.id = rl.registration_id
    where not exists (select 1 from public.listings l where l.id = rl.id)
      and not exists (
        select 1 from public.listings l2
        where l2.apt = rl.apt and l2.status in ('pending','approved') and r.status in ('pending','approved')
      );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- INCIDENTS
-- v73: owner_resolution_at tracks when owner adds their resolution/answer.
--      guest_state added to guest info.
--      SLA reminders continue until owner provides resolution (owner_resolution_at is set).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.incidents (
  id text primary key,
  community_id text not null default 'kai' references public.communities(id),
  reporter_uid text not null,
  reporter_name text,
  apt_id text references public.listings(id) on delete cascade,
  apt_label text,
  guest_name text not null,
  guest_city text default '',
  guest_state text default '',
  guest_country text default '',
  incident_date date not null default current_date,
  type text not null default 'other',
  category text not null default 'minor',
  description text not null,
  status text not null default 'open' check (status in ('open', 'verified', 'resolved')),
  owner_guest_names text not null default '',
  owner_comments text not null default '',
  owner_resolution text not null default '',
  owner_resolution_at timestamptz,
  owner_email_opened_at timestamptz,
  owner_viewed_at timestamptz,
  owner_verified_at timestamptz,
  resolved_at timestamptz,
  resolved_by text not null default '',
  resolution_comments text not null default '',
  sla_hours integer not null default 24,
  next_sla_reminder_at timestamptz,
  sla_cycle_count integer not null default 0,
  owner_guest_city text not null default '',
  owner_guest_country text not null default '',
  owner_guests jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  is_general boolean not null default false,
  created_at timestamptz not null default now()
);

-- Backfill columns for existing databases (all idempotent)
alter table public.incidents add column if not exists community_id text not null default 'kai' references public.communities(id);
alter table public.incidents add column if not exists guest_state text default '';
alter table public.incidents add column if not exists owner_resolution_at timestamptz;
alter table public.incidents add column if not exists owner_guest_names text not null default '';
alter table public.incidents add column if not exists owner_comments text not null default '';
alter table public.incidents add column if not exists owner_resolution text not null default '';
alter table public.incidents add column if not exists owner_email_opened_at timestamptz;
alter table public.incidents add column if not exists owner_viewed_at timestamptz;
alter table public.incidents add column if not exists owner_verified_at timestamptz;
alter table public.incidents add column if not exists resolved_at timestamptz;
alter table public.incidents add column if not exists resolved_by text not null default '';
alter table public.incidents add column if not exists resolution_comments text not null default '';
alter table public.incidents add column if not exists sla_hours integer not null default 24;
alter table public.incidents add column if not exists next_sla_reminder_at timestamptz;
alter table public.incidents add column if not exists sla_cycle_count integer not null default 0;
-- v37: guest city/country
alter table public.incidents add column if not exists owner_guest_city text not null default '';
alter table public.incidents add column if not exists owner_guest_country text not null default '';
-- v42: multi-guest jsonb
alter table public.incidents add column if not exists owner_guests jsonb not null default '[]'::jsonb;
-- v80: photo attachments (up to 3, base64-compressed) and general (non-unit) incident flag
alter table public.incidents add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.incidents add column if not exists is_general boolean not null default false;
-- Per-event SLA: which clock is currently active on this incident.
-- NULL = no clock (terminal). Values: 'step1_verify' (open, awaiting owner verify),
-- 'step2_resolve' (verified, awaiting owner resolution), 'admin_close' (resolution
-- added, awaiting admin close).
alter table public.incidents add column if not exists sla_event text;
update public.incidents set sla_event =
  case
    when status = 'resolved' then null
    when status = 'verified' and coalesce(owner_resolution,'') = '' then 'step2_resolve'
    when status = 'verified' and coalesce(owner_resolution,'') <> '' then 'admin_close'
    else 'step1_verify'
  end
where sla_event is null;

-- Status constraint (drop old, add updated)
alter table public.incidents drop constraint if exists incidents_status_check;
alter table public.incidents add constraint incidents_status_check check (status in ('open','verified','resolved')) not valid;

-- ─────────────────────────────────────────────────────────────────────────────
-- APP CONFIG
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.app_config (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.app_config(key, value) values
  ('sla_hours', '24'),
  -- Per-event SLA policies. JSON shape:
  --   { "step1_verify": {"enabled":true,"hours":24,"maxReminders":3},
  --     "step2_resolve": {"enabled":true,"hours":24,"maxReminders":3},
  --     "admin_close":  {"enabled":true,"hours":48,"maxReminders":3} }
  -- enabled=false halts the SLA clock for that event entirely (no reminder
  -- is scheduled at the transition; existing rows with that event clear
  -- next_sla_reminder_at on the next cron pass). maxReminders caps how
  -- many escalation cycles the SLA cron will fire before clearing
  -- next_sla_reminder_at — prevents indefinite reminders.
  -- Per-community overrides (community_config table) may override only the
  -- owner-facing events: step1_verify and step2_resolve. admin_close is
  -- platform-wide and ignored from community_config.
  ('sla_policies', '{"step1_verify":{"enabled":true,"hours":24,"maxReminders":3},"step2_resolve":{"enabled":true,"hours":24,"maxReminders":3},"admin_close":{"enabled":true,"hours":48,"maxReminders":3}}'),
  ('escalation_cc_emails', ''),
  ('mission_title', 'Misión y normas de la comunidad'),
  ('mission_body', 'Crear una comunidad organizada, informada y proactiva que proteja el valor de nuestras propiedades y eleve la experiencia en Morros KAI.'),
  -- v27 bilingual mission content
  ('mission_title_es', 'Misión y normas de la comunidad'),
  ('mission_body_es', 'Crear una comunidad organizada, informada y proactiva que proteja el valor de nuestras propiedades y eleve la experiencia en Morros KAI.'),
  ('mission_title_en', 'Mission and community rules'),
  ('mission_body_en', 'Create an organized, informed, and proactive community that protects property value and improves the Morros KAI guest experience.'),
  -- v26 analytics
  ('analytics_enabled','false'),
  -- v43 role/permission defaults
  ('standard_menu_permissions','{"dashboard":true,"listings":true,"incidents":true,"notifications":true,"about":true,"my":true,"analytics":false}'),
  ('default_delegate_permissions','{"canApproveRegistrations":true,"canResolveIncidents":true,"canUpdateGlobalListings":false,"canDeleteGlobalListings":false,"canUpdateGlobalIncidents":false,"canDeleteGlobalIncidents":false}'),
  -- v73 admin-editable UI label overrides (JSON objects mapping i18n key → custom text)
  ('ui_labels_es', '{}'),
  ('ui_labels_en', '{}'),
  -- v74 admin-configurable nav order and default landing per role
  ('nav_config', '{"user":{"landing":"my","primary":["my","incidents","general","listings","dashboard"]},"delegate":{"landing":"my","primary":["my","incidents","general","listings","dashboard"]},"global":{"landing":"my","primary":["my","incidents","general","listings","dashboard"]}}')
on conflict (key) do nothing;

-- v27 bilingual mission/rules detailed content
insert into public.app_config(key, value) values ('mission_sections_es', '{"title": "Misión y normas de la comunidad", "subtitle": "Referencia para propietarios aprobados · Propietarios Airbnb KAI", "sectionLabel": "Nuestra misión", "heading": "Crear una comunidad organizada, informada y proactiva.", "body": "La aplicación ayuda a proteger el valor de nuestras propiedades, mejorar la coordinación entre propietarios y elevar la experiencia de los huéspedes en Morros KAI.", "cards": [{"icon": "🏡", "title": "Gestión centralizada", "text": "Organizar apartamentos, contactos, emails de notificación y enlaces importantes en un solo lugar."}, {"icon": "⚠️", "title": "Reportes transparentes", "text": "Documentar incidentes de manera rápida para que el propietario correcto reciba aviso y pueda tomar acción."}, {"icon": "🤝", "title": "Colaboración comunitaria", "text": "Compartir información útil entre propietarios aprobados para operar mejor y prevenir problemas repetidos."}, {"icon": "📊", "title": "Mejora continua", "text": "Usar datos y tendencias para elevar la calidad del servicio, la comunicación y la experiencia del huésped."}], "participationTitle": "📌 Reglas de participación", "participationRules": ["Reportar incidentes con información clara, objetiva y verificable.", "Incluir detalles útiles: apartamento, huésped, fecha, tipo de incidente y descripción.", "Mantener respeto y confidencialidad en los comentarios.", "No publicar contenido ofensivo, especulativo o no relacionado con la operación.", "Usar los reportes para prevenir, corregir y mejorar; no para conflictos personales."], "accessTitle": "🔐 Acceso y responsabilidad", "accessRules": ["El acceso requiere Google Sign-In.", "Cada apartamento solo puede pertenecer a una cuenta aprobada.", "Los nuevos registros quedan pendientes hasta revisión.", "Los propietarios aprobados pueden revisar solicitudes pendientes y aprobar o rechazar con motivo.", "Las notificaciones se envían al email de Google y al email del listing cuando son diferentes."]}') on conflict (key) do nothing;

-- v45 email notification routing config (per-type, per-role toggles)
insert into public.app_config(key, value) values (
  'email_notification_config',
  '{
    "incident_new":              {"enabled":true,  "reporter":true, "owner":true,  "operator":true,  "globalAdmin":true,  "delegateAdmin":true },
    "incident_sla_notification": {"enabled":true,  "reporter":true, "owner":true,  "operator":true,  "globalAdmin":false, "delegateAdmin":false},
    "incident_sla_reminder":     {"enabled":true,  "reporter":true, "owner":true,  "operator":true,  "globalAdmin":false, "delegateAdmin":false},
    "incident_sla":              {"enabled":true,  "reporter":true, "owner":true,  "operator":true,  "globalAdmin":true,  "delegateAdmin":false},
    "incident_verified":           {"enabled":true,  "reporter":true, "owner":true,  "operator":true,  "globalAdmin":true,  "delegateAdmin":true },
    "incident_resolution_added":   {"enabled":true,  "reporter":true, "owner":true,  "operator":true,  "globalAdmin":true,  "delegateAdmin":true },
    "incident_resolved":           {"enabled":true,  "reporter":true, "owner":true,  "operator":true,  "globalAdmin":true,  "delegateAdmin":true },
    "registration_submitted":    {"enabled":true,  "owner":true,  "operator":false, "globalAdmin":false, "delegateAdmin":false},
    "registration_approved":     {"enabled":true,  "owner":true,  "operator":false, "globalAdmin":true,  "delegateAdmin":true },
    "registration_declined":     {"enabled":true,  "owner":true,  "operator":false, "globalAdmin":true,  "delegateAdmin":true },
    "registration_status_admin": {"enabled":true,  "owner":false, "operator":false, "globalAdmin":true,  "delegateAdmin":true },
    "registration_reviewer":     {"enabled":true,  "owner":true,  "operator":false, "globalAdmin":true,  "delegateAdmin":true },
    "listing_created":           {"enabled":true,  "owner":true,  "operator":false, "globalAdmin":false, "delegateAdmin":false},
    "listing_updated":           {"enabled":true,  "owner":true,  "operator":false, "globalAdmin":false, "delegateAdmin":false},
    "listing_deleted":           {"enabled":true,  "owner":true,  "operator":false, "globalAdmin":false, "delegateAdmin":false}
  }'
) on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- APP USERS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.app_users (
  uid text primary key,
  email text not null unique,
  name text not null default '',
  role text not null default 'user' check (role in ('user','delegate_admin','global_admin')),
  permissions jsonb not null default '{}'::jsonb,
  language_preference text not null default 'es-CO' check (language_preference in ('es-CO','en')),
  whatsapp text not null default '',
  country text not null default 'Colombia',
  notification_email text not null default '',
  updated_at timestamptz not null default now()
);

-- Backfill columns for existing databases
alter table public.app_users add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.app_users add column if not exists language_preference text not null default 'es-CO';
alter table public.app_users add column if not exists whatsapp text not null default '';
alter table public.app_users add column if not exists country text not null default 'Colombia';
alter table public.app_users add column if not exists notification_email text not null default '';

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id text primary key,
  community_id text not null default 'kai' references public.communities(id),
  owner_uid text not null,
  listing_id text references public.listings(id) on delete cascade,
  incident_id text references public.incidents(id) on delete cascade,
  title text not null,
  message text not null default '',
  is_read boolean not null default false,
  email_sent boolean not null default false,
  email_error text not null default '',
  kind text not null default 'incident',
  registration_id text,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists community_id text not null default 'kai' references public.communities(id);
alter table public.notifications add column if not exists kind text not null default 'incident';
alter table public.notifications add column if not exists registration_id text;
alter table public.notifications drop constraint if exists notifications_registration_id_fkey;
alter table public.notifications alter column listing_id drop not null;
alter table public.notifications alter column incident_id drop not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- LISTING AUDIT EVENTS (legacy per-listing audit trail)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.listing_audit_events (
  id text primary key,
  listing_id text,
  registration_id text,
  actor_uid text not null default '',
  actor_name text not null default '',
  action text not null,
  reason text not null default '',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOGS (v27 unified audit log for all mutable entities)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.audit_logs (
  id text primary key,
  community_id text not null default 'kai' references public.communities(id),
  entity text not null,
  entity_id text not null default '',
  action text not null,
  actor_uid text not null default '',
  actor_email text not null default '',
  actor_name text not null default '',
  reason text not null default '',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists community_id text not null default 'kai' references public.communities(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL TEMPLATES
-- v80: community_id added as sentinel-value column (not FK; '__global__' = applies to all communities).
--      PK is now (community_id, key, language).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_templates (
  community_id text not null default '__global__',
  key text not null,
  label text not null default '',
  subject text not null default '',
  text text not null default '',
  html text not null default '',
  updated_at timestamptz not null default now(),
  updated_by_email text not null default '',
  language text not null default 'es-CO' check (language in ('es-CO','en')),
  primary key (community_id, key, language)
);

-- Backfill community_id column and migrate PK for existing databases
alter table public.email_templates add column if not exists community_id text not null default '__global__';
alter table public.email_templates add column if not exists language text not null default 'es-CO';
-- Drop old PKs and recreate with community_id included
alter table public.email_templates drop constraint if exists email_templates_pkey;
alter table public.email_templates add constraint email_templates_pkey primary key (community_id, key, language);

-- Default Spanish template for incident_verified event
insert into public.email_templates(community_id, key, language, label, subject, text, html)
values (
  '__global__',
  'incident_verified',
  'es-CO',
  'Incidente verificado',
  'Incidente verificado - Apto {{apt}} Torre KAI',
  'Hola,\n\nEl propietario verificó el incidente.\n\nApartamento: {{apt}} - Torre KAI\nPropietario: {{owner}}\nOperador: {{operator}}\nHuésped(es): {{ownerGuestNames}}\nComentarios del propietario: {{ownerComments}}\n\nVer incidente: {{incidentLink}}\n',
  '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#17313a"><h2 style="color:#2F4F3A">Incidente verificado</h2><p>El propietario verificó el incidente y completó la información requerida.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Huésped(es):</strong> {{ownerGuestNames}}</p><p><strong>Comentarios del propietario:</strong></p><p style="background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px">{{ownerComments}}</p><p style="margin:18px 0"><a href="{{incidentLink}}" style="background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700">Ver incidente</a></p></div>'
)
on conflict (community_id, key, language) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL DELIVERY LOGS (v34)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_delivery_logs (
  id text primary key,
  community_id text not null default 'kai' references public.communities(id),
  event_type text not null default '',
  recipients text[] not null default '{}',
  subject text not null default '',
  status text not null default '',
  error_message text not null default '',
  related_entity text not null default '',
  related_id text not null default '',
  created_at timestamptz not null default now()
);

alter table public.email_delivery_logs add column if not exists community_id text not null default 'kai' references public.communities(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- Listings: enforce one active record per apartment, now scoped per community (v80)
drop index if exists public.idx_listings_unique_active_kai_apt;
drop index if exists public.idx_listings_unique_kai_apt;
drop index if exists public.unique_apartment;
drop index if exists public.unique_apartment_active;
create unique index if not exists idx_listings_unique_active_community_apt
  on public.listings(community_id, apt)
  where status in ('pending','approved');

create index if not exists idx_listings_community_id on public.listings(community_id);
create index if not exists idx_listings_owner_uid on public.listings(owner_uid);
create index if not exists idx_listings_status_created on public.listings(status, created_at desc);
create index if not exists idx_listings_registration_id on public.listings(registration_id);

create index if not exists idx_incidents_community_id on public.incidents(community_id);
create index if not exists idx_incidents_reporter_uid on public.incidents(reporter_uid);
create index if not exists idx_incidents_apt_id on public.incidents(apt_id);

-- v73: SLA index now includes 'verified' incidents (SLA fires until owner adds resolution).
-- Drop old partial index that excluded 'verified', recreate covering all non-resolved.
drop index if exists public.idx_incidents_sla_due;
create index if not exists idx_incidents_sla_due
  on public.incidents(next_sla_reminder_at)
  where status != 'resolved';

create index if not exists idx_incidents_created_at on public.incidents(created_at desc);
-- v26 analytics / dashboard indexes
create index if not exists idx_incidents_created_status on public.incidents(created_at desc, status);
create index if not exists idx_incidents_owner_verified_at on public.incidents(owner_verified_at) where owner_verified_at is not null;
create index if not exists idx_incidents_type_category on public.incidents(type, category);
-- v73: fast lookup of incidents pending owner resolution
create index if not exists idx_incidents_pending_resolution
  on public.incidents(owner_resolution_at)
  where status = 'verified' and owner_resolution_at is null;

create index if not exists idx_notifications_community_id on public.notifications(community_id);
create index if not exists idx_notifications_owner_uid on public.notifications(owner_uid);
create index if not exists idx_notifications_read on public.notifications(owner_uid, is_read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_registration_id on public.notifications(registration_id);

create index if not exists idx_listing_audit_registration_id on public.listing_audit_events(registration_id);
create index if not exists idx_listing_audit_listing_id on public.listing_audit_events(listing_id);
create index if not exists idx_listing_audit_created_at on public.listing_audit_events(created_at desc);

create index if not exists idx_audit_logs_entity on public.audit_logs(entity, entity_id, created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_email, created_at desc);

create index if not exists idx_email_delivery_logs_created_at on public.email_delivery_logs(created_at desc);
create index if not exists idx_email_delivery_logs_status on public.email_delivery_logs(status);

-- v80: community membership indexes
create index if not exists idx_community_memberships_user on public.community_memberships(user_uid);
create index if not exists idx_community_memberships_community on public.community_memberships(community_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — disabled (server uses service role key)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.listings disable row level security;
alter table public.incidents disable row level security;
alter table public.notifications disable row level security;
alter table public.listing_audit_events disable row level security;
alter table public.app_config disable row level security;
alter table public.app_users disable row level security;
alter table public.audit_logs disable row level security;
alter table public.email_templates disable row level security;
alter table public.email_delivery_logs disable row level security;
alter table public.communities disable row level security;
alter table public.community_memberships disable row level security;
alter table public.community_config disable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- TAX MODULE (v85, Phase 1) — landing + leads + product catalog
-- New vertical reusing the existing `communities` table as the multi-tenant
-- boundary. A tax practice is `business_type='tax'`. Branches (same brand,
-- different address) use `parent_community_id` to inherit branding.
-- ─────────────────────────────────────────────────────────────────────────────

-- v85a: vertical + branch hierarchy + service-business contact fields on communities
alter table public.communities add column if not exists business_type text not null default 'airbnb';
do $$ begin
  alter table public.communities add constraint communities_business_type_chk
    check (business_type in ('airbnb','tax'));
exception when duplicate_object then null; end $$;

alter table public.communities add column if not exists parent_community_id text references public.communities(id) on delete set null;
alter table public.communities add column if not exists address_line1 text not null default '';
alter table public.communities add column if not exists address_line2 text not null default '';
alter table public.communities add column if not exists postal_code text not null default '';
alter table public.communities add column if not exists phone text not null default '';
alter table public.communities add column if not exists contact_email text not null default '';
alter table public.communities add column if not exists tagline text not null default '';
alter table public.communities add column if not exists tagline_en text not null default '';
alter table public.communities add column if not exists brand_primary_color text not null default '';
alter table public.communities add column if not exists brand_secondary_color text not null default '';
alter table public.communities add column if not exists default_locale text not null default 'es';
do $$ begin
  alter table public.communities add constraint communities_default_locale_chk
    check (default_locale in ('en','es'));
exception when duplicate_object then null; end $$;

-- v85-2a: per-community toggle controlling whether customers can change their
-- own reminder-channel preference inside the portal. Default: false (locked).
-- Owner flips to true to allow customer self-service. Existing subscription
-- reminder_channels are not affected when this flag changes.
alter table public.communities add column if not exists tax_allow_customer_notif_pref_change boolean not null default false;

create index if not exists idx_communities_business_type on public.communities(business_type);
create index if not exists idx_communities_parent on public.communities(parent_community_id);

-- Seed Tax America Services (single org + single community at launch).
-- Owner can edit any of these fields later via the admin UI in Phase 4b.
insert into public.communities (
  id, name, name_en, business_type,
  city, state, country,
  address_line1, postal_code,
  contact_email,
  tagline, tagline_en,
  brand_primary_color, brand_secondary_color,
  logo_url,
  description, description_en
) values (
  'tax-america-services',
  'Tax America Services',
  'Tax America Services',
  'tax',
  'Hamden', 'CT', 'USA',
  '1310 Dixwell Ave, Unit 1', '06514',
  'info@taxamericaservices.com',
  'Su éxito financiero en buenas manos',
  'Your financial success in good hands',
  '#1d3a6d',
  '#d62027',
  '/tax/tax-america-services-logo.png',
  'Servicios profesionales de impuestos, contabilidad y formación de empresas para individuos y negocios.',
  'Professional tax preparation, bookkeeping, and business formation services for individuals and businesses.'
) on conflict (id) do nothing;

-- Re-applies the canonical brand defaults for tax-america-services so
-- re-running this schema after a brand update overwrites the older values.
-- Owner can change again via SQL today; via admin UI in Phase 4b.
update public.communities set
  brand_primary_color   = '#1d3a6d',
  brand_secondary_color = '#d62027',
  logo_url              = '/tax/tax-america-services-logo.png',
  default_locale        = 'es'
where id = 'tax-america-services';

-- v85b: tax_products — service catalog cloned per tax community.
-- workflow / sla_hours / required_documents / notification_rules are JSONB and
-- start empty; Phase 2+ populates them. Owner can enable/disable and edit
-- name/description in Phase 4b. Custom products are explicitly out of v1.
create table if not exists public.tax_products (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  slug text not null,
  category text not null default 'tax_prep',
  enabled boolean not null default true,
  display_order int not null default 0,
  name_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  icon text not null default '',
  workflow jsonb not null default '[]'::jsonb,
  sla_hours jsonb not null default '{}'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  notification_rules jsonb not null default '[]'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, slug)
);
create index if not exists idx_tax_products_community on public.tax_products(community_id, enabled, display_order);

-- Seed defaults for Tax America Services (10 services from taxamericaservices.com).
insert into public.tax_products (id, community_id, slug, category, display_order, name_i18n, description_i18n, icon) values
  ('tax-america-services:individual-tax', 'tax-america-services', 'individual-tax', 'tax_prep', 10,
    '{"en":"Individual Income Tax","es":"Impuestos Personales"}'::jsonb,
    '{"en":"Federal and state income tax preparation for individuals and families.","es":"Preparación de impuestos federales y estatales para individuos y familias."}'::jsonb,
    'receipt'),
  ('tax-america-services:business-tax', 'tax-america-services', 'business-tax', 'tax_prep', 20,
    '{"en":"Business Tax Preparation","es":"Impuestos de Negocios"}'::jsonb,
    '{"en":"Tax filings for LLCs, S-Corps, C-Corps, and partnerships.","es":"Declaraciones de impuestos para LLCs, S-Corps, C-Corps y sociedades."}'::jsonb,
    'briefcase'),
  ('tax-america-services:itin', 'tax-america-services', 'itin', 'one_off', 30,
    '{"en":"ITIN Application","es":"Solicitud de ITIN"}'::jsonb,
    '{"en":"Apply for an Individual Taxpayer Identification Number.","es":"Solicitud del Número de Identificación Personal del Contribuyente (ITIN)."}'::jsonb,
    'id-card'),
  ('tax-america-services:bookkeeping', 'tax-america-services', 'bookkeeping', 'recurring', 40,
    '{"en":"Bookkeeping","es":"Contabilidad"}'::jsonb,
    '{"en":"Monthly bookkeeping and financial reporting for small businesses.","es":"Contabilidad mensual y reportes financieros para pequeños negocios."}'::jsonb,
    'book'),
  ('tax-america-services:payroll', 'tax-america-services', 'payroll', 'recurring', 50,
    '{"en":"Payroll Services","es":"Nómina"}'::jsonb,
    '{"en":"Payroll processing, tax withholdings, and quarterly filings.","es":"Procesamiento de nómina, retenciones fiscales y declaraciones trimestrales."}'::jsonb,
    'wallet'),
  ('tax-america-services:business-formation', 'tax-america-services', 'business-formation', 'one_off', 60,
    '{"en":"Business Formation","es":"Formación de Empresas"}'::jsonb,
    '{"en":"LLC, Corporation, and partnership formation and EIN registration.","es":"Constitución de LLC, Corporaciones y sociedades, y registro de EIN."}'::jsonb,
    'building'),
  ('tax-america-services:notary', 'tax-america-services', 'notary', 'one_off', 70,
    '{"en":"Notary Services","es":"Servicios Notariales"}'::jsonb,
    '{"en":"Notarization of legal and financial documents.","es":"Notarización de documentos legales y financieros."}'::jsonb,
    'stamp'),
  ('tax-america-services:translation', 'tax-america-services', 'translation', 'one_off', 80,
    '{"en":"Translation Services","es":"Traducciones"}'::jsonb,
    '{"en":"Certified document translation between English and Spanish.","es":"Traducción certificada de documentos entre inglés y español."}'::jsonb,
    'globe'),
  ('tax-america-services:irs-representation', 'tax-america-services', 'irs-representation', 'one_off', 90,
    '{"en":"IRS Representation","es":"Representación ante el IRS"}'::jsonb,
    '{"en":"Audit defense and IRS correspondence on your behalf.","es":"Defensa en auditorías y correspondencia con el IRS en su nombre."}'::jsonb,
    'scales'),
  ('tax-america-services:sales-tax', 'tax-america-services', 'sales-tax', 'recurring', 100,
    '{"en":"Sales Tax Filing","es":"Impuestos sobre Ventas"}'::jsonb,
    '{"en":"State and local sales tax registration, collection, and filing.","es":"Registro, recolección y declaración de impuestos sobre ventas estatales y locales."}'::jsonb,
    'calculator')
on conflict (id) do nothing;

-- v85c: tax_leads — public landing page contact form submissions.
create table if not exists public.tax_leads (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  product_slug text not null default '',
  message text not null default '',
  preferred_locale text not null default 'en' check (preferred_locale in ('en','es')),
  status text not null default 'new' check (status in ('new','contacted','converted','closed')),
  source text not null default 'landing',
  user_agent text not null default '',
  ip text not null default '',
  contacted_at timestamptz,
  contacted_by_uid text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tax_leads_community on public.tax_leads(community_id, created_at desc);
create index if not exists idx_tax_leads_status on public.tax_leads(community_id, status);
create index if not exists idx_tax_leads_email on public.tax_leads(email);

alter table public.tax_products disable row level security;
alter table public.tax_leads disable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- TAX MODULE — Phase 1.5: Compliance Reminders
-- Subscriptions, recurring schedules, filing periods, magic-link responses,
-- in-app notifications. See server/modules/tax/ for the cron + dispatcher.
-- ─────────────────────────────────────────────────────────────────────────────

-- Customers known to the tax module. No Firebase auth yet in Phase 1.5 —
-- magic-link tokens identify them. Phase 2 adds firebase_uid + portal accounts.
create table if not exists public.tax_customers (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  locale text not null default 'es' check (locale in ('en','es')),
  status text not null default 'active' check (status in ('active','paused','archived')),
  notes text not null default '',
  firebase_uid text not null default '',  -- Phase 2 populates this on first portal login
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, email)
);
create index if not exists idx_tax_customers_community on public.tax_customers(community_id, status);

-- Schedule definitions — one row per recurring filing under a product.
-- A product like "Payroll Services" has multiple schedules (941 quarterly,
-- W-2 January). When a customer subscribes to the product, periods are
-- generated from all `enabled=true` schedules unless the subscription opts
-- some out via `active_schedule_slugs`.
create table if not exists public.tax_filing_schedules (
  id text primary key,                                   -- e.g. 'fed-941-quarterly'
  community_id text not null references public.communities(id) on delete cascade,
  product_id text not null references public.tax_products(id) on delete cascade,
  slug text not null,
  jurisdiction text not null default 'federal',          -- 'federal' | 'state:CT' | 'state:NY' | ...
  cadence text not null check (cadence in ('monthly','quarterly','annual','custom')),
  -- anchor_rule describes when the filing recurs. Shapes:
  --   { type:'fixed_quarterly', dates:['04-15','06-15','09-15','01-15'] }
  --   { type:'monthly_following', day:20 }   -- 20th of month FOLLOWING the period
  --   { type:'annual', date:'01-31' }
  anchor_rule jsonb not null default '{}'::jsonb,
  -- info_checklist: array of { key, label_i18n, type ('number'|'text'|'currency'), required }
  info_checklist jsonb not null default '[]'::jsonb,
  name_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  display_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, slug)
);
create index if not exists idx_tax_filing_schedules_product on public.tax_filing_schedules(product_id, enabled);

-- Customer × product enrollment. One row per recurring service per customer.
create table if not exists public.tax_subscriptions (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  customer_id text not null references public.tax_customers(id) on delete cascade,
  product_id text not null references public.tax_products(id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused','ended')),
  start_date date not null default current_date,
  end_date date,
  -- null = all enabled schedules of this product; explicit list = only those slugs
  active_schedule_slugs text[],
  -- default both channels; owner can set ['email'] or ['in_app'] per subscription
  reminder_channels text[] not null default '{email,in_app}',
  -- default offsets relative to due date; negative = days before
  reminder_offsets_days int[] not null default '{-14,-7,-3}',
  custom_info_checklist jsonb,                            -- per-customer override; null = use schedule defaults
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id)
);
create index if not exists idx_tax_subs_community on public.tax_subscriptions(community_id, status);
create index if not exists idx_tax_subs_customer on public.tax_subscriptions(customer_id);

-- Instance of an upcoming/past filing for a specific customer.
create table if not exists public.tax_filing_periods (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  subscription_id text not null references public.tax_subscriptions(id) on delete cascade,
  schedule_id text not null references public.tax_filing_schedules(id) on delete cascade,
  customer_id text not null references public.tax_customers(id) on delete cascade,
  period_label text not null default '',                  -- 'Q1 2026' | 'Jan 2026' | 'Tax Year 2025'
  period_start date,
  period_end date,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','info_requested','info_received','in_prep','filed','skipped')),
  info_received_at timestamptz,
  filed_at timestamptz,
  assigned_employee_uid text not null default '',         -- Phase 3 wires this
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, schedule_id, due_date)
);
create index if not exists idx_tax_periods_due on public.tax_filing_periods(community_id, status, due_date);
create index if not exists idx_tax_periods_customer on public.tax_filing_periods(customer_id, due_date desc);

-- Magic-link tokens for customer info submissions. Token stored hashed
-- (sha-256 hex). Single-use OR until the period reaches info_received.
create table if not exists public.tax_response_tokens (
  id text primary key,
  period_id text not null references public.tax_filing_periods(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_tax_tokens_period on public.tax_response_tokens(period_id);

-- Captured customer responses for a filing period.
create table if not exists public.tax_filing_responses (
  id text primary key,
  period_id text not null references public.tax_filing_periods(id) on delete cascade,
  customer_id text not null references public.tax_customers(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,                -- { checklistKey: value, ... }
  notes text not null default '',
  submitted_at timestamptz not null default now(),
  ip text not null default '',
  user_agent text not null default ''
);
create index if not exists idx_tax_responses_period on public.tax_filing_responses(period_id, submitted_at desc);

-- In-app notification rows. Phase 1.5 writes when channel includes 'in_app';
-- Phase 2 customer portal renders unread rows for the customer.
create table if not exists public.tax_notifications (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  customer_id text not null references public.tax_customers(id) on delete cascade,
  type text not null,                                     -- 'reminder' | 'response_received' | ...
  title_i18n jsonb not null default '{}'::jsonb,
  body_i18n jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,             -- { periodId, scheduleSlug, magicUrl, ... }
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_tax_notifs_customer on public.tax_notifications(customer_id, created_at desc);

-- Audit reminder dispatch (separate from audit_logs to keep it queryable + cheap).
create table if not exists public.tax_reminder_log (
  id text primary key,
  period_id text not null references public.tax_filing_periods(id) on delete cascade,
  channel text not null check (channel in ('email','in_app')),
  offset_days int not null,
  status text not null check (status in ('sent','failed','skipped')),
  reason text not null default '',
  sent_at timestamptz not null default now()
);
create index if not exists idx_tax_reminder_log_period on public.tax_reminder_log(period_id, sent_at desc);
create unique index if not exists ux_tax_reminder_once on public.tax_reminder_log(period_id, channel, offset_days) where status = 'sent';

alter table public.tax_customers           disable row level security;
alter table public.tax_subscriptions       disable row level security;
alter table public.tax_filing_schedules    disable row level security;
alter table public.tax_filing_periods      disable row level security;
alter table public.tax_response_tokens     disable row level security;
alter table public.tax_filing_responses    disable row level security;
alter table public.tax_notifications       disable row level security;
alter table public.tax_reminder_log        disable row level security;

-- ── SEED: filing schedules for Tax America Services ─────────────────────────
-- Federal (every state): Q1–Q4 estimated tax, Form 941 quarterly, W-2/1099 January.
-- Connecticut: Sales & Use Tax monthly, Sales & Use Tax quarterly,
-- CT Estimated Income Tax quarterly.
-- Per owner feedback: federal payroll tax deposits + CT-941 are NOT customer-
-- facing (owner handles directly), so they are omitted from this seed.

insert into public.tax_filing_schedules (id, community_id, product_id, slug, jurisdiction, cadence, anchor_rule, info_checklist, name_i18n, description_i18n, display_order) values

-- ── Federal estimated income tax (attached to Individual + Business products) ─
('tax-america-services:fed-1040es', 'tax-america-services', 'tax-america-services:individual-tax', 'fed-1040es',
  'federal', 'quarterly',
  '{"type":"fixed_quarterly","dates":["04-15","06-15","09-15","01-15"]}'::jsonb,
  '[
    {"key":"income_estimate","type":"currency","required":true,"label_i18n":{"es":"Ingreso estimado del trimestre (USD)","en":"Estimated income for the quarter (USD)"}},
    {"key":"deductions_estimate","type":"currency","required":false,"label_i18n":{"es":"Deducciones estimadas (USD)","en":"Estimated deductions (USD)"}},
    {"key":"prior_year_paid","type":"currency","required":false,"label_i18n":{"es":"Pagos estimados previos del año (USD)","en":"Prior estimated payments this year (USD)"}},
    {"key":"notes","type":"text","required":false,"label_i18n":{"es":"Notas o cambios de situación","en":"Notes or changes in situation"}}
  ]'::jsonb,
  '{"es":"Impuesto Estimado Federal (1040-ES)","en":"Federal Estimated Income Tax (1040-ES)"}'::jsonb,
  '{"es":"Pago trimestral de impuesto estimado para individuos.","en":"Quarterly estimated income tax for individuals."}'::jsonb,
  10),

('tax-america-services:fed-1120w', 'tax-america-services', 'tax-america-services:business-tax', 'fed-1120w',
  'federal', 'quarterly',
  '{"type":"fixed_quarterly","dates":["04-15","06-15","09-15","12-15"]}'::jsonb,
  '[
    {"key":"taxable_income_estimate","type":"currency","required":true,"label_i18n":{"es":"Ingreso gravable estimado del trimestre (USD)","en":"Estimated taxable income for the quarter (USD)"}},
    {"key":"prior_year_paid","type":"currency","required":false,"label_i18n":{"es":"Pagos estimados previos del año (USD)","en":"Prior estimated payments this year (USD)"}},
    {"key":"notes","type":"text","required":false,"label_i18n":{"es":"Notas o cambios","en":"Notes or changes"}}
  ]'::jsonb,
  '{"es":"Impuesto Estimado Federal Corporativo (1120-W)","en":"Federal Corporate Estimated Tax (1120-W)"}'::jsonb,
  '{"es":"Pago trimestral de impuesto estimado para corporaciones.","en":"Quarterly estimated income tax for corporations."}'::jsonb,
  20),

-- ── Federal Form 941 quarterly (attached to Payroll product) ────────────────
('tax-america-services:fed-941', 'tax-america-services', 'tax-america-services:payroll', 'fed-941',
  'federal', 'quarterly',
  '{"type":"fixed_quarterly","dates":["04-30","07-31","10-31","01-31"]}'::jsonb,
  '[
    {"key":"total_wages","type":"currency","required":true,"label_i18n":{"es":"Salarios totales pagados en el trimestre (USD)","en":"Total wages paid in the quarter (USD)"}},
    {"key":"federal_withheld","type":"currency","required":true,"label_i18n":{"es":"Impuesto federal retenido (USD)","en":"Federal income tax withheld (USD)"}},
    {"key":"social_security_wages","type":"currency","required":true,"label_i18n":{"es":"Salarios sujetos a Seguro Social (USD)","en":"Social Security wages (USD)"}},
    {"key":"medicare_wages","type":"currency","required":true,"label_i18n":{"es":"Salarios sujetos a Medicare (USD)","en":"Medicare wages (USD)"}},
    {"key":"num_employees","type":"number","required":true,"label_i18n":{"es":"Número de empleados","en":"Number of employees"}},
    {"key":"notes","type":"text","required":false,"label_i18n":{"es":"Notas","en":"Notes"}}
  ]'::jsonb,
  '{"es":"Declaración Trimestral del Empleador (Form 941)","en":"Employer''s Quarterly Federal Tax Return (Form 941)"}'::jsonb,
  '{"es":"Reporte trimestral de impuestos retenidos, Seguro Social y Medicare.","en":"Quarterly report of withheld income tax, Social Security, and Medicare taxes."}'::jsonb,
  30),

-- ── Federal W-2 / 1099 January (attached to Payroll product) ────────────────
('tax-america-services:fed-w2-1099', 'tax-america-services', 'tax-america-services:payroll', 'fed-w2-1099',
  'federal', 'annual',
  '{"type":"annual","date":"01-31"}'::jsonb,
  '[
    {"key":"num_w2","type":"number","required":true,"label_i18n":{"es":"Número de W-2 a emitir","en":"Number of W-2s to issue"}},
    {"key":"num_1099","type":"number","required":true,"label_i18n":{"es":"Número de 1099 a emitir","en":"Number of 1099s to issue"}},
    {"key":"contractor_list_notes","type":"text","required":false,"label_i18n":{"es":"Notas sobre contratistas o empleados nuevos","en":"Notes on new contractors or employees"}}
  ]'::jsonb,
  '{"es":"Emisión Anual de W-2 / 1099","en":"Annual W-2 / 1099 Filing"}'::jsonb,
  '{"es":"Emisión anual de formularios W-2 y 1099 al 31 de enero.","en":"Annual issuance of W-2 and 1099 forms by January 31."}'::jsonb,
  40),

-- ── Connecticut Sales & Use Tax — monthly ────────────────────────────────────
-- CT requires monthly filing for higher-volume sellers; quarterly otherwise.
-- Subscription `active_schedule_slugs` picks which one applies per customer.
('tax-america-services:ct-sut-monthly', 'tax-america-services', 'tax-america-services:sales-tax', 'ct-sut-monthly',
  'state:CT', 'monthly',
  '{"type":"monthly_following","day":20}'::jsonb,
  '[
    {"key":"gross_sales","type":"currency","required":true,"label_i18n":{"es":"Ventas brutas del mes (USD)","en":"Gross sales for the month (USD)"}},
    {"key":"taxable_sales","type":"currency","required":true,"label_i18n":{"es":"Ventas gravables (USD)","en":"Taxable sales (USD)"}},
    {"key":"exempt_sales","type":"currency","required":true,"label_i18n":{"es":"Ventas exentas (USD)","en":"Exempt sales (USD)"}},
    {"key":"tax_collected","type":"currency","required":true,"label_i18n":{"es":"Impuesto sobre ventas recaudado (USD)","en":"Sales tax collected (USD)"}},
    {"key":"notes","type":"text","required":false,"label_i18n":{"es":"Notas","en":"Notes"}}
  ]'::jsonb,
  '{"es":"Impuesto sobre Ventas y Uso de CT — Mensual","en":"CT Sales & Use Tax — Monthly"}'::jsonb,
  '{"es":"Declaración mensual de impuesto sobre ventas (vence el día 20 del mes siguiente).","en":"Monthly sales tax return (due the 20th of the following month)."}'::jsonb,
  50),

-- ── Connecticut Sales & Use Tax — quarterly ─────────────────────────────────
('tax-america-services:ct-sut-quarterly', 'tax-america-services', 'tax-america-services:sales-tax', 'ct-sut-quarterly',
  'state:CT', 'quarterly',
  '{"type":"fixed_quarterly","dates":["04-30","07-31","10-31","01-31"]}'::jsonb,
  '[
    {"key":"gross_sales","type":"currency","required":true,"label_i18n":{"es":"Ventas brutas del trimestre (USD)","en":"Gross sales for the quarter (USD)"}},
    {"key":"taxable_sales","type":"currency","required":true,"label_i18n":{"es":"Ventas gravables (USD)","en":"Taxable sales (USD)"}},
    {"key":"exempt_sales","type":"currency","required":true,"label_i18n":{"es":"Ventas exentas (USD)","en":"Exempt sales (USD)"}},
    {"key":"tax_collected","type":"currency","required":true,"label_i18n":{"es":"Impuesto sobre ventas recaudado (USD)","en":"Sales tax collected (USD)"}},
    {"key":"notes","type":"text","required":false,"label_i18n":{"es":"Notas","en":"Notes"}}
  ]'::jsonb,
  '{"es":"Impuesto sobre Ventas y Uso de CT — Trimestral","en":"CT Sales & Use Tax — Quarterly"}'::jsonb,
  '{"es":"Declaración trimestral de impuesto sobre ventas.","en":"Quarterly sales tax return."}'::jsonb,
  60),

-- ── Connecticut Estimated Income Tax quarterly ──────────────────────────────
('tax-america-services:ct-estimated', 'tax-america-services', 'tax-america-services:individual-tax', 'ct-estimated',
  'state:CT', 'quarterly',
  '{"type":"fixed_quarterly","dates":["04-15","06-15","09-15","01-15"]}'::jsonb,
  '[
    {"key":"income_estimate","type":"currency","required":true,"label_i18n":{"es":"Ingreso estimado del trimestre (USD)","en":"Estimated income for the quarter (USD)"}},
    {"key":"prior_year_paid","type":"currency","required":false,"label_i18n":{"es":"Pagos estimados previos del año (USD)","en":"Prior estimated payments this year (USD)"}},
    {"key":"notes","type":"text","required":false,"label_i18n":{"es":"Notas","en":"Notes"}}
  ]'::jsonb,
  '{"es":"Impuesto Estimado de Connecticut","en":"CT Estimated Income Tax"}'::jsonb,
  '{"es":"Pago trimestral del impuesto estimado de Connecticut.","en":"Quarterly Connecticut estimated income tax payment."}'::jsonb,
  70)

on conflict (id) do nothing;

-- ── SEED: test customer (Martha Pause) + sample subscriptions ───────────────
insert into public.tax_customers (id, community_id, email, name, locale)
values ('cust_martha_pause', 'tax-america-services', 'inversur1310@gmail.com', 'Martha Pause', 'es')
on conflict (community_id, email) do nothing;

-- Subscribe Martha to Sales Tax (CT monthly only, opting out of quarterly)
-- and Payroll. Reminders go via email + in-app by default.
insert into public.tax_subscriptions (id, community_id, customer_id, product_id, active_schedule_slugs) values
  ('sub_martha_sales',   'tax-america-services', 'cust_martha_pause', 'tax-america-services:sales-tax', ARRAY['ct-sut-monthly']),
  ('sub_martha_payroll', 'tax-america-services', 'cust_martha_pause', 'tax-america-services:payroll',   null)
on conflict (customer_id, product_id) do nothing;

-- Deprecated old registration tables are intentionally not used by the app anymore.
-- Keep them as historical backups unless you have verified the migration and want to drop them manually.
