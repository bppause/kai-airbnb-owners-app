# `front-desk` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `front-desk`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

The guard / concierge / front-desk operating surface: visitor and
delivery pre-registration, package management, building access control
(codes / smart locks / badges), parking and vehicle log, guard shift
handover, and emergency response playbook surfacing.

This module sits under the building admin's ownership
(`building-admin`); it is *not* an extension of the Airbnb operator's
unit-level operations.

## Why it exists

Today these flows run on paper sheets at the guard desk, walkie-talkie
calls, and one-off WhatsApp messages between residents and the guard.
Consequences:

- Visitor logs are not auditable; "who came up to apartment 504 on
  Saturday?" is unanswerable a week later
- Packages get lost, delivered to wrong unit, or sit at the desk for
  weeks because no resident notification fires
- Access code rotation is informal; ex-staff and ex-vendors retain
  building entry
- Shift handover is verbal and lossy

A real-time event-stream module aimed at the front-desk surface keeps
the building accountable and gives residents and admins visibility
without standing at the desk.

## Sketch of scope

A more detailed sketch lives in `../../platform/ROADMAP.md` §6.4.

**In scope:**
- Visitor & delivery pre-registration by residents/owners; guard
  check-in.
- Package mgmt: receive → photograph → notify resident → confirm pickup.
- Access & security: smart locks, gate codes, badges, restricted areas,
  time-bound visitor codes.
- Parking & vehicle: owner/resident vehicle registry, visitor parking,
  violations, towing notes.
- Guard log / shift handover: notes, anomalies, incidents to escalate
  into the `incidents` module.
- Lost & found.
- Emergency response playbook surfacing (cross-references `incidents`
  for the canonical record).

**Out of scope:**
- The HOA / community admin's recurring cycles (`building-admin`).
- Resident self-service amenity reservations (`resident-experience`).
- Airbnb-guest pre-arrival flow that bridges to building access — that
  surface is split between `guest-mgmt` (guest side) and this module
  (guard side).

## Likely owned tables (sketch)

`visitor_preregistrations`, `visitor_checkins`, `packages`,
`access_codes`, `access_events`, `vehicles`, `parking_violations`,
`guard_shift_notes`, `lost_found_items`.

## Likely capability keys (sketch)

`front-desk:checkin-visitor`, `front-desk:log-package`,
`front-desk:rotate-access-code`, `front-desk:write-shift-note`,
`front-desk:flag-incident` (escalates to `incidents` module).

## Dependencies

- **Hard:** platform layer (units, communities, users, audit).
- **Soft:** `incidents` (anything the guard escalates flows there);
  `building-admin` (resident directory drives "who lives in 504?");
  `guest-mgmt` (Airbnb guest pre-arrival hands off building access);
  `resident-experience` (residents pre-register their own visitors).

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` and update
status here and in `../../PLATFORM_ARCHITECTURE.md` §3. The guard
persona does not use Gmail in most buildings, so Phase 0 of any
detailed design must answer the auth-mode question (kiosk PIN /
magic-link / shared-tablet) flagged in `../../platform/ROADMAP.md` §11.
