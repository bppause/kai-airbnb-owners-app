# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Install dependencies:**
```bash
npm install          # root (server)
cd client && npm install  # frontend
```

**Run locally:**
```bash
# Backend (port 3001):
npm start

# Frontend dev server with HMR (proxies /api to localhost:3001):
cd client && npm run dev
```

**Production build:**
```bash
npm run build   # installs client deps and runs vite build inside client/
npm start       # serves built frontend + API from server.js
```

There is no test suite.

**Health check after deploy:**
```
GET /api/health
```

## Architecture

**Backend — `server.js`** is a single large Express file (CJS). It owns all API routes, Supabase queries, email dispatch, SLA logic, audit logging, and role/permission resolution. `logger.js` is a thin wrapper: `log()` is suppressed in production unless `DEBUG=true`, `warn`/`error` always emit.

**Frontend — `client/src/App.jsx`** is a single monolithic React component that contains the entire UI: auth state, routing (tab-based), all views (Dashboard, Listings, Incidents, Notifications, Admin, etc.), and inline i18n strings. There is intentionally no router library. All UI state is managed with React hooks inside this one file.

**Database — Supabase only.** There is no local/demo data fallback. The server will fail requests if `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing. Key tables: `listings`, `incidents`, `notifications`, `app_users`, `app_config`, `email_templates`, `audit_logs`, `email_delivery_logs`.

**Auth — Firebase (Google Sign-In only).** Firebase config is injected at Vite build time via `VITE_FIREBASE_*` env vars. After sign-in the frontend passes the Google UID and email to server endpoints; the server resolves roles independently.

## Role model

Three roles resolved server-side in `getUserRole()`:
- `global_admin` — email matches `GLOBAL_ADMIN_EMAILS` env var (takes precedence over DB)
- `delegate_admin` — stored in `app_users.role`
- `user` — default

Permissions for delegate_admins are stored per-user in `app_users.permissions` (JSON) and merged with `app_config.default_delegate_permissions`. Global admins always have all permissions.

## Key runtime patterns

- **`app_config` table** stores runtime settings (SLA hours, escalation emails, mission text, standard menu permissions) loaded by `getAppConfig()`. The Admin section lets global admins edit these without redeploying.
- **Email templates** have hardcoded defaults in `server.js` (`DEFAULT_EMAIL_TEMPLATES` / `DEFAULT_EMAIL_TEMPLATES_EN`) that are overridden by rows in the `email_templates` table. Templates use `{{variable}}` placeholders; variables ending in `Html` are trusted server-generated HTML and bypass escaping.
- **`/api/client-log`** receives frontend error payloads (window errors, unhandled rejections, root error boundary catches) and writes them to Render logs. Errors are also saved to `localStorage` as `kai_last_ui_error`.
- **`production-ui.css`** is a global layout hardening layer loaded unconditionally in `main.jsx`. It stabilizes responsive layout without touching `App.jsx`.
- **`adminRegistrationAwareness.js`** (v72) is a non-invasive DOM bridge that runs after React mounts. It injects pending-registration badges and banners by reading DOM text; it does not call any API.

## Environment variables

`VITE_*` variables are compiled into the frontend bundle at build time — changing them requires a redeploy. All other vars are runtime (server-only).

Required for full functionality: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GLOBAL_ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_APP_URL`, and the six `VITE_FIREBASE_*` vars. See `.env.example` for the full list.

## Deployment

Deployed on Render via `render.yaml`. After a `git push`, use **Manual Deploy → Deploy latest commit** in the Render dashboard unless auto-deploy is on. The build command is `npm install && cd client && npm install && npm run build`; start command is `node server.js`.

Database migrations are run manually by executing `supabase/schema.sql` in the Supabase SQL Editor after pulling a major update.

## Documentation conventions

The platform's design and product documentation lives under `docs/`. **Read these before making non-trivial product/architecture decisions.**

**Structure:**
- `docs/README.md` — the documentation index. Start here.
- `docs/platform/` — platform-wide docs that cross modules:
  - `PLATFORM_ARCHITECTURE.md` — the locked architectural contract; module slugs are registered in §3.
  - `DESIGN.md`, `DIAGRAMS.md` — cross-module design and Mermaid diagrams.
  - `ROADMAP.md` — multi-horizon conceptual roadmap (H0 live → H5 intelligence).
  - `PITCH.md` — investor / client / friends-and-family pitch (ES + EN).
  - `USER_STORIES.md` — cross-module user stories with `live` / `concept` / `idea` status badges per story.
- `docs/modules/<slug>/` — per-module docs. Every module slug in `PLATFORM_ARCHITECTURE.md` §3 has a folder here with at least a `README.md`. Modules promoted to `concept` add `DESIGN.md`. Some have additional files (`PROPOSAL.md`, `USE_CASE_DISCOVERY.md`, `DIAGRAMS.md`, `UAT_SCRIPT.md`, etc.).
- `docs/CHANGELOG_ARCHIVE.md` — historical release notes.

**When adding a new module:**
1. Create `docs/modules/<new-slug>/README.md` following the shape of an existing one (e.g. `tourism/README.md`).
2. Register the slug in `docs/platform/PLATFORM_ARCHITECTURE.md` §3 with status `idea` / `concept` / `live`.
3. Add it to `docs/README.md`'s layout sketch and modules-at-a-glance table.
4. If it appears in `docs/platform/ROADMAP.md` §6, link the pillar heading to the new module folder.

## Terminology (locked)

These terms are used in a specific narrow sense across docs and UI:

| Term | Means | Owns |
|---|---|---|
| **Airbnb operator** (often **operator**) | The Airbnb listing manager / co-host running STR on a unit | The listing, guest relationship, unit-level service requests, owner tasks/issues/requests from STR operation |
| **Building admin** (HOA / community admin / property manager) | The party that runs the building or complex itself | Operations of the facility/complex: front desk, access, common areas, residents, fees, governance, building-wide incidents |

**There is no "building operator" role.** When docs say *operator* they always mean the Airbnb operator. When the building's day-to-day is being discussed, the actor is the building admin, the facilities team, or the front desk — never an "operator". Enforce this lock in UI copy, role names, permission keys, and email templates.

## Multi-owner model (Airbnb operator-portal context)

A unit can have multiple owners with different access levels:

- **Payout Owner** — exactly one per unit. Has financial approval rights (repairs above threshold, pricing proposals). Sees everything.
- **Calendar Owner** — zero or more per unit. Can see calendar context and participate in request threads. Repair-cost amounts and other financial figures are hidden.

Both can post replies in any request thread for their unit. See `docs/modules/operator-portal/USE_CASE_DISCOVERY.md` and `PROPOSAL.md` for the full model.

## Git workflow

- **Feature branches.** Work on a `claude/<task-slug>` branch (the session's assigned branch is preferred when one exists). Never commit directly to `main`.
- **PRs only.** Land changes on `main` via a GitHub PR using the merge commit workflow (`Merge pull request #N from …`). Match the existing convention; do not squash unless asked.
- **Reference updates in the same change.** Renames or moves of docs that are referenced from code comments (most notably `docs/platform/PLATFORM_ARCHITECTURE.md`) must update those references in the same PR — verify with grep before pushing.
- **Never force-push to `main`.** If the feature branch is behind, rebase locally and force-push the *feature branch* with `--force-with-lease`, then merge the PR.
- **Bilingual docs.** Long-form product docs aimed at customers (proposals, pitch) are Spanish-first with an English mirror. Internal architecture docs are English-only.

