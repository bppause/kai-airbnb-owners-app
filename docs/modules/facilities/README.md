# `facilities` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `facilities`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

Operations layer for shared community amenities — pool, gym, party room,
BBQ, parking, elevators, common laundry — covering inventory,
reservations where applicable, closures with cross-module impact, and the
HOA / building rules library that listing edits must respect.

## Why it exists

Every community has shared amenities, and operations on those amenities
(reservations, closures, maintenance, HOA notices) live in WhatsApp
groups and printed signs today. The closure and rules surfaces matter
beyond the building admin's own context: closures during an active or
upcoming guest stay are an operator obligation, and HOA rules are a
listing-content obligation.

## Sketch of scope

A more detailed sketch lives in `../../platform/DESIGN.md` §5.3.

**In scope:**
- Amenity inventory per community (name, capacity, hours, rules,
  photos).
- Reservations where applicable (party room, BBQ, guest parking) with
  conflict checks and per-unit quotas.
- **Closure notices** with start/end + reason — the cross-module event
  type:
  - The operator-portal must surface closures as a `building notice`
    request against any unit with an in-progress or upcoming guest stay.
  - The tourism module's content pack reflects closures on the public
    landing page automatically.
- Maintenance schedule for amenities, with the option to spawn an
  incident or service request when something breaks.
- HOA / building rules library that the operator-portal references so
  listing-content updates can be flagged when they would remove a
  required rule.

**Out of scope:** replacing the HOA's accounting or fee-collection
system; full PMS replacement (this is operations only).

## Likely owned tables (sketch)

`facility_amenities`, `facility_reservations`, `facility_closures`,
`facility_rules`.

## Likely capability keys (sketch)

`facilities:manage-amenities`, `facilities:manage-reservations`,
`facilities:publish-closure`, `facilities:manage-rules`.

## Dependencies

- **Hard:** platform layer (communities, units).
- **Soft:** operator-portal (closures fan out through operator-portal
  request threads when present, but degrade gracefully to plain
  notifications when not). Ideally guest-mgmt for stay-impact detection.

## Cross-module integration (when live)

- A `facility_closures` row that overlaps an active or upcoming guest
  stay triggers an operator-portal `building notice` request requiring
  operator acknowledgement and (if guest-impacting) a prompt to message
  the guest on Airbnb.
- The operator-portal's listing-change request consults `facility_rules`
  and warns if the change would remove a required HOA rule from the
  listing.
- Tourism content publishes closures automatically.

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` to this folder.
Update status here and in `../../platform/PLATFORM_ARCHITECTURE.md` §3 in the
same change.
