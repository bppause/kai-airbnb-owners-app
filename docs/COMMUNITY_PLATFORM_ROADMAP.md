# Community Management Platform — Conceptual Roadmap

> Strategy document — May 2026
> Companions: `OPERATOR_PORTAL_PROPOSAL.md`, `OPERATOR_PORTAL_DESIGN.md`,
> `PROTOTYPE_READINESS.md`, `USE_CASE_DISCOVERY.md`, `GTM_AND_PRICING.md`

---

## 1. Why this document exists

The product started as a single-purpose tool: structured **incident reporting**
between owners and a community admin in Morros KAI / Serena del Mar. Two things
have happened since:

1. The discovery work for the **Operator Portal** — grounded in a real 7-month
   WhatsApp transcript between owners (Brian and Martha Pause) and operator
   (Luxury Rentals / Oscar Lindo) for unit Morros KAI 317 — showed that the
   same data model (units, owners, incidents, audit trail, role-based
   permissions) is the spine of a much larger product: the WhatsApp-replacement
   layer for day-to-day STR operations.
2. Conversations with owners, operators and the building's community admin
   surfaced needs that go well beyond incidents and operator coordination:
   amenity bookings, package handling, fees and fines, tourism-board reporting,
   resident directory, etc.

This roadmap stitches all of that into one product picture. It does **not**
prescribe build order beyond H1; later horizons are intentionally directional
so they can be re-prioritised as we learn from the pilot.

---

## 2. North star

> **KAI is the relationship management layer between operators (hosts), owners
> (co-hosts), and the buildings their units sit in.** Airbnb (and other listing
> platforms) remain the source of truth for bookings, guest data, and money.
> KAI owns everything else: typed requests, approvals, audits, expenses,
> documents, devices, building context.

Three product promises follow:

- **Visibility over control.** Owners and admins want to *see* what is
  happening before they want to *do* anything. (`USE_CASE_DISCOVERY.md` § 5
  finds owners asked for visibility ~5× and were denied; a read-only dashboard
  would resolve ~60% of follow-up volume.)
- **Approval gates, not courtesies.** Significant cost or change requires
  explicit acceptance, not a 1am WhatsApp heads-up.
- **Permanent record.** Decisions, invoices, photos, and credentials live in
  the platform — not in a chat group that disappears with staff turnover.

### Scope boundary (locked)

KAI **does not** replicate or replace what listing platforms already do:

| Out of scope (Airbnb / OTA owns) | In scope (KAI owns) |
|---|---|
| Guest profiles, booking & stay data | Typed requests tied to a stay (repair, block, damage) |
| Payout calculation, splits, remittances | Repair approvals, invoice ledger, expense tracking |
| Calendar sync & booking confirmation | Owner-initiated calendar blocks; building-driven blocks |
| Guest messaging (Airbnb inbox) | Operator → Owner notifications when guest action is needed |
| Cleaning fee charged to guest (line item) | Non-guest cleaning costs (deep clean, owner visit prep) |
| AirCover claim filing | Damage case tracking + the photo log AirCover requires |
| Review publishing | Review visibility and draft-approval workflow |

**Rule of thumb:** if it lives natively in Airbnb's host UI, KAI does not
duplicate it. We capture the *relationship* events around it.

---

## 3. Design principles from real-chat findings

Seven behavioural findings from `USE_CASE_DISCOVERY.md` directly drive the
product. They are not abstract values; they are constraints on every screen.

1. **Owners are engaged, not passive.** Brian built an AI pricing tool; Martha
   tracks compliance. Treat owners as power users, not clients.
2. **Follow-up burden falls entirely on owners today.** Every open loop must be
   visible to both parties with an aging timer; closure requires the
   responsible party to confirm.
3. **Operator acts first, informs later.** Approval gates are *enforced*, not
   courtesy. No work above threshold starts without owner confirmation.
4. **Zero credentials or financial details in chat.** Bank accounts (Bancolombia,
   Nequi handles) and RNT logins appeared in plain text. KAI ships an
   encrypted vault and a structured expense flow; chat is for context only.
5. **Owners want visibility, not total control.** A read-only owner dashboard
   covers most of the friction. Direct edit rights are not the goal.
6. **Trust erodes through small repeated failures.** A Yale lock battery took
   10 days and 6 follow-ups. Aging timers and SLA escalation prevent this from
   accumulating.
7. **Team rosters are opaque to owners.** Owners must see a named team
   directory with roles for every unit they own.

---

## 4. Where we are today (baseline)

| Capability | State | Notes |
|---|---|---|
| Incident workflow `Open → Owner Verification → Resolved` | **Production** | `server.js`, `client/src/App.jsx` |
| Listings as source of truth for ownership | **Production** | Pending / approved / declined |
| Registration approval workflow | **Production** | First-time owner gate |
| Roles: `global_admin`, `delegate_admin`, `user` | **Production** | `getUserRole()` in `server.js` |
| Configurable delegate permissions | **Production** | `app_config.default_delegate_permissions` + per-user JSON |
| Smart notifications (in-app + email) | **Production** | Resend; SLA timers; escalation reminders |
| Bilingual UI (es-CO default, en) | **Production** | Inline strings in `App.jsx` |
| Audit logs | **Production** | `audit_logs` table |
| Email templates (DB-overridable) | **Production** | `email_templates` table |
| `operator` role + portal | **Designed, not built** | `PROTOTYPE_READINESS.md` Phase 0 |
| Login path split (Owner vs Operator) | **Designed, not built** | Phase 0 |
| Listing Management Contract (terms + amendments) | **Designed, not built** | `USE_CASE_DISCOVERY.md` § Listing Management Contract |
| Multi-owner model (Payout / Calendar Owner) | **Designed, not built** | `USE_CASE_DISCOVERY.md` § Platform & Role Model |
| Typed-request inbox (WhatsApp replacement) | **Designed, not built** | `USE_CASE_DISCOVERY.md` § Request Type Taxonomy |
| Bidirectional pricing proposals | **Designed, not built** | Phase 5 |
| Per-stay inspection photo log | **Designed, not built** | AirCover prerequisite |
| Two-path damage workflow (AirCover vs owner insurance) | **Designed, not built** | Phase 3 |
| Service requests / work orders | **Designed, not built** | Phase 3 |
| Anything below in §7 "H2/H3" | **Not yet designed** | This document is the first sketch |

Key technical facts that constrain the roadmap:

- Single-tenant deployment per building today. Multi-building tenancy and
  multi-property operators are the H1 architectural step, not a config tweak.
- Backend is one large `server.js`; frontend is one large `App.jsx`. Either we
  decompose deliberately as we add modules, or future work gets harder
  super-linearly.
- Database is Supabase. No local fallback. Migrations are applied manually via
  `supabase/schema.sql`.
- Auth is Firebase (Google only). Adding any persona that isn't a Gmail-using
  owner (guards, vendors, guests, individual team members) means widening the
  auth story.

---

## 5. Operating model: typed requests + unified attention inbox

This is the actual product, distinct from the module catalog in §6. Every
WhatsApp message that requires action becomes a **typed, trackable request**
with a defined initiator, recipients, SLA, and resolution path. Both operator
and owner see one shared concept: *"What needs me right now?"*

### Request type families (full taxonomy in `USE_CASE_DISCOVERY.md`)

- **Operator → Owner(s).** Repair approval, repair FYI, guest issue, booking
  relay, special-request approval, pricing proposal, peak-period proposal,
  damage (two paths), non-guest cleaning, utility bill, general update.
- **Owner → Operator.** Task request, calendar block, pricing proposal,
  listing-change request, document request, general question.
- **Operator → Team (internal).** Cleaning, repair, inspection, access-code
  change, building-notice relay.
- **System-generated.** AirCover window prompt (12 days post-checkout),
  Superhost risk prompt, scheduled rate-change activation.

### SLA tiers (default — overridable per unit/community)

| Tier | Examples | Response | Overdue action |
|---|---|---|---|
| Critical | Guest lockout, guest safety | 1h | Alert owner if operator silent |
| Urgent | AC/hot water, AirCover window, special request | 2–4h | Reminder at 50%, badge red |
| Standard | Repair approval, task request | 24h | Reminder at 12h |
| Async | Pricing / peak / listing change | 48h | Reminder at 24h; expires at 48h |
| Monthly | Utility bill | 5d | Reminder at 3d |
| FYI | Booking notification | None | Auto-archive 7d |

### Visibility rules (multi-owner aware)

- **Payout Owner** — sees everything; has approval rights on financial items.
- **Calendar Owner** — sees calendar items and all request threads; financial
  amounts hidden ("—").
- **All owners** — can post replies in any thread for their unit.
- **Team** — sees only their assignments; never sees repair cost amounts (per
  `USE_CASE_DISCOVERY.md` open question NOTIFY-2 default).

### What the inbox replaces

| Field | Replaces |
|---|---|
| Type | Topic buried in the message |
| Owner | "Ball in your court" clarity |
| Status | Open → In Progress → Awaiting Response → Resolved |
| SLA timer | Aging visibility, yellow/red escalation |
| Thread | Follow-ups stay attached, not lost in the group |
| Visibility | Right people only, instead of "everyone in the WhatsApp" |

This is the foundation. Everything in §6 below — pricing, calendar, contracts,
documents, building notices — is a **typed request that flows through this
inbox**. Build the inbox first; everything else layers on it.

---

## 6. Personas

| Persona | Primary jobs-to-be-done | Today | Roadmap horizon |
|---|---|---|---|
| **Payout Owner** (one per unit) | Approve cost/price, file & verify incidents, block dates, see everything | H0 (incidents only) | H1 portfolio view |
| **Calendar Owner** (zero+ per unit) | See calendar, participate in threads, request tasks; financials hidden | Not modelled | H1 |
| **Operator / co-host** | Manage all units across communities, dispatch staff, get owner approvals, close loops | Designed | H1 |
| **Operator's team** (cleaning, supervision, logistics, guest support) | Daily task list across communities, mark done with photo | Designed | H1 (Phase 7) |
| **Community / building admin** (delegate or global) | Triage incidents, enforce STR rules, comms, fees, amenities | H0 (incidents) | H2 |
| **Guard / front desk** | Visitor & package logging, amenity check-in, panic | Not in scope | H2 |
| **Vendor / contractor** | Receive a work order, schedule access, upload invoice | Not in scope | H2 (read-only invite first) |
| **Guest** | Surfaces in KAI only as an *impact* (lockout, AC down) — not as a directly served persona | Not modelled | H3 (limited: pre-arrival check-in, building rules) |
| **Authority / tourism board** | Receive structured reporting (RNT, SIRE, occupancy, tax) | Not in scope | H3 |

The role model needs to grow from 3 (`global_admin`, `delegate_admin`, `user`)
to ~7, plus per-unit owner subtypes (Payout / Calendar). Plan it once
(see §9) instead of re-doing the permissions layer each time we add a persona.

---

## 7. Module map

Modules are grouped by *what problem they solve*, not by who uses them. Most
modules render different views per persona using the same record.

### 7.1 Operating layer (the WhatsApp replacement itself)

| Module | Problem it solves | Status |
|---|---|---|
| Typed Request Inbox | Every action item has a type, status, SLA, thread | Designed |
| Unified Attention Feed | "What needs me now?" view per persona | Designed |
| SLA & Escalation Engine | Aging timers, yellow/red, auto-reminders, expiry | Partial (incident SLAs live) |
| Audit Trail | Every write logged; standard helper across modules | **Live** for incidents |
| Notifications (in-app + email) | Right person, right urgency | **Live** |
| Multilingual support (es-CO + en) | All UI, comms, templates | **Live (UI)** — extends to docs/comms |

### 7.2 Operator–Owner Governance

| Module | Problem it solves | Status |
|---|---|---|
| Operator Identity & Unit Linking | Who manages which unit, owner-accepted, one operator per unit | Designed |
| **Listing Management Contract** | Locked terms (fee, threshold, services, notice period); propose / counter / amend / terminate | **Designed (locked concept)** |
| Multi-Owner Roster (Payout + Calendar) | Multiple co-hosts per unit with differing access levels | Designed |
| Operator Multi-Community Console | One view of all units across buildings | Designed |
| Owner Read-Only Dashboard | Listing state, pricing schedule, ranking context, review history | Designed |
| Operator Team Roster (visible to owners) | Named directory with roles per unit | Designed |
| Bidirectional Pricing | Either party proposes; the other confirms / counters / rejects; immutable log | Designed |
| Pricing-with-Ranking-Preview | Show estimated Airbnb position before confirming | Designed |
| Scheduled / Annual Rate Changes | Future-dated rate that auto-applies | Designed |
| Discount Structure (last-minute, early-bird, weekly, monthly) | Per-unit discount rules with proposal flow | Designed |
| Owner Calendar / Personal Use Blocks | Distinct from guest bookings; auto-schedules cleaning | Designed |
| Listing-Change Requests + Version History | Title, description, photos, rules, amenities — bidirectional flow | Designed |
| Review Dashboard with Draft Approval | Owner sees draft response before publish | Designed |
| Guest Block List (per unit) | Owner can request operator block a specific guest | Designed |
| Operator Scorecard | Incidents, complaints, response time per operator | Future |
| Listing / Branding Compliance | Approved photos, naming, building rules | Future |

### 7.3 Service Operations

| Module | Problem it solves | Status |
|---|---|---|
| Service Requests / Work Orders | Maintenance · Repair · Cleaning · Inspection · Trámite · Other | Designed |
| Approval Threshold Engine | Auto-approve below contract threshold; gate above | Designed |
| Per-Stay Inspection Photo Log | Required baseline for AirCover; distinguishes guest vs non-guest damage | Designed |
| **Two-Path Damage Workflow** | Guest → AirCover (operator files); Non-guest → owner insurance (KAI documents) | Designed |
| Non-Guest Cleaning (expense flow) | Deep clean, owner-visit prep, post-renovation | Designed |
| Device / IoT Management | Per-device instructions (Yale lock, AC, appliances), escalation, photo proof | Designed |
| Recurring Maintenance Schedules | AC filter, water heater flush, deep clean | Designed (future phase) |
| Vendor & Contractor Management | Approved list, COIs, ratings, access windows | Future |
| Building Notice Ingestion | Owner/admin uploads; operator must ack; if guest-impacting prompts action | Designed |
| Lost & Found | Logging + return workflow | Future |
| Asset & Inventory Register | Appliances, warranties, lifecycle | Future |

### 7.4 Documents, Credentials & Compliance

| Module | Problem it solves | Status |
|---|---|---|
| **Credential Vault (per unit)** | RNT, TRA, warranties, manuals — encrypted, access-controlled | Designed |
| Document Vault (per unit) | Utility bills, invoices, insurance policies, listing assets | Designed |
| Expense Submission Ledger | Repair invoices + utility bills with no bank details in chat | Designed |
| HOA Document Library | Bylaws, policies, contracts, permits | Future |
| Insurance & Claims | Policy registry, COIs, two-path damage hand-off | Partial (damage workflow designed) |
| Licensing & Permits | RNT / STR registration with renewal reminders | Future (H3) |
| Tourism Authority Reporting | SIRE / Migración Colombia / occupancy stats | Future (H3) |
| Tourism Tax & Levies | Calc, collect, remit (national + municipal) | Future (H3) |
| Data Privacy & Consent | Habeas Data (Colombia), retention policy | Future |

### 7.5 Building / Community Layer

| Module | Problem it solves | Status |
|---|---|---|
| Incident Management (community) | Structured triage of community incidents | **Live** |
| Resident & Owner Directory | Unit ↔ resident graph, emergency contacts | Future |
| Visitor & Guest Registration | Pre-register guests/vendors/deliveries | Future |
| Access & Security | Smart locks, gate codes, guard approvals | Future |
| Package & Delivery | Receive, photograph, notify, confirm pickup | Future |
| Parking & Vehicle | Owner vehicles, visitor spots, violations | Future |
| Amenity Reservations | Pool, BBQ, gym, meeting room | Future |
| Rules & Compliance Center (building) | STR caps per unit, quiet hours, pet rules, fines | Future |
| HOA Fees / Fines / Deposits | Billing, dunning, payment tracking | Future |
| Announcements / Polls / Minutes | Comms hub for board → residents | Future |
| Emergency Response | Fire/flood/medical playbooks | Future |

### 7.6 Insight & AI

| Module | Problem it solves | Status |
|---|---|---|
| Admin Dashboard / Reporting | KPIs: open incidents, repeat offenders, SLA | Partial |
| Owner Read-Only Dashboard | Listing state, pricing, ranking, review history | Designed |
| Operator Scorecard | Quantitative trust signal across operators | Future |
| Anomaly Detection | Utility bill > X% of rolling avg; conflated damage cases | Future |
| Pricing-with-Ranking-Preview | Estimated Airbnb position before confirming | Designed |
| AI Triage / Drafting / Translation | Reduce admin & operator workload | Future |
| Risk & Reputation Monitoring | Reputation-impacting incidents | Future |

### 7.7 Explicitly out of scope (do not build)

These are tempting modules that the locked scope boundary excludes:

- Owner Statements & Payouts, Tax Pack, Revenue Splits — Airbnb owns payouts.
- Channel Manager (publishing to Airbnb / VRBO / Booking) — out of scope.
- Unified Guest Inbox / AI guest replies — Airbnb's inbox.
- Dynamic pricing engine — KAI surfaces ranking impact, doesn't price.
- Guest profiles / KYC — owned by Airbnb.
- AirCover claim filing — happens on Airbnb; KAI prepares the package.

---

## 8. Horizons

Horizons are *thematic*, not strict quarter boundaries. Each one has an exit
condition; we don't move on until it's met.

### H0 — Today (delivered)

**Theme:** Community incident management as the trust anchor between owners
and the building admin.

Exit condition (already met): owners submit & verify incidents; admins
resolve & escalate with SLA tracking; audit + email working in production;
bilingual UI live.

### H1 — Operator–Owner Relationship Layer (next)

**Theme:** Replace the WhatsApp group as the canonical channel between
operator, owners, and team for a unit. **Build the inbox core first;
everything else layers on it** (`USE_CASE_DISCOVERY.md` closing line).

**Scope, in build order:**

1. **Phase 0** — Login path split (Owner vs Operator), `operator` role,
   per-community owner opt-out.
2. **Phase 1** — Operator identity, unit linking, **multi-owner roster**
   (Payout / Calendar), team directory visible to owners. Co-host /
   platform-access tracking.
3. **Phase 2** — Operator multi-community console + owner read-only
   dashboard.
4. **Phase 3 (the core)** — Typed-request inbox: service requests, repair
   approval gate, **per-stay inspection photo log**, two-path damage
   workflow, device/IoT tickets, building-notice ingestion with operator
   acknowledgment, expense submission (zero bank details in chat),
   non-guest cleaning. SLA timers + escalation across all types.
5. **Phase 4** — Owner calendar blocks (personal use, distinct from guest
   rate, auto-schedules cleaning).
6. **Phase 5** — Bidirectional pricing: base/weekend/seasonal/peak;
   discounts (last-minute, early-bird, weekly, monthly); cleaning fee;
   ranking-impact preview before confirm; scheduled annual rate change.
7. **Phase 6** — Document & credential vault, utility-bill upload with
   anomaly flag, **Listing Management Contract** as a first-class record
   (proposal / amendment / termination flow that drives threshold + SLA +
   services-included).
8. **Phase 7** — Operator team task management on mobile.

**Cross-cutting in H1:**

- Listing-change request + version history.
- Review dashboard with draft approval; guest block list.
- Multilingual everything (es-CO + en).
- AirCover window prompt (system-generated 12 days post-checkout).

**Exit condition:**

- A pilot operator runs at least one unit's full cycle on the platform —
  contract → linked unit → repair-or-clean request → owner approval →
  invoice → close — with no parallel WhatsApp thread for the same item.
- Owners report they can answer "what's the status of X on my unit?"
  without asking the operator.
- The operator's team picks up their daily list on mobile.
- A guest-damage incident produces an AirCover-ready package (per-stay
  photos, description, invoice, claim reference) entirely from KAI.

**Why this first:** highest-friction daily flow, designed already, money
follows it (operator-paid model in `GTM_AND_PRICING.md`), and it forces us to
generalise the platform from "one building" to "operator's units across
buildings" — the multi-tenant precondition for everything in H2/H3.

### H2 — Building Operating System

**Theme:** The community admin's day-to-day moves into the platform too.
Visitors, packages, amenities, fees, and rules join incidents and operations.

**Indicative scope (priority order to be set after H1 pilot):**

1. **Resident & Owner Directory.** Cleans up `app_users` + `listings` into a
   proper unit ↔ resident graph, including renters and emergency contacts.
2. **Visitor & Package Management.** Replaces guard notebooks. Pre-register
   guests/vendors; package photo + pickup confirmation. First persona that
   isn't email-as-Google: guards likely need a kiosk/PIN auth.
3. **Amenity Reservations.** Pool, BBQ, gym, meeting room.
4. **Rules & Compliance Center.** STR caps per unit, quiet hours, pet rules,
   fines. Connects to Incident Management via "rule violation → incident".
5. **HOA Fees / Fines / Deposits.** Billing + dunning. First time we touch
   payments → forces the payments foundation (§9).
6. **Vendor & Contractor Management.** Approved list + COI tracking. Read-only
   vendor invites first; full vendor portal later.
7. **Announcements / Polls / Minutes.** Comms hub for board → residents.
8. **Maintenance preventive scheduling.** Recurring work-order templates as
   typed requests in the H1 inbox.
9. **Building-notice → listing-update trigger.** When admin posts a
   guest-impacting notice (pool closed during a stay), system prompts the
   operator to update the listing and message guests on Airbnb.

**Exit condition:** A delegate admin runs a normal week — incidents, visitors,
packages, amenities, fee reminders, an announcement — without touching email
or WhatsApp for any of it.

### H3 — Compliance & Regulatory Layer

**Theme:** The platform talks to authorities on the unit's behalf. Guest
appears as a *first-class subject* (for compliance) but still not as a directly
served persona — Airbnb owns guest communication.

**Indicative scope:**

1. **Guest Registration to Authorities.** SIRE / Migración Colombia for
   foreign guests. Reads from operator-entered booking relays; outputs the
   files the law requires.
2. **Tourism Registry (RNT) tracking + renewals.** Lives in the credential
   vault but with regulatory reminders.
3. **Tourism Tax / Levies.** Calc per stay; remittance reporting.
4. **Pre-Arrival Building Rules surface.** Building rules and access
   instructions packaged for operators to share with guests via Airbnb
   messaging — KAI generates, operator sends.
5. **Owner Insurance Policy Registry.** Policy details stored to enable the
   non-guest damage path; policy expiry reminders.
6. **Habeas Data compliance.** Resident & visitor PII retention; data subject
   request workflow.

**Exit condition:** A foreign guest's stay generates the SIRE report,
calculates tourism tax, and confirms RNT validity — with no manual data entry
beyond the operator's booking relay.

### H4 — Intelligence & Scale

**Theme:** The platform stops being just a system of record and starts being a
system of insight — and goes beyond one building.

**Indicative scope:**

1. **AI smart notifications & triage.** Auto-route incidents and service
   requests by type/urgency/history. Draft replies in the operator inbox.
2. **Operator Scorecard & Risk/Reputation Monitoring.** Quantitative trust
   signal across operators, used in matching and pricing.
3. **Analytics & Trends.** Repeat apartments, high-risk operators, seasonal
   issues, cost drivers per unit.
4. **Mobile apps.** Guest, owner, operator, field tech, board member —
   probably not all native; some are PWAs.
5. **Multi-building rollout beyond Morros KAI.**
6. **Open API / integrations.** Read-only owner API; PMS (Hostaway/Guesty)
   inbound; accounting (Siigo / QuickBooks) outbound; IoT (locks, sensors);
   payments.
7. **Optional Airbnb API direct push** for confirmed pricing changes (replaces
   "Applied on Airbnb ✓" manual confirmation).

---

## 9. Persona × module matrix (compact)

`●` primary  `◐` secondary / read or assist  `.` not involved
PO = Payout Owner · CO = Calendar Owner · Op = Operator · Tm = Team
Ad = Building Admin · Gd = Guard · Gs = Guest (impact only)

```
                              PO   CO   Op   Tm   Ad   Gd   Gs
Typed Request Inbox            ●    ◐    ●    ◐    ●    .    .
Listing Mgmt Contract          ●    ◐    ●    .    .    .    .
Multi-Owner Roster             ●    ◐    ◐    .    .    .    .
Operator Console               .    .    ●    ◐    .    .    .
Owner Read-Only Dashboard      ●    ◐    .    .    .    .    .
Team Directory (visible)       ●    ◐    ●    ●    .    .    .
Bidirectional Pricing          ●    ◐    ●    .    .    .    .
Owner Calendar / Blocks        ●    ◐    ◐    .    .    .    .
Listing Change Requests        ●    ◐    ●    .    .    .    .
Review Approval                ●    ◐    ●    .    .    .    .
Service Requests               ◐    ◐    ●    ●    .    .    ◐
Per-Stay Photo Log             ◐    .    ●    ●    .    .    ◐
Two-Path Damage                ●    ◐    ●    ◐    .    .    ◐
Device / IoT                   ◐    .    ●    ●    .    .    ◐
Building Notice Ingestion      ◐    ◐    ●    .    ●    ◐    .
Credential / Doc Vault         ●    ◐    ●    .    ◐    .    .
Expense Ledger                 ●    .    ●    .    .    .    .
Incident Mgmt (community)      ●    ◐    ◐    .    ●    ◐    .
Resident Directory             ◐    ◐    .    .    ●    ◐    .
Visitor & Package              .    .    ◐    .    ●    ●    ◐
Amenity Reservations           ●    ◐    .    .    ●    ◐    ◐
Rules & Compliance             ◐    ◐    ◐    .    ●    .    ◐
Fees / Fines / Deposits        ●    .    .    .    ●    .    .
Vendor Mgmt                    .    .    ◐    .    ●    .    .
Comms Hub                      ◐    ◐    ◐    .    ●    ◐    .
Tourism Reporting (SIRE/RNT)   ◐    .    ●    .    ◐    .    ◐
Tourism Tax                    ◐    .    ●    .    ◐    .    .
Operator Scorecard / AI        ●    ◐    ●    .    ●    .    .
```

---

## 10. Cross-cutting foundations

These have to be planned once, not per module. Most of them are the *real*
work behind H2 and H3 even though they're invisible on a feature list.

1. **Identity & multi-tenant RBAC.** Today: 3 roles, single building. Need:
   ~7 personas, multiple buildings, multi-property operators, **per-unit
   Payout/Calendar Owner subtypes**, owner ↔ operator role-switching. Decide
   before H2 whether to keep Firebase-Google-only or add email-link / phone /
   kiosk auth for guards & vendors.
2. **Workflow & notification engine.** Right now SLA, escalation, and email
   templating live inline in `server.js`. With H1's typed-request taxonomy
   (~25+ request types) this must become a declarative engine, not N copies.
3. **Audit trail.** `audit_logs` exists; we need to *enforce* it for every
   write across new modules. Standard helper in `server.js` so future modules
   don't skip it.
4. **Document & credential storage.** Vault for RNT/TRA/credentials (encrypted,
   access-controlled), separate document store for invoices/utility bills/
   listing assets, eventual e-sign for contracts. Pick the storage layer once
   (Supabase Storage vs. S3+CDN) before H1 Phase 6.
5. **Expense ledger (no payments yet).** H1 captures invoices and acknowledges
   payment-out-of-band. Real payments arrive first in H2 with HOA fees.
   Multi-currency from day one even if H1/H2 are COP-only.
6. **Code structure.** `server.js` and `App.jsx` are already at the limit of
   "one file is fine". Before H2 we should extract per-module route files on
   the server and per-feature folders on the client. Not a rewrite — a
   precondition to keep adding modules at speed.
7. **Mobile / PWA.** Operator team, guard, and guest all need mobile-first
   surfaces. PWA first, native only where push or offline forces it.
8. **AI layer.** Drafting, triage, translation, anomaly detection, ranking
   suggestions. Cross-cutting from H1 onward; add as a service, not module by
   module.
9. **Data privacy & retention.** Habeas Data (Colombia) for residents and
   guests; operator credential isolation. Policy doc must land before H3
   because guests bring real PII into the platform.
10. **Listing-platform integrations.** Read-only first (relayed booking
    metadata, review fetching). Direct push (rate change, calendar block) is
    H4 at earliest; until then, the "Applied on Airbnb ✓" manual confirmation
    closes every loop.

---

## 11. Decisions to lock before each horizon

Pulled from `USE_CASE_DISCOVERY.md` open-question lists. Items prefixed with a
code (e.g. **MO-1**) are quoted from that document.

### Before H1 ships

**Multi-owner model (blocks Phase 1):**

- [ ] **MO-1** — Can the 85% owner share be split among multiple Payout
      Owners? If yes, KAI needs a per-owner share field.
- [ ] **MO-2** — Can a Calendar Owner approve a financial request on behalf of
      the Payout Owner, or is approval strictly the Payout Owner's?
- [ ] **MO-3** — Who can manage the owner roster — Payout Owner only, or any
      Calendar Owner?
- [ ] **MO-4** — When a Payout Owner removes a Calendar Owner, do they lose
      access immediately? Are they notified?
- [ ] **MO-5** — Does the operator see Payout vs Calendar distinctions in
      threads, or do all owners appear identically?

**Inbox / SLA core (blocks Phase 3):**

- [ ] **D** — Does Instant Book require owner notification, or fully silent?
- [ ] **SLA-1** — On unanswered urgent guest issues, does KAI alert all owners
      or only the Payout Owner?
- [ ] **SLA-2** — Are SLA thresholds global-admin only, or owner/operator
      customizable per unit?
- [ ] **TEAM-1** — Do team members get individual logins, or does the operator
      act on their behalf? (Drives auth model expansion timing.)
- [ ] **THREAD-1** — Calendar Owner replies in an approval thread — counts as
      approval or informational only?

**Pricing (blocks Phase 5):**

- [ ] **G** — Is Airbnb Smart Pricing on/off bidirectional or operator's call?
- [ ] **I** — Are minimum-stay rule changes bidirectional or operator
      discretion?
- [ ] **PRICE-1** — On 48h proposal expiry, does it expire (safer) or
      auto-approve?

**Documents & contract (blocks Phase 6):**

- [ ] **CONTRACT-1** — One contract per unit, or one per operator-owner pair
      covering all their units together?
- [ ] **CONTRACT-2** — Multi-owner units: do all owners sign, or only Payout?
- [ ] **CONTRACT-3** — Default contract template provided, or blank form?
- [ ] **CONTRACT-4** — Is the management fee % visible to Calendar Owners?
- [ ] **CONTRACT-5** — Does an amendment to the repair threshold apply
      retroactively to open requests, or only new ones?
- [ ] Supabase Storage bucket provisioning before file uploads ship.

**Commercial / pilot:**

- [ ] Confirm `GTM_AND_PRICING.md` proposal: operator pays, off by default
      until billing is wired.
- [ ] Email-only notifications confirmed (no WhatsApp) for H1.
- [ ] Pilot building (Morros KAI 317 + 1 more unit).

### Before H2 starts

- [ ] Auth: do guards/vendors get Firebase-Google, kiosk, magic-link, or
      something else?
- [ ] Multi-building tenancy: one Supabase instance with `community_id`
      everywhere, or one project per building?
- [ ] Code structure: commit to splitting `server.js` and `App.jsx` before
      first H2 module ships.
- [ ] Payments provider for COP (Wompi? Mercado Pago? ePayco?).
- [ ] Document storage backend (Supabase Storage vs. S3 + CDN).

### Before H3 starts

- [ ] Whether KAI itself files SIRE / RNT, or just generates the file an
      operator submits.
- [ ] Tourism tax remittance — platform of record vs. report-only.
- [ ] Guest auth model if any — phone+OTP, email link, or signed URL only.
- [ ] PII retention policy (Habeas Data) finalised and reviewed by counsel.

### Inform design (not blocking)

- **F** — Final say on Airbnb host response to a negative review — operator or
  owner?
- **H** — If operator-owner relationship ends, what happens to the Airbnb
  listing?
- **NOTIFY-1** — Daily digest of FYI items, or only real-time notifications?
- **NOTIFY-2** — Are repair cost amounts ever visible to team members?

---

## 12. Risks worth naming early

- **Scope creep into Airbnb territory.** Channel manager, guest profiles, host
  inbox, payouts, dynamic pricing engines are huge products on their own and
  are *explicitly out of scope* (§2). Any feature that starts to look like
  "we are now Hostaway" should bounce off the scope boundary, not negotiate
  with it.
- **Persona expansion outpacing RBAC.** Adding Calendar Owners, guards,
  vendors, team members, guests one at a time without a foundation rewrite
  produces a permissions tangle. Spend H1 evenings paying down the role model.
- **WhatsApp gravity.** Replacing the chat is *the* product thesis for H1.
  If pilot users keep a parallel WhatsApp thread for the same items, H1 has
  failed regardless of what shipped. Measure it explicitly.
- **Inbox-last instead of inbox-first.** The temptation is to build the
  contract module, the pricing module, the document vault as standalone
  features. They are not — they are typed requests. Shipping any of them
  before the inbox core (Phase 3) means rebuilding their UX twice.
- **Compliance underestimation.** SIRE / RNT / tourism tax look like "another
  module" but they're regulated workflows with audit and legal exposure.
  Treat H3 as half product / half ops + legal.
- **Single-file architecture compounding.** Every horizon adds modules; if we
  don't split before H2, we'll spend H3 fighting the codebase.
- **Per-stay photo log skipped or partial.** Without it, AirCover claims fail
  and the two-path damage workflow is theatre. It is a Phase 3 hard
  requirement, not a nice-to-have.
- **Credentials leak into the inbox.** The inbox is not a chat. The vault
  exists for a reason. Any UI that lets users paste a bank account or RNT
  password into a request thread reintroduces the very problem KAI was built
  to solve.

---

## 13. What this document is not

- It is not a release plan with dates. The phase weeks in
  `OPERATOR_PORTAL_PROPOSAL.md` and the token estimates in
  `USE_CASE_DISCOVERY.md` are still the source of truth for H1 timing and
  effort.
- It is not a commitment to build every module listed in §7. Many will turn
  into "buy/integrate" or "wontbuild" once we get closer.
- It is not a UI spec. UI work for each horizon is owned by the design docs
  for that scope (today: `OPERATOR_PORTAL_DESIGN.md`).

If something here contradicts a more specific doc inside the horizon we are
currently executing, the specific doc wins. This file is the map, not the
territory.
