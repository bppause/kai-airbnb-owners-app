# `tourism` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `tourism`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

A per-community curated content pack for guests — restaurants, services,
transport, emergency contacts, language tips — with per-unit overrides,
delivered through guest-facing read-only surfaces (in-unit QR code,
linkable URL pasted into the Airbnb welcome message).

## Why it exists

Owners and operators get repeatedly asked the same things by guests:
where to eat, how to get a taxi, what to do, beach access, day trips.
Today this is solved with PDFs in the apartment and ad hoc messages,
which go out of date fast and vary unit-to-unit by accident rather than
intent.

## Sketch of scope

A more detailed sketch lives in `../../platform/DESIGN.md` §5.2.

**In scope:**
- Per-community curated content pack (categories: dining, services,
  transport, emergency, language).
- Per-unit overrides (the owner's recommended coffee shop differs from
  the community default).
- Lightweight CMS for community admins (or designated
  community-module admin: `tourism:edit-content`).
- Guest-facing surface delivered via in-unit QR code → public read-only
  landing page, and via a linkable URL the operator can paste into the
  Airbnb welcome message.
- Optional booking relays for taxi / day trip categories that create an
  operator-portal request thread instead of holding the booking in this
  module.

**Out of scope:** acting as a booking engine for third parties; holding
payment; replicating Google Maps.

## Likely owned tables (sketch)

`tourism_pois` (points of interest), `tourism_categories`,
`tourism_unit_overrides`, `tourism_publications` (for QR/URL versioning).

## Likely capability keys (sketch)

`tourism:edit-content`, `tourism:publish`, `tourism:override-per-unit`.

## Dependencies

- **Hard:** platform layer only (communities, units).
- **Soft:** none. A community can publish content without operators in
  place.

When the facilities module is live, tourism content publishes facility
closures automatically (so the public landing page never advertises a
pool that is shut for maintenance).

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` to this folder.
Update status here and in `../../PLATFORM_ARCHITECTURE.md` §3 in the
same change.
