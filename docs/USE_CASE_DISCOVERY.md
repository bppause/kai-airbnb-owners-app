# Use Case Discovery & Claude Max Cost Reference
# KAI Operator Portal

> Reference document — May 2026  
> Companion to: `PROTOTYPE_READINESS.md`, `OPERATOR_PORTAL_PROPOSAL.md`

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
| 5 — Pricing log + approvals | 4–6 | 130K | 570K | 4–19% |
| 6 — Documents + compliance | 3–4 | 100K | 380K | 3–13% |
| 7 — Staff task management | 3–5 | 100K | 475K | 3–15% |
| **Full build total** | **35–53** | **~1.2M** | **~5.0M** | **40–165%** |

**Prototype only (Phases 0–2):** ~400K–1.8M tokens — fits comfortably within one $100/month cycle if sessions are focused and well-scoped.

**Practical guidance for Max plan:**
- Phases 0–2 can realistically be completed in 1–2 billing months on Max $100.
- Phase 3 alone may consume a full month's allowance if sessions are exploratory.
- Breaking each session into a single discrete task (one endpoint, one UI component) keeps token use predictable.
- Compacting long conversations before switching tasks saves significant context tokens.

---

## Use Case Discovery — Comprehensive Question Set

Organized by the topic categories drawn from real owner-operator WhatsApp experience.
Answer these before or during prototype build. Each answer directly informs a feature scope decision.

---

### 1. Building Administration

*Info the building/community pushes to owners and operators — rule changes, maintenance windows, notices.*

**What gets shared:**
- What types of building notices arrive today via WhatsApp? (scheduled maintenance, water shutoffs, elevator repairs, security updates, parking rules, HOA meeting minutes, fee changes)
- Are building notices the same for all unit owners, or are some targeted (e.g. only units on floor 5)?
- Does the operator need to see building notices, or only the owner? If both, do they need separate acknowledgment?

**Who creates and sends:**
- Does the building/HOA send notices directly, or does the KAI admin relay them?
- Can operators ever create building-scoped notices, or is that admin-only?

**Urgency and acknowledgment:**
- Are some notices urgent (24h water shutoff) vs. informational (quarterly report)?
- Does the owner or operator need to confirm they've read it?
- If the operator doesn't acknowledge within X hours, should the owner be alerted?

**Operator sharing:**
- When the operator shares building info with their cleaning/maintenance team, does that happen inside KAI or via WhatsApp still?
- Should the operator be able to forward a KAI notice to a staff member with a single tap?

---

### 2. Repairs

*Maintenance and repair requests, cost approval, vendor coordination, invoice archiving.*

**Initiation:**
- Who most often identifies a repair need — the operator (after a guest leaves), the owner (remote inspection), or the community building (common area adjacent)?
- Can a guest report a repair need, or only operator/owner?
- Are repairs always linked to a specific incident, or are many proactive/routine?

**Approval:**
- What cost threshold today triggers an owner approval request? (e.g. anything over $50,000 COP)
- Is there a threshold below which the operator can proceed without asking?
- Do you want a hard approval gate (work cannot start until owner taps "Approve") or a soft one (operator proceeds and owner is notified)?
- Does the owner ever want to get multiple quotes before approving?

**Vendors:**
- Does your operator use a regular set of vendors (plumber, electrician, locksmith)?
- Should KAI maintain a vendor list per community with contact info?
- Should the owner be able to specify preferred vendors, or does the operator choose?

**Invoices and payment:**
- How are invoices shared today? WhatsApp photo? Email?
- Who pays the vendor — operator pays and charges back to owner, or owner pays directly?
- If operator advances the cost, how is reimbursement tracked?
- Are utility-linked repairs (e.g. water leak → high water bill) connected in your current process?

**Recurring repairs:**
- Are there repairs that repeat (AC filter every 3 months, deep clean annually)?
- Should these be schedulable as recurring service requests?

---

### 3. Guest Issues, Requests & Feedback

*Anything a guest raises during a stay that reaches the operator and may reach the owner.*

**Issue types (rank which are most common for you):**
- Access/key problems (lockout, lost key, keypad failure)
- AC/heating not working
- Hot water failure
- Wi-Fi down
- Noise complaint (from or about the unit)
- Missing amenity (no towels, broken appliance)
- Early check-in / late check-out request
- Guest damage report (pre or post stay)
- Guest complaint about building/community (pool, elevator, parking)

**Notification threshold:**
- For which issue types does the owner want to be notified immediately vs. after resolution?
- Are there issues the operator should always handle silently (minor, routine)?
- Should the owner receive a daily or weekly summary of guest issues even if none required immediate action?

**Feedback:**
- Does the operator currently share guest feedback (positive/negative) with you after a stay?
- Is feedback tied to a specific stay date?
- Would you want feedback captured in KAI to track patterns over time (e.g. "AC complaints in July every year")?
- Should 5-star / 4-star / negative review outcomes be logged against the unit?

**Operator response:**
- When the operator resolves a guest issue, do you want to see what action they took?
- Is there a case where you (the owner) need to be the one to resolve something directly with the guest?

---

### 4. Pricing — Base Rate, Peak Schedules & Markup

*Either party (owner or operator) can propose base pricing or peak period/schedule changes. The other party must confirm before any change is implemented. This is a locked design decision.*

**Confirmed workflow:**
- Owner proposes → operator must confirm before it takes effect
- Operator proposes → owner must confirm before it takes effect
- Neither party can unilaterally apply a pricing change
- All proposals, counter-proposals, confirmations, and rejections are logged immutably with timestamp and actor

**Current process:**
- How do pricing change conversations happen today? (owner messages operator, operator messages owner, or both?)
- How often does each party initiate changes? (weekly dynamic, monthly, seasonally)
- Do you use percentage markup (e.g. "+20% for Carnaval"), absolute amounts, or both?
- Has the operator ever proposed a price change you disagreed with? What happened?

**Pricing structure:**
- What is your current pricing model? (base nightly rate + weekday/weekend split + seasonal peaks?)
- Which peak periods apply to your unit? (Carnaval, Semana Santa, December, long weekends, local holidays)
- Is the peak period defined by a fixed calendar (same dates every year) or does it shift annually?
- Do you set a price floor (minimum below which you never want to price regardless of who proposes)?
- Is cleaning fee included in the per-night rate or listed separately? Does it change with season?

**Proposal workflow detail:**
- When either party proposes, should the other party receive both an email notification and an in-app badge?
- Should the proposing party be able to include a note/reason with their proposal? (e.g. "Carnaval demand up 30% vs last year")
- Is counter-proposal needed? (e.g. operator proposes $180/night → owner counter-proposes $165/night → operator confirms)
- How quickly must the receiving party confirm? Is there a timeout after which the proposal expires or auto-approves?
- If no response within 48 hours, should the proposal expire (safer) or auto-approve (faster)?
- Can a proposal be withdrawn by the proposer before the other party responds?

**Peak period / schedule specifics:**
- Is a "peak period" just a date range + multiplier, or does it have more fields? (name, minimum stay, different rates for weekday vs. weekend within peak)
- Who owns the peak calendar — owner defines the periods, operator applies rates? Or fully shared?
- If an operator wants to add a new peak period (e.g. a new local festival), does that require owner confirmation the same as a rate change?
- Can the same unit have multiple overlapping peak rules? How are conflicts resolved?

**Platform updates:**
- After a change is confirmed, who actually updates Airbnb/VRBO? Operator, owner, or shared?
- Should the confirming party be required to log "Updated on Airbnb: ✓" inside KAI to close the loop?
- Would an iCal or Airbnb API sync (automatic price push) be valuable, or is manual update acceptable for now?

**History and disputes:**
- Have you ever had a disagreement with your operator about what price was agreed?
- How far back do you need pricing history to be queryable? (1 year? full history?)
- Should the pricing history be exportable (CSV, PDF) for tax or accounting purposes?

---

### 5. Owner General Requests

*Ad hoc requests from owner to operator that don't fit a specific category.*

**Common types (from WhatsApp experience):**
- "Can you check on the unit this week?"
- "Please make sure the balcony furniture is put away before the storm"
- "A friend is arriving Thursday — can you leave a welcome bag?"
- "Can you coordinate with the building about the parking sticker renewal?"
- "Send me the current photo of the unit"

**Workflow questions:**
- Should general requests have a status (sent → acknowledged → done)?
- Do you want photo confirmation when a task is complete?
- Should these be categorized, or free-form text with optional photo?
- What's the typical response time you expect from your operator?
- Should overdue requests (no acknowledgment in X hours) send you a nudge?

---

### 6. Listing Information & Photos

*Managing the Airbnb/VRBO listing content — description, amenities, photos.*

**Current ownership:**
- Who currently manages the Airbnb listing — you, the operator, or both?
- Do you log in to Airbnb directly, or do you have the operator update it?

**Change requests:**
- What listing fields do you most commonly need to update? (title, description, house rules, amenities checklist, check-in instructions, photos)
- How often are photos refreshed? (seasonally, after renovation, after damage repair)
- Is the operator responsible for taking new photos, or do you hire a photographer?

**Approval workflow:**
- If the operator proposes a listing change (new house rule, updated description), do you want to approve it before it goes live?
- Should there be a version history of listing changes so you can roll back?

**Compliance:**
- Are there specific house rules required by your community (HOA rules, noise curfews, pool hours) that must always appear in the listing?
- Does the building or HOA have any listing restrictions (e.g. max occupancy limits)?

---

### 7. Unit Bills & Utilities

*Electricity, water, gas, internet, building fees — tracking, sharing, and dispute resolution.*

**Which bills:**
- Which utilities does the owner pay? Which does the operator advance?
- Is electricity billed separately to the unit, or shared/averaged across the building?
- Does internet have a separate bill or is it included in building fees?
- Are there platform/service fees (Airbnb host fee, OTA commission) tracked here or separately?

**Current process:**
- How does the operator share utility bills today? Photo on WhatsApp? Email?
- Are there months where you've questioned a bill amount (unusually high electricity, etc.)?
- Is there a process for comparing bill amounts month-over-month?

**Linking bills to events:**
- When a guest causes abnormally high usage (e.g. left AC on constantly), do you want that linked to the stay in KAI?
- Should the operator be required to note a reason for any bill that is more than X% above the prior month?

**Payment tracking:**
- Do you want to track which bills have been paid vs. outstanding?
- Should the system alert you when a bill is due or overdue?
- Is there a building administration fee (cuota de administración) that is monthly and recurring?

---

### 8. Other Topics Observed in WhatsApp (Confirm/Expand)

*Topics that commonly appear in owner-operator chats but may not fit the above categories.*

**Key handoffs and access:**
- Does your operator manage physical keys, smart locks, or a combination?
- Are there key/access code changes needed between guests? Is this logged?
- Do you want the owner to be notified every time an access code is changed?

**Guest check-in and check-out:**
- Does the operator or a staff member physically attend check-in?
- Is there a check-in report (condition, missing items, initial photos)?
- Is there a check-out report? Who does it? How quickly after guest departure?

**Damage and disputes:**
- If a guest causes damage, what is the current process? (Airbnb resolution center, direct charge, absorbed by operator)
- Should damage reports link to a service request for repair, to a listing incident, and to the guest stay record, all at once?
- Have you had a case where the operator and owner disagreed about whether damage was pre-existing?

**Owner visits (personal use):**
- How often do you visit your own unit?
- Do you notify the operator in advance via WhatsApp today?
- Do you need the unit prepared differently for personal use vs. guest arrival?

**Financial reporting:**
- Do you currently receive a monthly revenue/expense summary from your operator?
- What format — WhatsApp message, PDF, spreadsheet?
- What line items matter most: gross revenue, net after fees, operating costs, net to owner?
- Would you want a KAI-generated monthly statement the operator cannot edit after you've seen it?

**Operator communication style:**
- Are most of your operator messages time-sensitive (need reply within hours) or async (next day is fine)?
- Are there things your operator currently over-communicates (you don't need to know) vs. under-communicates (you wish they'd told you)?
- Is there a language preference between you and your operator?

---

## Priority Matrix — Which Use Cases to Build First

Based on frequency and pain level from a typical owner-operator WhatsApp relationship:

| Use case | Frequency | Pain without system | Build in phase |
|---|---|---|---|
| Repair request + owner approval | Weekly | High (lost approvals, surprise costs) | Phase 3 |
| Building admin notices to operator | Weekly | Medium (operator misses notice) | Phase 1 (unit profile) / Phase 3 |
| Guest issue notification to owner | Per stay | High (owner out of loop) | Phase 3 |
| Pricing change request + approval | Monthly | High (disputes, no audit trail) | Phase 5 |
| Owner general requests to operator | Weekly | Medium (no acknowledgment, forgotten) | Phase 3 (general request type) |
| Utility bill sharing | Monthly | Medium (photos lost in chat) | Phase 6 |
| Listing info/photo updates | Quarterly | Low (infrequent, manageable by DM) | Phase 6 |
| Check-in / check-out reports | Per stay | Medium (no structured record) | Phase 3 extension |
| Financial summary | Monthly | High (manual, inconsistent) | Phase 6 |
| Access / key management | Per stay | Medium | Phase 1 (unit profile notes) |

---

*Complete the questions in sections 3, 4, and 7 first — guest issues, pricing, and utilities are where WhatsApp breaks down hardest and where KAI creates the most immediate value.*
