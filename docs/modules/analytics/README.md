# `analytics` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `analytics`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

The cross-module insight surface: KPI dashboards (admin, owner,
operator views), operator and vendor scorecards, a building health
score, anomaly detection (utility consumption, conflated damage
cases, access-pattern anomalies), AI-assisted notification triage and
drafting / translation, and the owner investment view (cap rate,
RevPAR proxy, comps).

A pull / dashboard surface with push alerts on detected anomalies —
distinct from the operating modules that produce the underlying
events.

## Why it exists

Each module produces events; nobody today reads them across modules.
The community admin doesn't know which units cause repeat incidents;
owners don't see how their unit performs vs. comps; operators don't
have a quantitative trust signal feeding back; nobody flags a utility
bill that's 3× the rolling average.

An analytics module reads from the other modules (without owning
their writes) and surfaces insight — both as static dashboards and as
push alerts when something crosses a threshold.

## Sketch of scope

A more detailed sketch lives in `../../platform/ROADMAP.md` §6.11
and the H5 horizon plan.

**In scope:**
- Admin dashboard / KPIs: open incidents, repeat offenders, SLA
  compliance, fees collected, occupancy.
- Building health score (composite of facilities, compliance,
  satisfaction, incidents).
- Sales funnel analytics (lead → reservation → contract → handover
  by source/cohort) — reads from `property-development-lifecycle`.
- Operator scorecard: incidents, response time, complaints, reviews
  per operator — reads from `operator-portal`.
- Vendor scorecard — reads from `facilities` + `operator-portal`.
- Anomaly detection: utility bill > X% of average; conflated damage
  incidents on same item; access-pattern anomalies.
- AI smart notifications: auto-route by type/urgency/persona/history.
  AI drafting, translation, triage assistance.
- Owner investment view (cap rate, RevPAR proxy, comps); owner-only.
- Trend reports: repeat apartments, seasonal patterns, vendor
  performance.

**Out of scope:**
- Owning any of the source-of-truth records — this module reads.
- Full BI tool replacement (export to a real BI for power users if
  needed).
- Replacing the modules' own audit trails (they own writes; this
  module aggregates).

## Likely owned tables (sketch)

`kpi_snapshots`, `scorecards` (operator/vendor), `anomaly_signals`,
`ai_drafts` (cached / audited), `building_health_scores`.

Most of this module's work is read-and-aggregate against tables owned
by other modules, plus a thin layer of cached scores + alert state.

## Likely capability keys (sketch)

`analytics:view-admin-kpis`, `analytics:view-operator-scorecard`,
`analytics:view-owner-investment`, `analytics:configure-anomaly-rule`,
`analytics:use-ai-drafting`.

## Dependencies

- **Hard:** platform layer (audit log read access, users, units,
  communities).
- **Soft:** every operating module — this module reads from
  `incidents`, `operator-portal`, `facilities`, `building-admin`,
  `property-development-lifecycle`, `compliance`, etc. As a result it
  is **the last module to be promoted from idea → concept**: its
  shape depends on the shape of the modules it aggregates.

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` and update
status here and in `../../PLATFORM_ARCHITECTURE.md` §3. Two upstream
decisions are required first:

- AI provider choice (Claude API / OpenAI / on-prem) and the PII
  envelope it operates inside (Habeas Data; see
  `../compliance/README.md`).
- Whether analytics queries live alongside operating modules in
  Supabase (acceptable up to a scale ceiling) or are exported to a
  dedicated warehouse.
