# Prototype Readiness Summary
# KAI Operator Portal

> Reference document — May 2026  
> Companion to: `OPERATOR_PORTAL_PROPOSAL.md`, `GTM_AND_PRICING.md`

---

## Decisions Locked

| # | Question | Decision |
|---|---|---|
| 1 | Owner who is also an operator | **Single account with role switch** — one Google login, toggle between Owner view and Operator view from the profile |
| 2 | WhatsApp notifications | **Email only** for now |
| 3 | Who pays / billing | **Operator pays**, but payment is **off by default** — UI placeholder only until billing is wired |
| 4 | Initial operator role assignment | **Global admins get operator role automatically**; other users granted operator role by a global admin in the Admin panel |

---

## Role Model (Updated)

Current roles: `global_admin`, `delegate_admin`, `user`

**New role added:** `operator`

| Role | How assigned | What it unlocks |
|---|---|---|
| `global_admin` | `GLOBAL_ADMIN_EMAILS` env var | Everything, including operator view automatically |
| `operator` | Global admin grants in Admin panel | Operator dashboard, staff roster, unit linking, service requests |
| `delegate_admin` | Stored in `app_users.role` | Existing community admin powers (unchanged) |
| `user` | Default | Owner view only |

A `global_admin` who is also acting as an operator uses the role switch in their profile to toggle the active view.

---

## Claude Implementation Effort Key

| Label | What it means for Claude |
|---|---|
| **Trivial** | Single-file change, no schema, low reasoning load. 1 focused prompt. |
| **Low** | 1–2 files, minimal schema change, clear pattern to follow. 1–2 sessions. |
| **Medium** | 2–4 files, new DB table or endpoint, some cross-cutting logic. 2–4 sessions. |
| **High** | 4–6 files, multi-step flows, error handling, state coordination. 4–8 sessions. |
| **Very High** | 6+ files, new subsystem, complex async flows, significant testing surface. 8–15 sessions. |

*A "session" is one focused Claude Code prompt-to-completion cycle on a discrete task.*

---

## Phase 0 — Login Path Split, Role Switch & Owner Opt-Out

### What gets built
- Login gate shows two cards: **I'm an Owner** / **I'm an Operator** before Google sign-in
- Each path has its own mission/welcome screen (community branding for owners; operator-focused copy for operators)
- Post-login destination: Owner → My Units, Operator → Operator Dashboard
- `kai_user_type` stored in `localStorage`, switchable from profile
- `operator` role added to server role resolution; global admins get it automatically
- Admin panel gets a "Grant Operator Role" control for other users
- Owner community opt-out: per-community toggle in profile; opted-out units hidden from all community incident queries

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| Login path selector UI (two cards before Google button) | `App.jsx` | Trivial |
| Operator mission/welcome screen variant | `App.jsx` | Trivial |
| `kai_user_type` persistence + profile role-switch toggle | `App.jsx` | Low |
| Add `operator` role to `getUserRole()` server logic | `server.js` | Low |
| Global admins auto-get operator role in `getUserRole()` | `server.js` | Trivial |
| Admin panel: grant/revoke operator role for a user | `App.jsx`, `server.js` | Low |
| `user_community_prefs` table + migration | `schema.sql` | Trivial |
| Owner opt-out toggle in profile UI (per community) | `App.jsx` | Low |
| Server: filter opted-out unit IDs from all community incident queries | `server.js` | Medium |
| **Phase 0 total** | | **Medium (3–5 sessions)** |

---

## Phase 1 — Operator Identity & Unit Linking (Multi-Owner)

### What gets built
- Operator registers a business profile: name, logo, contact info, communities they work in
- Operator staff roster: name, role (cleaning / supervision / logistics / guest relations), email, WhatsApp
- Unit linking — one active operator per unit, multiple owners per unit:
  - Operator proposes → Payout Owner accepts/declines
  - Payout Owner invites → operator accepts/declines
- **Multiple owner types per unit:**
  - **Payout Owner** — exactly one; financial approval rights (repairs, pricing); full thread access; payout received directly on Airbnb (not tracked in KAI)
  - **Calendar Owner** — one or more; sees calendar and threads; repair cost amounts hidden; no approval rights (pending MO-2 answer)
  - Payout Owner manages the owner roster (add/remove Calendar Owners)
- Unit profile fields maintained by operator: amenities, bed config, Airbnb URL, platforms listed on, access notes
- Status badges per unit: No operator / Pending / Actively managed
- Platform registration per unit: Airbnb primary + optional others (VRBO, Booking.com, direct)

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| `operators` table + `operator_staff` table + migration | `schema.sql` | Low |
| `unit_operator_links` table (status: pending/active/declined) | `schema.sql` | Trivial |
| `unit_owner_links` table (uid, unit_id, role: payout/calendar, status) | `schema.sql` | Low |
| Operator profile CRUD API endpoints | `server.js` | Low |
| Staff roster CRUD API endpoints | `server.js` | Low |
| Operator profile + staff roster UI | `App.jsx` | Medium |
| Unit link propose flow (operator side) + duplicate guard | `server.js`, `App.jsx` | Medium |
| Unit link accept/decline flow (Payout Owner side) + notifications | `server.js`, `App.jsx` | Medium |
| Payout Owner invite flow (owner → operator) | `server.js`, `App.jsx` | Medium |
| Payout Owner: add/remove Calendar Owners for their unit | `server.js`, `App.jsx` | Medium |
| Permission resolver: payout vs. calendar owner data scoping | `server.js` | Medium |
| Extend `listings` table with operator-maintained fields + platform list | `schema.sql`, `server.js`, `App.jsx` | Low |
| Status badges on unit cards (all owner views + operator view) | `App.jsx` | Low |
| Email notifications for link/invite events | `server.js` | Low |
| **Phase 1 total** | | **High–Very High (6–9 sessions)** |

---

## Phase 2 — Operator Dashboard (Multi-Community View)

### What gets built
- Post-login destination for operators: all linked units across all communities in one view
- Units requiring attention (open incidents, pending approvals) surface first
- Community filter as secondary control
- Staff daily assignment view: what's on my list today, across all communities

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| `GET /api/operator/dashboard` endpoint (cross-community unit + incident aggregation) | `server.js` | Medium |
| Operator dashboard view component | `App.jsx` | Medium |
| Unit attention card (open incidents, pending approvals, next event) | `App.jsx` | Low |
| Attention-first sort + community filter | `App.jsx` | Low |
| Staff daily assignment list (scoped to logged-in staff member) | `server.js`, `App.jsx` | Medium |
| Route operator users to dashboard on login (not My Units) | `App.jsx` | Trivial |
| Mobile-responsive layout for dashboard | `App.jsx` (CSS) | Low |
| **Phase 2 total** | | **Medium–High (4–6 sessions)** |

---

## Phase 3 — Service Requests & Work Orders

### What gets built
- Creates, tracks, and closes maintenance/repair/cleaning/inspection requests per unit
- Owner approval gate when estimated cost > 0 (work cannot start without approval)
- Before/after photos and invoice upload per request
- Status timeline (event log) — mirrors existing incident audit log pattern
- Owner notified at every status change
- Service request can be linked to an existing community incident

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| `service_requests` + `service_request_events` tables + migration | `schema.sql` | Low |
| Service request CRUD API (create, update status, assign) | `server.js` | Medium |
| Owner approval endpoint + block-on-cost logic | `server.js` | Medium |
| File upload endpoints (photos, invoices) via Supabase Storage | `server.js` | Medium |
| Service request creation form (multi-step: type → details → assign → submit) | `App.jsx` | High |
| Status timeline display (reuse incident audit log UI pattern) | `App.jsx` | Low |
| Owner approval UI (approve / reject with comment) | `App.jsx` | Low |
| Photo upload UI (before/after) | `App.jsx` | Low |
| Invoice upload + display | `App.jsx` | Low |
| Incident ↔ service request link UI | `App.jsx`, `server.js` | Low |
| Owner notification emails per status change | `server.js` | Low |
| **Phase 3 total** | | **Very High (8–12 sessions)** |

---

## Phase 4 — Scheduling & Owner Blocks

### What gets built
- Owner requests date blocks (personal use, family, maintenance) directly in platform
- Operator confirms and coordinates cleaning/preparation
- Conflict detection: block vs. scheduled service request

**Constraint:** Without Airbnb API or iCal feed, booking data must be manually entered. Conflict detection is limited to platform-known events only until a booking data source is connected.

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| `unit_date_blocks` table + migration | `schema.sql` | Trivial |
| Date block CRUD API | `server.js` | Low |
| Operator confirmation flow | `server.js`, `App.jsx` | Low |
| Date range conflict detection (blocks vs. service requests) | `server.js` | Medium |
| Calendar view per unit (week/month grid — new UI component) | `App.jsx` | High |
| Booking data manual entry (interim until iCal/API) | `server.js`, `App.jsx` | Medium |
| **Phase 4 total** | | **High (5–7 sessions)** |

---

## Phase 5 — Pricing Log & Bidirectional Confirmation Workflow

### What gets built
- Structured pricing record per unit: base rate, weekend rate, active discounts
- **Either party (owner or operator) can propose** base rate or peak period/schedule changes
- **The other party must confirm before any change takes effect** — no unilateral updates
- Counter-proposal support: recipient can propose an alternative instead of accept/reject
- Proposal expiry: proposal expires (or optionally auto-approves) after a configurable timeout
- Proposal withdrawal: proposer can cancel before the other party responds
- Named season rules: peak periods with date range, multiplier, min-stay — require same bidirectional confirmation
- Immutable decision log: every proposal, counter, confirmation, rejection, and withdrawal recorded with timestamp and actor
- "Applied to Airbnb" confirmation step after a change is confirmed (manual checkbox until API sync is built)

### States a pricing proposal moves through
```
Draft → Proposed → [Counter-proposed →] Confirmed | Rejected | Expired | Withdrawn
                                                         ↓
                                               Applied to platform ✓
```

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| `unit_pricing` (current live rates) + `pricing_proposals` + `pricing_decisions` (append-only) tables | `schema.sql` | Low |
| Current pricing record CRUD API | `server.js` | Low |
| Proposal creation endpoint (owner or operator, base rate or peak period) | `server.js` | Medium |
| Counter-proposal endpoint | `server.js` | Low |
| Confirm / reject / withdraw / expire endpoints | `server.js` | Medium |
| Proposal apply-to-platform confirmation step | `server.js`, `App.jsx` | Low |
| Immutable decision log (append-only, no deletes) | `server.js` | Low |
| Season / peak period CRUD with same proposal flow | `server.js`, `App.jsx` | Medium |
| Pricing UI: current rates + open proposals + history timeline | `App.jsx` | High |
| Email notification to other party on proposal / counter / confirm / reject | `server.js` | Low |
| In-app badge on pending proposals (owner view + operator view) | `App.jsx` | Low |
| **Phase 5 total** | | **High (6–8 sessions)** |

---

## Phase 6 — Documents & Compliance

### What gets built
- Document folder per unit: RNT, utilities, insurance, Airbnb assets
- Invoices from service requests auto-archived per unit
- Quarterly auto-generated summary (occupancy + service costs)

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| `unit_documents` table + Supabase Storage bucket policy | `schema.sql`, `server.js` | Low |
| Document upload/download/delete API | `server.js` | Low |
| Document folder UI per unit | `App.jsx` | Low |
| Auto-archive invoice on service request close | `server.js` | Trivial |
| Quarterly summary aggregate query + JSON/CSV export | `server.js` | Medium |
| **Phase 6 total** | | **Medium (3–4 sessions)** |

---

## Phase 7 — Staff Task Management

### What gets built
- Staff-scoped mobile view: daily assignment list across all communities
- Staff updates task status: Arrived / In Progress / Done + photo
- Operator real-time overview of team status
- New staff see full unit history from day one (read-only)

### Claude implementation breakdown

| Task | Files touched | Claude effort |
|---|---|---|
| Staff-scoped auth context (limit data to assigned units) | `server.js` | Medium |
| Staff task list API (today's assignments, cross-community) | `server.js` | Low |
| Staff mobile task view (new role-scoped UI) | `App.jsx` | Medium |
| Task status update + photo (reuse Phase 3 upload pattern) | `server.js`, `App.jsx` | Low |
| Operator real-time team overview (polling every 30s) | `App.jsx` | Low |
| **Phase 7 total** | | **Medium (3–5 sessions)** |

---

## Full Summary — Claude Implementation Effort

| Phase | Core feature | Claude effort | Est. sessions |
|---|---|---|---|
| 0 | Login split, role switch, operator role, owner opt-out | Medium | 3–5 |
| 1 | Operator identity + unit linking | High | 5–8 |
| 2 | Operator multi-community dashboard | Medium–High | 4–6 |
| 3 | Service requests + work orders | Very High | 8–12 |
| 4 | Scheduling + owner blocks | High | 5–7 |
| 5 | Pricing log + bidirectional confirmation | High | 6–8 |
| 6 | Documents + compliance | Medium | 3–4 |
| 7 | Staff task management | Medium | 3–5 |
| **Total** | | | **37–55 sessions** |

**Prototype (Phases 0–2):** ~12–19 sessions — enough to validate both user paths, the linking flow, and the operator dashboard before investing in Phases 3–7.

---

## Remaining Open Questions

> Questions 1–4 resolved above. Remaining items before prototype build:

| # | Question | Impact if unresolved |
|---|---|---|
| 5 | **Opt-out visibility** — can community admin see who has opted out, or are opted-out units simply invisible? | Changes admin UI and audit behavior |
| 6 | **Operator onboarding next step** — after first unit link is accepted, what guided action does the operator see? | Affects Phase 2 activation rate |
| 7 | **Airbnb booking data source** — manual entry, iCal import, or API? | Determines Phase 4 scope and conflict detection accuracy |
| 8 | **Supabase Storage** — already provisioned with bucket policies, or needs setup? | Blocks Phase 3 and 6 file uploads |
| 9 | **Staff individual logins** — staff log in with their own Google account, or operator shares a PIN-per-person system? | Changes Phase 7 auth architecture significantly |
| 10 | **Pilot community/operator** — who is the first real user? | Every Phase 0–2 design decision should be validated against their specific setup |

---

*Start with Phase 0. Each phase should be fully functional and in production before the next begins.*
