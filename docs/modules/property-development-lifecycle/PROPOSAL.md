# Propuesta: Ciclo de Vida del Desarrollo Inmobiliario
# Proposal: Property Development Lifecycle

> **Estado / Status:** Placeholder — pendiente de descubrimiento con desarrolladores
> y compradores reales. Este documento captura el alcance y las preguntas a
> resolver antes de un diseño detallado, en el mismo formato que
> `../operator-portal/PROPOSAL.md`.
>
> Companion: `../../platform/ROADMAP.md` §6.1, Horizon H3.

---

# ESPAÑOL

## Resumen Ejecutivo

KAI ya gestiona la fase de **operación** de una propiedad: incidentes,
operadores Airbnb, propietarios, comunicaciones. Pero la vida de una unidad
empieza mucho antes: en preventa, durante la construcción, en la entrega, y
durante la garantía postventa. Hoy esa fase también vive en WhatsApp,
correos sueltos, hojas de Excel del desarrollador, y carpetas físicas.

Esta propuesta describe un módulo de **Ciclo de Vida del Desarrollo
Inmobiliario** que cubre desde la captura del lead hasta la reventa, e
integra al desarrollador, comprador, administrador del edificio y propietario
en un único hilo de información que sobrevive cambios de personal del
desarrollador y traspasos de unidad.

---

## El Problema Actual

| Situación | Consecuencia |
|---|---|
| Leads de preventa rastreados en Excel del corredor | Se pierden, no hay seguimiento, no se sabe qué ofreció quién |
| Plan de pagos comunicado por correo y WhatsApp | Cuotas atrasadas no se detectan a tiempo; sin recordatorios automáticos |
| Avance de obra mostrado por fotos en grupo | Compradores ansiosos, llamadas repetitivas al área comercial |
| Acta de entrega en papel | Hallazgos del comprador se pierden; el desarrollador no aprende patrones de defectos |
| Garantía 1/5/10 años opaca | El comprador no sabe qué reclamar ni cuándo; el desarrollador recibe reclamos por correo sin trazabilidad |
| Reventa sin transferencia de historial | El nuevo propietario hereda una caja negra: ni manuales, ni claves, ni decisiones previas |

---

## La Solución Propuesta

Un módulo de **Ciclo de Vida del Desarrollo Inmobiliario** integrado a la
plataforma existente, que conecta al desarrollador, equipo de ventas,
comprador y futuro propietario en torno a una única **unidad** que persiste
desde antes de existir físicamente hasta su reventa.

### Principios de diseño

- **La unidad es el hilo conductor** — todo (lead, contrato, pagos, obra,
  acta, garantía, reventa) cuelga del mismo registro de unidad
- **El desarrollador es un actor temporal pero crítico** — entra fuerte en
  preventa, se desvanece tras la entrega, vuelve solo durante reclamos de
  garantía
- **El historial sobrevive al cambio de propietario** — al revender, el
  nuevo dueño hereda manuales, claves, garantías vigentes, y decisiones
  arquitectónicas
- **Compatible con CRM existentes** — KAI no reemplaza HubSpot/Salesforce;
  sirve como capa de experiencia post-reserva e integra con CRM si existe

---

## Funcionalidades por Fase

### Fase 1 — Captura de Leads y Portal del Comprador
*Duración estimada: 3 semanas (post-descubrimiento)*

- Formulario de interés con UTM y fuente del lead
- Página por proyecto con planos, render, recorrido virtual
- Conversión de lead a comprador (depósito de reserva)
- Acceso del comprador a un portal con su unidad reservada

### Fase 2 — Contrato de Compraventa y Plan de Pagos
*Duración estimada: 4 semanas*

- Plantilla de contrato de promesa, firma electrónica integrada
- Plan de pagos por hitos (cuota inicial, separación, contra escritura)
- Recordatorios automáticos antes de cada cuota
- Conciliación de pagos recibidos contra el plan
- Reporte para contabilidad (Siigo, QuickBooks)

### Fase 3 — Comunicación de Avance de Obra
*Duración estimada: 3 semanas*

- Hitos de construcción configurables por proyecto (fundación, estructura,
  fachada, acabados, entrega)
- Galería de fotos por hito, marcada con fecha
- Notificación a compradores en cada hito alcanzado
- Cambios de cronograma (delays) comunicados con justificación

### Fase 4 — Inspección Pre-Entrega (Acta de Entrega)
*Duración estimada: 4 semanas*

- Lista de chequeo configurable por tipología de unidad
- Comprador y representante del desarrollador hacen recorrido conjunto
- Hallazgos (defectos, faltantes) registrados con foto y ubicación
- Compromisos de subsanación con fecha tope
- Firma digital del acta cuando todo lo prometido queda subsanado

### Fase 5 — Entrega y Transición a Propietario
*Duración estimada: 2 semanas*

- Paquete de entrega digital: manuales, garantías, claves, códigos
- Identidad del comprador se convierte en `owner` en el módulo de operación
  (mismo login, nueva vista)
- El administrador del edificio recibe al nuevo propietario en el directorio
- Si la unidad va a operación STR, se invita al operador Airbnb

### Fase 6 — Período de Garantía Postventa (1/5/10 años)
*Duración estimada: 4 semanas*

- Reclamos de garantía como tipo de solicitud especial
- Enrutamiento al desarrollador (no al operador Airbnb ni al administrador)
- Ventanas legales colombianas: 1 año (acabados), 5 años (instalaciones),
  10 años (estructura)
- El desarrollador ve un panel con todos los reclamos pendientes por proyecto
- Cierre del reclamo requiere aprobación del propietario

### Fase 7 — Reventa y Transferencia de Propiedad
*Duración estimada: 3 semanas*

- Propietario marca unidad en venta; corredor recibe acceso de solo lectura
- Paquete de venta: histórico de mantenimiento, garantías vigentes, reglas
  HOA, documentos
- Transferencia de propietario: nuevo dueño hereda historial relevante;
  datos sensibles (precios pagados, ingresos STR) quedan archivados según
  política de privacidad
- Notificación al administrador del edificio para actualizar el directorio

---

## Resumen de Fases

| Fase | Reemplaza | Semanas |
|---|---|---|
| 1 · Leads y portal | Excel de corredor | 3 |
| 2 · Contrato y pagos | Correo + WhatsApp + hojas de control | 4 |
| 3 · Avance de obra | Fotos sueltas en grupos | 3 |
| 4 · Acta de entrega | Papel + memoria | 4 |
| 5 · Entrega y transición | Carpetas físicas | 2 |
| 6 · Garantía 1/5/10 | Correos sin trazabilidad | 4 |
| 7 · Reventa | Caja negra heredada | 3 |
| **Total** | | **~23 semanas** |

Las fases 4, 5 y 6 (acta, entrega, garantía) son las de mayor diferenciación
porque son las que no cubre ningún CRM existente.

---

## Beneficios Esperados

**Para el desarrollador:**
- Un único sistema de registro desde el lead hasta el último reclamo de
  garantía
- Reducción de reclamos repetidos al detectar patrones de defectos por
  tipología
- Trazabilidad legal de la entrega y los compromisos de subsanación

**Para el comprador / propietario:**
- Visibilidad permanente del avance de su inversión
- Recordatorios proactivos de cuotas
- Transición fluida de "comprador" a "propietario" sin perder información
- Saber qué cubre cada garantía y cómo reclamar

**Para la comunidad / administrador del edificio:**
- Recibe propietarios ya identificados, con datos de contacto, no como
  desconocidos en la portería
- Puede coordinar la fase final de obra con el desarrollador desde la misma
  plataforma

---

## Preguntas para el Cliente (pre-construcción)

1. ¿KAI vende este módulo directamente al desarrollador, o se lo licencia
   para usarlo internamente con su marca?
2. ¿El módulo debe integrarse con un CRM existente (HubSpot, Salesforce,
   Zoho) o reemplazarlo?
3. ¿La firma electrónica del contrato debe integrarse con un proveedor
   (DocuSign, FirmaYa, Signio) o ser nativa?
4. ¿El plan de pagos se concilia automáticamente con el banco
   (Bancolombia, Davivienda) o se carga manualmente?
5. ¿El desarrollador requiere un dashboard de pipeline comercial, o eso
   queda en su CRM?
6. ¿Las garantías 1/5/10 años deben generar pólizas formales o son
   compromisos contractuales rastreados internamente?
7. ¿En reventa, qué historial es transferible al nuevo dueño y cuál queda
   archivado por privacidad?

---
---
---

# ENGLISH

## Executive Summary

KAI already manages the **operating** phase of a property: incidents, Airbnb
operators, owners, communications. But a unit's life starts much earlier:
pre-sale, construction, handover, and warranty period. Today that phase also
lives in WhatsApp, scattered emails, the developer's spreadsheets, and
physical folders.

This proposal describes a **Property Development Lifecycle** module covering
lead capture through resale, integrating developer, buyer, building admin,
and owner into a single information thread that survives developer-staff
turnover and unit ownership transfers.

---

## The Current Problem

| Situation | Consequence |
|---|---|
| Pre-sale leads tracked in broker Excel | Lost, no follow-up, unclear who offered what |
| Payment plan communicated by email and WhatsApp | Late instalments not caught early; no automatic reminders |
| Construction progress shown via group-chat photos | Anxious buyers, repetitive calls to sales |
| Pre-delivery inspection on paper | Buyer findings get lost; developer can't learn defect patterns |
| Opaque 1/5/10-year warranty | Buyer doesn't know what to claim or when; developer receives claims by email with no traceability |
| Resale without history transfer | New owner inherits a black box: no manuals, no codes, no prior decisions |

---

## The Proposed Solution

A **Property Development Lifecycle** module integrated into the existing
platform, connecting developer, sales team, buyer, and future owner around
a single **unit** record that persists from before the unit physically
exists through to its eventual resale.

### Design principles

- **The unit is the through-line** — leads, contracts, payments,
  construction, inspection, warranty, and resale all hang off the same unit
  record
- **The developer is a temporary but critical actor** — heavy presence
  pre-sale, fades after handover, returns only during warranty claims
- **History survives ownership change** — at resale the new owner inherits
  manuals, codes, valid warranties, and architectural decisions
- **Compatible with existing CRMs** — KAI doesn't replace HubSpot /
  Salesforce; it is the post-reservation experience layer and integrates
  with a CRM if one exists

---

## Features by Phase

### Phase 1 — Lead Capture & Buyer Portal
*Estimated duration: 3 weeks (post-discovery)*

- Interest form with UTM and lead source
- Per-project page with floor plans, renders, virtual tour
- Lead-to-buyer conversion (reservation deposit)
- Buyer access to a portal showing their reserved unit

### Phase 2 — Sales Contract & Payment Plan
*Estimated duration: 4 weeks*

- Promesa-de-compraventa template; integrated e-signature
- Milestone payment plan (down payment, separación, against escritura)
- Automatic reminders before each instalment
- Reconciliation of received payments against the plan
- Accounting export (Siigo, QuickBooks)

### Phase 3 — Construction Progress Communications
*Estimated duration: 3 weeks*

- Configurable construction milestones per project (foundation, structure,
  façade, finishes, handover)
- Photo gallery per milestone, date-stamped
- Buyer notification at each milestone reached
- Schedule changes (delays) communicated with justification

### Phase 4 — Pre-Delivery Inspection (Acta de Entrega)
*Estimated duration: 4 weeks*

- Configurable checklist per unit typology
- Buyer and developer rep walk through together
- Findings (defects, missing items) logged with photo and location
- Remediation commitments with deadlines
- Digital signature of the acta when all promised items are remediated

### Phase 5 — Handover & Transition to Owner
*Estimated duration: 2 weeks*

- Digital handover packet: manuals, warranties, keys, codes
- Buyer identity becomes `owner` in the operating module (same login,
  new view)
- Building admin welcomes the new owner into the directory
- If the unit goes to STR operation, the Airbnb operator is invited

### Phase 6 — Post-Sale Warranty Period (1/5/10 years)
*Estimated duration: 4 weeks*

- Warranty claims as a special request type
- Routed to the developer (not the Airbnb operator, not the building admin)
- Colombian legal windows: 1 year (finishes), 5 years (installations),
  10 years (structure)
- Developer sees a dashboard of all open claims by project
- Claim closure requires owner approval

### Phase 7 — Resale & Ownership Transfer
*Estimated duration: 3 weeks*

- Owner flags unit as for sale; broker gets read-only access
- Sales packet: maintenance history, valid warranties, HOA rules,
  documents
- Owner transfer: new owner inherits relevant history; sensitive data
  (prices paid, STR income) is archived per privacy policy
- Notification to building admin to update the directory

---

## Phase Summary

| Phase | Replaces | Weeks |
|---|---|---|
| 1 · Leads + buyer portal | Broker Excel | 3 |
| 2 · Contract + payments | Email + WhatsApp + tracking sheets | 4 |
| 3 · Construction progress | Stray photos in groups | 3 |
| 4 · Acta de entrega | Paper + memory | 4 |
| 5 · Handover & transition | Physical folders | 2 |
| 6 · Warranty 1/5/10 | Untraceable email | 4 |
| 7 · Resale | Inherited black box | 3 |
| **Total** | | **~23 weeks** |

Phases 4, 5, and 6 (acta, handover, warranty) are the highest-differentiation
ones because no existing CRM covers them.

---

## Expected Benefits

**For the developer:**
- A single system of record from lead to final warranty claim
- Reduced repeat claims by detecting defect patterns per typology
- Legal traceability of handover and remediation commitments

**For the buyer / owner:**
- Permanent visibility into the progress of their investment
- Proactive payment reminders
- Smooth "buyer" → "owner" transition without losing information
- Clarity on what each warranty covers and how to claim

**For the community / building admin:**
- Receives owners already identified, with contact data — not as
  strangers at the front desk
- Can coordinate the final construction phase with the developer from
  inside the same platform

---

## Questions for the Client (pre-construction)

1. Does KAI sell this module directly to developers, or license it to them
   for white-label use under their brand?
2. Should the module integrate with an existing CRM (HubSpot, Salesforce,
   Zoho) or replace one?
3. Should contract e-signature integrate with a provider (DocuSign,
   FirmaYa, Signio) or be native?
4. Is the payment plan reconciled automatically with the bank
   (Bancolombia, Davivienda) or loaded manually?
5. Does the developer need a sales-pipeline dashboard, or does that stay
   in their CRM?
6. Should 1/5/10-year warranties generate formal insurance policies, or
   are they contractual commitments tracked internally?
7. On resale, which history transfers to the new owner and which is
   archived for privacy?

---

## What this document is not

This is a **placeholder proposal**, parallel to
`../operator-portal/PROPOSAL.md`. It captures scope and the open questions
to resolve before detailed design. Concrete UI, data model, and effort
estimates require a discovery cycle with at least one developer partner —
analogous to the WhatsApp transcript work that grounded the operator
portal in `../operator-portal/USE_CASE_DISCOVERY.md`.
