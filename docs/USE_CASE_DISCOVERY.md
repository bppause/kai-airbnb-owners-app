# Use Case Discovery & Claude Max Cost Reference
# KAI Operator Portal

> Reference document — May 2026  
> Companion to: `PROTOTYPE_READINESS.md`, `OPERATOR_PORTAL_PROPOSAL.md`

---

## Platform & Revenue Model (Locked)

### Airbnb as Primary Platform

The operator manages listings primarily on **Airbnb**. Other platforms (VRBO, Booking.com, direct booking) are supported by allowing the owner to register which platforms their unit is listed on — but Airbnb is the reference model for all host/co-host workflows.

### Host / Co-Host Role Mapping

| Airbnb Role | KAI Role | Responsibilities |
|---|---|---|
| **Host** (primary) | **Operator** | Owns the listing, manages calendar and pricing, responds to guests, arranges cleaning, handles Airbnb relationship and AirCover claims |
| **Co-Host** | **Owner** | Can view listing, calendar, and bookings; receives payout; approves significant changes; has limited Airbnb platform actions |

### Revenue Split (Estimated Defaults — Editable Per Unit)

| Party | Share | Covers |
|---|---|---|
| Operator (host) | ~15% of net payout | Listing management, guest communication, cleaning coordination, Airbnb relationship, issue resolution |
| Owner (co-host) | ~85% of net payout | Unit ownership, capital expenditures |

**Net payout** = Guest total − Airbnb host service fee (~3%) − cleaning fee (pass-through or operator-retained — see open question below)

KAI must track gross booking revenue, Airbnb fees, cleaning fees, and the 15/85 split per booking and per month, with the split percentage configurable per unit.

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

### 2. Bookings — Visibility & Notification

*How bookings flow from Airbnb to both parties, and what each needs to see.*

**Booking visibility:**
- Does the owner currently see new bookings on Airbnb as a co-host, or only when the operator tells them?
- Should every new confirmed booking generate a KAI notification to the owner with: guest name (or first name only), check-in/check-out dates, number of guests, payout amount?
- For Instant Book listings, is the owner comfortable not approving individual bookings, or should they see a notification within X hours of each new booking?

**Booking types and handling:**
- Does your listing use **Instant Book** (auto-confirm) or **Request to Book** (operator manually accepts)?
- For Request to Book: does the operator discuss with the owner before accepting, or does the operator decide independently?
- Are there guest profiles the owner wants the operator to decline (e.g. first-time Airbnb users, no reviews, large groups)?

**Special requests from guests:**
- Early check-in (before standard 3pm): who approves — operator independently, or does it need owner awareness?
- Late check-out (past standard 11am): same question
- Long-stay discount request: who handles (see Pricing section)
- Bringing pets (not in listing): operator decision, or owner must approve?
- Additional guests beyond listing capacity: operator or owner decides?
- "Can I have a birthday party?": how is this typically handled?

**Booking modifications:**
- If a guest wants to change their dates after booking, who handles the modification on Airbnb?
- Should the owner be notified of booking modifications, or only the initial booking and final payout?

**Cancellations:**
- What is your current cancellation policy on Airbnb? (Flexible, Moderate, Firm, Strict)
- If a guest cancels, does the owner want to be notified immediately? What data (refund amount, dates freed)?
- Has the operator ever needed to cancel a booking on the host side? What happened? (Airbnb penalizes host cancellations — loss of payout, calendar block, possible listing suppression)
- Should KAI log host-initiated cancellations with a required reason, since they carry consequences?

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

### 6. Financial Tracking & Payouts

*How Airbnb payouts flow, how the split is calculated, and what reporting each party needs.*

**Airbnb payout mechanics:**
- Airbnb pays out to the host (operator) approximately 24 hours after guest check-in
- Payout = (nightly rate × nights) + cleaning fee − Airbnb host service fee (~3%)
- Who is the Airbnb payout account — operator's bank account? Owner's? Business account?
- If operator receives the full payout: how does the 85% remittance to the owner currently happen? (bank transfer, cash, third-party)
- Is there a regular cadence for remittance? (monthly, after each booking, on the 1st of each month)

**Split calculation questions:**
- Does the 15/85 split apply to the gross Airbnb payout (before Airbnb fee) or net (after Airbnb fee)?
- Is the cleaning fee included in the split, or does the operator keep it fully to cover cleaning cost?
- If a guest cancels and receives a partial refund, is the operator's 15% calculated on the amount actually paid out?
- Are long-stay discounts factored into the split as a reduction, or does the operator absorb them from their 15%?

**Per-booking record KAI should track:**
- Guest first name (or anonymized)
- Check-in and check-out dates
- Number of nights
- Number of guests
- Gross nightly revenue
- Cleaning fee
- Airbnb host service fee (deducted)
- Net payout from Airbnb
- Operator share (15% × net or configured %)
- Owner share (85% × net or configured %)
- Platform (Airbnb / VRBO / other)
- Booking source (Instant Book / Request / direct)
- Status (upcoming / active / completed / cancelled)

**Monthly summary:**
- Should KAI generate a monthly statement per unit showing: bookings, gross revenue, fees, net payout, operator share, owner share?
- Should the statement be locked (owner sees it, operator cannot edit after the close period)?
- Does the owner need a year-to-date view for tax purposes?
- Should statements be exportable as PDF or CSV?

**Remittance tracking:**
- Should KAI track when the operator has remitted the owner's 85%? (operator marks "Sent", owner marks "Received")
- Should there be a dispute mechanism if the owner believes the remittance amount is wrong?

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

### 10. Unit Bills & Utilities

*Electricity, water, gas, internet, cuota de administración — tracking and dispute prevention.*

**Which bills:**
- Which utilities are in the owner's name vs. the operator's?
- Is electricity billed per unit (sub-meter) or averaged across the building?
- Does internet have a separate bill or is it included in building fees?
- What is the monthly cuota de administración? Is it fixed or variable?

**Bill sharing and tracking:**
- How does the operator share bills today? WhatsApp photo? Email forward?
- Should the operator be required to upload bill photos or PDFs to KAI monthly?
- Are bills deducted from the owner's payout, or billed separately?

**Anomaly detection:**
- Has an unusually high electricity bill ever been a source of dispute?
- Should KAI flag any utility bill more than X% above the rolling 3-month average?
- If a bill spike correlates with a guest stay, should KAI surface that connection?

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

| # | Question | Affects |
|---|---|---|
| A | Is the cleaning fee part of the 15/85 split, or does the operator keep it fully to cover cleaning costs? | Every payout calculation |
| B | Is the split calculated on gross Airbnb payout or net (after Airbnb host fee)? | Every payout calculation |
| C | Who holds the Airbnb payout account — operator or owner? Who remits to whom? | Phase 6 financial tracking |
| D | Does Instant Book require owner notification within X hours, or is it fully silent? | Phase 3 booking notifications |
| E | If a guest cancels and partial payout is received, how is the split applied? | Phase 6 cancellation handling |
| F | Who has final say on the Airbnb host response to a negative review — operator or owner? | Phase 3 review workflow |
| G | Should Smart Pricing (Airbnb dynamic pricing) on/off be subject to bidirectional confirmation, or operator's call? | Phase 5 pricing scope |
| H | If the operator-owner relationship ends, what happens to the Airbnb listing? Who is responsible for transition? | Phase 1 link termination |
| I | Are minimum stay rule changes subject to bidirectional confirmation (same as pricing) or operator discretion? | Phase 4 / Phase 5 boundary |
| J | Should AirCover claim payouts affect the monthly revenue split calculation? | Phase 6 financial edge cases |

---

## Priority Matrix (Updated for Airbnb Model)

| Use case | Frequency | Pain without system | Build in phase |
|---|---|---|---|
| New booking notification to owner (amount, dates, guests) | Per booking | High — owner blind until operator tells them | Phase 3 |
| Guest issue during stay → operator logs → owner notified | Per stay | High — no audit trail, no threshold control | Phase 3 |
| Repair request + owner approval gate | Weekly | High — surprise costs, no pre-approval | Phase 3 |
| Pricing proposal (either party) + confirmation | Monthly | High — disputes, no immutable record | Phase 5 |
| Monthly payout statement (15/85 split per booking) | Monthly | High — manual calc, no locked record | Phase 6 |
| Building admin notices → operator acknowledgment | Weekly | Medium — operator misses notices | Phase 3 |
| AirCover damage claim tracking | Occasional | High when it happens — short filing window | Phase 3 extension |
| Calendar block (owner personal use) | Monthly | Medium — operator surprised by block | Phase 4 |
| Listing content change → owner notification/approval | Quarterly | Medium — owner unaware of changes | Phase 6 |
| Utility bill upload + anomaly flag | Monthly | Medium — photos lost in chat | Phase 6 |
| Owner general request → acknowledgment → done + photo | Weekly | Medium — forgotten tasks | Phase 3 (general type) |
| Review score tracking + host response coordination | Per stay | Medium — no history, no handoff | Phase 3 extension |
| Remittance tracking (operator pays owner their 85%) | Monthly | High if disputed — no record | Phase 6 |

---

*Resolve open questions A, B, and C before building any financial tracking in Phase 6. Resolve D before building booking notifications in Phase 3. All other questions can be answered during build.*
