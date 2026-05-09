# `communications` — Module Documentation

> **Status:** idea (recognized in the architecture; no detailed design yet)
> **Slug:** `communications`
> **Server code:** *(none)*
> **Client code:** *(none)*

## Purpose

The cross-module communications surface for the building: targeted
announcements (admin → audience), polls and surveys, meeting minutes,
and the underlying multilingual / consent-aware notification engine
that other modules (`incidents`, `operator-portal`,
`building-admin`, `front-desk`, `resident-experience`) push events
through.

## Why it exists

Today communications are split across:

- A WhatsApp group for the building (which mixes important admin
  announcements with chit-chat)
- Email blasts from the admin's Gmail (no delivery tracking, no
  opt-outs)
- Printed posters in the elevator lobby
- The community admin's voice on the lobby phone

Consequences: announcements miss residents who muted the WhatsApp
group, polls have no audit trail, meeting minutes are not searchable,
notifications go to the wrong audience or in the wrong language.

A communications module gives the building admin and the board a
single targeted-broadcast surface and gives every other module a
shared notifications backplane (so "right person, right urgency,
right language" is solved once).

## Sketch of scope

A more detailed sketch lives in `../../platform/ROADMAP.md` §6.10.

**In scope:**
- Announcements (admin → audience): targeted broadcast — building-wide,
  per-floor, owners-only, residents-only, operators-only, with
  delivery tracking.
- Polls & surveys (board votes, resident sentiment), audit-logged.
- Meeting minutes — linked to `building-admin` governance, searchable,
  multilingual.
- Notifications engine: email + in-app today; WhatsApp + push later.
  Used by every other module.
- Multilingual content layer: every UI / comms / docs / templates flow
  through one i18n layer (es-CO + en today; extensible).
- Targeted comms with consent: opt-in / opt-out per channel and
  audience; honor Habeas Data preferences from `compliance`.

**Out of scope:**
- Acting as a chat platform (KAI is structured-request-first, not chat;
  the inbox UX is `operator-portal`'s).
- Operator → owner request threads (`operator-portal`).
- Guard ↔ resident real-time event stream (`front-desk`).

## Likely owned tables (sketch)

`announcements`, `announcement_deliveries`, `polls`, `poll_responses`,
`meeting_minutes`, `notification_templates` (cross-module), `consent_prefs`.

## Likely capability keys (sketch)

`communications:publish-announcement`,
`communications:open-poll`, `communications:close-poll`,
`communications:publish-minutes`, `communications:edit-template`.

## Dependencies

- **Hard:** platform layer (users, audit, i18n).
- **Soft:** every other module sends events through this module's
  notification engine. `building-admin` owns governance content.
  `compliance` sets PII / consent constraints.

## Status next steps

When promoted from `idea` → `concept`, add `DESIGN.md` and update
status here and in `../../PLATFORM_ARCHITECTURE.md` §3. A key open
question is whether the notification engine is implemented as a
shared platform service used by every module, or as this module
exposing services that other modules depend on. The latter is the
default in the architecture; the former is a foundation-level
refactor flagged in `../../platform/ROADMAP.md` §10.
