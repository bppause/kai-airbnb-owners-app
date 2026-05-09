# `incidents` — Architecture Diagrams

> Companion to [`DESIGN.md`](DESIGN.md).
> All diagrams are Mermaid so they render natively on GitHub.

---

## 1. Unit-attached incident — state machine

The canonical owner-driven path. Both Step 1 and Step 2 are owner-only
today; Step 1+2 can be collapsed into a single action by supplying the
resolution text inside the verify modal.

```mermaid
stateDiagram-v2
    [*] --> Open: reporter submits
    Open --> VerifiedNoResolution: owner Step 1<br/>(verify + immediate action)
    VerifiedNoResolution --> VerifiedWithResolution: owner Step 2<br/>(adds resolution)
    Open --> VerifiedWithResolution: owner Step 1+2<br/>(combined)
    VerifiedWithResolution --> Resolved: admin close<br/>(resolution_comments)
    Resolved --> [*]

    note right of Open
        next_sla_reminder_at active
        SLA cron fires step1 reminders
    end note
    note right of VerifiedNoResolution
        next_sla_reminder_at still active
        SLA cron fires step2 reminders
    end note
    note right of VerifiedWithResolution
        next_sla_reminder_at = null
        SLA timer stops
    end note
```

---

## 2. General (community-wide) incident — state machine

`is_general = true`, `apt_id = null`. Admin chooses to assign to a unit
(folds into the canonical path) or close directly without an owner
workflow.

```mermaid
stateDiagram-v2
    [*] --> OpenGeneral: reporter submits<br/>(no unit)
    OpenGeneral --> Assigned: admin assigns to unit<br/>(is_general → false)
    OpenGeneral --> Resolved: admin close-direct
    Assigned --> CanonicalFlow: enters unit-attached path
    CanonicalFlow --> Resolved: (eventually)
    Resolved --> [*]
```

---

## 3. Entity relationships

The `incidents` table and the platform tables it joins onto. Reporter
identity (`reporter_uid`, `reporter_name`) is filtered server-side
before responses reach owner / operator viewers — see DESIGN.md §7.

```mermaid
erDiagram
    communities ||--o{ incidents : scoped_to
    listings    ||--o{ incidents : "attached to (nullable)"
    app_users   ||--o{ incidents : reported_by
    app_users   ||--o{ incidents : resolved_by
    incidents   ||--o{ audit_logs : emits
    incidents   ||--o{ notifications : emits
    incidents   ||--o{ email_delivery_logs : emits

    incidents {
        text id PK
        text community_id FK
        text apt_id FK
        text reporter_uid FK
        text type
        text category
        text status
        jsonb photos
        jsonb owner_guests
        text owner_comments
        text owner_resolution
        text resolution_comments
        timestamptz next_sla_reminder_at
        integer sla_cycle_count
        boolean is_general
    }
```

---

## 4. End-to-end lifecycle (sequence)

From report → SLA escalations → owner steps → admin close. Each email
send is per-recipient so reporter identity can be conditionally
included or omitted.

```mermaid
sequenceDiagram
    actor R as Reporter
    actor O as Unit Owner
    actor A as Admin
    participant API as Server (incidents router)
    participant DB as Supabase
    participant Cron as SLA cron (~15 min)
    participant E as Email (Resend)

    R->>API: POST / (new incident)
    API->>DB: INSERT incidents (status=open,<br/>next_sla_reminder_at = now + sla_hours)
    API->>E: incident_new<br/>(admins, owner; reporter redacted for owner)

    loop while next_sla_reminder_at &le; now
      Cron->>DB: SELECT overdue rows
      Cron->>E: incident_sla<br/>(pendingStep = step1 or step2)
      Cron->>DB: UPDATE sla_cycle_count,<br/>next_sla_reminder_at += sla_hours
    end

    O->>API: PATCH /:id/verify (Step 1)
    API->>DB: UPDATE owner_guests, owner_comments,<br/>status=verified, owner_verified_at
    API->>E: incident_verified

    O->>API: PATCH /:id/add-resolution (Step 2)
    API->>DB: UPDATE owner_resolution,<br/>owner_resolution_at,<br/>next_sla_reminder_at = null
    API->>E: incident_resolution_added

    A->>API: PATCH /:id/resolve
    API->>DB: UPDATE status=resolved,<br/>resolved_at, resolved_by,<br/>resolution_comments
    API->>E: incident_resolved (all parties + reporter)
```

---

## 5. SLA cron decision flow

What `server/modules/incidents/sla-cron.js` does on each tick.

```mermaid
flowchart TD
    Tick[Cron tick] --> Pull[SELECT incidents<br/>WHERE next_sla_reminder_at &le; now]
    Pull --> Loop{For each row}
    Loop --> Gen{is_general?}
    Gen -- yes --> GE[Send incident_general_sla<br/>to admins]
    Gen -- no --> Status{status?}
    Status -- open --> Step1[Send incident_sla<br/>pendingStep=step1<br/>to owner + operator + admins]
    Status -- "verified, no resolution" --> Step2[Send incident_sla<br/>pendingStep=step2<br/>to owner + operator + admins]
    Status -- "verified, with resolution" --> Skip[Should not happen<br/>timer should be null]
    GE --> Bump
    Step1 --> Bump
    Step2 --> Bump
    Skip --> Bump
    Bump[UPDATE sla_cycle_count++,<br/>next_sla_reminder_at += sla_hours] --> Loop
    Loop --> Done[Done]
```

---

## 6. Permission gates per endpoint

Visual mapping of who can hit which route.

```mermaid
flowchart LR
    subgraph Anyone[Any signed-in user]
      A1[POST /]
    end
    subgraph Owner[Unit owner only]
      O1[PATCH /:id/viewed]
      O2[PATCH /:id/verify]
      O3[PATCH /:id/add-resolution]
    end
    subgraph Admin[incidents:resolve / :assign / :delete]
      AD1[PATCH /:id/assign]
      AD2[PATCH /:id/close-general]
      AD3[PATCH /:id/resolve]
      AD4[DELETE /:id]
    end
```

---

## 7. Email senders fan-out

Five senders in `server/modules/incidents/email-senders.js`, each gated
by `app_config.email_notifications`. Reporter inclusion is per-recipient,
not per-template.

```mermaid
flowchart LR
    subgraph Triggers
      T1[New incident]
      T2[Owner Step 1]
      T3[Owner Step 2]
      T4[Admin close]
      T5[SLA cron tick]
    end
    subgraph Senders[email-senders.js]
      S1[sendIncidentEmail]
      S2[sendIncidentVerifiedEmail]
      S3[sendIncidentResolutionAddedEmail]
      S4[sendIncidentResolvedEmail]
      S5[sendGeneralIncidentSlaEmail]
    end
    subgraph Recipients
      R1[Reporter]
      R2[Owner]
      R3[Operator]
      R4[Admins / delegates]
    end
    T1 --> S1
    T5 --> S1
    T5 --> S5
    T2 --> S2
    T3 --> S3
    T4 --> S4
    S1 --> R2
    S1 --> R3
    S1 --> R4
    S5 --> R4
    S2 --> R2
    S2 --> R3
    S2 --> R4
    S3 --> R2
    S3 --> R3
    S3 --> R4
    S4 --> R1
    S4 --> R2
    S4 --> R3
    S4 --> R4
```

---

## 8. Roadmap shape

How the §14 roadmap items map to the existing architecture. Each band
is one tranche from DESIGN.md §14.

```mermaid
flowchart TB
    subgraph Now[Live today]
      L1[Two-step owner workflow]
      L2[Single SLA tier]
      L3[Photos as base64 in row]
      L4[5 email senders]
      L5[Reporter privacy]
    end
    subgraph N[14.1 — Near-term, no schema change]
      N1[Tier SLA cron by category]
      N2[Email retry from UI]
      N3[Bulk close / assign]
      N4[Reporter self-edit window]
      N6[Business-hours SLA mode]
    end
    subgraph S[14.2 — Schema-additive]
      S1[Threaded comments]
      S2[Add building / regulatory types]
      S3[Watcher subscriptions]
      S4[sla_paused_until]
      S5[updated_at]
    end
    subgraph P[14.3 — Photos to attachments]
      P1[Supabase Storage bucket]
      P2[Thumbnails]
    end
    subgraph X[14.4 — Cross-module hooks]
      X1[delegation_level → operator-portal]
      X2[linked service_request → operator-portal]
      X3[linked guest_stay → guest-mgmt]
      X4[facility-closure-spawned → facilities]
    end
    subgraph R[14.5 — Larger reshapes]
      R1[Generalized state machine]
      R2[Incident templates]
      R3[Anomaly surfacing]
      R4[Public receipt URL]
    end
    Now --> N
    Now --> S
    Now --> P
    P --> X
    S --> X
    X --> R
```

---

*Update these diagrams when the module's shape or roadmap shifts.*
