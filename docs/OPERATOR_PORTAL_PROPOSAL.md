# Propuesta: Portal de Operadores — Gestión de Unidades Airbnb
# Proposal: Operator Portal — Airbnb Unit Management

---

# ESPAÑOL

## Resumen Ejecutivo

Actualmente, la relación entre operadores y propietarios se gestiona principalmente a través de grupos de WhatsApp: solicitudes de mantenimiento, aprobaciones de costos, coordinación de limpieza, cambios de precios e incidentes de la comunidad — todo en el mismo hilo de conversación. La información se pierde, las decisiones no quedan registradas y el seguimiento depende de la memoria de cada persona.

Esta propuesta describe una extensión de la plataforma existente que reemplaza ese flujo informal con flujos de trabajo estructurados, rastreados y permanentes — sin eliminar WhatsApp de inmediato, sino ofreciendo una alternativa más organizada que los equipos adoptarán naturalmente.

---

## El Problema Actual

| Situación | Consecuencia |
|---|---|
| Solicitudes de mantenimiento por WhatsApp | Los propietarios se enteran del costo después del trabajo, sin posibilidad de aprobar antes |
| Decisiones de precio dispersas en mensajes | No hay registro de quién aprobó qué y cuándo |
| Información de la unidad en descripciones de grupos | Se pierde cuando cambia el personal o se modifica el grupo |
| Coordinación de limpieza por mensaje | Instrucciones específicas olvidadas o mal entendidas |
| Credenciales y documentos enviados por chat | Riesgo de seguridad, sin control de versiones |
| Cambios de personal del operador | El historial y el contexto de la unidad se pierde con la persona que se va |
| Incidentes de la comunidad invisibles al operador | El operador actúa sin conocer el registro formal; el propietario recibe notificaciones pero está lejos |

---

## La Solución Propuesta

Un **Portal de Operadores** integrado a la plataforma existente, que conecta a operadores, su equipo de trabajo y los propietarios en un espacio organizado por unidad.

### Principios de diseño

- **El propietario siempre aprueba** — ningún costo o cambio significativo se ejecuta sin confirmación del propietario
- **El operador gestiona el día a día** — con visibilidad total de sus unidades en todas las comunidades desde una sola vista
- **Todo queda registrado** — decisiones, aprobaciones, facturas, fotos e historial son permanentes y accesibles para ambas partes
- **Una unidad, un operador** — cada unidad solo puede tener un operador activo, evitando confusión y conflictos de responsabilidad

---

## Cómo se Establece y Termina la Relación

### Establecimiento

Cualquiera de las dos partes puede iniciar, pero **el propietario siempre debe aceptar**:

**Opción A — El operador propone:**
El operador busca la unidad por número de apartamento y comunidad. Si la unidad no tiene operador activo, envía una propuesta. El propietario recibe una notificación y acepta o rechaza.

**Opción B — El propietario invita:**
El propietario busca al operador por nombre o correo electrónico desde la vista de su unidad y envía una invitación. El operador acepta o rechaza.

**Si la unidad ya tiene operador:**
El sistema informa claramente que la unidad ya está gestionada. No se puede asignar un nuevo operador hasta que el propietario termine la relación existente.

### Terminación

Cualquiera de las dos partes puede terminar la relación en cualquier momento. El sistema verifica si hay solicitudes de servicio abiertas y avisa antes de confirmar. Todo el historial — solicitudes, facturas, decisiones de precio, documentos — queda visible para ambas partes en modo de solo lectura. El equipo del operador pierde acceso de inmediato.

---

## Funcionalidades por Fase

### Fase 1 — Identidad del operador y vinculación de unidades
*Duración estimada: 3 semanas*

- Registro del operador con nombre comercial, contacto, y comunidades donde trabaja
- Gestión del equipo de trabajo: nombre, rol (limpieza / supervisión / logística / atención al huésped), correo y WhatsApp
- Vinculación de unidades con el flujo de propuesta/invitación descrito arriba
- **Perfil de la unidad** mantenido por el operador: amenidades (agua caliente, unidades de AC, sofá cama, tipo de cerradura), configuración de camas, URL de Airbnb, notas de acceso — reemplaza la hoja de Excel y la descripción del grupo de WhatsApp
- Indicadores de estado visibles para propietario y operador: *Sin operador / Pendiente / Gestionada activamente*

---

### Fase 2 — Panel del operador (vista multi-comunidad)
*Duración estimada: 2 semanas*

El operador ve **todas sus unidades en todas las comunidades en una sola vista**, con filtro de comunidad como opción secundaria. Las unidades que requieren atención aparecen primero.

Cada tarjeta de unidad muestra: estado actual, aprobaciones pendientes, próximo evento programado.

El equipo también tiene una vista diaria de sus asignaciones en todas las comunidades.

---

### Fase 3 — Solicitudes de servicio y órdenes de trabajo
*Duración estimada: 4 semanas*

Reemplaza los hilos de WhatsApp sobre mantenimiento, reparaciones y limpieza.

**Tipos de solicitud:** Mantenimiento · Reparación · Limpieza · Inspección · Trámite (RNT, etc.) · Otro

**Flujo de trabajo:**
```
Creada → Enviada → Aprobación del propietario* → Asignada → En progreso → Completada → Cerrada
```
*Solo cuando hay costo estimado mayor a cero. El propietario aprueba antes de que comience el trabajo.*

**Incluye:**
- Asignación a un miembro del equipo del operador
- Fotos antes y después del trabajo
- Carga de facturas (quedan archivadas permanentemente en la unidad)
- Notificación al propietario en cada cambio de estado
- Vinculación directa a un incidente de la comunidad cuando aplica

---

### Fase 4 — Agenda y bloqueos del propietario
*Duración estimada: 2 semanas*

- El propietario solicita bloquear fechas (uso personal, familiar, mantenimiento) directamente desde la plataforma
- El operador confirma y coordina limpieza/preparación
- Calendario de visitas programadas de mantenimiento vinculado a solicitudes de servicio
- Detección de conflictos: el sistema avisa si un bloqueo choca con una reserva existente o un servicio programado

---

### Fase 5 — Historial de precios y aprobaciones
*Duración estimada: 3 semanas*

- Registro estructurado del precio: tarifa base, tarifa de fin de semana, temporadas, descuentos activos
- **Flujo de aprobación de cambios:** cualquiera de las dos partes propone, la otra aprueba o contra-propone
- **Registro inmutable de decisiones:** quién propuso, quién aprobó, cuándo, monto anterior y nuevo — elimina la confusión de "¿en qué precio quedamos?"
- Reglas de temporada: periodos con nombre (Alta / Estándar / Baja) con rango de fechas y multiplicador de precio

---

### Fase 6 — Documentos y cumplimiento
*Duración estimada: 2 semanas*

- Carpeta de documentos por unidad: RNT, servicios públicos, seguro, activos de Airbnb
- Todas las facturas de solicitudes de servicio archivadas automáticamente
- Resumen trimestral generado automáticamente: ocupación y costos de servicio
- Elimina el intercambio de credenciales por grupos de chat

---

### Fase 7 — Gestión del equipo de trabajo
*Duración estimada: 3 semanas*

- El personal accede a su lista de asignaciones del día en todas las comunidades desde su celular
- Actualizan el estado de tareas: Llegué / En proceso / Listo + foto
- El operador ve en tiempo real qué está hecho y qué está pendiente
- El historial completo de la unidad es visible para el personal nuevo desde el primer día — sin necesidad de ponerse al día por WhatsApp

---

### Incidentes de la comunidad — Integración

Los operadores pueden **ver y gestionar los incidentes de sus unidades** con un modelo claro de responsabilidad:

- El operador ve todos los incidentes de sus unidades gestionadas
- La identidad del denunciante sigue siendo confidencial (igual que para los propietarios hoy)
- El propietario y el operador son notificados simultáneamente
- **Nivel de delegación** configurado por unidad:
  - *Propietario gestiona:* el operador ve, el propietario actúa
  - *Operador asiste (predeterminado):* el operador puede completar el Paso 1 en nombre del propietario; el propietario completa el Paso 2
  - *Operador gestiona:* el operador completa ambos pasos; el propietario recibe notificación informativa
- Todas las acciones del operador quedan registradas como "actuando en nombre de [Propietario]"
- Las reparaciones derivadas de un incidente se vinculan directamente a una solicitud de servicio

---

## Resumen de Fases y Tiempos

| Fase | Qué reemplaza | Semanas estimadas |
|---|---|---|
| 1 · Identidad y vinculación | Excel de unidades, descripción de grupos, proceso informal de asignación | 3 |
| 2 · Panel multi-comunidad | Vista mental de "mis unidades" repartida por grupos | 2 |
| 3 · Solicitudes de servicio | Hilos de mantenimiento/reparación/limpieza por WhatsApp | 4 |
| 4 · Agenda y bloqueos | "Bloquéame estas fechas" por mensaje | 2 |
| 5 · Historial de precios | Decisiones de precio dispersas en conversaciones | 3 |
| 6 · Documentos | Credenciales en descripción de grupos, facturas como fotos | 2 |
| 7 · Equipo de trabajo | Asignaciones por @menciones, seguimiento manual | 3 |
| **Total** | | **~19 semanas** |

Las fases 1, 2 y 3 se recomiendan como primera entrega (MVP), ya que cubren los flujos de mayor fricción diaria.

---

## Beneficios Esperados

**Para el operador:**
- Vista consolidada de todas sus unidades sin importar la comunidad
- Historial permanente que sobrevive cambios de personal
- Menos mensajes de seguimiento de propietarios preguntando "¿qué pasó con X?"
- Evidencia fotográfica y factura archivadas por trabajo, reduciendo disputas

**Para el propietario:**
- Aprobación explícita antes de que comience cualquier trabajo con costo
- Visibilidad del estado de su unidad sin tener que preguntar
- Registro permanente de todas las decisiones (precios, reparaciones, incidentes)
- Menos sorpresas

**Para la comunidad:**
- Operadores informados de incidentes pueden actuar más rápido
- Registro claro de quién gestionó qué y cuándo
- Reducción de incidentes recurrentes en unidades bien gestionadas

---

## Preguntas para el Cliente

1. ¿Los operadores pagarían una suscripción por el portal, o es un beneficio de la plataforma?
2. ¿El equipo de trabajo del operador necesita acceso individual a la plataforma, o es suficiente que el operador actualice en su nombre?
3. ¿Con qué comunidades o edificios se haría el piloto inicial?
4. ¿Deberían las notificaciones llegar también por WhatsApp (además de correo electrónico)?
5. ¿Qué fases tienen mayor urgencia desde la perspectiva del operador y del propietario?

---
---
---

# ENGLISH

## Executive Summary

Today, the relationship between operators and property owners is managed primarily through WhatsApp groups: maintenance requests, cost approvals, cleaning coordination, pricing changes, and community incidents — all in the same conversation thread. Information gets lost, decisions go unrecorded, and follow-up depends on individual memory.

This proposal describes an extension to the existing platform that replaces that informal flow with structured, tracked, and permanent workflows — not by eliminating WhatsApp immediately, but by offering a more organized alternative that teams will adopt naturally.

---

## The Current Problem

| Situation | Consequence |
|---|---|
| Maintenance requests over WhatsApp | Owners learn the cost after the work is done, with no chance to approve beforehand |
| Pricing decisions scattered across messages | No record of who approved what and when |
| Unit information in group descriptions | Lost when staff changes or the group is modified |
| Cleaning coordination by message | Specific instructions forgotten or misunderstood |
| Credentials and documents sent by chat | Security risk, no version control |
| Operator staff turnover | Unit history and context leaves with the departing person |
| Community incidents invisible to operator | Operator acts without seeing the formal record; owner gets notified but is often remote |

---

## The Proposed Solution

An **Operator Portal** integrated into the existing platform, connecting operators, their staff, and property owners in a workspace organized by unit.

### Design Principles

- **Owner always approves** — no significant cost or change is executed without owner confirmation
- **Operator manages day-to-day** — with full visibility into all their units across all communities from a single view
- **Everything is recorded** — decisions, approvals, invoices, photos, and history are permanent and accessible to both parties
- **One unit, one operator** — each unit can only have one active operator, preventing confusion and conflicting responsibilities

---

## How the Relationship is Established and Terminated

### Establishment

Either party can initiate, but **the owner must always accept**:

**Option A — Operator proposes:**
The operator searches for the unit by apartment number and community. If the unit has no active operator, they send a management proposal. The owner receives a notification and accepts or declines.

**Option B — Owner invites:**
The owner searches for the operator by name or email from their unit view and sends an invitation. The operator accepts or declines.

**If the unit already has an operator:**
The system clearly indicates the unit is already managed. A new operator cannot be assigned until the owner ends the existing relationship.

### Termination

Either party can end the relationship at any time. The system checks for open service requests and warns before confirming. All history — requests, invoices, pricing decisions, documents — remains visible to both parties in read-only mode. The operator's staff immediately loses access.

---

## Features by Phase

### Phase 1 — Operator Identity & Unit Linking
*Estimated duration: 3 weeks*

- Operator registration with business name, contact details, and communities they work in
- Staff roster management: name, role (cleaning / supervision / logistics / guest relations), email and WhatsApp
- Unit linking with the propose/invite flow described above
- **Unit profile** maintained by the operator: amenities (hot water, AC units, sofa bed, lock type), bed configuration, Airbnb URL, access notes — replaces the Excel sheet and WhatsApp group description
- Clear status indicators visible to both owner and operator: *No operator / Pending / Actively managed*

---

### Phase 2 — Operator Dashboard (Multi-Community View)
*Estimated duration: 2 weeks*

The operator sees **all their units across all communities in a single view**, with community filter as a secondary option. Units requiring attention appear first.

Each unit card shows: current status, pending approvals, next scheduled event.

Staff also have a daily view of their assignments across all communities.

---

### Phase 3 — Service Requests & Work Orders
*Estimated duration: 4 weeks*

Replaces WhatsApp threads for maintenance, repairs, and cleaning.

**Request types:** Maintenance · Repair · Cleaning · Inspection · Regulatory (RNT, etc.) · Other

**Workflow:**
```
Created → Submitted → Owner approval* → Assigned → In progress → Completed → Closed
```
*Only when estimated cost is greater than zero. Owner approves before work begins.*

**Includes:**
- Assignment to an operator staff member
- Before and after photos of work completed
- Invoice upload (permanently archived against the unit)
- Owner notification at each status change
- Direct link to a community incident when applicable

---

### Phase 4 — Scheduling & Owner Blocks
*Estimated duration: 2 weeks*

- Owner requests date blocks (personal use, family, maintenance) directly from the platform
- Operator confirms and coordinates cleaning/preparation
- Scheduled maintenance visits calendar linked to service requests
- Conflict detection: system warns if a block conflicts with an existing booking or scheduled service

---

### Phase 5 — Pricing Log & Approval Workflow
*Estimated duration: 3 weeks*

- Structured pricing record: base rate, weekend rate, seasonal rules, active discounts
- **Change approval workflow:** either party proposes, the other approves or counter-proposes
- **Immutable decision log:** who proposed, who approved, when, before and after amounts — eliminates "what price did we agree on?" confusion
- Season rules: named periods (Peak / Standard / Low) with date ranges and price multipliers

---

### Phase 6 — Documents & Compliance
*Estimated duration: 2 weeks*

- Unit document folder: RNT, utilities, insurance, Airbnb listing assets
- All service request invoices automatically archived per unit
- Quarterly summary auto-generated: occupancy and service costs
- Eliminates credential sharing in chat group descriptions

---

### Phase 7 — Staff Task Management
*Estimated duration: 3 weeks*

- Staff access their daily assignment list across all communities from their phone
- They update task status: Arrived / In progress / Done + photo
- Operator sees real-time view of what's complete and what's overdue
- Complete unit history visible to new staff from day one — no WhatsApp catch-up needed

---

### Community Incidents — Integration

Operators can **see and manage incidents on their units** with a clear accountability model:

- Operator sees all incidents on their managed units
- Reporter identity remains confidential (same rule as for owners today)
- Owner and operator are notified simultaneously
- **Delegation level** configured per unit:
  - *Owner handles:* operator sees, owner acts
  - *Operator assists (default):* operator can complete Step 1 on behalf of owner; owner completes Step 2
  - *Operator handles:* operator completes both steps; owner receives an informational notification
- All operator actions are logged as "acting on behalf of [Owner]"
- Repairs triggered by an incident link directly to a service request record

---

## Phase Summary & Timeline

| Phase | What it replaces | Estimated weeks |
|---|---|---|
| 1 · Identity & linking | Unit Excel, group descriptions, informal assignment | 3 |
| 2 · Multi-community dashboard | Mental "my units" view scattered across groups | 2 |
| 3 · Service requests | Maintenance/repair/cleaning WhatsApp threads | 4 |
| 4 · Scheduling & blocks | "Block these dates" by message | 2 |
| 5 · Pricing history | Pricing decisions scattered across conversations | 3 |
| 6 · Documents | Credentials in group descriptions, invoices as photos | 2 |
| 7 · Staff management | @-tag assignments, manual status follow-up | 3 |
| **Total** | | **~19 weeks** |

Phases 1, 2, and 3 are recommended as the first delivery (MVP), as they address the highest daily-friction workflows.

---

## Expected Benefits

**For the operator:**
- Consolidated view of all units regardless of community
- Permanent history that survives staff changes
- Fewer follow-up messages from owners asking "what happened with X?"
- Photo evidence and invoices archived per job, reducing disputes

**For the owner:**
- Explicit approval before any paid work begins
- Visibility into their unit's status without having to ask
- Permanent record of all decisions (pricing, repairs, incidents)
- Fewer surprises

**For the community:**
- Operators informed of incidents can act faster
- Clear record of who managed what and when
- Reduction in recurring incidents on well-managed units

---

## Questions for the Client

1. Would operators pay a subscription for the portal, or is this a platform benefit?
2. Does the operator's staff need individual platform access, or is it enough for the operator to update on their behalf?
3. Which communities or buildings would be used for the initial pilot?
4. Should notifications also arrive via WhatsApp (in addition to email)?
5. Which phases are most urgent from the operator's and the owner's perspective?
