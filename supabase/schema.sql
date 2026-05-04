-- Supabase schema for Propietarios Airbnb KAI
-- v74: notification_email on app_users; co_owners JSONB on listings; owner directory search.
--      Previous: v73: owner_resolution_at on incidents; SLA continues through verified-without-resolution;
--      ui_labels_es / ui_labels_en in app_config for admin-editable UI text; guest_state field.
--      Older: v45 owner WhatsApp, v43 role/permission controls, v42 multi-guest jsonb,
--      v37 guest city/country, v34 email delivery logs, v27 audit_logs, v26 analytics indexes.
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run on an existing database — all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- No demo/test data is inserted.

-- ─────────────────────────────────────────────────────────────────────────────
-- LISTINGS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.listings (
  id text primary key,
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
  ('nav_config', '{"user":{"landing":"my","primary":["my","incidents","listings","dashboard"]},"delegate":{"landing":"my","primary":["my","incidents","listings","dashboard"]},"global":{"landing":"my","primary":["my","incidents","listings","dashboard"]}}')
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

-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL TEMPLATES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_templates (
  key text not null,
  label text not null default '',
  subject text not null default '',
  text text not null default '',
  html text not null default '',
  updated_at timestamptz not null default now(),
  updated_by_email text not null default '',
  language text not null default 'es-CO' check (language in ('es-CO','en')),
  primary key (key, language)
);

alter table public.email_templates add column if not exists language text not null default 'es-CO';
alter table public.email_templates drop constraint if exists email_templates_pkey;
alter table public.email_templates add constraint email_templates_pkey primary key (key, language);

-- Default Spanish template for incident_verified event
insert into public.email_templates(key, language, label, subject, text, html)
values (
  'incident_verified',
  'es-CO',
  'Incidente verificado',
  'Incidente verificado - Apto {{apt}} Torre KAI',
  'Hola,\n\nEl propietario verificó el incidente.\n\nApartamento: {{apt}} - Torre KAI\nPropietario: {{owner}}\nOperador: {{operator}}\nHuésped(es): {{ownerGuestNames}}\nComentarios del propietario: {{ownerComments}}\n\nVer incidente: {{incidentLink}}\n',
  '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#17313a"><h2 style="color:#2F4F3A">Incidente verificado</h2><p>El propietario verificó el incidente y completó la información requerida.</p><p><strong>Apartamento:</strong> {{apt}} · Torre KAI<br/><strong>Propietario:</strong> {{owner}}<br/><strong>Operador:</strong> {{operator}}<br/><strong>Huésped(es):</strong> {{ownerGuestNames}}</p><p><strong>Comentarios del propietario:</strong></p><p style="background:#f6f1e7;border-left:4px solid #d9b45a;padding:12px">{{ownerComments}}</p><p style="margin:18px 0"><a href="{{incidentLink}}" style="background:#2F4F3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block;font-weight:700">Ver incidente</a></p></div>'
)
on conflict (key, language) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL DELIVERY LOGS (v34)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_delivery_logs (
  id text primary key,
  event_type text not null default '',
  recipients text[] not null default '{}',
  subject text not null default '',
  status text not null default '',
  error_message text not null default '',
  related_entity text not null default '',
  related_id text not null default '',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- Listings: enforce one active record per apartment
drop index if exists public.idx_listings_unique_kai_apt;
drop index if exists public.unique_apartment;
drop index if exists public.unique_apartment_active;
create unique index if not exists idx_listings_unique_active_kai_apt
  on public.listings(apt)
  where status in ('pending','approved');

create index if not exists idx_listings_owner_uid on public.listings(owner_uid);
create index if not exists idx_listings_status_created on public.listings(status, created_at desc);
create index if not exists idx_listings_registration_id on public.listings(registration_id);

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

-- Deprecated old registration tables are intentionally not used by the app anymore.
-- Keep them as historical backups unless you have verified the migration and want to drop them manually.
