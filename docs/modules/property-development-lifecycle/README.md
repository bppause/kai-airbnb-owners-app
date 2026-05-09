# `property-development-lifecycle` — Module Documentation

> **Status:** idea (placeholder proposal exists; no detailed design yet)
> **Slug:** `property-development-lifecycle`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

A module that covers the **full property lifecycle before, during, and
after the operating phase**: pre-sale lead capture → contracts and
milestone payments → construction-progress communications → pre-delivery
inspection (acta de entrega) → handover → 1/5/10-year warranty defect
routing → resale and ownership transfer.

The unit is the through-line: it is the same record that later becomes the
subject of incidents, operator management, and tourism content — but
populated and owned long before the operating phase begins.

## Why it exists

Today this phase lives in WhatsApp, scattered emails, broker spreadsheets,
the developer's CRM (if any), and physical folders. Consequences observed
by owners and admins:

- Pre-sale leads tracked in broker Excel — no follow-up trail
- Payment plans communicated by email; late instalments not caught early
- Construction progress shown via group-chat photos
- Pre-delivery inspections done on paper; defect patterns never aggregated
- Opaque 1/5/10-year warranties — owners don't know what to claim or when
- Resale happens without history transfer; new owner inherits a black box

A module that owns this phase keeps the unit's history continuous and
gives the developer, buyer, building admin, and future owner one source of
truth instead of seven.

## Sketch of scope

A more detailed sketch lives in [`PROPOSAL.md`](./PROPOSAL.md) (placeholder,
bilingual). High-level phases:

1. Lead capture & buyer portal
2. Sales contract & milestone payment plan
3. Construction progress communications
4. Pre-delivery inspection (acta de entrega)
5. Handover & buyer → owner transition
6. Post-sale warranty period (1/5/10 years under Colombian law), routed
   to the developer (not the Airbnb operator, not the building admin)
7. Resale & ownership transfer

**In scope:** the relationship and document layer between developer,
buyer, and future owner during these phases.

**Out of scope:** acting as a CRM (integrate with HubSpot / Salesforce /
Zoho if the developer has one); replacing accounting (export to Siigo /
QuickBooks); handling the e-signature flow itself (integrate with
DocuSign / FirmaYa / Signio).

## Likely owned tables (sketch)

`development_projects`, `project_milestones`, `units_pre_sale_state`
(extends platform `units` with pre-sale lifecycle fields),
`sales_contracts`, `payment_plan_instalments`, `acta_findings`,
`warranty_claims`.

## Likely capability keys (sketch)

`property-dev:edit-project`, `property-dev:approve-acta`,
`property-dev:route-warranty`, `property-dev:transfer-ownership`.

## Dependencies

- **Hard:** platform layer (units, communities, users, audit, documents).
- **Soft:** `incidents` (during construction, an issue raised by an
  early-handover unit can flow as an incident); `operator-portal`
  (handover triggers operator invitation if the unit is going to STR).

## Status next steps

When promoted from `idea` → `concept`, the placeholder
[`PROPOSAL.md`](./PROPOSAL.md) is replaced with (or supplemented by) a
proper `DESIGN.md`. Update status here and in
`../../PLATFORM_ARCHITECTURE.md` §3 in the same change. Detailed design
requires a discovery cycle with at least one developer partner —
analogous to the WhatsApp-transcript work that grounded the operator
portal in `../operator-portal/USE_CASE_DISCOVERY.md`.

## Cross-references

- [`PROPOSAL.md`](./PROPOSAL.md) — bilingual placeholder proposal (ES + EN).
- `../../platform/ROADMAP.md` §6.1 (Horizon H3) — where this module sits
  in the platform-wide roadmap.
- `../../platform/PITCH.md` — investor / client framing of why the
  full-lifecycle promise matters.
