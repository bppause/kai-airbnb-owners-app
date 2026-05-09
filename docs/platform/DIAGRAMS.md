# Platform — Architecture Diagrams

> Companion to [`DESIGN.md`](DESIGN.md) and [`./PLATFORM_ARCHITECTURE.md`](./PLATFORM_ARCHITECTURE.md).
> All diagrams are Mermaid so they render natively on GitHub.

---

## 1. Three orthogonal axes

Every domain row, route, permission, and UI view sits at the intersection
of `(tenant, module, role)`.

```mermaid
flowchart LR
    subgraph Axes
      direction TB
      T["<b>Tenant</b><br/>community_id"]
      M["<b>Module</b><br/>incidents · operator-portal<br/>guest-mgmt · tourism · facilities"]
      R["<b>Role</b><br/>global · community<br/>community-module · member"]
    end
    Row["Every domain row<br/>=&nbsp; (tenant, module, role)"]
    T --> Row
    M --> Row
    R --> Row
```

---

## 2. Module dependency graph

Solid arrows show "depends on platform layer." Dashed arrows show
optional cross-module integrations (link, do not duplicate).

```mermaid
flowchart TB
    Platform["<b>Platform layer</b><br/>units · users · communities<br/>notifications · audit · email · app_config"]
    Inc["incidents<br/><i>live</i>"]
    OP["operator-portal<br/><i>concept</i>"]
    GM["guest-mgmt<br/><i>idea</i>"]
    Tour["tourism<br/><i>idea</i>"]
    Fac["facilities<br/><i>idea</i>"]

    Inc --> Platform
    OP --> Platform
    GM --> Platform
    Tour --> Platform
    Fac --> Platform

    OP -. delegation_level .-> Inc
    OP -. requires operator role .- GM
    GM -. inspection link for damage .-> Inc
    Fac -. closure spawns incident .-> Inc
    Fac -. closure → request thread .-> OP
    Tour -. publishes closures .-> Fac
```

---

## 3. Repository layout

The agreed target shape from [`./PLATFORM_ARCHITECTURE.md`](./PLATFORM_ARCHITECTURE.md) §9.

```mermaid
flowchart TB
    subgraph Server["server/"]
      direction TB
      SI["index.js<br/>bootstrap + module registry"]
      SC["core/<br/>supabase · auth · email<br/>audit · i18n · logger"]
      SP["platform/<br/>users · communities · units<br/>registrations · notifications<br/>audit · app-config · email"]
      SM["modules/<br/>incidents/ · operator-portal/<br/>guest-mgmt/ · ..."]
      SI --> SC
      SI --> SP
      SI --> SM
    end

    subgraph Client["client/src/"]
      direction TB
      CA["App.jsx<br/>shell + module router"]
      CC["core/<br/>api · auth · i18n · ui · utils"]
      CP["platform/<br/>landing · admin · units<br/>users · registrations · ..."]
      CM["modules/<br/>incidents/{views,components,...}<br/>operator-portal/ · ..."]
      CA --> CC
      CA --> CP
      CA --> CM
    end
```

---

## 4. The module contract

Every module — live or planned — exposes the same shape on each side.

```mermaid
flowchart LR
    subgraph ServerMod["server/modules/&lt;slug&gt;/index.js"]
      direction TB
      S1["slug · name · version"]
      S2["routes (Express router)"]
      S3["permissions (capability list)"]
      S4["emailTemplates (es-CO + en)"]
      S5["auditEntities"]
      S6["schemaMigrations (optional)"]
    end
    subgraph ClientMod["client/src/modules/&lt;slug&gt;/index.js"]
      direction TB
      C1["slug · name"]
      C2["navItems (gated by perms)"]
      C3["routes (&lt;Route&gt; elements)"]
      C4["permissions (mirror server)"]
      C5["i18n"]
    end
    ServerMod -. shared slug .- ClientMod
```

---

## 5. HTTP request lifecycle

The path every state-changing API call takes through the platform.

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Client (React)
    participant API as Express server
    participant Auth as resolvePermissions
    participant Mod as Module router
    participant DB as Supabase
    participant N as Notifications
    participant A as Audit log
    participant E as Email (Resend)

    U->>FE: action
    FE->>API: POST /api/m/&lt;slug&gt;/...
    API->>Auth: (uid, communityId)
    Auth-->>API: { platform: [...], &lt;module&gt;: { ... } }
    API->>Mod: route handler
    Mod->>DB: read/write domain rows
    Mod->>A: append audit_logs row
    Mod->>N: write notifications row(s)
    N-->>E: per-recipient email send
    E-->>DB: email_delivery_logs row
    Mod-->>FE: response
    FE-->>U: render
```

---

## 6. Permissions resolution

Server-side, in one place. The client never re-derives permissions.

```mermaid
flowchart TD
    Req["Request: uid, communityId"] --> GA{"Email in<br/>GLOBAL_ADMIN_EMAILS?"}
    GA -- yes --> All["Return: all permissions,<br/>all communities"]
    GA -- no --> CM["Read community_memberships<br/>(uid + communityId)"]
    CM --> Role{"role?"}
    Role -- community_admin --> AllInComm["All permissions<br/>in this community"]
    Role -- community-module admin --> Scoped["Scoped to<br/>(community, module) tuples"]
    Role -- member --> Member["Module access flags only"]
    AllInComm --> Build["Build namespaced<br/>permission object"]
    Scoped --> Build
    Member --> Build
    All --> Resp["Return JSON to client"]
    Build --> Resp
```

---

## 7. Tenant model

A community is a single physical place. Units, members, and module rows
all hang off it.

```mermaid
erDiagram
    communities ||--o{ community_memberships : has
    communities ||--o{ listings : contains
    communities ||--o{ community_config : has
    app_users ||--o{ community_memberships : member_of
    listings ||--o{ incidents : has
    communities ||--o{ incidents : scoped_to
    communities ||--o{ notifications : scoped_to
    communities ||--o{ audit_logs : scoped_to

    communities {
        text id PK
        text name
        text slug
    }
    listings {
        text id PK
        text community_id FK
        text apt_label
        text owner_uid FK
    }
    community_memberships {
        text community_id FK
        text uid FK
        text role
        jsonb permissions
    }
    app_users {
        text uid PK
        text email
        text display_name
    }
```

---

## 8. Cross-cutting platform services

Three services every module plugs into. These are owned by the platform
layer and must not be reinvented inside a module.

```mermaid
flowchart LR
    subgraph Mod[Any module]
      H[Route handler]
    end
    H --> N[Notifications<br/>platform service]
    H --> A[Audit log<br/>platform service]
    H --> S[SLA cron<br/>platform service]
    N --> Inbox[In-app inbox]
    N --> Mail[Email send]
    A --> Viewer[Audit viewer<br/>platform/audit/]
    S -. reads .-> Mod
    S --> N
```

---

*Update these diagrams when the inter-module surface changes; do not let
drift accumulate.*
