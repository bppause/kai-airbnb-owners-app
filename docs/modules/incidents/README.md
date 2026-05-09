# `incidents` — Module Documentation

> **Status:** live
> **Slug:** `incidents`
> **Server code:** `server/modules/incidents/`
> **Client code:** `client/src/modules/incidents/`

## Purpose

Community / property incident management. Captures any
community-or-property-level issue — guest complaint, noise, damage, common-
area problem, regulatory or building notice — and runs it through a
two-step resolution workflow with SLA pressure.

## Design

The full design — current architecture, data model, workflow, API, UI,
known gaps, and roadmap — lives in [`DESIGN.md`](DESIGN.md). A
cross-module summary lives in `../../platform/DESIGN.md` §3. The key
shape:

- **Two-step workflow**: `Reported → Step 1 (verify + immediate action) →
  Step 2 (owner resolution) → Closed`.
- **SLA cron** in `server/modules/incidents/sla-cron.js` walks pending
  rows whose `next_sla_reminder_at` has elapsed and fires reminders /
  escalations.
- **Reporter privacy** is a non-negotiable platform rule: reporter
  identity is hidden from operator and unit owner; only community admins
  and the originating reporter see it.
- **Capabilities**: `incidents:resolve`, `incidents:update`,
  `incidents:delete`, `incidents:assign` (declared in
  `server/modules/incidents/permissions.js`).

## Documents in this folder

| File | Purpose |
| --- | --- |
| [`README.md`](README.md) | This index. |
| [`DESIGN.md`](DESIGN.md) | Full module design: architecture, data model, workflow, API, UI, known gaps, roadmap. |
| [`UAT_SCRIPT.md`](UAT_SCRIPT.md) | User acceptance test script for the incident management portal. |

## Companion documents

- `../../PLATFORM_ARCHITECTURE.md` — module contract and platform
  conventions.
- `../../platform/DESIGN.md` §3 — incidents module summary in the
  platform-wide design.
- `server/modules/incidents/README.md` — server-side code-level notes.

## Known gaps and roadmap

Captured in [`DESIGN.md`](DESIGN.md) §13 (gaps) and §14 (roadmap, grouped
into near-term polish, schema-additive items, photos-as-attachments,
cross-module integrations, and longer-horizon reshapes). The biggest
near-term gaps — operator delegation, structured repair record, per-stay
inspection baseline — are addressed by the operator-portal and
guest-mgmt modules respectively.
