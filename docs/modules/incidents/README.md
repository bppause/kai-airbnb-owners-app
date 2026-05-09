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

## Design summary

A summary lives in `../../platform/DESIGN.md` §3. The key shape:

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
| [`UAT_SCRIPT.md`](UAT_SCRIPT.md) | User acceptance test script for the incident management portal. |

## Companion documents

- `../../PLATFORM_ARCHITECTURE.md` — module contract and platform
  conventions.
- `../../platform/DESIGN.md` §3 — incidents module summary in the
  platform-wide design.
- `server/modules/incidents/README.md` — server-side code-level notes.

## Known gaps

Captured in `../../platform/DESIGN.md` §3.7. They are addressed by the
operator-portal module (delegation, structured repair record, per-stay
inspection baseline).
