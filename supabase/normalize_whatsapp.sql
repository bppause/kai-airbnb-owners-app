-- ─────────────────────────────────────────────────────────────────────────────
-- Propietarios Airbnb KAI — WhatsApp international format normalization
-- Run in Supabase Dashboard → SQL Editor.
--
-- Adds a leading '+' to any stored WhatsApp that lacks one (both owner contact
-- in listings and operator_whatsapp).  Only touches numbers with 10+ digits
-- (i.e. numbers that already contain a country code in digit-only form).
--
-- Numbers with fewer than 10 digits are left untouched and flagged in the
-- verification query below so you can correct them manually.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Normalize owner WhatsApp in listings ──────────────────────────────────
UPDATE public.listings
SET contact = '+' || regexp_replace(contact, '[^0-9]', '', 'g')
WHERE
  contact IS NOT NULL
  AND contact != ''
  AND contact NOT LIKE '+%'
  AND length(regexp_replace(contact, '[^0-9]', '', 'g')) >= 10;

-- ── 2. Normalize operator WhatsApp in listings ───────────────────────────────
UPDATE public.listings
SET operator_whatsapp = '+' || regexp_replace(operator_whatsapp, '[^0-9]', '', 'g')
WHERE
  operator_whatsapp IS NOT NULL
  AND operator_whatsapp != ''
  AND operator_whatsapp NOT LIKE '+%'
  AND length(regexp_replace(operator_whatsapp, '[^0-9]', '', 'g')) >= 10;

-- ── 3. Normalize WhatsApp in app_users ───────────────────────────────────────
UPDATE public.app_users
SET whatsapp = '+' || regexp_replace(whatsapp, '[^0-9]', '', 'g')
WHERE
  whatsapp IS NOT NULL
  AND whatsapp != ''
  AND whatsapp NOT LIKE '+%'
  AND length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) >= 10;

-- ── 4. Verification ───────────────────────────────────────────────────────────
-- Shows any remaining numbers that still don't start with + (need manual fix)
SELECT
  'listings.contact'        AS "field",
  id,
  apt,
  owner,
  contact                   AS "whatsapp"
FROM public.listings
WHERE contact IS NOT NULL AND contact != '' AND contact NOT LIKE '+%'
UNION ALL
SELECT
  'listings.operator_whatsapp',
  id,
  apt,
  operator,
  operator_whatsapp
FROM public.listings
WHERE operator_whatsapp IS NOT NULL AND operator_whatsapp != '' AND operator_whatsapp NOT LIKE '+%'
UNION ALL
SELECT
  'app_users.whatsapp',
  app_users.uid,
  '',
  app_users.name,
  app_users.whatsapp
FROM public.app_users
WHERE app_users.whatsapp IS NOT NULL AND app_users.whatsapp != '' AND app_users.whatsapp NOT LIKE '+%';

COMMIT;
