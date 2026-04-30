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
    nav:{dashboard:"Dashboard",about:"Misión",listings:"Apartamentos",incidents:"Reportes",notifications:"Avisos",approvals:"Registros",admin:"Admin",analytics:"Analíticas",my:"Mis propiedades"},
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
    nav:{dashboard:"Dashboard",about:"Mission",listings:"Apartments",incidents:"Reports",notifications:"Alerts",approvals:"Registrations",admin:"Admin",analytics:"Analytics",my:"My listings"},
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
  "modal.verify.help": { es:"Confirma el nombre del huésped o huéspedes, ciudad y país. La respuesta del propietario es opcional.", en:"Confirm the guest name(s), city, and country. The owner response is optional." },
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
  "form.ownerResponse": { es:"💬 Respuesta del propietario", en:"💬 Owner response" },
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
  "roles.ownerAction2": { es:"Actualiza tus datos de contacto", en:"Update your contact details" },
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


const normalizePhoneForWhatsApp = (v='') => String(v || '').replace(/[^0-9]/g, '');
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

  const submitRegistration = async (listingsToRegister) => {
    setSyncing(true);
    try {
      const r = await api.post('/api/registrations', { userUid:user.uid, userName:user.name, userEmail:user.email, listings:listingsToRegister });
      setRegistration(r);
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
  const delegatePerms = previewPerms ? previewPerms.delegate : { ...DEFAULT_DELEGATE_PERMISSIONS, ...(adminInfo?.permissions?.delegate || {}) };
  const canSeeMenu = (id) => effectiveIsGlobalAdmin || id === 'dashboard' || !!menuPerms[id];
  const needsOwnerVerification = incidents.filter(i => i.status === "open" && myListingIds.has(i.aptId));
  const canResolveIncidentsNow = Boolean(effectiveIsGlobalAdmin || effectiveRole === 'standard_admin' || delegatePerms.canResolveIncidents);
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
    ...(isApproved && canSeeMenu('notifications') ? [{ id:"notifications", icon:"🔔", label:t.nav.notifications, badge: unreadNotifications }] : []),
    ...(canSeeMenu('about') ? [{ id:"about", icon:"🌊", label:t.nav.about }] : []),
    ...(isApproved ? [
      ...(effectiveCanManageRegistrations ? [{ id:"approvals", icon:"📝", label:t.nav.approvals, badge: pendingRegistrations.length }] : []),
      ...(effectiveIsGlobalAdmin ? [{ id:"admin", icon:"⚙️", label:t.nav.admin }] : []),
      ...((effectiveIsGlobalAdmin || (analyticsEnabledForAll && canSeeMenu('analytics'))) ? [{ id:"analytics", icon:"📈", label:t.nav.analytics }] : []),
      ...(canSeeMenu('my') ? [{ id:"my", icon:"🔑", label:t.nav.my, badge: myListings.length }] : [])
    ] : []),
  ];
  const primaryNavIds = new Set(["dashboard", "listings", "incidents", "notifications", "my"]);
  const primaryNav = NAV.filter(n => primaryNavIds.has(n.id));
  const moreNav = NAV.filter(n => !primaryNavIds.has(n.id));

  // ── CRUD ACTIONS ──
  const addListing = async (data) => {
    setSyncing(true);
    try {
      const newL = await api.post('/api/listings', { ...data, ownerUid: user.uid, owner: user.name });
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
            <LanguageSwitch lang={lang} setLang={setLang} compact />
            <div className="smart-dd" onClick={e=>e.stopPropagation()}>
              <button className={`icon-btn ${openDropdown==="smart"||view==="notifications"?"icon-active":""}`} onClick={()=>setOpenDropdown(openDropdown === "smart" ? null : "smart")} title={appText(lang,"smart.title")}>🔔{smartAlertCount>0 && <span className="icon-badge">{smartAlertCount}</span>}</button>
              <SmartNotificationsDropdown lang={lang} open={openDropdown === "smart"} alerts={smartAlerts} unread={unreadNotifications} onReadAll={markAllNotificationsRead} onOpenNotifications={()=>{setView('notifications');setOpenDropdown(null);}} />
            </div>
            <div className="sync-pill compact-sync">
              {syncing
                ? <><span className="sync-dot syncing"/>{lang === "en" ? "Saving..." : "Guardando..."}</>
                : <><span className="sync-dot synced"/>{lastSync ? `Sync ${lastSync.toLocaleTimeString(lang === "en" ? "en-US" : "es-CO",{hour:"2-digit",minute:"2-digit"})}` : (lang === "en" ? "Connected" : "Conectado")}</>
              }
            </div>
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
                  <button className="dd-item" onClick={()=>{setView('dashboard');setOpenDropdown(null);}}>{lang === "en" ? "👤 My profile" : "👤 Mi perfil"}</button>
                  <button className="dd-item" onClick={()=>{setView('my');setOpenDropdown(null);}}>🔑 {t.nav.my}</button>
                  {effectiveIsGlobalAdmin && <button className="dd-item" onClick={()=>{setView('admin');setOpenDropdown(null);}}>⚙️ {t.nav.admin}</button>}
                  {(effectiveIsGlobalAdmin || analyticsEnabledForAll) && <button className="dd-item" onClick={()=>{setView('analytics');setOpenDropdown(null);}}>📈 {t.nav.analytics}</button>}
                  <div className="profile-lang"><span>{lang === "en" ? "🌐 Language" : "🌐 Idioma"}</span><LanguageSwitch lang={lang} setLang={setLang} compact /></div>
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
        {view==="listings"  && <ListingsView lang={lang} listings={listings} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canEditGlobal={delegatePerms.canUpdateGlobalListings} canDeleteGlobal={delegatePerms.canDeleteGlobalListings} onAdd={()=>{ if(!user){login();return;} setModal({type:"addListing"}); }} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>{ if(!user){login();return;} setModal({type:"incident",data:{aptId:l.id}}); }} />}
        {view==="incidents" && <IncidentsView lang={lang} incidents={incidents} listings={listings} user={user} quickFilter={incidentQuickFilter} onQuickFilterApplied={()=>setIncidentQuickFilter(null)} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canUpdateGlobal={delegatePerms.canUpdateGlobalIncidents} canDeleteGlobal={delegatePerms.canDeleteGlobalIncidents} canResolveGlobal={canResolveIncidentsNow} onAdd={()=>{ if(!user){login();return;} setModal({type:"incident"}); }} onResolve={resolveIncident} onDelete={deleteIncident} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} />}
        {view==="notifications" && user && <NotificationsView lang={lang} notifications={notifications} incidents={incidents} listings={listings} contactProps={contactProps} onRead={markNotificationRead} onReadAll={markAllNotificationsRead} />}
        {view==="approvals" && user && effectiveCanManageRegistrations && <PendingApprovalsView lang={lang} pending={pendingRegistrations} onApprove={id=>reviewRegistrationAction(id,'approve')} onDecline={id=>reviewRegistrationAction(id,'decline')} active={activeRegistrations} />}
        {view==="analytics" && user && (effectiveIsGlobalAdmin || analyticsEnabledForAll) && <AnalyticsDashboard lang={lang} user={user} contactProps={contactProps} showToast={showToast} isGlobalAdmin={effectiveIsGlobalAdmin} />}
        {view==="admin" && user && (effectiveIsGlobalAdmin ? <ErrorBoundary section="admin" fallback={(err)=><AdminFallback lang={lang} error={err}/>}><AdminSettings config={adminInfo.config || {}} user={user} listings={listings} contactProps={contactProps} onSave={saveAdminConfig} showToast={showToast} lang={lang} /></ErrorBoundary> : <AdminAccessHelp user={user} adminInfo={adminInfo} lang={lang} />)}
        {view==="my" && user && <MyListings lang={lang} listings={myListings} incidents={incidents} user={user} contactProps={contactProps} onAdd={()=>setModal({type:"addListing"})} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>setModal({type:"incident",data:{aptId:l.id}})} />}
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
function SmartNotificationsDropdown({ lang="es-CO", open=false, alerts=[], unread=0, onReadAll=()=>{}, onOpenNotifications=()=>{} }) {
  if (!open) return null;
  return (
    <div className="smart-menu">
      <div className="smart-head">
        <div><strong>{appText(lang,"smart.title")}</strong><span>{appText(lang,"smart.subtitle")}</span></div>
        <em className="smart-live">{appText(lang,"smart.live")}</em>
      </div>
      {alerts.length === 0
        ? <div className="smart-empty"><span className="smart-empty-icon">✅</span><strong>{appText(lang,"smart.none")}</strong><span>{appText(lang,"smart.noneSub")}</span></div>
        : <div className="smart-list">
            {alerts.map(a => (
              <button key={a.id} className={`smart-item smart-${a.tone}`} onClick={a.action} title={a.msg}>
                <span className="smart-count" style={{background: SMART_TONE_COLOR[a.tone]||'#0b7f4f'}}>{a.count}</span>
                <span className="smart-icon" aria-hidden="true">{a.icon}</span>
                <span className="smart-copy">
                  <strong>{a.title}</strong>
                  <small>{a.msg}</small>
                </span>
                <span className="smart-arr" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
      }
      <div className="smart-foot">
        <button className="dd-item" onClick={onOpenNotifications}>🔔 {lang === "en" ? "Open alert history" : "Abrir historial de avisos"}</button>
        {unread > 0 && <button className="dd-item" onClick={onReadAll}>✅ {appText(lang,"smart.markAll")}</button>}
      </div>
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
  const makeBlank = () => ({ apt:'', tower:'KAI', rooms:'2', guests:4, operator:'', operatorEmail:'', operatorWhatsapp:'', contact:'', email:user?.email || '', airbnb:'' });
  const [items,setItems]=useState([makeBlank()]);
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
    const seen={};
    items.forEach((f,i)=>{
      const apt=String(f.apt||'').trim();
      if(!apt) e[`apt_${i}`]=appText(lang,'validation.aptRequired');
      else if(!/^[0-9]{3}$/.test(apt)) e[`apt_${i}`]=appText(lang,'validation.aptFormat');
      else if(seen[apt]) e[`apt_${i}`]=appText(lang,'validation.aptDuplicateLocal');
      seen[apt]=true;
      if(!String(f.rooms||'').trim()) e[`rooms_${i}`]=appText(lang,'validation.roomsRequired');
      if(!f.guests || Number(f.guests)<1) e[`guests_${i}`]=appText(lang,'validation.capacityRequired');
      if(String(f.operatorEmail||'').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.operatorEmail).trim())) e[`operatorEmail_${i}`]=appText(lang,'validation.operatorEmailInvalid');
      if(!String(f.contact||'').trim()) e[`contact_${i}`]=appText(lang,'validation.ownerWhatsappRequired');
      if(!String(f.email||'').trim()) e[`email_${i}`]=appText(lang,'validation.emailRequired');
      else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email).trim())) e[`email_${i}`]=appText(lang,'validation.emailInvalid');
      if(f.airbnb && !/^https?:\/\/.+/i.test(String(f.airbnb).trim())) e[`airbnb_${i}`]=appText(lang,'validation.urlInvalid');
    });
    setErrors(prev=>({...prev,...e})); return Object.keys({...errors,...e}).filter(k=>({...errors,...e})[k]).length===0;
  };
  const cls=(k)=>errors[k]?'field-error':'';
  return <div>
    <div className="form-alert">{appText(lang,'modal.listing.registrationHelp')}</div>
    {items.map((f,i)=><div key={i} className="reg-listing-box">
      <div className="card-hdr"><span className="card-title">🏠 {lang==='en'?'Listing':'Listing'} #{i+1}</span>{items.length>1&&<button className="bsm bs-del" onClick={()=>setItems(rows=>rows.filter((_,x)=>x!==i))}>Quitar</button>}</div>
      <div className="fg2">
        <div className="fg"><label>{appText(lang,"form.aptNumber")} <Tip text={tips.aptNumber}/></label><input className={cls(`apt_${i}`)} value={f.apt} onChange={e=>setVal(i,'apt',e.target.value)} onBlur={()=>checkApt(i)} placeholder="000"/>{checking[i]&&<span className="help-msg">{appText(lang,'validation.aptChecking')}</span>}{errors[`apt_${i}`]&&<span className="err-msg">{errors[`apt_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value="KAI" readOnly disabled className="locked-field"/></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={cls(`rooms_${i}`)} value={f.rooms} onChange={e=>setVal(i,'rooms',e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors[`rooms_${i}`]&&<span className="err-msg">{errors[`rooms_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={cls(`guests_${i}`)} type="number" value={f.guests} onChange={e=>setVal(i,'guests',parseInt(e.target.value)||'')} min={1}/>{errors[`guests_${i}`]&&<span className="err-msg">{errors[`guests_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} <Tip text={tips.operator}/></label><input className={cls(`operator_${i}`)} value={f.operator} onChange={e=>setVal(i,'operator',e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors[`operator_${i}`]&&<span className="err-msg">{errors[`operator_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} <Tip text={tips.operatorEmail}/></label><input className={cls(`operatorEmail_${i}`)} type="email" value={f.operatorEmail} onChange={e=>setVal(i,'operatorEmail',e.target.value)} placeholder="operador@email.com"/>{errors[`operatorEmail_${i}`]&&<span className="err-msg">{errors[`operatorEmail_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorWhatsappOptional")} <Tip text={tips.operatorWhatsapp}/></label><input className={cls(`operatorWhatsapp_${i}`)} value={f.operatorWhatsapp} onChange={e=>setVal(i,'operatorWhatsapp',e.target.value)} placeholder="+57 300 000 0000"/>{errors[`operatorWhatsapp_${i}`]&&<span className="err-msg">{errors[`operatorWhatsapp_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.ownerWhatsapp")} <Tip text={tips.ownerWhatsapp}/></label><input className={cls(`contact_${i}`)} value={f.contact} onChange={e=>setVal(i,'contact',e.target.value)} placeholder="+57 300 000 0000"/>{errors[`contact_${i}`]&&<span className="err-msg">{errors[`contact_${i}`]}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.listingEmail")} <Tip text={tips.listingEmail}/></label><input className={cls(`email_${i}`)} type="email" value={f.email} onChange={e=>setVal(i,'email',e.target.value)} placeholder={user?.email || 'propietario@email.com'}/>{errors[`email_${i}`]&&<span className="err-msg">{errors[`email_${i}`]}</span>}<span className="help-msg">{appText(lang,"form.listingEmailHelp")}</span></div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} <span style={{color:"#70d6c6",fontStyle:"italic",textTransform:"none",letterSpacing:0,fontSize:"0.68rem"}}>({appText(lang,"form.optional")})</span></label><input className={cls(`airbnb_${i}`)} value={f.airbnb} onChange={e=>setVal(i,'airbnb',e.target.value)} placeholder="https://www.airbnb.com/rooms/..."/>{errors[`airbnb_${i}`]&&<span className="err-msg">{errors[`airbnb_${i}`]}</span>}</div>
      </div>
    </div>)}
    <div className="mact"><button className="btn-ghost" onClick={()=>setItems(rows=>[...rows, makeBlank()])}>{appText(lang,"form.addAnotherListing")}</button><button className="btn-p" onClick={()=>{ if(validate()) onSubmit(items.map(x=>({...x,apt:String(x.apt).trim(),tower:'KAI',email:String(x.email).trim(),contact:String(x.contact).trim(),operatorEmail:String(x.operatorEmail||'').trim(),operatorWhatsapp:String(x.operatorWhatsapp||'').trim(),airbnb:String(x.airbnb||'').trim()}))); }}>{submitText}</button></div>
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


function DashboardFocus({ lang="es-CO", effectiveIsGlobalAdmin=false, effectiveRole='user', delegatePerms={},
  pendingOwner=0, pendingResolve=0, pendingRegistrations=0, openCount=0,
  canResolve=false, canManageRegistrations=false,
  onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{}, onOpenClick=()=>{}, setView=()=>{} }) {
  const role = effectiveIsGlobalAdmin ? 'global' : effectiveRole === 'delegate_admin' ? 'delegate' : 'standard';
  const titleKey = role === 'global' ? 'roles.globalTitle' : role === 'delegate' ? 'roles.delegateTitle' : 'roles.standardTitle';
  const textKey  = role === 'global' ? 'roles.globalText'  : role === 'delegate' ? 'roles.delegateText'  : 'roles.standardText';
  const roleIcon = role === 'global' ? '🌐' : role === 'delegate' ? '🛡️' : '🏠';
  const actions = role === 'global'
    ? [{label:appText(lang,'roles.globalAction1'),   view:'analytics'}, {label:appText(lang,'roles.globalAction2'),   view:'admin'}]
    : role === 'delegate'
    ? [{label:appText(lang,'roles.delegateAction1'), view:'approvals'}, ...(delegatePerms.canResolveIncidents ? [{label:appText(lang,'roles.delegateAction2'), view:'incidents'}] : [])]
    : [{label:appText(lang,'roles.ownerAction1'),    view:'incidents'}, {label:appText(lang,'roles.ownerAction2'),    view:'my'}];
  const cards = [
    { id:'ownerVerification', icon:'✅', count:pendingOwner,       title:lang==='en'?'My verification':'Mi verificación',         sub:lang==='en'?'Open incidents requiring owner confirmation':'Incidentes abiertos que requieren confirmación del propietario', show:true,                   onClick:onOwnerClick,         accent:pendingOwner>0?'amber':null },
    { id:'requiresResolution',icon:'🛠️',count:pendingResolve,     title:lang==='en'?'Ready to resolve':'Listos para resolver',    sub:lang==='en'?'Owner-verified incidents pending resolution':'Incidentes verificados pendientes de resolución admin',            show:canResolve,             onClick:onResolveClick,       accent:pendingResolve>0?'green':null },
    { id:'registrations',     icon:'📝', count:pendingRegistrations,title:lang==='en'?'Registrations':'Registros',                sub:lang==='en'?'Pending registration requests':'Solicitudes pendientes de aprobación',                                             show:canManageRegistrations, onClick:onRegistrationsClick, accent:pendingRegistrations>0?'blue':null },
    { id:'incidents',         icon:'⚠️', count:openCount,           title:lang==='en'?'All open incidents':'Incidentes abiertos', sub:lang==='en'?'Community incidents still in progress':'Incidentes de la comunidad en progreso',                                   show:true,                   onClick:onOpenClick,          accent:null },
  ].filter(x=>x.show);
  return (
    <div className="dash-focus card">
      <div className="dash-focus-head">
        <div className="dash-focus-title">
          <strong>{roleIcon} {appText(lang, titleKey)}</strong>
          <p>{appText(lang, textKey)}</p>
        </div>
        <div className="dash-focus-actions">
          <span>{appText(lang,'roles.primaryActions')}:</span>
          {actions.map((a,i) => <button key={i} type="button" className="role-chip" onClick={()=>setView(a.view)}>{a.label}</button>)}
        </div>
      </div>
      <div className="dash-focus-grid">
        {cards.map(card => (
          <button key={card.id} type="button"
            className={`dash-focus-card${card.count>0?' dfc-active':''}${card.accent?' dfc-'+card.accent:''}`}
            onClick={card.onClick} title={card.sub}>
            <span className="dfc-icon">{card.icon}</span>
            <span className="dfc-copy"><strong>{card.title}</strong><small>{card.sub}</small></span>
            <span className="dfc-count">{card.count}</span>
          </button>
        ))}
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
  return (
    <div className="fade">
      <div className="ph"><div><h1 className="ptitle">{appText(lang,"dashboard.title")}</h1><p className="psub">{appText(lang,"dashboard.subtitle")}</p></div>{user&&<button className="btn-p btn-report" title={localizedTooltips({}, lang).reportIncident} onClick={onReport}>{appText(lang,"dashboard.reportIncident")}</button>}</div>
      <DashboardFocus lang={lang} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} effectiveRole={effectiveRole} delegatePerms={delegatePerms} pendingOwner={pendingOwner} pendingResolve={pendingResolve} pendingRegistrations={pendingRegistrations} openCount={open.length} canResolve={canResolve} canManageRegistrations={canManageRegistrations} onOwnerClick={onOwnerClick} onResolveClick={onResolveClick} onRegistrationsClick={onRegistrationsClick} onOpenClick={()=>setView('incidents')} setView={setView} />
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
          {[...listings].sort((a,b)=>a.apt.localeCompare(b.apt)).map(l=>(
            <div key={l.id} className="apt-row"><div className="ar-num">{appText(lang,"listing.apt")} {l.apt}</div><div className="ar-owner">{l.owner}</div><div className="ar-chips"><span className="chip c-teal">🛏️ {l.rooms}</span><span className="chip c-blue">👥 {l.guests}</span>{l.airbnb&&<a className="chip c-red" href={l.airbnb} target="_blank">Airbnb↗</a>}</div></div>
          ))}
        </div>
      </div>
      {showBlacklist&&naughty.length>0&&<div className="card ncard"><div className="card-hdr"><span className="card-title" style={{color:"#ff6b6b"}}>😈 {appText(lang,"dashboard.blacklist")}</span><button className="lnk" onClick={()=>setView("naughty")}>{appText(lang,"dashboard.view")}</button></div><div className="nrow">{naughty.slice(0,4).map(i=><div key={i.id} className="npill"><div style={{fontSize:"1.2rem"}}>😈</div><div><div className="np-name">{i.guestName}</div><div className="np-loc">📍 {i.guestCity}, {i.guestCountry}</div><div className="np-apt">{i.aptLabel}</div></div></div>)}</div></div>}
    </div>
  );
}

function MyListings({ listings, incidents, user, contactProps={}, onAdd, onEdit, onDelete, onReport, lang="es-CO" }) {
  const totalGuests=listings.reduce((a,l)=>a+(l.guests||0),0), myInc=incidents.filter(i=>listings.some(l=>l.id===i.aptId)), openC=myInc.filter(i=>i.status==="open").length;
  return (
    <div className="fade">
      <div className="ph"><div><h1 className="ptitle">{appText(lang,"my.title")}</h1><p className="psub">{user.name} · {listings.length} {appText(lang,"my.units")} · {totalGuests} {appText(lang,"my.guestsTotal")}</p></div><button className="btn-p" onClick={onAdd}>{appText(lang,"listings.add")}</button></div>
      <div className="owner-stats">{[{icon:"🏠",val:listings.length,label:appText(lang,"my.myApts"),color:"#2a9aaa"},{icon:"👥",val:totalGuests,label:appText(lang,"my.capacityShort"),color:"#c9a84c"},{icon:"⚠️",val:openC,label:appText(lang,"dashboard.openReports"),color:"#d4634a"},{icon:"🔗",val:listings.filter(l=>l.airbnb).length,label:appText(lang,"dashboard.onAirbnb"),color:"#FF5A5F"}].map((s,i)=><div key={i} className="scard" style={{borderTop:`3px solid ${s.color}`}}><div style={{fontSize:"1.4rem"}}>{s.icon}</div><div className="sval" style={{color:s.color}}>{s.val}</div><div className="slabel">{s.label}</div></div>)}</div>
      {listings.length===0?<EmptyState icon="🏠" title={appText(lang,"my.noApts")} sub={appText(lang,"my.addFirst")}/>:<div className="lg">{[...listings].sort((a,b)=>a.apt.localeCompare(b.apt)).map(l=><AptCard key={l.id} l={l} contactProps={contactProps} incCount={incidents.filter(i=>i.aptId===l.id&&i.status==="open").length} isOwner onEdit={()=>onEdit(l)} onDelete={()=>onDelete(l)} onReport={()=>onReport(l)} lang={lang}/>)}</div>}
      {myInc.length>0&&<div style={{marginTop:32}}><div className="section-label">{appText(lang,"filters.scopeMyIncidents")}</div>{[...myInc].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(i=><IRow key={i.id} inc={i} listings={listings} contactProps={contactProps} lang={lang}/>)}</div>}
    </div>
  );
}

function ListingsView({ listings, incidents, user, contactProps={}, isGlobalAdmin=false, canEditGlobal=false, canDeleteGlobal=false, onAdd, onEdit, onDelete, onReport, lang="es-CO" }) {
  const [search,setSearch]=useState("");
  const [scope,setScope]=useState("all");
  const scoped = scope === "mine" && user ? listings.filter(l=>l.ownerUid===user.uid) : listings;
  const filtered=scoped.filter(l=>String(l.apt||"").includes(search)||String(l.owner||"").toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="fade">
      <div className="ph"><div><h1 className="ptitle">{appText(lang,"listings.title")}</h1><p className="psub">{appText(lang,"listings.subtitle",{count:scoped.length})}</p></div>{user&&<button className="btn-p" onClick={onAdd}>{appText(lang,"listings.add")}</button>}</div>
      {user&&<div className="filter-row" style={{marginBottom:12}}><button className={`fchip ${scope==="all"?"fchip-on":""}`} onClick={()=>setScope("all")}>{appText(lang,"filters.scopeAll")}</button><button className={`fchip ${scope==="mine"?"fchip-on":""}`} onClick={()=>setScope("mine")}>{appText(lang,"filters.scopeMine")}</button></div>}
      <input className="search" placeholder={appText(lang,"listings.search")} value={search} onChange={e=>setSearch(e.target.value)}/>
      {filtered.length===0?<EmptyState icon="🏠" title={appText(lang,"listings.none")} sub={appText(lang,"listings.noResults")}/>:<div className="lg">{[...filtered].sort((a,b)=>String(a.apt||"").localeCompare(String(b.apt||""))).map(l=><AptCard key={l.id} l={l} contactProps={contactProps} incCount={incidents.filter(i=>i.aptId===l.id&&i.status==="open").length} canEdit={user?.uid===l.ownerUid || isGlobalAdmin || canEditGlobal} canDelete={user?.uid===l.ownerUid || isGlobalAdmin || canDeleteGlobal} onEdit={()=>onEdit(l)} onDelete={()=>onDelete(l)} onReport={()=>onReport(l)} showLogin={!user} lang={lang}/>)}</div>}
    </div>
  );
}

function AptCard({ l, incCount, contactProps={}, canEdit=false, canDelete=false, onEdit, onDelete, onReport, showLogin, lang="es-CO" }) {
  return (
    <div className="acard">
      <div className="acard-top">
        <div><div className="ac-num">{appText(lang,"listing.apt")} {l.apt}</div><div className="ac-owner"><UserContact name={l.owner} uid={l.ownerUid} email={l.email} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt, lang)]:[]} {...contactProps}/></div>{l.tower&&<div className="ac-tower">{appText(lang,"listing.tower")} {l.tower}</div>}</div>
        <div className={l.operator?"ac-op-badge":"ac-op-none"}>{l.operator?`⚙️ ${l.operator}`:(lang==="en"?"👤 Owner":"👤 Propietario")}</div>
        <div className="ac-wave">🌊</div>
      </div>
      <div className="acard-body">
        <div className="ac-chips"><span className="chip c-teal">🛏️ {l.rooms} {appText(lang,"listing.roomsShort")}.</span><span className="chip c-blue">👥 {l.guests} {appText(lang,"listing.guests")}</span>{l.contact&&<span className="chip c-gray">📞 {l.contact}</span>}{l.email&&<span className="chip c-gray">✉️ {l.email}</span>}{l.operatorEmail&&<span className="chip c-gray">✉️ {lang==="en"?"Op":"Op"}: {l.operatorEmail}</span>}{l.operatorWhatsapp&&<span className="chip c-gray">📲 Op: {l.operatorWhatsapp}</span>}</div>
        {l.airbnb?<a className="airbnb-lnk" href={l.airbnb} target="_blank">{appText(lang,"listings.viewAirbnb")}</a>:<div className="no-link">{appText(lang,"listings.noAirbnb")}</div>}
        <div className={`inc-b ${incCount>0?"ib-open":"ib-none"}`} onClick={onReport}>{incCount>0?(incCount>1?appText(lang,"listings.openReportPlural",{count:incCount}):appText(lang,"listings.openReportSingular",{count:incCount})):appText(lang,"listings.noOpenReports")}</div>
      </div>
      <div className="acard-foot">
        <button className="bsm bs-rep" title={localizedTooltips({}, lang).reportIncident} onClick={onReport}>{appText(lang,"reports.reportIncident")}</button>
        {canEdit&&<button className="bsm bs-edit" onClick={onEdit}>{lang==="en"?"✏️ Edit":"✏️ Editar"}</button>}{canDelete&&<button className="bsm bs-del" onClick={onDelete}>🗑️</button>}
        {showLogin&&<span className="lock-tag">{lang==="en"?"🔒 Sign in":"🔒 Inicia sesión"}</span>}
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

function IncidentsView({ incidents, listings, user, quickFilter=null, onQuickFilterApplied=()=>{}, contactProps={}, isGlobalAdmin=false, canUpdateGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, onAdd, onResolve, onDelete, onVerify, lang="es-CO" }) {
  const [sf,setSf]=useState("all"), [cf,setCf]=useState("all"), [scope,setScope]=useState("all");
  useEffect(()=>{
    if (quickFilter === "ownerVerification") { setScope("ownerVerification"); setSf("open"); setCf("all"); onQuickFilterApplied(); }
    if (quickFilter === "requiresResolution") { setScope("requiresResolution"); setSf("verified"); setCf("all"); onQuickFilterApplied(); }
    if (quickFilter === "seriousOpen") { setScope("all"); setSf("all"); setCf("serious"); onQuickFilterApplied(); }
  }, [quickFilter, onQuickFilterApplied]);
  const myListingIds = new Set((user ? listings.filter(l=>l.ownerUid===user.uid) : []).map(l=>l.id));
  let list=[...incidents];
  if(scope==="mine" && user) list=list.filter(i=>myListingIds.has(i.aptId) || i.reporterUid===user.uid);
  if(scope==="ownerVerification" && user) list=list.filter(i=>i.status==="open" && myListingIds.has(i.aptId));
  if(scope==="requiresResolution") list=list.filter(i=>i.status==="verified" && (isGlobalAdmin || canResolveGlobal));
  if(sf!=="all") list=list.filter(i=>i.status===sf);
  if(cf!=="all") list=list.filter(i=>i.category===cf);
  list.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return (
    <div className="fade">
      <div className="ph"><div><h1 className="ptitle">{appText(lang,"reports.title")}</h1><p className="psub">{appText(lang,"reports.subtitle",{total:list.length,open:list.filter(i=>i.status==="open").length})}</p></div>{user&&<button className="btn-p btn-report" title={localizedTooltips({}, lang).reportIncident} onClick={onAdd}>{appText(lang,"reports.reportIncident")}</button>}</div>
      <div className="workflow-card workflow-card-compact">
        <div className="wf-head">
          <div>
            <div className="wf-title">{appText(lang,"workflow.title")}</div>
            <div className="wf-subtitle">{lang==="en"?"Click a step to filter incidents below":"Haz clic en un paso para filtrar los incidentes abajo"}</div>
          </div>
        </div>
        <div className="wf-steps wf-steps-interactive" role="tablist" aria-label={appText(lang,"workflow.title")}>
          <button type="button" className={`wf-step wf-step-click ${sf==="open"?"wf-active":""}`} title={lang==="en"?"Show incidents reported by users that still need owner verification":"Mostrar incidentes reportados que todavía necesitan verificación del propietario"} onClick={()=>{setScope(user?"ownerVerification":"all"); setSf("open"); setCf("all");}}>
            <span className="wf-icon wf-open">⚠️</span>
            <span className="wf-copy"><strong>{appText(lang,"workflow.open")}</strong><small>{appText(lang,"workflow.openDesc")}</small></span>
            <span className="wf-tip">{lang==="en"?"Filters to open incidents needing owner verification":"Filtra incidentes abiertos pendientes de verificación"}</span>
          </button>
          <div className="wf-arrow wf-arrow-line">→</div>
          <button type="button" className={`wf-step wf-step-click ${sf==="verified"?"wf-active":""}`} title={lang==="en"?"Show verified incidents ready for admin resolution":"Mostrar incidentes verificados listos para resolución del administrador"} onClick={()=>{setScope((isGlobalAdmin || canResolveGlobal)?"requiresResolution":"all"); setSf("verified"); setCf("all");}}>
            <span className="wf-icon wf-verified">👤</span>
            <span className="wf-copy"><strong>{appText(lang,"workflow.verified")}</strong><small>{appText(lang,"workflow.verifiedDesc")}</small></span>
            <span className="wf-tip">{lang==="en"?"Filters to verified / ready to resolve incidents":"Filtra incidentes verificados / listos para resolver"}</span>
          </button>
          <div className="wf-arrow wf-arrow-line">→</div>
          <button type="button" className={`wf-step wf-step-click ${sf==="resolved"?"wf-active":""}`} title={lang==="en"?"Show incidents resolved by a Standard or Global Admin":"Mostrar incidentes resueltos por administrador estándar o global"} onClick={()=>{setScope("all"); setSf("resolved"); setCf("all");}}>
            <span className="wf-icon wf-resolved">✓</span>
            <span className="wf-copy"><strong>{appText(lang,"workflow.resolved")}</strong><small>{appText(lang,(isGlobalAdmin || canResolveGlobal) ? "workflow.resolvedDesc" : "workflow.resolvedDescGlobalOnly")}</small></span>
            <span className="wf-tip">{lang==="en"?"Filters to resolved incidents":"Filtra incidentes resueltos"}</span>
          </button>
        </div>
      </div>
      {user&&<div className="filter-row filter-scope" style={{marginBottom:10}}><button className={`fchip ${scope==="all"?"fchip-on":""}`} onClick={()=>setScope("all")}>{appText(lang,"filters.scopeAll")}</button><button className={`fchip ${scope==="mine"?"fchip-on":""}`} onClick={()=>setScope("mine")}>{appText(lang,"filters.scopeMyIncidents")}</button><button className={`fchip ${scope==="ownerVerification"?"fchip-on":""}`} onClick={()=>{setScope("ownerVerification");setSf("open");}}>{appText(lang,"actions.viewMine")}</button>{(isGlobalAdmin || canResolveGlobal)&&<button className={`fchip ${scope==="requiresResolution"?"fchip-on":""}`} onClick={()=>{setScope("requiresResolution");setSf("verified");}}>{appText(lang,"actions.viewReports")}</button>}</div>}
      <div className="filter-group"><div className="filter-label">{appText(lang,"filters.workflow")}</div><div className="filter-row">{["all","open","verified","resolved"].map(f=><button key={f} className={`fchip ${sf===f?"fchip-on":""}`} onClick={()=>setSf(f)}>{f==="all"?appText(lang,"reports.all"):f==="open"?appText(lang,"reports.open"):f==="verified"?appText(lang,"reports.verified"):appText(lang,"reports.resolved")}</button>)}</div></div>
      <div className="filter-group"><div className="filter-label">{appText(lang,"filters.category")}</div><div className="filter-row"><button className={`fchip ${cf==="all"?"fchip-on":""}`} onClick={()=>setCf("all")}>{appText(lang,"filters.categoryAll")}</button>{GUEST_CATEGORIES.map(c=><button key={c.value} className={`fchip ${cf===c.value?"fchip-on":""}`} onClick={()=>setCf(cf===c.value?"all":c.value)}>{c.icon} {categoryLabel(c.value,lang)}</button>)}</div></div>
      {list.length===0?<EmptyState icon="✅" title={appText(lang,"reports.none")} sub={appText(lang,"reports.noneFilter")}/>:list.map(i=><IRow key={i.id} inc={i} user={user} listings={listings} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canUpdateGlobal={canUpdateGlobal} canDeleteGlobal={canDeleteGlobal} canResolveGlobal={canResolveGlobal} onResolve={onResolve} onDelete={onDelete} onVerify={onVerify} lang={lang}/>) }
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

function NotificationsView({ notifications, incidents, listings=[], contactProps={}, onRead, onReadAll, lang="es-CO" }) {
  const unread = notifications.filter(n => !n.isRead).length;
  return (
    <div className="fade">
      <div className="ph"><div><h1 className="ptitle">{appText(lang,"notifications.title")}</h1><p className="psub">{appText(lang,"notifications.subtitle",{count:unread})}</p></div>{unread>0&&<button className="btn-p" onClick={onReadAll}>{appText(lang,"notifications.markAll")}</button>}</div>
      {notifications.length===0?<EmptyState icon="🔔" title={appText(lang,"notifications.none")} sub={appText(lang,"notifications.noneSub")}/>:
        <div className="notice-list">{notifications.map(n=>{ const inc=incidents.find(i=>i.id===n.incidentId); const nt=localizeNotification(n,lang); return (
          <div key={n.id} className={`notice-card ${n.isRead?'notice-read':'notice-new'}`}>
            <div className="notice-main">
              <div className="notice-title">{n.isRead?'🔔':'🆕'} {nt.title}</div>
              <div className="notice-msg">{nt.message}</div>
              <div className="notice-meta">{new Date(n.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO')} · {appText(lang,'common.email')}: {n.emailSent?(appText(lang,'common.sent')+' ✅'):(appText(lang,'common.notSent')+' ⚠️')}{n.emailError?` · ${n.emailError}`:''}</div>
              {inc&&<div className="notice-inc"><strong>{appText(lang,'notifications.detail')}:</strong> {inc.desc}</div>}
            </div>
            {!n.isRead&&<button className="bsm bs-resolve" onClick={()=>onRead(n.id)}>{appText(lang,"notifications.markRead")}</button>}
          </div>
        );})}</div>}
    </div>
  );
}

function IRow({ inc, user, listings=[], contactProps={}, isGlobalAdmin=false, canUpdateGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, onResolve, onDelete, onVerify, compact, naughtyMode, lang="es-CO" }) {
  const listing = listings.find(l=>l.id===inc.aptId);
  const isOwner = Boolean(user?.uid && listing?.ownerUid === user.uid);
  const guests = normalizeOwnerGuests(inc);
  const ti=INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6], ci=GUEST_CATEGORIES.find(c=>c.value===inc.category); const tiLabel=incidentTypeLabel(ti.value,lang), ciLabel=ci?categoryLabel(ci.value,lang):"";
  return (
    <div className={`irow ${(inc.status==="resolved"||inc.status==="verified")?"irow-res":""} ${naughtyMode?"irow-naughty":""}`}>
      <div className="ir-l"><div className="ir-apt">{inc.aptLabel}</div>{guests.length>0?<div className="ir-guest">👥 {guests.map(guestFullName).join(' · ')}</div>:<div className="ir-guest">👤 {inc.guestName || (lang==='en'?'Pending owner verification':'Pendiente por verificar')}</div>}{guests.length>0&&<div className="ir-loc">📍 {[...new Set(guests.map(guestLocation).filter(Boolean))].join(' · ')}</div>}{!guests.length&&inc.guestCity&&<div className="ir-loc">📍 {inc.guestCity}, {inc.guestCountry}</div>}<div className="ir-date">📅 {fmtDate(inc.date)}</div>{!compact&&<div className="ir-rep">{lang==="en"?"By":"Por"}: <UserContact name={inc.reporterName} uid={inc.reporterUid} {...contactProps}/></div>}</div>
      <div className="ir-c"><div className="ir-tags"><span className="ir-type" style={{background:ti.bg,color:ti.color}}>{tiLabel}</span>{ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color}}>{ci.icon} {ciLabel}</span>}<span className={`ir-status ${inc.status==="open"?"is-open":inc.status==="resolved"?"is-resolved":"is-verified"}`}>{inc.status==="open"?(lang==="en"?"⚠️ Open":"⚠️ Abierto"):inc.status==="verified"?(lang==="en"?"✅ Verified by owner":"✅ Verificado por propietario"):(lang==="en"?"🛠️ Resolved":"🛠️ Resuelto")}</span>{inc.slaCycleCount>0&&<span className="ir-cat" style={{background:"#fff3e0",color:"#e65100"}}>⏱️ SLA {inc.slaCycleCount}</span>}</div>{!compact&&<div className="ir-desc">{inc.desc}</div>}{guests.length>0&&<div className="ir-desc"><strong>{appText(lang,'form.guestDetails')}:</strong><div className="guest-display-list">{guests.map((g,idx)=><div key={idx}>👤 {guestFullName(g)}{guestLocation(g)?` · ${guestLocation(g)}`:''}</div>)}</div>{inc.ownerComments&&<div style={{marginTop:6}}><strong>{appText(lang,'form.ownerResponse')}:</strong> {inc.ownerComments}</div>}{inc.resolutionComments&&<div style={{marginTop:6}}><strong>{appText(lang,'form.resolutionComments')}:</strong> {inc.resolutionComments}</div>}</div>}</div>
      {!compact&&user&&<div className="ir-acts">{inc.status==="open"&&isOwner&&<button className="bsm bs-resolve" onClick={()=>onVerify(inc)}>{appText(lang,"reports.verify")}</button>}{inc.status==="verified"&&(isGlobalAdmin || canResolveGlobal)&&<button className="bsm bs-resolve" onClick={()=>onResolve(inc.id)}>{appText(lang,"reports.close")}</button>}{(inc.reporterUid===user.uid || isGlobalAdmin || canDeleteGlobal)&&<button className="bsm bs-del" onClick={()=>onDelete(inc.id)}>🗑️</button>}</div>}
    </div>
  );
}

// LoginModal replaced by Firebase signInWithPopup — no modal needed

function ListingModal({ title, user, initial={}, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
  const [f,setF]=useState({apt:"",rooms:"2",guests:4,operator:"",operatorEmail:"",operatorWhatsapp:"",contact:"",airbnb:"",...initial,tower:"KAI",email:initial.email || user?.email || ""});
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
    if(String(f.operatorEmail||"").trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.operatorEmail).trim())) e.operatorEmail=appText(lang,'validation.operatorEmailInvalid');
    if(!String(f.contact||"").trim()) e.contact=appText(lang,'validation.ownerWhatsappRequired');
    if(!String(f.email||"").trim()) e.email=appText(lang,'validation.emailRequired');
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email).trim())) e.email=appText(lang,'validation.emailInvalid');
    if(f.airbnb && !/^https?:\/\/.+/i.test(String(f.airbnb).trim())) e.airbnb=appText(lang,'validation.urlInvalid');
    setErrors(e);
    return Object.keys(e).length===0;
  };
  const inputCls=(k)=>errors[k]?"field-error":"";
  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">{title}</div><div className="modal-sub">{appText(lang,"modal.listing.ownerPrefix")}: {user?.name}</div>
      <div className="form-alert">{appText(lang,"modal.listing.requiredHelp")}</div>
      <div className="fg2">
        <div className="fg"><label>{appText(lang,"form.aptNumber")} <Tip text={tips.aptNumber}/></label><input className={inputCls("apt")} value={f.apt} onChange={e=>s("apt",e.target.value)} onBlur={checkApt} placeholder="000"/>{checkingApt&&<span className="help-msg">{appText(lang,'validation.aptChecking')}</span>}{errors.apt&&<span className="err-msg">{errors.apt}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value="KAI" readOnly disabled className="locked-field"/><span className="help-msg">{appText(lang,"form.towerHelp")}</span></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={inputCls("rooms")} value={f.rooms} onChange={e=>s("rooms",e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors.rooms&&<span className="err-msg">{errors.rooms}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={inputCls("guests")} type="number" value={f.guests} onChange={e=>s("guests",parseInt(e.target.value)||"")} min={1} max={20}/>{errors.guests&&<span className="err-msg">{errors.guests}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} <Tip text={tips.operator}/></label><input className={inputCls("operator")} value={f.operator} onChange={e=>s("operator",e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors.operator&&<span className="err-msg">{errors.operator}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} <Tip text={tips.operatorEmail}/></label><input className={inputCls("operatorEmail")} type="email" value={f.operatorEmail} onChange={e=>s("operatorEmail",e.target.value)} placeholder="operador@email.com"/>{errors.operatorEmail&&<span className="err-msg">{errors.operatorEmail}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorWhatsappOptional")} <Tip text={tips.operatorWhatsapp}/></label><input className={inputCls("operatorWhatsapp")} value={f.operatorWhatsapp} onChange={e=>s("operatorWhatsapp",e.target.value)} placeholder="+57 300 000 0000"/>{errors.operatorWhatsapp&&<span className="err-msg">{errors.operatorWhatsapp}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.ownerWhatsapp")} <Tip text={tips.ownerWhatsapp}/></label><input className={inputCls("contact")} value={f.contact} onChange={e=>s("contact",e.target.value)} placeholder="+57 300 000 0000"/>{errors.contact&&<span className="err-msg">{errors.contact}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.listingEmail")} <Tip text={tips.listingEmail}/></label><input className={inputCls("email")} type="email" value={f.email} onChange={e=>s("email",e.target.value)} placeholder={user?.email || appText(lang,"form.ownerEmailPlaceholder")}/>{errors.email&&<span className="err-msg">{errors.email}</span>}<span className="help-msg">{appText(lang,"form.listingEmailHelp")}</span></div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} <span style={{color:"#70d6c6",fontStyle:"italic",textTransform:"none",letterSpacing:0,fontSize:"0.68rem"}}>({appText(lang,"form.optional")})</span></label><input className={inputCls("airbnb")} value={f.airbnb} onChange={e=>s("airbnb",e.target.value)} placeholder="https://www.airbnb.com/rooms/..."/>{errors.airbnb&&<span className="err-msg">{errors.airbnb}</span>}</div>
      </div>
      <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" onClick={()=>{if(validate()) onSave({...f,apt:String(f.apt).trim(),tower:"KAI",operatorEmail:String(f.operatorEmail||"").trim(),operatorWhatsapp:String(f.operatorWhatsapp||"").trim(),contact:String(f.contact||"").trim(),email:String(f.email).trim(),airbnb:String(f.airbnb||"").trim()});}}>{appText(lang,"form.save")}</button></div>
    </Overlay>
  );
}

function IncidentModal({ listings, user, presetApt, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
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
  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">{appText(lang,"modal.report.title")}</div><div className="modal-sub">{appText(lang,"modal.report.sub",{name:user?.name||""})}</div>
      <div className="form-alert">{appText(lang,"modal.report.help")}</div>
      <div className="fg2">
        <div className="fg"><label>{appText(lang,"form.apartment")} <Tip text={tips.incidentApartment}/></label><select className={inputCls("aptId")} value={f.aptId} onChange={e=>s("aptId",e.target.value)}><option value="">{appText(lang,"form.select")}</option>{[...listings].sort((a,b)=>a.apt.localeCompare(b.apt)).map(l=><option key={l.id} value={l.id}>{aptDisplay(l.apt, lang)} – {l.owner}</option>)}</select>{errors.aptId&&<span className="err-msg">{errors.aptId}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.date")}</label><input className={inputCls("date")} type="date" value={f.date} onChange={e=>s("date",e.target.value)}/>{errors.date&&<span className="err-msg">{errors.date}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.type")} <Tip text={tips.incidentType}/></label><select className={inputCls("type")} value={f.type} onChange={e=>s("type",e.target.value)}>{INCIDENT_TYPES.map(t=><option key={t.value} value={t.value}>{incidentTypeLabel(t.value,lang)}</option>)}</select>{errors.type&&<span className="err-msg">{errors.type}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.category")} <Tip text={tips.incidentCategory}/></label><div className="csel">{GUEST_CATEGORIES.map(c=><button key={c.value} type="button" className={`copt ${f.category===c.value?"copt-on":""}`} style={f.category===c.value?{background:c.bg,color:c.color,borderColor:c.color}:{}} onClick={()=>s("category",c.value)}>{c.icon} {categoryLabel(c.value,lang)}</button>)}</div>{errors.category&&<span className="err-msg">{errors.category}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.description")} <Tip text={tips.incidentDescription}/></label><textarea className={inputCls("desc")} value={f.desc} onChange={e=>s("desc",e.target.value)} placeholder={appText(lang,"form.descriptionPlaceholder")} rows={4}/>{errors.desc&&<span className="err-msg">{errors.desc}</span>}</div>
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
    <div className="fg full"><label>{appText(lang,"form.ownerResponse")} * <Tip text={tips.verifyIncident}/></label><textarea className={errors.ownerComments?'field-error':''} value={ownerComments} onChange={e=>{setOwnerComments(e.target.value);setErrors(er=>({...er,ownerComments:undefined}));}} rows={3} placeholder={appText(lang,"form.optionalMessage")}/>{errors.ownerComments&&<span className="err-msg">{errors.ownerComments}</span>}</div>
    <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" title={tips.verifyIncident} onClick={()=>{ if(validate()) onSave({guests, ownerComments});}}>{appText(lang,"form.saveVerification")}</button></div>
  </Overlay>;
}


function AnalyticsDashboard({ user, contactProps={}, showToast=()=>{}, isGlobalAdmin=false, lang="es-CO" }) {
  const [days,setDays]=useState('90');
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const load=useCallback(()=>{
    if(!user?.uid) return;
    setLoading(true);
    api.get('/api/analytics?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '') + '&days=' + encodeURIComponent(days))
      .then(setData)
      .catch(e=>showToast((lang==='en'?'Error loading analytics: ':'Error cargando analíticas: ') + (e.message || ''), true))
      .finally(()=>setLoading(false));
  }, [user?.uid, user?.email, days]);
  useEffect(()=>{ load(); }, [load]);
  const s=data?.summary || {};
  const bar=(rows=[])=> rows.length ? <div className="bar-list">{rows.map(r=>{ const max=Math.max(...rows.map(x=>x.count||0),1); return <div key={r.name} className="bar-row"><div className="bar-label">{r.name}</div><div className="bar-track"><span style={{width:`${Math.max(6,(r.count/max)*100)}%`}}/></div><div className="bar-count">{r.count}</div></div>;})}</div> : <Empty icon="📭" msg={appText(lang,"analytics.noData")}/>;
  const fmt=(d)=>d?new Date(d).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO',{dateStyle:'medium',timeStyle:'short'}):'';
  return <div className="fade"><div className="ph"><div><h1 className="ptitle">{appText(lang,"analytics.title")}</h1><p className="psub">{isGlobalAdmin ? appText(lang,"analytics.subtitleAdmin") : appText(lang,"analytics.subtitleUser")} · {appText(lang,"analytics.subtitleRest")}</p></div><div style={{display:'flex',gap:8,alignItems:'center'}}><select className="lang-switch" value={days} onChange={e=>setDays(e.target.value)}><option value="30">{appText(lang,"analytics.days",{count:30})}</option><option value="90">{appText(lang,"analytics.days",{count:90})}</option><option value="180">{appText(lang,"analytics.days",{count:180})}</option><option value="365">{appText(lang,"analytics.days",{count:365})}</option></select><button className="btn-p" onClick={load}>{loading?appText(lang,'analytics.loading'):appText(lang,'analytics.refresh')}</button></div></div>
    <div className="stats6">{[
      ['⚠️',s.openIncidents||0,appText(lang,'analytics.open'),'#d4634a'],['🚨',s.breachedSla||0,appText(lang,'analytics.breached'),'#c62828'],['⏳',s.dueSoon24h||0,appText(lang,'analytics.dueSoon'),'#e19a4b'],['✅',s.verifiedIncidents||0,appText(lang,'analytics.verified'),'#2F8F46'],['⏱️',`${s.avgResponseHours||0}h`,appText(lang,'analytics.avgResponse'),'#0b7f8c'],['🔁',s.escalationCycles||0,appText(lang,'analytics.cycles'),'#6a1b9a']
    ].map((x,i)=><div className="scard" key={i} style={{borderTop:`3px solid ${x[3]}`}}><div style={{fontSize:'1.4rem'}}>{x[0]}</div><div className="sval" style={{color:x[3]}}>{x[1]}</div><div className="slabel">{x[2]}</div></div>)}</div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">{appText(lang,"analytics.breachedIncidents")}</div><div className="psub">{appText(lang,"analytics.breachedSub")}</div></div></div>{(data?.breachRows||[]).length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>{appText(lang,"analytics.table.apt")}</th><th>{appText(lang,"analytics.table.owner")}</th><th>{appText(lang,"analytics.table.operator")}</th><th>{appText(lang,"analytics.table.type")}</th><th>{appText(lang,"analytics.table.cycles")}</th><th>{appText(lang,"analytics.table.hoursOverdue")}</th><th>{appText(lang,"analytics.table.nextSla")}</th><th>{appText(lang,"analytics.table.desc")}</th></tr></thead><tbody>{data.breachRows.map(r=><tr key={r.id}><td><strong>{r.apt}</strong></td><td><UserContact name={r.owner} email={r.ownerEmail} apartments={r.apt?[aptDisplay(r.apt, lang)]:[]} {...contactProps}/><br/><small>{r.ownerEmail}</small></td><td><UserContact name={r.operator || (lang==='en'?'No operator':'Sin operador')} email={r.operatorEmail} apartments={r.apt?[aptDisplay(r.apt, lang)]:[]} {...contactProps}/><br/><small>{r.operatorEmail}</small></td><td>{r.type}<br/><small>{r.category}</small></td><td>{r.slaCycleCount}</td><td><strong style={{color:'#c62828'}}>{r.hoursOverdue}h</strong></td><td>{fmt(r.nextSlaReminderAt)}</td><td>{String(r.description||'').slice(0,120)}</td></tr>)}</tbody></table></div> : <Empty icon="✅" msg={appText(lang,"analytics.noBreached")}/>}</div>
    <div className="analytics-grid"><div className="card"><div className="card-title">{appText(lang,"analytics.topApartments")}</div>{bar(data?.rankings?.byApartment||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.topOperators")}</div>{bar(data?.rankings?.byOperator||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byType")}</div>{bar(data?.rankings?.byType||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byCategory")}</div>{bar(data?.rankings?.byCategory||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byStatus")}</div>{bar(data?.rankings?.byStatus||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byMonth")}</div>{bar(data?.rankings?.byMonth||[])}</div></div>
  </div>;
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
  const [adminErrors,setAdminErrors]=useState([]);
  const [lastUiError,setLastUiError]=useState('');
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
  return <div className="fade"><div className="ph"><div><h1 className="ptitle">⚙️ {lt(lang,'Configuración global')}</h1><p className="psub">{lt(lang,'Solo administradores globales · SLA, copias, misión y plantillas de email')}</p></div></div>
    {(adminErrors.length > 0 || lastUiError) && <div className="card" style={{marginBottom:18,borderLeft:'4px solid #d4634a'}}><div className="card-title">🧪 {lt(lang,'Diagnóstico')}</div><p className="psub">{lt(lang,'Ver consola del navegador para más detalles.')}</p>{adminErrors.map((e,i)=><pre key={i} className="codebox" style={{whiteSpace:'pre-wrap',marginTop:8}}>{JSON.stringify(e,null,2)}</pre>)}{lastUiError && <><div className="section-label" style={{marginTop:12}}>{lt(lang,'Último error de interfaz')}</div><pre className="codebox" style={{whiteSpace:'pre-wrap'}}>{lastUiError}</pre></>}<button className="btn-ghost" onClick={clearSavedErrors}>{lt(lang,'Limpiar error guardado')}</button></div>}
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">⏱️ {lt(lang,'SLA y escalaciones')}</div><div className="psub">{lt(lang,'El recordatorio se repite cada ciclo hasta que el propietario verifique.')}</div></div></div><div className="fg2"><div className="fg"><label>⏱️ {lt(lang,'SLA en horas')}</label><input type="number" min="1" value={slaHours} onChange={e=>setSlaHours(e.target.value)}/><span className="help-msg">{lt(lang,'Default: 24 horas.')}</span></div><div className="fg full"><label>✉️ {lt(lang,'Emails en copia para escalaciones')}</label><input value={escalationCcEmails} onChange={e=>setEscalationCcEmails(e.target.value)} placeholder="admin1@email.com, admin2@email.com"/><span className="help-msg">{lt(lang,'Se copian en cada recordatorio SLA, además del propietario y operador.')}</span></div><div className="fg full"><label>📈 {lt(lang,'Visibilidad de analíticas')}</label><select value={analyticsEnabled ? "true" : "false"} onChange={e=>setAnalyticsEnabled(e.target.value === "true")}><option value="false">{lt(lang,'Solo administrador global')}</option><option value="true">{lt(lang,'Todos los usuarios aprobados')}</option></select><span className="help-msg">{lt(lang,'El administrador global puede activar o desactivar las analíticas para toda la comunidad.')}</span></div></div></div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">🌊 {lt(lang,'Misión y reglas de participación')}</div><div className="psub">{lt(lang,'Mantén Español Colombia como base. También puedes editar textos visibles en inglés cuando aplique.')}</div></div></div>
      <div className="fg2"><div className="fg full"><label>{lt(lang,'Título')}</label><textarea className="admin-textarea" rows={2} value={mission?.title||''} onChange={e=>setMissionField('title', e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Subtítulo')}</label><textarea className="admin-textarea" rows={2} value={mission?.subtitle||''} onChange={e=>setMissionField('subtitle', e.target.value)}/></div><div className="fg"><label>{lt(lang,'Etiqueta de sección')}</label><input value={mission?.sectionLabel||''} onChange={e=>setMissionField('sectionLabel', e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Encabezado principal')}</label><textarea className="admin-textarea" rows={2} value={mission?.heading||''} onChange={e=>setMissionField('heading', e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto principal')}</label><textarea rows={3} value={mission?.body||''} onChange={e=>setMissionField('body', e.target.value)}/></div></div>
      <div className="card-title" style={{margin:'16px 0 10px'}}>{lt(lang,'Tarjetas de propósito')}</div>{((mission&&mission.cards)||[]).map((c,i)=><div className="fg2" key={i} style={{borderTop:'1px solid rgba(90,105,80,.12)',paddingTop:12,marginTop:8}}><div className="fg"><label>{lt(lang,'Icono')}</label><input value={c?.icon||''} onChange={e=>setMissionCard(i,'icon',e.target.value)}/></div><div className="fg"><label>{lt(lang,'Título tarjeta')} {i+1}</label><textarea className="admin-textarea" rows={2} value={c?.title||''} onChange={e=>setMissionCard(i,'title',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto tarjeta')} {i+1}</label><textarea rows={2} value={c?.text||''} onChange={e=>setMissionCard(i,'text',e.target.value)}/></div></div>)}
      <div className="two-col" style={{marginTop:16}}><div><div className="fg"><label>{lt(lang,'Título reglas de participación')}</label><textarea className="admin-textarea" rows={2} value={mission?.participationTitle||''} onChange={e=>setMissionField('participationTitle', e.target.value)}/></div>{((mission&&mission.participationRules)||[]).map((r,i)=><div className="fg" key={i}><label>{lt(lang,'Regla')} {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionRule('participationRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeRule('participationRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addRule('participationRules')}>+ {lt(lang,'Agregar regla')}</button></div><div><div className="fg"><label>{lt(lang,'Título acceso y responsabilidad')}</label><textarea className="admin-textarea" rows={2} value={mission?.accessTitle||''} onChange={e=>setMissionField('accessTitle', e.target.value)}/></div>{((mission&&mission.accessRules)||[]).map((r,i)=><div className="fg" key={i}><label>{lt(lang,'Regla')} {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionRule('accessRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeRule('accessRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addRule('accessRules')}>+ {lt(lang,'Agregar regla')}</button></div></div>
      <div className="mact"><button className="btn-p" onClick={saveConfig}>💾 {lt(lang,'Guardar misión y configuración')}</button></div></div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">🧭 {lt(lang,'Permisos estándar de menú')}</div><div className="psub">{lt(lang,'Activa o desactiva qué menús ven los usuarios estándar. Dashboard siempre queda disponible.')}</div></div><button className="btn-ghost" onClick={saveStandardMenuPermissions}>💾 {lt(lang,'Guardar permisos de menú')}</button></div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.keys(DEFAULT_STANDARD_MENU_PERMISSIONS).map(k=><label key={k} className="chip c-gray" style={{cursor:'pointer'}}><input type="checkbox" checked={!!standardMenuPermissions[k]} disabled={k==='dashboard'} onChange={()=>toggleMenuPermission(k)} style={{marginRight:6}}/>{MENU_LABELS[k]?.[lang==='en'?'en':'es'] || k}</label>)}</div></div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">🛡️ {lt(lang,'Permisos predeterminados del delegado')}</div><div className="psub">{lt(lang,'Define qué permisos recibe un administrador delegado nuevo por defecto.')} {lt(lang,'Los permisos estándar siempre se heredan.')}</div></div><button className="btn-ghost" onClick={saveDefaultDelegatePermissions}>💾 {lt(lang,'Guardar permisos predeterminados')}</button></div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.keys(DEFAULT_DELEGATE_PERMISSIONS).map(k=><label key={k} className="chip c-gray" style={{cursor:'pointer'}}><input type="checkbox" checked={!!defaultDelegatePermissions[k]} onChange={()=>toggleDefaultDelegatePermission(k)} style={{marginRight:6}}/>{PERMISSION_LABELS[k]?.[lang==='en'?'en':'es'] || k}</label>)}</div></div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">👥 {lt(lang,'Roles y permisos de usuarios')}</div><div className="psub">{lt(lang,'Define global admins, delegates and standard users. Delegate admins inherit the global delegate permissions configured above.')}</div></div><button className="btn-ghost" onClick={loadUsers}>{usersLoading?lt(lang,'Cargando...'):lt(lang,'Actualizar')}</button></div>{users.length===0?<Empty icon="👥" msg={lt(lang,'No hay usuarios aprobados todavía.')}/>:<div className="table-wrap"><table className="admin-table"><thead><tr><th>{lt(lang,'Usuario')}</th><th>{lt(lang,'Email')}</th><th>{lt(lang,'Rol')}</th><th>{lt(lang,'Permisos del delegado')}</th><th>{lt(lang,'Acción')}</th></tr></thead><tbody>{users.map((u,idx)=><tr key={u.uid || u.email}><td><UserContact name={u.name || lt(lang,'Sin nombre')} email={u.email} uid={u.uid} {...contactProps}/></td><td><span className="copy-inline">{u.email}<button type="button" onClick={()=>copyText(u.email, showToast, lang)}>📋</button><button type="button" onClick={()=>contactProps.onEmail({name:u.name,email:u.email,apartments:(lookupContact(contactProps.directory,{uid:u.uid,email:u.email,name:u.name}).apartments||[])})}>✉️</button></span></td><td><select value={u.role || 'user'} disabled={u.envGlobal} onChange={e=>setUsers(prev=>prev.map((x,i)=>i===idx?{...x,role:e.target.value}:x))}><option value="user">{lt(lang,'Usuario estándar')}</option><option value="delegate_admin">{lt(lang,'Administrador delegado')}</option><option value="global_admin">{lt(lang,'Administrador global')}</option></select>{u.envGlobal&&<div className="help-msg">GLOBAL_ADMIN_EMAILS</div>}</td><td>{u.role === 'delegate_admin'
  ? <div style={{display:'flex',flexDirection:'column',gap:5}}>
      <small style={{color:'#496674',fontSize:'.69rem',fontStyle:'italic',marginBottom:2}}>{lang==='en'?'Global delegate permissions:':'Permisos globales del delegado:'}</small>
      {Object.keys(DEFAULT_DELEGATE_PERMISSIONS).map(k=>(
        <span key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:'.77rem',color:defaultDelegatePermissions[k]?'#087346':'#aabcb8'}}>
          {defaultDelegatePermissions[k]?'✅':'—'} {PERMISSION_LABELS[k]?.[lang==='en'?'en':'es']||k}
        </span>
      ))}
    </div>
  : <span className="help-msg">{u.role === 'global_admin' ? lt(lang,'Administrador global') : lt(lang,'Usuario estándar')}</span>
}</td><td><button className="bsm bs-edit" onClick={()=>saveUserPermissions(u)}>{lt(lang,'Actualizar rol/permisos')}</button></td></tr>)}</tbody></table></div>}</div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">💡 {appText(lang,'tooltips.adminTitle')}</div><div className="psub">{appText(lang,'tooltips.adminSub')}</div></div><button className="btn-ghost" onClick={saveTooltips}>💾 {appText(lang,'tooltips.save')}</button></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>{appText(lang,'tooltips.key')}</th><th>{appText(lang,'tooltips.spanish')}</th><th>{appText(lang,'tooltips.english')}</th></tr></thead><tbody>{Object.keys(DEFAULT_TOOLTIPS).map(k=><tr key={k}><td><code>{k}</code></td><td><textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEs[k]||''} onChange={e=>setTooltipsEs(v=>({...v,[k]:e.target.value}))}/></td><td><textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEn[k]||''} onChange={e=>setTooltipsEn(v=>({...v,[k]:e.target.value}))}/></td></tr>)}</tbody></table></div></div>
    <div className="card"><div className="card-hdr"><div><div className="card-title">📨 {lt(lang,'Plantillas de emails')}</div><div className="psub">{lt(lang,'Edita y guarda la versión en Español e Inglés por separado. El sistema envía según la preferencia del destinatario.')}</div></div>{tplLoading && <span className="sync-pill"><span className="spinner-sm"/> {lt(lang,'Cargando...')}</span>}</div>
      {templateEntries.length===0 ? <Empty icon="📨" msg={ui(lang,'templatesEmpty')}/> : <><div className="fg2"><div className="fg"><label>{lt(lang,'Idioma de plantilla')}</label><select value={templateLang} onChange={e=>setTemplateLang(e.target.value)}><option value="es-CO">{lt(lang,'Español')}</option><option value="en">{lt(lang,'Inglés')}</option></select></div><div className="fg"><label>{lt(lang,'Tipo de notificación')}</label><select value={selectedKey} onChange={e=>setSelectedTemplate(e.target.value)}>{templateEntries.map(([k,tpl])=><option key={k} value={k}>{tpl?.label || k}</option>)}</select></div><div className="fg full"><span className="help-msg">{lt(lang,'Variables disponibles')}: {selectedVars.map(v=>'{{'+v+'}}').join(', ')}</span></div><div className="fg full"><label>{lt(lang,'Asunto')}</label><input value={selected?.subject || ''} onChange={e=>updateTpl('subject', e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto plano')}</label><textarea rows={6} value={selected?.text || ''} onChange={e=>updateTpl('text', e.target.value)}/></div><div className="fg full"><label>{lt(lang,'HTML del email')}</label><textarea rows={10} value={selected?.html || ''} onChange={e=>updateTpl('html', e.target.value)}/><span className="help-msg">{lt(lang,'Conserva variables como href="{{incidentLink}}".')}</span></div></div><div className="mact"><button className="btn-p" onClick={saveTemplates}>💾 {lt(lang,'Guardar plantillas de email')}</button></div></>} </div>
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
.card,.workflow-card,.acard,.notice-card,.gate-card,.modal,.catcard,.ngcard,.reg-listing-box,.listing-detail-card{background:rgba(255,255,255,.94)!important;border-color:rgba(47,79,58,.22)!important;box-shadow:0 14px 38px rgba(32,46,38,.14)!important;}
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
*{box-sizing:border-box}body{margin:0;font-family:'DM Sans',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f3e9;color:var(--kai-ink)}button,input,select,textarea{font:inherit}.app-shell{min-height:100vh;padding-bottom:40px;background:linear-gradient(180deg,rgba(255,255,255,.88),rgba(245,239,225,.93)),url('/morros-kai.png') center top/cover fixed!important;color:var(--kai-ink)!important}.hdr{position:sticky!important;top:0!important;z-index:100000!important;background:rgba(255,255,255,.92)!important;backdrop-filter:blur(14px);border-bottom:1px solid rgba(47,79,58,.16);box-shadow:0 10px 28px rgba(32,46,38,.10);overflow:visible!important}.hdr-inner{min-height:62px;padding:8px 16px;display:flex;align-items:center;gap:12px;max-width:1440px;margin:0 auto;overflow:visible!important}.logo{display:flex;align-items:center;gap:10px;cursor:pointer;min-width:220px}.logo-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#e7fff7,#d8f2f5);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 8px 20px rgba(11,127,140,.13);color:#0b7f4f;font-family:'Playfair Display',serif;font-weight:900}.logo-k{font-size:1.22rem}.logo-wave{font-size:.7rem;position:absolute;right:7px;top:7px;color:#0b7f8c}.logo-title{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:900;color:#203f2b}.logo-sub{font-size:.76rem;color:#235f72}.nav{display:flex;align-items:center;gap:5px;flex:1;min-width:0;overflow:visible!important}.nb,.dd-item,.icon-btn,.profile-btn,.btn-google,.btn-p,.btn-ghost,.bsm,.fchip{border:1px solid rgba(47,79,58,.18);background:rgba(255,255,255,.84);color:#17313a;border-radius:12px;cursor:pointer;transition:.15s ease;text-decoration:none}.nb{padding:8px 10px;font-weight:800;white-space:nowrap;position:relative}.nb:hover,.dd-item:hover,.icon-btn:hover,.profile-btn:hover{background:#fff;box-shadow:0 8px 18px rgba(32,46,38,.10);transform:translateY(-1px)}.nb-active,.dd-active{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.nb-badge,.icon-badge,.mbn-badge{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:999px;background:#e94235;color:#fff;font-size:.68rem;font-weight:900;margin-left:6px;padding:0 5px}.nav-dd,.profile-dd{position:relative;overflow:visible!important}.nav-dd-menu,.profile-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:230px;background:rgba(255,255,255,.98);border:1px solid rgba(47,79,58,.18);border-radius:16px;padding:8px;box-shadow:0 24px 70px rgba(20,32,26,.25);z-index:1000000!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important;flex-direction:column;gap:4px}.dd-item{width:100%;text-align:left;padding:10px 12px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px}.dd-item.danger{color:#9d1f16;background:#fff5f3}.hdr-right{display:flex;align-items:center;gap:8px;margin-left:auto;overflow:visible!important}.lang-switch{height:38px;border-radius:12px;border:1px solid rgba(47,79,58,.18);background:#fff;color:#17313a;padding:0 9px;font-weight:800}.icon-btn,.profile-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;position:relative}.uavatar,.uavatar-img{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#a84cc1;color:#fff;font-weight:900;object-fit:cover}.profile-menu{right:0;min-width:285px}.profile-head{padding:10px 12px;border-bottom:1px solid rgba(47,79,58,.12);margin-bottom:5px;display:flex;flex-direction:column;gap:2px}.profile-head strong{color:#203f2b}.profile-head span,.profile-head small{font-size:.78rem;color:#235f72;word-break:break-word}.profile-lang{padding:10px 12px;display:flex;align-items:center;gap:8px;justify-content:space-between}.sync-pill{font-size:.76rem;color:#235f72;background:rgba(255,255,255,.72);border:1px solid rgba(47,79,58,.14);border-radius:999px;padding:8px 10px;white-space:nowrap}.sync-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}.synced{background:#1eaa64}.syncing{background:#d9b45a}.mob-nav{display:none}.main{max-width:1360px;margin:0 auto;padding:20px 24px 70px;position:relative;z-index:1}.card,.welcome-card,.role-guide,.notice-card,.gate-card{background:rgba(255,255,255,.94)!important;border:1px solid rgba(47,79,58,.18)!important;border-radius:22px!important;box-shadow:0 14px 40px rgba(32,46,38,.13)!important;padding:22px}.ptitle{font-family:'Playfair Display',serif;color:#203f2b!important;font-size:2rem;margin:0 0 8px;font-weight:900}.psub{color:#235f72!important;margin:0 0 14px;line-height:1.45}.ph{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.btn-p,.btn-report,.btn-action{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border:0!important;border-radius:16px!important;padding:11px 17px!important;font-weight:900!important;box-shadow:0 12px 26px rgba(11,127,140,.22)!important;cursor:pointer}.btn-ghost{background:rgba(255,255,255,.78)!important;color:#17313a!important;padding:10px 14px!important;font-weight:800!important}.btn-google{display:inline-flex;align-items:center;gap:9px;background:#fff!important;padding:12px 18px!important;font-weight:900!important}.stats6,.owner-stats,.mission-grid,.mission-grid-compact,.analytics-grid,.cat-stats,.reg-filter-grid{display:grid;gap:14px}.stats6{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))}.owner-stats{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.stat,.owner-stat,.acard,.catcard{background:rgba(255,255,255,.9)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:18px!important;padding:16px!important;box-shadow:0 10px 25px rgba(32,46,38,.08)!important}.stat-num,.ac-num,.ar-num{font-family:'Playfair Display',serif;font-size:1.55rem;font-weight:900;color:#203f2b}.stat-label,.ac-label{font-size:.78rem;color:#235f72;font-weight:800}.action-banner-wrap{position:relative!important;z-index:10!important;margin:12px auto 16px!important;max-width:1360px!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;gap:12px!important;padding:0 24px!important}.action-banner{background:rgba(255,255,255,.96)!important;border:1px solid rgba(47,79,58,.18)!important;border-left:6px solid var(--kai-ocean)!important;border-radius:18px!important;padding:14px 16px!important;box-shadow:0 12px 30px rgba(32,46,38,.12)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}.action-banner strong{color:#203f2b!important}.action-banner span{color:#235f72!important}.resolve-action{border-left-color:#2f8f46!important}.owner-action{border-left-color:#d9b45a!important}.fg,.fg2{display:grid;gap:10px}.fg2{grid-template-columns:repeat(2,minmax(0,1fr))}.fg label{font-size:.78rem;font-weight:900;color:#203f2b}.fg input,.fg select,.fg textarea,.search,.admin-textarea,.admin-tooltip-textarea{width:100%;border:1px solid rgba(47,79,58,.24)!important;border-radius:13px!important;background:rgba(255,255,255,.96)!important;color:#102f3a!important;padding:10px 12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}.fg textarea,.admin-textarea,.admin-tooltip-textarea{min-height:74px;resize:vertical;line-height:1.45}.admin-tooltip-textarea{min-height:92px}.irow{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:14px 16px!important;margin-bottom:10px!important;display:flex;gap:14px;box-shadow:0 8px 22px rgba(32,46,38,.08)!important}.ir-guest,.ir-desc,.ir-date,.ir-rep,.ir-loc{color:#173f4d!important}.ir-guest{font-weight:900}.ir-acts{display:flex;flex-direction:column;gap:6px}.bsm{padding:8px 10px!important;font-weight:900!important;border-radius:12px!important}.filter-row{display:flex;gap:8px;flex-wrap:wrap}.fchip{padding:9px 14px!important;border-radius:999px!important;font-weight:900!important}.fchip-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.workflow-card{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:20px!important;padding:14px 18px!important;box-shadow:0 12px 28px rgba(32,46,38,.10)!important;overflow:visible!important}.wf-steps{display:grid!important;grid-template-columns:1fr 26px 1fr 26px 1fr;align-items:center;gap:8px}.wf-step{min-height:72px!important;background:#fff!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:10px 12px!important}.wf-arrow{display:flex!important;justify-content:center;color:#2aa8ad;font-size:1.2rem}.wf-tip{z-index:1000001!important}.overlay{z-index:1000002!important}.modal{background:#fff!important}.toast{position:fixed;right:18px;bottom:18px;z-index:1000003;background:#17313a;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.25)}.empty{padding:30px;text-align:center;color:#235f72}.admin-table{width:100%;border-collapse:separate;border-spacing:0 8px}.admin-table th{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#203f2b;text-align:left}.admin-table td{background:rgba(255,255,255,.86);border-top:1px solid rgba(47,79,58,.12);border-bottom:1px solid rgba(47,79,58,.12);padding:10px;vertical-align:top}.admin-table td:first-child{border-left:1px solid rgba(47,79,58,.12);border-radius:12px 0 0 12px}.admin-table td:last-child{border-right:1px solid rgba(47,79,58,.12);border-radius:0 12px 12px 0}.nav-dd-menu,.profile-menu{position:fixed!important;top:64px!important;right:16px!important;max-height:calc(100vh - 78px)!important;overflow:auto!important}.nav-dd-menu{right:auto!important;left:320px!important}.profile-menu{right:16px!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important}.role-guide,.action-banner-wrap,.workflow-card,.card,.main{overflow:visible!important}.action-banner-wrap,.role-guide{z-index:5!important}.main{z-index:1!important}
@media(max-width:1000px){.logo{min-width:auto}.logo-title,.logo-sub,.compact-sync{display:none}.hdr-inner{padding:8px 10px}.nav{gap:3px}.nav .nb:nth-of-type(n+4){display:none}.nb{padding:7px 8px;font-size:.72rem}.nav-dd-menu{left:10px!important;right:10px!important;top:60px!important}.profile-menu{left:10px!important;right:10px!important;top:60px!important}.main{padding:16px 12px 60px}.action-banner-wrap{padding:0 12px!important;grid-template-columns:1fr!important}.wf-steps{grid-template-columns:1fr!important}.wf-arrow{display:none!important}.fg2{grid-template-columns:1fr}.ph{flex-direction:column}.irow{flex-direction:column}.ir-acts{flex-direction:row;flex-wrap:wrap}.stats6{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.hdr-inner{gap:6px}.logo-mark{width:34px;height:34px}.nav .nb:nth-of-type(n+3){display:none}.lang-switch{max-width:110px}.icon-btn,.profile-btn{width:34px;height:34px}.ptitle{font-size:1.55rem}.card,.welcome-card,.role-guide{padding:16px}.action-banner{flex-direction:column;align-items:flex-start!important}.stats6{grid-template-columns:1fr}.workflow-card{padding:12px!important}.wf-tip{left:8px!important;right:8px!important;transform:none!important;min-width:0!important}.wf-tip:after{left:22px!important}}

/* v62 responsive/device-aware layout patch */
:root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px)}
html{font-size:clamp(14px,1.1vw,16px);-webkit-text-size-adjust:100%}body{overflow-x:hidden}.app-shell{min-height:100svh;background-attachment:scroll!important}.hdr{top:0!important}.hdr-inner{width:100%;max-width:1440px}.main{width:100%;max-width:min(1360px,100%);padding-left:clamp(10px,2.5vw,24px)!important;padding-right:clamp(10px,2.5vw,24px)!important}.card,.welcome-card,.role-guide,.notice-card,.gate-card,.workflow-card{max-width:100%;overflow-wrap:anywhere}.ph{flex-wrap:wrap}.btn-p,.btn-report,.btn-action,.btn-ghost,.bsm,.fchip,.nb,.dd-item,.icon-btn,.profile-btn{min-height:44px;touch-action:manipulation}.nav{min-width:0;flex-wrap:nowrap}.nav .nb{max-width:160px;overflow:hidden;text-overflow:ellipsis}.hdr-right{flex-shrink:0}.sync-pill{max-width:190px;overflow:hidden;text-overflow:ellipsis}.stats6,.owner-stats,.analytics-grid,.cat-stats,.mission-grid,.mission-grid-compact,.reg-filter-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))!important}.action-banner-wrap{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))!important}.action-banner{min-width:0}.workflow-card-compact{padding:12px 14px!important;margin:10px 0 14px!important}.wf-steps{grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr)!important}.wf-step{min-width:0!important;min-height:62px!important}.wf-copy strong,.wf-copy small{white-space:normal!important}.filter-row{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;scrollbar-width:thin}.filter-row .fchip{flex:0 0 auto}.irow{min-width:0}.ir-l,.ir-c,.ir-acts{min-width:0}.admin-table{display:block;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}.admin-table textarea,.admin-table input,.admin-table select{min-width:260px;white-space:normal}.modal{width:min(94vw,560px)!important;max-height:min(90svh,900px)!important}.overlay{padding:max(12px,var(--safe-top)) 12px max(12px,var(--safe-bottom))!important}.nav-dd-menu,.profile-menu{position:fixed!important;z-index:2147483000!important;max-height:calc(100svh - 74px)!important;overflow:auto!important;-webkit-overflow-scrolling:touch}.toast{max-width:calc(100vw - 24px);right:12px!important;bottom:max(12px,var(--safe-bottom))!important}
@media (pointer:coarse){.wf-step:hover .wf-tip{display:none!important}.wf-step:focus .wf-tip,.wf-step:active .wf-tip{display:block!important}}
@media (max-width:1180px){.hdr-inner{gap:8px}.logo{min-width:0}.logo-sub{display:none}.nav .nb{font-size:.78rem;padding:8px 9px}.nav .nb:nth-of-type(n+5){display:none}.nav-dd-menu{left:auto!important;right:72px!important;top:62px!important}.profile-menu{right:10px!important;top:62px!important}.main{padding-top:14px!important}.workflow-card{padding:12px!important}.wf-step{padding:9px!important}.wf-copy small{font-size:.72rem!important}}
@media (max-width:820px){.hdr{position:sticky!important}.hdr-inner{min-height:58px}.logo-title{font-size:.92rem}.logo-sub,.sync-pill{display:none!important}.nav .nb:nth-of-type(n+3){display:none}.nav-dd-menu,.profile-menu{left:8px!important;right:8px!important;top:58px!important;width:auto!important;min-width:0!important}.main{padding:12px 10px 92px!important}.ptitle{font-size:clamp(1.45rem,7vw,2rem)!important}.psub{font-size:.92rem}.ph{display:block}.ph .btn-p,.ph .btn-report,.ph .btn-action{margin-top:10px;width:100%}.card,.welcome-card,.role-guide,.notice-card,.gate-card{border-radius:18px!important;padding:16px!important}.action-banner-wrap{padding:0 10px!important;margin:10px auto!important}.action-banner{align-items:stretch!important}.action-banner .btn-p,.action-banner .btn-action,.action-banner .btn-ghost{width:100%;text-align:center;justify-content:center}.wf-steps{grid-template-columns:1fr!important;gap:8px!important}.wf-arrow{display:none!important}.wf-step{display:flex!important;align-items:center!important;gap:10px!important;width:100%;text-align:left}.wf-icon{flex:0 0 auto}.wf-tip{position:fixed!important;left:10px!important;right:10px!important;top:auto!important;bottom:max(14px,var(--safe-bottom))!important;transform:none!important;min-width:0!important;max-width:none!important;z-index:2147483001!important}.wf-tip:after{display:none!important}.fg2,.listing-detail-grid{grid-template-columns:1fr!important}.irow{flex-direction:column!important}.ir-acts{flex-direction:row!important;flex-wrap:wrap!important}.ir-acts .bsm{flex:1 1 140px}.notice-card{flex-direction:column}.mission-grid,.mission-grid-compact{grid-template-columns:1fr!important}.gate-shell{padding:12px!important}.welcome-brand{align-items:flex-start}.welcome-logo{width:64px;height:64px}.modal{border-radius:18px!important;padding:18px!important}}
@media (max-width:520px){.hdr-inner{padding:7px 8px!important}.logo-mark{width:36px!important;height:36px!important;border-radius:12px}.logo-title{display:none!important}.nav{flex:0 1 auto}.nav .nb{display:none!important}.hdr-right{gap:5px}.lang-switch{width:74px!important;padding:0 4px!important}.icon-btn,.profile-btn{width:38px!important;height:38px!important}.uavatar,.uavatar-img{width:30px!important;height:30px!important}.main{padding-left:8px!important;padding-right:8px!important}.stats6,.owner-stats,.analytics-grid,.cat-stats,.reg-filter-grid{grid-template-columns:1fr!important}.stat,.owner-stat,.acard,.catcard{padding:13px!important}.filter-row{margin-left:-2px;margin-right:-2px}.fchip{padding:9px 12px!important}.btn-p,.btn-report,.btn-action,.btn-ghost{width:100%;justify-content:center}.admin-table td,.admin-table th{font-size:.82rem;padding:8px}.admin-table textarea,.admin-table input,.admin-table select{min-width:220px}.toast{left:10px!important;right:10px!important}.profile-head span,.profile-head small{font-size:.72rem}.profile-lang{flex-direction:column;align-items:stretch}.profile-lang select{width:100%}.empty{padding:22px 12px!important}}
@media (min-width:1181px){.nav-dd-menu{left:auto!important;right:360px!important}.profile-menu{right:16px!important}.wf-step:hover,.wf-step:focus{transform:translateY(-1px);box-shadow:0 14px 30px rgba(32,46,38,.14)!important}.filter-row{overflow:visible;flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}


/* v77 smart notifications – count-first layout, tone colours, no overflow */
.smart-dd{position:relative;display:inline-flex;z-index:2147482500}
.smart-menu{position:fixed;top:64px;right:80px;width:350px;max-height:calc(100svh - 80px);overflow-y:auto;background:rgba(255,255,255,.99);border:1px solid rgba(47,79,58,.18);border-radius:18px;box-shadow:0 24px 72px rgba(18,31,38,.3);padding:14px;z-index:2147483500!important;color:#17313a}
.smart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid rgba(47,79,58,.12);margin-bottom:10px}
.smart-head>div>strong{display:block;font-size:.9rem;font-weight:900;color:#17313a}
.smart-head>div>span{display:block;font-size:.72rem;color:#496674;line-height:1.35;margin-top:2px}
.smart-live{flex-shrink:0;font-style:normal;background:#e7f8f0;color:#087346;border:1px solid #bdebd5;border-radius:999px;padding:3px 9px;font-size:.67rem;font-weight:900;white-space:nowrap;margin-top:2px}
.smart-list{display:flex;flex-direction:column;gap:6px}
.smart-item{width:100%;display:flex!important;align-items:center!important;gap:8px!important;border:1px solid rgba(47,79,58,.10);background:#fff;border-radius:12px;padding:9px 10px;text-align:left;cursor:pointer;transition:transform .14s,box-shadow .14s;overflow:hidden}
.smart-item:hover,.smart-item:focus{transform:translateY(-1px);box-shadow:0 10px 26px rgba(32,46,38,.13)}
.smart-owner{border-left:3px solid #c49a14!important}
.smart-resolve{border-left:3px solid #d96c1a!important}
.smart-registration{border-left:3px solid #2f6fbf!important}
.smart-notice{border-left:3px solid #6b44b8!important}
.smart-serious{border-left:3px solid #c0281e!important;background:#fdf6f6!important}
.smart-count{width:32px;height:32px;border-radius:9px;color:#fff;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:.9rem;font-weight:900;flex-shrink:0;line-height:1}
.smart-icon{font-size:.95rem;flex-shrink:0;line-height:1;width:20px;text-align:center}
.smart-copy{flex:1;min-width:0;overflow:hidden}
.smart-copy strong{display:block;color:#17313a;font-size:.84rem;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25}
.smart-copy small{display:block;color:#496674;font-size:.71rem;line-height:1.3;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smart-arr{color:#b0bfba;font-size:1.15rem;flex-shrink:0;line-height:1}
.smart-empty{padding:18px 8px;text-align:center}
.smart-empty-icon{font-size:1.8rem;display:block;margin-bottom:6px}
.smart-empty strong{display:block;color:#17313a;font-size:.88rem;font-weight:900}
.smart-empty span{display:block;color:#496674;font-size:.76rem;margin-top:5px;line-height:1.4}
.smart-foot{display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(47,79,58,.12);margin-top:10px;padding-top:8px}
.smart-foot .dd-item{justify-content:center!important;background:#f7fbfa;border:1px solid rgba(47,79,58,.10);border-radius:10px;font-size:.82rem;min-height:40px}
.icon-badge{animation:smartPulse 1.8s infinite}
@keyframes smartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
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
.apt-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(47,79,58,.08);flex-wrap:wrap;min-width:0}
.apt-row:last-child{border-bottom:0}
.ar-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1;min-width:0}

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
.acard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.acard-body{margin-bottom:10px}
.acard-foot{display:flex;gap:8px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(47,79,58,.08)}
.ac-op-badge{font-size:.74rem;color:#235f72;background:rgba(11,127,140,.08);border:1px solid rgba(11,127,140,.14);border-radius:999px;padding:3px 9px;white-space:nowrap;flex-shrink:0}
.ac-op-none{font-size:.74rem;color:#8a9fa5;flex-shrink:0}
.ac-wave{font-size:1.2rem;opacity:.4;flex-shrink:0}
.ac-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
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

`;