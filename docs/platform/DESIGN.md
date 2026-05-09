# Community Property Management Platform — Design Document

> Status: design reference — May 2026
> Owner: platform team
> Companion docs: `./PLATFORM_ARCHITECTURE.md` (contract), `../modules/operator-portal/DESIGN.md` (operator-portal spec), `../modules/operator-portal/PROPOSAL.md` (client-facing proposal), `../modules/operator-portal/USE_CASE_DISCOVERY.md` (operator/owner use cases grounded in real WhatsApp data)

This document is the high-level design of the community property management
platform: the live incident-management module, the operator-portal module
that is currently a concept, and the longer-horizon modules on the roadmap
(guest-mgmt, tourism, facilities). It frames each module as a vertical slice
on top of a shared platform layer and explains how they are intended to
compose.

---

## 1. Vision and Scope

The platform is the **operational system of record for residential
communities that host short-term rentals**. A community is a single physical
place — a building, condo tower, gated neighborhood, resort, or HOA-managed
complex — with its own units, owners, operators, guests, staff, rules,
incidents and shared spaces.

The platform is the layer that makes those parties speak to each other
through structured, auditable workflows instead of WhatsApp groups, Excel
sheets, or "ask the building admin." Listing platforms (Airbnb, VRBO,
Booking.com, etc.) remain the source of truth for bookings, guest data, and
money; **the platform is the relationship management layer** sitting next to
them.

Two things are intentionally **out of scope**:

1. Replacing Airbnb / VRBO / Booking.com — guest profiles, payouts, calendar
   sync, and reviews live there.
2. Holding any payment rails — no bank details, no transfers. Repair invoices
   and utility bills are tracked as documents and approval state, never as
   funds movement.

### Success criteria

| Stakeholder | What "the platform works" looks like |
| --- | --- |
| Owner | Knows the state of every unit without asking; approvals never get buried; nothing financial happens without their explicit confirmation. |
| Operator | Sees every unit they manage across every community in one inbox; has a permanent record that survives staff turnover; never re-explains a unit to a new team member. |
| Community admin | Sees all incidents, all operators, all unit-level activity for their building; can act on regulatory and HOA matters without chasing people down individual chats. |
| Staff member | Sees today's assignments across communities on a phone; updates status with a photo; never asks "what's the access code again?". |
| Guest | (Indirect) gets faster issue resolution and accurate listings because the operator/owner are no longer guessing who owns what. |

---

## 2. Platform Fundamentals

The platform is structured around the **three orthogonal axes** locked in
`./PLATFORM_ARCHITECTURE.md`:

| Axis | Question it answers |
| --- | --- |
| **Tenant** (`community_id`) | *Whose* data is this? |
| **Module** (`incidents`, `operator-portal`, `guest-mgmt`, `facilities`, `tourism`) | *What functional area* does it belong to? |
| **Role** (global admin / community admin / community-module admin / member) | *What is this user allowed to do*? |

Every domain row, route, permission, UI view, and email template sits at the
intersection of these three axes. A new module is "drop a folder, register
it" — no edits to the platform shell.

### 2.1 Platform-layer entities

These belong to the platform itself; modules reference them but never own
them.

| Entity | Purpose |
| --- | --- |
| `app_users` | Global user records keyed by Firebase UID. |
| `communities`, `community_memberships`, `community_config` | A community and the people in it; per-community settings and admin grants. |
| `units` (currently `listings`) | Apartments / rooms / villas inside a community. The shared anchor every module joins onto. |
| `registrations` | Community-membership applications (owner/operator/staff onboarding). |
| `notifications` | Cross-module notification fan-out (in-app inbox + email). |
| `audit_logs` | Cross-module audit trail of state-changing actions. |
| `email_templates`, `email_delivery_logs` | Module-declared default templates, overridable per row in DB; full delivery history. |
| `app_config` | Platform-wide runtime settings (SLA hours, mission text, default permissions, escalation emails). |

### 2.2 Authentication and authorization

- **Auth** is Firebase Google Sign-In only. The frontend hands the server a
  Google UID and email; the server resolves roles independently from
  `GLOBAL_ADMIN_EMAILS` (env) and `community_memberships`.
- **Permissions** are resolved server-side in a single
  `resolvePermissions(uid, communityId)` call and returned to the client as
  one structured object. The client never re-derives them.
- **Permission keys** are namespaced: `incidents:resolve`,
  `operator-portal:approve-relationship`, `platform:manage-users`. Old flat
  keys are aliased during the migration window.

### 2.3 The module contract

Every module — live or planned — exposes the same shape, server- and
client-side:

```js
// server/modules/<slug>/index.js
module.exports = {
  slug, name, version,
  routes,                  // mounted at /api/m/<slug>
  permissions,             // capabilities this module declares
  emailTemplates,          // default templates (es-CO, en)
  auditEntities,           // entity names this module emits
  schemaMigrations         // optional
}
```

```js
// client/src/modules/<slug>/index.js
export default {
  slug, name,
  navItems,                // gated by declared permissions
  routes,                  // <Route> elements at /m/<slug>
  permissions,
  i18n
}
```

### 2.4 Cross-cutting platform services

Three services are shared by every module and must not be reinvented inside
one:

1. **Notifications** — every state change worth a person's attention writes a
   `notifications` row and (where configured) sends an email via the
   module's declared template.
2. **Audit log** — any state-changing action emits an `audit_logs` row keyed
   by `<module>.<entity>`. Operator actions in the operator-portal module
   carry the additional `"acting on behalf of [Owner]"` attribution string.
3. **SLA timers** — modules with timed obligations (incidents today,
   service-requests tomorrow) plug into a shared SLA cron loop that walks
   rows whose `next_sla_reminder_at` has elapsed and fires the appropriate
   reminders + escalations.

---

## 3. Module: `incidents` (live)

Status: **shipped**. This is the working module today; everything else in
this document layers on top of it.

### 3.1 What it does

Captures any community-or-property-level incident — guest complaint, noise,
damage, common-area issue, regulatory or building notice — and runs it
through a two-step resolution workflow with SLA pressure.

### 3.2 Two-step workflow

```
Reported → Step 1: verify + immediate action → Step 2: owner resolution → Closed
```

- **Step 1** is the operational acknowledgement: someone with eyes on the
  unit confirms the issue and takes the immediate action (turn off the
  water, talk to the guest, file the building report).
- **Step 2** is the owner-side resolution: ownership decision, follow-up
  task, closure note. This is where pricing implications, repair approvals,
  and AirCover decisions land.

Today, both steps are owned by the **owner** unless they delegate.
Operator-portal (Section 4) introduces the `delegation_level` field so
operators can complete Step 1 (or both) on behalf of the owner with full
audit attribution.

### 3.3 SLA model

`app_config` stores default SLA hours per incident urgency tier. The cron
loop in `server/modules/incidents/sla-cron.js`:

- Walks pending incidents whose `next_sla_reminder_at` is in the past.
- Fires the per-stage reminder email.
- Escalates by writing a higher-tier notification when the cycle count
  exceeds the configured threshold.
- Updates `sla_cycle_count` and the next reminder timestamp.

The default tiers (mirrored later by the operator-portal request-type
taxonomy):

| Tier | Examples | Response SLA |
| --- | --- | --- |
| Critical | Guest locked out, safety issue | 1 hour |
| Urgent | AC/water failure, AirCover window | 2–4 hours |
| Standard | Repair approval, task request, general question | 24 hours |
| Async | Pricing or peak-period proposal, listing change | 48 hours |
| Monthly | Utility bill, payout statement | 5 days |
| FYI | Booking notification, informational | none, archive after 7 days |

### 3.4 Reporter privacy

A non-negotiable platform rule: **the reporter's identity is hidden from the
operator and the unit owner.** Only community admins and the originating
reporter see the reporter identity. The operator-portal must respect this;
the same rule will apply to guest-mgmt and facilities.

### 3.5 Capabilities

Declared in `server/modules/incidents/permissions.js`:

- `incidents:resolve`
- `incidents:update`
- `incidents:delete`
- `incidents:assign`

### 3.6 Data shape (live)

`incidents` is the only module-owned table in the live system. It already
references `listings` (units), `communities`, and `app_users` from the
platform layer, and emits `incidents.incident` audit entries.

### 3.7 Known gaps the operator-portal will fill

- Step 1 cannot be performed by an operator on behalf of an owner — only the
  owner's account can advance it. This forces "ask the owner" round-trips.
- Damage incidents cannot link to a structured repair record with cost,
  photos, and invoice — the conversation lives in notification emails.
- There is no per-stay inspection baseline, so guest-vs-prior-guest damage
  disputes cannot be resolved from data.

These are explicitly addressed in Section 4.

---

## 4. Module: `operator-portal` (concept)

Status: **approved design, pending implementation**. Full spec in
`docs/modules/operator-portal/DESIGN.md`; client-facing pitch in
`docs/modules/operator-portal/PROPOSAL.md`; use-case grounding in
`docs/modules/operator-portal/USE_CASE_DISCOVERY.md`.

### 4.1 What it does

Replaces the WhatsApp group that today connects the **operator (host)**, the
**owner (co-host)**, and **operator staff** for a unit. Every actionable
WhatsApp message becomes a typed, tracked request with: type, owner,
status, SLA timer, threaded follow-ups, and scoped visibility.

### 4.2 Roles

Two new roles join the existing model:

| Role | Description |
| --- | --- |
| `operator` | Business or individual managing units across multiple communities for one or more owners. |
| `operator_staff` | A team member under an operator (cleaner, supervisor, logistics, guest relations). May or may not have a platform login. |

The owner role split inside the operator-portal mirrors Airbnb's co-host
model:

| Operator-portal role | Mapped from Airbnb | What they see / do in the platform |
| --- | --- | --- |
| **Operator** | Host (primary) | Owns the listing, calendar, pricing, guest replies, AirCover claims. |
| **Payout Owner** | Co-host — Payout | Approves financial requests (repair above threshold, pricing). Exactly one per unit. |
| **Calendar Owner** | Co-host — Calendar | Sees calendar context and request threads; financial figures hidden. One or more per unit. |

All owners can read and reply in any request thread for their unit, mirroring
their current WhatsApp group participation.

### 4.3 Relationship lifecycle

```
unmanaged ──┬── (operator proposes) ──→ pending_owner ──→ active
            └── (owner invites)     ──→ pending_operator ──→ active

active ──→ terminated  (either party; history stays read-only)
       └─→ amended     (contract change via same propose/confirm flow)
```

Constraints:

- 1 unit → 0 or 1 active operator (exclusive management).
- 1 operator → N units across M communities.
- "Already managed" is a hard block; the existing relationship must be
  terminated first (or force-terminated by an admin in dispute resolution).

### 4.4 Listing-management contract

Each operator-unit-owner relationship carries a stored contract that
encodes terms KAI then enforces:

- Repair approval threshold (drives the cost-gate in service requests)
- Response-time commitments per request type (drives SLA)
- Services included (cleaning arrangement, listing edits, AirCover filing)
- Management fee % and basis (reference only — payouts happen on Airbnb)
- Termination notice period and behavior on active bookings
- Platforms covered (Airbnb required; VRBO / Booking / direct optional)

Amendments follow the same propose / counter / confirm flow as pricing;
neither party can unilaterally edit an active contract.

### 4.5 Request taxonomy

Every request maps to one structured type. Each carries its own SLA tier,
initiator, recipient list, and Calendar-Owner visibility rule. Summary by
direction:

**Operator → Owners:** repair approval, repair FYI, guest issue (urgent /
standard), booking relay, booking special request, pricing proposal, peak
period proposal, guest-caused damage (AirCover), non-guest damage (owner
insurance), non-guest cleaning, utility bill, general update.

**Owner → Operator:** task request, calendar block, pricing proposal,
peak-period proposal, listing change request, document request, general
question.

**Operator → Team (internal):** cleaning assignment, repair assignment,
inspection request, access-code change, building-notice relay.

**System / platform-derived:** booking relay (manual or future iCal sync),
AirCover window prompt (12 days post-checkout), Superhost risk prompt.

The full table with WhatsApp-equivalent examples and Calendar-Owner
visibility lives in `../modules/operator-portal/USE_CASE_DISCOVERY.md` §"Request Type Taxonomy".

### 4.6 The unified attention inbox

Both the operator and the owner see the same concept: *"What needs me right
now?"* Items where the ball is in your court are surfaced first; SLA timers
turn yellow at 50% elapsed and red at overdue; items awaiting the other
party are visible but deprioritized; completed items are archived and
searchable, not lost.

### 4.7 Damage path: two insurance lanes

Every damage incident is tagged at creation as one of two paths, which
determines who files and what KAI collects:

| | Guest-caused | Non-guest |
| --- | --- | --- |
| When | During a guest stay | Between stays / owner use / external cause |
| Insurance | Airbnb AirCover | Owner's unit insurance |
| Filed by | Operator on Airbnb (14-day window) | Owner with their insurer |
| KAI role | Per-stay photo log, AirCover prompt, claim reference + outcome | Incident record, photo evidence, cost estimate |

The operator-portal hard-requires per-stay check-in / check-out inspection
photos; without them, "the damage was pre-existing" cannot be disproved and
AirCover claims fail.

### 4.8 Delegation into the incidents module

The operator-portal does not replace the incidents module; it integrates
with it via a per-unit `delegation_level`:

| Level | Step 1 | Step 2 |
| --- | --- | --- |
| `owner_handles` | Owner only; operator notified | Owner only |
| `operator_assists` (default) | Operator can complete on behalf of owner | Owner must complete |
| `operator_handles` | Operator | Operator; owner notified |

Every operator action in the incident workflow is audited as
`"[Operator Name] acting on behalf of [Owner Name] — Unit [APT]"`.
Reporter identity remains protected.

### 4.9 New tables (summary)

Full DDL is in `../modules/operator-portal/DESIGN.md` §"Database — New Tables /
Columns". The shape:

- `operator_profiles`, `operator_communities`, `operator_staff`
- `unit_operator_relationships` (status + delegation_level + lifecycle dates)
- `unit_profiles` (amenities, beds, access notes, Airbnb URL)
- `service_requests` + `service_request_attachments`
- `unit_pricing` + `pricing_decisions` (immutable log)
- `owner_blocks`
- `unit_documents`

All live under `server/modules/operator-portal/` and routes under
`/api/m/operator-portal/*`. Permissions are namespaced
`operator-portal:<verb>-<noun>`.

### 4.10 Implementation phasing

Pulled from the design doc; recommended MVP is Phases 1–3.

| Phase | Scope | Rough effort |
| --- | --- | --- |
| 1 | Operator identity + unit linking + unit profile | ~3 weeks |
| 2 | Cross-community operator dashboard | ~2 weeks |
| 3 | Service requests + work orders (cost gate, photos, invoices, incident link) | ~4 weeks |
| 4 | Scheduling + owner blocks + conflict detection | ~2 weeks |
| 5 | Pricing log + bidirectional change workflow + ranking-impact preview | ~3 weeks |
| 6 | Documents + compliance (RNT, utilities, insurance, credentials vault) | ~2 weeks |
| 7 | Staff task management (mobile, photo proof, real-time view) | ~3 weeks |

### 4.11 Open questions blocking implementation

These need answers before code lands; full list in
`../modules/operator-portal/USE_CASE_DISCOVERY.md` §"Questions That Must Be Answered Before Building":

- Multi-owner approval semantics (Payout vs. Calendar Owner approval rights).
- Pricing-proposal expiry: silent expire vs. auto-approve at 48h.
- Smart Pricing on/off: bidirectional confirm or operator's call?
- Listing transition on relationship end.
- Whether team members get individual platform accounts in v1.

---

## 5. Future Roadmap Modules

The slugs and statuses below are locked in `./PLATFORM_ARCHITECTURE.md` §3 so
they can be reasoned about today even though they are not implementation
commitments.

| Slug | Status | Purpose |
| --- | --- | --- |
| `incidents` | live | Community / property incident management |
| `operator-portal` | concept | Operator work management; owner ↔ operator relationship lifecycle |
| `guest-mgmt` | idea | Guest stays, check-in/out, guest history |
| `tourism` | idea | Local tourism integration |
| `facilities` | idea | Shared amenity / facilities operations |

Each future module below is sketched at the level of: what problem it
solves, what platform entities it touches, what new entities it owns, what
namespaced capabilities it would declare, and what its dependencies on
already-shipped modules are.

### 5.1 `guest-mgmt` (idea)

**Problem.** The platform deliberately does not replace Airbnb for booking
and payouts, but several operational concerns straddle "the booking" and
"the unit": pre-arrival communication, in-stay issue handling, the
check-in / check-out inspection baseline that AirCover depends on, and the
post-stay review loop. Today these live in Airbnb messaging, WhatsApp, and
the operator's head.

**In scope.**

- A lightweight per-stay record (dates, guest count, source platform,
  optional reference to Airbnb reservation code) created by the operator or
  by future iCal/API sync.
- Pre-arrival checklist (welcome message sent, access instructions
  delivered, special-request acknowledgement).
- In-stay issue feed scoped to the active stay, surfacing relevant
  operator-portal request types (guest urgent, guest standard).
- **Per-stay inspection photo log** (check-in baseline + check-out
  closeout). This is the single most-cited gap in the discovery doc — it is
  the prerequisite for both AirCover claims and damage attribution between
  consecutive stays. It belongs here, not in incidents.
- Review draft + owner approval flow before the operator publishes the host
  response on Airbnb.
- Guest block list (per unit, owner-requested, operator-applied).

**Out of scope.** Guest profiles, payment, calendar sync writeback, direct
guest messaging — those stay on Airbnb.

**Depends on.** Operator-portal must be live (this module needs the
operator role and the unit_operator_relationship). Incidents module for
escalation paths.

**Owns (sketch).** `guest_stays`, `stay_inspections`,
`stay_inspection_photos`, `review_drafts`, `guest_block_list`.

**Capability keys.** `guest-mgmt:create-stay`,
`guest-mgmt:complete-inspection`, `guest-mgmt:approve-review`,
`guest-mgmt:manage-block-list`.

**Cross-module integration.** Damage incidents in the operator-portal must
be able to attach to a `guest_stays` row to inherit its inspection photos
and decide the AirCover-vs-owner-insurance lane.

### 5.2 `tourism` (idea)

**Problem.** Owners and operators get repeatedly asked the same things by
guests: where to eat, how to get a taxi, what to do, beach access, day trips.
Today this is solved with PDFs in the apartment and ad hoc messages.

**In scope.**

- Per-community curated content pack: restaurants, services, transport,
  emergency contacts, language tips.
- Per-unit overrides (the owner's recommended coffee shop differs from the
  community default).
- Lightweight content management for community admins (or for a designated
  community-module admin: `tourism:edit-content`).
- Guest-facing surface delivered via:
  - QR code in the unit → public read-only landing page
  - Linkable URL the operator can paste into the Airbnb welcome message
- Optional booking relays (taxi, day trip) that create an
  operator-portal request thread instead of holding the booking in this
  module.

**Out of scope.** Acting as a booking engine for third parties, holding
payment, or replicating Google Maps.

**Depends on.** Platform layer only (communities, units). No hard
dependency on operator-portal — a community can publish content even
without operators in place.

**Owns (sketch).** `tourism_pois` (points of interest), `tourism_categories`,
`tourism_unit_overrides`, `tourism_publications` (for QR/URL versioning).

**Capability keys.** `tourism:edit-content`, `tourism:publish`,
`tourism:override-per-unit`.

**Cross-module integration.** A guest tap on "Request a taxi" (or any other
relayable category) creates a request in operator-portal of type
`booking special request` or `task request`, depending on the category
configuration.

### 5.3 `facilities` (idea)

**Problem.** Every community has shared amenities — pool, gym, party room,
BBQ, parking, elevators, common laundry. Operations on those amenities
(reservations, closures, maintenance, HOA notices) are the building admin's
domain today and live in WhatsApp groups and printed signs.

**In scope.**

- Amenity inventory per community: name, capacity, hours, rules, photos.
- Reservations where applicable (party room, BBQ, guest parking) with
  conflict checks and per-unit quotas.
- **Closure notices** with start/end and reason — these are the events that
  cross over into other modules:
  - The operator-portal must surface them as a `building notice` request
    against any unit with an in-progress or upcoming guest stay.
  - The tourism module's content pack must reflect closures on the public
    landing page automatically.
- Maintenance schedule for amenities, with the option to spawn an incident
  or a service request when something breaks.
- HOA / building rules library that the operator-portal references so that
  listing-content updates can be flagged when they would remove a required
  rule.

**Out of scope.** Replacing the HOA's accounting or fee-collection system.
Property-management system (PMS) replacement — this is operations only.

**Depends on.** Platform layer (communities, units). Soft dependency on
operator-portal (closures fan out through operator-portal request threads
when present, but degrade gracefully to plain notifications when not).

**Owns (sketch).** `facility_amenities`, `facility_reservations`,
`facility_closures`, `facility_rules`.

**Capability keys.** `facilities:manage-amenities`,
`facilities:manage-reservations`, `facilities:publish-closure`,
`facilities:manage-rules`.

**Cross-module integration.**

- A `facility_closures` row that overlaps an active or upcoming guest stay
  triggers an operator-portal `building notice` request requiring operator
  acknowledgement and (if guest-impacting) a prompt to message the guest on
  Airbnb.
- The operator-portal's listing-change request must consult
  `facility_rules` and warn if the change would remove a required HOA rule
  from the listing.
- Tourism content publishes closures automatically.

---

## 6. Cross-Module Integration Patterns

The four planned modules and the live one fit together through a small set
of patterns. Naming these patterns now keeps the surface area small as more
modules land.

### 6.1 Unit as the join key

Every domain row outside the platform layer joins onto `units` (currently
`listings`). This is why `listings` was promoted out of incidents and into
the platform layer in the v80 schema — operator-portal, guest-mgmt and
facilities all need it, and putting it inside any one module would force
the others to reach across module boundaries.

### 6.2 Notifications fan-out

A module never sends emails or writes notifications directly to a database
table belonging to another module. It writes a `notifications` row and lets
the platform notification service decide who gets what (in-app badge,
email, future WhatsApp) based on per-user preferences and the recipient's
permission set.

### 6.3 Audit attribution for delegated action

Any action a user takes on behalf of another user — most commonly an
operator acting for an owner — must be logged with the
`"[Actor Name] acting on behalf of [Subject Name] — Unit [APT]"` format.
The audit log is module-agnostic; the attribution string is the contract.

### 6.4 Request-thread linking, not entity duplication

When two modules both have a stake in the same real-world thing (a damage
incident is both an `incidents.incident` and an
`operator-portal.service_request`; a facility closure during a guest stay
is both a `facilities.facility_closure` and an
`operator-portal.request`), the rule is **link, do not duplicate**. Each
side keeps its own record; one carries a foreign key to the other; the UI
renders both sides of the link.

### 6.5 SLA tiers are platform-defined

Modules do not invent their own SLA scales. They pick a tier from the
platform list (Critical / Urgent / Standard / Async / Monthly / FYI) and
register their typed rows with the shared SLA cron. The community admin
sets the hours per tier in `app_config`.

### 6.6 Permission keys are namespaced; visibility is server-resolved

The client never decides "is this user allowed to see this?" — the server
returns the permission object up front and filters list endpoints down to
the rows the user can see. New modules add keys like
`<slug>:<verb>-<noun>` and consume them through the same
`resolvePermissions` path. Calendar-Owner financial-figure hiding (Section
4) is implemented as a server-side filter, not a client-side hide.

---

## 7. Roadmap

The build order is dictated by two constraints: (1) shared dependencies
must land before dependents, and (2) the highest-friction WhatsApp
workflows from the discovery doc come first.

### 7.1 In flight

- **Architecture refactor** — monolith → module structure
  (`server/modules/<slug>/`, `client/src/modules/<slug>/`). Frontend
  extraction (F1–F35) is complete; server-side staged extraction continues
  on `claude/review-platform-architecture-Qt8m0`.
- **Incidents module** — live. Continued investment in SLA cron, audit
  surface, and admin views.

### 7.2 Next milestone — operator-portal MVP

Phases 1–3 of the operator-portal design (operator identity + unit
linking, cross-community dashboard, service requests with cost gate). This
is the first real test of the module contract and unblocks both
`guest-mgmt` and `facilities`.

Open questions blocking start:

- Multi-owner approval rules (MO-2, MO-5).
- Pricing-proposal expiry behavior (PRICE-1).
- Whether staff get platform accounts (TEAM-1).
- Supabase Storage bucket for photos and invoices (Phase 6 dependency, but
  needed earlier if Phase 3 photos land first).

### 7.3 Following milestones

| Milestone | Why now | Prereqs |
| --- | --- | --- |
| Operator-portal Phases 4–7 | Closes the WhatsApp-replacement loop (scheduling, pricing, documents, staff mobile) | Operator-portal MVP |
| `guest-mgmt` v1 | Per-stay inspection photo log unblocks AirCover and damage attribution; biggest single risk reduction in the use-case discovery | Operator-portal MVP |
| `facilities` v1 | Building-notice → guest-stay impact loop is the #2 unmet need from the chat data; required for HOA-rule enforcement on listing edits | Operator-portal MVP, ideally guest-mgmt for stay-impact detection |
| `tourism` v1 | Lowest dependency footprint; delivers visible value to guests with no prerequisite from other modules | Platform only |

### 7.4 Module enablement per community

Per `./PLATFORM_ARCHITECTURE.md` §10, the `community_modules` table lands
when module #2 (operator-portal) ships. Default backfill: every existing
community has every then-available module enabled. Global admin toggles
per-community thereafter; community admin assigns who admins what within
their community.

---

## 8. Non-Goals and Anti-Patterns

The platform is small on purpose. Calling these out so future contributors
don't accidentally drift into them:

- **Not a PMS.** No revenue, no payouts, no remittances, no booking
  engine. Listing platforms keep that role.
- **Not a payment rail.** No bank details, no transfers, no crypto.
  Repair invoices are documents; utility bills are documents; the platform
  tracks approval state, not money movement.
- **Not a guest-facing chat product.** Guest communication stays on Airbnb.
  The platform talks to guests only via tourism module's read-only
  surfaces and via operator-portal-prompted operator action.
- **Not a generic incident tracker.** Incidents are scoped to a community
  and a unit; cross-community generic ticketing is not a goal.
- **No cross-module reach-into-tables.** A module that wants data from
  another module gets it through that module's API, not by joining its
  tables. This is what keeps the module contract honest.
- **No client-side permission decisions.** The server returns the permission
  set; the client renders accordingly. No "if user.email === ..." in the UI.

---

*This document is the design contract for the platform as a whole; per-
module specifications (`../modules/operator-portal/DESIGN.md`, future
`GUEST_MGMT_DESIGN.md`, etc.) live next to it and override it on details
within their slice. Update this file when the inter-module surface
changes; do not let drift accumulate.*
