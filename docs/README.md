# Documentation Index

This folder contains the design and operational documentation for the
community property management platform. It is organized to make the
**current**, **proposed**, and **future** modules easy to find and to add to
without restructuring.

## Layout

```
docs/
├── README.md                  ← you are here
├── CHANGELOG_ARCHIVE.md       ← historical version notes
├── platform/                  ← platform-wide (cross-module) docs
│   ├── PLATFORM_ARCHITECTURE.md   ← the platform contract; referenced by code
│   ├── DESIGN.md
│   ├── DIAGRAMS.md
│   ├── ROADMAP.md             ← multi-horizon conceptual roadmap
│   ├── PITCH.md               ← investor / client / friends-and-family pitch
│   └── USER_STORIES.md        ← cross-module user stories by persona
└── modules/                   ← one folder per module slug
    ├── incidents/             ← live module
    ├── operator-portal/       ← proposed module (concept)
    ├── building-admin/        ← future (idea)
    ├── front-desk/            ← future (idea)
    ├── resident-experience/   ← future (idea)
    ├── facilities/            ← future (idea)
    ├── property-development-lifecycle/  ← future (idea, with proposal sketch)
    ├── guest-mgmt/            ← future (idea)
    ├── tourism/               ← future (idea)
    ├── compliance/            ← future (idea)
    ├── communications/        ← future (idea)
    └── analytics/             ← future (idea)
```

Each module folder contains a `README.md` that captures status, scope, and
links to its design / proposal / use-case / operational documents.

## Status legend

The same legend used in `platform/PLATFORM_ARCHITECTURE.md` §3 and surfaced in every
module's `README.md`:

| Status | Meaning |
| --- | --- |
| **live** | Shipped and in production. |
| **concept** | Approved design exists; implementation pending. |
| **idea** | Recognized in the architecture; no detailed design yet. |

A module's status is metadata in its README, not a directory location, so
promotion (e.g. operator-portal `concept` → `live`) does not require moving
files or breaking links.

## Where to start

- **New to the platform?** Read `platform/DESIGN.md` first — it is the
  cross-module overview of why each module exists and how they fit
  together. Then read `platform/PLATFORM_ARCHITECTURE.md` for the technical
  contract every module must follow.
- **Adding a feature to a live module?** Start in that module's folder.
- **Proposing a new module?** Create `modules/<new-slug>/README.md` using
  the same shape as the existing module READMEs. Register the slug in
  `platform/PLATFORM_ARCHITECTURE.md` §3 in the same change.

## Modules at a glance

| Slug | Status | Folder | One-line purpose |
| --- | --- | --- | --- |
| `incidents` | live | [`modules/incidents/`](modules/incidents/README.md) | Community / property incident management with two-step workflow + SLA |
| `operator-portal` | concept | [`modules/operator-portal/`](modules/operator-portal/README.md) | Operator work management; owner ↔ operator relationship lifecycle |
| `building-admin` | idea | [`modules/building-admin/`](modules/building-admin/README.md) | HOA / community admin: residents, fees, fines, governance, board minutes |
| `front-desk` | idea | [`modules/front-desk/`](modules/front-desk/README.md) | Guard / concierge: visitors, packages, access, parking, shift log |
| `resident-experience` | idea | [`modules/resident-experience/`](modules/resident-experience/README.md) | Owner / renter self-service portal: amenities, fees due, packages, move-in/out |
| `facilities` | idea | [`modules/facilities/`](modules/facilities/README.md) | Shared amenity operations, closures, HOA rules library |
| `property-development-lifecycle` | idea | [`modules/property-development-lifecycle/`](modules/property-development-lifecycle/README.md) | Pre-sale → contracts → construction comms → handover → 1/5/10-year warranty → resale |
| `guest-mgmt` | idea | [`modules/guest-mgmt/`](modules/guest-mgmt/README.md) | Per-stay context, inspection photo log, review draft approval |
| `tourism` | idea | [`modules/tourism/`](modules/tourism/README.md) | Local tourism content pack, per-unit overrides, guest-facing landing |
| `compliance` | idea | [`modules/compliance/`](modules/compliance/README.md) | Regulatory: SIRE / RNT / tourism tax / building rules / insurance / Habeas Data |
| `communications` | idea | [`modules/communications/`](modules/communications/README.md) | Targeted announcements, polls, minutes; cross-module notifications backplane |
| `analytics` | idea | [`modules/analytics/`](modules/analytics/README.md) | Cross-module KPIs, scorecards, anomaly detection, AI triage / drafting |

## Cross-cutting documents

- **`platform/PLATFORM_ARCHITECTURE.md`** — the locked architectural contract every
  module follows (the three orthogonal axes, the module contract, naming
  conventions, permissions resolution, migration plan). Heavily referenced
  from code comments across `server/` and `client/src/` — when moving or
  renaming, update those references in the same change.
- **`platform/DESIGN.md`** — the high-level platform design that frames
  every module as a vertical slice on top of a shared platform layer and
  describes inter-module integration patterns.
- **`platform/DIAGRAMS.md`** — Mermaid architecture diagrams: the three
  orthogonal axes, module dependency graph, repository layout, module
  contract, request lifecycle, permissions resolution, tenant model, and
  shared platform services.
- **`platform/ROADMAP.md`** — multi-horizon conceptual roadmap across all
  pillars (operator, building admin, facilities, sales/development,
  compliance), with a per-horizon backlog of decisions to lock.
- **`platform/PITCH.md`** — bilingual (ES + EN) pitch overview for
  investors, prospective clients, and friends/family.
- **`platform/USER_STORIES.md`** — the platform-wide catalogue of user
  stories grouped by module and persona, with status badges (`live` /
  `concept` / `idea`) per story. When a module promotes to `concept`,
  its stories migrate into the module's `DESIGN.md` with acceptance
  criteria.
- **`CHANGELOG_ARCHIVE.md`** — historical release notes from earlier
  versions, kept out of the root README to keep production setup clear.
