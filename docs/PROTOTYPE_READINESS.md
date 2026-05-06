# Prototype Readiness Summary
# KAI Operator Portal

> Reference document — May 2026  
> Companion to: `OPERATOR_PORTAL_PROPOSAL.md`, `GTM_AND_PRICING.md`

---

## Effort Estimate Key

| Label | Dev Time (with Claude Code) | Approx Cost* |
|---|---|---|
| XS | 1–2 days | $50–150 |
| S | 3–5 days | $150–400 |
| M | 1–2 weeks | $400–1,200 |
| L | 2–4 weeks | $1,200–2,800 |
| XL | 4–8 weeks | $2,800–6,000 |

*Assumes Claude Code usage + light QA. Does not include infrastructure, Supabase, email/SMS costs, or product/design time.

---

## Phase 0 — Login Path Split & Onboarding Redesign

**New (from clarification):** The login screen must present two explicit paths before authentication. Each path has its own branded mission screen and distinct post-login destination.

### What this means

**Path A — Owner login:**
- User selects "I'm an Owner"
- Sees the existing mission/welcome screen (community branding, mission text)
- Signs in with Google → lands on My Units

**Path B — Operator login:**
- User selects "I'm an Operator"
- Sees an operator-focused mission screen: "Manage your units across all communities — service requests, pricing, your team, all in one place"
- Signs in with Google → lands on the Operator Dashboard (multi-community view)

**Path selection:**
- Stored in `localStorage` as `kai_user_type` (`owner` | `operator`) — persists across sessions
- User can change it from their profile
- If a user is both an owner and an operator (they exist), the profile lets them toggle which view to default to

### Owner Opt-In / Opt-Out of Community Incident Management

**New (from clarification):** When an owner joins a community (or at any time after), they can choose whether their units participate in the community incident management system. This is a per-community setting, toggleable from their profile.

**Opt-out means:**
- Their units do not appear in the community-wide incident view for admins
- No incidents can be reported against or assigned to their units from the community system
- They still have full access to My Units, their own historical data, and the Operator Portal if applicable
- The toggle is per-community — an owner can be opted-in for Community A and opted-out for Community B

**DB change:** `app_users` table gets a `community_incident_opt_out` JSON column (or a join table `user_community_prefs` with `community_id`, `uid`, `incident_opt_out boolean`). The join table is cleaner and more scalable.

**Server change:** All incident queries that scope by community must filter out opted-out owners' unit IDs.

**UI change:** Profile view gets a "Community Participation" section listing each community the user belongs to, with a toggle per community.

### Phase 0 Effort

| Component | Effort | Notes |
|---|---|---|
| Login path selector UI (Owner / Operator cards) | XS | Two styled cards before Google sign-in button |
| Operator mission screen | XS | New variant of the existing welcome-card |
| `kai_user_type` persistence + profile toggle | XS | localStorage + one profile UI field |
| `user_community_prefs` table + migration | XS | Simple join table |
| Owner opt-out toggle in profile UI | S | Per-community list with toggle switches |
| Server: filter opted-out units from incident queries | S | Add to `getUserRole` context or per-query filter |
| **Phase 0 Total** | **S–M** | **3–6 days** |

---

## Phase 1 — Operator Identity & Unit Linking

**What it builds:**
- Operator registers a business profile (name, logo, contact, communities they work in)
- Operator staff roster (name, role, email, WhatsApp)
- Unit linking: operator proposes → owner accepts (or owner invites → operator accepts)
- Unit profile maintained by operator: amenities, bed config, Airbnb URL, access notes
- Status indicators per unit: No operator / Pending / Actively managed

**DB changes:** `operators` table, `operator_staff` table, `unit_operator_links` table (with status field), extension of `listings` for operator-maintained fields.

**Key dependency:** Phase 0 must be complete (login path split defines who sees what after auth).

| Component | Effort | Notes |
|---|---|---|
| Operator profile CRUD + UI | S | Similar to existing admin community CRUD |
| Staff roster management | S | Simple list with roles |
| Propose/accept/decline linking flow | M | Two-sided flow with notifications; edge cases (unit already linked, pending invite) |
| Unit profile fields (operator-maintained) | S | Extend existing listings table + form |
| Status indicators (owner view + operator view) | XS | Derived from link status |
| Email notifications for link events | S | Reuse existing Resend/email template system |
| **Phase 1 Total** | **L** | **2–3 weeks** |

---

## Phase 2 — Operator Dashboard (Multi-Community View)

**What it builds:**
- Post-login destination for operators: all their linked units across all communities in one view
- Units requiring attention (pending approvals, open incidents) surface first
- Community filter as secondary
- Staff daily assignment view (what's on my list today, across all communities)

**Key dependency:** Phase 1 (unit links must exist to populate the dashboard).

| Component | Effort | Notes |
|---|---|---|
| Operator dashboard layout + unit cards | M | New view; reuses incident/listing card patterns |
| Cross-community unit aggregation API endpoint | S | Query `unit_operator_links` + join listings + incidents |
| Attention-first sorting logic | XS | Sort by open incidents + pending approvals |
| Staff daily view (operator's team) | S | Filter assignments by date + assignee |
| Mobile-responsive layout | S | Existing CSS patterns apply; needs testing |
| **Phase 2 Total** | **M** | **1–2 weeks** |

---

## Phase 3 — Service Requests & Work Orders

**What it builds:**
- Replaces WhatsApp maintenance/repair/cleaning threads
- Request types: Maintenance, Repair, Cleaning, Inspection, Regulatory, Other
- Workflow: Created → Submitted → Owner Approval (if cost > 0) → Assigned → In Progress → Completed → Closed
- Before/after photos, invoice upload, owner notification at each step
- Link service request to a community incident

**This is the highest daily-use phase — the core habit driver.**

**DB changes:** `service_requests` table, `service_request_events` timeline table, file storage for photos/invoices (Supabase Storage).

| Component | Effort | Notes |
|---|---|---|
| Service request CRUD + form | M | Multi-step form with type, cost estimate, assignment |
| Owner approval flow (notification + approve/reject) | M | Email + in-app; must block work start if cost > 0 |
| File upload (before/after photos, invoices) | S | Supabase Storage; reuse any existing upload patterns |
| Status timeline (event log per request) | S | Similar to existing incident audit log |
| Incident ↔ service request linking | S | Foreign key + UI to link/unlink |
| Owner notification emails per status change | S | Extend existing email template system |
| **Phase 3 Total** | **L–XL** | **3–5 weeks** |

---

## Phase 4 — Scheduling & Owner Blocks

**What it builds:**
- Owner requests date blocks (personal use, family, maintenance) from the platform
- Operator confirms and schedules cleaning/preparation
- Conflict detection (block vs. existing booking or scheduled service)

**Note:** Without Airbnb API access, "existing booking" data must be manually entered or imported. This is a significant constraint worth resolving before building.

| Component | Effort | Notes |
|---|---|---|
| Date block CRUD (owner) | S | Simple date range input + reason |
| Operator confirmation flow | S | Accept/propose alternative dates |
| Calendar view per unit | M | New component; no calendar library currently in stack |
| Conflict detection logic | S | Date range overlap check on service requests + blocks |
| **Phase 4 Total** | **M–L** | **2–3 weeks** |
| **Blocker:** | | Airbnb booking data source TBD |

---

## Phase 5 — Pricing Log & Approval Workflow

**What it builds:**
- Structured pricing record per unit: base rate, weekend rate, seasons, discounts
- Change proposal workflow: either party proposes, other approves or counter-proposes
- Immutable decision log: who proposed, who approved, when, before/after amounts
- Season rules with date ranges and price multipliers

| Component | Effort | Notes |
|---|---|---|
| Pricing record schema + CRUD | S | New table with version history |
| Proposal / counter-proposal flow | M | Two-sided async approval; similar to service request approval |
| Immutable audit log (append-only) | S | Trigger or append-only insert pattern |
| Season rules UI | S | Named date ranges with multiplier |
| **Phase 5 Total** | **M–L** | **2–3 weeks** |

---

## Phase 6 — Documents & Compliance

**What it builds:**
- Unit document folder: RNT, utilities, insurance, Airbnb listing assets
- Invoices from service requests auto-archived per unit
- Quarterly auto-generated summary (occupancy + service costs)
- Eliminates credential sharing in group chats

| Component | Effort | Notes |
|---|---|---|
| Document upload/folder UI per unit | S | Supabase Storage + metadata table |
| Auto-archive invoices from Phase 3 | XS | Side effect of service request close |
| Quarterly summary generation | M | Aggregate query + PDF or structured export |
| **Phase 6 Total** | **M** | **1–2 weeks** |

---

## Phase 7 — Staff Task Management

**What it builds:**
- Staff mobile view: daily assignment list across all communities
- Status updates by staff: Arrived / In Progress / Done + photo
- Operator real-time view of what's complete and pending
- New staff see full unit history from day one

| Component | Effort | Notes |
|---|---|---|
| Staff-facing mobile task list | M | New role-scoped view; mobile-first layout |
| Status update flow (with photo) | S | Subset of service request event logging |
| Operator real-time overview | S | Polling or Supabase real-time subscription |
| Unit history visibility for new staff | XS | Already exists; just scope permissions |
| **Phase 7 Total** | **M** | **1–2 weeks** |

---

## Full Phase Summary

| Phase | Core feature | Effort | Est. weeks | Cumulative |
|---|---|---|---|---|
| 0 | Login path split + owner opt-out | S–M | 1 | 1 |
| 1 | Operator identity + unit linking | L | 2–3 | 3–4 |
| 2 | Operator multi-community dashboard | M | 1–2 | 4–6 |
| 3 | Service requests + work orders | L–XL | 3–5 | 7–11 |
| 4 | Scheduling + owner blocks | M–L | 2–3 | 9–14 |
| 5 | Pricing log + approval workflow | M–L | 2–3 | 11–17 |
| 6 | Documents + compliance | M | 1–2 | 12–19 |
| 7 | Staff task management | M | 1–2 | 13–21 |

**Recommended prototype scope: Phases 0, 1, 2** — establishes the two user paths, linking, and the operator dashboard. Gives both sides something real to react to with minimal infrastructure investment.

---

## Outstanding Questions Before Building the Prototype

### Product / UX

1. **Owner who is also an operator** — if someone owns 2 units and also manages 10 units for others, do they get one login with a role switch, or two separate accounts? The profile toggle handles this but needs a decision on default behavior.

2. **Operator staff accounts** — do staff members log in with their own Google account (full identity), or does the operator share a single account with a PIN for each staff member? Full individual accounts are more secure but increase friction.

3. **Opt-out visibility** — if an owner opts out of community incident management, should the community admin be able to see that they've opted out, or should it be invisible (units simply don't appear)?

4. **Operator onboarding trigger** — after a unit link is accepted, what is the operator's first guided action? A structured "next step" banner drives activation.

5. **WhatsApp notifications** — is email sufficient for the prototype, or do key events (owner approval requests, incident alerts) need WhatsApp delivery from day one?

### Technical

6. **Airbnb booking data** — Phase 4 (scheduling) assumes booking data is available for conflict detection. Is this manually entered by the operator, scraped via iCal export, or integrated via Airbnb API? This determines Phase 4 complexity significantly.

7. **Supabase Storage** — photo and invoice uploads in Phase 3 require Supabase Storage to be enabled and bucket policies configured. Is this already set up, or does it need to be provisioned?

8. **Real-time vs. polling** — the operator dashboard and staff task view could use Supabase real-time subscriptions or simple polling. Real-time adds complexity; polling every 30s may be sufficient for the prototype.

9. **PDF generation** — the quarterly summary in Phase 6 requires either a server-side PDF library or a third-party service. Worth deciding before Phase 6 begins.

### Business / GTM

10. **Operator pays vs. community pays** — does the operator subscribe independently (Operator Pro plan), or does the community admin enable the Operator Portal as an add-on to their community plan? This affects which screens appear and who gets the payment link.

11. **Pilot community** — which specific community or operator will be the first prototype user? Having a named pilot user changes every design decision (their unit count, staff size, current pain points).

12. **Language default** — operator path: default to English or Spanish? Owner path continues bilingual. Operators in Cartagena are predominantly Spanish-speaking, but this may shift in other markets.

---

*Resolve questions 1, 5, 10, and 11 before writing a single line of prototype code. The others can be decided during build.*
