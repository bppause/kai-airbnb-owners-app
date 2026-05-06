# Use Case Discovery & Claude Max Cost Reference
# KAI Operator Portal

> Reference document — May 2026  
> Companion to: `PROTOTYPE_READINESS.md`, `OPERATOR_PORTAL_PROPOSAL.md`

---

## Primary Objective

**KAI replaces the WhatsApp group that today connects the operator (host), owner (co-host), and team members for a unit.**

### The Current Reality

Every unit managed by an operator has a WhatsApp group. In that group: the operator posts guest issues, repair requests, pricing questions, booking updates, team photos, utility bills, and general updates. The owner responds when they see it. Team members post check-in/out confirmations and repair photos. The result:

- Requests get buried under new messages and are never followed up
- No clear owner for each item — "is this resolved or are we still waiting?"
- No SLA — urgent issues sit unacknowledged for hours
- No next-action clarity — "is the ball in my court or yours?"

---

## Real WhatsApp Patterns — Morros KAI 317

*Observed from a real 7-month chat (Oct 2025 – May 2026) between Brian and Martha Pause (co-hosts) and Luxury Rentals / Oscar Lindo (operator) plus team members Paula Ramirez, Samira Ferrer, Andrea, Camila del Valle, ACTB, CDVR.*

### Interaction Frequency (Actual)

| Type | Occurrences | Follow-ups required | Resolved in chat? |
|---|---|---|---|
| Pricing change request | 8 | High (multiple rounds) | Partially — no audit trail |
| Photo / listing update | 6 | Medium | Yes but slow |
| Scheduling coordination | 5 | High (owner initiates all) | Mostly |
| Maintenance request / approval | 4 | High (invoices never arrived) | Partially |
| Role / responsibility confusion | 4 | Medium | Rarely |
| Platform policy question | 4 | Low | Yes |
| Regulatory / compliance (RNT, TRA) | 3 | High (credentials shared twice) | Poorly |
| Guest rule / policy clarification | 3 | Low | Yes |
| Review management | 3 | Low | Yes |
| Urgent building / utility notice | 3 | High (35-min response gap) | Yes |
| Receipts / invoices follow-up | 3 | Very high (asked 3× over 3 weeks) | No |
| Co-host / platform access | 3 | High (always denied or unexplained) | No |
| Damage claim / AirCover | 2 | High (double-billing confusion) | Partially |
| Personal use / owner block | 2 | Medium | Yes |
| Smart lock / device issue | 1 | Critical (6+ follow-ups, 10 days) | Barely |
| Financial transaction in chat | 3 | N/A | Yes — but dangerously |

### Critical Behavioral Findings

**1. Owners are highly engaged and capable — not passive.**
Brian built an AI pricing tool, runs market research, creates Instagram accounts, monitors competitor listings. Martha tracks compliance, coordinates vendors, follows up on building issues. The operator treats them as passive clients; they are not. KAI must give them appropriate visibility and lightweight control.

**2. The follow-up burden falls entirely on owners.**
In every multi-step task — receipts, lock batteries, photo updates, listing corrections — owners initiated all follow-ups. The operator never proactively closed the loop. **KAI should make the open-loop visible and require operator closure confirmation.**

**3. Operator acts first, informs later.**
The 2027 10% rate increase was communicated at 1am as a near-done deal. The AC repair was started before owner approval was fully obtained. Owners said "consult me first" but the group format doesn't enforce it. **KAI enforces the approval gate before action, not as a courtesy.**

**4. Financial and credential hygiene is nonexistent.**
Bank account numbers (Bancolombia), Nequi handles, RNT login credentials, and payment confirmations all appear in the WhatsApp group in plain text. No access control. No audit log. No recovery path. **Zero financial transactions or credentials should pass through KAI chat — all routed through structured, encrypted flows.**

**5. Owners want visibility, not total control.**
The recurring ask is not "let me run everything" — it is "let me see what's happening." Guest profiles, listing changes, pricing, damage status, cleaning confirmation. A read-only owner dashboard would resolve ~60% of the follow-up volume. The specific ask: "Can I update the price myself?" and "Can I edit the listing?" were both repeatedly denied.

**6. Trust erodes through small repeated failures.**
The Yale smart lock battery: a trivial task, 6+ follow-ups over 10 days, still not confirmed resolved. Receipts requested 3× over 3 weeks, never received. These accumulate. By late April, Brian's tone is visibly skeptical in every message. **KAI prevents this by making every open item visible to both parties with aging timers.**

**7. Team roster is opaque to owners.**
Martha and Brian don't know who ACTB, CDVR, or the unnamed phone numbers are. When a team member adds another to the group, there's no introduction. Responsibilities are unclear (who handles reviews? who does logistics? who does RNT?). **KAI shows owners a named team directory with roles.**

### Pain Points by Interaction Type (From Real Chat)

#### Maintenance & Repairs
- Operator brought a technician without pre-authorization → owner said "consult me first"
- Payment (150k COP) requested via Nequi in group chat → no invoice, no platform record
- Invoices requested 3× over 3 weeks, never delivered
- Two separate end table damage incidents conflated → owner: "We just paid to have this fixed, why are we paying again?"
- **KAI fix:** Approval threshold (auto-approve below X, gate above X). Invoices required to close ticket. Payment via platform ledger. Per-incident photo log prevents conflation.

#### Pricing
- Rate changes communicated at 1am as near-final
- Owner repeatedly denied ability to update prices directly
- Algorithm ranking impact (price → position) only surfaced after 10 days of no bookings at new rate
- Confusion between base rate / weekend rate / 2026 rate / 2027 rate all at once
- **KAI fix:** Bidirectional proposal with confirmation. Owner sees proposed rate, ranking impact preview, and competitor range before confirming. Full rate schedule visible (base, weekend, seasonal, per-year).

#### Photo & Listing Updates
- Operator downloaded Dropbox photos one by one — manual friction
- Owner had to screenshot specific photos to communicate which to delete
- Title character limit (50 chars on Airbnb) discovered mid-execution
- Owner asked multiple times to get direct listing edit access — always denied
- **KAI fix:** Listing update module where owner uploads assets in bulk, sets order, annotates. Operator reviews and publishes. Platform constraints surfaced in UI before submission.

#### Smart Lock / Device Management
- Yale battery critical warning: 10+ days and 6+ owner messages to resolve
- Team didn't know how to open the lock cover → owner sent YouTube tutorial
- Cleaning staff couldn't change batteries during active guest stay
- Brian had to send same video twice, @mention 4 different team members
- **KAI fix:** Device/maintenance ticket with owner, operator, and assigned staff. Step-by-step instructions stored per device model. Escalation auto-triggers if unresolved within SLA. Closure requires photo proof.

#### Co-host Access & Platform Visibility
- Martha's co-host status existed but she couldn't see guest profile details after an Airbnb app update
- Brian asked 5+ times across different dates whether he could update prices or ranking data himself
- Platform answers: always no or redirect — with no explanation
- **KAI fix:** Owner dashboard with: guest summary per booking, current listing state, pricing schedule, review history, ranking context — independent of Airbnb co-host permission level.

#### Financial Transactions
- Bancolombia account (Oscar Lindo, Cedula 1050951054) posted in group chat
- Nequi 3004232674 for AC advance payment, Nequi 3052166010 for owner block
- RNT credentials shared in group chat twice
- **KAI fix:** Expenses submitted through platform. Owner approves and payment acknowledged through ledger. Zero bank details in any chat field. Document vault for credentials.

#### Building / Community Notices
- Martha acts as the bridge between building administration and the operator group
- Urgent water utility notice at 8pm — 35-minute wait for operator response while guests potentially affected
- Road protest at 7:54am — owner relaying, operator never confirmed awareness
- **KAI fix:** Building notice type with urgency flag. Operator must acknowledge within SLA. If guest-impacting, system prompts operator to message guest on Airbnb.

#### Damage Claims
- Two separate incidents on same piece of furniture over 5 weeks caused billing confusion
- No per-stay photo record to prove which guests caused which damage
- AirCover 14-day window nearly missed; process opaque to owners
- Damage claim strategy discussed in group (charge guests vs. warranty vs. absorb)
- **KAI fix:** Per-stay check-in / check-out photo log with timestamp. Each damage incident gets a unique case linked to a specific stay. AirCover claim package (photos, description, invoice) compiled from within KAI.

### New Use Cases Identified from Real Chat

| Use case | Source in chat | Priority |
|---|---|---|
| **Device/IoT management** (smart locks, AC, appliances with status and fix instructions) | Yale lock battery 10-day saga | High |
| **Credential vault** (RNT, TRA, warranties, appliance manuals — per unit, access-controlled) | RNT credentials shared in plain text twice | High |
| **Pre/post stay photo log** (timestamped, linked to booking, basis for damage claims) | End table double-billing confusion | High |
| **Owner read-only dashboard** (guest summary, current listing state, pricing, ranking) | Brian asked 5+ times for visibility | High |
| **Team directory visible to owners** (name, role, responsibilities, who to contact for what) | ACTB/CDVR unknown to owners | Medium |
| **Pricing with ranking impact preview** (show estimated Airbnb position before confirming rate change) | Paula's ranking chart surfaced 10 days late | Medium |
| **Annual / scheduled rate change** (set future date, rate takes effect automatically) | 2027 pricing discussion spanning weeks | Medium |
| **Discount structure management** (last-minute, early-bird, weekly, monthly — per unit) | Four discount types discussed, applied manually | Medium |
| **Review dashboard with draft approval** (owner sees draft response, approves or edits before publishing) | ACTB manages reviews; owners unaware | Medium |
| **Guest block list** (owner can request operator block a specific guest from their unit) | Martha: "block her from my apartment" | Low |
| **Building notice ingestion** (owner uploads notice, operator must acknowledge, if guest-impacting prompts action) | Martha relays all building comms | Medium |
| **Personal use booking flow** (distinct from guest booking — no guest rate, includes cleaning scheduling) | Feb 20 personal visit — quoted guest rate | Medium |
| **Platform policy reference** (Airbnb rules: character limits, what links are allowed, bed counting rules) | Title limit, Instagram link prohibition, sofa bed counting discovered mid-task | Low |
- No audit trail — "wait, did we agree to that price?"
- No separation by unit — multi-unit operators and owners mix all units in one or multiple groups
- Team members see owner/operator financial discussions they shouldn't
- Owner has no visibility into response times or patterns

### What KAI Replaces

Every WhatsApp message that requires action becomes a **typed, trackable request** with:

| Field | What it replaces |
|---|---|
| **Type** | The topic buried in the message (repair / guest issue / pricing / task / FYI) |
| **Owner** | Who is responsible right now ("ball in your court" clarity) |
| **Status** | Open → In Progress → Awaiting Response → Resolved |
| **SLA timer** | How long since last action, and when it becomes overdue |
| **Thread** | Follow-up messages stay attached to the original request, not lost in the group |
| **Visibility** | Only the right people see it (owner ↔ operator, team only sees their assignments) |

### The Unified Attention Inbox

Both the operator and the owner see the same concept: **"What needs me right now?"**

- Items where the ball is in your court are surfaced first
- SLA timers show aging — yellow at 50% of SLA, red when overdue
- Items awaiting the other party are visible but deprioritized
- Completed items are archived and searchable, not lost

---

## Scope Boundary — What KAI Does Not Own

**Guest tracking and payouts are out of scope.** These are handled entirely by Airbnb and other listing platforms:

| Out of scope — handled by Airbnb | In scope — handled by KAI |
|---|---|
| Guest profiles, booking details, stay dates | Request threads tied to a stay (repair, guest issue, block) |
| Payout calculations and remittances | Repair approval threshold, invoice delivery |
| Revenue splits and statements | Pricing change proposals (bidirectional confirmation) |
| Review responses on Airbnb | Review visibility and draft approval workflow |
| Calendar sync and booking confirmation | Owner-initiated date blocks (personal use, maintenance) |
| Airbnb messaging with guests | Operator → Owner notifications when guest action is needed |

KAI is the **relationship management layer** between operator and owner. The listing platform (Airbnb, VRBO, etc.) remains the source of truth for bookings, guest data, and money.

---

## Platform & Role Model (Locked)

### Airbnb as Primary Platform

The operator manages listings primarily on **Airbnb**. Other platforms (VRBO, Booking.com, direct booking) are supported by allowing the owner to register which platforms their unit is listed on — but Airbnb is the reference model for all host/co-host workflows.

### Host / Co-Host Role Mapping

| Airbnb Role | KAI Role | Responsibilities |
|---|---|---|
| **Host** (primary) | **Operator** | Owns the listing, manages calendar and pricing, responds to guests, arranges cleaning, handles Airbnb relationship and AirCover claims |
| **Co-Host — Payout** | **Payout Owner** | Financial approval rights (repairs, pricing); full thread participation; receives payout on Airbnb directly |
| **Co-Host — Calendar** | **Calendar Owner** | Views calendar and date blocks; no financial visibility in KAI; full thread participation |

### Multiple Owners Per Unit

A single unit can have **multiple owners (co-hosts)**, each with a different access level in KAI:

- **Payout Owner** — exactly one per unit. Has approval rights on financial requests (repairs above threshold, pricing proposals). Participates in all request threads. Payout happens on Airbnb, not tracked in KAI.
- **Calendar Owner** — one or more per unit. Can see booking calendar context (dates, blocks) and participate in request threads. Repair costs and financial figures are hidden.
- **All owners** can read and reply in KAI request threads — mirroring their current WhatsApp group participation.

**Open questions this raises (see section below):**
- For requests requiring owner approval (repair, pricing), does only the Payout Owner approve, or can any owner approve?
- If a Calendar Owner posts in a request thread, does the operator see them as a co-owner or as a separate contact?
- Can a Calendar Owner initiate requests (e.g. task request to the operator), or is that Payout Owner only?

---

## Claude Max Plan — Token Usage Estimates Per Phase

### How to read these estimates

Claude Max ($100/month) is a flat subscription. The estimates below reflect approximate
token consumption if you used Claude Code as the sole implementation tool for each phase.
Token ranges assume this codebase's context size (App.jsx ~9,400 lines, server.js large,
plus schema and config files loaded per session).

**Session token profile for this codebase:**
- File reads per session: ~15,000–40,000 input tokens
- Code generation per session: ~5,000–25,000 output tokens
- Back-and-forth iterations: ~10,000–30,000 tokens total per session
- Typical session total: ~30,000–95,000 tokens

**Claude Max $100/month ≈ equivalent of ~3–5M API tokens/month** (varies with model mix and rate limits). The $200/month plan roughly doubles that.

---

### Per-Phase Token Estimates

| Phase | Sessions | Est. tokens (low) | Est. tokens (high) | % of $100 Max/month |
|---|---|---|---|---|
| 0 — Login split, role switch, opt-out | 3–5 | 100K | 475K | 3–15% |
| 1 — Operator identity + unit linking | 5–8 | 175K | 760K | 6–25% |
| 2 — Operator dashboard | 4–6 | 130K | 570K | 4–19% |
| 3 — Service requests + work orders | 8–12 | 265K | 1,140K | 9–38% |
| 4 — Scheduling + owner blocks | 5–7 | 165K | 665K | 5–22% |
| 5 — Pricing log + bidirectional confirmation | 6–8 | 200K | 760K | 6–25% |
| 6 — Documents + compliance | 3–4 | 100K | 380K | 3–13% |
| 7 — Staff task management | 3–5 | 100K | 475K | 3–15% |
| **Full build total** | **37–55** | **~1.2M** | **~5.2M** | **40–170%** |

**Prototype only (Phases 0–2):** ~400K–1.8M tokens — fits comfortably within one $100/month cycle if sessions are focused and well-scoped.

**Practical guidance for Max plan:**
- Phases 0–2 can realistically be completed in 1–2 billing months on Max $100.
- Phase 3 alone may consume a full month's allowance if sessions are exploratory.
- Breaking each session into a single discrete task (one endpoint, one UI component) keeps token use predictable.
- Compacting long conversations before switching tasks saves significant context tokens.

---

## Request Type Taxonomy

Every item that flows through KAI maps to one of these types. These are the structured replacements for WhatsApp messages. Each type has a defined initiator, recipients, SLA, and resolution path.

**Owner visibility rules per type:**
- **Payout Owner** — sees everything, has approval rights on financial items
- **Calendar Owner** — sees calendar-related items and all request threads; financial amounts are hidden (repair cost, payout amounts shown as "—")
- **All owners** — can post replies in any request thread for their unit, mirroring WhatsApp group participation

---

### Operator → Owners (owners respond or are informed)

| Type | WhatsApp equivalent | SLA | Who must act | Calendar Owner sees? |
|---|---|---|---|---|
| **Repair approval** | "AC broken, $150 to fix, ok?" | 4h urgent / 24h standard | Payout Owner approves; others see thread | Yes, cost hidden |
| **Repair FYI** (below threshold) | "Fixed the door hinge, $8" | None | Optional acknowledge | Yes, cost hidden |
| **Guest issue — urgent** | "Guest locked out at 11pm" | 1h | All owners notified; Payout Owner authorizes if needed | Yes |
| **Guest issue — standard** | "Guest says Wi-Fi slow, I reset router, fixed" | 4h | All owners informed | Yes |
| **Booking relay** | "New booking Jan 15–18, 4 guests" | None | All owners see dates; payout/revenue handled on Airbnb | Yes |
| **Booking special request** | "Guest asks to bring a dog, ok?" | 2h | Payout Owner approves; others can comment | Yes |
| **Pricing proposal** | "Raise Dec rate to $200, up from $170" | 48h | Payout Owner confirms/counters/rejects | Yes, can comment |
| **Peak period proposal** | "Adding Carnaval Feb 28–Mar 4 at +25%" | 48h | Payout Owner confirms/counters/rejects | Yes, can comment |
| **AirCover / damage alert** | "Guest left damage, filing AirCover claim" | 24h | All owners notified; Payout Owner co-authorizes | Yes |
| **Utility bill** | [photo of electricity bill] | 5 days | Payout Owner acknowledges/disputes | No (financial) |
| **General update** | "Unit is ready for next guest" | None | All owners informed | Yes |

---

### Owner → Operator (any owner can initiate; operator acts)

| Type | WhatsApp equivalent | SLA | Operator action | Who can initiate |
|---|---|---|---|---|
| **Task request** | "Can you check the unit and send photos?" | 24h | Acknowledge → Complete → Photo proof | Any owner |
| **Calendar block** | "Block Dec 22–28 for my family visit" | 24h | Confirm → Apply on Airbnb | Any owner |
| **Pricing proposal** | "I want to raise the base rate to $160" | 48h | Confirm / Counter / Reject | Payout Owner only |
| **Peak period proposal** | "Add Semana Santa at +30%" | 48h | Confirm / Counter / Reject | Payout Owner only |
| **Listing change request** | "Update the house rules to add pool hours" | 48h | Confirm → Apply → Mark done | Any owner |
| **Document request** | "Send me last month's electricity bill" | 24h | Upload document | Payout Owner only |
| **General question** | "How was the last checkout?" | 4h | Reply | Any owner |

---

### Operator → Team (internal, owner does not see by default)

| Type | SLA | Team action |
|---|---|---|
| **Cleaning assignment** | Per-stay schedule | Arrive → In progress → Done + photos |
| **Repair assignment** | Per repair SLA | Acknowledge → In progress → Done + invoice photo |
| **Inspection request** | 24h | Complete → Report + photos |
| **Access code change** | Immediate | Confirm received |
| **Building notice relay** | 2h | Acknowledge |

---

### System-generated (operator-entered or future platform integration)

Booking and payout data lives on Airbnb — KAI does not replicate it. The following are operator-entered relays or prompts derived from platform events:

| Type | Trigger | Who sees it | Note |
|---|---|---|---|
| **Booking relay** | Operator manually enters or future iCal/API sync | Operator + all owners | Dates only; no guest PII or revenue figures in KAI |
| **AirCover window prompt** | Configurable: 12 days after checkout, no claim filed | Operator | Prompts operator to inspect and file; claim details tracked in KAI |
| **Superhost risk prompt** | Operator-flagged or future API | Operator | Informational only |

---

## SLA Reference

Default SLAs — configurable per unit or community by the global admin.

| Urgency tier | Applies to | Response SLA | Overdue action |
|---|---|---|---|
| **Critical** | Guest locked out, guest safety issue | 1 hour | Alert owner if operator hasn't responded |
| **Urgent** | AC/hot water failure, damage claim window, booking special request | 2–4 hours | Email reminder at 50% elapsed, badge turns red |
| **Standard** | Repair approval, task request, general question | 24 hours | Email reminder at 12h, badge turns yellow then red |
| **Async** | Pricing proposal, peak period proposal, listing change | 48 hours | Reminder at 24h, proposal expires at 48h |
| **Monthly** | Utility bill, payout statement | 5 days | Reminder at 3 days |
| **FYI** | Booking notification, FYI updates | No SLA | No reminder; auto-archived after 7 days |

---

## Use Case Discovery — Comprehensive Question Set

Organized by topic. All scenarios are grounded in the Airbnb host (operator) / co-host (owner) relationship. Answer these before or during prototype build.

---

### 1. Platform & Listing Setup

*Which platforms the unit is listed on, and how the host/co-host relationship is established on each.*

**Platform registration (per unit):**
- Is Airbnb the only active platform, or does your operator also list on VRBO, Booking.com, or a direct booking site?
- For each platform beyond Airbnb, does the same 15/85 split apply, or is it negotiated separately?
- Should KAI track bookings from non-Airbnb platforms manually (operator enters the booking), or is automation expected later?

**Airbnb co-host setup:**
- Is the owner already added as a co-host on Airbnb today, or does the operator manage the listing exclusively?
- What co-host permissions does the owner currently have on Airbnb? (full access, calendar only, view only)
- Should KAI mirror the Airbnb co-host permission model, or define its own visibility rules independently?

**Listing ownership:**
- Is the Airbnb account in the operator's name, the owner's name, or a shared business account?
- If the operator relationship ends, what happens to the Airbnb listing? (transferred to owner, deactivated, re-listed under new operator)
- Does this transition need to be tracked inside KAI?

**Superhost status:**
- Is your operator a Superhost on Airbnb?
- Does Superhost status affect the agreed split (operator earns it through performance)?
- Should KAI surface a warning if actions (late responses, cancellations) put Superhost status at risk?

---

### 2. Bookings — Operational Coordination

*Booking and payout data lives on Airbnb. KAI's role is: (1) relaying operational context to owners, (2) surfacing requests that require owner action, and (3) providing date context for requests (repairs, blocks).*

**Booking relay (informational only):**
- Does the owner want a KAI notification when a new booking is confirmed? If yes: check-in/check-out dates and number of guests only — no payout amounts (those are on Airbnb).
- For Instant Book listings, is a date-only notification sufficient, or does the owner want to see every booking?
- Should cancellations that free up dates be relayed in KAI so the owner knows the calendar changed?

**Guest special requests that need owner input:**
- Bringing pets (not in listing): operator decision, or should the owner be asked in KAI?
- Additional guests beyond listing capacity: operator decides or owner approves?
- Long-stay discount requests (see Pricing section for bidirectional confirmation flow)
- "Can I have a birthday party?" — how is this typically handled?

**Host-initiated cancellations:**
- Has the operator ever cancelled a booking on the host side? (Airbnb penalizes: loss of payout, calendar block, listing suppression)
- Should KAI require the operator to document the reason for a host-initiated cancellation, since the owner is affected?

**Operational context for requests:**
- When the operator creates a repair or maintenance request, should they be able to tag it to a specific stay (e.g. "check-in Jan 15 — AC issue on arrival")?
- This links the request to a period without duplicating guest or financial data in KAI.

---

### 3. Guest Communication & Issues

*Anything a guest raises during inquiry, before arrival, during stay, or after checkout.*

**Pre-arrival messaging (on Airbnb):**
- Who currently sends the welcome/check-in instructions message to guests — operator, or automated Airbnb message?
- Does the owner ever want to send a personal message to guests (as co-host)?
- Are check-in instructions stored somewhere structured today, or embedded in Airbnb messages?

**During-stay issue types (rank by frequency):**
- Access/entry problems (lockout, keypad failure, lost key)
- AC not cooling or broken
- Hot water failure
- Wi-Fi down or slow
- Noise complaint against the unit (building or neighbor reports)
- Noise complaint from the unit about building (guest complains)
- Missing or broken amenity (no towels, broken appliance, TV not working)
- Cleanliness issue on arrival (previous guest left mess, cleaning not completed)
- Pest (cockroach, ant, mosquito)
- Guest requests additional items (extra towels, pillows, kitchen supplies)
- Guest locked out after losing key or changing code
- Guest reports damage they caused (proactive disclosure)
- Guest reports pre-existing damage on arrival (protecting themselves)
- Power/utilities outage (building-wide vs. unit-only)

**Notification threshold (per issue type):**
- Which issue types should always alert the owner immediately (within minutes)?
- Which should the operator resolve silently and just log in KAI?
- Which should be summarized in a daily or per-stay digest?
- Should the owner be able to configure their own threshold per issue type?

**Issue response on Airbnb:**
- When the operator responds to a guest complaint through Airbnb's resolution center, should that be logged in KAI?
- If a guest contacts Airbnb support directly (bypassing the host), does the operator know? Should KAI have a way to log this?

**AirCover & Damage Claims:**
- Has your operator ever filed an AirCover damage claim?
- Who initiates the claim on Airbnb — operator always, or could the owner file it?
- The AirCover claim window is 14 days after checkout (or before next guest check-in). Should KAI prompt the operator to inspect and file within this window?
- If a damage claim payout is received, how does it factor into the 15/85 split? (Full payout to owner? Split? Operator absorbs repair cost then claims?)
- Should damage photos taken at check-out be linked directly to an AirCover claim record in KAI?

**Guest feedback & reviews:**
- Does the operator currently share Airbnb review text with you after each stay?
- Should KAI capture the star rating (overall, cleanliness, accuracy, communication, location, value) per stay?
- If a guest leaves a negative review, does the owner want to draft the host response, or does the operator handle it?
- Should KAI track review score trends over time to surface patterns (e.g. cleanliness score dropping, linked to cleaning staff change)?
- Airbnb allows one host response per review — if both operator and owner have opinions, who has final say?

---

### 4. Calendar Management

*Blocking dates, minimum stays, advance notice, and coordination between Airbnb availability and real-world events.*

**Owner personal use:**
- How often do you block dates for personal use? (monthly, seasonally, ad hoc)
- Does the owner block dates directly on Airbnb as co-host, or request the operator to do it?
- How far in advance do personal-use blocks typically get set?
- Does the owner want the unit prepared differently for personal use vs. guest stays (welcome bag, specific amenities)?
- If an owner block conflicts with an existing booking, who resolves it and how?

**Operator-initiated blocks:**
- Does the operator ever block dates for maintenance, deep cleaning, or renovation?
- Should operator-initiated blocks require owner awareness (notification) or approval (confirmation)?
- How much advance notice is typical for a maintenance block?

**Minimum stay rules:**
- Does your listing have different minimum stays by season? (e.g. 2 nights standard, 3 nights peak, 7 nights December)
- Who proposes minimum stay changes — owner, operator, or either with bidirectional confirmation (same as pricing)?

**Advance notice:**
- What is the current advance notice setting on Airbnb? (how far in advance guests can book)
- Has there ever been a booking that came in with too little lead time for the operator to prepare? What happened?

**Preparation time:**
- What preparation/turnaround time is set between bookings?
- Is this always the same, or does it vary (e.g. longer after long stays)?

---

### 5. Pricing — Bidirectional Confirmation Required

*Either party (owner or operator) can propose. The other must confirm before any change is implemented. Locked design decision.*

**Confirmed workflow:**
- Owner proposes → operator must confirm before it takes effect on Airbnb
- Operator proposes → owner must confirm before it takes effect on Airbnb
- All proposals, counter-proposals, confirmations, and rejections are logged immutably

**Airbnb pricing tools in scope:**
- Base nightly rate (weekday)
- Weekend pricing (Friday and Saturday nights)
- Weekly discount (% off for 7+ night stays) — owner or operator proposes, other confirms
- Monthly discount (% off for 28+ night stays) — same confirmation flow
- Custom date pricing (override for specific dates, e.g. New Year's Eve)
- Seasonal / peak period pricing (date range + multiplier or absolute amount)
- Cleaning fee (flat per booking — see split question below)
- Extra guest fee (per person above base occupancy)
- Smart Pricing on/off (Airbnb dynamic pricing — does owner want to allow or always use manual?)

**Pricing structure questions:**
- What is the current weekday base rate and weekend premium?
- Which peak periods are active? (Carnaval, Semana Santa, December, local long weekends)
- Are peak period dates fixed annually or adjusted each year?
- Do you use Airbnb Smart Pricing currently? If yes, do you set a floor and ceiling?
- Do you apply weekly or monthly discounts for long stays?
- What is the current cleaning fee? Does it change by season or stay length?
- Is there an extra guest fee? At what occupancy threshold?

**Cleaning fee split question (open):**
- Does the 15% operator cut include cleaning services rendered (operator keeps cleaning fee to cover their cost), or is the cleaning fee passed through to the owner and cleaning cost paid separately?
- This directly affects how KAI calculates owner payout per booking.

**Proposal workflow:**
- When either party proposes, should the other receive an email + in-app badge?
- Should proposals include a required note/reason? (e.g. "Carnaval demand up vs. last year")
- Counter-proposal supported: recipient can propose an alternative amount instead of accept/reject
- Timeout: if no response in 48 hours, proposal expires (or auto-approves — which do you prefer?)
- Proposer can withdraw before the other party responds

**After confirmation:**
- Who updates Airbnb after a change is confirmed? Operator always? Either party?
- Should KAI require an "Applied on Airbnb ✓" confirmation to close the loop?
- Future: Airbnb API direct push (no manual step needed)

---

### 6. Utility Bills & Expenses

*Expenses tied to the unit that the operator shares with the owner: electricity, water, internet, building fees.*

> **Note:** Revenue, payouts, and booking financials are handled by Airbnb and other listing platforms — they are out of scope for KAI. KAI tracks *expenses* (bills, repair invoices) and the *approval workflow* around them, not revenue or remittances.

**Which bills:**
- Which utilities are in the owner's name vs. the operator's?
- Is electricity billed per unit (sub-meter) or averaged across the building?
- Does internet have a separate bill or is it included in building fees?
- What is the monthly cuota de administración? Is it fixed or variable?

**Bill sharing and tracking:**
- How does the operator share bills today? (WhatsApp photo, email forward)
- Should the operator be required to upload bill photos or PDFs to KAI monthly?
- How does the owner pay utility bills — deducted from payout on Airbnb, or billed separately by operator?

**Repair costs:**
- Are repair costs deducted from the owner's payout, or billed separately?
- If a repair is caused by guest damage, is the cost recovered from AirCover before billing the owner?
- If the operator advances the repair cost, how is reimbursement tracked?

**Anomaly detection:**
- Has an unusually high electricity bill ever been a source of dispute?
- Should KAI flag any utility bill more than X% above the rolling 3-month average?

---

### 7. Repairs & Maintenance

*Maintenance and repair requests tied to unit condition and guest stays.*

**Initiation:**
- Who most often identifies a repair need — operator (after guest departure), owner (remote observation), or guest (during stay)?
- Can a guest-reported issue during a stay auto-create a service request in KAI?
- Are repairs always linked to a specific stay, or are many proactive/routine?

**Approval and cost:**
- What cost threshold requires owner approval before work starts? (e.g. anything over $50,000 COP / ~$12 USD)
- Below that threshold, can the operator proceed and log it in KAI after?
- Hard gate (work cannot start until owner approves) vs. soft gate (operator proceeds, owner notified)?
- Does the owner want to see quotes before approving larger repairs?

**Repair cost and the split:**
- Are repair costs deducted from the owner's 85% payout, or billed separately to the owner?
- If a repair is caused by guest damage, is the cost recovered from AirCover before billing the owner?
- If the operator advances the repair cost, how is reimbursement tracked against future payouts?

**Vendors:**
- Does your operator have a regular set of vendors (plumber, electrician, locksmith, AC tech)?
- Should KAI maintain a vendor list per unit or community with contact info and typical rates?
- Should the owner be able to specify preferred vendors, or does the operator choose?

**Recurring maintenance:**
- Are there recurring scheduled tasks? (AC filter every 3 months, deep clean annually, water heater flush)
- Should these be schedulable in KAI as recurring service requests with reminders?

---

### 8. Listing Content & Photos

*Managing the Airbnb listing — what each party can propose and what requires the other's confirmation.*

**Airbnb listing fields in scope:**
- Listing title
- Description (short and long)
- Space details (bedrooms, bathrooms, beds, max guests)
- Amenities checklist (pool access, parking, hot water, AC units, washer/dryer, etc.)
- House rules (noise curfew, no smoking, no parties, pet policy, check-in window)
- Check-in instructions (access code, key location, building entry)
- Check-out instructions
- Photos (add, remove, reorder, set cover photo)
- Cancellation policy
- Instant Book on/off

**Change workflow:**
- Should listing content changes follow the same bidirectional proposal/confirmation flow as pricing, or is it more permissive (operator can update most fields, owner notified)?
- Are there specific fields the owner always wants to approve? (house rules, max guests, cancellation policy, Instant Book toggle)
- Should there be a version history of listing changes so either party can see what changed and when?

**Community compliance:**
- Are there HOA-mandated house rules (pool hours, noise curfew, parking limits) that must always appear in the listing?
- Should KAI flag if a proposed listing update would remove a required community rule?
- Does the building have a maximum occupancy per unit that the listing must not exceed?

**Photos:**
- Who is responsible for photography — operator takes photos, owner hires a photographer, or shared?
- How often are photos refreshed? (after renovation, after damage repair, seasonally)
- Should KAI store approved photo sets per unit, separate from what's live on Airbnb?

---

### 9. Building Administration & Community Notices

*Info from the building/HOA that affects the unit and operator's day-to-day.*

**What gets shared:**
- What types of building notices arrive via WhatsApp today? (water shutoffs, elevator maintenance, pool closures, security updates, parking rules, HOA fees, meeting minutes)
- Are some notices unit-specific (floor 5 only) vs. building-wide?
- Do building notices affect Airbnb listing accuracy? (e.g. pool closed for 2 weeks → should listing reflect this?)

**Who creates and sends:**
- Does the building/HOA notify directly, or does the KAI admin relay?
- Should operators be able to create a "building notice" to share with their own team?

**Urgency and acknowledgment:**
- Are some notices urgent (same-day water shutoff) vs. informational (quarterly report)?
- Should the operator be required to acknowledge urgent notices? Should the owner be alerted if they don't?
- If a building notice affects an active guest stay (e.g. pool closed during their booking), should KAI prompt the operator to message the guest on Airbnb?

---


### 11. Owner General Requests

*Ad hoc tasks the owner asks of the operator that don't fit a category.*

**Common types from WhatsApp:**
- "Can you check on the unit this week and send photos?"
- "Please secure the balcony furniture before the storm"
- "A friend arrives Thursday — please leave a welcome bag"
- "Coordinate with the building about renewing the parking sticker"
- "The building sent a notice about the elevator — please acknowledge it"

**Workflow:**
- Should general requests have a status (sent → acknowledged → in progress → done)?
- Do you want photo confirmation when a task is complete?
- What is the expected response time for non-urgent requests?
- Should overdue requests (no acknowledgment in X hours) nudge the owner?

---

## Open Questions — Airbnb-Specific

> Payout calculations, revenue splits, and remittance tracking are handled by Airbnb — not in scope for KAI.

| # | Question | Affects |
|---|---|---|
| D | Does Instant Book require owner notification in KAI within X hours, or is a date-only relay sufficient? | Section 2, booking relay |
| F | Who has final say on the Airbnb host response to a negative review — operator or owner? | Phase 3 review workflow |
| G | Should Smart Pricing (Airbnb dynamic pricing) on/off be subject to bidirectional confirmation, or operator's call? | Phase 5 pricing scope |
| H | If the operator-owner relationship ends, what happens to the Airbnb listing? Who is responsible for transition? | Phase 1 link termination |
| I | Are minimum stay rule changes subject to bidirectional confirmation (same as pricing) or operator discretion? | Phase 4 / Phase 5 boundary |

---

## Priority Matrix — Grounded in Real Chat Data

Ranked by actual frequency and cost of failure observed in the Morros KAI 317 chat.

| Request type | Observed freq | Real failure mode | SLA tier | Build phase |
|---|---|---|---|---|
| **Pricing change** (either party, bidirectional confirm) | 8× in 7 months | No audit trail; rate changed at 1am before owner confirms; ranking impact only known after 10 days no bookings | Async 48h | Phase 5 |
| **Listing photo / content update** (bulk upload, ordering, owner review) | 6× | One-by-one Dropbox download; owner screenshots to communicate deletions; title limit discovered mid-task | Async 48h | Phase 5 / Phase 6 |
| **Scheduling coordination** (maintenance, cleaning, vendor, personal visit) | 5× | Operator never proactively confirms; owner initiates all follow-ups | Standard 24h | Phase 3 |
| **Repair approval + invoice** (threshold gate, invoice required to close) | 4× | Paid without pre-approval; invoices requested 3× over 3 weeks, never delivered | Standard / Urgent | Phase 3 |
| **Smart lock / device management** (per-device instructions, escalation) | 1× but 6+ follow-ups | Yale battery took 10 days, 6 owner messages, 2 video tutorials, still not confirmed resolved | Urgent 4h | Phase 3 (device type) |
| **Building / community notice** (urgency flag, operator acknowledge) | 3× | 35-min gap on urgent water notice; owner acts as relay bridge | Urgent / Standard | Phase 3 |
| **Receipts / invoice delivery** | 3× | Never proactively sent; owner must ask; asked 3× with no resolution | Standard 24h | Phase 3 (close gate) |
| **Owner read-only visibility** (guest summary, listing state, pricing, ranking) | 5+ asks denied | Brian asked 5+ times across months for pricing control or ranking visibility — always redirected | Always-on | Phase 2 (dashboard) |
| **Co-host / platform access** (track permissions, surface changes) | 3× | Martha lost guest profile visibility after Airbnb app update; team couldn't explain | Always-on | Phase 1 |
| **Damage claim / AirCover** (per-stay photo log, case per incident, 14-day window) | 2× | Two incidents conflated → double-billing dispute ("why are we paying again?") | Urgent 24h | Phase 3 ext |
| **Credential vault** (RNT, TRA, warranties, appliance manuals — no chat) | 3× | RNT credentials in group chat plain text; shared twice because first share lost | Secure / no SLA | Phase 6 |
| **Calendar block — personal use** (distinct from guest, cleaning auto-scheduled) | 2× | Operator quoted guest rate for personal use; 1-night minimum policy conflict not surfaced | Standard 24h | Phase 4 |
| **Expense submission** (repair invoices, utility bills — zero bank details in KAI) | 3× | Bancolombia + Nequi account numbers in group chat; no receipt; no audit trail | Zero tolerance | Phase 3 / 6 |
| **Review management** (draft approval, guest block, positive response policy) | 3× | Operator responds without owner awareness; owner had to request specific response strategy | Standard 24h | Phase 3 ext |
| **Team directory** (name, role, contact, responsibilities — visible to owners) | 4× role confusion | Owners don't know who ACTB, CDVR are; new team members added with no intro | Always-on | Phase 1 |
| **Pricing with ranking preview** (show Airbnb position impact before confirming) | 1× surfaced late | Paula's ranking data only surfaced 10 days after a rate increase killed bookings | Pre-confirm | Phase 5 |
| **Utility bill delivery** (operator uploads, owner acknowledges, anomaly flagging) | Monthly | Manual WhatsApp photo; no structured record or anomaly detection | Monthly | Phase 6 |
| **Annual / scheduled rate change** (future-dated, auto-applies) | 3× pricing sessions | 2027 pricing negotiated over multiple weeks; no scheduled activation | Async | Phase 5 |
| **Discount structure** (last-minute, early-bird, weekly, monthly — per unit) | 1× applied | Four discount types discussed and applied manually with no owner visibility | Async | Phase 5 |
| **Building notice → listing update trigger** (pool closed? prompt listing update) | 1× water issue | No connection between building outage and listing accuracy | Manual prompt | Phase 3 ext |

---

## Questions That Must Be Answered Before Building

### Block Phase 1 (unit linking — multi-owner model)
- **MO-1** — Can the 85% owner payout be split among multiple Payout Owners? (e.g. two siblings co-own, each gets 42.5%) If yes, KAI needs a per-owner share field.
- **MO-2** — When a Payout Owner must approve a request (repair, pricing), can a Calendar Owner also approve on their behalf, or is approval strictly the Payout Owner?
- **MO-3** — Can a Calendar Owner add other Calendar Owners, or can only the Payout Owner manage the owner roster for a unit?
- **MO-4** — If a Payout Owner removes a Calendar Owner, do they lose access immediately? Are they notified?
- **MO-5** — Should the operator see which owners are Payout vs. Calendar in the thread, or do all owners appear identically?

### Block Phase 3 (service requests / inbox core)
- **D** — Does Instant Book require owner notification, or is it fully silent?
- **SLA-1** — For guest urgent issues, if the operator hasn't responded in 1 hour, does KAI alert all owners or only the Payout Owner?
- **SLA-2** — Who configures SLA thresholds — the global admin only, or can each owner/operator group customize their own?
- **TEAM-1** — Do team members log in with their own Google account, or does the operator assign tasks without team members having KAI accounts?
- **THREAD-1** — When a Calendar Owner replies in a request thread (e.g. repair approval), is their reply informational only, or can it count as the approval action?

### Block Phase 5 (pricing)
- **G** — Is Airbnb Smart Pricing on/off subject to bidirectional confirmation, or operator's call?
- **I** — Are minimum stay rule changes subject to bidirectional confirmation or operator discretion?
- **PRICE-1** — If a pricing proposal expires with no response after 48 hours, does it expire (safer) or auto-approve?

### Block Phase 6 (documents & compliance)
- Supabase Storage — is a bucket already provisioned, or does it need setup before Phase 6 file uploads?

### Inform design (not blocking)
- **F** — Who has final say on the host response to a negative Airbnb review?
- **H** — If operator-owner relationship ends, what happens to the Airbnb listing?
- **NOTIFY-1** — Should owners receive a daily digest of FYI items, or only real-time notifications for items requiring action?
- **NOTIFY-2** — Should team members ever see repair cost amounts, or is that always filtered out?

---

*Start with the inbox core (Phase 3 request types, SLA timers, attention feed). That is the WhatsApp replacement. Everything else — pricing, financials, scheduling — layers on top of it.*
