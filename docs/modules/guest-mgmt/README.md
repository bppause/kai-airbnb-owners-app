# `guest-mgmt` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `guest-mgmt`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

Operational layer for **per-stay** concerns that straddle "the booking" and
"the unit": pre-arrival communication checklist, in-stay issue feed
scoped to the active stay, the **per-stay inspection photo log** that
AirCover claims and damage attribution depend on, post-stay review draft
+ owner approval, and a per-unit guest block list.

## Why it exists

The platform deliberately does not replace Airbnb for booking and payouts
(that data stays on Airbnb). But several operational gaps are not
addressable from inside the operator-portal alone:

- The single most-cited gap in `../operator-portal/USE_CASE_DISCOVERY.md`
  is the absence of per-stay check-in / check-out inspection photos.
  Without them, "the damage was pre-existing" cannot be disproved and
  AirCover claims fail.
- Damage that straddles two consecutive stays cannot be attributed
  without a stay-anchored photo baseline.
- Review responses are published by the operator without the owner ever
  seeing the draft.

These all anchor on a per-stay record, which belongs in its own module
rather than being grafted onto operator-portal or incidents.

## Sketch of scope

A more detailed sketch lives in `../../platform/DESIGN.md` §5.1.

**In scope:**
- Lightweight per-stay record (dates, guest count, source platform,
  optional Airbnb reservation reference) — created by operator or future
  iCal/API sync.
- Pre-arrival checklist (welcome message sent, access instructions
  delivered, special-request acknowledgement).
- In-stay issue feed scoped to the active stay (surfaces relevant
  operator-portal request types).
- **Per-stay inspection photo log** (check-in baseline + check-out
  closeout).
- Review draft + owner approval before host response is published on
  Airbnb.
- Guest block list (per unit, owner-requested, operator-applied).

**Out of scope:** guest profiles, payments, calendar sync writeback,
direct guest messaging — all stay on Airbnb.

## Likely owned tables (sketch)

`guest_stays`, `stay_inspections`, `stay_inspection_photos`,
`review_drafts`, `guest_block_list`.

## Likely capability keys (sketch)

`guest-mgmt:create-stay`, `guest-mgmt:complete-inspection`,
`guest-mgmt:approve-review`, `guest-mgmt:manage-block-list`.

## Dependencies

- **Hard:** operator-portal must be live (this module needs the operator
  role and `unit_operator_relationships`).
- **Soft:** incidents module for escalation paths; facilities for
  in-stay closure impact (see `../facilities/README.md`).

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` and
`USE_CASE_DISCOVERY.md` to this folder following the same shape as
`../operator-portal/`. Update status here and in
`../../PLATFORM_ARCHITECTURE.md` §3 in the same change.
