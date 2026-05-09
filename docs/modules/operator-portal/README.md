# `operator-portal` — Module Documentation

> **Status:** concept (approved design, pending implementation)
> **Slug:** `operator-portal`
> **Server code:** *(not yet)* — will live at `server/modules/operator-portal/`
> **Client code:** *(not yet)* — will live at `client/src/modules/operator-portal/`

## Purpose

Replaces the WhatsApp group that today connects the **operator (host)**,
the **owner (co-host)**, and **operator staff** for a unit. Every
actionable WhatsApp message becomes a typed, tracked request with type,
owner, status, SLA timer, threaded follow-ups, and scoped visibility.

## Design summary

A summary lives in `../../platform/DESIGN.md` §4. The key shape:

- **New roles**: `operator`, `operator_staff`. Owners split into
  **Payout Owner** (one per unit, financial approval rights) and
  **Calendar Owner** (one or more per unit, financial figures hidden).
- **Relationship lifecycle**: `unmanaged → pending_(operator|owner) →
  active → terminated`. 1 unit ↔ 0 or 1 active operator; 1 operator ↔ N
  units across M communities.
- **Listing-management contract** stored per relationship; drives repair
  approval threshold, SLA tiers, included services, termination terms.
- **Request taxonomy** (full table in `USE_CASE_DISCOVERY.md` §"Request
  Type Taxonomy"): repair approval / FYI, guest issue, booking relay,
  pricing & peak-period proposals, damage (AirCover vs. owner
  insurance), non-guest cleaning, utility bills, task requests, calendar
  blocks, listing change requests, document requests, general questions.
- **Unified attention inbox** — both operator and owners see *"What
  needs me right now?"* with SLA-aging timers.
- **Delegation into the incidents module** via per-unit
  `delegation_level` (`owner_handles` / `operator_assists` /
  `operator_handles`) with `"acting on behalf of"` audit attribution.

## Documents in this folder

| File | Purpose |
| --- | --- |
| [`README.md`](README.md) | This index. |
| [`DESIGN.md`](DESIGN.md) | Full technical design — roles, lifecycle, tables, endpoints, phases. |
| [`DIAGRAMS.md`](DIAGRAMS.md) | Mermaid architecture diagrams: relationship lifecycle, role model, request taxonomy direction, service-request state machine, pricing proposal sequence, delegation matrix, ER, attention inbox, phasing. |
| [`PROPOSAL.md`](PROPOSAL.md) | Client-facing proposal (Spanish + English). |
| [`USE_CASE_DISCOVERY.md`](USE_CASE_DISCOVERY.md) | Use cases grounded in real WhatsApp chat data, request taxonomy, SLA reference, comprehensive question set, priority matrix, blocking questions. |
| [`PROTOTYPE_READINESS.md`](PROTOTYPE_READINESS.md) | Decisions locked, role model, MVP scope, Claude Max cost reference. |
| [`GTM_AND_PRICING.md`](GTM_AND_PRICING.md) | Go-to-market and pricing model for the operator portal. |

## Implementation phasing

Phases 1–7 in `DESIGN.md` §"Implementation Phases". Recommended MVP is
**Phases 1–3** (operator identity + unit linking, cross-community
dashboard, service requests with cost gate).

## Open questions blocking start

Listed in `USE_CASE_DISCOVERY.md` §"Questions That Must Be Answered Before
Building" and summarized in `../../platform/DESIGN.md` §4.11:

- Multi-owner approval semantics (Payout vs. Calendar Owner approval rights).
- Pricing-proposal expiry: silent expire vs. auto-approve at 48h.
- Smart Pricing on/off: bidirectional confirm or operator's call?
- Listing transition on relationship end.
- Whether team members get individual platform accounts in v1.

## Companion documents

- `../../platform/PLATFORM_ARCHITECTURE.md` — module contract every new module
  must follow.
- `../../platform/DESIGN.md` §4 — operator-portal summary in the
  platform-wide design.
- `../incidents/README.md` — incidents module the delegation model plugs
  into.
