# Changelog Archive

Historical notes from earlier development versions were moved out of the main README to keep the production setup clear.

## v15 — Google login registration approval workflow and Spanish emails

- Google login required before using the app.
- First-time users submit at least one owned KAI listing.
- Registration status supports `pending`, `approved`, and `declined`.
- Approved users can approve or decline pending registrations.
- Spanish email notifications added for registrations and incidents.
- In-app notifications added for pending registrations and incidents.
- Supabase is the source of truth.

## v16-v17 — Apartment ownership uniqueness

- Apartment number uniqueness enforced for Torre KAI.
- Apartment number is checked during registration and listing add/edit.
- Listing email defaults to logged-in Google account email, with optional override.
- Incident emails can be sent to both the Google account email and listing email.

## v20 — Listings-only registration source of truth

- `public.listings` became the single source of truth for pending, approved, and declined registrations.
- Registration grouping added with `registration_id`.
- Listing review fields added: `reason`, `reviewed_by_uid`, `reviewed_by_name`, and `reviewed_at`.
- Listing audit events added.
- Active-only apartment uniqueness: blocked only when status is `pending` or `approved`.

## v21 — Login welcome and mission section

- Welcoming Google login screen added.
- Morros KAI logo displayed on login screen.
- Mission page added for approved users.

## v22-v24 — SLA, admin settings, bilingual email templates

- Operator contact fields added.
- Owner verification fields added to incidents.
- SLA reminder fields and app configuration added.
- Admin-editable email templates added.
- Spanish Colombia is default language; English preference added.

## v26-v28 — Analytics, governance, mission sections

- SLA breach dashboard and incident analytics added.
- Global admin governance expanded.
- Audit logs expanded.
- Mission sections became admin-editable.

## v29-v31 — Admin stability and registration details

- Admin page hardened against blank screens.
- Explicit logout and language selector added.
- Pending registration review details expanded.
- Active registrations endpoint added.

## v34-v35 — Email reliability and roles

- Email delivery logs added.
- Registered-user email notifications expanded.
- Global admin emails handled via environment variables.
- UAT cleanup SQL retained.

## v37 — Incident reporting and owner verification workflow

- Reporter fields standardized: apartment, date, incident type, category, and description.
- Owner verification requires guest names, city, and country.
- Verification stops SLA escalation reminders.

## v39 — Admin diagnostics and i18n hardening

- Client-side UI errors logged to console, localStorage, and `/api/client-log`.
- Admin diagnostic details shown instead of blank screens.
- Admin labels follow language preference.

## v43-v46 — Roles, permissions, and user views

- Global admins can assign users as `global_admin`, `delegate_admin`, or `user`.
- Delegate permissions added for registration, listing, and incident actions.
- Standard-user menu visibility can be controlled.
- User views for own apartments and incidents added.

## v55 — UX and tooltips

- Google account chooser forced with `prompt=select_account`.
- Login account-switch guidance added.
- Role-tailored guidance added.
- Global-admin editable bilingual tooltips added.

## v56-v70 collaboration builds

- Stability improvements for auth, roles, API loading, and protected route rendering.
- Workflow updated to: Open → Owner Verification → Resolved by Global Admin or Standard Admin.
- Notifications, registrations visibility, adaptive navigation, and responsive layouts improved.
- Tooltips and menu overlays hardened across screen sizes.
- Smart notifications, predictive automation, and autonomous-ops concepts introduced as configurable UX/automation layers.
