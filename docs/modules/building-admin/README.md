# `building-admin` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `building-admin`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

The HOA / community admin's day-to-day operating surface for the
building or complex itself: resident directory, board governance, HOA
fees and fines, document library, reserve fund and budget, and per-
community announcements.

Distinct from the Airbnb operator's pillar (`operator-portal`), which
owns *unit-level* STR operations. The building admin owns the operations
of the facility/complex; the Airbnb operator owns the listing and
guest-derived work for a unit.

## Why it exists

Today the building admin runs HOA fees in Excel, board minutes in
Google Drive, fine workflow in WhatsApp, and the resident directory
across at least three places (the building intercom panel, the guard's
notebook, and a printed list). Consequences:

- Fees and dunning miss residents who changed contact info
- Board decisions are not searchable; new admins have no history
- Fine workflow has no audit trail
- Owners and renters appear inconsistently across resident-facing
  surfaces

A module that owns the resident graph and the recurring administrative
cycles makes the building admin's week tractable and gives every other
module (incidents, operator-portal, communications) a single source of
truth for *who lives where*.

## Sketch of scope

A more detailed sketch lives in `../../platform/ROADMAP.md` §6.2 and
the H2 horizon plan.

**In scope:**
- Resident & owner directory (unit ↔ resident graph; renters; emergency
  contacts; consent flags).
- Board governance: committees, meeting minutes, polls, bylaw amendments.
- HOA fees / cuotas — recurring billing, late fees, statements.
- Fines & violations — issued, contested, paid; linked to the
  `incidents` module when a violation arises from one.
- Reserve fund & budget at a glance.
- Document library: bylaws, regulations, permits, insurance certificates.

**Out of scope:**
- Airbnb operator-owner relationship (`operator-portal`).
- Front-desk / guard real-time event stream (`front-desk`).
- Resident self-service portal surface (`resident-experience`).
- Building-wide incident triage (`incidents`).
- Tourism / regulatory reporting (`compliance`, `tourism`).

## Likely owned tables (sketch)

`hoa_fees_schedule`, `hoa_fee_invoices`, `fines`, `board_meetings`,
`board_minutes`, `polls`, `residents` (or a per-unit `unit_residency`
relation), `hoa_documents`.

## Likely capability keys (sketch)

`building-admin:edit-residents`, `building-admin:issue-fine`,
`building-admin:waive-fine`, `building-admin:publish-minutes`,
`building-admin:edit-fees`.

## Dependencies

- **Hard:** platform layer (units, communities, users, audit, documents,
  payments).
- **Soft:** `incidents` (rule-violation incidents flow into fines);
  `communications` (announcements / polls reuse the comms hub);
  `resident-experience` (residents see their own statements and fines
  through that surface).

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` and update
status here and in `../../PLATFORM_ARCHITECTURE.md` §3 in the same
change. A discovery cycle with the building admin who runs at least
one pilot community is the precondition for that work.
