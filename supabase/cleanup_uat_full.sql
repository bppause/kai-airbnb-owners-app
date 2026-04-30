-- ─────────────────────────────────────────────────────────────────────────────
-- Propietarios Airbnb KAI — FULL UAT cleanup (includes app_users)
-- Run this in Supabase Dashboard → SQL Editor for a complete clean slate.
--
-- ⚠️  WARNING: this removes ALL user accounts, including admin accounts.
--     After running, the first sign-in with a GLOBAL_ADMIN_EMAILS address
--     will automatically recreate that account via /api/admin/me.
--     All other users must re-register.
--
-- KEEPS:  app_config · email_templates
-- CLEARS: listings · incidents · notifications · audit logs ·
--         email delivery logs · app_users (all rows)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Audit & delivery logs ──
DELETE FROM public.audit_logs;
DELETE FROM public.listing_audit_events;
DELETE FROM public.email_delivery_logs;

-- ── 2. Notifications ──
DELETE FROM public.notifications;

-- ── 3. Incidents ──
DELETE FROM public.incidents;

-- ── 4. Listings (includes all registration state) ──
DELETE FROM public.listings;

-- ── 5. All user accounts ──
DELETE FROM public.app_users;

-- ── 6. Verification ──
SELECT 'listings'             AS "table", COUNT(*)::int AS remaining FROM public.listings
UNION ALL
SELECT 'incidents',                        COUNT(*)::int              FROM public.incidents
UNION ALL
SELECT 'notifications',                    COUNT(*)::int              FROM public.notifications
UNION ALL
SELECT 'audit_logs',                       COUNT(*)::int              FROM public.audit_logs
UNION ALL
SELECT 'listing_audit_events',             COUNT(*)::int              FROM public.listing_audit_events
UNION ALL
SELECT 'email_delivery_logs',              COUNT(*)::int              FROM public.email_delivery_logs
UNION ALL
SELECT 'app_users',                        COUNT(*)::int              FROM public.app_users
UNION ALL
SELECT 'app_config (kept)',                COUNT(*)::int              FROM public.app_config
UNION ALL
SELECT 'email_templates (kept)',           COUNT(*)::int              FROM public.email_templates
ORDER BY "table";

COMMIT;
