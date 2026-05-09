# `incidents` — Module Design

> **Status:** live (shipped, in production)
> **Slug:** `incidents`
> **Server code:** `server/modules/incidents/`
> **Client code:** `client/src/modules/incidents/`
> **Audit entity:** `incidents.incident`
> **Companion docs:** `README.md` (this folder), `UAT_SCRIPT.md`, `../../PLATFORM_ARCHITECTURE.md`, `../../platform/DESIGN.md` §3

This is the design reference for the live incident-management module. It
describes what the module does today (current state), how it is wired up
(architecture, data model, API, UI), how it integrates with the rest of the
platform, the gaps that are known and accepted, and the potential roadmap
items grouped by where they fit in the build order.

---

## 1. Purpose and Scope

The incidents module captures any **community- or property-level incident**
— guest complaint, noise, damage, common-area issue, regulatory or building
notice — and runs it through a structured two-step resolution workflow with
SLA pressure and email escalation.

It is the WhatsApp-group replacement for community-wide reporting:
**typed**, **tracked**, **timestamped**, **searchable**, with **reporter
privacy** as a non-negotiable platform rule.

In scope:

- Reporting an incident against a unit or against the community at large.
- Owner-side workflow (verify + immediate action; then resolution).
- Admin-side close-out and history.
- SLA timer with email reminders and red/yellow/green visual aging.
- Photo evidence (up to 3 photos × 2 MB each, stored as base64 in the
  incident row).

Out of scope (deferred to other modules — see §12):

- Operator-side delegation of owner steps (`operator-portal`).
- Structured repair records with cost, invoice, vendor (`operator-portal`).
- Per-stay inspection baseline photos (`guest-mgmt`).
- Cross-community pattern analytics beyond per-community filtering.
- File-storage backend (everything is base64 in `incidents.photos` today).

---

## 2. Roles and Actors

The module respects the platform role model
(`../../PLATFORM_ARCHITECTURE.md` §6) with no module-specific overlays. The
roles that touch an incident:

| Role | What they do |
| --- | --- |
| **Reporter** | Any signed-in user. Files the incident. Their identity is hidden from owner / operator (see §7). |
| **Unit owner** | Owner-of-record on the `listings` row the incident is attached to. Performs Step 1 (verify) and Step 2 (resolution). |
| **Community admin** (and global admin) | Closes the incident with `resolution_comments`. For general incidents: assigns to a unit or closes directly. Can delete. |
| **Delegate admin** | A community member granted the `incidents:*` capabilities. Acts as a community admin for incident resolution. |

The module does **not** know about operators or operator staff today; that
is the operator-portal module's job (§12).

---

## 3. Data Model

### 3.1 The `incidents` table

`supabase/schema.sql` lines 192–227 define a single 26-column row with
five logical groups:

**Identity and tenancy**

| Column | Notes |
| --- | --- |
| `id` text primary key | `inc_<8-char-uuid-slice>` |
| `community_id` text | FK to `communities`, default `'kai'` |
| `created_at` timestamptz | When reported |

**Reporter context (privacy-protected)**

| Column | Notes |
| --- | --- |
| `reporter_uid` text | Hidden from owner / operator (§7) |
| `reporter_name` text | Hidden from owner / operator |

**Unit linkage**

| Column | Notes |
| --- | --- |
| `apt_id` text | FK to `listings(id)`; null for general incidents |
| `apt_label` text | Cached label (e.g. `'Apto 301'`) |
| `is_general` boolean | True for community-wide; false for unit-attached |

**Initial report payload**

| Column | Notes |
| --- | --- |
| `incident_date` date | When the issue happened (not when reported) |
| `type` text | One of seven: `noise`, `damage`, `rules`, `payment`, `unauthorized`, `cleanliness`, `other` |
| `category` text | Urgency: `serious`, `watch`, `minor` (used today as a tag; planned as the SLA tier driver — see §13) |
| `description` text | |
| `photos` jsonb | Array of `{data, name}`, base64-encoded, ≤ 3, ≤ 2 MB each |
| `guest_name`, `guest_city`, `guest_state`, `guest_country` | Initial guest info from the reporter form (often partial, gets corrected in Step 1) |

**Workflow state**

| Column | Notes |
| --- | --- |
| `status` text | `open` \| `verified` \| `resolved` (CHECK constraint enforced) |
| `owner_viewed_at` timestamptz | First time owner opened the incident |
| `owner_verified_at` timestamptz | Step 1 complete |
| `owner_resolution_at` timestamptz | Step 2 complete |
| `resolved_at` timestamptz | Admin closed |
| `resolved_by` text | Admin actor email |

**Owner-supplied fields**

| Column | Notes |
| --- | --- |
| `owner_guests` jsonb | Array of `{firstName, middleName, lastName, city, state, country}` — corrected from initial reporter guess in Step 1 |
| `owner_guest_names` text | Comma-joined for search index |
| `owner_guest_city`, `owner_guest_country` text | Deduplicated for search |
| `owner_comments` text | Step 1 immediate-action description |
| `owner_resolution` text | Step 2 resolution narrative |
| `resolution_comments` text | Admin-side final notes on close |

**SLA tracking**

| Column | Notes |
| --- | --- |
| `sla_hours` integer | Captured per-incident at creation from `app_config` (default 24) |
| `next_sla_reminder_at` timestamptz | Next escalation time; null when both owner steps are complete |
| `sla_cycle_count` integer | Reminder cycles fired so far |

### 3.2 What the schema notably does **not** carry

- **No structured attachments table.** Photos are base64 inside the row.
  Up to 3 × 2 MB inflates rows to ~6 MB; the Express JSON limit was raised
  to 15 MB explicitly to accommodate this (recent fix).
- **No vendor / cost / invoice fields.** Damage incidents that need a
  repair receipt have nowhere to put it inside the module today.
- **No link to a stay or a booking.** The incident is anchored to a unit
  and a date; it does not know which guest stay it belongs to.
- **No threaded comments.** Free-text fields capture each step's narrative
  but there is no append-only conversation log; updates overwrite.

---

## 4. Workflow

### 4.1 Unit-attached incident — the canonical path

```
              ┌───────────────────────────┐
              │ OPEN                      │
              │ status = 'open'           │
 reporter ───▶│ next_sla_reminder_at set  │
              │ Owner: ① Verify button    │
              │ Admin: read-only          │
              └─────────────┬─────────────┘
                            │ owner clicks "① Verify"
                            ▼
              ┌───────────────────────────┐
              │ VERIFIED — no resolution  │
              │ status = 'verified'       │
              │ owner_verified_at set     │
              │ owner_guests / _comments  │
              │ SLA timer continues       │
              │ Owner: ② Add Resolution   │
              │ Admin: read-only          │
              └─────────────┬─────────────┘
                            │ owner clicks "② Add Resolution"
                            │ (or supplies it inside Step 1)
                            ▼
              ┌───────────────────────────┐
              │ VERIFIED — with resolution│
              │ status = 'verified'       │
              │ owner_resolution_at set   │
              │ owner_resolution non-empty│
              │ next_sla_reminder_at = ∅  │  ← timer stops
              │ Admin: Resolve enabled    │
              └─────────────┬─────────────┘
                            │ admin clicks "Resolve"
                            ▼
              ┌───────────────────────────┐
              │ CLOSED                    │
              │ status = 'resolved'       │
              │ resolved_at, resolved_by  │
              │ resolution_comments set   │
              └───────────────────────────┘
```

Step 1 and Step 2 are **owner-only** today. The owner can collapse them
into one action by supplying the resolution text inside the verify modal.

### 4.2 General (community-wide) incident — the alternate path

```
                       ┌─────────────────────┐
                       │ OPEN, is_general    │
       reporter ─────▶ │ apt_id = null       │
                       │ Admin: Assign / Close│
                       └────┬───────────┬────┘
       admin clicks "Assign"│           │admin clicks "Close directly"
                            ▼           ▼
            ┌────────────────────┐   ┌────────────────────────┐
            │ ASSIGNED           │   │ CLOSED                 │
            │ is_general → false │   │ status = 'resolved'    │
            │ apt_id set         │   │ resolved_at set        │
            │ enters §4.1 path   │   │ resolution_comments set│
            └────────────────────┘   └────────────────────────┘
```

A general incident bypasses the owner workflow entirely if the admin
chooses to close directly (e.g. duplicate, building-wide notice already
handled, no-action-needed).

### 4.3 Permission gates

| Action | Endpoint | Who |
| --- | --- | --- |
| Report incident | `POST /` | any signed-in user |
| Mark viewed | `PATCH /:id/viewed` | unit owner |
| Step 1 (verify) | `PATCH /:id/verify` | unit owner |
| Step 2 (add resolution) | `PATCH /:id/add-resolution` | unit owner |
| Assign general → unit | `PATCH /:id/assign` | `incidents:assign` (or `incidents:resolve`) |
| Close general directly | `PATCH /:id/close-general` | `incidents:resolve` |
| Resolve unit incident | `PATCH /:id/resolve` | `incidents:resolve` (requires owner steps complete first) |
| Delete | `DELETE /:id` | `incidents:delete` |

---

## 5. SLA Model

### 5.1 Today

A **single SLA tier** governs every incident: `sla_hours` is read from
`app_config` at creation time and stored on the row (so changing the
default later does not retroactively shorten in-flight timers).

The cron loop in `server/modules/incidents/sla-cron.js`:

1. Runs every ~15 minutes (configurable initial delay + interval).
2. Selects rows where `next_sla_reminder_at <= now`.
3. For each:
   - **Unit-attached, status `open`** → fires `incident_sla` email with
     `pendingStep: 'step1'` to owner / operator / admins / delegates.
   - **Unit-attached, status `verified` and no resolution** → fires
     `incident_sla` with `pendingStep: 'step2'`.
   - **General** → fires `incident_general_sla` to admins only ("assign or
     close").
4. Increments `sla_cycle_count`, sets
   `next_sla_reminder_at = now + sla_hours`.
5. Once both owner steps are complete (or general is closed),
   `next_sla_reminder_at` is cleared and the row stops escalating.

### 5.2 Aging visualization

The frontend renders an SLA badge per row in `IRow.jsx`:

- **🟢 default** when fresh.
- **🟠 N hours left** as the deadline approaches.
- **🔴 overdue** once past `next_sla_reminder_at`.
- **⏱️ N** showing `sla_cycle_count` once reminders have fired.

### 5.3 What the platform-wide design (`../../platform/DESIGN.md` §3.3) anticipates

A six-tier ladder mapped to incident `category`:

| Tier | Default SLA | Maps to |
| --- | --- | --- |
| Critical | 1 h | guest locked out, safety |
| Urgent | 2–4 h | AC/water failure, AirCover window |
| Standard | 24 h | repair approval, task |
| Async | 48 h | pricing, peak period |
| Monthly | 5 d | utility bill |
| FYI | none | informational |

The schema already carries `category` (`serious` / `watch` / `minor`) but
the cron loop ignores it; this is a capacity-already-there roadmap item
(see §13).

---

## 6. API Surface

All routes are mounted under `/api/m/incidents/*` (canonical) with
`/api/incidents/*` aliased for the migration window
(`../../PLATFORM_ARCHITECTURE.md` §5).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List incidents for the current community, filtered by viewer's permissions (reporter identity stripped where required). |
| POST | `/` | Create an incident, unit-attached or general; sets initial `sla_hours` and `next_sla_reminder_at`. |
| PATCH | `/:id/viewed` | Owner marks "I've seen this" — sets `owner_viewed_at`. |
| PATCH | `/:id/verify` | Owner Step 1: writes `owner_guests`, `owner_comments`, optionally `owner_resolution`. |
| PATCH | `/:id/add-resolution` | Owner Step 2: writes `owner_resolution`, clears `next_sla_reminder_at`. |
| PATCH | `/:id/assign` | Admin: assigns a general incident to a unit. |
| PATCH | `/:id/close-general` | Admin: closes general directly without owner workflow. |
| PATCH | `/:id/resolve` | Admin: closes unit incident with `resolution_comments` (requires both owner steps complete). |
| DELETE | `/:id` | Admin: removes an incident (audited). |

Capabilities are declared in `server/modules/incidents/permissions.js`:

```js
RESOLVE  = 'incidents:resolve'   // legacy alias: canResolveIncidents
UPDATE   = 'incidents:update'    // legacy alias: canUpdateGlobalIncidents
DELETE   = 'incidents:delete'    // legacy alias: canDeleteGlobalIncidents
ASSIGN   = 'incidents:assign'    // no legacy alias
```

---

## 7. Reporter Privacy

A non-negotiable platform rule, owned by this module:

- `reporter_uid` and `reporter_name` are stripped from every list/detail
  response served to owner / operator viewers.
- Only **community admin**, **global admin**, and the **reporter
  themselves** see those fields.
- Email templates honor the same rule: only admin- and reporter-facing
  emails include the reporter name; owner / operator emails redact it.

This is enforced server-side. The frontend is a defense-in-depth layer,
not the contract.

A recent commit ("Route incident/listing emails individually per recipient
for privacy") split the per-incident email send into per-recipient calls
specifically so reporter identity could be conditionally included or
omitted per recipient instead of relying on a single broadcast template.

---

## 8. Email Notifications

Five senders in `server/modules/incidents/email-senders.js`, each gated by
`app_config.email_notifications`:

| Sender | Trigger | Template key |
| --- | --- | --- |
| `sendIncidentEmail()` | New incident created (and re-used for SLA escalation reminders) | `incident_new` / `incident_sla` |
| `sendIncidentVerifiedEmail()` | Owner completes Step 1 | `incident_verified` |
| `sendIncidentResolutionAddedEmail()` | Owner completes Step 2 | `incident_resolution_added` |
| `sendIncidentResolvedEmail()` | Admin closes the incident | `incident_resolved` |
| `sendGeneralIncidentSlaEmail()` | Cron finds an overdue general incident | `incident_general_sla` |

Every email links to the in-app incident view via
`PUBLIC_APP_URL/?view=incidents&incident=<id>` and includes
`relatedEntity: 'incident'` + `relatedId` for delivery-log audit.

Templates have hardcoded defaults in `server/templates/email-defaults.js`
(es-CO and en) that are overridden by rows in the `email_templates` table
when present (`../../PLATFORM_ARCHITECTURE.md` §11 stage 2).

---

## 9. Frontend Surfaces

The module owns one tab area in the app shell with two top-level views.

### 9.1 Views

**`IncidentsView.jsx`** — the unit-incidents tab.

- Tab switcher between Unit and General incidents.
- Filters: status, category, scope (`I reported` / `My listings` /
  `Pending resolution` / `Requires resolution` / `Owner Verification`),
  search, date range, floor.
- Filter state is persisted to `localStorage` so the user's view survives
  a reload.
- Renders `WorkflowGroup` sections grouped by status.

**`GeneralIncidentsView.jsx`** — community-wide incidents
(`is_general = true`).

- Lists open general incidents with type / category labels, SLA badge,
  reporter name (admin-visible only), photos.
- Admin-only Assign / Close-directly buttons.

### 9.2 Components

| Component | Role |
| --- | --- |
| `WorkflowGroup.jsx` | Collapsible section per status; counts per group. |
| `IRow.jsx` | One incident row: badges, SLA timer, status, owner-step buttons, admin actions, dropdown menu. |
| `IncidentModal.jsx` | Full detail overlay with photo lightbox and timeline. |
| `VerifyIncidentModal.jsx` | Step 1 form: guest editor + immediate action + optional resolution. |
| `AddResolutionModal.jsx` | Step 2 form: single resolution textarea. |
| `AssignToUnitModal.jsx` | Admin: pick a unit for a general incident. |
| `CloseGeneralModal.jsx` | Admin: close a general incident directly. |

### 9.3 Constants

`constants.js` declares the seven `INCIDENT_TYPES` (each with emoji,
label, color, bg color) and the three `GUEST_CATEGORIES` (urgency
buckets). Both are i18n'd via the `core/i18n/` machinery.

---

## 10. Audit

The module emits one entity: `incidents.incident`. Every state-changing
endpoint writes an `audit_logs` row with the actor UID, the action verb,
the old/new state delta, and the related incident ID. This rolls up into
the platform-wide audit-log viewer
(`client/src/platform/audit/views/AuditLogViewer.jsx`).

When operator-portal lands (§12), incident-related actions taken by an
operator on an owner's behalf will carry the
`"[Operator Name] acting on behalf of [Owner Name] — Unit [APT]"`
attribution string in the audit row.

---

## 11. Failure Modes and Operational Notes

| Failure | What happens today | Mitigation |
| --- | --- | --- |
| Photo upload exceeds 2 MB after compression | Frontend rejects with bilingual message | Client-side compression with quality fallback; recent v1.2.2 fix |
| Total request body > 15 MB | Express rejects with 413 | Express limit was raised from 1 MB to 15 MB explicitly for 3-photo incidents |
| SLA cron crashes mid-cycle | Per-row try/catch in `sla-cron.js`; remaining rows still process | None needed |
| Email send fails | Logged to `email_delivery_logs` with error; incident state already committed | Manual retry from admin UI is a roadmap item (§13) |
| Owner never views incident | SLA cron keeps escalating until both owner steps complete; no auto-close | Intentional — never silently drop |
| Reporter is also the unit owner | Both views (reporter-facing, owner-facing) collapse to one user; reporter identity is shown to themselves | Working as intended |

---

## 12. Cross-Module Integration

### 12.1 Operator-portal (planned)

The single largest near-term integration is the operator-portal module
(`../operator-portal/DESIGN.md`), which adds a per-unit
`delegation_level` field and lets operators advance Step 1 (or both
steps) on behalf of the owner. The contract:

| `delegation_level` | Step 1 | Step 2 |
| --- | --- | --- |
| `owner_handles` | Owner only; operator notified | Owner only |
| `operator_assists` (default) | Operator can complete on behalf of owner | Owner must complete |
| `operator_handles` | Operator | Operator; owner notified |

Every operator action carries the `"acting on behalf of"` audit
attribution. Reporter privacy still applies to operators — they do **not**
see the reporter identity.

A damage incident in the incidents module will be linkable to a
`service_request` row in operator-portal (one-to-one), so the cost,
invoice, and vendor live where they belong without polluting the
incident schema.

### 12.2 Guest-mgmt (idea)

`../guest-mgmt/README.md` describes the per-stay record. When that lands,
incidents will be linkable to a `guest_stays` row to inherit the
inspection photo baseline that AirCover claims and damage-vs-prior-guest
attribution depend on. The link is foreign-key only — incidents do not
duplicate stay data (`../../platform/DESIGN.md` §6.4).

### 12.3 Facilities (idea)

`../facilities/README.md` describes amenity closures. When a closure is
published, the facilities module will optionally spawn an incident of
type `building` (a new type — see §13) against the affected community,
so the existing escalation and acknowledgement flow applies.

### 12.4 Tourism (idea)

No direct integration. Tourism content is read-only guest-facing.

---

## 13. Known Gaps and Constraints

These are accepted today; some are roadmap items (§14), some are
intentional tradeoffs.

1. **Single SLA tier.** The cron treats every incident with the same
   `sla_hours`. The schema already carries `category`; the cron does not
   yet branch on it.
2. **Owner-only Step 1 / Step 2.** The biggest single ask in the
   operator-portal use-case discovery (`../operator-portal/USE_CASE_DISCOVERY.md`).
   Deferred to that module's delegation model.
3. **No structured repair record.** Damage incidents that lead to a
   repair have no place to put cost / vendor / invoice. Conversation
   lives in email threads. Deferred to operator-portal service requests.
4. **Photos are base64 in-row.** No CDN, no thumbnails, no separate
   storage table; rows can hit ~6 MB. A Supabase Storage bucket move is
   sized in `../operator-portal/USE_CASE_DISCOVERY.md` Phase 6 prereqs.
5. **No threaded comments.** Each step has one free-text field that the
   actor overwrites. There is no append-only conversation log.
6. **No `building` / `regulatory` incident type.** The current type list
   is guest-stay-flavored (noise, damage, rules, payment, unauthorized,
   cleanliness, other). Building notices and regulatory items get filed
   as `other`, which loses categorization fidelity.
7. **No bulk operations.** Each admin action is one incident at a time.
   Closing 30 duplicate building-noise reports after a single event is
   manual.
8. **No email retry from UI.** When a notification fails, the
   `email_delivery_logs` row records it but there is no admin "resend"
   button. Manual fix is a server console action.
9. **No incident-level subscriptions.** Notifications are role-based; a
   user who wants to follow a specific incident they did not report has
   no way to opt in.
10. **No SLA pause for nights / weekends / holidays.** A 24h timer that
    starts at 6pm Friday is overdue Saturday afternoon.
11. **Global admin can be a single point of failure** for general
    incidents that admins must triage; there is no round-robin or
    on-call schedule.
12. **Reporter cannot edit a submitted incident.** If they submitted with
    a typo or wrong unit, the owner or admin sees the bad data and there
    is no first-party correction path.

---

## 14. Roadmap

Grouped by where each item fits in the build order. Numbering is per
group, not chronological. Items are scoped to the incidents module
itself; cross-module roadmap (operator-portal, guest-mgmt, facilities,
tourism) is in `../../platform/DESIGN.md` §7.

### 14.1 Near-term, no schema change

Things the module can adopt without a migration; mostly polish on what
already exists.

| # | Item | Notes |
| --- | --- | --- |
| N1 | **Tier the SLA cron by `category`** | Map `serious / watch / minor` → existing tier ladder (§5.3). Schema already carries the field; only the cron logic needs to branch. |
| N2 | **Email retry button** | Admin UI action that re-runs a failed `email_delivery_logs` row. Server endpoint already exists for the underlying send. |
| N3 | **Bulk close / bulk assign** | Admin checkbox + bar for general-incident triage during a building-wide event. |
| N4 | **Reporter self-edit window** | Allow the reporter to edit their own incident for N minutes (configurable) after submission, before the owner is notified. |
| N5 | **Frontend reporter-privacy hardening** | Treat `reporter_name` as never-rendered for owner/operator viewers via a typed boundary instead of relying on prop filtering. Server is already the contract; this is defense-in-depth. |
| N6 | **SLA business-hours mode** | Optional per-community config: pause the timer outside business hours / weekends / holidays. |

### 14.2 Schema-additive, single-migration items

Each adds columns or one small table; backwards-compatible.

| # | Item | Schema change | Notes |
| --- | --- | --- | --- |
| S1 | **Threaded comments** | New `incident_comments(id, incident_id, author_uid, body, created_at, visibility)` | Append-only. `visibility` lets admins post admin-only notes. Replaces the overwrite-on-update pattern of `owner_resolution` / `resolution_comments`. |
| S2 | **Add `building` and `regulatory` incident types** | Extend `INCIDENT_TYPES` constant + email templates | No DB migration; `type` is free text. Tag colors + i18n strings only. |
| S3 | **Watcher subscriptions** | New `incident_watchers(incident_id, user_uid, created_at)` | A user can opt in to follow an incident they did not report. Notifications fan out to watchers in addition to role-based recipients. |
| S4 | **`sla_paused_until`** | One column on `incidents` | Lets an admin acknowledge a stuck escalation ("waiting on building admin response") without losing the row. Cron skips paused rows. |
| S5 | **`updated_at` + edit history** | One column + an audit-log convention | Today only `created_at` is on the row; updates are inferred from the audit log. Surfacing `updated_at` lets the list view sort by recent activity cheaply. |

### 14.3 Schema-additive, photos-as-attachments

This is the **biggest single-row simplification** and a precondition for
both operator-portal repair invoices and guest-mgmt inspection photos.

| # | Item | Schema change | Notes |
| --- | --- | --- | --- |
| P1 | **Move photos to a Supabase Storage bucket** | New `incident_attachments(id, incident_id, kind, url, content_type, byte_size, uploaded_by_uid, uploaded_at)`; deprecate `incidents.photos` JSONB | Remove the 6 MB row size; allow more than 3 photos; share the same attachment table shape with `service_request_attachments` and `stay_inspection_photos` from neighbor modules. Migration is a one-time lift of base64 → bucket. |
| P2 | **Thumbnail generation** | Bucket-side image transform on upload | List view stops decoding 2 MB blobs to render a 64 px badge. |

### 14.4 Cross-module integrations to land

These are the incidents-side hooks for modules described in
`../../platform/DESIGN.md`. Each is a wire-up, not a redesign of the
incidents module.

| # | Item | Required from other module | Incidents-side change |
| --- | --- | --- | --- |
| X1 | **Delegation level** | `unit_operator_relationships.delegation_level` (operator-portal) | Step 1 / Step 2 endpoints accept an operator actor when delegation allows; audit row carries the `"acting on behalf of"` attribution. |
| X2 | **Linked service request** | `service_requests` table (operator-portal) | New nullable `linked_service_request_id` on `incidents`; UI shows a link in the detail modal. |
| X3 | **Linked guest stay** | `guest_stays` table (guest-mgmt) | New nullable `linked_stay_id` on `incidents`; pulls inspection-photo baseline into the detail view. |
| X4 | **Facility-closure-spawned incident** | `facility_closures` (facilities) | A closure can post an incident of type `building` against the community; the closure row holds the back-link. |

### 14.5 Larger reshapes (longer horizon)

Things that change the module's shape, not just add to it. Each of these
deserves its own design pass before commitment.

| # | Item | Why | What it would touch |
| --- | --- | --- | --- |
| R1 | **Replace the two-step owner workflow with a generalized state machine** | The current `open → verified-without-resolution → verified-with-resolution → resolved` is encoded across `status`, two timestamp columns, and string-emptiness checks. A small typed state machine (`open`, `acknowledged`, `in_progress`, `awaiting_response`, `resolved`, `closed`) would let the module support more than just the owner-driven flow without further special-casing. | `incidents` schema (status enum + transition table); cron; UI status labels. |
| R2 | **Incident templates** | Frequent incident types (water leak, lockout, party complaint) collect the same metadata each time. A template stores a starter form, suggested guest fields, and a recommended SLA tier. | New `incident_templates` table; report form picks a template before opening. |
| R3 | **Anomaly / pattern surfacing** | The platform has the data to see "Apt 305 had three noise incidents in 60 days." Today this requires a manual export. A small per-unit / per-type rollup view would surface it. | Read-side aggregation; new analytics view. No write-side change. |
| R4 | **Public-facing incident receipt** | The reporter currently has no shareable proof their report was received and is being handled (analogous to a building-admin response). A signed read-only URL would close that loop. | New endpoint; no schema change beyond a token. |
| R5 | **Incident-level guest tagging** | Today guest names live as a JSONB blob on the incident. If guest-mgmt lands, repeated bad-actor guests should be linkable across incidents per unit. | Foreign key from `incidents.owner_guests[*]` → `guest_block_list` rows once `guest-mgmt` exists. |

### 14.6 Out-of-scope reminders

For clarity, these will **not** land in this module no matter how often
they get asked for; they belong elsewhere:

- Repair vendor / cost / invoice — operator-portal `service_requests`.
- Per-stay inspection baseline — guest-mgmt.
- Cross-community incident pattern analytics — platform analytics.
- Payment for damage — out of platform scope entirely (no payment rail).

---

*Update this document when the module's shape changes. Per-roadmap
items are sketches; promote them to their own design notes if and when
they become committed work.*
