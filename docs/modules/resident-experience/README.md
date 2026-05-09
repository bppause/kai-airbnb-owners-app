# `resident-experience` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `resident-experience`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

The owner / renter facing surface for *living in* the building (as
opposed to operating a unit on Airbnb). A unified self-service portal
covering: announcements seen by this resident, fees due, packages
waiting, visitors expected, amenity reservations, owner-initiated
maintenance for in-unit issues, and move-in / move-out workflow.

A resident is not the same as an *owner-as-co-host*. The same person
may have both views (resident in their own unit; co-host on another
unit they own elsewhere); each view lives in a different module.

## Why it exists

Residents today juggle a building WhatsApp, the guard's notebook for
package receipts, an Excel-or-PDF for HOA fees, an in-person sign-up
sheet for the BBQ, and the building intercom for visitor calls. None of
these are connected and most are not auditable.

A self-service portal collapses the resident's recurring jobs-to-be-done
into one surface and makes the building admin's job easier (fewer
phone calls, fewer paper sheets).

## Sketch of scope

A more detailed sketch lives in `../../platform/ROADMAP.md` §6.5.

**In scope:**
- Resident portal home: notices, fees due, my packages, my visitors,
  my reservations, my open maintenance tickets.
- Amenity reservations: pool, jacuzzi, sauna, BBQ, gym, meeting room,
  parking, visitor spaces. Conflict detection; per-amenity rules
  (max consecutive hours, advance-notice window, capacity).
- Personal visitor & vehicle pre-registration (self-service alternative
  to phoning the guard).
- Move-in / move-out workflow: inventory, key handoff, deposit
  handling, condition photos.
- Owner-initiated in-unit maintenance requests (only when the unit is
  not under an Airbnb operator's management — otherwise these belong
  in `operator-portal`).

**Out of scope:**
- Building admin's side of fees / fines / governance (`building-admin`).
- Front-desk real-time event stream (`front-desk`).
- Airbnb guest pre-arrival (`guest-mgmt`).
- The Airbnb operator's relationship with the owner (`operator-portal`).

## Likely owned tables (sketch)

`amenities`, `amenity_reservations`, `amenity_rules`, `move_events`,
`unit_maintenance_requests` (when not routed through `operator-portal`).

## Likely capability keys (sketch)

`resident:reserve-amenity`, `resident:cancel-reservation`,
`resident:preregister-visitor`, `resident:open-maintenance`,
`resident:submit-move-checklist`.

## Dependencies

- **Hard:** platform layer (units, users, audit).
- **Soft:** `building-admin` (resident directory + fees), `front-desk`
  (visitor pre-reg flows to the guard), `incidents` (an amenity issue
  becomes a community incident), `communications` (announcements
  surface here), `operator-portal` (in-unit maintenance routing
  depends on whether the unit is operator-managed).

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` and update
status here and in `../../platform/PLATFORM_ARCHITECTURE.md` §3. Auth-mode
question for residents who do not use Gmail (renters in particular)
applies here as it does for `front-desk`.
