# Go-to-Market & Pricing Model
# KAI Operator Portal

> Reference document — updated May 2026  
> Companion to: `OPERATOR_PORTAL_PROPOSAL.md`

---

## 1. Product Context

KAI is a community-scoped incident and property management platform for short-term rental (STR) owners inside gated residential communities. The Operator Portal extends this to the professional operators who manage those units on behalf of owners.

**Key structural facts that shape GTM:**
- Each community is an isolated tenant with its own admin hierarchy and branding.
- The multi-community architecture already exists — one operator can manage units across many communities from a single login.
- The platform runs in Spanish and English; the primary live market is Colombia (Cartagena / Serena del Mar anchor).
- The invite URL deep link (`?community=XYZ`) enables friction-free onboarding of new members via a single shareable link.

---

## 2. Customer Segments

### Primary Buyers

| Segment | Who they are | Why they buy |
|---|---|---|
| **Community Admin / HOA Board** | Property manager or board president of a residential community | Wants structured incident and operator accountability across all units |
| **Professional Operator** | Individual or small company managing 5–50 STR units | Needs a consolidated multi-community dashboard and an audit trail to protect against owner disputes |

### Secondary / Influenced Users

| Segment | Who they are | Role in adoption |
|---|---|---|
| **Unit Owner** | Absentee owner of 1–4 apartments | Approves work orders and pricing changes; platform reduces surprise costs |
| **Operator Staff** | Cleaner, supervisor, logistics person | Daily task list from phone; drives daily active use metric |

### Buyer vs. User Split

The **buyer** is typically the Community Admin or the Operator. The **users** are owners and staff. Pricing should be charged to the buyer, not the end user.

---

## 3. Go-to-Market Strategy

### 3.1 Primary Motion: Community-Led (Top-Down)

**Thesis:** One sale to a community admin unlocks every unit owner and operator in that community. The existing invite URL makes onboarding zero-friction.

**How it works:**
1. Land one community admin (cold outreach, referral, or conference).
2. Admin distributes `?community=XYZ` invite link to all unit owners via WhatsApp or email.
3. Owners onboard and naturally pull their operators in (or operators self-register).
4. Operators who span multiple communities become cross-community growth vectors.

**Why this fits the product:** The community config and branding system is already built. Each community feels like its own product, reducing "this doesn't apply to me" objections.

---

### 3.2 Secondary Motion: Operator-Led (Bottom-Up)

**Thesis:** Operators managing 10–50 units across multiple communities feel the pain hardest (WhatsApp chaos, lost invoices, owner disputes). They become internal champions who push adoption to community management.

**How it works:**
1. Operator signs up for free (no credit card).
2. They link their first community — triggers an email/notification to the community admin.
3. Admin activates the community or the operator pays for it directly.
4. Operator's presence across 3–5 communities creates network density.

**Why this fits:** The multi-community operator view is already designed. Operators are also easier to reach at STR industry events and Facebook groups than HOA boards.

---

### 3.3 Geographic Expansion Sequence

Concentrate before expanding. Word-of-mouth within a market is faster than scattered multi-city presence.

| Phase | Market | Rationale |
|---|---|---|
| **Now** | Cartagena (Serena del Mar anchor) | Existing live users; density compounds |
| **Phase 2** | Medellín (El Poblado, Laureles) | High STR concentration; tech-forward operators |
| **Phase 3** | Bogotá (Chapinero, Rosales) | Corporate STR demand; more formal operator ecosystem |
| **Phase 4** | CDMX / Miami Beach | Larger market; requires localization investment |

Do not enter Phase 4 markets until you have ≥3 reference communities in Phase 1–3 markets.

---

### 3.4 Channels

| Channel | Priority | Notes |
|---|---|---|
| Direct / founder-led sales | High (now) | Best for first 10 community deals |
| STR operator WhatsApp groups & Facebook groups | High | Operators self-organize; organic content about "no more WhatsApp chaos" resonates |
| Airbnb co-host community | Medium | Co-hosts = operators; Airbnb has its own forums |
| Real estate developer partnerships | Medium | New developments (like Serena del Mar) need community management software from day 1 |
| Property management associations (Lonja) | Low-medium | Slower cycle but credible validation |

---

## 4. Pricing Model

### 4.1 Recommended Model: Per-Community Flat + Operator Add-On

**Rationale:** HOA boards and property managers have fixed monthly budgets. A flat per-community fee is easy to justify and approve. The operator add-on captures value from professional operators who benefit most from the multi-community view.

---

### Tier Structure

#### Community Plan (sold to Community Admin)
Covers all unit owners and non-professional use within one community.

| Tier | Price | Includes |
|---|---|---|
| **Starter** | Free | Up to 20 units, incidents, basic notifications |
| **Community** | $49 / month | Up to 100 units, full incident workflow, operator linking, analytics |
| **Community Pro** | $99 / month | Unlimited units, custom branding, SLA config, audit logs, priority support |

> Annual pricing: 2 months free (≈17% discount).

---

#### Operator Plan (sold to Professional Operator)
Covers the operator's multi-community dashboard, staff management, service requests, pricing log, and document vault. Billed per operator account, regardless of how many communities they work in.

| Tier | Price | Includes |
|---|---|---|
| **Operator Basic** | Free | 1 community, up to 10 units, no staff accounts |
| **Operator Pro** | $29 / month | Unlimited communities and units, up to 5 staff accounts, service requests, invoice archive |
| **Operator Team** | $59 / month | Everything in Pro + unlimited staff accounts, daily task view, quarterly auto-reports |

> If the operator's community is already on a paid Community plan, the Operator Basic tier is always free within that community.

---

### 4.2 Alternative Models (considered, not recommended for launch)

| Model | Pros | Cons | When to revisit |
|---|---|---|---|
| **Per-unit pricing** (e.g. $2/unit/month) | Scales with community size | Hard to budget; feels like a meter | After you have >50 communities and usage data |
| **Transaction fee** (% of approved work orders) | Aligns with value | Requires payment infrastructure; operators will route around it | Phase 3+ when you process payments |
| **Platform + marketplace** | Network effects | Requires critical mass to work | Year 2–3 |
| **White-label / setup fee** | High ACV for enterprise property managers | Long sales cycle; custom support burden | When you have a dedicated enterprise sales motion |

---

### 4.3 Pilot / Early Adopter Pricing

For the first 10 communities:
- **Free for 6 months**, then 50% off for life (locks them in as reference customers).
- In exchange: product feedback sessions, permission to use as a case study, introduction to 2 other community admins.

For the first 20 operators:
- **Operator Pro free for 3 months**.
- In exchange: weekly 20-minute feedback calls for first 6 weeks.

---

## 5. Revenue Model Summary

### Unit Economics at Scale (illustrative)

| Metric | Conservative | Base | Optimistic |
|---|---|---|---|
| Communities (Year 1) | 10 | 25 | 50 |
| Avg revenue / community / month | $49 | $75 | $99 |
| Operators (Year 1) | 15 | 40 | 100 |
| Avg revenue / operator / month | $0 (pilots) | $29 | $45 |
| **MRR (Year 1 end)** | **~$490** | **~$3,035** | **~$9,450** |

Year 2 growth lever: operator accounts scale faster than communities because operators span multiple communities.

---

## 6. Key Metrics to Track

| Metric | Why it matters |
|---|---|
| Communities activated (paid) | Primary revenue driver |
| Units linked to an operator | Measures operator portal adoption depth |
| Service requests created / month | Leading indicator of daily habit |
| Owner approval rate on work orders | Product health signal (too low = friction problem) |
| Operator churn | Operators are stickier than community admins if they use it daily |
| Time to first operator link (per community) | Measures how well the invite flow works |

---

## 7. Open Questions Before Finalizing Pricing

1. Are operators willing to pay separately from the community subscription, or do they expect the community to absorb the cost?
2. What is the median number of units a professional operator manages in the target market?
3. Is the Starter (free community) tier enough to drive meaningful operator adoption, or does it create a free-rider problem?
4. Should WhatsApp notification delivery (via Twilio / Meta Business API) be a paid add-on or included?
5. At what unit count does the per-community flat fee feel unfair to small communities vs. large towers?

---

*This document should be reviewed with at least 5 operator interviews and 5 community admin interviews before committing to the tier structure.*
