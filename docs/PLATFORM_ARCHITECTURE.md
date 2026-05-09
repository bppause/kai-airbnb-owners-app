# Platform Architecture

This document captures the agreed-upon architecture for the property management
platform. It is the contract every module is expected to follow. If you are
adding a feature and it doesn't fit one of the patterns below, that is a signal
to discuss the architecture, not a signal to ignore it.

Status: **agreed; in-progress refactor.** The codebase as of this commit is
mid-migration from monolith → module structure. New code should follow this
document; old code is being migrated module-by-module on
`claude/review-platform-architecture-Qt8m0`.

---

## 1. Three orthogonal axes

Every domain row, route, permission, and UI view sits at the intersection of
three independent axes:

| Axis | What it means | Examples |
| --- | --- | --- |
| **Tenant** | Which community owns the data | `community_id` column on every domain row |
| **Module** | Which functional area | `incidents`, `operator-portal`, `guest-mgmt`, `facilities`, `tourism` |
| **Role** | What a user is allowed to do | platform global admin, community admin, community-module admin, member |

Tenancy and role were already separated in the v80 schema (communities,
community_memberships). Modules are the new axis being added.

## 2. What is a community

A community is a single physical place: a building, condo tower, gated
neighborhood, resort, or HOA-managed complex. A community has units, owners,
operators, guests, admins, shared amenities, rules, incidents, and financials.
Every module operates within one or more communities; cross-community concerns
belong to the platform layer, not to any module.

Examples:
- Morros Kai
- Serena del Mar Tower A
- Luxury HOA Miami Beach
- Cartagena Beachfront Villas

## 3. Module taxonomy

Each module is a self-contained vertical slice of functionality with its own
routes, permissions, email templates, audit entities, i18n strings, and UI
views. Modules reference platform entities (units, users, communities) but
they do not reach into each other's tables.

Live and planned modules:

| Slug | Status | Purpose |
| --- | --- | --- |
| `incidents` | live | Community / property incident management |
| `operator-portal` | concept (`docs/modules/operator-portal/DESIGN.md`) | Operator work management; owner ↔ operator relationship lifecycle |
| `guest-mgmt` | idea | Guest stays, check-in/out, guest history |
| `tourism` | idea | Local tourism integration |
| `facilities` | idea | Shared amenity / facilities operations |

Planned modules are not implementation commitments — they exist here so the
naming and architectural fit can be reasoned about today.

## 4. Platform vs module entities

Some entities belong to the platform/community layer; modules reference them.
Others are owned by a single module.

**Platform entities** (live in `server/platform/`):
- `app_users` — global user records
- `communities`, `community_memberships`, `community_config`
- `units` (currently `listings`) — apartments / rooms / villas inside a community
- `registrations` — community-membership applications
- `notifications` — cross-module fan-out
- `audit_logs` — cross-module audit trail
- `email_templates` / email delivery
- `app_config` — platform-wide settings

**Module-owned entities** (live in `server/modules/<slug>/`):
- `incidents` (incidents module)
- `operator_relationships`, `service_requests`, etc. (operator-portal — future)

`listings` is the most common confusion. It is currently named after a
listing-style data model but its semantics are units-of-a-community. Operator
portal, guest mgmt, and facilities all need it. It belongs to the platform,
not the incidents module.

## 5. Naming conventions

| Thing | Pattern | Example |
| --- | --- | --- |
| Module slug | lowercase-kebab | `incidents`, `operator-portal`, `guest-mgmt` |
| API route | `/api/m/<module>/<resource>` for module-owned; `/api/platform/<resource>` for platform-owned | `/api/m/incidents/list`, `/api/platform/units` |
| DB table | `<module>_<entity>` for module-owned; bare names for platform | `operator_relationships`, `guest_stays`; vs `units`, `app_users` |
| Permission key | `<module>:<verb>-<noun>` or `platform:<verb>-<noun>` | `incidents:resolve`, `operator-portal:approve-relationship`, `platform:manage-users` |
| Email template key | `<module>.<event>` or `<platform-area>.<event>` | `incidents.new`, `units.created`, `registrations.approved` |
| Audit entity | `<module>.<entity>` or `platform.<entity>` | `incidents.incident`, `platform.unit` |
| i18n namespace | `<module>.<key>` | `incidents.dashboard.title` |
| Frontend route | `/m/<module>/...` | `/m/incidents/dashboard` |

Old paths (`/api/incidents/*`, `/api/listings/*`, `/api/registrations/*`,
flat permission keys like `canResolveIncidents`) are aliased during the
migration window so the live frontend keeps working unchanged.

## 6. Role and admin model

Three platform-level roles, plus per-community-and-module grants on top.

**Platform global admin** — env-defined emails (`GLOBAL_ADMIN_EMAILS`).
Implicit `*` on every permission. Manages communities, enables modules
per community (when that table lands; see §10), and sets platform
defaults.

**Community admin** — admins everything inside their community across
all enabled modules. Stored in `community_memberships.role =
'community_admin'`. Manages community members, community config, and
who is a community-module admin within their community.

**Community-module admin** — admins one module within one community.
Example: "the operator manager at Morros Kai". Permissions live in
`community_memberships.permissions` (JSONB) keyed by namespaced
capability (`operator-portal:approve-relationship`).

**Member / module user** — standard user, no admin permissions.
Module access controlled per-module in the same JSONB.

Off-diagonal scopes (cross-community module admin, single-module-no-community
admin) are not supported in v1. The grant table can be widened later without
breaking existing rows.

## 7. Permissions resolution

Server-side, in one place: `resolvePermissions(uid, communityId)`. Returns a
single object the client can use to drive nav and UI:

```json
{
  "platform": ["manage-users", "manage-config"],
  "incidents": { "*": ["resolve", "delete"] },
  "operator-portal": { "kai": ["approve-relationship"] }
}
```

- Global admin: short-circuited to "all permissions, all communities"
- Community admin: full set within their community(s)
- Community-module admin: scoped to `(community_id, module)` tuples
- Member: only module access flags

The client never re-derives permissions; it consumes what the server returned.

## 8. The module contract

Every module exposes the same shape, server- and client-side. Adding a module
is "drop a folder, register it" — no edits to platform shell code.

**Server (`server/modules/<slug>/index.js`)**:
```js
module.exports = {
  slug, name, version,
  routes,                  // express router, mounted at /api/m/<slug>
  permissions,             // capability list this module declares
  emailTemplates,          // default templates (es-CO, en)
  auditEntities,           // entity names this module emits
  schemaMigrations         // optional, run via supabase
}
```

**Client (`client/src/modules/<slug>/index.js`)**:
```js
export default {
  slug, name,
  navItems,                // shown if user has these permissions
  routes,                  // <Route> elements mounted at /m/<slug>
  permissions,             // declared capabilities (mirrors server)
  i18n
}
```

## 9. Target file layout

```
server/
  index.js                    # bootstrap + module registry mount
  core/                       # supabase client, auth, email send, audit, i18n, logger
  platform/
    users/, communities/, units/, registrations/, notifications/, app-config/
  modules/
    incidents/                # routes.js, service.js, email-templates.js,
                              # permissions.js, audit-entities.js, index.js
    operator-portal/          # (future)
    guest-mgmt/               # (future)
  templates/                  # default email templates aggregated from modules
                              # during migration; long-term these move into modules

client/src/
  core/                       # api client, auth, layout shell, i18n loader
  platform/
    landing/, community-switcher/, profile/, global-admin/
  modules/
    incidents/{views,components,i18n,permissions.js,index.js}
    operator-portal/          # (future)
  module-registry.js
  App.jsx                     # ~200 lines: shell + module router (long-term)
```

## 10. Module enablement per community

Deferred until module #2 ships. Implementation when needed:
- New table `community_modules (community_id, module_slug, enabled, config)`
- Default during migration: every existing community has every available
  module enabled. This is a one-line backfill.
- Global admin toggles per-community module enablement.
- Community admin assigns who admins what within their community.

## 11. Migration plan

Refactor in place, no behavior change. Stages:

1. **Scaffold + first extraction** — directory structure, architecture
   doc, extract email-template defaults out of `server.js`. _(this commit)_
2. **Incidents module extraction** — incident routes, service logic,
   permissions, audit entities move to `server/modules/incidents/`.
3. **Platform extractions** — units (rename from listings), registrations,
   notifications, audit, app_users, app_config, communities, email move to
   `server/platform/<area>/`.
4. **Old-path + permission-key aliases** for backwards compat during the
   client-refactor window.
5. **New `server/index.js`** replaces top of `server.js`. The original
   `server.js` is reduced to a re-export shim or deleted.
6. **Client refactor** as a separate PR: extract `App.jsx` views into
   `client/src/modules/incidents/views/`, set up module registry, move
   i18n constants to JSON files.
7. **Operator-portal as module #2** — first real test of the architecture.

### 11a. Frontend extraction stages (F1-F35) — completed

The client refactor split into 35 byte-identical extractions. App.jsx
went from **9,488 → ~1,040 lines** (~89% reduction). Every extracted
file has its own per-file header explaining what was lifted.

| Stage | Target | New folder / file |
|---|---|---|
| F1 | i18n locale data + per-screen strings | `core/i18n/` |
| F2 | Pure utilities (validation, SLA, image compression, floor color, HL) | `core/utils.js` |
| F3 | API client (`fetchT`, `parseResponse`, `api`, community-id state) | `core/api.js` |
| F4 | Firebase init + sign-in/out + admin-context fetch | `core/auth.js` |
| F5 | `<AppStateProvider>` + `useApp()` hook | `core/app-state.jsx` |
| F6 | `appText` / label override system + `_complexName` state | `core/i18n/app-text.js` (+ `app-strings.json`) |
| F7 | `EmptyState` / `Empty` + first view (`GeneralIncidentsView`) | `core/ui/EmptyState.jsx` + `modules/incidents/views/` |
| F8-F11 | Overlay + 4 incident modals + INCIDENT_TYPES/GUEST_CATEGORIES | `core/ui/Overlay.jsx`, `core/ui/Tip.jsx`, `modules/incidents/components/`, `modules/incidents/constants.js` |
| F12 | `UnitPlate`, `UnitMiniCard` | `platform/units/components/` |
| F13 | `UserContact` + brand icons + contact directory | `core/contacts.jsx`, `core/ui/Icons.jsx` |
| F14-F16 | `IRow`, `WorkflowGroup`, `IncidentsView` | `modules/incidents/{components,views}/` |
| F17 | `NotificationsView` (with co-located `localizeNotification` + `SMART_TONE_COLOR`) | `modules/notifications/views/` |
| F18 | `OwnerDirectoryView` | `platform/users/views/` |
| F19 | `AnalyticsDashboard` | `platform/analytics/views/` |
| F20 | `AuditLogViewer` (with `AUDIT_ENTITIES`) | `platform/audit/views/` |
| F21 | Registrations cluster (`PendingApprovalsView`, `RegistrationCard` + helpers) | `platform/registrations/{views,components}/` |
| F22 | `ProfileView` (+ `OWNER_COUNTRIES` to `core/utils.js`) | `platform/users/views/` |
| F23 | Auth gates cluster (`AuthGate`, `RegistrationGate`, `RegistrationListingForm`, mission), big CSS string, `LanguageSwitch`, `GoogleIcon` | `platform/auth/`, `core/styles.js`, `core/ui/`, `core/i18n/mission.js` |
| F24 | `HelpView` + `UserTour` (+ `HELP_TOPICS` / `HELP_ACTIONS` data) | `platform/onboarding/` |
| F25 | `SendUserEmailModal` | `platform/email/components/` |
| F26 | Dashboard cluster (`Dashboard`, `DashboardFocus`, `DashboardGreeting`) + 4 dead components dropped | `platform/dashboard/{views,components}/` |
| F27 | `CommunitySwitch` | `core/ui/` |
| F28 | `AptContactPopup`, `AptDoor` (with `aptDoorStatus`) + 2 dead components dropped | `platform/units/components/` |
| F29 | 3 dead listings mid-tier components dropped | — |
| F30 | `UnitDetailCard` (~430 lines) + `BuildingFloor` | `platform/units/components/` |
| F31 | `ListingsView`, `MyListings` | `platform/units/views/` |
| F32 | `ListingModal` (with `EMPTY_CO_OWNER`) | `platform/units/components/` |
| F33 | Admin shells (`AdminSection`, `NavConfigEditor`, `CommunityCrudModal`, `AdminFallback`, `AdminAccessHelp`) | `platform/admin/{views,components}/` |
| F34 | `AdminSettings` (~1,915 lines, single-file lift) + permission constants | `platform/admin/views/`, `core/permissions.js` |
| F35 | Final cleanup: prune unused imports, strip orphan comments, regroup imports by area | App.jsx |

**Total dead code removed across the refactor:** 9 components
(~400 lines) — `ActionStrip`, `ActionNeededBanner`, `RoleOutcomeGuide`,
`BetaCommandCenter`, `FloorSection`, `AptRow`, `AptCard`,
`AptDetailPanel`, `GeneralListingsSection` — all defined but never
referenced.

**Final App.jsx contains:**
- imports of all extracted views/components/core modules (grouped by
  area, alphabetized)
- global `window.error` / `unhandledrejection` logging handlers
- `BUILD_TIME` constant injected by Vite
- `<ErrorBoundary>` class wrapper used around `<AdminSettings>`
- `<App/>` default export with state, effects, role/permission
  resolution, action handlers, and the view-dispatch JSX wrapped in
  `<AppStateProvider>` so extracted views read shared state via
  `useApp()`.

## 12. Decisions locked, tradeoffs noted

- **`/api/m/<module>/...` URL prefix** — agreed. Old `/api/<resource>` paths get one-release aliases.
- **Listings → units rename** — agreed. Aliased view + endpoint for one release.
- **Off-diagonal admin scopes** — deferred (community-module admin is enough for v1).
- **Modules-per-community toggle table** — deferred until module #2 lands.
- **PR strategy** — server-first, client second. Within server, staged commits as listed in §11.

This document supersedes any conflicting older guidance. Update it when the
architecture changes; do not let drift accumulate.
