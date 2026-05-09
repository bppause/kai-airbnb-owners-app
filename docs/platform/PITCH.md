# KAI — Pitch
# Una plataforma para administrar la vida completa de una propiedad
# A platform for the full life of a property

> **Para inversionistas, clientes, amigos y familia.**
> *For investors, clients, friends and family.*
>
> Última actualización / Last updated: May 2026 · Cartagena, Colombia

---

# ESPAÑOL

## La escena que conocemos

Imagínate un edificio en Cartagena. Veinte apartamentos. Algunos los
habitan sus dueños; la mayoría se rentan por Airbnb. Detrás de cada uno hay
un grupo de WhatsApp con quince personas: el operador Airbnb, el dueño, su
esposa, el equipo de limpieza, alguien del edificio, un técnico de aire
acondicionado que ya no trabaja allí, y números de teléfono que nadie
identifica.

En ese grupo se discute todo: el huésped que se quedó sin agua caliente, la
factura del aire acondicionado, el precio del fin de semana de Carnaval, el
cambio de cerradura, una factura por Nequi, las credenciales del RNT en
texto plano. Cuando algo falla — y falla a menudo — nadie sabe quién dijo
qué, cuándo, ni quién tiene que actuar ahora. La memoria depende de las
personas, y las personas se van.

Ahora súbele otra capa: el administrador del edificio gestiona cuotas en
Excel, las reservas del salón social en una libreta, las visitas en una
hoja de papel en la portería, y el desarrollador inmobiliario que entregó
ese edificio hace dos años todavía recibe reclamos de garantía por correo
sin un sistema que los rastree.

**Esto no es Cartagena. Esto es así en cada edificio residencial con
operación turística en América Latina.**

---

## Lo que estamos construyendo

KAI es una plataforma que opera la vida completa de una propiedad
residencial: desde la preventa, pasando por la entrega, la operación
diaria, la operación turística (Airbnb) si aplica, hasta la reventa.

Una sola plataforma. Múltiples audiencias. Cada quien ve lo que le
corresponde:

- **El propietario** ve el estado de su unidad: incidentes, aprobaciones
  pendientes, calendario, mantenimiento, finanzas
- **El operador Airbnb** gestiona todas sus unidades en todos los edificios
  desde una sola vista, con aprobaciones formales del propietario
- **El administrador del edificio** opera el complejo: residentes, visitas,
  paquetes, reservas de amenidades, cuotas, comunicaciones, emergencias
- **El equipo de portería** registra visitas, paquetes y accesos en tiempo
  real, no en libretas
- **El desarrollador** mantiene contacto con el comprador desde la
  preventa hasta el último reclamo de garantía
- **Las autoridades de turismo** reciben los reportes que la ley exige sin
  intervención manual

Todo queda registrado. Todo es auditable. Y nada vive en un grupo de
WhatsApp que se pierde cuando el equipo cambia.

---

## Por qué ahora

Tres tendencias se cruzan:

1. **Explosión del alquiler corto plazo en LATAM.** Cartagena, Medellín,
   Ciudad de México, Buenos Aires. Edificios diseñados como vivienda están
   operando como hoteles, sin las herramientas de un hotel.
2. **Regulación creciente.** RNT, SIRE, Migración Colombia, impuestos al
   turismo, Habeas Data. La operación informal ya no es viable; las
   sanciones son reales.
3. **Comunicación rota.** WhatsApp resolvió el contacto pero rompió la
   memoria. Las plataformas globales (Airbnb, Hostaway, Guesty) no se
   ocupan de la relación operador-propietario, ni de la administración del
   edificio, ni del desarrollador.

KAI ocupa el espacio entre Airbnb (que controla huéspedes y dinero) y la
realidad operativa del edificio (que nadie controla). Ese espacio existe
en cada complejo turístico de Latinoamérica.

---

## Lo que ya está vivo

- **Gestión de incidentes en producción** en Morros KAI, Serena del Mar
  (Cartagena). Flujo completo: reportar → verificar con propietario →
  resolver, con SLA, escalación, notificaciones por correo y registro de
  auditoría.
- **Roles y permisos** configurables por administrador.
- **Bilingüe** español–inglés desde el primer día.
- **Despliegue** en Render, base de datos en Supabase, autenticación con
  Google.

## Lo que viene en el corto plazo (próximos 6 meses)

- **Portal del Operador Airbnb** — el reemplazo estructurado del grupo de
  WhatsApp entre operador y propietario. Documentación completa, basada en
  un análisis de un chat real de 7 meses entre dueños y operador.
  Detalles: `../modules/operator-portal/PROPOSAL.md`.

## Lo que viene después

- **Operación del edificio:** directorio de residentes, visitas y paquetes,
  reservas de amenidades, cuotas, mantenimiento de áreas comunes, emergencia.
- **Ciclo de vida del desarrollo inmobiliario:** preventa, contratos,
  avance de obra, acta de entrega, garantía 1/5/10 años, reventa.
  Detalles: `../modules/property-development-lifecycle/PROPOSAL.md`.
- **Cumplimiento turístico:** SIRE, RNT, impuestos, Habeas Data.
- **Inteligencia y escala:** análisis, IA, multi-edificio, multi-moneda,
  integraciones (PMS, contabilidad, banca).

Hoja de ruta completa: `./ROADMAP.md`.

---

## ¿Por qué confiar en este equipo?

- **Construido por usuarios reales de la cosa que está rota.** El primer
  edificio piloto es propiedad de uno de los socios, que vivió siete meses
  el caos del WhatsApp con su operadora antes de escribir la primera línea
  de código.
- **Construido en el mercado, para el mercado.** Español como lenguaje
  primario, peso colombiano como moneda primaria, normativa colombiana
  (RNT, SIRE, Habeas Data) como cumplimiento por defecto.
- **Documentación obsesiva.** Antes de codificar el portal del operador
  hicimos un análisis cuantitativo de un chat real (frecuencia por tipo de
  interacción, fallas de seguimiento, tiempos de respuesta). Ese rigor está
  en `../modules/operator-portal/USE_CASE_DISCOVERY.md` y guía cada decisión de producto.

---

## Cómo participar

- **Inversionistas:** estamos definiendo la siguiente ronda de capital
  para acelerar el portal del operador y arrancar el módulo de edificio.
  Conversemos.
- **Clientes (administradores, desarrolladores, operadores):** buscamos
  uno o dos edificios piloto para validar el portal del operador y otro
  desarrollador inmobiliario para co-diseñar el módulo de ciclo de vida.
- **Amigos y familia:** comparte este documento con quien creas que
  enfrenta este caos. La mejor introducción es un edificio que esté
  cansado de gestionar todo por WhatsApp.

Contacto: *[insertar correo / sitio]*

---
---
---

# ENGLISH

## The scene you already know

Picture a building in Cartagena. Twenty apartments. A few are
owner-occupied; most are rented out on Airbnb. Behind each one is a
WhatsApp group with fifteen people: the Airbnb operator, the owner, their
spouse, the cleaning team, someone from the building, an AC technician
who no longer works there, and phone numbers nobody recognises.

That group covers everything: the guest with no hot water, the AC bill,
the Carnaval weekend price, the lock change, a Nequi payment, RNT
credentials in plain text. When something breaks — and it breaks often —
nobody knows who said what, when, or whose turn it is now. Memory
depends on people, and people leave.

Now add another layer: the building admin runs HOA fees in Excel, common-
area bookings in a notebook, visitor entries on a paper sheet at the
guard desk, and the developer who handed that building over two years
ago still receives warranty claims by email, with no system to track them.

**This isn't Cartagena. This is every residential building with tourist
operations across Latin America.**

---

## What we're building

KAI is a platform that runs the full life of a residential property:
from pre-sale, through handover, daily operation, short-term-rental
operation (Airbnb) where applicable, to resale.

One platform. Multiple audiences. Each one sees only what's theirs:

- **The owner** sees their unit's state: incidents, pending approvals,
  calendar, maintenance, finances
- **The Airbnb operator** runs every unit they manage across every
  building from one view, with formal owner approvals
- **The building admin** runs the complex: residents, visitors, packages,
  amenity bookings, fees, communications, emergencies
- **The front-desk team** logs visits, packages and access in real time,
  not in notebooks
- **The developer** stays connected to the buyer from pre-sale all the
  way through the last warranty claim
- **Tourism authorities** receive the legally-required reports without
  manual intervention

Everything is logged. Everything is auditable. And nothing lives in a
WhatsApp group that disappears when the team changes.

---

## Why now

Three trends converge:

1. **Short-term rentals exploding across LATAM.** Cartagena, Medellín,
   Mexico City, Buenos Aires. Buildings designed as residences operating
   as hotels — without the tools of a hotel.
2. **Regulation tightening.** RNT, SIRE, Migración Colombia, tourism
   taxes, Habeas Data. Informal operation is no longer viable; penalties
   are real.
3. **Communication is broken.** WhatsApp solved contact but broke memory.
   Global platforms (Airbnb, Hostaway, Guesty) don't address the
   operator–owner relationship, building administration, or the developer.

KAI fills the space between Airbnb (which owns guests and money) and the
operational reality of the building (which nobody owns). That space
exists in every tourist complex in Latin America.

---

## What's already live

- **Incident management in production** at Morros KAI, Serena del Mar
  (Cartagena). Full flow: report → owner verification → resolve, with
  SLAs, escalation, email notifications and audit log.
- **Roles & permissions** configurable per admin.
- **Bilingual** Spanish–English from day one.
- **Deployed** on Render, database on Supabase, Google authentication.

## What's coming in the short term (next 6 months)

- **Airbnb Operator Portal** — the structured replacement for the
  WhatsApp group between operator and owner. Fully documented, based on
  analysis of a real 7-month chat between owners and operator.
  Details: `../modules/operator-portal/PROPOSAL.md`.

## What's coming after that

- **Building operation:** resident directory, visitors and packages,
  amenity reservations, fees, common-area maintenance, emergency.
- **Property development lifecycle:** pre-sale, contracts, construction
  progress, acta de entrega, 1/5/10-year warranty, resale. Details:
  `../modules/property-development-lifecycle/PROPOSAL.md`.
- **Tourism compliance:** SIRE, RNT, taxes, Habeas Data.
- **Intelligence and scale:** analytics, AI, multi-building,
  multi-currency, integrations (PMS, accounting, banking).

Full roadmap: `./ROADMAP.md`.

---

## Why this team

- **Built by real users of the thing that's broken.** The first pilot
  building is owned by one of the founders, who lived seven months of
  WhatsApp chaos with his operator before the first line of code was
  written.
- **Built in the market, for the market.** Spanish as the primary
  language, Colombian peso as the primary currency, Colombian regulation
  (RNT, SIRE, Habeas Data) as default compliance.
- **Obsessive documentation.** Before coding the operator portal we did
  a quantitative analysis of a real chat (frequency by interaction type,
  follow-up failures, response times). That rigour is in
  `../modules/operator-portal/USE_CASE_DISCOVERY.md` and drives every product decision.

---

## How to engage

- **Investors:** we're defining the next funding round to accelerate the
  operator portal and start the building-operations module. Let's talk.
- **Clients (admins, developers, operators):** we're looking for one or
  two pilot buildings to validate the operator portal, and one
  development-stage builder to co-design the lifecycle module.
- **Friends and family:** share this document with anyone you think
  faces this chaos. The best introduction is a building that's tired of
  running everything through WhatsApp.

Contact: *[insert email / website]*
