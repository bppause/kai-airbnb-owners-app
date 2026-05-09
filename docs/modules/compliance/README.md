# `compliance` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `compliance`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

The regulatory / compliance / insurance layer: tourism authority
reporting (SIRE / Migración Colombia for foreign guests), Tourism
Registry (RNT) tracking and renewals, tourism tax calculation and
remittance, building rules and STR policy enforcement, insurance
policy registry and claim hand-off, and Habeas Data (Colombian PII)
consent and retention.

Distinct from `tourism`, which is the *content* layer (what to
recommend to a guest). This module is the *regulatory* layer (what
the law requires the building or operator to do).

## Why it exists

Today regulatory artifacts live in scattered places: RNT credentials
in WhatsApp groups (in plain text), SIRE batch reports filed manually
when an operator remembers, tax remittance done quarterly with
hand-edited spreadsheets, building rules embedded only inside Airbnb
listings, owner unit-insurance policies on paper. Failure modes:

- Foreign guest stays go unreported; the building or operator faces
  fines
- RNT lapses without warning
- Tourism tax is under-collected or under-remitted, with no audit trail
- Damage claims fail because the relevant insurance policy is not
  on file
- Habeas Data violations are invisible until a regulator asks

A module owning the calendar of obligations + the document/credential
ground truth + the report-generation surface keeps the building and
its operators above board without depending on any one person's
memory.

## Sketch of scope

A more detailed sketch lives in `../../platform/ROADMAP.md` §6.8 and
the H4 horizon plan.

**In scope:**
- Tourism authority reporting (SIRE / Migración Colombia for foreign
  guests; occupancy / origin / length-of-stay statistics).
- RNT: registration tracking, expiry/renewal reminders.
- Tourism tax: per-stay calculation, remittance reporting (national +
  municipal).
- Building rules & STR policy registry: STR caps per unit, quiet hours,
  pet rules, pool hours, fines policy. Surfaced into `tourism` (guest
  guidebook) and `operator-portal` (listing compliance).
- Insurance policy registry (building-side and per-unit owner
  policies); two-path damage hand-off integrates with
  `operator-portal`.
- Licensing & permits with renewal calendar.
- Habeas Data: data-subject access requests, retention rules,
  consent capture.
- Audit trail surfacing for regulatory inspection.

**Out of scope:**
- Filing AirCover claims (Airbnb owns that surface; `operator-portal`
  prepares the package).
- Acting as the e-signature / e-billing system itself (integrate with
  providers).
- Acting as the building's accounting GL (export to Siigo /
  QuickBooks).

## Likely owned tables (sketch)

`tourism_filings`, `rnt_registrations`, `tourism_tax_remittances`,
`building_rules`, `insurance_policies`, `pii_consent`,
`pii_retention_jobs`, `permit_renewals`.

## Likely capability keys (sketch)

`compliance:file-sire`, `compliance:edit-rnt`,
`compliance:remit-tourism-tax`, `compliance:edit-rules`,
`compliance:register-insurance`, `compliance:run-pii-request`.

## Dependencies

- **Hard:** platform layer (units, communities, users, audit, documents).
- **Soft:** `operator-portal` (booking relays drive SIRE reports;
  damage cases hand off to insurance), `tourism` (rules surface in
  guest content), `building-admin` (HOA insurance policy lives in
  the building admin's document library; this module is the
  per-unit and regulatory side).

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` and update
status here and in `../../PLATFORM_ARCHITECTURE.md` §3. Detailed
design must be reviewed by counsel before shipping (Habeas Data
exposure, tourism-tax remittance correctness).
