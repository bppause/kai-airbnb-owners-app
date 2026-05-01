import { useState, useEffect, useRef, useCallback, Component } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "firebase/auth";

// ─── FIREBASE CONFIG — replace with your own from Firebase Console ────────────
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseReady = Object.values(FIREBASE_CONFIG).every(Boolean);
let firebaseApp = null;
let auth = null;
let provider = null;
try {
  if (firebaseReady) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(firebaseApp);
    provider = new GoogleAuthProvider();
    // Always show Google account chooser so users can switch accounts on shared devices.
    provider.setCustomParameters({ prompt: "select_account" });
  } else {
    console.warn('[KAI_FIREBASE_CONFIG_MISSING]', Object.keys(FIREBASE_CONFIG).filter(k => !FIREBASE_CONFIG[k]));
  }
} catch (e) {
  console.error('[KAI_FIREBASE_INIT_ERROR]', e);
}

// Global client logging: prevents silent blank screens and records the last runtime issue.
window.addEventListener("error", (event) => {
  const payload = { section:"window.error", message:event?.message || "Unknown error", stack:event?.error?.stack || "", ts:new Date().toISOString() };
  console.error("[KAI_WINDOW_ERROR]", payload);
  try { localStorage.setItem("kai_last_ui_error", JSON.stringify(payload, null, 2)); } catch(e) {}
  try { fetch("/api/client-log", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }).catch(()=>{}); } catch(e) {}
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason || {};
  const payload = { section:"unhandledrejection", message:reason?.message || String(reason), stack:reason?.stack || "", ts:new Date().toISOString() };
  console.error("[KAI_UNHANDLED_REJECTION]", payload);
  try { localStorage.setItem("kai_last_ui_error", JSON.stringify(payload, null, 2)); } catch(e) {}
  try { fetch("/api/client-log", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }).catch(()=>{}); } catch(e) {}
});

const INCIDENT_TYPES = [
  { value:"noise",        label:"🔊 Ruido excesivo",           color:"#e65100", bg:"#fff3e0" },
  { value:"damage",       label:"💥 Daños al apartamento",     color:"#c62828", bg:"#fde8e4" },
  { value:"rules",        label:"📋 Incumplimiento de normas", color:"#6a1b9a", bg:"#f3e5f5" },
  { value:"payment",      label:"💳 Problemas de pago",        color:"#1565c0", bg:"#e3f2fd" },
  { value:"unauthorized", label:"🚫 Personas no autorizadas",  color:"#bf360c", bg:"#fbe9e7" },
  { value:"cleanliness",  label:"🧹 Suciedad / limpieza",      color:"#558b2f", bg:"#f1f8e9" },
  { value:"other",        label:"❓ Otro",                     color:"#37474f", bg:"#eceff1" },
];
const GUEST_CATEGORIES = [
  { value:"serious", label:"Incidente Grave",  icon:"⚠️", color:"#e65100", bg:"#ffe0b2" },
  { value:"watch",   label:"En Observación",   icon:"👁️", color:"#4527a0", bg:"#ede7f6" },
  { value:"minor",   label:"Incidente Menor",  icon:"📝", color:"#1565c0", bg:"#bbdefb" },
];
// ─── INCIDENT TEMPLATES ─────────────────────────────────────────────────────
// Short description templates shown when opening a new incident.
// Key format: `${type}_${category}`. Each entry has es + en versions.
const INCIDENT_TEMPLATES = {
  noise_serious: {
    es: "Huéspedes generando ruido extremo. Múltiples vecinos afectados. Se solicitó parar y continúa el problema.",
    en: "Guests generating extreme noise. Multiple neighbors affected. Requested to stop but the problem continues.",
  },
  noise_watch: {
    es: "Nivel de ruido por encima de lo permitido reportado por vecinos.",
    en: "Noise level above allowed limit reported by neighbors.",
  },
  noise_minor: {
    es: "Nivel de ruido ligeramente elevado en horario normal.",
    en: "Slightly elevated noise level during normal hours.",
  },
  damage_serious: {
    es: "Daños mayores al apartamento: muebles rotos, paredes rayadas, electrodomésticos dañados. Se requiere peritaje.",
    en: "Major damage to the apartment: broken furniture, scratched walls, damaged appliances. Expert assessment required.",
  },
  damage_watch: {
    es: "Daño moderado observado al salir el huésped. En proceso de evaluación con fotos.",
    en: "Moderate damage found upon guest checkout. Under assessment with photos.",
  },
  damage_minor: {
    es: "Pequeño daño (roto/rasgado/manchado). Sin impacto operacional inmediato.",
    en: "Minor damage (broken/torn/stained). No immediate operational impact.",
  },
  rules_serious: {
    es: "Incumplimiento grave de normas de convivencia: evento no autorizado, número de huéspedes excedido, o actividad prohibida.",
    en: "Serious breach of community rules: unauthorized event, guest count exceeded, or prohibited activity.",
  },
  rules_watch: {
    es: "Infracción de normas de convivencia observada. Propietario y operador notificados.",
    en: "Community rule infraction observed. Owner and operator notified.",
  },
  rules_minor: {
    es: "Norma menor incumplida (ej. basura no clasificada, uso indebido de amenidades).",
    en: "Minor rule not followed (e.g. unsorted trash, improper amenity use).",
  },
  payment_serious: {
    es: "Disputa de cobro iniciada por Airbnb o huésped. Posible reversión de pago. Requiere atención urgente.",
    en: "Payment dispute initiated by Airbnb or guest. Possible charge reversal. Urgent attention required.",
  },
  payment_watch: {
    es: "Pago pendiente o cuestionado por el huésped. En seguimiento con Airbnb.",
    en: "Payment pending or disputed by guest. Following up with Airbnb.",
  },
  payment_minor: {
    es: "Cargo menor en disputa. Caso abierto con soporte Airbnb.",
    en: "Minor charge in dispute. Support case opened with Airbnb.",
  },
  unauthorized_serious: {
    es: "Personas no autorizadas en el apartamento. Se requirió desalojo. Posible fiesta o subarrendamiento.",
    en: "Unauthorized persons in the apartment. Eviction requested. Possible party or sub-rental.",
  },
  unauthorized_watch: {
    es: "Personas adicionales no registradas en la reserva identificadas en las áreas comunes.",
    en: "Additional unregistered persons identified in common areas.",
  },
  unauthorized_minor: {
    es: "Posible visita no autorizada de corta duración. En verificación con el operador.",
    en: "Possible short unauthorized visit. Verifying with operator.",
  },
  cleanliness_serious: {
    es: "Apartamento en estado de suciedad extrema al final de la estadía. Requiere limpieza profunda y revisión de daños.",
    en: "Apartment in extremely dirty condition at end of stay. Deep cleaning and damage assessment required.",
  },
  cleanliness_watch: {
    es: "Problemas de limpieza moderados al salir el huésped. Servicio de limpieza extra requerido.",
    en: "Moderate cleanliness issues upon checkout. Extra cleaning service required.",
  },
  cleanliness_minor: {
    es: "Pequeñas observaciones de limpieza al final de la estadía (ropa de cama, cocina).",
    en: "Minor cleanliness notes at end of stay (bedding, kitchen).",
  },
  other_serious: {
    es: "Incidente grave que requiere atención inmediata: ",
    en: "Serious incident requiring immediate attention: ",
  },
  other_watch: {
    es: "Situación en observación que puede escalar: ",
    en: "Situation under observation that may escalate: ",
  },
  other_minor: {
    es: "Asunto menor registrado para seguimiento: ",
    en: "Minor matter recorded for follow-up: ",
  },
};

const COUNTRIES = ["Colombia","USA","Venezuela","Ecuador","Perú","México","Brasil","España","Argentina","Chile","Panamá","Costa Rica","Canadá","UK","Francia","Alemania","Italia","Otro"];
const LANGS = { "es-CO": { label:"Español 🇨🇴", short:"ES" }, en:{ label:"English 🇺🇸", short:"EN" } };

const DEFAULT_STANDARD_MENU_PERMISSIONS = { dashboard:true, listings:true, incidents:true, notifications:true, about:true, my:true, analytics:false };
const DEFAULT_DELEGATE_PERMISSIONS = { canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:false, canDeleteGlobalListings:false, canUpdateGlobalIncidents:false, canDeleteGlobalIncidents:false };
const PERMISSION_LABELS = {
  canApproveRegistrations: { es:'Aprobar / rechazar registros', en:'Approve / deny registrations' },
  canResolveIncidents: { es:'Resolver incidentes con comentarios', en:'Resolve incidents with comments' },
  canUpdateGlobalListings: { es:'Editar listings globales', en:'Edit global listings' },
  canDeleteGlobalListings: { es:'Eliminar listings globales', en:'Delete global listings' },
  canUpdateGlobalIncidents: { es:'Actualizar incidentes globales', en:'Update global incidents' },
  canDeleteGlobalIncidents: { es:'Eliminar incidentes globales', en:'Delete global incidents' },
};
const MENU_LABELS = {
  dashboard:{es:'Dashboard',en:'Dashboard'}, listings:{es:'Apartamentos',en:'Apartments'}, incidents:{es:'Reportes',en:'Reports'}, notifications:{es:'Avisos',en:'Alerts'}, about:{es:'Misión',en:'Mission'}, my:{es:'Mis propiedades',en:'My listings'}, analytics:{es:'Analíticas',en:'Analytics'}
};
const TXT = {
  "es-CO": {
    appName:"Propietarios Airbnb KAI", location:"Serena del Mar · Cartagena 🇨🇴", loginTitle:"Bienvenido a la Comunidad Morros KAI",
    loginSub:"Propietarios Airbnb KAI · Serena del Mar · Cartagena 🇨🇴",
    loginHero:"Estamos construyendo una comunidad de propietarios comprometidos con la excelencia en la operación, el cuidado de nuestras propiedades y una mejor experiencia para nuestros huéspedes.",
    rulesTitle:"📌 Normas de uso de la comunidad", firstAccess:"⏳ Primer acceso:", firstAccessText:"al iniciar sesión por primera vez deberás registrar al menos una propiedad. Tu solicitud quedará pendiente de aprobación antes de acceder a la plataforma.",
    secure:"🔐 Para proteger la información de la comunidad, primero debes iniciar sesión con Google.", google:"Continuar con Google",
    nav:{dashboard:"Dashboard",about:"Misión",listings:"Apartamentos",incidents:"Reportes",notifications:"Avisos",approvals:"Registros",admin:"Admin",analytics:"Analíticas",my:"Mis propiedades",help:"Ayuda"},
    cards:[['🏡','Gestión centralizada','Organizar apartamentos, contactos, emails de notificación y enlaces importantes en un solo lugar.'],['⚠️','Reportes transparentes','Documentar incidentes de manera rápida para que el propietario correcto reciba aviso y pueda tomar acción.'],['🤝','Colaboración comunitaria','Compartir información útil entre propietarios aprobados para operar mejor y prevenir problemas repetidos.'],['📊','Mejora continua','Usar datos y tendencias para elevar la calidad del servicio, la comunicación y la experiencia del huésped.']],
    rules:['Reporta incidentes con información clara, objetiva y verificable.','Usa la plataforma con respeto, responsabilidad y enfoque constructivo.','Evita contenido innecesario, ofensivo o no relacionado con la operación.','Colabora para proteger el valor de nuestras propiedades y mejorar el servicio.'],
    missionTitle:"🌊 Misión y normas de la comunidad", missionSub:"Referencia para propietarios aprobados · Propietarios Airbnb KAI", missionHeading:"Crear una comunidad organizada, informada y proactiva.", missionBody:"La aplicación ayuda a proteger el valor de nuestras propiedades, mejorar la coordinación entre propietarios y elevar la experiencia de los huéspedes en Morros KAI."
  },
  en: {
    appName:"KAI Airbnb Owners", location:"Serena del Mar · Cartagena 🇨🇴", loginTitle:"Welcome to the Morros KAI Community",
    loginSub:"KAI Airbnb Owners · Serena del Mar · Cartagena 🇨🇴",
    loginHero:"We are building a community of owners committed to operational excellence, property care, and a better guest experience.",
    rulesTitle:"📌 Community engagement rules", firstAccess:"⏳ First access:", firstAccessText:"when you sign in for the first time, you must register at least one property. Your request will remain pending approval before you can access the platform.",
    secure:"🔐 To protect community information, you must first sign in with Google.", google:"Continue with Google",
    nav:{dashboard:"Dashboard",about:"Mission",listings:"Apartments",incidents:"Reports",notifications:"Alerts",approvals:"Registrations",admin:"Admin",analytics:"Analytics",my:"My listings",help:"Help"},
    cards:[['🏡','Centralized management','Organize apartments, contacts, notification emails, and important links in one place.'],['⚠️','Transparent reports','Document incidents quickly so the correct owner receives notice and can take action.'],['🤝','Community collaboration','Share useful information among approved owners to operate better and prevent repeated issues.'],['📊','Continuous improvement','Use data and trends to improve service quality, communication, and guest experience.']],
    rules:['Report incidents with clear, objective, and verifiable information.','Use the platform respectfully, responsibly, and constructively.','Avoid unnecessary, offensive, or non-operational content.','Collaborate to protect property value and improve service.'],
    missionTitle:"🌊 Mission and community rules", missionSub:"Reference for approved owners · KAI Airbnb Owners", missionHeading:"Create an organized, informed, and proactive community.", missionBody:"The app helps protect the value of our properties, improve coordination among owners, and elevate the guest experience at Morros KAI."
  }
};
const getT = (lang) => TXT[lang] || TXT["es-CO"];

const UI={
'es-CO':{adminCouldNotLoad:'⚙️ Admin no pudo cargar',adminErrorHelp:'La página Admin encontró un error de interfaz. Esta versión muestra este mensaje en lugar de una pantalla en blanco.',reload:'Recargar',templatesEmpty:'No hay plantillas disponibles. Ejecuta el schema y revisa /api/health.'},
en:{adminCouldNotLoad:'⚙️ Admin could not load',adminErrorHelp:'The Admin page found an interface error. This message appears instead of a blank screen.',reload:'Reload',templatesEmpty:'No templates available. Run schema and check /api/health.'}
};
const ui=(lang,key)=>(UI[lang]||UI['es-CO'])[key]||UI['es-CO'][key]||key;


// v39 lightweight global i18n helper. Spanish (Colombia) remains the source language.
const I18N = {
  'Configuración global':'Global settings','Solo administradores globales · SLA, copias, misión y plantillas de email':'Global admins only · SLA, CC list, mission, and email templates',
  'SLA y escalaciones':'SLA and escalations','El recordatorio se repite cada ciclo hasta que el propietario verifique.':'The reminder repeats each cycle until the owner verifies.',
  'SLA en horas':'SLA in hours','Default: 24 horas.':'Default: 24 hours.','Emails en copia para escalaciones':'CC emails for escalations','Se copian en cada recordatorio SLA, además del propietario y operador.':'Copied on every SLA reminder, in addition to the owner and operator.',
  'Visibilidad de analíticas':'Analytics visibility','Solo administrador global':'Global admin only','Todos los usuarios aprobados':'All approved users','El administrador global puede activar o desactivar las analíticas para toda la comunidad.':'The global admin can turn analytics on or off for the whole community.',
  'Misión y reglas de participación':'Mission and engagement rules','Mantén Español Colombia como base. También puedes editar textos visibles en inglés cuando aplique.':'Keep Colombian Spanish as the base. You can also edit visible English text where applicable.',
  'Título':'Title','Subtítulo':'Subtitle','Etiqueta de sección':'Section label','Encabezado principal':'Main heading','Texto principal':'Main text','Tarjetas de propósito':'Purpose cards','Icono':'Icon','Título tarjeta':'Card title','Texto tarjeta':'Card text',
  'Título reglas de participación':'Participation rules title','Título acceso y responsabilidad':'Access and responsibility title','Regla':'Rule','Agregar regla':'Add rule','Guardar misión y configuración':'Save mission and settings',
  'Delegar aprobación de registros':'Delegate registration approvals','Solo usuarios registrados y aprobados pueden recibir rol de delegado para aprobar o rechazar registros.':'Only registered and approved users can receive delegate role to approve or deny registrations.',
  'Actualizar':'Refresh','Cargando...':'Loading...','No hay usuarios aprobados todavía.':'There are no approved users yet.','Usuario':'User','Email':'Email','Rol':'Role','Acción':'Action','Sin nombre':'No name','Administrador global':'Global admin','Quitar delegado':'Remove delegate','Hacer delegado':'Make delegate','Hacer global admin':'Make global admin',
  'Plantillas de emails':'Email templates','Edita y guarda la versión en Español e Inglés por separado. El sistema envía según la preferencia del destinatario.':'Edit and save the Spanish and English versions separately. The system sends based on the recipient language preference.',
  'Tipo de notificación':'Notification type','Variables disponibles':'Available variables','Asunto (Español)':'Subject (Spanish)','Texto plano (Español)':'Plain text (Spanish)','HTML del email (Español)':'Email HTML (Spanish)','Conserva variables como href="{{incidentLink}}".':'Keep variables such as href="{{incidentLink}}".','Guardar plantillas de email':'Save email templates',
  'Página Admin cargó correctamente.':'Admin page loaded successfully.','Diagnóstico':'Diagnostics','Último error de interfaz':'Last interface error','Limpiar error guardado':'Clear saved error','Ver consola del navegador para más detalles.':'Check the browser console for more details.',
  'Error cargando plantillas de email':'Error loading email templates','Error cargando usuarios':'Error loading users','Error actualizando delegado':'Error updating delegate','Error al guardar plantillas':'Error saving templates',
  'Plantillas guardadas. Inglés se genera automáticamente según preferencia del usuario.':'Templates saved. English is generated automatically based on the user preference.','Plantillas guardadas.':'Templates saved.','Idioma de plantilla':'Template language','Español':'Spanish','Inglés':'English','Asunto':'Subject','Texto plano':'Plain text','HTML del email':'Email HTML','Roles y permisos de usuarios':'User roles and permissions','Define global admins, delegates and standard users. Delegate admins inherit the global delegate permissions configured above.':'Define global admins, delegates, and standard users. Delegate admins inherit the global delegate permissions configured above.',
  'Permisos estándar de menú':'Standard menu permissions','Activa o desactiva qué menús ven los usuarios estándar. Dashboard siempre queda disponible.':'Enable or disable which menus standard users can view. Dashboard always remains available.',
  'Permisos del delegado':'Delegate permissions','Los delegados siempre mantienen permisos de usuario estándar y solo reciben permisos adicionales habilitados aquí.':'Delegates always keep standard user permissions and only receive additional permissions enabled here.',
  'Usuario estándar':'Standard user','Administrador delegado':'Delegate admin','Guardar permisos de menú':'Save menu permissions','Permisos guardados':'Permissions saved','Actualizar rol/permisos':'Update role/permissions',
  'Permisos predeterminados del delegado':'Default delegate permissions','Define qué permisos recibe un administrador delegado nuevo por defecto.':'Define which permissions a new delegate admin receives by default.','Guardar permisos predeterminados':'Save default permissions','Permisos predeterminados guardados':'Default permissions saved','Los permisos estándar siempre se heredan.':'Standard user permissions are always inherited.'
};
const lt = (lang, es) => lang === 'en' ? (I18N[es] || es) : es;
const ltf = (lang, es, en) => lang === 'en' ? (en || I18N[es] || es) : es;




// v41 full-screen i18n labels. Spanish (Colombia) remains default/source.
const APP_I18N = {
  "dashboard.title": { es:"Dashboard Comunal", en:"Community Dashboard" },
  "dashboard.subtitle": { es:"Vista compartida en tiempo real · Todos los propietarios · Serena del Mar", en:"Shared real-time view · All owners · Serena del Mar" },
  "dashboard.reportIncident": { es:"⚠️ Reportar incidente", en:"⚠️ Report incident" },
  "dashboard.apartments": { es:"Apartamentos", en:"Apartments" },
  "dashboard.capacity": { es:"Capacidad total", en:"Total capacity" },
  "dashboard.openReports": { es:"Reportes abiertos", en:"Open reports" },
  "dashboard.blacklist": { es:"Lista negra", en:"Blacklist" },
  "dashboard.resolved": { es:"Resueltos", en:"Resolved" },
  "dashboard.onAirbnb": { es:"En Airbnb", en:"On Airbnb" },
  "dashboard.recentReports": { es:"⚠️ Reportes recientes", en:"⚠️ Recent reports" },
  "dashboard.viewAll": { es:"Ver todos →", en:"View all →" },
  "dashboard.view": { es:"Ver →", en:"View →" },
  "dashboard.noReports": { es:"Sin reportes", en:"No reports" },

  "my.title": { es:"🔑 Mis propiedades e incidentes", en:"🔑 My listings and incidents" },
  "my.units": { es:"unidades", en:"units" },
  "my.guestsTotal": { es:"huéspedes total", en:"total guests" },
  "my.addApt": { es:"＋ Agregar apto", en:"＋ Add apt" },
  "my.myApts": { es:"Mis propiedades", en:"My listings" },
  "my.capacityShort": { es:"Cap. total", en:"Total cap." },
  "my.noApts": { es:"Sin apartamentos", en:"No apartments" },
  "my.addFirst": { es:"Agrega tu primera unidad", en:"Add your first unit" },

  "listings.title": { es:"Inventario de Apartamentos", en:"Apartment Inventory" },
  "listings.subtitle": { es:"Todas las unidades · Morros KAI · {count} registradas", en:"All units · Morros KAI · {count} registered" },
  "listings.add": { es:"＋ Agregar apto", en:"＋ Add apt" },
  "listings.search": { es:"🔍 Buscar por número de apto o propietario...", en:"🔍 Search by apartment number or owner..." },
  "incidents.search": { es:"🔍 Buscar por apto, propietario, huésped, ciudad, país, tipo...", en:"🔍 Search by apartment, owner, guest, city, country, type..." },
  "listings.none": { es:"Sin apartamentos", en:"No apartments" },
  "listings.noResults": { es:"No hay resultados", en:"No results found" },
  "listings.noAirbnb": { es:"Sin enlace Airbnb", en:"No Airbnb link" },
  "listings.viewAirbnb": { es:"🔗 Ver en Airbnb ↗", en:"🔗 View on Airbnb ↗" },
  "listings.noOpenReports": { es:"✅ Sin reportes abiertos", en:"✅ No open reports" },
  "listings.openReportSingular": { es:"⚠️ {count} reporte abierto", en:"⚠️ {count} open report" },
  "listings.openReportPlural": { es:"⚠️ {count} reportes abiertos", en:"⚠️ {count} open reports" },
  "listing.apt": { es:"Apto", en:"Apartment" },
  "listing.tower": { es:"Torre", en:"Tower" },
  "listing.owner": { es:"Propietario", en:"Owner" },
  "listing.googleEmail": { es:"Email Google", en:"Google email" },
  "listing.listingEmail": { es:"Email listing", en:"Listing email" },
  "listing.ownerWhatsapp": { es:"WhatsApp propietario", en:"Owner WhatsApp" },
  "listing.roomsGuests": { es:"Habitaciones / huéspedes", en:"Bedrooms / guests" },
  "listing.roomsShort": { es:"hab", en:"br" },
  "listing.guests": { es:"huéspedes", en:"guests" },
  "listing.operator": { es:"Operador", en:"Operator" },
  "listing.operatorEmail": { es:"Email operador", en:"Operator email" },
  "listing.operatorWhatsapp": { es:"WhatsApp operador", en:"Operator WhatsApp" },
  "listing.openLink": { es:"Abrir enlace", en:"Open link" },

  "reports.title": { es:"Reportes de Incidentes", en:"Incident Reports" },
  "reports.subtitle": { es:"Historial completo · {total} total · {open} abiertos", en:"Full history · {total} total · {open} open" },
  "reports.new": { es:"＋ Nuevo reporte", en:"＋ New report" },
  "reports.reportIncident": { es:"⚠️ Reportar incidente", en:"⚠️ Report incident" },
  "actions.ownerVerificationTitle": { es:"Incidentes pendientes de verificación", en:"Incidents requiring owner verification" },
  "actions.ownerVerificationMsg": { es:"Tienes {count} incidente(s) que requieren verificación del propietario.", en:"You have {count} incident(s) requiring owner verification." },
  "actions.resolveTitle": { es:"Incidentes listos para resolver", en:"Incidents ready to resolve" },
  "actions.resolveMsg": { es:"Hay {count} incidente(s) verificados por propietario pendientes de resolución.", en:"There are {count} owner-verified incident(s) pending resolution." },
  "actions.viewMine": { es:"Ver mis incidentes", en:"View my incidents" },
  "actions.viewReports": { es:"Ver reportes", en:"View reports" },
  "reports.all": { es:"Todos", en:"All" },
  "reports.open": { es:"⚠️ Abiertos", en:"⚠️ Open" },
  "reports.verified": { es:"✅ Verificados", en:"✅ Verified" },
  "reports.resolved": { es:"🛠️ Resueltos", en:"🛠️ Resolved" },
  "reports.none": { es:"Sin reportes", en:"No reports" },
  "reports.noneFilter": { es:"No hay incidentes con este filtro", en:"No incidents match this filter" },
  "reports.verify": { es:"✅ Verificar", en:"✅ Verify" },
  "reports.close": { es:"🛠️ Resolver", en:"🛠️ Resolve" },
  "reports.resolvePrompt": { es:"Indique los comentarios requeridos para resolver este incidente:", en:"Enter the required comments to resolve this incident:" },
  "reports.resolveRequired": { es:"Los comentarios de resolución son requeridos.", en:"Resolution comments are required." },
  "form.resolutionComments": { es:"🛠️ Comentarios de resolución", en:"🛠️ Resolution comments" },

  "notifications.title": { es:"🔔 Avisos del propietario", en:"🔔 Owner Alerts" },
  "notifications.subtitle": { es:"Nuevos incidentes reportados en tus listings · {count} sin leer", en:"New incidents reported in your listings · {count} unread" },
  "notifications.markAll": { es:"Marcar todos leídos", en:"Mark all as read" },
  "notifications.none": { es:"Sin avisos", en:"No alerts" },
  "notifications.noneSub": { es:"Cuando reporten incidentes en tus apartamentos aparecerán aquí.", en:"When incidents are reported in your apartments, they will appear here." },
  "notifications.markRead": { es:"Marcar leído", en:"Mark as read" },

  "common.all": { es:"Todos", en:"All" },
  "common.mine": { es:"Mis registros", en:"Mine" },
  "common.email": { es:"Email", en:"Email" },
  "common.sent": { es:"enviado", en:"sent" },
  "common.notSent": { es:"no enviado", en:"not sent" },
  "notifications.detail": { es:"Detalle", en:"Detail" },
  "notifications.newIncidentTitle": { es:"Nuevo incidente abierto", en:"New open incident" },
  "notifications.pendingRegistrationTitle": { es:"Nuevo registro pendiente", en:"New pending registration" },
  "notifications.pendingRegistrationMsg": { es:"solicita acceso con {count} listing(s).", en:"requests access with {count} listing(s)." },
  "smart.title": { es:"🔔 Notificaciones inteligentes", en:"🔔 Smart notifications" },
  "smart.subtitle": { es:"Prioridad automática según tu rol y acciones pendientes.", en:"Automatic priority based on your role and pending actions." },
  "smart.live": { es:"En vivo", en:"Live" },
  "smart.none": { es:"Sin acciones pendientes", en:"No pending actions" },
  "smart.noneSub": { es:"Todo está al día. Las alertas aparecerán aquí cuando requieran atención.", en:"Everything is up to date. Alerts will appear here when attention is needed." },
  "smart.ownerTitle": { es:"Verificación de propietario requerida", en:"Owner verification required" },
  "smart.ownerMsg": { es:"{count} incidente(s) abierto(s) necesitan confirmación del propietario.", en:"{count} open incident(s) need owner confirmation." },
  "smart.resolveTitle": { es:"Listo para resolver", en:"Ready to resolve" },
  "smart.resolveMsg": { es:"{count} incidente(s) verificado(s) están pendientes de resolución administrativa.", en:"{count} verified incident(s) are pending admin resolution." },
  "smart.registrationTitle": { es:"Registros pendientes", en:"Pending registrations" },
  "smart.registrationMsg": { es:"{count} solicitud(es) de registro esperan aprobación o rechazo.", en:"{count} registration request(s) need approval or decline." },
  "smart.unreadTitle": { es:"Avisos sin leer", en:"Unread alerts" },
  "smart.unreadMsg": { es:"{count} aviso(s) nuevo(s) no han sido leídos.", en:"{count} new alert(s) have not been read." },
  "smart.seriousTitle": { es:"Incidentes serios abiertos", en:"Open serious incidents" },
  "smart.seriousMsg": { es:"{count} incidente(s) serio(s) siguen abiertos o en observación.", en:"{count} serious incident(s) are still open or under watch." },
  "smart.markAll": { es:"Marcar avisos leídos", en:"Mark alerts read" },
  "filters.scopeAll": { es:"Todos", en:"All" },
  "filters.scopeMine": { es:"Mis listings", en:"My listings" },
  "filters.scopeMyIncidents": { es:"Mis incidentes", en:"My incidents" },
  "blacklist.title": { es:"😈 Huéspedes Problemáticos", en:"😈 Problem Guests" },
  "blacklist.subtitle": { es:"Registro comunal · Visible para todos los propietarios", en:"Community registry · Visible to all owners" },
  "blacklist.banned": { es:"😈 Lista Negra — Huéspedes Baneados", en:"😈 Blacklist — Banned Guests" },
  "blacklist.allFlagged": { es:"📋 Todos los Marcados", en:"📋 All Flagged" },
  "blacklist.peace": { es:"¡Comunidad en paz!", en:"Community at peace!" },
  "blacklist.noProblem": { es:"Sin huéspedes problemáticos", en:"No problem guests" },

  "registrations.title": { es:"📝 Registros", en:"📝 Registrations" },
  "registrations.subtitle": { es:"Revisa solicitudes pendientes y consulta propietarios activos con sus apartamentos registrados.", en:"Review pending requests and view active owners with their registered apartments." },
  "registrations.pendingTitle": { es:"⏳ Registros pendientes de aprobación", en:"⏳ Pending registrations" },
  "registrations.pendingSub": { es:"Incluye todos los detalles del listing para aprobar o rechazar con mejor contexto · {count} pendiente(s)", en:"Includes all listing details to approve or decline with better context · {count} pending" },
  "registrations.nonePending": { es:"Sin registros pendientes", en:"No pending registrations" },
  "registrations.nonePendingSub": { es:"Cuando un propietario nuevo se registre aparecerá aquí.", en:"When a new owner registers, they will appear here." },
  "registrations.activeTitle": { es:"✅ Registros activos aprobados", en:"✅ Active approved registrations" },
  "registrations.activeSub": { es:"Usuarios aprobados y apartamentos asociados. Un usuario puede tener uno o varios listings · {count} usuario(s)", en:"Approved users and associated apartments. A user can have one or multiple listings · {count} user(s)" },
  "registrations.noneActive": { es:"Sin registros activos", en:"No active registrations" },
  "registrations.noneActiveSub": { es:"Los propietarios aprobados aparecerán aquí con sus apartamentos.", en:"Approved owners will appear here with their apartments." },
  "registrations.approve": { es:"✅ Aprobar", en:"✅ Approve" },
  "registrations.decline": { es:"🚫 Rechazar", en:"🚫 Decline" },
  "registrations.userNoName": { es:"Usuario sin nombre", en:"Unnamed user" },
  "registrations.noEmail": { es:"Sin email", en:"No email" },
  "registrations.approvedBy": { es:"Aprobado por", en:"Approved by" },
  "registrations.filtersTitle": { es:"Filtros de registros", en:"Registration filters" },
  "registrations.filterDate": { es:"Fecha", en:"Date" },
  "registrations.filterOwner": { es:"Propietario", en:"Owner" },
  "registrations.filterApartment": { es:"Apartamento", en:"Apartment" },
  "registrations.filterStatus": { es:"Estado", en:"Status" },
  "registrations.filterAll": { es:"Todos", en:"All" },
  "registrations.statusPending": { es:"Pendiente", en:"Pending" },
  "registrations.statusApproved": { es:"Aprobado", en:"Approved" },
  "registrations.statusDeclined": { es:"Rechazado", en:"Declined" },
  "registrations.clearFilters": { es:"Limpiar filtros", en:"Clear filters" },
  "registrations.reviewedBy": { es:"Revisado por", en:"Reviewed by" },
  "registrations.status": { es:"Estado", en:"Status" },

  "analytics.title": { es:"📈 Panel SLA y analítica de incidentes", en:"📈 SLA breach dashboard and incident analytics" },
  "analytics.subtitleAdmin": { es:"Administrador global", en:"Global admin" },
  "analytics.subtitleUser": { es:"Visible para usuarios aprobados", en:"Visible to approved users" },
  "analytics.subtitleRest": { es:"Ventana de análisis, vencimientos SLA, respuesta del propietario y tendencias", en:"Analysis window, SLA breaches, owner response, and trends" },
  "analytics.days": { es:"{count} días", en:"{count} days" },
  "analytics.refresh": { es:"Actualizar", en:"Refresh" },
  "analytics.loading": { es:"Cargando...", en:"Loading..." },
  "analytics.open": { es:"Abiertos", en:"Open" },
  "analytics.breached": { es:"SLA vencido", en:"SLA breached" },
  "analytics.dueSoon": { es:"Vencen <24h", en:"Due <24h" },
  "analytics.verified": { es:"Verificados", en:"Verified" },
  "analytics.avgResponse": { es:"Prom. respuesta", en:"Avg. response" },
  "analytics.cycles": { es:"Ciclos SLA", en:"SLA cycles" },
  "analytics.breachedIncidents": { es:"🚨 Incidentes con SLA vencido", en:"🚨 Incidents with breached SLA" },
  "analytics.breachedSub": { es:"Recordatorios se continúan enviando hasta que el propietario verifique el incidente.", en:"Reminders continue until the owner verifies the incident." },
  "analytics.noBreached": { es:"No hay incidentes con SLA vencido en esta ventana.", en:"No SLA-breached incidents in this window." },
  "analytics.topApartments": { es:"🏠 Top apartamentos", en:"🏠 Top apartments" },
  "analytics.topOperators": { es:"👷 Top operadores", en:"👷 Top operators" },
  "analytics.byType": { es:"🏷️ Por tipo", en:"🏷️ By type" },
  "analytics.byCategory": { es:"😈 Por categoría", en:"😈 By category" },
  "analytics.byStatus": { es:"📌 Por estado", en:"📌 By status" },
  "analytics.byMonth": { es:"📅 Tendencia mensual", en:"📅 Monthly trend" },
  "analytics.noData": { es:"Sin datos", en:"No data" },
  "analytics.table.apt": { es:"Apto", en:"Apt" },
  "analytics.table.owner": { es:"Propietario", en:"Owner" },
  "analytics.table.operator": { es:"Operador", en:"Operator" },
  "analytics.table.type": { es:"Tipo", en:"Type" },
  "analytics.table.cycles": { es:"Ciclos", en:"Cycles" },
  "analytics.table.hoursOverdue": { es:"Horas vencido", en:"Hours overdue" },
  "analytics.table.nextSla": { es:"Próximo SLA", en:"Next SLA" },
  "analytics.table.desc": { es:"Descripción", en:"Description" },

  "modal.report.title": { es:"⚠️ Reportar Incidente", en:"⚠️ Report Incident" },
  "modal.report.sub": { es:"Por: {name} · Visible para toda la comunidad", en:"By: {name} · Visible to the whole community" },
  "modal.report.help": { es:"Completa apartamento, fecha, tipo, categoría y descripción. El propietario confirmará luego el nombre del huésped, ciudad y país.", en:"Complete apartment, date, type, category, and description. The owner will later confirm guest name, city, and country." },
  "form.apartment": { es:"🏠 Apartamento *", en:"🏠 Apartment *" },
  "form.select": { es:"Seleccionar...", en:"Select..." },
  "form.date": { es:"📅 Fecha *", en:"📅 Date *" },
  "form.type": { es:"🏷️ Tipo *", en:"🏷️ Type *" },
  "form.category": { es:"😈 Categoría *", en:"😈 Category *" },
  "form.description": { es:"📝 Descripción *", en:"📝 Description *" },
  "form.descriptionPlaceholder": { es:"Describe el incidente...", en:"Describe the incident..." },
  "form.cancel": { es:"Cancelar", en:"Cancel" },
  "form.registerReport": { es:"⚠️ Registrar reporte", en:"⚠️ Submit report" },
  "form.saveVerification": { es:"Guardar verificación", en:"Save verification" },
  "modal.verify.title": { es:"✅ Verificar incidente", en:"✅ Verify incident" },
  "modal.verify.sub": { es:"{apt} · El SLA se detendrá cuando verifiques el incidente.", en:"{apt} · The SLA will stop when you verify the incident." },
  "modal.verify.help": { es:"Confirma el nombre del huésped o huéspedes, ciudad y país. La respuesta del propietario es requerida — describe la acción tomada. Un administrador resolverá el incidente una vez verificado.", en:"Confirm the guest name(s), city, and country. The owner response is required — describe the action taken. An admin will resolve the incident once verified." },
  "form.guestNames": { es:"👥 Huésped(es) confirmado(s) *", en:"👥 Confirmed guest(s) *" },
  "form.guestNamesPlaceholder": { es:"Nombre de huésped 1, huésped 2...", en:"Guest 1 name, guest 2 name..." },

  "form.guestFirstName": { es:"Nombre", en:"First name" },
  "form.guestMiddleName": { es:"Segundo nombre", en:"Middle name" },
  "form.guestLastName": { es:"Apellido", en:"Last name" },
  "form.addGuest": { es:"＋ Agregar huésped", en:"＋ Add guest" },
  "form.removeGuest": { es:"Eliminar huésped", en:"Remove guest" },
  "form.guestNumber": { es:"Huésped {count}", en:"Guest {count}" },
  "form.guestDetails": { es:"Huésped(es) verificados", en:"Verified guest(s)" },
  "validation.guestFirstName": { es:"El nombre del huésped es requerido.", en:"Guest first name is required." },
  "validation.guestLastName": { es:"El apellido del huésped es requerido.", en:"Guest last name is required." },
  "form.city": { es:"🏙️ Ciudad *", en:"🏙️ City *" },
  "form.country": { es:"🌍 País *", en:"🌍 Country *" },
  "form.ownerResponse": { es:"💬 Respuesta del propietario *", en:"💬 Owner response *" },
  "form.ownerResponsePlaceholder": { es:"Describe la acción inmediata tomada, el estado actual del caso y cualquier detalle relevante para la resolución...", en:"Describe the immediate action taken, the current status of the case, and any details relevant for resolution..." },
  "form.optionalMessage": { es:"Mensaje opcional...", en:"Optional message..." },
  "validation.apartment": { es:"Seleccione un apartamento.", en:"Select an apartment." },
  "validation.date": { es:"Fecha requerida.", en:"Date is required." },
  "validation.type": { es:"Tipo requerido.", en:"Type is required." },
  "validation.category": { es:"Categoría requerida.", en:"Category is required." },
  "validation.description": { es:"Descripción requerida.", en:"Description is required." },
  "validation.guests": { es:"El nombre del huésped o huéspedes es requerido.", en:"Guest name(s) are required." },
  "validation.city": { es:"La ciudad es requerida.", en:"City is required." },
  "validation.country": { es:"El país es requerido.", en:"Country is required." },
  "validation.ownerComments": { es:"La respuesta del propietario es requerida.", en:"Owner response is required." },

  "incidentType.noise": { es:"🔊 Ruido excesivo", en:"🔊 Excessive noise" },
  "incidentType.damage": { es:"💥 Daños al apartamento", en:"💥 Apartment damage" },
  "incidentType.rules": { es:"📋 Incumplimiento de normas", en:"📋 Rule violation" },
  "incidentType.payment": { es:"💳 Problemas de pago", en:"💳 Payment issues" },
  "incidentType.unauthorized": { es:"🚫 Personas no autorizadas", en:"🚫 Unauthorized people" },
  "incidentType.cleanliness": { es:"🧹 Suciedad / limpieza", en:"🧹 Cleanliness issue" },
  "incidentType.other": { es:"❓ Otro", en:"❓ Other" },
  "workflow.title": { es:"Flujo del incidente", en:"Incident workflow" },
  "workflow.open": { es:"1. Abierto", en:"1. Open" },
  "workflow.openDesc": { es:"Incidente reportado por un usuario", en:"Incident reported by a user" },
  "workflow.verified": { es:"2. Verificado por propietario", en:"2. Verified by owner" },
  "workflow.verifiedDesc": { es:"Propietario confirma huésped(es), ciudad, país y comentarios", en:"Owner confirms guest(s), city, country, and comments" },
  "workflow.resolved": { es:"3. Resuelto por admin", en:"3. Resolved by admin" },
  "workflow.resolvedDesc": { es:"Admin global o delegado cierra con comentarios", en:"Global or delegate admin closes with comments" },
  "workflow.resolvedDescGlobalOnly": { es:"Admin global cierra con comentarios", en:"Global admin closes with comments" },
  "filters.workflow": { es:"Estado del flujo", en:"Workflow status" },
  "filters.category": { es:"Tipo de seguimiento", en:"Tracking category" },
  "filters.categoryAll": { es:"Todas las categorías", en:"All categories" },
  "modal.listing.addTitle": { es:"＋ Agregar apto", en:"＋ Add apt" },
  "modal.listing.editTitle": { es:"✏️ Editar apto", en:"✏️ Edit apartment" },
  "modal.listing.ownerPrefix": { es:"Propietario", en:"Owner" },
  "modal.listing.requiredHelp": { es:"Los campos marcados con * son requeridos. Torre KAI es fija y no se puede cambiar. Operador, email operador y WhatsApp operador son opcionales.", en:"Fields marked with * are required. Tower KAI is fixed and cannot be changed. Operator, operator email, and operator WhatsApp are optional." },
  "modal.listing.registrationHelp": { es:"Debes incluir al menos un listing. Torre KAI es fija. Airbnb URL, operador, email operador y WhatsApp operador son opcionales. El email del listing se llena con tu Google email, pero puedes cambiarlo.", en:"You must include at least one listing. Tower KAI is fixed. Airbnb URL, operator, operator email, and operator WhatsApp are optional. Listing email defaults to your Google email, but you can change it." },
  "form.aptNumber": { es:"🚪 Número de apartamento *", en:"🚪 Apartment number *" },
  "form.tower": { es:"🏢 Torre", en:"🏢 Tower" },
  "form.towerHelp": { es:"Torre fija del edificio.", en:"Fixed building tower." },
  "form.rooms": { es:"🛏️ Habitaciones *", en:"🛏️ Bedrooms *" },
  "form.guestCapacity": { es:"👥 Cap. huéspedes *", en:"👥 Guest capacity *" },
  "form.operatorOptional": { es:"⚙️ Operador", en:"⚙️ Operator" },
  "form.operatorEmailOptional": { es:"✉️ Email operador", en:"✉️ Operator email" },
  "form.operatorWhatsappOptional": { es:"📲 WhatsApp operador", en:"📲 Operator WhatsApp" },
  "form.ownerWhatsapp": { es:"📞 WhatsApp propietario *", en:"📞 Owner WhatsApp *" },
  "form.listingEmail": { es:"✉️ Email del listing *", en:"✉️ Listing email *" },
  "form.listingEmailHelp": { es:"Por defecto usa tu email de Google; cámbialo si este listing debe notificar a otro email.", en:"Defaults to your Google email; change it if this listing should notify another email." },
  "form.airbnbOptional": { es:"🔗 URL de Airbnb", en:"🔗 Airbnb URL" },
  "form.optional": { es:"opcional", en:"optional" },
  "form.save": { es:"💾 Guardar", en:"💾 Save" },
  "form.operatorPlaceholder": { es:"Nombre del operador", en:"Operator name" },
  "form.ownerEmailPlaceholder": { es:"propietario@email.com", en:"owner@email.com" },
  "form.addAnotherListing": { es:"＋ Agregar otro listing", en:"＋ Add another listing" },
  "validation.aptRequired": { es:"Apartamento requerido. Ejemplo: 000", en:"Apartment is required. Example: 000" },
  "validation.aptFormat": { es:"Debe tener exactamente 3 dígitos. Ejemplo: 000", en:"Must have exactly 3 digits. Example: 000" },
  "validation.aptDuplicateLocal": { es:"Este apartamento está repetido en este formulario.", en:"This apartment is duplicated in this form." },
  "validation.aptTaken": { es:"Este apartamento ya está registrado o pendiente.", en:"This apartment is already registered or pending." },
  "validation.aptCheckFailed": { es:"No se pudo validar si el apartamento está disponible.", en:"Could not validate whether the apartment is available." },
  "validation.aptChecking": { es:"Validando apartamento...", en:"Checking apartment..." },
  "validation.roomsRequired": { es:"Habitaciones requeridas.", en:"Bedrooms are required." },
  "validation.capacityRequired": { es:"Capacidad requerida.", en:"Capacity is required." },
  "validation.ownerWhatsappRequired": { es:"WhatsApp propietario requerido.", en:"Owner WhatsApp is required." },
  "validation.emailRequired": { es:"Email requerido.", en:"Email is required." },
  "validation.emailInvalid": { es:"Ingrese un email válido.", en:"Enter a valid email." },
  "validation.operatorEmailInvalid": { es:"Email del operador inválido.", en:"Operator email is invalid." },
  "validation.urlInvalid": { es:"URL debe comenzar con http:// o https://", en:"URL must start with http:// or https://" },
  "category.naughty": { es:"Lista Negra", en:"Blacklist" },
  "category.serious": { es:"Incidente Grave", en:"Serious Incident" },
  "category.watch": { es:"En Observación", en:"Under Watch" },
  "category.minor": { es:"Incidente Menor", en:"Minor Incident" }
};

Object.assign(APP_I18N, {
  "login.switchGoogleTitle": { es:"¿Necesitas usar otra cuenta de Google?", en:"Need to use a different Google account?" },
  "login.switchGoogleHelp": { es:"Al presionar Continuar con Google se abrirá el selector de cuentas. Si no aparece, cierra sesión en Google en este navegador o usa una ventana incógnita.", en:"When you press Continue with Google, the account chooser will open. If it does not appear, sign out of Google in this browser or use an incognito window." },
  "login.switchGoogleSteps": { es:"Consejo: selecciona la cuenta del propietario que debe quedar asociada a tus apartamentos.", en:"Tip: select the owner account that should be associated with your apartments." },
  "roles.standardTitle": { es:"Tu enfoque como propietario", en:"Your focus as an owner" },
  "roles.standardText": { es:"Mantén tus listings actualizados, revisa avisos y verifica incidentes de tus apartamentos con la información del huésped y comentarios.", en:"Keep your listings current, review alerts, and verify incidents for your apartments with guest details and comments." },
  "roles.delegateTitle": { es:"Tu enfoque como admin delegado", en:"Your focus as delegate admin" },
  "roles.delegateText": { es:"Además de tus permisos estándar, puedes revisar registros pendientes y resolver incidentes cuando el permiso esté activo.", en:"In addition to standard permissions, you can review pending registrations and resolve incidents when that permission is enabled." },
  "roles.globalTitle": { es:"Tu enfoque como admin global", en:"Your focus as global admin" },
  "roles.globalText": { es:"Gobierna la comunidad: usuarios, permisos, SLA, plantillas, misión, reportes y calidad de datos.", en:"Govern the community: users, permissions, SLA, templates, mission, reports, and data quality." },
  "roles.primaryActions": { es:"Acciones recomendadas", en:"Recommended actions" },
  "roles.ownerAction1": { es:"Verifica incidentes pendientes", en:"Verify pending incidents" },
  "roles.ownerAction2": { es:"Actualizar mi listing", en:"Update listing info" },
  "roles.delegateAction1": { es:"Revisa registros pendientes", en:"Review pending registrations" },
  "roles.delegateAction2": { es:"Resuelve incidentes verificados", en:"Resolve verified incidents" },
  "roles.globalAction1": { es:"Revisa métricas y SLA", en:"Review metrics and SLA" },
  "roles.globalAction2": { es:"Mantén permisos y textos actualizados", en:"Keep permissions and content updated" },
  "tooltips.adminTitle": { es:"Instrucciones y tooltips", en:"Instructions and tooltips" },
  "tooltips.adminSub": { es:"El admin global puede reemplazar las ayudas que aparecen al pasar el mouse sobre campos y botones. Mantén Español e Inglés separados.", en:"The global admin can override helper text shown on hover for fields and action buttons. Keep Spanish and English separate." },
  "tooltips.key": { es:"Clave", en:"Key" },
  "tooltips.spanish": { es:"Tooltip español", en:"Spanish tooltip" },
  "tooltips.english": { es:"Tooltip inglés", en:"English tooltip" },
  "tooltips.save": { es:"Guardar tooltips", en:"Save tooltips" },
  "tooltip.reportIncident": { es:"Reporta un incidente visible para propietarios aprobados. Incluye datos claros y verificables.", en:"Report an incident visible to approved owners. Include clear, verifiable details." },
  "tooltip.addListing": { es:"Agrega un apartamento que te pertenece. El número debe ser único y quedará asociado a tu cuenta Google.", en:"Add an apartment you own. The number must be unique and will be tied to your Google account." },
  "tooltip.aptNumber": { es:"Ingresa 3 dígitos. Ejemplo: 000. Solo un propietario puede registrar cada apartamento.", en:"Enter 3 digits. Example: 000. Each apartment can only be registered to one owner." },
  "tooltip.listingEmail": { es:"Email que recibirá notificaciones del listing. Si queda igual, usa tu email de Google.", en:"Email that receives listing notifications. If unchanged, it uses your Google email." },
  "tooltip.ownerWhatsapp": { es:"WhatsApp del propietario para contacto operativo.", en:"Owner WhatsApp for operational contact." },
  "tooltip.operator": { es:"Operador del apartamento. Opcional.", en:"Apartment operator. Optional." },
  "tooltip.operatorEmail": { es:"Email del operador para incidentes y recordatorios SLA. Opcional.", en:"Operator email for incidents and SLA reminders. Optional." },
  "tooltip.operatorWhatsapp": { es:"WhatsApp del operador. Opcional.", en:"Operator WhatsApp. Optional." },
  "tooltip.incidentApartment": { es:"Selecciona el apartamento donde ocurrió el incidente.", en:"Select the apartment where the incident happened." },
  "tooltip.incidentType": { es:"Clasifica la naturaleza del incidente: ruido, daños, normas, limpieza, etc.", en:"Classify the incident nature: noise, damage, rules, cleanliness, etc." },
  "tooltip.incidentCategory": { es:"Categoría de seguimiento: grave, en observación o menor. Sirve para filtrar y priorizar.", en:"Tracking category: serious, under watch, or minor. Used for filtering and prioritization." },
  "tooltip.incidentDescription": { es:"Describe los hechos de forma objetiva, clara y útil para el propietario.", en:"Describe the facts objectively, clearly, and usefully for the owner." },
  "tooltip.verifyIncident": { es:"El propietario confirma huésped(es), ciudad, país y comentarios antes de que un admin pueda resolver.", en:"The owner confirms guest(s), city, country, and comments before an admin can resolve." },
  "tooltip.resolveIncident": { es:"Solo admin global o delegado autorizado. Requiere comentarios y solo después de verificación del propietario.", en:"Global admin or authorized delegate only. Requires comments and only after owner verification." }
});

const DEFAULT_TOOLTIPS = {
  reportIncident: { es: APP_I18N["tooltip.reportIncident"].es, en: APP_I18N["tooltip.reportIncident"].en },
  addListing: { es: APP_I18N["tooltip.addListing"].es, en: APP_I18N["tooltip.addListing"].en },
  aptNumber: { es: APP_I18N["tooltip.aptNumber"].es, en: APP_I18N["tooltip.aptNumber"].en },
  listingEmail: { es: APP_I18N["tooltip.listingEmail"].es, en: APP_I18N["tooltip.listingEmail"].en },
  ownerWhatsapp: { es: APP_I18N["tooltip.ownerWhatsapp"].es, en: APP_I18N["tooltip.ownerWhatsapp"].en },
  operator: { es: APP_I18N["tooltip.operator"].es, en: APP_I18N["tooltip.operator"].en },
  operatorEmail: { es: APP_I18N["tooltip.operatorEmail"].es, en: APP_I18N["tooltip.operatorEmail"].en },
  operatorWhatsapp: { es: APP_I18N["tooltip.operatorWhatsapp"].es, en: APP_I18N["tooltip.operatorWhatsapp"].en },
  incidentApartment: { es: APP_I18N["tooltip.incidentApartment"].es, en: APP_I18N["tooltip.incidentApartment"].en },
  incidentType: { es: APP_I18N["tooltip.incidentType"].es, en: APP_I18N["tooltip.incidentType"].en },
  incidentCategory: { es: APP_I18N["tooltip.incidentCategory"].es, en: APP_I18N["tooltip.incidentCategory"].en },
  incidentDescription: { es: APP_I18N["tooltip.incidentDescription"].es, en: APP_I18N["tooltip.incidentDescription"].en },
  verifyIncident: { es: APP_I18N["tooltip.verifyIncident"].es, en: APP_I18N["tooltip.verifyIncident"].en },
  resolveIncident: { es: APP_I18N["tooltip.resolveIncident"].es, en: APP_I18N["tooltip.resolveIncident"].en }
};
const parseJsonObject = (v, fallback={}) => { try { return typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : fallback); } catch(e) { return fallback; } };
const localizedTooltips = (config={}, lang='es-CO') => {
  const esOverrides = parseJsonObject(config?.tooltips_es, {});
  const enOverrides = parseJsonObject(config?.tooltips_en, {});
  const isEn = lang === 'en';
  const out = {};
  Object.keys(DEFAULT_TOOLTIPS).forEach(k => { out[k] = (isEn ? enOverrides[k] : esOverrides[k]) || DEFAULT_TOOLTIPS[k][isEn ? 'en' : 'es'] || ''; });
  return out;
};
const Tip = ({ text }) => {
  const [tp, setTp] = useState(null);
  if (!text) return null;
  const show = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const mw = Math.min(300, window.innerWidth - 24);
    const cx = r.left + r.width / 2;
    setTp({ x: Math.max(mw / 2 + 8, Math.min(cx, window.innerWidth - mw / 2 - 8)), y: r.bottom + 8, mw });
  };
  const hide = () => setTp(null);
  return (
    <span className="tip" tabIndex="0" aria-label={text}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      ⓘ
      {tp && <span style={{position:'fixed',left:tp.x,top:tp.y,transform:'translateX(-50%)',maxWidth:tp.mw+'px',background:'#17313a',color:'#fff',borderRadius:'12px',padding:'10px 12px',fontSize:'.78rem',fontWeight:700,lineHeight:'1.35',boxShadow:'0 14px 34px rgba(0,0,0,.28)',whiteSpace:'normal',pointerEvents:'none',zIndex:2147483647,textAlign:'left'}}>{text}</span>}
    </span>
  );
};

const appText = (lang, key, vars={}) => {
  const v = (APP_I18N[key]?.[lang === 'en' ? 'en' : 'es']) || APP_I18N[key]?.es || key;
  return String(v).replace(/\{(\w+)\}/g, (_,k)=> vars[k] ?? '');
};
const aptDisplay = (apt, lang='es-CO') => `${appText(lang,'listing.apt')} ${apt || ''}`.trim();
const incidentTypeLabel = (value, lang='es-CO') => appText(lang, `incidentType.${value || 'other'}`);
const categoryLabel = (value, lang='es-CO') => appText(lang, `category.${value || 'minor'}`);


// Strip everything except digits. Requires ≥10 digits (country code + subscriber)
// to produce a usable wa.me link; returns '' for short/missing numbers.
const normalizePhoneForWhatsApp = (v='') => {
  const digits = String(v || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits : '';
};
const validateWhatsApp = (v='', lang='es-CO') => {
  const raw = String(v || '').trim();
  if (!raw) return ''; // field is optional — blank is fine
  // Must start with + (country code required)
  if (!raw.startsWith('+')) return lang === 'en'
    ? 'Must start with + and country code — e.g. +57 300 000 0000 (Colombia)'
    : 'Debe comenzar con + y código de país — ej. +57 300 000 0000 (Colombia)';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 10) return lang === 'en'
    ? 'Number too short — include country code, e.g. +57 300 000 0000'
    : 'Número muy corto — incluya código de país, ej. +57 300 000 0000';
  return '';
};
const validateEmail = (v='') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const copyText = async (text, showToast=()=>{}, lang='es-CO') => {
  const value = String(text || '').trim();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    showToast(lang === 'en' ? 'Copied to clipboard' : 'Copiado al portapapeles');
  } catch(e) {
    window.prompt(lang === 'en' ? 'Copy this value:' : 'Copia este valor:', value);
  }
};
const buildContactDirectory = (listings=[]) => {
  const byKey = new Map();
  const put = (key, data) => {
    if (!key) return;
    const existing = byKey.get(key) || { name:'', email:'', whatsapp:'', apartments:[] };
    const apartments = Array.from(new Set([...(existing.apartments||[]), ...(data.apartments||[]).filter(Boolean)]));
    byKey.set(key, { ...existing, ...data, apartments, name:data.name || existing.name, email:data.email || existing.email, whatsapp:data.whatsapp || existing.whatsapp });
  };
  listings.forEach(l => {
    const apt = l?.apt ? `Apt ${l.apt}` : '';
    const owner = { uid:l.ownerUid, name:l.owner || '', email:l.email || l.ownerEmail || '', whatsapp:l.contact || l.whatsapp || '', apartments:[apt].filter(Boolean) };
    put(l.ownerUid || '', owner); put(String(owner.email||'').toLowerCase(), owner); put(String(owner.name||'').toLowerCase(), owner);
    const op = { name:l.operator || '', email:l.operatorEmail || l.operator_email || '', whatsapp:l.operatorWhatsapp || l.operator_whatsapp || '', apartments:[apt].filter(Boolean) };
    put(String(op.email||'').toLowerCase(), op); put(String(op.name||'').toLowerCase(), op);
  });
  return byKey;
};
const lookupContact = (directory, { uid='', email='', name='' }={}) => {
  return directory.get(String(uid||'')) || directory.get(String(email||'').toLowerCase()) || directory.get(String(name||'').toLowerCase()) || { name:name||'', email:email||'', whatsapp:'', apartments:[] };
};

function UserContact({ name='', email='', whatsapp='', apartments=[], directory, uid='', showToast=()=>{}, onEmail=()=>{}, lang='es-CO', children }) {
  const [cardPos, setCardPos] = useState(null);
  const hideTimer = useRef(null);
  const btnRef = useRef(null);
  const c = lookupContact(directory || new Map(), { uid, email, name });
  const finalName = name || c.name || email || (lang === 'en' ? 'User' : 'Usuario');
  const finalEmail = email || c.email || '';
  const finalWhatsapp = whatsapp || c.whatsapp || '';
  const aptList = Array.from(new Set([...(apartments||[]), ...(c.apartments||[])].filter(Boolean)));
  const waDigits = normalizePhoneForWhatsApp(finalWhatsapp);
  const schedHide = () => { if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setCardPos(null), 220); };
  const cancelHide = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  const openCard = () => {
    cancelHide();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const cardW = 296;
      const x = Math.max(8, Math.min(r.left, window.innerWidth - cardW - 8));
      const y = Math.min(r.bottom + 6, window.innerHeight - 190);
      setCardPos({ x, y });
    }
  };
  return (
    <span className="contact-hover-wrap" onMouseEnter={openCard} onMouseLeave={schedHide}>
      <button type="button" ref={btnRef} className="contact-name-btn"
        onFocus={openCard} onBlur={schedHide} onClick={e => e.preventDefault()}>
        {children || finalName}
      </button>
      {cardPos && (
        <span className="contact-card"
          style={{display:'flex',flexDirection:'column',gap:'7px',position:'fixed',left:cardPos.x,top:cardPos.y,zIndex:2147483646}}
          onClick={e => e.stopPropagation()} onMouseEnter={cancelHide} onMouseLeave={schedHide}>
          <strong style={{color:'#203f2b'}}>{finalName}</strong>
          {aptList.length > 0 && <span style={{fontSize:'.75rem',color:'#235f72'}}>🏠 {aptList.join(', ')}</span>}
          {finalEmail && (
            <span className="contact-line">
              <span className="contact-line-val">✉️ {finalEmail}</span>
              <button type="button" title={lang==='en'?'Copy email':'Copiar email'} onClick={() => copyText(finalEmail, showToast, lang)}>📋</button>
              <a href={`mailto:${finalEmail}`} className="contact-action-link" target="_blank" rel="noreferrer" title={lang==='en'?'Open in email app':'Abrir en app de email'}>✉️ {lang==='en'?'Email':'Email'}</a>
            </span>
          )}
          {finalWhatsapp && (
            <span className="contact-line">
              <span className="contact-line-val">📲 {finalWhatsapp}</span>
              <button type="button" title={lang==='en'?'Copy number':'Copiar número'} onClick={() => copyText(finalWhatsapp, showToast, lang)}>📋</button>
              {waDigits && <a href={`https://wa.me/${waDigits}`} className="contact-action-link" target="_blank" rel="noreferrer" title={lang==='en'?'Open in WhatsApp':'Abrir en WhatsApp'}>💬 WhatsApp</a>}
            </span>
          )}
          {!finalEmail && !finalWhatsapp && <span style={{color:'#607063',fontSize:'.75rem'}}>{lang === 'en' ? 'No contact info' : 'Sin info de contacto'}</span>}
        </span>
      )}
    </span>
  );
}

function SendUserEmailModal({ contact, fromUser, onSend, onClose, lang='es-CO' }) {
  const [subject,setSubject]=useState('');
  const [message,setMessage]=useState('');
  const [err,setErr]=useState('');
  return <Overlay onClose={onClose} wide>
    <div className="modal-title">{lang==='en'?'Send email':'Enviar email'}</div>
    <div className="modal-sub">{contact?.name || contact?.email} · {contact?.email}</div>
    <div className="fg full"><label>{lang==='en'?'Subject *':'Asunto *'}</label><input value={subject} onChange={e=>{setSubject(e.target.value);setErr('');}} placeholder={lang==='en'?'Message subject':'Asunto del mensaje'} /> </div>
    <div className="fg full"><label>{lang==='en'?'Message *':'Mensaje *'}</label><textarea value={message} onChange={e=>{setMessage(e.target.value);setErr('');}} rows={6} placeholder={lang==='en'?'Write your message...':'Escribe tu mensaje...'} /></div>
    {err && <div className="err-msg">{err}</div>}
    <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,'form.cancel')}</button><button className="btn-p" onClick={()=>{ if(!subject.trim() || !message.trim()){setErr(lang==='en'?'Subject and message are required.':'Asunto y mensaje son requeridos.'); return;} onSend({ to:contact.email, toName:contact.name, subject, message }); }}>{lang==='en'?'Send':'Enviar'}</button></div>
  </Overlay>;
}

const DEFAULT_MISSION_SECTIONS = {
  title: 'Misión y normas de la comunidad',
  subtitle: 'Referencia para propietarios aprobados · Propietarios Airbnb KAI',
  sectionLabel: 'Nuestra misión',
  heading: 'Crear una comunidad organizada, informada y proactiva.',
  body: 'La aplicación ayuda a proteger el valor de nuestras propiedades, mejorar la coordinación entre propietarios y elevar la experiencia de los huéspedes en Morros KAI.',
  cards: [
    { icon:'🏡', title:'Gestión centralizada', text:'Organizar apartamentos, contactos, emails de notificación y enlaces importantes en un solo lugar.' },
    { icon:'⚠️', title:'Reportes transparentes', text:'Documentar incidentes de manera rápida para que el propietario correcto reciba aviso y pueda tomar acción.' },
    { icon:'🤝', title:'Colaboración comunitaria', text:'Compartir información útil entre propietarios aprobados para operar mejor y prevenir problemas repetidos.' },
    { icon:'📊', title:'Mejora continua', text:'Usar datos y tendencias para elevar la calidad del servicio, la comunicación y la experiencia del huésped.' }
  ],
  participationTitle: '📌 Reglas de participación',
  participationRules: [
    'Reportar incidentes con información clara, objetiva y verificable.',
    'Incluir detalles útiles: apartamento, huésped, fecha, tipo de incidente y descripción.',
    'Mantener respeto y confidencialidad en los comentarios.',
    'No publicar contenido ofensivo, especulativo o no relacionado con la operación.',
    'Usar los reportes para prevenir, corregir y mejorar; no para conflictos personales.'
  ],
  accessTitle: '🔐 Acceso y responsabilidad',
  accessRules: [
    'El acceso requiere Google Sign-In.',
    'Cada apartamento solo puede pertenecer a una cuenta aprobada.',
    'Los nuevos registros quedan pendientes hasta revisión.',
    'Los propietarios aprobados pueden revisar solicitudes pendientes y aprobar o rechazar con motivo.',
    'Las notificaciones se envían al email de Google y al email del listing cuando son diferentes.'
  ]
};
const MISSION_EN_DEFAULTS = {
  title: 'Mission and community rules',
  subtitle: 'Reference for approved owners · KAI Airbnb Owners',
  sectionLabel: 'Our mission',
  heading: 'Create an organized, informed, and proactive community.',
  body: 'The application helps protect the value of our properties, improve coordination among owners, and elevate the guest experience at Morros KAI.',
  cards: [
    { icon:'🏡', title:'Centralized management', text:'Organize apartments, contacts, notification emails, and important links in one place.' },
    { icon:'⚠️', title:'Transparent reports', text:'Document incidents quickly so the correct owner receives notice and can take action.' },
    { icon:'🤝', title:'Community collaboration', text:'Share useful information among approved owners to operate better and prevent repeated issues.' },
    { icon:'📊', title:'Continuous improvement', text:'Use data and trends to improve service quality, communication, and guest experience.' }
  ],
  participationTitle: '📌 Community engagement rules',
  participationRules: [
    'Report incidents with clear, objective, and verifiable information.',
    'Include useful details: apartment, guest, date, incident type, and description.',
    'Maintain respect and confidentiality in comments.',
    'Do not publish offensive, speculative, or non-operational content.',
    'Use reports to prevent, correct, and improve; not for personal conflicts.'
  ],
  accessTitle: '🔐 Access and responsibility',
  accessRules: [
    'Access requires Google Sign-In.',
    'Each apartment can belong to only one approved account.',
    'New registrations remain pending until reviewed.',
    'Approved owners can review pending requests and approve or decline with a reason.',
    'Notifications are sent to the Google email and listing email when different.'
  ]
};
const TRANSLATE_TO_EN = new Map([
  ...Object.entries(DEFAULT_MISSION_SECTIONS).filter(([k,v])=>typeof v==='string').map(([k,v])=>[v, MISSION_EN_DEFAULTS[k]]),
  ...DEFAULT_MISSION_SECTIONS.cards.flatMap((c,i)=>[[c.title, MISSION_EN_DEFAULTS.cards[i].title],[c.text, MISSION_EN_DEFAULTS.cards[i].text]]),
  ...DEFAULT_MISSION_SECTIONS.participationRules.map((v,i)=>[v, MISSION_EN_DEFAULTS.participationRules[i]]),
  ...DEFAULT_MISSION_SECTIONS.accessRules.map((v,i)=>[v, MISSION_EN_DEFAULTS.accessRules[i]])
]);
const translateToEnglish = (text) => TRANSLATE_TO_EN.get(String(text||'')) || String(text||'');
const normalizeMissionSections = (m={}) => { const base={...DEFAULT_MISSION_SECTIONS,...(m&&typeof m==='object'?m:{})}; const dc=DEFAULT_MISSION_SECTIONS.cards; const cards=Array.isArray(base.cards)?base.cards.map((c,i)=>({icon:String((c&&typeof c==='object'?c.icon:undefined)??dc[i]?.icon??'•'),title:String((c&&typeof c==='object'?c.title:undefined)??dc[i]?.title??''),text:String((c&&typeof c==='object'?c.text:undefined)??dc[i]?.text??'')})):dc; const participationRules=Array.isArray(base.participationRules)?base.participationRules.map(x=>String(x??'')):DEFAULT_MISSION_SECTIONS.participationRules; const accessRules=Array.isArray(base.accessRules)?base.accessRules.map(x=>String(x??'')):DEFAULT_MISSION_SECTIONS.accessRules; return {...base,cards,participationRules,accessRules}; };
const parseMissionSections = (config={}) => { try { return normalizeMissionSections(JSON.parse(config?.mission_sections_es || '{}') || {}); } catch { return normalizeMissionSections({}); } };
const localizeMissionSections = (config={}, lang='es-CO') => {
  const es = parseMissionSections(config);
  if (lang !== 'en') return es;
  return { ...es, title:translateToEnglish(es.title), subtitle:translateToEnglish(es.subtitle), sectionLabel:translateToEnglish(es.sectionLabel), heading:translateToEnglish(es.heading), body:translateToEnglish(es.body), cards:(es.cards||[]).map(c=>({icon:c.icon,title:translateToEnglish(c.title),text:translateToEnglish(c.text)})), participationTitle:translateToEnglish(es.participationTitle), participationRules:(es.participationRules||[]).map(translateToEnglish), accessTitle:translateToEnglish(es.accessTitle), accessRules:(es.accessRules||[]).map(translateToEnglish) };
};

const fmtDate = d => { if(!d) return ""; const [y,m,day]=d.split("-"); return `${parseInt(day)} ${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][parseInt(m)-1]} ${y}`; };
const today = () => new Date().toISOString().split("T")[0];

// ─── API HELPERS (30s timeout handles Render cold starts) ────────────────────
const fetchT = (url, opts={}, ms=35000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
};
const parseResponse = async (r) => {
  const raw = await r.text().catch(() => '');
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch(e) { data = { raw }; }
  if (!r.ok || data?.error) {
    const msg = data?.error || data?.message || raw || `Request failed: ${r.status}`;
    const err = new Error(msg);
    err.status = r.status; err.details = data; err.url = r.url;
    console.error('[KAI_API_ERROR]', { url:r.url, status:r.status, msg, data });
    throw err;
  }
  return data;
};
const api = {
  get:   (p)    => fetchT(p).then(parseResponse),
  post:  (p, b) => fetchT(p, { method:'POST',   headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }).then(parseResponse),
  put:   (p, b) => fetchT(p, { method:'PUT',    headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }).then(parseResponse),
  patch: (p, b) => fetchT(p, { method:'PATCH',  headers:{'Content-Type':'application/json'}, body:JSON.stringify(b||{}) }).then(parseResponse),
  del:   (p, b) => fetchT(p, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }).then(parseResponse),
};
const checkApartmentUnique = ({ apt, ownerUid, excludeListingId='' }) => {
  const q = new URLSearchParams({ apt:String(apt||'').trim(), ownerUid:String(ownerUid||''), excludeListingId:String(excludeListingId||'') });
  return api.get('/api/apartments/check?' + q.toString());
};


class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state={hasError:false, message:'', stack:'', componentStack:''}; }
  static getDerivedStateFromError(error){ return {hasError:true, message:error?.message || String(error), stack:error?.stack || ''}; }
  componentDidCatch(error, info){
    const payload = { section:this.props.section || 'unknown', message:error?.message || String(error), stack:error?.stack || '', componentStack:info?.componentStack || '', ts:new Date().toISOString() };
    console.error('[KAI_UI_ERROR]', payload);
    try { localStorage.setItem('kai_last_ui_error', JSON.stringify(payload, null, 2)); } catch(e) {}
    try { fetch('/api/client-log', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }).catch(()=>{}); } catch(e) {}
    this.setState({componentStack:info?.componentStack || ''});
  }
  render(){
    if(this.state.hasError){
      if (typeof this.props.fallback === 'function') return this.props.fallback({ message:this.state.message, stack:this.state.stack, componentStack:this.state.componentStack });
      return this.props.fallback || <div className="card"><h2 className="ptitle">No se pudo cargar esta sección</h2><p className="psub">Error: {this.state.message}</p><pre className="codebox">{this.state.stack}</pre></div>;
    }
    return this.props.children;
  }
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,      setUser]      = useState(null);
  const [lang, setLangState] = useState(localStorage.getItem("kai_lang") || "es-CO");
  const t = getT(lang);
  const setLang = (next) => { const v = next === "en" ? "en" : "es-CO"; setLangState(v); localStorage.setItem("kai_lang", v); if (user?.uid) api.put("/api/users/preference", { uid:user.uid, email:user.email, name:user.name, language:v }).catch(()=>{}); };
  const [authLoading, setAuthLoading] = useState(true);
  const [listings,  setListings]  = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [registration, setRegistration] = useState(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [activeRegistrations, setActiveRegistrations] = useState([]);
  const [adminInfo, setAdminInfo] = useState({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
  const [previewRole, setPreviewRole] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const initialView = new URLSearchParams(window.location.search).get('view') || "dashboard";
  const [view,      setView]      = useState(initialView);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [lastSync,  setLastSync]  = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast,     setToast]     = useState(null);
  const [modal,     setModal]     = useState(null);
  const [incidentQuickFilter, setIncidentQuickFilter] = useState(null);
  const [userProfile, setUserProfile] = useState({ whatsapp:'' });
  // Listing floor collapse state — lives here so it persists across navigation
  const [listingFloorOpen, setListingFloorOpen] = useState({});
  const toggleListingFloor = (f) => setListingFloorOpen(s=>({...s,[f]:!s[f]}));
  const pollRef = useRef(null);

  const [loadError, setLoadError] = useState(false);
  const [loadErrorMsg, setLoadErrorMsg] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const isApproved = registration?.status === "approved";
  const analyticsEnabledForAll = String(adminInfo?.config?.analytics_enabled || "false") === "true";

  // ── ROLE PREVIEW (Global Admin only, view-only simulation, never writes to DB) ──
  const ROLE_PREVIEW_PERMS = {
    global_admin: { isGlobalAdmin:true, role:'global_admin', canManage:true, menu:{ dashboard:true, listings:true, incidents:true, notifications:true, about:true, my:true, analytics:true, approvals:true }, delegate:{ canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:true, canDeleteGlobalListings:true, canUpdateGlobalIncidents:true, canDeleteGlobalIncidents:true } },
    delegate_admin: { isGlobalAdmin:false, role:'delegate_admin', canManage:true, menu:{ ...DEFAULT_STANDARD_MENU_PERMISSIONS, approvals:true }, delegate:{ ...DEFAULT_DELEGATE_PERMISSIONS } },
    standard_admin: { isGlobalAdmin:false, role:'standard_admin', canManage:false, menu:{ ...DEFAULT_STANDARD_MENU_PERMISSIONS }, delegate:{ ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false, canResolveIncidents:true } },
    user: { isGlobalAdmin:false, role:'user', canManage:false, menu:{ ...DEFAULT_STANDARD_MENU_PERMISSIONS }, delegate:{ ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false, canResolveIncidents:false } },
  };
  const PREVIEW_ROLE_LABELS = {
    en: { global_admin:'Global Admin', delegate_admin:'Delegate Admin', standard_admin:'Standard Admin', user:'Owner/User' },
    es: { global_admin:'Admin global', delegate_admin:'Admin delegado', standard_admin:'Admin estándar', user:'Propietario/Usuario' },
  };
  const previewPerms = previewRole ? ROLE_PREVIEW_PERMS[previewRole] : null;
  const effectiveIsGlobalAdmin = previewPerms ? previewPerms.isGlobalAdmin : adminInfo.isGlobalAdmin;
  const effectiveRole = previewPerms ? previewPerms.role : adminInfo.role;
  const effectiveCanManageRegistrations = previewPerms ? previewPerms.canManage : adminInfo.canManageRegistrations;

  const loadAll = useCallback(async (isInit=false) => {
    if (!user?.uid || registration?.status !== "approved") { setLoading(false); return; }
    try {
      const [l, i, n, p, a] = await Promise.all([
        api.get('/api/listings'),
        api.get('/api/incidents'),
        api.get('/api/notifications?ownerUid=' + encodeURIComponent(user.uid)),
        adminInfo.canManageRegistrations ? api.get('/api/registrations/pending?reviewerUid=' + encodeURIComponent(user.uid) + '&reviewerEmail=' + encodeURIComponent(user.email || '')) : Promise.resolve([]),
        adminInfo.canManageRegistrations ? api.get('/api/registrations/active?reviewerUid=' + encodeURIComponent(user.uid) + '&reviewerEmail=' + encodeURIComponent(user.email || '')) : Promise.resolve([]),
      ]);
      setListings(Array.isArray(l) ? l : []);
      setIncidents(Array.isArray(i) ? i : []);
      setNotifications(Array.isArray(n) ? n : []);
      setPendingRegistrations(Array.isArray(p) ? p : []);
      setActiveRegistrations(Array.isArray(a) ? a : []);
      setLastSync(new Date());
      if (isInit) { setLoadError(false); setLoadErrorMsg(''); }
    } catch(e) {
      console.error('Load error', e);
      if (isInit) { setLoadError(true); setLoadErrorMsg(e.message || 'No se pudo conectar al servidor'); }
    }
  }, [user?.uid, user?.email, registration?.status, adminInfo.canManageRegistrations]);

  useEffect(() => {
    loadAll(true).finally(() => setLoading(false));
  }, [loadAll, retryCount]);

  // Poll every 20s for real-time updates
  useEffect(() => {
    if (!isApproved) return;
    pollRef.current = setInterval(loadAll, 20000);
    return () => clearInterval(pollRef.current);
  }, [loadAll, isApproved]);

  // Reset to dashboard when preview role is activated so the simulated role's view is coherent
  useEffect(() => {
    if (previewRole) setView('dashboard');
  }, [previewRole]);

  const showToast = (msg, err=false) => { setToast({msg,err}); setTimeout(()=>setToast(null),3200); };

  // ── FIREBASE AUTH ──
  useEffect(() => {
    if (!firebaseReady || !auth) {
      setAuthLoading(false);
      setUser(null);
      setRegistration(null);
      setAdminLoading(false);
      setRegistrationLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setAdminLoading(true);
        setRegistrationLoading(true);
        setUser({
          uid:    firebaseUser.uid,
          email:  firebaseUser.email,
          name:   firebaseUser.displayName || firebaseUser.email,
          avatar: (firebaseUser.displayName||"?")[0].toUpperCase(),
          photo:  firebaseUser.photoURL,
        });
      } else {
        setUser(null);
        setRegistration(null);
        setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
        setAdminLoading(false);
        setRegistrationLoading(false);
        setListings([]); setIncidents([]); setNotifications([]); setPendingRegistrations([]); setActiveRegistrations([]);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) { setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}}); setAdminLoading(false); return; }
    setAdminLoading(true);
    api.get('/api/admin/me?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '') + '&name=' + encodeURIComponent(user.name || ''))
      .then(adminResponse => {
        const info = adminResponse || {role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}};
        setAdminInfo(info);
        if (info.languagePreference && info.languagePreference !== lang) {
          const pref = info.languagePreference === 'en' ? 'en' : 'es-CO';
          setLangState(pref);
          localStorage.setItem('kai_lang', pref);
        }
      })
      .catch(e => { console.error('Admin info error', e); setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}}); })
      .finally(() => setAdminLoading(false));
  }, [user?.uid, user?.email, user?.name]);

  useEffect(() => {
    if (!user?.uid) { setRegistration(null); setRegistrationLoading(false); return; }
    setRegistrationLoading(true);
    api.get('/api/registrations/status?uid=' + encodeURIComponent(user.uid))
      .then(r => setRegistration(r || {status:'none'}))
      .catch(e => { console.error('Registration status error', e); setRegistration({status:'error', error:e.message}); })
      .finally(() => setRegistrationLoading(false));
  }, [user?.uid]);

  // Load owner profile (whatsapp)
  useEffect(() => {
    if (!user?.uid) { setUserProfile({ whatsapp:'' }); return; }
    api.get('/api/users/profile?uid=' + encodeURIComponent(user.uid))
      .then(p => setUserProfile({ whatsapp:p.whatsapp||'' }))
      .catch(() => {});
  }, [user?.uid]);

  const saveProfile = async (profileData) => {
    setSyncing(true);
    try {
      const result = await api.put('/api/users/profile', { uid:user.uid, email:user.email, whatsapp:profileData.whatsapp });
      setUserProfile({ whatsapp:result.whatsapp||'' });
      // Also update cached whatsapp in listings for the current user
      setListings(ls => ls.map(l => l.ownerUid===user.uid ? {...l, contact:result.whatsapp||'', email:user.email} : l));
      showToast(lang==='en' ? '✅ Profile updated' : '✅ Perfil actualizado');
    } catch(e) {
      showToast((lang==='en' ? 'Could not save: ' : 'No se pudo guardar: ') + (e.message || ''), true);
    } finally { setSyncing(false); }
  };

  const submitRegistration = async ({ listings: listingsToRegister, profile = {} }) => {
    setSyncing(true);
    try {
      const r = await api.post('/api/registrations', { userUid:user.uid, userName:user.name, userEmail:user.email, listings:listingsToRegister, profileWhatsapp:profile.whatsapp||'' });
      setRegistration(r);
      if (profile.whatsapp) setUserProfile({ whatsapp:profile.whatsapp });
      showToast('✅ Registro enviado. Pendiente de aprobación.');
    } catch(e) { showToast('Error al enviar registro: ' + (e.message || 'Revise los datos'), true); }
    finally { setSyncing(false); }
  };
  const reviewRegistrationAction = async (id, action) => {
    const reason = action === 'decline' ? prompt('Motivo del rechazo:') : prompt('Nota opcional para aprobación:', 'Aprobado');
    if (action === 'decline' && !reason) { showToast('Debe ingresar un motivo para rechazar.', true); return; }
    setSyncing(true);
    try {
      await api.post('/api/registrations/' + id + '/' + (action === 'approve' ? 'approve' : 'decline'), { reviewerUid:user.uid, reviewerEmail:user.email, reviewerName:user.name, reason:reason || '' });
      setPendingRegistrations(p => p.filter(r => r.id !== id));
      await loadAll(false);
      showToast(action === 'approve' ? '✅ Registro aprobado' : '🚫 Registro rechazado');
    } catch(e) { showToast('Error al revisar registro: ' + (e.message || 'Revise Render/Supabase'), true); }
    finally { setSyncing(false); }
  };

  const login = async () => {
    if (!firebaseReady || !auth || !provider) {
      showToast(lang === 'en' ? 'Google login is not configured. Check Firebase environment variables in Render.' : 'Google login no está configurado. Revise las variables de Firebase en Render.', true);
      return;
    }
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, provider);
      setLoginOpen(false);
    } catch(e) {
      setAuthLoading(false);
      if (e.code !== "auth/popup-closed-by-user") showToast("Error al iniciar sesión: " + e.message, true);
    }
  };
  const logout = async () => {
    if (auth) await signOut(auth);
    showToast("Sesión cerrada");
  };

  const openCount    = incidents.filter(i=>i.status==="open").length;
  const myListings   = user ? listings.filter(l=>l.ownerUid===user.uid) : [];
  const contactDirectory = buildContactDirectory(listings);
  const contactProps = { directory:contactDirectory, showToast, lang, onEmail:(contact)=>setModal({type:'sendUserEmail', data:contact}) };
  const sendUserEmail = async ({ to, toName, subject, message }) => {
    setSyncing(true);
    try {
      await api.post('/api/contact/send-email', { actorUid:user.uid, actorEmail:user.email, actorName:user.name, to, toName, subject, message, language:lang });
      setModal(null);
      showToast(lang === 'en' ? '✅ Email sent' : '✅ Email enviado');
    } catch(e) { showToast((lang === 'en' ? 'Error sending email: ' : 'Error enviando email: ') + (e.message || ''), true); }
    finally { setSyncing(false); }
  };
  const unreadNotifications = notifications.filter(n=>!n.isRead).length;
  // Derived set used for action-needed banners; keep safe to avoid home-screen render crashes.
  const myListingIds = new Set((myListings || []).map(l => l.id));
  const menuPerms = previewPerms ? previewPerms.menu : { ...DEFAULT_STANDARD_MENU_PERMISSIONS, ...(adminInfo?.permissions?.menu || {}) };
  // Only delegate_admins and global_admins receive delegate permissions.
  // Standard users (role='user') always get canResolveIncidents:false and
  // canApproveRegistrations:false regardless of any DB-stored value.
  const delegatePerms = previewPerms
    ? previewPerms.delegate
    : effectiveRole === 'delegate_admin'
      ? { ...DEFAULT_DELEGATE_PERMISSIONS, ...(adminInfo?.permissions?.delegate || {}) }
      : { ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false, canResolveIncidents:false };
  const canSeeMenu = (id) => effectiveIsGlobalAdmin || id === 'dashboard' || !!menuPerms[id];
  const needsOwnerVerification = incidents.filter(i => i.status === "open" && myListingIds.has(i.aptId));
  const canResolveIncidentsNow = Boolean(effectiveIsGlobalAdmin || (effectiveRole === 'delegate_admin' && delegatePerms.canResolveIncidents));
  const needsAdminResolution = incidents.filter(i => i.status === "verified" && canResolveIncidentsNow);
  const openSeriousIncidents = incidents.filter(i => i.status !== "resolved" && ["serious","watch","under_watch"].includes(String(i.category || "")));
  const smartAlerts = [
    needsOwnerVerification.length ? { id:"ownerVerification", priority:1, icon:"✅", tone:"owner", title:appText(lang,"smart.ownerTitle"), msg:appText(lang,"smart.ownerMsg",{count:needsOwnerVerification.length}), count:needsOwnerVerification.length, action:()=>{setIncidentQuickFilter("ownerVerification");setView("incidents");setOpenDropdown(null);} } : null,
    needsAdminResolution.length ? { id:"readyResolve", priority:2, icon:"🛠️", tone:"resolve", title:appText(lang,"smart.resolveTitle"), msg:appText(lang,"smart.resolveMsg",{count:needsAdminResolution.length}), count:needsAdminResolution.length, action:()=>{setIncidentQuickFilter("requiresResolution");setView("incidents");setOpenDropdown(null);} } : null,
    effectiveCanManageRegistrations && pendingRegistrations.length ? { id:"registrations", priority:3, icon:"📝", tone:"registration", title:appText(lang,"smart.registrationTitle"), msg:appText(lang,"smart.registrationMsg",{count:pendingRegistrations.length}), count:pendingRegistrations.length, action:()=>{setView("approvals");setOpenDropdown(null);} } : null,
    unreadNotifications ? { id:"unread", priority:4, icon:"🔔", tone:"notice", title:appText(lang,"smart.unreadTitle"), msg:appText(lang,"smart.unreadMsg",{count:unreadNotifications}), count:unreadNotifications, action:()=>{setView("notifications");setOpenDropdown(null);} } : null,
    openSeriousIncidents.length ? { id:"serious", priority:5, icon:"🚨", tone:"serious", title:appText(lang,"smart.seriousTitle"), msg:appText(lang,"smart.seriousMsg",{count:openSeriousIncidents.length}), count:openSeriousIncidents.length, action:()=>{setIncidentQuickFilter("seriousOpen");setView("incidents");setOpenDropdown(null);} } : null,
  ].filter(Boolean).sort((a,b)=>a.priority-b.priority);
  const smartAlertCount = smartAlerts.reduce((sum,a)=>sum + Number(a.count || 0), 0);
  const NAV = [
    ...(canSeeMenu('dashboard') ? [{ id:"dashboard", icon:"📊", label:t.nav.dashboard }] : []),
    ...(canSeeMenu('listings') ? [{ id:"listings",  icon:"🏠", label:t.nav.listings }] : []),
    ...(canSeeMenu('incidents') ? [{ id:"incidents", icon:"⚠️", label:t.nav.incidents, badge: openCount }] : []),
    ...(canSeeMenu('about') ? [{ id:"about", icon:"🌊", label:t.nav.about }] : []),
    ...(isApproved ? [
      ...(effectiveCanManageRegistrations ? [{ id:"approvals", icon:"📝", label:t.nav.approvals, badge: pendingRegistrations.length }] : []),
      ...(effectiveIsGlobalAdmin ? [{ id:"admin", icon:"⚙️", label:t.nav.admin }] : []),
      ...((effectiveIsGlobalAdmin || (analyticsEnabledForAll && canSeeMenu('analytics'))) ? [{ id:"analytics", icon:"📈", label:t.nav.analytics }] : []),
      ...(canSeeMenu('my') ? [{ id:"my", icon:"🔑", label:t.nav.my, badge: myListings.length }] : [])
    ] : []),
  ];
  const primaryNavIds = new Set(["dashboard", "listings", "incidents", "my"]);
  const primaryNav = NAV.filter(n => primaryNavIds.has(n.id));
  const moreNav = NAV.filter(n => !primaryNavIds.has(n.id));

  // ── CRUD ACTIONS ──
  const addListing = async (data) => {
    setSyncing(true);
    try {
      const newL = await api.post('/api/listings', { ...data, ownerUid: user.uid, owner: user.name, userEmail: user.email });
      setListings(l => [...l, newL]);
      setModal(null); showToast("✅ Apartamento registrado");
    } catch(e) { console.error('Save listing error', e); showToast("Error al guardar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const editListing = async (id, ownerUid, data) => {
    if (ownerUid !== user?.uid && !adminInfo.isGlobalAdmin) { showToast("Solo el propietario o administrador global puede editar", true); return; }
    setSyncing(true);
    try {
      const updated = await api.put(`/api/listings/${id}`, { ...data, ownerUid: user.uid, actorEmail: user.email });
      setListings(l => l.map(x => x.id === id ? updated : x));
      setModal(null); showToast("✅ Actualizado");
    } catch(e) { console.error('Update listing error', e); showToast("Error al actualizar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const deleteListing = async (l) => {
    if (l.ownerUid !== user?.uid && !adminInfo.isGlobalAdmin) { showToast("Solo el propietario o administrador global puede eliminar", true); return; }
    setSyncing(true);
    try {
      await api.del(`/api/listings/${l.id}`, { ownerUid: user.uid, actorEmail: user.email });
      setListings(ls => ls.filter(x => x.id !== l.id));
      setIncidents(is => is.filter(x => x.aptId !== l.id));
      showToast("🗑️ Eliminado");
    } catch(e) { console.error('Delete error', e); showToast("Error al eliminar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const addIncident = async (data) => {
    setSyncing(true);
    try {
      const apt = listings.find(l => l.id === data.aptId);
      const newI = await api.post('/api/incidents', { ...data, reporterUid: user.uid, reporterName: user.name, aptLabel: apt ? aptDisplay(apt.apt, lang) : '?' });
      setIncidents(i => [newI, ...i]);
      setModal(null); showToast("⚠️ Reporte registrado");
    } catch(e) { console.error('Save incident error', e); showToast("Error al reportar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const resolveIncident = async (id) => {
    const comments = window.prompt(appText(lang, 'reports.resolvePrompt'), '');
    if (comments === null) return;
    if (!String(comments || '').trim()) { showToast(appText(lang, 'reports.resolveRequired'), true); return; }
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${id}/resolve`, { actorUid:user.uid, actorEmail:user.email, actorName:user.name, resolutionComments:comments });
      setIncidents(i => i.map(x => x.id === id ? (updated?.id ? updated : {...x, status:'resolved', resolutionComments:comments, resolvedAt:new Date().toISOString(), resolvedBy:user.email}) : x));
      showToast(lang === 'en' ? '🛠️ Resolved' : '🛠️ Resuelto');
    } catch(e) { console.error('Resolve incident error', e); showToast("Error: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const verifyIncident = async (id, payload) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${id}/verify`, { ownerUid:user.uid, guests:payload.guests || [], ownerComments:payload.ownerComments || '' });
      setIncidents(i => i.map(x => x.id === id ? updated : x));
      setModal(null); showToast('✅ Incidente verificado');
    } catch(e) { showToast('Error al verificar: ' + (e.message || 'Revise datos'), true); }
    finally { setSyncing(false); }
  };

  const deleteIncident = async (id) => {
    setSyncing(true);
    try {
      await api.del(`/api/incidents/${id}`, { reporterUid: user.uid, actorEmail: user.email });
      setIncidents(i => i.filter(x => x.id !== id));
      showToast("🗑️ Eliminado");
    } catch(e) { console.error('Delete incident error', e); showToast("Error al eliminar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const markNotificationRead = async (id) => {
    if (!user?.uid) return;
    try {
      const updated = await api.patch(`/api/notifications/${id}/read`, { ownerUid: user.uid });
      setNotifications(ns => ns.map(n => n.id === id ? updated : n));
    } catch(e) { console.error('Notification read error', e); showToast("Error al marcar aviso", true); }
  };

  const markAllNotificationsRead = async () => {
    if (!user?.uid) return;
    try {
      await api.patch('/api/notifications/read-all', { ownerUid: user.uid });
      setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
      showToast("🔔 Avisos marcados como leídos");
    } catch(e) { console.error('Notification read-all error', e); showToast("Error al marcar avisos", true); }
  };

  const saveAdminConfig = async (cfg) => {
    setSyncing(true);
    try {
      const r = await api.put('/api/admin/config', { actorUid:user.uid, actorEmail:user.email, ...cfg });
      setAdminInfo(a => ({...a, config:r.config || a.config}));
      showToast('✅ Configuración guardada');
    } catch(e) { showToast('Error al guardar configuración: ' + (e.message || ''), true); }
    finally { setSyncing(false); }
  };

  if (authLoading || (user && (adminLoading || registrationLoading)) || (isApproved && loading) || loadError) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#07141e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24}}>
      <style>{CSS}</style>
      <div className="logo-mark" style={{width:64,height:64}}>
        <span className="logo-k" style={{fontSize:"1.6rem"}}>K</span>
        <span className="logo-wave" style={{fontSize:"0.8rem"}}>~</span>
      </div>
      <div style={{textAlign:"center",maxWidth:320}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem",color:"#dff0f5",marginBottom:8}}>Propietarios Airbnb KAI</div>
        {loading && !loadError && <>
          <div style={{fontSize:"0.82rem",color:"#2a6a7a",marginBottom:6}}>Conectando con el servidor...</div>
          <div style={{fontSize:"0.72rem",color:"#1a4a5a",marginBottom:20}}>(El servidor puede tardar ~30s en despertar)</div>
          <div className="spinner" style={{margin:"0 auto"}}/>
        </>}
        {loadError && <>
          <div style={{fontSize:"0.82rem",color:"#ff6b6b",marginBottom:8}}>⚠️ No se pudo conectar al servidor</div>
          <div style={{fontSize:"0.72rem",color:"#8fb6c4",marginBottom:8,wordBreak:"break-word"}}>{loadErrorMsg}</div>
          <div style={{fontSize:"0.72rem",color:"#3a5a6a",marginBottom:20}}>Verifica <code>/api/health</code>. Si dice missing env o table missing, revisa Render Environment y corre el schema de Supabase.</div>
          <button onClick={()=>{ setLoading(true); setLoadError(false); setLoadErrorMsg(''); setRetryCount(c=>c+1); }}
            style={{background:"#1a8fa0",color:"white",border:"none",padding:"10px 24px",borderRadius:10,fontSize:"0.85rem",cursor:"pointer"}}>
            🔄 Reintentar
          </button>
        </>}
      </div>
    </div>
  );

  if (!user) return <AuthGate onLogin={login} lang={lang} setLang={setLang} />;
  if (!isApproved) return <RegistrationGate user={user} registration={registration} onSubmit={submitRegistration} onLogout={logout} syncing={syncing} toast={toast} lang={lang} setLang={setLang} />;

  return (
    <div className="app-shell">
      <style>{CSS}</style>

      <header className="hdr">
        <div className="hdr-inner">
          <div className="logo" onClick={()=>setView("dashboard")}>
            <div className="logo-mark"><span className="logo-k">K</span><span className="logo-wave">~</span></div>
            <div>
              <div className="logo-title">{t.appName}</div>
              <div className="logo-sub">{t.location} <span className="beta-badge">BETA</span></div>
            </div>
          </div>

          <nav className="nav nav-compact">
            {primaryNav.map(n=>(
              <button key={n.id} className={`nb ${view===n.id?"nb-active":""}`} onClick={()=>{setView(n.id);setOpenDropdown(null);}}>
                {n.icon} {n.label}
                {n.badge>0 && <span className="nb-badge">{n.badge}</span>}
              </button>
            ))}
            <button className={`nb nav-help-btn ${view==='help'?'nb-active':''}`} onClick={()=>{setView('help');setOpenDropdown(null);}} title={t.nav.help} aria-label={t.nav.help}>❓</button>
            {/* Bell sits inside the nav so it stays adjacent to More ▾ */}
            <button className={`icon-btn nav-bell${view==="notifications"?" icon-active":""}`} onClick={()=>{setView('notifications');setOpenDropdown(null);}} title={appText(lang,"smart.title")} aria-label={`${appText(lang,"smart.title")}${smartAlertCount>0?` (${smartAlertCount})`:''}`}>🔔{smartAlertCount>0 && <span className="icon-badge">{smartAlertCount}</span>}</button>
            {(moreNav.length > 0 || adminInfo.isGlobalAdmin) && <div className="nav-dd" onClick={e=>e.stopPropagation()}>
              <button type="button" className={`nb ${moreNav.some(n=>n.id===view)||previewRole?"nb-active":""}`} onClick={() => setOpenDropdown(openDropdown === "more" ? null : "more")}>{lang === "en" ? "More ▾" : "Más ▾"}{previewRole && <span className="nb-preview-dot" aria-label="preview active">👁</span>}</button>
              <div className={`nav-dd-menu ${openDropdown === "more" ? "menu-open" : ""}`}>
                {moreNav.map(n=><button key={n.id} className={`dd-item ${view===n.id?"dd-active":""}`} onClick={()=>{setView(n.id);setOpenDropdown(null);}}>{n.icon} {n.label}{n.badge>0 && <span className="nb-badge">{n.badge}</span>}</button>)}
                {adminInfo.isGlobalAdmin && <>
                  {moreNav.length > 0 && <div className="dd-sep"/>}
                  <div className="dd-section-label">👁 {lang==='en'?'View as role':'Ver como rol'}</div>
                  {[
                    {value:'',               label:lang==='en'?'Global Admin':'Admin global'},
                    {value:'delegate_admin',  label:lang==='en'?'Delegate Admin':'Admin delegado'},
                    {value:'user',            label:lang==='en'?'Owner/User':'Propietario/Usuario'},
                  ].map(opt=>(
                    <button key={opt.value||'ga'} type="button"
                      className={`dd-item dd-radio ${(previewRole||'')=== opt.value?'dd-radio-on':''}`}
                      onClick={()=>{setPreviewRole(opt.value||null);setOpenDropdown(null);}}>
                      <span className="dd-radio-dot">{(previewRole||'')=== opt.value?'●':'○'}</span>
                      {opt.label}
                    </button>
                  ))}
                </>}
              </div>
            </div>}
          </nav>

          <div className="hdr-right">
            <LanguageSwitch lang={lang} setLang={setLang} />
            {user ? (
              <div className="profile-dd" onClick={e=>e.stopPropagation()}>
                <button type="button" className="profile-btn" title={user.email} onClick={() => setOpenDropdown(openDropdown === "profile" ? null : "profile")}>
                  {user.photo ? <img src={user.photo} className="uavatar-img" alt={user.avatar} referrerPolicy="no-referrer"/> : <div className="uavatar">{user.avatar}</div>}
                </button>
                <div className={`profile-menu ${openDropdown === "profile" ? "menu-open" : ""}`}>
                  <div className="profile-head">
                    <UserContact name={user.name} uid={user.uid} email={user.email} whatsapp={myListings[0]?.contact||''} apartments={myListings.map(l=>aptDisplay(l.apt,lang))} directory={contactProps.directory||new Map()} showToast={showToast} onEmail={contactProps.onEmail||(()=>{})} lang={lang}><strong>{user.name}</strong></UserContact>
                    <span>{user.email}</span>
                    <small>{myListings.length ? `${myListings.length} ${lang === 'en' ? (myListings.length>1?'listings':'listing') : ('apto' + (myListings.length>1?'s':''))}` : (lang === "en" ? "Visitor" : "Visitante")}</small>
                  </div>
                  <button className="dd-item" onClick={()=>{setView('profile');setOpenDropdown(null);}}>{lang === "en" ? "👤 My profile" : "👤 Mi perfil"}</button>
                  <button className="dd-item" onClick={()=>{setView('my');setOpenDropdown(null);}}>🔑 {t.nav.my}</button>
                  {effectiveIsGlobalAdmin && <button className="dd-item" onClick={()=>{setView('admin');setOpenDropdown(null);}}>⚙️ {t.nav.admin}</button>}
                  {(effectiveIsGlobalAdmin || analyticsEnabledForAll) && <button className="dd-item" onClick={()=>{setView('analytics');setOpenDropdown(null);}}>📈 {t.nav.analytics}</button>}
                  {adminInfo.isGlobalAdmin && <div className="profile-view-as"><span>👁 {lang==='en'?'View as:':'Ver como:'}</span><select className="view-as-select" value={previewRole||''} onChange={e=>{setPreviewRole(e.target.value||null);setOpenDropdown(null);}}><option value="">{lang==='en'?'Global Admin':'Admin global'}</option><option value="delegate_admin">{lang==='en'?'Delegate Admin':'Admin delegado'}</option><option value="user">{lang==='en'?'Owner/User':'Propietario/Usuario'}</option></select></div>}
                  <button className="dd-item danger" onClick={()=>{setOpenDropdown(null);logout();}}>{lang === "en" ? "🚪 Log out" : "🚪 Cerrar sesión"}</button>
                </div>
              </div>
            ) : (
              <button className="btn-google" onClick={login}><GoogleIcon/> {lang === "en" ? "Sign in with Google" : "Ingresar con Google"}</button>
            )}
          </div>
        </div>
        <div className="mob-nav">
          {NAV.map(n=>(
            <button key={n.id} className={`mbn ${view===n.id?"mbn-active":""}`} onClick={()=>{setView(n.id);setOpenDropdown(null);}}>
              <span>{n.icon}</span><span>{n.label}</span>
              {n.badge>0 && <span className="mbn-badge">{n.badge}</span>}
            </button>
          ))}
        </div>
      </header>
      {adminInfo.isGlobalAdmin && previewRole && (
        <div className="role-preview-banner" role="alert" aria-live="polite">
          <span>⚠️ {lang==='en' ? `Viewing as: ${PREVIEW_ROLE_LABELS.en[previewRole]} — This is a preview only` : `Vista previa como: ${PREVIEW_ROLE_LABELS.es[previewRole]} — Esto es solo una vista previa`}</span>
          <button type="button" onClick={()=>setPreviewRole(null)}>{lang==='en'?'Exit preview':'Salir de vista previa'}</button>
        </div>
      )}
      <main className="main">
        {view==="dashboard" && <Dashboard lang={lang} listings={listings} incidents={incidents} user={user} contactProps={contactProps} setView={setView} showBlacklist={false} onReport={()=>{ if(!user){login();return;} setModal({type:"incident"}); }} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} effectiveRole={effectiveRole} delegatePerms={delegatePerms} pendingOwner={needsOwnerVerification.length} pendingResolve={needsAdminResolution.length} pendingRegistrations={effectiveCanManageRegistrations ? pendingRegistrations.length : 0} canResolve={canResolveIncidentsNow} canManageRegistrations={effectiveCanManageRegistrations} onOwnerClick={()=>{setIncidentQuickFilter('ownerVerification');setView('incidents');}} onResolveClick={()=>{setIncidentQuickFilter('requiresResolution');setView('incidents');}} onRegistrationsClick={()=>setView('approvals')} />}
        {view==="about" && <CommunityMissionView lang={lang} config={adminInfo.config} />}
        {view==="listings"  && <ListingsView lang={lang} listings={listings} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canEditGlobal={delegatePerms.canUpdateGlobalListings} canDeleteGlobal={delegatePerms.canDeleteGlobalListings} canResolveGlobal={canResolveIncidentsNow} floorOpenState={listingFloorOpen} onFloorToggle={toggleListingFloor} onAdd={()=>{ if(!user){login();return;} setModal({type:"addListing"}); }} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>{ if(!user){login();return;} setModal({type:"incident",data:{aptId:l.id}}); }} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onResolve={resolveIncident} />}
        {view==="incidents" && <IncidentsView lang={lang} incidents={incidents} listings={listings} user={user} quickFilter={incidentQuickFilter} onQuickFilterApplied={()=>setIncidentQuickFilter(null)} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canUpdateGlobal={delegatePerms.canUpdateGlobalIncidents} canDeleteGlobal={delegatePerms.canDeleteGlobalIncidents} canResolveGlobal={canResolveIncidentsNow} onAdd={()=>{ if(!user){login();return;} setModal({type:"incident"}); }} onResolve={resolveIncident} onDelete={deleteIncident} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} />}
        {view==="notifications" && user && <NotificationsView lang={lang} notifications={notifications} incidents={incidents} listings={listings} contactProps={contactProps} onRead={markNotificationRead} onReadAll={markAllNotificationsRead} smartAlerts={smartAlerts} />}
        {view==="approvals" && user && effectiveCanManageRegistrations && <PendingApprovalsView lang={lang} pending={pendingRegistrations} onApprove={id=>reviewRegistrationAction(id,'approve')} onDecline={id=>reviewRegistrationAction(id,'decline')} active={activeRegistrations} />}
        {view==="analytics" && user && (effectiveIsGlobalAdmin || analyticsEnabledForAll) && <AnalyticsDashboard lang={lang} user={user} contactProps={contactProps} showToast={showToast} isGlobalAdmin={effectiveIsGlobalAdmin} />}
        {view==="admin" && user && (effectiveIsGlobalAdmin ? <ErrorBoundary section="admin" fallback={(err)=><AdminFallback lang={lang} error={err}/>}><AdminSettings config={adminInfo.config || {}} user={user} listings={listings} contactProps={contactProps} onSave={saveAdminConfig} showToast={showToast} lang={lang} /></ErrorBoundary> : <AdminAccessHelp user={user} adminInfo={adminInfo} lang={lang} />)}
        {view==="my" && user && <MyListings lang={lang} listings={myListings} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canResolveGlobal={canResolveIncidentsNow} onAdd={()=>setModal({type:"addListing"})} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>setModal({type:"incident",data:{aptId:l.id}})} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onResolve={resolveIncident} />}
        {view==="profile" && user && <ProfileView lang={lang} user={user} userProfile={userProfile} onSave={saveProfile} />}
        {view==="help" && <HelpView lang={lang} effectiveRole={effectiveRole} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} delegatePerms={delegatePerms} listings={listings} incidents={incidents} user={user} setView={setView} onReport={()=>{ if(!user){login();return;} setModal({type:'incident'}); }} onAddListing={()=>{ if(!user){login();return;} setModal({type:'addListing'}); }} setIncidentQuickFilter={setIncidentQuickFilter} openMore={()=>setOpenDropdown('more')} />}
      </main>

      {/* LoginModal removed — Google popup handles auth directly */}
      {modal?.type==="addListing" && <ListingModal title={appText(lang,"listings.add")} lang={lang} config={adminInfo.config} user={user} onSave={addListing} onClose={()=>setModal(null)} />}
      {modal?.type==="editListing" && <ListingModal title={lang === "en" ? "Edit apartment" : "Editar apartamento"} lang={lang} config={adminInfo.config} user={user} initial={modal.data} onSave={d=>editListing(modal.data.id, modal.data.ownerUid, d)} onClose={()=>setModal(null)} />}
      {modal?.type==="incident" && <IncidentModal lang={lang} config={adminInfo.config} listings={listings} user={user} presetApt={modal.data?.aptId} onSave={addIncident} onClose={()=>setModal(null)} />}
      {modal?.type==="verifyIncident" && <VerifyIncidentModal lang={lang} config={adminInfo.config} incident={modal.data} onSave={payload=>verifyIncident(modal.data.id,payload)} onClose={()=>setModal(null)} />}
      {modal?.type==="sendUserEmail" && <SendUserEmailModal lang={lang} contact={modal.data} fromUser={user} onSend={sendUserEmail} onClose={()=>setModal(null)} />}

      {syncing && <div className="sync-overlay"><div className="spinner-sm"/><span>{lang === "en" ? "Saving to server..." : "Guardando en servidor..."}</span></div>}
      {toast && <div className={`toast ${toast.err?"toast-err":""}`}>{toast.msg}</div>}
    </div>
  );
}



const SMART_TONE_COLOR = { owner:'#c49a14', resolve:'#d96c1a', registration:'#2f6fbf', notice:'#6b44b8', serious:'#c0281e' };

// ─── HELP CONTENT ─────────────────────────────────────────────────────────────
const HL = (es, en) => ({ es, en });
const HELP_TOPICS = [
  {
    id:'start', icon:'🚀', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Primeros pasos','Getting started'),
    summary:HL('Cómo ingresar, registrar tu apartamento y entender tu rol en la app.','How to sign in, register your apartment, and understand your role in the app.'),
    sections:[
      { h:HL('¿Qué es KAI Owners App?','What is KAI Owners App?'),
        b:HL('KAI Owners App es la plataforma privada de los propietarios del edificio KAI. Centraliza el registro de apartamentos, el reporte de incidentes con huéspedes y la comunicación entre propietarios y administración.','KAI Owners App is the private platform for KAI building owners. It centralizes apartment registration, guest incident reporting, and communication between owners and building management.')},
      { h:HL('Ingreso con Google','Signing in with Google'),
        b:HL('La app usa exclusivamente Google Sign-In — no hay contraseñas separadas. Al hacer clic en "Ingresar con Google" selecciona la cuenta de Gmail que usas para gestionar tus apartamentos en KAI.','The app uses Google Sign-In only — there are no separate passwords. When you click "Sign in with Google" select the Gmail account you use to manage your KAI apartments.')},
      { h:HL('Visitante vs. propietario aprobado','Visitor vs. approved owner'),
        b:HL('Al ingresar por primera vez eres "Visitante". Para participar plenamente debes registrar tu(s) apartamento(s) y esperar que el administrador global apruebe tu solicitud. Una vez aprobado tendrás acceso a Reportes, Avisos y tus propiedades.','When you first sign in you appear as a "Visitor". To fully participate you need to register your apartment(s) and wait for the global admin to approve your request. Once approved you will have access to Reports, Alerts, and your listings.')},
    ]
  },
  {
    id:'listings', icon:'🏠', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Mis apartamentos','My apartments'),
    summary:HL('Agregar, editar y gestionar tus apartamentos registrados en el edificio.','Add, edit, and manage your registered apartments in the building.'),
    sections:[
      { h:HL('Agregar un apartamento','Adding an apartment'),
        b:HL('Ve a "Mis propiedades" y haz clic en "+ Agregar". Completa el número de 3 dígitos del apartamento (ej. 501), torre (KAI por defecto), habitaciones, máximo de huéspedes, tu WhatsApp de contacto y tu email de notificaciones. El WhatsApp es obligatorio.','Go to "My listings" and click "+ Add". Fill in the 3-digit apartment number (e.g. 501), tower (KAI by default), rooms, maximum guests, your contact WhatsApp and your notification email. WhatsApp is required.')},
      { h:HL('Editar un apartamento','Editing an apartment'),
        b:HL('Desde "Mis propiedades" o "Apartamentos", haz clic en el ícono de editar en la tarjeta. Puedes actualizar el operador, email y WhatsApp en cualquier momento. El número de apartamento no puede cambiarse una vez registrado.','From "My listings" or "Apartments", click the edit icon on the card. You can update the operator, email and WhatsApp at any time. The apartment number cannot be changed once registered.')},
      { h:HL('Operador de apartamento','Apartment operator'),
        b:HL('El operador es opcional. Es la persona que gestiona el arriendo en tu nombre. Si lo agregas, su email recibirá notificaciones de incidentes y recordatorios de SLA para que pueda actuar sin necesidad de contactarte directamente.','The operator is optional. They manage rentals on your behalf. If added, their email receives incident notifications and SLA reminders so they can act without contacting you directly.')},
    ]
  },
  {
    id:'incidents', icon:'⚠️', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Reportar un incidente','Reporting an incident'),
    summary:HL('Cómo documentar un problema con huéspedes de forma objetiva y completa.','How to objectively and completely document a guest problem.'),
    sections:[
      { h:HL('¿Qué es un incidente?','What is an incident?'),
        b:HL('Un incidente es cualquier situación problemática con huéspedes: ruido excesivo, daños a áreas comunes, violaciones de normas del edificio, problemas de limpieza, etc. Documentarlos crea un historial compartido que ayuda a todos los propietarios.','An incident is any problematic situation involving guests: excessive noise, damage to common areas, building rule violations, cleaning issues, etc. Documenting them creates a shared history that helps all owners.')},
      { h:HL('Llenar el formulario','Filling the form'),
        b:HL('Haz clic en "Reportar incidente" desde cualquier vista. Debes especificar: apartamento, fecha, tipo (ruido, daños, normas, limpieza…), categoría de seguimiento y una descripción objetiva. El administrador confirmará luego el nombre del huésped, ciudad y país.','Click "Report incident" from any view. You must specify: apartment, date, type (noise, damage, rules, cleaning…), tracking category and an objective description. The admin will later confirm the guest name, city and country.')},
      { h:HL('Categorías de seguimiento','Tracking categories'),
        b:HL('Serio: casos graves de atención prioritaria (daños mayores, comportamiento peligroso). En observación: situaciones a monitorear que podrían escalar. Menor: incidentes leves documentados como referencia futura.','Serious: critical cases requiring priority attention (major damage, dangerous behaviour). Under watch: situations to monitor that may escalate. Minor: mild incidents documented as future reference.')},
    ]
  },
  {
    id:'workflow', icon:'🔄', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Ciclo de vida del incidente','Incident lifecycle'),
    summary:HL('El flujo de tres etapas: Abierto → Verificado por propietario → Resuelto por admin.','The three-stage flow: Open → Verified by owner → Resolved by admin.'),
    sections:[
      { h:HL('Etapa 1 — Abierto','Stage 1 — Open'),
        b:HL('Un administrador reporta el incidente con apartamento, fecha, tipo, categoría y descripción. El propietario del apartamento recibe una notificación para estar al tanto.','An admin reports the incident with apartment, date, type, category and description. The apartment owner receives a notification to stay informed.')},
      { h:HL('Etapa 2 — Verificado por propietario','Stage 2 — Verified by owner'),
        b:HL('Antes de cerrarse, el propietario confirma los datos del huésped: nombre, ciudad y país, y puede agregar comentarios. Esta verificación garantiza que la información sea precisa y que el propietario esté de acuerdo con el reporte.','Before closing, the owner confirms the guest details: name, city and country, and can add comments. This verification ensures accuracy and that the owner agrees with the report.')},
      { h:HL('Etapa 3 — Resuelto','Stage 3 — Resolved'),
        b:HL('Solo un administrador global o delegado autorizado puede cerrar el incidente, y solo después de la verificación del propietario. La resolución requiere comentarios sobre qué acción se tomó. Todos los incidentes resueltos quedan en el historial.','Only a global admin or authorized delegate can close the incident, and only after the owner verifies. Resolution requires comments about what action was taken. All resolved incidents remain in the history.')},
    ]
  },
  {
    id:'verify', icon:'✅', category:'incidents', roles:['user','delegate_admin','global_admin'],
    title:HL('Verificar un incidente','Verifying an incident'),
    summary:HL('Como propietario, cómo confirmar la información antes de que el incidente pueda resolverse.','As an owner, how to confirm information before an incident can be resolved.'),
    sections:[
      { h:HL('¿Por qué verificar?','Why verify?'),
        b:HL('Tu verificación confirma que reconoces el incidente y que los datos del huésped son correctos. Sin tu verificación el administrador no puede cerrar el caso. Esto asegura que ningún incidente se resuelva sin tu conocimiento.','Your verification confirms you acknowledge the incident and the guest data is correct. Without your verification the admin cannot close the case. This ensures no incident is resolved without your knowledge.')},
      { h:HL('Cómo verificar','How to verify'),
        b:HL('Cuando tengas un incidente pendiente verás una alerta ámbar en la campana de notificaciones inteligentes. En Reportes el incidente mostrará el botón "Verificar". Haz clic, confirma el nombre del huésped, ciudad y país, agrega comentarios opcionales y guarda.','When you have a pending incident you\'ll see an amber alert in the smart notifications bell. In Reports the incident shows a "Verify" button. Click it, confirm guest name, city and country, add optional comments, and save.')},
    ]
  },
  {
    id:'notifications', icon:'🔔', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Avisos y notificaciones','Alerts and notifications'),
    summary:HL('Cómo funcionan los avisos automáticos y cómo marcarlos como leídos.','How automatic alerts work and how to mark them as read.'),
    sections:[
      { h:HL('¿Cuándo recibes avisos?','When do you receive alerts?'),
        b:HL('Recibes avisos cuando: se reporta un incidente en tu apartamento, el incidente es verificado o resuelto, tu solicitud de registro es aprobada o rechazada, o la administración te envía un mensaje.','You receive alerts when: an incident is reported in your apartment, the incident is verified or resolved, your registration request is approved or declined, or management sends you a message.')},
      { h:HL('Leer y marcar como leído','Reading and marking as read'),
        b:HL('Ve a Notificaciones (campana 🔔) en el menú. La página muestra las acciones prioritarias arriba y el historial completo de avisos abajo. Los no leídos aparecen marcados. Usa "Marcar todos como leídos" para limpiar la bandeja de una vez.','Go to Notifications (bell 🔔) in the menu. The page shows priority actions at the top and the full alert history below. Unread alerts appear highlighted. Use "Mark all as read" to clear the inbox at once.')},
    ]
  },
  {
    id:'smart', icon:'🎯', category:'basics', roles:['user','delegate_admin','global_admin'],
    title:HL('Notificaciones inteligentes','Smart notifications'),
    summary:HL('El panel de la campana que muestra las acciones prioritarias según tu rol actual.','The bell panel showing priority actions based on your current role.'),
    sections:[
      { h:HL('¿Cómo acceder?','How to access?'),
        b:HL('Haz clic en la campana (🔔) en la barra de navegación para ir directamente a la página de Notificaciones. El número rojo en el ícono muestra el total de ítems pendientes de acción.','Click the bell (🔔) in the navigation bar to go directly to the Notifications page. The red number on the icon shows the total items that need action.')},
      { h:HL('Tipos de alertas y sus colores','Alert types and their colours'),
        b:HL('Ámbar — Verificación de propietario: incidentes de tus apartamentos que necesitan tu confirmación. Naranja — Listos para resolver: incidentes verificados esperando acción admin. Azul — Registros pendientes: solicitudes de nuevos propietarios. Morado — Avisos sin leer. Rojo — Incidentes serios abiertos en la comunidad.','Amber — Owner verification: your apartment incidents needing confirmation. Orange — Ready to resolve: verified incidents awaiting admin action. Blue — Pending registrations: new owner requests. Purple — Unread alerts. Red — Serious incidents still open in the community.')},
      { h:HL('Acciones directas','Direct actions'),
        b:HL('Hacer clic en cualquier alerta te lleva directamente a la vista correcta con los filtros aplicados. No necesitas navegar manualmente — el sistema te posiciona exactamente donde debes actuar.','Clicking any alert takes you directly to the right view with filters already applied. You do not need to navigate manually — the system positions you exactly where you need to act.')},
    ]
  },
  {
    id:'contact', icon:'👤', category:'account', roles:['user','delegate_admin','global_admin'],
    title:HL('Tarjetas de contacto','Contact cards'),
    summary:HL('Cómo ver y usar la información de contacto al pasar el mouse sobre un nombre.','How to view and use contact info by hovering over a name.'),
    sections:[
      { h:HL('¿Qué son las tarjetas de contacto?','What are contact cards?'),
        b:HL('En toda la app los nombres de propietarios aparecen subrayados con puntos. Al posicionarte sobre un nombre (o tocar en móvil), aparece una tarjeta con su email, WhatsApp y apartamentos registrados.','Throughout the app owner names appear with a dotted underline. Hovering (or tapping on mobile) shows a card with their email, WhatsApp and registered apartments.')},
      { h:HL('Acciones disponibles','Available actions'),
        b:HL('📋 Copiar: copia el email o número al portapapeles. ✉️ Email: abre tu aplicación de correo para enviar un mensaje. 💬 WhatsApp: abre WhatsApp con el número pre-cargado listo para enviar un mensaje. La tarjeta desaparece al mover el mouse fuera.','📋 Copy: copies email or number to clipboard. ✉️ Email: opens your mail app to send a message. 💬 WhatsApp: opens WhatsApp with the number pre-loaded ready to send. The card closes when you move the mouse away.')},
      { h:HL('Tu propio nombre','Your own name'),
        b:HL('En el menú de perfil (tu avatar arriba a la derecha) también puedes ver tu propia información de contacto al pasar el mouse sobre tu nombre. Útil para verificar qué datos tuyos ven los demás propietarios.','In the profile menu (your avatar top right) you can also see your own contact info by hovering your name. Useful for checking what information other owners see about you.')},
    ]
  },
  {
    id:'resolve', icon:'🛠️', category:'incidents', roles:['delegate_admin','global_admin'],
    title:HL('Resolver incidentes','Resolving incidents'),
    summary:HL('Cómo cerrar un incidente verificado como administrador o delegado autorizado.','How to close a verified incident as an admin or authorized delegate.'),
    sections:[
      { h:HL('Requisitos para resolver','Requirements to resolve'),
        b:HL('Para resolver necesitas: (1) permiso de resolución (administrador global o delegado autorizado), (2) que el propietario haya verificado el incidente previamente, y (3) agregar comentarios explicando la acción tomada — son obligatorios.','To resolve you need: (1) resolve permission (global admin or authorized delegate), (2) the owner must have previously verified the incident, and (3) add comments explaining the action taken — these are required.')},
      { h:HL('Cómo resolver','How to resolve'),
        b:HL('En Reportes los incidentes listos para resolver muestran el botón "Resolver". Haz clic, escribe los comentarios de resolución, y confirma. El incidente pasará a Resuelto y todos los involucrados recibirán un aviso automático.','In Reports, incidents ready to resolve show a "Resolve" button. Click it, write the resolution comments, and confirm. The incident moves to Resolved and everyone involved receives an automatic alert.')},
    ]
  },
  {
    id:'approvals', icon:'📝', category:'admin', roles:['delegate_admin','global_admin'],
    title:HL('Aprobar registros','Approving registrations'),
    summary:HL('Cómo revisar y aprobar o rechazar solicitudes de nuevos propietarios.','How to review and approve or decline new owner requests.'),
    sections:[
      { h:HL('¿Qué es un registro pendiente?','What is a pending registration?'),
        b:HL('Cuando un nuevo usuario inicia sesión y registra sus apartamentos, la solicitud queda pendiente hasta que la apruebes o rechaces. Solo los propietarios aprobados tienen acceso completo a la comunidad.','When a new user signs in and registers their apartments, the request stays pending until you approve or decline it. Only approved owners have full access to the community.')},
      { h:HL('Proceso de revisión','Review process'),
        b:HL('Ve a "Registros" en el menú. Verás las solicitudes pendientes con nombre, email y apartamentos solicitados. Puedes aprobar (acceso inmediato) o rechazar (el usuario recibe un email y puede reintentar). Si rechazas, se recomienda agregar un motivo.','Go to "Registrations" in the menu. You\'ll see pending requests with name, email and requested apartments. You can approve (immediate access) or decline (user receives an email and can retry). Adding a reason when declining is recommended.')},
    ]
  },
  {
    id:'users', icon:'👥', category:'admin', roles:['global_admin'],
    title:HL('Gestionar usuarios','Managing users'),
    summary:HL('Asignar roles y configurar permisos globales de administradores delegados.','Assigning roles and configuring global delegate admin permissions.'),
    sections:[
      { h:HL('Roles disponibles','Available roles'),
        b:HL('Usuario estándar: propietario aprobado con acceso a sus propiedades e incidentes. Administrador delegado: puede gestionar incidentes y aprobar registros según los permisos globales configurados. Administrador global: acceso completo, configurado mediante GLOBAL_ADMIN_EMAILS en el servidor.','Standard user: approved owner with access to their properties and incidents. Delegate admin: can manage incidents and approve registrations based on configured global permissions. Global admin: full access, configured via GLOBAL_ADMIN_EMAILS on the server.')},
      { h:HL('Permisos del delegado','Delegate permissions'),
        b:HL('En Admin → "Permisos predeterminados del delegado" configura qué pueden hacer todos los delegados: aprobar/rechazar registros, resolver incidentes, editar/eliminar listings e incidentes globales. Todos los delegados heredan exactamente esta configuración — no hay permisos individuales.','In Admin → "Default delegate permissions" configure what all delegates can do: approve/decline registrations, resolve incidents, edit/delete global listings and incidents. All delegates inherit exactly these settings — there are no individual overrides.')},
    ]
  },
  {
    id:'settings', icon:'⚙️', category:'admin', roles:['global_admin'],
    title:HL('Configuración de Admin','Admin settings'),
    summary:HL('SLA de incidentes, emails de escalación, analíticas, misión y tooltips personalizados.','Incident SLA, escalation emails, analytics, mission content and custom tooltips.'),
    sections:[
      { h:HL('SLA de incidentes','Incident SLA'),
        b:HL('Define cuántas horas tiene el administrador para resolver un incidente verificado antes de que se envíe una notificación de escalación. El temporizador empieza cuando el propietario verifica. El valor predeterminado es 48 horas.','Defines how many hours the admin has to resolve a verified incident before an escalation notification fires. The timer starts when the owner verifies. The default is 48 hours.')},
      { h:HL('Emails de escalación y analíticas','Escalation emails and analytics'),
        b:HL('Los emails de escalación reciben avisos cuando un incidente supera el SLA sin resolverse. También puedes activar o desactivar el acceso a analíticas para todos los usuarios aprobados sin necesidad de redesplegar la app.','Escalation emails receive notifications when an incident exceeds SLA without being resolved. You can also toggle analytics access for all approved users without needing to redeploy the app.')},
      { h:HL('Misión y tooltips','Mission and tooltips'),
        b:HL('Edita el texto de misión y los valores que aparecen en la pantalla de bienvenida directamente desde el admin. También puedes personalizar los textos de ayuda (tooltips) que aparecen al pasar el mouse sobre campos del formulario.','Edit the mission text and values shown on the welcome screen directly from admin. You can also customise the help tooltip texts shown when hovering over form fields.')},
    ]
  },
  {
    id:'analytics', icon:'📊', category:'admin', roles:['global_admin'],
    title:HL('Analíticas','Analytics'),
    summary:HL('Tendencias de incidentes, tipos frecuentes, actividad por apartamento y tiempos de resolución.','Incident trends, frequent types, activity by apartment, and resolution times.'),
    sections:[
      { h:HL('¿Qué muestra Analytics?','What does Analytics show?'),
        b:HL('Incidentes por tipo (ruido, daños, normas…), distribución por categoría (serio/observación/menor), actividad por apartamento y tendencias en el tiempo. El rango de fechas es configurable. Los administradores globales siempre tienen acceso; para otros usuarios se activa desde el panel de Admin.','Incidents by type (noise, damage, rules…), distribution by category (serious/watch/minor), activity by apartment, and trends over time. The date range is configurable. Global admins always have access; for other users it is toggled from the Admin panel.')},
    ]
  },
  {
    id:'viewas', icon:'👁️', category:'admin', roles:['global_admin'],
    title:HL('Ver como (Vista previa de rol)','View As (Role preview)'),
    summary:HL('Simular la experiencia de otro rol sin cambiar tu cuenta ni afectar datos reales.','Simulate another role\'s experience without changing your account or affecting real data.'),
    sections:[
      { h:HL('¿Para qué sirve?','What is it for?'),
        b:HL('Como administrador global puedes simular cómo ve la app un administrador delegado o un propietario estándar. Útil para verificar que los permisos y la navegación funcionen correctamente antes de agregar nuevos usuarios.','As a global admin you can simulate how a delegate admin or standard owner sees the app. Useful for verifying that permissions and navigation work correctly before adding new users.')},
      { h:HL('Cómo usarlo','How to use it'),
        b:HL('En el menú "More ▾" en la barra de navegación, busca la sección "Ver como rol". Selecciona el rol que quieres simular. Un ícono 👁 aparece en el botón "More" indicando que estás en modo previsualización. Para regresar a tu vista normal, selecciona "Admin global".','In the "More ▾" navigation menu, find the "View as role" section. Select the role to simulate. A 👁 icon appears on the "More" button indicating preview mode is active. To return to your normal view, select "Global Admin".')},
    ]
  },
];

// ─── HELP ACTIONS (topic-id → CTA buttons) ────────────────────────────────────
// Each action: { label:HL(), icon, primary, fn(handlers) }
// handlers = { setView, onReport, onAddListing, setQuickFilter }
const HELP_ACTIONS = {
  start:        [{ label:HL('Ver mis propiedades','View my listings'),          icon:'🏠', primary:true,  fn:h=>h.setView('my') }],
  listings:     [{ label:HL('Mis propiedades','My listings'),                   icon:'🔑', primary:true,  fn:h=>h.setView('my') },
                 { label:HL('Agregar apartamento','Add apartment'),             icon:'➕', primary:false, fn:h=>h.onAddListing() }],
  incidents:    [{ label:HL('Reportar incidente','Report incident'),            icon:'⚠️', primary:true,  fn:h=>h.onReport() },
                 { label:HL('Ver todos los reportes','View all reports'),       icon:'📋', primary:false, fn:h=>h.setView('incidents') }],
  workflow:     [{ label:HL('Ver reportes','View reports'),                     icon:'📋', primary:true,  fn:h=>h.setView('incidents') }],
  verify:       [{ label:HL('Ver mis pendientes de verificación','View my pending verifications'), icon:'✅', primary:true, fn:h=>{ h.setQuickFilter('ownerVerification'); h.setView('incidents'); } }],
  notifications:[{ label:HL('Ver mis avisos','View my alerts'),                 icon:'🔔', primary:true,  fn:h=>h.setView('notifications') }],
  smart:        [{ label:HL('Ver avisos','View alerts'),                        icon:'🔔', primary:true,  fn:h=>h.setView('notifications') }],
  resolve:      [{ label:HL('Ver listos para resolver','View ready to resolve'),icon:'🛠️', primary:true,  fn:h=>{ h.setQuickFilter('requiresResolution'); h.setView('incidents'); } }],
  approvals:    [{ label:HL('Ir a registros','Go to registrations'),            icon:'📝', primary:true,  fn:h=>h.setView('approvals') }],
  users:        [{ label:HL('Gestionar usuarios','Manage users'),               icon:'👥', primary:true,  fn:h=>h.setView('admin') }],
  settings:     [{ label:HL('Ir a configuración','Go to Admin settings'),       icon:'⚙️', primary:true,  fn:h=>h.setView('admin') }],
  analytics:    [{ label:HL('Ver analíticas','View analytics'),                 icon:'📊', primary:true,  fn:h=>h.setView('analytics') }],
  viewas:       [{ label:HL('Abrir menú "Más"','Open the "More" menu'),         icon:'👁️', primary:false, fn:h=>h.openMore() }],
};

// ─── HELP VIEW ────────────────────────────────────────────────────────────────
function HelpView({ lang, effectiveRole, effectiveIsGlobalAdmin, listings=[], incidents=[], user,
                    setView=()=>{}, onReport=()=>{}, onAddListing=()=>{}, setIncidentQuickFilter=()=>{}, openMore=()=>{} }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const L = s => s?.[lang === 'en' ? 'en' : 'es'] ?? '';
  const role = effectiveIsGlobalAdmin ? 'global_admin' : (effectiveRole || 'user');
  const topics = HELP_TOPICS.filter(t => t.roles.includes(role));
  const filtered = topics.filter(t => {
    if (category !== 'all' && t.category !== category) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return L(t.title).toLowerCase().includes(q) || L(t.summary).toLowerCase().includes(q) ||
      t.sections.some(s => L(s.h).toLowerCase().includes(q) || L(s.b).toLowerCase().includes(q));
  });
  const CATS = [
    { id:'all', icon:'🔍', label:HL('Todo','All') },
    { id:'basics', icon:'📖', label:HL('Básicos','Basics') },
    { id:'incidents', icon:'⚠️', label:HL('Incidentes','Incidents') },
    { id:'admin', icon:'⚙️', label:HL('Admin','Admin') },
    { id:'account', icon:'👤', label:HL('Cuenta','Account') },
  ].filter(c => c.id === 'all' || topics.some(t => t.category === c.id));
  const handlers = { setView, onReport, onAddListing, setQuickFilter: setIncidentQuickFilter, openMore };

  if (selected) {
    const t = selected;
    const actions = (HELP_ACTIONS[t.id] || []).filter(a => {
      // hide admin-only actions for non-admins
      if ((t.id==='approvals'||t.id==='users'||t.id==='settings'||t.id==='analytics') && !effectiveIsGlobalAdmin && role!=='delegate_admin') return false;
      return true;
    });
    return (
      <div className="fade">
        <button className="btn-ghost" style={{marginBottom:18}} onClick={() => setSelected(null)}>
          ← {lang === 'en' ? 'Back to Help' : 'Volver a Ayuda'}
        </button>
        <div className="card help-article">
          <div className="help-article-hdr">
            <span className="help-article-icon">{t.icon}</span>
            <div>
              <h1 className="ptitle" style={{margin:0,fontSize:'1.55rem'}}>{L(t.title)}</h1>
              <p className="psub" style={{margin:'6px 0 0'}}>{L(t.summary)}</p>
            </div>
          </div>
          {t.sections.map((s, i) => (
            <div key={i} className="help-section">
              <h3 className="help-section-h">{L(s.h)}</h3>
              <p className="help-section-b">{L(s.b)}</p>
            </div>
          ))}
          {actions.length > 0 && (
            <div className="help-actions">
              <span className="help-actions-label">{lang==='en'?'Quick actions':'Acciones rápidas'}</span>
              <div className="help-actions-row">
                {actions.map((a,i) => (
                  <button key={i}
                    className={a.primary ? 'btn-p help-action-btn' : 'btn-ghost help-action-btn'}
                    onClick={() => a.fn(handlers)}>
                    {a.icon} {L(a.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="help-article-foot">
            <button className="btn-ghost" onClick={() => setSelected(null)}>← {lang === 'en' ? 'Back to Help' : 'Volver a Ayuda'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade">
      <div className="ph" style={{alignItems:'flex-end'}}>
        <div>
          <h1 className="ptitle">❓ {lang === 'en' ? 'Help & Guide' : 'Ayuda y guía'}</h1>
          <p className="psub">{lang === 'en' ? 'Browse topics or search for any feature.' : 'Explora temas o busca cualquier función.'}</p>
        </div>
        <span className="help-topic-count">{filtered.length} {lang === 'en' ? (filtered.length===1?'topic':'topics') : (filtered.length===1?'tema':'temas')}</span>
      </div>
      <input className="search" type="search"
        placeholder={lang === 'en' ? '🔍  Search topics…' : '🔍  Buscar temas…'}
        value={query} onChange={e => setQuery(e.target.value)}
        style={{marginBottom:14,maxWidth:480,display:'block'}}
      />
      <div className="filter-row" style={{marginBottom:20}}>
        {CATS.map(c => (
          <button key={c.id} className={`fchip ${category === c.id ? 'fchip-on' : ''}`} onClick={() => setCategory(c.id)}>
            {c.icon} {L(c.label)}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="empty"><p>{lang === 'en' ? 'No topics match your search.' : 'Ningún tema coincide con tu búsqueda.'}</p></div>
        : <div className="help-grid">
            {filtered.map(t => (
              <button key={t.id} className="help-card" onClick={() => setSelected(t)}>
                <span className="help-card-icon">{t.icon}</span>
                <span className="help-card-body">
                  <strong>{L(t.title)}</strong>
                  <span>{L(t.summary)}</span>
                </span>
                <span className="help-card-arr">›</span>
              </button>
            ))}
          </div>
      }
    </div>
  );
}

function ActionStrip({ lang="es-CO", pendingOwner=0, pendingResolve=0, pendingRegistrations=0, canResolve=false, canManageRegistrations=false, onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{} }) {
  const items = [
    pendingOwner > 0 ? {
      key:'verify', icon:'✅',
      label: lang==='en' ? `${pendingOwner} to verify` : `${pendingOwner} por verificar`,
      sub: lang==='en' ? 'Owner verification' : 'Verificación requerida',
      onClick: onOwnerClick, cls:'ap-owner'
    } : null,
    pendingResolve > 0 && canResolve ? {
      key:'resolve', icon:'🛠️',
      label: lang==='en' ? `${pendingResolve} to resolve` : `${pendingResolve} por resolver`,
      sub: lang==='en' ? 'Ready to close' : 'Listos para cerrar',
      onClick: onResolveClick, cls:'ap-resolve'
    } : null,
    pendingRegistrations > 0 && canManageRegistrations ? {
      key:'reg', icon:'📝',
      label: lang==='en' ? `${pendingRegistrations} pending` : `${pendingRegistrations} pendiente${pendingRegistrations===1?'':'s'}`,
      sub: lang==='en' ? 'Registrations' : 'Registros',
      onClick: onRegistrationsClick, cls:'ap-reg'
    } : null,
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="action-strip" role="region" aria-label={lang==='en'?'Action items':'Acciones pendientes'}>
      {items.map(item => (
        <button key={item.key} type="button" className={`action-pill ${item.cls}`} onClick={item.onClick}>
          <span className="ap-icon">{item.icon}</span>
          <span className="ap-body"><strong>{item.label}</strong><span>{item.sub}</span></span>
        </button>
      ))}
    </div>
  );
}

function ActionNeededBanner({ lang="es-CO", ownerItems=[], resolveItems=[], onOwnerClick=()=>{}, onResolveClick=()=>{} }) {
  if (!ownerItems.length && !resolveItems.length) return null;
  return <div className="action-banner-wrap">
    {ownerItems.length > 0 && <div className="action-banner owner-action">
      <div><strong>✅ {appText(lang,'actions.ownerVerificationTitle')}</strong><span>{appText(lang,'actions.ownerVerificationMsg',{count:ownerItems.length})}</span></div>
      <button className="btn-action" onClick={onOwnerClick}>{appText(lang,'actions.viewMine')}</button>
    </div>}
    {resolveItems.length > 0 && <div className="action-banner resolve-action">
      <div><strong>🛠️ {appText(lang,'actions.resolveTitle')}</strong><span>{appText(lang,'actions.resolveMsg',{count:resolveItems.length})}</span></div>
      <button className="btn-action" onClick={onResolveClick}>{appText(lang,'actions.viewReports')}</button>
    </div>}
  </div>;
}


function RoleOutcomeGuide({ lang="es-CO", adminInfo={}, delegatePerms={}, ownerCount=0, pendingOwner=0, pendingResolve=0, onGo=()=>{} }) {
  const role = adminInfo.isGlobalAdmin ? 'global' : adminInfo.role === 'delegate_admin' ? 'delegate' : 'standard';
  const titleKey = role === 'global' ? 'roles.globalTitle' : role === 'delegate' ? 'roles.delegateTitle' : 'roles.standardTitle';
  const textKey = role === 'global' ? 'roles.globalText' : role === 'delegate' ? 'roles.delegateText' : 'roles.standardText';
  const actions = role === 'global'
    ? [{label:appText(lang,'roles.globalAction1'), view:'analytics'}, {label:appText(lang,'roles.globalAction2'), view:'admin'}]
    : role === 'delegate'
      ? [{label:appText(lang,'roles.delegateAction1'), view:'approvals'}, ...(delegatePerms.canResolveIncidents ? [{label:appText(lang,'roles.delegateAction2'), view:'incidents'}] : [])]
      : [{label:appText(lang,'roles.ownerAction1'), view:'incidents'}, {label:appText(lang,'roles.ownerAction2'), view:'my'}];
  return <div className="role-guide">
    <div><strong>{role === 'global' ? '🌐' : role === 'delegate' ? '🛡️' : '🏠'} {appText(lang,titleKey)}</strong><span>{appText(lang,textKey)}</span></div>
    <div className="role-actions"><span>{appText(lang,'roles.primaryActions')}:</span>{actions.map((a,i)=><button key={i} className="role-chip" onClick={()=>onGo(a.view)}>{a.label}</button>)}</div>
    <div className="role-metrics"><span>🏠 {ownerCount}</span>{pendingOwner>0&&<span>✅ {pendingOwner}</span>}{pendingResolve>0&&<span>🛠️ {pendingResolve}</span>}</div>
  </div>;
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────
function AuthGate({ onLogin, lang="es-CO", setLang=()=>{} }) {
  const t = getT(lang);
  return (
    <div className="app-shell gate-shell"><style>{CSS}</style>
      <div className="gate-card welcome-card">
        <div className="gate-lang"><LanguageSwitch lang={lang} setLang={setLang} /></div>
        <div className="welcome-brand">
          <img src="/morros-kai.png" className="welcome-logo" alt="Morros KAI"/>
          <div>
            <h1 className="ptitle">{t.loginTitle}</h1>
            <p className="psub">{t.loginSub}</p>
          </div>
        </div>
        <div className="welcome-hero">
          <p>{t.loginHero}</p>
        </div>
        <CommunityMissionCards compact lang={lang} config={{}} />
        <div className="login-rules">
          <h3>{t.rulesTitle}</h3>
          <ul>{t.rules.map((r,i)=><li key={i}>{r}</li>)}</ul>
        </div>
        <div className="first-access-box">
          <strong>{t.firstAccess}</strong> {t.firstAccessText}
        </div>
        <p className="secure-copy">{t.secure}</p>
        <div className="google-switch-help"><strong>{appText(lang,"login.switchGoogleTitle")}</strong><br/>{appText(lang,"login.switchGoogleHelp")}<br/><span>{appText(lang,"login.switchGoogleSteps")}</span></div>
        <button className="btn-google gate-btn" onClick={onLogin} title={appText(lang,"login.switchGoogleHelp")}><GoogleIcon/> {t.google}</button>
      </div>
    </div>
  );
}

function CommunityMissionCards({ compact=false, lang="es-CO", config={} }) {
  const m = localizeMissionSections(config, lang);
  const items = (m.cards || []).map(x=>({icon:x.icon,title:x.title,text:x.text}));
  return <div className={compact ? 'mission-grid mission-grid-compact' : 'mission-grid'}>{items.map((x,i)=><div key={i} className="mission-card"><div className="mission-icon">{x.icon}</div><div><h3>{x.title}</h3><p>{x.text}</p></div></div>)}</div>;
}

function CommunityMissionView({ lang="es-CO", config={} }) {
  const m = localizeMissionSections(config, lang);
  return (
    <div className="fade">
      <div className="ph"><div><h1 className="ptitle">{m.title}</h1><p className="psub">{m.subtitle}</p></div></div>
      <div className="card mission-main">
        <div className="welcome-brand inline-brand">
          <img src="/morros-kai.png" className="welcome-logo small" alt="Morros KAI"/>
          <div><div className="section-label">{m.sectionLabel}</div><h2>{m.heading}</h2><p>{m.body}</p></div>
        </div>
        <CommunityMissionCards lang={lang} config={config} />
      </div>
      <div className="two-col mission-two">
        <div className="card"><div className="card-hdr"><span className="card-title">{m.participationTitle}</span></div><ul className="rules-list">{(m.participationRules||[]).map((r,i)=><li key={i}>{r}</li>)}</ul></div>
        <div className="card"><div className="card-hdr"><span className="card-title">{m.accessTitle}</span></div><ul className="rules-list">{(m.accessRules||[]).map((r,i)=><li key={i}>{r}</li>)}</ul></div>
      </div>
    </div>
  );
}

function RegistrationGate({ user, registration, onSubmit, onLogout, syncing, toast, lang="es-CO", setLang=()=>{} }) {
  const t = getT(lang);
  const status = registration?.status || 'none';
  return (
    <div className="app-shell gate-shell"><style>{CSS}</style>
      <div className="gate-card gate-wide">
        <div className="gate-top"><div className="logo-mark"><span className="logo-k">K</span><span className="logo-wave">~</span></div><LanguageSwitch lang={lang} setLang={setLang} /><button className="btn-ghost" onClick={onLogout}>Salir</button></div>
        <h1 className="ptitle">Registro de propietario KAI</h1>
        <p className="psub">Hola {user.name}. Para usar la aplicación debes registrar uno o más apartamentos que son tuyos.</p>
        {status === 'pending' && <div className="status-box pending"><h3>⏳ Registro pendiente de aprobación</h3><p>Tu solicitud fue recibida. Un propietario aprobado revisará tus datos. Te enviaremos un email cuando cambie el estado.</p></div>}
        {status === 'declined' && <div className="status-box declined"><h3>🚫 Registro rechazado</h3><p><strong>Motivo:</strong> {registration.reason || 'No se indicó motivo.'}</p><p>Puedes corregir la información y enviar una nueva solicitud.</p><RegistrationListingForm user={user} onSubmit={onSubmit} submitText={lang === "en" ? "Resubmit registration" : "Reenviar registro"} lang={lang} /></div>}
        {(status === 'none' || status === 'error') && <RegistrationListingForm user={user} onSubmit={onSubmit} submitText={lang === "en" ? "Submit registration for approval" : "Enviar registro para aprobación"} lang={lang} />}
      </div>
      {syncing && <div className="sync-overlay"><div className="spinner-sm"/><span>{lang === "en" ? "Saving to server..." : "Guardando en servidor..."}</span></div>}
      {toast && <div className={`toast ${toast.err?"toast-err":""}`}>{toast.msg}</div>}
    </div>
  );
}

function RegistrationListingForm({ user, onSubmit, submitText, lang="es-CO" }) {
  const isEn = lang === 'en';
  const tips = localizedTooltips({}, lang); // default tooltips — no admin config available at registration time
  const makeBlank = () => ({ apt:'', tower:'KAI', rooms:'2', guests:4, operator:'', operatorEmail:'', operatorWhatsapp:'', airbnb:'' });
  const [items,setItems]=useState([makeBlank()]);
  const [whatsapp,setWhatsapp]=useState('');
  const [errors,setErrors]=useState({});
  const [checking,setChecking]=useState({});
  const setVal=(idx,k,v)=>{ setItems(rows=>rows.map((r,i)=>i===idx?{...r,[k]:v}:r)); setErrors(e=>({...e,[`${k}_${idx}`]:undefined})); };
  const checkApt=async(idx)=>{
    const apt=String(items[idx]?.apt||'').trim();
    if(!apt || !/^[0-9]{3}$/.test(apt)) return;
    const duplicatedLocal = items.some((row,i)=>i!==idx && String(row.apt||'').trim()===apt);
    if(duplicatedLocal){ setErrors(e=>({...e,[`apt_${idx}`]:appText(lang,'validation.aptDuplicateLocal')})); return; }
    setChecking(c=>({...c,[idx]:true}));
    try{
      const r = await checkApartmentUnique({ apt, ownerUid:user?.uid });
      if(!r.available) setErrors(e=>({...e,[`apt_${idx}`]:r.message || appText(lang,'validation.aptTaken')}));
    }catch(e){ setErrors(er=>({...er,[`apt_${idx}`]:appText(lang,'validation.aptCheckFailed')})); }
    finally{ setChecking(c=>({...c,[idx]:false})); }
  };
  const validate=()=>{
    const e={};
    // Profile validation — WhatsApp required
    if(!String(whatsapp||'').trim()) e.whatsapp = isEn ? 'WhatsApp is required' : 'WhatsApp es requerido';
    else { const waErr=validateWhatsApp(whatsapp,lang); if(waErr) e.whatsapp=waErr; }
    // Listing validation
    const seen={};
    items.forEach((f,i)=>{
      const apt=String(f.apt||'').trim();
      if(!apt) e[`apt_${i}`]=appText(lang,'validation.aptRequired');
      else if(!/^[0-9]{3}$/.test(apt)) e[`apt_${i}`]=appText(lang,'validation.aptFormat');
      else if(seen[apt]) e[`apt_${i}`]=appText(lang,'validation.aptDuplicateLocal');
      seen[apt]=true;
      if(!String(f.rooms||'').trim()) e[`rooms_${i}`]=appText(lang,'validation.roomsRequired');
      if(!f.guests || Number(f.guests)<1) e[`guests_${i}`]=appText(lang,'validation.capacityRequired');
      if(String(f.operatorEmail||'').trim() && !validateEmail(f.operatorEmail)) e[`operatorEmail_${i}`]=appText(lang,'validation.operatorEmailInvalid');
      const waOpErr=validateWhatsApp(f.operatorWhatsapp,lang); if(waOpErr) e[`operatorWhatsapp_${i}`]=waOpErr;
      if(f.airbnb && !/^https?:\/\/.+/i.test(String(f.airbnb).trim())) e[`airbnb_${i}`]=appText(lang,'validation.urlInvalid');
    });
    setErrors(prev=>({...prev,...e})); return Object.keys({...errors,...e}).filter(k=>({...errors,...e})[k]).length===0;
  };
  const cls=(k)=>errors[k]?'field-error':'';
  const optLabel = <span style={{color:"#70d6c6",fontStyle:"italic",textTransform:"none",letterSpacing:0,fontSize:"0.68rem"}}>({isEn?'optional':'opcional'})</span>;
  return <div>
    <div className="form-alert">{appText(lang,'modal.listing.registrationHelp')}</div>

    {/* ── Owner Profile ─────────────────────────────────────── */}
    <div className="reg-listing-box reg-profile-box">
      <div className="card-hdr"><span className="card-title">👤 {isEn?'Your contact information':'Tu información de contacto'}</span></div>
      <div className="fg2">
        <div className="fg full" style={{display:'flex',flexDirection:'column',gap:'6px',padding:'4px 0'}}>
          <div style={{fontSize:'.82rem',color:'#2a5a6a'}}><strong>{isEn?'Name:':'Nombre:'}</strong> {user?.name}</div>
          <div style={{fontSize:'.82rem',color:'#2a5a6a'}}><strong>Email:</strong> {user?.email}</div>
        </div>
        <div className="fg full">
          <label>WhatsApp <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
          <input className={cls('whatsapp')} type="tel" value={whatsapp} onChange={e=>{setWhatsapp(e.target.value);setErrors(er=>({...er,whatsapp:undefined}));}} onBlur={e=>{const v=String(e.target.value||'').trim();if(!v)setErrors(er=>({...er,whatsapp:isEn?'WhatsApp is required':'WhatsApp es requerido'}));else{const err=validateWhatsApp(v,lang);setErrors(er=>({...er,whatsapp:err||undefined}));}}} placeholder="+57 300 000 0000"/>
          {errors.whatsapp?<span className="err-msg">{errors.whatsapp}</span>:<span className="help-msg">{isEn?'Your WhatsApp with country code — used for all your listings':'Tu WhatsApp con código de país — se usará en todos tus listings'}</span>}
        </div>
      </div>
    </div>

    {/* ── Listings ──────────────────────────────────────────── */}
    {items.map((f,i)=><div key={i} className="reg-listing-box">
      <div className="card-hdr"><span className="card-title">🏠 {isEn?'Listing':'Listing'} #{i+1}</span>{items.length>1&&<button className="bsm bs-del" onClick={()=>setItems(rows=>rows.filter((_,x)=>x!==i))}>Quitar</button>}</div>
      <div className="fg2">
        {/* ── Listing ──────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🏠 {isEn?'Listing details':'Datos del listing'}</div>
        <div className="fg"><label>{appText(lang,"form.aptNumber")} <Tip text={tips.aptNumber}/></label><input className={cls(`apt_${i}`)} value={f.apt} onChange={e=>setVal(i,'apt',e.target.value)} onBlur={()=>checkApt(i)} placeholder="000"/>{checking[i]&&<span className="help-msg">{appText(lang,'validation.aptChecking')}</span>}{errors[`apt_${i}`]&&<span className="err-msg">{errors[`apt_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value="KAI" readOnly disabled className="locked-field"/></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={cls(`rooms_${i}`)} value={f.rooms} onChange={e=>setVal(i,'rooms',e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors[`rooms_${i}`]&&<span className="err-msg">{errors[`rooms_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={cls(`guests_${i}`)} type="number" value={f.guests} onChange={e=>setVal(i,'guests',parseInt(e.target.value)||'')} min={1}/>{errors[`guests_${i}`]&&<span className="err-msg">{errors[`guests_${i}`]}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} {optLabel}</label><input className={cls(`airbnb_${i}`)} value={f.airbnb} onChange={e=>setVal(i,'airbnb',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`airbnb_${i}`;if(v&&!/^https?:\/\/.+/i.test(v))setErrors(p=>({...p,[key]:appText(lang,'validation.urlInvalid')}));else setErrors(p=>({...p,[key]:undefined}));}} placeholder="https://www.airbnb.com/rooms/..."/>{errors[`airbnb_${i}`]&&<span className="err-msg">{errors[`airbnb_${i}`]}</span>}</div>
        {/* ── Operator ─────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🔧 {isEn?'Operator (optional)':'Operador (opcional)'}</div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} <Tip text={tips.operator}/></label><input className={cls(`operator_${i}`)} value={f.operator} onChange={e=>setVal(i,'operator',e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors[`operator_${i}`]&&<span className="err-msg">{errors[`operator_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} <Tip text={tips.operatorEmail}/></label><input className={cls(`operatorEmail_${i}`)} type="email" value={f.operatorEmail} onChange={e=>setVal(i,'operatorEmail',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`operatorEmail_${i}`;if(v&&!validateEmail(v))setErrors(p=>({...p,[key]:appText(lang,'validation.operatorEmailInvalid')}));else setErrors(p=>({...p,[key]:undefined}));}} placeholder="operador@email.com"/>{errors[`operatorEmail_${i}`]&&<span className="err-msg">{errors[`operatorEmail_${i}`]}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.operatorWhatsappOptional")} <Tip text={tips.operatorWhatsapp}/></label><input className={cls(`operatorWhatsapp_${i}`)} type="tel" value={f.operatorWhatsapp} onChange={e=>setVal(i,'operatorWhatsapp',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`operatorWhatsapp_${i}`;const err=validateWhatsApp(v,lang);setErrors(p=>({...p,[key]:err||undefined}));}} placeholder="+57 300 000 0000"/>{errors[`operatorWhatsapp_${i}`]?<span className="err-msg">{errors[`operatorWhatsapp_${i}`]}</span>:<span className="help-msg">{isEn?'With country code, e.g. +57':'Con código de país, ej. +57'}</span>}</div>
      </div>
    </div>)}
    <div className="mact"><button className="btn-ghost" onClick={()=>setItems(rows=>[...rows, makeBlank()])}>{appText(lang,"form.addAnotherListing")}</button><button className="btn-p" onClick={()=>{ if(validate()) onSubmit({ listings: items.map(x=>({...x,apt:String(x.apt).trim(),tower:'KAI',operatorEmail:String(x.operatorEmail||'').trim().toLowerCase(),operatorWhatsapp:String(x.operatorWhatsapp||'').trim(),airbnb:String(x.airbnb||'').trim()})), profile:{ whatsapp:whatsapp.trim() } }); }}>{submitText}</button></div>
  </div>;
}

function ListingDetailsBlock({ listings=[], lang="es-CO" }) {
  return <div className="listing-detail-grid">{listings.map(l=><div key={l.id} className="listing-detail-card">
    <div className="ld-title">🏠 {appText(lang,"listing.apt")} {l.apt} · {appText(lang,"listing.tower")} KAI</div>
    <div className="ld-row"><strong>{appText(lang,"listing.owner")}:</strong> {l.owner || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.googleEmail")}:</strong> {l.userEmail || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.listingEmail")}:</strong> {l.email || l.userEmail || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.ownerWhatsapp")}:</strong> {l.contact || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.roomsGuests")}:</strong> {l.rooms || 'N/A'} {appText(lang,"listing.roomsShort")} · {l.guests || 'N/A'} {appText(lang,"listing.guests")}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.operator")}:</strong> {l.operator || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.operatorEmail")}:</strong> {l.operatorEmail || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.operatorWhatsapp")}:</strong> {l.operatorWhatsapp || 'N/A'}</div>
    {l.airbnb && <div className="ld-row"><strong>Airbnb:</strong> <a href={l.airbnb} target="_blank" rel="noreferrer">{appText(lang,"listing.openLink")}</a></div>}
  </div>)}</div>;
}

function RegistrationCard({ r, actions=false, onApprove, onDecline, lang="es-CO" }) {
  return <div className="notice-card notice-new reg-card reg-detail-card">
    <div style={{flex:1}}>
      <div className="notice-title">{r.userName || appText(lang,'registrations.userNoName')}</div>
      <div className="notice-meta">{r.userEmail || appText(lang,'registrations.noEmail')} · {r.listings?.length || 0} {lang === 'en' ? 'apartment(s)' : 'apartamento(s)'} · {r.createdAt ? new Date(r.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO') : ''}</div>
      <div className="notice-meta"><strong>{appText(lang,'registrations.status')}:</strong> {registrationStatusLabel(r.status || (actions ? 'pending' : 'approved'), lang)}</div>
      {r.reviewedAt && <div className="notice-meta">{appText(lang,'registrations.approvedBy')} {r.reviewedByName || 'N/A'} · {new Date(r.reviewedAt).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO')}</div>}
      <ListingDetailsBlock listings={r.listings || []} lang={lang}/>
    </div>
    {actions && <div className="ir-acts"><button className="bsm bs-resolve" onClick={()=>onApprove(r.id)}>{appText(lang,"registrations.approve")}</button><button className="bsm bs-del" onClick={()=>onDecline(r.id)}>{appText(lang,"registrations.decline")}</button></div>}
  </div>;
}

function registrationStatusLabel(status, lang="es-CO") {
  if (status === 'approved') return appText(lang,'registrations.statusApproved');
  if (status === 'declined') return appText(lang,'registrations.statusDeclined');
  return appText(lang,'registrations.statusPending');
}

function PendingApprovalsView({ pending, active=[], onApprove, onDecline, lang="es-CO" }) {
  const [dateFilter,setDateFilter]=useState('');
  const [ownerFilter,setOwnerFilter]=useState('');
  const [aptFilter,setAptFilter]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const applyFilters = (items=[]) => items.filter(r => {
    const created = r.createdAt ? new Date(r.createdAt) : null;
    const d = created && !Number.isNaN(created.getTime()) ? created.toISOString().slice(0,10) : '';
    const ownerText = `${r.userName || ''} ${r.userEmail || ''}`.toLowerCase();
    const aptText = (r.listings || []).map(l => l.apt || l.apartment || '').join(' ').toLowerCase();
    const st = r.status || 'pending';
    return (!dateFilter || d === dateFilter)
      && (!ownerFilter || ownerText.includes(ownerFilter.toLowerCase()))
      && (!aptFilter || aptText.includes(aptFilter.toLowerCase()))
      && (statusFilter === 'all' || st === statusFilter);
  });
  const pendingFiltered = applyFilters(pending.map(r=>({...r,status:r.status || 'pending'})));
  const historyFiltered = applyFilters(active.map(r=>({...r,status:r.status || 'approved'})));
  const clear=()=>{setDateFilter('');setOwnerFilter('');setAptFilter('');setStatusFilter('all');};
  return <div className="fade">
    <div className="ph"><div><h1 className="ptitle">{appText(lang,"registrations.title")}</h1><p className="psub">{appText(lang,"registrations.subtitle")}</p></div></div>

    <div className="card reg-filters" style={{marginBottom:18}}>
      <div className="card-title">🔎 {appText(lang,'registrations.filtersTitle')}</div>
      <div className="reg-filter-grid">
        <div className="fg"><label>{appText(lang,'registrations.filterDate')}</label><input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} /></div>
        <div className="fg"><label>{appText(lang,'registrations.filterOwner')}</label><input value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} placeholder={appText(lang,'registrations.filterOwner')} /></div>
        <div className="fg"><label>{appText(lang,'registrations.filterApartment')}</label><input value={aptFilter} onChange={e=>setAptFilter(e.target.value)} placeholder="000" /></div>
        <div className="fg"><label>{appText(lang,'registrations.filterStatus')}</label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">{appText(lang,'registrations.filterAll')}</option><option value="pending">{appText(lang,'registrations.statusPending')}</option><option value="approved">{appText(lang,'registrations.statusApproved')}</option><option value="declined">{appText(lang,'registrations.statusDeclined')}</option></select></div>
        <button className="btn-ghost reg-clear" onClick={clear}>{appText(lang,'registrations.clearFilters')}</button>
      </div>
    </div>

    <div className="card" style={{marginBottom:18}}>
      <div className="card-hdr"><div><div className="card-title">{appText(lang,"registrations.pendingTitle")}</div><div className="psub">{appText(lang,"registrations.pendingSub",{count:pendingFiltered.length})}</div></div></div>
      {pendingFiltered.length===0?<EmptyState icon="✅" title={appText(lang,"registrations.nonePending")} sub={appText(lang,"registrations.nonePendingSub")}/>:<div className="notice-list">{pendingFiltered.map(r=><RegistrationCard key={r.id} r={r} actions onApprove={onApprove} onDecline={onDecline} lang={lang}/>)}</div>}
    </div>

    <div className="card">
      <div className="card-hdr"><div><div className="card-title">{appText(lang,"registrations.activeTitle")}</div><div className="psub">{appText(lang,"registrations.activeSub",{count:historyFiltered.length})}</div></div></div>
      {historyFiltered.length===0?<EmptyState icon="🏠" title={appText(lang,"registrations.noneActive")} sub={appText(lang,"registrations.noneActiveSub")}/>:<div className="notice-list">{historyFiltered.map(r=><RegistrationCard key={r.id} r={r} lang={lang}/>)}</div>}
    </div>
  </div>;
}

function BetaCommandCenter({ lang="es-CO", alerts=[], pendingOwner=0, pendingResolve=0, pendingRegistrations=0, openCount=0, isAdmin=false, onGo=()=>{} }) {
  const items = [
    { id:'ownerVerification', icon:'✅', count:pendingOwner, title:lang==='en'?'My verification':'Mi verificación', sub:lang==='en'?'Open incidents requiring owner confirmation':'Incidentes abiertos que requieren confirmación del propietario', show:true },
    { id:'requiresResolution', icon:'🛠️', count:pendingResolve, title:lang==='en'?'Ready to resolve':'Listos para resolver', sub:lang==='en'?'Owner-verified incidents pending admin resolution':'Incidentes verificados pendientes de resolución admin', show:isAdmin },
    { id:'registrations', icon:'📝', count:pendingRegistrations, title:lang==='en'?'Registrants':'Registros', sub:lang==='en'?'Pending registration requests':'Solicitudes pendientes de aprobación', show:isAdmin },
    { id:'incidents', icon:'⚠️', count:openCount, title:lang==='en'?'All open incidents':'Incidentes abiertos', sub:lang==='en'?'Community incidents still in progress':'Incidentes de la comunidad en progreso', show:true },
  ].filter(x=>x.show);
  const totalAction = items.reduce((a,x)=>a + Number(x.count||0), 0);
  return <section className="beta-command" aria-label={lang==='en'?'Beta action center':'Centro de acciones beta'}>
    <div className="beta-command-head">
      <div><span className="beta-kicker">{lang==='en'?'Beta action center':'Centro de acciones beta'}</span><strong>{lang==='en'?'What needs attention now':'Qué requiere atención ahora'}</strong></div>
      <span className={`beta-health ${totalAction ? 'needs-work' : 'all-clear'}`}>{totalAction ? (lang==='en'?`${totalAction} action(s)`:`${totalAction} acción(es)`) : (lang==='en'?'All clear':'Todo al día')}</span>
    </div>
    <div className="beta-command-grid">
      {items.map(item=><button key={item.id} className={`beta-action-card ${item.count>0?'has-count':''}`} onClick={()=>onGo(item.id)} title={item.sub}>
        <span className="beta-action-icon">{item.icon}</span>
        <span className="beta-action-copy"><strong>{item.title}</strong><small>{item.sub}</small></span>
        <span className="beta-action-count">{item.count}</span>
      </button>)}
    </div>
  </section>;
}


function ProfileView({ user, lang, userProfile, onSave }) {
  const isEn = lang === 'en';
  const [whatsapp, setWhatsapp] = useState(userProfile.whatsapp || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync when profile loads from server
  useEffect(() => { setWhatsapp(userProfile.whatsapp || ''); }, [userProfile.whatsapp]);

  const validate = () => {
    if (!String(whatsapp||'').trim()) { setError(isEn ? 'WhatsApp is required' : 'WhatsApp es requerido'); return false; }
    const err = validateWhatsApp(whatsapp, lang);
    if (err) { setError(err); return false; }
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave({ whatsapp: whatsapp.trim() }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">👤 {isEn ? 'My profile' : 'Mi perfil'}</h1>
          <p className="psub">{isEn ? 'Your contact info is used across all your listings.' : 'Tu información de contacto se usa en todos tus listings.'}</p>
        </div>
      </div>

      <div className="prof-card">
        {/* ── Account (read-only) ─────────────────── */}
        <div className="prof-section">
          <div className="prof-section-hdr">🔒 {isEn ? 'Account (Google)' : 'Cuenta (Google)'}</div>
          <div className="prof-ro-grid">
            <div className="prof-ro-row">
              <span className="prof-ro-lbl">{isEn ? 'Name' : 'Nombre'}</span>
              <span className="prof-ro-val">{user.name || '—'}</span>
            </div>
            <div className="prof-ro-row">
              <span className="prof-ro-lbl">Email</span>
              <span className="prof-ro-val">{user.email || '—'}</span>
            </div>
          </div>
        </div>

        {/* ── Editable contact ────────────────────── */}
        <div className="prof-section">
          <div className="prof-section-hdr">📱 WhatsApp</div>
          <p style={{fontSize:'.84rem',color:'#2a5a6a',margin:'0 0 14px',lineHeight:1.5}}>
            {isEn ? 'Used as the contact WhatsApp for all your listings. Updating this will apply to all apartments you own.' : 'Se usa como WhatsApp de contacto en todos tus listings. Al actualizar aquí se aplica a todos tus apartamentos.'}
          </p>
          <div className="fg2" style={{maxWidth:320}}>
            <div className="fg full">
              <label>WhatsApp <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
              <input className={error?'field-error':''} type="tel" value={whatsapp} onChange={e=>{setWhatsapp(e.target.value);setError('');}} onBlur={e=>{const v=String(e.target.value||'').trim();if(!v)setError(isEn?'WhatsApp is required':'WhatsApp es requerido');else{const err=validateWhatsApp(v,lang);if(err)setError(err);else setError('');}}} placeholder="+57 300 000 0000"/>
              {error ? <span className="err-msg">{error}</span> : <span className="help-msg">{isEn?'With country code, e.g. +57 300 000 0000':'Con código de país, ej. +57 300 000 0000'}</span>}
            </div>
          </div>
        </div>

        <div className="prof-footer">
          <button className="btn-p" onClick={handleSave} disabled={saving}>
            {saving ? (isEn ? 'Saving…' : 'Guardando…') : (isEn ? '💾 Save changes' : '💾 Guardar cambios')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardFocus({ lang="es-CO", effectiveIsGlobalAdmin=false, effectiveRole='user', delegatePerms={},
  pendingOwner=0, pendingResolve=0, pendingRegistrations=0, openCount=0,
  myListingCount=0, myOpenCount=0,
  canResolve=false, canManageRegistrations=false,
  onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{}, onOpenClick=()=>{}, setView=()=>{} }) {
  const isEn = lang==='en';
  const role = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'standard';

  // Role-specific card sets — each role sees only what matters to them
  const cards = role==='standard' ? [
    { id:'myListings',     icon:'🏠', count:myListingCount, label:isEn?'My listings':'Mis listings',          sub:isEn?'Your registered apartments':'Tus apartamentos registrados',              accent:'teal',  onClick:()=>setView('my') },
    { id:'myVerification', icon:'✅', count:pendingOwner,   label:isEn?'Need my action':'Requieren mi acción', sub:isEn?'Incidents awaiting your verification':'Incidentes esperando tu verificación', accent:'amber', onClick:onOwnerClick },
    { id:'myOpen',         icon:'⚠️', count:myOpenCount,   label:isEn?'My open reports':'Mis reportes',       sub:isEn?'Open reports on your listings':'Reportes abiertos en tus listings',       accent:'red',   onClick:()=>setView('incidents') },
  ] : role==='delegate' ? [
    { id:'ownerVerification', icon:'✅', count:pendingOwner,         label:isEn?'Need verification':'Requieren verificación',   sub:isEn?'Awaiting owner confirmation':'Esperando confirmación propietario',  accent:'amber', onClick:onOwnerClick,         show:true },
    { id:'requiresResolution',icon:'🛠️',count:pendingResolve,       label:isEn?'Ready to resolve':'Listos para resolver',       sub:isEn?'Verified, ready to close':'Verificados, listos para cerrar',        accent:'green', onClick:onResolveClick,       show:canResolve },
    { id:'registrations',     icon:'📝', count:pendingRegistrations,  label:isEn?'Registrations':'Registros',                   sub:isEn?'Pending approval':'Pendientes de aprobación',                         accent:'blue',  onClick:onRegistrationsClick, show:canManageRegistrations },
    { id:'allOpen',           icon:'⚠️', count:openCount,             label:isEn?'All open':'Total abiertos',                   sub:isEn?'Community incidents in progress':'Incidentes activos comunidad',       accent:null,    onClick:onOpenClick,          show:true },
  ].filter(x=>x.show!==false) : [
    { id:'allOpen',           icon:'⚠️', count:openCount,             label:isEn?'Open incidents':'Incidentes abiertos',         sub:isEn?'Community-wide open reports':'Reportes abiertos en comunidad',        accent:'red',   onClick:onOpenClick },
    { id:'ownerVerification', icon:'✅', count:pendingOwner,          label:isEn?'Need verification':'Requieren verificación',   sub:isEn?'Awaiting owner action':'Esperando acción del propietario',            accent:'amber', onClick:onOwnerClick },
    { id:'requiresResolution',icon:'🛠️',count:pendingResolve,        label:isEn?'Ready to resolve':'Listos para resolver',       sub:isEn?'Verified, ready to close':'Verificados, listos para cerrar',         accent:'green', onClick:onResolveClick },
    { id:'registrations',     icon:'📝', count:pendingRegistrations,   label:isEn?'Pending registrations':'Registros pendientes', sub:isEn?'Awaiting approval':'Esperando aprobación',                           accent:'blue',  onClick:onRegistrationsClick, show:canManageRegistrations },
  ].filter(x=>x.show!==false);

  const roleConfig = {
    standard: { icon:'🏠', title:isEn?'Your focus':'Tu enfoque',
      actions:[{label:isEn?'Verify pending':'Verificar pendientes',view:'incidents'},{label:isEn?'Update listing info':'Actualizar listing',view:'my'}] },
    delegate: { icon:'🛡️', title:isEn?'Admin actions':'Acciones admin',
      actions:[{label:isEn?'Registrations':'Registros',view:'approvals'},...(canResolve?[{label:isEn?'Resolve incidents':'Resolver incidentes',view:'incidents'}]:[])].slice(0,2) },
    global:   { icon:'🌐', title:isEn?'Community overview':'Vista comunidad',
      actions:[{label:isEn?'Analytics':'Analíticas',view:'analytics'},{label:isEn?'Settings':'Configuración',view:'admin'}] },
  }[role];

  return (
    <div className="dash-focus card">
      <div className="dash-focus-head">
        <strong className="dfc-role-title">{roleConfig.icon} {roleConfig.title}</strong>
        <div className="dash-focus-actions">
          {roleConfig.actions.map((a,i)=><button key={i} type="button" className="role-chip" onClick={()=>setView(a.view)}>{a.label}</button>)}
        </div>
      </div>
      <div className="dash-focus-grid">
        {cards.map(card=>(
          <button key={card.id} type="button"
            className={`dash-focus-card${card.count>0?' dfc-active':''}${card.accent?' dfc-'+card.accent:''}`}
            onClick={card.onClick} title={card.sub}>
            <span className="dfc-icon">{card.icon}</span>
            <span className="dfc-copy"><strong>{card.label}</strong><small>{card.sub}</small></span>
            <span className="dfc-count">{card.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardGreeting({ user, lang, role, pendingOwner=0, pendingResolve=0, pendingRegistrations=0, myOpenCount=0, onOwnerClick, onResolveClick, onRegistrationsClick, setView }) {
  const isEn = lang==='en';
  const hour = new Date().getHours();
  const timeGreet = hour<12 ? (isEn?'Good morning':'Buenos días') : hour<17 ? (isEn?'Good afternoon':'Buenas tardes') : (isEn?'Good evening':'Buenas noches');
  const firstName = String(user?.name||'').split(' ')[0] || (isEn?'there':'hola');
  const urgentPills = [];
  let msg = '';

  if (role==='standard') {
    if (pendingOwner>0) {
      msg = isEn
        ? `You have ${pendingOwner} incident${pendingOwner>1?'s':''} waiting for your verification.`
        : `Tienes ${pendingOwner} incidente${pendingOwner>1?'s':''} esperando tu verificación.`;
      urgentPills.push(<button key="verify" className="dg-pill dg-pill-amber" onClick={onOwnerClick}>✅ {isEn?`Verify ${pendingOwner} incident${pendingOwner>1?'s':''}`:`Verificar ${pendingOwner} incidente${pendingOwner>1?'s':''}`}</button>);
    } else if (myOpenCount>0) {
      msg = isEn
        ? `Your listings have ${myOpenCount} open report${myOpenCount>1?'s':''}. No immediate action needed from you.`
        : `Tus listings tienen ${myOpenCount} reporte${myOpenCount>1?'s':''} abierto${myOpenCount>1?'s':''}. Sin acción inmediata de tu parte.`;
      urgentPills.push(<button key="open" className="dg-pill dg-pill-red" onClick={()=>setView('incidents')}>⚠️ {isEn?`View ${myOpenCount} report${myOpenCount>1?'s':''}`:`Ver ${myOpenCount} reporte${myOpenCount>1?'s':''}`}</button>);
    } else {
      msg = isEn ? "You're all caught up — no pending actions today! 🎉" : "¡Estás al día — sin acciones pendientes hoy! 🎉";
    }
  } else if (role==='delegate') {
    const parts = [];
    if (pendingResolve>0) {
      parts.push(isEn?`${pendingResolve} ready to resolve`:`${pendingResolve} listos para resolver`);
      urgentPills.push(<button key="res" className="dg-pill dg-pill-green" onClick={onResolveClick}>🛠️ {isEn?`Resolve ${pendingResolve}`:`Resolver ${pendingResolve}`}</button>);
    }
    if (pendingRegistrations>0) {
      parts.push(isEn?`${pendingRegistrations} registration${pendingRegistrations>1?'s':''} pending`:`${pendingRegistrations} registro${pendingRegistrations>1?'s':''} pendiente${pendingRegistrations>1?'s':''}`);
      urgentPills.push(<button key="reg" className="dg-pill dg-pill-blue" onClick={onRegistrationsClick}>📝 {isEn?`Review ${pendingRegistrations}`:`Revisar ${pendingRegistrations}`}</button>);
    }
    msg = parts.length>0 ? (isEn?'Action needed: ':'Acción requerida: ')+parts.join(' · ')+'.' : (isEn?'No pending actions today — community is up to date!':'Sin acciones pendientes — la comunidad está al día.');
  } else {
    // global
    const parts = [];
    if (pendingResolve>0) { parts.push(isEn?`${pendingResolve} ready to resolve`:`${pendingResolve} listos para resolver`); urgentPills.push(<button key="res" className="dg-pill dg-pill-green" onClick={onResolveClick}>🛠️ {pendingResolve} {isEn?'to resolve':'por resolver'}</button>); }
    if (pendingOwner>0) { parts.push(isEn?`${pendingOwner} need verification`:`${pendingOwner} requieren verificación`); urgentPills.push(<button key="ver" className="dg-pill dg-pill-amber" onClick={onOwnerClick}>✅ {pendingOwner} {isEn?'need verification':'requieren verificación'}</button>); }
    if (pendingRegistrations>0) { parts.push(isEn?`${pendingRegistrations} pending registrations`:`${pendingRegistrations} registros pendientes`); urgentPills.push(<button key="reg" className="dg-pill dg-pill-blue" onClick={onRegistrationsClick}>📝 {pendingRegistrations} {isEn?'registrations':'registros'}</button>); }
    msg = parts.length>0 ? parts.join(' · ')+'.' : (isEn?'Community is up to date — no pending actions!':'¡Comunidad al día — sin acciones pendientes!');
  }

  const allClear = urgentPills.length===0;
  return (
    <div className={`dash-greeting${allClear?' dg-all-clear':''}`}>
      {user?.photo
        ? <img src={user.photo} className="dg-avatar" alt="" referrerPolicy="no-referrer"/>
        : <div className="dg-initials">{firstName.slice(0,1).toUpperCase()}</div>
      }
      <div className="dg-body">
        <div className="dg-hello">{timeGreet}, <span className="dg-name">{firstName}!</span> 👋</div>
        <p className="dg-msg">{msg}</p>
        {urgentPills.length>0 && <div className="dg-pills">{urgentPills}</div>}
      </div>
    </div>
  );
}

function Dashboard({ listings, incidents, user, contactProps={}, setView, onReport, showBlacklist=false, lang="es-CO",
  effectiveIsGlobalAdmin=false, effectiveRole='user', delegatePerms={},
  pendingOwner=0, pendingResolve=0, pendingRegistrations=0,
  canResolve=false, canManageRegistrations=false,
  onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{} }) {
  const open=incidents.filter(i=>i.status==="open"), naughty=incidents.filter(i=>i.category==="naughty"), resolved=incidents.filter(i=>i.status==="resolved");
  const totalCap=listings.reduce((a,l)=>a+(l.guests||0),0);
  const recent=[...incidents].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4);
  // Owner-specific counts for DashboardFocus
  const myListings = user ? listings.filter(l=>l.ownerUid===user.uid) : [];
  const myOpen = incidents.filter(i=>myListings.some(l=>l.id===i.aptId)&&i.status==="open");
  const dashRole = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'standard';
  return (
    <div className="fade">
      {/* ── Personalised greeting ── */}
      <div className="ph" style={{alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <h1 className="ptitle" style={{fontSize:'1.5rem',marginBottom:4}}>{appText(lang,"dashboard.title")}</h1>
          <p className="psub" style={{marginBottom:0}}>{appText(lang,"dashboard.subtitle")}</p>
        </div>
        {user&&<button className="btn-p btn-report" title={localizedTooltips({},lang).reportIncident} onClick={onReport}>{appText(lang,"dashboard.reportIncident")}</button>}
      </div>
      {user && <DashboardGreeting user={user} lang={lang} role={dashRole} pendingOwner={pendingOwner} pendingResolve={pendingResolve} pendingRegistrations={pendingRegistrations} myOpenCount={myOpen.length} onOwnerClick={onOwnerClick} onResolveClick={onResolveClick} onRegistrationsClick={onRegistrationsClick} setView={setView}/>}
      <DashboardFocus lang={lang} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} effectiveRole={effectiveRole} delegatePerms={delegatePerms} pendingOwner={pendingOwner} pendingResolve={pendingResolve} pendingRegistrations={pendingRegistrations} openCount={open.length} myListingCount={myListings.length} myOpenCount={myOpen.length} canResolve={canResolve} canManageRegistrations={canManageRegistrations} onOwnerClick={onOwnerClick} onResolveClick={onResolveClick} onRegistrationsClick={onRegistrationsClick} onOpenClick={()=>setView('incidents')} setView={setView} />
      <div className="stats6">
        {[{icon:"🏠",val:listings.length,label:appText(lang,"dashboard.apartments"),color:"#2a9aaa",click:()=>setView("listings")},{icon:"👥",val:totalCap,label:appText(lang,"dashboard.capacity"),color:"#c9a84c"},{icon:"⚠️",val:open.length,label:appText(lang,"dashboard.openReports"),color:"#d4634a",click:()=>setView("incidents")},...(showBlacklist?[{icon:"😈",val:naughty.length,label:appText(lang,"dashboard.blacklist"),color:"#b71c1c",click:()=>setView("naughty")}]:[]),{icon:"✅",val:resolved.length,label:appText(lang,"dashboard.resolved"),color:"#2e7d32"},{icon:"🔗",val:listings.filter(l=>l.airbnb).length,label:appText(lang,"dashboard.onAirbnb"),color:"#FF5A5F"}].map((s,i)=>(
          <div key={i} className="scard" style={{borderTop:`3px solid ${s.color}`,cursor:s.click?"pointer":"default"}} onClick={s.click}>
            <div style={{fontSize:"1.5rem"}}>{s.icon}</div><div className="sval" style={{color:s.color}}>{s.val}</div><div className="slabel">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="two-col">
        <div className="card"><div className="card-hdr"><span className="card-title">{appText(lang,"dashboard.recentReports")}</span><button className="lnk" onClick={()=>setView("incidents")}>{appText(lang,"dashboard.viewAll")}</button></div>{recent.length===0?<Empty icon="✅" msg={appText(lang,"dashboard.noReports")}/>:recent.map(i=><IRow key={i.id} inc={i} compact lang={lang}/>)}</div>
        <div className="card"><div className="card-hdr"><span className="card-title">🏠 {appText(lang,"dashboard.apartments")}</span><button className="lnk" onClick={()=>setView("listings")}>{appText(lang,"dashboard.viewAll")}</button></div>
          {[...listings].sort((a,b)=>a.apt.localeCompare(b.apt)).map(l=>{
            const waDigits = normalizePhoneForWhatsApp(l.contact||'');
            return (
              <div key={l.id} className="apt-row">
                <div className="ar-info">
                  <div className="ar-apt">{appText(lang,"listing.apt")} {l.apt}</div>
                  <div className="ar-meta">
                    <UserContact name={l.owner} uid={l.ownerUid} email={l.email} whatsapp={l.contact}
                      apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
                    <div className="ar-chips">
                      <span className="chip c-teal">🛏️ {l.rooms}</span>
                      <span className="chip c-blue">👥 {l.guests}</span>
                    </div>
                  </div>
                </div>
                <div className="ar-actions">
                  {l.email && <a href={`mailto:${l.email}`} className="ar-act" target="_blank" rel="noreferrer" title={l.email} aria-label="Email">✉️</a>}
                  {waDigits && <a href={`https://wa.me/${waDigits}`} className="ar-act ar-act-wa" target="_blank" rel="noreferrer" title={l.contact} aria-label="WhatsApp">💬</a>}
                  {l.airbnb && <a href={l.airbnb} className="ar-act ar-act-ab" target="_blank" rel="noreferrer" title="Airbnb" aria-label="Airbnb">↗</a>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showBlacklist&&naughty.length>0&&<div className="card ncard"><div className="card-hdr"><span className="card-title" style={{color:"#ff6b6b"}}>😈 {appText(lang,"dashboard.blacklist")}</span><button className="lnk" onClick={()=>setView("naughty")}>{appText(lang,"dashboard.view")}</button></div><div className="nrow">{naughty.slice(0,4).map(i=><div key={i.id} className="npill"><div style={{fontSize:"1.2rem"}}>😈</div><div><div className="np-name">{i.guestName}</div><div className="np-loc">📍 {i.guestCity}, {i.guestCountry}</div><div className="np-apt">{i.aptLabel}</div></div></div>)}</div></div>}
    </div>
  );
}

function MyListings({ listings, incidents, user, contactProps={}, isGlobalAdmin=false, canResolveGlobal=false, onAdd, onEdit, onDelete, onReport, onVerify, onResolve, lang="es-CO" }) {
  const [selectedId, setSelectedId] = useState(null);
  const [statFilter, setStatFilter] = useState(null); // null | 'open' | 'verified' | 'resolved'
  const isEn = lang==='en';
  const myListingIds = new Set(listings.map(l=>l.id));
  const incAgainstMe = incidents.filter(i=>myListingIds.has(i.aptId));
  const incIReported = incidents.filter(i=>i.reporterUid===user.uid&&!myListingIds.has(i.aptId));
  const totalGuests  = listings.reduce((a,l)=>a+(l.guests||0),0);
  const openC    = incAgainstMe.filter(i=>i.status==='open').length;
  const verifiedC= incAgainstMe.filter(i=>i.status==='verified').length;
  const resolvedC= incAgainstMe.filter(i=>i.status==='resolved').length;
  const allSorted = [...listings].sort((a,b)=>a.apt.localeCompare(b.apt));
  // Apply stat filter: only show listings that have incidents of that status
  const sorted = statFilter
    ? allSorted.filter(l=>incidents.some(i=>i.aptId===l.id&&i.status===statFilter))
    : allSorted;
  const toggleStat = (s) => { setStatFilter(f=>f===s?null:s); setSelectedId(null); };
  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang,"my.title")}</h1>
          <p className="psub">{user.name} · {listings.length} {appText(lang,"my.units")} · {totalGuests} {appText(lang,"my.guestsTotal")}</p>
        </div>
        <button className="btn-p" onClick={onAdd}>{appText(lang,"listings.add")}</button>
      </div>

      {/* ── Summary stats — click to filter listings below ── */}
      <div className="ml-stats">
        <div className={`ml-stat${statFilter?'':' ml-stat-active'}`} onClick={()=>toggleStat(null)} style={{cursor:'pointer'}} title={isEn?'Show all listings':'Ver todos los listings'}>
          <span className="ml-stat-val">{listings.length}</span>
          <span className="ml-stat-lbl">🏠 {isEn?'All listings':'Todos'}</span>
        </div>
        <div className="ml-stat" style={{cursor:'default'}}>
          <span className="ml-stat-val">{totalGuests}</span>
          <span className="ml-stat-lbl">👥 {isEn?'Guest cap.':'Huéspedes'}</span>
        </div>
        <div className={`ml-stat${openC>0?' ml-stat-warn':''}${statFilter==='open'?' ml-stat-active':''}`} onClick={()=>openC>0&&toggleStat('open')} style={{cursor:openC>0?'pointer':'default'}} title={isEn?'Filter to listings with open incidents':'Ver listings con incidentes abiertos'}>
          <span className="ml-stat-val">{openC}</span>
          <span className="ml-stat-lbl">⚠️ {isEn?'Open':'Abiertos'}</span>
        </div>
        <div className={`ml-stat${verifiedC>0?' ml-stat-ver':''}${statFilter==='verified'?' ml-stat-active':''}`} onClick={()=>verifiedC>0&&toggleStat('verified')} style={{cursor:verifiedC>0?'pointer':'default'}} title={isEn?'Filter to listings with verified incidents':'Ver listings con incidentes verificados'}>
          <span className="ml-stat-val">{verifiedC}</span>
          <span className="ml-stat-lbl">👤 {isEn?'Verified':'Verificados'}</span>
        </div>
        <div className={`ml-stat${resolvedC>0?' ml-stat-res':''}${statFilter==='resolved'?' ml-stat-active':''}`} onClick={()=>resolvedC>0&&toggleStat('resolved')} style={{cursor:resolvedC>0?'pointer':'default'}} title={isEn?'Filter to listings with resolved incidents':'Ver listings con incidentes resueltos'}>
          <span className="ml-stat-val">{resolvedC}</span>
          <span className="ml-stat-lbl">✓ {isEn?'Resolved':'Resueltos'}</span>
        </div>
      </div>
      {statFilter&&<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:'.8rem',color:'#496674'}}>
        <span>{isEn?'Filtered:':'Filtrado:'} <strong>{statFilter==='open'?(isEn?'Open incidents':'Incidentes abiertos'):statFilter==='verified'?(isEn?'Verified incidents':'Incidentes verificados'):(isEn?'Resolved incidents':'Incidentes resueltos')}</strong> · {sorted.length} {isEn?'listing':'listing'}{sorted.length!==1?'s':''}</span>
        <button className="fchip fchip-sm fchip-reset" onClick={()=>toggleStat(null)}>✕ {isEn?'Clear':'Limpiar'}</button>
      </div>}

      {/* ── My listings — click to see incidents ── */}
      <div className="ml-section">
        <div className="ml-section-hdr">🏠 {isEn?'My listings':'Mis listings'}</div>
        {listings.length===0
          ? <EmptyState icon="🏠" title={appText(lang,"my.noApts")} sub={appText(lang,"my.addFirst")}/>
          : sorted.map(l=>{
              const lInc  = incidents.filter(i=>i.aptId===l.id);
              const lOpen = lInc.filter(i=>i.status==='open').length;
              const lVer  = lInc.filter(i=>i.status==='verified').length;
              const lRes  = lInc.filter(i=>i.status==='resolved').length;
              const isSel = selectedId===l.id;
              return (
                <div key={l.id} className={`ml-listing${isSel?' ml-listing-sel':''}`}>
                  <div className="ml-listing-row" onClick={()=>setSelectedId(isSel?null:l.id)}>
                    <div className="ml-listing-apt">Apt {l.apt}</div>
                    <div className="ml-listing-chips">
                      <span className="chip c-teal">🛏️ {l.rooms}</span>
                      <span className="chip c-blue">👥 {l.guests}</span>
                    </div>
                    <div className="ml-listing-inc-pills">
                      {lOpen>0&&<span className="ml-pill ml-pill-open">⚠️ {lOpen}</span>}
                      {lVer>0&&<span className="ml-pill ml-pill-ver">👤 {lVer}</span>}
                      {lRes>0&&<span className="ml-pill ml-pill-res">✓ {lRes}</span>}
                      {lInc.length===0&&<span className="ml-pill ml-pill-clear">✓ {isEn?'Clear':'Al día'}</span>}
                    </div>
                    <div className="ml-listing-acts" onClick={e=>e.stopPropagation()}>
                      <button className="bsm bs-rep" onClick={()=>onReport(l)}>+ {isEn?'Report':'Reporte'}</button>
                      <button className="bsm bs-edit" onClick={()=>onEdit(l)}>✏️</button>
                      <button className="bsm bs-del" onClick={()=>onDelete(l)}>🗑️</button>
                    </div>
                    <span className={`fls-chev${isSel?' fls-chev-up':''}`} style={{marginLeft:'auto',flexShrink:0}}>›</span>
                  </div>
                  {isSel&&(
                    <AptDetailPanel l={l} incidents={incidents} contactProps={contactProps} canEdit canDelete onEdit={()=>onEdit(l)} onDelete={()=>onDelete(l)} onReport={()=>onReport(l)} onClose={()=>setSelectedId(null)} user={user} isGlobalAdmin={isGlobalAdmin} canResolveGlobal={canResolveGlobal} onVerify={onVerify} onResolve={onResolve} lang={lang} isEn={isEn}/>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* ── Incidents I reported against other apts ── */}
      {incIReported.length>0&&(
        <div className="ml-section" style={{marginTop:24}}>
          <div className="ml-section-hdr">📋 {isEn?'Incidents I reported':'Incidentes que reporté'}</div>
          {[...incIReported].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(i=>(
            <IRow key={i.id} inc={i} listings={listings} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canResolveGlobal={canResolveGlobal} onResolve={onResolve} onDelete={()=>{}} onVerify={onVerify} lang={lang}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Building-view helpers
const FLOOR_PALETTE = ['#0b7f8c','#0b7f4f','#8a6a0a','#4a6fa5','#7a4a2a','#5a7a2a','#6a4a8a'];
const floorColor = (f) => FLOOR_PALETTE[f % FLOOR_PALETTE.length];
const getFloorNum = (apt) => Math.floor(parseInt(apt||'0')/100);

function aptDoorStatus(l, incidents) {
  const open = incidents.filter(i=>i.aptId===l.id&&i.status==='open');
  if (open.some(i=>i.category==='serious')) return 'alert';
  if (open.length>0) return 'warn';
  return 'clean';
}

// Inline branded SVG icons — small enough to embed directly
const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{flexShrink:0}}>
    <circle cx="12" cy="12" r="12" fill="#25D366"/>
    <path d="M17.5 14.4c-.3-.1-1.7-.85-1.97-.95-.27-.1-.46-.1-.66.1-.19.21-.74.95-.9 1.14-.17.2-.33.22-.62.07-.29-.14-1.22-.45-2.33-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29 0-.45.13-.59l.42-.49c.12-.14.17-.25.25-.42.08-.17.04-.32-.02-.46-.06-.14-.65-1.57-.9-2.15-.23-.55-.47-.48-.65-.48h-.57c-.19 0-.5.07-.76.37-.26.3-.99.97-.99 2.36 0 1.39.99 2.74 1.13 2.93.14.19 1.95 3 4.73 4.09 2.78 1.08 2.78.72 3.28.68.5-.04 1.61-.66 1.84-1.3.22-.64.22-1.19.16-1.3z" fill="#fff"/>
  </svg>
);
const IconEmail = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{flexShrink:0}}>
    <rect width="24" height="24" rx="3" fill="#EA4335"/>
    <path d="M4 8l8 5 8-5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <rect x="3" y="7" width="18" height="12" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.3"/>
  </svg>
);

function AptDoor({ l, incidents, isSelected, onSelect, lang, isEn }) {
  const status = aptDoorStatus(l, incidents);
  const openCount = incidents.filter(i=>i.aptId===l.id&&i.status==='open').length;
  const ownerEmail = l.userEmail || l.email || '';
  const ownerWaRaw = l.contact || '';
  const ownerWaDigits = normalizePhoneForWhatsApp(ownerWaRaw);
  // Flag numbers missing the + prefix so owners know to update them
  const waFormatOk = !ownerWaRaw || ownerWaRaw.trim().startsWith('+');
  return (
    <div
      className={`apt-door apt-door-${status}${isSelected?' apt-door-sel':''}`}
      onClick={()=>onSelect(isSelected?null:l.id)}
      role="button"
      aria-expanded={isSelected}
      aria-label={`${isEn?'Apartment':'Apartamento'} ${l.apt}${isEn?'. Click to see incidents':'. Clic para ver incidentes'}`}
    >
      {/* Status colour bar across full top edge */}
      <div className={`door-status-bar door-sb-${status}`}/>
      {/* Full-width number plate */}
      <div className="door-num-plate">
        <span className="door-num">{l.apt}</span>
        {openCount>0 && <span className="door-inc-badge">⚠️ {openCount}</span>}
      </div>
      {/* Card body */}
      <div className="door-body">
        <div className="door-owner" title={l.owner}>{l.owner||'—'}</div>
        {l.operator && <div className="door-op" title={l.operator}>🔧 {l.operator}</div>}
        <div className="door-chips">
          <span className="door-chip">🛏️ {l.rooms}</span>
          <span className="door-chip">👥 {l.guests}</span>
        </div>
      </div>
      {/* Hover overlay — pointer-events:none so card click still works;
          only the <a> links inside have pointer-events:auto               */}
      <div className="door-hover-overlay">
        {ownerEmail ? (
          <a className="door-hover-link" href={`mailto:${ownerEmail}`} onClick={e=>e.stopPropagation()} title={ownerEmail}>
            <IconEmail/><span>{ownerEmail}</span>
          </a>
        ) : (
          <span className="door-hover-missing">{isEn?'No email':'Sin email'}</span>
        )}
        {ownerWaDigits ? (
          <a className="door-hover-link" href={`https://wa.me/${ownerWaDigits}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} title={ownerWaRaw}>
            <IconWhatsApp/><span>{ownerWaRaw}{!waFormatOk&&<span className="door-wa-warn"> ⚠️</span>}</span>
          </a>
        ) : (
          <span className="door-hover-missing">{isEn?'No WhatsApp':'Sin WhatsApp'}</span>
        )}
        <div className="door-hover-cta">{isEn?'👆 Click · view incidents':'👆 Clic · ver incidentes'}</div>
      </div>
      <div className="door-footer">
        {isSelected
          ? `▲ ${isEn?'Close':'Cerrar'}`
          : `👆 ${isEn?'Click · incidents':'Clic · incidentes'}`}
      </div>
    </div>
  );
}

function AptDetailPanel({ l, incidents, contactProps={}, canEdit, canDelete, onEdit, onDelete, onReport, onClose, user, isGlobalAdmin, canResolveGlobal, onVerify, onResolve, lang, isEn }) {
  const aptInc = [...incidents.filter(i=>i.aptId===l.id)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const ownerWa = normalizePhoneForWhatsApp(l.contact);
  const opWa = normalizePhoneForWhatsApp(l.operatorWhatsapp);
  const hasOp = !!(l.operator||l.operatorEmail||l.operatorWhatsapp);
  const incGroups = [
    { key:'open',     icon:'⚠️', label:isEn?'Open':'Abiertos',       color:'#d9a030', items:aptInc.filter(i=>i.status==='open') },
    { key:'verified', icon:'👤', label:isEn?'Verified':'Verificados', color:'#0b7f4f', items:aptInc.filter(i=>i.status==='verified') },
    { key:'resolved', icon:'✓',  label:isEn?'Resolved':'Resueltos',   color:'#6a9a7a', items:aptInc.filter(i=>i.status==='resolved') },
  ].filter(g=>g.items.length>0);

  return (
    <div className="adp-wrap">
      <div className="adp-header">
        <div className="adp-apt-id">
          <span className="adp-apt-num">Apt {l.apt}</span>
          <span className="chip c-teal">🛏️ {l.rooms}</span>
          <span className="chip c-blue">👥 {l.guests}</span>
          {l.airbnb && <a className="airbnb-lnk" href={l.airbnb} target="_blank" rel="noreferrer">Airbnb ↗</a>}
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <button className="bsm bs-rep" onClick={onReport}>+ {isEn?'Report':'Reporte'}</button>
          {canEdit && <button className="bsm bs-edit" onClick={onEdit}>✏️</button>}
          {canDelete && <button className="bsm bs-del" onClick={onDelete}>🗑️</button>}
          <button className="adp-close-btn" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      <div className="adp-contacts">
        <div className="adp-party">
          <span className="adp-party-lbl">👤 {isEn?'Owner':'Propietario'}</span>
          <div className="adp-party-row">
            <UserContact name={l.owner} uid={l.ownerUid} email={l.userEmail||l.email} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
            <div style={{display:'flex',gap:5}}>
              {(l.userEmail||l.email)&&<a href={`mailto:${l.userEmail||l.email}`} className="ac-cbtn" title={l.userEmail||l.email}>✉️</a>}
              {ownerWa&&<a href={`https://wa.me/${ownerWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer">💬</a>}
            </div>
          </div>
        </div>
        {hasOp && (
          <div className="adp-party">
            <span className="adp-party-lbl">🔧 {isEn?'Operator':'Operador'}</span>
            <div className="adp-party-row">
              {l.operator ? <UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={[]} {...contactProps}/> : <span style={{fontSize:'.8rem',color:'#8a9fa5'}}>—</span>}
              <div style={{display:'flex',gap:5}}>
                {l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="ac-cbtn">✉️</a>}
                {opWa&&<a href={`https://wa.me/${opWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer">💬</a>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="adp-incidents">
        <div className="adp-inc-hdr">{isEn?'Incident history':'Historial de incidentes'} <span className="adp-inc-count">{aptInc.length}</span></div>
        {aptInc.length===0
          ? <div className="adp-inc-empty">✅ {isEn?'No incidents on record':'Sin incidentes registrados'}</div>
          : incGroups.map(g=>(
            <div key={g.key} className="adp-inc-group">
              <div className="adp-inc-group-lbl" style={{color:g.color}}>{g.icon} {g.label} ({g.items.length})</div>
              {g.items.map(inc=>{
                const ti=INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6];
                const ci=GUEST_CATEGORIES.find(c=>c.value===inc.category);
                const isOwner=user?.uid===l.ownerUid;
                const guests=normalizeOwnerGuests(inc);
                return (
                  <div key={inc.id} className="adp-inc-card">
                    <div className="adp-inc-top">
                      <span className="ir-type" style={{background:ti.bg,color:ti.color}}>{incidentTypeLabel(ti.value,lang)}</span>
                      {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color}}>{ci.icon}</span>}
                      {/* Reporter context — who filed this incident */}
                      {inc.reporterUid===user?.uid
                        ? <span className="inc-ctx-tag inc-ctx-reporter">{isEn?'📋 I reported':'📋 Yo reporté'}</span>
                        : <span className="adp-inc-reporter-name">📋 {isEn?'By':'Por'}: {inc.reporterName||'—'}</span>}
                      <span className="adp-inc-date">{fmtDate(inc.date)}</span>
                    </div>
                    <div className="adp-inc-desc">{inc.desc}</div>
                    {guests.length>0 ? <div className="adp-inc-guest">👥 {guests.map(guestFullName).join(' · ')}</div> : inc.guestName&&<div className="adp-inc-guest">👤 {inc.guestName}{inc.guestCity?` · 📍 ${inc.guestCity}`:''}</div>}
                    {inc.ownerComments&&<div className="adp-inc-comments"><strong>{isEn?'Owner note:':'Nota propietario:'}</strong> {inc.ownerComments}</div>}
                    {inc.resolutionComments&&<div className="adp-inc-comments"><strong>{isEn?'Resolution:':'Resolución:'}</strong> {inc.resolutionComments}</div>}
                    <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
                      {inc.status==='open'&&isOwner&&<button className="bsm bs-resolve" onClick={()=>onVerify(inc)}>{appText(lang,'reports.verify')}</button>}
                      {inc.status==='verified'&&(isGlobalAdmin||canResolveGlobal)&&<button className="bsm bs-resolve" onClick={()=>onResolve(inc.id)}>{appText(lang,'reports.close')}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function BuildingFloor({ floor, apts, incidents, user, contactProps, isGlobalAdmin, canEditGlobal, canDeleteGlobal, canResolveGlobal, onEdit, onDelete, onReport, onVerify, onResolve, isOpen, onToggle, lang, isEn }) {
  const [selectedAptId, setSelectedAptId] = useState(null);
  const color = floorColor(floor);
  const floorInc   = incidents.filter(i=>apts.some(l=>l.id===i.aptId));
  const openCount  = floorInc.filter(i=>i.status==='open').length;
  const verCount   = floorInc.filter(i=>i.status==='verified').length;
  const resCount   = floorInc.filter(i=>i.status==='resolved').length;
  const selectedApt = apts.find(l=>l.id===selectedAptId);
  const handleSelect = (id) => setSelectedAptId(id);

  return (
    <div className="bld-floor">
      <button className="bld-floor-hdr" style={{borderLeftColor:color}} onClick={onToggle}>
        <div className="bld-floor-id">
          <span className="bld-floor-level">{isEn?'FLOOR':'PISO'}</span>
          <span className="bld-floor-num" style={{color}}>{floor}</span>
        </div>
        <div className="bld-floor-stats">
          <span className="bld-stat-pill bld-stat-apts">🏠 {apts.length} {isEn?(apts.length===1?'apt':'apts'):'apto'+(apts.length>1?'s':'')}</span>
          {openCount>0  && <span className="bld-stat-pill bld-stat-inc">⚠️ {openCount} {isEn?'open':'abierto'}{openCount>1&&isEn?'s':''}</span>}
          {verCount>0   && <span className="bld-stat-pill bld-stat-ver">👤 {verCount} {isEn?'verified':'verificado'}{verCount>1&&isEn?'s':''}</span>}
          {resCount>0   && <span className="bld-stat-pill bld-stat-res">✓ {resCount} {isEn?'resolved':'resuelto'}{resCount>1&&isEn?'s':''}</span>}
          {floorInc.length===0 && <span className="bld-stat-pill bld-stat-clear">✓ {isEn?'Clear':'Al día'}</span>}
        </div>
        <span className={`bld-chev${isOpen?' bld-chev-up':''}`}>›</span>
      </button>

      {isOpen && (
        <div className="bld-floor-body">
          <div className="bld-door-grid">
            {apts.map(l=>(
              <AptDoor key={l.id} l={l} incidents={incidents} isSelected={selectedAptId===l.id} onSelect={handleSelect} lang={lang} isEn={isEn}/>
            ))}
          </div>
          {selectedApt && (
            <AptDetailPanel
              l={selectedApt}
              incidents={incidents}
              contactProps={contactProps}
              canEdit={user?.uid===selectedApt.ownerUid||isGlobalAdmin||canEditGlobal}
              canDelete={user?.uid===selectedApt.ownerUid||isGlobalAdmin||canDeleteGlobal}
              onEdit={()=>onEdit(selectedApt)}
              onDelete={()=>onDelete(selectedApt)}
              onReport={()=>onReport(selectedApt)}
              onClose={()=>setSelectedAptId(null)}
              user={user}
              isGlobalAdmin={isGlobalAdmin}
              canResolveGlobal={canResolveGlobal}
              onVerify={onVerify}
              onResolve={onResolve}
              lang={lang}
              isEn={isEn}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Keep old FloorSection + AptRow for list-mode compatibility
function AptRow({ l, incCount, user, contactProps={}, isGlobalAdmin=false, canEditGlobal=false, canDeleteGlobal=false, onEdit, onDelete, onReport, lang, isEn }) {
  const [expanded, setExpanded] = useState(false);
  const ownerWa = normalizePhoneForWhatsApp(l.contact);
  const opWa    = normalizePhoneForWhatsApp(l.operatorWhatsapp);
  const hasOp   = !!(l.operator||l.operatorEmail||l.operatorWhatsapp);
  const canEdit   = user?.uid===l.ownerUid||isGlobalAdmin||canEditGlobal;
  const canDelete = user?.uid===l.ownerUid||isGlobalAdmin||canDeleteGlobal;
  return (
    <div className={`fls-row${expanded?' fls-row-open':''}`}>
      <div className="fls-row-main" onClick={()=>setExpanded(x=>!x)} role="button" aria-expanded={expanded}>
        <span className="fls-apt-num">Apt {l.apt}</span>
        <span className="fls-owner-wrap"><UserContact name={l.owner} uid={l.ownerUid} email={l.userEmail||l.email} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/></span>
        {hasOp&&<span className="fls-op-pill">🔧 {l.operator||'—'}</span>}
        <span className="fls-row-chips"><span className="chip c-teal">🛏️ {l.rooms}</span><span className="chip c-blue">👥 {l.guests}</span></span>
        <span className="fls-row-acts" onClick={e=>e.stopPropagation()}>
          {(l.userEmail||l.email)&&<a href={`mailto:${l.userEmail||l.email}`} className="ac-cbtn" title={l.userEmail||l.email}>✉️</a>}
          {ownerWa&&<a href={`https://wa.me/${ownerWa}`} className="ac-cbtn ac-cbtn-wa" title={l.contact} target="_blank" rel="noreferrer">💬</a>}
        </span>
        {incCount>0&&<span className="fls-inc-pill">⚠️ {incCount}</span>}
        <span className={`fls-chev${expanded?' fls-chev-up':''}`}>›</span>
      </div>
      {expanded&&(
        <div className="fls-row-detail" onClick={e=>e.stopPropagation()}>
          {hasOp&&<div className="fls-det-row"><span className="fls-det-lbl">🔧 {isEn?'Operator':'Operador'}</span><span className="fls-det-val">{l.operator?<UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={[]} {...contactProps}/>:<span style={{fontSize:'.8rem',color:'#8a9fa5'}}>{isEn?'No name':'Sin nombre'}</span>}<span className="fls-det-acts">{l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="ac-cbtn">✉️</a>}{opWa&&<a href={`https://wa.me/${opWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer">💬</a>}</span></span></div>}
          <div className="fls-det-row"><span className="fls-det-lbl">Airbnb</span><span className="fls-det-val">{l.airbnb?<a className="airbnb-lnk" href={l.airbnb} target="_blank" rel="noreferrer">{isEn?'View listing':'Ver listing'}</a>:<span style={{fontSize:'.8rem',color:'#8a9fa5'}}>{isEn?'No link':'Sin enlace'}</span>}</span></div>
          <div className="fls-det-acts-row"><button className="bsm bs-rep" onClick={e=>{e.stopPropagation();onReport();}}>+ {isEn?'Report':'Reporte'}</button>{canEdit&&<button className="bsm bs-edit" onClick={e=>{e.stopPropagation();onEdit();}}>✏️</button>}{canDelete&&<button className="bsm bs-del" onClick={e=>{e.stopPropagation();onDelete();}}>🗑️</button>}<span className={`inc-b ${incCount>0?'ib-open':'ib-none'}`} style={{cursor:'default',display:'inline-flex',alignItems:'center'}}>{incCount>0?(incCount>1?appText(lang,'listings.openReportPlural',{count:incCount}):appText(lang,'listings.openReportSingular',{count:incCount})):appText(lang,'listings.noOpenReports')}</span></div>
        </div>
      )}
    </div>
  );
}

function FloorSection({ floor, apts, openCount, incidents, user, contactProps, isGlobalAdmin, canEditGlobal, canDeleteGlobal, onEdit, onDelete, onReport, lang, isEn }) {
  const [open, setOpen] = useState(true);
  const color = floorColor(floor);
  return (
    <div className="fls-floor">
      <button className="fls-floor-hdr" style={{borderLeftColor:color}} onClick={()=>setOpen(o=>!o)}>
        <span className="fls-floor-badge" style={{background:color}}>F{floor}</span>
        <span className="fls-floor-label">{isEn?`Floor ${floor}`:`Piso ${floor}`}</span>
        <span className="fls-floor-meta">
          <span className="fls-floor-units">{apts.length} {isEn?(apts.length===1?'unit':'units'):'apto'+(apts.length>1?'s':'')}</span>
          {openCount>0&&<span className="fls-floor-open">⚠️ {openCount}</span>}
        </span>
        <span className={`fls-chev${open?' fls-chev-up':''}`} style={{marginLeft:'auto'}}>›</span>
      </button>
      {open&&<div className="fls-floor-body">{apts.map(l=><AptRow key={l.id} l={l} incCount={incidents.filter(i=>i.aptId===l.id&&i.status==='open').length} user={user} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canEditGlobal={canEditGlobal} canDeleteGlobal={canDeleteGlobal} onEdit={()=>onEdit(l)} onDelete={()=>onDelete(l)} onReport={()=>onReport(l)} lang={lang} isEn={isEn}/>)}</div>}
    </div>
  );
}

function ListingsView({ listings, incidents, user, contactProps={}, isGlobalAdmin=false, canEditGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, floorOpenState={}, onFloorToggle, onAdd, onEdit, onDelete, onReport, onVerify, onResolve, lang="es-CO" }) {
  const [search, setSearch]   = useState('');
  const [scope, setScope]     = useState('all');
  const [viewMode, setViewMode] = useState('building');
  const isEn = lang === 'en';

  const scoped   = scope==='mine'&&user ? listings.filter(l=>l.ownerUid===user.uid) : listings;
  const filtered = scoped.filter(l=>{
    const q=search.toLowerCase();
    return !q||String(l.apt||'').includes(q)||String(l.owner||'').toLowerCase().includes(q)||String(l.operator||'').toLowerCase().includes(q);
  });
  const sorted    = [...filtered].sort((a,b)=>String(a.apt||'').localeCompare(String(b.apt||'')));
  // Ascending floor order (floor 1 at top, floor 9 at bottom)
  const floorNums = [...new Set(sorted.map(l=>getFloorNum(l.apt)))].sort((a,b)=>a-b);
  const byFloor   = (f) => sorted.filter(l=>getFloorNum(l.apt)===f);

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang,'listings.title')}</h1>
          <p className="psub">{appText(lang,'listings.subtitle',{count:scoped.length})}</p>
        </div>
        {user&&<button className="btn-p" onClick={onAdd}>{appText(lang,'listings.add')}</button>}
      </div>

      <div className="fls-toolbar">
        {user&&<div className="filter-row" style={{margin:0,gap:6}}><button className={`fchip ${scope==='all'?'fchip-on':''}`} onClick={()=>setScope('all')}>{appText(lang,'filters.scopeAll')}</button><button className={`fchip ${scope==='mine'?'fchip-on':''}`} onClick={()=>setScope('mine')}>{appText(lang,'filters.scopeMine')}</button></div>}
        <div className="fls-vtoggle">
          <button className={`fls-vbtn${viewMode==='building'?' fls-vbtn-on':''}`} onClick={()=>setViewMode('building')} title={isEn?'Building view':'Vista edificio'}>🏢</button>
          <button className={`fls-vbtn${viewMode==='list'?' fls-vbtn-on':''}`}     onClick={()=>setViewMode('list')}     title={isEn?'List view':'Lista'}>≡</button>
          <button className={`fls-vbtn${viewMode==='grid'?' fls-vbtn-on':''}`}     onClick={()=>setViewMode('grid')}     title={isEn?'Card grid':'Tarjetas'}>⊞</button>
        </div>
      </div>

      <div style={{position:'relative',marginBottom:14}}>
        <input className="search" style={{paddingRight:36}} placeholder={appText(lang,'listings.search')} value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button className="inc-search-clear" onClick={()=>setSearch('')}>✕</button>}
      </div>

      {filtered.length===0
        ? <EmptyState icon="🏠" title={appText(lang,'listings.none')} sub={appText(lang,'listings.noResults')}/>
        : viewMode==='grid'
          ? <div className="lg">{sorted.map(l=><AptCard key={l.id} l={l} contactProps={contactProps} incCount={incidents.filter(i=>i.aptId===l.id&&i.status==='open').length} canEdit={user?.uid===l.ownerUid||isGlobalAdmin||canEditGlobal} canDelete={user?.uid===l.ownerUid||isGlobalAdmin||canDeleteGlobal} onEdit={()=>onEdit(l)} onDelete={()=>onDelete(l)} onReport={()=>onReport(l)} showLogin={!user} lang={lang}/>)}</div>
          : viewMode==='list'
            ? <div className="fls-list">{floorNums.map(f=><FloorSection key={f} floor={f} apts={byFloor(f)} openCount={incidents.filter(i=>byFloor(f).some(l=>l.id===i.aptId)&&i.status==='open').length} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canEditGlobal={canEditGlobal} canDeleteGlobal={canDeleteGlobal} onEdit={onEdit} onDelete={onDelete} onReport={onReport} lang={lang} isEn={isEn}/>)}</div>
            : <div className="bld-building">{floorNums.map(f=><BuildingFloor key={f} floor={f} apts={byFloor(f)} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canEditGlobal={canEditGlobal} canDeleteGlobal={canDeleteGlobal} canResolveGlobal={canResolveGlobal} onEdit={onEdit} onDelete={onDelete} onReport={onReport} onVerify={onVerify} onResolve={onResolve} isOpen={!!floorOpenState[f]} onToggle={()=>onFloorToggle(f)} lang={lang} isEn={isEn}/>)}</div>
      }
    </div>
  );
}

function AptCard({ l, incCount, contactProps={}, canEdit=false, canDelete=false, onEdit, onDelete, onReport, showLogin, lang="es-CO" }) {
  const isEn = lang==='en';
  const ownerWa = normalizePhoneForWhatsApp(l.contact);
  const opWa    = normalizePhoneForWhatsApp(l.operatorWhatsapp);
  const hasOp   = !!(l.operator || l.operatorEmail || l.operatorWhatsapp);
  return (
    <div className="acard">
      {/* ── Header: apt number + tower + wave ── */}
      <div className="acard-top">
        <div>
          <div className="ac-num">{appText(lang,"listing.apt")} {l.apt}</div>
          {l.tower && <div className="ac-tower">{appText(lang,"listing.tower")} {l.tower}</div>}
        </div>
        <div className="ac-wave">🌊</div>
      </div>

      {/* ── Stats row ── */}
      <div className="ac-stats">
        <span className="chip c-teal">🛏️ {l.rooms} {appText(lang,"listing.roomsShort")}.</span>
        <span className="chip c-blue">👥 {l.guests} {appText(lang,"listing.guests")}</span>
      </div>

      {/* ── Owner ── */}
      <div className="ac-party">
        <div className="ac-party-lbl">👤 {isEn?'Owner':'Propietario'}</div>
        <div className="ac-party-row">
          <UserContact name={l.owner} uid={l.ownerUid} email={l.userEmail||l.email} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
          <div className="ac-cbtns">
            {(l.userEmail||l.email) && <a href={`mailto:${l.userEmail||l.email}`} className="ac-cbtn" title={l.userEmail||l.email}>✉️</a>}
            {ownerWa && <a href={`https://wa.me/${ownerWa}`} className="ac-cbtn ac-cbtn-wa" title={l.contact} target="_blank" rel="noreferrer">💬</a>}
          </div>
        </div>
      </div>

      {/* ── Operator (only if any operator info exists) ── */}
      {hasOp && (
        <div className="ac-party ac-party-op">
          <div className="ac-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
          <div className="ac-party-row">
            {l.operator
              ? <UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
              : <span className="ac-no-name">{isEn?'No name':'Sin nombre'}</span>
            }
            <div className="ac-cbtns">
              {l.operatorEmail    && <a href={`mailto:${l.operatorEmail}`}        className="ac-cbtn"           title={l.operatorEmail}    >✉️</a>}
              {opWa               && <a href={`https://wa.me/${opWa}`}           className="ac-cbtn ac-cbtn-wa" title={l.operatorWhatsapp} target="_blank" rel="noreferrer">💬</a>}
            </div>
          </div>
        </div>
      )}

      {/* ── Airbnb + reports ── */}
      <div className="acard-body">
        {l.airbnb
          ? <a className="airbnb-lnk" href={l.airbnb} target="_blank" rel="noreferrer">{appText(lang,"listings.viewAirbnb")}</a>
          : <div className="no-link">{appText(lang,"listings.noAirbnb")}</div>
        }
        <div className={`inc-b ${incCount>0?"ib-open":"ib-none"}`} onClick={onReport}>
          {incCount>0
            ?(incCount>1?appText(lang,"listings.openReportPlural",{count:incCount}):appText(lang,"listings.openReportSingular",{count:incCount}))
            :appText(lang,"listings.noOpenReports")
          }
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="acard-foot">
        <button className="bsm bs-rep" title={localizedTooltips({},lang).reportIncident} onClick={onReport}>{appText(lang,"reports.reportIncident")}</button>
        {canEdit  && <button className="bsm bs-edit" onClick={onEdit}>{isEn?"✏️ Edit":"✏️ Editar"}</button>}
        {canDelete && <button className="bsm bs-del"  onClick={onDelete}>🗑️</button>}
        {showLogin && <span className="lock-tag">{isEn?"🔒 Sign in":"🔒 Inicia sesión"}</span>}
      </div>
    </div>
  );
}


const normalizeOwnerGuests = (incident={}) => {
  if (Array.isArray(incident.ownerGuests) && incident.ownerGuests.length) {
    return incident.ownerGuests.map(g => ({
      firstName: String(g.firstName || g.first_name || '').trim(),
      middleName: String(g.middleName || g.middle_name || '').trim(),
      lastName: String(g.lastName || g.last_name || '').trim(),
      city: String(g.city || '').trim(),
      country: String(g.country || '').trim(),
    })).filter(g => g.firstName || g.lastName || g.city || g.country);
  }
  if (incident.ownerGuestNames || incident.ownerGuestCity || incident.ownerGuestCountry) {
    return String(incident.ownerGuestNames || '').split(',').map(x => x.trim()).filter(Boolean).map(name => {
      const parts = name.split(/\s+/);
      return { firstName: parts[0] || name, middleName: parts.length > 2 ? parts.slice(1,-1).join(' ') : '', lastName: parts.length > 1 ? parts[parts.length-1] : '', city: incident.ownerGuestCity || '', country: incident.ownerGuestCountry || '' };
    });
  }
  return [];
};
const guestFullName = (g={}) => [g.firstName, g.middleName, g.lastName].map(x=>String(x||'').trim()).filter(Boolean).join(' ');
const guestLocation = (g={}) => [g.city, g.country].map(x=>String(x||'').trim()).filter(Boolean).join(', ');

function WorkflowGroup({ statusKey, icon, label, sublabel, color, incidents, listings, isOpen, onToggle, user, contactProps, isGlobalAdmin, canUpdateGlobal, canDeleteGlobal, canResolveGlobal, onResolve, onDelete, onVerify, lang, isEn }) {
  const count = incidents.length;
  return (
    <div className="wfg-section">
      <button className="wfg-hdr" style={{borderLeftColor:color}} onClick={onToggle}>
        <span className="wfg-icon">{icon}</span>
        <div className="wfg-hdr-body">
          <span className="wfg-label">{label}</span>
          {sublabel&&<span className="wfg-sublabel">{sublabel}</span>}
        </div>
        <span className="wfg-badge" style={{background:color+'22',color}}>{count}</span>
        <span className={`fls-chev${isOpen?' fls-chev-up':''}`}>›</span>
      </button>
      {isOpen&&(
        <div className="wfg-body">
          {count===0
            ? <div className="wfg-empty">✓ {isEn?'None here':'Nada aquí'}</div>
            : incidents.map(inc=><IRow key={inc.id} inc={inc} user={user} listings={listings} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canUpdateGlobal={canUpdateGlobal} canDeleteGlobal={canDeleteGlobal} canResolveGlobal={canResolveGlobal} onResolve={onResolve} onDelete={onDelete} onVerify={onVerify} lang={lang}/>)
          }
        </div>
      )}
    </div>
  );
}

function IncidentsView({ incidents, listings, user, quickFilter=null, onQuickFilterApplied=()=>{}, contactProps={}, isGlobalAdmin=false, canUpdateGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, onAdd, onResolve, onDelete, onVerify, lang="es-CO" }) {
  const [sf,setSf]=useState("all"), [cf,setCf]=useState("all"), [scope,setScope]=useState("all"), [search,setSearch]=useState("");
  useEffect(()=>{
    if (quickFilter === "ownerVerification") { setScope("ownerVerification"); setSf("open"); setCf("all"); onQuickFilterApplied(); }
    if (quickFilter === "requiresResolution") { setScope("requiresResolution"); setSf("verified"); setCf("all"); onQuickFilterApplied(); }
    if (quickFilter === "seriousOpen") { setScope("all"); setSf("all"); setCf("serious"); onQuickFilterApplied(); }
  }, [quickFilter, onQuickFilterApplied]);
  const listingMap = Object.fromEntries(listings.map(l=>[l.id, l]));
  const myListingIds = new Set((user ? listings.filter(l=>l.ownerUid===user.uid) : []).map(l=>l.id));
  let list=[...incidents];
  // "I reported" — incidents the current user filed (any apartment)
  if(scope==="iReported"   && user) list=list.filter(i=>i.reporterUid===user.uid);
  // "My listings" — incidents against apartments the user owns
  if(scope==="myListings"  && user) list=list.filter(i=>myListingIds.has(i.aptId));
  // "Needs resolution" — user's incidents (reported by or against their listings) that are still open/verified
  if(scope==="needsResolution" && user) list=list.filter(i=>i.status!=='resolved'&&(myListingIds.has(i.aptId)||i.reporterUid===user.uid));
  // Legacy quickFilter scopes (used by dashboard action pills)
  if(scope==="ownerVerification" && user) list=list.filter(i=>i.status==="open"&&myListingIds.has(i.aptId));
  if(scope==="requiresResolution") list=list.filter(i=>i.status==="verified"&&(isGlobalAdmin||canResolveGlobal));
  if(sf!=="all") list=list.filter(i=>i.status===sf);
  if(cf!=="all") list=list.filter(i=>i.category===cf);
  if(search.trim()){
    const q=search.trim().toLowerCase();
    list=list.filter(i=>{
      const apt      = String(i.aptLabel||'').toLowerCase();
      const owner    = String(listingMap[i.aptId]?.owner||'').toLowerCase();
      const operator = String(listingMap[i.aptId]?.operator||'').toLowerCase();
      const desc     = String(i.desc||'').toLowerCase();
      const type     = String(i.type||'').toLowerCase();
      const reporter = String(i.reporterName||'').toLowerCase();
      // Initial report guest fields
      const guest    = String(i.guestName||'').toLowerCase();
      const city     = String(i.guestCity||'').toLowerCase();
      const country  = String(i.guestCountry||'').toLowerCase();
      // Owner-verified guest fields (set during verification step)
      const vGuests  = String(i.ownerGuestNames||'').toLowerCase();
      const vCity    = String(i.ownerGuestCity||'').toLowerCase();
      const vCountry = String(i.ownerGuestCountry||'').toLowerCase();
      // Individual verified guest records (firstName, lastName, city, country)
      const guestDetails = Array.isArray(i.ownerGuests)
        ? i.ownerGuests.map(g=>[g.firstName,g.middleName,g.lastName,g.city,g.country].filter(Boolean).join(' ')).join(' ').toLowerCase()
        : '';
      return apt.includes(q)||owner.includes(q)||operator.includes(q)||desc.includes(q)||type.includes(q)||reporter.includes(q)||guest.includes(q)||city.includes(q)||country.includes(q)||vGuests.includes(q)||vCity.includes(q)||vCountry.includes(q)||guestDetails.includes(q);
    });
  }
  list.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const isEn = lang==='en';
  const anyFilter = sf!=='all'||cf!=='all'||(user&&scope!=='all'&&scope!=='iReported'&&scope!=='myListings'&&scope!=='needsResolution')||search.trim()!==''||['iReported','myListings','needsResolution','ownerVerification','requiresResolution'].includes(scope);
  const resetAll = () => { setSf('all'); setCf('all'); setScope('all'); setSearch(''); };
  const [groupOpen, setGroupOpen] = useState({open:true,verified:false,resolved:false});
  const toggleGroup = (k) => setGroupOpen(s=>({...s,[k]:!s[k]}));

  const wfGroups = [
    { key:'open',     icon:'⚠️', color:'#d9a030', label:appText(lang,'workflow.open'),     sublabel:isEn?'Pending owner verification':'Pendiente verificación del propietario' },
    { key:'verified', icon:'👤', color:'#0b7f4f', label:appText(lang,'workflow.verified'),  sublabel:isEn?'Awaiting admin resolution':'Esperando resolución del admin' },
    { key:'resolved', icon:'✓',  color:'#6a9a7a', label:appText(lang,'workflow.resolved'),  sublabel:isEn?'Closed incidents':'Incidentes cerrados' },
  ];

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang,"reports.title")}</h1>
          <p className="psub">{appText(lang,"reports.subtitle",{total:list.length,open:list.filter(i=>i.status==="open").length})}</p>
        </div>
        {user&&<button className="btn-p btn-report" onClick={onAdd}>{appText(lang,"reports.reportIncident")}</button>}
      </div>

      <div className="inc-search-wrap" style={{marginBottom:10}}>
        <input className="search inc-search" placeholder={appText(lang,"incidents.search")} value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button className="inc-search-clear" onClick={()=>setSearch('')}>✕</button>}
      </div>

      <div className="wfg-filters">
        <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
          <button className={`fchip fchip-sm ${scope==='all'?'fchip-on':''}`} onClick={()=>{setScope('all');setSf('all');}}>
            {isEn?'All':'Todos'}
          </button>
          {user&&<>
            <button className={`fchip fchip-sm ${scope==='iReported'?'fchip-on':''}`} onClick={()=>{setScope(scope==='iReported'?'all':'iReported');setSf('all');}}>
              📋 {isEn?'I reported':'Yo reporté'}
            </button>
            <button className={`fchip fchip-sm ${scope==='myListings'?'fchip-on':''}`} onClick={()=>{setScope(scope==='myListings'?'all':'myListings');setSf('all');}}>
              🏠 {isEn?'My listings':'Mis listings'}
            </button>
            <button className={`fchip fchip-sm ${scope==='needsResolution'?'fchip-on':''}`} onClick={()=>{setScope(scope==='needsResolution'?'all':'needsResolution');setSf('all');}}>
              🔧 {isEn?'Needs resolution':'Sin resolver'}
            </button>
          </>}
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
          {GUEST_CATEGORIES.map(c=><button key={c.value} className={`fchip fchip-sm ${cf===c.value?'fchip-on':''}`} onClick={()=>setCf(cf===c.value?'all':c.value)}>{c.icon} {categoryLabel(c.value,lang)}</button>)}
          {anyFilter&&<button className="fchip fchip-sm fchip-reset" onClick={resetAll}>✕ {isEn?'Reset':'Limpiar'}</button>}
        </div>
      </div>

      <div className="wfg-list">
        {wfGroups.map(g=>(
          <WorkflowGroup
            key={g.key}
            statusKey={g.key}
            icon={g.icon}
            color={g.color}
            label={g.label}
            sublabel={g.sublabel}
            incidents={list.filter(i=>i.status===g.key)}
            listings={listings}
            isOpen={groupOpen[g.key]}
            onToggle={()=>toggleGroup(g.key)}
            user={user}
            contactProps={contactProps}
            isGlobalAdmin={isGlobalAdmin}
            canUpdateGlobal={canUpdateGlobal}
            canDeleteGlobal={canDeleteGlobal}
            canResolveGlobal={canResolveGlobal}
            onResolve={onResolve}
            onDelete={onDelete}
            onVerify={onVerify}
            lang={lang}
            isEn={isEn}
          />
        ))}
      </div>
    </div>
  );
}

const localizeNotification = (n={}, lang="es-CO") => {
  const title = String(n.title || '');
  const message = String(n.message || '');
  if (lang !== 'en') return { title, message };
  let outTitle = title
    .replace(/^Nuevo incidente abierto/i, 'New open incident')
    .replace(/^Nuevo registro pendiente/i, 'New pending registration')
    .replace(/^Registro aprobado/i, 'Registration approved')
    .replace(/^Registro rechazado/i, 'Registration declined')
    .replace(/^Listing actualizado/i, 'Listing updated')
    .replace(/^Listing eliminado/i, 'Listing deleted')
    .replace(/^Nuevo listing/i, 'New listing')
    .replace(/Apto\s+(\d+)/gi, 'Apartment $1');
  let outMessage = message
    .replace(/solicita acceso con (\d+) listing\(s\)\./i, 'requests access with $1 listing(s).')
    .replace(/Nuevo incidente reportado/i, 'New incident reported')
    .replace(/Pendiente de revisión/i, 'Pending review')
    .replace(/Apto\s+(\d+)/gi, 'Apartment $1');
  return { title: outTitle, message: outMessage };
};

function NotificationsView({ notifications, incidents, listings=[], contactProps={}, onRead, onReadAll, lang="es-CO", smartAlerts=[] }) {
  const unread = notifications.filter(n => !n.isRead).length;
  const hasAlerts = smartAlerts.length > 0;
  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">🔔 {lang==='en'?'Notifications':'Notificaciones'}</h1>
          <p className="psub">{lang==='en'
            ? `${hasAlerts?smartAlerts.length+' priority action'+(smartAlerts.length!==1?'s':'')+' · ':''}${unread} unread alert${unread!==1?'s':''}`
            : `${hasAlerts?smartAlerts.length+' acción'+(smartAlerts.length!==1?'es':'')+' prioritaria'+(smartAlerts.length!==1?'s':'')+' · ':''}${unread} aviso${unread!==1?'s':''} sin leer`}
          </p>
        </div>
        {unread>0 && <button className="btn-p" onClick={onReadAll}>{appText(lang,"notifications.markAll")}</button>}
      </div>

      {hasAlerts && (
        <div className="notif-alerts-section">
          <div className="section-label" style={{marginBottom:10}}>
            🎯 {lang==='en'?'Priority actions — tap to act':'Acciones prioritarias — toca para actuar'}
          </div>
          <div className="notif-alerts-grid">
            {smartAlerts.map(a => (
              <button key={a.id} className={`smart-item smart-${a.tone}`} onClick={a.action}>
                <span className="smart-count" style={{background: SMART_TONE_COLOR[a.tone]||'#0b7f4f'}}>{a.count}</span>
                <span className="smart-title"><span className="smart-icon-inline" aria-hidden="true">{a.icon}</span>{a.title}</span>
                <span className="smart-arr" aria-hidden="true">›</span>
                <span className="smart-desc">{a.msg}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section-label" style={{margin:`${hasAlerts?20:0}px 0 10px`}}>
        {lang==='en'?'Alert history':'Historial de avisos'}
      </div>
      {notifications.length===0
        ? <EmptyState icon="🔔" title={appText(lang,"notifications.none")} sub={appText(lang,"notifications.noneSub")}/>
        : <div className="notice-list">{notifications.map(n=>{
            const inc=incidents.find(i=>i.id===n.incidentId);
            const nt=localizeNotification(n,lang);
            return (
              <div key={n.id} className={`notice-card ${n.isRead?'notice-read':'notice-new'}`}>
                <div className="notice-main">
                  <div className="notice-title">{n.isRead?'🔔':'🆕'} {nt.title}</div>
                  <div className="notice-msg">{nt.message}</div>
                  <div className="notice-meta">{new Date(n.createdAt).toLocaleString(lang==='en'?'en-US':'es-CO')} · {appText(lang,'common.email')}: {n.emailSent?(appText(lang,'common.sent')+' ✅'):(appText(lang,'common.notSent')+' ⚠️')}{n.emailError?` · ${n.emailError}`:''}</div>
                  {inc&&<div className="notice-inc"><strong>{appText(lang,'notifications.detail')}:</strong> {inc.desc}</div>}
                </div>
                {!n.isRead&&<button className="bsm bs-resolve" onClick={()=>onRead(n.id)}>{appText(lang,"notifications.markRead")}</button>}
              </div>
            );
          })}</div>
      }
    </div>
  );
}

function IRow({ inc, user, listings=[], contactProps={}, isGlobalAdmin=false, canUpdateGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, onResolve, onDelete, onVerify, compact, naughtyMode, lang="es-CO" }) {
  const listing   = listings.find(l=>l.id===inc.aptId);
  const isOwner   = Boolean(user?.uid && listing?.ownerUid === user.uid);
  const isReporter= Boolean(user?.uid && inc.reporterUid === user.uid);
  const guests = normalizeOwnerGuests(inc);
  const ti=INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6], ci=GUEST_CATEGORIES.find(c=>c.value===inc.category); const tiLabel=incidentTypeLabel(ti.value,lang), ciLabel=ci?categoryLabel(ci.value,lang):"";
  const isEn = lang==='en';
  return (
    <div className={`irow ${(inc.status==="resolved"||inc.status==="verified")?"irow-res":""} ${naughtyMode?"irow-naughty":""}`}>
      <div className="ir-l">
        <div className="ir-apt-context">
          <div className="ir-apt">{inc.aptLabel}</div>
          {listing&&<div className="ir-apt-sub">👤 {listing.owner||'—'}{listing.operator?` · 🔧 ${listing.operator}`:''}</div>}
        </div>
        {/* Who the current user is in relation to this incident */}
        {user&&(isReporter||isOwner)&&(
          <div className="ir-ctx-tags">
            {isReporter&&<span className="inc-ctx-tag inc-ctx-reporter">{isEn?'📋 I reported':'📋 Yo reporté'}</span>}
            {isOwner&&<span className="inc-ctx-tag inc-ctx-mine">{isEn?'🏠 My listing':'🏠 Mi listing'}</span>}
          </div>
        )}
        {guests.length>0?<div className="ir-guest">👥 {guests.map(guestFullName).join(' · ')}</div>:<div className="ir-guest">👤 {inc.guestName||(isEn?'Pending owner verification':'Pendiente por verificar')}</div>}
        {guests.length>0&&<div className="ir-loc">📍 {[...new Set(guests.map(guestLocation).filter(Boolean))].join(' · ')}</div>}
        {!guests.length&&inc.guestCity&&<div className="ir-loc">📍 {inc.guestCity}, {inc.guestCountry}</div>}
        <div className="ir-date">📅 {fmtDate(inc.date)}</div>
        {!compact&&!isReporter&&<div className="ir-rep">{isEn?'By':'Por'}: <UserContact name={inc.reporterName} uid={inc.reporterUid} {...contactProps}/></div>}
      </div>
      <div className="ir-c">
        <div className="ir-tags">
          <span className="ir-type" style={{background:ti.bg,color:ti.color}}>{tiLabel}</span>
          {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color}}>{ci.icon} {ciLabel}</span>}
          <span className={`ir-status ${inc.status==="open"?"is-open":inc.status==="resolved"?"is-resolved":"is-verified"}`}>
            {inc.status==="open"?(isEn?"⚠️ Open":"⚠️ Abierto"):inc.status==="verified"?(isEn?"✅ Verified":"✅ Verificado"):(isEn?"🛠️ Resolved":"🛠️ Resuelto")}
          </span>
          {inc.slaCycleCount>0&&<span className="ir-cat" style={{background:"#fff3e0",color:"#e65100"}}>⏱️ SLA {inc.slaCycleCount}</span>}
        </div>
        {!compact&&<div className="ir-desc">{inc.desc}</div>}
        {guests.length>0&&<div className="ir-desc">
          <strong>{appText(lang,'form.guestDetails')}:</strong>
          <div className="guest-display-list">{guests.map((g,idx)=><div key={idx}>👤 {guestFullName(g)}{guestLocation(g)?` · ${guestLocation(g)}`:''}</div>)}</div>
          {inc.ownerComments&&<div style={{marginTop:6}}><strong>{appText(lang,'form.ownerResponse')}:</strong> {inc.ownerComments}</div>}
          {inc.resolutionComments&&<div style={{marginTop:6}}><strong>{appText(lang,'form.resolutionComments')}:</strong> {inc.resolutionComments}</div>}
        </div>}
      </div>
      {!compact&&user&&<div className="ir-acts">
        {inc.status==="open"&&isOwner&&<button className="bsm bs-resolve" onClick={()=>onVerify(inc)}>{appText(lang,"reports.verify")}</button>}
        {inc.status==="verified"&&(isGlobalAdmin||canResolveGlobal)&&<button className="bsm bs-resolve" onClick={()=>onResolve(inc.id)}>{appText(lang,"reports.close")}</button>}
        {(isReporter||isGlobalAdmin||canDeleteGlobal)&&<button className="bsm bs-del" onClick={()=>onDelete(inc.id)}>🗑️</button>}
      </div>}
    </div>
  );
}

// LoginModal replaced by Firebase signInWithPopup — no modal needed

function ListingModal({ title, user, initial={}, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
  const isEn = lang === 'en';
  const [f,setF]=useState({apt:"",rooms:"2",guests:4,operator:"",operatorEmail:"",operatorWhatsapp:"",airbnb:"",...initial,tower:"KAI"});
  const [errors,setErrors]=useState({});
  const [checkingApt,setCheckingApt]=useState(false);
  const s=(k,v)=>{ setF(p=>({...p,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };
  const checkApt=async()=>{
    const apt=String(f.apt||'').trim();
    if(!apt || !/^[0-9]{3}$/.test(apt)) return;
    setCheckingApt(true);
    try{
      const r = await checkApartmentUnique({ apt, ownerUid:user?.uid, excludeListingId:initial?.id || '' });
      if(!r.available) setErrors(e=>({...e,apt:r.message || appText(lang,'validation.aptTaken')}));
    }catch(e){ setErrors(er=>({...er,apt:appText(lang,'validation.aptCheckFailed')})); }
    finally{ setCheckingApt(false); }
  };
  const validate=()=>{
    const e={};
    if(!String(f.apt||"").trim()) e.apt=appText(lang,'validation.aptRequired');
    else if(!/^[0-9]{3}$/.test(String(f.apt).trim())) e.apt=appText(lang,'validation.aptFormat');
    if(!String(f.rooms||"").trim()) e.rooms=appText(lang,'validation.roomsRequired');
    if(!f.guests || Number(f.guests)<1) e.guests=appText(lang,'validation.capacityRequired');
    if(String(f.operatorEmail||"").trim() && !validateEmail(f.operatorEmail)) e.operatorEmail=appText(lang,'validation.operatorEmailInvalid');
    const waOpErr=validateWhatsApp(f.operatorWhatsapp,lang); if(waOpErr) e.operatorWhatsapp=waOpErr;
    if(f.airbnb && !/^https?:\/\/.+/i.test(String(f.airbnb).trim())) e.airbnb=appText(lang,'validation.urlInvalid');
    setErrors(e);
    return Object.keys(e).length===0;
  };
  const inputCls=(k)=>errors[k]?"field-error":"";
  const optLabel = <span style={{color:"#70d6c6",fontStyle:"italic",textTransform:"none",letterSpacing:0,fontSize:"0.68rem"}}>({appText(lang,"form.optional")})</span>;
  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">{title}</div>
      <div className="modal-sub">{appText(lang,"modal.listing.ownerPrefix")}: {user?.name}</div>
      <div className="form-alert" style={{marginBottom:8}}>
        {isEn ? 'Your Google email and profile WhatsApp are used as contact details for this listing.' : 'Tu email de Google y WhatsApp del perfil se usan como contacto para este listing.'}
      </div>
      <div className="fg2">
        {/* ── Listing ──────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🏠 {isEn?'Listing details':'Datos del listing'}</div>
        <div className="fg"><label>{appText(lang,"form.aptNumber")} <Tip text={tips.aptNumber}/></label><input className={inputCls("apt")} value={f.apt} onChange={e=>s("apt",e.target.value)} onBlur={checkApt} placeholder="000"/>{checkingApt&&<span className="help-msg">{appText(lang,'validation.aptChecking')}</span>}{errors.apt&&<span className="err-msg">{errors.apt}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value="KAI" readOnly disabled className="locked-field"/></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={inputCls("rooms")} value={f.rooms} onChange={e=>s("rooms",e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors.rooms&&<span className="err-msg">{errors.rooms}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={inputCls("guests")} type="number" value={f.guests} onChange={e=>s("guests",parseInt(e.target.value)||"")} min={1} max={20}/>{errors.guests&&<span className="err-msg">{errors.guests}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} {optLabel}</label><input className={inputCls("airbnb")} value={f.airbnb} onChange={e=>s("airbnb",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!/^https?:\/\/.+/i.test(v))setErrors(p=>({...p,airbnb:appText(lang,'validation.urlInvalid')}));else setErrors(p=>({...p,airbnb:undefined}));}} placeholder="https://www.airbnb.com/rooms/..."/>{errors.airbnb&&<span className="err-msg">{errors.airbnb}</span>}</div>
        {/* ── Operator ─────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🔧 {isEn?'Operator (optional)':'Operador (opcional)'}</div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} <Tip text={tips.operator}/></label><input className={inputCls("operator")} value={f.operator} onChange={e=>s("operator",e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors.operator&&<span className="err-msg">{errors.operator}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} {optLabel}</label><input className={inputCls("operatorEmail")} type="email" value={f.operatorEmail} onChange={e=>s("operatorEmail",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!validateEmail(v))setErrors(p=>({...p,operatorEmail:appText(lang,'validation.operatorEmailInvalid')}));else setErrors(p=>({...p,operatorEmail:undefined}));}} placeholder="operador@email.com"/>{errors.operatorEmail&&<span className="err-msg">{errors.operatorEmail}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.operatorWhatsappOptional")} {optLabel}</label><input className={inputCls("operatorWhatsapp")} type="tel" value={f.operatorWhatsapp} onChange={e=>s("operatorWhatsapp",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const err=validateWhatsApp(v,lang);setErrors(p=>({...p,operatorWhatsapp:err||undefined}));}} placeholder="+57 300 000 0000"/>{errors.operatorWhatsapp?<span className="err-msg">{errors.operatorWhatsapp}</span>:<span className="help-msg">{isEn?'With country code, e.g. +57':'Con código de país, ej. +57'}</span>}</div>
      </div>
      <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" onClick={()=>{if(validate()) onSave({...f,apt:String(f.apt).trim(),tower:"KAI",operatorEmail:String(f.operatorEmail||"").trim().toLowerCase(),operatorWhatsapp:String(f.operatorWhatsapp||"").trim(),airbnb:String(f.airbnb||"").trim()});}}>{appText(lang,"form.save")}</button></div>
    </Overlay>
  );
}

function IncidentModal({ listings, user, presetApt, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
  const isEn = lang === 'en';
  const [f,setF]=useState({aptId:presetApt||"",date:today(),type:"noise",category:"minor",desc:""});
  const [errors,setErrors]=useState({});
  const s=(k,v)=>{ setF(p=>({...p,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };
  const validate=()=>{
    const e={};
    if(!f.aptId) e.aptId=appText(lang,"validation.apartment");
    if(!f.date) e.date=appText(lang,"validation.date");
    if(!f.type) e.type=appText(lang,"validation.type");
    if(!f.category) e.category=appText(lang,"validation.category");
    if(!String(f.desc||"").trim()) e.desc=appText(lang,"validation.description");
    setErrors(e);
    return Object.keys(e).length===0;
  };
  const inputCls=(k)=>errors[k]?"field-error":"";
  // Template for current type+category combo
  const templateKey = `${f.type}_${f.category}`;
  const templateText = INCIDENT_TEMPLATES[templateKey] ? (isEn ? INCIDENT_TEMPLATES[templateKey].en : INCIDENT_TEMPLATES[templateKey].es) : null;
  const applyTemplate = () => { if(templateText) s('desc', templateText); };
  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">{appText(lang,"modal.report.title")}</div><div className="modal-sub">{appText(lang,"modal.report.sub",{name:user?.name||""})}</div>
      <div className="form-alert">{appText(lang,"modal.report.help")}</div>
      <div className="fg2">
        <div className="fg"><label>{appText(lang,"form.apartment")} <Tip text={tips.incidentApartment}/></label><select className={inputCls("aptId")} value={f.aptId} onChange={e=>s("aptId",e.target.value)}><option value="">{appText(lang,"form.select")}</option>{[...listings].sort((a,b)=>a.apt.localeCompare(b.apt)).map(l=><option key={l.id} value={l.id}>{aptDisplay(l.apt, lang)} – {l.owner}</option>)}</select>{errors.aptId&&<span className="err-msg">{errors.aptId}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.date")}</label><input className={inputCls("date")} type="date" value={f.date} onChange={e=>s("date",e.target.value)}/>{errors.date&&<span className="err-msg">{errors.date}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.type")} <Tip text={tips.incidentType}/></label><select className={inputCls("type")} value={f.type} onChange={e=>s("type",e.target.value)}>{INCIDENT_TYPES.map(t=><option key={t.value} value={t.value}>{incidentTypeLabel(t.value,lang)}</option>)}</select>{errors.type&&<span className="err-msg">{errors.type}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.category")} <Tip text={tips.incidentCategory}/></label><div className="csel">{GUEST_CATEGORIES.map(c=><button key={c.value} type="button" className={`copt ${f.category===c.value?"copt-on":""}`} style={f.category===c.value?{background:c.bg,color:c.color,borderColor:c.color}:{}} onClick={()=>s("category",c.value)}>{c.icon} {categoryLabel(c.value,lang)}</button>)}</div>{errors.category&&<span className="err-msg">{errors.category}</span>}</div>
        <div className="fg full">
          <label>{appText(lang,"form.description")} <Tip text={tips.incidentDescription}/></label>
          {templateText && !String(f.desc||'').trim() && (
            <div className="inc-template-hint">
              <span className="inc-template-label">💡 {isEn?'Template:':'Plantilla:'}</span>
              <span className="inc-template-preview">{templateText}</span>
              <button type="button" className="inc-template-apply" onClick={applyTemplate}>{isEn?'Use template':'Usar plantilla'}</button>
            </div>
          )}
          <textarea className={inputCls("desc")} value={f.desc} onChange={e=>s("desc",e.target.value)} placeholder={templateText||appText(lang,"form.descriptionPlaceholder")} rows={4}/>
          {errors.desc&&<span className="err-msg">{errors.desc}</span>}
        </div>
      </div>
      <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-danger" title={tips.reportIncident} onClick={()=>{if(validate()) onSave(f);}}>{appText(lang,"form.registerReport")}</button></div>
    </Overlay>
  );
}


function VerifyIncidentModal({ incident, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
  const blankGuest = () => ({ firstName:'', middleName:'', lastName:'', city:'', country:'Colombia' });
  const initialGuests = normalizeOwnerGuests(incident);
  const [guests,setGuests]=useState(initialGuests.length ? initialGuests : [blankGuest()]);
  const [ownerComments,setOwnerComments]=useState(incident?.ownerComments || '');
  const [errors,setErrors]=useState({});
  const setGuest = (idx, field, value) => {
    setGuests(gs => gs.map((g,i)=>i===idx?{...g,[field]:value}:g));
    setErrors(e => ({...e, [`${field}_${idx}`]:undefined}));
  };
  const addGuest = () => setGuests(gs => [...gs, blankGuest()]);
  const removeGuest = (idx) => setGuests(gs => gs.length <= 1 ? gs : gs.filter((_,i)=>i!==idx));
  const validate=()=>{
    const e={};
    guests.forEach((g,i)=>{
      if(!String(g.firstName||'').trim()) e[`firstName_${i}`]=appText(lang,'validation.guestFirstName');
      if(!String(g.lastName||'').trim()) e[`lastName_${i}`]=appText(lang,'validation.guestLastName');
      if(!String(g.city||'').trim()) e[`city_${i}`]=appText(lang,'validation.city');
      if(!String(g.country||'').trim()) e[`country_${i}`]=appText(lang,'validation.country');
    });
    if(!String(ownerComments||'').trim()) e.ownerComments=appText(lang,'validation.ownerComments');
    setErrors(e);
    return Object.keys(e).length===0;
  };
  return <Overlay onClose={onClose} wide>
    <div className="modal-title">{appText(lang,"modal.verify.title")}</div><div className="modal-sub">{appText(lang,"modal.verify.sub",{apt:incident?.aptLabel||""})}</div>
    <div className="form-alert">{appText(lang,"modal.verify.help")}</div>
    <div className="guest-editor-list">
      {guests.map((g,idx)=><div key={idx} className="guest-editor-card">
        <div className="guest-editor-title"><strong>{appText(lang,'form.guestNumber',{count:idx+1})}</strong>{guests.length>1&&<button type="button" className="btn-mini-danger" onClick={()=>removeGuest(idx)}>🗑️ {appText(lang,'form.removeGuest')}</button>}</div>
        <div className="fg2">
          <div className="fg"><label>{appText(lang,'form.guestFirstName')} *</label><input className={errors[`firstName_${idx}`]?'field-error':''} value={g.firstName} onChange={e=>setGuest(idx,'firstName',e.target.value)} />{errors[`firstName_${idx}`]&&<span className="err-msg">{errors[`firstName_${idx}`]}</span>}</div>
          <div className="fg"><label>{appText(lang,'form.guestMiddleName')}</label><input value={g.middleName} onChange={e=>setGuest(idx,'middleName',e.target.value)} /></div>
          <div className="fg"><label>{appText(lang,'form.guestLastName')} *</label><input className={errors[`lastName_${idx}`]?'field-error':''} value={g.lastName} onChange={e=>setGuest(idx,'lastName',e.target.value)} />{errors[`lastName_${idx}`]&&<span className="err-msg">{errors[`lastName_${idx}`]}</span>}</div>
          <div className="fg"><label>{appText(lang,"form.city")}</label><input className={errors[`city_${idx}`]?'field-error':''} value={g.city} onChange={e=>setGuest(idx,'city',e.target.value)} placeholder="Bogotá" />{errors[`city_${idx}`]&&<span className="err-msg">{errors[`city_${idx}`]}</span>}</div>
          <div className="fg"><label>{appText(lang,"form.country")}</label><select className={errors[`country_${idx}`]?'field-error':''} value={g.country} onChange={e=>setGuest(idx,'country',e.target.value)}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>{errors[`country_${idx}`]&&<span className="err-msg">{errors[`country_${idx}`]}</span>}</div>
        </div>
      </div>)}
      <button type="button" className="btn-ghost" onClick={addGuest}>{appText(lang,'form.addGuest')}</button>
    </div>
    <div className="fg full"><label>{appText(lang,"form.ownerResponse")} <Tip text={tips.verifyIncident}/></label><textarea className={errors.ownerComments?'field-error':''} value={ownerComments} onChange={e=>{setOwnerComments(e.target.value);setErrors(er=>({...er,ownerComments:undefined}));}} rows={4} placeholder={appText(lang,"form.ownerResponsePlaceholder")}/>{errors.ownerComments&&<span className="err-msg">{errors.ownerComments}</span>}</div>
    <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" title={tips.verifyIncident} onClick={()=>{ if(validate()) onSave({guests, ownerComments});}}>{appText(lang,"form.saveVerification")}</button></div>
  </Overlay>;
}


function AnalyticsDashboard({ user, contactProps={}, showToast=()=>{}, isGlobalAdmin=false, lang="es-CO" }) {
  const [rangeMode, setRangeMode] = useState('preset');   // 'preset' | 'custom'
  const [days, setDays]           = useState('90');        // preset: 30|90|180|365|all
  const [startDate, setStartDate] = useState('');          // custom YYYY-MM-DD
  const [endDate, setEndDate]     = useState('');          // custom YYYY-MM-DD
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const isEn = lang==='en';

  // Today's date for max constraint on date inputs
  const todayISO = new Date().toISOString().slice(0,10);

  const buildUrl = useCallback(() => {
    let url = '/api/analytics?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '');
    if (rangeMode === 'custom' && startDate && endDate) {
      url += '&start=' + encodeURIComponent(startDate) + '&end=' + encodeURIComponent(endDate);
    } else {
      url += '&days=' + encodeURIComponent(days);
    }
    return url;
  }, [user?.uid, user?.email, rangeMode, days, startDate, endDate]);

  const load = useCallback(() => {
    if (!user?.uid) return;
    if (rangeMode === 'custom' && (!startDate || !endDate)) {
      showToast(isEn ? 'Select both start and end date' : 'Selecciona fecha inicio y fin', true);
      return;
    }
    setLoading(true);
    api.get(buildUrl())
      .then(setData)
      .catch(e => showToast((isEn ? 'Error loading analytics: ' : 'Error cargando analíticas: ') + (e.message || ''), true))
      .finally(() => setLoading(false));
  }, [buildUrl, user?.uid, rangeMode, startDate, endDate]);

  // Auto-load when preset changes
  useEffect(() => { if (rangeMode === 'preset') load(); }, [days, rangeMode]);
  // Initial load
  useEffect(() => { load(); }, [user?.uid]);

  const s = data?.summary || {};
  const bar=(rows=[])=> rows.length ? <div className="bar-list">{rows.map(r=>{ const max=Math.max(...rows.map(x=>x.count||0),1); return <div key={r.name} className="bar-row"><div className="bar-label">{r.name}</div><div className="bar-track"><span style={{width:`${Math.max(6,(r.count/max)*100)}%`}}/></div><div className="bar-count">{r.count}</div></div>;})}</div> : <Empty icon="📭" msg={appText(lang,"analytics.noData")}/>;
  const fmt=(d)=>d?new Date(d).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO',{dateStyle:'medium',timeStyle:'short'}):'';

  const windowDesc = data?.windowLabel
    ? (isEn ? `Showing: ${data.windowLabel}` : `Mostrando: ${data.windowLabel}`)
    : '';

  const presets = [
    { v:'30',  label: isEn ? '30 days' : '30 días' },
    { v:'90',  label: isEn ? '90 days' : '90 días' },
    { v:'180', label: isEn ? '180 days' : '180 días' },
    { v:'365', label: isEn ? '1 year'  : '1 año'   },
    { v:'all', label: isEn ? 'All time' : 'Todo el tiempo' },
  ];

  return <div className="fade">
    <div className="ph">
      <div>
        <h1 className="ptitle">{appText(lang,"analytics.title")}</h1>
        <p className="psub">{isGlobalAdmin ? appText(lang,"analytics.subtitleAdmin") : appText(lang,"analytics.subtitleUser")} · {appText(lang,"analytics.subtitleRest")}</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
        {/* ── Mode toggle ── */}
        <div className="an-range-bar">
          <div className="an-mode-toggle">
            <button className={`an-mode-btn${rangeMode==='preset'?' an-mode-on':''}`} onClick={()=>setRangeMode('preset')}>
              {isEn?'Presets':'Predefinido'}
            </button>
            <button className={`an-mode-btn${rangeMode==='custom'?' an-mode-on':''}`} onClick={()=>setRangeMode('custom')}>
              📅 {isEn?'Date range':'Rango de fechas'}
            </button>
          </div>
          {/* ── Preset pills ── */}
          {rangeMode==='preset' && (
            <div className="an-preset-pills">
              {presets.map(p=>(
                <button key={p.v} className={`an-preset-pill${days===p.v?' an-preset-on':''}`} onClick={()=>setDays(p.v)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {/* ── Custom date range ── */}
          {rangeMode==='custom' && (
            <div className="an-custom-range">
              <div className="an-date-group">
                <label className="an-date-lbl">{isEn?'From':'Desde'}</label>
                <input type="date" className="an-date-input" value={startDate} max={endDate||todayISO} onChange={e=>setStartDate(e.target.value)}/>
              </div>
              <span className="an-date-sep">→</span>
              <div className="an-date-group">
                <label className="an-date-lbl">{isEn?'To':'Hasta'}</label>
                <input type="date" className="an-date-input" value={endDate} min={startDate} max={todayISO} onChange={e=>setEndDate(e.target.value)}/>
              </div>
              <button className="btn-p" style={{alignSelf:'flex-end'}} onClick={load} disabled={!startDate||!endDate||loading}>
                {loading ? appText(lang,'analytics.loading') : (isEn?'Apply':'Aplicar')}
              </button>
            </div>
          )}
          {rangeMode==='preset' && <button className="btn-p" onClick={load} disabled={loading}>
            {loading ? appText(lang,'analytics.loading') : appText(lang,'analytics.refresh')}
          </button>}
        </div>
        {windowDesc && <div className="an-window-desc">{windowDesc}</div>}
      </div>
    </div>
    <div className="stats6">{[
      ['⚠️',s.openIncidents||0,appText(lang,'analytics.open'),'#d4634a'],['🚨',s.breachedSla||0,appText(lang,'analytics.breached'),'#c62828'],['⏳',s.dueSoon24h||0,appText(lang,'analytics.dueSoon'),'#e19a4b'],['✅',s.verifiedIncidents||0,appText(lang,'analytics.verified'),'#2F8F46'],['⏱️',`${s.avgResponseHours||0}h`,appText(lang,'analytics.avgResponse'),'#0b7f8c'],['🔁',s.escalationCycles||0,appText(lang,'analytics.cycles'),'#6a1b9a']
    ].map((x,i)=><div className="scard" key={i} style={{borderTop:`3px solid ${x[3]}`}}><div style={{fontSize:'1.4rem'}}>{x[0]}</div><div className="sval" style={{color:x[3]}}>{x[1]}</div><div className="slabel">{x[2]}</div></div>)}</div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">{appText(lang,"analytics.breachedIncidents")}</div><div className="psub">{appText(lang,"analytics.breachedSub")}</div></div></div>{(data?.breachRows||[]).length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>{appText(lang,"analytics.table.apt")}</th><th>{appText(lang,"analytics.table.owner")}</th><th>{appText(lang,"analytics.table.operator")}</th><th>{appText(lang,"analytics.table.type")}</th><th>{appText(lang,"analytics.table.cycles")}</th><th>{appText(lang,"analytics.table.hoursOverdue")}</th><th>{appText(lang,"analytics.table.nextSla")}</th><th>{appText(lang,"analytics.table.desc")}</th></tr></thead><tbody>{data.breachRows.map(r=><tr key={r.id}><td><strong>{r.apt}</strong></td><td><UserContact name={r.owner} email={r.ownerEmail} apartments={r.apt?[aptDisplay(r.apt, lang)]:[]} {...contactProps}/><br/><small>{r.ownerEmail}</small></td><td><UserContact name={r.operator || (lang==='en'?'No operator':'Sin operador')} email={r.operatorEmail} apartments={r.apt?[aptDisplay(r.apt, lang)]:[]} {...contactProps}/><br/><small>{r.operatorEmail}</small></td><td>{r.type}<br/><small>{r.category}</small></td><td>{r.slaCycleCount}</td><td><strong style={{color:'#c62828'}}>{r.hoursOverdue}h</strong></td><td>{fmt(r.nextSlaReminderAt)}</td><td>{String(r.description||'').slice(0,120)}</td></tr>)}</tbody></table></div> : <Empty icon="✅" msg={appText(lang,"analytics.noBreached")}/>}</div>
    <div className="analytics-grid"><div className="card"><div className="card-title">{appText(lang,"analytics.topApartments")}</div>{bar(data?.rankings?.byApartment||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.topOperators")}</div>{bar(data?.rankings?.byOperator||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byType")}</div>{bar(data?.rankings?.byType||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byCategory")}</div>{bar(data?.rankings?.byCategory||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byStatus")}</div>{bar(data?.rankings?.byStatus||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byMonth")}</div>{bar(data?.rankings?.byMonth||[])}</div></div>
  </div>;
}

function AdminSection({ title, subtitle, action, open, onToggle, children }) {
  return (
    <div className="card admin-section" style={{marginBottom:18}}>
      <div className="admin-sec-hdr" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onToggle();}} aria-expanded={String(!!open)}>
        <div className="admin-sec-info">
          <span className="card-title">{title}</span>
          {subtitle && <div className="psub" style={{margin:'3px 0 0',fontWeight:400}}>{subtitle}</div>}
        </div>
        {open && action && <div className="admin-sec-action" onClick={e=>e.stopPropagation()}>{action}</div>}
        <span className={`admin-sec-chevron${open?' asc-up':''}`}>{open?'▲':'▼'}</span>
      </div>
      {open && <div className="admin-sec-body">{children}</div>}
    </div>
  );
}

function AdminSettings({ config={}, user, listings=[], contactProps={}, onSave, showToast=()=>{}, lang="es-CO" }) {
  const tips = localizedTooltips(config || {}, lang);
  const [slaHours,setSlaHours]=useState(config?.sla_hours || '24');
  const [escalationCcEmails,setEscalationCcEmails]=useState(config?.escalation_cc_emails || '');
  const [analyticsEnabled,setAnalyticsEnabled]=useState(String(config?.analytics_enabled || 'false') === 'true');
  const [users,setUsers]=useState([]);
  const [usersLoading,setUsersLoading]=useState(false);
  const [standardMenuPermissions,setStandardMenuPermissions]=useState(()=>({ ...DEFAULT_STANDARD_MENU_PERMISSIONS }));
  const [defaultDelegatePermissions,setDefaultDelegatePermissions]=useState(()=>({ ...DEFAULT_DELEGATE_PERMISSIONS }));
  const [mission,setMission]=useState(() => parseMissionSections(config || {}));
  const [tooltipsEs,setTooltipsEs]=useState(() => ({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.es])), ...parseJsonObject(config?.tooltips_es,{})}));
  const [tooltipsEn,setTooltipsEn]=useState(() => ({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.en])), ...parseJsonObject(config?.tooltips_en,{})}));
  const [templates,setTemplates]=useState({});
  const [templateVars,setTemplateVars]=useState({});
  const [selectedTemplate,setSelectedTemplate]=useState('incident_new');
  const [templateLang,setTemplateLang]=useState('es-CO');
  const [tplLoading,setTplLoading]=useState(false);
  const [emailNotifConfig,setEmailNotifConfig]=useState({});
  const [emailNotifLoading,setEmailNotifLoading]=useState(false);
  const [emailNotifSaving,setEmailNotifSaving]=useState(false);
  const [adminErrors,setAdminErrors]=useState([]);
  const [lastUiError,setLastUiError]=useState('');
  const ADMIN_SEC_DEFAULT = {sla:false,mission:false,menu:false,delegate:false,users:true,tooltips:false,email:false,emailNotif:false};
  const [openSections,setOpenSections] = useState(()=>{
    try{ const s=JSON.parse(localStorage.getItem('kai_admin_open')||'null'); return s&&typeof s==='object'?{...ADMIN_SEC_DEFAULT,...s}:ADMIN_SEC_DEFAULT; }catch{ return ADMIN_SEC_DEFAULT; }
  });
  const toggleSection = id => setOpenSections(s=>{ const n={...s,[id]:!s[id]}; try{localStorage.setItem('kai_admin_open',JSON.stringify(n))}catch{} return n; });
  const expandAll  = ()=>{ const n=Object.fromEntries(Object.keys(ADMIN_SEC_DEFAULT).map(k=>[k,true]));  setOpenSections(n); try{localStorage.setItem('kai_admin_open',JSON.stringify(n))}catch{}};
  const collapseAll= ()=>{ const n=Object.fromEntries(Object.keys(ADMIN_SEC_DEFAULT).map(k=>[k,false])); setOpenSections(n); try{localStorage.setItem('kai_admin_open',JSON.stringify(n))}catch{}};
  const trace = (...args) => console.log('[KAI_ADMIN]', ...args);
  const captureAdminError = (scope, err) => {
    const msg = err?.message || String(err || 'Unknown error');
    const detail = { scope, message:msg, status:err?.status, url:err?.url, details:err?.details, ts:new Date().toISOString() };
    console.error('[KAI_ADMIN_ERROR]', detail, err);
    setAdminErrors(prev => [detail, ...prev].slice(0,8));
    try { localStorage.setItem('kai_last_admin_error', JSON.stringify(detail, null, 2)); } catch(e) {}
  };
  useEffect(()=>{
    trace('mount/update config', { user:user?.email, lang, config });
    setMission(parseMissionSections(config || {}));
    setSlaHours(config?.sla_hours || '24');
    setEscalationCcEmails(config?.escalation_cc_emails || '');
    setAnalyticsEnabled(String(config?.analytics_enabled || 'false') === 'true');
    setTooltipsEs({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.es])), ...parseJsonObject(config?.tooltips_es,{})});
    setTooltipsEn({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.en])), ...parseJsonObject(config?.tooltips_en,{})});
    try { setLastUiError(localStorage.getItem('kai_last_ui_error') || localStorage.getItem('kai_last_admin_error') || ''); } catch(e) {}
  }, [config?.mission_sections_es, config?.sla_hours, config?.escalation_cc_emails, config?.analytics_enabled, lang, user?.email]);
  const templateEntries = Object.entries((templates && typeof templates==='object') ? templates : {}).filter(([k,v])=>k && v && typeof v==='object');
  const selectedKey = (templates && templates[selectedTemplate]) ? selectedTemplate : (templateEntries[0]?.[0] || '');
  const selected = selectedKey ? (templates[selectedKey] || {}) : {};
  const selectedVars = (templateVars && typeof templateVars==='object' && Array.isArray(templateVars[selectedKey])) ? templateVars[selectedKey] : [];
  const loadTemplates = useCallback(()=>{
    if (!user?.uid) return;
    setTplLoading(true);
    setAdminErrors([]);
    const url = '/api/admin/email-templates?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '') + '&language=' + encodeURIComponent(templateLang);
    trace('loading templates', url);
    api.get(url).then(r => {
      const incoming = (r?.templates && typeof r.templates === 'object') ? r.templates : {};
      setTemplates(incoming);
      setTemplateVars((r?.variables && typeof r.variables === 'object') ? r.variables : {});
      const keys = Object.keys(incoming);
      if (!incoming[selectedTemplate] && keys.length) setSelectedTemplate(keys[0]);
      trace('templates loaded', keys);
    }).catch(e => { captureAdminError('email-templates', e); showToast(lt(lang,'Error cargando plantillas de email') + ': ' + (e.message || ''), true); }).finally(()=>setTplLoading(false));
  }, [user?.uid, user?.email, selectedTemplate, lang, templateLang]);
  useEffect(()=>{ loadTemplates(); }, [loadTemplates]);
  const loadEmailNotifConfig = useCallback(()=>{
    if(!user?.uid) return;
    setEmailNotifLoading(true);
    api.get('/api/admin/email-notification-config?uid='+encodeURIComponent(user.uid)+'&email='+encodeURIComponent(user.email||''))
      .then(r=>{ if(r?.config && typeof r.config==='object') setEmailNotifConfig(r.config); })
      .catch(e=>captureAdminError('email-notif-config',e))
      .finally(()=>setEmailNotifLoading(false));
  },[user?.uid,user?.email]);
  useEffect(()=>{ loadEmailNotifConfig(); },[loadEmailNotifConfig]);
  const saveEmailNotifConfig = async () => {
    setEmailNotifSaving(true);
    try {
      const r = await api.put('/api/admin/email-notification-config',{ actorUid:user.uid, actorEmail:user.email, config:emailNotifConfig });
      if(r?.config) setEmailNotifConfig(r.config);
      showToast('✅ '+lt(lang,'Configuración de notificaciones guardada'));
    } catch(e) { captureAdminError('save-email-notif-config',e); showToast(lt(lang,'Error guardando')+': '+(e.message||''),true); }
    finally { setEmailNotifSaving(false); }
  };
  const loadUsers = useCallback(()=>{
    if(!user?.uid) return;
    setUsersLoading(true);
    const url = '/api/admin/users?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '');
    trace('loading users', url);
    api.get(url).then(r=>{
      const rows = Array.isArray(r?.users) ? r.users : [];
      setUsers(rows);
      if (r?.standardMenuPermissions) setStandardMenuPermissions({ ...DEFAULT_STANDARD_MENU_PERMISSIONS, ...r.standardMenuPermissions });
      if (r?.defaultDelegatePermissions) setDefaultDelegatePermissions({ ...DEFAULT_DELEGATE_PERMISSIONS, ...r.defaultDelegatePermissions });
      trace('users loaded', rows.length);
    }).catch(e=>{ captureAdminError('admin-users', e); showToast(lt(lang,'Error cargando usuarios') + ': ' + (e.message||''), true); }).finally(()=>setUsersLoading(false));
  }, [user?.uid, user?.email, lang]);
  useEffect(()=>{ loadUsers(); }, [loadUsers]);
  const updateUserRole = async (u, role) => {
    try {
      await api.post('/api/admin/delegate', { actorUid:user.uid, actorEmail:user.email, uid:u.uid, email:u.email, name:u.name, role, permissions: u.permissions || DEFAULT_DELEGATE_PERMISSIONS });
      showToast(role === 'delegate_admin' ? '✅ Usuario delegado para aprobar registros' : role === 'global_admin' ? '✅ Usuario promovido a administrador global' : '✅ Delegación removida');
      loadUsers();
    } catch(e) { captureAdminError('update-user-role', e); showToast(lt(lang,'Error actualizando delegado') + ': ' + (e.message||''), true); }
  };
  const updateTpl = (field, value) => { if(!selectedKey) return; setTemplates(t => ({...(t||{}), [selectedKey]: {...((t||{})[selectedKey]||{}), [field]:value}})); };
  const saveTemplates = async () => {
    try {
      const r = await api.put('/api/admin/email-templates', { actorUid:user.uid, actorEmail:user.email, templates, language:templateLang });
      setTemplates((r && r.templates) || templates);
      showToast('✅ ' + lt(lang,'Plantillas guardadas.'));
    } catch(e) { captureAdminError('save-templates', e); showToast(lt(lang,'Error al guardar plantillas') + ': ' + (e.message || ''), true); }
  };
  const setMissionField = (field, value) => setMission(m => ({...(m||{}), [field]:value}));
  const setMissionCard = (idx, field, value) => setMission(m => ({...(m||{}), cards:((m||{}).cards||[]).map((c,i)=>i===idx?{...c,[field]:value}:c)}));
  const setMissionRule = (group, idx, value) => setMission(m => ({...(m||{}), [group]:((m||{})[group]||[]).map((r,i)=>i===idx?value:r)}));
  const addRule = (group) => setMission(m => ({...(m||{}), [group]:[...(((m||{})[group])||[]), '']}));
  const removeRule = (group, idx) => setMission(m => ({...(m||{}), [group]:(((m||{})[group])||[]).filter((_,i)=>i!==idx)}));
  const saveConfig = () => onSave({slaHours, escalationCcEmails, analyticsEnabled, missionSectionsEs:mission, defaultDelegatePermissions, tooltipsEs, tooltipsEn});
  const saveTooltips = () => onSave({ tooltipsEs, tooltipsEn });
  const toggleMenuPermission = (key) => setStandardMenuPermissions(p => ({ ...p, [key]: key === 'dashboard' ? true : !p[key] }));
  const toggleDefaultDelegatePermission = (key) => setDefaultDelegatePermissions(p => ({ ...p, [key]: !p[key] }));
  const saveStandardMenuPermissions = async () => {
    try { await api.put('/api/admin/config', { actorUid:user.uid, actorEmail:user.email, standardMenuPermissions }); showToast('✅ ' + lt(lang,'Permisos guardados')); }
    catch(e) { showToast((e.message || String(e)), true); }
  };
  const setUserPermission = (idx, key, val) => setUsers(prev => prev.map((u,i)=> i===idx ? ({...u, permissions:{...(u.permissions||{}), [key]:val}}) : u));
  const saveDefaultDelegatePermissions = async () => {
    try { await api.put('/api/admin/config', { actorUid:user.uid, actorEmail:user.email, defaultDelegatePermissions }); showToast('✅ ' + lt(lang,'Permisos predeterminados guardados')); }
    catch(e) { showToast((e.message || String(e)), true); }
  };
  const saveUserPermissions = async (u) => {
    const permsToSave = u.role === 'delegate_admin' ? defaultDelegatePermissions : (u.permissions || DEFAULT_DELEGATE_PERMISSIONS);
    try { await api.post('/api/admin/delegate', { actorUid:user.uid, actorEmail:user.email, uid:u.uid, email:u.email, name:u.name, role:u.role || 'user', permissions:permsToSave }); showToast('✅ ' + lt(lang,'Permisos guardados')); await loadUsers(); }
    catch(e) { showToast((e.message || String(e)), true); }
  };
  const clearSavedErrors = () => { try { localStorage.removeItem('kai_last_ui_error'); localStorage.removeItem('kai_last_admin_error'); } catch(e) {} setLastUiError(''); setAdminErrors([]); };
  return <div className="fade">
  <div className="ph" style={{flexWrap:'wrap',gap:12,alignItems:'flex-start'}}>
    <div><h1 className="ptitle">⚙️ {lt(lang,'Configuración global')}</h1><p className="psub">{lt(lang,'Solo administradores globales · SLA, copias, misión y plantillas de email')}</p></div>
    <div style={{display:'flex',gap:8,flexShrink:0,alignItems:'center'}}>
      <button className="btn-ghost" style={{minHeight:36,padding:'6px 12px',fontSize:'.8rem'}} onClick={expandAll}>{lang==='en'?'▼ Expand all':'▼ Expandir todo'}</button>
      <button className="btn-ghost" style={{minHeight:36,padding:'6px 12px',fontSize:'.8rem'}} onClick={collapseAll}>{lang==='en'?'▲ Collapse all':'▲ Colapsar todo'}</button>
    </div>
  </div>

  {(adminErrors.length > 0 || lastUiError) && <div className="card" style={{marginBottom:18,borderLeft:'4px solid #d4634a'}}><div className="card-title">🧪 {lt(lang,'Diagnóstico')}</div><p className="psub">{lt(lang,'Ver consola del navegador para más detalles.')}</p>{adminErrors.map((e,i)=><pre key={i} className="codebox" style={{whiteSpace:'pre-wrap',marginTop:8}}>{JSON.stringify(e,null,2)}</pre>)}{lastUiError&&<><div className="section-label" style={{marginTop:12}}>{lt(lang,'Último error de interfaz')}</div><pre className="codebox" style={{whiteSpace:'pre-wrap'}}>{lastUiError}</pre></>}<button className="btn-ghost" onClick={clearSavedErrors}>{lt(lang,'Limpiar error guardado')}</button></div>}

  <AdminSection title={`⏱️ ${lt(lang,'SLA y escalaciones')}`} subtitle={lt(lang,'El recordatorio se repite cada ciclo hasta que el propietario verifique.')} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveConfig}>💾 {lt(lang,'Guardar')}</button>} open={openSections.sla} onToggle={()=>toggleSection('sla')}>
    <div className="fg2"><div className="fg"><label>⏱️ {lt(lang,'SLA en horas')}</label><input type="number" min="1" value={slaHours} onChange={e=>setSlaHours(e.target.value)}/><span className="help-msg">{lt(lang,'Default: 24 horas.')}</span></div><div className="fg full"><label>✉️ {lt(lang,'Emails en copia para escalaciones')}</label><input value={escalationCcEmails} onChange={e=>setEscalationCcEmails(e.target.value)} placeholder="admin1@email.com, admin2@email.com"/><span className="help-msg">{lt(lang,'Se copian en cada recordatorio SLA, además del propietario y operador.')}</span></div><div className="fg full"><label>📈 {lt(lang,'Visibilidad de analíticas')}</label><select value={analyticsEnabled?"true":"false"} onChange={e=>setAnalyticsEnabled(e.target.value==="true")}><option value="false">{lt(lang,'Solo administrador global')}</option><option value="true">{lt(lang,'Todos los usuarios aprobados')}</option></select><span className="help-msg">{lt(lang,'El administrador global puede activar o desactivar las analíticas para toda la comunidad.')}</span></div></div>
  </AdminSection>

  <AdminSection title={`🌊 ${lt(lang,'Misión y reglas de participación')}`} subtitle={lt(lang,'Mantén Español Colombia como base. También puedes editar textos visibles en inglés cuando aplique.')} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveConfig}>💾 {lt(lang,'Guardar')}</button>} open={openSections.mission} onToggle={()=>toggleSection('mission')}>
    <div className="fg2"><div className="fg full"><label>{lt(lang,'Título')}</label><textarea className="admin-textarea" rows={2} value={mission?.title||''} onChange={e=>setMissionField('title',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Subtítulo')}</label><textarea className="admin-textarea" rows={2} value={mission?.subtitle||''} onChange={e=>setMissionField('subtitle',e.target.value)}/></div><div className="fg"><label>{lt(lang,'Etiqueta de sección')}</label><input value={mission?.sectionLabel||''} onChange={e=>setMissionField('sectionLabel',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Encabezado principal')}</label><textarea className="admin-textarea" rows={2} value={mission?.heading||''} onChange={e=>setMissionField('heading',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto principal')}</label><textarea rows={3} value={mission?.body||''} onChange={e=>setMissionField('body',e.target.value)}/></div></div>
    <div className="card-title" style={{margin:'16px 0 10px'}}>{lt(lang,'Tarjetas de propósito')}</div>{((mission&&mission.cards)||[]).map((c,i)=><div className="fg2" key={i} style={{borderTop:'1px solid rgba(90,105,80,.12)',paddingTop:12,marginTop:8}}><div className="fg"><label>{lt(lang,'Icono')}</label><input value={c?.icon||''} onChange={e=>setMissionCard(i,'icon',e.target.value)}/></div><div className="fg"><label>{lt(lang,'Título tarjeta')} {i+1}</label><textarea className="admin-textarea" rows={2} value={c?.title||''} onChange={e=>setMissionCard(i,'title',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto tarjeta')} {i+1}</label><textarea rows={2} value={c?.text||''} onChange={e=>setMissionCard(i,'text',e.target.value)}/></div></div>)}
    <div className="two-col" style={{marginTop:16}}><div><div className="fg"><label>{lt(lang,'Título reglas de participación')}</label><textarea className="admin-textarea" rows={2} value={mission?.participationTitle||''} onChange={e=>setMissionField('participationTitle',e.target.value)}/></div>{((mission&&mission.participationRules)||[]).map((r,i)=><div className="fg" key={i}><label>{lt(lang,'Regla')} {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionRule('participationRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeRule('participationRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addRule('participationRules')}>+ {lt(lang,'Agregar regla')}</button></div><div><div className="fg"><label>{lt(lang,'Título acceso y responsabilidad')}</label><textarea className="admin-textarea" rows={2} value={mission?.accessTitle||''} onChange={e=>setMissionField('accessTitle',e.target.value)}/></div>{((mission&&mission.accessRules)||[]).map((r,i)=><div className="fg" key={i}><label>{lt(lang,'Regla')} {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionRule('accessRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeRule('accessRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addRule('accessRules')}>+ {lt(lang,'Agregar regla')}</button></div></div>
  </AdminSection>

  <AdminSection title={`🧭 ${lt(lang,'Permisos estándar de menú')}`} subtitle={lt(lang,'Activa o desactiva qué menús ven los usuarios estándar. Dashboard siempre queda disponible.')} action={<button className="btn-ghost" onClick={saveStandardMenuPermissions}>💾 {lt(lang,'Guardar permisos de menú')}</button>} open={openSections.menu} onToggle={()=>toggleSection('menu')}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.keys(DEFAULT_STANDARD_MENU_PERMISSIONS).map(k=><label key={k} className="chip c-gray" style={{cursor:'pointer'}}><input type="checkbox" checked={!!standardMenuPermissions[k]} disabled={k==='dashboard'} onChange={()=>toggleMenuPermission(k)} style={{marginRight:6}}/>{MENU_LABELS[k]?.[lang==='en'?'en':'es']||k}</label>)}</div>
  </AdminSection>

  <AdminSection title={`🛡️ ${lt(lang,'Permisos predeterminados del delegado')}`} subtitle={`${lt(lang,'Define qué permisos recibe un administrador delegado nuevo por defecto.')} ${lt(lang,'Los permisos estándar siempre se heredan.')}`} action={<button className="btn-ghost" onClick={saveDefaultDelegatePermissions}>💾 {lt(lang,'Guardar permisos predeterminados')}</button>} open={openSections.delegate} onToggle={()=>toggleSection('delegate')}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.keys(DEFAULT_DELEGATE_PERMISSIONS).map(k=><label key={k} className="chip c-gray" style={{cursor:'pointer'}}><input type="checkbox" checked={!!defaultDelegatePermissions[k]} onChange={()=>toggleDefaultDelegatePermission(k)} style={{marginRight:6}}/>{PERMISSION_LABELS[k]?.[lang==='en'?'en':'es']||k}</label>)}</div>
  </AdminSection>

  <AdminSection title={`👥 ${lt(lang,'Roles y permisos de usuarios')}`} subtitle={lt(lang,'Define global admins, delegates and standard users. Delegate admins inherit the global delegate permissions configured above.')} action={<button className="btn-ghost" onClick={loadUsers}>{usersLoading?lt(lang,'Cargando...'):lt(lang,'Actualizar')}</button>} open={openSections.users} onToggle={()=>toggleSection('users')}>
    {users.length===0?<Empty icon="👥" msg={lt(lang,'No hay usuarios aprobados todavía.')}/>:<div className="table-wrap"><table className="admin-table"><thead><tr><th>{lt(lang,'Usuario')}</th><th>{lt(lang,'Email')}</th><th>{lt(lang,'Rol')}</th><th>{lt(lang,'Permisos del delegado')}</th><th>{lt(lang,'Acción')}</th></tr></thead><tbody>{users.map((u,idx)=><tr key={u.uid||u.email}><td><UserContact name={u.name||lt(lang,'Sin nombre')} email={u.email} uid={u.uid} {...contactProps}/></td><td><span className="copy-inline">{u.email}<button type="button" onClick={()=>copyText(u.email,showToast,lang)}>📋</button><button type="button" onClick={()=>contactProps.onEmail({name:u.name,email:u.email,apartments:(lookupContact(contactProps.directory,{uid:u.uid,email:u.email,name:u.name}).apartments||[])})}>✉️</button></span></td><td><select value={u.role||'user'} disabled={u.envGlobal} onChange={e=>setUsers(prev=>prev.map((x,i)=>i===idx?{...x,role:e.target.value}:x))}><option value="user">{lt(lang,'Usuario estándar')}</option><option value="delegate_admin">{lt(lang,'Administrador delegado')}</option><option value="global_admin">{lt(lang,'Administrador global')}</option></select>{u.envGlobal&&<div className="help-msg">GLOBAL_ADMIN_EMAILS</div>}</td><td>{u.role==='delegate_admin'?<div style={{display:'flex',flexDirection:'column',gap:5}}><small style={{color:'#496674',fontSize:'.69rem',fontStyle:'italic',marginBottom:2}}>{lang==='en'?'Global delegate permissions:':'Permisos globales del delegado:'}</small>{Object.keys(DEFAULT_DELEGATE_PERMISSIONS).map(k=>(<span key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:'.77rem',color:defaultDelegatePermissions[k]?'#087346':'#aabcb8'}}>{defaultDelegatePermissions[k]?'✅':'—'} {PERMISSION_LABELS[k]?.[lang==='en'?'en':'es']||k}</span>))}</div>:<span className="help-msg">{u.role==='global_admin'?lt(lang,'Administrador global'):lt(lang,'Usuario estándar')}</span>}</td><td><button className="bsm bs-edit" onClick={()=>saveUserPermissions(u)}>{lt(lang,'Actualizar rol/permisos')}</button></td></tr>)}</tbody></table></div>}
  </AdminSection>

  <AdminSection title={`💡 ${appText(lang,'tooltips.adminTitle')}`} subtitle={appText(lang,'tooltips.adminSub')} action={<button className="btn-ghost" onClick={saveTooltips}>💾 {appText(lang,'tooltips.save')}</button>} open={openSections.tooltips} onToggle={()=>toggleSection('tooltips')}>
    <div className="table-wrap"><table className="admin-table"><thead><tr><th>{appText(lang,'tooltips.key')}</th><th>{appText(lang,'tooltips.spanish')}</th><th>{appText(lang,'tooltips.english')}</th></tr></thead><tbody>{Object.keys(DEFAULT_TOOLTIPS).map(k=><tr key={k}><td><code>{k}</code></td><td><textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEs[k]||''} onChange={e=>setTooltipsEs(v=>({...v,[k]:e.target.value}))}/></td><td><textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEn[k]||''} onChange={e=>setTooltipsEn(v=>({...v,[k]:e.target.value}))}/></td></tr>)}</tbody></table></div>
  </AdminSection>

  <AdminSection title={`📨 ${lt(lang,'Plantillas de emails')}`} subtitle={lt(lang,'Edita y guarda la versión en Español e Inglés por separado. El sistema envía según la preferencia del destinatario.')} action={tplLoading?<span className="sync-pill"><span className="spinner-sm"/> {lt(lang,'Cargando...')}</span>:null} open={openSections.email} onToggle={()=>toggleSection('email')}>
    {templateEntries.length===0?<Empty icon="📨" msg={ui(lang,'templatesEmpty')}/>:<><div className="fg2"><div className="fg"><label>{lt(lang,'Idioma de plantilla')}</label><select value={templateLang} onChange={e=>setTemplateLang(e.target.value)}><option value="es-CO">{lt(lang,'Español')}</option><option value="en">{lt(lang,'Inglés')}</option></select></div><div className="fg"><label>{lt(lang,'Tipo de notificación')}</label><select value={selectedKey} onChange={e=>setSelectedTemplate(e.target.value)}>{templateEntries.map(([k,tpl])=><option key={k} value={k}>{tpl?.label||k}</option>)}</select></div><div className="fg full"><span className="help-msg">{lt(lang,'Variables disponibles')}: {selectedVars.map(v=>'{{'+v+'}}').join(', ')}</span></div><div className="fg full"><label>{lt(lang,'Asunto')}</label><input value={selected?.subject||''} onChange={e=>updateTpl('subject',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto plano')}</label><textarea rows={6} value={selected?.text||''} onChange={e=>updateTpl('text',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'HTML del email')}</label><textarea rows={10} value={selected?.html||''} onChange={e=>updateTpl('html',e.target.value)}/><span className="help-msg">{lt(lang,'Conserva variables como href="{{incidentLink}}".')}</span></div></div><div className="mact"><button className="btn-p" onClick={saveTemplates}>💾 {lt(lang,'Guardar plantillas de email')}</button></div></>}
  </AdminSection>

  {/* ── Email notification routing ─────────────────────────────────────── */}
  {(()=>{
    const isEn = lang==='en';
    const tog = (key,field,val) => setEmailNotifConfig(c=>({...c,[key]:{...c[key],[field]:val}}));
    const GROUPS = [
      { id:'incident', label: isEn?'⚠️ Incidents':'⚠️ Incidentes', types:[
        { key:'incident_new',              label:isEn?'New incident':'Incidente nuevo',                     cols:['owner','operator','globalAdmin','delegateAdmin'] },
        { key:'incident_sla',              label:isEn?'SLA escalation':'Escalación SLA',                   cols:['owner','operator','globalAdmin'] },
        { key:'incident_sla_notification', label:isEn?'SLA notification (initial)':'SLA — notificación inicial', cols:['owner','operator','globalAdmin'] },
        { key:'incident_sla_reminder',     label:isEn?'SLA reminder (cycle)':'SLA — recordatorio (ciclo)', cols:['owner','operator','globalAdmin'] },
        { key:'incident_verified',         label:isEn?'Incident verified':'Incidente verificado',           cols:['owner','operator','globalAdmin','delegateAdmin'] },
        { key:'incident_resolved',         label:isEn?'Incident resolved':'Incidente resuelto',             cols:['owner','operator','globalAdmin','delegateAdmin'] },
      ]},
      { id:'registration', label: isEn?'📝 Registrations':'📝 Registros', types:[
        { key:'registration_submitted',    label:isEn?'Received (to registrant)':'Recibido (al registrante)',     cols:['owner'] },
        { key:'registration_approved',     label:isEn?'Approved (to registrant)':'Aprobado (al registrante)',     cols:['owner','globalAdmin','delegateAdmin'] },
        { key:'registration_declined',     label:isEn?'Declined (to registrant)':'Rechazado (al registrante)',    cols:['owner','globalAdmin','delegateAdmin'] },
        { key:'registration_reviewer',     label:isEn?'Pending — notify reviewers':'Pendiente — avisar revisores', cols:['owner','globalAdmin','delegateAdmin'] },
      ]},
      { id:'listing', label: isEn?'🏠 Listings':'🏠 Listings', types:[
        { key:'listing_created',           label:isEn?'Listing created':'Listing creado',   cols:['owner','operator','globalAdmin','delegateAdmin'] },
        { key:'listing_updated',           label:isEn?'Listing updated':'Listing actualizado', cols:['owner','operator','globalAdmin','delegateAdmin'] },
        { key:'listing_deleted',           label:isEn?'Listing deleted':'Listing eliminado', cols:['owner','operator','globalAdmin','delegateAdmin'] },
      ]},
    ];
    const COL_INFO = [
      { key:'owner',         icon:'👤', label: isEn?'Owner / Registrant':'Propietario / Registrante', short: isEn?'Owner':'Prop.' },
      { key:'operator',      icon:'🔧', label: isEn?'Operator':'Operador',                            short: isEn?'Oper.':'Oper.' },
      { key:'globalAdmin',   icon:'🌍', label: isEn?'Global Admin':'Admin Global',                   short: isEn?'Global':'Global' },
      { key:'delegateAdmin', icon:'🎯', label: isEn?'Delegate Admin (permission-gated)':'Admin Delegado (según permisos)', short: isEn?'Deleg.':'Deleg.' },
    ];
    return (
      <AdminSection
        title={`📧 ${isEn?'Email Routing':'Enrutamiento de emails'}`}
        subtitle={isEn?'Enable or disable email types and choose who receives them. Based on current app workflows.':'Activa o desactiva tipos de email y elige a quiénes se envían. Basado en los flujos actuales de la app.'}
        action={<button className="bsm" onClick={saveEmailNotifConfig} disabled={emailNotifSaving} style={{whiteSpace:'nowrap'}}>{emailNotifSaving?(isEn?'Saving...':'Guardando...'):`💾 ${isEn?'Save':'Guardar'}`}</button>}
        open={openSections.emailNotif}
        onToggle={()=>toggleSection('emailNotif')}
      >
        {emailNotifLoading
          ? <div style={{padding:'12px 0',color:'#2a5a6a'}}><span className="spinner-sm"/> {lt(lang,'Cargando...')}</div>
          : <>
            {/* Legend */}
            <div className="enc-legend">
              {COL_INFO.map(c=><span key={c.key}><strong>{c.icon}</strong> {c.label}</span>)}
              <span style={{color:'#9aafb0'}}>— = {isEn?'not applicable':'no aplica'}</span>
            </div>
            <div className="enc-table">
              {/* Column header */}
              <div className="enc-hdr">
                <div className="enc-col-type">{isEn?'Email type':'Tipo de email'}</div>
                <div className="enc-col-on">{isEn?'On':'Activo'}</div>
                {COL_INFO.map(c=>(
                  <div key={c.key} className="enc-col-r enc-col-r-hdr" title={c.label}>
                    <span>{c.icon}</span>
                    <span>{c.short}</span>
                  </div>
                ))}
              </div>
              {GROUPS.map(g=>(
                <div key={g.id} className="enc-group">
                  <div className="enc-group-hdr">{g.label}</div>
                  {g.types.map(t=>{
                    const cfg = emailNotifConfig[t.key] || {};
                    const on = !!cfg.enabled;
                    return (
                      <div key={t.key} className={`enc-row${on?'':' enc-off'}`}>
                        <div className="enc-col-type">{t.label}</div>
                        <div className="enc-col-on">
                          <label className="enc-pill-toggle">
                            <input type="checkbox" checked={on} onChange={e=>tog(t.key,'enabled',e.target.checked)}/>
                            <span className={`enc-pill${on?' enc-pill-on':''}`}/>
                          </label>
                        </div>
                        {COL_INFO.map(c=>(
                          <div key={c.key} className="enc-col-r">
                            {t.cols.includes(c.key)
                              ? <label className={`enc-cb-wrap${!on?' enc-cb-dim':''}`} title={c.label}>
                                  <input type="checkbox" disabled={!on} checked={!!cfg[c.key]} onChange={e=>tog(t.key,c.key,e.target.checked)}/>
                                </label>
                              : <span className="enc-na">—</span>
                            }
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{marginTop:12,display:'flex',justifyContent:'flex-end'}}>
              <button className="btn-p" onClick={saveEmailNotifConfig} disabled={emailNotifSaving}>{emailNotifSaving?(isEn?'Saving...':'Guardando...'):`💾 ${isEn?'Save configuration':'Guardar configuración'}`}</button>
            </div>
          </>
        }
      </AdminSection>
    );
  })()}

</div>;
}

function AdminFallback({ lang='es-CO', error={} }){
  const saved = (()=>{ try { return localStorage.getItem('kai_last_ui_error') || localStorage.getItem('kai_last_admin_error') || ''; } catch(e) { return ''; } })();
  return <div className="fade"><div className="card" style={{borderLeft:'4px solid #d4634a'}}><h1 className="ptitle">{ui(lang,'adminCouldNotLoad')}</h1><p className="psub">{ui(lang,'adminErrorHelp')}</p>{error?.message && <div className="form-alert"><strong>Error:</strong> {error.message}</div>}{error?.stack && <pre className="codebox" style={{whiteSpace:'pre-wrap',marginTop:10}}>{error.stack}</pre>}{saved && <><div className="section-label" style={{marginTop:12}}>{lt(lang,'Último error de interfaz')}</div><pre className="codebox" style={{whiteSpace:'pre-wrap'}}>{saved}</pre></>}<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}><button className="btn-p" onClick={()=>window.location.reload()}>{ui(lang,'reload')}</button><button className="btn-ghost" onClick={()=>{try{localStorage.removeItem('kai_last_ui_error');localStorage.removeItem('kai_last_admin_error')}catch(e){};window.location.reload();}}>{lt(lang,'Limpiar error guardado')}</button></div></div></div>;
}

function AdminAccessHelp({ user, adminInfo, lang='es-CO' }) {
  const isEn = lang === 'en';
  return <div className="fade"><div className="card"><h1 className="ptitle">⚙️ Admin</h1><p className="psub">{isEn ? 'This account is not being recognized as a global admin yet.' : 'Esta cuenta no está siendo reconocida como administrador global todavía.'}</p><div className="form-alert"><strong>{isEn ? 'Current email' : 'Email actual'}:</strong> {user?.email || 'No disponible'}<br/><strong>{isEn ? 'Detected role' : 'Rol detectado'}:</strong> {adminInfo?.role || 'user'}</div><p className="psub">{isEn ? 'In Render, add this email to GLOBAL_ADMIN_EMAILS, save changes, and redeploy. You can use several emails separated by commas.' : 'En Render agrega este email en GLOBAL_ADMIN_EMAILS, guarda cambios y redeploy. Puedes usar varios separados por coma.'}</p><pre className="codebox">GLOBAL_ADMIN_EMAILS={user?.email || 'tuemail@gmail.com'}</pre><button className="btn-p" onClick={()=>window.location.reload()}>{isEn ? 'Check again' : 'Volver a verificar'}</button></div></div>;
}

function LanguageSwitch({ lang, setLang }) {
  return <select className="lang-switch" value={lang} onChange={e=>setLang(e.target.value)} aria-label="Language"><option value="es-CO">Español 🇨🇴</option><option value="en">English 🇺🇸</option></select>;
}

function Overlay({ children, onClose, wide }) {
  return <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className={`modal ${wide?"modal-w":""}`}>{children}<button className="btn-x" onClick={onClose}>✕</button></div></div>;
}
function EmptyState({ icon, title, sub }) { return <div className="empty"><div style={{fontSize:"3rem",marginBottom:12}}>{icon}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.2rem",marginBottom:6}}>{title}</div><div style={{fontSize:"0.82rem",color:"#3a5a6a"}}>{sub}</div></div>; }
function Empty({ icon, msg }) { return <div style={{textAlign:"center",padding:"20px 0",color:"#2a4a5a",fontSize:"0.82rem"}}>{icon} {msg}</div>; }
function GoogleIcon() { return <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>; }

const CSS = `
.workflow-card{background:rgba(255,255,255,.74);border:1px solid rgba(47,79,58,.12);border-radius:18px;padding:12px 16px;margin:8px 0 14px;box-shadow:0 8px 22px rgba(0,0,0,.045);overflow:visible;position:relative;z-index:2}
.workflow-card-compact{max-width:100%;}
.wf-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.wf-title{font-weight:800;color:#2F4F3A;margin-bottom:2px;letter-spacing:.04em;text-transform:uppercase;font-size:.78rem}.wf-subtitle{font-size:.74rem;color:#496674}.wf-steps{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}.wf-step{flex:1;min-width:0;background:rgba(246,241,231,.65);border-radius:14px;padding:8px 10px}.wf-step-click{position:relative;display:flex;align-items:center;gap:10px;border:1px solid rgba(47,79,58,.14);cursor:pointer;text-align:left;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease;overflow:visible}.wf-step-click:hover{background:#fff;transform:translateY(-1px);box-shadow:0 12px 28px rgba(32,46,38,.12);border-color:#19a66a}.wf-active{border-color:#0f9d63!important;background:rgba(15,157,99,.08)!important;box-shadow:inset 0 -3px 0 rgba(15,157,99,.45)}.wf-icon{width:36px;height:36px;border-radius:50%;display:flex!important;align-items:center;justify-content:center;flex:0 0 36px;font-weight:900}.wf-open{background:rgba(15,157,99,.14);color:#0f9d63}.wf-verified{background:rgba(23,63,77,.10);color:#173f4d}.wf-resolved{background:rgba(128,84,214,.14);color:#6b40c9;font-size:1.15rem}.wf-copy{display:block;min-width:0}.wf-step strong{display:block;color:#17313a;margin-bottom:1px;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-step small{display:block;color:#4d6b76;font-size:.72rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-arrow{display:flex;align-items:center;justify-content:center;color:#2aa8ad;font-size:1.15rem;font-weight:800;flex:0 0 22px}.wf-arrow-line{opacity:.85}.wf-tip{display:none!important;position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);z-index:999999;background:#263238;color:#fff!important;border-radius:8px;padding:8px 10px;font-size:.72rem;line-height:1.25;min-width:210px;max-width:260px;box-shadow:0 14px 34px rgba(0,0,0,.24);white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.wf-tip:after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#263238}.wf-step-click:hover .wf-tip,.wf-step-click:focus .wf-tip{display:block!important}.filter-group{margin:10px 0}.filter-label{font-weight:800;color:#2F4F3A;margin:0 0 6px 2px;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em}
@media(max-width:760px){.wf-steps{flex-direction:column;align-items:stretch}.wf-arrow{display:none}.wf-step{min-width:100%}.wf-step strong,.wf-step small{white-space:normal}.wf-tip{left:12px;right:12px;transform:none;min-width:0}.wf-tip:after{left:24px}}
.divider{width:1px;background:rgba(255,255,255,.07);margin:0 3px}
.irow{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:14px 18px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;position:relative;overflow:hidden;transition:background .18s}.irow::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#d4634a}.irow-res::before{background:#2e7d32}.irow-naughty::before{background:#b71c1c}.irow:hover{background:rgba(255,255,255,.05)}.ir-l{min-width:150px;flex-shrink:0}.ir-apt{font-size:.72rem;font-weight:800;color:var(--kai-olive);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;text-shadow:0 1px 2px rgba(0,0,0,.10)}.ir-guest{font-size:.88rem;font-weight:500;color:#dff0f5}.ir-loc{font-size:.72rem;color:#5a8090;margin-top:3px}.ir-date{font-size:.7rem;color:#2a4a5a;margin-top:3px}.ir-rep{font-size:.68rem;color:#1a3a4a;margin-top:3px;font-style:italic}.ir-c{flex:1}.ir-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px}.ir-type,.ir-cat,.ir-status{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:20px;font-size:.7rem;font-weight:600}.is-open{background:rgba(210,90,70,.2);color:#f08070}.is-verified{background:rgba(46,125,50,.2);color:#69c47a}.is-resolved,.is-res{background:rgba(42,154,170,.18);color:#1d7f8d}.ir-desc{font-size:.8rem;color:#3a6070;line-height:1.5}.ir-acts{display:flex;flex-direction:column;gap:5px;flex-shrink:0}.section-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#2a4a5a;font-weight:600;margin-bottom:14px}
.cat-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:26px}.catcard{border-radius:13px;padding:16px 18px;display:flex;flex-direction:column;gap:5px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}.ngcard{background:rgba(180,28,28,.07);border:1px solid rgba(180,28,28,.18);border-radius:11px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}.ngcard-l{display:flex;align-items:center;gap:14px}.ng-name{font-size:.95rem;font-weight:600;color:#ff6b6b}.ng-loc{font-size:.74rem;color:#5a8090;margin-top:3px}.ngcard-r{text-align:right}.ng-cnt{font-size:.82rem;font-weight:600;color:#f08070}.ng-apts{font-size:.7rem;color:#2a4a5a;margin-top:3px}
.overlay{position:fixed;inset:0;background:rgba(3,10,18,.82);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}.modal{background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(248,244,235,.96));border:1px solid rgba(90,105,80,.18);box-shadow:0 22px 70px rgba(20,32,26,.22);border-radius:18px;padding:28px;width:100%;max-width:440px;position:relative;animation:mIn .25s ease;max-height:90vh;overflow-y:auto}.modal-w{max-width:560px}@keyframes mIn{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}.modal-title{font-family:'Playfair Display',serif;font-size:1.2rem;color:#314433;margin-bottom:4px}.modal-sub{font-size:.76rem;color:#2a5a6a;margin-bottom:20px}.btn-x{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.06);border:none;color:#5a8090;width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:.85rem}.btn-x:hover{background:rgba(255,255,255,.14);color:white}.mact{display:flex;gap:9px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fg{display:flex;flex-direction:column;gap:5px}.fg.full{grid-column:1/-1}.fg label{font-size:.69rem;font-weight:500;color:#2a5a6a;text-transform:uppercase;letter-spacing:.06em}.fg input,.fg select,.fg textarea{background:rgba(255,255,255,.78);border:1px solid rgba(90,105,80,.22);color:#17313a;padding:8px 12px;border-radius:8px;font-size:.85rem;outline:none;transition:border .2s}.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--kai-aqua);background:rgba(94,215,198,.07)}.fg input.field-error,.fg select.field-error,.fg textarea.field-error{border-color:#ff6b6b;background:rgba(255,107,107,.10);box-shadow:0 0 0 2px rgba(255,107,107,.12)}.err-msg{font-size:.68rem;color:#ff8a80;font-weight:600}.help-msg{font-size:.66rem;color:#5a8a8f;margin-top:1px}.form-alert{font-size:.75rem;color:#e8d19a;background:rgba(217,180,90,.1);border:1px solid rgba(217,180,90,.22);padding:9px 11px;border-radius:9px;margin-bottom:15px}.locked-field{opacity:.74;cursor:not-allowed;color:#d9b45a!important;background:rgba(217,180,90,.08)!important;border-color:rgba(217,180,90,.22)!important}.fg select option{background:#fff;color:#17313a}.fg textarea{resize:vertical}.csel{display:flex;flex-wrap:wrap;gap:7px}.copt{padding:6px 13px;border-radius:20px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#3a6070;font-size:.75rem;cursor:pointer;transition:all .18s}.copt:hover{border-color:rgba(255,255,255,.2);color:#b0ccd8}.copt-on{font-weight:600}
.uavatar-img{width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0}
.gu-btn{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;transition:all .18s;text-align:left;width:100%}.gu-btn:hover{background:rgba(255,255,255,.08);border-color:#1a8fa0}.gu-av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:.95rem;flex-shrink:0}.gu-name{font-size:.88rem;font-weight:500;color:#dff0f5}.gu-email{font-size:.7rem;color:#2a5a6a;margin-top:2px}
.empty{text-align:center;padding:60px 28px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:14px}
.notice-list{display:flex;flex-direction:column;gap:12px}.notice-card{background:rgba(255,255,255,.86);border:1px solid rgba(90,105,80,.16);border-radius:13px;padding:15px 18px;display:flex;gap:12px;justify-content:space-between;align-items:flex-start;box-shadow:0 10px 28px rgba(62,75,55,.08)}.notice-new{border-left:4px solid #d9b45a}.notice-read{opacity:.72}.notice-title{font-family:'Playfair Display',serif;font-size:1rem;color:#2F4F3A;font-weight:700}.notice-msg{font-size:.84rem;color:#17313a;margin-top:5px}.notice-meta{font-size:.7rem;color:#5a8090;margin-top:6px}.notice-inc{font-size:.78rem;color:#3a6070;margin-top:9px;background:rgba(217,180,90,.10);border-radius:8px;padding:8px 10px}
.toast{position:fixed;bottom:24px;right:24px;background:#07141e;border:1px solid rgba(26,143,160,.35);color:#dff0f5;padding:12px 18px;border-radius:11px;font-size:.83rem;box-shadow:0 8px 28px rgba(0,0,0,.4);z-index:300;animation:tIn .3s ease}.toast-err{background:#150808;border-color:rgba(180,28,28,.4);color:#ff6b6b}@keyframes tIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.gate-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px}.gate-card{width:100%;max-width:520px;background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(248,244,235,.94));border:1px solid rgba(90,105,80,.18);box-shadow:0 22px 70px rgba(20,32,26,.22);border-radius:20px;padding:30px;text-align:center}.gate-wide{max-width:760px;text-align:left}.gate-logo{margin:0 auto 16px}.gate-btn{margin-top:18px}.gate-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.status-box{border-radius:13px;padding:18px;margin-top:18px;border:1px solid rgba(90,105,80,.18);background:rgba(255,255,255,.62)}.status-box h3{margin:0 0 8px;color:#2F4F3A}.status-box p{margin:6px 0;color:#17313a}.status-box.pending{border-left:4px solid #d9b45a}.status-box.declined{border-left:4px solid #d4634a}.reg-listing-box{border:1px solid rgba(90,105,80,.14);background:rgba(255,255,255,.60);border-radius:14px;padding:16px;margin:14px 0}.reg-card{align-items:stretch}.reg-card .ir-acts{min-width:100px}.reg-detail-card{gap:18px}.listing-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:12px}.listing-detail-card{background:rgba(255,255,255,.72);border:1px solid rgba(90,105,80,.14);border-radius:14px;padding:12px}.ld-title{font-weight:900;color:#2F4F3A;margin-bottom:8px}.ld-row{font-size:13px;color:#17313a;margin:4px 0;line-height:1.35}.ld-row strong{color:#2F4F3A}

.welcome-card{max-width:920px;text-align:left;padding:34px}.welcome-brand{display:flex;align-items:center;gap:18px;margin-bottom:18px}.welcome-logo{width:92px;height:92px;object-fit:contain;border-radius:18px;background:rgba(255,255,255,.72);box-shadow:0 12px 28px rgba(47,79,58,.15);padding:8px}.welcome-logo.small{width:72px;height:72px}.welcome-hero{background:linear-gradient(135deg,rgba(94,215,198,.16),rgba(217,180,90,.14));border:1px solid rgba(90,105,80,.16);border-radius:16px;padding:16px 18px;margin-bottom:18px}.welcome-hero p{margin:0;color:#17313a;line-height:1.55;font-size:.98rem}.mission-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin:18px 0}.mission-grid-compact{grid-template-columns:repeat(2,1fr)}.mission-card{background:rgba(255,255,255,.70);border:1px solid rgba(90,105,80,.15);border-radius:14px;padding:15px;display:flex;gap:11px;align-items:flex-start;box-shadow:0 8px 20px rgba(62,75,55,.06)}.mission-icon{font-size:1.45rem;line-height:1}.mission-card h3{font-size:.9rem;color:#2F4F3A;margin:0 0 5px;font-weight:800}.mission-card p{font-size:.76rem;color:#3a6070;line-height:1.45;margin:0}.login-rules,.first-access-box{background:rgba(255,255,255,.66);border:1px solid rgba(90,105,80,.14);border-radius:14px;padding:16px 18px;margin-top:16px}.login-rules h3{margin:0 0 10px;color:#2F4F3A;font-size:1rem}.login-rules ul,.rules-list{margin:0;padding-left:20px;color:#17313a}.login-rules li,.rules-list li{margin:7px 0;line-height:1.45;font-size:.86rem}.first-access-box{border-left:4px solid #d9b45a;color:#17313a;line-height:1.5}.secure-copy{text-align:center;color:#2a5a6a;font-size:.86rem;margin:20px 0 0}.google-switch-help{margin:14px 0 12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.72);border:1px solid rgba(42,90,106,.16);color:#17313a;font-size:.78rem;line-height:1.45}.google-switch-help span{color:#2a5a6a}.tip{display:inline-flex;align-items:center;justify-content:center;margin-left:5px;width:18px;height:18px;border-radius:50%;background:#e8f6f4;color:#0b7f8c;font-size:.72rem;font-weight:900;cursor:help}.role-guide{margin:12px 28px 0;padding:12px 16px;border-radius:18px;background:rgba(255,255,255,.82);border:1px solid rgba(42,90,106,.14);box-shadow:0 10px 28px rgba(20,40,45,.08);display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap}.role-guide strong{display:block;color:#2F4F3A}.role-guide span{font-size:.78rem;color:#2a5a6a}.role-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.role-chip{border:1px solid rgba(11,127,140,.2);background:#eefbf9;color:#0b7f8c;border-radius:999px;padding:7px 10px;font-weight:800;cursor:pointer}.role-metrics{display:flex;gap:8px}.role-metrics span{background:#f6f1e7;border-radius:999px;padding:6px 9px;color:#17313a;font-weight:800}.inline-brand{align-items:flex-start}.mission-main h2{font-family:'Playfair Display',serif;color:#2F4F3A;margin:0 0 8px}.mission-main p{color:#17313a;line-height:1.55;margin:0}.mission-two{margin-top:18px}
.analytics-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.bar-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}.bar-row{display:grid;grid-template-columns:110px 1fr 34px;gap:10px;align-items:center;font-size:.78rem}.bar-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#314433}.bar-track{height:10px;background:rgba(11,127,140,.10);border-radius:999px;overflow:hidden}.bar-track span{display:block;height:100%;background:linear-gradient(90deg,var(--kai-ocean),var(--kai-aqua));border-radius:999px}.bar-count{text-align:right;font-weight:700;color:#2F4F3A}.table-wrap{overflow:auto;margin-top:12px}.admin-table{width:100%;border-collapse:collapse;font-size:.78rem}.admin-table th{text-align:left;background:rgba(11,127,140,.10);color:#314433;padding:10px;border-bottom:1px solid rgba(90,105,80,.15);white-space:nowrap}.admin-table td{padding:10px;border-bottom:1px solid rgba(90,105,80,.12);vertical-align:top}.admin-table small{color:#607063}.session-actions{display:none}.session-email{font-size:.72rem;color:#314433;max-width:210px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.codebox{background:#f6f1e7;border:1px solid rgba(90,105,80,.18);border-radius:10px;padding:12px;color:#17313a;overflow:auto}.admin-table small{color:#607063}

/* v77 contact card: React-controlled, position:fixed — escapes overflow containers */
.contact-hover-wrap{display:inline-flex;align-items:center;max-width:100%;vertical-align:middle}
.contact-name-btn{border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:0;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
.contact-card{min-width:280px;max-width:296px;background:rgba(255,255,255,.99);border:1px solid rgba(90,105,80,.22);border-radius:14px;box-shadow:0 18px 50px rgba(20,32,26,.26);padding:12px 14px;color:#17313a;font-family:'DM Sans',sans-serif;font-size:.78rem;line-height:1.4}
.contact-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;word-break:break-word}
.contact-line-val{flex:1;min-width:0;overflow-wrap:anywhere}
.contact-action-link,.contact-line button{border:1px solid rgba(11,127,140,.22);background:rgba(94,215,198,.14);color:#0b7f8c;border-radius:8px;padding:3px 8px;font-size:.68rem;text-decoration:none;cursor:pointer;white-space:nowrap;line-height:1.6}
.contact-action-link:hover,.contact-line button:hover{background:rgba(11,127,140,.18)}
.modal-sub{word-break:break-word}
@media(max-width:600px){.contact-card{min-width:calc(100vw - 24px);max-width:calc(100vw - 24px)}}

@media(max-width:1000px){.analytics-grid{grid-template-columns:1fr}.mission-grid{grid-template-columns:repeat(2,1fr)}.stats6{grid-template-columns:repeat(3,1fr)}.two-col{grid-template-columns:1fr}.cat-stats{grid-template-columns:repeat(2,1fr)}.nav{display:none}.mob-nav{display:flex}.compact-sync{display:none}.logo-title,.logo-sub{display:none}.hdr-inner{height:56px}.hdr-right{gap:6px}}
/* v36 header/menu mobile hardening */
.nav-dd-menu,.profile-menu{max-height:min(72vh,520px);overflow:auto;-webkit-overflow-scrolling:touch}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:block!important}@media(max-width:1000px){.hdr-inner{height:auto;min-height:56px;align-items:center}.hdr-right{margin-left:auto}.nav-dd-menu{position:fixed;left:12px;right:12px;top:62px;min-width:auto}.profile-menu{position:fixed;left:12px;right:12px;top:62px;min-width:auto}.mob-nav{display:none!important}.nav{display:flex!important;justify-content:flex-start;gap:2px;overflow:visible}.nav .nb:nth-of-type(n+4){display:none}.nav-dd{display:block}.nb{font-size:.72rem;padding:6px 8px}.lang-switch{max-width:112px}.icon-btn{width:32px;height:32px}.profile-head strong,.profile-head span,.profile-head small{max-width:none}}@media(max-width:600px){.hdr-inner{padding:7px 10px;gap:6px}.logo-mark{width:34px;height:34px}.nav .nb:nth-of-type(n+3){display:none}.nav-dd-menu,.profile-menu{top:56px}.main{padding-top:14px}.fg2{grid-template-columns:1fr}.card{padding:18px}.ptitle{font-size:1.55rem}}
@media(max-width:600px){.welcome-card{padding:24px}.welcome-brand{flex-direction:column;text-align:center}.mission-grid,.mission-grid-compact{grid-template-columns:1fr}.ac-num{font-size:1.45rem;padding:4px 10px}.ar-num{font-size:.95rem;width:66px}.stats6,.owner-stats{grid-template-columns:repeat(2,1fr)}.fg2{grid-template-columns:1fr}.ph{flex-direction:column}.main{padding:18px 14px 56px}.hdr-inner{padding:0 14px}.sync-pill{display:none}}


/* v53 readability: stronger glass panels and darker text over background image */
.app-shell{background:linear-gradient(180deg,rgba(255,255,255,.84),rgba(245,239,225,.90)),url('/morros-kai.png') center top/cover fixed;color:#102f3a;}
.card,.workflow-card,.acard,.notice-card,.gate-card,.modal,.catcard,.ngcard,.reg-listing-box,.listing-detail-card,.prof-section{background:rgba(255,255,255,.94)!important;border-color:rgba(47,79,58,.22)!important;box-shadow:0 14px 38px rgba(32,46,38,.14)!important;}
.irow{background:rgba(255,255,255,.88)!important;border-color:rgba(47,79,58,.18)!important;box-shadow:0 8px 22px rgba(32,46,38,.08);}
.irow:hover{background:rgba(255,255,255,.96)!important;}
.ptitle,.card-title,.wf-title,.filter-label,.ir-apt,.ar-num,.ac-num,.modal-title{color:#203f2b!important;text-shadow:none!important;}
.psub,.ir-desc,.ir-date,.ir-rep,.ar-owner,.ac-owner,.ac-tower,.ld-row,.empty,.fg label,.wf-step span{color:#173f4d!important;}
.ir-guest{color:#173f4d!important;font-weight:700;}
.ir-loc,.ng-loc,.np-loc,.help-msg,.modal-sub{color:#235f72!important;}
.fchip{background:rgba(255,255,255,.78)!important;border-color:rgba(47,79,58,.18)!important;color:#174b5a!important;font-weight:700;}
.fchip-on{background:#1193a5!important;color:white!important;border-color:#1193a5!important;}
.ir-type,.ir-cat,.ir-status,.chip{font-weight:800!important;border:1px solid rgba(0,0,0,.06);}
.is-open{background:#ffe2d7!important;color:#b83215!important;}
.is-verified{background:#dff5e4!important;color:#1f7a35!important;}
.is-resolved,.is-res{background:#d8f2f5!important;color:#0a6673!important;}
.bs-resolve{background:#dff5e4!important;color:#1f7a35!important;font-weight:800;}
.bs-del{background:#f7d6d2!important;color:#9d1f16!important;font-weight:800;}
.bs-edit{background:#f7edc8!important;color:#8a6a00!important;font-weight:800;}
.bs-rep{background:#d8f2f5!important;color:#0a6673!important;font-weight:800;}
.wf-step{background:#f8fbfb!important;border:1px solid rgba(47,79,58,.16);} .wf-step-click{overflow:visible!important;} .wf-step-click:hover .wf-tip,.wf-step-click:focus .wf-tip{display:block!important;}
.search,.fg input,.fg select,.fg textarea{background:rgba(255,255,255,.96)!important;color:#102f3a!important;border-color:rgba(47,79,58,.28)!important;}
/* v54 action banners, consistent report button, and registration filters */
.action-banner-wrap{position:sticky;top:64px;z-index:850;margin:0 auto 8px;max-width:calc(100% - 48px);display:flex;flex-direction:column;gap:8px;padding-top:8px}.action-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;background:rgba(255,255,255,.96);border:1px solid rgba(47,79,58,.22);border-left:6px solid var(--kai-ocean);border-radius:16px;padding:12px 16px;box-shadow:0 14px 34px rgba(32,46,38,.16);color:#17313a}.action-banner strong{display:block;color:#203f2b;font-size:.92rem}.action-banner span{display:block;color:#25596a;font-size:.82rem;margin-top:3px}.resolve-action{border-left-color:#2f8f46}.owner-action{border-left-color:#d9b45a}.btn-action,.btn-report{background:linear-gradient(135deg,var(--kai-ocean),var(--kai-aqua));color:#fff;border:0;border-radius:14px;padding:10px 16px;font-weight:900;white-space:nowrap;box-shadow:0 10px 24px rgba(11,127,140,.22);cursor:pointer}.ph .btn-p{font-weight:900}.reg-filter-grid{display:grid;grid-template-columns:170px 1fr 180px 180px auto;gap:12px;align-items:end}.reg-clear{height:42px;white-space:nowrap}.filter-group{margin:12px 0 8px}.filter-label{letter-spacing:.08em;text-transform:uppercase;font-size:.76rem;font-weight:900;margin:8px 0;color:#203f2b!important}.filter-row{display:flex;gap:8px;flex-wrap:wrap}.fchip{padding:9px 14px!important;border-radius:999px!important}.fchip-on{box-shadow:0 10px 22px rgba(17,147,165,.22)}
@media(max-width:900px){.action-banner-wrap{top:58px;max-width:calc(100% - 24px)}.action-banner{align-items:flex-start;flex-direction:column}.reg-filter-grid{grid-template-columns:1fr}.reg-clear{width:100%}}

/* v58 UX fixes: banners below dropdowns and better spacing */
.action-banner-wrap{position:relative!important;top:auto!important;z-index:120!important;margin:10px auto 10px!important;max-width:1180px!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;gap:10px!important;padding:8px 24px 0!important}.nav-dd-menu,.profile-menu{z-index:2000!important}.role-guide{position:relative;z-index:80;margin-top:4px}.main{position:relative;z-index:1}@media(max-width:900px){.action-banner-wrap{display:flex!important;flex-direction:column!important;max-width:calc(100% - 24px)!important;padding:8px 0 0!important}}
/* v59 admin readability, menu priority, and visible hover tooltips */
.hdr{position:sticky!important;top:0!important;z-index:90000!important;overflow:visible!important;}
.hdr-inner,.nav,.nav-dd,.profile-dd{overflow:visible!important;}
.nav-dd-menu,.profile-menu{position:fixed!important;top:62px!important;left:auto!important;right:auto!important;z-index:999999!important;max-height:calc(100vh - 82px)!important;overflow:auto!important;box-shadow:0 24px 70px rgba(0,0,0,.32)!important;}
.nav-dd-menu{min-width:240px!important;}
.profile-menu{right:16px!important;min-width:270px!important;}
@media(max-width:1000px){.nav-dd-menu,.profile-menu{left:10px!important;right:10px!important;top:58px!important;width:auto!important;min-width:0!important;}}
.action-banner-wrap,.role-guide,.main,.card{z-index:auto!important;}
/* .tip tooltip is now React-controlled (position:fixed span) — no ::after/::before needed */
.tip{position:relative;}
.admin-table input,.admin-table textarea,.fg textarea.admin-textarea,.admin-tooltip-textarea{width:100%!important;min-width:220px;box-sizing:border-box;line-height:1.35!important;white-space:pre-wrap!important;overflow:auto!important;text-overflow:clip!important;}
.admin-textarea,.admin-tooltip-textarea{resize:vertical!important;min-height:58px!important;padding:11px 12px!important;border:1px solid rgba(90,105,80,.2)!important;border-radius:12px!important;background:rgba(255,255,255,.9)!important;color:#17313a!important;font-family:inherit!important;font-size:.86rem!important;}
.admin-tooltip-textarea{min-height:78px!important;}
.admin-table td{vertical-align:top!important;}
.flex-grow{flex:1 1 auto!important;}


/* v61 emergency production layout reset: restores app styling, prevents overlap, and keeps menus on top */
:root{--kai-ink:#102f3a;--kai-green:#0b7f4f;--kai-olive:#2F4F3A;--kai-ocean:#0b7f8c;--kai-aqua:#17b7b5;--kai-gold:#d9b45a;--kai-soft:#f7f3e9;}
*{box-sizing:border-box}body{margin:0;font-family:'DM Sans',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f3e9;color:var(--kai-ink)}button,input,select,textarea{font:inherit}.app-shell{min-height:100vh;padding-bottom:40px;background:linear-gradient(180deg,rgba(255,255,255,.88),rgba(245,239,225,.93)),url('/morros-kai.png') center top/cover fixed!important;color:var(--kai-ink)!important}.hdr{position:sticky!important;top:0!important;z-index:100000!important;background:rgba(255,255,255,.92)!important;backdrop-filter:blur(14px);border-bottom:1px solid rgba(47,79,58,.16);box-shadow:0 10px 28px rgba(32,46,38,.10);overflow:visible!important}.hdr-inner{min-height:62px;padding:8px 16px;display:flex;align-items:center;gap:12px;max-width:1440px;margin:0 auto;overflow:visible!important}.logo{display:flex;align-items:center;gap:10px;cursor:pointer;min-width:220px}.logo-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#e7fff7,#d8f2f5);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 8px 20px rgba(11,127,140,.13);color:#0b7f4f;font-family:'Playfair Display',serif;font-weight:900}.logo-k{font-size:1.22rem}.logo-wave{font-size:.7rem;position:absolute;right:7px;top:7px;color:#0b7f8c}.logo-title{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:900;color:#203f2b}.logo-sub{font-size:.76rem;color:#235f72}.nav{display:flex;align-items:center;gap:5px;flex:1;min-width:0;overflow:visible!important}.nb,.dd-item,.icon-btn,.profile-btn,.btn-google,.btn-p,.btn-ghost,.bsm,.fchip{border:1px solid rgba(47,79,58,.18);background:rgba(255,255,255,.84);color:#17313a;border-radius:12px;cursor:pointer;transition:.15s ease;text-decoration:none}.nb{padding:8px 10px;font-weight:800;white-space:nowrap;position:relative}.nb:hover,.dd-item:hover,.icon-btn:hover,.profile-btn:hover{background:#fff;box-shadow:0 8px 18px rgba(32,46,38,.10);transform:translateY(-1px)}.nb-active,.dd-active{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.nb-badge,.icon-badge,.mbn-badge{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:999px;background:#e94235;color:#fff;font-size:.68rem;font-weight:900;margin-left:6px;padding:0 5px}.nav-dd,.profile-dd{position:relative;overflow:visible!important}.nav-dd-menu,.profile-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:230px;background:rgba(255,255,255,.98);border:1px solid rgba(47,79,58,.18);border-radius:16px;padding:8px;box-shadow:0 24px 70px rgba(20,32,26,.25);z-index:1000000!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important;flex-direction:column;gap:4px}.dd-item{width:100%;text-align:left;padding:10px 12px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px}.dd-item.danger{color:#9d1f16;background:#fff5f3}.hdr-right{display:flex;align-items:center;gap:8px;margin-left:auto;overflow:visible!important}.lang-switch{height:38px;border-radius:12px;border:1px solid rgba(47,79,58,.18);background:#fff;color:#17313a;padding:0 9px;font-weight:800;max-width:130px}.icon-btn,.profile-btn{width:42px;height:42px;display:flex;align-items:center;justify-content:center;position:relative}.icon-btn{font-size:1.15rem}.uavatar,.uavatar-img{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#a84cc1;color:#fff;font-weight:900;object-fit:cover}.profile-menu{right:0;min-width:285px}.profile-head{padding:10px 12px;border-bottom:1px solid rgba(47,79,58,.12);margin-bottom:5px;display:flex;flex-direction:column;gap:2px}.profile-head strong{color:#203f2b}.profile-head span,.profile-head small{font-size:.78rem;color:#235f72;word-break:break-word}.profile-lang{padding:10px 12px;display:flex;align-items:center;gap:8px;justify-content:space-between}.sync-pill{font-size:.76rem;color:#235f72;background:rgba(255,255,255,.72);border:1px solid rgba(47,79,58,.14);border-radius:999px;padding:8px 10px;white-space:nowrap}.sync-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}.synced{background:#1eaa64}.syncing{background:#d9b45a}.mob-nav{display:none}.main{max-width:1360px;margin:0 auto;padding:20px 24px 70px;position:relative;z-index:1}.card,.welcome-card,.role-guide,.notice-card,.gate-card{background:rgba(255,255,255,.94)!important;border:1px solid rgba(47,79,58,.18)!important;border-radius:22px!important;box-shadow:0 14px 40px rgba(32,46,38,.13)!important;padding:22px}.ptitle{font-family:'Playfair Display',serif;color:#203f2b!important;font-size:2rem;margin:0 0 8px;font-weight:900}.psub{color:#235f72!important;margin:0 0 14px;line-height:1.45}.ph{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.btn-p,.btn-report,.btn-action{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border:0!important;border-radius:16px!important;padding:11px 17px!important;font-weight:900!important;box-shadow:0 12px 26px rgba(11,127,140,.22)!important;cursor:pointer}.btn-ghost{background:rgba(255,255,255,.78)!important;color:#17313a!important;padding:10px 14px!important;font-weight:800!important}.btn-google{display:inline-flex;align-items:center;gap:9px;background:#fff!important;padding:12px 18px!important;font-weight:900!important}.stats6,.owner-stats,.mission-grid,.mission-grid-compact,.analytics-grid,.cat-stats,.reg-filter-grid{display:grid;gap:14px}.stats6{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))}.owner-stats{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.stat,.owner-stat,.acard,.catcard{background:rgba(255,255,255,.9)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:18px!important;padding:16px!important;box-shadow:0 10px 25px rgba(32,46,38,.08)!important}.stat-num,.ac-num,.ar-num{font-family:'Playfair Display',serif;font-size:1.55rem;font-weight:900;color:#203f2b}.stat-label,.ac-label{font-size:.78rem;color:#235f72;font-weight:800}.action-banner-wrap{position:relative!important;z-index:10!important;margin:12px auto 16px!important;max-width:1360px!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;gap:12px!important;padding:0 24px!important}.action-banner{background:rgba(255,255,255,.96)!important;border:1px solid rgba(47,79,58,.18)!important;border-left:6px solid var(--kai-ocean)!important;border-radius:18px!important;padding:14px 16px!important;box-shadow:0 12px 30px rgba(32,46,38,.12)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}.action-banner strong{color:#203f2b!important}.action-banner span{color:#235f72!important}.resolve-action{border-left-color:#2f8f46!important}.owner-action{border-left-color:#d9b45a!important}.fg,.fg2{display:grid;gap:10px}.fg2{grid-template-columns:repeat(2,minmax(0,1fr))}.fg label{font-size:.78rem;font-weight:900;color:#203f2b}.fg input,.fg select,.fg textarea,.search,.admin-textarea,.admin-tooltip-textarea{width:100%;border:1px solid rgba(47,79,58,.24)!important;border-radius:13px!important;background:rgba(255,255,255,.96)!important;color:#102f3a!important;padding:10px 12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}.fg textarea,.admin-textarea,.admin-tooltip-textarea{min-height:74px;resize:vertical;line-height:1.45}.admin-tooltip-textarea{min-height:92px}.irow{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:14px 16px!important;margin-bottom:10px!important;display:flex;gap:14px;box-shadow:0 8px 22px rgba(32,46,38,.08)!important}.ir-guest,.ir-desc,.ir-date,.ir-rep,.ir-loc{color:#173f4d!important}.ir-guest{font-weight:900}.ir-acts{display:flex;flex-direction:column;gap:6px}.bsm{padding:8px 10px!important;font-weight:900!important;border-radius:12px!important}.filter-row{display:flex;gap:8px;flex-wrap:wrap}.fchip{padding:9px 14px!important;border-radius:999px!important;font-weight:900!important}.fchip-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.workflow-card{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:20px!important;padding:14px 18px!important;box-shadow:0 12px 28px rgba(32,46,38,.10)!important;overflow:visible!important}.wf-steps{display:grid!important;grid-template-columns:1fr 26px 1fr 26px 1fr;align-items:center;gap:8px}.wf-step{min-height:72px!important;background:#fff!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:10px 12px!important}.wf-arrow{display:flex!important;justify-content:center;color:#2aa8ad;font-size:1.2rem}.wf-tip{z-index:1000001!important}.overlay{z-index:1000002!important}.modal{background:#fff!important}.toast{position:fixed;right:18px;bottom:18px;z-index:1000003;background:#17313a;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.25)}.empty{padding:30px;text-align:center;color:#235f72}.admin-table{width:100%;border-collapse:separate;border-spacing:0 8px}.admin-table th{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#203f2b;text-align:left}.admin-table td{background:rgba(255,255,255,.86);border-top:1px solid rgba(47,79,58,.12);border-bottom:1px solid rgba(47,79,58,.12);padding:10px;vertical-align:top}.admin-table td:first-child{border-left:1px solid rgba(47,79,58,.12);border-radius:12px 0 0 12px}.admin-table td:last-child{border-right:1px solid rgba(47,79,58,.12);border-radius:0 12px 12px 0}.nav-dd-menu,.profile-menu{position:fixed!important;top:64px!important;right:16px!important;max-height:calc(100vh - 78px)!important;overflow:auto!important}.nav-dd-menu{right:auto!important;left:320px!important}.profile-menu{right:16px!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important}.role-guide,.action-banner-wrap,.workflow-card,.card,.main{overflow:visible!important}.action-banner-wrap,.role-guide{z-index:5!important}.main{z-index:1!important}
@media(max-width:1000px){.logo{min-width:auto}.logo-title,.logo-sub,.compact-sync{display:none}.hdr-inner{padding:8px 10px}.nav{gap:3px}.nav .nb:nth-of-type(n+4){display:none}.nb{padding:7px 8px;font-size:.72rem}.nav-dd-menu{left:10px!important;right:10px!important;top:60px!important}.profile-menu{left:10px!important;right:10px!important;top:60px!important}.main{padding:16px 12px 60px}.action-banner-wrap{padding:0 12px!important;grid-template-columns:1fr!important}.wf-steps{grid-template-columns:1fr!important}.wf-arrow{display:none!important}.fg2{grid-template-columns:1fr}.ph{flex-direction:column}.irow{flex-direction:column}.ir-acts{flex-direction:row;flex-wrap:wrap}.stats6{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.hdr-inner{gap:6px}.logo-mark{width:34px;height:34px}.nav .nb:nth-of-type(n+3){display:none}.lang-switch{max-width:110px}.icon-btn,.profile-btn{width:34px;height:34px}.ptitle{font-size:1.55rem}.card,.welcome-card,.role-guide{padding:16px}.action-banner{flex-direction:column;align-items:flex-start!important}.stats6{grid-template-columns:1fr}.workflow-card{padding:12px!important}.wf-tip{left:8px!important;right:8px!important;transform:none!important;min-width:0!important}.wf-tip:after{left:22px!important}}

/* v62 responsive/device-aware layout patch */
:root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px)}
html{font-size:clamp(14px,1.1vw,16px);-webkit-text-size-adjust:100%}body{overflow-x:hidden}.app-shell{min-height:100svh;background-attachment:scroll!important}.hdr{top:0!important}.hdr-inner{width:100%;max-width:1440px}.main{width:100%;max-width:min(1360px,100%);padding-left:clamp(10px,2.5vw,24px)!important;padding-right:clamp(10px,2.5vw,24px)!important}.card,.welcome-card,.role-guide,.notice-card,.gate-card,.workflow-card{max-width:100%;overflow-wrap:anywhere}.ph{flex-wrap:wrap}.btn-p,.btn-report,.btn-action,.btn-ghost,.bsm,.fchip,.nb,.dd-item,.icon-btn,.profile-btn{min-height:44px;touch-action:manipulation}.nav{min-width:0;flex-wrap:nowrap}.nav .nb{max-width:160px;overflow:hidden;text-overflow:ellipsis}.hdr-right{flex-shrink:0}.sync-pill{max-width:190px;overflow:hidden;text-overflow:ellipsis}.stats6,.owner-stats,.analytics-grid,.cat-stats,.mission-grid,.mission-grid-compact,.reg-filter-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))!important}.action-banner-wrap{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))!important}.action-banner{min-width:0}.workflow-card-compact{padding:12px 14px!important;margin:10px 0 14px!important}.wf-steps{grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr)!important}.wf-step{min-width:0!important;min-height:62px!important}.wf-copy strong,.wf-copy small{white-space:normal!important}.filter-row{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;scrollbar-width:thin}.filter-row .fchip{flex:0 0 auto}.irow{min-width:0}.ir-l,.ir-c,.ir-acts{min-width:0}.admin-table{display:block;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}.admin-table textarea,.admin-table input,.admin-table select{min-width:260px;white-space:normal}.modal{width:min(94vw,560px)!important;max-height:min(90svh,900px)!important}.overlay{padding:max(12px,var(--safe-top)) 12px max(12px,var(--safe-bottom))!important}.nav-dd-menu,.profile-menu{position:fixed!important;z-index:2147483000!important;max-height:calc(100svh - 74px)!important;overflow:auto!important;-webkit-overflow-scrolling:touch}.toast{max-width:calc(100vw - 24px);right:12px!important;bottom:max(12px,var(--safe-bottom))!important}
@media (pointer:coarse){.wf-step:hover .wf-tip{display:none!important}.wf-step:focus .wf-tip,.wf-step:active .wf-tip{display:block!important}}
@media (max-width:1180px){.hdr-inner{gap:8px}.logo{min-width:0}.logo-sub{display:none}.nav .nb{font-size:.78rem;padding:8px 9px}.nav .nb:nth-of-type(n+5){display:none}.nav-dd-menu{left:auto!important;right:72px!important;top:62px!important}.profile-menu{right:10px!important;top:62px!important}.main{padding-top:14px!important}.workflow-card{padding:12px!important}.wf-step{padding:9px!important}.wf-copy small{font-size:.72rem!important}}
@media (max-width:820px){.hdr{position:sticky!important}.hdr-inner{min-height:58px}.logo-title{font-size:.92rem}.logo-sub,.sync-pill{display:none!important}.nav .nb:nth-of-type(n+3){display:none}.nav-dd-menu,.profile-menu{left:8px!important;right:8px!important;top:58px!important;width:auto!important;min-width:0!important}.main{padding:12px 10px 92px!important}.ptitle{font-size:clamp(1.45rem,7vw,2rem)!important}.psub{font-size:.92rem}.ph{display:block}.ph .btn-p,.ph .btn-report,.ph .btn-action{margin-top:10px;width:100%}.card,.welcome-card,.role-guide,.notice-card,.gate-card{border-radius:18px!important;padding:16px!important}.action-banner-wrap{padding:0 10px!important;margin:10px auto!important}.action-banner{align-items:stretch!important}.action-banner .btn-p,.action-banner .btn-action,.action-banner .btn-ghost{width:100%;text-align:center;justify-content:center}.wf-steps{grid-template-columns:1fr!important;gap:8px!important}.wf-arrow{display:none!important}.wf-step{display:flex!important;align-items:center!important;gap:10px!important;width:100%;text-align:left}.wf-icon{flex:0 0 auto}.wf-tip{position:fixed!important;left:10px!important;right:10px!important;top:auto!important;bottom:max(14px,var(--safe-bottom))!important;transform:none!important;min-width:0!important;max-width:none!important;z-index:2147483001!important}.wf-tip:after{display:none!important}.fg2,.listing-detail-grid{grid-template-columns:1fr!important}.irow{flex-direction:column!important}.ir-acts{flex-direction:row!important;flex-wrap:wrap!important}.ir-acts .bsm{flex:1 1 140px}.notice-card{flex-direction:column}.mission-grid,.mission-grid-compact{grid-template-columns:1fr!important}.gate-shell{padding:12px!important}.welcome-brand{align-items:flex-start}.welcome-logo{width:64px;height:64px}.modal{border-radius:18px!important;padding:18px!important}}
@media (max-width:520px){.hdr-inner{padding:7px 8px!important}.logo-mark{width:36px!important;height:36px!important;border-radius:12px}.logo-title{display:none!important}.nav{flex:0 1 auto}.nav .nb{display:none!important}.hdr-right{gap:5px}.icon-btn,.profile-btn{width:38px!important;height:38px!important}.uavatar,.uavatar-img{width:30px!important;height:30px!important}.main{padding-left:8px!important;padding-right:8px!important}.stats6,.owner-stats,.analytics-grid,.cat-stats,.reg-filter-grid{grid-template-columns:1fr!important}.stat,.owner-stat,.acard,.catcard{padding:13px!important}.filter-row{margin-left:-2px;margin-right:-2px}.fchip{padding:9px 12px!important}.btn-p,.btn-report,.btn-action,.btn-ghost{width:100%;justify-content:center}.admin-table td,.admin-table th{font-size:.82rem;padding:8px}.admin-table textarea,.admin-table input,.admin-table select{min-width:220px}.toast{left:10px!important;right:10px!important}.profile-head span,.profile-head small{font-size:.72rem}.profile-lang{flex-direction:column;align-items:stretch}.profile-lang select{width:100%}.empty{padding:22px 12px!important}}
@media (min-width:1181px){.nav-dd-menu{left:auto!important;right:360px!important}.profile-menu{right:16px!important}.wf-step:hover,.wf-step:focus{transform:translateY(-1px);box-shadow:0 14px 30px rgba(32,46,38,.14)!important}.filter-row{overflow:visible;flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}


/* v80 smart notifications – grid layout, text wraps, simple positioning */
.smart-dd{position:relative;display:inline-flex;z-index:2147482500}
.smart-menu{position:fixed!important;top:64px!important;right:8px!important;width:min(420px,calc(100vw - 16px))!important;max-height:calc(100svh - 78px);overflow-y:auto;background:rgba(255,255,255,.99);border:1px solid rgba(47,79,58,.18);border-radius:18px;box-shadow:0 28px 80px rgba(18,31,38,.32);padding:14px 16px;z-index:2147483500!important;color:#17313a}
.smart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid rgba(47,79,58,.10);margin-bottom:12px}
.smart-head>div>strong{display:block;font-size:.92rem;font-weight:900;color:#17313a}
.smart-head>div>span{display:block;font-size:.72rem;color:#607872;line-height:1.35;margin-top:2px}
.smart-live{flex-shrink:0;font-style:normal;background:#e7f8f0;color:#087346;border:1px solid #bdebd5;border-radius:999px;padding:3px 9px;font-size:.67rem;font-weight:900;white-space:nowrap;margin-top:2px}
.smart-list{display:flex;flex-direction:column;gap:8px}
/* 3-col grid: [badge 44px] [title+desc 1fr] [arrow 16px]; badge spans both rows */
.smart-item{width:100%;display:grid!important;grid-template-columns:44px 1fr 18px!important;grid-template-rows:auto auto!important;column-gap:10px!important;row-gap:3px!important;align-items:center!important;border:1px solid rgba(47,79,58,.10);background:#fff;border-radius:14px;padding:12px!important;text-align:left!important;cursor:pointer!important;transition:transform .14s,box-shadow .14s,border-color .14s;box-sizing:border-box}
.smart-item:hover,.smart-item:focus{transform:translateY(-2px);box-shadow:0 10px 28px rgba(32,46,38,.12);border-color:rgba(11,127,140,.28)!important}
.smart-count{grid-column:1!important;grid-row:1/3!important;align-self:center!important;justify-self:center!important;width:40px;height:40px;border-radius:10px;color:#fff;display:flex!important;align-items:center!important;justify-content:center!important;font-size:1.05rem;font-weight:900;line-height:1}
.smart-title{grid-column:2!important;grid-row:1!important;font-size:.87rem;font-weight:900;color:#17313a;line-height:1.3;word-break:break-word;overflow-wrap:anywhere}
.smart-icon-inline{font-size:.85rem;margin-right:4px}
.smart-arr{grid-column:3!important;grid-row:1!important;align-self:start!important;justify-self:end!important;color:#c4d0ce;font-size:1rem;line-height:1.4;margin-top:1px}
.smart-desc{grid-column:2/4!important;grid-row:2!important;font-size:.74rem;color:#607872;line-height:1.4;word-break:break-word;overflow-wrap:anywhere}
.smart-owner{border-left:3px solid #c49a14!important}
.smart-resolve{border-left:3px solid #d96c1a!important}
.smart-registration{border-left:3px solid #2f6fbf!important}
.smart-notice{border-left:3px solid #6b44b8!important}
.smart-serious{border-left:3px solid #c0281e!important;background:rgba(255,245,245,.5)!important}
.smart-empty{padding:20px 8px;text-align:center}
.smart-empty-icon{font-size:2rem;display:block;margin-bottom:8px}
.smart-empty strong{display:block;color:#17313a;font-size:.9rem;font-weight:900}
.smart-empty span{display:block;color:#607872;font-size:.77rem;margin-top:6px;line-height:1.45}
.smart-foot{display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(47,79,58,.10);margin-top:12px;padding-top:10px}
.smart-foot .dd-item{justify-content:center!important;background:#f5f9f8;border:1px solid rgba(47,79,58,.12);border-radius:11px;font-size:.84rem;min-height:40px;font-weight:800}
.smart-foot .dd-item:hover{background:#eaf4f2!important}
/* ── Personalised dashboard greeting ─────────────────────────────────── */
.dash-greeting{display:flex;align-items:center;gap:16px;padding:16px 20px;background:linear-gradient(135deg,rgba(47,79,58,.05),rgba(11,127,140,.05));border:1px solid rgba(47,79,58,.13);border-radius:18px;margin-bottom:14px;transition:background .2s}
.dg-all-clear{background:linear-gradient(135deg,rgba(31,122,53,.06),rgba(11,127,140,.04))!important;border-color:rgba(31,122,53,.18)!important}
.dg-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(47,79,58,.16)}
.dg-initials{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0b7f4f,#0b7f8c);color:#fff;font-weight:900;font-size:1.3rem;flex-shrink:0}
.dg-body{flex:1;min-width:0}
.dg-hello{font-family:'Playfair Display',serif;font-size:1.3rem;color:#203f2b;margin:0 0 4px;font-weight:900;line-height:1.2}
.dg-name{color:#0b7f8c}
.dg-msg{font-size:.86rem;color:#2a5a6a;margin:0 0 10px;line-height:1.45}
.dg-msg:last-child{margin-bottom:0}
.dg-pills{display:flex;flex-wrap:wrap;gap:7px}
.dg-pill{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:999px;font-size:.78rem;font-weight:800;cursor:pointer;transition:all .14s;white-space:nowrap}
.dg-pill-amber{background:rgba(217,180,90,.15);color:#8a6200;border:1px solid rgba(217,180,90,.35)}
.dg-pill-amber:hover{background:rgba(217,180,90,.28);transform:translateY(-1px)}
.dg-pill-green{background:rgba(47,143,70,.12);color:#1a6b30;border:1px solid rgba(47,143,70,.28)}
.dg-pill-green:hover{background:rgba(47,143,70,.22);transform:translateY(-1px)}
.dg-pill-blue{background:rgba(11,127,140,.10);color:#085f6a;border:1px solid rgba(11,127,140,.24)}
.dg-pill-blue:hover{background:rgba(11,127,140,.20);transform:translateY(-1px)}
.dg-pill-red{background:rgba(210,90,70,.10);color:#8c2a1a;border:1px solid rgba(210,90,70,.28)}
.dg-pill-red:hover{background:rgba(210,90,70,.20);transform:translateY(-1px)}
@media(max-width:640px){.dash-greeting{gap:12px;padding:14px 16px}.dg-hello{font-size:1.1rem}.dg-initials,.dg-avatar{width:44px;height:44px;font-size:1.1rem}}
/* ── Compact incident workflow stepper ────────────────────────────────── */
.inc-wf-bar{display:flex;align-items:center;gap:6px;padding:9px 14px;background:rgba(255,255,255,.78);border:1px solid rgba(47,79,58,.13);border-radius:14px;margin-bottom:10px;flex-wrap:wrap}
.inc-wf-label{font-size:.68rem;font-weight:900;color:#2a5a6a;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;flex-shrink:0}
.inc-wf-sep{width:1px;height:18px;background:rgba(47,79,58,.18);margin:0 4px;flex-shrink:0}
.inc-wf-group{display:flex;align-items:center;gap:4px}
.inc-wf-step{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:10px;border:1px solid rgba(47,79,58,.16);background:rgba(255,255,255,.85);font-size:.8rem;font-weight:700;color:#17313a;cursor:pointer;transition:all .14s;white-space:nowrap}
.inc-wf-step:hover{background:#fff;border-color:#0b7f8c;box-shadow:0 4px 12px rgba(32,46,38,.10);transform:translateY(-1px)}
.inc-wf-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 4px 12px rgba(11,127,140,.22)!important}
.inc-wf-arrow{color:#b0c4be;font-size:1rem;font-weight:900;line-height:1}
.inc-wf-clear{padding:4px 8px;border-radius:999px;border:1px solid rgba(233,66,53,.28);background:rgba(233,66,53,.06);color:#c62828;font-size:.72rem;cursor:pointer;font-weight:800;margin-left:auto;flex-shrink:0;transition:all .14s}
.inc-wf-clear:hover{background:rgba(233,66,53,.14)}
/* ── Incident search ─────────────────────────────────────────────────── */
.inc-search-wrap{position:relative;margin-bottom:10px}
.inc-search{width:100%;padding-right:36px!important}
.inc-search-clear{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#7a9aaa;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;line-height:1}
.inc-search-clear:hover{background:rgba(47,79,58,.08);color:#17313a}
/* ── Grouped filter bar ───────────────────────────────────────────────── */
.inc-filter-bar{display:flex;align-items:flex-end;gap:8px 16px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:rgba(255,255,255,.65);border:1px solid rgba(47,79,58,.11);border-radius:14px}
.inc-fb-group{display:flex;flex-direction:column;gap:5px}
.inc-fb-lbl{font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#2a5a6a;padding-left:2px}
.inc-fb-chips{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.inc-fb-div{width:1px;align-self:stretch;background:rgba(47,79,58,.15);margin:0 2px;flex-shrink:0}
.inc-fb-reset{align-self:flex-end;margin-bottom:0}
.fchip-sm{padding:6px 12px!important;font-size:.76rem!important;min-height:32px!important;border-radius:999px!important}
.fchip-reset{border-color:rgba(233,66,53,.28)!important;color:#c62828!important;background:rgba(233,66,53,.05)!important}
.fchip-reset:hover{background:rgba(233,66,53,.12)!important}
@media(max-width:600px){.inc-filter-bar{padding:8px 10px;gap:6px 10px}.inc-fb-div{display:none}}
@media(max-width:640px){.inc-wf-bar{gap:4px;padding:8px 10px}.inc-wf-label{display:none}.inc-wf-sep{display:none}.inc-wf-step{font-size:.74rem;padding:5px 9px}}
/* ── Form section headers ─────────────────────────────────────────────── */
.form-section-hdr{grid-column:1/-1;margin:14px 0 2px;padding:10px 0 6px;border-top:1px solid rgba(47,79,58,.14);font-size:.7rem;font-weight:900;color:#2F4F3A;text-transform:uppercase;letter-spacing:.09em;display:flex;align-items:center;gap:6px}
.form-section-hdr:first-child{margin-top:0;padding-top:0;border-top:none}
/* ── Email notification config table ──────────────────────────────────── */
.enc-legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.72rem;color:#2a5a6a;margin-bottom:12px;padding:8px 10px;background:rgba(11,127,140,.05);border-radius:10px}
.enc-legend strong{margin-right:3px}
.enc-table{border:1px solid rgba(47,79,58,.14);border-radius:12px;overflow:hidden;font-size:.78rem}
.enc-hdr{display:grid;grid-template-columns:1fr 58px repeat(4,52px);background:rgba(47,79,58,.07);padding:7px 10px;font-size:.68rem;font-weight:900;color:#2a5a6a;text-transform:uppercase;letter-spacing:.06em;align-items:end}
.enc-col-r-hdr{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.62rem;line-height:1.1;color:#2a5a6a;font-weight:900;padding-bottom:2px}
.enc-group{border-top:1px solid rgba(47,79,58,.10)}
.enc-group:first-child{border-top:none}
.enc-group-hdr{padding:7px 10px 4px;font-size:.7rem;font-weight:900;color:#2F4F3A;background:rgba(47,79,58,.04);text-transform:uppercase;letter-spacing:.08em}
.enc-row{display:grid;grid-template-columns:1fr 58px repeat(4,52px);padding:6px 10px;align-items:center;border-top:1px solid rgba(47,79,58,.07);transition:background .12s}
.enc-row:hover{background:rgba(255,255,255,.6)}
.enc-off{opacity:.55}
.enc-col-type{font-size:.78rem;color:#17313a;padding-right:8px}
.enc-col-on,.enc-col-r{display:flex;align-items:center;justify-content:center}
/* pill toggle */
.enc-pill-toggle{display:inline-flex;align-items:center;cursor:pointer;position:relative}
.enc-pill-toggle input{position:absolute;opacity:0;width:0;height:0}
.enc-pill{display:inline-block;width:32px;height:18px;border-radius:999px;background:#d0d8d4;border:1px solid rgba(0,0,0,.08);transition:background .2s;position:relative}
.enc-pill::after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:left .2s}
.enc-pill-on{background:#0b7f4f}
.enc-pill-on::after{left:16px}
/* checkbox */
.enc-cb-wrap{display:flex;align-items:center;justify-content:center;cursor:pointer}
.enc-cb-wrap input{width:16px;height:16px;accent-color:#0b7f8c;cursor:pointer}
.enc-cb-dim{opacity:.38}
.enc-cb-dim input{cursor:not-allowed}
.enc-na{color:#aec0be;font-size:.9rem;text-align:center;display:block}
@media(max-width:640px){.enc-hdr,.enc-row{grid-template-columns:1fr 46px repeat(4,40px)}.enc-hdr{font-size:.6rem}.enc-col-type{font-size:.72rem}}
.nav-help-btn{padding:8px 10px!important;font-size:1rem!important;flex-shrink:0!important}
/* Bell lives in nav so it stays adjacent to More ▾ */
.nav-bell{flex-shrink:0!important;margin-right:2px!important}
.icon-btn .icon-badge{position:absolute!important;top:-6px!important;right:-6px!important;margin-left:0!important;min-width:20px!important;height:20px!important;font-size:.72rem!important;padding:0 5px!important;box-shadow:0 2px 8px rgba(233,66,53,.45)!important}
.icon-badge{animation:smartPulse 1.8s infinite}
@keyframes smartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
@media(max-width:860px){.smart-menu{right:8px!important;left:8px!important;width:auto!important;top:60px!important;max-height:calc(100svh - 72px)!important}}

/* --- spinners -------------------------------------------------------------- */
.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,.18);border-top-color:#17b7b5;border-radius:50%;animation:spin .8s linear infinite}
.spinner-sm{width:16px;height:16px;border:2px solid rgba(11,127,140,.22);border-top-color:#0b7f8c;border-radius:50%;animation:spin .8s linear infinite;display:inline-block;flex-shrink:0;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.sync-overlay{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:rgba(23,49,58,.94);color:#fff;border-radius:14px;padding:10px 18px;display:flex;align-items:center;gap:8px;font-size:.82rem;z-index:9999999;box-shadow:0 10px 30px rgba(0,0,0,.3);white-space:nowrap}

/* --- missing base layouts -------------------------------------------------- */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:18px 0}
.card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px;flex-wrap:wrap}
.lnk{background:transparent!important;border:0!important;color:#0b7f8c!important;font-weight:800;text-decoration:underline;text-underline-offset:3px;padding:4px 0!important;box-shadow:none!important;cursor:pointer;font-size:.84rem}
.lg{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:14px}
.fade{animation:fadeIn .3s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* --- dashboard stat cards -------------------------------------------------- */
.scard{background:rgba(255,255,255,.9)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:18px!important;padding:16px!important;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 22px rgba(32,46,38,.08)!important;transition:transform .15s ease,box-shadow .15s ease;cursor:default}
.scard:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(32,46,38,.14)!important}
.sval{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:900;line-height:1;color:#203f2b}
.slabel{font-size:.78rem;color:#235f72;font-weight:800}

/* --- dashboard listing rows ------------------------------------------------ */
.apt-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 2px;border-bottom:1px solid rgba(47,79,58,.08);min-width:0}
.apt-row:last-child{border-bottom:0;padding-bottom:2px}
.apt-row:hover{background:rgba(11,127,140,.03);border-radius:10px;margin:0 -6px;padding-left:8px;padding-right:8px}
.ar-info{flex:1;min-width:0}
.ar-apt{font-family:'Playfair Display',serif;font-weight:900;font-size:1.05rem;color:#203f2b;line-height:1.2}
.ar-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
.ar-chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.ar-actions{display:flex;gap:6px;flex-shrink:0;align-items:center}
.ar-act{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.82);border:1px solid rgba(47,79,58,.16);color:#17313a;font-size:.9rem;text-decoration:none;transition:background .13s,box-shadow .13s,transform .13s;flex-shrink:0}
.ar-act:hover{background:#fff;transform:translateY(-2px);box-shadow:0 6px 14px rgba(32,46,38,.13)}
.ar-act-wa{color:#1aa361!important;border-color:rgba(26,163,97,.25)!important;background:rgba(26,163,97,.07)!important}
.ar-act-ab{color:#cc3035!important;border-color:rgba(255,90,95,.22)!important;background:rgba(255,90,95,.07)!important}
@media(max-width:500px){.ar-apt{font-size:.96rem}.ar-act{width:38px;height:38px;font-size:1rem}}

/* --- chip color variants --------------------------------------------------- */
.chip{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:999px;font-size:.72rem;font-weight:700;line-height:1.3}
.c-teal{background:rgba(11,127,140,.12)!important;color:#0b7f8c!important;border:1px solid rgba(11,127,140,.18)!important}
.c-blue{background:rgba(23,63,100,.1)!important;color:#174b70!important;border:1px solid rgba(23,63,100,.16)!important}
.c-gray{background:rgba(100,120,130,.1)!important;color:#3a5a6a!important;border:1px solid rgba(100,120,130,.16)!important}
.c-red{background:rgba(255,90,95,.12)!important;color:#cc3035!important;border:1px solid rgba(255,90,95,.2)!important}

/* --- header beta badge ----------------------------------------------------- */
.beta-badge{font-size:.58rem;font-weight:900;letter-spacing:.06em;background:rgba(11,127,140,.16);color:#0b7f8c;border-radius:999px;padding:2px 7px;vertical-align:middle;margin-left:5px;border:1px solid rgba(11,127,140,.22)}

/* --- BetaCommandCenter ----------------------------------------------------- */
.beta-command{background:rgba(255,255,255,.88);border:1px solid rgba(47,79,58,.14);border-radius:20px;padding:16px 18px;margin:0 0 16px;box-shadow:0 8px 22px rgba(32,46,38,.07)}
.beta-command-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.beta-command-head strong{display:block;color:#203f2b;font-size:.95rem;font-weight:900}
.beta-kicker{display:block;font-size:.68rem;font-weight:900;color:#0b7f8c;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px}
.beta-health{font-size:.78rem;font-weight:900;border-radius:999px;padding:5px 10px;white-space:nowrap;flex-shrink:0}
.all-clear{background:#dff5e4;color:#1f7a35;border:1px solid rgba(31,122,53,.2)}
.needs-work{background:#fff0dc;color:#a06000;border:1px solid rgba(160,96,0,.2)}
.beta-command-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.beta-action-card{display:grid!important;grid-template-columns:36px 1fr auto;align-items:center!important;gap:10px;background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.12);border-radius:14px;padding:10px 12px;text-align:left;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;justify-content:initial!important;width:100%}
.beta-action-card:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(32,46,38,.12);border-color:#19a66a}
.beta-action-card.has-count{border-left:3px solid #d9b45a}
.beta-action-icon{width:32px;height:32px;border-radius:50%;background:#f1f6f4;display:flex!important;align-items:center!important;justify-content:center!important;font-size:.95rem;flex:0 0 32px}
.beta-action-copy{min-width:0;text-align:left}
.beta-action-copy strong{display:block;color:#203f2b;font-size:.84rem;font-weight:900}
.beta-action-copy small{display:block;color:#496674;font-size:.7rem;line-height:1.25;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.beta-action-count{min-width:26px;height:26px;border-radius:999px;background:#edf5fe;color:#203f2b;display:flex!important;align-items:center!important;justify-content:center!important;font-size:.8rem;font-weight:900;border:1px solid rgba(47,79,58,.12);flex:0 0 26px}
.beta-action-card.has-count .beta-action-count{background:#fff0dc;color:#a06000;border-color:rgba(160,96,0,.22)}
@media(max-width:760px){.beta-command-grid{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}}

/* --- DashboardFocus (unified action section) -------------------------------- */
.dash-focus{margin-bottom:16px}
.dash-focus-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}
.dash-focus-title strong{display:block;font-size:1rem;font-weight:900;color:#203f2b}
.dash-focus-title p{margin:4px 0 0;font-size:.84rem;color:#235f72;line-height:1.45}
.dash-focus-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dash-focus-actions>span{font-size:.78rem;font-weight:900;color:#235f72;white-space:nowrap}
.dash-focus-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dash-focus-card{display:grid!important;grid-template-columns:36px 1fr auto;align-items:center!important;gap:10px;background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.12);border-left:4px solid transparent;border-radius:14px;padding:12px 14px;text-align:left;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;width:100%;justify-content:initial!important}
.dash-focus-card:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(32,46,38,.12)}
.dfc-icon{font-size:1.25rem;width:36px;text-align:center;flex-shrink:0}
.dfc-copy{min-width:0}
.dfc-copy strong{display:block;font-size:.88rem;font-weight:900;color:#203f2b}
.dfc-copy small{display:block;font-size:.76rem;color:#235f72;line-height:1.35;margin-top:2px;white-space:normal}
.dfc-count{min-width:28px;height:28px;border-radius:999px;background:#edf5fe;color:#203f2b;display:flex!important;align-items:center!important;justify-content:center!important;font-size:.82rem;font-weight:900;border:1px solid rgba(47,79,58,.12);flex-shrink:0}
.dfc-active .dfc-count{background:#fff0dc;color:#a06000;border-color:rgba(160,96,0,.22)}
.dfc-active.dfc-amber{border-left-color:#d9a030}
.dfc-active.dfc-green{border-left-color:#2a9a4a}
.dfc-active.dfc-blue{border-left-color:#3b82f6}
.role-chip{background:rgba(11,127,140,.1);color:#0b7f8c;border:1px solid rgba(11,127,140,.22);border-radius:999px;padding:6px 13px;font-size:.8rem;font-weight:900;cursor:pointer;white-space:nowrap;transition:.12s ease}
.role-chip:hover{background:rgba(11,127,140,.18);transform:translateY(-1px)}
@media(max-width:760px){.dash-focus-grid{grid-template-columns:1fr}.dash-focus-head{flex-direction:column}.dash-focus-actions{margin-top:4px}}

/* --- AptCard internals ----------------------------------------------------- */
.acard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.acard-body{margin-bottom:10px}
.acard-foot{display:flex;gap:8px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(47,79,58,.08)}
.ac-wave{font-size:1.2rem;opacity:.4;flex-shrink:0}
/* Stats row */
.ac-stats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
/* Owner / Operator sections */
.ac-party{padding:7px 0;border-top:1px solid rgba(47,79,58,.09)}
.ac-party-op{border-top-style:dashed}
.ac-party-lbl{font-size:.63rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#2a5a6a;margin-bottom:4px}
.ac-party-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.ac-no-name{font-size:.8rem;color:#8a9fa5;font-style:italic}
/* Contact icon buttons — mirrors ar-act from dashboard for consistency */
.ac-cbtns{display:flex;align-items:center;gap:5px;flex-shrink:0}
.ac-cbtn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;border:1px solid rgba(47,79,58,.20);background:rgba(255,255,255,.92);color:#17313a;font-size:1rem;text-decoration:none;transition:all .14s;cursor:pointer;flex-shrink:0}
.ac-cbtn:hover{background:#fff;border-color:#0b7f8c;box-shadow:0 5px 14px rgba(32,46,38,.13);transform:translateY(-1px)}
.ac-cbtn-wa{color:#1aa361!important;border-color:rgba(26,163,97,.28)!important;background:rgba(26,163,97,.08)!important}
.ac-cbtn-wa:hover{background:rgba(26,163,97,.16)!important;border-color:#1aa361!important}
.airbnb-lnk{display:inline-flex;align-items:center;font-size:.78rem;color:#FF5A5F!important;text-decoration:none;font-weight:800;padding:4px 10px;border:1px solid rgba(255,90,95,.22);border-radius:999px;background:rgba(255,90,95,.08)}
.airbnb-lnk:hover{background:rgba(255,90,95,.16)}
.no-link{font-size:.74rem;color:#8a9fa5;margin-bottom:6px}
.inc-b{font-size:.76rem;font-weight:800;padding:5px 10px;border-radius:999px;cursor:pointer;margin-top:6px;display:inline-block;border:1px solid transparent}
.ib-open{background:rgba(210,90,70,.14);color:#b83215;border-color:rgba(210,90,70,.2)}
.ib-none{background:rgba(31,122,53,.1);color:#1f7a35;border-color:rgba(31,122,53,.16)}
.lock-tag{font-size:.74rem;color:#8a9fa5;background:rgba(100,120,130,.08);border-radius:999px;padding:3px 8px;border:1px solid rgba(100,120,130,.14)}

/* --- dashboard blacklist --------------------------------------------------- */
.ncard{border-left:4px solid #b71c1c!important}
.nrow{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.npill{display:flex;align-items:center;gap:10px;background:rgba(180,28,28,.06);border:1px solid rgba(180,28,28,.14);border-radius:12px;padding:10px 14px}
.np-name{font-size:.88rem;font-weight:700;color:#b83215}
.np-loc{font-size:.72rem;color:#5a8090;margin-top:2px}
.np-apt{font-size:.7rem;color:#2a4a5a;margin-top:2px}

/* --- guest display --------------------------------------------------------- */
.guest-display-list{font-size:.8rem;color:#235f72;line-height:1.55;padding:4px 0}

/* --- action strip (single compact row, replaces banner + guide + command center) */
.action-strip{display:flex;flex-wrap:wrap;gap:8px;padding:8px 24px;background:rgba(255,255,255,.86);border-bottom:1px solid rgba(47,79,58,.10)}
.action-pill{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:14px;font-size:.82rem;font-weight:700;cursor:pointer;border:1.5px solid;transition:transform .12s ease,box-shadow .12s ease;text-align:left;min-height:44px;touch-action:manipulation}
.action-pill:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.10)}
.ap-icon{font-size:1.05rem;line-height:1;flex-shrink:0}
.ap-body{display:flex;flex-direction:column;gap:1px}
.ap-body strong{font-size:.84rem;font-weight:900;line-height:1.15}
.ap-body span{font-size:.7rem;font-weight:600;opacity:.72;line-height:1}
.ap-owner{background:#fffbeb;color:#92400e;border-color:rgba(217,119,6,.3)}
.ap-resolve{background:#f0fdf4;color:#14532d;border-color:rgba(22,163,74,.28)}
.ap-reg{background:#eff6ff;color:#1e3a8a;border-color:rgba(59,130,246,.28)}
@media(max-width:600px){.action-strip{padding:8px 12px}.action-pill{padding:7px 11px}.ap-body span{display:none}}

/* --- role preview banner (Global Admin only) ------------------------------- */
.role-preview-banner{position:sticky;top:62px;z-index:89999;background:#fbbf24;color:#1a1200;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 24px;font-weight:700;font-size:.86rem;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.role-preview-banner>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.role-preview-banner>button{flex-shrink:0;background:rgba(0,0,0,.14);border:1px solid rgba(0,0,0,.22);border-radius:8px;padding:5px 12px;font-weight:900;cursor:pointer;color:#1a1200;white-space:nowrap;font-size:.82rem}
.role-preview-banner>button:hover{background:rgba(0,0,0,.24)}
@media(max-width:600px){.role-preview-banner{padding:8px 12px;font-size:.78rem}.role-preview-banner>span{font-size:.72rem}}

/* --- view-as selector (Global Admin only) ---------------------------------- */
.view-as-wrap{display:flex;align-items:center;gap:5px;flex-shrink:0}
.view-as-label{font-size:.72rem;font-weight:900;color:#235f72;white-space:nowrap}
.view-as-select{height:34px;border-radius:10px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,252,.96)!important;color:#17313a!important;padding:0 8px!important;font-weight:800;font-size:.76rem;cursor:pointer}
@media(max-width:1180px){.view-as-wrap{max-width:175px}.view-as-label{display:none}.view-as-select{font-size:.72rem}}
@media(max-width:1000px){.view-as-wrap{display:none}}
/* "View as" in profile dropdown (always accessible) */
.profile-view-as{padding:8px 12px;display:flex;align-items:center;gap:8px;border-top:1px solid rgba(47,79,58,.08);margin-top:2px}
.profile-view-as>span{font-size:.78rem;font-weight:900;color:#235f72;white-space:nowrap;flex-shrink:0}
.profile-view-as .view-as-select{flex:1;height:32px;font-size:.82rem}

/* --- FIX 1: nav overflow at 900-1200 px ----------------------------------- */
@media(max-width:1200px) and (min-width:1001px){
  .hdr-inner{gap:6px!important}
  .nav .nb{font-size:.76rem!important;padding:7px 8px!important}
  .nav-dd-menu{right:215px!important}
}

/* --- v76 nav layout: left|center|right — no overflow ----------------------- */
.hdr-inner{display:flex!important;flex-wrap:nowrap!important;gap:6px!important}
.logo{flex:0 0 auto!important}
.nav.nav-compact{flex:1 1 0!important;min-width:0!important;overflow:hidden!important;flex-wrap:nowrap!important;gap:3px!important}
.nav.nav-compact .nb{min-width:0!important;flex-shrink:1!important;white-space:nowrap!important;font-size:clamp(.7rem,1.4vw,.85rem)!important;padding:7px 8px!important}
.hdr-right{flex:0 0 auto!important;margin-left:auto!important}
/* More ▾ dropdown — View as role section */
.dd-sep{height:1px;background:rgba(47,79,58,.12);margin:5px 8px}
.dd-section-label{font-size:.69rem;font-weight:900;color:#235f72;padding:6px 12px 3px;text-transform:uppercase;letter-spacing:.07em;display:block}
.dd-radio{justify-content:flex-start!important;gap:8px!important}
.dd-radio-on{background:rgba(11,127,140,.1)!important;color:#0b7f8c!important;font-weight:900!important}
.dd-radio-dot{font-size:.88rem;width:14px;text-align:center;flex-shrink:0;font-family:monospace}
.nb-preview-dot{font-size:.72rem;margin-left:4px;vertical-align:middle;line-height:1}

/* ── Help view ─────────────────────────────────────────────────────────────── */
.help-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px}
.help-card{display:flex!important;align-items:center!important;gap:14px!important;background:rgba(255,255,255,.94)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:15px 16px!important;text-align:left!important;cursor:pointer!important;transition:transform .14s,box-shadow .14s,border-color .14s!important}
.help-card:hover,.help-card:focus{transform:translateY(-2px)!important;box-shadow:0 12px 32px rgba(32,46,38,.14)!important;border-color:rgba(11,127,140,.3)!important}
.help-card-icon{font-size:1.7rem;flex-shrink:0;line-height:1}
.help-card-body{flex:1;min-width:0}
.help-card-body strong{display:block;color:#203f2b;font-size:.9rem;font-weight:900;line-height:1.25}
.help-card-body span{display:block;color:#496674;font-size:.76rem;margin-top:3px;line-height:1.35}
.help-card-arr{color:#b0bfba;font-size:1.3rem;flex-shrink:0;line-height:1}
.help-topic-count{font-size:.78rem;color:#496674;font-weight:700;white-space:nowrap;padding-bottom:6px}
.help-article{max-width:760px}
.help-article-hdr{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid rgba(47,79,58,.12)}
.help-article-icon{font-size:2.4rem;line-height:1;flex-shrink:0;margin-top:3px}
.help-section{margin-top:22px;padding-top:18px;border-top:1px solid rgba(47,79,58,.09)}
.help-section-h{color:#203f2b;font-size:1rem;font-weight:900;margin:0 0 8px;line-height:1.3}
.help-section-b{color:#17313a;font-size:.9rem;line-height:1.7;margin:0}
.help-actions{margin-top:24px;padding:16px 18px;background:linear-gradient(135deg,rgba(11,127,79,.05),rgba(11,127,140,.06));border:1px solid rgba(11,127,140,.16);border-radius:14px}
.help-actions-label{display:block;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#235f72;margin-bottom:10px}
.help-actions-row{display:flex;gap:10px;flex-wrap:wrap}
.help-action-btn{flex-shrink:0}
.help-article-foot{margin-top:20px;padding-top:16px;border-top:1px solid rgba(47,79,58,.10)}
/* ── Notifications view: full-page smart alerts grid ─────────────────────────*/
.notif-alerts-section{margin-bottom:8px}
.notif-alerts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
@media(max-width:600px){.notif-alerts-grid{grid-template-columns:1fr}}

/* ── Admin collapsible sections ─────────────────────────────────────────────── */
.admin-sec-hdr{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;border-radius:12px;padding:4px 2px;margin:-4px -2px;transition:background .12s}
.admin-sec-hdr:hover{background:rgba(11,127,140,.05)}
.admin-sec-info{flex:1;min-width:0}
.admin-sec-action{flex-shrink:0}
.admin-sec-chevron{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(47,79,58,.07);color:#496674;font-size:.68rem;transition:background .12s}
.admin-sec-hdr:hover .admin-sec-chevron{background:rgba(11,127,140,.12);color:#0b7f8c}
.admin-sec-body{margin-top:14px;padding-top:14px;border-top:1px solid rgba(47,79,58,.10)}
.admin-section.card:not(:has(.admin-sec-body)){padding-bottom:18px}
@media(max-width:600px){.admin-sec-hdr{flex-wrap:wrap;gap:8px}.admin-sec-action{width:100%}}
@media(max-width:600px){.help-grid{grid-template-columns:1fr}.help-article-hdr{flex-direction:column;gap:10px}.help-article-icon{font-size:2rem}}

/* ── Building view ───────────────────────────────────────────────────────── */
.fls-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.fls-vtoggle{display:flex;border:1px solid rgba(47,79,58,.2);border-radius:10px;overflow:hidden;flex-shrink:0}
.fls-vbtn{padding:7px 14px;font-size:.78rem;font-weight:800;color:#496674;background:rgba(255,255,255,.7);border:0;cursor:pointer;transition:background .12s,color .12s;white-space:nowrap}
.fls-vbtn:hover{background:rgba(255,255,255,.95);color:#17313a}
.fls-vbtn-on{background:#0b7f4f!important;color:#fff!important}
/* ── Building (floor bands + door grid) */
.bld-building{display:flex;flex-direction:column;gap:10px}
/* ── Building floors — light, on-theme */
.bld-floor{border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.08);border:1px solid rgba(47,79,58,.16);background:rgba(255,255,255,.9)}
.bld-floor-hdr{width:100%;display:flex;align-items:center;gap:14px;padding:13px 18px;background:linear-gradient(90deg,rgba(11,127,79,.07),rgba(11,127,140,.04));border-left:5px solid #0b7f8c;border-top:0;border-right:0;border-bottom:0;cursor:pointer;text-align:left;transition:background .14s}
.bld-floor-hdr:hover{background:linear-gradient(90deg,rgba(11,127,79,.11),rgba(11,127,140,.07))}
.bld-floor-id{display:flex;flex-direction:column;gap:0;flex-shrink:0;min-width:38px}
.bld-floor-level{font-size:.52rem;font-weight:900;letter-spacing:.14em;color:#8a9fa5;text-transform:uppercase}
.bld-floor-num{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:900;line-height:1;color:#203f2b}
.bld-floor-stats{display:flex;gap:6px;flex:1;flex-wrap:wrap;align-items:center}
.bld-stat-pill{border-radius:999px;padding:4px 10px;font-size:.72rem;font-weight:800;white-space:nowrap}
.bld-stat-apts{background:rgba(47,79,58,.08);color:#496674;border:1px solid rgba(47,79,58,.14)}
.bld-stat-inc{background:rgba(160,80,0,.08);color:#a05000;border:1px solid rgba(160,80,0,.18)}
.bld-stat-ver{background:rgba(11,127,79,.08);color:#0b5f3a;border:1px solid rgba(11,127,79,.18)}
.bld-stat-res{background:rgba(100,150,120,.08);color:#4a7060;border:1px solid rgba(100,150,120,.18)}
.bld-stat-clear{background:rgba(31,160,100,.07);color:#1a7a50;border:1px solid rgba(31,160,100,.16)}
.bld-chev{color:#8a9fa5;font-size:1.1rem;font-weight:900;transition:transform .2s;display:inline-block;flex-shrink:0;margin-left:auto}
.bld-chev-up{transform:rotate(90deg)}
.bld-floor-body{background:rgba(245,248,244,.8);border-top:1px solid rgba(47,79,58,.08)}
/* ── Door grid — min 160px so 3-digit numbers and "Details" always fit */
.bld-door-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:14px}
/* ── Door card */
.apt-door{position:relative;border-radius:12px;overflow:hidden;cursor:pointer;background:rgba(255,255,255,.96);border:1.5px solid rgba(47,79,58,.16);box-shadow:0 4px 12px rgba(32,46,38,.08);transition:transform .15s,box-shadow .15s,border-color .18s;user-select:none;display:flex;flex-direction:column}
.apt-door:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(32,46,38,.14)}
.apt-door-clean{border-color:rgba(31,160,100,.3)!important}
.apt-door-warn{border-color:rgba(217,160,0,.45)!important;box-shadow:0 4px 12px rgba(32,46,38,.08),0 0 0 1px rgba(217,160,0,.18)!important}
.apt-door-alert{border-color:rgba(210,80,60,.45)!important;box-shadow:0 4px 12px rgba(32,46,38,.08),0 0 10px rgba(210,80,60,.18)!important}
.apt-door-sel{border-color:rgba(11,127,140,.55)!important;box-shadow:0 0 0 3px rgba(11,127,140,.14),0 6px 16px rgba(32,46,38,.12)!important;transform:translateY(-1px)}
/* Status bar */
.door-status-bar{height:3px;width:100%;flex-shrink:0}
.door-sb-clean{background:linear-gradient(90deg,#1fa862,#2dda80)}
.door-sb-warn{background:linear-gradient(90deg,#d9a030,#f0c040)}
.door-sb-alert{background:linear-gradient(90deg,#d43028,#f05040)}
/* Full-width number plate — always shows the complete 3-digit apt number */
.door-num-plate{display:flex;align-items:center;justify-content:space-between;margin:10px 10px 4px;background:linear-gradient(135deg,#17313a,#243c30);border-radius:8px;padding:7px 10px;flex-shrink:0}
.door-num{font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:900;color:#c8d8a0;letter-spacing:.05em;line-height:1}
/* Incident badge — inline inside the plate, no absolute positioning */
.door-inc-badge{background:#d9a030;color:#1a0800;border-radius:999px;font-size:.6rem;font-weight:900;padding:2px 7px;white-space:nowrap;flex-shrink:0}
/* Card body */
.door-body{padding:6px 10px 4px;flex:1}
.door-owner{font-size:.74rem;font-weight:700;color:#203f2b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.door-op{font-size:.64rem;color:#496674;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px}
.door-chips{display:flex;gap:4px;flex-wrap:wrap}
.door-chip{font-size:.62rem;font-weight:700;padding:2px 6px;border-radius:999px;background:rgba(47,79,58,.08);color:#496674;border:1px solid rgba(47,79,58,.1)}
/* Footer */
.door-footer{text-align:center;font-size:.62rem;font-weight:800;color:#0b7f8c;padding:5px 8px 7px;border-top:1px solid rgba(47,79,58,.06);margin-top:4px;white-space:nowrap;flex-shrink:0}
/* ── Door hover overlay — shows contact links on hover without blocking card click */
.door-hover-overlay{
  position:absolute;inset:0;border-radius:12px;
  background:rgba(5,22,30,.86);backdrop-filter:blur(3px);
  display:flex;flex-direction:column;justify-content:center;align-items:flex-start;
  padding:10px 12px;gap:7px;
  opacity:0;pointer-events:none;
  transition:opacity .18s ease;
}
.apt-door:hover:not(.apt-door-sel) .door-hover-overlay{opacity:1}
.door-hover-link{
  display:flex;align-items:center;gap:6px;
  color:#fff;text-decoration:none;font-size:.68rem;font-weight:600;line-height:1.3;
  max-width:100%;pointer-events:auto;
}
.door-hover-link span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.door-hover-link:hover{text-decoration:underline;color:#a8e6cf}
.door-hover-missing{font-size:.65rem;color:rgba(255,255,255,.4);font-style:italic}
.door-hover-cta{font-size:.6rem;font-weight:800;color:rgba(255,255,255,.5);margin-top:2px;letter-spacing:.03em}
.door-wa-warn{color:#f0c040;font-size:.65em}
/* ── Apt detail panel */
.adp-wrap{margin:0 16px 16px;background:rgba(255,255,255,.96);border-radius:14px;border:1px solid rgba(47,79,58,.18);box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden;animation:fadeIn .18s ease}
.adp-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:linear-gradient(90deg,rgba(11,127,79,.07),rgba(11,127,140,.05));border-bottom:1px solid rgba(47,79,58,.1);flex-wrap:wrap}
.adp-apt-id{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.adp-apt-num{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:900;color:#203f2b}
.adp-close-btn{width:28px;height:28px;border-radius:8px;border:1px solid rgba(47,79,58,.2);background:rgba(255,255,255,.7);color:#496674;font-size:.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.adp-close-btn:hover{background:#fff;color:#17313a}
.adp-contacts{display:flex;gap:0;flex-direction:column;border-bottom:1px solid rgba(47,79,58,.08)}
.adp-party{display:flex;align-items:center;gap:10px;padding:10px 16px;flex-wrap:wrap;border-bottom:1px solid rgba(47,79,58,.06)}
.adp-party:last-child{border-bottom:none}
.adp-party-lbl{font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#2a5a6a;min-width:72px;flex-shrink:0}
.adp-party-row{display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap}
.adp-incidents{padding:14px 16px}
.adp-inc-hdr{font-size:.78rem;font-weight:900;color:#2a5a6a;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.adp-inc-count{background:rgba(47,79,58,.1);border-radius:999px;padding:2px 9px;font-size:.72rem;color:#17313a}
.adp-inc-empty{font-size:.84rem;color:#6a9a7a;padding:8px 0;font-weight:700}
.adp-inc-group{margin-bottom:12px}
.adp-inc-group-lbl{font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.adp-inc-card{background:rgba(247,243,234,.8);border:1px solid rgba(47,79,58,.1);border-radius:10px;padding:10px 12px;margin-bottom:6px}
.adp-inc-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.adp-inc-date{font-size:.7rem;color:#8a9fa5;margin-left:auto}
.adp-inc-desc{font-size:.82rem;color:#17313a;line-height:1.45;margin-bottom:4px}
.adp-inc-guest{font-size:.76rem;color:#496674;margin-top:4px}
.adp-inc-comments{font-size:.76rem;color:#496674;margin-top:4px;background:rgba(217,180,90,.08);border-radius:6px;padding:4px 8px}
.adp-inc-reporter-name{font-size:.68rem;color:#6a8a9a;white-space:nowrap}
/* ── Incident context tags — shown in IRow and AptDetailPanel */
.ir-ctx-tags{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 2px}
.inc-ctx-tag{display:inline-flex;align-items:center;border-radius:999px;font-size:.62rem;font-weight:900;padding:2px 8px;white-space:nowrap;letter-spacing:.02em}
.inc-ctx-reporter{background:rgba(21,101,192,.1);color:#1565c0;border:1px solid rgba(21,101,192,.22)}
.inc-ctx-mine{background:rgba(11,127,140,.09);color:#0b5f72;border:1px solid rgba(11,127,140,.22)}
/* ── List-mode floor groups (kept for ≡ view) */
.fls-list{display:flex;flex-direction:column;gap:12px}
.fls-floor{background:rgba(255,255,255,.88);border:1px solid rgba(47,79,58,.16);border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.07)}
.fls-floor-hdr{width:100%;display:flex;align-items:center;gap:10px;padding:13px 16px;background:none;border:0;border-left:5px solid #0b7f8c;cursor:pointer;text-align:left;transition:background .14s}
.fls-floor-hdr:hover{background:rgba(11,127,140,.04)}
.fls-floor-badge{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;color:#fff;font-size:.78rem;font-weight:900;flex-shrink:0}
.fls-floor-label{font-family:'Playfair Display',serif;font-size:1rem;font-weight:900;color:#203f2b;flex-shrink:0}
.fls-floor-meta{display:flex;align-items:center;gap:8px;margin-left:4px;flex:1;flex-wrap:wrap}
.fls-floor-units{font-size:.78rem;color:#496674;font-weight:700;background:rgba(47,79,58,.07);border-radius:999px;padding:3px 9px}
.fls-floor-open{font-size:.76rem;color:#a05000;font-weight:800;background:rgba(160,80,0,.1);border-radius:999px;padding:3px 9px;border:1px solid rgba(160,80,0,.18)}
.fls-chev{font-size:1.1rem;color:#8a9fa5;font-weight:900;transition:transform .18s;display:inline-block;flex-shrink:0}
.fls-chev-up{transform:rotate(90deg)}
.fls-floor-body{border-top:1px solid rgba(47,79,58,.1)}
.fls-row{border-bottom:1px solid rgba(47,79,58,.07);transition:background .12s}
.fls-row:last-child{border-bottom:none}
.fls-row:hover{background:rgba(11,127,140,.03)}
.fls-row-open{background:rgba(11,127,140,.04)!important}
.fls-row-main{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;flex-wrap:wrap;min-width:0}
.fls-apt-num{font-family:'Playfair Display',serif;font-weight:900;font-size:.96rem;color:#203f2b;white-space:nowrap;flex-shrink:0;min-width:62px}
.fls-owner-wrap{flex:1;min-width:110px}
.fls-op-pill{font-size:.72rem;font-weight:700;color:#496674;background:rgba(47,79,58,.08);border-radius:999px;padding:3px 8px;white-space:nowrap;flex-shrink:0;max-width:120px;overflow:hidden;text-overflow:ellipsis}
.fls-row-chips{display:flex;gap:5px;flex-shrink:0}
.fls-row-acts{display:flex;gap:5px;flex-shrink:0}
.fls-inc-pill{font-size:.72rem;font-weight:800;color:#a05000;background:rgba(160,80,0,.10);border:1px solid rgba(160,80,0,.20);border-radius:999px;padding:3px 8px;white-space:nowrap;flex-shrink:0}
.fls-row-detail{padding:12px 16px 14px 78px;background:rgba(245,248,244,.7);border-top:1px solid rgba(47,79,58,.08);display:flex;flex-direction:column;gap:9px}
.fls-det-row{display:flex;align-items:center;gap:10px;font-size:.84rem;flex-wrap:wrap}
.fls-det-lbl{font-weight:800;color:#2a5a6a;min-width:72px;font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0}
.fls-det-val{display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap}
.fls-det-acts{display:flex;gap:5px}
.fls-det-acts-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px solid rgba(47,79,58,.08)}
/* ── Workflow groups (incidents) */
.wfg-list{display:flex;flex-direction:column;gap:10px}
.wfg-section{background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.14);border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.07)}
.wfg-hdr{width:100%;display:flex;align-items:center;gap:10px;padding:14px 18px;background:none;border:0;border-left:5px solid;cursor:pointer;text-align:left;transition:background .14s}
.wfg-hdr:hover{background:rgba(47,79,58,.03)}
.wfg-icon{font-size:1.15rem;flex-shrink:0;line-height:1}
.wfg-hdr-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.wfg-label{font-family:'Playfair Display',serif;font-size:.98rem;font-weight:900;color:#203f2b;line-height:1.2}
.wfg-sublabel{font-size:.72rem;color:#496674}
.wfg-badge{border-radius:999px;padding:4px 12px;font-size:.78rem;font-weight:900;flex-shrink:0}
.wfg-body{border-top:1px solid rgba(47,79,58,.08)}
.wfg-empty{padding:14px 18px;font-size:.84rem;color:#6a9a7a;font-weight:700}
.wfg-filters{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px;justify-content:space-between}
/* IRow apt context */
.ir-apt-context{display:flex;flex-direction:column;gap:2px}
.ir-apt-sub{font-size:.7rem;color:#6a8a9a;line-height:1.3}
@media(max-width:640px){.bld-door-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:12px}.bld-floor-hdr{padding:12px 14px;gap:10px}.bld-floor-num{font-size:1.3rem}.door-plate{width:46px;height:46px;font-size:.88rem}.fls-row-main{gap:7px;padding:10px 12px}.fls-row-detail{padding:10px 12px 12px}.fls-op-pill{display:none}.wfg-hdr{padding:12px 14px}}
@media(max-width:480px){.bld-door-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}}
/* ── Analytics date range controls ──────────────────────────────────────── */
.an-range-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:flex-end}
.an-mode-toggle{display:flex;border:1px solid rgba(47,79,58,.2);border-radius:10px;overflow:hidden;flex-shrink:0}
.an-mode-btn{padding:7px 14px;font-size:.78rem;font-weight:800;color:#496674;background:rgba(255,255,255,.7);border:0;cursor:pointer;transition:background .12s,color .12s;white-space:nowrap}
.an-mode-btn:hover{background:rgba(255,255,255,.95);color:#17313a}
.an-mode-on{background:#0b7f4f!important;color:#fff!important}
.an-preset-pills{display:flex;gap:5px;flex-wrap:wrap}
.an-preset-pill{padding:6px 13px;border-radius:999px;font-size:.78rem;font-weight:800;border:1px solid rgba(47,79,58,.18);background:rgba(255,255,255,.8);color:#496674;cursor:pointer;transition:all .12s;white-space:nowrap}
.an-preset-pill:hover{background:#fff;border-color:#0b7f8c;color:#0b5f72}
.an-preset-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 3px 10px rgba(11,127,140,.22)}
.an-custom-range{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
.an-date-group{display:flex;flex-direction:column;gap:4px}
.an-date-lbl{font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#2a5a6a}
.an-date-input{height:36px;border-radius:10px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.96)!important;color:#17313a!important;padding:0 10px!important;font-size:.84rem;cursor:pointer;min-width:140px}
.an-date-sep{font-size:1.1rem;color:#8a9fa5;font-weight:900;padding-bottom:4px;flex-shrink:0}
.an-window-desc{font-size:.72rem;font-weight:700;color:#496674;background:rgba(47,79,58,.07);border-radius:999px;padding:4px 12px;white-space:nowrap}
@media(max-width:640px){.an-range-bar{justify-content:flex-start}.an-custom-range{flex-direction:column;align-items:flex-start}.an-date-sep{display:none}}
/* ── My listings & incidents ─────────────────────────────────────────────── */
.ml-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
.ml-stat{background:rgba(255,255,255,.92);border:1px solid rgba(47,79,58,.14);border-radius:14px;padding:12px 10px;text-align:center;display:flex;flex-direction:column;gap:4px;box-shadow:0 4px 10px rgba(32,46,38,.06)}
.ml-stat-val{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:900;color:#203f2b;line-height:1}
.ml-stat-lbl{font-size:.68rem;font-weight:700;color:#496674}
.ml-stat-warn .ml-stat-val{color:#a05000}
.ml-stat-ver .ml-stat-val{color:#0b5f3a}
.ml-stat-res .ml-stat-val{color:#4a7060}
.ml-stat-active{border-color:rgba(11,127,140,.4)!important;box-shadow:0 0 0 2px rgba(11,127,140,.14),0 4px 10px rgba(32,46,38,.06)!important;background:rgba(11,127,140,.05)!important}
.ml-section{background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.14);border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(32,46,38,.07)}
.ml-section-hdr{padding:12px 16px;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#2a5a6a;background:linear-gradient(90deg,rgba(11,127,79,.06),rgba(11,127,140,.03));border-bottom:1px solid rgba(47,79,58,.1)}
.ml-listing{border-bottom:1px solid rgba(47,79,58,.07)}
.ml-listing:last-child{border-bottom:none}
.ml-listing-sel{background:rgba(11,127,140,.04)}
.ml-listing-row{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;flex-wrap:wrap;transition:background .12s}
.ml-listing-row:hover{background:rgba(11,127,140,.04)}
.ml-listing-apt{font-family:'Playfair Display',serif;font-weight:900;font-size:1rem;color:#203f2b;flex-shrink:0;min-width:64px}
.ml-listing-chips{display:flex;gap:5px;flex-shrink:0}
.ml-listing-inc-pills{display:flex;gap:5px;flex-wrap:wrap;flex-shrink:0}
.ml-listing-acts{display:flex;gap:5px;flex-shrink:0;margin-left:auto}
.ml-pill{border-radius:999px;padding:3px 9px;font-size:.7rem;font-weight:800;white-space:nowrap}
.ml-pill-open{background:rgba(160,80,0,.1);color:#a05000;border:1px solid rgba(160,80,0,.2)}
.ml-pill-ver{background:rgba(11,127,79,.08);color:#0b5f3a;border:1px solid rgba(11,127,79,.18)}
.ml-pill-res{background:rgba(100,150,120,.08);color:#4a7060;border:1px solid rgba(100,150,120,.18)}
.ml-pill-clear{background:rgba(31,160,100,.07);color:#1a7a50;border:1px solid rgba(31,160,100,.16)}
@media(max-width:640px){.ml-stats{grid-template-columns:repeat(3,1fr)}.ml-listing-row{gap:7px;padding:10px 12px}.ml-listing-acts{margin-left:0;width:100%}}
@media(max-width:400px){.ml-stats{grid-template-columns:repeat(2,1fr)}}
/* ── Profile view ────────────────────────────────────────────────────────── */
.prof-card{max-width:640px;display:flex;flex-direction:column;gap:16px}
.prof-section{background:rgba(255,255,255,.94);border:1px solid rgba(47,79,58,.16);border-radius:18px;padding:20px 22px;box-shadow:0 8px 22px rgba(32,46,38,.08)}
.prof-section-hdr{font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#235f72;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(47,79,58,.10);display:flex;align-items:center;gap:6px}
.prof-ro-grid{display:flex;flex-direction:column;gap:9px}
.prof-ro-row{display:grid;grid-template-columns:160px 1fr;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(47,79,58,.06);font-size:.87rem}
.prof-ro-row:last-child{border-bottom:none}
.prof-ro-lbl{font-weight:700;color:#2a5a6a;font-size:.8rem}
.prof-ro-val{color:#17313a;word-break:break-all}
.prof-ro-val-hi{color:#0b7f4f;font-weight:800}
.prof-footer{padding-top:4px}
/* Registration profile box: slightly highlighted to distinguish from listing boxes */
.reg-profile-box{background:linear-gradient(135deg,rgba(11,127,79,.04),rgba(11,127,140,.03))!important;border-color:rgba(11,127,140,.22)!important}
@media(max-width:600px){.prof-ro-row{grid-template-columns:1fr;gap:2px}.prof-ro-lbl{font-size:.74rem;color:#5a8090}}

`;