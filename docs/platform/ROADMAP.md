# Community Management Platform — Conceptual Roadmap

> Strategy document — May 2026
> Companions: `../modules/operator-portal/PROPOSAL.md`,
> `../modules/operator-portal/DESIGN.md`,
> `../modules/operator-portal/PROTOTYPE_READINESS.md`,
> `../modules/operator-portal/USE_CASE_DISCOVERY.md`,
> `../modules/operator-portal/GTM_AND_PRICING.md`,
> `../modules/property-development-lifecycle/PROPOSAL.md`, `./PITCH.md`

---

## 1. Why this document exists

The product started as a single-purpose tool: structured **incident reporting**
between owners and a community admin in Morros KAI / Serena del Mar. Two
expansions are now visible:

1. The **Operator Portal** discovery — grounded in a real 7-month WhatsApp
   transcript between owners (Brian and Martha Pause) and operator (Luxury
   Rentals / Oscar Lindo) for unit Morros KAI 317 — showed the same data
   model is the spine of an STR governance product replacing the WhatsApp
   group between operator, owner, and team.
2. Conversations across the building's stakeholders surfaced needs that go
   well beyond incidents and Airbnb operators: **building administration,
   facilities, sales/property development, on-site operations, residents,
   visitors and guests, tourism authorities, communications, analytics**.

This roadmap stitches all of that into one product picture across the **full
lifecycle of a property** — pre-sale → handover → ownership → operation
(personal use or STR) → resale. Each lifecycle stage has different audiences
and different operating patterns, but all share the same record (unit, owner,
building, audit, identity).

Important framing: the operator-portal discovery is one module, not the whole
platform. The seven design principles drawn from that WhatsApp transcript
(§4) are authoritative *inside* the operator-owner pillar. Other pillars
(sales, facilities, building admin, tourism) need their own discovery and
will not necessarily inherit the same operating model.

### Terminology (locked)

The word *operator* is used in a specific, narrow sense throughout this
document and the platform's UI:

| Term | Means | Owns |
|---|---|---|
| **Airbnb operator** (often shortened to **operator**) | The Airbnb listing manager / co-host who runs an STR unit on behalf of one or more owners | The listing, guest relationship, unit-level service requests, owner tasks/issues/requests arising from STR operation |
| **Building admin** (HOA admin / community admin / property manager) | The party that runs the building or complex itself | Operations of the facility/complex: front desk, access control, common areas, facilities, residents, fees, governance, building-wide incidents |

There is **no** "building operator" role. The building's operations belong to
the **building admin**. When this document says *operator*, it always means
the Airbnb operator. When it discusses the building's day-to-day, the actor is
the building admin, the facilities team, or the front desk — never an
"operator".

The two are independent: a unit can have an Airbnb operator, none, or several
over time, while the building admin remains constant for the complex.

---

## 2. North star

> **One operating system for residential communities across the full
> property lifecycle.** Same record, different views per audience. Every
> action audited. Every open loop visible to the party who can close it.
> Spanish-first, English-ready, multilingual extensible.

Three product promises that apply across all pillars:

- **Visibility over control.** Most stakeholders want to *see* what's
  happening before they want to *do* anything. Read-only dashboards solve a
  surprising share of friction.
- **Approval gates, not courtesies.** Significant cost or change requires
  explicit acceptance — whether it's a repair (operator → owner), an
  amenity reservation (resident → admin), or a sales contract amendment
  (buyer → developer).
- **Permanent record.** Decisions, invoices, photos, contracts, and
  credentials live in the platform — not in chat groups, email threads, or
  binders that disappear with staff turnover.

### What KAI is not (scope edges)

KAI doesn't replicate purpose-built systems where they already work:

| Out of scope (someone else's source of truth) | KAI captures |
|---|---|
| Airbnb / OTA: bookings, guest profiles, payouts, host inbox, AirCover filing | Relationship events around the stay (approvals, damage cases, photo log) |
| ERP / accounting: GL, AR, AP, tax filing | Expense submission, receipt vault, and the data hand-off |
| CRM / sales pipeline tools (HubSpot, Salesforce) | The buyer-facing post-reservation experience and document signing |
| Banking, payment rails | Payment intent + reconciliation, not money movement |
| Calendar systems (Google, Outlook) | Building-context events that don't belong in a personal calendar |

The rule: if a specialised system already owns it, integrate; don't replace.

---

## 3. Where we are today (baseline)

| Capability | State |
|---|---|
| Incident workflow `Open → Owner Verification → Resolved` | **Production** |
| Listings as source of truth for ownership | **Production** |
| Registration approval workflow | **Production** |
| Roles: `global_admin`, `delegate_admin`, `user` | **Production** |
| Smart notifications (in-app + email) | **Production** |
| Bilingual UI (es-CO default, en) | **Production** |
| Audit logs | **Production** |
| Email templates (DB-overridable) | **Production** |
| Operator Portal (Phases 0–7) | **Designed, not built** |
| Multi-owner model (Payout / Calendar Owner) | **Designed, not built** |
| Listing Management Contract | **Designed, not built** |
| Per-stay inspection photo log + two-path damage workflow | **Designed, not built** |
| Building Operations modules (visitors, packages, amenities, fees) | **Not yet designed** |
| Facilities & Common-Area Maintenance | **Not yet designed** |
| Property Development Lifecycle (pre-sale → handover → warranty → resale) | **Placeholder proposal** — see `../modules/property-development-lifecycle/PROPOSAL.md` |
| Tourism authority reporting (SIRE / RNT / tax) | **Not yet designed** |
| Communications hub (announcements, polls, minutes) | **Not yet designed** |

Technical constraints to keep in mind across all pillars:

- Single-tenant deployment per building today. Multi-building tenancy is the
  H1 architectural step.
- One large `server.js` and one large `App.jsx`. Per-pillar code splitting
  becomes a precondition before H2.
- Supabase only; manual migrations.
- Firebase Google sign-in only; almost every audience expansion below this
  baseline (guards, vendors, residents-without-Gmail, guests, sales leads)
  needs additional auth modes.

---

## 4. Design principles (and where they apply)

### 4.1 Operator-Owner pillar — from the real-chat findings

Seven behavioural findings from `../modules/operator-portal/USE_CASE_DISCOVERY.md`. Authoritative inside
the operator portal; informative elsewhere.

1. **Owners are engaged, not passive.** Treat them as power users.
2. **Follow-up burden falls on owners today.** Open loops must be visible to
   both parties with aging timers; closure requires the responsible party.
3. **Operator acts first, informs later.** Approval gates are *enforced*, not
   courtesy.
4. **Zero credentials or financial details in chat.** Encrypted vault +
   structured expense flow; chat is for context only.
5. **Owners want visibility, not total control.** Read-only dashboards cover
   most friction.
6. **Trust erodes through small repeated failures.** Aging timers and SLA
   escalation prevent accumulation.
7. **Team rosters are opaque to owners.** Named team directory with roles per
   unit.

### 4.2 Cross-pillar principles (apply everywhere)

- **Same record, different views.** A unit isn't owned by a pillar — it's
  shared. Build the projection layer; don't fork the schema.
- **Audit everything that writes.** A standard helper, not a per-pillar
  decision.
- **Multilingual from day one.** Every new pillar's UI, comms, and templates
  pass through the same i18n layer.
- **Notifications respect role and consent.** A resident shouldn't see an
  operator's repair-cost numbers; a sales lead shouldn't get HOA notices.
- **Mobile is not optional.** Field staff, guards, residents, guests all use
  phones first.

---

## 5. Audiences (personas)

The platform serves the lifecycle of a property and the building it sits in.
That means many more personas than "owner / admin / operator".

| # | Persona | Lifecycle stage | Pillars they primarily live in |
|---|---|---|---|
| 1 | **Property developer / sales team** | Pre-sale, construction, handover | Sales & Development, Communications |
| 2 | **Buyer / pre-owner** | Pre-sale → handover | Sales & Development |
| 3 | **Owner — Payout** (1 per unit, financial approval rights) | Ownership + STR | Operator-Owner, Building Admin |
| 4 | **Owner — Calendar** (0+ per unit, no financial visibility) | Ownership + STR | Operator-Owner |
| 5 | **Resident / renter** (long-term tenant, not owner) | Ownership phase | Building Admin, Operations |
| 6 | **Building admin** (HOA / community admin — delegate or global; owns facility operations) | Ownership phase | Building Admin, Front Desk, Facilities |
| 7 | **Board / committee member** | Ownership phase | Building Admin, Communications |
| 8 | **Facilities team** (building engineer, common-area maintenance, common-area cleaners — reports to building admin) | Ownership phase | Facilities |
| 9 | **Guard / front desk / concierge** (reports to building admin) | Ownership phase | Front Desk |
| 10 | **Vendor / contractor** | All stages | Facilities, Operator-Owner |
| 11 | **Airbnb operator** (listing manager / co-host — one per unit; may operate many across buildings) | STR operation | Operator-Owner |
| 12 | **Airbnb operator's team** (cleaning, supervision, logistics, guest support — reports to the Airbnb operator, not the building admin) | STR operation | Operator-Owner |
| 13 | **Long-term guest / Airbnb guest** (impact-only persona inside KAI) | STR operation | Operator-Owner, Tourism, Operations |
| 14 | **Visitor / delivery** (one-shot guest of a resident) | Ownership phase | Operations |
| 15 | **Tourism authority / regulator** (consumer of structured reports) | STR operation | Tourism |
| 16 | **External buyer / agent** (resale phase) | End of ownership | Sales & Development |

Implication: the role model needs to grow from 3 today to ~10–12 distinct
roles, plus per-unit subtypes (Payout/Calendar) and per-pillar permissions.
Plan it once (see §8) instead of re-doing the permissions layer per pillar.

---

## 6. Functional pillars

Eleven pillars. The user-supplied module table from the brainstorm slots into
these. Each module renders different views per persona using the same record.

### 6.1 Property Development Lifecycle

For new construction phase, handover, post-sale warranty, and unit resale.
**Detailed placeholder proposal:**
[`../modules/property-development-lifecycle/PROPOSAL.md`](../modules/property-development-lifecycle/PROPOSAL.md).

| Module | Problem it solves |
|---|---|
| Pre-sales / Lead capture | Brochure, virtual tour, reservation deposit, lead → buyer conversion |
| Sales contracts & payment plans | Promesa, escritura, milestone payments, late-payment dunning |
| Construction progress comms | Photos, milestone updates, ETA changes shared with buyers |
| Pre-delivery inspection (acta de entrega) | Punch list, defect logging, sign-off |
| Unit handover | Handover packet (keys, codes, manuals, warranties), title transfer tracking |
| Warranty period mgmt | Post-handover defect reporting (1y / 5y / 10y warranty windows in Colombia), routes to developer not operator |
| Resale support | Owner lists for sale, brokers granted scoped access, handover to new owner |

### 6.2 Building Administration & Governance

The building admin's day-to-day. The building admin owns the operations of
the facility/complex itself — distinct from the Airbnb operator (§6.7), who
owns STR operations *inside* a unit.

| Module | Problem it solves |
|---|---|
| Resident & Owner Directory | Unit ↔ resident graph; renters; emergency contacts; consent flags |
| Board governance | Committees, meeting minutes, voting / polls, bylaw amendments |
| HOA Fees / Cuotas | Recurring billing, late fees, payment tracking, statements |
| Fines & Violations | Issued, contested, paid; linked to incident |
| Reserve Fund & Budget | Annual budget, reserve health, special assessments |
| Document Library | Bylaws, regulations, permits, insurance certificates, tax filings |
| HOA Communications (admin pillar overlaps with §6.10) | Targeted broadcasts to residents/owners |

### 6.3 Facilities & Common-Area Maintenance

Distinct from unit-level maintenance (which lives in Operator-Owner).

| Module | Problem it solves |
|---|---|
| Common-Area Asset Register | Elevators, generators, pumps, pool equipment, HVAC, lighting; warranties; lifecycle |
| Preventive Maintenance Schedules | Recurring tasks per asset; technician assignments; compliance with manufacturer schedules |
| Reactive Work Orders (common areas) | Reported by residents, guards, or detected by IoT |
| Vendor & Contractor Management | Approved vendor list, COIs, ratings, access windows, performance |
| Inspections & QA | Periodic asset and area inspections with photo evidence |
| Energy & Utilities | Common-area consumption, sub-metering, anomaly flags, cost allocation |
| Smart Building / IoT | Common-area sensors (leak, smoke, occupancy, CCTV events) feeding into incidents and work orders |

### 6.4 Front Desk, Access & Visitor Management

The guard / concierge / front-desk surface. Sits under the building admin's
ownership (§6.2). Not to be confused with the Airbnb operator's unit-level
operations (§6.7) — different actor, different scope.

| Module | Problem it solves |
|---|---|
| Visitor & Delivery Pre-Registration | Resident/owner registers expected guest; guard checks in |
| Package & Delivery Mgmt | Receive, photograph, notify resident, confirm pickup |
| Access & Security | Smart locks, gate codes, badges, restricted areas, visitor codes |
| Parking & Vehicle Mgmt | Owner/resident vehicle registry, visitor parking, violations, towing |
| Guard log / Shift handover | Notes, incidents, anomalies; visible to next shift and admin |
| Lost & Found | Logging + return workflow |
| Emergency Response Center | Fire, flood, violence, medical, evacuation playbooks; broadcast |

### 6.5 Resident Experience

Owner / renter as a *resident* — separate from owner-as-co-host.

| Module | Problem it solves |
|---|---|
| Resident Portal Home | Unified inbox: notices, fees due, my packages, my visitors, my reservations |
| Amenity Reservations | Pool, jacuzzi, sauna, BBQ, gym, meeting room, parking, visitor spaces |
| Personal Visitor & Vehicle Pre-Reg | Self-service alternative to phoning the guard |
| Move-In / Move-Out Workflow | Inventory, key handoff, deposit handling, condition photos |
| Maintenance Requests (in-unit, owner-initiated) | When the resident is not an STR operator's unit |

### 6.6 Guest & Visitor Management

Different from §6.4 because it includes Airbnb guests and longer stays.

| Module | Problem it solves |
|---|---|
| Guest Pre-Arrival Registration | KYC-light, ID upload, building rules acknowledgment |
| Building Access Provisioning | Time-bound codes, lock provisioning, guard pre-notice |
| Digital Guidebook | House manual, local recommendations, multilingual |
| In-Stay Issue Routing | Guest impact ticket → operator first, building admin only on escalation |
| Guest Departure & Inspection | Linked to operator-portal photo log when STR; otherwise owner-handled |

### 6.7 Airbnb Operator–Owner Governance (STR Listing Portal)

This is the pillar described in `../modules/operator-portal/USE_CASE_DISCOVERY.md`. **The seven design
principles in §4.1 apply specifically here.** Detailed module list is in
`../modules/operator-portal/PROPOSAL.md`.

**Scope (locked):** the Airbnb operator's role is to manage the listing, the
guest relationship, and the unit-owner tasks/issues/requests that arise from
STR operation. The Airbnb operator does **not** own the building's operations
— that is the building admin's pillar (§6.2). When unit-level activity
intersects building rules (e.g. a guest violates quiet hours), the typed
request flows through the operator-owner inbox *and* surfaces to the building
admin via the incident pillar (§6.9).

Headline modules:

| Module | Problem it solves |
|---|---|
| Typed Request Inbox + SLA engine | The WhatsApp replacement; aging timers; persona-aware visibility |
| Listing Management Contract | Locked terms (fee, threshold, services, notice); proposal/amendment lifecycle |
| Multi-Owner Roster (Payout + Calendar) | Multiple co-hosts per unit with differing access |
| Operator Multi-Community Console | One view of all units across buildings |
| Owner Read-Only Dashboard | Listing state, pricing, ranking context, reviews |
| Bidirectional Pricing | Either party proposes; the other confirms; immutable log |
| Per-stay Photo Log + Two-Path Damage | AirCover (guest) vs owner-insurance (non-guest) |
| Service Requests / Work Orders (in-unit) | Repair, cleaning, inspection, device, building-notice relay |
| Credential & Document Vault (per unit) | RNT/TRA/manuals, no chat-leak |
| Operator Team Roster + Mobile Tasks | Visible to owners; team picks up daily list on phone |
| Review Approval, Guest Block List, Calendar Blocks | Owner controls without taking the wheel |

This pillar's scope explicitly excludes: Airbnb payouts, channel manager,
guest profiles, AirCover filing UI. See §2 scope edges.

### 6.8 Compliance & Tourism

Where the building meets the regulator.

| Module | Problem it solves |
|---|---|
| Rules & Compliance Center (building) | STR caps per unit, quiet hours, pet rules, pool hours, fines policy |
| Licensing & Permits | RNT registration, STR licenses, expirations, renewal reminders |
| Tourism Authority Reporting | SIRE / Migración Colombia for foreign guests; occupancy/origin/length-of-stay statistics |
| Tourism Tax & Levies | Per-stay calc, remittance reporting (national + municipal) |
| Insurance & Claims | Building policies, COIs, owner-unit policies; two-path damage hand-off |
| Habeas Data (Colombia) / GDPR-style | Resident, guest, lead PII consent + retention + subject requests |
| Audit Trail | Every action: who, what, when, why (already live for incidents) |

### 6.9 Incident & Emergency Management

The pillar that exists today.

| Module | Problem it solves |
|---|---|
| Incident Reporting & Triage | Structured open → verify → resolve workflow |
| Owner Verification Workflow | Owner confirms before close (live) |
| SLA & Escalation | Aging timers; configurable per type |
| Smart Notifications | Right person, right urgency |
| Risk & Reputation Monitoring | Reputation-impacting incidents, repeat-apartment surfacing |
| Emergency Response Center | Cross-references with §6.4 — playbooks, broadcast, guard coordination |

### 6.10 Communications

Cross-pillar layer; many modules in §6.2/§6.4/§6.7 push events through here.

| Module | Problem it solves |
|---|---|
| Announcements (admin → audience) | Targeted broadcast: building-wide, floor, owners-only, residents-only, operators-only |
| Polls & Surveys | Board votes, resident sentiment |
| Meeting Minutes | Linked to governance, searchable, multilingual |
| Notifications Engine | Email + in-app today; WhatsApp + push later |
| Multilingual Content Layer | All UI/comms/docs/templates flow through one i18n layer |
| Targeted Comms with Consent | Sales-lead nurture, owner mailers, with opt-out |

### 6.11 Analytics, Reporting & AI

| Module | Problem it solves |
|---|---|
| Admin Dashboard / KPIs | Open incidents, repeat offenders, SLA compliance, fees collected |
| Building Health Score | Composite of facilities, compliance, satisfaction, incidents |
| Sales Funnel Analytics | Lead → reservation → contract → handover, by source/cohort |
| Operator Scorecard | Incidents, response time, complaints, reviews per operator |
| Anomaly Detection | Utility bill > X% of avg; conflated damage; access-pattern anomalies |
| AI Smart Notifications | Auto-route by type/urgency/persona |
| AI Drafting & Translation | Reduce admin/operator/sales workload |
| Owner Investment View | Cap rate, RevPAR, comps; owner-only |
| Trend Reports | Repeat apartments, seasonal patterns, vendor performance |

---

## 7. Where the operator-portal "inbox-first" pattern applies

The typed-request + unified-inbox + SLA pattern (`../modules/operator-portal/USE_CASE_DISCOVERY.md`) is
the operating model **inside the Operator-Owner pillar**. Other pillars have
different operating patterns and shouldn't be force-fitted:

| Pillar | Primary operating pattern |
|---|---|
| Airbnb Operator–Owner (§6.7) | **Typed requests + attention inbox** (chat replacement) |
| Sales & Development (§6.1) | **Pipeline / stage-gates** + document signing + buyer comms |
| Building Admin (§6.2) | **Recurring billing cycle** + governance calendar + fines workflow |
| Facilities (§6.3) | **Asset-centric work orders** + preventive schedules + IoT events |
| Front Desk, Access & Visitor (§6.4) | **Real-time event stream** (visitor in, package in, gate event) |
| Resident Experience (§6.5) | **Self-service portal** + reservation calendar |
| Guest & Visitor (§6.6) | **Pre-arrival flow** + access provisioning timer |
| Compliance & Tourism (§6.8) | **Calendar of obligations** (filings, renewals, taxes due) |
| Incidents & Emergency (§6.9) | **Open/verify/close ticket workflow** (already live) |
| Communications (§6.10) | **Broadcast / targeted send** with delivery tracking |
| Analytics & AI (§6.11) | **Pull / dashboard** + push alerts on anomaly |

A typed-request inbox can sit *under* several pillars (tasks, approvals,
escalations) — but it isn't the universal operating model. Not every domain
is a chat replacement.

---

## 8. Horizons

Horizons are *thematic*, not strict gates. Pillars can move semi-independently
once foundations are in place; the rough order below reflects current
priorities and the existing baseline.

### H0 — Today (delivered)

Incident management as the trust anchor between owners and the building admin.
Production. Bilingual UI. Audit + email working.

### H1 — Operator–Owner Relationship Layer

The Airbnb operator portal as designed in `../modules/operator-portal/PROPOSAL.md` and
`../modules/operator-portal/USE_CASE_DISCOVERY.md`. Phases 0–7. Inbox-first.

**Why first:** highest-friction daily flow, designed already, money follows
it (operator-paid model in `../modules/operator-portal/GTM_AND_PRICING.md`), and it forces multi-building
tenancy — the precondition for everything below.

### H2 — Building Operations Suite

The community admin, residents, guards, and facilities team move into the
platform.

Indicative scope:
1. Resident & Owner Directory (Building Admin §6.2).
2. Visitor & Package Management (Operations §6.4).
3. Amenity Reservations (Resident Experience §6.5).
4. Rules & Compliance Center — building-side (Compliance §6.8).
5. HOA Fees / Cuotas / Fines (Building Admin §6.2). First payments touch.
6. Facilities work orders + asset register + preventive schedules
   (Facilities §6.3). Distinct from in-unit operator service requests.
7. Vendor & Contractor Mgmt (cross-cutting Facilities + Operator-Owner).
8. Communications Hub: announcements, polls, minutes (§6.10).
9. Emergency Response playbooks (§6.4 + §6.9).

**Exit:** delegate admin runs a normal week — incidents, visitors, packages,
amenities, fees, an announcement, a maintenance work order, an emergency
drill — without email or WhatsApp.

### H3 — Property Development, Sales & Lifecycle

The pre-sale and post-handover phases of a unit.

Indicative scope:
1. Pre-sales lead capture + reservation deposit (Sales §6.1).
2. Sales contracts + payment plans + dunning (Sales §6.1). Second payments
   touch — different rails (sales vs. recurring HOA).
3. Construction progress comms to buyers (Sales §6.1 + Communications).
4. Pre-delivery inspection / acta de entrega (Sales §6.1).
5. Handover packet (keys, codes, manuals, warranties) — bridges Sales →
   Operations + Resident Experience.
6. Warranty-period defect routing (Sales §6.1) — defect goes to *developer*,
   not operator; tracks 1y/5y/10y windows under Colombian law.
7. Resale support: owner lists for sale, broker scoped access, handover to
   new owner without losing history.

**Exit:** a buyer is captured as a lead, signs a contract through the
platform, receives milestone updates during construction, signs the acta de
entrega, transitions to resident/owner, files a warranty defect that routes
to the developer not the operator.

### H4 — Compliance & Tourism Layer

Where the building speaks structured data to authorities and protects PII.

Indicative scope:
1. Guest registration to authorities (SIRE / Migración Colombia).
2. RNT tracking + renewal reminders.
3. Tourism tax calc + remittance reporting.
4. Owner unit-insurance registry (enables non-guest damage path).
5. Habeas Data PII workflow (data-subject requests, retention, consent).
6. Building rules surfaced into Airbnb listings via operator workflow.

**Exit:** a foreign guest's stay generates the SIRE report, calculates
tourism tax, confirms RNT validity, and respects retention rules — with no
manual data entry beyond the operator's booking relay.

### H5 — Intelligence & Scale

Insight, mobile, and beyond-one-building.

Indicative scope:
1. AI smart notifications + triage + drafting + translation across pillars.
2. Operator scorecard, vendor scorecard, building health score.
3. Sales funnel analytics; owner investment view.
4. Anomaly detection (utility, access, damage patterns).
5. Mobile apps / PWAs per persona (resident, guard, field tech, operator,
   owner, board, sales lead).
6. Multi-building rollout beyond Morros KAI; multi-currency.
7. Open API / integrations: PMS, accounting (Siigo / QuickBooks), banking,
   IoT, OTAs, e-sign providers.

---

## 9. Persona × pillar matrix (compact)

`●` primary  `◐` secondary / read or assist  `.` not involved

```
                          Sales  Bldg-Adm  Fac  FrontD  Res  Guest  AbnbOp  Compl  Inc  Comms  AI
Developer / sales team      ●       ◐       .     .     .    .      .       ◐    .    ●      ◐
Buyer / pre-owner           ●       .       .     .     .    .      .       .    .    ◐      .
Payout Owner                ◐       ●       ◐     ◐     ●    ◐      ●       ◐    ●    ●      ●
Calendar Owner              .       ◐       .     .     ◐    ◐      ●       .    ◐    ◐      ◐
Resident / renter           .       ●       ◐     ●     ●    ◐      .       ◐    ●    ●      .
Building admin              ◐       ●       ●     ●     ◐    ◐      ◐       ●    ●    ●      ●
Board member                ◐       ●       ◐     .     .    .      .       ●    ◐    ●      ●
Facilities team             .       ◐       ●     ◐     .    .      .       ◐    ◐    ◐      .
Guard / front desk          .       ◐       .     ●     ◐    ●      .       .    ●    ◐      .
Vendor / contractor         .       .       ●     ◐     .    .      ◐       ◐    .    .      .
Airbnb operator             .       ◐       ◐     .     .    ◐      ●       ●    ◐    ◐      ●
Airbnb operator's team      .       .       .     .     .    ◐      ●       .    .    .      .
Guest (impact only)         .       .       .     ◐     .    ●      ◐       ◐    ◐    .      .
Visitor / delivery          .       .       .     ●     .    ●      .       .    .    .      .
Tourism authority           .       .       .     .     .    .      .       ●    .    .      ◐
External buyer / agent      ●       ◐       .     .     .    .      .       ◐    .    ◐      .
```

Pillars: Sales (§6.1) · Bldg-Adm (§6.2) · Fac (§6.3) · FrontD (§6.4) ·
Res (§6.5) · Guest (§6.6) · AbnbOp (§6.7 Airbnb operator–owner) ·
Compl (§6.8) · Inc (§6.9) · Comms (§6.10) · AI (§6.11).

---

## 10. Cross-cutting foundations

Plan once, not per pillar. These get harder the later we touch them.

1. **Identity & multi-tenant RBAC.** Today: 3 roles, single building. Need:
   ~12 personas, multiple buildings, multi-property operators, per-unit
   subtypes (Payout/Calendar), per-pillar permissions, lifecycle-aware roles
   (buyer → owner → ex-owner). Plan auth modes for non-Gmail audiences
   (guards, vendors, residents, guests, sales leads).
2. **Workflow & notification engine.** SLA, escalation, templating today
   live inline in `server.js`. With ~25+ request types in operator-owner
   alone — and dozens more once admin/facilities/sales come online — this
   has to become a declarative engine.
3. **Audit trail.** Standard helper enforced for every write across pillars.
4. **Document & credential storage.** One vault layer with versioning,
   retention, encryption, e-sign. Used by operator-owner, building admin,
   facilities (manuals, warranties), sales (contracts), compliance.
5. **Payments & money.** First touched in H1 (operator expense ledger, no
   movement), then H2 (HOA fees recurring), then H3 (sales contract
   milestones, very different rails). Multi-currency. Provider choice for
   COP (Wompi / Mercado Pago / ePayco) and milestone/escrow flows for sales.
6. **Code structure.** Per-pillar split of `server.js` and `App.jsx` is a
   precondition for H2.
7. **Mobile / PWA.** Multiple persona-specific surfaces; PWA-first.
8. **AI service layer.** Drafting, triage, translation, anomaly detection.
   Cross-cutting from H1; do not bolt onto each pillar.
9. **Data privacy & retention.** Habeas Data for residents, guests, leads,
   visitors. Policy must land before H3 (buyer leads PII) and is mandatory
   before H4 (guest authority data).
10. **Integrations & API.** Read-only owner API first. PMS / OTA inbound
    (operator-owner). Accounting outbound (Siigo, QuickBooks) for fees +
    sales. IoT inbound (facilities). E-sign (sales). Banking (payments).
    CRM (sales).

---

## 11. Decisions to lock before each horizon

### Before H1 ships

Multi-owner / inbox / pricing / contract — the blocking question lists from
`../modules/operator-portal/USE_CASE_DISCOVERY.md` (MO-1..5, SLA-1/2, TEAM-1, THREAD-1, PRICE-1, G, I,
D, CONTRACT-1..5). See that document for full text. Plus:

- [ ] Operator billing model (operator-paid, off by default until wired).
- [ ] Email-only notifications confirmed for H1.
- [ ] Pilot building (Morros KAI 317 + 1 more unit).

### Before H2 starts

- [ ] Auth modes for non-Gmail personas (guards, residents, vendors).
- [ ] Multi-building tenancy: one Supabase with `community_id`, or one
      project per building?
- [ ] Code structure: per-pillar split before first H2 module.
- [ ] HOA-fees payment provider for COP.
- [ ] Document storage backend (Supabase Storage vs S3 + CDN).
- [ ] Resident vs owner — same record with role flag, or separate persona
      tables?
- [ ] Facilities work orders vs Operator-Owner service requests — shared
      "work order" entity with type discriminator, or two separate models?

### Before H3 starts (Sales & Lifecycle)

- [ ] Are we serving developers ourselves, or is this a future-build for KAI
      to license to developers? (Affects schema multi-tenancy.)
- [ ] Sales contract storage: KAI as e-sign integrator, or just document
      vault + manual signature?
- [ ] Milestone payment rails: bank transfer reconciliation only, or
      platform-mediated escrow?
- [ ] Warranty period defect routing: developer-employee accounts vs.
      developer-as-vendor?
- [ ] Lead capture: KAI-native or HubSpot/Salesforce integration?
- [ ] Resale workflow: how much history transfers to the new owner?

### Before H4 starts (Compliance & Tourism)

- [ ] Does KAI file SIRE / RNT, or just generate the file an operator
      submits?
- [ ] Tourism tax remittance — platform of record vs. report-only.
- [ ] Guest auth model if any — phone+OTP, email link, signed URL only.
- [ ] PII retention policy (Habeas Data) finalised and reviewed by counsel.
- [ ] Data subject access request workflow.

### Before H5 starts (Intelligence & Scale)

- [ ] AI provider (Claude API, OpenAI, on-prem) — cost ceiling and PII
      handling.
- [ ] Mobile strategy: one PWA shell per persona, or a single shell with
      role-aware views?
- [ ] Public API auth (per-owner read-only key vs. OAuth).

---

## 12. Risks worth naming early

- **Audience myopia.** Treating the operator-portal design principles
  (inbox-first, enforced approval gates, zero-credentials-in-chat) as
  universal across all pillars produces wrong UX for sales, facilities,
  amenity reservations, etc. Each pillar deserves its own discovery.
- **Role-name conflation.** Calling building front-desk staff or facilities
  leads "operators" — or talking about "the building operator" — collapses
  two completely different roles (Airbnb listing manager vs. building admin)
  into one bucket. Enforce the §1 terminology lock in UI copy, role names,
  permission keys, and email templates.
- **Scope creep into specialist tools.** Channel manager, full ERP, full
  CRM, e-sign, banking are huge products. Integrate; don't replace.
- **Persona expansion outpacing RBAC.** Going from 3 roles to ~12 without a
  foundation rewrite produces a permissions tangle. Pay it down in H1.
- **WhatsApp gravity (operator-owner only).** Replacing the chat is *the*
  product thesis for H1. If pilot users keep a parallel WhatsApp thread for
  the same items, H1 has failed regardless of what shipped.
- **Inbox-last instead of inbox-first (operator-owner).** Building contract
  / pricing / vault as standalones before the inbox core means rebuilding
  their UX twice.
- **Compliance underestimation.** SIRE / RNT / tax / Habeas Data look like
  modules but are regulated workflows with legal exposure. H4 is half
  product / half ops + legal.
- **Sales pillar requires different commercial dynamics.** A developer is
  the customer for §6.1; an HOA is the customer for §6.2; an operator is
  the customer for §6.7. The platform must be sellable to each without
  bundling them.
- **Single-file architecture compounding.** Every pillar adds modules; if
  we don't split before H2, we'll spend H3 fighting the codebase.
- **Per-stay photo log skipped or partial (operator-owner).** Without it,
  AirCover claims fail and the two-path damage workflow is theatre.
- **Lifecycle-aware identity.** A buyer becomes an owner becomes a seller.
  History must transfer cleanly without losing audit, threads, or warranty
  context.

---

## 13. What this document is not

- It is not a release plan with dates. The phase weeks in
  `../modules/operator-portal/PROPOSAL.md` and the token estimates in
  `../modules/operator-portal/USE_CASE_DISCOVERY.md` are still the source of truth for H1.
- It is not a commitment to build every module listed in §6. Many will turn
  into "buy/integrate" or "wontbuild" once we get closer.
- It is not a UI spec. UI work for each horizon is owned by the design docs
  for that scope (today: `../modules/operator-portal/DESIGN.md`).
- The seven design principles in §4.1 are operator-portal-specific. Other
  pillars need their own discovery.

If something here contradicts a more specific doc inside the horizon we are
currently executing, the specific doc wins. This file is the map, not the
territory.
