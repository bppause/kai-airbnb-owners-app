// Help content + per-topic action buttons.
//
// HELP_TOPICS — bilingual help articles, role-gated (user / delegate_admin /
//               global_admin) and category-grouped (basics / incidents /
//               admin / account).
// HELP_ACTIONS — keyed by topic id; each action has a handler that receives
//                { setView, onReport, onAddListing, setQuickFilter, openMore }
//                from HelpView so buttons can act on the parent app state.
//
// Lifted byte-identical from App.jsx in stage F24.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F24.

import { HL } from "../../core/utils";

// ─── HELP CONTENT ─────────────────────────────────────────────────────────────
export const HELP_TOPICS = [
  // ── BASICS ────────────────────────────────────────────────────────────────
  {
    id:'start', icon:'🚀', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Primeros pasos','Getting started'),
    summary:HL('Cómo ingresar, registrar tu apartamento y entender tu rol en la app.','How to sign in, register your apartment, and understand your role in the app.'),
    sections:[
      { h:HL('¿Qué es esta app?','What is this app?'),
        b:HL('Esta es la plataforma privada de propietarios de tu comunidad. Centraliza el registro de unidades, el reporte de incidentes (con fotos), incidentes generales, notificaciones automáticas y comunicación entre propietarios y administración. La app soporta múltiples comunidades/edificios: cada una tiene su propio branding, torre y equipo de administración.','This is the private owners platform for your community. It centralizes unit registration, incident reporting (with photos), community-wide general incidents, automatic notifications, and communication between owners and management. The app supports multiple communities/buildings — each with its own branding, tower, and independent admin team.')},
      { h:HL('Ingreso con Google','Signing in with Google'),
        b:HL('La app usa exclusivamente Google Sign-In. Haz clic en "Ingresar con Google" y selecciona la cuenta de Gmail que usas para gestionar tus apartamentos. No hay contraseñas separadas. La app detecta automáticamente a qué comunidad perteneces según tu membresía.','The app uses Google Sign-In only. Click "Sign in with Google" and select the Gmail account you use to manage your apartments. There are no separate passwords. The app automatically detects which community you belong to based on your membership.')},
      { h:HL('Visitante vs. propietario aprobado','Visitor vs. approved owner'),
        b:HL('Al ingresar por primera vez apareces como "Visitante". Registra tu(s) unidad(es) y espera la aprobación del administrador o admin de comunidad. Una vez aprobado tendrás acceso completo: Mis Unidades, Incidentes, Comunidad, Dashboard, Alertas y más.','When you first sign in you appear as a "Visitor". Register your unit(s) and wait for admin or community admin approval. Once approved you get full access: My Units, Incidents, Community, Dashboard, Alerts, and more.')},
    ]
  },
  {
    id:'navigation', icon:'🗺️', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Cómo navegar la app','Navigating the app'),
    summary:HL('Mis Unidades es la pantalla de inicio. Menú superior en escritorio, barra inferior en móvil.','My Units is the home screen. Top menu on desktop, bottom bar on mobile.'),
    sections:[
      { h:HL('Pantalla de inicio: Mis Unidades','Home screen: My Units'),
        b:HL('Al ingresar llegas a "Mis Unidades". Verás el banner "¿Qué debes hacer ahora?" con tus acciones pendientes (Paso 1 y Paso 2), y la advertencia de perfil incompleto si algún operador no tiene email registrado.','When you sign in you land on "My Units". You\'ll see the "What do you need to do next?" banner with your pending actions (Step 1 and Step 2), and a profile warning if any operator is missing an email.')},
      { h:HL('Menú principal (escritorio)','Main menu (desktop)'),
        b:HL('El menú superior muestra: Mis Unidades · Incidentes · Comunidad · Inventario · Dashboard. Las secciones adicionales (Misión, Analíticas, Registros, Admin) aparecen en "Más ▾". El administrador puede personalizar el orden y las secciones por rol.','The top menu shows: My Units · Incidents · Community · Inventory · Dashboard. Additional sections (Mission, Analytics, Registrations, Admin) appear under "More ▾". Admins can customize order and sections per role.')},
      { h:HL('Barra de navegación inferior (móvil)','Bottom navigation bar (mobile)'),
        b:HL('En dispositivos móviles (pantalla ≤768px) aparece una barra fija en la parte inferior con 4 accesos rápidos: Mis Unidades · Incidentes · Alertas · Perfil. Así puedes navegar con el pulgar sin necesidad de desplazarte al menú superior.','On mobile devices (screen ≤768px) a sticky bottom bar appears with 4 quick tabs: My Units · Incidents · Alerts · Profile. Navigate with your thumb without scrolling to the top menu.')},
      { h:HL('Clic en número de unidad → detalle','Click unit number → detail'),
        b:HL('En cualquier parte de la app puedes hacer clic en el número de unidad (placa oscura) para abrir el popup de detalles: info del listing, propietario con email/WhatsApp, operador, e historial de incidentes de esa unidad.','Anywhere in the app click the unit number plate (dark) to open the detail popup: listing info, owner with email/WhatsApp, operator, and incident history for that unit.')},
      { h:HL('Clic en incidente → detalle completo','Click incident → full detail'),
        b:HL('Haz clic en cualquier incidente (en Incidentes, Dashboard, Mis Unidades, Alertas, Comunidad) para ver su detalle completo: estado, tipo, fotos adjuntas, huéspedes, acción tomada con fecha/hora, respuesta del propietario, y cierre del admin.','Click any incident (in Incidents, Dashboard, My Units, Alerts, Community) to see its full detail: status, type, attached photos, guests, action taken with timestamp, owner resolution, and admin closure.')},
    ]
  },
  // ── MY UNITS ──────────────────────────────────────────────────────────────
  {
    id:'units', icon:'🏠', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Mis Unidades','My Units'),
    summary:HL('Agregar, editar y gestionar tus unidades. Ver el banner de acción y advertencias de perfil.','Add, edit, and manage your units. See the action guide banner and profile warnings.'),
    sections:[
      { h:HL('Agregar una unidad','Adding a unit'),
        b:HL('Ve a "Mis Unidades" y haz clic en "+ Agregar". Completa el número de 3 dígitos (ej. 501), habitaciones y capacidad. El operador (nombre + email + WhatsApp) es opcional pero recomendado: su email recibirá todas las notificaciones de incidentes.','Go to "My Units" and click "+ Add". Fill in the 3-digit number (e.g. 501), rooms, and capacity. The operator (name + email + WhatsApp) is optional but recommended: their email receives all incident notifications.')},
      { h:HL('Advertencia de perfil incompleto','Incomplete profile warning'),
        b:HL('Si un operador tiene nombre registrado pero no email, aparece una advertencia naranja en la parte superior de Mis Unidades. Sin email, el operador no recibirá notificaciones de incidentes ni recordatorios SLA. Edita la unidad para agregar el email del operador.','If an operator has a name registered but no email, an orange warning appears at the top of My Units. Without an email the operator won\'t receive incident notifications or SLA reminders. Edit the unit to add the operator email.')},
      { h:HL('Banner "¿Qué debes hacer ahora?"','Banner "What do you need to do next?"'),
        b:HL('Debajo de las estadísticas aparece un banner verde con tus incidentes accionables: cuántos necesitan el Paso 1 (verificar) y cuántos necesitan el Paso 2 (agregar respuesta). Haz clic en cualquier ítem del banner para filtrar directamente a esos incidentes.','Below the stats a green banner shows your actionable incidents: how many need Step 1 (verify) and how many need Step 2 (add resolution). Click any banner item to filter directly to those incidents.')},
      { h:HL('Filtrar por estado','Filter by status'),
        b:HL('Las 5 píldoras de estadísticas (Todos, Verificar, Resolución, Admin, Cerrados) funcionan como filtros. Haz clic en una para ver solo los listings con incidentes en ese estado. Haz clic de nuevo para quitar el filtro.','The 5 stat pills (All, Verify, Resolution, Admin, Closed) work as filters. Click one to show only listings with incidents in that status. Click again to clear the filter.')},
    ]
  },
  // ── INCIDENTS ─────────────────────────────────────────────────────────────
  {
    id:'incidents', icon:'⚠️', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Reportar un incidente','Reporting an incident'),
    summary:HL('Reporta incidentes de unidad con fotos, o incidentes generales de la comunidad sin unidad específica.','Report unit incidents with photos, or general community incidents without a specific unit.'),
    sections:[
      { h:HL('Incidente de unidad','Unit incident'),
        b:HL('Selecciona la unidad, fecha, categoría y tipo. Usa los ejemplos de la cuadrícula para pre-completar tipo y descripción. Añade hasta 3 fotos (JPEG/PNG/WebP, máx 10 MB cada una antes de compresión). Las fotos se comprimen automáticamente y quedan adjuntas al incidente.','Select the unit, date, category, and type. Use the example grid to pre-fill type and description. Add up to 3 photos (JPEG/PNG/WebP, max 10 MB each before compression). Photos are automatically compressed and attached to the incident.')},
      { h:HL('Fotos adjuntas — hasta 3','Photo attachments — up to 3'),
        b:HL('En el formulario de reporte verás la sección "Fotos". Toca el botón 📷 Agregar para elegir imágenes desde tu galería o cámara. El sistema las comprime a máx 1200px y calidad JPEG 0.72 antes de guardar. Toca una miniatura para verla a tamaño completo, y ✕ para quitarla.','In the report form you\'ll see the "Photos" section. Tap the 📷 Add button to choose images from your gallery or camera. The system compresses them to max 1200px at JPEG quality 0.72 before saving. Tap a thumbnail to view full size, and ✕ to remove it.')},
      { h:HL('Incidente general de la comunidad','General community incident'),
        b:HL('Si el incidente no aplica a una unidad específica (por ejemplo, daño en área común o problema en la fachada), activa el interruptor "Incidente general de la comunidad". El formulario ocultará el selector de unidad. El incidente aparecerá en la sección 📢 Comunidad y los administradores serán notificados para asignarlo a una unidad o cerrarlo directamente.','If the incident doesn\'t apply to a specific unit (e.g. common area damage or facade issue), toggle "General community incident". The form hides the unit selector. The incident will appear in the 📢 Community section and admins will be notified to assign it to a unit or close it directly.')},
      { h:HL('Borrador automático','Auto-save draft'),
        b:HL('El formulario guarda automáticamente lo que escribes (unidad, tipo, categoría, descripción). Si cierras el formulario por accidente o navegas a otra sección, al volver a abrir "+ Reporte" verás un banner azul "Borrador restaurado" con el contenido que tenías. Haz clic en "Limpiar" para empezar desde cero.','The form automatically saves what you type (unit, type, category, description). If you close the form accidentally or navigate away, reopening "+ Report" shows a blue "Draft restored" banner with your previous content. Click "Clear" to start fresh.')},
      { h:HL('Categorías de gravedad','Severity categories'),
        b:HL('🚨 Serio: casos graves de atención prioritaria. 👁 En observación: situaciones a monitorear que pueden escalar. 📌 Menor: incidentes leves documentados como referencia futura. La categoría afecta las alertas que reciben los administradores.','🚨 Serious: critical cases requiring priority attention. 👁 Under watch: situations to monitor that may escalate. 📌 Minor: mild incidents documented as future reference. The category affects which alerts administrators receive.')},
    ]
  },
  {
    id:'workflow', icon:'🔄', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Ciclo de vida del incidente','Incident lifecycle'),
    summary:HL('Incidentes de unidad: 3 pasos. Incidentes generales: el admin asigna o cierra directamente.','Unit incidents: 3 steps. General incidents: admin assigns or closes directly.'),
    sections:[
      { h:HL('⚠️ Abierto — Paso 1 del propietario','⚠️ Open — Owner Step 1'),
        b:HL('El incidente se reporta. El propietario de la unidad debe: confirmar datos del huésped (nombre, ciudad, país) y documentar la acción inmediata tomada. El botón de acción rápida "① Verificar" aparece directamente en la tarjeta del incidente. Sin este paso el SLA sigue corriendo.','The incident is reported. The unit owner must: confirm guest details (name, city, country) and document the immediate action taken. The quick-action button "① Verify" appears directly on the incident card. Without this step the SLA keeps running.')},
      { h:HL('📝 Verificado — Paso 2 del propietario','📝 Verified — Owner Step 2'),
        b:HL('Completado el Paso 1, el propietario debe agregar la resolución: cómo se resolvió (contactó al huésped, coordinó con el operador, reportó a Airbnb, etc.). El botón "② Agregar respuesta" aparece en la tarjeta. Sin este paso el admin no puede cerrar.','After Step 1 the owner must add their resolution: how it was handled (contacted guest, coordinated with operator, reported to Airbnb, etc.). The "② Add resolution" button appears on the card. Without this step admin cannot close.')},
      { h:HL('⏳ Esperando al admin','⏳ Awaiting admin close'),
        b:HL('El propietario completó ambos pasos. El administrador recibe notificación y puede revisar la documentación completa (incluyendo fotos) en el detalle del incidente antes de cerrarlo formalmente con sus comentarios.','Owner completed both steps. Admin receives a notification and can review the complete documentation (including photos) in the incident detail before formally closing it with their comments.')},
      { h:HL('✓ Cerrado','✓ Closed'),
        b:HL('Un administrador global, delegado autorizado, o admin de comunidad con permiso "Resolver incidentes" cierra el incidente con comentarios finales. Todos los involucrados — propietario, operador, quien reportó y los admins — reciben un aviso automático por email. El incidente queda en el historial permanente.','A global admin, authorized delegate, or community admin with "Resolve incidents" permission closes the incident with final comments. Everyone involved — owner, operator, reporter, and admins — receives an automatic email. The incident remains in the permanent history.')},
      { h:HL('Incidentes generales — flujo del admin','General incidents — admin workflow'),
        b:HL('Los incidentes generales no pasan por los Pasos 1 y 2 del propietario. El administrador puede: (A) "Asignar a unidad" — el incidente se convierte en un incidente normal de unidad y el propietario recibe notificación para completar los Pasos 1 y 2; o (B) "Cerrar directamente" — el admin documenta la acción tomada y la resolución, y el incidente se cierra.','General incidents don\'t go through owner Steps 1 and 2. The administrator can: (A) "Assign to unit" — the incident becomes a normal unit incident and the owner is notified to complete Steps 1 and 2; or (B) "Close directly" — the admin documents the action taken and resolution, and the incident is closed.')},
    ]
  },
  {
    id:'detail', icon:'🔍', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Ver detalles de un incidente','Viewing incident details'),
    summary:HL('Haz clic en cualquier incidente para ver historial completo, fotos y tomar acciones.','Click any incident to see the full history, photos, and take actions.'),
    sections:[
      { h:HL('Abrir el detalle desde cualquier pantalla','Opening detail from any screen'),
        b:HL('Haz clic en la fila del incidente (o en el botón "Detalles ›") desde Incidentes, Dashboard, Mis Unidades, Alertas o Comunidad. Se abre un panel con: estado coloreado, tipo/categoría/fecha, fotos adjuntas, línea de tiempo con todos los eventos y acciones disponibles.','Click the incident row (or the "Details ›" button) from Incidents, Dashboard, My Units, Alerts, or Community. A panel opens with: coloured status, type/category/date, attached photos, a timeline of all events, and available actions.')},
      { h:HL('Fotos en el detalle','Photos in the detail'),
        b:HL('Las fotos adjuntas al incidente aparecen como miniaturas debajo de la descripción. Haz clic en cualquier miniatura para verla a tamaño completo en una nueva pestaña. Las fotos quedan guardadas permanentemente con el incidente.','Photos attached to the incident appear as thumbnails below the description. Click any thumbnail to view it full size in a new tab. Photos are permanently saved with the incident.')},
      { h:HL('Acciones directas en la tarjeta','Direct actions on the card'),
        b:HL('Sin necesidad de abrir el detalle completo, los botones de acción rápida aparecen directamente en la tarjeta del incidente: "① Verificar" (Paso 1 del propietario), "② Agregar respuesta" (Paso 2), "Cerrar" (admin). Esto facilita la gestión desde cualquier lista.','Without opening the full detail, quick-action buttons appear directly on the incident card: "① Verify" (owner Step 1), "② Add resolution" (Step 2), "Close" (admin). This makes management easy from any list.')},
    ]
  },
  {
    id:'community', icon:'📢', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Incidentes generales — Comunidad','General incidents — Community'),
    summary:HL('Incidentes que afectan el edificio o áreas comunes, sin unidad específica.','Incidents affecting the building or common areas, without a specific unit.'),
    sections:[
      { h:HL('¿Qué es un incidente general?','What is a general incident?'),
        b:HL('Es un incidente que afecta el edificio, las áreas comunes o la comunidad en general y no puede atribuirse a una unidad específica. Ejemplos: daño en lobby, problema en parqueadero, incidente en piscina, vandalismo en fachada.','An incident that affects the building, common areas, or the community and cannot be attributed to a specific unit. Examples: lobby damage, parking issue, pool incident, facade vandalism.')},
      { h:HL('Cómo reportar uno','How to report one'),
        b:HL('Abre el formulario "+ Reporte" y activa el interruptor "Este es un incidente general de la comunidad". El campo de unidad desaparece. Completa categoría, tipo, descripción y fotos (opcional) como de costumbre. El incidente aparece en 📢 Comunidad y los admins son notificados.','Open the "+ Report" form and toggle "This is a general community incident". The unit field disappears. Complete category, type, description, and photos (optional) as usual. The incident appears in 📢 Community and admins are notified.')},
      { h:HL('Sección 📢 Comunidad','📢 Community section'),
        b:HL('Todos los usuarios aprobados pueden ver la sección Comunidad en el menú. Muestra los incidentes generales abiertos con su estado, descripción y fotos. Los cerrados se pueden ver con el botón "▼ Ver cerrados".','All approved users can see the Community section in the menu. It shows open general incidents with their status, description, and photos. Closed ones can be viewed with the "▼ Show closed" button.')},
      { h:HL('Acciones del administrador','Administrator actions'),
        b:HL('Los administradores globales, delegados con permiso "Resolver incidentes", y admins de comunidad con ese permiso pueden actuar: 🏠 "Asignar a unidad" — elige la unidad responsable y el incidente entra al flujo normal (el propietario recibirá el Paso 1 y Paso 2); ✓ "Cerrar directamente" — el admin documenta la acción tomada y la resolución sin asignar a ninguna unidad.','Global admins, delegates with "Resolve incidents" permission, and community admins with that permission can act: 🏠 "Assign to unit" — choose the responsible unit and the incident enters the normal flow (owner gets Step 1 and Step 2); ✓ "Close directly" — the admin documents the action and resolution without assigning to any unit.')},
    ]
  },
  {
    id:'search', icon:'🔎', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Buscar y filtrar incidentes','Search & filter incidents'),
    summary:HL('Busca por texto y filtra por rango de fechas en la vista de Incidentes.','Search by text and filter by date range in the Incidents view.'),
    sections:[
      { h:HL('Búsqueda de texto','Text search'),
        b:HL('La barra de búsqueda en la parte superior de Incidentes filtra en tiempo real por: unidad, propietario, operador, descripción, tipo, quien reportó, nombre/ciudad/país del huésped (datos iniciales y verificados). Escribe cualquier término para filtrar.','The search bar at the top of Incidents filters in real time by: unit, owner, operator, description, type, reporter, guest name/city/country (both initial and verified data). Type any term to filter.')},
      { h:HL('Filtro por rango de fechas','Date range filter'),
        b:HL('Junto a la búsqueda de texto hay dos campos de fecha (Desde – Hasta). Selecciona un rango para ver solo los incidentes ocurridos en esas fechas. Puedes combinar búsqueda de texto y rango de fechas al mismo tiempo. Haz clic en ✕ para limpiar las fechas.','Next to the text search are two date fields (From – To). Select a range to see only incidents that occurred in those dates. You can combine text search and date range at the same time. Click ✕ to clear the dates.')},
      { h:HL('Filtros de estado y categoría','Status and category filters'),
        b:HL('Además de la búsqueda, puedes filtrar por estado (Abierto, Verificado, Cerrado), categoría (Serio, En observación, Menor) y alcance (Mis reportes, Mis unidades, Pendientes de resolución). Los filtros se combinan entre sí.','In addition to search, you can filter by status (Open, Verified, Closed), category (Serious, Watch, Minor), and scope (My reports, My units, Pending resolution). Filters combine with each other.')},
    ]
  },
  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  {
    id:'notifications', icon:'🔔', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Alertas y notificaciones','Alerts and notifications'),
    summary:HL('Avisos automáticos por email y en la app. Agrupados por incidente para fácil seguimiento.','Automatic alerts by email and in the app. Grouped by incident for easy tracking.'),
    sections:[
      { h:HL('¿Cuándo recibes avisos?','When do you receive alerts?'),
        b:HL('Recibes avisos cuando: se reporta un incidente en tu unidad, el incidente avanza de estado (verificado, respuesta agregada, cerrado), tu registro es aprobado o rechazado, o el SLA vence. Los avisos llegan al email y aparecen en la campana 🔔.','You receive alerts when: an incident is reported in your unit, the incident changes status (verified, resolution added, closed), your registration is approved or declined, or the SLA expires. Alerts go to your email and appear in the bell 🔔.')},
      { h:HL('Avisos agrupados por incidente','Alerts grouped by incident'),
        b:HL('En la sección Alertas, los avisos aparecen agrupados por incidente. Cada grupo muestra la descripción del incidente, cuántos avisos sin leer hay y un botón "Ver incidente ›" para abrir el detalle directamente. Los grupos con avisos sin leer se abren automáticamente; los leídos aparecen colapsados.','In the Alerts section, notifications are grouped by incident. Each group shows the incident description, how many unread alerts there are, and a "View incident ›" button to open the detail directly. Groups with unread alerts open automatically; read ones appear collapsed.')},
      { h:HL('Acciones prioritarias en la campana','Priority actions in the bell'),
        b:HL('Arriba en Alertas (y en la campana) aparecen las acciones prioritarias: incidentes que requieren tu Paso 1 o Paso 2, registros por aprobar, avisos sin leer. Haz clic en una acción para ir directamente a la pantalla correcta.','At the top of Alerts (and in the bell) priority actions appear: incidents requiring your Step 1 or Step 2, registrations to approve, unread alerts. Click an action to go directly to the right screen.')},
      { h:HL('Notificaciones por email','Email notifications'),
        b:HL('Cada evento genera un email automático a todos los involucrados: propietario, operador, quien reportó, administrador global, administradores delegados autorizados, y admins de comunidad registrados en la DB. Los emails se enrutan por comunidad: los admins de tu comunidad reciben las notificaciones de tu comunidad automáticamente. El routing de emails es configurable desde Admin → Enrutamiento de emails.','Each event generates an automatic email to everyone involved: owner, operator, reporter, global admin, authorized delegate admins, and community admins registered in the DB. Emails are routed by community: your community\'s admins automatically receive notifications for your community. Email routing is configurable from Admin → Email Routing.')},
    ]
  },
  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  {
    id:'dashboard', icon:'📊', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Dashboard','Dashboard'),
    summary:HL('Vista rápida del estado de la comunidad y tus incidentes que requieren atención.','Quick view of community status and your incidents requiring attention.'),
    sections:[
      { h:HL('Sección "Requiere tu atención"','"Needs your attention" section'),
        b:HL('Si tienes incidentes pendientes en tus unidades, el Dashboard muestra una tarjeta roja "Requiere tu atención" con dos grupos: "⚠️ Paso 1 — Verificar" (incidentes abiertos) y "📝 Paso 2 — Agregar respuesta" (incidentes verificados sin resolución). Haz clic en cualquier incidente para actuar.','If you have pending incidents in your units, the Dashboard shows a red "Needs your attention" card with two groups: "⚠️ Step 1 — Verify" (open incidents) and "📝 Step 2 — Add resolution" (verified incidents without resolution). Click any incident to act.')},
      { h:HL('Estadísticas de la comunidad','Community statistics'),
        b:HL('Cuatro métricas clave: Unidades registradas, Reportes abiertos, Respuesta pendiente (Paso 2 pendiente) y Cerrados. Haz clic en las tarjetas de Abiertos o Respuesta pendiente para ir directamente a la vista filtrada de Incidentes.','Four key metrics: Registered units, Open reports, Pending resolution (Step 2 pending), and Closed. Click the Open or Pending resolution cards to go directly to the filtered Incidents view.')},
      { h:HL('Actividad reciente','Recent activity'),
        b:HL('La sección "Actividad reciente de incidentes" muestra los 5 incidentes más recientes con estado, tipo y descripción. Haz clic en cualquiera para ver el detalle completo.','The "Recent incident activity" section shows the 5 most recent incidents with status, type, and description. Click any to see the full detail.')},
    ]
  },
  // ── SLA ───────────────────────────────────────────────────────────────────
  {
    id:'sla', icon:'⏱️', category:'incidents', roles:['delegate_admin','global_admin'],
    title:HL('SLA y recordatorios','SLA and reminders'),
    summary:HL('Recordatorios automáticos para incidentes de unidad e incidentes generales sin asignar.','Automatic reminders for unit incidents and unassigned general incidents.'),
    sections:[
      { h:HL('¿Cómo funciona el SLA?','How does SLA work?'),
        b:HL('Cada incidente tiene un temporizador SLA (por defecto 24h, configurable desde Admin → SLA y escalaciones). El temporizador corre mientras el propietario no complete el Paso 1 y el Paso 2. Una vez ambos pasos completados, el temporizador se detiene. El contador "SLA" en la tarjeta muestra cuántos ciclos se han enviado.','Each incident has an SLA timer (default 24h, configurable from Admin → SLA & Escalations). The timer runs until the owner completes Step 1 and Step 2. Once both steps are complete the timer stops. The "SLA" counter on the card shows how many cycles have been sent.')},
      { h:HL('Recordatorios a propietario, operador y admins','Reminders to owner, operator, and admins'),
        b:HL('Cuando el SLA vence, el sistema notifica automáticamente al propietario, operador, administrador global, delegados autorizados, y admins de comunidad con permiso "Resolver incidentes". Todos reciben el contexto del incidente y el paso pendiente. El routing es configurable desde Admin → Enrutamiento de emails.','When SLA expires, the system automatically notifies the owner, operator, global admin, authorized delegates, and community admins with "Resolve incidents" permission. All receive the incident context and the pending step. Routing is configurable from Admin → Email Routing.')},
      { h:HL('SLA de incidentes generales','SLA for general incidents'),
        b:HL('Los incidentes generales sin asignar a una unidad también tienen SLA. Cuando vence, el sistema notifica al administrador global y delegados autorizados para que asignen el incidente a una unidad o lo cierren directamente. El tipo de email "incident_general_sla" es configurable.','Unassigned general incidents also have SLA. When it expires, the system notifies the global admin and authorized delegates to assign the incident to a unit or close it directly. The "incident_general_sla" email type is configurable.')},
    ]
  },
  // ── ADMIN ─────────────────────────────────────────────────────────────────
  {
    id:'roles_reference', icon:'👤', category:'admin', roles:['global_admin','delegate_admin'],
    title:HL('Referencia de roles y permisos','Roles & permissions reference'),
    summary:HL('Los 4 roles de la plataforma, su alcance y capacidades en un entorno multi-comunidad.','The 4 platform roles, their scope, and capabilities in a multi-community environment.'),
    sections:[
      { h:HL('🏠 Propietario (usuario estándar)','🏠 Standard Owner (default user)'),
        b:HL('Alcance: una o más unidades en una comunidad específica. Capacidades: registrar y gestionar sus propias unidades, reportar incidentes en unidades de otras personas, ver el estado de sus propios incidentes (Paso 1 y Paso 2), recibir notificaciones automáticas. No puede ver incidentes de otras unidades ni datos de otros propietarios. No puede aprobar registros ni gestionar la comunidad. Este es el rol predeterminado cuando un usuario se registra.','Scope: one or more units in a specific community. Capabilities: register and manage their own units, report incidents on other units, view the status of their own incidents (Step 1 and Step 2), receive automatic notifications. Cannot see incidents on other units or other owners\' data. Cannot approve registrations or manage the community. This is the default role when a user registers.')},
      { h:HL('🏢 Admin de comunidad','🏢 Community Admin'),
        b:HL('Alcance: una o más comunidades específicas (no todas). Asignado desde Admin → Comunidades → Miembros. Capacidades configurables individualmente por comunidad: ✅ Aprobar registros: ver y aprobar/rechazar solicitudes pendientes en su comunidad, ✅ Resolver incidentes: cerrar incidentes en su comunidad con comentario final, ✅ Gestionar listings: editar y eliminar unidades de otros propietarios en su comunidad. Los admins de comunidad reciben automáticamente los emails de notificación de su comunidad. No tienen acceso al panel Admin completo — solo ven la sección de configuración de su comunidad.','Scope: one or more specific communities (not all). Assigned from Admin → Communities → Members. Configurable permissions per community: ✅ Approve registrations: view and approve/decline pending registrations in their community, ✅ Resolve incidents: close incidents in their community with final comment, ✅ Manage listings: edit and delete other owners\' units in their community. Community admins automatically receive email notifications for their community. They do not have access to the full Admin panel — they only see their community\'s settings section.')},
      { h:HL('🛡️ Admin delegado','🛡️ Delegate Admin'),
        b:HL('Alcance: toda la plataforma (todas las comunidades). Asignado en la base de datos (campo role en app_users). Capacidades: definidas por permisos individuales configurables por el admin global desde Admin → Permisos. Los permisos disponibles son: Aprobar registros, Resolver incidentes, Actualizar listings de otros, Eliminar listings de otros, Actualizar incidentes de otros, Eliminar incidentes de otros. Los admins delegados tienen acceso a todas las comunidades y aparecen en los emails de escalación. Útil para staff de soporte que gestiona múltiples comunidades.','Scope: entire platform (all communities). Assigned in the database (role field in app_users). Capabilities: defined by individual permissions configured by the global admin from Admin → Permissions. Available permissions: Approve registrations, Resolve incidents, Update others\' listings, Delete others\' listings, Update others\' incidents, Delete others\' incidents. Delegate admins have access to all communities and appear in escalation emails. Useful for support staff managing multiple communities.')},
      { h:HL('🌐 Admin global','🌐 Global Admin'),
        b:HL('Alcance: toda la plataforma sin restricciones. Asignado mediante la variable de entorno GLOBAL_ADMIN_EMAILS en el servidor (no se puede cambiar desde la UI). Capacidades: acceso completo a todas las comunidades, todos los datos, y todas las secciones del panel Admin. Puede: crear/editar/eliminar comunidades, aprobar o rechazar registros en cualquier comunidad, promover admins de comunidad, configurar permisos de admins delegados, editar plantillas de email, configurar branding por comunidad, y más. El rol de admin global tiene precedencia sobre cualquier otro rol.','Scope: entire platform with no restrictions. Assigned via the GLOBAL_ADMIN_EMAILS environment variable on the server (cannot be changed from the UI). Capabilities: full access to all communities, all data, and all Admin panel sections. Can: create/edit/delete communities, approve or reject registrations in any community, promote community admins, configure delegate admin permissions, edit email templates, configure per-community branding, and more. The global admin role takes precedence over any other role.')},
      { h:HL('Comparación de alcance en multi-comunidad','Scope comparison in multi-community setup'),
        b:HL('Propietario → solo su comunidad, solo sus unidades. Admin de comunidad → su(s) comunidad(es) asignada(s), todos los propietarios de esa comunidad. Admin delegado → todas las comunidades, según permisos. Admin global → todas las comunidades, sin restricciones. Un usuario puede ser Propietario estándar en una comunidad y Admin de comunidad en otra simultáneamente.','Owner → their community only, their units only. Community admin → their assigned community/communities, all owners in that community. Delegate admin → all communities, per their permissions. Global admin → all communities, no restrictions. A user can be a Standard Owner in one community and Community Admin in another at the same time.')},
    ]
  },
  {
    id:'admin_nav', icon:'⚙️', category:'admin', roles:['global_admin'],
    title:HL('Admin — Navegación y roles','Admin — Navigation & roles'),
    summary:HL('Personalizar el orden del menú, la página de inicio y los permisos por rol.','Customize menu order, default landing page, and permissions per role.'),
    sections:[
      { h:HL('Configurar orden de navegación','Configure navigation order'),
        b:HL('En Admin → Navegación y página de inicio, selecciona el rol (Propietario, Admin Delegado, Admin Global) y marca qué secciones aparecen en la barra superior. Usa las flechas ↑↓ para reordenar. Las secciones no marcadas van al menú "Más ▾".','In Admin → Navigation & Landing, select the role (Owner, Delegate Admin, Global Admin) and check which sections appear in the top bar. Use ↑↓ arrows to reorder. Unchecked sections go to "More ▾" menu.')},
      { h:HL('Página de inicio por rol','Default landing page per role'),
        b:HL('Para cada rol, selecciona la página de inicio predeterminada. El valor predeterminado de fábrica es "Incidentes" para todos los roles. Este valor se aplica al ingresar a la app sin URL específica, después de que la configuración del servidor se carga completamente.','For each role, select the default landing page. The factory default is "Incidents" for all roles. This applies when signing in without a specific URL, after the server configuration loads completely.')},
      { h:HL('Enrutamiento de emails','Email routing'),
        b:HL('En Admin → Enrutamiento de emails puedes activar/desactivar cada tipo de email y elegir quién lo recibe (propietario, operador, quien reportó, admin global, admin delegado). Los admins de comunidad registrados en la base de datos reciben automáticamente las notificaciones de su comunidad. Los cambios aplican de inmediato.','In Admin → Email Routing you can enable/disable each email type and choose who receives it (owner, operator, reporter, global admin, delegate admin). Community admins registered in the database automatically receive notifications for their community. Changes apply immediately.')},
      { h:HL('Panel de Comunidades (🌐)','Communities panel (🌐)'),
        b:HL('En Admin → Comunidades puedes crear y gestionar comunidades/edificios independientes. Cada comunidad tiene: ID único (slug), nombre en español e inglés, torre, ciudad, país, logo, fondo, y estado activo/inactivo. Los datos de cada comunidad (unidades, incidentes, registros) son completamente independientes entre sí.','In Admin → Communities you can create and manage independent communities/buildings. Each community has: a unique ID (slug), name in Spanish and English, tower, city, country, logo, background, and active/inactive status. Data for each community (units, incidents, registrations) is fully isolated.')},
      { h:HL('Admins de comunidad y permisos','Community admins and permissions'),
        b:HL('Dentro de cada comunidad puedes expandir el panel de Miembros para agregar usuarios aprobados como "Admin comunidad". Los admins de comunidad tienen 3 permisos configurables por checkbox: ✅ Aprobar registros (pueden ver y aprobar/rechazar registros pendientes), ✅ Resolver incidentes (pueden cerrar incidentes en su comunidad), ✅ Gestionar listings (pueden editar y eliminar listings de otros propietarios en su comunidad). Los permisos defecto son: Aprobar ✓, Resolver ✓, Gestionar ✗.','Inside each community you can expand the Members panel to add approved users as "Community Admin". Community admins have 3 configurable permissions via checkbox: ✅ Approve registrations (can view and approve/decline pending registrations), ✅ Resolve incidents (can close incidents in their community), ✅ Manage listings (can edit and delete other owners\' listings in their community). Default permissions: Approve ✓, Resolve ✓, Manage ✗.')},
    ]
  },
  {
    id:'communities', icon:'🌐', category:'admin', roles:['global_admin'],
    title:HL('Multi-comunidad (multi-tenant)','Multi-community (multi-tenant)'),
    summary:HL('Cómo funciona el soporte para múltiples comunidades/edificios independientes.','How support for multiple independent communities/buildings works.'),
    sections:[
      { h:HL('¿Qué es una comunidad?','What is a community?'),
        b:HL('Una comunidad es una instancia aislada de la app: sus propios listings, incidentes, registros, configuración de branding y equipo de administración. Un mismo servidor y base de datos puede alojar varias comunidades simultáneamente. Los usuarios son asignados a una comunidad mediante membresía en la tabla community_memberships.','A community is an isolated instance of the app: its own listings, incidents, registrations, branding configuration, and admin team. A single server and database can host multiple communities simultaneously. Users are assigned to a community via membership in the community_memberships table.')},
      { h:HL('Crear una nueva comunidad','Creating a new community'),
        b:HL('Ve a Admin → Comunidades → "+ Nueva comunidad". Define el ID (slug corto, ej. "playa-01"), nombre en español e inglés, torre o nombre del edificio, ciudad y país. Opcionalmente agrega URL de logo y fondo. Activa la comunidad para que los usuarios puedan ser asignados a ella. El ID no se puede cambiar después de crear.','Go to Admin → Communities → "+ New community". Define the ID (short slug, e.g. "beach-01"), name in Spanish and English, tower or building name, city, and country. Optionally add logo and background URLs. Activate the community so users can be assigned to it. The ID cannot be changed after creation.')},
      { h:HL('Ver miembros de una comunidad','Viewing community members'),
        b:HL('Expande el panel 👥 Miembros en la comunidad. Se muestran automáticamente todos los propietarios con registro aprobado en esa comunidad. No es necesario agregar miembros manualmente — los registros aprobados son la membresía.','Expand the 👥 Members panel on the community. All owners with an approved registration in that community are shown automatically. No need to add members manually — approved registrations are the membership.')},
      { h:HL('Promover a admin de comunidad','Promoting a community admin'),
        b:HL('En el panel de miembros, activa el checkbox "Admin comunidad" junto al nombre del propietario para darle permisos de administración. Desactívalo para quitarle el rol. Los propietarios aprobados pueden ser admins de múltiples comunidades.','In the members panel, check the "Community Admin" checkbox next to an owner\'s name to grant admin rights. Uncheck it to remove the role. Approved owners can be admins of multiple communities.')},
      { h:HL('Permisos del admin de comunidad','Community admin permissions'),
        b:HL('Cuando un miembro tiene "Admin comunidad" activado, aparecen 3 checkboxes de permisos: Aprobar registros, Resolver incidentes, Gestionar listings. Marca los permisos necesarios y haz clic en "Guardar permisos". Los permisos defecto son: Aprobar ✓, Resolver ✓, Gestionar ✗. Los cambios aplican de inmediato.','When a member has "Community Admin" checked, 3 permission checkboxes appear: Approve registrations, Resolve incidents, Manage listings. Check the required permissions and click "Save perms". Default permissions are: Approve ✓, Resolve ✓, Manage ✗. Changes apply immediately.')},
      { h:HL('Enrutamiento de emails por comunidad','Community-scoped email routing'),
        b:HL('Los admins de comunidad reciben automáticamente los emails de notificación de su comunidad (incidentes, registros, SLA) sin configuración manual. El sistema consulta la tabla community_memberships en cada envío. Si una comunidad no tiene admins registrados en la DB, el sistema usa la lista de escalación de app_config como respaldo.','Community admins automatically receive notification emails for their community (incidents, registrations, SLA) without manual configuration. The system queries community_memberships on each send. If a community has no admins registered in the DB, the system falls back to the app_config escalation list.')},
    ]
  },
  {
    id:'admin_labels', icon:'🏷️', category:'admin', roles:['global_admin'],
    title:HL('Admin — Etiquetas, tooltips y auditoría','Admin — Labels, tooltips & audit'),
    summary:HL('Personalizar textos de la interfaz y revisar el historial completo de actividad.','Customize interface texts and review the complete activity history.'),
    sections:[
      { h:HL('Etiquetas de UI','UI Labels'),
        b:HL('En Admin → Etiquetas de la interfaz puedes cambiar cualquier texto de la app (títulos, botones, mensajes) en español e inglés, organizados por sección de página. Los cambios aplican de inmediato sin redesplegar. Un punto verde indica etiquetas modificadas.','In Admin → UI Labels you can change any app text (titles, buttons, messages) in Spanish and English, organized by page section. Changes apply immediately without redeploying. A green dot indicates modified labels.')},
      { h:HL('Tooltips personalizables','Customizable tooltips'),
        b:HL('En Admin → Tooltips puedes editar los textos de ayuda que aparecen al pasar el cursor sobre los íconos de información (ⓘ) en los formularios. Afectan el formulario de registro de unidad y el formulario de reporte de incidente.','In Admin → Tooltips you can edit the help texts that appear when hovering over info icons (ⓘ) in forms. They affect the unit registration form and the incident report form.')},
      { h:HL('Log de auditoría (🕵️)','Audit log (🕵️)'),
        b:HL('En Admin → Log de auditoría puedes ver el historial completo de actividad: creación y edición de listings, creación y resolución de incidentes, cambios de roles de usuario, cambios de configuración. Filtra por entidad (listing, incident, user_role…), email del actor y rango de fechas. La vista muestra hasta 50 entradas por página con paginación y botón "diff" para ver los cambios exactos.','In Admin → Audit Log you can see the complete activity history: listing creation and edits, incident creation and resolution, user role changes, configuration changes. Filter by entity (listing, incident, user_role…), actor email, and date range. The view shows up to 50 entries per page with pagination and a "diff" button to see the exact changes.')},
    ]
  },
];

// ─── HELP ACTIONS (topic-id → CTA buttons) ────────────────────────────────────
// Each action: { label:HL(), icon, primary, fn(handlers) }
// handlers = { setView, onReport, onAddListing, setQuickFilter }
export const HELP_ACTIONS = {
  start:        [{ label:HL('Ver mis propiedades','View my listings'),           icon:'🏠', primary:true,  fn:h=>h.setView('my') }],
  navigation:   [{ label:HL('Mis Unidades','My Units'),                         icon:'🔑', primary:true,  fn:h=>h.setView('my') },
                 { label:HL('Ver Comunidad','View Community'),                  icon:'📢', primary:false, fn:h=>h.setView('general') }],
  units:        [{ label:HL('Mis propiedades','My listings'),                   icon:'🔑', primary:true,  fn:h=>h.setView('my') },
                 { label:HL('Agregar apartamento','Add apartment'),             icon:'➕', primary:false, fn:h=>h.onAddListing() }],
  incidents:    [{ label:HL('Reportar incidente','Report incident'),            icon:'⚠️', primary:true,  fn:h=>h.onReport() },
                 { label:HL('Ver todos los reportes','View all reports'),       icon:'📋', primary:false, fn:h=>h.setView('incidents') }],
  workflow:     [{ label:HL('Ver reportes','View reports'),                     icon:'📋', primary:true,  fn:h=>h.setView('incidents') }],
  detail:       [{ label:HL('Ver incidentes','View incidents'),                 icon:'⚠️', primary:true,  fn:h=>h.setView('incidents') }],
  community:    [{ label:HL('Ver Comunidad','View Community'),                  icon:'📢', primary:true,  fn:h=>h.setView('general') },
                 { label:HL('Reportar incidente general','Report general incident'), icon:'➕', primary:false, fn:h=>h.onReport() }],
  search:       [{ label:HL('Ir a Incidentes','Go to Incidents'),               icon:'⚠️', primary:true,  fn:h=>h.setView('incidents') }],
  verify:       [{ label:HL('Ver mis pendientes de verificación','View my pending verifications'), icon:'✅', primary:true, fn:h=>{ h.setQuickFilter('ownerVerification'); h.setView('incidents'); } }],
  notifications:[{ label:HL('Ver mis avisos','View my alerts'),                 icon:'🔔', primary:true,  fn:h=>h.setView('notifications') }],
  dashboard:    [{ label:HL('Ver Dashboard','View Dashboard'),                  icon:'📊', primary:true,  fn:h=>h.setView('dashboard') }],
  smart:        [{ label:HL('Ver avisos','View alerts'),                        icon:'🔔', primary:true,  fn:h=>h.setView('notifications') }],
  resolve:      [{ label:HL('Ver listos para resolver','View ready to resolve'),icon:'🛠️', primary:true,  fn:h=>{ h.setQuickFilter('requiresResolution'); h.setView('incidents'); } }],
  approvals:    [{ label:HL('Ir a registros','Go to registrations'),            icon:'📝', primary:true,  fn:h=>h.setView('approvals') }],
  users:        [{ label:HL('Gestionar usuarios','Manage users'),               icon:'👥', primary:true,  fn:h=>h.setView('admin') }],
  sla:          [{ label:HL('Ir a configuración','Go to Admin settings'),       icon:'⚙️', primary:true,  fn:h=>h.setView('admin') }],
  admin_nav:    [{ label:HL('Ir a Admin','Go to Admin'),                        icon:'⚙️', primary:true,  fn:h=>h.setView('admin') }],
  admin_labels: [{ label:HL('Ir a Admin','Go to Admin'),                        icon:'⚙️', primary:true,  fn:h=>h.setView('admin') }],
  communities:  [{ label:HL('Ir a Comunidades','Go to Communities'),            icon:'🌐', primary:true,  fn:h=>h.setView('admin') }],
  settings:     [{ label:HL('Ir a configuración','Go to Admin settings'),       icon:'⚙️', primary:true,  fn:h=>h.setView('admin') }],
  analytics:    [{ label:HL('Ver analíticas','View analytics'),                 icon:'📊', primary:true,  fn:h=>h.setView('analytics') }],
  viewas:       [{ label:HL('Abrir menú "Más"','Open the "More" menu'),         icon:'👁️', primary:false, fn:h=>h.openMore() }],
};
