-- Propietarios Airbnb KAI - UAT cleanup script
-- Use before a new round of User Acceptance Testing.
-- Keeps app configuration, email templates, and app_users so global/admin accounts remain available.
-- If you want to remove non-admin app users too, uncomment the optional section at the bottom.

BEGIN;

TRUNCATE TABLE IF EXISTS incident_audit_events RESTART IDENTITY CASCADE;
TRUNCATE TABLE IF EXISTS listing_audit_events RESTART IDENTITY CASCADE;
TRUNCATE TABLE IF EXISTS audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE IF EXISTS notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE IF EXISTS email_delivery_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE IF EXISTS incidents RESTART IDENTITY CASCADE;
TRUNCATE TABLE IF EXISTS listings RESTART IDENTITY CASCADE;

-- Optional: reset roles for all non-env admins.
-- Replace the emails below with the same GLOBAL_ADMIN_EMAILS you use in Render before running.
-- UPDATE app_users
-- SET role = 'user', updated_at = now()
-- WHERE lower(email) NOT IN ('admin1@gmail.com','admin2@gmail.com');

COMMIT;
