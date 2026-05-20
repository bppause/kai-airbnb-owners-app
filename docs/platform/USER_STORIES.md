# User Stories

> **Status:** living document.
> **Companions:** [`PLATFORM_ARCHITECTURE.md`](./PLATFORM_ARCHITECTURE.md) (slugs and
> module taxonomy), [`ROADMAP.md`](./ROADMAP.md) (horizons), [`DESIGN.md`](./DESIGN.md)
> (platform-wide design), per-module READMEs under `../modules/<slug>/`.

This is the platform's catalogue of **user stories** across all modules and
personas. Stories are grouped by module (following the locked slugs in
`PLATFORM_ARCHITECTURE.md` §3) and then by persona within each module.

## How to read this document

- **Format:** *"As a [persona], I want to [capability] so that [outcome]."*
- **Status badges per story:** `[live]` shipped today · `[concept]` covered
  by an approved design · `[idea]` aspirational, from the module README's
  scope sketch.
- A module section's status (live / concept / idea) is inherited from its
  README and `PLATFORM_ARCHITECTURE.md` §3, but **individual stories can
  carry a different badge** — e.g. an idea-status module may have one or
  two `[concept]` stories that came from a partial design.
- Stories are intentionally one-liner; acceptance criteria belong in each
  module's `DESIGN.md` when it lands.
- "Building admin" is the canonical term for the HOA / community admin
  (delegate or global). See `ROADMAP.md` §1 Terminology lock for the
  operator-vs-admin distinction.

## Personas (locked, from `ROADMAP.md` §5)

| Persona | One-line role |
|---|---|
| **Payout Owner** | Owner with financial approval rights for a unit; one per unit |
| **Calendar Owner** | Co-owner with read-and-thread access; financials hidden; ≥0 per unit |
| **Airbnb operator** | Listing manager / co-host running STR on units; may operate many across buildings |
| **Airbnb operator's team** | Cleaning / supervision / logistics / guest support staff reporting to the operator |
| **Building admin** | HOA / community admin (delegate or global) — owns facility/complex operations |
| **Board / committee member** | Elected resident with governance powers |
| **Resident / renter** | Long-term tenant who is not necessarily an owner |
| **Facilities team** | Building engineer / common-area maintenance / common-area cleaners — reports to building admin |
| **Guard / front desk / concierge** | Reports to building admin; operates the entrance and common areas |
| **Vendor / contractor** | External service provider with scoped, time-bounded access |
| **Guest (Airbnb)** | Stays in a unit during an STR booking — *impact-only persona inside KAI* |
| **Visitor / delivery** | One-shot guest of a resident or owner |
| **Property developer / sales team** | Owns the unit before handover; participates during warranty period |
| **Buyer / pre-owner** | Pre-handover purchaser; later becomes Payout Owner |
| **Tourism authority / regulator** | Consumer of structured compliance reports (SIRE, RNT, tax) |
| **External buyer / agent** | Brokers and prospective buyers during resale |

---

## Cross-cutting / platform stories

These do not belong to any single module. They are the platform contract.

### Identity, auth, and roles

- `[live]` As any user, I want to sign in with my Google account so that I do not need to remember a separate password.
- `[concept]` As a global admin, I want to grant the `operator` role to a specific user so that they can access the operator portal.
- `[concept]` As a global admin, I want to grant per-community delegate-admin permissions so that day-to-day work can be distributed.
- `[idea]` As a guard / vendor / resident without a Gmail account, I want to sign in via magic-link, phone OTP, or shared kiosk so that I can use the surface intended for me.
- `[concept]` As a Payout Owner, I want to opt my unit out of a specific community's surface so that I keep ownership without exposure to that community's flows.
- `[live]` As a system, I want every write to be recorded in the audit log so that any decision can be traced back to its actor.

### Notifications

- `[live]` As any user with notifications enabled, I want to receive an email when something on my plate is overdue.
- `[live]` As any user, I want to see an in-app badge counting items that need my action.
- `[idea]` As any user, I want to choose per-channel (email / in-app / WhatsApp / push) preferences per notification type so that I am not over-paged.
- `[idea]` As a building admin, I want my building's branding (logo, colours, mission text) reflected in outgoing emails so that residents recognise legitimate communication.

### Language & localisation

- `[live]` As a Spanish-speaking user, I want every screen, email and document to default to es-CO.
- `[live]` As an English-speaking user, I want to toggle the UI into English without restarting my session.
- `[idea]` As a future-market user, I want the platform to be ready to add my language without a redeploy.

### Privacy & data subject rights

- `[idea]` As a resident, owner, or guest, I want to request a copy of the data the platform holds about me (Habeas Data right).
- `[idea]` As a resident or guest who has left the property, I want my data retained only for the period the law requires, then deleted.
- `[idea]` As a building admin, I want to honour consent preferences (e.g. opt-out of marketing comms) on every channel.

---

## `incidents` — Community / Property Incident Management (live)

Current production module. Primary personas: Payout Owner, building admin, Calendar Owner (read).

### Payout Owner

- `[live]` As a Payout Owner, I want to report an incident in my unit so that the building admin can act on it.
- `[live]` As a Payout Owner, I want to verify an incident the operator or building admin reported, providing guest names, city and country and optional comments, so that the record reflects what really happened.
- `[live]` As a Payout Owner, I want to mark an incident as resolved when the issue is fixed so that it stops appearing on my open list.
- `[live]` As a Payout Owner, I want to receive an email when a new incident affecting my unit is logged.
- `[live]` As a Payout Owner, I want to see the full audit trail on each incident so that I can confirm who said what and when.

### Calendar Owner

- `[live]` As a Calendar Owner, I want to see open incidents for my unit so that I am aware of issues without having to ask.
- `[concept]` As a Calendar Owner, I want to add a comment to an incident thread without taking the Payout Owner's approval action.

### Building admin (delegate or global)

- `[live]` As a building admin, I want a single screen showing all open incidents across the community so that I can prioritise my day.
- `[live]` As a building admin, I want to triage an incident (assign, escalate, close) with full audit logging so that decisions are traceable.
- `[live]` As a building admin, I want incidents to escalate automatically when SLA thresholds elapse so that nothing rots unattended.
- `[live]` As a building admin, I want to send a one-off email to a unit's owner from inside the incident so that I do not have to switch tools.
- `[live]` As a building admin, I want to edit SLA hours, escalation emails, and mission text without a redeploy so that I can tune behaviour per community.
- `[concept]` As a building admin, I want to see "repeat offender" units (recurring incidents) so that I can address root causes rather than symptoms.
- `[idea]` As a building admin, I want incidents to optionally feed into the `fines` workflow in `building-admin` when a rule violation is established.

### Airbnb operator (read-on-behalf, future)

- `[concept]` As an Airbnb operator with a unit linked to me, I want to see incidents on that unit so that I can act on the guest-experience impact without having to chase the owner.
- `[concept]` As an Airbnb operator, I want a clear "acting on behalf of [Owner]" badge on any action I take so that the audit trail remains honest.

### Guest impact (not a directly served persona)

- `[idea]` As a guest impacted by an incident, I want the operator or admin to be promptly notified through the platform so that the resolution time is shorter than a WhatsApp ping.

---

## `operator-portal` — Airbnb Operator–Owner Governance (concept)

Most-detailed module. Driven by `USE_CASE_DISCOVERY.md` (real-chat data) and
`PROPOSAL.md` (phased plan).

### Phase 0 — Login path split & operator role

- `[concept]` As a first-time user, I want a clear "I'm an owner / I'm an operator" choice before sign-in so that I land in the right view.
- `[concept]` As a user who is both owner and operator, I want to toggle between Owner view and Operator view from my profile so that I do not need two accounts.
- `[concept]` As a global admin, I want to grant or revoke the operator role for any user from the admin panel.
- `[concept]` As an owner, I want to opt my unit out of a specific community's incident queries so that I retain ownership without exposing my activity to that admin.

### Phase 1 — Operator identity & unit linking

- `[concept]` As an operator, I want to register with a business name, contact info, and the communities I work in so that owners can find me.
- `[concept]` As an operator, I want to search a unit by community + apt number and send a management proposal so that the owner can accept or decline.
- `[concept]` As an owner, I want to invite an operator by name or email from my unit view so that the operator can accept or decline.
- `[concept]` As either party, I want clear status indicators on each unit — *unmanaged / pending / actively managed* — so that there is no ambiguity.
- `[concept]` As an owner, I want to terminate the operator relationship with a warning if there are open service requests so that closure is deliberate.
- `[concept]` As either party after termination, I want history to remain visible in read-only mode so that nothing disappears with the relationship.
- `[concept]` As a Payout Owner, I want exactly one operator per unit at a time so that responsibility is unambiguous.
- `[concept]` As a Payout Owner of a unit with multiple owners, I want to grant Calendar Owner status to additional people so that they can participate in threads without seeing financials.

### Phase 2 — Operator multi-community console & owner read-only dashboard

- `[concept]` As an operator, I want one view of every unit I manage across every community so that I do not have to switch contexts by building.
- `[concept]` As an operator, I want units that need my attention to surface first so that triage is automatic.
- `[concept]` As an operator's team member, I want my daily assignment list across communities on my phone so that I can work without standing at a desktop.
- `[concept]` As a Payout Owner, I want a read-only dashboard with listing state, pricing schedule, ranking context, and review history so that I can see what is happening without asking.

### Phase 3 — Typed-request inbox (the core)

- `[concept]` As either party, I want every action item to appear in a unified attention inbox with type, status, SLA, and thread so that nothing is lost in chat.
- `[concept]` As an operator, I want to file a repair / cleaning / inspection / device / building-notice-relay request typed by category so that the owner sees the right context up front.
- `[concept]` As a Payout Owner, I want any cost above the contract threshold to wait for my explicit approval before work starts so that there are no surprise invoices.
- `[concept]` As an operator below the contract threshold, I want to file a repair FYI without an approval gate so that small jobs do not block.
- `[concept]` As an operator, I want to upload before/after photos and the invoice to close a service request so that disputes can be resolved with evidence.
- `[concept]` As any party, I want SLA timers to age yellow at 50% and red when overdue so that I see what is slipping at a glance.
- `[concept]` As an operator, I want a request automatically escalated if I have not acknowledged it within its SLA so that I cannot accidentally ignore it.
- `[concept]` As a Payout Owner, I want to see a per-stay inspection photo log so that any damage claim has a baseline.
- `[concept]` As an operator, I want a damage case routed automatically to the AirCover path (guest-caused) or the owner-insurance path (non-guest) so that the right documentation is collected.
- `[concept]` As an operator with a device (smart lock, AC, appliance), I want per-model instructions stored alongside the device so that a new team member can fix it on the first attempt.
- `[concept]` As a Payout Owner, I want repair invoices required to close a ticket so that "I'll send it later" is no longer possible.
- `[concept]` As an operator, I want non-guest cleaning costs (deep clean, owner-visit prep) to go through the same approval flow as repairs so that nothing slips through.
- `[concept]` As a building admin or any owner, I want to upload a building notice with an urgency flag and require operator acknowledgement so that guest-affecting issues do not sit for 35 minutes.
- `[concept]` As an operator, I want to submit an expense (utility bill, repair invoice) with no bank account fields anywhere on the platform so that financial details never live in chat.

### Phase 4 — Owner blocks & calendar

- `[concept]` As a Payout Owner, I want to request a calendar block for personal use distinct from a guest booking so that the operator does not quote me a guest rate.
- `[concept]` As an operator, I want a personal-use block to auto-create a cleaning request before the owner arrives so that the unit is ready.
- `[concept]` As either party, I want the system to flag conflicts between a proposed block and an existing booking so that I see the problem before confirming.

### Phase 5 — Bidirectional pricing

- `[concept]` As either party, I want to propose a price change (base / weekend / season / peak / discount / cleaning fee) and have the other party confirm, counter, or reject so that no rate changes at 1am as a fait accompli.
- `[concept]` As a Payout Owner, I want to see a ranking-impact preview before confirming a rate change so that I do not learn 10 days later that the new rate killed bookings.
- `[concept]` As either party, I want every proposal, counter, confirmation, and rejection logged immutably so that "what did we agree?" is never a question.
- `[concept]` As either party, I want to schedule a future-dated rate change that auto-applies on a chosen date so that next year's pricing is locked in once and forgotten.
- `[concept]` As a Payout Owner, I want a 48h unanswered proposal to expire (not auto-approve) so that silence is never read as consent.
- `[concept]` As a Calendar Owner, I want to comment on a pricing proposal without my reply counting as approval so that the Payout Owner remains the decider.

### Phase 6 — Document vault, expenses & Listing Management Contract

- `[concept]` As an operator, I want a per-unit credential vault for RNT, TRA, warranties, and appliance manuals so that credentials never live in a chat group again.
- `[concept]` As either party, I want utility bills uploaded monthly with an automatic anomaly flag when a bill exceeds X% of the rolling average so that surprises are caught early.
- `[concept]` As either party, I want a Listing Management Contract with locked terms (fee, threshold, services included, notice period) drafted, countered, confirmed, and amendable through the platform so that "consult me first" disputes disappear.
- `[concept]` As either party, I want any amendment to follow the same propose / counter / confirm flow as the initial contract so that no term silently changes.
- `[concept]` As either party, I want a contract termination to record the notice date, the termination date, and whether active bookings carry through so that handover is unambiguous.

### Phase 7 — Operator team task management

- `[concept]` As an operator, I want to assign service-request work to a specific team member by name and role so that owners know who did what.
- `[concept]` As an operator's team member, I want a mobile-first daily task list with statuses (Arrived / In progress / Done + photo) so that I can update from the unit.
- `[concept]` As a Payout Owner, I want to see a named team directory with roles per unit so that "ACTB" and unknown phone numbers do not appear on my unit.

### Cross-phase

- `[concept]` As an operator, I want the system to remind me 12 days after checkout if a damage case is still open with no AirCover claim reference so that I do not miss the 14-day window.
- `[concept]` As a Payout Owner, I want to draft a host response to a review and have it ready for the operator to publish so that the public response reflects the owner's voice.
- `[concept]` As a Payout Owner, I want to flag a specific guest as blocked from my unit so that the operator does not accept a repeat booking I do not want.
- `[concept]` As either party, I want a listing-change request (title, description, photos, amenities, house rules) to follow the same proposal flow as pricing so that nothing is changed unilaterally.
- `[concept]` As either party, I want a listing-change request to surface the platform's constraints (e.g. Airbnb 50-char title limit) up front so that I do not discover them mid-edit.

---

## `building-admin` — HOA / Community Administration (idea)

### Building admin (delegate or global)

- `[idea]` As a building admin, I want a single resident & owner directory linking residents to units (including renters and emergency contacts) so that "who lives in 504?" has one answer.
- `[idea]` As a building admin, I want to publish recurring HOA fees and track payment status per unit so that dunning is data-driven.
- `[idea]` As a building admin, I want to issue a fine against a unit (linked to an incident when applicable) with a contestable workflow so that violations have due process.
- `[idea]` As a building admin, I want to waive a fine with a recorded reason so that exceptions are auditable.
- `[idea]` As a building admin, I want to upload meeting minutes and board documents into a searchable, multilingual library so that history is findable.
- `[idea]` As a building admin, I want to open a poll among owners or residents with a configurable audience and quorum so that decisions can be recorded.

### Board / committee member

- `[idea]` As a board member, I want to read the latest minutes and pending agenda from any device so that I can prepare without email attachments.
- `[idea]` As a board member, I want to vote on an open poll and see the live tally if voting is public, or the closed result if it is anonymous.

### Resident / renter

- `[idea]` As a resident, I want to see my unit's outstanding fees and download a statement so that I can pay without phoning the admin.
- `[idea]` As a renter (not the owner), I want my contact and emergency info on file so that the admin can reach me even if the owner is away.

### Payout Owner

- `[idea]` As a Payout Owner, I want my unit's annual budget contribution, reserve-fund share, and special assessments visible so that I know what I owe ahead of time.

---

## `front-desk` — Front Desk, Access & Visitor Management (idea)

### Resident / renter / owner

- `[idea]` As a resident, I want to pre-register an expected visitor with a date, time window, and ID number so that the guard checks them in without phoning me.
- `[idea]` As a resident expecting a delivery, I want the guard to receive it, photograph it, and notify me so that I do not have to be home.

### Guard / front desk / concierge

- `[idea]` As a guard, I want a real-time event stream of visitors, packages, and gate events so that I can see what is happening on my shift at a glance.
- `[idea]` As a guard, I want to rotate access codes for ex-staff and ex-vendors in one click so that orphaned codes do not linger.
- `[idea]` As a guard ending my shift, I want to leave a shift note that the next guard sees so that handover is not verbal-only.
- `[idea]` As a guard, I want to escalate any anomaly into the `incidents` module so that the building admin sees it without a separate channel.
- `[idea]` As a guard at a building without my own Gmail, I want a kiosk PIN or shared-tablet sign-in so that I can do my job without a personal device.

### Building admin

- `[idea]` As a building admin, I want a parking and vehicle registry (owner, resident, visitor) with violation logging so that towing has a paper trail.
- `[idea]` As a building admin, I want a Lost & Found log with item photo and pickup confirmation so that we stop misplacing umbrellas.

### Visitor / delivery (impact)

- `[idea]` As a visitor, I want a one-shot building-entry code valid only for my expected window so that I do not need a permanent badge for a one-hour visit.

---

## `resident-experience` — Resident / Renter Portal (idea)

### Resident / renter / owner-as-resident

- `[idea]` As a resident, I want a single home view with notices, fees due, my packages, my visitors, my open maintenance items, and my reservations so that I do not check five places.
- `[idea]` As a resident, I want to reserve the pool, BBQ, gym, meeting room, parking, or visitor space per the building's per-amenity rules so that I do not phone the admin.
- `[idea]` As a resident, I want amenity conflicts and capacity limits enforced automatically so that double-bookings do not happen.
- `[idea]` As a resident, I want to pre-register a visitor or vehicle myself so that I do not phone the guard.
- `[idea]` As a moving-in resident, I want a move-in checklist with inventory, key handoff, deposit receipt, and condition photos so that the move is recorded.
- `[idea]` As an owner-resident *not* using an Airbnb operator, I want to open a maintenance request directly with the building admin or facilities team so that small fixes have a place to live.

---

## `facilities` — Common-Area Maintenance (idea)

### Building admin

- `[idea]` As a building admin, I want a common-area asset register (elevators, generators, pumps, pool equipment, HVAC, lighting) with warranties and lifecycle so that nothing is forgotten.
- `[idea]` As a building admin, I want preventive maintenance schedules per asset that auto-create work orders on the right cadence so that compliance with manufacturer schedules is automatic.
- `[idea]` As a building admin, I want to maintain an approved vendor list with insurance / COI tracking, ratings, and access windows so that nobody unverified gets a contract.

### Facilities team

- `[idea]` As a facilities team member, I want a daily work-order list with photo and note-back per job so that closures are evidenced.
- `[idea]` As a facilities team member, I want a periodic-inspection workflow with required photos so that "we inspected the roof in March" can be proven.

### Vendor / contractor

- `[idea]` As an approved vendor, I want a scoped read-only view of work orders assigned to me with access windows so that I do not need access to anything I do not need.
- `[idea]` As an approved vendor, I want to upload an invoice and have the building admin acknowledge receipt so that I do not chase by WhatsApp.

### Resident / guard (source)

- `[idea]` As a resident or guard, I want to report a common-area issue (leaking pipe in the lobby, dim staircase light) so that it becomes a tracked work order, not a forgotten WhatsApp message.

---

## `property-development-lifecycle` — Pre-sale through Resale (idea, with placeholder proposal)

See [`../modules/property-development-lifecycle/PROPOSAL.md`](../modules/property-development-lifecycle/PROPOSAL.md) for phased detail.

### Property developer / sales team

- `[concept]` As a sales rep, I want to capture leads with UTM and source attribution so that lead-to-buyer conversion is measurable.
- `[concept]` As a developer, I want milestones per project (foundation, structure, façade, finishes, handover) with photo galleries so that buyers see progress without phoning.
- `[concept]` As a developer, I want defect patterns aggregated across acta findings by typology so that we learn from one buyer's findings before the next.
- `[concept]` As a developer, I want warranty claims routed to me (not the operator or admin) with a per-project dashboard so that the legal claim windows are visible.
- `[concept]` As a developer, I want to mark a claim closed with the owner's explicit approval so that we cannot unilaterally close disputes.

### Buyer / pre-owner

- `[concept]` As a buyer, I want a portal showing my reserved unit, my contract, my payment plan, and the project's progress so that I do not need to phone for updates.
- `[concept]` As a buyer, I want a reminder before each milestone payment so that I do not miss a date.
- `[concept]` As a buyer, I want the pre-delivery inspection (acta de entrega) to log my findings with photos and remediation deadlines so that subsequent disputes have a record.
- `[concept]` As a buyer at handover, I want a digital packet of manuals, warranties, keys and codes so that day one in the unit is not paperwork-soup.
- `[concept]` As a new Payout Owner just past handover, I want my identity to seamlessly become an owner record (same login, new view) so that I do not re-onboard.

### Building admin

- `[idea]` As the receiving building admin, I want new buyers populated into the resident directory at handover so that day one is not "who is this?".

### External buyer / agent (resale)

- `[idea]` As a Payout Owner listing for resale, I want to grant a broker scoped, time-bounded read-only access to my unit's history so that buyers can do diligence without me sharing credentials.
- `[idea]` As an external buyer's agent, I want a sales packet (maintenance history, valid warranties, HOA rules, documents) so that I am not waiting on email attachments.
- `[idea]` As the new Payout Owner post-resale, I want relevant history transferred while sensitive prior-pricing or income data is archived per privacy policy so that I inherit context without violating the prior owner's privacy.

---

## `guest-mgmt` — Guest & Visitor Stays (idea)

### Guest (Airbnb) — impact-only persona

- `[idea]` As a guest, I want a pre-arrival flow with ID upload and a building-rules acknowledgement so that arriving at the door is friction-free.
- `[idea]` As a guest, I want time-bounded building access (gate code, lock provisioning) only for my stay window so that I do not need to track keys.
- `[idea]` As a guest with an in-stay issue, I want to submit it from my phone and have it route to the operator first — and the building admin only on escalation — so that I am not bounced between contacts.
- `[idea]` As a guest, I want a digital guidebook (house manual, local recs, emergency) in my language so that I do not have to ask the operator.

### Airbnb operator

- `[idea]` As an operator, I want guest pre-arrival completions visible on my console so that I know which stays are ready and which still need attention.
- `[idea]` As an operator, I want a check-out inspection workflow that produces per-stay photos linked to the operator-portal's photo log so that AirCover claims have a baseline.

### Building admin / guard

- `[idea]` As a building admin, I want STR guests visible (arriving today / leaving today) without seeing guest PII beyond what is necessary so that the guard can do their job.

---

## `tourism` — Local Tourism Content (idea)

### Building admin / community-module admin

- `[idea]` As a community content editor, I want to curate a per-community content pack (dining, services, transport, emergency, language tips) so that every guest sees the same vetted recommendations.
- `[idea]` As a community content editor, I want to publish the pack as a public read-only landing page with a QR code so that an in-unit sticker is enough to surface the content.

### Payout Owner

- `[idea]` As a Payout Owner, I want to override a community recommendation with my own pick per unit so that my guests see my coffee shop, not the default.

### Airbnb operator

- `[idea]` As an operator, I want a single linkable URL with the building's content to paste into my Airbnb welcome message so that I do not maintain a duplicate guidebook.

### Guest (impact)

- `[idea]` As a guest, I want the tourism content in my language and updated for current closures so that I do not show up at a restaurant that closed last year.

---

## `compliance` — Regulatory, Insurance & Privacy (idea)

### Airbnb operator

- `[idea]` As an operator hosting a foreign guest, I want SIRE / Migración Colombia reports generated from the booking relay so that filing is one click, not a manual transcription.
- `[idea]` As an operator, I want RNT expiry reminders ahead of the lapse window so that registration never silently lapses.
- `[idea]` As an operator, I want tourism tax calculated per stay and a remittance report ready by the due date so that under-collection is no longer a risk.

### Building admin

- `[idea]` As a building admin, I want to register insurance policies (building, common areas) and their COIs so that incident-to-claim routing is fast.
- `[idea]` As a building admin, I want a building-rules library (STR caps per unit, quiet hours, pet rules, pool hours, fines policy) surfaced into `tourism` and `operator-portal` so that the rules are enforced where guests and operators see them.

### Payout Owner

- `[idea]` As a Payout Owner, I want to register my unit insurance policy (insurer, policy number, contact) so that the non-guest damage path has somewhere to land.

### Tourism authority / regulator

- `[idea]` As a tourism authority, I want structured monthly reports (occupancy, origin, length-of-stay) so that I do not chase individual operators for spreadsheets.

### Data-subject (any persona with PII on the platform)

- `[idea]` As a data subject under Habeas Data (Colombia), I want to request access, correction, or deletion of my personal data with a documented workflow so that the building can answer to me and to the regulator.

---

## `communications` — Targeted Comms, Polls & Notifications Backplane (idea)

### Building admin

- `[idea]` As a building admin, I want to publish an announcement to a targeted audience (building-wide, per-floor, owners-only, residents-only, operators-only) with delivery tracking so that I know who read it.
- `[idea]` As a building admin, I want to open a poll among any of the same audiences with audit-logged responses so that decisions are recorded.
- `[idea]` As a building admin, I want every comms surface to honour the recipient's language and consent preferences so that I do not over-page anyone.

### Board / committee member

- `[idea]` As a board member, I want to publish meeting minutes linked to the relevant governance items and searchable across languages so that institutional memory is preserved.

### Any module (system actor)

- `[idea]` As any module (incidents, operator-portal, building-admin, front-desk, resident-experience), I want to publish notifications through one shared engine — email + in-app today, WhatsApp + push later — so that audience, language, and consent are solved once.

---

## `analytics` — Cross-Module KPIs, Scorecards & AI (idea)

This module is intentionally promoted last; its shape depends on the modules it
aggregates.

### Building admin

- `[idea]` As a building admin, I want a KPI dashboard (open incidents, repeat offenders, SLA compliance, fees collected, occupancy) so that "how is the building doing this month?" has a screen.
- `[idea]` As a building admin, I want a Building Health Score composite of facilities, compliance, satisfaction, and incidents so that I can show the board one number that summarises operations.

### Payout Owner

- `[idea]` As a Payout Owner, I want an investment view with cap rate, RevPAR proxy, and comps so that I see how my unit is performing without leaving the platform.

### Airbnb operator

- `[idea]` As an operator, I want my own scorecard (incidents, response time, complaints, reviews) so that I can see trends before owners do.

### Property developer / sales team

- `[idea]` As a sales lead, I want sales-funnel analytics (lead → reservation → contract → handover by source / cohort) so that marketing spend is measurable.

### Cross-module anomaly detection

- `[idea]` As any party, I want anomaly alerts (utility bill > X% of average; conflated damage cases on the same item; access-pattern anomalies) so that I am notified of problems before they bite.

### AI assistance

- `[idea]` As an operator or admin, I want AI-drafted replies / translations / triage suggestions so that the platform reduces my admin load — without making decisions for me.

---

## Coverage map

| Module | Status | Story count (approx.) |
|---|---|---|
| Cross-cutting | n/a | ~15 |
| `incidents` | live | ~15 |
| `operator-portal` | concept | ~55 |
| `building-admin` | idea | ~10 |
| `front-desk` | idea | ~10 |
| `resident-experience` | idea | ~6 |
| `facilities` | idea | ~7 |
| `property-development-lifecycle` | idea (with proposal) | ~13 |
| `guest-mgmt` | idea | ~7 |
| `tourism` | idea | ~5 |
| `compliance` | idea | ~8 |
| `communications` | idea | ~5 |
| `analytics` | idea | ~7 |

When a module is promoted from `idea` → `concept`, its stories migrate (or are
refined) into the module's own `DESIGN.md` with acceptance criteria. This
document continues to be the cross-module index.

## What this document is not

- It is not a backlog. Stories here are not implementation tickets; they are
  the platform's catalogue of intent.
- It is not exhaustive. Each module's `DESIGN.md` (when it lands) is the
  source of truth for that module's full story set with acceptance criteria.
- It is not a roadmap. See [`ROADMAP.md`](./ROADMAP.md) for horizon order
  and decisions-to-lock per horizon.
