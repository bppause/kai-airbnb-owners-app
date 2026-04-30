-- ─────────────────────────────────────────────────────────────────────────────
-- Propietarios Airbnb KAI — UAT cleanup script
-- Run this in Supabase Dashboard → SQL Editor before each UAT round.
--
-- KEEPS:  app_config · email_templates
--         app_users rows (login accounts stay intact so admins can sign in)
-- CLEARS: all listings · incidents · notifications · audit logs ·
--         email delivery logs
--
-- Tip: run the verification SELECT at the bottom to confirm the result.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Audit & delivery logs (no FK dependencies on other cleared tables) ──
DELETE FROM public.audit_logs;
DELETE FROM public.listing_audit_events;
DELETE FROM public.email_delivery_logs;

-- ── 2. Notifications (FK → listings and incidents; clear before them) ──
DELETE FROM public.notifications;

-- ── 3. Incidents (FK → listings via apt_id; clear before listings) ──
DELETE FROM public.incidents;

-- ── 4. Listings — this also removes all pending/approved/declined registrations
--    since registration state is stored as rows in this table.
DELETE FROM public.listings;

-- ── 5. Reset non-admin user profiles (optional — uncomment to use) ──
--    Clears whatsapp and resets role/permissions for every account that is NOT
--    in your GLOBAL_ADMIN_EMAILS list.  Replace the email values below.
--
-- UPDATE public.app_users
-- SET
--   role        = 'user',
--   permissions = '{}'::jsonb,
--   whatsapp    = '',
--   updated_at  = now()
-- WHERE lower(email) NOT IN (
--   'admin@yourdomain.com'   -- replace with your GLOBAL_ADMIN_EMAILS
-- );

-- ── 6. Remove non-admin test accounts entirely (optional — uncomment to use) ──
--    Only needed when testers created Google-login accounts you want gone.
--
-- DELETE FROM public.app_users
-- WHERE lower(email) NOT IN (
--   'admin@yourdomain.com'   -- replace with your GLOBAL_ADMIN_EMAILS
-- );

-- ── 7. Verification — shows row counts for every cleared table ──
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
SELECT 'app_users (kept)',                 COUNT(*)::int              FROM public.app_users
UNION ALL
SELECT 'app_config (kept)',                COUNT(*)::int              FROM public.app_config
UNION ALL
SELECT 'email_templates (kept)',           COUNT(*)::int              FROM public.email_templates
ORDER BY "table";

COMMIT;
