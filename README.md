# KAI Airbnb Owners App

Production-ready community operations app for Morros KAI / Airbnb property owners in Serena del Mar, Cartagena.

The app helps approved owners and admins manage listings, incident reports, owner verification, registrations, notifications, SLA follow-up, and role-based permissions.

## Current production features

- Google/Firebase sign-in with account-switch guidance.
- Supabase-backed data model; no local JSON/demo data fallback.
- Registration approval workflow for first-time owners.
- Listings as the source of truth for pending, approved, and declined apartment ownership.
- Incident workflow: **Open → Owner Verification → Resolved**.
- Owner verification with guest names, city, country, and optional owner comments.
- Global Admin, Standard Admin, Delegate Admin, and Owner/User role behavior.
- Configurable delegate permissions.
- Smart notifications for pending registrations, owner verification, incidents ready to resolve, unread alerts, and serious incidents.
- Admin-editable bilingual mission text and tooltips.
- Spanish Colombia default language with English UI support.
- Email notifications through Resend.
- SLA tracking, escalation reminders, analytics, audit logs, and health checks.
- Responsive navigation for desktop, tablet, and mobile.

## Repository structure

```text
.
├── server.js                 # Express API and production static server
├── logger.js                 # Server logging helper
├── package.json              # Root server/build scripts
├── render.yaml               # Render deployment blueprint
├── client/                   # React + Vite frontend
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       └── main.jsx
├── supabase/
│   ├── schema.sql            # Production database schema/migrations
│   └── cleanup_uat.sql       # Optional UAT/test data cleanup
└── docs/
    └── CHANGELOG_ARCHIVE.md  # Historical version notes
```

## Local development

Install root dependencies:

```bash
npm install
```

Install client dependencies:

```bash
cd client
npm install
cd ..
```

Run the server:

```bash
npm start
```

For frontend-only development, run Vite from the client folder:

```bash
cd client
npm run dev
```

## Production build

```bash
npm install
npm run build
npm start
```

Root `npm run build` installs/builds the Vite client from `client/`.

## Render deployment

Use the included `render.yaml`, or create a Render Web Service manually with:

```bash
Build Command: npm install && cd client && npm install && npm run build
Start Command: node server.js
```

After each GitHub push, use **Manual Deploy → Deploy latest commit** in Render, unless auto-deploy is enabled.

## Required environment variables

Add these in Render → Web Service → Environment:

```env
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PUBLIC_APP_URL=https://your-render-app.onrender.com
GLOBAL_ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Propietarios Airbnb KAI <alerts@yourdomain.com>
```

Firebase values are Vite build-time variables. Add them in Render before building:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

After changing any `VITE_` value, redeploy because Vite builds these into the frontend.

## Supabase setup

Run the full schema in Supabase SQL Editor:

```text
supabase/schema.sql
```

Run it after pulling a major update. It is designed to add/update required tables and columns for the current app version.

Useful tables include:

- `listings`
- `incidents`
- `notifications`
- `app_users`
- `app_config`
- `email_templates`
- `audit_logs`
- `email_delivery_logs`

For UAT resets only, use:

```text
supabase/cleanup_uat.sql
```

## Health check

After deployment, open:

```text
https://your-render-app.onrender.com/api/health
```

Expected production indicators:

- `ok: true`
- `listings: ok`
- `incidents: ok`
- `notifications: ok`
- `auditTrail: ok`
- `emailConfigured: true`

## Email notes

For testing, Resend's default sender may work:

```env
EMAIL_FROM=Propietarios Airbnb KAI <onboarding@resend.dev>
```

For production, verify your domain in Resend and use a sender such as:

```env
EMAIL_FROM=Propietarios Airbnb KAI <notificaciones@yourdomain.com>
```

## Admin bootstrap

Set your Google email in `GLOBAL_ADMIN_EMAILS` before first login. Emails are comma-separated, and spaces/capitalization are ignored.

```env
GLOBAL_ADMIN_EMAILS=your-google-email@gmail.com
```

Global admins can manage roles, delegate permissions, mission text, tooltips, email templates, analytics visibility, and operational settings inside the Admin section.

## Production cleanup standards

Do not commit:

- `.env` files
- local Firebase/Supabase secrets
- `node_modules/`
- `client/dist/`
- ZIP files
- backup files such as `*.bak`, `*.old`, or `*.v64-base`

Historical version notes live in `docs/CHANGELOG_ARCHIVE.md`.

## Vision and roadmap

For the broader product story:

- `docs/platform/PITCH.md` — pitch overview for investors, clients, and friends/family (ES + EN).
- `docs/platform/ROADMAP.md` — conceptual roadmap across all pillars (operator, building admin, facilities, sales/development, compliance).
- `docs/modules/operator-portal/PROPOSAL.md` — Airbnb Operator Portal proposal (ES + EN).
- `docs/modules/property-development-lifecycle/PROPOSAL.md` — Property Development Lifecycle module placeholder (ES + EN).
- `docs/modules/operator-portal/USE_CASE_DISCOVERY.md` — discovery work grounding the operator portal.
