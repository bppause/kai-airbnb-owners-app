# Operator Portal — Design & Implementation Reference

> Status: Approved for future implementation — pending client feedback
> Last updated: 2026-05-05

---

## Overview

Extends the platform with an **Operator Portal** that replaces WhatsApp group chats
between property operators and owners with structured, tracked, permanent workflows.

### Core Constraints
- 1 unit → 0 or 1 active operator (exclusive management)
- 1 operator → N units across M communities
- Operator navigator is community-agnostic (all units in one view)
- Both owner and operator must always have clear visibility into managed/unmanaged status
- Owner retains legal responsibility; operator acts on behalf of owner under a delegation model

---

## New Roles

| Role | Description |
|---|---|
| `operator` | Business/individual managing Airbnb units on behalf of owners. Cross-community. |
| `operator_staff` | Staff member under an operator. Can log in to update task/service request status. |

Operators are distinct from `delegate_admin` and `community_admin`. One operator may work
across multiple communities; their access is scoped to units they actively manage.

---

## Operator-Owner Relationship Lifecycle

### Establishment

Either party can initiate. Owner must always accept.

**Path A — Operator initiates (most common):**
1. Operator searches unit by community + apt number
2. System shows: owner name, current managed status
3. If unmanaged → operator sends "management proposal"
4. Owner receives in-app notification + email: accept / decline
5. Accepted → relationship status = `active`

**Path B — Owner initiates:**
1. Owner opens their listing → "Assign operator" button
2. Owner types operator email or business name
3. System finds operator account → owner sends invitation
4. Operator accepts / declines
5. Accepted → status = `active`

**Blocked path — already managed:**
- System shows: "Unit is currently managed by another operator."
- No request can be sent. Owner must terminate existing relationship first.
- Admin (global/community) can force-terminate in dispute resolution.

### Relationship States

| State | Owner sees | Operator sees |
|---|---|---|
| `unmanaged` | "No operator" + invite button | Unit not in portfolio |
| `pending_operator` | Notification + accept/decline | "Awaiting owner acceptance" |
| `pending_owner` | "Invitation sent" | Accept/decline prompt |
| `active` | Operator name, since date, activity | Full unit access |
| `terminated` | History (read-only), re-invite enabled | History (read-only) |

### Termination

Either party can terminate at any time.

**Termination flow:**
1. Party clicks "Release unit" (operator) or "Remove operator" (owner)
2. System checks for open service requests → warns if any exist
3. Confirmed → status = `terminated`; other party notified
4. All history (service requests, pricing log, documents, incidents) remains visible
   to both parties in read-only mode — nothing is deleted
5. Operator staff lose unit access immediately
6. Unit returns to `unmanaged` state

---

## Operator Staff

- Operator adds staff with: name, role label, email, WhatsApp
- Staff do not need platform accounts to be added as contacts
- Staff who need to update task status receive an invite linked to the operator
- Staff are cross-unit (one staff member can be assigned to multiple units across communities)

---

## Delegation Model (Incident Integration)

Controls how much the operator can act on behalf of the owner within the existing
incident Step 1 / Step 2 workflow.

| Level | Step 1 (verify + immediate action) | Step 2 (owner resolution) |
|---|---|---|
| `owner_handles` | Owner only; operator notified | Owner only |
| `operator_assists` *(default)* | Operator can complete on behalf of owner; owner notified | Owner must complete |
| `operator_handles` | Operator completes | Operator completes; owner notified |

**Audit trail:** All operator actions on incidents are labelled:
`"[Operator Name] acting on behalf of [Owner Name] — Unit [APT]"`

Community admins see full attribution in the incident detail view.

**Reporter identity** is always protected from operators (same rule as for owners).

---

## Database — New Tables / Columns

```sql
-- Operators
operator_profiles (
  id, user_uid, business_name, contact_email, contact_whatsapp,
  status, created_at
)

-- Operator ↔ Community (which communities they work in)
operator_communities (
  operator_id, community_id
)

-- Staff roster
operator_staff (
  id, operator_id, name, role_label, email, whatsapp,
  user_uid (nullable — only set if staff has a platform account),
  created_at
)

-- Operator ↔ Unit relationship
unit_operator_relationships (
  id, listing_id, operator_id, status (pending_operator | pending_owner | active | terminated),
  delegation_level (owner_handles | operator_assists | operator_handles),
  initiated_by (operator | owner),
  initiated_at, accepted_at, terminated_at, terminated_by
)

-- Unit profile (operator-maintained)
unit_profiles (
  id, listing_id, operator_id,
  amenities JSONB,          -- { hot_water, ac_units, sofa_bed, smart_lock_type, ... }
  bed_config JSONB,         -- { room1, room2, sofa_bed, total }
  airbnb_url, access_notes,
  updated_at
)

-- Service requests
service_requests (
  id, listing_id, operator_id, community_id,
  type (maintenance | repair | cleaning | inspection | regulatory | other),
  title, description, urgency (routine | urgent | emergency),
  status (draft | submitted | awaiting_approval | assigned | in_progress | completed | closed),
  estimated_cost, approved_cost, approved_by_uid, approved_at,
  assigned_staff_id, scheduled_at,
  linked_incident_id (nullable),
  created_by_uid, created_at, updated_at
)

-- Service request attachments (before/after photos, invoices)
service_request_attachments (
  id, service_request_id, type (photo | invoice | document),
  url, uploaded_by_uid, uploaded_at
)

-- Pricing records
unit_pricing (
  id, listing_id, operator_id,
  base_rate, weekend_rate, cleaning_fee,
  discounts JSONB,          -- { last_minute_pct, advance_pct, weekly_pct, monthly_pct }
  effective_from,
  status (draft | proposed | active | superseded)
)

-- Pricing change log (immutable)
pricing_decisions (
  id, listing_id, operator_id,
  proposed_by_uid, proposed_at, change_description,
  approved_by_uid, approved_at,
  old_rate, new_rate, effective_date
)

-- Owner date blocks
owner_blocks (
  id, listing_id, operator_id,
  start_date, end_date,
  reason (personal | family | maintenance | other), notes,
  status (requested | confirmed | cancelled),
  created_at, confirmed_at
)

-- Unit documents
unit_documents (
  id, listing_id, operator_id,
  type (rnt | utility | insurance | airbnb | other),
  filename, url, uploaded_by_uid, uploaded_at, notes
)
```

---

## API Endpoints — New Routes

```
# Operator profile
POST   /api/operators                          Create operator profile
GET    /api/operators/:id                      Get operator profile
PUT    /api/operators/:id                      Update profile

# Operator staff
GET    /api/operators/:id/staff                List staff
POST   /api/operators/:id/staff                Add staff member
PUT    /api/operators/:id/staff/:staffId       Update staff
DELETE /api/operators/:id/staff/:staffId       Remove staff

# Unit relationships
POST   /api/operators/:id/propose-unit         Operator proposes management of a unit
POST   /api/listings/:id/invite-operator       Owner invites operator
PATCH  /api/unit-relationships/:id/accept      Accept relationship (either party)
PATCH  /api/unit-relationships/:id/decline     Decline
PATCH  /api/unit-relationships/:id/terminate   Terminate active relationship
GET    /api/operators/:id/units                All units managed by operator (cross-community)

# Unit profile
GET    /api/listings/:id/unit-profile          Get unit profile
PUT    /api/listings/:id/unit-profile          Operator updates unit profile

# Service requests
GET    /api/operators/:id/service-requests     All requests across operator's portfolio
GET    /api/listings/:id/service-requests      Requests for a specific unit
POST   /api/listings/:id/service-requests      Create request
PATCH  /api/service-requests/:id               Update status, assign staff, add notes
PATCH  /api/service-requests/:id/approve       Owner approves cost
POST   /api/service-requests/:id/attachments   Upload photo or invoice

# Owner blocks
POST   /api/listings/:id/owner-blocks          Request a date block
PATCH  /api/owner-blocks/:id/confirm           Operator confirms block
PATCH  /api/owner-blocks/:id/cancel            Cancel block

# Pricing
GET    /api/listings/:id/pricing               Current pricing record
POST   /api/listings/:id/pricing/propose       Propose a price change
PATCH  /api/pricing-proposals/:id/approve      Owner or operator approves
GET    /api/listings/:id/pricing/log           Immutable decision history

# Documents
GET    /api/listings/:id/documents             List unit documents
POST   /api/listings/:id/documents             Upload document
DELETE /api/documents/:id                      Remove document
```

---

## Implementation Phases

### Phase 1 — Operator Identity & Unit Linking (~3 weeks)
- Operator registration + approval flow
- Staff roster (name, role, email, WhatsApp)
- Unit linking: search, propose, invite, accept, terminate
- Unit profile (amenities, beds, access notes, Airbnb URL)
- Status badges on listing cards (managed / unmanaged / pending)

### Phase 2 — Cross-Community Operator Dashboard (~2 weeks)
- Operator home: all units across all communities in one view
- Community filter (secondary, not primary navigation)
- Unit cards: status, pending action count, next scheduled event
- Staff view: cross-community assignment list per staff member
- "Needs attention" sort (pending approvals, overdue tasks first)

### Phase 3 — Service Requests & Work Orders (~4 weeks)
- Request types: Maintenance, Repair, Cleaning, Inspection, Regulatory, Other
- Full state machine: Draft → Submitted → Awaiting owner approval → Assigned → In progress → Completed → Closed
- Cost approval gate: any request with cost > 0 requires owner approval before work starts
- Staff assignment from operator's roster
- Photo attachments (before/after) + invoice upload
- Owner notification on every status change
- Link service request to existing incident record

### Phase 4 — Scheduling & Owner Blocks (~2 weeks)
- Owner date block request (personal use, family, maintenance)
- Operator confirms/declines block request
- Cleaning schedule: recurring rules + ad hoc cleanings as service requests
- Maintenance calendar: scheduled visits linked to service requests
- Conflict detection: block vs. existing booking or service visit

### Phase 5 — Pricing Log & Change Workflow (~3 weeks)
- Structured pricing record: base rate, weekend rate, seasonal rules, discounts
- Effective-date-based rates (2026 vs 2027 co-exist)
- Change request workflow: propose → review → approve/counter-propose
- Immutable decision log: who proposed, who approved, when, amounts
- Named season rules (Peak / Standard / Low) with date ranges + multipliers

### Phase 6 — Documents & Compliance (~2 weeks)
- Unit document store: RNT, utilities, insurance, Airbnb assets
- Invoice archive: all service request invoices auto-stored per unit
- Quarterly summary auto-generated: occupancy + service costs
- No more credentials in WhatsApp group descriptions

### Phase 7 — Staff Task Management (~3 weeks)
- Staff mobile view: today's assignments across all communities
- Status updates from mobile: Arrived / In progress / Done + photo
- Operator real-time view: who is where, completed vs. overdue
- Complete unit history visible to new staff from day one (eliminates onboarding gap)

---

## Incident Integration

See separate section above under "Delegation Model."

Key points:
- Operators see all incidents on their managed units
- Reporter identity always protected
- Delegation level controls who can complete Step 1 and Step 2
- All operator actions in the incident workflow are audited with "acting on behalf of" label
- Service requests can be created directly from an incident record (links the two)
- Operators get a cross-community incident feed for portfolio-level pattern visibility

---

## Frontend — Key Views to Build

| View | Role | Notes |
|---|---|---|
| Operator dashboard | operator | Cross-community, "needs attention" first |
| Unit detail (operator) | operator | Profile, active requests, schedule, pricing, documents |
| Staff roster | operator | Add/edit/remove staff, assign to units |
| Service request detail | operator + owner | Full workflow, cost approval, attachments |
| Owner unit page (extended) | owner | Shows operator info, pending approvals, block request button |
| Pricing log | operator + owner | History + propose change |
| Document vault | operator + owner | Upload, view, download |
| Operator management (admin) | global admin | Approve operators, force-terminate relationships |

---

## Open Questions for Client Feedback

1. Should operators pay a subscription fee or is this a community platform benefit?
2. Should staff members be able to log in independently or only update via operator account?
3. Is document storage needed in Phase 1 or can it wait?
4. Should the platform send WhatsApp messages (via Twilio/WATI) in addition to email?
5. Should owner blocks be confirmed automatically or always require operator confirmation?
6. Is pricing change workflow needed for Phase 1 or can operators update pricing directly first?
