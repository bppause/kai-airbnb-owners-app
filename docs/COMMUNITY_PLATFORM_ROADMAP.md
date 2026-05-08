# Community Management Platform — Conceptual Roadmap

> Strategy document — May 2026
> Companions: `OPERATOR_PORTAL_PROPOSAL.md`, `OPERATOR_PORTAL_DESIGN.md`,
> `PROTOTYPE_READINESS.md`, `USE_CASE_DISCOVERY.md`, `GTM_AND_PRICING.md`

---

## 1. Why this document exists

The product started as a single-purpose tool: structured **incident reporting**
between owners and a community admin in Morros KAI / Serena del Mar. Two things
have happened since:

1. The discovery work for the **Operator Portal** showed that the same data
   model (units, owners, incidents, audit trail, role-based permissions) is the
   spine of a much larger product — the WhatsApp-replacement layer for
   day-to-day STR operations.
2. Conversations with owners, operators and the building's community admin
   surfaced needs that go well beyond incidents and operator coordination:
   guest registration, amenity bookings, package handling, fees and fines,
   tourism-board reporting, resident directory, etc.

This roadmap stitches all of that into one product picture. It does **not**
prescribe build order beyond H1; later horizons are intentionally directional
so they can be re-prioritised as we learn from the pilot.

---

## 2. North star

> **One operating system for owner-occupied buildings that also have
> short-term rental activity.**
>
> Same record, different views per persona. Every action audited. Every open
> loop visible to the party who can close it. Spanish-first, English-ready,
> tourism-compliant by default.

Three product promises follow from that:

- **Visibility over control.** Owners and admins want to *see* what is
  happening before they want to *do* anything. (`USE_CASE_DISCOVERY.md` §
  "Owners want visibility, not total control".)
- **Approval gates, not courtesies.** Significant cost or change requires
  explicit acceptance, not a WhatsApp heads-up.
- **Permanent record.** Decisions, invoices, photos, and credentials live in
  the platform — not in a chat group that disappears with staff turnover.

---

## 3. Where we are today (baseline)

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
| Operator role + portal | **Designed, not built** | See `PROTOTYPE_READINESS.md` Phase 0 |
| Login path split (Owner vs Operator) | **Designed, not built** | Phase 0 |
| Service requests / work orders | **Designed, not built** | Phase 3 of operator portal |
| Pricing approvals, owner blocks, document vault | **Designed, not built** | Phases 4–6 of operator portal |
| Anything below in §6 "H2/H3" | **Not yet designed** | This document is the first sketch |

Key technical facts that constrain the roadmap:

- Single-tenant deployment per building today. Multi-tenant ("manage two
  buildings on one platform") is a real architectural step, not just a config.
- Backend is one large `server.js`; frontend is one large `App.jsx`. Either we
  decompose deliberately as we add modules, or future work gets harder
  super-linearly.
- Database is Supabase. No local fallback. Migrations are applied manually via
  `supabase/schema.sql`.
- Auth is Firebase (Google only). Adding any persona that isn't a Gmail-using
  owner (guards, vendors, guests) means widening the auth story.

---

## 4. Personas and what they need from the platform

We use the same record / different view model. A unit isn't owned by the
operator's view or the admin's view — they're projections.

| Persona | Primary jobs-to-be-done | Today | Roadmap horizon |
|---|---|---|---|
| **Owner** (single + multi-property) | See what's happening with my unit, approve cost/price changes, file & verify incidents, block dates | H0 (incidents only) | H1 portfolio view |
| **Operator / co-host** | Manage all units across communities, dispatch staff, get owner approvals, close loops | Designed | H1 |
| **Operator's team** (cleaning, supervision, logistics, guest support) | Daily task list across communities, mark done with photo | Designed | H1 (Phase 7) |
| **Community / building admin** (delegate or global) | Triage incidents, enforce STR rules, comms, fees, amenities | H0 (incidents) | H2 |
| **Guard / front desk** | Visitor & package logging, amenity check-in, panic | Not in scope | H2 |
| **Guest** | Pre-arrival check-in, access codes, in-stay support, tourism registration | Not in scope | H3 |
| **Vendor / contractor** | Receive a work order, schedule access, upload invoice | Not in scope | H2 (read-only invite first) |
| **Authority / tourism board** | Receive structured reporting (RNT, SIRE, occupancy, tax) | Not in scope | H3 |

Implication: the role model needs to grow from 3 → ~7. We should plan it once
(see §8) instead of re-doing the permissions layer each time we add a persona.

---

## 5. Module map

Modules are grouped by *what problem they solve*, not by who uses them.
"Shared" means the same module renders different views per persona — most
modules are like this.

### 5.1 Community Operations (the building's day-to-day)

| Module | Problem it solves | Status |
|---|---|---|
| Incident Management | Structured triage of community incidents | **Live** |
| Maintenance / Work Orders | Reactive + preventive jobs with approval gates | Designed |
| Vendor & Contractor Mgmt | Approved list, COIs, ratings, access windows | Future |
| Inspections & QA | Pre-arrival, post-stay, quarterly | Future |
| Housekeeping & Turnover | Checklists, photo verification, par-level linens | Future |
| Asset & Inventory Register | Appliances, warranties, lifecycle | Future |
| Lost & Found | Logging + return workflow | Future |

### 5.2 STR / Operator Governance

| Module | Problem it solves | Status |
|---|---|---|
| Operator Identity & Unit Linking | Who manages which unit, owner-accepted | Designed |
| Operator Multi-Community Console | One view of all units across buildings | Designed |
| Service Requests with Approval | WhatsApp replacement for repair/clean/inspect | Designed |
| Owner Calendar & Blocks | Owner-initiated date holds | Designed |
| Pricing History & Approvals | Immutable price-change ledger | Designed |
| Operator Document Vault | RNT, utility, insurance, listing assets | Designed |
| Operator Team Roster | Per-unit team with clear roles | Designed |
| Operator Scorecard | Incidents/complaints/response time per operator | Future |
| Listing / Branding Compliance | Approved photos, naming, building rules | Future |

### 5.3 Resident & Visitor Layer

| Module | Problem it solves | Status |
|---|---|---|
| Owner & Resident Directory | Who lives where, contacts, emergency info | Future |
| Guest / Visitor Registration | Pre-register guests, vendors, deliveries | Future |
| Access & Security | Smart locks, gate codes, guard approvals | Future |
| Package & Delivery | Receive, photograph, notify, confirm pickup | Future |
| Parking & Vehicle | Owner vehicles, visitor spots, violations | Future |
| Amenity Reservations | Pool, BBQ, gym, meeting room | Future |
| Emergency Response | Fire/flood/medical/security playbooks | Future |

### 5.4 Compliance & Money

| Module | Problem it solves | Status |
|---|---|---|
| Rules & Compliance Center | Building rules, STR caps, quiet hours, fines | Future |
| Licensing & Permits | RNT, STR registration, expirations | Future |
| Tourism Authority Reporting | SIRE / Migración Colombia / occupancy stats | Future |
| Tourism Tax & Levies | Calc, collect, remit (national + municipal) | Future |
| Insurance & Claims | Policies, COIs, incident-to-claim workflow | Future |
| HOA Fees / Fines / Deposits | Billing, dunning, payment tracking | Future |
| Owner Statements & Payouts | Revenue share, expenses, multi-currency | Future |
| Tax Pack | Year-end summaries, withholding | Future |

### 5.5 Communication & Knowledge

| Module | Problem it solves | Status |
|---|---|---|
| Notifications (in-app + email) | SLA, escalation, smart alerts | **Live** |
| Announcements / Polls / Minutes | Broadcasts to residents and owners | Future |
| Document Library | HOA bylaws, policies, contracts, permits | Partial (operator vault designed) |
| Multilingual Support | es-CO + en across all surfaces | **Live (UI)** — needs to extend to docs/comms |
| Digital Guidebook & Concierge | Guest-facing house manual, upsells | Future |

### 5.6 Insight & AI

| Module | Problem it solves | Status |
|---|---|---|
| Admin Dashboard / Reporting | KPIs: open incidents, repeat offenders, SLA | Partial |
| Analytics & Trends | Repeat apartments, high-risk operators, seasonal | Future |
| AI Smart Notifications | Auto-route by type/urgency/persona | Future |
| AI Triage / Drafting / Translation | Reduce admin & operator workload | Future |
| Risk & Reputation Monitoring | Reputation-impacting incidents | Future |
| Investment Analytics (owner) | Cap rate, cash-on-cash, comps | Future |

### 5.7 Cross-cutting platform foundations (see §8)

Identity / multi-tenant RBAC · Workflow & notification engine · Audit trail ·
Document storage · Payments & multi-currency · Integrations & API · Mobile apps
· AI layer.

---

## 6. Horizons

Horizons are *thematic*, not strict quarter boundaries. Each one has an exit
condition; we don't move on until it's met.

### H0 — Today (delivered)

**Theme:** Incident management as the trust anchor between owners and the
building admin.

**Exit condition (already met):**
- Owners can submit & verify incidents.
- Admins can resolve & escalate with SLA tracking.
- Audit log + email notifications working in production.
- Bilingual UI live.

### H1 — Operator Portal MVP (next)

**Theme:** Replace the WhatsApp group as the canonical owner-operator channel
for a single unit.

**Scope:** Operator Portal Phases 0–3 from `PROTOTYPE_READINESS.md` /
`OPERATOR_PORTAL_PROPOSAL.md`:

1. Login path split (Owner vs Operator) + `operator` role + admin grant +
   per-community owner opt-out.
2. Operator identity & unit linking (owner accepts).
3. Operator multi-community console.
4. Service Requests with owner approval gate, photos, invoices, status flow.

**Exit condition:**
- A pilot operator runs at least one unit's repair-or-clean cycle entirely on
  the platform — request → approval → work → invoice → close — with no
  parallel WhatsApp thread for the same item.
- Owners report they can answer "what's the status of X on my unit?" without
  asking the operator.
- The operator's team can pick up their daily list on mobile.

**Why this first:** highest-friction daily flow, designed already, money
follows it (operator-paid model in `GTM_AND_PRICING.md`), and it forces us to
generalise the platform from "one building" to "operator's units across
buildings" — which is the multi-tenant precondition for everything in H2/H3.

### H2 — Building Operating System

**Theme:** The community admin's day-to-day moves into the platform too.
Visitors, packages, amenities, fees, and rules join incidents and operations.

**Indicative scope (priority order to be set after H1 pilot):**

1. **Resident & Owner Directory.** Cleans up `app_users` + `listings` into a
   proper unit ↔ resident graph, including renters and emergency contacts.
2. **Visitor & Package Management.** Replaces guard notebooks. Pre-register
   guests/vendors; package photo + pickup confirmation. First persona that
   isn't email-as-Google: guards likely need a kiosk/PIN auth.
3. **Amenity Reservations.** Pool, BBQ, gym, meeting room. Standalone-ish but
   shares notifications + audit.
4. **Rules & Compliance Center.** STR caps per unit, quiet hours, pet rules,
   fines. Connects to Incident Management via "rule violation → incident".
5. **HOA Fees / Fines / Deposits.** Billing + dunning. First time we touch
   payments → forces the payments foundation (§8).
6. **Vendor & Contractor Management.** Approved list + COI tracking. Read-only
   vendor invites first; full vendor portal later.
7. **Announcements / Polls / Minutes.** Comms hub for board → residents.
8. **Maintenance preventive scheduling.** Recurring work-order templates.

**Exit condition:** A delegate admin can run a normal week — incidents,
visitors, packages, amenities, fee reminders, an announcement — without
touching email or WhatsApp for any of it.

### H3 — Guest & Tourism Layer

**Theme:** The guest becomes a first-class persona, and the platform talks to
authorities on the unit's behalf.

**Indicative scope:**

1. **Guest Registration to Authorities.** SIRE / Migración Colombia for
   foreign guests. Reads from the operator's reservation data; outputs the
   files the law requires.
2. **Tourism Registry (RNT) tracking + renewals.** Lives next to the document
   vault but with regulatory reminders.
3. **Tourism Tax / Levies.** Calc on each stay, remittance reporting.
4. **Pre-Arrival Flow.** Digital check-in, ID verification, registration card,
   key/code delivery. Becomes the bridge between operator's PMS/OTAs and the
   building's access system.
5. **Digital Guidebook & In-Stay Support.** Guest can submit incidents/repairs
   from their phone — these route to the operator first, building admin only
   if escalated.
6. **Reviews & Reputation.** Solicitation + sentiment + response workflows;
   feeds the operator scorecard.
7. **Channel Manager + Unified Inbox** *(stretch, owner-operator-only).*

**Exit condition:** A new guest arrives, gets verified, gets reported to
authorities, accesses the unit, submits one in-stay request, and leaves a
review — all through the platform with no manual data entry by the operator
or admin.

### H4 — Intelligence & Scale

**Theme:** The platform stops being just a system of record and starts being a
system of insight.

**Indicative scope:**

1. **AI smart notifications & triage.** Auto-route incidents and service
   requests by type/urgency/history. Draft replies in the operator inbox.
2. **Operator Scorecard & Risk/Reputation Monitoring.** Quantitative trust
   signal across operators, used in matching and pricing.
3. **Analytics & Trends.** Repeat apartments, high-risk operators, seasonal
   issues, cost drivers per unit.
4. **Investment Analytics for owners.** Cap rate, RevPAR, comps across
   communities (cross-tenant benchmarking).
5. **Mobile apps.** Guest, owner, operator, field tech, board member —
   probably not all native; some are PWAs.
6. **Multi-building + multi-currency.** First building beyond Morros KAI,
   probably first non-COP currency.
7. **Open API / integrations.** PMS (e.g. Hostaway/Guesty), accounting
   (QuickBooks / Siigo), OTAs (Airbnb/VRBO/Booking), IoT (locks, sensors),
   payments.

---

## 7. Persona ↔ module mapping (compact)

Reading guide: a row marks the modules where that persona is the *primary*
actor. They will appear in many other modules in supporting roles.

```
                         Owner  Operator  Team  Admin  Guard  Guest  Vendor
Incident Management        ●       ◐       .     ●      .     ◐      .
Service Requests           ◐       ●       ◐     .      .     ◐      ◐
Pricing & Approvals        ●       ●       .     .      .     .      .
Owner Calendar / Blocks    ●       ◐       .     .      .     .      .
Operator Console           .       ●       ◐     .      .     .      .
Resident Directory         ◐       .       .     ●      ◐     .      .
Visitor & Package          .       ◐       .     ●      ●     ◐      .
Amenity Reservations       ●       .       .     ●      ◐     ◐      .
Rules & Compliance         ◐       ◐       .     ●      .     ◐      .
Fees / Fines / Deposits    ●       .       .     ●      .     .      .
Vendor Mgmt                .       ◐       .     ●      .     .      ●
Documents (Vault + HOA)    ●       ●       .     ●      .     ◐      ◐
Comms Hub                  ◐       ◐       .     ●      ◐     ◐      .
Guest Pre-Arrival          .       ●       ◐     .      ◐     ●      .
Tourism Reporting          ◐       ●       .     ●      .     ◐      .
Owner Statements / Tax     ●       ◐       .     .      .     .      .
Analytics & AI             ●       ●       .     ●      .     .      .
```

`●` primary  `◐` secondary / read or assist  `.` not involved

---

## 8. Cross-cutting foundations

These have to be planned once, not per module. Most of them are the *real*
work behind H2 and H3 even though they're invisible on a feature list.

1. **Identity & multi-tenant RBAC.** Today: 3 roles, single building. Need:
   ~7 personas, multiple buildings, multi-property operators, owner ↔
   operator role-switching. Decision needed before H2: do we keep
   Firebase-Google-only, or add email-link / phone / kiosk auth for
   guards & vendors?
2. **Workflow & notification engine.** Right now SLA, escalation, and email
   templating live inline in `server.js`. As workflows multiply (service
   requests, fees, amenity bookings, tourism filings) we'll want one
   declarative engine instead of N copies.
3. **Audit trail.** `audit_logs` exists; we need to *enforce* it for every
   write across new modules. Standard helper in `server.js` so future modules
   don't skip it.
4. **Document storage.** Operator vault, HOA library, COIs, invoices, guest
   IDs — all want versioning, retention rules, and (eventually) e-sign. Pick
   the storage layer once.
5. **Payments & multi-currency.** Triggered first by HOA fees in H2. Owner
   payouts and tourism tax remittance follow. Multi-currency from day one,
   even if H1/H2 are COP-only.
6. **Code structure.** `server.js` and `App.jsx` are already at the limit of
   "one file is fine". Before H2 we should extract: per-module route files on
   the server, per-feature folder split on the client. This is not a rewrite
   — it's a precondition to keep adding modules at speed.
7. **Mobile / PWA.** The team roster (operator's cleaners and supervisors),
   the guard, and the guest all need a mobile-first surface. PWA first,
   native only where push or offline forces it.
8. **AI layer.** Drafting, triage, translation, anomaly detection, pricing
   suggestions. Cross-cutting from H1 onward; we should add it as a service,
   not module by module.
9. **Data privacy & retention.** Habeas Data (Colombia) for residents; guest
   data retention windows; operator credential isolation. A policy doc has
   to land before H3 because guests bring real PII into the platform.
10. **Integrations & API.** Public read-only API for owners' own data first;
    PMS / accounting / IoT inbound integrations later in H4.

---

## 9. Key decisions to lock before each horizon

### Before H1 ships
- [ ] Operator billing model — confirm `GTM_AND_PRICING.md` proposal stays
      "operator pays, off by default until billing is wired".
- [ ] Email-only notifications confirmed (no WhatsApp) for H1.
- [ ] Pilot building (assume Morros KAI 317 + 1 more unit).
- [ ] Cost threshold above which owner approval is mandatory (default? per
      operator? per unit?).
- [ ] Whether the operator's team needs individual logins in H1 or operator
      acts on their behalf (today: per `OPERATOR_PORTAL_PROPOSAL.md` Q2,
      open).

### Before H2 starts
- [ ] Auth: do guards/vendors get Firebase-Google, kiosk, magic-link, or
      something else?
- [ ] Multi-building tenancy model: one Supabase instance with `community_id`
      everywhere, or one project per building?
- [ ] Code structure: commit to splitting `server.js` and `App.jsx` before
      first H2 module ships.
- [ ] Payments provider for COP (Wompi? Mercado Pago? ePayco?).
- [ ] Document storage backend (Supabase Storage vs. S3 + CDN).

### Before H3 starts
- [ ] Whether KAI itself files SIRE / RNT, or just generates the file an
      operator submits.
- [ ] Tourism tax remittance — platform of record vs. report-only.
- [ ] Guest auth: phone + OTP? Email link? No login (signed URL only)?
- [ ] PII retention policy (Habeas Data) finalised and reviewed by counsel.

---

## 10. Risks worth naming early

- **Scope creep into "we are now Hostaway".** Channel manager, dynamic
  pricing, unified inbox are huge products on their own. Resist building
  them; integrate instead. Owner statements + tax are an exception because
  no off-the-shelf product covers Colombian HOA + STR cleanly.
- **Persona expansion outpacing RBAC.** Adding guards/vendors/guests one at a
  time without a foundation rewrite produces a permissions tangle. Spend H1
  evenings paying down the role model.
- **WhatsApp gravity.** Replacing the chat is *the* product thesis for H1.
  If pilot users keep a parallel WhatsApp thread for the same items, H1 has
  failed regardless of what shipped.
- **Compliance underestimation.** SIRE / RNT / tourism tax look like
  "another module" but they're regulated workflows with audit and legal
  exposure. Treat H3 as half product / half ops + legal.
- **Single-file architecture compounding.** Every horizon adds modules; if we
  don't split before H2, we'll spend H3 fighting the codebase.

---

## 11. What this document is not

- It is not a release plan with dates. The phase weeks in
  `OPERATOR_PORTAL_PROPOSAL.md` are still the source of truth for H1 timing.
- It is not a commitment to build every module listed in §5. Many will turn
  into "buy/integrate" or "wontbuild" once we get closer.
- It is not a UI spec. UI work for each horizon is owned by the design docs
  for that scope (today: `OPERATOR_PORTAL_DESIGN.md`).

If something here contradicts a more specific doc inside the horizon we are
currently executing, the specific doc wins. This file is the map, not the
territory.
