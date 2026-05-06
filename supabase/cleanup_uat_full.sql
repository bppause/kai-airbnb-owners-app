-- ─────────────────────────────────────────────────────────────────────────────
-- Propietarios Airbnb KAI — FULL UAT cleanup (includes app_users)
-- Run this in Supabase Dashboard → SQL Editor for a complete clean slate.
--
-- ⚠️  WARNING: this removes ALL user accounts, including admin accounts.
--     After running, the first sign-in with a GLOBAL_ADMIN_EMAILS address
--     will automatically recreate that account via /api/admin/me.
--     All other users must re-register.
--
-- KEEPS:  app_config · email_templates · communities WHERE id = 'kai'
-- CLEARS: listings · incidents · notifications · audit logs ·
--         email delivery logs · community_memberships · community_config ·
--         communities (non-default rows) · app_users (all rows)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Audit & delivery logs (no FK deps on other cleared tables) ──
DELETE FROM public.audit_logs;
DELETE FROM public.listing_audit_events;
DELETE FROM public.email_delivery_logs;

-- ── 2. Notifications (FK → listings, incidents) ──
DELETE FROM public.notifications;

-- ── 3. Incidents (FK → listings) ──
DELETE FROM public.incidents;

-- ── 4. Listings (includes all registration state) ──
DELETE FROM public.listings;

-- ── 5. Community membership & config (FK → communities) ──
DELETE FROM public.community_memberships;
DELETE FROM public.community_config;

-- ── 6. All user accounts ──
DELETE FROM public.app_users;

-- ── 7. Non-default communities (keep the seeded 'kai' row) ──
DELETE FROM public.communities WHERE id != 'kai';

-- ── 8. Verification ──
SELECT 'listings'                  AS "table", COUNT(*)::int AS remaining FROM public.listings
UNION ALL
SELECT 'incidents',                             COUNT(*)::int              FROM public.incidents
UNION ALL
SELECT 'notifications',                         COUNT(*)::int              FROM public.notifications
UNION ALL
SELECT 'audit_logs',                            COUNT(*)::int              FROM public.audit_logs
UNION ALL
SELECT 'listing_audit_events',                  COUNT(*)::int              FROM public.listing_audit_events
UNION ALL
SELECT 'email_delivery_logs',                   COUNT(*)::int              FROM public.email_delivery_logs
UNION ALL
SELECT 'community_memberships',                 COUNT(*)::int              FROM public.community_memberships
UNION ALL
SELECT 'community_config',                      COUNT(*)::int              FROM public.community_config
UNION ALL
SELECT 'app_users',                             COUNT(*)::int              FROM public.app_users
UNION ALL
SELECT 'communities (non-default)',             COUNT(*)::int              FROM public.communities WHERE id != 'kai'
UNION ALL
SELECT 'communities (kept: kai)',               COUNT(*)::int              FROM public.communities WHERE id = 'kai'
UNION ALL
SELECT 'app_config (kept)',                     COUNT(*)::int              FROM public.app_config
UNION ALL
SELECT 'email_templates (kept)',                COUNT(*)::int              FROM public.email_templates
ORDER BY "table";

COMMIT;
