# Propietarios Airbnb KAI — Supabase + Google Login + Approval Workflow

This version requires every user to sign in with Google before using the app. First-time users must register one or more KAI listings they own. Their registration stays **pending approval** until an already-approved owner approves or declines it.

## What changed

- Google login is required first.
- First-time users must submit at least one owned listing.
- Registration status can be: `pending`, `approved`, or `declined`.
- Approved users can view all pending registrations under **📝 Registros**.
- Approved users can approve or decline a registration with a reason/note.
- Registration status emails are sent in Spanish.
- Incident emails are in Spanish and include a link back to the app.
- New in-app notifications are created for pending registrations and incidents.
- Data is stored only in Supabase tables.

## Supabase setup

Run the full file:

```text
supabase/schema.sql
```

It creates/updates these tables:

- `listings`
- `incidents`
- `notifications`
- `registrations`
- `registration_listings`

No sample/test data is inserted.

## Render environment variables

Add these in Render → Web Service → Environment:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PUBLIC_APP_URL=https://airbnb-property-issue-management.onrender.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Propietarios Airbnb KAI <onboarding@resend.dev>
BOOTSTRAP_ADMIN_EMAILS=your-google-email@gmail.com
```

`BOOTSTRAP_ADMIN_EMAILS` is important for the first approved user. Before the first registration, put your Google email there. If there are no approved users yet, that email will be automatically approved when it registers, and its submitted listing(s) will be created.

After the first owner is approved, other users will remain pending until an approved owner approves or declines them inside the app.

## Firebase Google Sign-In

Keep the existing client env variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

After changing any `VITE_` variable, redeploy because Vite builds those values into the frontend.

## Resend default sender

For testing, this works:

```env
EMAIL_FROM=Propietarios Airbnb KAI <onboarding@resend.dev>
```

For production, verify your own domain in Resend and use something like:

```env
EMAIL_FROM=Propietarios Airbnb KAI <alerts@yourdomain.com>
```

## Health check

After deploy, open:

```text
https://your-render-app.onrender.com/api/health
```

Confirm:

- `ok: true`
- `auditTrail: ok`
- `emailConfigured: true`

## Deploy

```bash
git add .
git commit -m "v15: Google login registration approval workflow and Spanish emails"
git push origin main
```

Then in Render: **Manual Deploy → Deploy latest commit**.

## Apartment ownership rule

Version v16 enforces that each apartment number in Torre KAI can be registered to only one Google account.

- Registration checks approved listings and pending registrations before accepting the request.
- Adding/editing a listing inside the app checks the same rule.
- Supabase also has a unique index on `listings.apt` to prevent duplicate approved ownership.

If `schema.sql` fails on the unique index, clean duplicate apartments in `public.listings` first, then run the SQL again.

## Version v17 updates

- Apartment number uniqueness is checked immediately when the user leaves the apartment field during registration and when adding/editing a listing.
- The apartment field is highlighted with an error message when the apartment is already approved or pending under another Google account.
- Listing email defaults to the logged-in Google account email.
- Users can override the listing email if that apartment should send notifications to a different email.
- Incident email notifications are sent to both the approved Google account email and the listing email when they are different.
- New endpoint added: `GET /api/apartments/check?apt=000&ownerUid=...&excludeListingId=...`.

No additional Supabase table change is required beyond the v16 schema.

## Version v20 updates — listings-only registration source of truth

This version removes the app dependency on the old `registrations` and `registration_listings` tables.

### New data model

`public.listings` is now the single source of truth for:

- Pending registration listings
- Approved owner listings
- Declined registration listings
- Apartment ownership uniqueness

The app now uses these listing fields for registration state:

- `status`: `pending`, `approved`, or `declined`
- `registration_id`: groups multiple listings submitted in one registration request
- `user_email`: Google account email of the owner
- `reason`: approval/denial note
- `reviewed_by_uid`
- `reviewed_by_name`
- `reviewed_at`

### Audit trail

A new table is created:

- `listing_audit_events`

It records:

- who approved or declined a registration
- denial/approval reason
- timestamp
- before/after listing data
- listing create/update/delete actions

### Important migration note

Run the updated `supabase/schema.sql` one time after deployment. It will:

1. Add the new columns to `public.listings`
2. Migrate any old `registrations` + `registration_listings` rows into `public.listings` if those tables exist
3. Create the new audit table
4. Replace the old full apartment unique index with an active-only unique index

The active-only unique index means an apartment is blocked only when it is:

- `pending`
- `approved`

If a registration is `declined`, the apartment number becomes available for another owner to register.

### Health check expectations

After running the SQL and redeploying, `/api/health` should show:

- `listings: ok`
- `incidents: ok`
- `notifications: ok`
- `auditTrail: ok`
- `emailConfigured: true`

### Deploy commit example

```bash
git add .
git commit -m "v20: listings-only registration source of truth with audit trail"
git push origin main
```

## v21 - Login welcome and community mission section

This version updates the user experience with:

- A welcoming Google login screen explaining the application mission, purpose, and community engagement rules.
- Morros KAI logo display on the login screen.
- A new logged-in navigation section: **🌊 Misión**.
- A future-reference page for approved users with:
  - Application mission
  - Purpose of incident reporting
  - Community participation rules
  - Access and owner responsibility rules

No database migration is required for this UI-only update.

## v22 - Incident SLA, operator notifications, and admin settings

Run `supabase/schema.sql` again after deploying this version. It adds:

- `operator_email` and `operator_whatsapp` to listings.
- Owner incident verification fields.
- SLA reminder fields on incidents.
- `app_config` for editable SLA hours, escalation copy emails, and mission/rules text.
- `app_users` for delegated admins.

### Required Render environment variables

```env
GLOBAL_ADMIN_EMAILS=youradmin@gmail.com,anotheradmin@gmail.com
PUBLIC_APP_URL=https://airbnb-property-issue-management.onrender.com
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Propietarios Airbnb KAI <onboarding@resend.dev>
```

Optional defaults:

```env
DEFAULT_SLA_HOURS=24
DEFAULT_ESCALATION_CC_EMAILS=admin1@email.com,admin2@email.com
SLA_CHECK_INTERVAL_MS=900000
```

### SLA behavior

When a new incident is opened, the system emails the listing owner emails and the operator email. The owner must verify the incident in the app by entering the guest name or names. Until the incident is verified, the server checks for due SLA reminders and sends reminder emails to the owner, operator, and the configured escalation copy list every SLA cycle.

### Admin behavior

Only emails listed in `GLOBAL_ADMIN_EMAILS` are global admins. Global admins can open the Admin section to set SLA hours, escalation copy emails, and mission/rules text. Global admins can also delegate registration approval permissions using the backend `POST /api/admin/delegate` endpoint.

## v23 — Plantillas de emails editables por administradores globales

Los administradores globales ahora pueden editar las plantillas de email desde **⚙️ Admin → Plantillas de emails**.

Tipos incluidos:
- Incidente nuevo
- Recordatorio SLA de incidente
- Registro recibido
- Registro aprobado
- Registro rechazado
- Aviso a revisor de registro pendiente
- Listing creado
- Listing actualizado
- Listing eliminado

Después de desplegar esta versión, ejecuta nuevamente `supabase/schema.sql` para crear la tabla:

```sql
email_templates
```

Las plantillas aceptan variables como `{{apt}}`, `{{owner}}`, `{{operator}}`, `{{incidentLink}}`, `{{registrationLink}}`, etc. La pantalla de Admin muestra las variables disponibles para cada tipo de notificación.

## v24 update — fully wired templates + bilingual preference

This version completes the email-template feature and adds app language preference.

### What changed

- Email templates are now used by the backend send logic for incident, SLA, registration, and listing-change notifications.
- Global admins can edit Spanish and English template versions in **Admin → Plantillas de emails**.
- Default app language is **Colombian Spanish (`es-CO`)**.
- Users can switch between **Español 🇨🇴** and **English 🇺🇸** from the login screen and app header.
- The language preference is saved locally and also sent to Supabase for the signed-in user.
- New listing created/updated/deleted emails use the editable template engine.
- Template variables use `{{variableName}}` format and are safely escaped, except server-generated `*Html` variables.

### Required Supabase migration

Run the latest `supabase/schema.sql`. It adds/updates:

- `email_templates.language`
- composite primary key: `(key, language)`
- `app_users.language_preference`

### Notes

- Spanish is the default language and the default email-template set remains Colombian Spanish.
- Existing templates are preserved as Spanish templates where possible.
- If a template is missing, the server falls back to the built-in default.

## v26 — SLA Breach Dashboard + Incident Analytics

Global admins now have a new **📈 Analíticas / Analytics** section.

Included:
- SLA breach dashboard showing incidents currently past due.
- Incidents due within the next 24 hours.
- Average and maximum owner verification response time.
- SLA escalation cycle count.
- Incident rankings by apartment, operator, type, category, status, and month.
- Admin-only endpoint: `GET /api/admin/analytics?uid=<uid>&email=<email>&days=90`.

After updating, run the latest `supabase/schema.sql` in Supabase SQL Editor and redeploy Render.


## v27 Rebuild Notes

This rebuilt v27 package unifies the v25 governance requirements with v26 SLA analytics:

- Global admins can view, edit, and delete all listings and incidents.
- All listing, incident, registration, mission/rules, template, and delegation changes are audited in `audit_logs`.
- `listings` remains the single source of truth for approved/pending/declined registrations.
- Global admins can manage bilingual mission/rules text (`es-CO` default and English).
- Email templates remain configurable per language (`es-CO` and `en`) by global admins.
- Any logged-in user can change language preference; it is saved in `app_users.language_preference`.
- Global admins can delegate registration approval/decline rights only to existing approved registered users.
- Listing WhatsApp is the owner WhatsApp. Listing email is an optional override; when blank, the Google account email is used.
- Operator name, operator email, and operator WhatsApp are retained on listings for incident notification/SLA escalation.

After deploying this version, run `supabase/schema.sql` again in Supabase SQL Editor.


## v28 mission sections + simplified bilingual templates

- Global admins can edit every visible Mission page section in Spanish Colombia from Admin.
- The app stores this in `app_config.mission_sections_es`.
- Users can choose Spanish or English. English mission text is generated from the built-in default translation map for the standard section text.
- Email templates are maintained only in Spanish. For English-language users, the app automatically uses the built-in English version for the notification type and preserves variables such as `{{apt}}` and `{{incidentLink}}`.

Run `supabase/schema.sql` after deployment.


## v29 fixes
- Fixed blank admin/login issues caused by missing registration components.
- Global admins can edit/delete all listings and incidents from the UI.
- Global admins can delegate registration approval/deny to approved users.
- Global admins can turn analytics on/off for all approved users.
- Added explicit logout button and language preference selector in the app header.
- Analytics endpoint respects the global visibility setting.


## v30 Fixes
- Added visible floating Logout and Spanish/English selector after login.
- Admin page now shows a diagnostic instead of a blank screen if the user is not recognized as global admin.
- Admin page is wrapped in an error boundary so UI errors display a recovery message instead of a blank screen.
- /api/admin/me now returns/saves language preference and ensures global admin users are present in app_users.

If Admin says the current user is not global admin, add the displayed email to Render GLOBAL_ADMIN_EMAILS, save, and redeploy.


## v31 - Registration review details

- Pending registration approvals now show full listing details for each submitted apartment.
- Admins/delegate admins can view active approved registrations grouped by Google account, including one or many associated listings.
- Added `/api/registrations/active` for registration managers.

## v34 Email Notification Reliability

This build sends and logs registered-user email notifications for:
- registration submitted
- registration approved/declined
- listing created/updated/deleted
- new incident on an owned listing
- SLA reminders/escalations
- incident verification success

Run the updated `supabase/schema.sql` so the new `email_delivery_logs` table is created. Then confirm `/api/health` shows `emailConfigured: true` and `emailDeliveryLogs: ok`.

Required Render environment variables:

```env
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Propietarios Airbnb KAI <your_verified_sender@yourdomain.com>
PUBLIC_APP_URL=https://airbnb-property-issue-management.onrender.com
```

Important Resend note: `onboarding@resend.dev` is best for testing only. For reliable delivery to all registered owners/operators, verify your domain in Resend and use a sender like `notificaciones@yourdomain.com`.


## v35 notes

### Global admins
Set all global admins in Render as a comma-separated list. Spaces and capitalization are ignored.

```env
GLOBAL_ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com,admin3@gmail.com
```

Global admins can promote approved users to `delegate_admin` or `global_admin` from the Admin users section.

### UAT cleanup
Run `supabase/cleanup_uat.sql` in the Supabase SQL editor to clear test listings, incidents, notifications, and audit/event logs before a new UAT round.

### Mobile menus
The header uses click/tap menus for `Más` and profile actions. If menus appear stale after deploy, hard refresh the browser or clear site data.


## v37 Incident reporting / owner verification workflow

- Incident reporters provide: apartment, date, incident type, category, and description.
- The listing owner and operator are notified by email.
- Owner verification requires guest name(s), city, and country. Owner response is optional.
- Verification stops SLA escalation reminders and sends the verified notification.
- Run `supabase/schema.sql` after deploy to add any missing columns.


## v39 - Admin diagnostics + i18n hardening

- Admin page now logs client-side UI errors to the browser console, localStorage, and `/api/client-log` so errors appear in Render logs.
- Admin page shows diagnostic details instead of only a blank/fallback screen.
- Admin page is hardened against missing/null config, templates, and users responses.
- Admin labels now follow the logged-in user's language preference.
- Common Admin/menu diagnostics text supports Spanish (Colombia) and English.
- More client/server logging was added for `/api/admin/me`, `/api/admin/users`, and `/api/admin/email-templates`.

If Admin still fails, open the Admin page and copy the diagnostic box or check Render logs for `[CLIENT_LOG]`, `[KAI_ADMIN]`, or `[KAI_ADMIN_ERROR]`.

## v43 Admin roles and permissions

This version adds global-admin controlled role and permission management:

- Global admins can assign approved users as `global_admin`, `delegate_admin`, or `user`.
- Delegate admins can be granted specific permissions:
  - Approve / deny registrations
  - Edit global listings
  - Delete global listings
  - Update global incidents
  - Delete global incidents
- Standard users remain the default role.
- Global admins can enable/disable visible menu items for standard users. Dashboard remains always visible.

Run the latest `supabase/schema.sql` before deploying.


## v46 Blacklist toggle + user views
- Blacklist menu is disabled by default for standard users via `standard_menu_permissions.naughty=false`.
- Global admins can enable/disable menu visibility in Admin Settings.
- Users can access **Mis Aptos / My Apts** from the profile menu to view their own listings and related incidents.

## v55 UX / Tooltips Update

This version adds:
- Google login account-switch guidance and forces the Google account chooser with `prompt=select_account`.
- Role-tailored guidance for standard users, delegate admins, and global admins.
- Global-admin editable bilingual tooltips for common data-entry fields and action buttons.
- Tooltips are stored in `app_config` as `tooltips_es` and `tooltips_en` and are optional; defaults are used when not configured.

No manual table migration is required if `app_config` already exists with `key` and `value` columns.
