# Documentation Index

This folder contains the design and operational documentation for the
community property management platform. It is organized to make the
**current**, **proposed**, and **future** modules easy to find and to add to
without restructuring.

## Layout

```
docs/
├── README.md                  ← you are here
├── PLATFORM_ARCHITECTURE.md   ← the platform contract; referenced by code
├── CHANGELOG_ARCHIVE.md       ← historical version notes
├── platform/                  ← platform-wide (cross-module) design
│   └── DESIGN.md
└── modules/                   ← one folder per module slug
    ├── incidents/             ← live module
    ├── operator-portal/       ← proposed module (concept)
    ├── guest-mgmt/            ← future (idea)
    ├── tourism/               ← future (idea)
    └── facilities/            ← future (idea)
```

Each module folder contains a `README.md` that captures status, scope, and
links to its design / proposal / use-case / operational documents.

## Status legend

The same legend used in `PLATFORM_ARCHITECTURE.md` §3 and surfaced in every
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
  together. Then read `PLATFORM_ARCHITECTURE.md` for the technical
  contract every module must follow.
- **Adding a feature to a live module?** Start in that module's folder.
- **Proposing a new module?** Create `modules/<new-slug>/README.md` using
  the same shape as the existing module READMEs. Register the slug in
  `PLATFORM_ARCHITECTURE.md` §3 in the same change.

## Modules at a glance

| Slug | Status | Folder | One-line purpose |
| --- | --- | --- | --- |
| `incidents` | live | [`modules/incidents/`](modules/incidents/README.md) | Community / property incident management with two-step workflow + SLA |
| `operator-portal` | concept | [`modules/operator-portal/`](modules/operator-portal/README.md) | Operator work management; owner ↔ operator relationship lifecycle |
| `guest-mgmt` | idea | [`modules/guest-mgmt/`](modules/guest-mgmt/README.md) | Per-stay context, inspection photo log, review draft approval |
| `tourism` | idea | [`modules/tourism/`](modules/tourism/README.md) | Local tourism content pack, per-unit overrides, guest-facing landing |
| `facilities` | idea | [`modules/facilities/`](modules/facilities/README.md) | Shared amenity operations, closures, HOA rules library |

## Cross-cutting documents

- **`PLATFORM_ARCHITECTURE.md`** — the locked architectural contract every
  module follows (the three orthogonal axes, the module contract, naming
  conventions, permissions resolution, migration plan). Heavily referenced
  from code comments; do not move.
- **`platform/DESIGN.md`** — the high-level platform design that frames
  every module as a vertical slice on top of a shared platform layer and
  describes inter-module integration patterns.
- **`platform/DIAGRAMS.md`** — Mermaid architecture diagrams: the three
  orthogonal axes, module dependency graph, repository layout, module
  contract, request lifecycle, permissions resolution, tenant model, and
  shared platform services.
- **`CHANGELOG_ARCHIVE.md`** — historical release notes from earlier
  versions, kept out of the root README to keep production setup clear.
