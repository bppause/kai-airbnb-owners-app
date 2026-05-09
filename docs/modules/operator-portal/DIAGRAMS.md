# `operator-portal` — Architecture Diagrams

> Companion to [`DESIGN.md`](DESIGN.md), [`USE_CASE_DISCOVERY.md`](USE_CASE_DISCOVERY.md), and [`PROPOSAL.md`](PROPOSAL.md).
> All diagrams are Mermaid so they render natively on GitHub.
>
> **Status:** these diagrams describe the **proposed** module. None of
> the data flows or tables exist in the codebase yet.

---

## 1. Operator ↔ owner relationship lifecycle

`unmanaged → pending → active → terminated`. Either party can initiate;
only the owner can finally accept on Path A; only the operator on Path
B. "Already managed" is a hard block — see DESIGN.md §"Establishment".

```mermaid
stateDiagram-v2
    [*] --> Unmanaged
    Unmanaged --> PendingOwner: operator proposes<br/>(Path A)
    Unmanaged --> PendingOperator: owner invites<br/>(Path B)
    PendingOwner --> Active: owner accepts
    PendingOperator --> Active: operator accepts
    PendingOwner --> Unmanaged: owner declines / expires
    PendingOperator --> Unmanaged: operator declines / expires
    Active --> Active: amendment<br/>(propose → confirm)
    Active --> Terminated: either party<br/>(checks open requests)
    Terminated --> Unmanaged: re-invite enabled
    Terminated --> [*]

    note right of Active
        delegation_level set per unit
        Listing-management contract active
        All history visible to both parties
    end note
```

---

## 2. Roles and their relationship to a unit

One operator manages a unit. Owners split into Payout (financial) and
Calendar (operational, $$ hidden). Staff are cross-unit and may or may
not have a platform login.

```mermaid
flowchart TB
    Unit["Unit"]
    Op["Operator<br/>(0..1 active per unit;<br/>1..N units across communities)"]
    PO["Payout Owner<br/>(exactly 1 per unit;<br/>financial approval)"]
    CO["Calendar Owner<br/>(0..N per unit;<br/>$$ hidden, full thread)"]
    Staff["Operator Staff<br/>(0..N per operator;<br/>cross-unit, optional account)"]

    Op -- manages --&gt; Unit
    PO -- approves financial<br/>full thread --&gt; Unit
    CO -- sees calendar<br/>full thread --&gt; Unit
    Op -- employs --&gt; Staff
    Staff -. assignable to .-&gt; Unit
```

---

## 3. Request flow direction (the request taxonomy)

Who initiates which request type. Full table with WhatsApp equivalents
in [`USE_CASE_DISCOVERY.md`](USE_CASE_DISCOVERY.md) §"Request Type
Taxonomy".

```mermaid
flowchart LR
    subgraph Operator["Operator"]
      O[Operator]
    end
    subgraph Owners["Owners"]
      PO[Payout Owner]
      CO[Calendar Owner]
    end
    subgraph Staff["Team"]
      T[Operator Staff]
    end
    subgraph System["System / cron"]
      Sys[Platform-derived]
    end

    O -->|repair approval / FYI| PO
    O -->|guest issue<br/>booking relay| PO
    O -->|guest issue<br/>booking relay| CO
    O -->|pricing / peak proposal| PO
    O -->|damage AirCover<br/>non-guest damage| PO
    O -->|utility bill<br/>general update| PO
    O -->|cleaning / repair<br/>inspection / access code<br/>building notice| T

    PO -->|task / block / pricing<br/>listing change<br/>document request| O
    CO -->|task / block<br/>listing change<br/>general question| O

    Sys -->|booking relay<br/>AirCover window prompt<br/>Superhost prompt| O
```

---

## 4. Service request — state machine

The state machine for a single request (repair, cleaning, inspection,
etc.). The cost-approval gate is enforced when `estimated_cost > 0`.

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted: operator submits
    Submitted --> AwaitingApproval: estimated_cost &gt; 0
    Submitted --> Assigned: estimated_cost = 0<br/>(no approval needed)
    AwaitingApproval --> Assigned: Payout Owner approves
    AwaitingApproval --> Submitted: counter-propose
    AwaitingApproval --> Cancelled: rejected / withdrawn
    Assigned --> InProgress: staff acknowledges
    InProgress --> Completed: staff marks done<br/>+ photo / invoice
    Completed --> Closed: operator closes
    Closed --> [*]
    Cancelled --> [*]
```

---

## 5. Pricing proposal — bidirectional confirmation

Either party can propose; the other must confirm. All proposals,
counter-proposals, confirmations, and rejections are logged immutably
in `pricing_decisions`.

```mermaid
sequenceDiagram
    actor P as Proposer<br/>(operator OR Payout Owner)
    actor R as Recipient<br/>(the other party)
    participant API as Server
    participant DB as Supabase
    participant N as Notifications

    P->>API: POST /pricing/propose<br/>(amount, effective_date, note)
    API->>DB: INSERT pricing_decisions (status=proposed)
    API->>N: notify recipient
    alt Recipient confirms
      R->>API: PATCH /pricing-proposals/:id/approve
      API->>DB: UPDATE pricing_decisions (approved_by_uid, approved_at)
      API->>DB: UPDATE unit_pricing (effective_from)
      API->>N: notify both parties + Calendar Owners
    else Recipient counter-proposes
      R->>API: POST /pricing/propose (new amount,<br/>references prior_id)
      API->>DB: INSERT pricing_decisions (status=counter)
      Note right of API: loop until both agree<br/>or expiry
    else Recipient rejects
      R->>API: PATCH /pricing-proposals/:id/reject
      API->>DB: UPDATE pricing_decisions (rejected_at)
    else Timeout (48h default)
      Note over API,DB: PRICE-1 open question:<br/>silent expire vs auto-approve
    end
```

---

## 6. Delegation matrix → incidents module

How the per-unit `delegation_level` field affects who can advance the
incidents-module two-step workflow.

```mermaid
flowchart TB
    subgraph Levels[delegation_level per unit]
      direction TB
      L1[owner_handles]
      L2[operator_assists - default]
      L3[operator_handles]
    end
    subgraph S1[Step 1 verify]
      S1A[Owner only]
      S1B[Owner OR Operator on behalf]
      S1C[Operator]
    end
    subgraph S2[Step 2 resolution]
      S2A[Owner only]
      S2B[Owner only]
      S2C[Operator]
    end
    L1 --> S1A
    L1 --> S2A
    L2 --> S1B
    L2 --> S2B
    L3 --> S1C
    L3 --> S2C
```

Every operator action carries the audit attribution
`"[Operator Name] acting on behalf of [Owner Name] — Unit [APT]"`.
Reporter privacy still applies: operators do **not** see
`reporter_uid` / `reporter_name`.

---

## 7. Entity relationships (proposed)

The new tables this module owns. All hang off `listings` (the platform
`units` entity). Service requests can optionally link to an existing
incident record.

```mermaid
erDiagram
    operator_profiles               ||--o{ operator_communities          : works_in
    operator_profiles               ||--o{ operator_staff                : employs
    operator_profiles               ||--o{ unit_operator_relationships   : manages
    listings                        ||--o{ unit_operator_relationships   : managed_by
    listings                        ||--|| unit_profiles                 : described_in
    listings                        ||--o{ service_requests              : has
    listings                        ||--o{ unit_pricing                  : has
    listings                        ||--o{ pricing_decisions             : has
    listings                        ||--o{ owner_blocks                  : has
    listings                        ||--o{ unit_documents                : stores
    service_requests                ||--o{ service_request_attachments   : has
    service_requests                }o--o| operator_staff                : assigned_to
    service_requests                }o--o| incidents                     : "linked (nullable)"

    unit_operator_relationships {
        uuid id PK
        text listing_id FK
        uuid operator_id FK
        text status
        text delegation_level
        text initiated_by
        timestamptz initiated_at
        timestamptz accepted_at
        timestamptz terminated_at
    }
    service_requests {
        uuid id PK
        text listing_id FK
        uuid operator_id FK
        text type
        text status
        text urgency
        numeric estimated_cost
        numeric approved_cost
        uuid approved_by_uid
        uuid assigned_staff_id FK
        text linked_incident_id FK
    }
```

---

## 8. The unified attention inbox

Both the operator and the owner see the same concept: *"What needs me
right now?"* Items where the ball is in your court are surfaced first;
SLA timers age yellow → red.

```mermaid
flowchart TB
    subgraph Inbox[Unified attention inbox]
      direction TB
      Top["<b>Needs me right now</b><br/>SLA red / yellow first"]
      Mid["<b>Awaiting other party</b><br/>visible but deprioritized"]
      Bot["<b>Resolved / closed</b><br/>archived, searchable"]
    end
    subgraph Sources[Source request types]
      direction TB
      Repair[Repair approval / FYI]
      Guest[Guest issue]
      Pricing[Pricing proposal]
      Damage[Damage AirCover / non-guest]
      Block[Calendar block]
      Task[Task request]
      Doc[Document request]
      Bill[Utility bill]
      Note[Building notice]
    end
    Sources --> Inbox
```

---

## 9. Implementation phasing

The seven phases from DESIGN.md. Recommended MVP is Phases 1–3 (the
WhatsApp-replacement core).

```mermaid
flowchart LR
    P1[1 — Operator identity<br/>+ unit linking<br/>+ unit profile] --> P2[2 — Cross-community<br/>operator dashboard]
    P2 --> P3[3 — Service requests<br/>+ work orders<br/>+ cost gate]
    P3 -. MVP boundary .- P4[4 — Scheduling<br/>+ owner blocks]
    P4 --> P5[5 — Pricing log<br/>+ bidirectional confirm]
    P5 --> P6[6 — Documents<br/>+ compliance vault]
    P6 --> P7[7 — Staff task<br/>management mobile]
```

---

*Update these diagrams when the module's shape, request taxonomy, or
delegation model changes. Promote sections into separate diagrams files
if any of them grow large enough to warrant their own page.*
