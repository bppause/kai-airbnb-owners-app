import React, { useState, useEffect, useRef, useCallback, Component } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "firebase/auth";
import { APP_VERSION } from "./version.js";

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
const OWNER_COUNTRIES = [
  { name:'Colombia',    code:'+57'  },
  { name:'USA',         code:'+1'   },
  { name:'Venezuela',   code:'+58'  },
  { name:'Ecuador',     code:'+593' },
  { name:'Perú',        code:'+51'  },
  { name:'México',      code:'+52'  },
  { name:'Brasil',      code:'+55'  },
  { name:'España',      code:'+34'  },
  { name:'Argentina',   code:'+54'  },
  { name:'Chile',       code:'+56'  },
  { name:'Panamá',      code:'+507' },
  { name:'Costa Rica',  code:'+506' },
  { name:'Canadá',      code:'+1'   },
  { name:'UK',          code:'+44'  },
  { name:'Francia',     code:'+33'  },
  { name:'Alemania',    code:'+49'  },
  { name:'Italia',      code:'+39'  },
  { name:'Otro',        code:''     },
];
// Replace existing dial-code prefix with a new one, keeping the subscriber digits.
const applyDialCode = (current='', newCode='') => {
  const stripped = String(current || '').trim().replace(/^\+\d+\s*/, '');
  return newCode ? (newCode + (stripped ? ' ' + stripped : '')).trim() : stripped;
};
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
  dashboard:{es:'Dashboard',en:'Dashboard'}, listings:{es:'Inventario',en:'Inventory'}, incidents:{es:'Incidentes',en:'Incidents'}, notifications:{es:'Alertas',en:'Alerts'}, about:{es:'Misión',en:'Mission'}, my:{es:'Mis Unidades',en:'My Units'}, analytics:{es:'Analíticas',en:'Analytics'}
};
const TXT = {
  "es-CO": {
    appName:"Propietarios Airbnb KAI", location:"Serena del Mar · Cartagena 🇨🇴", loginTitle:"Bienvenido a la Comunidad Morros KAI",
    loginSub:"Propietarios Airbnb KAI · Serena del Mar · Cartagena 🇨🇴",
    loginHero:"Estamos construyendo una comunidad de propietarios comprometidos con la excelencia en la operación, el cuidado de nuestras propiedades y una mejor experiencia para nuestros huéspedes.",
    rulesTitle:"📌 Normas de uso de la comunidad", firstAccess:"⏳ Primer acceso:", firstAccessText:"al iniciar sesión por primera vez deberás registrar al menos una propiedad. Tu solicitud quedará pendiente de aprobación antes de acceder a la plataforma.",
    secure:"🔐 Para proteger la información de la comunidad, primero debes iniciar sesión con Google.", google:"Continuar con Google",
    nav:{dashboard:"Dashboard",about:"Misión",listings:"Inventario",incidents:"Incidentes",notifications:"Alertas",approvals:"Registros",admin:"Admin",analytics:"Analíticas",my:"Mis Unidades",help:"Ayuda"},
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
    nav:{dashboard:"Dashboard",about:"Mission",listings:"Inventory",incidents:"Incidents",notifications:"Alerts",approvals:"Registrations",admin:"Admin",analytics:"Analytics",my:"My Units",help:"Help"},
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

  "my.title": { es:"🏠 Mis Unidades", en:"🏠 My Units" },
  "my.units": { es:"unidades", en:"units" },
  "my.guestsTotal": { es:"huéspedes total", en:"total guests" },
  "my.addApt": { es:"＋ Agregar unidad", en:"＋ Add unit" },
  "my.myApts": { es:"Mis unidades", en:"My units" },
  "my.capacityShort": { es:"Cap. total", en:"Total cap." },
  "my.noApts": { es:"Sin unidades registradas", en:"No units registered" },
  "my.addFirst": { es:"Registra tu primera unidad en {complex}", en:"Register your first unit at {complex}" },

  "listings.title": { es:"🏢 Inventario de Unidades", en:"🏢 Unit Inventory" },
  "listings.subtitle": { es:"{complex} · {count} unidades registradas", en:"{complex} · {count} registered units" },
  "listings.add": { es:"＋ Agregar unidad", en:"＋ Add unit" },
  "listings.search": { es:"🔍 Buscar por número de apto o propietario...", en:"🔍 Search by apartment number or owner..." },
  "incidents.search": { es:"🔍 Buscar por apto, propietario, huésped, ciudad, país, tipo...", en:"🔍 Search by apartment, owner, guest, city, country, type..." },
  "listings.none": { es:"Sin apartamentos", en:"No apartments" },
  "listings.noResults": { es:"No hay resultados", en:"No results found" },
  "listings.noAirbnb": { es:"Sin enlace Airbnb", en:"No Airbnb link" },
  "listings.viewAirbnb": { es:"🔗 Ver en Airbnb ↗", en:"🔗 View on Airbnb ↗" },
  "listings.noOpenReports": { es:"✅ Sin reportes abiertos", en:"✅ No open reports" },
  "listings.openReportSingular": { es:"⚠️ {count} reporte abierto", en:"⚠️ {count} open report" },
  "listings.openReportPlural": { es:"⚠️ {count} reportes abiertos", en:"⚠️ {count} open reports" },
  "listing.apt": { es:"Apto.", en:"Apt." },
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

  "reports.title": { es:"📋 Incidentes", en:"📋 Incidents" },
  "reports.subtitle": { es:"Historial completo · {total} total · {open} activos", en:"Full history · {total} total · {open} active" },
  "reports.new": { es:"＋ Nuevo reporte", en:"＋ New report" },
  "reports.reportIncident": { es:"⚠️ Reportar incidente", en:"⚠️ File a report" },
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
  "smart.ownerTitle": { es:"Acción del propietario requerida", en:"Owner action required" },
  "smart.ownerMsg": { es:"{count} incidente(s) en tus unidades esperan tu confirmación y documentación de acción tomada.", en:"{count} incident(s) on your units need your confirmation and action documentation." },
  "smart.ownerResolutionTitle": { es:"Respuesta pendiente", en:"Resolution pending" },
  "smart.ownerResolutionMsg": { es:"{count} incidente(s) verificado(s) requieren tu respuesta antes de que administración pueda cerrarlos.", en:"{count} verified incident(s) require your resolution before management can close them." },
  "smart.resolveTitle": { es:"Listos para cierre administrativo", en:"Ready for management closure" },
  "smart.resolveMsg": { es:"{count} incidente(s) documentados por el propietario — listos para revisión y cierre por administración.", en:"{count} incident(s) documented by owner — ready for management review and closure." },
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
  "analytics.table.apt": { es:"Apto.", en:"Apt." },
  "analytics.table.owner": { es:"Propietario", en:"Owner" },
  "analytics.table.operator": { es:"Operador", en:"Operator" },
  "analytics.table.type": { es:"Tipo", en:"Type" },
  "analytics.table.cycles": { es:"Ciclos", en:"Cycles" },
  "analytics.table.hoursOverdue": { es:"Horas vencido", en:"Hours overdue" },
  "analytics.table.nextSla": { es:"Próximo SLA", en:"Next SLA" },
  "analytics.table.desc": { es:"Descripción", en:"Description" },

  "modal.report.title": { es:"📋 Registrar Incidente", en:"📋 File an Incident Report" },
  "modal.report.sub": { es:"Por: {name} · Registro formal de incidente · {complex}", en:"By: {name} · Formal incident record · {complex}" },
  "modal.report.help": { es:"Selecciona la unidad, fecha, categoría y usa una plantilla como punto de partida. El propietario confirmará los datos del huésped en el paso de verificación.", en:"Select the unit, date, category, and use a template as a starting point. The owner will confirm guest details in the verification step." },
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
  "modal.verify.title": { es:"✅ Paso 1 de 2 — Confirmar y documentar acción", en:"✅ Step 1 of 2 — Confirm & Document Action" },
  "modal.verify.sub": { es:"{apt} · Confirma los datos del huésped y documenta la acción que tomaste.", en:"{apt} · Confirm guest details and document the action you took." },
  "modal.verify.help": { es:"Esto es el Paso 1 de 2. Confirma los datos del huésped y describe la acción inmediata (requerida). Después del Paso 1, deberás agregar tu respuesta (Paso 2) para que el administrador pueda cerrar el incidente.", en:"This is Step 1 of 2. Confirm guest details and describe the immediate action taken (required). After Step 1, you will still need to add your resolution (Step 2) before the admin can close the incident." },
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
  "form.immediateAction": { es:"💡 Acción inmediata del propietario (requerida)", en:"💡 Owner immediate action (required)" },
  "form.immediateActionPlaceholder": { es:"¿Qué hiciste de inmediato ante este incidente? (ej: llamé al huésped, contacté al operador, presenté queja a Airbnb...)", en:"What did you do immediately about this incident? (e.g. called the guest, contacted the operator, filed an Airbnb complaint...)" },
  "form.ownerResolution": { es:"🔍 Tu respuesta", en:"🔍 Proposed resolution" },
  "form.ownerResolutionPlaceholder": { es:"Describe tu respuesta al incidente. Ej.: se trabajó directamente con el huésped, se coordinó con el operador o la administración del edificio, se involucró a Airbnb o las autoridades necesarias...", en:"Describe your resolution to this incident. E.g. worked directly with the guest, coordinated with the operator or building management, involved Airbnb or the necessary authorities..." },
  "form.addResolution": { es:"📝 Agregar respuesta", en:"📝 Add resolution" },
  "form.resolutionRequired": { es:"⚠️ Respuesta pendiente — el administrador no puede cerrar este incidente hasta que agregues tu respuesta.", en:"⚠️ Resolution pending — the admin cannot close this incident until you add your resolution." },
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
  "workflow.open": { es:"1. Verificar — Paso 1", en:"1. Verify — Step 1" },
  "workflow.openDesc": { es:"El propietario verifica y documenta la acción inmediata tomada", en:"Owner verifies and documents the immediate action taken" },
  "workflow.verified": { es:"2. En Progreso", en:"2. In Progress" },
  "workflow.verifiedDesc": { es:"Paso 1 completo. Propietario agrega respuesta (Paso 2) para que el admin pueda cerrar", en:"Step 1 complete. Owner adds resolution (Step 2) so admin can close" },
  "workflow.resolved": { es:"3. Cerrado", en:"3. Closed" },
  "workflow.resolvedDesc": { es:"Admin cierra una vez que el propietario agregó su respuesta en el Paso 2", en:"Admin closes once owner has added their resolution in Step 2" },
  "workflow.resolvedDescGlobalOnly": { es:"Admin global cierra una vez que el propietario agregó su respuesta", en:"Global admin closes once owner has added their resolution" },
  "filters.workflow": { es:"Estado del flujo", en:"Workflow status" },
  "filters.category": { es:"Tipo de seguimiento", en:"Tracking category" },
  "filters.categoryAll": { es:"Todas las categorías", en:"All categories" },
  "modal.listing.addTitle": { es:"＋ Agregar unidad", en:"＋ Add unit" },
  "modal.listing.editTitle": { es:"✏️ Editar unidad", en:"✏️ Edit unit" },
  "modal.listing.ownerPrefix": { es:"Propietario", en:"Owner" },
  "modal.listing.requiredHelp": { es:"Los campos marcados con * son requeridos. Torre {tower} es fija y no se puede cambiar. Operador, email operador y WhatsApp operador son opcionales.", en:"Fields marked with * are required. Tower {tower} is fixed and cannot be changed. Operator, operator email, and operator WhatsApp are optional." },
  "modal.listing.registrationHelp": { es:"Debes incluir al menos un listing. Torre {tower} es fija. Airbnb URL, operador, email operador y WhatsApp operador son opcionales. El email del listing se llena con tu Google email, pero puedes cambiarlo.", en:"You must include at least one listing. Tower {tower} is fixed. Airbnb URL, operator, operator email, and operator WhatsApp are optional. Listing email defaults to your Google email, but you can change it." },
  "form.aptNumber": { es:"🚪 Número de unidad *", en:"🚪 Unit number *" },
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
  "roles.standardText": { es:"Mantén tus unidades actualizadas, revisa avisos y gestiona incidentes en 2 pasos: Paso 1 verificar + documentar acción, Paso 2 agregar respuesta para que el admin pueda cerrar.", en:"Keep your units current, review alerts, and manage incidents in 2 steps: Step 1 verify + document action, Step 2 add resolution so admin can close." },
  "roles.delegateTitle": { es:"Tu enfoque como admin delegado", en:"Your focus as delegate admin" },
  "roles.delegateText": { es:"Además de tus permisos estándar, puedes revisar registros pendientes y resolver incidentes cuando el permiso esté activo.", en:"In addition to standard permissions, you can review pending registrations and resolve incidents when that permission is enabled." },
  "roles.globalTitle": { es:"Tu enfoque como admin global", en:"Your focus as global admin" },
  "roles.globalText": { es:"Gobierna la comunidad: usuarios, permisos, SLA, plantillas, misión, reportes y calidad de datos.", en:"Govern the community: users, permissions, SLA, templates, mission, reports, and data quality." },
  "roles.primaryActions": { es:"Acciones recomendadas", en:"Recommended actions" },
  "roles.ownerAction1": { es:"Verificar + agregar respuesta", en:"Verify + add resolution" },
  "roles.ownerAction2": { es:"Mis unidades", en:"My units" },
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
  "tooltip.addListing": { es:"Registra una unidad que te pertenece en {complex}. El número debe ser único y quedará asociado a tu cuenta Google.", en:"Register a unit you own at {complex}. The number must be unique and will be linked to your Google account." },
  "tooltip.aptNumber": { es:"Ingresa 3 dígitos (ej: 705). Solo un propietario puede registrar cada unidad.", en:"Enter 3 digits (e.g. 705). Each unit can only be registered to one owner." },
  "tooltip.listingEmail": { es:"Email que recibirá notificaciones del listing. Si queda igual, usa tu email de Google.", en:"Email that receives listing notifications. If unchanged, it uses your Google email." },
  "tooltip.ownerWhatsapp": { es:"WhatsApp del propietario para contacto operativo.", en:"Owner WhatsApp for operational contact." },
  "tooltip.operator": { es:"Operador del apartamento. Opcional.", en:"Apartment operator. Optional." },
  "tooltip.operatorEmail": { es:"Email del operador para incidentes y recordatorios SLA. Opcional.", en:"Operator email for incidents and SLA reminders. Optional." },
  "tooltip.operatorWhatsapp": { es:"WhatsApp del operador. Opcional.", en:"Operator WhatsApp. Optional." },
  "tooltip.incidentApartment": { es:"Selecciona el apartamento donde ocurrió el incidente.", en:"Select the apartment where the incident happened." },
  "tooltip.incidentType": { es:"Clasifica la naturaleza del incidente: ruido, daños, normas, limpieza, etc.", en:"Classify the incident nature: noise, damage, rules, cleanliness, etc." },
  "tooltip.incidentCategory": { es:"Categoría de seguimiento: grave, en observación o menor. Sirve para filtrar y priorizar.", en:"Tracking category: serious, under watch, or minor. Used for filtering and prioritization." },
  "tooltip.incidentDescription": { es:"Describe los hechos de forma objetiva, clara y útil para el propietario.", en:"Describe the facts objectively, clearly, and usefully for the owner." },
  "tooltip.verifyIncident": { es:"Paso 1: El propietario verifica y documenta la acción inmediata tomada. Paso 2 (por separado): El propietario agrega su respuesta — requerida antes de que el admin pueda cerrar.", en:"Step 1: Owner verifies and documents immediate action taken. Step 2 (separate): Owner adds their resolution — required before admin can close." },
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

// Returns SLA urgency info for a step-2 pending resolution incident, or null if not applicable.
const slaResInfo = (inc) => {
  if (inc.status !== 'verified' || String(inc.ownerResolution||'').trim()) return null;
  const verifiedAt = inc.ownerVerifiedAt ? new Date(inc.ownerVerifiedAt) : null;
  if (!verifiedAt) return null;
  const slaHours = inc.slaHours || 24;
  const deadline = new Date(verifiedAt.getTime() + slaHours * 3600000);
  const now = new Date();
  const hoursLeft = Math.round((deadline - now) / 3600000);
  return {
    deadline,
    isBreached: hoursLeft < 0,
    hoursLeft,          // negative = overdue
    cycleCount: inc.slaCycleCount || 0,
    slaHours,
  };
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

// Module-level custom label overrides — populated from adminInfo.config on load
let _customLabels = { es: {}, en: {} };
// Phase 2: current community ID, synced from adminInfo after login
let _communityId = (() => { try { return localStorage.getItem('kai_community') || 'kai'; } catch(e) { return 'kai'; } })();
// Phase 3: community display name + tower, synced from adminInfo.config on load
let _complexName = { es:'Propietarios Airbnb KAI', en:'KAI Airbnb Owners', tower:'KAI' };
const setCustomLabels = (cfg={}) => {
  cfg = cfg || {};
  try { _customLabels.es = JSON.parse(cfg.ui_labels_es || '{}') || {}; } catch(e) { _customLabels.es = {}; }
  try { _customLabels.en = JSON.parse(cfg.ui_labels_en || '{}') || {}; } catch(e) { _customLabels.en = {}; }
  _complexName.es = cfg.complex_name_es || 'Propietarios Airbnb KAI';
  _complexName.en = cfg.complex_name_en || 'KAI Airbnb Owners';
  _complexName.tower = cfg.community_tower || 'KAI';
};
const getDefaultTower = () => _complexName.tower || 'KAI';
const appText = (lang, key, vars={}) => {
  const langKey = lang === 'en' ? 'en' : 'es';
  // Custom admin override takes priority over built-in defaults
  const custom = _customLabels[langKey]?.[key] ?? _customLabels['es']?.[key];
  const v = custom ?? (APP_I18N[key]?.[langKey]) ?? APP_I18N[key]?.es ?? key;
  // Auto-inject {complex} and {tower} from community config so i18n strings stay generic
  const merged = { complex: _complexName[langKey] || _complexName.es, tower: _complexName.tower, ...vars };
  return String(v).replace(/\{(\w+)\}/g, (_,k)=> merged[k] ?? '');
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
              <a href={`mailto:${finalEmail}`} className="contact-action-link" target="_blank" rel="noreferrer" title={lang==='en'?'Open in email app':'Abrir en app de email'}><IconEmail/> {lang==='en'?'Email':'Email'}</a>
            </span>
          )}
          {finalWhatsapp && (
            <span className="contact-line">
              <span className="contact-line-val">📲 {finalWhatsapp}</span>
              <button type="button" title={lang==='en'?'Copy number':'Copiar número'} onClick={() => copyText(finalWhatsapp, showToast, lang)}>📋</button>
              {waDigits && <a href={`https://wa.me/${waDigits}`} className="contact-action-link" target="_blank" rel="noreferrer" title={lang==='en'?'Open in WhatsApp':'Abrir en WhatsApp'}><IconWhatsApp/> WhatsApp</a>}
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

// Build timestamp injected by Vite at build time via vite.config.js define.__BUILD_TIME__
// Falls back gracefully if the constant isn't defined (e.g. older builds or test envs).
const BUILD_TIME = (() => {
  try {
    const iso = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
    if (!iso) return '';
    const d = new Date(iso);
    // Format: "Jan 1, 2026 · 07:48 PM UTC"
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  } catch(e) { return ''; }
})();

const fmtDate = d => { if(!d) return ""; const [y,m,day]=String(d).split("T")[0].split("-"); return `${parseInt(day)} ${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][parseInt(m)-1]} ${y}`; };
const fmtDateTime = (iso, lang='es-CO') => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(lang==='en'?'en-US':'es-CO',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch(e) { return String(iso).slice(0,16).replace('T',' '); }
};
const today = () => new Date().toISOString().split("T")[0];

// ─── PHOTO COMPRESSION — client-side, Canvas API ─────────────────────────────
// Resize to ≤900px, JPEG quality 0.65. Falls back to 0.38 if > 500 KB.
// Target: ≤400 KB per photo so 3 photos ≤ 1.2 MB base64 — safely under server 15 MB limit.
// Rejects if file > 10MB or not an image. Returns { data, name, size } where
// data is a data:image/jpeg;base64,… URI and size is compressed bytes.
const compressImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) { reject(new Error('Only image files (JPEG, PNG, WebP, HEIC) are allowed.')); return; }
  if (file.size > 10 * 1024 * 1024) { reject(new Error('Image too large — max 10 MB before compression.')); return; }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.onload = (e) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not decode image'));
    img.onload = () => {
      const MAX_PX = 900;
      let {width, height} = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
        else { width = Math.round(width * MAX_PX / height); height = MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      let dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      // If still > 500 KB (base64 ~667 KB string) after first pass, compress harder
      if (dataUrl.length > 667 * 1024) dataUrl = canvas.toDataURL('image/jpeg', 0.38);
      resolve({ data: dataUrl, name: file.name, size: Math.round(dataUrl.length * 0.75) });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// ─── API HELPERS (30s timeout handles Render cold starts) ────────────────────
const fetchT = (url, opts={}, ms=35000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  const headers = { ...(opts.headers||{}), 'X-Community-Id': _communityId };
  return fetch(url, { ...opts, headers, signal: ctrl.signal }).finally(() => clearTimeout(id));
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
  const [lang, setLangState] = useState(() => { let v = localStorage.getItem("kai_lang"); if (!v) { const bl = (navigator.language || navigator.userLanguage || 'es-CO').toLowerCase(); v = bl.startsWith('en') ? 'en' : 'es-CO'; localStorage.setItem("kai_lang", v); } document.documentElement.lang = v.startsWith('en') ? 'en' : 'es'; return v; });
  const t = getT(lang);
  const setLang = (next) => { const v = next === "en" ? "en" : "es-CO"; setLangState(v); localStorage.setItem("kai_lang", v); document.documentElement.lang = v.startsWith('en') ? 'en' : 'es'; if (user?.uid) api.put("/api/users/preference", { uid:user.uid, email:user.email, name:user.name, language:v }).catch(()=>{}); };
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
  const complexNameEs = adminInfo.config?.complex_name_es || 'Propietarios Airbnb KAI';
  const complexNameEn = adminInfo.config?.complex_name_en || 'KAI Airbnb Owners';
  const complexName = lang === 'en' ? complexNameEn : complexNameEs;
  const complexLocation = adminInfo.config?.complex_location || 'Serena del Mar · Cartagena 🇨🇴';
  const complexLogo = adminInfo.config?.complex_logo || '';
  const complexBg = adminInfo.config?.complex_bg ?? '/morros-kai-bg.jpg';
  const complexTower = adminInfo.config?.community_tower || 'KAI';
  const [previewRole, setPreviewRole] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const initialView = new URLSearchParams(window.location.search).get('view') || 'my';
  const [view,      setView]      = useState(initialView);
  // Apply role-based landing once admin config has fully loaded from server.
  // Must wait for adminLoading===false — without this guard the effect fires on the
  // initial render (config:{}) before the real config arrives, sets the ref, and the
  // actual nav_config landing is never applied.  Default is always 'my'.
  const _landingApplied = useRef(false);
  useEffect(() => {
    if (_landingApplied.current || !user || adminLoading) return;
    _landingApplied.current = true;
    if (new URLSearchParams(window.location.search).get('view')) return;
    try {
      const navCfg = JSON.parse(adminInfo?.config?.nav_config || '{}');
      const roleKey = effectiveIsGlobalAdmin ? 'global' : effectiveRole === 'delegate_admin' ? 'delegate' : 'user';
      // Explicit default of 'my' — admin can override per role via NavConfigEditor
      const landing = navCfg[roleKey]?.landing || 'my';
      setView(landing);
    } catch(e) { setView('my'); }
  }, [adminInfo, user, adminLoading]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [lastSync,  setLastSync]  = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast,     setToast]     = useState(null);
  const [modal,            setModal]            = useState(null);
  const [unitDetailOverlay, setUnitDetailOverlay] = useState(null); // { listingId, defaultStep? }
  const [incidentDetailOverlay, setIncidentDetailOverlay] = useState(null); // { incidentId }
  const openIncidentDetail = (incidentId) => setIncidentDetailOverlay({ incidentId });

  // ── Email deep-link: ?incident=inc_xxx opens the incident popup after data loads ──
  const _deepLinkApplied = useRef(false);
  useEffect(() => {
    if (_deepLinkApplied.current || loading || !incidents.length) return;
    const params = new URLSearchParams(window.location.search);
    const incId = params.get('incident');
    if (incId && incidents.find(i => i.id === incId)) {
      _deepLinkApplied.current = true;
      setView('incidents');
      // Small delay so the view renders before the overlay mounts
      setTimeout(() => openIncidentDetail(incId), 120);
    }
  }, [loading, incidents]);
  const [incidentQuickFilter, setIncidentQuickFilter] = useState(null);
  const [userProfile, setUserProfile] = useState({ whatsapp:'', country:'Colombia', notificationEmail:'' });
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
    if (!user?.uid) {
      setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
      setAdminLoading(false);
      setRegistration(null);
      setRegistrationLoading(false);
      return;
    }
    setAdminLoading(true);
    setRegistrationLoading(true);
    api.get('/api/admin/me?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '') + '&name=' + encodeURIComponent(user.name || '') + '&lang=' + encodeURIComponent(lang))
      .then(adminResponse => {
        const info = adminResponse || {role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}};
        setAdminInfo(info);
        if (info.config) setCustomLabels(info.config);
        // Confirm community from server before checking registration
        if (info.communityId) { _communityId = info.communityId; try { localStorage.setItem('kai_community', info.communityId); } catch(e) {} }
        if (info.languagePreference && info.languagePreference !== lang) {
          const pref = info.languagePreference === 'en' ? 'en' : 'es-CO';
          setLangState(pref);
          localStorage.setItem('kai_lang', pref);
        }
        // Chain registration check so it always uses the confirmed communityId
        return api.get('/api/registrations/status?uid=' + encodeURIComponent(user.uid));
      })
      .then(r => { if (r !== undefined) setRegistration(r || {status:'none'}); })
      .catch(e => {
        console.error('Login init error', e);
        setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
        setRegistration({status:'error', error:e.message});
      })
      .finally(() => { setAdminLoading(false); setRegistrationLoading(false); });
  }, [user?.uid, user?.email, user?.name]);

  // Load owner profile (whatsapp + country)
  useEffect(() => {
    if (!user?.uid) { setUserProfile({ whatsapp:'', country:'Colombia', notificationEmail:'' }); return; }
    api.get('/api/users/profile?uid=' + encodeURIComponent(user.uid))
      .then(p => setUserProfile({ whatsapp:p.whatsapp||'', country:p.country||'Colombia', notificationEmail:p.notificationEmail||'' }))
      .catch(() => {});
  }, [user?.uid]);

  const saveProfile = async (profileData) => {
    setSyncing(true);
    try {
      const result = await api.put('/api/users/profile', { uid:user.uid, email:user.email, whatsapp:profileData.whatsapp, country:profileData.country||'Colombia', notificationEmail:profileData.notificationEmail||'' });
      setUserProfile({ whatsapp:result.whatsapp||'', country:result.country||'Colombia', notificationEmail:result.notificationEmail||'' });
      // Also update cached contact info in listings for the current user
      const effectiveEmail = result.notificationEmail || user.email;
      setListings(ls => ls.map(l => l.ownerUid===user.uid ? {...l, contact:result.whatsapp||'', email:effectiveEmail} : l));
      showToast(lang==='en' ? '✅ Profile updated' : '✅ Perfil actualizado');
    } catch(e) {
      showToast((lang==='en' ? 'Could not save: ' : 'No se pudo guardar: ') + (e.message || ''), true);
    } finally { setSyncing(false); }
  };

  const switchCommunity = async (newCommunityId) => {
    if (!newCommunityId || newCommunityId === adminInfo.communityId) return;
    _communityId = newCommunityId;
    try { localStorage.setItem('kai_community', newCommunityId); } catch(e) {}
    setAdminLoading(true);
    setRegistrationLoading(true);
    setListings([]); setIncidents([]); setNotifications([]); setPendingRegistrations([]); setActiveRegistrations([]);
    try {
      const info = await api.get('/api/admin/me?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '') + '&name=' + encodeURIComponent(user.name || '') + '&lang=' + encodeURIComponent(lang));
      const adminData = info || {role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}};
      setAdminInfo(adminData);
      if (adminData.config) setCustomLabels(adminData.config);
      const reg = await api.get('/api/registrations/status?uid=' + encodeURIComponent(user.uid));
      setRegistration(reg || {status:'none'});
    } catch(e) {
      showToast((lang === 'en' ? 'Could not switch community: ' : 'Error al cambiar comunidad: ') + (e.message || ''), true);
    } finally {
      setAdminLoading(false);
      setRegistrationLoading(false);
    }
  };

  const submitRegistration = async ({ listings: listingsToRegister, profile = {} }) => {
    setSyncing(true);
    try {
      const r = await api.post('/api/registrations', { userUid:user.uid, userName:user.name, userEmail:user.email, listings:listingsToRegister, profileWhatsapp:profile.whatsapp||'', profileCountry:profile.country||'Colombia', language:lang });
      setRegistration(r);
      if (profile.whatsapp) setUserProfile({ whatsapp:profile.whatsapp, country:profile.country||'Colombia' });
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
  const handleLoginCommunitySelect = (communityId, cfg) => {
    if (!communityId) return;
    _communityId = communityId;
    try { localStorage.setItem('kai_community', communityId); } catch(e) {}
    if (cfg) setCustomLabels({
      complex_name_es: cfg.name, complex_name_en: cfg.name_en || cfg.name,
      complex_logo: cfg.logo_url, complex_bg: cfg.background_url,
      community_tower: cfg.tower,
    });
  };
  const logout = async () => {
    if (auth) await signOut(auth);
    try { localStorage.removeItem('kai_community'); } catch(e) {}
    _communityId = 'kai';
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
  // Step 2 for owners: verified but owner hasn't added their resolution yet
  const needsOwnerResolution   = incidents.filter(i => i.status === "verified" && !String(i.ownerResolution||'').trim() && myListingIds.has(i.aptId));
  const canResolveIncidentsNow = Boolean(effectiveIsGlobalAdmin || (effectiveRole === 'delegate_admin' && delegatePerms.canResolveIncidents));
  // Verified incidents where owner resolution is still missing (owner must act before admin can close)
  const ownerResolutionPending = incidents.filter(i => i.status === "verified" && !String(i.ownerResolution||'').trim() && myListingIds.has(i.aptId));
  // Verified incidents where owner has provided resolution — truly ready for admin to close
  const needsAdminResolution = incidents.filter(i => i.status === "verified" && String(i.ownerResolution||'').trim() && canResolveIncidentsNow);
  const openSeriousIncidents = incidents.filter(i => i.status !== "resolved" && ["serious","watch","under_watch"].includes(String(i.category || "")));
  const smartAlerts = [
    needsOwnerVerification.length ? { id:"ownerVerification", priority:1, icon:"✅", tone:"owner", title:appText(lang,"smart.ownerTitle"), msg:appText(lang,"smart.ownerMsg",{count:needsOwnerVerification.length}), count:needsOwnerVerification.length, action:()=>{setIncidentQuickFilter("ownerVerification");setView("incidents");setOpenDropdown(null);} } : null,
    ownerResolutionPending.length ? { id:"ownerResolution", priority:2, icon:"📝", tone:"owner", title:appText(lang,"smart.ownerResolutionTitle"), msg:appText(lang,"smart.ownerResolutionMsg",{count:ownerResolutionPending.length}), count:ownerResolutionPending.length, action:()=>{setIncidentQuickFilter("needsResolution");setView("incidents");setOpenDropdown(null);} } : null,
    needsAdminResolution.length ? { id:"readyResolve", priority:3, icon:"🛠️", tone:"resolve", title:appText(lang,"smart.resolveTitle"), msg:appText(lang,"smart.resolveMsg",{count:needsAdminResolution.length}), count:needsAdminResolution.length, action:()=>{setIncidentQuickFilter("requiresResolution");setView("incidents");setOpenDropdown(null);} } : null,
    effectiveCanManageRegistrations && pendingRegistrations.length ? { id:"registrations", priority:4, icon:"📝", tone:"registration", title:appText(lang,"smart.registrationTitle"), msg:appText(lang,"smart.registrationMsg",{count:pendingRegistrations.length}), count:pendingRegistrations.length, action:()=>{setView("approvals");setOpenDropdown(null);} } : null,
    unreadNotifications ? { id:"unread", priority:5, icon:"🔔", tone:"notice", title:appText(lang,"smart.unreadTitle"), msg:appText(lang,"smart.unreadMsg",{count:unreadNotifications}), count:unreadNotifications, action:()=>{setView("notifications");setOpenDropdown(null);} } : null,
    openSeriousIncidents.length ? { id:"serious", priority:6, icon:"🚨", tone:"serious", title:appText(lang,"smart.seriousTitle"), msg:appText(lang,"smart.seriousMsg",{count:openSeriousIncidents.length}), count:openSeriousIncidents.length, action:()=>{setIncidentQuickFilter("seriousOpen");setView("incidents");setOpenDropdown(null);} } : null,
  ].filter(Boolean).sort((a,b)=>a.priority-b.priority);
  const smartAlertCount = smartAlerts.reduce((sum,a)=>sum + Number(a.count || 0), 0);
  // All available nav items for the current user/role
  const allNavItems = [
    canSeeMenu('my') && isApproved         ? { id:'my',        icon:'🔑', label:t.nav.my,        badge:myListings.length } : null,
    canSeeMenu('incidents')                 ? { id:'incidents',  icon:'⚠️', label:t.nav.incidents,  badge:openCount } : null,
    canSeeMenu('listings')                  ? { id:'listings',   icon:'🏠', label:t.nav.listings } : null,
    canSeeMenu('dashboard')                 ? { id:'dashboard',  icon:'📊', label:t.nav.dashboard } : null,
    effectiveCanManageRegistrations && isApproved ? { id:'approvals', icon:'📝', label:t.nav.approvals, badge:pendingRegistrations.length } : null,
    (effectiveIsGlobalAdmin || adminInfo.role === 'delegate_admin' || adminInfo.isCommunityAdmin) && isApproved    ? { id:'admin',      icon:'⚙️', label:t.nav.admin } : null,
    (effectiveIsGlobalAdmin || (analyticsEnabledForAll && canSeeMenu('analytics'))) && isApproved ? { id:'analytics', icon:'📈', label:t.nav.analytics } : null,
  ].filter(Boolean);

  // Role-based nav config (from app_config.nav_config JSON)
  const _roleNavKey = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'user';
  const _navRoleCfg = (() => { try { return JSON.parse(adminInfo?.config?.nav_config||'{}')[_roleNavKey]||{}; } catch(e){return{};} })();
  const _configuredPrimary = _navRoleCfg.primary || ['my','incidents','listings','dashboard'];

  // Build NAV: primary items first (in config order), then remaining items
  const _navById = Object.fromEntries(allNavItems.map(n=>[n.id,n]));
  const NAV = [
    ..._configuredPrimary.filter(id=>_navById[id]).map(id=>_navById[id]),
    ...allNavItems.filter(n=>!_configuredPrimary.includes(n.id))
  ];
  const primaryNav = NAV.filter(n=>_configuredPrimary.includes(n.id));
  const moreNav    = NAV.filter(n=>!_configuredPrimary.includes(n.id));

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
      const apt = data.aptId ? listings.find(l => l.id === data.aptId) : null;
      const aptLabel = data.isGeneral ? '' : apt ? aptDisplay(apt.apt, lang) : '?';
      const newI = await api.post('/api/incidents', { ...data, reporterUid: user.uid, reporterName: user.name, aptLabel });
      setIncidents(i => [newI, ...i]);
      setModal(null);
      showToast(data.isGeneral ? (lang==='en'?'📢 General report submitted':'📢 Reporte general registrado') : '⚠️ Reporte registrado');
    } catch(e) {
      console.error('Save incident error', e);
      let errMsg;
      if (e.status === 413)
        errMsg = lang==='en'
          ? '⚠️ Photos are too large to upload. Try attaching fewer photos or using images with lower resolution.'
          : '⚠️ Las fotos son demasiado grandes para enviar. Intenta con menos fotos o imágenes de menor resolución.';
      else
        errMsg = (lang==='en' ? 'Error saving report: ' : 'Error al reportar: ') + (e.message && !e.message.startsWith('<') ? e.message : 'Revise Supabase/Render');
      showToast(errMsg, true);
    } finally { setSyncing(false); }
  };

  const assignIncident = async (incidentId, aptId) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${incidentId}/assign`, { actorUid:user.uid, actorEmail:user.email, aptId });
      setIncidents(i => i.map(x => x.id === incidentId ? updated : x));
      setModal(null); showToast(lang==='en'?'🏠 Incident assigned to unit':'🏠 Incidente asignado a unidad');
    } catch(e) { showToast('Error: ' + (e.message||''), true); } finally { setSyncing(false); }
  };

  const closeGeneralIncident = async (incidentId, { action, resolution, resolutionComments='' }) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${incidentId}/close-general`, { actorUid:user.uid, actorEmail:user.email, action, resolution, resolutionComments });
      setIncidents(i => i.map(x => x.id === incidentId ? updated : x));
      setModal(null); showToast(lang==='en'?'✓ General incident closed':'✓ Incidente general cerrado');
    } catch(e) { showToast('Error: ' + (e.message||''), true); } finally { setSyncing(false); }
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
      const updated = await api.patch(`/api/incidents/${id}/verify`, { ownerUid:user.uid, guests:payload.guests || [], ownerComments:payload.ownerComments || '', ownerResolution:payload.ownerResolution || '' });
      setIncidents(i => i.map(x => x.id === id ? updated : x));
      setModal(null); showToast('✅ Incidente verificado');
    } catch(e) { showToast('Error al verificar: ' + (e.message || 'Revise datos'), true); }
    finally { setSyncing(false); }
  };

  const addResolution = async (id, resolutionText) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${id}/add-resolution`, { ownerUid:user.uid, ownerResolution:resolutionText });
      setIncidents(i => i.map(x => x.id === id ? updated : x));
      setModal(null); showToast(lang==='en' ? '📝 Resolution saved — admin notified' : '📝 Respuesta guardada — admin notificado');
    } catch(e) { showToast('Error: ' + (e.message || ''), true); }
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
      const newConfig = r.config || {};
      setAdminInfo(a => ({...a, config: newConfig }));
      if (newConfig) setCustomLabels(newConfig);
      showToast('✅ Configuración guardada');
    } catch(e) { showToast('Error al guardar configuración: ' + (e.message || ''), true); }
    finally { setSyncing(false); }
  };

  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    const clientBuild = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
    if (!clientBuild) return;
    const check = () => api.get('/api/version').then(r => { if (r?.buildTime && r.buildTime !== clientBuild) setUpdateAvailable(true); }).catch(()=>{});
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (authLoading || (user && (adminLoading || registrationLoading)) || (isApproved && loading) || loadError) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#07141e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24}}>
      <style>{CSS}</style>
      <div className="logo-mark" style={{width:64,height:64}}>
        <span className="logo-k" style={{fontSize:"1.6rem"}}>K</span>
        <span className="logo-wave" style={{fontSize:"0.8rem"}}>~</span>
      </div>
      <div style={{textAlign:"center",maxWidth:320}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem",color:"#dff0f5",marginBottom:8}}>{complexName}</div>
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

  if (!user) return <AuthGate onLogin={login} lang={lang} setLang={setLang} complexLogo={complexLogo} complexNameEs={complexNameEs} complexNameEn={complexNameEn} complexLocation={complexLocation} complexBg={complexBg} onCommunitySelect={handleLoginCommunitySelect} />;
  if (!isApproved) return <RegistrationGate user={user} registration={registration} onSubmit={submitRegistration} onLogout={logout} syncing={syncing} toast={toast} lang={lang} setLang={setLang} complexLogo={complexLogo} complexName={complexName} complexLocation={complexLocation} complexBg={complexBg} />;

  return (
    <div className="app-shell">
      <style>{CSS}</style>

      {updateAvailable && (
        <div className="update-banner" role="alert">
          <span>🔄 {lang==='en' ? 'A new version is available.' : 'Hay una nueva versión disponible.'}</span>
          <button className="update-banner-btn" onClick={() => window.location.reload()}>
            {lang==='en' ? 'Reload' : 'Actualizar'}
          </button>
        </div>
      )}

      <header className="hdr">
        <div className="hdr-inner">
          <div className="logo" onClick={()=>setView("dashboard")}>
            {complexLogo
              ? <img src={complexLogo} className="hdr-logo-img" alt={complexName} title={`${complexNameEn} v${APP_VERSION} · BETA${BUILD_TIME ? '\nBuilt ' + BUILD_TIME : ''}`}/>
              : <div className="logo-mark" title={`${complexNameEn} v${APP_VERSION} · BETA${BUILD_TIME ? '\nBuilt ' + BUILD_TIME : ''}`}><span className="logo-k">K</span><span className="logo-wave">~</span></div>}
            <div>
              <div className="logo-title">{complexName}</div>
              <div className="logo-sub">{complexLocation} <span className="beta-badge">BETA</span></div>
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
            {user && (adminInfo.communities||[]).length > 1 && (
              <CommunitySwitch
                communities={adminInfo.communities}
                currentId={adminInfo.communityId || _communityId || ''}
                onChange={switchCommunity}
                lang={lang}
                loading={adminLoading}
              />
            )}
            <LanguageSwitch lang={lang} setLang={setLang} />
            {user ? (
              <div className="profile-dd" onClick={e=>e.stopPropagation()}>
                <button type="button" className="profile-btn" title={user.email} onClick={() => setOpenDropdown(openDropdown === "profile" ? null : "profile")}>
                  {user.photo ? <img src={user.photo} className="uavatar-img" alt={user.avatar} referrerPolicy="no-referrer"/> : <div className="uavatar">{user.avatar}</div>}
                </button>
                <div className={`profile-menu ${openDropdown === "profile" ? "menu-open" : ""}`}>
                  <div className="profile-head">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <small>{myListings.length ? `${myListings.length} ${lang === 'en' ? (myListings.length>1?'units':'unit') : ('unidad' + (myListings.length>1?'es':''))}` : (lang === "en" ? "Visitor" : "Visitante")}</small>
                    <span className={`profile-role-badge prb-${effectiveIsGlobalAdmin?'global':effectiveRole==='delegate_admin'?'delegate':adminInfo.isCommunityAdmin?'community':'user'}`}>{effectiveIsGlobalAdmin?(lang==='en'?'🌐 Global Admin':'🌐 Admin global'):effectiveRole==='delegate_admin'?(lang==='en'?'🛡️ Delegate Admin':'🛡️ Admin delegado'):adminInfo.isCommunityAdmin?(lang==='en'?'🏢 Community Admin':'🏢 Admin comunidad'):(lang==='en'?'🏠 Unit Owner':'🏠 Propietario')}</span>
                  </div>
                  <button className="dd-item" onClick={()=>{setView('profile');setOpenDropdown(null);}}>{lang === "en" ? "👤 My profile" : "👤 Mi perfil"}</button>
                  <button className="dd-item" onClick={()=>{setView('my');setOpenDropdown(null);}}>🏠 {t.nav.my}</button>
                  <button className="dd-item" onClick={()=>{setView('about');setOpenDropdown(null);}}>🌊 {t.nav.about}</button>
                  {(effectiveIsGlobalAdmin || adminInfo.role === 'delegate_admin' || adminInfo.isCommunityAdmin) && <button className="dd-item" onClick={()=>{setView('admin');setOpenDropdown(null);}}>⚙️ {t.nav.admin}</button>}
                  {(effectiveIsGlobalAdmin || analyticsEnabledForAll) && <button className="dd-item" onClick={()=>{setView('analytics');setOpenDropdown(null);}}>📈 {t.nav.analytics}</button>}
                  {adminInfo.isGlobalAdmin && <div className="profile-view-as"><span>👁 {lang==='en'?'View as:':'Ver como:'}</span><select className="view-as-select" value={previewRole||''} onChange={e=>{setPreviewRole(e.target.value||null);setOpenDropdown(null);}}><option value="">{lang==='en'?'Global Admin':'Admin global'}</option><option value="delegate_admin">{lang==='en'?'Delegate Admin':'Admin delegado'}</option><option value="user">{lang==='en'?'Owner/User':'Propietario/Usuario'}</option></select></div>}
                  <button className="dd-item danger" onClick={()=>{setOpenDropdown(null);logout();}}>{lang === "en" ? "🚪 Log out" : "🚪 Cerrar sesión"}</button>
                  <div className="profile-version">{complexName} · v{APP_VERSION}</div>
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
        {view==="dashboard" && <Dashboard lang={lang} listings={listings} incidents={incidents} user={user} contactProps={contactProps} setView={setView} showBlacklist={false} onReport={()=>{ if(!user){login();return;} setModal({type:"incident"}); }} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} effectiveRole={effectiveRole} delegatePerms={delegatePerms} pendingOwner={needsOwnerVerification.length} pendingOwnerResolution={needsOwnerResolution.length} pendingResolve={needsAdminResolution.length} pendingRegistrations={effectiveCanManageRegistrations ? pendingRegistrations.length : 0} canResolve={canResolveIncidentsNow} canManageRegistrations={effectiveCanManageRegistrations} onOwnerClick={()=>{setIncidentQuickFilter('ownerVerification');setView('incidents');}} onResolveClick={()=>{setIncidentQuickFilter('requiresResolution');setView('incidents');}} onRegistrationsClick={()=>setView('approvals')} onAddResClick={()=>{setIncidentQuickFilter('needsResolution');setView('incidents');}} onIncidentDetail={openIncidentDetail} />}
        {view==="about" && <CommunityMissionView lang={lang} config={adminInfo.config} />}
        {view==="listings"  && <ListingsView lang={lang} listings={listings} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canEditGlobal={delegatePerms.canUpdateGlobalListings} canDeleteGlobal={delegatePerms.canDeleteGlobalListings} canResolveGlobal={canResolveIncidentsNow} floorOpenState={listingFloorOpen} onFloorToggle={toggleListingFloor} onAdd={()=>{ if(!user){login();return;} setModal({type:"addListing"}); }} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>{ if(!user){login();return;} setModal({type:"incident",data:{aptId:l.id}}); }} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onResolve={resolveIncident} onAddResolution={inc=>setModal({type:"addResolution",data:inc})} onFloorFilter={f=>{setIncidentQuickFilter({type:'floorFilter',aptIds:f.aptIds,status:f.status});setView('incidents');}} onAssign={inc=>setModal({type:'assignGeneral',data:inc})} onCloseGeneral={inc=>setModal({type:'closeGeneral',data:inc})} onIncidentDetail={openIncidentDetail} />}

        {(view==="incidents"||view==="general") && <IncidentsView key={view} defaultTab={view==='general'?'general':'unit'} lang={lang} incidents={incidents} listings={listings} user={user} quickFilter={incidentQuickFilter} onQuickFilterApplied={()=>setIncidentQuickFilter(null)} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canUpdateGlobal={delegatePerms.canUpdateGlobalIncidents} canDeleteGlobal={delegatePerms.canDeleteGlobalIncidents} canResolveGlobal={canResolveIncidentsNow} onAdd={()=>{ if(!user){login();return;} setModal({type:"incident"}); }} onResolve={resolveIncident} onDelete={deleteIncident} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onAddResolution={inc=>setModal({type:"addResolution",data:inc})} onUnitDetail={id=>setUnitDetailOverlay({listingId:id})} onIncidentDetail={openIncidentDetail} onAssign={inc=>setModal({type:'assignGeneral',data:inc})} onCloseGeneral={inc=>setModal({type:'closeGeneral',data:inc})} />}
        {view==="notifications" && user && <NotificationsView lang={lang} notifications={notifications} incidents={incidents} listings={listings} contactProps={contactProps} onRead={markNotificationRead} onReadAll={markAllNotificationsRead} smartAlerts={smartAlerts} onIncidentDetail={openIncidentDetail} />}
        {view==="approvals" && user && effectiveCanManageRegistrations && <PendingApprovalsView lang={lang} pending={pendingRegistrations} onApprove={id=>reviewRegistrationAction(id,'approve')} onDecline={id=>reviewRegistrationAction(id,'decline')} active={activeRegistrations} />}
        {view==="analytics" && user && (effectiveIsGlobalAdmin || analyticsEnabledForAll) && <AnalyticsDashboard lang={lang} user={user} contactProps={contactProps} showToast={showToast} isGlobalAdmin={effectiveIsGlobalAdmin} />}
        {view==="admin" && user && ((effectiveIsGlobalAdmin || adminInfo.role === 'delegate_admin' || adminInfo.isCommunityAdmin) ? <ErrorBoundary section="admin" fallback={(err)=><AdminFallback lang={lang} error={err}/>}><AdminSettings config={adminInfo.config || {}} user={user} listings={listings} contactProps={contactProps} onSave={saveAdminConfig} showToast={showToast} lang={lang} adminInfo={adminInfo} /></ErrorBoundary> : <AdminAccessHelp user={user} adminInfo={adminInfo} lang={lang} />)}
        {view==="my" && user && <MyListings lang={lang} listings={myListings} allListings={listings} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canResolveGlobal={canResolveIncidentsNow} onAdd={()=>setModal({type:"addListing"})} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>setModal({type:"incident",data:{aptId:l.id}})} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onResolve={resolveIncident} onAddResolution={inc=>setModal({type:"addResolution",data:inc})} onNavigateToIncidents={f=>{setIncidentQuickFilter({type:'floorFilter',aptIds:f.aptIds,status:f.status||'all'});setView('incidents');}} onIncidentDetail={openIncidentDetail} onAssign={inc=>setModal({type:'assignGeneral',data:inc})} onCloseGeneral={inc=>setModal({type:'closeGeneral',data:inc})} />}
        {view==="profile" && user && <ProfileView lang={lang} user={user} userProfile={userProfile} onSave={saveProfile} communities={adminInfo.communities||[]} currentCommunityId={adminInfo.communityId||_communityId} onSwitchCommunity={switchCommunity} />}
        {view==="help" && <HelpView lang={lang} effectiveRole={effectiveRole} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} delegatePerms={delegatePerms} listings={listings} incidents={incidents} user={user} setView={setView} onReport={()=>{ if(!user){login();return;} setModal({type:'incident'}); }} onAddListing={()=>{ if(!user){login();return;} setModal({type:'addListing'}); }} setIncidentQuickFilter={setIncidentQuickFilter} openMore={()=>setOpenDropdown('more')} />}
      </main>

      {/* Mobile bottom navigation — sticky 4-tab bar for small screens */}
      {user && isApproved && (
        <nav className="mob-bottom-nav" aria-label={lang==='en'?'Main navigation':'Navegación principal'}>
          {[
            { id:'my',            icon:'🔑', label:lang==='en'?'My Units':'Mis Unidades', badge: myListings.length>0&&(needsOwnerVerification.length+needsOwnerResolution.length)||0 },
            { id:'incidents',     icon:'⚠️', label:lang==='en'?'Unit Incidents':'Incidentes de Unidad',  badge: openCount },
            { id:'notifications', icon:'🔔', label:lang==='en'?'Alerts':'Alertas',         badge: unreadNotifications },
            { id:'my',            icon:'👤', label:lang==='en'?'Profile':'Perfil',          badge: 0, toProfile:true },
          ].map((n,i)=>(
            <button key={i} type="button"
              className={`mbn-bottom${view===(n.toProfile?'profile':n.id)?' mbn-bottom-active':''}`}
              onClick={()=>{setView(n.toProfile?'profile':n.id);setOpenDropdown(null);}}>
              <span className="mbn-bottom-icon">{n.icon}{n.badge>0&&<span className="mbn-bottom-badge">{n.badge}</span>}</span>
              <span className="mbn-bottom-lbl">{n.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Global unit detail overlay — triggered from any unit number click across the app */}
      {unitDetailOverlay && (() => {
        const udl = listings.find(x=>x.id===unitDetailOverlay.listingId);
        if (!udl) return null;
        return (
          <Overlay onClose={()=>setUnitDetailOverlay(null)} wide>
            <UnitDetailCard
              key={udl.id}
              l={udl}
              incidents={incidents}
              canEdit={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canUpdateGlobalListings}
              canDelete={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canDeleteGlobalListings}
              onEdit={()=>{setUnitDetailOverlay(null);setModal({type:'editListing',data:udl});}}
              onDelete={()=>{setUnitDetailOverlay(null);deleteListing(udl);}}
              onReport={()=>{setUnitDetailOverlay(null);if(!user){login();return;}setModal({type:'incident',data:{aptId:udl.id}});}}
              user={user}
              contactProps={contactProps}
              isGlobalAdmin={effectiveIsGlobalAdmin}
              canResolveGlobal={canResolveIncidentsNow}
              onVerify={inc=>setModal({type:'verifyIncident',data:inc})}
              onResolve={resolveIncident}
              onAddResolution={inc=>setModal({type:'addResolution',data:inc})}
              defaultStep={unitDetailOverlay.defaultStep||'info'}
              lang={lang}
              isEn={lang==='en'}
            />
          </Overlay>
        );
      })()}
      {/* Global incident detail overlay — triggered from any incident summary click across the app */}
      {incidentDetailOverlay && (() => {
        const inc = incidents.find(i => i.id === incidentDetailOverlay.incidentId);
        const udl = inc ? listings.find(x => x.id === inc.aptId) : null;
        if (!udl || !inc) return null;
        return (
          <Overlay onClose={()=>setIncidentDetailOverlay(null)} wide>
            <UnitDetailCard
              key={`${udl.id}-${inc.id}`}
              l={udl}
              incidents={incidents}
              canEdit={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canUpdateGlobalListings}
              canDelete={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canDeleteGlobalListings}
              onEdit={()=>{setIncidentDetailOverlay(null);setModal({type:'editListing',data:udl});}}
              onDelete={()=>{setIncidentDetailOverlay(null);deleteListing(udl);}}
              onReport={()=>{setIncidentDetailOverlay(null);if(!user){login();return;}setModal({type:'incident',data:{aptId:udl.id}});}}
              user={user}
              contactProps={contactProps}
              isGlobalAdmin={effectiveIsGlobalAdmin}
              canResolveGlobal={canResolveIncidentsNow}
              onVerify={inc=>setModal({type:'verifyIncident',data:inc})}
              onResolve={resolveIncident}
              onAddResolution={inc=>setModal({type:'addResolution',data:inc})}
              defaultStep="incident"
              defaultIncidentId={inc.id}
              lang={lang}
              isEn={lang==='en'}
            />
          </Overlay>
        );
      })()}
      {/* LoginModal removed — Google popup handles auth directly */}
      {modal?.type==="addListing" && <ListingModal title={appText(lang,"listings.add")} lang={lang} config={adminInfo.config} user={user} onSave={addListing} onClose={()=>setModal(null)} />}
      {modal?.type==="editListing" && <ListingModal title={appText(lang,"modal.listing.editTitle")} lang={lang} config={adminInfo.config} user={user} initial={modal.data} onSave={d=>editListing(modal.data.id, modal.data.ownerUid, d)} onClose={()=>setModal(null)} />}
      {modal?.type==="incident" && <IncidentModal lang={lang} config={adminInfo.config} listings={listings} user={user} presetApt={modal.data?.aptId} onSave={addIncident} onClose={()=>setModal(null)} />}
      {modal?.type==="verifyIncident" && <VerifyIncidentModal lang={lang} config={adminInfo.config} incident={modal.data} onSave={payload=>verifyIncident(modal.data.id,payload)} onClose={()=>setModal(null)} />}
      {modal?.type==="addResolution" && <AddResolutionModal lang={lang} incident={modal.data} onSave={text=>addResolution(modal.data.id,text)} onClose={()=>setModal(null)} />}
      {modal?.type==="assignGeneral" && <AssignToUnitModal lang={lang} incident={modal.data} listings={listings} onSave={aptId=>assignIncident(modal.data.id,aptId)} onClose={()=>setModal(null)} />}
      {modal?.type==="closeGeneral" && <CloseGeneralModal lang={lang} incident={modal.data} onSave={data=>closeGeneralIncident(modal.data.id,data)} onClose={()=>setModal(null)} />}
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
    id:'admin_nav', icon:'⚙️', category:'admin', roles:['global_admin'],
    title:HL('Admin — Navegación y roles','Admin — Navigation & roles'),
    summary:HL('Personalizar el orden del menú, la página de inicio y los permisos por rol.','Customize menu order, default landing page, and permissions per role.'),
    sections:[
      { h:HL('Configurar orden de navegación','Configure navigation order'),
        b:HL('En Admin → Navegación y página de inicio, selecciona el rol (Propietario, Admin Delegado, Admin Global) y marca qué secciones aparecen en la barra superior. Usa las flechas ↑↓ para reordenar. Las secciones no marcadas van al menú "Más ▾".','In Admin → Navigation & Landing, select the role (Owner, Delegate Admin, Global Admin) and check which sections appear in the top bar. Use ↑↓ arrows to reorder. Unchecked sections go to "More ▾" menu.')},
      { h:HL('Página de inicio por rol','Default landing page per role'),
        b:HL('Para cada rol, selecciona la página de inicio predeterminada. El valor predeterminado de fábrica es "Mis Unidades" para todos los roles. Este valor se aplica al ingresar a la app sin URL específica, después de que la configuración del servidor se carga completamente.','For each role, select the default landing page. The factory default is "My Units" for all roles. This applies when signing in without a specific URL, after the server configuration loads completely.')},
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
const HELP_ACTIONS = {
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
  const isEn = lang === 'en';
  const isCommunityAdmin = !adminInfo.isGlobalAdmin && !!(adminInfo.communityAdminOf?.length);
  const role = adminInfo.isGlobalAdmin ? 'global' : adminInfo.role === 'delegate_admin' ? 'delegate' : isCommunityAdmin ? 'community' : 'standard';
  const icons = { global:'🌐', delegate:'🛡️', community:'🏢', standard:'🏠' };
  const titles = {
    global: isEn ? 'Global Admin' : 'Admin Global',
    delegate: isEn ? 'Delegate Admin' : 'Admin Delegado',
    community: isEn ? 'Community Admin' : 'Admin de Comunidad',
    standard: isEn ? 'Unit Owner' : 'Propietario',
  };
  const texts = {
    global: isEn ? 'Full platform control across all communities.' : 'Control total de la plataforma en todas las comunidades.',
    delegate: isEn ? 'Delegated admin with specific platform-wide permissions.' : 'Admin delegado con permisos específicos en toda la plataforma.',
    community: isEn ? `Community admin for ${adminInfo.communityAdminOf?.length||1} community${(adminInfo.communityAdminOf?.length||1)>1?'ies':''}. Manage members, settings, and incidents within your community.` : `Admin de ${adminInfo.communityAdminOf?.length||1} comunidad${(adminInfo.communityAdminOf?.length||1)>1?'es':''}. Gestiona miembros, configuración e incidentes de tu comunidad.`,
    standard: isEn ? 'View and manage your own units and incidents.' : 'Ver y gestionar tus propias unidades e incidentes.',
  };
  const actions = role === 'global'
    ? [{label:appText(lang,'roles.globalAction1'), view:'analytics'}, {label:appText(lang,'roles.globalAction2'), view:'admin'}]
    : role === 'delegate'
      ? [{label:appText(lang,'roles.delegateAction1'), view:'approvals'}, ...(delegatePerms.canResolveIncidents ? [{label:appText(lang,'roles.delegateAction2'), view:'incidents'}] : [])]
      : role === 'community'
        ? [{label:isEn?'Manage members':'Gestionar miembros', view:'admin'}, {label:isEn?'Registrations':'Registros', view:'approvals'}]
        : [{label:appText(lang,'roles.ownerAction1'), view:'incidents'}, {label:appText(lang,'roles.ownerAction2'), view:'my'}];
  return <div className="role-guide">
    <div><strong>{icons[role]} {titles[role]}</strong><span>{texts[role]}</span></div>
    <div className="role-actions"><span>{appText(lang,'roles.primaryActions')}:</span>{actions.map((a,i)=><button key={i} className="role-chip" onClick={()=>onGo(a.view)}>{a.label}</button>)}</div>
    <div className="role-metrics"><span>🏠 {ownerCount}</span>{pendingOwner>0&&<span>✅ {pendingOwner}</span>}{pendingResolve>0&&<span>🛠️ {pendingResolve}</span>}</div>
  </div>;
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────
function AuthGate({ onLogin, lang="es-CO", setLang=()=>{}, complexLogo='', complexNameEs='Propietarios Airbnb KAI', complexNameEn='KAI Airbnb Owners', complexLocation='Serena del Mar · Cartagena 🇨🇴', complexBg='/morros-kai-bg.jpg', onCommunitySelect }) {
  const isEn = lang === 'en';
  const [communities, setCommunities] = useState([]);
  const [selectedId, setSelectedId] = useState(() => { try { return localStorage.getItem('kai_community') || ''; } catch(e) { return ''; } });
  const [search, setSearch] = useState('');
  const [displayLogo, setDisplayLogo] = useState(complexLogo);
  const [displayNameEs, setDisplayNameEs] = useState(complexNameEs);
  const [displayNameEn, setDisplayNameEn] = useState(complexNameEn);
  const [displayLocation, setDisplayLocation] = useState(complexLocation);
  const [displayBg, setDisplayBg] = useState(complexBg);

  useEffect(() => {
    fetch('/api/communities/public').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      if (!d.communitiesEnabled) {
        // feature disabled — auto-select the default
        const defId = d.defaultCommunityId || 'kai';
        if (!selectedId) {
          setSelectedId(defId);
          onCommunitySelect?.(defId, null);
        }
        return;
      }
      if (d.communities?.length) {
        setCommunities(d.communities);
        const saved = selectedId || '';
        const match = d.communities.find(c => c.id === saved);
        if (match) { applyCommunityCfg(match); onCommunitySelect?.(match.id, match); }
        else if (d.communities.length === 1) {
          const c = d.communities[0];
          setSelectedId(c.id); applyCommunityCfg(c); onCommunitySelect?.(c.id, c);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/communities/${selectedId}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { applyCommunityCfg(d); onCommunitySelect?.(selectedId, d); }
    }).catch(() => {});
  }, [selectedId]);

  const applyCommunityCfg = (cfg) => {
    if (!cfg) return;
    if (cfg.name) setDisplayNameEs(cfg.name);
    if (cfg.name_en || cfg.name) setDisplayNameEn(cfg.name_en || cfg.name);
    if (cfg.city || cfg.country) setDisplayLocation([cfg.city, cfg.country].filter(Boolean).join(' · '));
    if (cfg.logo_url) setDisplayLogo(cfg.logo_url);
    if (cfg.background_url) setDisplayBg(cfg.background_url);
  };

  const handleCommunityChange = (id) => {
    setSelectedId(id);
    try { localStorage.setItem('kai_community', id); } catch(e) {}
    const c = communities.find(x => x.id === id);
    if (c) { applyCommunityCfg(c); onCommunitySelect?.(id, c); }
  };

  const complexName = isEn ? displayNameEn : displayNameEs;
  const loginTitle = isEn ? `Welcome to ${displayNameEn}` : `Bienvenido a ${displayNameEs}`;
  const loginSub = `${complexName} · ${displayLocation}`;
  const logoSrc = displayLogo || '/morros-kai.png';
  const t = getT(lang);
  const bgStyle = displayBg ? { backgroundImage:`url(${displayBg})`, backgroundSize:'cover', backgroundPosition:'center' } : {};
  return (
    <div className="app-shell gate-shell gate-shell-bg" style={bgStyle}><style>{CSS}</style>
      <div className="gate-shell-overlay"/>
      <div className="gate-card welcome-card">
        <div className="gate-lang"><LanguageSwitch lang={lang} setLang={setLang} /></div>
        {communities.length > 1 && (
          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:'.75rem',fontWeight:600,color:'rgba(47,79,58,.7)',marginBottom:4}}>{isEn ? 'Select your community' : 'Selecciona tu comunidad'}</label>
            <input
              type="text"
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder={isEn ? 'Search communities...' : 'Buscar comunidad...'}
              style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1.5px solid rgba(47,79,58,.25)',fontSize:'.9rem',background:'rgba(255,255,255,.85)',color:'#1a3c2a',boxSizing:'border-box',marginBottom:6}}
            />
            <div style={{maxHeight:180,overflowY:'auto',borderRadius:8,border:'1px solid rgba(47,79,58,.15)',background:'rgba(255,255,255,.9)'}}>
              {communities.filter(c=>{
                if(!search.trim()) return true;
                const q=search.trim().toLowerCase();
                return [c.name,c.name_en,c.city,c.country,c.tower].filter(Boolean).some(v=>v.toLowerCase().includes(q));
              }).map(c=>(
                <div key={c.id}
                  onClick={()=>handleCommunityChange(c.id)}
                  style={{padding:'8px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid rgba(47,79,58,.08)',background:selectedId===c.id?'rgba(47,79,58,.1)':'transparent'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:'.85rem',color:'#1a3c2a'}}>{isEn?(c.name_en||c.name):c.name}</div>
                    {(c.city||c.country)&&<div style={{fontSize:'.73rem',color:'rgba(47,79,58,.6)'}}>{[c.city,c.country].filter(Boolean).join(' · ')}</div>}
                  </div>
                  {selectedId===c.id&&<span style={{color:'#2F4F3A',fontSize:'1rem'}}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="welcome-brand">
          <img src={logoSrc} className="welcome-logo" alt={complexName}/>
          <div>
            <h1 className="ptitle">{loginTitle}</h1>
            <p className="psub">{loginSub}</p>
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
        <div style={{marginTop:16,fontSize:'.68rem',color:'rgba(47,79,58,.4)',textAlign:'center',letterSpacing:'.04em'}}>{complexName} · v{APP_VERSION}</div>
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
          <img src={config?.complex_logo || '/morros-kai.png'} className="welcome-logo small" alt={config?.complex_name_es || config?.complex_name_en || _complexName.es}/>
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

function RegistrationGate({ user, registration, onSubmit, onLogout, syncing, toast, lang="es-CO", setLang=()=>{}, complexLogo='', complexName='Propietarios Airbnb KAI', complexLocation='Serena del Mar · Cartagena 🇨🇴', complexBg='/morros-kai-bg.jpg' }) {
  const isEn = lang === 'en';
  const logoSrc = complexLogo || '/morros-kai.png';
  const t = getT(lang);
  const status = registration?.status || 'none';
  const bgStyle = complexBg ? { backgroundImage:`url(${complexBg})`, backgroundSize:'cover', backgroundPosition:'center' } : {};
  return (
    <div className="app-shell gate-shell gate-shell-bg" style={bgStyle}><style>{CSS}</style>
      <div className="gate-shell-overlay"/>
      <div className="gate-card gate-wide">
        <div className="gate-top">{complexLogo ? <img src={complexLogo} className="gate-logo-img" alt={complexName}/> : <div className="logo-mark"><span className="logo-k">K</span><span className="logo-wave">~</span></div>}<LanguageSwitch lang={lang} setLang={setLang} /><button className="btn-ghost" onClick={onLogout}>{isEn ? 'Sign out' : 'Salir'}</button></div>
        <h1 className="ptitle">{isEn ? `${complexName} — Owner registration` : `Registro de propietario ${complexName}`}</h1>
        <p className="psub">{isEn ? `Hi ${user.name}. To use the app you must register one or more apartments that belong to you.` : `Hola ${user.name}. Para usar la aplicación debes registrar uno o más apartamentos que son tuyos.`}</p>
        {status === 'pending' && <div className="status-box pending"><h3>⏳ {isEn ? 'Registration pending approval' : 'Registro pendiente de aprobación'}</h3><p>{isEn ? 'Your request was received. An approved owner will review your information. We will email you when the status changes.' : 'Tu solicitud fue recibida. Un propietario aprobado revisará tus datos. Te enviaremos un email cuando cambie el estado.'}</p></div>}
        {status === 'declined' && <div className="status-box declined"><h3>🚫 {isEn ? 'Registration declined' : 'Registro rechazado'}</h3><p><strong>{isEn ? 'Reason:' : 'Motivo:'}</strong> {registration.reason || (isEn ? 'No reason provided.' : 'No se indicó motivo.')}</p><p>{isEn ? 'You can correct the information and submit a new request.' : 'Puedes corregir la información y enviar una nueva solicitud.'}</p><RegistrationListingForm user={user} onSubmit={onSubmit} submitText={isEn ? "Resubmit registration" : "Reenviar registro"} lang={lang} /></div>}
        {(status === 'none' || status === 'error') && <RegistrationListingForm user={user} onSubmit={onSubmit} submitText={isEn ? "Submit registration for approval" : "Enviar registro para aprobación"} lang={lang} />}
      </div>
      {syncing && <div className="sync-overlay"><div className="spinner-sm"/><span>{isEn ? "Saving to server..." : "Guardando en servidor..."}</span></div>}
      {toast && <div className={`toast ${toast.err?"toast-err":""}`}>{toast.msg}</div>}
    </div>
  );
}

function RegistrationListingForm({ user, onSubmit, submitText, lang="es-CO" }) {
  const isEn = lang === 'en';
  const tips = localizedTooltips({}, lang); // default tooltips — no admin config available at registration time
  const makeBlank = () => ({ apt:'', tower:getDefaultTower(), rooms:'2', guests:4, operator:'', operatorEmail:'', operatorWhatsapp:'', airbnb:'' });
  const [items,setItems]=useState([makeBlank()]);
  const [country,setCountry]=useState('Colombia');
  const [whatsapp,setWhatsapp]=useState('+57 ');
  const [errors,setErrors]=useState({});
  const [checking,setChecking]=useState({});
  const handleCountryChange = (val) => {
    const code = OWNER_COUNTRIES.find(c=>c.name===val)?.code||'';
    setCountry(val);
    setWhatsapp(applyDialCode(whatsapp, code));
    setErrors(e=>({...e,whatsapp:undefined}));
  };
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
          <label>🌍 {isEn?'Country':'País'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
          <select value={country} onChange={e=>handleCountryChange(e.target.value)}>
            {OWNER_COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.name}{c.code?' ('+c.code+')':''}</option>)}
          </select>
        </div>
        <div className="fg full">
          <label>WhatsApp <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
          <input className={cls('whatsapp')} type="tel" value={whatsapp} onChange={e=>{setWhatsapp(e.target.value);setErrors(er=>({...er,whatsapp:undefined}));}} onBlur={e=>{let v=String(e.target.value||'').trim();if(!v){setErrors(er=>({...er,whatsapp:isEn?'WhatsApp is required':'WhatsApp es requerido'}));return;}const digits=v.replace(/[^0-9]/g,'');if(!v.startsWith('+')&&digits.length>=10){v='+'+digits;setWhatsapp(v);}const err=validateWhatsApp(v,lang);setErrors(er=>({...er,whatsapp:err||undefined}));}} placeholder="+57 300 000 0000"/>
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
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value={getDefaultTower()} readOnly disabled className="locked-field"/></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={cls(`rooms_${i}`)} value={f.rooms} onChange={e=>setVal(i,'rooms',e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors[`rooms_${i}`]&&<span className="err-msg">{errors[`rooms_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={cls(`guests_${i}`)} type="number" value={f.guests} onChange={e=>setVal(i,'guests',parseInt(e.target.value)||'')} min={1}/>{errors[`guests_${i}`]&&<span className="err-msg">{errors[`guests_${i}`]}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} {optLabel}</label><input className={cls(`airbnb_${i}`)} value={f.airbnb} onChange={e=>setVal(i,'airbnb',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`airbnb_${i}`;if(v&&!/^https?:\/\/.+/i.test(v))setErrors(p=>({...p,[key]:appText(lang,'validation.urlInvalid')}));else setErrors(p=>({...p,[key]:undefined}));}} placeholder="https://www.airbnb.com/rooms/..."/>{errors[`airbnb_${i}`]&&<span className="err-msg">{errors[`airbnb_${i}`]}</span>}</div>
        {/* ── Operator ─────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🔧 {isEn?'Operator (optional)':'Operador (opcional)'}</div>
        <div className="fg full" style={{marginTop:-4,marginBottom:4}}><span className="help-msg">{isEn?'Leave blank if you self-manage. Operator receives all incident notifications for this unit.':'Déjalo en blanco si gestionas tú mismo. El operador recibe todas las notificaciones de incidentes de esta unidad.'}</span></div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} {optLabel} <Tip text={tips.operator}/></label><input className={cls(`operator_${i}`)} value={f.operator} onChange={e=>setVal(i,'operator',e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors[`operator_${i}`]&&<span className="err-msg">{errors[`operator_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} <Tip text={tips.operatorEmail}/></label><input className={cls(`operatorEmail_${i}`)} type="email" value={f.operatorEmail} onChange={e=>setVal(i,'operatorEmail',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`operatorEmail_${i}`;if(v&&!validateEmail(v))setErrors(p=>({...p,[key]:appText(lang,'validation.operatorEmailInvalid')}));else setErrors(p=>({...p,[key]:undefined}));}} placeholder="operador@email.com"/>{errors[`operatorEmail_${i}`]&&<span className="err-msg">{errors[`operatorEmail_${i}`]}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.operatorWhatsappOptional")} <Tip text={tips.operatorWhatsapp}/></label><input className={cls(`operatorWhatsapp_${i}`)} type="tel" value={f.operatorWhatsapp} onChange={e=>setVal(i,'operatorWhatsapp',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`operatorWhatsapp_${i}`;const err=validateWhatsApp(v,lang);setErrors(p=>({...p,[key]:err||undefined}));}} placeholder="+57 300 000 0000"/>{errors[`operatorWhatsapp_${i}`]?<span className="err-msg">{errors[`operatorWhatsapp_${i}`]}</span>:<span className="help-msg">{isEn?'With country code, e.g. +57':'Con código de país, ej. +57'}</span>}</div>
      </div>
    </div>)}
    <div className="mact"><button className="btn-ghost" onClick={()=>setItems(rows=>[...rows, makeBlank()])}>{appText(lang,"form.addAnotherListing")}</button><button className="btn-p" onClick={()=>{ if(validate()) onSubmit({ listings: items.map(x=>({...x,apt:String(x.apt).trim(),tower:x.tower||getDefaultTower(),operatorEmail:String(x.operatorEmail||'').trim().toLowerCase(),operatorWhatsapp:String(x.operatorWhatsapp||'').trim(),airbnb:String(x.airbnb||'').trim()})), profile:{ whatsapp:whatsapp.trim(), country } }); }}>{submitText}</button></div>
  </div>;
}

function ListingDetailsBlock({ listings=[], lang="es-CO" }) {
  return <div className="listing-detail-grid">{listings.map(l=><div key={l.id} className="listing-detail-card">
    <div className="ld-title">🏠 {appText(lang,"listing.apt")} {l.apt} · {appText(lang,"listing.tower")} {l.tower||getDefaultTower()}</div>
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


function ProfileView({ user, lang, userProfile, onSave, communities=[], currentCommunityId='', onSwitchCommunity }) {
  const isEn = lang === 'en';
  const [country, setCountry] = useState(userProfile.country || 'Colombia');
  const [whatsapp, setWhatsapp] = useState(userProfile.whatsapp || '');
  const [notificationEmail, setNotificationEmail] = useState(userProfile.notificationEmail || '');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Sync when profile loads from server
  useEffect(() => { setWhatsapp(userProfile.whatsapp || ''); }, [userProfile.whatsapp]);
  useEffect(() => { setCountry(userProfile.country || 'Colombia'); }, [userProfile.country]);
  useEffect(() => { setNotificationEmail(userProfile.notificationEmail || ''); }, [userProfile.notificationEmail]);

  const handleCountryChange = (val) => {
    const code = OWNER_COUNTRIES.find(c=>c.name===val)?.code||'';
    setCountry(val);
    setWhatsapp(applyDialCode(whatsapp, code));
    setError('');
  };

  const validate = () => {
    if (!String(whatsapp||'').trim()) { setError(isEn ? 'WhatsApp is required' : 'WhatsApp es requerido'); return false; }
    const err = validateWhatsApp(whatsapp, lang);
    if (err) { setError(err); return false; }
    setError('');
    const ne = String(notificationEmail||'').trim();
    if (ne && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) {
      setEmailError(isEn ? 'Enter a valid email address' : 'Ingresa un email válido');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave({ whatsapp: whatsapp.trim(), country, notificationEmail: notificationEmail.trim() }); }
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
          <div className="prof-section-hdr">📱 {isEn ? 'Contact' : 'Contacto'}</div>
          <p style={{fontSize:'.84rem',color:'#2a5a6a',margin:'0 0 14px',lineHeight:1.5}}>
            {isEn ? 'Used as the contact WhatsApp for all your listings. Updating this will apply to all apartments you own.' : 'Se usa como WhatsApp de contacto en todos tus listings. Al actualizar aquí se aplica a todos tus apartamentos.'}
          </p>
          <div className="fg2" style={{maxWidth:360}}>
            <div className="fg full">
              <label>🌍 {isEn ? 'Country' : 'País'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
              <select value={country} onChange={e=>handleCountryChange(e.target.value)}>
                {OWNER_COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.name}{c.code?' ('+c.code+')':''}</option>)}
              </select>
            </div>
            <div className="fg full">
              <label>WhatsApp <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
              <input className={error?'field-error':''} type="tel" value={whatsapp} onChange={e=>{setWhatsapp(e.target.value);setError('');}} onBlur={e=>{let v=String(e.target.value||'').trim();if(!v){setError(isEn?'WhatsApp is required':'WhatsApp es requerido');return;}const digits=v.replace(/[^0-9]/g,'');if(!v.startsWith('+')&&digits.length>=10){v='+'+digits;setWhatsapp(v);}const err=validateWhatsApp(v,lang);if(err)setError(err);else setError('');}} placeholder="+57 300 000 0000"/>
              {error ? <span className="err-msg">{error}</span> : <span className="help-msg">{isEn?'With country code, e.g. +57 300 000 0000':'Con código de país, ej. +57 300 000 0000'}</span>}
            </div>
          </div>
        </div>

        {/* ── Notification email ───────────────────── */}
        <div className="prof-section">
          <div className="prof-section-hdr">✉️ {isEn ? 'Notification email' : 'Email de notificaciones'}</div>
          <p style={{fontSize:'.84rem',color:'#2a5a6a',margin:'0 0 14px',lineHeight:1.5}}>
            {isEn
              ? 'Optional. If set, notifications will be sent here instead of your Google email.'
              : 'Opcional. Si lo configuras, las notificaciones llegarán aquí en lugar de a tu email de Google.'}
          </p>
          <div className="fg2" style={{maxWidth:360}}>
            <div className="fg full">
              <label>{isEn ? 'Notification email' : 'Email alternativo'} <span style={{color:'#70d6c6',fontStyle:'italic',fontSize:'0.68rem'}}>({isEn?'optional':'opcional'})</span></label>
              <input className={emailError?'field-error':''} type="email" value={notificationEmail} onChange={e=>{setNotificationEmail(e.target.value);setEmailError('');}} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))setEmailError(isEn?'Enter a valid email address':'Ingresa un email válido');else setEmailError('');}} placeholder="otro@email.com"/>
              {emailError ? <span className="err-msg">{emailError}</span> : <span className="help-msg">{isEn?'Leave blank to use your Google email':'Deja en blanco para usar tu email de Google'}</span>}
            </div>
          </div>
        </div>

        {/* ── Communities ─────────────────────────── */}
        {communities.length > 0 && (
          <div className="prof-section">
            <div className="prof-section-hdr">🌐 {isEn ? 'My communities' : 'Mis comunidades'}</div>
            <p style={{fontSize:'.84rem',color:'#2a5a6a',margin:'0 0 14px',lineHeight:1.5}}>
              {isEn ? 'Communities you belong to. Switch without logging out.' : 'Comunidades a las que perteneces. Cambia sin cerrar sesión.'}
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {communities.map(c => {
                const isCurrent = c.id === currentCommunityId;
                const label = isEn ? (c.name_en || c.name) : c.name;
                const location = [c.city, c.country].filter(Boolean).join(', ');
                return (
                  <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,border:`1.5px solid ${isCurrent?'#2F4F3A':'#cce7ee'}`,background:isCurrent?'#f0f8f4':'#fafcfe',flexWrap:'wrap'}}>
                    {c.logo_url && <img src={c.logo_url} alt="" style={{width:32,height:32,objectFit:'contain',borderRadius:6,background:'#f5fbfd',padding:2,flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'.88rem',color:'#17313a'}}>{label}</div>
                      {(location || c.tower) && <div style={{fontSize:'.73rem',color:'#6b9ba8',marginTop:1}}>{[c.tower, location].filter(Boolean).join(' · ')}</div>}
                      {c.memberRole === 'community_admin' && <span className="chip c-teal" style={{fontSize:'.65rem',padding:'1px 7px',marginTop:3,display:'inline-block'}}>{isEn?'Admin':'Administrador'}</span>}
                    </div>
                    {isCurrent
                      ? <span className="chip c-teal" style={{fontSize:'.72rem',padding:'2px 10px',flexShrink:0}}>{isEn?'Current':'Actual'}</span>
                      : <button className="btn-ghost" style={{fontSize:'.78rem',padding:'5px 14px',flexShrink:0,minHeight:32}}
                          disabled={switching}
                          onClick={async()=>{setSwitching(true);try{await onSwitchCommunity?.(c.id);}finally{setSwitching(false);}}}>
                          {switching?'…':(isEn?'Switch':'Cambiar')}
                        </button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
  pendingOwner=0, pendingOwnerResolution=0, pendingResolve=0, pendingRegistrations=0, openCount=0,
  myListingCount=0, myOpenCount=0, pendingGeneral=0,
  canResolve=false, canManageRegistrations=false,
  onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{}, onOpenClick=()=>{}, setView=()=>{}, onAddResClick=()=>{}, onGeneralClick=()=>{} }) {
  const isEn = lang==='en';
  const role = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'standard';

  // Role-specific card sets — each role sees only what matters to them
  const cards = role==='standard' ? [
    { id:'verify',        icon:'⚠️', count:pendingOwner,           label:isEn?'⚠️ Verify now':'⚠️ Verificar',        sub:isEn?'Step 1 · Open incidents on your units requiring verification':'Paso 1 · Incidentes abiertos en tus unidades que requieren verificación', accent:'red',   onClick:onOwnerClick,   show:true },
    { id:'addResolution', icon:'📝', count:pendingOwnerResolution, label:isEn?'📝 Add resolution':'📝 Agregar respuesta', sub:isEn?'Step 2 · Verified — add your resolution to allow admin to close':'Paso 2 · Verificados — agrega tu respuesta para que admin pueda cerrar', accent:'amber', onClick:onAddResClick,  show:true },
    { id:'myListings',    icon:'🏠', count:myListingCount,         label:isEn?'My listings':'Mis listings',             sub:isEn?'Your registered units':'Tus unidades registradas',                                                                                       accent:'teal',  onClick:()=>setView('my'), show:true },
  ].filter(c=>c.show!==false) : role==='delegate' ? [
    { id:'general',           icon:'📢', count:pendingGeneral,         label:isEn?'General incidents':'Incidentes generales',     sub:isEn?'Unassigned — assign or close':'Sin unidad — asigna o cierra',         accent:'orange',onClick:onGeneralClick,       show:canResolve&&pendingGeneral>0 },
    { id:'ownerVerification', icon:'✅', count:pendingOwner,           label:isEn?'Need verification':'Requieren verificación',   sub:isEn?'Awaiting owner confirmation':'Esperando confirmación propietario',  accent:'amber', onClick:onOwnerClick,         show:true },
    { id:'requiresResolution',icon:'🛠️',count:pendingResolve,         label:isEn?'Ready to resolve':'Listos para resolver',       sub:isEn?'Verified, ready to close':'Verificados, listos para cerrar',        accent:'green', onClick:onResolveClick,       show:canResolve },
    { id:'registrations',     icon:'📝', count:pendingRegistrations,   label:isEn?'Registrations':'Registros',                   sub:isEn?'Pending approval':'Pendientes de aprobación',                         accent:'blue',  onClick:onRegistrationsClick, show:canManageRegistrations },
    { id:'allOpen',           icon:'⚠️', count:openCount,              label:isEn?'All open':'Total abiertos',                   sub:isEn?'Community incidents in progress':'Incidentes activos comunidad',       accent:null,    onClick:onOpenClick,          show:true },
  ].filter(x=>x.show!==false) : [
    { id:'general',           icon:'📢', count:pendingGeneral,         label:isEn?'General incidents':'Incidentes generales',     sub:isEn?'Unassigned — assign or close':'Sin unidad — asigna o cierra',         accent:'orange',onClick:onGeneralClick,       show:pendingGeneral>0 },
    { id:'allOpen',           icon:'⚠️', count:openCount,              label:isEn?'Open incidents':'Incidentes abiertos',         sub:isEn?'Community-wide open reports':'Reportes abiertos en comunidad',        accent:'red',   onClick:onOpenClick },
    { id:'ownerVerification', icon:'✅', count:pendingOwner,           label:isEn?'Need verification':'Requieren verificación',   sub:isEn?'Awaiting owner action':'Esperando acción del propietario',            accent:'amber', onClick:onOwnerClick },
    { id:'requiresResolution',icon:'🛠️',count:pendingResolve,         label:isEn?'Ready to resolve':'Listos para resolver',       sub:isEn?'Verified, ready to close':'Verificados, listos para cerrar',         accent:'green', onClick:onResolveClick },
    { id:'registrations',     icon:'📝', count:pendingRegistrations,   label:isEn?'Pending registrations':'Registros pendientes', sub:isEn?'Awaiting approval':'Esperando aprobación',                           accent:'blue',  onClick:onRegistrationsClick, show:canManageRegistrations },
  ].filter(x=>x.show!==false);

  const roleConfig = {
    standard: { icon:'🏠', title:isEn?'Your focus':'Tu enfoque',
      sub: isEn?'Verify incidents on your units and keep your listing info current.':'Verifica incidentes en tus unidades y mantén tu listing actualizado.',
      actions:[{label:isEn?'Verify pending':'Verificar pendientes',view:'incidents'},{label:isEn?'Update listing info':'Actualizar listing',view:'my'}] },
    delegate: { icon:'🛡️', title:isEn?'Delegate admin':'Admin delegado',
      sub: isEn?'Review pending registrations and resolve verified community incidents.':'Revisa registros pendientes y cierra incidentes verificados de la comunidad.',
      actions:[{label:isEn?'Registrations':'Registros',view:'approvals'},...(canResolve?[{label:isEn?'Resolve incidents':'Resolver incidentes',view:'incidents'}]:[])].slice(0,2) },
    global:   { icon:'🌐', title:isEn?'Community overview':'Vista comunidad',
      sub: isEn?'Full access — manage settings, users, analytics, and all incidents.':'Acceso total — gestiona configuración, usuarios, analíticas e incidentes.',
      actions:[{label:isEn?'Analytics':'Analíticas',view:'analytics'},{label:isEn?'Settings':'Configuración',view:'admin'}] },
  }[role];

  return (
    <div className="dash-focus card">
      <div className="dash-focus-head">
        <div>
          <strong className="dfc-role-title">{roleConfig.icon} {roleConfig.title}</strong>
          {roleConfig.sub && <p className="dfc-role-sub">{roleConfig.sub}</p>}
        </div>
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

function DashboardGreeting({ user, lang, role, pendingOwner=0, pendingOwnerResolution=0, pendingResolve=0, pendingRegistrations=0, myOpenCount=0, onOwnerClick, onResolveClick, onRegistrationsClick, setView }) {
  const isEn = lang==='en';
  const hour = new Date().getHours();
  const timeGreet = hour<12 ? (isEn?'Good morning':'Buenos días') : hour<17 ? (isEn?'Good afternoon':'Buenas tardes') : (isEn?'Good evening':'Buenas noches');
  const firstName = String(user?.name||'').split(' ')[0] || (isEn?'there':'hola');
  const urgentPills = [];
  let msg = '';

  if (role==='standard') {
    const parts=[], pills=[];
    if (pendingOwner>0) {
      parts.push(isEn?`${pendingOwner} incident${pendingOwner>1?'s':''} need your verification`:`${pendingOwner} incidente${pendingOwner>1?'s':''} esperan tu verificación`);
      pills.push(<button key="verify" className="dg-pill dg-pill-amber" onClick={onOwnerClick}>✅ {isEn?`Verify now (${pendingOwner})`:`Verificar ahora (${pendingOwner})`}</button>);
    }
    if (pendingOwnerResolution>0) {
      parts.push(isEn?`${pendingOwnerResolution} verified — add your resolution so admin can close`:`${pendingOwnerResolution} verificado${pendingOwnerResolution>1?'s':''} — agrega tu respuesta para que admin pueda cerrar`);
      pills.push(<button key="res" className="dg-pill dg-pill-amber" onClick={()=>setView('incidents')}>📝 {isEn?`Add resolution (${pendingOwnerResolution})`:`Agregar respuesta (${pendingOwnerResolution})`}</button>);
    }
    if (myOpenCount>0 && pendingOwner===0) {
      parts.push(isEn?`${myOpenCount} open report${myOpenCount>1?'s':''} on your units`:`${myOpenCount} reporte${myOpenCount>1?'s':''} abierto${myOpenCount>1?'s':''} en tus unidades`);
      if (pills.length===0) pills.push(<button key="open" className="dg-pill dg-pill-red" onClick={()=>setView('incidents')}>⚠️ {isEn?`View reports`:`Ver reportes`}</button>);
    }
    urgentPills.push(...pills);
    if (parts.length>0) {
      msg = (isEn?'Action needed: ':'Acción requerida: ')+parts.join(' · ')+'.';
    } else {
      msg = isEn ? "All units clear — no pending actions today! 🎉" : "¡Unidades al día — sin acciones pendientes hoy! 🎉";
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
  pendingOwner=0, pendingOwnerResolution=0, pendingResolve=0, pendingRegistrations=0,
  canResolve=false, canManageRegistrations=false,
  onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{}, onAddResClick=()=>{},
  onIncidentDetail=null }) {
  const isEn = lang==='en';
  const open       = incidents.filter(i=>i.status==="open");
  const resolved   = incidents.filter(i=>i.status==="resolved");
  const pendingRes = incidents.filter(i=>i.status==="verified"&&!String(i.ownerResolution||'').trim());
  const recent     = [...incidents].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  const myListings = user ? listings.filter(l=>l.ownerUid===user.uid) : [];
  const myOpen     = incidents.filter(i=>myListings.some(l=>l.id===i.aptId)&&i.status==="open");
  const generalOpen = incidents.filter(i=>i.isGeneral&&i.status!=='resolved');
  const dashRole   = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'standard';

  const stats = [
    { icon:"🏠", val:listings.length,    label:isEn?"Registered units":"Unidades registradas", color:"#2a9aaa", click:()=>setView("listings") },
    { icon:"⚠️", val:open.length,        label:isEn?"Open reports":"Reportes abiertos",         color:"#d4634a", click:()=>setView("incidents") },
    { icon:"⏳", val:pendingRes.length,   label:isEn?"Pending resolution":"Respuesta pendiente", color:"#e07b2a", click:()=>setView("incidents") },
    { icon:"✅", val:resolved.length,     label:isEn?"Closed this cycle":"Cerrados",              color:"#2e7d32" },
  ];

  return (
    <div className="fade">
      <div className="ph" style={{alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <h1 className="ptitle" style={{fontSize:'1.5rem',marginBottom:4}}>{appText(lang,"dashboard.title")}</h1>
          <p className="psub" style={{marginBottom:0}}>{appText(lang,"dashboard.subtitle")}</p>
        </div>
        {user&&<button className="btn-p btn-report" title={localizedTooltips({},lang).reportIncident} onClick={onReport}>{appText(lang,"dashboard.reportIncident")}</button>}
      </div>

      {user && <DashboardGreeting user={user} lang={lang} role={dashRole} pendingOwner={pendingOwner} pendingOwnerResolution={pendingOwnerResolution} pendingResolve={pendingResolve} pendingRegistrations={pendingRegistrations} myOpenCount={myOpen.length} onOwnerClick={onOwnerClick} onResolveClick={onResolveClick} onRegistrationsClick={onRegistrationsClick} setView={setView}/>}

      <DashboardFocus lang={lang} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} effectiveRole={effectiveRole} delegatePerms={delegatePerms} pendingOwner={pendingOwner} pendingOwnerResolution={pendingOwnerResolution} pendingResolve={pendingResolve} pendingRegistrations={pendingRegistrations} openCount={open.length} myListingCount={myListings.length} myOpenCount={myOpen.length} pendingGeneral={generalOpen.length} canResolve={canResolve} canManageRegistrations={canManageRegistrations} onOwnerClick={onOwnerClick} onResolveClick={onResolveClick} onRegistrationsClick={onRegistrationsClick} onOpenClick={()=>setView('incidents')} setView={setView} onAddResClick={onAddResClick} onGeneralClick={()=>setView('general')} />

      {/* ── My attention needed — owner's actionable incidents ── */}
      {user && myListings.length>0 && (()=>{
        const myAttnOpen = myOpen;
        const myAttnPending = incidents.filter(i=>myListings.some(l=>l.id===i.aptId)&&i.status==='verified'&&!String(i.ownerResolution||'').trim());
        if(!myAttnOpen.length&&!myAttnPending.length) return null;
        return (
          <div className="card attn-card">
            <div className="card-hdr">
              <span className="card-title">🚨 {isEn?'Needs your attention':'Requiere tu atención'}</span>
              <span className="attn-badge">{myAttnOpen.length+myAttnPending.length}</span>
            </div>
            <div className="attn-sub">{isEn?'These incidents on your units need action before admin can close them.':'Estos incidentes en tus unidades requieren tu acción antes de que el admin pueda cerrarlos.'}</div>
            {myAttnOpen.length>0&&<div className="attn-group-lbl">⚠️ {isEn?'Step 1 — Verify':'Paso 1 — Verificar'}</div>}
            {myAttnOpen.map(i=><IRow key={i.id} inc={i} compact listings={listings} contactProps={contactProps} lang={lang} onIncidentDetail={onIncidentDetail}/>)}
            {myAttnPending.length>0&&(()=>{
              const breached = myAttnPending.filter(i=>{const s=slaResInfo(i);return s&&s.isBreached;});
              const urgent   = myAttnPending.filter(i=>{const s=slaResInfo(i);return s&&!s.isBreached&&s.hoursLeft<=4;});
              return (<>
                <div className="attn-group-lbl" style={{marginTop:myAttnOpen.length?10:0}}>
                  📝 {isEn?'Step 2 — Add resolution':'Paso 2 — Agregar respuesta'}
                  {breached.length>0&&<span className="attn-sla-pill attn-sla-breached">{breached.length} SLA {isEn?'breached':'vencido'}</span>}
                  {!breached.length&&urgent.length>0&&<span className="attn-sla-pill attn-sla-urgent">{urgent.length} {isEn?'due soon':'por vencer'}</span>}
                </div>
                {myAttnPending.map(i=><IRow key={i.id} inc={i} compact listings={listings} contactProps={contactProps} lang={lang} onIncidentDetail={onIncidentDetail}/>)}
              </>);
            })()}
          </div>
        );
      })()}

      {/* ── General incidents admin attention card ── */}
      {user && (effectiveIsGlobalAdmin || effectiveRole==='delegate_admin') && generalOpen.length>0 && (
        <div className="card attn-card gen-attn-card">
          <div className="card-hdr">
            <span className="card-title">📢 {isEn?'General incidents need review':'Incidentes generales requieren revisión'}</span>
            <span className="attn-badge" style={{background:'#d9700e'}}>{generalOpen.length}</span>
          </div>
          <div className="attn-sub">{isEn
            ?'These incidents are not linked to any unit. Assign to the responsible unit (owner gets notified) or close directly.'
            :'Estos incidentes no están vinculados a ninguna unidad. Asigna a la unidad responsable (el propietario recibe aviso) o cierra directamente.'
          }</div>
          <div className="gen-attn-list">
            {generalOpen.slice(0,3).map(inc=>(
              <div key={inc.id} className="gen-attn-item">
                <span className={`gen-card-status-dot ${inc.status==='open'?'gen-dot-open':'gen-dot-wait'}`} style={{marginTop:2,flexShrink:0}}/>
                <div className="gen-attn-body">
                  <span className="gen-attn-type">{incidentTypeLabel(inc.type,lang)} · {categoryLabel(inc.category,lang)}</span>
                  <span className="gen-attn-desc">{String(inc.desc||'').slice(0,120)}{inc.desc&&inc.desc.length>120?'…':''}</span>
                  <span className="gen-attn-meta">📅 {fmtDate(inc.date)}{inc.reporterName?` · ${inc.reporterName}`:''}{inc.slaCycleCount>0?` · ⏱️ SLA ×${inc.slaCycleCount}`:''}</span>
                </div>
              </div>
            ))}
            {generalOpen.length>3&&<div style={{fontSize:'.76rem',color:'#496674',marginTop:6,paddingLeft:16}}>+{generalOpen.length-3} {isEn?'more':'más'}</div>}
          </div>
          <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn-p bsm" onClick={()=>setView('listings')}>🏠 {isEn?'Review in Inventory':'Revisar en Inventario'}</button>
            <button className="btn-ghost bsm" onClick={()=>setView('general')}>📢 {isEn?'Community tab':'Pestaña Comunidad'}</button>
          </div>
        </div>
      )}

      {/* ── Community health stats — 4 focused metrics ── */}
      <div className="stats6" style={{gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))'}}>
        {stats.map((s,i)=>(
          <div key={i} className="scard" style={{borderTop:`3px solid ${s.color}`,cursor:s.click?"pointer":"default"}} onClick={s.click}>
            <div style={{fontSize:"1.5rem"}}>{s.icon}</div>
            <div className="sval" style={{color:s.color}}>{s.val}</div>
            <div className="slabel">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Recent incident activity ── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">🕐 {isEn?'Recent incident activity':'Actividad reciente de incidentes'}</span>
          <button className="lnk" onClick={()=>setView("incidents")}>{appText(lang,"dashboard.viewAll")}</button>
        </div>
        {recent.length===0
          ? <Empty icon="✅" msg={appText(lang,"dashboard.noReports")}/>
          : recent.map(i=><IRow key={i.id} inc={i} compact listings={listings} contactProps={contactProps} lang={lang} onIncidentDetail={onIncidentDetail}/>)
        }
      </div>
    </div>
  );
}

function MyListings({ listings, allListings=listings, incidents, user, contactProps={}, isGlobalAdmin=false, canResolveGlobal=false, onAdd, onEdit, onDelete, onReport, onVerify, onResolve, onAddResolution, onNavigateToIncidents, onIncidentDetail=null, onAssign, onCloseGeneral, lang="es-CO" }) {
  const [selectedId, setSelectedId] = useState(null);
  const [statFilter, setStatFilter] = useState(null); // null | 'open' | 'pendingResolution' | 'awaitingAdmin' | 'resolved'
  const isEn = lang==='en';
  const myListingIds = new Set(listings.map(l=>l.id));
  const incAgainstMe = incidents.filter(i=>myListingIds.has(i.aptId));
  const incIReported = incidents.filter(i=>i.reporterUid===user.uid&&!myListingIds.has(i.aptId));
  const totalGuests  = listings.reduce((a,l)=>a+(l.guests||0),0);
  const openC          = incAgainstMe.filter(i=>i.status==='open').length;
  const pendingResC    = incAgainstMe.filter(i=>i.status==='verified'&&!String(i.ownerResolution||'').trim()).length;
  const awaitingAdminC = incAgainstMe.filter(i=>i.status==='verified'&& String(i.ownerResolution||'').trim()).length;
  const resolvedC      = incAgainstMe.filter(i=>i.status==='resolved').length;
  const allSorted = [...listings].sort((a,b)=>a.apt.localeCompare(b.apt));
  // Apply stat filter — verified is split into pendingResolution / awaitingAdmin
  const matchesStat = (l, sf) => incidents.some(i => i.aptId===l.id && (
    sf==='pendingResolution' ? (i.status==='verified'&&!String(i.ownerResolution||'').trim()) :
    sf==='awaitingAdmin'     ? (i.status==='verified'&& String(i.ownerResolution||'').trim()) :
    i.status===sf
  ));
  const sorted = statFilter ? allSorted.filter(l=>matchesStat(l,statFilter)) : allSorted;
  const toggleStat = (s) => { setStatFilter(f=>f===s?null:s); setSelectedId(null); };
  const goToIncidents = (l) => { /* now handled by UnitDetailCard's built-in incidents step */ };
  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang,"my.title")}</h1>
          <p className="psub">{user.name} · {listings.length} {appText(lang,"my.units")} · {totalGuests} {appText(lang,"my.guestsTotal")}</p>
        </div>
        <button className="btn-p" onClick={onAdd}>{appText(lang,"listings.add")}</button>
      </div>

      {/* ── Feature: Profile completeness warning ── */}
      {(()=>{
        const noEmailListings = listings.filter(l=>l.operator&&!l.operatorEmail);
        if(!noEmailListings.length) return null;
        return (
          <div className="profile-warn-banner">
            ⚠️ <strong>{isEn?'Incomplete operator profile':'Perfil de operador incompleto'}</strong>{' — '}
            {isEn
              ? `${noEmailListings.length} unit${noEmailListings.length!==1?'s':''} (${noEmailListings.map(l=>aptDisplay(l.apt,lang)).join(', ')}) have an operator name but no email — they won't receive incident notifications.`
              : `${noEmailListings.length} unidad${noEmailListings.length!==1?'es':''} (${noEmailListings.map(l=>aptDisplay(l.apt,lang)).join(', ')}) tienen operador sin email — no recibirán notificaciones de incidentes.`}
            {' '}<span style={{fontSize:'.78rem',opacity:.8}}>{isEn?'Edit each unit to add the operator email.':'Edita cada unidad para agregar el email del operador.'}</span>
          </div>
        );
      })()}

      {/* ── Feature: Action guide banner — "What do I do next?" ── */}
      {(openC>0||pendingResC>0)&&(
        <div className="action-guide-banner">
          <div className="agb-title">🎯 {isEn?'What do you need to do next?':'¿Qué debes hacer ahora?'}</div>
          <div className="agb-items">
            {openC>0&&(
              <button className="agb-item agb-item-warn" onClick={()=>toggleStat('open')}>
                <span className="agb-badge">{openC}</span>
                <span>⚠️ {isEn?`${openC} incident${openC!==1?'s':''} need Step 1 — verify guest & action taken`:`${openC} incidente${openC!==1?'s':''} necesita${openC!==1?'n':''} Paso 1 — verificar huésped y acción tomada`}</span>
                <span className="agb-arr">→</span>
              </button>
            )}
            {pendingResC>0&&(
              <button className="agb-item agb-item-res" onClick={()=>toggleStat('pendingResolution')}>
                <span className="agb-badge agb-badge-res">{pendingResC}</span>
                <span>📝 {isEn?`${pendingResC} incident${pendingResC!==1?'s':''} need Step 2 — add your resolution`:`${pendingResC} incidente${pendingResC!==1?'s':''} necesita${pendingResC!==1?'n':''} Paso 2 — agregar resolución`}</span>
                <span className="agb-arr">→</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Summary stats — 4 workflow states + total; click any to filter ── */}
      <div className="ml-stats">
        <div className={`ml-stat${!statFilter?' ml-stat-active':''}`} onClick={()=>toggleStat(null)} style={{cursor:'pointer'}} title={isEn?'Show all listings':'Ver todos los listings'}>
          <span className="ml-stat-val">{listings.length}</span>
          <span className="ml-stat-lbl">🏠 {isEn?'All':'Todos'}</span>
        </div>
        <div className={`ml-stat${openC>0?' ml-stat-warn':''}${statFilter==='open'?' ml-stat-active':''}`} onClick={()=>openC>0&&toggleStat('open')} style={{cursor:openC>0?'pointer':'default'}} title={isEn?'Step 1: Filter to listings needing your verification':'Paso 1: Ver listings que requieren tu verificación'}>
          <span className="ml-stat-val">{openC}</span>
          <span className="ml-stat-lbl">⚠️ {isEn?'Verify':'Verificar'}</span>
        </div>
        <div className={`ml-stat${pendingResC>0?' ml-stat-ver':''}${statFilter==='pendingResolution'?' ml-stat-active':''}`} onClick={()=>pendingResC>0&&toggleStat('pendingResolution')} style={{cursor:pendingResC>0?'pointer':'default'}} title={isEn?'Step 2: Filter to listings where you must add a resolution':'Paso 2: Ver listings donde debes agregar una resolución'}>
          <span className="ml-stat-val">{pendingResC}</span>
          <span className="ml-stat-lbl">📝 {isEn?'Add resolution':'Resolución'}</span>
        </div>
        <div className={`ml-stat${awaitingAdminC>0?' ml-stat-ver':''}${statFilter==='awaitingAdmin'?' ml-stat-active':''}`} onClick={()=>awaitingAdminC>0&&toggleStat('awaitingAdmin')} style={{cursor:awaitingAdminC>0?'pointer':'default'}} title={isEn?'Filter to listings with verified incidents awaiting admin review':'Ver listings con incidentes verificados esperando al admin'}>
          <span className="ml-stat-val">{awaitingAdminC}</span>
          <span className="ml-stat-lbl">⏳ {isEn?'Admin review':'Admin'}</span>
        </div>
        <div className={`ml-stat${resolvedC>0?' ml-stat-res':''}${statFilter==='resolved'?' ml-stat-active':''}`} onClick={()=>resolvedC>0&&toggleStat('resolved')} style={{cursor:resolvedC>0?'pointer':'default'}} title={isEn?'Filter to listings with closed incidents':'Ver listings con incidentes cerrados'}>
          <span className="ml-stat-val">{resolvedC}</span>
          <span className="ml-stat-lbl">✓ {isEn?'Closed':'Cerrados'}</span>
        </div>
      </div>
      {statFilter&&<div style={{fontSize:'.78rem',color:'#496674',marginBottom:6}}>
        {isEn?'Showing:':'Mostrando:'} <strong>{{
          open:isEn?'⚠️ Needs verification':'⚠️ Requieren verificación',
          pendingResolution:isEn?'📝 Needs resolution (Step 2)':'📝 Necesitan resolución (Paso 2)',
          awaitingAdmin:isEn?'⏳ Awaiting admin review':'⏳ Esperando revisión del admin',
          resolved:isEn?'✓ Closed':'✓ Cerrados',
        }[statFilter]}</strong> · {sorted.length} {isEn?(sorted.length===1?'listing':'listings'):'listing'+(sorted.length!==1?'s':'')} <span style={{color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'(click again to show all)':'(clic de nuevo para ver todos)'}</span>
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
                  <div className="ml-listing-row apt-cpop-wrap" onClick={()=>{ setSelectedId(isSel?null:l.id); }}>
                    <UnitPlate apt={l.apt} tower={l.tower||getDefaultTower()} size="sm"/>
                    <div className="ml-listing-chips">
                      <span className="chip c-teal">🛏️ {l.rooms}</span>
                      <span className="chip c-blue">👥 {l.guests}</span>
                    </div>
                    <div className="ml-listing-inc-pills">
                      {lOpen>0&&<span className="ml-pill ml-pill-open" title={isEn?`${lOpen} open incident${lOpen>1?'s':''} — needs attention`:`${lOpen} incidente${lOpen>1?'s':''} abierto${lOpen>1?'s':''} — requiere atención`}>⚠️ {lOpen}</span>}
                      {(() => {
                        const verPendingRes = lInc.filter(i=>i.status==='verified'&&!String(i.ownerResolution||'').trim()).length;
                        const verReady      = lInc.filter(i=>i.status==='verified'&& String(i.ownerResolution||'').trim()).length;
                        return <>
                          {verPendingRes>0&&<span className="ml-pill ml-pill-ver" title={isEn?`${verPendingRes} verified — Step 2: add your resolution so admin can close`:`${verPendingRes} verificado${verPendingRes>1?'s':''} — Paso 2: agrega resolución para que el admin pueda cerrar`}>📝 {verPendingRes}</span>}
                          {verReady>0&&<span className="ml-pill ml-pill-ver" style={{background:'rgba(11,127,79,.15)',color:'#0b5f3a'}} title={isEn?'Verified — ready to close':'Verificado — listo para cerrar'}>👤 {verReady}</span>}
                        </>;
                      })()}
                      {lRes>0&&<span className="ml-pill ml-pill-res" title={isEn?`${lRes} closed incident${lRes>1?'s':''}`:`${lRes} incidente${lRes>1?'s':''} cerrado${lRes>1?'s':''}`}>✓ {lRes}</span>}
                    </div>
                    <div className="ml-listing-acts" onClick={e=>e.stopPropagation()}>
                      <button className="bsm bs-rep" onClick={()=>onReport(l)}>+ {isEn?'Report':'Reporte'}</button>
                      <button className="bsm bs-edit" onClick={()=>onEdit(l)}>✏️</button>
                      <button className="bsm bs-del" onClick={()=>onDelete(l)}>🗑️</button>
                    </div>
                    <span className={`fls-chev${isSel?' fls-chev-up':''}`} style={{marginLeft:'auto',flexShrink:0}}>›</span>
                    <AptContactPopup ownerName={l.owner} ownerEmail={l.userEmail||l.email} ownerWaRaw={l.contact} coOwners={l.coOwners||[]} isEn={isEn}/>
                  </div>
                  {isSel&&(
                    <div className="ml-listing-detail" onClick={e=>e.stopPropagation()}>
                      <UnitDetailCard
                        l={l}
                        incidents={incidents}
                        canEdit
                        canDelete
                        onEdit={()=>onEdit(l)}
                        onDelete={()=>onDelete(l)}
                        onReport={()=>onReport(l)}
                        user={user}
                        contactProps={contactProps}
                        isGlobalAdmin={isGlobalAdmin}
                        canResolveGlobal={canResolveGlobal}
                        onVerify={onVerify}
                        onResolve={onResolve}
                        onAddResolution={onAddResolution}
                        lang={lang}
                        isEn={isEn}
                      />
                    </div>
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
            <IRow key={i.id} inc={i} user={user} listings={allListings} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canResolveGlobal={canResolveGlobal} onResolve={onResolve} onDelete={()=>{}} onVerify={onVerify} onAddResolution={onAddResolution} onIncidentDetail={onIncidentDetail} onAssign={onAssign} onCloseGeneral={onCloseGeneral} lang={lang}/>
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

// ─── Reusable apartment contact hover popup ───────────────────────────────────
// Wrap any apt header/row in <div className="apt-cpop-wrap"> to get a hover
// card showing owner email + WhatsApp (+ operator if present) with branded icons
// and direct mailto / wa.me external links.  Popup has pointer-events:none on
// the shell so the underlying click target still fires; links have auto.
function AptContactPopup({ ownerName='', ownerEmail='', ownerWaRaw='', operatorName='', operatorEmail='', opWaRaw='', coOwners=[], isEn=false }) {
  const ownerWaDigits = normalizePhoneForWhatsApp(ownerWaRaw);
  const opWaDigits    = normalizePhoneForWhatsApp(opWaRaw);
  const ownerWaOk     = !ownerWaRaw || ownerWaRaw.trim().startsWith('+');
  const hasOperator   = !!(operatorEmail || opWaDigits);
  return (
    <div className="apt-cpop" onClick={e=>e.stopPropagation()}>
      {/* Owner */}
      <div className="apt-cpop-section">
        <span className="apt-cpop-lbl">👤 {isEn?'Owner':'Propietario'}{ownerName ? ` · ${ownerName}` : ''}</span>
        {ownerEmail
          ? <a className="apt-cpop-link" href={`mailto:${ownerEmail}`}><IconEmail/><span>{ownerEmail}</span></a>
          : <span className="apt-cpop-miss">{isEn?'No email':'Sin email'}</span>}
        {ownerWaDigits
          ? <a className="apt-cpop-link" href={`https://wa.me/${ownerWaDigits}`} target="_blank" rel="noreferrer"><IconWhatsApp/><span>{ownerWaRaw}{!ownerWaOk&&<span style={{color:'#f0c040'}}> ⚠️</span>}</span></a>
          : <span className="apt-cpop-miss">{isEn?'No WhatsApp':'Sin WhatsApp'}</span>}
      </div>
      {/* Co-owners */}
      {coOwners.filter(co=>co.firstName||co.lastName).map((co,i)=>{
        const coName=[co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ');
        const coWaDigits=normalizePhoneForWhatsApp(co.whatsapp);
        return (
          <div key={i} className="apt-cpop-section">
            <span className="apt-cpop-lbl">👤 {isEn?'Co-owner':'Copropietario'}{coName?` · ${coName}`:''}</span>
            {coWaDigits
              ? <a className="apt-cpop-link" href={`https://wa.me/${coWaDigits}`} target="_blank" rel="noreferrer"><IconWhatsApp/><span>{co.whatsapp}</span></a>
              : <span className="apt-cpop-miss">{isEn?'No WhatsApp':'Sin WhatsApp'}</span>}
          </div>
        );
      })}
      {/* Operator — only if any contact info exists */}
      {hasOperator && (
        <div className="apt-cpop-section">
          <span className="apt-cpop-lbl">🔧 {isEn?'Operator':'Operador'}{operatorName ? ` · ${operatorName}` : ''}</span>
          {operatorEmail
            ? <a className="apt-cpop-link" href={`mailto:${operatorEmail}`}><IconEmail/><span>{operatorEmail}</span></a>
            : null}
          {opWaDigits
            ? <a className="apt-cpop-link" href={`https://wa.me/${opWaDigits}`} target="_blank" rel="noreferrer"><IconWhatsApp/><span>{opWaRaw}</span></a>
            : null}
        </div>
      )}
    </div>
  );
}

// ── UnitDetailCard ────────────────────────────────────────────────────────
// 3-step in-overlay navigator: Unit info → Incident list → Incident detail
function UnitDetailCard({ l, incidents, canEdit=false, canDelete=false, onEdit, onDelete, onReport,
  user, contactProps={}, isGlobalAdmin=false, canResolveGlobal=false,
  onVerify, onResolve, onAddResolution,
  defaultStep='info', defaultIncidentId=null,
  lang="es-CO", isEn=false }) {

  // step: 'info' | 'incidents' | 'incident'
  const [step, setStep] = useState(defaultStep||'info');
  const [selectedIncId, setSelectedIncId] = useState(defaultIncidentId||null);

  const goToIncident = (id) => { setSelectedIncId(id); setStep('incident'); };
  const goToList     = ()  => { setStep('incidents'); setSelectedIncId(null); };
  const goToInfo     = ()  => { setStep('info'); setSelectedIncId(null); };

  const aptInc = [...incidents.filter(i => i.aptId === l.id)]
    .sort((a,b) => new Date(b.createdAtFull||b.createdAt) - new Date(a.createdAtFull||a.createdAt));
  const ownerWa    = normalizePhoneForWhatsApp(l.contact);
  const opWa       = normalizePhoneForWhatsApp(l.operatorWhatsapp);
  const ownerEmail = l.userEmail || l.email || '';
  const hasOp      = !!(l.operator || l.operatorEmail || l.operatorWhatsapp);

  // ── Shared unit hero (always visible at top) ──────────────────────────
  const UnitHero = () => (
    <div className="adp-unit-hero">
      <div className="adp-unit-plate">
        <span className="adp-unit-num">{l.apt}</span>
        {l.tower&&<span className="adp-unit-tower">{l.tower}</span>}
      </div>
      <div className="adp-unit-meta">
        <span className="chip c-teal">🛏️ {l.rooms}</span>
        <span className="chip c-blue">👥 {l.guests}</span>
        {l.airbnb&&<a className="adp-airbnb-lnk" href={l.airbnb} target="_blank" rel="noreferrer">🔗 Airbnb</a>}
      </div>
      <div className="adp-unit-acts">
        {onReport&&<button className="bsm bs-rep" onClick={onReport}>+ {isEn?'Report':'Reporte'}</button>}
        {canEdit&&<button className="bsm bs-edit" onClick={onEdit}>✏️</button>}
        {canDelete&&<button className="bsm bs-del" onClick={onDelete}>🗑️</button>}
      </div>
    </div>
  );

  // ── Breadcrumb back navigation ────────────────────────────────────────
  const Breadcrumb = ({ crumbs }) => (
    <nav className="udc-breadcrumb" aria-label="breadcrumb">
      {crumbs.map((c,i)=>(
        <span key={i} className="udc-bc-item">
          {i>0&&<span className="udc-bc-sep">›</span>}
          {c.onClick
            ? <button type="button" className="udc-bc-link" onClick={c.onClick}>‹ {c.label}</button>
            : <span className="udc-bc-current">{c.label}</span>
          }
        </span>
      ))}
    </nav>
  );

  // ── STEP 1: Unit info + people ────────────────────────────────────────
  if (step === 'info') return (
    <div className="udc-wrap">
      <UnitHero/>
      {/* Listing details */}
      <div className="adp-section-lbl">🏠 {isEn?'Listing details':'Datos del listing'}</div>
      <div className="udc-fields">
        <span className="udc-field-lbl">{isEn?'Apt. #':'Apto. #'}</span>
        <span className="udc-field-val udc-apt-num">{l.apt}</span>
        <span className="udc-field-lbl">{isEn?'Tower':'Torre'}</span>
        <span className="udc-field-val">{l.tower||getDefaultTower()}</span>
        <span className="udc-field-lbl">{isEn?'Bedrooms':'Habitaciones'}</span>
        <span className="udc-field-val">🛏️ {l.rooms}</span>
        <span className="udc-field-lbl">{isEn?'Guests':'Huéspedes'}</span>
        <span className="udc-field-val">👥 {l.guests}</span>
        <span className="udc-field-lbl">Airbnb</span>
        <span className="udc-field-val">
          {l.airbnb ? <a href={l.airbnb} target="_blank" rel="noreferrer" className="adp-airbnb-lnk udc-airbnb-pill">🔗 {isEn?'View listing':'Ver listing'}</a> : <span className="udc-field-empty">{isEn?'No link':'Sin enlace'}</span>}
        </span>
        {l.createdAt&&<>
          <span className="udc-field-lbl">{isEn?'Date added':'Fecha de registro'}</span>
          <span className="udc-field-val" style={{color:'#496674',fontSize:'.8rem'}}>📅 {fmtDate(l.createdAt)}</span>
        </>}
      </div>
      {/* People */}
      <div className="adp-section-lbl">👥 {isEn?'People':'Personas'}</div>
      <div className="adp-contacts">
        <div className="adp-party">
          <div className="adp-party-lbl">👤 {isEn?'Owner':'Propietario'}</div>
          <div className="adp-party-row">
            <UserContact name={l.owner} uid={l.ownerUid} email={ownerEmail} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
            <div className="adp-party-cbtns">
              {ownerEmail&&<a href={`mailto:${ownerEmail}`} className="ac-cbtn" title={ownerEmail}><IconEmail/></a>}
              {ownerWa&&<a href={`https://wa.me/${ownerWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer"><IconWhatsApp/></a>}
            </div>
          </div>
        </div>
        {(l.coOwners||[]).filter(co=>co.firstName||co.lastName).map((co,i)=>{
          const coName=[co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ');
          const coWa=normalizePhoneForWhatsApp(co.whatsapp);
          return (
            <div key={i} className="adp-party">
              <div className="adp-party-lbl">👤 {isEn?`Co-owner ${i+1}`:`Copropietario ${i+1}`}</div>
              <div className="adp-party-row">
                <UserContact name={coName} email="" whatsapp={co.whatsapp} apartments={[]} {...contactProps}/>
                <div className="adp-party-cbtns">
                  {coWa&&<a href={`https://wa.me/${coWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer"><IconWhatsApp/></a>}
                </div>
              </div>
            </div>
          );
        })}
        {hasOp ? (
          <div className="adp-party">
            <div className="adp-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
            <div className="adp-party-row">
              {l.operator ? <UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={[]} {...contactProps}/> : <span style={{fontSize:'.8rem',color:'#8a9fa5'}}>{l.operatorEmail||'—'}</span>}
              <div className="adp-party-cbtns">
                {l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="ac-cbtn" title={l.operatorEmail}><IconEmail/></a>}
                {opWa&&<a href={`https://wa.me/${opWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer"><IconWhatsApp/></a>}
              </div>
            </div>
          </div>
        ) : (
          <div className="adp-party adp-party-none">
            <div className="adp-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
            <span className="adp-no-op">{isEn?'No operator assigned':'Sin operador asignado'}</span>
          </div>
        )}
      </div>
      {/* Navigate to incidents */}
      <button type="button" className="udc-nav-btn" onClick={()=>setStep('incidents')}>
        📋 {isEn?'View incidents':'Ver incidentes'}
        {aptInc.length>0&&<span className="udc-nav-badge">{aptInc.length}</span>}
        <span className="udc-nav-chev">›</span>
      </button>
    </div>
  );

  // ── STEP 2: Incident list (click → Step 3 detail) ─────────────────────
  if (step === 'incidents') return (
    <div className="udc-wrap">
      <UnitHero/>
      <Breadcrumb crumbs={[
        {label:`${isEn?'Unit':'Unidad'} ${l.apt}`, onClick: goToInfo},
        {label: isEn?'Incidents':'Incidentes'}
      ]}/>
      {aptInc.length===0
        ? <div className="adp-inc-empty" style={{marginTop:16}}>✅ {isEn?'No incidents on record':'Sin incidentes registrados'}</div>
        : <div className="udc-inc-list">
            {aptInc.map(inc=>{
              const ti = INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6];
              const ci = GUEST_CATEGORIES.find(c=>c.value===inc.category);
              const guests = normalizeOwnerGuests(inc);
              const hasPendingRes = inc.status==='verified'&&!String(inc.ownerResolution||'').trim();
              const hasAwaitingAdmin = inc.status==='verified'&&String(inc.ownerResolution||'').trim();
              const statusLabel = inc.status==='resolved'
                ? {label: isEn?'Closed':'Cerrado',   cls:'udc-s-res',  icon:'✓'}
                : inc.status==='open'
                ? {label: isEn?'Open':'Abierto',      cls:'udc-s-open', icon:'⚠️'}
                : hasPendingRes
                ? {label: isEn?'Resolution':'Respuesta', cls:'udc-s-pres', icon:'📝'}
                : {label: isEn?'Awaiting admin':'Admin', cls:'udc-s-wait', icon:'⏳'};
              return (
                <button key={inc.id} type="button" className="udc-inc-row" onClick={()=>goToIncident(inc.id)}>
                  <div className="udc-inc-row-left">
                    <div className="udc-inc-row-badges">
                      <span className="ir-type" style={{background:ti.bg,color:ti.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px',fontWeight:700}}>{incidentTypeLabel(ti.value,lang)}</span>
                      {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px'}}>{ci.icon} {categoryLabel(ci.value,lang)}</span>}
                    </div>
                    <div className="udc-inc-row-desc">{String(inc.desc||'').slice(0,100)}{String(inc.desc||'').length>100?'…':''}</div>
                    <div className="udc-inc-row-meta">
                      {guests.length>0&&<span className="udc-inc-row-guests">👥 {guests.slice(0,2).map(guestFullName).join(' · ')}{guests.length>2?` +${guests.length-2}`:''}</span>}
                      <span className="udc-inc-row-date">📅 {fmtDate(inc.date)}</span>
                    </div>
                  </div>
                  <div className="udc-inc-row-right">
                    <span className={`udc-inc-status ${statusLabel.cls}`}>{statusLabel.icon} {statusLabel.label}</span>
                    <span className="udc-inc-row-chev">›</span>
                  </div>
                </button>
              );
            })}
          </div>
      }
    </div>
  );

  // ── STEP 3: Full incident detail ───────────────────────────────────────
  if (step === 'incident') {
    const inc = incidents.find(i=>i.id===selectedIncId) || aptInc.find(i=>i.id===selectedIncId);
    if (!inc) return (
      <div className="udc-wrap">
        <UnitHero/>
        <Breadcrumb crumbs={[
          {label:`${isEn?'Unit':'Unidad'} ${l.apt}`, onClick: goToInfo},
          {label: isEn?'Incidents':'Incidentes', onClick: goToList},
          {label: isEn?'Detail':'Detalle'}
        ]}/>
        <div className="adp-inc-empty" style={{marginTop:16}}>⚠️ {isEn?'Incident not found':'Incidente no encontrado'}</div>
      </div>
    );
    const ti = INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6];
    const ci = GUEST_CATEGORIES.find(c=>c.value===inc.category);
    const guests = normalizeOwnerGuests(inc);
    const isOwner = Boolean(user?.uid && l.ownerUid === user.uid);
    const hasPendingRes = inc.status==='verified'&&!String(inc.ownerResolution||'').trim();
    const statusMeta = inc.status==='resolved'
      ? {label: isEn?'Closed':'Cerrado',         cls:'idd-status-resolved', icon:'✓'}
      : inc.status==='open'
      ? {label: isEn?'Open — action needed':'Abierto — acción requerida', cls:'idd-status-open', icon:'⚠️'}
      : hasPendingRes
      ? {label: isEn?'Verified — resolution needed':'Verificado — falta respuesta', cls:'idd-status-pres', icon:'📝'}
      : {label: isEn?'Awaiting admin close':'En espera del admin', cls:'idd-status-wait', icon:'⏳'};

    // Timeline step: icon lives inside the dot circle, title + timestamp inline
    const TlStep = ({icon, title, ts, accent, children}) => (
      <div className={`idd-tl-step${accent?' idd-tl-'+accent:''}`}>
        <div className="idd-tl-dot">{icon}</div>
        <div className="idd-tl-body">
          <div className="idd-tl-header">
            <span className="idd-tl-title">{title}</span>
            {ts&&<span className="idd-tl-ts">{fmtDateTime(ts, lang)}</span>}
          </div>
          {children&&<div className="idd-tl-content">{children}</div>}
        </div>
      </div>
    );

    return (
      <div className="udc-wrap idd-wrap">
        {/* ── Compact header bar instead of full UnitHero at step 3 ── */}
        <div className="idd-top-bar">
          <div className="idd-top-plate">
            <span className="idd-top-num">{l.apt}</span>
            <span className="idd-top-tower">{l.tower||getDefaultTower()}</span>
          </div>
          <div className="idd-top-breadcrumb">
            <button type="button" className="idd-bc-btn" onClick={goToInfo}>{isEn?'Unit':'Unidad'} {l.apt}</button>
            <span className="idd-bc-sep">›</span>
            <button type="button" className="idd-bc-btn" onClick={goToList}>{isEn?'Incidents':'Incidentes'}</button>
            <span className="idd-bc-sep">›</span>
            <span className="idd-bc-cur">{incidentTypeLabel(ti.value,lang)}</span>
          </div>
        </div>

        {/* ── Status + meta row ── */}
        <div className={`idd-status-banner ${statusMeta.cls}`}>
          <span className="idd-status-icon">{statusMeta.icon}</span>
          <span className="idd-status-label">{statusMeta.label}</span>
          <div className="idd-status-chips">
            <span className="ir-type" style={{background:ti.bg,color:ti.color,padding:'3px 9px',borderRadius:'999px',fontSize:'.67rem',fontWeight:700}}>{ti.icon||''} {incidentTypeLabel(ti.value,lang)}</span>
            {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color,padding:'3px 9px',borderRadius:'999px',fontSize:'.67rem'}}>{ci.icon} {categoryLabel(ci.value,lang)}</span>}
            <span className="idd-chip-date">📅 {fmtDate(inc.date)}</span>
          </div>
        </div>

        {/* ── Owner CTA — top of view so it's the first thing seen on mobile ── */}
        {user&&isOwner&&inc.status!=='resolved'&&(inc.status==='open'||hasPendingRes)&&(
          <div className="idd-cta-top">
            <div className="idd-cta-top-label">
              {inc.status==='open'
                ? (isEn?'① Your action is needed — Step 1 of 2':'① Tu acción es requerida — Paso 1 de 2')
                : (isEn?'② Your action is needed — Step 2 of 2':'② Tu acción es requerida — Paso 2 de 2')}
            </div>
            <div className="idd-cta-top-hint">
              {inc.status==='open'
                ? (isEn?'Confirm who your guest was and document what you did about it.':'Confirma quién fue tu huésped y documenta qué hiciste al respecto.')
                : (isEn?'Add your resolution so the admin can officially close this incident.':'Agrega tu respuesta para que el admin pueda cerrar este incidente.')}
            </div>
            {inc.status==='open'&&(
              <button className="btn-p idd-act-btn idd-cta-btn" onClick={()=>onVerify&&onVerify(inc)}>
                ① {isEn?'Verify now — add guest info & action':'Verificar ahora — agregar info del huésped y acción'}
              </button>
            )}
            {inc.status==='verified'&&hasPendingRes&&(
              <button className="btn-p idd-act-btn idd-cta-btn" onClick={()=>onAddResolution&&onAddResolution(inc)}>
                ② {isEn?'Add your resolution now':'Agregar tu respuesta ahora'}
              </button>
            )}
          </div>
        )}

        {/* ── Responsible parties ── */}
        <div className="idd-parties">
          <div className="idd-parties-hdr">👥 {isEn?'Incident Parties':'Partes del Incidente'}</div>
          <div className="idd-parties-grid">
            <div className="idd-pi-item">
              <span className="idd-pi-role">📋 {isEn?'Reporter':'Reportado por'}</span>
              <span className="idd-pi-name">{inc.reporterName||'—'}</span>
            </div>
            <div className="idd-pi-item idd-pi-owner">
              <span className="idd-pi-role">🏠 {isEn?'Owner':'Propietario'}{inc.status!=='resolved'&&<span className="idd-pi-resp-badge">{isEn?'Responsible — Steps 1 & 2':'Responsable — Pasos 1 y 2'}</span>}</span>
              <span className="idd-pi-name">{l.owner||ownerEmail||'—'}</span>
              {(ownerEmail||ownerWa)&&(
                <div className="idd-pi-contacts">
                  {ownerEmail&&<a href={`mailto:${ownerEmail}`} className="idd-pi-link">✉️ {ownerEmail}</a>}
                  {ownerWa&&<a href={`https://wa.me/${ownerWa}`} target="_blank" rel="noopener noreferrer" className="idd-pi-link idd-pi-wa">💬 WhatsApp</a>}
                </div>
              )}
            </div>
            <div className="idd-pi-item">
              <span className="idd-pi-role">🔧 {isEn?'Operator':'Operador'}</span>
              {hasOp?(
                <>
                  <span className="idd-pi-name">{l.operator||l.operatorEmail||'—'}</span>
                  {(l.operatorEmail||opWa)&&(
                    <div className="idd-pi-contacts">
                      {l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="idd-pi-link">✉️ {l.operatorEmail}</a>}
                      {opWa&&<a href={`https://wa.me/${opWa}`} target="_blank" rel="noopener noreferrer" className="idd-pi-link idd-pi-wa">💬 WhatsApp</a>}
                    </div>
                  )}
                </>
              ):(
                <span className="idd-pi-none">{isEn?'No operator assigned':'Sin operador asignado'}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Owner action callout ── */}
        {user&&inc.status!=='resolved'&&isOwner&&(
          <div className={`udc-action-needed${inc.status==='open'?' udc-an-step1':' udc-an-step2'}`}>
            <div className="udc-an-step-num">{inc.status==='open'?'①':'②'}</div>
            <div className="udc-an-body">
              <strong>{inc.status==='open'?(isEn?'Your action needed — Step 1 of 2':'Tu acción — Paso 1 de 2'):(isEn?'Your action needed — Step 2 of 2':'Tu acción — Paso 2 de 2')}</strong>
              <span>{inc.status==='open'?(isEn?'Confirm guest details and document your immediate action.':'Confirma datos del huésped y documenta tu acción inmediata.'):(isEn?'Add your resolution so admin can close this incident.':'Agrega tu respuesta para que el admin pueda cerrar.')}</span>
              {inc.status==='open'&&<span className="udc-an-hint">{isEn?'Step 2 (resolution) will also be required before admin can close.':'El Paso 2 (respuesta) también será requerido para que el admin pueda cerrar.'}</span>}
              {inc.status==='verified'&&hasPendingRes&&(()=>{
                const sla = slaResInfo(inc);
                if (!sla) return null;
                const label = sla.isBreached
                  ? `⏰ ${isEn?`SLA breached — ${Math.abs(sla.hoursLeft)}h overdue`:`SLA vencido — ${Math.abs(sla.hoursLeft)}h de retraso`}${sla.cycleCount>0?` · ${sla.cycleCount} ${isEn?`reminder${sla.cycleCount>1?'s':''} sent`:`recordatorio${sla.cycleCount>1?'s':''} enviado${sla.cycleCount>1?'s':''}`}`:''}`
                  : `⏰ ${isEn?`Resolution due in ${sla.hoursLeft}h`:`Respuesta requerida en ${sla.hoursLeft}h`}${sla.cycleCount>0?` · ${sla.cycleCount} ${isEn?`reminder${sla.cycleCount>1?'s':''} sent`:`recordatorio${sla.cycleCount>1?'s':''} enviado${sla.cycleCount>1?'s':''}`}`:''}`;
                return <span className={`udc-sla-dl${sla.isBreached?' udc-sla-breached':sla.hoursLeft<=4?' udc-sla-urgent':''}`}>{label}</span>;
              })()}
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        <div className="idd-timeline">
          <TlStep icon="📋" title={isEn?'Filed':'Reportado'} ts={inc.createdAtFull||inc.createdAt} accent="filed"/>

          <TlStep icon="📝" title={isEn?'Description':'Descripción'} accent="desc">
            <p className="idd-tl-desc">{inc.desc}</p>
            {Array.isArray(inc.photos)&&inc.photos.length>0&&(
              <div className="inc-photo-row" style={{marginTop:8}}>
                {inc.photos.map((p,i)=>(
                  <img key={i} src={p.data} alt={p.name||`photo-${i+1}`} className="inc-photo-thumb"
                    title={isEn?'Click to view full size':'Clic para ver tamaño completo'}
                    onClick={()=>window.open(p.data,'_blank')}/>
                ))}
              </div>
            )}
          </TlStep>

          {guests.length>0&&(
            <TlStep icon="👥" title={isEn?'Guests':'Huéspedes'} ts={inc.ownerVerifiedAt} accent="guests">
              <div className="idd-tl-guests">
                {guests.map((g,i)=>(
                  <div key={i} className="idd-tl-guest-row">
                    <span className="idd-tl-guest-name">{guestFullName(g)}</span>
                    {guestLocation(g)&&<span className="idd-tl-guest-loc">📍 {guestLocation(g)}</span>}
                  </div>
                ))}
              </div>
            </TlStep>
          )}

          {inc.ownerComments&&(
            <TlStep icon="✅" title={isEn?'Action taken':'Acción tomada'} ts={inc.ownerVerifiedAt} accent="action">
              <blockquote className="idd-tl-blockquote">{inc.ownerComments}</blockquote>
            </TlStep>
          )}

          {inc.ownerResolution&&(
            <TlStep icon="🔍" title={isEn?'Resolution':'Respuesta'} ts={inc.ownerResolutionAt||inc.ownerVerifiedAt} accent="resolution">
              <blockquote className="idd-tl-blockquote idd-tl-blockquote-res">{inc.ownerResolution}</blockquote>
            </TlStep>
          )}

          {inc.status==='resolved'&&(
            <TlStep icon="🏁" title={isEn?'Closed':'Cerrado'} ts={inc.resolvedAt} accent="closed">
              {inc.resolvedBy&&<span className="idd-tl-reporter">{isEn?'Closed by':'Cerrado por'}: <strong>{inc.resolvedBy}</strong></span>}
              {inc.resolutionComments&&<blockquote className="idd-tl-blockquote" style={{marginTop:6}}>{inc.resolutionComments}</blockquote>}
            </TlStep>
          )}
        </div>

        {/* ── Workflow progress ── */}
        {(()=>{
          const steps = [
            { label: isEn?'Reported':'Reportado',       done: true,                                                                          mine: false },
            { label: isEn?'Owner verifies':'Verifica',   done: inc.status!=='open',                                                           mine: inc.status==='open'&&isOwner },
            { label: isEn?'Owner resolves':'Responde',   done: Boolean(String(inc.ownerResolution||'').trim()),                               mine: inc.status==='verified'&&hasPendingRes&&isOwner },
            { label: isEn?'Admin closes':'Admin cierra', done: inc.status==='resolved',                                                       mine: (isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes },
          ];
          const nodes = [];
          steps.forEach((s,i)=>{
            if (i>0) nodes.push(<div key={`l${i}`} className={`inc-step-line${steps[i-1].done?' isl-done':''}`}/>);
            nodes.push(
              <div key={`s${i}`} className={`inc-step${s.done?' inc-step-done':s.mine?' inc-step-active':' inc-step-idle'}`}>
                <span className="inc-step-dot">{s.done?'✓':i+1}</span>
                <span className="inc-step-lbl">{s.label}</span>
                {s.mine&&<span className="inc-step-you">{isEn?'← yours':'← tú'}</span>}
              </div>
            );
          });
          return <div className="inc-steps">{nodes}</div>;
        })()}

        {/* ── Bottom action bar — admin actions + owner completion state ── */}
        {user&&inc.status!=='resolved'&&(
          <div className="idd-actions">
            {isOwner&&inc.status==='verified'&&!hasPendingRes&&(
              <div className="udc-step-done">
                ✓ {isEn?'Both steps complete — awaiting admin close':'Pasos completados — esperando cierre del admin'}
              </div>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes&&(
              <button className="bsm bs-resolve idd-act-btn" onClick={()=>onResolve&&onResolve(inc.id)}>
                {isEn?'Close incident':'Cerrar incidente'}
              </button>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&hasPendingRes&&(
              <div className="udc-admin-waiting" style={{textAlign:'center',width:'100%'}}>
                🔒 {isEn?'Waiting for owner resolution (Step 2)':'Esperando respuesta del propietario (Paso 2)'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// AptDoor: only the number plate and "View incidents" footer are interactive.
// The card body is display-only (hover reveals contact popup).
function AptDoor({ l, incidents, onUnitDetail, onViewIncidents, onPillFilter, lang, isEn }) {
  const status = aptDoorStatus(l, incidents);
  const aptInc         = incidents.filter(i => i.aptId === l.id);
  const openCount      = aptInc.filter(i => i.status === 'open').length;
  const pendingResCount= aptInc.filter(i => i.status === 'verified' && !String(i.ownerResolution||'').trim()).length;
  const awaitingCount  = aptInc.filter(i => i.status === 'verified' &&  String(i.ownerResolution||'').trim()).length;
  const resolvedCount  = aptInc.filter(i => i.status === 'resolved').length;
  const totalCount     = aptInc.length;
  const ownerEmail = l.userEmail || l.email || '';
  const ownerWaRaw = l.contact || '';
  return (
    <div className={`apt-door apt-door-${status} apt-cpop-wrap`}>
      {/* Status colour bar */}
      <div className={`door-status-bar door-sb-${status}`}/>

      {/* ★ CLICKABLE: Number plate — uses UnitPlate for consistent style */}
      <UnitPlate
        apt={l.apt}
        tower={l.tower||getDefaultTower()}
        size="door"
        onClick={()=>onUnitDetail&&onUnitDetail(l.id)}
        title={isEn?'View unit details':'Ver detalles de la unidad'}
        className="door-num-plate door-num-plate-btn"
      />

      {/* Display-only card body — hover reveals contact popup */}
      <div className="door-body">
        <div className="door-owner" title={l.owner}>{l.owner||'—'}</div>
        {l.operator&&<div className="door-op" title={l.operator}>🔧 {l.operator}</div>}
        <div className="door-chips">
          <span className="door-chip">🛏️ {l.rooms}</span>
          <span className="door-chip">👥 {l.guests}</span>
        </div>
      </div>

      {/* ★ CLICKABLE: Incident count pills → navigate to filtered incidents */}
      <div className="door-inc-summary">
        {totalCount===0
          ? <span className="dis-clean">✅ {isEn?'No incidents':'Sin incidentes'}</span>
          : <>
              {openCount>0      &&<button type="button" className="dis-pill dis-open"        onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'open'})}          title={isEn?`${openCount} open — click to filter`:`${openCount} abierto${openCount>1?'s':''} — clic para filtrar`}>⚠️ {openCount}</button>}
              {pendingResCount>0&&<button type="button" className="dis-pill dis-pending-res" onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'pendingResolution'})} title={isEn?`${pendingResCount} add resolution — click to filter`:`${pendingResCount} agregar resolución — clic para filtrar`}>📝 {pendingResCount}</button>}
              {awaitingCount>0  &&<button type="button" className="dis-pill dis-ver"         onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'awaitingAdmin'})}  title={isEn?`${awaitingCount} awaiting admin — click to filter`:`${awaitingCount} esperando admin — clic para filtrar`}>⏳ {awaitingCount}</button>}
              {resolvedCount>0  &&<button type="button" className="dis-pill dis-res"         onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'resolved'})}      title={isEn?`${resolvedCount} closed — click to filter`:`${resolvedCount} cerrado${resolvedCount>1?'s':''} — clic para filtrar`}>✓ {resolvedCount}</button>}
            </>
        }
      </div>

      {/* Contact popup — hover only, not a click target */}
      <AptContactPopup ownerName={l.owner} ownerEmail={ownerEmail} ownerWaRaw={ownerWaRaw} operatorName={l.operator} operatorEmail={l.operatorEmail} opWaRaw={l.operatorWhatsapp} coOwners={l.coOwners||[]} isEn={isEn}/>

      {/* ★ CLICKABLE: Footer → open incident popup for this unit */}
      <button
        type="button"
        className="door-footer door-footer-btn"
        onClick={()=>onViewIncidents&&onViewIncidents(l.id)}
        title={isEn?'View incidents for this unit':'Ver incidentes de esta unidad'}
      >
        👆 {isEn?'View incidents':'Ver incidentes'}
      </button>
    </div>
  );
}

function AptDetailPanel({ l, incidents, contactProps={}, canEdit, canDelete, onEdit, onDelete, onReport, onClose, user, isGlobalAdmin, canResolveGlobal, onVerify, onResolve, onAddResolution, lang, isEn }) {
  const aptInc = [...incidents.filter(i=>i.aptId===l.id)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const ownerWa = normalizePhoneForWhatsApp(l.contact);
  const opWa = normalizePhoneForWhatsApp(l.operatorWhatsapp);
  const hasOp = !!(l.operator||l.operatorEmail||l.operatorWhatsapp);
  // Group expand/collapse state for the detail panel
  const [panelGO, setPanelGO] = useState({open:true, verified:true, resolved:false});

  return (
    <div className="adp-wrap">
      {/* ── Unit header ── */}
      <div className="adp-unit-hero">
        <div className="adp-unit-plate">
          <span className="adp-unit-num">{l.apt}</span>
          {l.tower&&<span className="adp-unit-tower">{l.tower}</span>}
        </div>
        <div className="adp-unit-meta">
          <span className="chip c-teal" title={isEn?`${l.rooms} bedrooms`:`${l.rooms} habitaciones`}>🛏️ {l.rooms}</span>
          <span className="chip c-blue" title={isEn?`Up to ${l.guests} guests`:`Capacidad ${l.guests} huéspedes`}>👥 {l.guests}</span>
          {l.airbnb&&<a className="adp-airbnb-lnk" href={l.airbnb} target="_blank" rel="noreferrer" title="Airbnb listing">🔗 Airbnb</a>}
        </div>
        <div className="adp-unit-acts">
          <button className="bsm bs-rep" onClick={onReport}>+ {isEn?'Report':'Reporte'}</button>
          {canEdit&&<button className="bsm bs-edit" onClick={onEdit} title={isEn?'Edit unit':'Editar unidad'}>✏️</button>}
          {canDelete&&<button className="bsm bs-del" onClick={onDelete} title={isEn?'Delete unit':'Eliminar unidad'}>🗑️</button>}
        </div>
      </div>

      {/* ── People: owner + operator ── */}
      <div className="adp-section-lbl">👥 {isEn?'People':'Personas'}</div>
      <div className="adp-contacts">
        <div className="adp-party">
          <div className="adp-party-lbl">👤 {isEn?'Owner':'Propietario'}</div>
          <div className="adp-party-row">
            <UserContact name={l.owner} uid={l.ownerUid} email={l.userEmail||l.email} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
            <div className="adp-party-cbtns">
              {(l.userEmail||l.email)&&<a href={`mailto:${l.userEmail||l.email}`} className="ac-cbtn" title={l.userEmail||l.email}><IconEmail/></a>}
              {ownerWa&&<a href={`https://wa.me/${ownerWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer" title="WhatsApp"><IconWhatsApp/></a>}
            </div>
          </div>
        </div>
        {hasOp ? (
          <div className="adp-party">
            <div className="adp-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
            <div className="adp-party-row">
              {l.operator ? <UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={[]} {...contactProps}/> : <span style={{fontSize:'.8rem',color:'#8a9fa5'}}>{l.operatorEmail||'—'}</span>}
              <div className="adp-party-cbtns">
                {l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="ac-cbtn" title={l.operatorEmail}><IconEmail/></a>}
                {opWa&&<a href={`https://wa.me/${opWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer" title="WhatsApp"><IconWhatsApp/></a>}
              </div>
            </div>
          </div>
        ) : (
          <div className="adp-party adp-party-none">
            <div className="adp-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
            <span className="adp-no-op">{isEn?'No operator assigned':'Sin operador asignado'}</span>
          </div>
        )}
      </div>

      {/* ── Incident history ── */}
      <div className="adp-section-lbl">📋 {isEn?'Incident history':'Historial de incidentes'} <span className="adp-inc-count">{aptInc.length}</span></div>
      <div className="adp-incidents">
        {aptInc.length===0
          ? <div className="adp-inc-empty">✅ {isEn?'No incidents on record':'Sin incidentes registrados'}</div>
          : <div className="adp-wfg-list">
              {[
                {key:'open',     icon:'⚠️', label:isEn?'Verify required':'Verificación requerida', sublabel:isEn?'Step 1: Owner must verify and document action taken':'Paso 1: El propietario debe verificar y documentar la acción tomada', color:'#d9a030'},
                {key:'verified', icon:'📝', label:isEn?'In Progress':'En progreso',                sublabel:isEn?'Step 2: Add resolution · or awaiting admin review':'Paso 2: Agrega resolución · o esperando revisión del admin',           color:'#0b7f4f'},
                {key:'resolved', icon:'✓',  label:isEn?'Closed':'Cerrados',                        sublabel:isEn?'Resolved by management':'Resuelto por administración',                                                                      color:'#6a9a7a'},
              ].map(g => {
                const gInc = aptInc.filter(i => i.status === g.key);
                if (gInc.length === 0) return null;
                return (
                  <WorkflowGroup
                    key={g.key}
                    statusKey={g.key}
                    icon={g.icon}
                    label={g.label}
                    sublabel={g.sublabel}
                    color={g.color}
                    incidents={gInc}
                    listings={[l]}
                    isOpen={panelGO[g.key]}
                    onToggle={()=>setPanelGO(s=>({...s,[g.key]:!s[g.key]}))}
                    user={user}
                    contactProps={contactProps}
                    isGlobalAdmin={isGlobalAdmin}
                    canUpdateGlobal={false}
                    canDeleteGlobal={false}
                    canResolveGlobal={canResolveGlobal}
                    onResolve={onResolve}
                    onDelete={()=>{}}
                    onVerify={onVerify}
                    onAddResolution={onAddResolution}
                    onIncidentDetail={onIncidentDetail}
                    hideUnit
                    lang={lang}
                    isEn={isEn}
                  />
                );
              })}
            </div>
        }
      </div>
    </div>
  );
}

function BuildingFloor({ floor, apts, incidents, user, contactProps, isGlobalAdmin, canEditGlobal, canDeleteGlobal, canResolveGlobal, onEdit, onDelete, onReport, onVerify, onResolve, onAddResolution, onFloorFilter, isOpen, onToggle, lang, isEn }) {
  const [unitDetailAptId, setUnitDetailAptId] = useState(null);
  const [unitDetailStep, setUnitDetailStep] = useState('info');
  const color = floorColor(floor);
  const floorInc       = incidents.filter(i=>apts.some(l=>l.id===i.aptId));
  const openCount      = floorInc.filter(i=>i.status==='open').length;
  const verPendingRes  = floorInc.filter(i=>i.status==='verified'&&!String(i.ownerResolution||'').trim()).length;
  const verAwaiting    = floorInc.filter(i=>i.status==='verified'&& String(i.ownerResolution||'').trim()).length;
  const resCount       = floorInc.filter(i=>i.status==='resolved').length;
  return (
    <div className="bld-floor">
      <button className="bld-floor-hdr" style={{borderLeftColor:color}} onClick={onToggle}>
        <div className="bld-floor-id">
          <span className="bld-floor-level">{isEn?'FLOOR':'PISO'}</span>
          <span className="bld-floor-num" style={{color}}>{floor}</span>
        </div>
        <div className="bld-floor-stats">
          <span className="bld-stat-pill bld-stat-apts" title={isEn?`${apts.length} unit${apts.length===1?'':'s'} on this floor`:`${apts.length} unidad${apts.length===1?'':'es'} en este piso`}>🏠 {apts.length} {isEn?(apts.length===1?'apt':'apts'):'apto'+(apts.length>1?'s':'')}</span>
          {openCount>0     && <button type="button" className="bld-stat-pill bld-stat-inc bld-stat-btn" title={isEn?`${openCount} open — Step 1: verify required · click to filter`:`${openCount} abierto${openCount>1?'s':''} — Paso 1: verificación requerida`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'open'});}}>⚠️ {openCount} {isEn?'verify':'verificar'}</button>}
          {verPendingRes>0 && <button type="button" className="bld-stat-pill bld-stat-ver bld-stat-btn" title={isEn?`${verPendingRes} verified — Step 2: add resolution · click to filter`:`${verPendingRes} verificado${verPendingRes>1?'s':''} — Paso 2: agregar resolución`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'pendingResolution'});}}>📝 {verPendingRes} {isEn?'add res.':'resolución'}</button>}
          {verAwaiting>0   && <button type="button" className="bld-stat-pill bld-stat-ver bld-stat-btn" style={{background:'rgba(11,127,79,.08)',color:'#0b5f3a',borderColor:'rgba(11,127,79,.2)'}} title={isEn?`${verAwaiting} awaiting admin review · click to filter`:`${verAwaiting} esperando revisión del admin`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'awaitingAdmin'});}}>⏳ {verAwaiting} {isEn?'admin':'admin'}</button>}
          {resCount>0      && <button type="button" className="bld-stat-pill bld-stat-res bld-stat-btn" title={isEn?`${resCount} closed · click to filter`:`${resCount} cerrado${resCount>1?'s':''}`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'resolved'});}}>✓ {resCount} {isEn?'closed':'cerrados'}</button>}
        </div>
        <span className={`bld-chev${isOpen?' bld-chev-up':''}`}>›</span>
      </button>

      {isOpen && (
        <div className="bld-floor-body">
          <div className="bld-door-grid">
            {apts.map(l=>(
              <AptDoor
                key={l.id}
                l={l}
                incidents={incidents}
                onUnitDetail={id=>{setUnitDetailAptId(id);setUnitDetailStep('info');}}
                onViewIncidents={id=>{setUnitDetailAptId(id);setUnitDetailStep('incidents');}}
                onPillFilter={f=>{onFloorFilter&&onFloorFilter(f);}}
                lang={lang}
                isEn={isEn}
              />
            ))}
          </div>
        </div>
      )}
      {/* Unit detail overlay — opens on number plate click; incidents expand inside */}
      {unitDetailAptId && (() => {
        const udApt = apts.find(l=>l.id===unitDetailAptId);
        if (!udApt) return null;
        return (
          <Overlay onClose={()=>{setUnitDetailAptId(null);setUnitDetailStep('info');}} wide>
            <UnitDetailCard
              key={`${udApt.id}-${unitDetailStep}`}
              l={udApt}
              incidents={incidents}
              canEdit={user?.uid===udApt.ownerUid||isGlobalAdmin||canEditGlobal}
              canDelete={user?.uid===udApt.ownerUid||isGlobalAdmin||canDeleteGlobal}
              onEdit={()=>{setUnitDetailAptId(null);onEdit(udApt);}}
              onDelete={()=>{setUnitDetailAptId(null);onDelete(udApt);}}
              onReport={()=>{setUnitDetailAptId(null);onReport(udApt);}}
              user={user}
              contactProps={contactProps}
              isGlobalAdmin={isGlobalAdmin}
              canResolveGlobal={canResolveGlobal}
              onVerify={onVerify}
              onResolve={onResolve}
              onAddResolution={onAddResolution}
              defaultStep={unitDetailStep}
              lang={lang}
              isEn={isEn}
            />
          </Overlay>
        );
      })()}
    </div>
  );
}

// Keep old FloorSection + AptRow for list-mode compatibility
function AptRow({ l, incCount, user, contactProps={}, isGlobalAdmin=false, canEditGlobal=false, canDeleteGlobal=false, onEdit, onDelete, onReport, lang, isEn }) {
  const [expanded, setExpanded] = useState(false);
  const hasOp   = !!(l.operator||l.operatorEmail||l.operatorWhatsapp);
  const canEdit   = user?.uid===l.ownerUid||isGlobalAdmin||canEditGlobal;
  const canDelete = user?.uid===l.ownerUid||isGlobalAdmin||canDeleteGlobal;
  return (
    <div className={`fls-row${expanded?' fls-row-open':''}`}>
      <div className="fls-row-main apt-cpop-wrap" onClick={()=>setExpanded(x=>!x)} role="button" aria-expanded={expanded}>
        <span className="fls-apt-num">{isEn?'Apt.':'Apto.'} {l.apt}</span>
        <span className="fls-owner-wrap"><UserContact name={l.owner} uid={l.ownerUid} email={l.userEmail||l.email} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/></span>
        {hasOp&&<span className="fls-op-pill">🔧 {l.operator||'—'}</span>}
        <span className="fls-row-chips"><span className="chip c-teal">🛏️ {l.rooms}</span><span className="chip c-blue">👥 {l.guests}</span></span>
        {incCount>0&&<span className="fls-inc-pill">⚠️ {incCount}</span>}
        <span className={`fls-chev${expanded?' fls-chev-up':''}`}>›</span>
        <AptContactPopup
          ownerName={l.owner}
          ownerEmail={l.userEmail||l.email}
          ownerWaRaw={l.contact}
          operatorName={l.operator}
          operatorEmail={l.operatorEmail}
          opWaRaw={l.operatorWhatsapp}
          coOwners={l.coOwners||[]}
          isEn={isEn}
        />
      </div>
      {expanded&&(
        <div className="fls-row-detail" onClick={e=>e.stopPropagation()}>
          {hasOp&&<div className="fls-det-row"><span className="fls-det-lbl">🔧 {isEn?'Operator':'Operador'}</span><span className="fls-det-val">{l.operator?<UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={[]} {...contactProps}/>:<span style={{fontSize:'.8rem',color:'#8a9fa5'}}>{isEn?'No name':'Sin nombre'}</span>}<span className="fls-det-acts">{l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="ac-cbtn" title={l.operatorEmail}><IconEmail/></a>}{opWa&&<a href={`https://wa.me/${opWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer" title="WhatsApp"><IconWhatsApp/></a>}</span></span></div>}
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

function GeneralListingsSection({ incidents, isGlobalAdmin=false, canResolveGlobal=false, onAssign, onCloseGeneral, onIncidentDetail, lang='es-CO' }) {
  const isEn = lang === 'en';
  const canAct = isGlobalAdmin || canResolveGlobal;
  const generalOpen = incidents.filter(i => i.isGeneral && i.status !== 'resolved')
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [open, setOpen] = useState(false);

  return (
    <div className="gen-ls-section">
      <button className="gen-ls-hdr" onClick={() => setOpen(o => !o)}>
        <span className="gen-ls-icon">📢</span>
        <div className="gen-ls-hdr-body">
          <span className="gen-ls-label">{isEn ? 'General — Unassigned' : 'General — Sin unidad'}</span>
          {generalOpen.length > 0
            ? <span className="gen-ls-sublabel">{canAct
                ? (isEn ? 'Assign to a unit or close directly' : 'Asigna a una unidad o cierra directamente')
                : (isEn ? 'Community incidents under admin review' : 'Incidentes de comunidad en revisión')}</span>
            : <span className="gen-ls-sublabel gen-ls-sublabel-ok">{isEn ? 'No open general incidents' : 'Sin incidentes generales abiertos'}</span>
          }
        </div>
        {generalOpen.length > 0 && <span className="gen-ls-badge">{generalOpen.length}</span>}
        <span className={`fls-chev${open ? ' fls-chev-up' : ''}`}>›</span>
      </button>

      {open && (
        <div className="gen-ls-body">
          {generalOpen.length === 0 ? (
            <div className="gen-ls-empty">✅ {isEn ? 'All community incidents have been addressed.' : 'Todos los incidentes de la comunidad han sido atendidos.'}</div>
          ) : (
            <>
              {canAct && (
                <div className="gen-ls-admin-banner">
                  🔔 {isEn
                    ? `${generalOpen.length} general incident${generalOpen.length > 1 ? 's' : ''} need${generalOpen.length === 1 ? 's' : ''} admin review — assign to a unit so the owner is notified, or close directly.`
                    : `${generalOpen.length} incidente${generalOpen.length > 1 ? 's' : ''} general${generalOpen.length > 1 ? 'es' : ''} requiere${generalOpen.length > 1 ? 'n' : ''} revisión — asigna a una unidad para notificar al propietario, o cierra directamente.`}
                </div>
              )}
              <div className="gen-list" style={{marginTop:10}}>
                {generalOpen.map(inc => (
                  <div key={inc.id} className="gen-card">
                    <div className="gen-card-header">
                      <span className={`gen-card-status-dot ${inc.status === 'open' ? 'gen-dot-open' : 'gen-dot-wait'}`} />
                      <span className="gen-card-type">{incidentTypeLabel(inc.type, lang)}</span>
                      <span className="gen-card-cat">{categoryLabel(inc.category, lang)}</span>
                      <span className="gen-card-date">📅 {fmtDate(inc.date)}</span>
                      {(()=>{
                        const now = new Date();
                        const deadline = inc.nextSlaReminderAt ? new Date(inc.nextSlaReminderAt) : null;
                        const hoursLeft = deadline ? Math.round((deadline - now) / 3600000) : null;
                        if (inc.slaCycleCount > 0 && hoursLeft !== null && hoursLeft < 0) {
                          return <span className="gen-card-sla gen-card-sla-breach">🔴 SLA {isEn?'overdue':'vencido'} ×{inc.slaCycleCount}</span>;
                        }
                        if (inc.slaCycleCount > 0) return <span className="gen-card-sla">⏱️ ×{inc.slaCycleCount}</span>;
                        if (hoursLeft !== null && hoursLeft <= 4 && hoursLeft >= 0) return <span className="gen-card-sla gen-card-sla-urgent">🟠 {isEn?`${hoursLeft}h`:`${hoursLeft}h`}</span>;
                        return null;
                      })()}
                      {onIncidentDetail && <button className="ir-detail-pill" onClick={() => onIncidentDetail(inc.id)}>{isEn ? 'Details' : 'Detalles'} ›</button>}
                    </div>
                    <p className="gen-card-desc">{inc.desc}</p>
                    {inc.reporterName && <div className="gen-card-reporter">📋 {isEn ? 'Reported by' : 'Reportado por'}: {inc.reporterName}</div>}
                    {Array.isArray(inc.photos) && inc.photos.length > 0 && (
                      <div className="inc-photo-row">
                        {inc.photos.slice(0, 3).map((p, i) => <img key={i} src={p.data} alt={p.name || `photo-${i+1}`} className="inc-photo-thumb" onClick={() => window.open(p.data, '_blank')} />)}
                        {inc.photos.length > 3 && <span className="gen-card-reporter" style={{alignSelf:'center'}}>+{inc.photos.length - 3}</span>}
                      </div>
                    )}
                    {canAct && (
                      <div className="gen-card-acts">
                        <button className="btn-p bsm" onClick={() => onAssign && onAssign(inc)}>🏠 {isEn ? 'Assign to unit' : 'Asignar a unidad'}</button>
                        <button className="btn-ghost bsm" onClick={() => onCloseGeneral && onCloseGeneral(inc)}>✓ {isEn ? 'Close directly' : 'Cerrar directamente'}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OwnerDirectoryView({ listings, lang }) {
  const isEn = lang === 'en';
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();

  // Build a flat list of owner entries (primary + co-owners) with their listing reference
  const results = [];
  for (const l of listings) {
    // Primary owner
    const primaryMatch = !ql ||
      String(l.owner||'').toLowerCase().includes(ql) ||
      String(l.email||'').toLowerCase().includes(ql) ||
      String(l.userEmail||'').toLowerCase().includes(ql) ||
      String(l.apt||'').includes(ql) ||
      String(l.contact||'').replace(/\s/g,'').includes(ql.replace(/\s/g,''));
    if (primaryMatch) {
      results.push({ type:'primary', name:l.owner||'—', email:l.email||l.userEmail||'', whatsapp:l.contact||'', apt:l.apt, listingId:l.id });
    }
    // Co-owners
    for (const co of (l.coOwners||[])) {
      const fullName = [co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ');
      const coMatch = !ql ||
        fullName.toLowerCase().includes(ql) ||
        String(co.whatsapp||'').replace(/\s/g,'').includes(ql.replace(/\s/g,'')) ||
        String(l.apt||'').includes(ql);
      if (coMatch) {
        results.push({ type:'co', name:fullName||'—', email:'', whatsapp:co.whatsapp||'', apt:l.apt, listingId:l.id });
      }
    }
  }

  return (
    <div>
      <div style={{position:'relative',marginBottom:14}}>
        <input className="search" style={{paddingRight:36}} placeholder={isEn?'Search by name, email, unit or WhatsApp…':'Buscar por nombre, email, unidad o WhatsApp…'} value={q} onChange={e=>setQ(e.target.value)}/>
        {q&&<button className="inc-search-clear" onClick={()=>setQ('')}>✕</button>}
      </div>
      {results.length===0
        ? <EmptyState icon="👤" title={isEn?'No owners found':'Sin resultados'} sub={isEn?'Try a different search term.':'Intenta con otro término.'}/>
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {results.map((r,i)=>(
              <div key={i} style={{background:'#fff',border:'1px solid #cce7ee',borderRadius:10,padding:'12px 16px',display:'flex',flexWrap:'wrap',gap:'6px 20px',alignItems:'flex-start'}}>
                <div style={{flex:'1 1 160px'}}>
                  <div style={{fontWeight:700,fontSize:'.93rem',color:'#1a4a5a'}}>{r.name}</div>
                  {r.type==='co'&&<div style={{fontSize:'.72rem',color:'#70d6c6',marginTop:1}}>{isEn?'Co-owner':'Propietario adicional'}</div>}
                </div>
                <div style={{flex:'1 1 130px',fontSize:'.83rem',color:'#4a7a8a'}}>
                  <span style={{fontWeight:600,marginRight:4}}>{isEn?'Unit':'Unidad'}:</span>{r.apt}
                </div>
                {r.email&&<div style={{flex:'1 1 180px',fontSize:'.83rem',color:'#4a7a8a',wordBreak:'break-all'}}>
                  <span style={{fontWeight:600,marginRight:4}}>Email:</span>{r.email}
                </div>}
                {r.whatsapp&&<div style={{flex:'1 1 150px',fontSize:'.83rem',color:'#4a7a8a'}}>
                  <span style={{fontWeight:600,marginRight:4}}>WhatsApp:</span>{r.whatsapp}
                </div>}
              </div>
            ))}
          </div>
      }
      <div style={{fontSize:'.75rem',color:'#8ab0bb',marginTop:10,textAlign:'right'}}>{results.length} {isEn?'result(s)':'resultado(s)'}</div>
    </div>
  );
}

function ListingsView({ listings, incidents, user, contactProps={}, isGlobalAdmin=false, canEditGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, floorOpenState={}, onFloorToggle, onAdd, onEdit, onDelete, onReport, onVerify, onResolve, onAddResolution, onFloorFilter, onAssign, onCloseGeneral, onIncidentDetail, lang="es-CO" }) {
  const [search, setSearch]   = useState('');
  const [scope, setScope]     = useState('all');
  const [mode, setMode]       = useState('building');
  const isEn = lang === 'en';

  const scoped   = scope==='mine'&&user ? listings.filter(l=>l.ownerUid===user.uid) : listings;
  const filtered = scoped.filter(l=>{
    const q=search.toLowerCase();
    const coMatch=(l.coOwners||[]).some(co=>[co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)||String(co.whatsapp||'').includes(q));
    return !q||String(l.apt||'').includes(q)||String(l.owner||'').toLowerCase().includes(q)||String(l.operator||'').toLowerCase().includes(q)||String(l.email||'').toLowerCase().includes(q)||String(l.userEmail||'').toLowerCase().includes(q)||coMatch;
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

      <div className="fls-toolbar" style={{marginTop:14}}>
        <div className="filter-row" style={{margin:0,gap:6,flexWrap:'wrap'}}>
          <button className={`fchip ${mode==='building'?'fchip-on':''}`} onClick={()=>setMode('building')}>🏠 {isEn?'Building':'Edificio'}</button>
          <button className={`fchip ${mode==='directory'?'fchip-on':''}`} onClick={()=>setMode('directory')}>👤 {isEn?'Owner directory':'Directorio'}</button>
          {mode==='building'&&user&&<>
            <button className={`fchip ${scope==='all'?'fchip-on':''}`} onClick={()=>setScope('all')}>{appText(lang,'filters.scopeAll')}</button>
            <button className={`fchip ${scope==='mine'?'fchip-on':''}`} onClick={()=>setScope('mine')}>🔑 {isEn?'Mine':'Mis apts'}</button>
          </>}
        </div>
      </div>

      {mode==='directory'
        ? <OwnerDirectoryView listings={listings} lang={lang}/>
        : <>
            <div style={{position:'relative',marginBottom:14}}>
              <input className="search" style={{paddingRight:36}} placeholder={isEn?'Search by unit, owner, operator, email…':appText(lang,'listings.search')} value={search} onChange={e=>setSearch(e.target.value)}/>
              {search&&<button className="inc-search-clear" onClick={()=>setSearch('')}>✕</button>}
            </div>
            {filtered.length===0
              ? <EmptyState icon="🏠" title={appText(lang,'listings.none')} sub={appText(lang,'listings.noResults')}/>
              : <div className="bld-building">{floorNums.map(f=><BuildingFloor key={f} floor={f} apts={byFloor(f)} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canEditGlobal={canEditGlobal} canDeleteGlobal={canDeleteGlobal} canResolveGlobal={canResolveGlobal} onEdit={onEdit} onDelete={onDelete} onReport={onReport} onVerify={onVerify} onResolve={onResolve} onAddResolution={onAddResolution} onFloorFilter={onFloorFilter} isOpen={!!floorOpenState[f]} onToggle={()=>onFloorToggle(f)} lang={lang} isEn={isEn}/>)}</div>
            }
          </>
      }
    </div>
  );
}

function AptCard({ l, incCount, contactProps={}, canEdit=false, canDelete=false, onEdit, onDelete, onReport, showLogin, lang="es-CO" }) {
  const isEn = lang==='en';
  const hasOp = !!(l.operator || l.operatorEmail || l.operatorWhatsapp);
  return (
    <div className="acard">
      {/* ── Header: apt number + tower + wave — hover reveals contact popup ── */}
      <div className="acard-top apt-cpop-wrap">
        <div>
          <div className="ac-num">{appText(lang,"listing.apt")} {l.apt}</div>
          {l.tower && <div className="ac-tower">{appText(lang,"listing.tower")} {l.tower}</div>}
        </div>
        <div className="ac-wave">🌊</div>
        <AptContactPopup
          ownerName={l.owner}
          ownerEmail={l.userEmail||l.email}
          ownerWaRaw={l.contact}
          operatorName={l.operator}
          operatorEmail={l.operatorEmail}
          opWaRaw={l.operatorWhatsapp}
          coOwners={l.coOwners||[]}
          isEn={isEn}
        />
      </div>

      {/* ── Stats row ── */}
      <div className="ac-stats">
        <span className="chip c-teal">🛏️ {l.rooms} {appText(lang,"listing.roomsShort")}.</span>
        <span className="chip c-blue">👥 {l.guests} {appText(lang,"listing.guests")}</span>
      </div>

      {/* ── Owner ── */}
      <div className="ac-party">
        <div className="ac-party-lbl">👤 {isEn?'Owner':'Propietario'}</div>
        <UserContact name={l.owner} uid={l.ownerUid} email={l.userEmail||l.email} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
      </div>

      {/* ── Operator (only if any operator info exists) ── */}
      {hasOp && (
        <div className="ac-party ac-party-op">
          <div className="ac-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
          {l.operator
            ? <UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
            : <span className="ac-no-name">{isEn?'No name':'Sin nombre'}</span>}
        </div>
      )}

      {/* ── Open incident count ── */}
      <div className="acard-body">
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
      state: String(g.state || '').trim(),
      country: String(g.country || '').trim(),
    })).filter(g => g.firstName || g.lastName || g.city || g.country);
  }
  if (incident.ownerGuestNames || incident.ownerGuestCity || incident.ownerGuestCountry) {
    return String(incident.ownerGuestNames || '').split(',').map(x => x.trim()).filter(Boolean).map(name => {
      const parts = name.split(/\s+/);
      return { firstName: parts[0] || name, middleName: parts.length > 2 ? parts.slice(1,-1).join(' ') : '', lastName: parts.length > 1 ? parts[parts.length-1] : '', city: incident.ownerGuestCity || '', state: '', country: incident.ownerGuestCountry || '' };
    });
  }
  return [];
};
const guestFullName = (g={}) => [g.firstName, g.middleName, g.lastName].map(x=>String(x||'').trim()).filter(Boolean).join(' ');
// Location includes city, state (if present), and country
const guestLocation = (g={}) => [g.city, g.state, g.country].map(x=>String(x||'').trim()).filter(Boolean).join(', ');

function WorkflowGroup({ statusKey, icon, label, sublabel, color, incidents, listings, isOpen, onToggle, user, contactProps, isGlobalAdmin, canUpdateGlobal, canDeleteGlobal, canResolveGlobal, onResolve, onDelete, onVerify, onAddResolution, onUnitDetail, onIncidentDetail, onAssign, onCloseGeneral, hideUnit=false, lang, isEn }) {
  const count = incidents.length;
  const myActionCount = !user?.uid ? 0 : incidents.filter(inc => {
    const isMyListing = listings.find(l=>l.id===inc.aptId)?.ownerUid === user.uid;
    const hasPendingRes = inc.status==='verified' && !String(inc.ownerResolution||'').trim();
    return (inc.status==='open' || hasPendingRes) && isMyListing;
  }).length;
  return (
    <div className={`wfg-section${statusKey==='resolved'?' wfg-section-resolved':''}`}>
      <button className={`wfg-hdr${myActionCount>0?' wfg-hdr-urgent':''}`} style={{borderLeftColor:color}} onClick={onToggle}>
        <span className="wfg-icon">{icon}</span>
        <div className="wfg-hdr-body">
          <span className="wfg-label">{label}</span>
          {sublabel&&<span className="wfg-sublabel">{sublabel}</span>}
        </div>
        {myActionCount>0&&<span className="wfg-my-badge">{myActionCount} {isEn?'need your action':'necesitan tu acción'}</span>}
        <span className="wfg-badge" style={{background:color+'22',color}}>{count}</span>
        <span className={`fls-chev${isOpen?' fls-chev-up':''}`}>›</span>
      </button>
      {isOpen&&(
        <div className="wfg-body">
          {count===0
            ? <div className="wfg-empty">✓ {isEn?'None here':'Nada aquí'}</div>
            : incidents.map(inc => {
                const isMyListing = !!(user?.uid && listings.find(l=>l.id===inc.aptId)?.ownerUid === user.uid);
                const hasPendingRes = inc.status==='verified' && !String(inc.ownerResolution||'').trim();
                const actionNeeded = (inc.status==='open' || hasPendingRes) && isMyListing;
                return <IRow key={inc.id} inc={inc} user={user} listings={listings} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canUpdateGlobal={canUpdateGlobal} canDeleteGlobal={canDeleteGlobal} canResolveGlobal={canResolveGlobal} onResolve={onResolve} onDelete={onDelete} onVerify={onVerify} onAddResolution={onAddResolution} onUnitDetail={onUnitDetail} onIncidentDetail={onIncidentDetail} onAssign={onAssign} onCloseGeneral={onCloseGeneral} hideUnit={hideUnit} lang={lang} actionNeeded={actionNeeded}/>;
              })
          }
        </div>
      )}
    </div>
  );
}

function IncidentsView({ incidents, listings, user, quickFilter=null, onQuickFilterApplied=()=>{}, contactProps={}, isGlobalAdmin=false, canUpdateGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, onAdd, onResolve, onDelete, onVerify, onAddResolution, onUnitDetail, onIncidentDetail, onAssign, onCloseGeneral, lang="es-CO", defaultTab='unit' }) {
  const [sf,setSf]=useState("all"), [cf,setCf]=useState("all"), [scope,setScope]=useState("all"), [search,setSearch]=useState("");
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [tab, setTab] = useState(defaultTab || 'unit');
  const unitOpenCount = incidents.filter(i=>!i.isGeneral&&i.status==='open').length;
  const generalOpenCount = incidents.filter(i=>i.isGeneral&&i.status!=='resolved').length;
  // Floor filter: set when user clicks a stat pill on the Units page floor header
  const [floorFilter, setFloorFilter] = useState(null); // {aptIds:string[], status:string, label:string} | null
  useEffect(()=>{
    if (!quickFilter) return;
    if (typeof quickFilter === 'object' && quickFilter.type === 'floorFilter') {
      setFloorFilter({aptIds: quickFilter.aptIds, status: quickFilter.status});
      setScope("all");
      // Map sub-statuses to the sf dropdown; pendingResolution/awaitingAdmin both sit under 'verified'
      const sfVal = quickFilter.status==='pendingResolution'||quickFilter.status==='awaitingAdmin' ? 'verified' : (quickFilter.status||'all');
      setSf(sfVal); setCf("all"); setSearch("");
      onQuickFilterApplied(); return;
    }
    if (quickFilter === "ownerVerification") { setScope("ownerVerification"); setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "needsResolution")   { setScope("needsResolution");   setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "requiresResolution") { setScope("requiresResolution"); setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "seriousOpen") { setScope("all"); setSf("all"); setCf("serious"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "generalIncidents") { setTab('general'); setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); return; }
  }, [quickFilter, onQuickFilterApplied]);
  const listingMap = Object.fromEntries(listings.map(l=>[l.id, l]));
  const myListingIds = new Set((user ? listings.filter(l=>l.ownerUid===user.uid) : []).map(l=>l.id));
  let list=[...incidents];
  list = list.filter(i => !i.isGeneral);
  // "I reported" — incidents the current user filed (any apartment)
  if(scope==="iReported"   && user) list=list.filter(i=>i.reporterUid===user.uid);
  // "My listings" — incidents against apartments the user owns
  if(scope==="myListings"  && user) list=list.filter(i=>myListingIds.has(i.aptId));
  // "Pending resolution" — verified incidents where owner_resolution is still missing
  // Owners see only their listings; admins/delegates see all
  if(scope==="needsResolution") list=list.filter(i=>
    i.status==="verified" && !String(i.ownerResolution||'').trim() &&
    (isGlobalAdmin || canResolveGlobal || (user && myListingIds.has(i.aptId)))
  );
  // Legacy quickFilter scopes (used by dashboard action pills)
  if(scope==="ownerVerification" && user) list=list.filter(i=>i.status==="open"&&myListingIds.has(i.aptId));
  // "Requires resolution" (admin) — verified WITH owner resolution, truly ready to close
  if(scope==="requiresResolution") list=list.filter(i=>
    i.status==="verified" && String(i.ownerResolution||'').trim() && (isGlobalAdmin||canResolveGlobal)
  );
  // Floor filter — restricts to specific apt IDs + optional sub-status from the Units page
  if(floorFilter?.aptIds) {
    list=list.filter(i=>floorFilter.aptIds.includes(i.aptId));
    if(floorFilter.status==='pendingResolution') list=list.filter(i=>i.status==='verified'&&!String(i.ownerResolution||'').trim());
    else if(floorFilter.status==='awaitingAdmin') list=list.filter(i=>i.status==='verified'&&String(i.ownerResolution||'').trim());
    else if(floorFilter.status&&floorFilter.status!=='all') list=list.filter(i=>i.status===floorFilter.status);
  }
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
      // General incident keyword — matches "general" and "comunidad/community"
      const genFlag  = i.isGeneral ? 'general comunidad community' : '';
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
      return apt.includes(q)||owner.includes(q)||operator.includes(q)||desc.includes(q)||type.includes(q)||reporter.includes(q)||genFlag.includes(q)||guest.includes(q)||city.includes(q)||country.includes(q)||vGuests.includes(q)||vCity.includes(q)||vCountry.includes(q)||guestDetails.includes(q);
    });
  }
  // Date range filter — filter by incident date (i.date is YYYY-MM-DD)
  if(dateFrom) list=list.filter(i=>String(i.date||i.createdAt||'').slice(0,10)>=dateFrom);
  if(dateTo)   list=list.filter(i=>String(i.date||i.createdAt||'').slice(0,10)<=dateTo);
  const actionWeight = (inc) => {
    if (!user?.uid) return 2;
    const isMyListing = listings.find(l=>l.id===inc.aptId)?.ownerUid === user.uid;
    const hasPendingRes = inc.status==='verified' && !String(inc.ownerResolution||'').trim();
    if ((inc.status==='open' || hasPendingRes) && isMyListing) return 0;
    if ((isGlobalAdmin||canResolveGlobal) && inc.status==='verified' && String(inc.ownerResolution||'').trim()) return 1;
    return 2;
  };
  list.sort((a,b) => {
    const wa = actionWeight(a), wb = actionWeight(b);
    if (wa !== wb) return wa - wb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const isEn = lang==='en';
  const anyFilter = sf!=='all'||cf!=='all'||scope!=='all'||search.trim()!==''||!!floorFilter||!!dateFrom||!!dateTo;
  const resetAll = () => { setSf('all'); setCf('all'); setScope('all'); setSearch(''); setFloorFilter(null); setDateFrom(''); setDateTo(''); };
  // ── Persist group open/close to localStorage; restore on mount ──────────────
  const WFG_KEY = 'kai_wfg_state';
  const [groupOpen, setGroupOpen] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(WFG_KEY) || '{}');
      return { open: s.open !== false, verified: !!s.verified, resolved: !!s.resolved };
    } catch { return {open:true, verified:false, resolved:false}; }
  });
  const toggleGroup = (k) => {
    setGroupOpen(s => {
      const n = {...s, [k]: !s[k]};
      try { localStorage.setItem(WFG_KEY, JSON.stringify(n)); } catch {}
      return n;
    });
  };

  // ── Auto-expand/collapse based on active filter results ────────────────────
  // When a filter is active, expand groups that have matching incidents and
  // collapse empty groups.  Specific scope filters force-open the target group.
  useEffect(() => {
    const openC     = list.filter(i=>i.status==='open').length;
    const verifiedC = list.filter(i=>i.status==='verified').length;
    const resolvedC = list.filter(i=>i.status==='resolved').length;
    const noFilter  = scope==='all' && sf==='all' && cf==='all' && !search.trim();

    if (noFilter) return; // No filter → leave user's saved state untouched

    setGroupOpen(prev => {
      const next = {
        // Groups with content stay open; empty groups collapse
        open:     openC > 0     ? (scope==='ownerVerification' ? true : prev.open)     : false,
        verified: verifiedC > 0 ? (scope==='needsResolution' || scope==='requiresResolution' ? true : prev.verified) : false,
        resolved: resolvedC > 0 ? prev.resolved : false,
      };
      // Force-open the primary group for each focused scope
      if (scope === 'ownerVerification'  && openC > 0)     next.open = true;
      if (scope === 'needsResolution'    && verifiedC > 0) next.verified = true;
      if (scope === 'requiresResolution' && verifiedC > 0) next.verified = true;
      if (scope === 'iReported' || scope === 'myListings') {
        if (openC > 0)     next.open = true;
        if (verifiedC > 0) next.verified = true;
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, sf, cf, search]);

  // Break verified group down so users understand which are blocked vs ready
  const verifiedAll = list.filter(i=>i.status==='verified');
  const verifiedPendingRes = verifiedAll.filter(i=>!String(i.ownerResolution||'').trim()).length;
  const verifiedReady      = verifiedAll.filter(i=> String(i.ownerResolution||'').trim()).length;
  const verifiedSublabel = verifiedAll.length===0
    ? (isEn?'Awaiting admin resolution':'Esperando resolución del admin')
    : verifiedPendingRes>0 && verifiedReady>0
      ? (isEn?`${verifiedPendingRes} awaiting owner resolution · ${verifiedReady} ready to close`:`${verifiedPendingRes} esperan resolución del propietario · ${verifiedReady} listos para cerrar`)
      : verifiedPendingRes>0
        ? (isEn?`${verifiedPendingRes} awaiting owner resolution`:`${verifiedPendingRes} esperan resolución del propietario`)
        : (isEn?`${verifiedReady} ready to close`:`${verifiedReady} listos para cerrar`);

  const wfGroups = [
    { key:'open',     icon:'⚠️', color:'#d4634a', label:isEn?'1 · Verify — Owner action required':'1 · Verificar — Acción del propietario',  sublabel:isEn?'Step 1: Owner verifies incident and documents immediate action taken':'Paso 1: El propietario verifica el incidente y documenta la acción inmediata tomada' },
    { key:'verified', icon:'📝', color:'#0b7f4f', label:isEn?'2 · In Progress':'2 · En Progreso',                                              sublabel:verifiedSublabel },
    { key:'resolved', icon:'✓',  color:'#2e7d32', label:isEn?'3 · Closed':'3 · Cerrado',                                                       sublabel:isEn?'Resolved and filed by management':'Resuelto y archivado por administración' },
  ];

  return (
    <div className="fade">
      <div className="inc-tab-bar">
        <button className={`inc-tab${tab==='unit'?' inc-tab-on':''}`} onClick={()=>setTab('unit')}>
          ⚠️ {isEn?'Unit Incidents':'Incidentes de Unidad'}
          {unitOpenCount>0&&<span className="inc-tab-badge">{unitOpenCount}</span>}
        </button>
        <button className={`inc-tab${tab==='general'?' inc-tab-on':''}`} onClick={()=>setTab('general')}>
          📢 {isEn?'General Incidents':'Incidentes Generales'}
          {generalOpenCount>0&&<span className="inc-tab-badge">{generalOpenCount}</span>}
        </button>
      </div>
      {tab==='general'
        ? <GeneralIncidentsView incidents={incidents} listings={listings} user={user} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canResolveGlobal={canResolveGlobal} onIncidentDetail={onIncidentDetail} onAssign={onAssign} onClose={onCloseGeneral} lang={lang} embedded={true}/>
        : <>
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang,"reports.title")}</h1>
          <p className="psub">{appText(lang,"reports.subtitle",{total:list.length,open:list.filter(i=>i.status==="open").length})}</p>
        </div>
        {user&&<button className="btn-p btn-report" onClick={onAdd}>{appText(lang,"reports.reportIncident")}</button>}
      </div>

      {/* Floor filter banner — shown when navigated from Units page stat pill or unit detail */}
      {floorFilter&&(
        <div className="floor-filter-banner">
          <span>🏢 {isEn?'Filtered to unit':'Filtrado a unidad'}{floorFilter.aptIds?.length===1?' '+floorFilter.aptIds[0]:''}{floorFilter.status&&floorFilter.status!=='all'?' · ':''}<strong>{{
            open:             isEn?'⚠️ Needs verification':'⚠️ Requieren verificación',
            pendingResolution:isEn?'📝 Needs resolution (Step 2)':'📝 Necesitan resolución (Paso 2)',
            awaitingAdmin:    isEn?'⏳ Awaiting admin review':'⏳ Esperando revisión del admin',
            resolved:         isEn?'✓ Closed':'✓ Cerrados',
            verified:         isEn?'In progress':'En progreso',
            all:              '',
          }[floorFilter.status]||floorFilter.status}</strong></span>
          <button className="ffb-clear" onClick={()=>setFloorFilter(null)}>✕ {isEn?'Show all':'Ver todos'}</button>
        </div>
      )}
      <div className="inc-filters-bar">
        <div className="inc-search-wrap" style={{flex:'1 1 200px',minWidth:0}}>
          <input className="search inc-search" placeholder={appText(lang,"incidents.search")} value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button className="inc-search-clear" onClick={()=>setSearch('')}>✕</button>}
        </div>
        <div className="inc-date-range">
          <label className="inc-date-lbl">{isEn?'From':'Desde'}</label>
          <input type="date" className="inc-date-input" value={dateFrom} max={dateTo||''} onChange={e=>setDateFrom(e.target.value)}/>
          <span className="inc-date-sep">–</span>
          <label className="inc-date-lbl">{isEn?'To':'Hasta'}</label>
          <input type="date" className="inc-date-input" value={dateTo} min={dateFrom||''} onChange={e=>setDateTo(e.target.value)}/>
          {(dateFrom||dateTo)&&<button className="inc-search-clear" style={{position:'static',transform:'none',marginLeft:2}} onClick={()=>{setDateFrom('');setDateTo('');}}>✕</button>}
        </div>
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
          </>}
          {/* Pending resolution — available to all authenticated users:
              owners see their listings waiting for their resolution note;
              admins/delegates see all verified incidents missing a resolution */}
          <button className={`fchip fchip-sm ${scope==='needsResolution'?'fchip-on fchip-warn':''}`} onClick={()=>{setScope(scope==='needsResolution'?'all':'needsResolution');setSf('all');setFloorFilter(null);}}>
            📝 {isEn?'Add resolution':'Agregar resolución'}
          </button>
          {/* Ready to close — admins/delegates only: verified + owner resolution provided */}
          {(isGlobalAdmin||canResolveGlobal)&&(
            <button className={`fchip fchip-sm ${scope==='requiresResolution'?'fchip-on fchip-resolve':''}`} onClick={()=>{setScope(scope==='requiresResolution'?'all':'requiresResolution');setSf('all');}}>
              🛠️ {isEn?'Ready to close':'Listos para cerrar'}
            </button>
          )}
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
            onAddResolution={onAddResolution}
            onUnitDetail={onUnitDetail}
            onIncidentDetail={onIncidentDetail}
            onAssign={onAssign}
            onCloseGeneral={onCloseGeneral}
            lang={lang}
            isEn={isEn}
          />
        ))}
      </div>
      </>}
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

function NotificationsView({ notifications, incidents, listings=[], contactProps={}, onRead, onReadAll, lang="es-CO", smartAlerts=[], onIncidentDetail=null }) {
  const isEn = lang==='en';
  const unread = notifications.filter(n => !n.isRead).length;
  const hasAlerts = smartAlerts.length > 0;
  // Group notifications by incidentId (or '__general__' for those without)
  const [openGroups, setOpenGroups] = useState({});
  const toggleGroup = (key) => setOpenGroups(s=>({...s,[key]:!s[key]}));

  const grouped = notifications.reduce((acc, n) => {
    const key = n.incidentId || '__general__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});
  // Sort group keys: incident groups with unread first (most recent), then general
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a==='__general__' && b!=='__general__') return 1;
    if (b==='__general__' && a!=='__general__') return -1;
    const aUnread = grouped[a].filter(n=>!n.isRead).length;
    const bUnread = grouped[b].filter(n=>!n.isRead).length;
    if (aUnread !== bUnread) return bUnread - aUnread;
    return new Date(grouped[b][0]?.createdAt||0) - new Date(grouped[a][0]?.createdAt||0);
  });
  // On first load, open groups that have unread notifications
  useEffect(() => {
    const init = {};
    groupKeys.forEach(k => {
      init[k] = grouped[k].some(n=>!n.isRead);
    });
    setOpenGroups(init);
  }, []); // eslint-disable-line

  const renderNotifCard = (n) => {
    const inc=incidents.find(i=>i.id===n.incidentId);
    const nt=localizeNotification(n,lang);
    const canOpenDetail = !!(inc && onIncidentDetail);
    return (
      <div key={n.id} className={`notice-card ${n.isRead?'notice-read':'notice-new'}${canOpenDetail?' notice-card-clickable':''}`}
        onClick={canOpenDetail?()=>onIncidentDetail(inc.id):undefined}
        role={canOpenDetail?'button':undefined}
        tabIndex={canOpenDetail?0:undefined}
        onKeyDown={canOpenDetail?e=>{if(e.key==='Enter'||e.key===' ')onIncidentDetail(inc.id);}:undefined}
        title={canOpenDetail?(isEn?'Click to view full incident details':'Clic para ver detalles del incidente'):undefined}
      >
        <div className="notice-main">
          <div className="notice-title">{n.isRead?'🔔':'🆕'} {nt.title}</div>
          <div className="notice-msg">{nt.message}</div>
          <div className="notice-meta">{new Date(n.createdAt).toLocaleString(isEn?'en-US':'es-CO')} · {appText(lang,'common.email')}: {n.emailSent?(appText(lang,'common.sent')+' ✅'):(appText(lang,'common.notSent')+' ⚠️')}{n.emailError?` · ${n.emailError}`:''}</div>
          {inc&&<div className="notice-inc-row">
            <span className="notice-inc-desc"><strong>{appText(lang,'notifications.detail')}:</strong> {String(inc.desc||'').slice(0,100)}{String(inc.desc||'').length>100?'…':''}</span>
            {canOpenDetail&&<span className="notice-inc-hint">{isEn?'View details':'Ver detalles'} ›</span>}
          </div>}
        </div>
        {!n.isRead&&<button className="bsm bs-resolve" onClick={e=>{e.stopPropagation();onRead(n.id);}}>{appText(lang,"notifications.markRead")}</button>}
      </div>
    );
  };

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">🔔 {isEn?'Notifications':'Notificaciones'}</h1>
          <p className="psub">{isEn
            ? `${hasAlerts?smartAlerts.length+' priority action'+(smartAlerts.length!==1?'s':'')+' · ':''}${unread} unread alert${unread!==1?'s':''}`
            : `${hasAlerts?smartAlerts.length+' acción'+(smartAlerts.length!==1?'es':'')+' prioritaria'+(smartAlerts.length!==1?'s':'')+' · ':''}${unread} aviso${unread!==1?'s':''} sin leer`}
          </p>
        </div>
        {unread>0 && <button className="btn-p" onClick={onReadAll}>{appText(lang,"notifications.markAll")}</button>}
      </div>

      {hasAlerts && (
        <div className="notif-alerts-section">
          <div className="section-label" style={{marginBottom:10}}>
            🎯 {isEn?'Priority actions — tap to act':'Acciones prioritarias — toca para actuar'}
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
        {isEn?'Alert history':'Historial de avisos'}{groupKeys.length>1&&<span style={{fontWeight:'normal',fontSize:'.78rem',marginLeft:6,opacity:.7}}>({groupKeys.length} {isEn?'groups':'grupos'})</span>}
      </div>
      {notifications.length===0
        ? <EmptyState icon="🔔" title={appText(lang,"notifications.none")} sub={appText(lang,"notifications.noneSub")}/>
        : <div className="notice-groups">
            {groupKeys.map(gkey => {
              const groupNotifs = grouped[gkey];
              const inc = gkey!=='__general__' ? incidents.find(i=>i.id===gkey) : null;
              const listing = inc ? listings.find(l=>l.id===inc.aptId) : null;
              const gUnread = groupNotifs.filter(n=>!n.isRead).length;
              const isOpen = !!openGroups[gkey];
              const groupLabel = inc
                ? `${aptDisplay(listing?.apt||'',lang)} — ${String(inc.desc||'').slice(0,60)}${String(inc.desc||'').length>60?'…':''}`
                : (isEn?'General alerts':'Avisos generales');
              const groupIcon = inc ? (inc.status==='resolved'?'✓':inc.status==='open'?'⚠️':'📝') : '🔔';
              return (
                <div key={gkey} className={`notif-group${isOpen?' notif-group-open':''}`}>
                  <button type="button" className="notif-group-hdr" onClick={()=>toggleGroup(gkey)}>
                    <span className="notif-group-icon">{groupIcon}</span>
                    <span className="notif-group-label">{groupLabel}</span>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto',flexShrink:0}}>
                      {gUnread>0&&<span className="notif-group-badge">{gUnread}</span>}
                      <span className="notif-group-count">{groupNotifs.length} {isEn?'alert'+(groupNotifs.length!==1?'s':''):'aviso'+(groupNotifs.length!==1?'s':'')}</span>
                      {inc&&onIncidentDetail&&<button type="button" className="bsm" style={{fontSize:'.68rem',padding:'2px 8px'}} onClick={e=>{e.stopPropagation();onIncidentDetail(inc.id);}}>{isEn?'View incident':'Ver incidente'} ›</button>}
                      <span className={`notif-group-chev${isOpen?' notif-group-chev-open':''}`}>›</span>
                    </div>
                  </button>
                  {isOpen&&(
                    <div className="notice-list" style={{padding:'8px 14px 12px'}}>
                      {groupNotifs.map(n=>renderNotifCard(n))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// Compact unit card shown next to incident rows — hover reveals owner/operator contact links
// ── UnitPlate — universal dark plate showing unit number + complex name ──────
// Use for ALL unit number displays across the app for visual consistency.
// Pass onClick to make it clickable (opens unit detail popup).
function UnitPlate({ apt, tower=getDefaultTower(), size='md', onClick, title, className='' }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick?'button':undefined}
      className={`unit-plate unit-plate-${size}${className?' '+className:''}`}
      onClick={onClick}
      title={title}
      onKeyDown={onClick?e=>{if(e.key==='Enter'||e.key===' ')onClick(e);}:undefined}
    >
      <span className="unit-plate-num">{apt}</span>
      {tower&&<span className="unit-plate-tower">{tower}</span>}
    </Tag>
  );
}

// Compact unit card — styled like a mini AptDoor with dark plate header.
// Hover reveals AptContactPopup (branded email + WhatsApp links).
function UnitMiniCard({ listing, onUnitDetail, isEn=false }) {
  if (!listing) return null;
  const ownerEmail = listing.userEmail || listing.email || '';
  const ownerWaRaw = listing.contact || '';
  const ownerWa    = normalizePhoneForWhatsApp(ownerWaRaw);
  const opWa       = normalizePhoneForWhatsApp(listing.operatorWhatsapp);
  return (
    <div className="unit-mini-card">
      <UnitPlate
        apt={listing.apt}
        tower={listing.tower||getDefaultTower()}
        size="sm"
        onClick={onUnitDetail ? ()=>onUnitDetail(listing.id) : undefined}
        title={onUnitDetail?(isEn?'View unit details':'Ver detalles de la unidad'):undefined}
        className="umc-plate-unit"
      />
      <div className="umc-body">
        <div className="umc-party">
          <div className="umc-owner" title={listing.owner||'—'}><span className="umc-role-lbl">{isEn?'Owner':'Propietario'}</span> {listing.owner||'—'}</div>
          {(ownerEmail||ownerWa)&&(
            <div className="umc-contacts">
              {ownerEmail&&<a href={`mailto:${ownerEmail}`} className="idd-pi-link" onClick={e=>e.stopPropagation()}>✉️ {ownerEmail}</a>}
              {ownerWa&&<a href={`https://wa.me/${ownerWa}`} target="_blank" rel="noopener noreferrer" className="idd-pi-link idd-pi-wa" onClick={e=>e.stopPropagation()}>💬 WhatsApp</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IRow({ inc, user, listings=[], contactProps={}, isGlobalAdmin=false, canUpdateGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, onResolve, onDelete, onVerify, onAddResolution, onUnitDetail, onIncidentDetail, onAssign, onCloseGeneral, compact, naughtyMode, hideUnit=false, lang="es-CO", actionNeeded=false }) {
  const listing    = listings.find(l=>l.id===inc.aptId);
  const isOwner    = Boolean(user?.uid && listing?.ownerUid === user.uid);
  const isReporter = Boolean(user?.uid && inc.reporterUid === user.uid);
  const guests     = normalizeOwnerGuests(inc);
  const ti = INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6];
  const ci = GUEST_CATEGORIES.find(c=>c.value===inc.category);
  const isEn       = lang==='en';
  const hasDetail  = !!onIncidentDetail;
  const hasPendingRes = inc.status==='verified' && !String(inc.ownerResolution||'').trim();

  // Status strip config — matches idd-status-banner colours
  const statusMeta = inc.status==='resolved'
    ? { cls:'ir-ss-resolved', icon:'✓',  label: isEn?'Closed':'Cerrado' }
    : inc.isGeneral && inc.status==='open'
    ? { cls:'ir-ss-general',  icon:'📢', label: isEn?'General — Admin action needed':'General — Acción del admin requerida' }
    : inc.status==='open'
    ? { cls:'ir-ss-open',     icon:'⚠️', label: isEn?'Open — verify required':'Abierto — verificación requerida' }
    : hasPendingRes
    ? { cls:'ir-ss-pres',     icon:'📝', label: isEn?'Verified — resolution needed':'Verificado — falta respuesta' }
    : { cls:'ir-ss-wait',     icon:'⏳', label: isEn?'Awaiting admin close':'En espera del admin' };

  return (
    <div className={`irow irow-card${naughtyMode?' irow-naughty':''}${actionNeeded?' irow-action-needed':''}`}>
      {/* ── Left sidebar: unit card + reporter context ── */}
      <div className="ir-l">
        {!hideUnit && (inc.isGeneral
          ? <div className="ir-apt-context"><div className="ir-apt ir-apt-general">📢 {isEn?'General':'General'}</div><div className="ir-apt-sub">{isEn?'Community — no unit':'Comunidad — sin unidad'}</div></div>
          : listing
            ? <UnitMiniCard listing={listing} onUnitDetail={onUnitDetail} isEn={isEn}/>
            : <div className="ir-apt-context"><div className="ir-apt">{inc.aptLabel}</div></div>
        )}
        {hideUnit && <div className="ir-apt-context"><div className="ir-apt">{inc.isGeneral?'📢 General':inc.aptLabel}</div></div>}
        {user&&(isReporter||isOwner)&&(
          <div className="ir-ctx-tags">
            {isReporter&&isOwner&&<span className="inc-ctx-tag inc-ctx-reporter">{isEn?'📋 I reported · my listing':'📋 Yo reporté · mi listing'}</span>}
            {isReporter&&!isOwner&&<span className="inc-ctx-tag inc-ctx-reporter">{isEn?'📋 I reported':'📋 Yo reporté'}</span>}
            {!isReporter&&isOwner&&<span className="inc-ctx-tag inc-ctx-mine">{isEn?'🏠 My listing':'🏠 Mi listing'}</span>}
          </div>
        )}
      </div>

      {/* ── Main content card ── */}
      <div className="ir-main">
        {/* Status strip + type/category chips + date + view details */}
        <div className={`ir-status-strip ${statusMeta.cls}`}>
          <span className="ir-ss-icon">{statusMeta.icon}</span>
          <span className="ir-ss-label">{statusMeta.label}</span>
          <div className="ir-ss-chips">
            <span className="ir-type" style={{background:ti.bg,color:ti.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px',fontWeight:700}}>{incidentTypeLabel(ti.value,lang)}</span>
            {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px'}}>{ci.icon} {categoryLabel(ci.value,lang)}</span>}
            {(()=>{
              if (hasPendingRes) {
                const sla = slaResInfo(inc);
                if (!sla) return null;
                if (sla.isBreached) return <span className="ir-sla-chip ir-sla-breached">🔴 {isEn?`${Math.abs(sla.hoursLeft)}h overdue`:`${Math.abs(sla.hoursLeft)}h retraso`}</span>;
                if (sla.hoursLeft<=4) return <span className="ir-sla-chip ir-sla-urgent">🟠 {isEn?`Due in ${sla.hoursLeft}h`:`Vence en ${sla.hoursLeft}h`}</span>;
                if (sla.cycleCount>0) return <span className="ir-sla-chip ir-sla-reminded">⏱️ {sla.cycleCount} {isEn?`reminder${sla.cycleCount>1?'s':''}`:`recordatorio${sla.cycleCount>1?'s':''}`}</span>;
                return <span className="ir-sla-chip">⏰ {isEn?`${sla.hoursLeft}h left`:`${sla.hoursLeft}h restantes`}</span>;
              }
              return inc.slaCycleCount>0 ? <span className="ir-sla-chip ir-sla-reminded">⏱️ SLA ×{inc.slaCycleCount}</span> : null;
            })()}
            <span className="ir-ss-date">📅 {fmtDate(inc.date)}</span>
          </div>
          {actionNeeded&&(
            <span className="ir-ss-action-mine">
              {isEn?'⚡ Your action':'⚡ Tu acción'}
            </span>
          )}
          {/* General incident quick actions — admin only */}
          {inc.isGeneral && (isGlobalAdmin||canResolveGlobal) && inc.status!=='resolved' && (
            <>
              <button type="button" className="ir-ss-act ir-ss-act-assign"
                onClick={e=>{e.stopPropagation();onAssign&&onAssign(inc);}}>
                🏠 {isEn?'Assign to unit':'Asignar a unidad'}
              </button>
              <button type="button" className="ir-ss-act ir-ss-act-close-gen"
                onClick={e=>{e.stopPropagation();onCloseGeneral&&onCloseGeneral(inc);}}>
                ✓ {isEn?'Close':'Cerrar'}
              </button>
            </>
          )}
          {/* Quick-action buttons — shown whenever owner action is required */}
          {user&&inc.status==='open'&&isOwner&&(
            <button type="button" className="ir-ss-act ir-ss-act-verify"
              onClick={e=>{e.stopPropagation();onVerify&&onVerify(inc);}}
              title={isEn?'Step 1: Verify guest details and document your action':'Paso 1: Verificar datos del huésped y documentar acción'}>
              ① {isEn?'Verify':'Verificar'}
            </button>
          )}
          {user&&inc.status==='verified'&&isOwner&&hasPendingRes&&(
            <button type="button" className="ir-ss-act ir-ss-act-resolve"
              onClick={e=>{e.stopPropagation();onAddResolution&&onAddResolution(inc);}}
              title={isEn?'Step 2: Add your resolution so admin can close':'Paso 2: Agrega tu respuesta para que el admin pueda cerrar'}>
              ② {isEn?'Add resolution':'Agregar respuesta'}
            </button>
          )}
          {user&&(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes&&(
            <button type="button" className="ir-ss-act ir-ss-act-close"
              onClick={e=>{e.stopPropagation();onResolve&&onResolve(inc.id);}}>
              {isEn?'Close':'Cerrar'}
            </button>
          )}
          {hasDetail&&(
            <button type="button" className="ir-detail-pill" onClick={()=>onIncidentDetail(inc.id)}>
              {isEn?'Details':'Detalles'} ›
            </button>
          )}
        </div>

        <div className="ir-body">
          {inc.desc&&<p className="ir-body-desc">{inc.desc}</p>}
          {/* ── Parties — reporter + owner always visible ── */}
          {compact?(
            <div className="ir-bparty-compact">
              {inc.reporterName&&<span className="ir-bpc-item" title={isEn?'Reporter':'Reportado por'}>📋 {inc.reporterName}</span>}
              {listing&&<span className="ir-bpc-item" title={isEn?'Owner':'Propietario'}>🏠 {listing.owner||listing.userEmail||'—'}</span>}
            </div>
          ):(
            <div className="ir-body-parties">
              <span className="ir-bparty">
                <span className="ir-bparty-lbl">📋 {isEn?'Reporter':'Reportado por'}</span>
                <UserContact name={inc.reporterName||'—'} uid={inc.reporterUid||''} {...contactProps}/>
              </span>
              {listing&&(
                <span className="ir-bparty">
                  <span className="ir-bparty-lbl">🏠 {isEn?'Owner':'Propietario'}</span>
                  <UserContact name={listing.owner||listing.userEmail||'—'} uid={listing.ownerUid||''} email={listing.userEmail||listing.email||''} whatsapp={listing.contact||''} {...contactProps}/>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Action footer — mirrors idd-actions ── */}
        {!compact&&user&&(
          <div className="ir-footer-acts">
            {/* General incident footer actions */}
            {inc.isGeneral && (isGlobalAdmin||canResolveGlobal) && inc.status!=='resolved' && (
              <>
                <button className="btn-p ir-act-btn" onClick={()=>onAssign&&onAssign(inc)}>
                  🏠 {isEn?'Assign to unit — owner will be notified':'Asignar a unidad — propietario recibirá aviso'}
                </button>
                <button className="btn-ghost ir-act-btn" onClick={()=>onCloseGeneral&&onCloseGeneral(inc)}>
                  ✓ {isEn?'Close directly':'Cerrar directamente'}
                </button>
              </>
            )}
            {inc.status==='open'&&isOwner&&(
              <>
                <button className="btn-p ir-act-btn" onClick={()=>onVerify&&onVerify(inc)}>
                  ① {isEn?'Verify — add guest info & action (Step 1 of 2)':'Verificar — agregar info y acción (Paso 1 de 2)'}
                </button>
                <div className="ir-act-steps-note">{isEn?'Step 2 (resolution) also required before admin can close':'El Paso 2 (respuesta) también es requerido para que el admin cierre'}</div>
              </>
            )}
            {inc.status==='verified'&&isOwner&&hasPendingRes&&(
              <button className="btn-p ir-act-btn" onClick={()=>onAddResolution&&onAddResolution(inc)}>
                ② {isEn?'Add resolution':'Agregar respuesta'}
              </button>
            )}
            {inc.status==='verified'&&isOwner&&!hasPendingRes&&(
              <div className="ir-act-done">✓ {isEn?'Both steps complete — awaiting admin close':'Pasos completados — esperando cierre del admin'}</div>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes&&(
              <button className="bsm bs-resolve ir-act-btn-sm" onClick={()=>onResolve&&onResolve(inc.id)}>
                {appText(lang,'reports.close')}
              </button>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&hasPendingRes&&(
              <div className="ir-act-waiting">🔒 {isEn?'Waiting for owner resolution':'Esperando respuesta del propietario'}</div>
            )}
            {(isGlobalAdmin||canDeleteGlobal)&&(
              <button className="bsm bs-del ir-act-del" title={isEn?'Delete incident (admin only)':'Eliminar incidente (solo admin)'} onClick={()=>onDelete&&onDelete(inc.id)}>🗑️</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// LoginModal replaced by Firebase signInWithPopup — no modal needed

const EMPTY_CO_OWNER = { firstName:'', middleName:'', lastName:'', whatsapp:'' };

function ListingModal({ title, user, initial={}, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
  const isEn = lang === 'en';
  const [f,setF]=useState({apt:"",rooms:"2",guests:4,operator:"",operatorEmail:"",operatorWhatsapp:"",airbnb:"",...initial,tower:initial.tower||config?.community_tower||'KAI'});
  const [coOwners,setCoOwners]=useState(Array.isArray(initial?.coOwners)&&initial.coOwners.length?initial.coOwners:[]);
  const [errors,setErrors]=useState({});
  const [coErrors,setCoErrors]=useState([]);
  const [checkingApt,setCheckingApt]=useState(false);
  const s=(k,v)=>{ setF(p=>({...p,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };

  const setCo=(i,k,v)=>setCoOwners(prev=>prev.map((o,idx)=>idx===i?{...o,[k]:v}:o));
  const addCoOwner=()=>{ if(coOwners.length<3) setCoOwners(p=>[...p,{...EMPTY_CO_OWNER}]); };
  const removeCoOwner=(i)=>{ setCoOwners(p=>p.filter((_,idx)=>idx!==i)); setCoErrors(p=>p.filter((_,idx)=>idx!==i)); };

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

  const validateCoOwners=()=>{
    const errs=coOwners.map(o=>{
      const e={};
      if(!String(o.firstName||'').trim()) e.firstName=isEn?'First name required':'Nombre requerido';
      if(!String(o.lastName||'').trim()) e.lastName=isEn?'Last name required':'Apellido requerido';
      const waErr=validateWhatsApp(o.whatsapp,lang); if(waErr) e.whatsapp=waErr;
      return e;
    });
    setCoErrors(errs);
    return errs.every(e=>Object.keys(e).length===0);
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
    const coOk=validateCoOwners();
    return Object.keys(e).length===0 && coOk;
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
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value={f.tower} readOnly disabled className="locked-field"/></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={inputCls("rooms")} value={f.rooms} onChange={e=>s("rooms",e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors.rooms&&<span className="err-msg">{errors.rooms}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={inputCls("guests")} type="number" value={f.guests} onChange={e=>s("guests",parseInt(e.target.value)||"")} min={1} max={20}/>{errors.guests&&<span className="err-msg">{errors.guests}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} {optLabel}</label><input className={inputCls("airbnb")} value={f.airbnb} onChange={e=>s("airbnb",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!/^https?:\/\/.+/i.test(v))setErrors(p=>({...p,airbnb:appText(lang,'validation.urlInvalid')}));else setErrors(p=>({...p,airbnb:undefined}));}} placeholder="https://www.airbnb.com/rooms/..."/>{errors.airbnb&&<span className="err-msg">{errors.airbnb}</span>}</div>
        {/* ── Operator ─────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🔧 {isEn?'Operator (optional)':'Operador (opcional)'}</div>
        <div className="fg full" style={{marginTop:-4,marginBottom:4}}><span className="help-msg">{isEn?'Leave blank if you self-manage. Operator receives all incident notifications for this unit.':'Déjalo en blanco si gestionas tú mismo. El operador recibe todas las notificaciones de incidentes de esta unidad.'}</span></div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} {optLabel}</label><input className={inputCls("operator")} value={f.operator} onChange={e=>s("operator",e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors.operator&&<span className="err-msg">{errors.operator}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} {optLabel}</label><input className={inputCls("operatorEmail")} type="email" value={f.operatorEmail} onChange={e=>s("operatorEmail",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!validateEmail(v))setErrors(p=>({...p,operatorEmail:appText(lang,'validation.operatorEmailInvalid')}));else setErrors(p=>({...p,operatorEmail:undefined}));}} placeholder="operador@email.com"/>{errors.operatorEmail&&<span className="err-msg">{errors.operatorEmail}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.operatorWhatsappOptional")} {optLabel}</label><input className={inputCls("operatorWhatsapp")} type="tel" value={f.operatorWhatsapp} onChange={e=>s("operatorWhatsapp",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const err=validateWhatsApp(v,lang);setErrors(p=>({...p,operatorWhatsapp:err||undefined}));}} placeholder="+57 300 000 0000"/>{errors.operatorWhatsapp?<span className="err-msg">{errors.operatorWhatsapp}</span>:<span className="help-msg">{isEn?'With country code, e.g. +57':'Con código de país, ej. +57'}</span>}</div>
        {/* ── Co-owners ────────────────────────────────────── */}
        <div className="fg full form-section-hdr">👥 {isEn?'Additional owners':'Propietarios adicionales'} {optLabel}</div>
        {coOwners.length===0&&<div className="fg full" style={{color:'#6b9ba8',fontSize:'.83rem',margin:'-4px 0 4px'}}>{isEn?'Up to 3 additional owners can be added to this unit.':'Se pueden agregar hasta 3 propietarios adicionales a esta unidad.'}</div>}
        {coOwners.map((co,i)=>(
          <div key={i} className="fg full" style={{border:'1px solid #cce7ee',borderRadius:8,padding:'12px 14px',marginBottom:4,background:'#f5fbfd'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontWeight:600,fontSize:'.85rem',color:'#1a4a5a'}}>{isEn?`Co-owner ${i+1}`:`Propietario ${i+1}`}</span>
              <button type="button" style={{background:'none',border:'none',color:'#e53935',cursor:'pointer',fontSize:'1rem',padding:'0 2px'}} onClick={()=>removeCoOwner(i)}>✕</button>
            </div>
            <div className="fg2">
              <div className="fg">
                <label>{isEn?'First name':'Nombre'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
                <input className={coErrors[i]?.firstName?'field-error':''} value={co.firstName} onChange={e=>setCo(i,'firstName',e.target.value)} placeholder={isEn?'First name':'Nombre'}/>
                {coErrors[i]?.firstName&&<span className="err-msg">{coErrors[i].firstName}</span>}
              </div>
              <div className="fg">
                <label>{isEn?'Middle name':'Segundo nombre'} {optLabel}</label>
                <input value={co.middleName} onChange={e=>setCo(i,'middleName',e.target.value)} placeholder={isEn?'Middle name (optional)':'Segundo nombre (opcional)'}/>
              </div>
              <div className="fg">
                <label>{isEn?'Last name':'Apellido'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
                <input className={coErrors[i]?.lastName?'field-error':''} value={co.lastName} onChange={e=>setCo(i,'lastName',e.target.value)} placeholder={isEn?'Last name':'Apellido'}/>
                {coErrors[i]?.lastName&&<span className="err-msg">{coErrors[i].lastName}</span>}
              </div>
              <div className="fg">
                <label>WhatsApp {optLabel}</label>
                <input className={coErrors[i]?.whatsapp?'field-error':''} type="tel" value={co.whatsapp} onChange={e=>setCo(i,'whatsapp',e.target.value)} onBlur={e=>{const err=validateWhatsApp(e.target.value,lang);setCoErrors(p=>p.map((ce,idx)=>idx===i?{...ce,whatsapp:err||undefined}:ce));}} placeholder="+57 300 000 0000"/>
                {coErrors[i]?.whatsapp?<span className="err-msg">{coErrors[i].whatsapp}</span>:<span className="help-msg">{isEn?'With country code':'Con código de país'}</span>}
              </div>
            </div>
          </div>
        ))}
        {coOwners.length<3&&<div className="fg full"><button type="button" className="btn-ghost" style={{fontSize:'.83rem',padding:'6px 14px'}} onClick={addCoOwner}>+ {isEn?'Add co-owner':'Agregar propietario'}</button></div>}
      </div>
      <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" onClick={()=>{if(validate()) onSave({...f,apt:String(f.apt).trim(),tower:f.tower||getDefaultTower(),operatorEmail:String(f.operatorEmail||"").trim().toLowerCase(),operatorWhatsapp:String(f.operatorWhatsapp||"").trim(),airbnb:String(f.airbnb||"").trim(),coOwners:coOwners.map(o=>({...o,firstName:o.firstName.trim(),middleName:o.middleName.trim(),lastName:o.lastName.trim(),whatsapp:o.whatsapp.trim()}))});}}>{appText(lang,"form.save")}</button></div>
    </Overlay>
  );
}

// ─── UNIT PICKER ──────────────────────────────────────────────────────────────
// Searchable, floor-grouped unit selector. Replaces <select> for 100+ units.
function UnitPicker({ listings=[], value='', onChange=()=>{}, lang='es-CO', error=false, disabled=false }) {
  const isEn = lang === 'en';
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const inputRef = React.useRef(null);

  const selected = listings.find(l => l.id === value) || null;

  // Close on outside click / Escape
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const sorted = React.useMemo(() => [...listings].sort((a,b) => a.apt.localeCompare(b.apt, undefined, {numeric:true})), [listings]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(l => l.apt.toLowerCase().includes(q) || String(l.owner||'').toLowerCase().includes(q));
  }, [sorted, query]);

  // Group by floor (first N-2 digits of the apt number)
  const grouped = React.useMemo(() => {
    if (query.trim()) return [{ floor: null, units: filtered }];
    const map = {};
    for (const l of filtered) {
      const num = parseInt(l.apt, 10);
      const floor = Number.isFinite(num) ? String(Math.floor(num / 100)) : '?';
      (map[floor] = map[floor] || []).push(l);
    }
    return Object.entries(map)
      .sort(([a],[b]) => (a==='?'?999:Number(a)) - (b==='?'?999:Number(b)))
      .map(([floor, units]) => ({ floor, units }));
  }, [filtered, query]);

  const select = (l) => { onChange(l.id); setOpen(false); setQuery(''); };
  const clear   = () => { onChange('');   setOpen(true);  setQuery(''); setTimeout(()=>inputRef.current?.focus(),30); };

  return (
    <div className={`upk-wrap${error?' upk-error':''}${disabled?' upk-disabled':''}`} ref={ref}>
      {selected ? (
        <div className="upk-selected" onClick={()=>!disabled&&clear()}>
          <span className="upk-sel-apt">{aptDisplay(selected.apt, lang)}</span>
          <span className="upk-sel-owner">{selected.owner}</span>
          {!disabled && <button type="button" className="upk-clear" onClick={e=>{e.stopPropagation();clear();}} aria-label="Clear">✕</button>}
        </div>
      ) : (
        <div className="upk-input-wrap">
          <span className="upk-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="upk-input"
            value={query}
            disabled={disabled}
            placeholder={isEn ? 'Search by unit # or owner name…' : 'Buscar por número o nombre del propietario…'}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
          {query && <button type="button" className="upk-clear" onClick={()=>setQuery('')}>✕</button>}
        </div>
      )}
      {open && !selected && (
        <div className="upk-dropdown">
          {filtered.length === 0 && (
            <div className="upk-empty">{isEn ? 'No units match your search.' : 'Ninguna unidad coincide.'}</div>
          )}
          {grouped.map(({ floor, units }) => (
            <div key={floor ?? 'all'}>
              {floor !== null && (
                <div className="upk-floor-hdr">
                  {isEn ? `Floor ${floor}` : `Piso ${floor}`}
                  <span className="upk-floor-count">{units.length}</span>
                </div>
              )}
              {units.map(l => (
                <button key={l.id} type="button" className="upk-item" onMouseDown={e=>{e.preventDefault();select(l);}}>
                  <strong className="upk-item-apt">{aptDisplay(l.apt, lang)}</strong>
                  <span className="upk-item-owner">{l.owner}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncidentModal({ listings, user, presetApt, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
  const isEn = lang === 'en';
  const DRAFT_KEY = 'kai_incident_draft';
  // Restore draft from localStorage if no preset apt; save draft on every change
  const [f,setF]=useState(()=>{
    if(presetApt) return {aptId:presetApt,date:today(),type:"noise",category:"minor",desc:""};
    try{
      const saved=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
      if(saved&&typeof saved==='object'&&(saved.aptId||saved.desc))
        return {aptId:saved.aptId||'',date:saved.date||today(),type:saved.type||'noise',category:saved.category||'minor',desc:saved.desc||''};
    }catch{}
    return {aptId:"",date:today(),type:"noise",category:"minor",desc:""};
  });
  const [draftRestored] = useState(()=>{
    if(presetApt) return false;
    try{const s=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');return !!(s&&typeof s==='object'&&(s.aptId||s.desc));}catch{return false;}
  });
  const [errors,setErrors]=useState({});
  const [photos,setPhotos]=useState([]);
  const [photoError,setPhotoError]=useState('');
  const [photoLoading,setPhotoLoading]=useState(false);
  const [isGeneral,setIsGeneral]=useState(false);
  // Auto-save draft on every field change (skip when preset apt is used)
  useEffect(()=>{
    if(presetApt) return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(f));}catch{}
  },[f]);// eslint-disable-line

  const handlePhotoAdd = async (files) => {
    const remaining = 3 - photos.length;
    if(remaining<=0){setPhotoError(isEn?'Maximum 3 photos allowed.':'Máximo 3 fotos permitidas.');return;}
    const toProcess = Array.from(files).slice(0,remaining);
    setPhotoLoading(true); setPhotoError('');
    const results=[]; const errs=[];
    await Promise.all(toProcess.map(async file=>{
      try{results.push(await compressImage(file));}catch(e){
        const raw = e.message || '';
        let msg;
        if(raw.includes('too large')||raw.includes('10 MB')||raw.includes('10MB'))
          msg = isEn
            ? '⚠️ Photo too large — max 10 MB per image before compression. Please choose a smaller file.'
            : '⚠️ Foto demasiado grande — máx 10 MB por imagen antes de comprimir. Elige un archivo más pequeño.';
        else if(raw.includes('Only image')||raw.includes('image files'))
          msg = isEn
            ? '⚠️ Only image files are allowed (JPEG, PNG, WebP).'
            : '⚠️ Solo se permiten imágenes (JPEG, PNG, WebP).';
        else if(raw.includes('Could not read')||raw.includes('Could not decode'))
          msg = isEn
            ? '⚠️ Could not read this image file. Try a different format.'
            : '⚠️ No se pudo leer la imagen. Intenta con otro formato.';
        else
          msg = isEn ? `⚠️ Photo error: ${raw}` : `⚠️ Error en foto: ${raw}`;
        errs.push(msg);
      }
    }));
    if(errs.length) setPhotoError(errs.join(' '));
    if(results.length) setPhotos(p=>[...p,...results].slice(0,3));
    setPhotoLoading(false);
  };
  const removePhoto = (i) => setPhotos(p=>p.filter((_,idx)=>idx!==i));
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

  // Build template chips for the selected category — one per incident type
  const categoryChips = INCIDENT_TYPES.map(t => {
    const key = `${t.value}_${f.category}`;
    const tmpl = INCIDENT_TEMPLATES[key];
    if (!tmpl) return null;
    return { typeValue:t.value, typeLabel:incidentTypeLabel(t.value,lang), typeMeta:t, text:isEn?tmpl.en:tmpl.es };
  }).filter(Boolean);

  const applyChip = (chip) => {
    setF(p=>({...p, type:chip.typeValue, desc:chip.text}));
    setErrors(e=>({...e, type:undefined, desc:undefined}));
  };

  // Placeholder: prefix with "(Example) " so it's unmistakably not real content
  const currentChip = categoryChips.find(c=>c.typeValue===f.type);
  const _examplePrefix = isEn ? '(Example) ' : '(Ejemplo) ';
  const descPlaceholder = (!String(f.desc||'').trim() && currentChip)
    ? _examplePrefix + currentChip.text
    : appText(lang,"form.descriptionPlaceholder");

  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">{appText(lang,"modal.report.title")}</div>
      <div className="inc-modal-meta">{appText(lang,"modal.report.sub",{name:user?.name||""})} · <span className="inc-modal-hint">{appText(lang,"modal.report.help")}</span></div>

      {draftRestored&&(
        <div className="draft-restored-banner">
          📋 <strong>{isEn?'Draft restored':'Borrador restaurado'}</strong> — {isEn?'Your last unsaved report has been loaded.':'Se cargó tu último reporte sin guardar.'}
          <button type="button" className="btn-ghost bsm" style={{marginLeft:8,fontSize:'.68rem'}}
            onClick={()=>{try{localStorage.removeItem(DRAFT_KEY);}catch{}setF({aptId:presetApt||'',date:today(),type:'noise',category:'minor',desc:''});}}>
            {isEn?'Clear draft':'Limpiar'}
          </button>
        </div>
      )}

      {/* ── General incident toggle ── */}
      <div className="gen-toggle-wrap">
        <label className="gen-toggle-label">
          <input type="checkbox" checked={isGeneral} onChange={e=>{setIsGeneral(e.target.checked);if(e.target.checked)s('aptId','');}}/>
          <span className="gen-toggle-box"/>
          <span>📢 {isEn?'This is a general community incident (not specific to one unit)':'Este es un incidente general de la comunidad (no específico de una unidad)'}</span>
        </label>
        {isGeneral&&<div className="gen-toggle-hint">{isEn?'A global/delegate admin will review, assign to a unit, or close this incident.':'Un admin global/delegado revisará, asignará a una unidad, o cerrará este incidente.'}</div>}
      </div>

      <div className="fg2 inc-form-grid">
        {/* Row 1: Unit + Date */}
        {!isGeneral&&<div className="fg"><label>{appText(lang,"form.apartment")} <Tip text={tips.incidentApartment}/></label>
          <UnitPicker listings={listings} value={f.aptId} onChange={v=>s("aptId",v)} lang={lang} error={!!errors.aptId} disabled={!!presetApt}/>
          {errors.aptId&&<span className="err-msg">{errors.aptId}</span>}
        </div>}
        <div className="fg"><label>{appText(lang,"form.date")}</label>
          <input className={inputCls("date")} type="date" value={f.date} onChange={e=>s("date",e.target.value)}/>
          {errors.date&&<span className="err-msg">{errors.date}</span>}
        </div>

        {/* Row 2: Category chips (full width, inline) */}
        <div className="fg full">
          <label>{appText(lang,"form.category")} <Tip text={tips.incidentCategory}/></label>
          <div className="inc-cat-row">
            {GUEST_CATEGORIES.map(c=>(
              <button key={c.value} type="button"
                className={`inc-cat-btn${f.category===c.value?' inc-cat-btn-on':''}`}
                style={f.category===c.value?{background:c.bg,color:c.color,borderColor:c.color}:{}}
                onClick={()=>s("category",c.value)}>
                {c.icon} {categoryLabel(c.value,lang)}
              </button>
            ))}
          </div>
          {errors.category&&<span className="err-msg">{errors.category}</span>}
        </div>

        {/* Row 3: Examples grid (compact 2-col, type name + tap to pre-fill) */}
        <div className="fg full">
          <label>💡 {isEn?'Quick-fill examples — tap a chip to pre-fill the type and description with sample text (you can edit it)':'Ejemplos rápidos — toca un chip para pre-completar tipo y descripción con texto de muestra (puedes editarlo)'}</label>
          <div className="inc-chips-grid">
            {categoryChips.map(chip=>(
              <button key={chip.typeValue} type="button"
                className={`inc-chip-sm${f.type===chip.typeValue&&String(f.desc||'').trim()===chip.text?' inc-chip-sm-on':''}`}
                title={chip.text}
                onClick={()=>applyChip(chip)}>
                <span className="inc-chip-sm-lbl" style={{color:chip.typeMeta.color}}>{chip.typeLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 4: Type selector (auto-set by chip, or manual) + Description */}
        <div className="fg"><label>{appText(lang,"form.type")} <Tip text={tips.incidentType}/></label>
          <select className={inputCls("type")} value={f.type} onChange={e=>s("type",e.target.value)}>
            {INCIDENT_TYPES.map(t=><option key={t.value} value={t.value}>{incidentTypeLabel(t.value,lang)}</option>)}
          </select>
          {errors.type&&<span className="err-msg">{errors.type}</span>}
        </div>
        <div className="fg full">
          <label>{appText(lang,"form.description")} <Tip text={tips.incidentDescription}/></label>
          <textarea className={inputCls("desc")} value={f.desc} onChange={e=>s("desc",e.target.value)}
            placeholder={descPlaceholder} rows={3}/>
          {!String(f.desc||'').trim()&&currentChip&&(
            <span className="help-msg" style={{fontStyle:'italic',color:'#8a9fa5'}}>
              ✏️ {isEn?'The gray text above is an example — start typing to replace it, or tap a chip to pre-fill.':'El texto gris de arriba es un ejemplo — empieza a escribir para reemplazarlo, o toca un chip para pre-completar.'}
            </span>
          )}
          {errors.desc&&<span className="err-msg">{errors.desc}</span>}
        </div>

        {/* Photo attachments — inside fg2 grid so layout stays consistent */}
        <div className="fg full">
          <label>📷 {isEn?`Photos — up to 3 (JPEG/PNG/WebP, max 10 MB each before compression)`:`Fotos — hasta 3 (JPEG/PNG/WebP, máx 10 MB antes de comprimir)`}</label>
          <div className="inc-photo-upload-area">
            {photos.map((p,i)=>(
              <div key={i} className="inc-photo-preview">
                <img src={p.data} alt={p.name} className="inc-photo-preview-img"/>
                <button type="button" className="inc-photo-remove" onClick={()=>removePhoto(i)} title={isEn?'Remove':'Quitar'}>✕</button>
                <span className="inc-photo-size">{p.size>1024*1024?`${(p.size/1024/1024).toFixed(1)}MB`:`${Math.round(p.size/1024)}KB`}</span>
              </div>
            ))}
            {photos.length<3&&(
              <label className="inc-photo-add-btn" title={isEn?'Add photo':'Agregar foto'}>
                {photoLoading?<span className="spinner-sm"/>:<>📷 {isEn?'Add':'Agregar'}</>}
                <input type="file" accept="image/*" multiple style={{display:'none'}} disabled={photoLoading}
                  onChange={e=>{handlePhotoAdd(e.target.files);e.target.value='';}}/>
              </label>
            )}
          </div>
          {photoError&&<span className="err-msg">{photoError}</span>}
          <span className="help-msg">{isEn?'Photos are compressed automatically. Click a thumbnail to view full size.':'Las fotos se comprimen automáticamente. Clic en la miniatura para ver tamaño completo.'}</span>
        </div>
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button>
        <button className="btn-danger" title={tips.reportIncident} onClick={()=>{
          // For general incidents, aptId is not required
          const valid = isGeneral
            ? (f.date&&f.type&&f.category&&String(f.desc||'').trim())
            : validate();
          if(valid){try{localStorage.removeItem(DRAFT_KEY);}catch{}onSave({...f,photos,isGeneral,aptId:isGeneral?'':f.aptId});}
        }}>{appText(lang,"form.registerReport")}</button>
      </div>
    </Overlay>
  );
}


function VerifyIncidentModal({ incident, onSave, onClose, lang="es-CO", config={} }) {
  const tips = localizedTooltips(config, lang);
  const isEn = lang==='en';
  const blankGuest = () => ({ firstName:'', middleName:'', lastName:'', city:'', state:'', country:'Colombia' });
  const initialGuests = normalizeOwnerGuests(incident);
  const [guests,setGuests]=useState(initialGuests.length ? initialGuests : [blankGuest()]);
  const [ownerComments,setOwnerComments]=useState(incident?.ownerComments || '');
  const [ownerResolution,setOwnerResolution]=useState(incident?.ownerResolution || '');
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
    <div className="modal-title">{appText(lang,"modal.verify.title")}</div>
    <div className="modal-sub">{appText(lang,"modal.verify.sub",{apt:incident?.aptLabel||""})}</div>
    <div className="form-alert">{appText(lang,"modal.verify.help")}</div>
    <div className="guest-editor-list">
      {guests.map((g,idx)=><div key={idx} className="guest-editor-card">
        <div className="guest-editor-title"><strong>{appText(lang,'form.guestNumber',{count:idx+1})}</strong>{guests.length>1&&<button type="button" className="btn-mini-danger" onClick={()=>removeGuest(idx)}>🗑️ {appText(lang,'form.removeGuest')}</button>}</div>
        <div className="fg2 guest-grid">
          <div className="fg"><label>{appText(lang,'form.guestFirstName')} *</label><input className={errors[`firstName_${idx}`]?'field-error':''} value={g.firstName} onChange={e=>setGuest(idx,'firstName',e.target.value)} autoComplete="given-name"/>{errors[`firstName_${idx}`]&&<span className="err-msg">{errors[`firstName_${idx}`]}</span>}</div>
          <div className="fg"><label>{appText(lang,'form.guestLastName')} *</label><input className={errors[`lastName_${idx}`]?'field-error':''} value={g.lastName} onChange={e=>setGuest(idx,'lastName',e.target.value)} autoComplete="family-name"/>{errors[`lastName_${idx}`]&&<span className="err-msg">{errors[`lastName_${idx}`]}</span>}</div>
          <div className="fg"><label>{appText(lang,'form.guestMiddleName')} <span style={{fontSize:'.65rem',color:'#8a9fa5',fontWeight:400}}>{isEn?'(optional)':'(opcional)'}</span></label><input value={g.middleName} onChange={e=>setGuest(idx,'middleName',e.target.value)} /></div>
          <div className="fg"><label>{appText(lang,"form.city")} *</label><input className={errors[`city_${idx}`]?'field-error':''} value={g.city} onChange={e=>setGuest(idx,'city',e.target.value)} placeholder="Bogotá" autoComplete="address-level2"/>{errors[`city_${idx}`]&&<span className="err-msg">{errors[`city_${idx}`]}</span>}</div>
          <div className="fg"><label>{isEn?'State / Province':'Departamento / Estado'} <span style={{fontSize:'.65rem',color:'#8a9fa5',fontWeight:400}}>{isEn?'(optional)':'(opcional)'}</span></label><input value={g.state||''} onChange={e=>setGuest(idx,'state',e.target.value)} placeholder={isEn?'e.g. Cundinamarca':'ej. Cundinamarca'} autoComplete="address-level1"/></div>
          <div className="fg full"><label>{appText(lang,"form.country")} *</label><select className={errors[`country_${idx}`]?'field-error':''} value={g.country} onChange={e=>setGuest(idx,'country',e.target.value)}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>{errors[`country_${idx}`]&&<span className="err-msg">{errors[`country_${idx}`]}</span>}</div>
        </div>
      </div>)}
      <button type="button" className="btn-ghost" onClick={addGuest}>{appText(lang,'form.addGuest')}</button>
    </div>
    {/* Immediate action — REQUIRED */}
    <div className="fg full">
      <label>{appText(lang,"form.immediateAction")} <Tip text={tips.verifyIncident}/></label>
      <textarea className={errors.ownerComments?'field-error':''} value={ownerComments} onChange={e=>{setOwnerComments(e.target.value);setErrors(er=>({...er,ownerComments:undefined}));}} rows={3} placeholder={appText(lang,"form.immediateActionPlaceholder")}/>
      {errors.ownerComments&&<span className="err-msg">{errors.ownerComments}</span>}
    </div>
    {/* Your answer — OPTIONAL now, required later before admin can close */}
    <div className="fg full">
      <label>{appText(lang,"form.ownerResolution")}</label>
      <div className="verify-resolution-hint">{isEn?'Optional now — admin cannot close the incident until your resolution is provided.':'Opcional ahora — el admin no puede cerrar el incidente hasta que agregues tu respuesta.'}</div>
      <textarea value={ownerResolution} onChange={e=>setOwnerResolution(e.target.value)} rows={3} placeholder={appText(lang,"form.ownerResolutionPlaceholder")}/>
    </div>
    <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" title={tips.verifyIncident} onClick={()=>{ if(validate()) onSave({guests, ownerComments, ownerResolution});}}>{appText(lang,"form.saveVerification")}</button></div>
  </Overlay>;
}

function AddResolutionModal({ incident, onSave, onClose, lang="es-CO" }) {
  const isEn = lang==='en';
  const [text,setText]=useState(incident?.ownerResolution||'');
  const [err,setErr]=useState('');
  const submit=()=>{
    if(!String(text||'').trim()){setErr(isEn?'Resolution is required.':'Tu respuesta es requerida.');return;}
    onSave(text);
  };
  return <Overlay onClose={onClose}>
    <div className="modal-title">{isEn?'📝 Add resolution':'📝 Agregar respuesta'}</div>
    <div className="modal-sub">{incident?.aptLabel||''}</div>
    <div className="form-alert">{isEn?'Once you add your resolution, the admin will be notified and can close the incident.':'Al agregar tu respuesta el administrador será notificado y podrá cerrar el incidente.'}</div>
    <div className="fg full">
      <label>{appText(lang,"form.ownerResolution")} *</label>
      <textarea className={err?'field-error':''} value={text} onChange={e=>{setText(e.target.value);setErr('');}} rows={4} placeholder={appText(lang,"form.ownerResolutionPlaceholder")}/>
      {err&&<span className="err-msg">{err}</span>}
    </div>
    <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" onClick={submit}>{isEn?'Save resolution':'Guardar respuesta'}</button></div>
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

// All navigable views and their labels (bilingual)
const NAV_CONFIG_ITEMS = [
  { id:'my',        labelEs:'Mis Unidades',        labelEn:'My Units' },
  { id:'incidents', labelEs:'Incidentes', labelEn:'Incidents' },
  { id:'general',   labelEs:'Incidentes Generales', labelEn:'General Incidents' },
  { id:'listings',  labelEs:'Inventario',    labelEn:'Inventory' },
  { id:'dashboard', labelEs:'Dashboard',     labelEn:'Dashboard' },
  { id:'notifications',labelEs:'Alertas',   labelEn:'Alerts' },
  { id:'about',     labelEs:'Misión',        labelEn:'Mission' },
  { id:'analytics', labelEs:'Analíticas',   labelEn:'Analytics' },
  { id:'approvals', labelEs:'Registros',    labelEn:'Registrations' },
  { id:'admin',     labelEs:'Admin',         labelEn:'Admin' },
];
const NAV_ROLES = [
  { key:'user',     labelEs:'Propietario',   labelEn:'Owner / User' },
  { key:'delegate', labelEs:'Admin Delegado',labelEn:'Delegate Admin' },
  { key:'global',   labelEs:'Admin Global',  labelEn:'Global Admin' },
];
const DEFAULT_NAV_CONFIG = {
  user:     { landing:'my', primary:['my','incidents','listings','dashboard'] },
  delegate: { landing:'my', primary:['my','incidents','listings','dashboard'] },
  global:   { landing:'my', primary:['my','incidents','listings','dashboard'] },
};

function NavConfigEditor({ lang, isEn, config, onSave, showToast=()=>{}, defaultRole='global' }) {
  const [activeRole, setActiveRole] = useState(defaultRole);
  const [cfg, setCfg] = useState(()=>{
    try { return { ...DEFAULT_NAV_CONFIG, ...JSON.parse(config?.nav_config||'{}') }; }
    catch(e) { return { ...DEFAULT_NAV_CONFIG }; }
  });
  const [saving, setSaving] = useState(false);

  const roleCfg = cfg[activeRole] || DEFAULT_NAV_CONFIG[activeRole];

  const togglePrimary = (id) => {
    const cur = roleCfg.primary || [];
    const next = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id];
    setCfg(c=>({...c, [activeRole]:{...c[activeRole], primary:next}}));
  };
  const movePrimary = (id, dir) => {
    const cur = [...(roleCfg.primary||[])];
    const i = cur.indexOf(id); if(i<0) return;
    const j = i+dir; if(j<0||j>=cur.length) return;
    [cur[i],cur[j]] = [cur[j],cur[i]];
    setCfg(c=>({...c, [activeRole]:{...c[activeRole], primary:cur}}));
  };
  const setLanding = (v) => setCfg(c=>({...c, [activeRole]:{...c[activeRole], landing:v}}));

  const save = async () => {
    setSaving(true);
    await onSave(cfg);
    setSaving(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Role tabs */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {NAV_ROLES.map(r=>(
          <button key={r.key} type="button"
            style={{padding:'6px 14px',borderRadius:999,fontWeight:800,fontSize:'.78rem',border:'1.5px solid',cursor:'pointer',
              background:activeRole===r.key?'linear-gradient(135deg,#0b7f4f,#0b7f8c)':'rgba(255,255,255,.8)',
              color:activeRole===r.key?'#fff':'#17313a',borderColor:activeRole===r.key?'transparent':'rgba(47,79,58,.2)'}}
            onClick={()=>setActiveRole(r.key)}>
            {isEn?r.labelEn:r.labelEs}
          </button>
        ))}
      </div>
      {/* Landing page */}
      <div className="fg">
        <label>{isEn?'Default landing page':'Página de inicio por defecto'}</label>
        <select value={roleCfg.landing||'my'} onChange={e=>setLanding(e.target.value)}>
          {NAV_CONFIG_ITEMS.map(n=><option key={n.id} value={n.id}>{isEn?n.labelEn:n.labelEs}</option>)}
        </select>
      </div>
      {/* Primary nav items */}
      <div>
        <div style={{fontSize:'.78rem',fontWeight:900,color:'#17313a',marginBottom:8}}>{isEn?'Primary nav (shown in top bar)':'Nav principal (visible en la barra superior)'}</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {NAV_CONFIG_ITEMS.map(n=>{
            const inPrimary = (roleCfg.primary||[]).includes(n.id);
            const idx = (roleCfg.primary||[]).indexOf(n.id);
            return (
              <div key={n.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:inPrimary?'rgba(11,127,140,.06)':'rgba(47,79,58,.03)',borderRadius:8,border:'1px solid',borderColor:inPrimary?'rgba(11,127,140,.2)':'rgba(47,79,58,.1)'}}>
                <input type="checkbox" checked={inPrimary} onChange={()=>togglePrimary(n.id)} id={`ncp-${n.id}-${activeRole}`} style={{width:16,height:16,flexShrink:0,cursor:'pointer'}}/>
                <label htmlFor={`ncp-${n.id}-${activeRole}`} style={{flex:1,fontSize:'.82rem',fontWeight:700,color:'#17313a',cursor:'pointer'}}>{isEn?n.labelEn:n.labelEs}</label>
                {inPrimary&&<span style={{fontSize:'.7rem',color:'#496674',background:'rgba(47,79,58,.08)',padding:'2px 7px',borderRadius:999}}>#{idx+1}</span>}
                {inPrimary&&<button type="button" onClick={()=>movePrimary(n.id,-1)} disabled={idx===0} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.9rem',opacity:idx===0?.3:1,padding:'0 2px'}}>↑</button>}
                {inPrimary&&<button type="button" onClick={()=>movePrimary(n.id,1)} disabled={idx>=(roleCfg.primary||[]).length-1} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.9rem',opacity:idx>=(roleCfg.primary||[]).length-1?.3:1,padding:'0 2px'}}>↓</button>}
                {!inPrimary&&<span style={{fontSize:'.7rem',color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'More menu':'Menú más'}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <button className="btn-p" onClick={save} disabled={saving} style={{alignSelf:'flex-start'}}>
        {saving?(isEn?'Saving…':'Guardando…'):(isEn?'Save navigation config':'Guardar configuración de navegación')}
      </button>
    </div>
  );
}

// ─── COMMUNITY CRUD MODAL ────────────────────────────────────────────────────
function CommunityCrudModal({ mode='create', initial={}, onSave, onClose, lang='es-CO' }) {
  const isEn = lang === 'en';
  const isEdit = mode === 'edit';
  const [f, setF] = useState({
    id: initial.id || '',
    name: initial.name || '',
    nameEn: initial.name_en || '',
    tower: initial.tower || '',
    city: initial.city || '',
    country: initial.country || 'Colombia',
    logoUrl: initial.logo_url || '',
    backgroundUrl: initial.background_url || '',
    description: initial.description || '',
    descriptionEn: initial.description_en || '',
    isActive: initial.is_active !== false,
  });
  const [logoMode, setLogoMode] = useState('url');
  const [bgMode, setBgMode] = useState('url');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const s = (k, v) => setF(p => ({...p, [k]: v}));

  const validate = () => {
    const e = {};
    if (!isEdit && !String(f.id||'').trim()) e.id = isEn ? 'ID is required' : 'ID es requerido';
    else if (!isEdit && f.id && !/^[a-z0-9-]+$/.test(f.id)) e.id = isEn ? 'Lowercase letters, numbers, and hyphens only' : 'Solo letras minúsculas, números y guiones';
    if (!String(f.name||'').trim()) e.name = isEn ? 'Name (Spanish) is required' : 'Nombre (Español) es requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(f); } catch(e) { setSaving(false); }
  };

  const imgField = (label, urlKey, mode, setMode) => (
    <div className="fg full">
      <label>{label}</label>
      <div style={{display:'flex',gap:8,marginBottom:6}}>
        <button type="button" className={`chip ${mode==='url'?'chip-active':''}`} onClick={()=>setMode('url')}>URL</button>
        <button type="button" className={`chip ${mode==='file'?'chip-active':''}`} onClick={()=>setMode('file')}>{isEn?'Upload':'Subir'}</button>
      </div>
      {mode==='url' && <input value={f[urlKey]} onChange={e=>s(urlKey,e.target.value)} placeholder="https://..." className="input" style={{marginBottom:6}}/>}
      {mode==='file' && <input type="file" accept="image/*" style={{marginBottom:6}} onChange={e=>{const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=ev=>s(urlKey,ev.target?.result||'');r.readAsDataURL(file);}}/>}
      {f[urlKey] && <div style={{marginTop:4,padding:6,background:'#f5fbfd',borderRadius:6,display:'inline-block'}}>
        <img src={f[urlKey]} alt="preview" style={{maxHeight:48,maxWidth:180,objectFit:'contain',display:'block'}} onError={e=>{e.target.style.display='none';}}/>
      </div>}
      {f[urlKey] && <button type="button" className="btn-ghost" style={{fontSize:'.72rem',padding:'2px 8px',marginTop:4}} onClick={()=>s(urlKey,'')}>{isEn?'Remove':'Quitar'}</button>}
    </div>
  );

  return (
    <Overlay onClose={onClose}>
      <div className="modal-title">{isEdit?(isEn?'✏️ Edit community':'✏️ Editar comunidad'):(isEn?'＋ New community':'＋ Nueva comunidad')}</div>
      <div className="fg2">
        {!isEdit && (
          <div className="fg full">
            <label>{isEn?'Community ID (slug)':'ID de comunidad (slug)'} <span style={{color:'#e53935',fontSize:'.75rem'}}>*</span></label>
            <input value={f.id} onChange={e=>s('id',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="my-community" className={errors.id?'field-error':''}/>
            <span className="help-msg">{isEn?'Lowercase letters, numbers, hyphens. Cannot be changed after creation.':'Letras minúsculas, números, guiones. No se puede cambiar luego.'}</span>
            {errors.id && <span className="err-msg">{errors.id}</span>}
          </div>
        )}
        <div className="fg">
          <label>{isEn?'Name (Spanish)':'Nombre (Español)'} <span style={{color:'#e53935',fontSize:'.75rem'}}>*</span></label>
          <input value={f.name} onChange={e=>s('name',e.target.value)} className={errors.name?'field-error':''}/>
          {errors.name && <span className="err-msg">{errors.name}</span>}
        </div>
        <div className="fg">
          <label>{isEn?'Name (English)':'Nombre (Inglés)'}</label>
          <input value={f.nameEn} onChange={e=>s('nameEn',e.target.value)}/>
        </div>
        <div className="fg">
          <label>{isEn?'Tower label':'Etiqueta de torre'}</label>
          <input value={f.tower} onChange={e=>s('tower',e.target.value)} placeholder="KAI"/>
          <span className="help-msg">{isEn?'Short label shown on unit plates (e.g. KAI, OLAS, NORTE).':'Etiqueta corta en fichas de unidad (ej. KAI, OLAS, NORTE).'}</span>
        </div>
        <div className="fg">
          <label>{isEn?'City':'Ciudad'}</label>
          <input value={f.city} onChange={e=>s('city',e.target.value)} placeholder="Cartagena"/>
        </div>
        <div className="fg">
          <label>{isEn?'Country':'País'}</label>
          <input value={f.country} onChange={e=>s('country',e.target.value)} placeholder="Colombia"/>
        </div>
        {imgField(isEn?'Logo':'Logo', 'logoUrl', logoMode, setLogoMode)}
        {imgField(isEn?'Background image (login / registration screens)':'Imagen de fondo (login y registro)', 'backgroundUrl', bgMode, setBgMode)}
        <div className="fg full">
          <label>{isEn?'Description (Spanish)':'Descripción (Español)'}</label>
          <textarea className="admin-textarea" rows={2} value={f.description} onChange={e=>s('description',e.target.value)}/>
        </div>
        <div className="fg full">
          <label>{isEn?'Description (English)':'Descripción (Inglés)'}</label>
          <textarea className="admin-textarea" rows={2} value={f.descriptionEn} onChange={e=>s('descriptionEn',e.target.value)}/>
        </div>
        {isEdit && (
          <div className="fg full">
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none'}}>
              <input type="checkbox" checked={f.isActive} onChange={e=>s('isActive',e.target.checked)} style={{width:16,height:16}}/>
              {isEn?'Active (visible and accessible to users)':'Activa (visible y accesible para usuarios)'}
            </label>
          </div>
        )}
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{isEn?'Cancel':'Cancelar'}</button>
        <button className="btn-p" onClick={handleSave} disabled={saving}>{saving?(isEn?'Saving...':'Guardando...'):`💾 ${isEn?'Save':'Guardar'}`}</button>
      </div>
    </Overlay>
  );
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
        {action && <div className="admin-sec-action" onClick={e=>e.stopPropagation()}>{action}</div>}
        <span className={`admin-sec-chevron${open?' asc-up':''}`}>{open?'▲':'▼'}</span>
      </div>
      {open && <div className="admin-sec-body">{children}</div>}
    </div>
  );
}

// ─── AUDIT LOG VIEWER ────────────────────────────────────────────────────────
const AUDIT_ENTITIES = ['all','listing','incident','user_role','app_config','registration','email_template'];
function AuditLogViewer({ user, lang="es-CO", isEn=false }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState('all');
  const [actor, setActor] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offset, setOffset] = useState(0);
  const PAGE = 50;
  const load = useCallback(async (off=0) => {
    if(!user?.uid) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ uid:user.uid, email:user.email||'', limit:PAGE, offset:off });
      if(entity && entity!=='all') p.set('entity', entity);
      if(actor.trim()) p.set('actor', actor.trim());
      if(dateFrom) p.set('dateFrom', dateFrom);
      if(dateTo) p.set('dateTo', dateTo);
      const r = await api.get('/api/admin/audit-logs?' + p.toString());
      setLogs(r.logs || []);
      setTotal(r.total || 0);
      setOffset(off);
    } catch(e) { console.error('[AUDIT_LOG]', e); }
    finally { setLoading(false); }
  }, [user?.uid, user?.email, entity, actor, dateFrom, dateTo]);
  useEffect(() => { load(0); }, []); // eslint-disable-line
  const fmt = (ts) => { try{ return new Date(ts).toLocaleString(isEn?'en-US':'es-CO',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch{ return ts||''; }};
  const entityLabel = (e) => ({ listing:'🏠',incident:'⚠️',user_role:'👥',app_config:'⚙️',registration:'📝',email_template:'📨' }[e]||'•') + ' ' + (e||'');
  return (
    <div className="audit-wrap">
      {/* Filters */}
      <div className="audit-filters">
        <select className="audit-select" value={entity} onChange={e=>setEntity(e.target.value)}>
          {AUDIT_ENTITIES.map(e=><option key={e} value={e}>{e==='all'?(isEn?'All entities':'Todas las entidades'):entityLabel(e)}</option>)}
        </select>
        <input className="audit-input" placeholder={isEn?'Filter by actor email…':'Filtrar por email del actor…'} value={actor} onChange={e=>setActor(e.target.value)}/>
        <input type="date" className="audit-input audit-date" value={dateFrom} max={dateTo||''} onChange={e=>setDateFrom(e.target.value)} title={isEn?'From date':'Desde'}/>
        <span style={{color:'#8a9fa5',flexShrink:0}}>–</span>
        <input type="date" className="audit-input audit-date" value={dateTo} min={dateFrom||''} onChange={e=>setDateTo(e.target.value)} title={isEn?'To date':'Hasta'}/>
        <button className="btn-p" style={{minHeight:36,padding:'6px 14px',flexShrink:0}} onClick={()=>load(0)} disabled={loading}>
          {loading?'…':(isEn?'Search':'Buscar')}
        </button>
        {(entity!=='all'||actor||dateFrom||dateTo)&&
          <button className="btn-ghost" style={{minHeight:36,padding:'6px 10px',flexShrink:0}} onClick={()=>{setEntity('all');setActor('');setDateFrom('');setDateTo('');setTimeout(()=>load(0),0);}}>✕</button>}
      </div>
      {/* Stats bar */}
      <div className="audit-stats-bar">
        <span>{isEn?`${total} total entries`:`${total} entradas totales`}</span>
        {total>PAGE&&<span style={{opacity:.6}}>{isEn?`Showing ${offset+1}–${Math.min(offset+PAGE,total)}`:`Mostrando ${offset+1}–${Math.min(offset+PAGE,total)}`}</span>}
      </div>
      {/* Table */}
      {loading
        ? <div style={{padding:'18px 0',color:'#2a5a6a',display:'flex',alignItems:'center',gap:8}}><span className="spinner-sm"/> {isEn?'Loading…':'Cargando…'}</div>
        : logs.length===0
          ? <div style={{padding:'20px 0',color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'No entries found for the selected filters.':'No se encontraron entradas con los filtros seleccionados.'}</div>
          : <div className="table-wrap">
              <table className="admin-table audit-table">
                <thead><tr>
                  <th>{isEn?'Time':'Fecha/hora'}</th>
                  <th>{isEn?'Entity':'Entidad'}</th>
                  <th>{isEn?'Action':'Acción'}</th>
                  <th>{isEn?'Actor':'Actor'}</th>
                  <th>{isEn?'Details':'Detalles'}</th>
                </tr></thead>
                <tbody>
                  {logs.map((r,i)=>(
                    <tr key={r.id||i}>
                      <td style={{whiteSpace:'nowrap',fontSize:'.72rem',color:'#496674'}}>{fmt(r.created_at)}</td>
                      <td><span className="audit-entity-chip">{entityLabel(r.entity)}</span>{r.entity_id&&<code className="audit-id">{String(r.entity_id).slice(0,8)}…</code>}</td>
                      <td><span className="audit-action">{r.action}</span></td>
                      <td style={{fontSize:'.74rem',color:'#17313a',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.actor_email||r.actor_uid||'—'}</td>
                      <td>
                        {(r.before||r.after)&&(
                          <details className="audit-detail">
                            <summary className="audit-detail-toggle">{isEn?'diff':'diff'}</summary>
                            <div className="audit-detail-body">
                              {r.before&&<div><strong>Before:</strong><pre className="audit-json">{JSON.stringify(r.before,null,2)}</pre></div>}
                              {r.after&&<div><strong>After:</strong><pre className="audit-json">{JSON.stringify(r.after,null,2)}</pre></div>}
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
      {/* Pagination */}
      {total>PAGE&&(
        <div className="audit-pagination">
          <button className="btn-ghost bsm" disabled={offset===0||loading} onClick={()=>load(Math.max(0,offset-PAGE))}>← {isEn?'Prev':'Anterior'}</button>
          <span style={{fontSize:'.78rem',color:'#496674'}}>{Math.floor(offset/PAGE)+1} / {Math.ceil(total/PAGE)}</span>
          <button className="btn-ghost bsm" disabled={offset+PAGE>=total||loading} onClick={()=>load(offset+PAGE)}>{isEn?'Next':'Siguiente'} →</button>
        </div>
      )}
    </div>
  );
}

function AdminSettings({ config={}, user, listings=[], contactProps={}, onSave, showToast=()=>{}, lang="es-CO", adminInfo={} }) {
  const isEn = lang === 'en';
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
  const [uiLabelsEs,setUiLabelsEs]=useState(()=>parseJsonObject(config?.ui_labels_es,{}));
  const [uiLabelsEn,setUiLabelsEn]=useState(()=>parseJsonObject(config?.ui_labels_en,{}));
  const [uiLabelSearch,setUiLabelSearch]=useState('');
  const [uiLabelLang,setUiLabelLang]=useState('es');
  const [uiLabelOpenGroups,setUiLabelOpenGroups]=useState({});
  const toggleUlaGroup = (id) => setUiLabelOpenGroups(s=>({...s,[id]:!s[id]}));
  const [templates,setTemplates]=useState({});
  const [templateVars,setTemplateVars]=useState({});
  const [selectedTemplate,setSelectedTemplate]=useState('incident_new');
  const [templateLang,setTemplateLang]=useState('es-CO');
  const [templateCommunityId,setTemplateCommunityId]=useState('__global__');
  const [tplLoading,setTplLoading]=useState(false);
  const [emailNotifConfig,setEmailNotifConfig]=useState({});
  const [emailNotifLoading,setEmailNotifLoading]=useState(false);
  const [emailNotifSaving,setEmailNotifSaving]=useState(false);
  const [adminErrors,setAdminErrors]=useState([]);
  const [lastUiError,setLastUiError]=useState('');
  const [brandingNameEs,setBrandingNameEs]=useState(config?.complex_name_es||'Propietarios Airbnb KAI');
  const [brandingNameEn,setBrandingNameEn]=useState(config?.complex_name_en||'KAI Airbnb Owners');
  const [brandingLocation,setBrandingLocation]=useState(config?.complex_location||'Serena del Mar · Cartagena 🇨🇴');
  const [brandingLogo,setBrandingLogo]=useState(config?.complex_logo||'');
  const [brandingLogoMode,setBrandingLogoMode]=useState('url');
  const [brandingBg,setBrandingBg]=useState(config?.complex_bg??'/morros-kai-bg.jpg');
  const [brandingBgMode,setBrandingBgMode]=useState('url');
  const [emailFromName,setEmailFromName]=useState(config?.email_from_name||'Propietarios Airbnb KAI');
  const [emailFromAddress,setEmailFromAddress]=useState(config?.email_from_address||'');
  const [emailFromNameEn,setEmailFromNameEn]=useState(config?.email_from_name_en||'KAI Airbnb Owners');
  const [emailFromAddressEn,setEmailFromAddressEn]=useState(config?.email_from_address_en||'');
  // Phase 4 — community management state
  const [communityFeatureEnabled, setCommunityFeatureEnabled] = useState(String(config?.community_feature_enabled ?? 'true') !== 'false');
  const [defaultCommunityId, setDefaultCommunityId] = useState(config?.default_community_id || 'kai');
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communityModal, setCommunityModal] = useState(null); // null | {mode:'create'|'edit', data:{}}
  const [communityMembersOpen, setCommunityMembersOpen] = useState({});
  const [communityMembers, setCommunityMembers] = useState({});
  const [communityMembersLoading, setCommunityMembersLoading] = useState({});
  const [memberPermsEditing, setMemberPermsEditing] = useState({});  // {cid_uid: permissions obj}
  const [communityConfigData, setCommunityConfigData] = useState({}); // {cid: {globalValues, communityOverrides, overridesEnabled}}
  const [communityConfigLoading, setCommunityConfigLoading] = useState({});
  const [communityConfigOpen, setCommunityConfigOpen] = useState({});
  const [communityConfigDraft, setCommunityConfigDraft] = useState({}); // {cid: {key: value}}
  const [communityOverridesEnabled, setCommunityOverridesEnabled] = useState({}); // {cid: bool}
  const [communityTplOpen, setCommunityTplOpen] = useState({});
  const [communityTplData, setCommunityTplData] = useState({});
  const [communityTplLoading, setCommunityTplLoading] = useState({});
  const [communityTplLang, setCommunityTplLang] = useState({});
  const [communityTplSelected, setCommunityTplSelected] = useState({});
  const [communityRoutingOpen, setCommunityRoutingOpen] = useState({});
  const [communityRoutingData, setCommunityRoutingData] = useState({});
  const [communityRoutingLoading, setCommunityRoutingLoading] = useState({});
  const [communityRoutingDraft, setCommunityRoutingDraft] = useState({});
  const ADMIN_SEC_DEFAULT = {communities:false,branding:false,emailSender:false,roles:true,sla:false,mission:false,menu:false,delegate:false,users:true,tooltips:false,uiLabels:false,email:false,emailNotif:false,auditLog:false};
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
    setUiLabelsEs(parseJsonObject(config?.ui_labels_es,{}));
    setUiLabelsEn(parseJsonObject(config?.ui_labels_en,{}));
    setCommunityFeatureEnabled(String(config?.community_feature_enabled ?? 'true') !== 'false');
    setDefaultCommunityId(config?.default_community_id || 'kai');
    try { setLastUiError(localStorage.getItem('kai_last_ui_error') || localStorage.getItem('kai_last_admin_error') || ''); } catch(e) {}
  }, [config?.mission_sections_es, config?.sla_hours, config?.escalation_cc_emails, config?.analytics_enabled, config?.community_feature_enabled, config?.default_community_id, lang, user?.email]);
  const templateEntries = Object.entries((templates && typeof templates==='object') ? templates : {}).filter(([k,v])=>k && v && typeof v==='object');
  const selectedKey = (templates && templates[selectedTemplate]) ? selectedTemplate : (templateEntries[0]?.[0] || '');
  const selected = selectedKey ? (templates[selectedKey] || {}) : {};
  const selectedVars = (templateVars && typeof templateVars==='object' && Array.isArray(templateVars[selectedKey])) ? templateVars[selectedKey] : [];
  const loadTemplates = useCallback(()=>{
    if (!user?.uid) return;
    setTplLoading(true);
    setAdminErrors([]);
    const url = '/api/admin/email-templates?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '') + '&language=' + encodeURIComponent(templateLang) + '&communityId=' + encodeURIComponent(templateCommunityId||'__global__');
    trace('loading templates', url);
    api.get(url).then(r => {
      const incoming = (r?.templates && typeof r.templates === 'object') ? r.templates : {};
      setTemplates(incoming);
      setTemplateVars((r?.variables && typeof r.variables === 'object') ? r.variables : {});
      const keys = Object.keys(incoming);
      if (!incoming[selectedTemplate] && keys.length) setSelectedTemplate(keys[0]);
      trace('templates loaded', keys);
    }).catch(e => { captureAdminError('email-templates', e); showToast(lt(lang,'Error cargando plantillas de email') + ': ' + (e.message || ''), true); }).finally(()=>setTplLoading(false));
  }, [user?.uid, user?.email, selectedTemplate, lang, templateLang, templateCommunityId]);
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
      const r = await api.put('/api/admin/email-templates', { actorUid:user.uid, actorEmail:user.email, templates, language:templateLang, communityId:templateCommunityId||'__global__' });
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
  const saveUiLabels = () => onSave({ uiLabelsEs, uiLabelsEn });
  const saveBranding = () => onSave({ complexNameEs:brandingNameEs, complexNameEn:brandingNameEn, complexLocation:brandingLocation, complexLogo:brandingLogo, complexBg:brandingBg });
  const saveEmailSender = () => { if (!emailFromAddress.trim() || !emailFromAddressEn.trim()) { showToast(isEn?'Both email addresses are required':'Ambos emails son requeridos', true); return; } onSave({ emailFromName, emailFromAddress, emailFromNameEn, emailFromAddressEn }); };
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

  // ── Community CRUD ────────────────────────────────────────────────────────
  const loadCommunities = useCallback(() => {
    if (!user?.uid) return;
    setCommunitiesLoading(true);
    api.get('/api/communities?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email||''))
      .then(r => setCommunities(Array.isArray(r?.communities) ? r.communities : []))
      .catch(e => captureAdminError('communities', e))
      .finally(() => setCommunitiesLoading(false));
  }, [user?.uid, user?.email]);

  useEffect(() => { if (openSections.communities) loadCommunities(); }, [openSections.communities, loadCommunities]);

  const loadCommunityMembers = async (cid) => {
    setCommunityMembersLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/communities/${cid}/members?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}`);
      setCommunityMembers(p => ({...p,[cid]: Array.isArray(r?.members)?r.members:[]}));
    } catch(e) { captureAdminError('community-members', e); }
    finally { setCommunityMembersLoading(p => ({...p,[cid]:false})); }
  };

  const toggleCommunityMembers = (cid) => {
    const opening = !communityMembersOpen[cid];
    setCommunityMembersOpen(p => ({...p,[cid]:opening}));
    if (opening && !communityMembers[cid]) loadCommunityMembers(cid);
  };

  const loadCommunityConfig = async (cid) => {
    setCommunityConfigLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/communities/${cid}/config?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}`);
      setCommunityConfigData(p => ({...p,[cid]:r}));
      setCommunityOverridesEnabled(p => ({...p,[cid]:r.overridesEnabled}));
      setCommunityConfigDraft(p => ({...p,[cid]:{...(r.communityOverrides||{})}}));
    } catch(e) { captureAdminError('load-community-config', e); }
    finally { setCommunityConfigLoading(p => ({...p,[cid]:false})); }
  };

  const saveCommunityConfig = async (cid) => {
    try {
      await api.put(`/api/communities/${cid}/config`, { actorUid:user.uid, actorEmail:user.email, overrides: communityConfigDraft[cid]||{} });
      showToast(isEn?'✅ Community settings saved':'✅ Configuración de comunidad guardada');
      loadCommunityConfig(cid);
    } catch(e) { captureAdminError('save-community-config', e); showToast(e.message||String(e), true); }
  };

  const toggleCommunityOverrides = async (cid, enabled) => {
    try {
      await api.put(`/api/communities/${cid}/config/overrides-enabled`, { actorUid:user.uid, actorEmail:user.email, enabled });
      showToast(isEn ? (enabled?'✅ Community overrides enabled':'✅ Community overrides disabled') : (enabled?'✅ Overrides habilitados':'✅ Overrides deshabilitados'));
      setCommunityOverridesEnabled(p => ({...p,[cid]:enabled}));
      loadCommunityConfig(cid);
    } catch(e) { captureAdminError('toggle-community-overrides', e); showToast(e.message||String(e), true); }
  };

  const loadCommunityTemplates = async (cid, lang) => {
    const l = lang || communityTplLang[cid] || 'es-CO';
    setCommunityTplLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/admin/email-templates?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}&language=${encodeURIComponent(l)}&communityId=${encodeURIComponent(cid)}`);
      setCommunityTplData(p => ({...p,[cid]:r}));
      const keys = Object.keys(r?.templates||{});
      if (!communityTplSelected[cid] && keys.length) setCommunityTplSelected(p => ({...p,[cid]:keys[0]}));
    } catch(e) { captureAdminError('load-community-templates', e); showToast((e.message||String(e)), true); }
    finally { setCommunityTplLoading(p => ({...p,[cid]:false})); }
  };

  const saveCommunityTemplates = async (cid) => {
    const tplD = communityTplData[cid];
    if (!tplD?.templates) return;
    try {
      const r = await api.put('/api/admin/email-templates', { actorUid:user.uid, actorEmail:user.email, templates:tplD.templates, language:communityTplLang[cid]||'es-CO', communityId:cid });
      setCommunityTplData(p => ({...p,[cid]:{...(p[cid]||{}), templates:r.templates||tplD.templates}}));
      showToast(isEn?'✅ Community templates saved':'✅ Plantillas de comunidad guardadas');
    } catch(e) { captureAdminError('save-community-templates', e); showToast((e.message||String(e)), true); }
  };

  const loadCommunityRouting = async (cid) => {
    setCommunityRoutingLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/communities/${cid}/email-routing?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}`);
      setCommunityRoutingData(p => ({...p,[cid]:r}));
      const draft = {};
      (r.eventKeys||[]).forEach(k => { draft[k] = { cc: ((r.communityRouting||{})[k]?.cc||[]).join(', ') }; });
      setCommunityRoutingDraft(p => ({...p,[cid]:draft}));
    } catch(e) { captureAdminError('load-community-routing', e); showToast((e.message||String(e)), true); }
    finally { setCommunityRoutingLoading(p => ({...p,[cid]:false})); }
  };

  const saveCommunityRouting = async (cid) => {
    const draft = communityRoutingDraft[cid] || {};
    const routing = {};
    Object.entries(draft).forEach(([k, v]) => { if (v?.cc?.trim()) routing[k] = { cc: v.cc.split(',').map(e=>e.trim()).filter(Boolean) }; });
    try {
      const r = await api.put(`/api/communities/${cid}/email-routing`, { actorUid:user.uid, actorEmail:user.email, routing });
      setCommunityRoutingData(p => ({...p,[cid]:{...(p[cid]||{}), communityRouting:r.communityRouting||{}}}));
      showToast(isEn?'✅ Email routing saved':'✅ Enrutamiento de email guardado');
    } catch(e) { captureAdminError('save-community-routing', e); showToast((e.message||String(e)), true); }
  };

  const saveCommunity = async (f) => {
    const isEdit = f.id && communities.some(c => c.id === f.id);
    try {
      if (isEdit) {
        await api.put(`/api/communities/${f.id}`, { actorUid:user.uid, actorEmail:user.email, name:f.name, nameEn:f.nameEn, tower:f.tower, city:f.city, country:f.country, logoUrl:f.logoUrl, backgroundUrl:f.backgroundUrl, description:f.description, descriptionEn:f.descriptionEn, isActive:f.isActive });
        showToast(isEn ? '✅ Community updated' : '✅ Comunidad actualizada');
      } else {
        await api.post('/api/communities', { actorUid:user.uid, actorEmail:user.email, id:f.id, name:f.name, nameEn:f.nameEn, tower:f.tower, city:f.city, country:f.country, logoUrl:f.logoUrl, backgroundUrl:f.backgroundUrl, description:f.description, descriptionEn:f.descriptionEn });
        showToast(isEn ? '✅ Community created' : '✅ Comunidad creada');
      }
      setCommunityModal(null);
      loadCommunities();
    } catch(e) { captureAdminError('save-community', e); showToast((e.message||String(e)), true); throw e; }
  };

  const deleteCommunity = async (cid) => {
    if (!window.confirm(isEn ? `Delete community "${cid}"? This cannot be undone.` : `¿Eliminar la comunidad "${cid}"? No se puede deshacer.`)) return;
    try {
      await api.del(`/api/communities/${cid}`, { actorUid:user.uid, actorEmail:user.email });
      showToast(isEn ? '✅ Community deleted' : '✅ Comunidad eliminada');
      loadCommunities();
    } catch(e) { captureAdminError('delete-community', e); showToast((e.message||String(e)), true); }
  };

  const promoteCommunityAdmin = async (cid, m) => {
    try {
      await api.post(`/api/communities/${cid}/members/${m.userUid}/promote`, { actorUid:user.uid, actorEmail:user.email, userEmail:m.userEmail });
      showToast(isEn?'✅ Promoted to community admin':'✅ Promovido a admin de comunidad');
      loadCommunityMembers(cid);
    } catch(e) { captureAdminError('promote-admin', e); showToast((e.message||String(e)), true); }
  };

  const demoteCommunityAdmin = async (cid, m) => {
    try {
      await api.del(`/api/communities/${cid}/members/${m.userUid}/promote`, { actorUid:user.uid, actorEmail:user.email });
      showToast(isEn?'✅ Admin role removed':'✅ Rol de admin removido');
      loadCommunityMembers(cid);
    } catch(e) { captureAdminError('demote-admin', e); showToast((e.message||String(e)), true); }
  };

  const updateMemberPerms = async (cid, uid, perms) => {
    try {
      await api.patch(`/api/communities/${cid}/members/${uid}/permissions`, { actorUid:user.uid, actorEmail:user.email, permissions:perms });
      showToast(isEn?'✅ Permissions saved':'✅ Permisos guardados');
      setMemberPermsEditing(p => { const n={...p}; delete n[`${cid}_${uid}`]; return n; });
      loadCommunityMembers(cid);
    } catch(e) { captureAdminError('update-member-perms', e); showToast((e.message||String(e)), true); }
  };

  return <div className="fade">
  <div className="ph" style={{flexWrap:'wrap',gap:12,alignItems:'flex-start'}}>
    <div><h1 className="ptitle">⚙️ {lt(lang,'Configuración global')}</h1><p className="psub">{lt(lang,'Solo administradores globales · SLA, copias, misión y plantillas de email')}</p></div>
    <div style={{display:'flex',gap:8,flexShrink:0,alignItems:'center'}}>
      <button className="btn-ghost" style={{minHeight:36,padding:'6px 12px',fontSize:'.8rem'}} onClick={expandAll}>{lang==='en'?'▼ Expand all':'▼ Expandir todo'}</button>
      <button className="btn-ghost" style={{minHeight:36,padding:'6px 12px',fontSize:'.8rem'}} onClick={collapseAll}>{lang==='en'?'▲ Collapse all':'▲ Colapsar todo'}</button>
    </div>
  </div>

  {(adminErrors.length > 0 || lastUiError) && <div className="card" style={{marginBottom:18,borderLeft:'4px solid #d4634a'}}><div className="card-title">🧪 {lt(lang,'Diagnóstico')}</div><p className="psub">{lt(lang,'Ver consola del navegador para más detalles.')}</p>{adminErrors.map((e,i)=><pre key={i} className="codebox" style={{whiteSpace:'pre-wrap',marginTop:8}}>{JSON.stringify(e,null,2)}</pre>)}{lastUiError&&<><div className="section-label" style={{marginTop:12}}>{lt(lang,'Último error de interfaz')}</div><pre className="codebox" style={{whiteSpace:'pre-wrap'}}>{lastUiError}</pre></>}<button className="btn-ghost" onClick={clearSavedErrors}>{lt(lang,'Limpiar error guardado')}</button></div>}

  {/* ── My Community Settings (community admins only) ──────────────────── */}
  {adminInfo.isCommunityAdmin && !adminInfo.isGlobalAdmin && (adminInfo.communityAdminOf||[]).map(ca => (
    <div key={ca.communityId} className="card" style={{marginBottom:16,border:'1px solid #cce7ee'}}>
      <div style={{fontWeight:700,fontSize:'1rem',color:'#17313a',marginBottom:2}}>🏢 {isEn?'My Community Settings':'Configuración de mi comunidad'} <code style={{fontSize:'.78rem',background:'#eef6f8',padding:'1px 6px',borderRadius:4}}>{ca.communityId}</code></div>
      <div style={{fontSize:'.8rem',color:'#6b9ba8',marginBottom:10}}>{isEn?'Configure settings specific to your community.':'Configura ajustes específicos para tu comunidad.'}</div>
      <div style={{borderTop:'1px solid #e8f4f8',paddingTop:8}}>
        <button type="button" className="btn-ghost" style={{fontSize:'.78rem',padding:'3px 10px'}}
          onClick={()=>{
            const opening = !communityConfigOpen[ca.communityId];
            setCommunityConfigOpen(p=>({...p,[ca.communityId]:opening}));
            if (opening && !communityConfigData[ca.communityId]) loadCommunityConfig(ca.communityId);
          }}>
          ⚙️ {isEn?'Community Settings':'Configuración de comunidad'} {communityConfigOpen[ca.communityId]?'▲':'▼'}
        </button>
        {communityConfigOpen[ca.communityId] && (
          <div style={{marginTop:10}}>
            {communityConfigLoading[ca.communityId] && <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading...':'Cargando...'}</div>}
            {!communityConfigLoading[ca.communityId] && communityConfigData[ca.communityId] && (() => {
              const cfg = communityConfigData[ca.communityId];
              const draft = communityConfigDraft[ca.communityId] || {};
              const overridesOn = communityOverridesEnabled[ca.communityId];
              const LABELS = {
                mission_title_es: isEn?'Mission title (ES)':'Título de misión (ES)',
                mission_body_es: isEn?'Mission body (ES)':'Cuerpo de misión (ES)',
                mission_title_en: 'Mission title (EN)',
                mission_body_en: 'Mission body (EN)',
                escalation_cc_emails: isEn?'Escalation CC emails':'Emails de escalación CC',
                community_admin_default_permissions: isEn?'Default admin permissions (JSON)':'Permisos default admin (JSON)',
                tooltips_es: isEn?'Tooltips/instructions (ES, JSON)':'Tooltips/instrucciones (ES, JSON)',
                tooltips_en: 'Tooltips/instructions (EN, JSON)',
                ui_labels_es: isEn?'UI labels (ES, JSON)':'Etiquetas de UI (ES, JSON)',
                ui_labels_en: 'UI labels (EN, JSON)',
              };
              return (
                <div>
                  {Object.entries(LABELS).map(([key, label]) => {
                    const globalVal = cfg.globalValues?.[key] || '';
                    const overrideVal = draft[key] ?? cfg.communityOverrides?.[key] ?? '';
                    const hasOverride = key in (cfg.communityOverrides||{}) || key in draft;
                    const isTextarea = key.includes('body') || key.includes('sections') || key.includes('permissions');
                    return (
                      <div key={key} style={{marginBottom:10,paddingBottom:10,borderBottom:'1px solid #f0f8fb'}}>
                        <div style={{fontSize:'.75rem',fontWeight:700,color:'#2F4F3A',marginBottom:4}}>
                          {label}
                          {hasOverride && <span style={{marginLeft:6,fontSize:'.68rem',background:'#d9b45a22',color:'#7a5a00',padding:'1px 6px',borderRadius:4,fontWeight:600}}>{isEn?'overridden':'sobreescrito'}</span>}
                        </div>
                        <div style={{fontSize:'.72rem',color:'#6b9ba8',marginBottom:4,background:'#f8f8f6',padding:'4px 8px',borderRadius:6}}>
                          <span style={{fontWeight:600}}>{isEn?'Global:':'Global:'}</span> {globalVal ? (globalVal.length>80?globalVal.slice(0,80)+'…':globalVal) : <em>{isEn?'(not set)':'(sin valor)'}</em>}
                        </div>
                        {overridesOn && (
                          isTextarea
                            ? <textarea
                                value={overrideVal}
                                onChange={e=>setCommunityConfigDraft(p=>({...p,[ca.communityId]:{...(p[ca.communityId]||{}),[key]:e.target.value}}))}
                                rows={3}
                                placeholder={isEn?`Override for this community…`:`Valor específico para esta comunidad…`}
                                style={{width:'100%',fontSize:'.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid #cce7ee',resize:'vertical',boxSizing:'border-box'}}
                              />
                            : <input
                                value={overrideVal}
                                onChange={e=>setCommunityConfigDraft(p=>({...p,[ca.communityId]:{...(p[ca.communityId]||{}),[key]:e.target.value}}))}
                                placeholder={isEn?`Override for this community…`:`Valor específico para esta comunidad…`}
                                style={{width:'100%',fontSize:'.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid #cce7ee',boxSizing:'border-box'}}
                              />
                        )}
                        {!overridesOn && <div style={{fontSize:'.72rem',color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'Overrides are not enabled for this community. Contact a global admin to enable them.':'Los overrides no están habilitados para esta comunidad. Contacta a un admin global para habilitarlos.'}</div>}
                      </div>
                    );
                  })}
                  {overridesOn && (
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button className="btn-p" style={{fontSize:'.78rem',padding:'5px 14px'}} onClick={()=>saveCommunityConfig(ca.communityId)}>
                        💾 {isEn?'Save community settings':'Guardar configuración'}
                      </button>
                      <button className="btn-ghost" style={{fontSize:'.72rem',padding:'4px 10px'}} onClick={()=>loadCommunityConfig(ca.communityId)}>
                        ↻ {isEn?'Refresh':'Actualizar'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      {/* ── Community Email Templates ──────────────────────────────────────── */}
      <div style={{borderTop:'1px solid #e8f4f8',paddingTop:8,marginTop:8}}>
        <button type="button" className="btn-ghost" style={{fontSize:'.78rem',padding:'3px 10px'}}
          onClick={()=>{
            const opening = !communityTplOpen[ca.communityId];
            setCommunityTplOpen(p=>({...p,[ca.communityId]:opening}));
            if (opening && !communityTplData[ca.communityId]) loadCommunityTemplates(ca.communityId, 'es-CO');
          }}>
          ✉️ {isEn?'Community Email Templates':'Plantillas de email de comunidad'} {communityTplOpen[ca.communityId]?'▲':'▼'}
        </button>
        {communityTplOpen[ca.communityId] && (() => {
          const tplD = communityTplData[ca.communityId];
          const tplLang = communityTplLang[ca.communityId] || 'es-CO';
          const selKey = communityTplSelected[ca.communityId] || '';
          const tpl = selKey && tplD?.templates?.[selKey] ? tplD.templates[selKey] : null;
          const overridesOn = communityOverridesEnabled[ca.communityId];
          return (
            <div style={{marginTop:10}}>
              {communityTplLoading[ca.communityId] && <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading...':'Cargando...'}</div>}
              {!overridesOn && <div style={{fontSize:'.75rem',color:'#8a9fa5',fontStyle:'italic',padding:'6px 0'}}>{isEn?'Overrides must be enabled by a global admin to edit community templates.':'El admin global debe habilitar los overrides para editar plantillas de comunidad.'}</div>}
              {overridesOn && !communityTplLoading[ca.communityId] && (
                <div>
                  <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
                    <select value={tplLang} onChange={e=>{setCommunityTplLang(p=>({...p,[ca.communityId]:e.target.value})); loadCommunityTemplates(ca.communityId, e.target.value);}}
                      style={{padding:'3px 8px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.78rem'}}>
                      <option value="es-CO">Español</option>
                      <option value="en">English</option>
                    </select>
                    <select value={selKey} onChange={e=>setCommunityTplSelected(p=>({...p,[ca.communityId]:e.target.value}))}
                      style={{padding:'3px 8px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.78rem',flex:1,minWidth:120}}>
                      {Object.entries(tplD?.templates||{}).map(([k,v])=><option key={k} value={k}>{v?.label||k}</option>)}
                    </select>
                  </div>
                  {tpl && (
                    <div>
                      <div style={{fontSize:'.72rem',fontWeight:700,color:'#2F4F3A',marginBottom:4}}>{isEn?'Subject:':'Asunto:'}</div>
                      <input value={tpl.subject||''} onChange={e=>setCommunityTplData(p=>({...p,[ca.communityId]:{...(p[ca.communityId]||{}), templates:{...(p[ca.communityId]?.templates||{}), [selKey]:{...(p[ca.communityId]?.templates?.[selKey]||{}), subject:e.target.value}}}}))}
                        style={{width:'100%',fontSize:'.78rem',padding:'4px 8px',borderRadius:6,border:'1px solid #cce7ee',boxSizing:'border-box',marginBottom:6}}/>
                      <div style={{fontSize:'.72rem',fontWeight:700,color:'#2F4F3A',marginBottom:4}}>HTML:</div>
                      <textarea value={tpl.html||''} onChange={e=>setCommunityTplData(p=>({...p,[ca.communityId]:{...(p[ca.communityId]||{}), templates:{...(p[ca.communityId]?.templates||{}), [selKey]:{...(p[ca.communityId]?.templates?.[selKey]||{}), html:e.target.value}}}}))}
                        rows={5} style={{width:'100%',fontSize:'.72rem',fontFamily:'monospace',padding:'4px 8px',borderRadius:6,border:'1px solid #cce7ee',resize:'vertical',boxSizing:'border-box',marginBottom:4}}/>
                    </div>
                  )}
                  <div style={{display:'flex',gap:8,marginTop:6}}>
                    <button className="btn-p" style={{fontSize:'.78rem',padding:'4px 12px'}} onClick={()=>saveCommunityTemplates(ca.communityId)}>
                      💾 {isEn?'Save templates':'Guardar plantillas'}
                    </button>
                    <button className="btn-ghost" style={{fontSize:'.72rem',padding:'3px 10px'}} onClick={()=>loadCommunityTemplates(ca.communityId, tplLang)}>
                      ↻ {isEn?'Refresh':'Actualizar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {/* ── Community Email Routing ────────────────────────────────────────── */}
      <div style={{borderTop:'1px solid #e8f4f8',paddingTop:8,marginTop:8}}>
        <button type="button" className="btn-ghost" style={{fontSize:'.78rem',padding:'3px 10px'}}
          onClick={()=>{
            const opening = !communityRoutingOpen[ca.communityId];
            setCommunityRoutingOpen(p=>({...p,[ca.communityId]:opening}));
            if (opening && !communityRoutingData[ca.communityId]) loadCommunityRouting(ca.communityId);
          }}>
          📧 {isEn?'Community Email Routing':'Enrutamiento de email de comunidad'} {communityRoutingOpen[ca.communityId]?'▲':'▼'}
        </button>
        {communityRoutingOpen[ca.communityId] && (() => {
          const rd = communityRoutingData[ca.communityId];
          const draft = communityRoutingDraft[ca.communityId] || {};
          const overridesOn = communityOverridesEnabled[ca.communityId];
          return (
            <div style={{marginTop:10}}>
              {communityRoutingLoading[ca.communityId] && <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading...':'Cargando...'}</div>}
              {!overridesOn && <div style={{fontSize:'.75rem',color:'#8a9fa5',fontStyle:'italic',padding:'6px 0'}}>{isEn?'Overrides must be enabled by a global admin to set community email routing.':'El admin global debe habilitar los overrides para configurar el enrutamiento de email.'}</div>}
              {overridesOn && !communityRoutingLoading[ca.communityId] && rd && (
                <div>
                  <div style={{fontSize:'.75rem',color:'#6b9ba8',marginBottom:8}}>{isEn?'Add CC email addresses per event type. Enabled/disabled flags are global-only.':'Agrega emails en copia (CC) por tipo de evento. Los flags habilitado/deshabilitado son solo globales.'}</div>
                  {(rd.eventKeys||[]).map(k => {
                    const globalCfg = rd.globalConfig?.[k] || {};
                    const ccVal = draft[k]?.cc ?? '';
                    return (
                      <div key={k} style={{marginBottom:8,paddingBottom:8,borderBottom:'1px solid #f0f8fb'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                          <span style={{fontSize:'.72rem',fontWeight:700,color:'#2F4F3A',flex:1}}>{k}</span>
                          <span style={{fontSize:'.65rem',padding:'1px 7px',borderRadius:10,background:globalCfg.enabled===false?'#fce4ec':'#e8f4f0',color:globalCfg.enabled===false?'#c62828':'#2F4F3A',fontWeight:600}}>
                            {isEn?(globalCfg.enabled===false?'disabled':'enabled'):(globalCfg.enabled===false?'deshabilitado':'habilitado')} {isEn?'(global)':'(global)'}
                          </span>
                        </div>
                        <input
                          value={ccVal}
                          onChange={e=>setCommunityRoutingDraft(p=>({...p,[ca.communityId]:{...(p[ca.communityId]||{}),[k]:{cc:e.target.value}}}))}
                          placeholder={isEn?'CC emails, comma-separated':'Emails en CC, separados por coma'}
                          style={{width:'100%',fontSize:'.75rem',padding:'4px 8px',borderRadius:6,border:'1px solid #cce7ee',boxSizing:'border-box'}}
                        />
                      </div>
                    );
                  })}
                  <div style={{display:'flex',gap:8,marginTop:6}}>
                    <button className="btn-p" style={{fontSize:'.78rem',padding:'4px 12px'}} onClick={()=>saveCommunityRouting(ca.communityId)}>
                      💾 {isEn?'Save routing':'Guardar enrutamiento'}
                    </button>
                    <button className="btn-ghost" style={{fontSize:'.72rem',padding:'3px 10px'}} onClick={()=>loadCommunityRouting(ca.communityId)}>
                      ↻ {isEn?'Refresh':'Actualizar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  ))}

  {/* ── Communities ────────────────────────────────────────────────────── */}
  <AdminSection
    title={`🌐 ${isEn?'Communities':'Comunidades'}`}
    subtitle={isEn?'Create and manage multi-tenant communities. Approved registered owners are automatically members. Promote any member to Community Admin here.':'Crea y administra comunidades multi-tenant. Los propietarios con registro aprobado son miembros automáticamente. Promueve a cualquier miembro a Admin de comunidad aquí.'}
    action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={()=>setCommunityModal({mode:'create',data:{}})}>{isEn?'＋ New community':'＋ Nueva comunidad'}</button>}
    open={openSections.communities} onToggle={()=>toggleSection('communities')}>
    {/* Community feature flag settings */}
    <div className="card" style={{marginBottom:16,padding:'12px 16px',background:'#f5fbfd',border:'1px solid #cce7ee'}}>
      <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:'.88rem',fontWeight:600,color:'#17313a',cursor:'pointer',userSelect:'none'}}>
          <input type="checkbox" checked={communityFeatureEnabled} onChange={e=>setCommunityFeatureEnabled(e.target.checked)} style={{accentColor:'#2F4F3A',width:16,height:16}}/>
          {isEn?'Community picker enabled':'Selector de comunidad habilitado'}
        </label>
        {!communityFeatureEnabled && (
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:'.85rem',color:'#17313a'}}>
            <span style={{fontWeight:600}}>{isEn?'Default community:':'Comunidad predeterminada:'}</span>
            <select value={defaultCommunityId} onChange={e=>setDefaultCommunityId(e.target.value)} style={{padding:'4px 8px',borderRadius:6,border:'1.5px solid rgba(47,79,58,.25)',fontSize:'.85rem',background:'#fff',color:'#17313a'}}>
              {communities.map(c=><option key={c.id} value={c.id}>{isEn?(c.name_en||c.name):c.name}</option>)}
              {!communities.some(c=>c.id===defaultCommunityId)&&<option value={defaultCommunityId}>{defaultCommunityId}</option>}
            </select>
          </label>
        )}
        <button className="btn-p" style={{minHeight:32,padding:'4px 14px',fontSize:'.82rem'}}
          onClick={async()=>{
            try{
              await api.put('/api/admin/config',{actorUid:user.uid,actorEmail:user.email,communityFeatureEnabled,defaultCommunityId});
              showToast('✅ '+(isEn?'Community settings saved':'Configuración de comunidad guardada'));
            }catch(e){showToast((e.message||String(e)),true);}
          }}>
          💾 {isEn?'Save':'Guardar'}
        </button>
      </div>
    </div>
    {communitiesLoading && <div style={{padding:'20px 0',textAlign:'center'}}><span className="spinner-sm"/> {isEn?'Loading...':'Cargando...'}</div>}
    {!communitiesLoading && communities.length === 0 && (
      <div style={{padding:'16px 0',color:'#6b9ba8',textAlign:'center',fontSize:'.9rem'}}>
        {isEn?'No communities yet. Create the first one above.':'Sin comunidades todavía. Crea la primera arriba.'}
      </div>
    )}
    {!communitiesLoading && communities.map(c => (
      <div key={c.id} className="card" style={{marginBottom:12,padding:'12px 16px',border:'1px solid #cce7ee'}}>
        {/* Community header row */}
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          {c.logo_url && <img src={c.logo_url} alt="logo" style={{width:36,height:36,objectFit:'contain',borderRadius:6,background:'#f5fbfd',padding:2}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:'.95rem',color:'#17313a'}}>{c.name}{c.name_en&&c.name_en!==c.name&&<span style={{fontWeight:400,color:'#6b9ba8',marginLeft:8,fontSize:'.82rem'}}>{c.name_en}</span>}</div>
            <div style={{fontSize:'.77rem',color:'#8a9fa5',marginTop:2}}>
              <code style={{background:'#eef6f8',padding:'1px 5px',borderRadius:3,fontSize:'.75rem'}}>{c.id}</code>
              {c.tower&&<span style={{marginLeft:8}}>🏢 {c.tower}</span>}
              {c.city&&<span style={{marginLeft:8}}>📍 {c.city}{c.country?`, ${c.country}`:''}</span>}
              <span className={`chip ${c.is_active?'c-teal':'c-red'}`} style={{marginLeft:8,fontSize:'.68rem',padding:'1px 7px'}}>{c.is_active?(isEn?'Active':'Activa'):(isEn?'Inactive':'Inactiva')}</span>
            </div>
          </div>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 10px'}} onClick={()=>setCommunityModal({mode:'edit',data:c})}>✏️ {isEn?'Edit':'Editar'}</button>
            <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 10px'}} onClick={()=>api.put(`/api/communities/${c.id}`,{actorUid:user.uid,actorEmail:user.email,isActive:!c.is_active}).then(()=>loadCommunities()).catch(e=>showToast(e.message,true))}>{c.is_active?'⏸ '+(isEn?'Disable':'Deshabilitar'):'▶ '+(isEn?'Enable':'Habilitar')}</button>
            {c.id !== 'kai' && <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 10px',color:'#c62828'}} onClick={()=>deleteCommunity(c.id)}>🗑️ {isEn?'Delete':'Eliminar'}</button>}
          </div>
        </div>
        {/* Members toggle */}
        <div style={{marginTop:10,borderTop:'1px solid #e8f4f8',paddingTop:8}}>
          <button type="button" className="btn-ghost" style={{fontSize:'.78rem',padding:'3px 10px'}}
            onClick={()=>toggleCommunityMembers(c.id)}>
            👥 {isEn?'Members':'Miembros'} {communityMembersOpen[c.id]?'▲':'▼'}
          </button>
          {communityMembersOpen[c.id] && (
            <div style={{marginTop:10}}>
              {communityMembersLoading[c.id] && <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading members...':'Cargando miembros...'}</div>}
              {!communityMembersLoading[c.id] && (communityMembers[c.id]||[]).length === 0 && (
                <div style={{color:'#6b9ba8',fontSize:'.82rem',padding:'6px 0'}}>{isEn?'No approved members yet.':'Sin miembros aprobados todavía.'}</div>
              )}
              {!communityMembersLoading[c.id] && (communityMembers[c.id]||[]).map(m => {
                const pk = `${c.id}_${m.userUid}`;
                const currentPerms = memberPermsEditing[pk] || m.adminPermissions || { canApproveRegistrations:true, canResolveIncidents:true, canManageListings:false };
                const isDirty = !!memberPermsEditing[pk];
                return (
                <div key={m.userUid} style={{padding:'8px 0',borderBottom:'1px solid #f0f8fb'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontWeight:600,fontSize:'.82rem',color:'#17313a'}}>{m.name||m.userEmail}</div>
                      <div style={{fontSize:'.72rem',color:'#6b9ba8'}}>{m.userEmail}</div>
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'.8rem',color:'#17313a',cursor:'pointer',userSelect:'none'}}>
                      <input type="checkbox" checked={!!m.isAdmin}
                        onChange={() => m.isAdmin ? demoteCommunityAdmin(c.id, m) : promoteCommunityAdmin(c.id, m)}
                        style={{accentColor:'#2F4F3A',width:15,height:15}}
                      />
                      {isEn?'Community Admin':'Admin comunidad'}
                    </label>
                  </div>
                  {m.isAdmin && (
                    <div style={{marginTop:6,paddingLeft:4,display:'flex',flexWrap:'wrap',gap:'6px 18px',alignItems:'center'}}>
                      <span style={{fontSize:'.72rem',fontWeight:700,color:'#17313a',width:'100%',marginBottom:2}}>{isEn?'Admin permissions:':'Permisos de admin:'}</span>
                      {[
                        ['canApproveRegistrations', isEn?'Approve registrations':'Aprobar registros'],
                        ['canResolveIncidents',     isEn?'Resolve incidents':'Resolver incidentes'],
                        ['canManageListings',        isEn?'Manage listings':'Gestionar listings'],
                      ].map(([key, label]) => (
                        <label key={key} style={{display:'flex',alignItems:'center',gap:5,fontSize:'.75rem',color:'#2F4F3A',cursor:'pointer'}}>
                          <input type="checkbox" checked={!!(currentPerms[key])}
                            onChange={e => {
                              const updated = { ...currentPerms, [key]: e.target.checked };
                              setMemberPermsEditing(p => ({...p,[pk]:updated}));
                            }}
                            style={{accentColor:'#2F4F3A'}}
                          />
                          {label}
                        </label>
                      ))}
                      {isDirty && (
                        <button className="btn-p" style={{fontSize:'.72rem',padding:'2px 10px',marginLeft:4}}
                          onClick={()=>updateMemberPerms(c.id, m.userUid, memberPermsEditing[pk])}>
                          {isEn?'Save perms':'Guardar permisos'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
              {!communityMembersLoading[c.id] && (
                <div style={{marginTop:8}}>
                  <button className="btn-ghost" style={{fontSize:'.72rem',padding:'3px 8px'}} onClick={()=>loadCommunityMembers(c.id)}>↻ {isEn?'Refresh':'Actualizar'}</button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Community Settings toggle — visible to community admins and global admins */}
        <div style={{marginTop:8,borderTop:'1px solid #e8f4f8',paddingTop:8}}>
          <button type="button" className="btn-ghost" style={{fontSize:'.78rem',padding:'3px 10px'}}
            onClick={()=>{
              const opening = !communityConfigOpen[c.id];
              setCommunityConfigOpen(p=>({...p,[c.id]:opening}));
              if (opening && !communityConfigData[c.id]) loadCommunityConfig(c.id);
            }}>
            ⚙️ {isEn?'Community Settings':'Configuración de comunidad'} {communityConfigOpen[c.id]?'▲':'▼'}
          </button>
          {communityConfigOpen[c.id] && (
            <div style={{marginTop:10}}>
              {communityConfigLoading[c.id] && <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading...':'Cargando...'}</div>}
              {!communityConfigLoading[c.id] && communityConfigData[c.id] && (() => {
                const cfg = communityConfigData[c.id];
                const draft = communityConfigDraft[c.id] || {};
                const overridesOn = communityOverridesEnabled[c.id];
                const LABELS = {
                  mission_title_es: isEn?'Mission title (ES)':'Título de misión (ES)',
                  mission_body_es: isEn?'Mission body (ES)':'Cuerpo de misión (ES)',
                  mission_title_en: 'Mission title (EN)',
                  mission_body_en: 'Mission body (EN)',
                  escalation_cc_emails: isEn?'Escalation CC emails':'Emails de escalación CC',
                  community_admin_default_permissions: isEn?'Default admin permissions (JSON)':'Permisos default admin (JSON)',
                };
                return (
                  <div>
                    {/* Global admin: toggle override feature */}
                    {adminInfo.isGlobalAdmin && (
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'8px 10px',background:'#f0f8fb',borderRadius:8}}>
                        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'.82rem',fontWeight:700,color:'#17313a',cursor:'pointer'}}>
                          <input type="checkbox" checked={!!overridesOn}
                            onChange={e=>toggleCommunityOverrides(c.id, e.target.checked)}
                            style={{accentColor:'#0b7f4f',width:15,height:15}}
                          />
                          {isEn?'Allow community admin to override settings':'Permitir que admin comunidad sobreescriba configuración'}
                        </label>
                        <span style={{fontSize:'.72rem',color:'#6b9ba8'}}>{overridesOn?(isEn?'Overrides enabled':'Overrides habilitados'):(isEn?'Using global settings':'Usando config global')}</span>
                      </div>
                    )}
                    {/* Settings rows */}
                    {Object.entries(LABELS).map(([key, label]) => {
                      const globalVal = cfg.globalValues?.[key] || '';
                      const overrideVal = draft[key] ?? cfg.communityOverrides?.[key] ?? '';
                      const hasOverride = key in (cfg.communityOverrides||{}) || key in draft;
                      const isTextarea = key.includes('body') || key.includes('sections') || key.includes('permissions');
                      return (
                        <div key={key} style={{marginBottom:10,paddingBottom:10,borderBottom:'1px solid #f0f8fb'}}>
                          <div style={{fontSize:'.75rem',fontWeight:700,color:'#2F4F3A',marginBottom:4}}>
                            {label}
                            {hasOverride && <span style={{marginLeft:6,fontSize:'.68rem',background:'#d9b45a22',color:'#7a5a00',padding:'1px 6px',borderRadius:4,fontWeight:600}}>{isEn?'overridden':'sobreescrito'}</span>}
                          </div>
                          {/* Global value — always read-only */}
                          <div style={{fontSize:'.72rem',color:'#6b9ba8',marginBottom:4,background:'#f8f8f6',padding:'4px 8px',borderRadius:6}}>
                            <span style={{fontWeight:600}}>{isEn?'Global:':'Global:'}</span> {globalVal ? (globalVal.length>80?globalVal.slice(0,80)+'…':globalVal) : <em>{isEn?'(not set)':'(sin valor)'}</em>}
                          </div>
                          {/* Override input — editable when overridesOn */}
                          {overridesOn && (
                            isTextarea
                              ? <textarea
                                  value={overrideVal}
                                  onChange={e=>setCommunityConfigDraft(p=>({...p,[c.id]:{...(p[c.id]||{}),[key]:e.target.value}}))}
                                  rows={3}
                                  placeholder={isEn?`Override for this community…`:`Valor específico para esta comunidad…`}
                                  style={{width:'100%',fontSize:'.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid #cce7ee',resize:'vertical',boxSizing:'border-box'}}
                                />
                              : <input
                                  value={overrideVal}
                                  onChange={e=>setCommunityConfigDraft(p=>({...p,[c.id]:{...(p[c.id]||{}),[key]:e.target.value}}))}
                                  placeholder={isEn?`Override for this community…`:`Valor específico para esta comunidad…`}
                                  style={{width:'100%',fontSize:'.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid #cce7ee',boxSizing:'border-box'}}
                                />
                          )}
                          {!overridesOn && <div style={{fontSize:'.72rem',color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'Enable overrides above to set a community-specific value.':'Activa overrides arriba para establecer un valor específico.'}</div>}
                        </div>
                      );
                    })}
                    {overridesOn && (
                      <div style={{display:'flex',gap:8,marginTop:8}}>
                        <button className="btn-p" style={{fontSize:'.78rem',padding:'5px 14px'}} onClick={()=>saveCommunityConfig(c.id)}>
                          💾 {isEn?'Save community settings':'Guardar configuración'}
                        </button>
                        <button className="btn-ghost" style={{fontSize:'.72rem',padding:'4px 10px'}} onClick={()=>loadCommunityConfig(c.id)}>
                          ↻ {isEn?'Refresh':'Actualizar'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    ))}
    {communityModal && (
      <CommunityCrudModal
        mode={communityModal.mode}
        initial={communityModal.data||{}}
        onSave={saveCommunity}
        onClose={()=>setCommunityModal(null)}
        lang={lang}
      />
    )}
  </AdminSection>

  {/* ── Default / Fallback Branding ────────────────────────────── */}
  <AdminSection title={`🏢 ${isEn?'Default Branding (fallback)':'Identidad predeterminada (respaldo)'}`} subtitle={isEn?'Fallback logo, name, and location used when no community branding overrides it. For multi-community setups configure branding inside each community above.':'Logo, nombre y ubicación de respaldo usados cuando ninguna comunidad los sobreescribe. En setups multi-comunidad configura el branding dentro de cada comunidad arriba.'} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveBranding}>💾 {isEn?'Save':'Guardar'}</button>} open={openSections.branding} onToggle={()=>toggleSection('branding')}>
    <div className="fg-row" style={{gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
      <div className="fg" style={{minWidth:180}}>
        <label>{isEn?'Name (Spanish)':'Nombre (Español)'}</label>
        <input value={brandingNameEs} onChange={e=>setBrandingNameEs(e.target.value)} className="input" placeholder="Propietarios Airbnb KAI"/>
      </div>
      <div className="fg" style={{minWidth:180}}>
        <label>{isEn?'Name (English)':'Nombre (Inglés)'}</label>
        <input value={brandingNameEn} onChange={e=>setBrandingNameEn(e.target.value)} className="input" placeholder="KAI Airbnb Owners"/>
      </div>
      <div className="fg" style={{flex:'1 1 100%'}}>
        <label>{isEn?'Location / Tagline':'Ubicación / Tagline'}</label>
        <input value={brandingLocation} onChange={e=>setBrandingLocation(e.target.value)} className="input" placeholder="Serena del Mar · Cartagena 🇨🇴"/>
      </div>
    </div>
    <div style={{marginTop:12}}>
      <div className="section-label" style={{marginBottom:6}}>{isEn?'Logo':'Logo'}</div>
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        <button type="button" className={`chip ${brandingLogoMode==='url'?'chip-active':''}`} onClick={()=>setBrandingLogoMode('url')}>{isEn?'URL':'URL'}</button>
        <button type="button" className={`chip ${brandingLogoMode==='file'?'chip-active':''}`} onClick={()=>setBrandingLogoMode('file')}>{isEn?'Upload file':'Subir archivo'}</button>
      </div>
      {brandingLogoMode==='url' && <input value={brandingLogo} onChange={e=>setBrandingLogo(e.target.value)} className="input" placeholder="https://..." style={{marginBottom:8}}/>}
      {brandingLogoMode==='file' && <input type="file" accept="image/*" style={{marginBottom:8}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{setBrandingLogo(ev.target?.result||'');};r.readAsDataURL(f);}}/>}
      {brandingLogo && <div style={{marginTop:8,padding:8,background:'#f6f6f4',borderRadius:8,display:'inline-block'}}><img src={brandingLogo} alt="logo preview" style={{maxHeight:64,maxWidth:220,objectFit:'contain'}}/></div>}
      {brandingLogo && <div style={{marginTop:6}}><button type="button" className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px'}} onClick={()=>setBrandingLogo('')}>{isEn?'Remove logo':'Quitar logo'}</button></div>}
      {!brandingLogo && <div style={{marginTop:8,padding:8,background:'#f6f6f4',borderRadius:8,display:'inline-block'}}><img src="/morros-kai.png" alt="default logo" style={{maxHeight:64,maxWidth:220,objectFit:'contain'}}/><div style={{fontSize:'.7rem',color:'#888',marginTop:4}}>{isEn?'Default logo (morros-kai.png)':'Logo predeterminado (morros-kai.png)'}</div></div>}
    </div>
    <div style={{marginTop:16}}>
      <div className="section-label" style={{marginBottom:6}}>{isEn?'Background image (login & registration screens)':'Imagen de fondo (pantallas de login y registro)'}</div>
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        <button type="button" className={`chip ${brandingBgMode==='url'?'chip-active':''}`} onClick={()=>setBrandingBgMode('url')}>URL</button>
        <button type="button" className={`chip ${brandingBgMode==='file'?'chip-active':''}`} onClick={()=>setBrandingBgMode('file')}>{isEn?'Upload file':'Subir archivo'}</button>
      </div>
      {brandingBgMode==='url' && <input value={brandingBg} onChange={e=>setBrandingBg(e.target.value)} className="input" placeholder="/morros-kai-bg.jpg or https://..." style={{marginBottom:8}}/>}
      {brandingBgMode==='file' && <input type="file" accept="image/*" style={{marginBottom:8}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{setBrandingBg(ev.target?.result||'');};r.readAsDataURL(f);}}/>}
      {brandingBg && <div style={{marginTop:8,borderRadius:10,overflow:'hidden',display:'inline-block',position:'relative',maxWidth:320,boxShadow:'0 4px 14px rgba(0,0,0,.18)'}}>
        <img src={brandingBg} alt="bg preview" style={{width:320,height:160,objectFit:'cover',display:'block'}} onError={e=>{e.target.style.display='none';}} />
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'.72rem',letterSpacing:'.04em',opacity:.8,pointerEvents:'none'}}>PREVIEW</div>
      </div>}
      {brandingBg && <div style={{marginTop:6,display:'flex',gap:8}}>
        <button type="button" className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px'}} onClick={()=>setBrandingBg('')}>{isEn?'Remove background':'Quitar fondo'}</button>
        <button type="button" className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px'}} onClick={()=>setBrandingBg('/morros-kai-bg.jpg')}>{isEn?'Reset to default':'Restablecer por defecto'}</button>
      </div>}
      {!brandingBg && <div style={{marginTop:8,fontSize:'.78rem',color:'#888'}}>{isEn?'No background — solid color fallback.':'Sin fondo — se usa color sólido como alternativa.'}</div>}
    </div>
  </AdminSection>

  {/* ── Email Sender ────────────────────────────────────────────── */}
  <AdminSection title={`📤 ${isEn?'Email Sender':'Remitente de emails'}`} subtitle={isEn?'Display name and address used as the "From" field on all outgoing emails. The address must be verified in your Resend account.':'Nombre y dirección que aparecen como remitente en todos los emails. La dirección debe estar verificada en tu cuenta Resend.'} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveEmailSender}>💾 {isEn?'Save':'Guardar'}</button>} open={openSections.emailSender} onToggle={()=>toggleSection('emailSender')}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,flexWrap:'wrap'}} className="email-sender-grid">
      <div style={{padding:'12px 14px',background:'#f8f9fa',borderRadius:8,border:'1px solid #e8eaed'}}>
        <div className="section-label" style={{marginBottom:8}}>🇨🇴 {isEn?'Spanish recipients':'Destinatarios en Español'}</div>
        <div className="fg" style={{marginBottom:8}}>
          <label>{isEn?'Display name':'Nombre visible'}</label>
          <input value={emailFromName} onChange={e=>setEmailFromName(e.target.value)} className="input" placeholder="Propietarios Airbnb KAI"/>
        </div>
        <div className="fg">
          <label>{isEn?'From address':'Dirección de envío'}</label>
          <input value={emailFromAddress} onChange={e=>setEmailFromAddress(e.target.value)} className="input" type="email" placeholder="kai@yourdomain.com"/>
        </div>
        {emailFromAddress && <div style={{marginTop:6,fontSize:'.75rem',color:'#555'}}>→ <strong>{emailFromName ? `${emailFromName} <${emailFromAddress}>` : emailFromAddress}</strong></div>}
      </div>
      <div style={{padding:'12px 14px',background:'#f8f9fa',borderRadius:8,border:'1px solid #e8eaed'}}>
        <div className="section-label" style={{marginBottom:8}}>🇺🇸 {isEn?'English recipients':'Destinatarios en Inglés'}</div>
        <div className="fg" style={{marginBottom:8}}>
          <label>{isEn?'Display name':'Nombre visible'}</label>
          <input value={emailFromNameEn} onChange={e=>setEmailFromNameEn(e.target.value)} className="input" placeholder="KAI Airbnb Owners"/>
        </div>
        <div className="fg">
          <label>{isEn?'From address':'Dirección de envío'}</label>
          <input value={emailFromAddressEn} onChange={e=>setEmailFromAddressEn(e.target.value)} className="input" type="email" placeholder="kai@yourdomain.com"/>
        </div>
        {emailFromAddressEn && <div style={{marginTop:6,fontSize:'.75rem',color:'#555'}}>→ <strong>{emailFromNameEn ? `${emailFromNameEn} <${emailFromAddressEn}>` : emailFromAddressEn}</strong></div>}
      </div>
    </div>
    <div className="form-alert" style={{marginTop:10,fontSize:'.78rem'}}>
      {isEn
        ? '⚠️ Both addresses must be verified in Resend (Domains or single sender). Using an unverified address will cause delivery failures.'
        : '⚠️ Ambas direcciones deben estar verificadas en Resend (Dominios o sender individual). Usar una dirección no verificada causará fallos de entrega.'}
    </div>
  </AdminSection>

  {/* ── Role Reference ─────────────────────────────────────────── */}
  <AdminSection
    title={lang==='en'?'👥 Role Reference — Capabilities by role':'👥 Referencia de roles — Capacidades por rol'}
    subtitle={lang==='en'?'Quick reference for all three roles. Delegate permissions reflect current default settings above.':'Referencia rápida de los tres roles. Permisos del delegado reflejan la configuración predeterminada actual.'}
    open={openSections.roles} onToggle={()=>toggleSection('roles')}>
    {(()=>{
      const isEn = lang==='en';
      const dp = defaultDelegatePermissions;
      const cap = (ok, label, note='') => (
        <div key={label} className="role-cap-row">
          <span className={`role-cap-icon ${ok?'rci-yes':'rci-no'}`}>{ok?'✓':'—'}</span>
          <span className="role-cap-label">{label}{note&&<span className="role-cap-note"> {note}</span>}</span>
        </div>
      );
      const conf = (on, label) => (
        <div key={label} className="role-cap-row">
          <span className={`role-cap-icon ${on?'rci-yes':'rci-conf'}`}>{on?'✓':'○'}</span>
          <span className="role-cap-label">{label}<span className="role-cap-note"> {isEn?'(configurable)':'(configurable)'}</span></span>
        </div>
      );
      const std = [
        cap(true,  isEn?'Dashboard, community & alerts':'Dashboard, comunidad y avisos'),
        cap(true,  isEn?'My units — add, edit, view':'Mis unidades — agregar, editar, ver'),
        cap(true,  isEn?'File incident reports':'Reportar incidentes'),
        cap(true,  isEn?'⚠️ Step 1: Verify incidents on own units':'⚠️ Paso 1: Verificar incidentes en mis unidades'),
        cap(true,  isEn?'📝 Step 2: Add resolution (unlocks admin close)':'📝 Paso 2: Agregar resolución (desbloquea cierre)'),
        cap(true,  isEn?'View all community incidents':'Ver todos los incidentes de la comunidad'),
        cap(true,  isEn?'Hover contact cards (email + WhatsApp)':'Tarjetas de contacto (email + WhatsApp)'),
        cap(standardMenuPermissions.analytics||false, isEn?'Analytics (admin-controlled)':'Analíticas (controlado por admin)'),
      ];
      const del = [
        cap(true,  isEn?'All Standard Owner capabilities':'Todas las capacidades del propietario estándar'),
        conf(dp.canApproveRegistrations, isEn?'Approve / decline registrations':'Aprobar / rechazar registros'),
        conf(dp.canResolveIncidents,     isEn?'Close incidents (after owner Steps 1+2)':'Cerrar incidentes (tras Pasos 1+2 del propietario)'),
        conf(dp.canUpdateGlobalListings, isEn?'Edit any unit':'Editar cualquier unidad'),
        conf(dp.canDeleteGlobalListings, isEn?'Delete any unit':'Eliminar cualquier unidad'),
        conf(dp.canUpdateGlobalIncidents,isEn?'Edit any incident':'Editar cualquier incidente'),
        conf(dp.canDeleteGlobalIncidents,isEn?'Delete any incident':'Eliminar cualquier incidente'),
        cap(true,  isEn?'Analytics (always enabled)':'Analíticas (siempre activo)'),
      ];
      const glb = [
        cap(true, isEn?'All Delegate Admin capabilities':'Todas las capacidades del admin delegado'),
        cap(true, isEn?'Admin settings panel':'Panel de configuración admin'),
        cap(true, isEn?'Manage user roles & permissions':'Gestionar roles y permisos de usuarios'),
        cap(true, isEn?'SLA hours + escalation email list':'Horas SLA + lista de emails de escalación'),
        cap(true, isEn?'Community mission & content':'Misión y contenido de la comunidad'),
        cap(true, isEn?'Email templates + routing config':'Plantillas de email + configuración de envío'),
        cap(true, isEn?'Analytics — always on for global admin':'Analíticas — siempre activas para admin global'),
        cap(true, isEn?'View As role preview':'Vista previa de rol (Ver como)'),
      ];
      const RoleCol = ({icon, title, color, rows, badge}) => (
        <div className="role-ref-col" style={{borderTop:`3px solid ${color}`}}>
          <div className="role-ref-hdr">
            <span className="role-ref-icon">{icon}</span>
            <div><strong className="role-ref-title">{title}</strong>{badge&&<span className="role-ref-badge" style={{background:color+'22',color}}>{badge}</span>}</div>
          </div>
          <div className="role-ref-rows">{rows}</div>
        </div>
      );
      return (
        <div className="role-ref-grid">
          <RoleCol icon="🏠" title={isEn?'Standard Owner':'Propietario estándar'} color="#2a9aaa" rows={std} badge={isEn?'Default':'Por defecto'}/>
          <RoleCol icon="🛡️" title={isEn?'Delegate Admin':'Admin delegado'} color="#d9a030" rows={del} badge={isEn?'Configurable':'Configurable'}/>
          <RoleCol icon="🌐" title={isEn?'Global Admin':'Admin global'} color="#0b7f4f" rows={glb} badge={isEn?'Full access':'Acceso total'}/>
        </div>
      );
    })()}
  </AdminSection>

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

        {/* ── Navigation order & landing ── */}
        <AdminSection title={isEn?'🗺️ Navigation & Landing':'🗺️ Navegación y página de inicio'} subtitle={isEn?'Set the default landing page and primary nav items per role.':'Configura la página de inicio y los ítems de navegación por rol.'} open={openSections['navConfig']} onToggle={()=>toggleSection('navConfig')}>
          <NavConfigEditor lang={lang} isEn={isEn} config={config} onSave={cfg=>onSave({nav_config:JSON.stringify(cfg)})} showToast={showToast}/>
        </AdminSection>

        {/* ── UI Labels — organized by page/section with expand/collapse ── */}
  <AdminSection title={`🏷️ ${isEn?'UI Labels':'Etiquetas de la interfaz'}`} subtitle={isEn?'Customize any text in the app by page section. Changes apply to all users immediately after saving.':'Personaliza cualquier texto de la app por sección de página. Los cambios se aplican al guardar.'} action={<button className="btn-ghost" onClick={saveUiLabels}>💾 {isEn?'Save labels':'Guardar etiquetas'}</button>} open={openSections.uiLabels} onToggle={()=>toggleSection('uiLabels')}>
    {(()=>{
      const currentLabels = uiLabelLang==='en' ? uiLabelsEn : uiLabelsEs;
      const setLabel = (key, val) => uiLabelLang==='en'
        ? setUiLabelsEn(p=>({...p,[key]:val}))
        : setUiLabelsEs(p=>({...p,[key]:val}));
      const resetLabel = (key) => uiLabelLang==='en'
        ? setUiLabelsEn(p=>{const n={...p};delete n[key];return n;})
        : setUiLabelsEs(p=>{const n={...p};delete n[key];return n;});

      // Page/section oriented groups — ordered by how users encounter them
      const labelGroups = [
        { id:'nav',    icon:'🧭', label:isEn?'Navigation & menu':'Navegación y menú',          prefixes:['nav.'] },
        { id:'dash',   icon:'📊', label:isEn?'Dashboard':'Dashboard',                           prefixes:['dashboard.','actions.','smart.'] },
        { id:'inc',    icon:'⚠️', label:isEn?'Incidents & Reports':'Incidentes y Reportes',     prefixes:['reports.','workflow.','incidents.'] },
        { id:'form',   icon:'📝', label:isEn?'Forms & Validation':'Formularios y validación',   prefixes:['form.','validation.','modal.'] },
        { id:'my',     icon:'🔑', label:isEn?'My Units':'Mis Unidades',                         prefixes:['my.'] },
        { id:'listing',icon:'🏠', label:isEn?'Inventory':'Inventario',                          prefixes:['listings.'] },
        { id:'notif',  icon:'🔔', label:isEn?'Notifications & Alerts':'Notificaciones y Alertas', prefixes:['notifications.'] },
        { id:'roles',  icon:'👥', label:isEn?'Roles & Permissions':'Roles y permisos',          prefixes:['roles.'] },
        { id:'common', icon:'🔤', label:isEn?'Common & Other':'Común y otros',                  prefixes:['common.','tooltips.',null] },
      ];

      const q = uiLabelSearch.trim().toLowerCase();
      const allKeys = Object.keys(APP_I18N).sort();
      const filteredKeys = q
        ? allKeys.filter(k=>{
            const dEn=String(APP_I18N[k]?.en||'').toLowerCase();
            const dEs=String(APP_I18N[k]?.es||'').toLowerCase();
            const custom=String(currentLabels[k]||'').toLowerCase();
            return k.toLowerCase().includes(q)||dEn.includes(q)||dEs.includes(q)||custom.includes(q);
          })
        : allKeys;

      const totalModified = Object.keys(currentLabels).length;

      // Render a single label row
      const LabelRow = ({key:_,rkey,shortKey,defVal}) => {
        const custom = currentLabels[rkey];
        const isChanged = custom !== undefined;
        return (
          <div className={`ula-row${isChanged?' ula-row-changed':''}`}>
            <div className="ula-row-key">
              <code className="ula-key" title={rkey}>{shortKey}</code>
              {isChanged&&<span className="ula-changed-dot" title={isEn?'Customized':'Personalizado'}>●</span>}
            </div>
            <div className="ula-row-content">
              <div className="ula-default">{defVal||<span style={{color:'#aaa',fontStyle:'italic'}}>{isEn?'(empty)':'(vacío)'}</span>}</div>
              <div className="ula-input-wrap">
                <input className="ula-input" value={isChanged?custom:defVal} onChange={e=>setLabel(rkey,e.target.value)}
                  onFocus={e=>{if(!isChanged){setLabel(rkey,defVal);setTimeout(()=>e.target.select(),0);}}}
                  placeholder={defVal}/>
                {isChanged&&<button type="button" className="ula-reset" title={isEn?'Reset to default':'Restablecer'} onClick={()=>resetLabel(rkey)}>↩</button>}
              </div>
            </div>
          </div>
        );
      };

      return (
        <div className="ula-wrap">
          {/* Toolbar */}
          <div className="ula-toolbar">
            <div className="ula-lang-toggle">
              <button className={`fchip${uiLabelLang==='es'?' fchip-on':''}`} onClick={()=>setUiLabelLang('es')}>🇨🇴 Español</button>
              <button className={`fchip${uiLabelLang==='en'?' fchip-on':''}`} onClick={()=>setUiLabelLang('en')}>🇺🇸 English</button>
            </div>
            <div style={{position:'relative',flex:1,maxWidth:340}}>
              <input className="search" style={{paddingRight:32}} placeholder={isEn?'Search all labels…':'Buscar en todas las etiquetas…'} value={uiLabelSearch} onChange={e=>setUiLabelSearch(e.target.value)}/>
              {uiLabelSearch&&<button className="inc-search-clear" onClick={()=>setUiLabelSearch('')}>✕</button>}
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
              {totalModified>0&&<span className="ula-modified-badge">{totalModified} {isEn?'overridden':'modificadas'}</span>}
              {!q&&<button type="button" className="bsm" style={{fontSize:'.72rem'}}
                onClick={()=>setUiLabelOpenGroups(s=>{const allOpen=labelGroups.every(g=>s[g.id]);return Object.fromEntries(labelGroups.map(g=>[g.id,!allOpen]));})}>
                {labelGroups.every(g=>uiLabelOpenGroups[g.id])?(isEn?'Collapse all':'Colapsar todo'):(isEn?'Expand all':'Expandir todo')}
              </button>}
            </div>
          </div>

          {/* Search results — flat list */}
          {q ? (
            <div className="ula-group ula-group-open">
              <div className="ula-group-hdr ula-group-hdr-plain">
                🔍 {filteredKeys.length} {isEn?`result${filteredKeys.length!==1?'s':''}`:`resultado${filteredKeys.length!==1?'s':''}`}
              </div>
              <div className="ula-rows">
                {filteredKeys.map(key=>{
                  const defVal=APP_I18N[key]?.[uiLabelLang==='en'?'en':'es']||APP_I18N[key]?.es||'';
                  return <LabelRow key={key} rkey={key} shortKey={key} defVal={defVal}/>;
                })}
              </div>
            </div>
          ) : (
            /* Grouped by page/section — each group has its own expand/collapse */
            labelGroups.map(g=>{
              const gKeys = g.prefixes.includes(null)
                ? filteredKeys.filter(k=>!labelGroups.slice(0,-1).some(lg=>lg.prefixes.filter(Boolean).some(p=>k.startsWith(p))))
                : filteredKeys.filter(k=>g.prefixes.some(p=>k.startsWith(p)));
              if(!gKeys.length) return null;
              const isOpen = !!uiLabelOpenGroups[g.id];
              const groupModified = gKeys.filter(k=>currentLabels[k]!==undefined).length;
              return (
                <div key={g.id} className={`ula-group${isOpen?' ula-group-open':''}`}>
                  <button type="button" className="ula-group-toggle" onClick={()=>toggleUlaGroup(g.id)}>
                    <span className="ula-group-icon">{g.icon}</span>
                    <span className="ula-group-label">{g.label}</span>
                    <span className="ula-group-count">{gKeys.length} {isEn?'labels':'etiquetas'}</span>
                    {groupModified>0&&<span className="ula-modified-badge" style={{fontSize:'.65rem',padding:'1px 7px'}}>{groupModified} {isEn?'edited':'editadas'}</span>}
                    <span className={`ula-group-chev${isOpen?' ula-group-chev-open':''}`}>›</span>
                  </button>
                  {isOpen&&(
                    <div className="ula-rows">
                      {gKeys.map(key=>{
                        const shortKey = g.prefixes.filter(Boolean).reduce((s,p)=>s.startsWith(p)?s.slice(p.length):s, key);
                        const defVal=APP_I18N[key]?.[uiLabelLang==='en'?'en':'es']||APP_I18N[key]?.es||'';
                        return <LabelRow key={key} rkey={key} shortKey={shortKey} defVal={defVal}/>;
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="mact" style={{marginTop:16}}>
            <button className="btn-ghost" onClick={()=>{if(uiLabelLang==='en')setUiLabelsEn({});else setUiLabelsEs({});}}>
              ↩ {isEn?'Reset all to defaults':'Restablecer todo'}
            </button>
            <button className="btn-p" onClick={saveUiLabels}>💾 {isEn?'Save labels':'Guardar etiquetas'}</button>
          </div>
        </div>
      );
    })()}
  </AdminSection>

  <AdminSection title={`💡 ${appText(lang,'tooltips.adminTitle')}`} subtitle={appText(lang,'tooltips.adminSub')} action={<button className="btn-ghost" onClick={saveTooltips}>💾 {appText(lang,'tooltips.save')}</button>} open={openSections.tooltips} onToggle={()=>toggleSection('tooltips')}>
    {(()=>{
      const isEn = lang==='en';
      const TOOLTIP_GROUPS = [
        { id:'actions',  label: isEn?'⚡ Action Buttons':'⚡ Botones de acción',                    keys:['reportIncident','addListing'] },
        { id:'listing',  label: isEn?'🏠 Listing / Registration Fields':'🏠 Campos de listing / registro', keys:['aptNumber','listingEmail','ownerWhatsapp','operator','operatorEmail','operatorWhatsapp'] },
        { id:'incident', label: isEn?'⚠️ Incident Fields':'⚠️ Campos de incidente',               keys:['incidentApartment','incidentType','incidentCategory','incidentDescription','verifyIncident','resolveIncident'] },
      ];
      const KEY_LABELS = {
        reportIncident:      { es:'Botón "Reportar incidente"',        en:'"Report Incident" button' },
        addListing:          { es:'Botón "Registrar unidad"',           en:'"Add Listing" button' },
        aptNumber:           { es:'Campo número de apartamento',        en:'Apartment number field' },
        listingEmail:        { es:'Campo email del listing',            en:'Listing email field' },
        ownerWhatsapp:       { es:'Campo WhatsApp propietario',         en:'Owner WhatsApp field' },
        operator:            { es:'Campo operador',                     en:'Operator field' },
        operatorEmail:       { es:'Campo email del operador',           en:'Operator email field' },
        operatorWhatsapp:    { es:'Campo WhatsApp operador',            en:'Operator WhatsApp field' },
        incidentApartment:   { es:'Campo apartamento (incidente)',      en:'Apartment field (incident)' },
        incidentType:        { es:'Campo tipo de incidente',            en:'Incident type field' },
        incidentCategory:    { es:'Campo categoría de incidente',       en:'Incident category field' },
        incidentDescription: { es:'Campo descripción del incidente',    en:'Incident description field' },
        verifyIncident:      { es:'Botón "Verificar incidente"',        en:'"Verify Incident" button' },
        resolveIncident:     { es:'Botón "Resolver incidente"',         en:'"Resolve Incident" button' },
      };
      return (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>{appText(lang,'tooltips.key')}</th><th>{appText(lang,'tooltips.spanish')}</th><th>{appText(lang,'tooltips.english')}</th></tr></thead>
            <tbody>
              {TOOLTIP_GROUPS.flatMap(group=>[
                <tr key={`${group.id}-hdr`}><td colSpan={3} style={{background:'#e8f4f7',fontWeight:700,fontSize:'.8rem',padding:'8px 12px',color:'#1a4a5a',letterSpacing:'.02em',borderTop:'2px solid #c4dde6'}}>{group.label}</td></tr>,
                ...group.keys.map(k=>(
                  <tr key={k}>
                    <td>
                      <div style={{fontWeight:600,fontSize:'.78rem',color:'#2a5a6a',marginBottom:2}}>{KEY_LABELS[k]?.[isEn?'en':'es']||k}</div>
                      <code style={{fontSize:'.72rem',color:'#888'}}>{k}</code>
                    </td>
                    <td><textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEs[k]||''} onChange={e=>setTooltipsEs(v=>({...v,[k]:e.target.value}))}/></td>
                    <td><textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEn[k]||''} onChange={e=>setTooltipsEn(v=>({...v,[k]:e.target.value}))}/></td>
                  </tr>
                ))
              ])}
            </tbody>
          </table>
        </div>
      );
    })()}
  </AdminSection>

  <AdminSection title={`📨 ${lt(lang,'Plantillas de emails')}`} subtitle={lt(lang,'Edita y guarda la versión en Español e Inglés por separado. El sistema envía según la preferencia del destinatario.')} action={tplLoading?<span className="sync-pill"><span className="spinner-sm"/> {lt(lang,'Cargando...')}</span>:null} open={openSections.email} onToggle={()=>{ toggleSection('email'); if (!openSections.email && !communities.length) loadCommunities(); }}>
    {templateEntries.length===0?<Empty icon="📨" msg={ui(lang,'templatesEmpty')}/>:<><div className="fg2"><div className="fg"><label>{lang==='en'?'Community':'Comunidad'}</label><select value={templateCommunityId} onChange={e=>setTemplateCommunityId(e.target.value)}><option value="__global__">🌐 {lang==='en'?'Global (all communities)':'Global (todas las comunidades)'}</option>{communities.map(c=><option key={c.id} value={c.id}>{lang==='en'?(c.name_en||c.name):c.name} ({c.id})</option>)}</select></div><div className="fg"><label>{lt(lang,'Idioma de plantilla')}</label><select value={templateLang} onChange={e=>setTemplateLang(e.target.value)}><option value="es-CO">{lt(lang,'Español')}</option><option value="en">{lt(lang,'Inglés')}</option></select></div><div className="fg"><label>{lt(lang,'Tipo de notificación')}</label><select value={selectedKey} onChange={e=>setSelectedTemplate(e.target.value)}>{templateEntries.map(([k,tpl])=><option key={k} value={k}>{tpl?.label||k}</option>)}</select></div><div className="fg full"><span className="help-msg">{lt(lang,'Variables disponibles')}: {selectedVars.map(v=>'{{'+v+'}}').join(', ')}</span></div><div className="fg full"><label>{lt(lang,'Asunto')}</label><input value={selected?.subject||''} onChange={e=>updateTpl('subject',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto plano')}</label><textarea rows={6} value={selected?.text||''} onChange={e=>updateTpl('text',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'HTML del email')}</label><textarea rows={10} value={selected?.html||''} onChange={e=>updateTpl('html',e.target.value)}/><span className="help-msg">{lt(lang,'Conserva variables como href="{{incidentLink}}".')}</span></div></div><div className="mact"><button className="btn-p" onClick={saveTemplates}>💾 {lt(lang,'Guardar plantillas de email')}</button>{templateCommunityId!=='__global__'&&<span style={{fontSize:'.78rem',color:'#d9b45a',marginLeft:8}}>⚠️ {lang==='en'?`Editing community: ${templateCommunityId}`:`Editando comunidad: ${templateCommunityId}`}</span>}</div></>}
  </AdminSection>

  {/* ── Email notification routing ─────────────────────────────────────── */}
  {(()=>{
    const isEn = lang==='en';
    const tog = (key,field,val) => setEmailNotifConfig(c=>({...c,[key]:{...c[key],[field]:val}}));
    const GROUPS = [
      { id:'incident', label: isEn?'⚠️ Incidents':'⚠️ Incidentes', types:[
        { key:'incident_new',                label:isEn?'New incident filed':'Incidente nuevo reportado',               cols:['reporter','owner','operator','globalAdmin','delegateAdmin'] },
        { key:'incident_sla',                label:isEn?'SLA escalation':'Escalación SLA',                             cols:['reporter','owner','operator','globalAdmin'] },
        { key:'incident_sla_notification',   label:isEn?'SLA notification (initial)':'SLA — notificación inicial',     cols:['reporter','owner','operator','globalAdmin'] },
        { key:'incident_sla_reminder',       label:isEn?'SLA reminder (cycle)':'SLA — recordatorio (ciclo)',           cols:['reporter','owner','operator','globalAdmin'] },
        { key:'incident_verified',           label:isEn?'Step 1 verified by owner':'Paso 1 verificado por propietario', cols:['reporter','owner','operator','globalAdmin','delegateAdmin'] },
        { key:'incident_resolution_added',   label:isEn?'Step 2 resolution added (ready to close)':'Paso 2 respuesta agregada (listo para cerrar)', cols:['reporter','owner','operator','globalAdmin','delegateAdmin'] },
        { key:'incident_resolved',           label:isEn?'Incident closed':'Incidente cerrado',                         cols:['reporter','owner','operator','globalAdmin','delegateAdmin'] },
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
      { key:'reporter',      icon:'📋', label: isEn?'Reporter — individual person who filed this incident or request':'Reportador — persona específica que reportó el incidente', short: isEn?'Rep.':'Rep.', tag: isEn?'individual':'individual' },
      { key:'owner',         icon:'🏠', label: isEn?'Owner — individual listing owner / registrant':'Propietario — dueño específico del listing o registro', short: isEn?'Owner':'Prop.', tag: isEn?'individual':'individual' },
      { key:'operator',      icon:'🔧', label: isEn?'Operator — individual listing operator (if set)':'Operador — operador específico del listing (si está configurado)', short: isEn?'Oper.':'Oper.', tag: isEn?'individual':'individual' },
      { key:'delegateAdmin', icon:'👥', label: isEn?'Delegate Admins — all delegates with incident permission (group)':'Admins Delegados — todos los delegados con permiso de incidentes (grupo)', short: isEn?'Deleg.':'Deleg.', tag: isEn?'group':'grupo' },
      { key:'globalAdmin',   icon:'🌐', label: isEn?'Global Admins — all configured global admins (group)':'Admins Globales — todos los admins globales configurados (grupo)', short: isEn?'Global':'Global', tag: isEn?'group':'grupo' },
    ];
    return (
      <AdminSection
        title={`📧 ${isEn?'Email Routing':'Enrutamiento de emails'}`}
        subtitle={isEn?'Enable or disable email types and choose who receives them. Individual recipients receive the email directly at their own address; group recipients are all members of that role.':'Activa o desactiva tipos de email y elige quiénes los reciben. Los destinatarios individuales reciben el email en su dirección propia; los grupos incluyen a todos los miembros de ese rol.'}
        action={<button className="bsm" onClick={saveEmailNotifConfig} disabled={emailNotifSaving} style={{whiteSpace:'nowrap'}}>{emailNotifSaving?(isEn?'Saving...':'Guardando...'):`💾 ${isEn?'Save':'Guardar'}`}</button>}
        open={openSections.emailNotif}
        onToggle={()=>toggleSection('emailNotif')}
      >
        {emailNotifLoading
          ? <div style={{padding:'12px 0',color:'#2a5a6a'}}><span className="spinner-sm"/> {lt(lang,'Cargando...')}</div>
          : <>
            {/* Legend */}
            <div className="enc-legend">
              {COL_INFO.map(c=>(
                <span key={c.key}>
                  <strong>{c.icon}</strong> {c.label}
                  {c.tag&&<span className={`enc-tag enc-tag-${c.tag}`}>{c.tag}</span>}
                </span>
              ))}
              <span style={{color:'#9aafb0'}}>— = {isEn?'not applicable for this email type':'no aplica para este tipo de email'}</span>
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
                    {c.tag&&<span className={`enc-tag enc-tag-${c.tag}`} style={{fontSize:'.5rem'}}>{c.tag}</span>}
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

  {/* ── Audit Log Viewer ───────────────────────────────────────────────── */}
  <AdminSection title={`🕵️ ${isEn?'Audit Log':'Log de auditoría'}`} subtitle={isEn?'Full activity history for listings, incidents, roles, and config changes.':'Historial completo de actividad: listings, incidentes, roles y configuración.'} open={openSections.auditLog} onToggle={()=>toggleSection('auditLog')}>
    <AuditLogViewer user={user} lang={lang} isEn={isEn}/>
  </AdminSection>

</div>;
}

// ─── ASSIGN GENERAL INCIDENT TO UNIT ─────────────────────────────────────────
function AssignToUnitModal({ incident, listings=[], onSave, onClose, lang='es-CO' }) {
  const isEn = lang==='en';
  const [aptId,setAptId] = useState('');
  return (
    <Overlay onClose={onClose}>
      <div className="modal-title">🏠 {isEn?'Assign incident to unit':'Asignar incidente a unidad'}</div>
      <div className="modal-sub">{isEn?'Select the unit this incident relates to. Once assigned it follows the standard workflow.':'Selecciona la unidad a la que aplica este incidente. Una vez asignado sigue el flujo estándar.'}</div>
      <div className="fg2">
        <div className="fg full">
          <div className="gen-inc-preview" style={{marginBottom:10}}>
            <span style={{fontSize:'.72rem',fontWeight:800,color:'#496674',textTransform:'uppercase',letterSpacing:'.06em'}}>{isEn?'Incident':'Incidente'}</span>
            <div style={{fontSize:'.84rem',color:'#17313a',marginTop:4,lineHeight:1.4}}>{String(incident.desc||'').slice(0,120)}</div>
            <div style={{fontSize:'.72rem',color:'#8a9fa5',marginTop:4}}>{incident.type} · {incident.date}</div>
          </div>
          <label>{isEn?'Select unit to assign':'Seleccionar unidad para asignar'}</label>
          <UnitPicker listings={listings} value={aptId} onChange={setAptId} lang={lang}/>
        </div>
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{isEn?'Cancel':'Cancelar'}</button>
        <button className="btn-p" disabled={!aptId} onClick={()=>aptId&&onSave(aptId)}>
          🏠 {isEn?'Assign to unit':'Asignar a unidad'}
        </button>
      </div>
    </Overlay>
  );
}

// ─── CLOSE GENERAL INCIDENT (admin direct close) ──────────────────────────────
function CloseGeneralModal({ incident, onSave, onClose, lang='es-CO' }) {
  const isEn = lang==='en';
  const [action,setAction] = useState('');
  const [resolution,setResolution] = useState('');
  const [comments,setComments] = useState('');
  const canSave = String(action||'').trim().length>3 && String(resolution||'').trim().length>3;
  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">✓ {isEn?'Close general incident':'Cerrar incidente general'}</div>
      <div className="modal-sub">{isEn?'Provide the action taken and resolution. This closes the incident without assigning it to a unit.':'Indica la acción tomada y la resolución. Esto cierra el incidente sin asignarlo a una unidad.'}</div>
      <div className="fg2">
        <div className="fg full">
          <div className="gen-inc-preview">
            <span style={{fontSize:'.72rem',fontWeight:800,color:'#496674',textTransform:'uppercase',letterSpacing:'.06em'}}>{isEn?'Incident':'Incidente'}</span>
            <div style={{fontSize:'.84rem',color:'#17313a',marginTop:4,lineHeight:1.4}}>{String(incident.desc||'').slice(0,160)}</div>
            <div style={{fontSize:'.72rem',color:'#8a9fa5',marginTop:4}}>{incident.type} · {incident.date}</div>
          </div>
        </div>
        <div className="fg full">
          <label>✅ {isEn?'Action taken *':'Acción tomada *'}</label>
          <textarea rows={3} value={action} onChange={e=>setAction(e.target.value)} placeholder={isEn?'Describe the action taken to address this incident...':'Describe la acción tomada para atender este incidente...'}/>
        </div>
        <div className="fg full">
          <label>🔍 {isEn?'Resolution *':'Resolución *'}</label>
          <textarea rows={3} value={resolution} onChange={e=>setResolution(e.target.value)} placeholder={isEn?'How was this resolved? What is the outcome?':'¿Cómo se resolvió? ¿Cuál es el resultado?'}/>
        </div>
        <div className="fg full">
          <label>💬 {isEn?'Closing notes (optional)':'Notas de cierre (opcional)'}</label>
          <textarea rows={2} value={comments} onChange={e=>setComments(e.target.value)} placeholder={isEn?'Any additional closing notes...':'Notas adicionales de cierre...'}/>
        </div>
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{isEn?'Cancel':'Cancelar'}</button>
        <button className="btn-p" disabled={!canSave} onClick={()=>canSave&&onSave({action:action.trim(),resolution:resolution.trim(),resolutionComments:comments.trim()})}>
          ✓ {isEn?'Close incident':'Cerrar incidente'}
        </button>
      </div>
    </Overlay>
  );
}

// ─── GENERAL INCIDENTS VIEW ───────────────────────────────────────────────────
function GeneralIncidentsView({ incidents=[], listings=[], user, contactProps={}, isGlobalAdmin=false, canResolveGlobal=false, onIncidentDetail=null, onAssign, onClose: onCloseGeneral, lang='es-CO', embedded=false }) {
  const isEn = lang==='en';
  const general = incidents.filter(i=>i.isGeneral).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const open = general.filter(i=>i.status!=='resolved');
  const closed = general.filter(i=>i.status==='resolved');
  const [showClosed,setShowClosed] = useState(false);
  const canAct = isGlobalAdmin || canResolveGlobal;
  const inner = (
    <>
      <div className="gen-info-banner">
        {isEn
          ? '📢 General incidents affect the building or community and are not specific to one unit. Anyone can report them. Admins can assign them to a unit (switching to normal workflow) or close them directly.'
          : '📢 Los incidentes generales afectan el edificio o la comunidad y no están vinculados a una unidad específica. Cualquier usuario puede reportarlos. Los admins pueden asignarlos a una unidad (flujo normal) o cerrarlos directamente.'}
      </div>

      {open.length===0 && <EmptyState icon="✅" title={isEn?'No open general incidents':'Sin incidentes generales abiertos'} sub={isEn?'All community incidents have been addressed.':'Todos los incidentes de la comunidad han sido atendidos.'}/>}

      {open.length>0&&<div className="gen-list">
        {open.map(inc=>(
          <div key={inc.id} className={`gen-card${inc.status==='resolved'?' gen-card-closed':''}`}>
            <div className="gen-card-header">
              <span className={`gen-card-status-dot ${inc.status==='open'?'gen-dot-open':'gen-dot-wait'}`}/>
              <span className="gen-card-type">{incidentTypeLabel(inc.type,lang)}</span>
              <span className="gen-card-cat">{categoryLabel(inc.category,lang)}</span>
              <span className="gen-card-date">📅 {fmtDate(inc.date)}</span>
              {(()=>{
                const now = new Date();
                const deadline = inc.nextSlaReminderAt ? new Date(inc.nextSlaReminderAt) : null;
                const hoursLeft = deadline ? Math.round((deadline - now) / 3600000) : null;
                if (inc.slaCycleCount > 0 && hoursLeft !== null && hoursLeft < 0) {
                  return <span className="gen-card-sla gen-card-sla-breach">🔴 SLA {isEn?'overdue':'vencido'} ×{inc.slaCycleCount}</span>;
                }
                if (inc.slaCycleCount > 0) return <span className="gen-card-sla">⏱️ ×{inc.slaCycleCount}</span>;
                if (hoursLeft !== null && hoursLeft <= 4 && hoursLeft >= 0) return <span className="gen-card-sla gen-card-sla-urgent">🟠 {isEn?`${hoursLeft}h`:`${hoursLeft}h`}</span>;
                return null;
              })()}
              {onIncidentDetail&&<button className="ir-detail-pill" onClick={()=>onIncidentDetail(inc.id)}>{isEn?'Details':'Detalles'} ›</button>}
            </div>
            <p className="gen-card-desc">{inc.desc}</p>
            {inc.reporterName&&<div className="gen-card-reporter">📋 {isEn?'Reported by':'Reportado por'}: {inc.reporterName}</div>}
            {Array.isArray(inc.photos)&&inc.photos.length>0&&(
              <div className="inc-photo-row">
                {inc.photos.map((p,i)=><img key={i} src={p.data} alt={p.name||`photo-${i+1}`} className="inc-photo-thumb" onClick={()=>window.open(p.data,'_blank')}/>)}
              </div>
            )}
            {canAct&&inc.status!=='resolved'&&(
              <div className="gen-card-acts">
                <button className="btn-p bsm" onClick={()=>onAssign&&onAssign(inc)}>🏠 {isEn?'Assign to unit':'Asignar a unidad'}</button>
                <button className="btn-ghost bsm" onClick={()=>onCloseGeneral&&onCloseGeneral(inc)}>✓ {isEn?'Close directly':'Cerrar directamente'}</button>
              </div>
            )}
          </div>
        ))}
      </div>}

      {closed.length>0&&(
        <div style={{marginTop:16}}>
          <button className="btn-ghost bsm" onClick={()=>setShowClosed(s=>!s)}>
            {showClosed?(isEn?'▲ Hide closed':'▲ Ocultar cerrados'):(isEn?`▼ Show ${closed.length} closed`:`▼ Ver ${closed.length} cerrados`)}
          </button>
          {showClosed&&<div className="gen-list" style={{marginTop:8,opacity:.75}}>
            {closed.map(inc=>(
              <div key={inc.id} className="gen-card gen-card-closed">
                <div className="gen-card-header">
                  <span className="gen-card-status-dot gen-dot-closed"/>
                  <span className="gen-card-type">{incidentTypeLabel(inc.type,lang)}</span>
                  <span className="gen-card-date">📅 {fmtDate(inc.date)}</span>
                  {onIncidentDetail&&<button className="ir-detail-pill" onClick={()=>onIncidentDetail(inc.id)}>{isEn?'Details':'Detalles'} ›</button>}
                </div>
                <p className="gen-card-desc">{inc.desc}</p>
                {inc.resolutionComments&&<div className="gen-card-resolution">✓ {inc.resolutionComments}</div>}
              </div>
            ))}
          </div>}
        </div>
      )}
    </>
  );
  return embedded ? inner : (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">📢 {isEn?'General Incidents':'Incidentes Generales'}</h1>
          <p className="psub">{isEn?`Community-wide incidents not tied to a specific unit · ${open.length} open`:`Incidentes de la comunidad no asociados a una unidad · ${open.length} abiertos`}</p>
        </div>
      </div>
      {inner}
    </div>
  );
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

function CommunitySwitch({ communities=[], currentId='', onChange=()=>{}, lang='es-CO', loading=false }) {
  if (!communities || communities.length <= 1) return null;
  const label = lang === 'en' ? 'Switch community' : 'Cambiar comunidad';
  const current = communities.find(c => c.id === currentId);
  return (
    <select
      className="lang-switch community-switch"
      value={currentId || ''}
      onChange={e => e.target.value && e.target.value !== currentId && onChange(e.target.value)}
      title={label}
      aria-label={label}
      disabled={loading}
    >
      {!current && <option value="">— {label} —</option>}
      {communities.map(c => (
        <option key={c.id} value={c.id}>{lang === 'en' ? (c.name_en || c.name || c.id) : (c.name || c.id)}</option>
      ))}
    </select>
  );
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
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fg{display:flex;flex-direction:column;gap:5px}.fg.full{grid-column:1/-1}.fg label{font-size:.69rem;font-weight:500;color:#2a5a6a;text-transform:uppercase;letter-spacing:.06em}.fg input,.fg select,.fg textarea{background:rgba(255,255,255,.78);border:1px solid rgba(90,105,80,.22);color:#17313a;padding:8px 12px;border-radius:8px;font-size:.85rem;outline:none;transition:border .2s}.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--kai-aqua);background:rgba(94,215,198,.07)}.fg input.field-error,.fg select.field-error,.fg textarea.field-error{border-color:#ff6b6b;background:rgba(255,107,107,.10);box-shadow:0 0 0 2px rgba(255,107,107,.12)}.err-msg{font-size:.68rem;color:#ff8a80;font-weight:600}.help-msg{font-size:.66rem;color:#5a8a8f;margin-top:1px}.form-alert{font-size:.78rem;color:#1a4470;background:rgba(21,101,192,.06);border:1px solid rgba(21,101,192,.18);border-left:3px solid #1565c0;padding:9px 13px;border-radius:8px;margin-bottom:15px;line-height:1.45}.locked-field{opacity:.72;cursor:not-allowed;color:#496674!important;background:rgba(47,79,58,.05)!important;border-color:rgba(47,79,58,.15)!important}.fg select option{background:#fff;color:#17313a}.fg textarea{resize:vertical}.csel{display:flex;flex-wrap:wrap;gap:7px}.copt{padding:6px 13px;border-radius:20px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#3a6070;font-size:.75rem;cursor:pointer;transition:all .18s}.copt:hover{border-color:rgba(255,255,255,.2);color:#b0ccd8}.copt-on{font-weight:600}
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
.nav-dd-menu,.profile-menu{max-height:min(72vh,520px);overflow:auto;-webkit-overflow-scrolling:touch}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:block!important}@media(max-width:1000px){.hdr-inner{height:auto;min-height:56px;align-items:center}.hdr-right{margin-left:auto}.nav-dd-menu{position:fixed;left:12px;right:12px;top:62px;min-width:auto}.profile-menu{position:fixed;left:12px;right:12px;top:62px;min-width:auto}.mob-nav{display:none!important}.nav{display:flex!important;justify-content:flex-start;gap:2px;overflow:visible}.nav .nb:nth-of-type(n+4){display:none}.nav-dd{display:block}.nb{font-size:.72rem;padding:6px 8px}.lang-switch{max-width:112px}.community-switch{max-width:130px}.icon-btn{width:32px;height:32px}.profile-head strong,.profile-head span,.profile-head small{max-width:none}}@media(max-width:600px){.hdr-inner{padding:7px 10px;gap:6px}.logo-mark{width:34px;height:34px}.nav .nb:nth-of-type(n+3){display:none}.nav-dd-menu,.profile-menu{top:56px}.main{padding-top:14px}.fg2{grid-template-columns:1fr}.card{padding:18px}.ptitle{font-size:1.55rem}}
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
.fchip-warn.fchip-on{background:#d9700e!important;border-color:#d9700e!important;}
.fchip-resolve.fchip-on{background:#0b7f4f!important;border-color:#0b7f4f!important;}
.ir-type,.ir-cat,.ir-status,.chip{font-weight:800!important;border:1px solid rgba(0,0,0,.06);}
.is-open{background:#ffe2d7!important;color:#b83215!important;}
.is-pending-res{background:#fff3e0!important;color:#e07b2a!important;}
.is-verified{background:#dff5e4!important;color:#1f7a35!important;}
.is-resolved,.is-res{background:#e8f5e9!important;color:#2e7d32!important;}
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
*{box-sizing:border-box}body{margin:0;font-family:'DM Sans',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f3e9;color:var(--kai-ink)}button,input,select,textarea{font:inherit}.app-shell{min-height:100vh;padding-bottom:40px;background:linear-gradient(180deg,rgba(255,255,255,.88),rgba(245,239,225,.93)),url('/morros-kai.png') center top/cover fixed!important;color:var(--kai-ink)!important}.hdr{position:sticky!important;top:0!important;z-index:100000!important;background:rgba(255,255,255,.92)!important;backdrop-filter:blur(14px);border-bottom:1px solid rgba(47,79,58,.16);box-shadow:0 10px 28px rgba(32,46,38,.10);overflow:visible!important}.hdr-inner{min-height:62px;padding:8px 16px;display:flex;align-items:center;gap:12px;max-width:1440px;margin:0 auto;overflow:visible!important}.logo{display:flex;align-items:center;gap:10px;cursor:pointer;min-width:220px}.logo-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#e7fff7,#d8f2f5);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 8px 20px rgba(11,127,140,.13);color:#0b7f4f;font-family:'Playfair Display',serif;font-weight:900}.logo-k{font-size:1.22rem}.logo-wave{font-size:.7rem;position:absolute;right:7px;top:7px;color:#0b7f8c}.logo-title{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:900;color:#203f2b}.logo-sub{font-size:.76rem;color:#235f72}.nav{display:flex;align-items:center;gap:5px;flex:1;min-width:0;overflow:visible!important}.nb,.dd-item,.icon-btn,.profile-btn,.btn-google,.btn-p,.btn-ghost,.bsm,.fchip{border:1px solid rgba(47,79,58,.18);background:rgba(255,255,255,.84);color:#17313a;border-radius:12px;cursor:pointer;transition:.15s ease;text-decoration:none}.nb{padding:8px 10px;font-weight:800;white-space:nowrap;position:relative}.nb:hover,.dd-item:hover,.icon-btn:hover,.profile-btn:hover{background:#fff;box-shadow:0 8px 18px rgba(32,46,38,.10);transform:translateY(-1px)}.nb-active,.dd-active{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.nb-badge,.icon-badge,.mbn-badge{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:999px;background:#e94235;color:#fff;font-size:.68rem;font-weight:900;margin-left:6px;padding:0 5px}.nav-dd,.profile-dd{position:relative;overflow:visible!important}.nav-dd-menu,.profile-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:230px;background:rgba(255,255,255,.98);border:1px solid rgba(47,79,58,.18);border-radius:16px;padding:8px;box-shadow:0 24px 70px rgba(20,32,26,.25);z-index:1000000!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important;flex-direction:column;gap:4px}.dd-item{width:100%;text-align:left;padding:10px 12px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px}.dd-item.danger{color:#9d1f16;background:#fff5f3}.hdr-right{display:flex;align-items:center;gap:8px;margin-left:auto;overflow:visible!important}.lang-switch{height:38px;border-radius:12px;border:1px solid rgba(47,79,58,.18);background:#fff;color:#17313a;padding:0 9px;font-weight:800;max-width:130px}.community-switch{max-width:160px}.icon-btn,.profile-btn{width:42px;height:42px;display:flex;align-items:center;justify-content:center;position:relative}.icon-btn{font-size:1.15rem}.uavatar,.uavatar-img{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#a84cc1;color:#fff;font-weight:900;object-fit:cover}.profile-menu{right:0;min-width:285px}.profile-head{padding:10px 12px;border-bottom:1px solid rgba(47,79,58,.12);margin-bottom:5px;display:flex;flex-direction:column;gap:2px}.profile-head strong{color:#203f2b}.profile-head span,.profile-head small{font-size:.78rem;color:#235f72;word-break:break-word}.profile-lang{padding:10px 12px;display:flex;align-items:center;gap:8px;justify-content:space-between}.sync-pill{font-size:.76rem;color:#235f72;background:rgba(255,255,255,.72);border:1px solid rgba(47,79,58,.14);border-radius:999px;padding:8px 10px;white-space:nowrap}.sync-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}.synced{background:#1eaa64}.syncing{background:#d9b45a}.mob-nav{display:none}.main{max-width:1360px;margin:0 auto;padding:20px 24px 70px;position:relative;z-index:1}.card,.welcome-card,.role-guide,.notice-card,.gate-card{background:rgba(255,255,255,.94)!important;border:1px solid rgba(47,79,58,.18)!important;border-radius:22px!important;box-shadow:0 14px 40px rgba(32,46,38,.13)!important;padding:22px}.ptitle{font-family:'Playfair Display',serif;color:#203f2b!important;font-size:2rem;margin:0 0 8px;font-weight:900}.psub{color:#235f72!important;margin:0 0 14px;line-height:1.45}.ph{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.btn-p,.btn-report,.btn-action{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border:0!important;border-radius:16px!important;padding:11px 17px!important;font-weight:900!important;box-shadow:0 12px 26px rgba(11,127,140,.22)!important;cursor:pointer}.btn-ghost{background:rgba(255,255,255,.78)!important;color:#17313a!important;padding:10px 14px!important;font-weight:800!important}.btn-google{display:inline-flex;align-items:center;gap:9px;background:#fff!important;padding:12px 18px!important;font-weight:900!important}.stats6,.owner-stats,.mission-grid,.mission-grid-compact,.analytics-grid,.cat-stats,.reg-filter-grid{display:grid;gap:14px}.stats6{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))}.owner-stats{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.stat,.owner-stat,.acard,.catcard{background:rgba(255,255,255,.9)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:18px!important;padding:16px!important;box-shadow:0 10px 25px rgba(32,46,38,.08)!important}.stat-num,.ac-num,.ar-num{font-family:'Playfair Display',serif;font-size:1.55rem;font-weight:900;color:#203f2b}.stat-label,.ac-label{font-size:.78rem;color:#235f72;font-weight:800}.action-banner-wrap{position:relative!important;z-index:10!important;margin:12px auto 16px!important;max-width:1360px!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;gap:12px!important;padding:0 24px!important}.action-banner{background:rgba(255,255,255,.96)!important;border:1px solid rgba(47,79,58,.18)!important;border-left:6px solid var(--kai-ocean)!important;border-radius:18px!important;padding:14px 16px!important;box-shadow:0 12px 30px rgba(32,46,38,.12)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}.action-banner strong{color:#203f2b!important}.action-banner span{color:#235f72!important}.resolve-action{border-left-color:#2f8f46!important}.owner-action{border-left-color:#d9b45a!important}.fg,.fg2{display:grid;gap:10px}.fg2{grid-template-columns:repeat(2,minmax(0,1fr))}.fg label{font-size:.78rem;font-weight:900;color:#203f2b}.fg input,.fg select,.fg textarea,.search,.admin-textarea,.admin-tooltip-textarea{width:100%;border:1px solid rgba(47,79,58,.24)!important;border-radius:13px!important;background:rgba(255,255,255,.96)!important;color:#102f3a!important;padding:10px 12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}.fg textarea,.admin-textarea,.admin-tooltip-textarea{min-height:74px;resize:vertical;line-height:1.45}.admin-tooltip-textarea{min-height:92px}.irow{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:14px 16px!important;margin-bottom:10px!important;display:flex;gap:14px;box-shadow:0 8px 22px rgba(32,46,38,.08)!important}.ir-guest,.ir-desc,.ir-date,.ir-rep,.ir-loc{color:#173f4d!important}.ir-guest{font-weight:900}.ir-acts{display:flex;flex-direction:column;gap:6px}.bsm{padding:8px 10px!important;font-weight:900!important;border-radius:12px!important}.filter-row{display:flex;gap:8px;flex-wrap:wrap}.fchip{padding:9px 14px!important;border-radius:999px!important;font-weight:900!important}.fchip-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.workflow-card{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:20px!important;padding:14px 18px!important;box-shadow:0 12px 28px rgba(32,46,38,.10)!important;overflow:visible!important}.wf-steps{display:grid!important;grid-template-columns:1fr 26px 1fr 26px 1fr;align-items:center;gap:8px}.wf-step{min-height:72px!important;background:#fff!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:10px 12px!important}.wf-arrow{display:flex!important;justify-content:center;color:#2aa8ad;font-size:1.2rem}.wf-tip{z-index:1000001!important}.overlay{z-index:1000002!important}.modal{background:#fff!important}.toast{position:fixed;right:18px;bottom:18px;z-index:1000003;background:#17313a;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.25)}.empty{padding:30px;text-align:center;color:#235f72}.admin-table{width:100%;border-collapse:separate;border-spacing:0 8px}.admin-table th{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#203f2b;text-align:left}.admin-table td{background:rgba(255,255,255,.86);border-top:1px solid rgba(47,79,58,.12);border-bottom:1px solid rgba(47,79,58,.12);padding:10px;vertical-align:top}.admin-table td:first-child{border-left:1px solid rgba(47,79,58,.12);border-radius:12px 0 0 12px}.admin-table td:last-child{border-right:1px solid rgba(47,79,58,.12);border-radius:0 12px 12px 0}.nav-dd-menu,.profile-menu{position:fixed!important;top:64px!important;right:16px!important;max-height:calc(100vh - 78px)!important;overflow:auto!important}.nav-dd-menu{right:auto!important;left:320px!important}.profile-menu{right:16px!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important}.role-guide,.action-banner-wrap,.workflow-card,.card,.main{overflow:visible!important}.action-banner-wrap,.role-guide{z-index:5!important}.main{z-index:1!important}
@media(max-width:1000px){.logo{min-width:auto}.logo-title,.logo-sub,.compact-sync{display:none}.hdr-inner{padding:8px 10px}.nav{gap:3px}.nav .nb:nth-of-type(n+4){display:none}.nb{padding:7px 8px;font-size:.72rem}.nav-dd-menu{left:10px!important;right:10px!important;top:60px!important}.profile-menu{left:10px!important;right:10px!important;top:60px!important}.main{padding:16px 12px 60px}.action-banner-wrap{padding:0 12px!important;grid-template-columns:1fr!important}.wf-steps{grid-template-columns:1fr!important}.wf-arrow{display:none!important}.fg2{grid-template-columns:1fr}.ph{flex-direction:column}.irow{flex-direction:column}.ir-acts{flex-direction:row;flex-wrap:wrap}.stats6{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.hdr-inner{gap:6px}.logo-mark{width:34px;height:34px}.nav .nb:nth-of-type(n+3){display:none}.lang-switch{max-width:110px}.community-switch{max-width:120px}.icon-btn,.profile-btn{width:34px;height:34px}.ptitle{font-size:1.55rem}.card,.welcome-card,.role-guide{padding:16px}.action-banner{flex-direction:column;align-items:flex-start!important}.stats6{grid-template-columns:1fr}.workflow-card{padding:12px!important}.wf-tip{left:8px!important;right:8px!important;transform:none!important;min-width:0!important}.wf-tip:after{left:22px!important}}

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
.adp-airbnb-lnk{display:inline-flex;align-items:center;font-size:.9rem;opacity:.6;text-decoration:none;padding:2px 5px;border-radius:6px;transition:opacity .15s}
.adp-airbnb-lnk:hover{opacity:1}
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
/* Version badge at the bottom of profile dropdown */
.profile-version{font-size:.65rem;color:rgba(47,79,58,.4);text-align:center;padding:6px 12px 2px;letter-spacing:.04em;font-weight:600;border-top:1px solid rgba(47,79,58,.06);margin-top:2px}
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
.apt-door{position:relative;border-radius:12px;overflow:hidden;cursor:pointer;background:rgba(255,255,255,.96);border:1.5px solid rgba(47,79,58,.16);box-shadow:0 4px 12px rgba(32,46,38,.08);transition:transform .15s,box-shadow .15s,border-color .18s,background .15s;user-select:none;display:flex;flex-direction:column}
.apt-door:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(11,127,140,.18);background:rgba(11,127,140,.05);border-color:rgba(11,127,140,.35)!important}
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
.door-hover-cta{font-size:.6rem;font-weight:800;color:rgba(255,255,255,.5);margin-top:4px;letter-spacing:.03em}
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
.adp-inc-comments{font-size:.76rem;color:#203f2b;margin-top:5px;background:rgba(47,79,58,.06);border-radius:7px;padding:6px 10px;border:1px solid rgba(47,79,58,.1);line-height:1.45}
.adp-comment-action{background:rgba(21,101,192,.06)!important;border-color:rgba(21,101,192,.15)!important;color:#1a3a6a!important}
.adp-comment-resolution{background:rgba(11,127,79,.06)!important;border-color:rgba(11,127,79,.15)!important;color:#0b4f32!important}
.adp-comment-closed{background:rgba(47,79,58,.08)!important;border-color:rgba(47,79,58,.2)!important;color:#203f2b!important}
.adp-comment-lbl{font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-right:5px;display:inline-block}
.adp-inc-reporter-name{font-size:.68rem;color:#6a8a9a;white-space:nowrap}
/* ── Verify resolution hint + warning */
.verify-resolution-hint{font-size:.75rem;color:#1a4470;background:rgba(21,101,192,.06);border:1px solid rgba(21,101,192,.18);border-radius:6px;padding:6px 10px;margin-bottom:6px;line-height:1.4}
.inc-res-warn{font-size:.74rem;color:#7f1500;background:#fff5f0;border:1.5px solid #e65100;border-left:4px solid #e65100;border-radius:7px;padding:7px 11px;margin:6px 0;line-height:1.45;font-weight:600}
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

/* ── v80 — 8 new features ────────────────────────────────────────────────── */

/* Feature 3: Draft restored banner */
.draft-restored-banner{background:rgba(217,160,48,.1);border:1px solid rgba(217,160,48,.35);border-left:4px solid #d9a030;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:.8rem;color:#7a4a00;display:flex;align-items:center;flex-wrap:wrap;gap:6px;line-height:1.4}

/* Feature 1: Profile completeness warning banner */
.profile-warn-banner{background:rgba(220,100,0,.07);border:1px solid rgba(220,100,0,.28);border-left:4px solid #d9700e;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.8rem;color:#6a3000;line-height:1.45}

/* Feature 2: Action guide banner */
.action-guide-banner{background:rgba(11,127,79,.06);border:1px solid rgba(11,127,79,.2);border-radius:12px;padding:12px 14px;margin-bottom:14px}
.agb-title{font-size:.78rem;font-weight:900;color:#0b4f32;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
.agb-items{display:flex;flex-direction:column;gap:6px}
.agb-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.18);border-radius:9px;padding:8px 12px;cursor:pointer;text-align:left;font-size:.82rem;color:#17313a;transition:all .14s;width:100%}
.agb-item:hover{background:#fff;box-shadow:0 4px 12px rgba(32,46,38,.1);border-color:#0b7f4f}
.agb-item-warn{border-left:3px solid #d9700e}
.agb-item-res{border-left:3px solid #0b7f4f}
.agb-badge{background:#d9700e;color:#fff;border-radius:999px;font-size:.7rem;font-weight:900;padding:2px 8px;flex-shrink:0;min-width:24px;text-align:center}
.agb-badge-res{background:#0b7f4f}
.agb-arr{margin-left:auto;color:#8a9fa5;font-size:1rem;flex-shrink:0}

/* Feature 6: Dashboard attention section */
.attn-card{border-left:4px solid #d4634a!important}
.attn-badge{background:#d4634a;color:#fff;border-radius:999px;font-size:.7rem;font-weight:900;padding:2px 9px;min-width:24px;text-align:center;flex-shrink:0}
.attn-sub{font-size:.76rem;color:#6a3000;background:rgba(212,99,74,.06);border-radius:7px;padding:6px 10px;margin-bottom:10px;line-height:1.4}
.attn-group-lbl{font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#2a5a6a;margin:4px 0 4px;padding-bottom:4px;border-bottom:1px solid rgba(47,79,58,.08)}

/* Feature 7: Incident date filter bar */
.inc-filters-bar{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.inc-date-range{display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap}
.inc-date-lbl{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#2a5a6a;white-space:nowrap}
.inc-date-input{height:36px;border-radius:9px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.95)!important;color:#17313a!important;padding:0 9px!important;font-size:.82rem;min-width:136px;cursor:pointer}
@media(max-width:600px){.inc-filters-bar{flex-direction:column;align-items:stretch}.inc-date-range{flex-wrap:wrap}}

/* Feature 5: Notification grouping */
.notice-groups{display:flex;flex-direction:column;gap:10px}
.notif-group{background:rgba(255,255,255,.92);border:1px solid rgba(47,79,58,.16);border-radius:14px;overflow:hidden;box-shadow:0 6px 16px rgba(32,46,38,.07)}
.notif-group-open{border-color:rgba(11,127,140,.3)}
.notif-group-hdr{width:100%;display:flex;align-items:center;gap:8px;padding:12px 14px;background:none;border:0;border-left:4px solid rgba(47,79,58,.15);cursor:pointer;text-align:left;transition:background .14s}
.notif-group-open .notif-group-hdr{border-left-color:#0b7f8c;background:rgba(11,127,140,.04)}
.notif-group-hdr:hover{background:rgba(11,127,140,.04)}
.notif-group-icon{font-size:1rem;flex-shrink:0}
.notif-group-label{font-size:.84rem;font-weight:700;color:#17313a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.notif-group-badge{background:#d4634a;color:#fff;border-radius:999px;font-size:.65rem;font-weight:900;padding:2px 7px;flex-shrink:0}
.notif-group-count{font-size:.72rem;color:#496674;white-space:nowrap;flex-shrink:0}
.notif-group-chev{font-size:1.1rem;color:#8a9fa5;font-weight:900;transition:transform .18s;display:inline-block;flex-shrink:0}
.notif-group-chev-open{transform:rotate(90deg)}

/* Feature 4: Mobile bottom navigation */
.mob-bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:9500;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);border-top:1px solid rgba(47,79,58,.12);box-shadow:0 -4px 18px rgba(32,46,38,.1);padding:0;padding-bottom:env(safe-area-inset-bottom,0)}
@media(max-width:768px){.mob-bottom-nav{display:flex;justify-content:space-around;align-items:stretch}}
.mbn-bottom{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 4px 10px;background:none;border:0;cursor:pointer;color:#496674;min-height:56px;position:relative;transition:color .14s}
.mbn-bottom:active{background:rgba(11,127,140,.06)}
.mbn-bottom-active{color:#0b7f8c!important}
.mbn-bottom-active .mbn-bottom-icon::after{content:'';position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:20px;height:3px;background:#0b7f8c;border-radius:999px}
.mbn-bottom-icon{font-size:1.2rem;position:relative;line-height:1}
.mbn-bottom-lbl{font-size:.58rem;font-weight:800;letter-spacing:.03em;text-transform:uppercase}
.mbn-bottom-badge{position:absolute;top:-4px;right:-6px;background:#d4634a;color:#fff;border-radius:999px;font-size:.54rem;font-weight:900;padding:1px 5px;min-width:16px;text-align:center;line-height:1.4}
/* Shift main content up so bottom nav doesn't cover it on mobile */
@media(max-width:768px){.main{padding-bottom:70px!important}}

/* Feature 8: Audit log viewer */
.audit-wrap{display:flex;flex-direction:column;gap:12px}
.audit-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.audit-select{height:36px;border-radius:9px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.95)!important;color:#17313a!important;padding:0 10px!important;font-size:.82rem;min-width:160px;cursor:pointer}
.audit-input{height:36px;border-radius:9px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.95)!important;color:#17313a!important;padding:0 10px!important;font-size:.82rem;min-width:130px}
.audit-date{min-width:138px!important;cursor:pointer}
.audit-stats-bar{font-size:.74rem;color:#496674;display:flex;gap:12px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(47,79,58,.08)}
.audit-table{font-size:.78rem}
.audit-entity-chip{background:rgba(11,127,140,.1);color:#0b5f72;border-radius:999px;padding:2px 8px;font-size:.68rem;font-weight:800;white-space:nowrap}
.audit-id{background:rgba(47,79,58,.07);border-radius:5px;padding:1px 5px;font-size:.65rem;color:#496674;margin-left:5px}
.audit-action{font-weight:800;color:#17313a;font-size:.76rem}
.audit-detail{cursor:pointer}
.audit-detail-toggle{font-size:.7rem;color:#0b7f8c;cursor:pointer;list-style:none;border:1px solid rgba(11,127,140,.2);border-radius:6px;padding:2px 8px;background:rgba(11,127,140,.06)}
.audit-detail-body{padding:8px;background:rgba(245,248,244,.9);border-radius:8px;margin-top:6px;border:1px solid rgba(47,79,58,.1)}
.audit-json{font-size:.65rem;color:#17313a;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto;margin:4px 0 0;background:rgba(255,255,255,.8);border-radius:6px;padding:6px 8px}
.audit-pagination{display:flex;align-items:center;justify-content:center;gap:12px;padding-top:8px;border-top:1px solid rgba(47,79,58,.08)}
@media(max-width:640px){.audit-filters{flex-direction:column;align-items:stretch}.audit-filters .btn-p{width:100%}}
/* On mobile, push toast above the bottom nav */
@media(max-width:768px){.toast{bottom:80px!important}}

/* Email routing individual/group tags */
.enc-tag{display:inline-block;border-radius:999px;font-size:.55rem;font-weight:800;padding:1px 6px;margin-left:4px;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle}
.enc-tag-individual,.enc-tag-individual{background:rgba(11,127,140,.12);color:#0b5f72;border:1px solid rgba(11,127,140,.2)}
.enc-tag-group,.enc-tag-grupo{background:rgba(106,27,154,.1);color:#4a1a7a;border:1px solid rgba(106,27,154,.15)}

/* ── v81 — Photos + General Incidents ───────────────────────────────────── */

/* Photo thumbnails in IRow / GeneralIncidentsView */
.inc-photo-row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 2px}
.inc-photo-thumb{width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:pointer;border:1.5px solid rgba(47,79,58,.18);transition:transform .14s,box-shadow .14s}
.inc-photo-thumb:hover{transform:scale(1.06);box-shadow:0 4px 14px rgba(32,46,38,.18)}

/* Photo upload UI in IncidentModal */
.inc-photo-upload-area{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin-top:6px}
.inc-photo-preview{position:relative;width:72px;height:72px;flex-shrink:0}
.inc-photo-preview-img{width:72px;height:72px;object-fit:cover;border-radius:10px;border:1.5px solid rgba(47,79,58,.18);display:block}
.inc-photo-remove{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#d4634a;color:#fff;border:2px solid #fff;font-size:.62rem;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.inc-photo-size{position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:.55rem;color:rgba(255,255,255,.9);background:rgba(0,0,0,.4);border-radius:0 0 8px 8px;padding:1px 3px}
.inc-photo-add-btn{width:72px;height:72px;border-radius:10px;border:2px dashed rgba(11,127,140,.35);background:rgba(11,127,140,.06);color:#0b7f8c;font-size:.72rem;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:all .14s}
.inc-photo-add-btn:hover{background:rgba(11,127,140,.12);border-color:#0b7f8c}

/* General incident toggle in IncidentModal */
.gen-toggle-wrap{background:rgba(11,127,140,.06);border:1px solid rgba(11,127,140,.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:6px}
.gen-toggle-label{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.84rem;color:#17313a;font-weight:600}
.gen-toggle-label input[type="checkbox"]{width:16px;height:16px;flex-shrink:0;accent-color:#0b7f8c;cursor:pointer}
.gen-toggle-box{display:none}
.gen-toggle-hint{font-size:.74rem;color:#0b5f72;background:rgba(11,127,140,.07);border-radius:7px;padding:5px 10px;line-height:1.4}

/* GeneralIncidentsView */
.gen-info-banner{background:rgba(11,127,140,.07);border:1px solid rgba(11,127,140,.22);border-left:4px solid #0b7f8c;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:.8rem;color:#0b4f5e;line-height:1.5}
.gen-list{display:flex;flex-direction:column;gap:12px}
.gen-card{background:rgba(255,255,255,.94);border:1px solid rgba(47,79,58,.18);border-left:4px solid #d4634a;border-radius:14px;padding:14px 16px;box-shadow:0 6px 16px rgba(32,46,38,.08);display:flex;flex-direction:column;gap:8px}
.gen-card-closed{border-left-color:rgba(47,79,58,.25)!important;opacity:.8}
.gen-card-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.gen-card-status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.gen-dot-open{background:#d4634a}
.gen-dot-wait{background:#d9a030}
.gen-dot-closed{background:#4a7060}
.gen-card-type{font-size:.72rem;font-weight:800;color:#496674;background:rgba(47,79,58,.08);border-radius:999px;padding:2px 8px}
.gen-card-cat{font-size:.7rem;color:#6a8a9a;background:rgba(47,79,58,.06);border-radius:999px;padding:2px 7px}
.gen-card-date{font-size:.7rem;color:#8a9fa5;margin-left:auto}
.gen-card-sla{font-size:.68rem;font-weight:800;color:#e65100;background:#fff3e0;border-radius:999px;padding:2px 7px}
.gen-card-desc{font-size:.86rem;color:#17313a;line-height:1.5;margin:0}
.gen-card-reporter{font-size:.72rem;color:#496674}
.gen-card-resolution{font-size:.78rem;color:#0b4f32;background:rgba(11,127,79,.07);border-radius:7px;padding:6px 10px;border-left:3px solid #0b7f4f}
.gen-card-acts{display:flex;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px solid rgba(47,79,58,.08)}
/* General incident preview in modals */
.gen-inc-preview{background:rgba(47,79,58,.05);border-radius:8px;padding:8px 10px;border:1px solid rgba(47,79,58,.1)}

/* ── v82 — Responsible Parties panels ───────────────────────────────────────*/

/* Incident detail (UnitDetailCard step=incident) parties panel */
.idd-parties{background:rgba(11,127,79,.04);border:1px solid rgba(11,127,79,.16);border-radius:12px;padding:12px 14px;margin-bottom:12px}
.idd-parties-hdr{font-size:.67rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#0b5f3a;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(11,127,79,.12);display:flex;align-items:center;gap:6px}
.idd-parties-grid{display:flex;flex-direction:column;gap:6px}
.idd-pi-item{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.85);border:1px solid rgba(47,79,58,.1)}
.idd-pi-owner{border-color:rgba(11,127,79,.25)!important;background:rgba(11,127,79,.04)!important}
.idd-pi-role{font-size:.67rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#2a5a6a;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:1px}
.idd-pi-resp-badge{background:rgba(11,127,79,.15);color:#0b5f3a;border-radius:999px;font-size:.6rem;font-weight:900;padding:2px 8px;text-transform:none;letter-spacing:0;white-space:nowrap}
.idd-pi-name{font-size:.88rem;font-weight:700;color:#17313a}
.idd-pi-contacts{display:flex;gap:7px;flex-wrap:wrap;margin-top:4px}
.idd-pi-link{font-size:.73rem;color:#0b5f72;text-decoration:none;background:rgba(11,127,140,.08);border:1px solid rgba(11,127,140,.2);border-radius:6px;padding:3px 9px;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;transition:background .12s}
.idd-pi-link:hover{background:rgba(11,127,140,.18);color:#083f4f}
.idd-pi-wa{background:rgba(37,211,102,.07)!important;border-color:rgba(37,211,102,.22)!important;color:#1a6b34!important}
.idd-pi-wa:hover{background:rgba(37,211,102,.14)!important}
.idd-pi-none{font-size:.8rem;color:#8a9fa5;font-style:italic}

/* IRow parties strip (non-compact) */
.ir-body-parties{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(47,79,58,.09)}
.ir-bparty{display:inline-flex;align-items:center;gap:5px;font-size:.78rem;color:#496674}
.ir-bparty-lbl{font-weight:900;color:#2a5a6a;font-size:.64rem;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;flex-shrink:0}
/* IRow parties strip (compact / dashboard) */
.ir-bparty-compact{display:flex;flex-wrap:wrap;gap:3px 10px;margin-top:5px;padding-top:5px;border-top:1px solid rgba(47,79,58,.08)}
.ir-bpc-item{font-size:.69rem;color:#6a8a9a;white-space:nowrap}

/* Incidents tab bar */
.inc-tab-bar{display:flex;gap:0;border-bottom:2px solid rgba(47,79,58,.12);margin-bottom:18px}
.inc-tab{flex:1;padding:11px 14px;background:transparent;border:0;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;font-size:.88rem;font-weight:700;color:#496674;display:flex;align-items:center;justify-content:center;gap:7px;transition:color .14s,border-color .14s}
.inc-tab:hover{color:#17313a;background:rgba(47,79,58,.04)}
.inc-tab-on{color:#0b7f8c!important;border-bottom-color:#0b7f8c!important;background:rgba(11,127,140,.05)!important}
.inc-tab-badge{display:inline-flex;min-width:20px;height:20px;align-items:center;justify-content:center;border-radius:999px;background:#d4634a;color:#fff;font-size:.68rem;font-weight:900;padding:0 5px}
.inc-tab-on .inc-tab-badge{background:#0b7f8c}

/* GeneralListingsSection — "General" category at top of Inventory/Listings */
.gen-ls-section{background:rgba(255,255,255,.94);border:1px solid rgba(217,112,14,.28);border-left:5px solid #d9700e;border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.07);margin-bottom:16px}
.gen-ls-hdr{width:100%;display:flex;align-items:center;gap:10px;padding:13px 16px;background:linear-gradient(90deg,rgba(217,112,14,.06),rgba(217,112,14,.02));border:0;cursor:pointer;text-align:left;transition:background .14s}
.gen-ls-hdr:hover{background:rgba(217,112,14,.08)}
.gen-ls-icon{font-size:1.25rem;flex-shrink:0}
.gen-ls-hdr-body{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.gen-ls-label{font-family:'Playfair Display',serif;font-size:1rem;font-weight:900;color:#203f2b}
.gen-ls-sublabel{font-size:.74rem;color:#8a5000;font-weight:700}
.gen-ls-sublabel-ok{color:#2e7d32!important}
.gen-ls-badge{display:inline-flex;min-width:24px;height:24px;align-items:center;justify-content:center;border-radius:999px;background:#d9700e;color:#fff;font-size:.72rem;font-weight:900;padding:0 6px;flex-shrink:0}
.gen-ls-body{padding:12px 16px 16px;border-top:1px solid rgba(217,112,14,.14)}
.gen-ls-admin-banner{background:rgba(217,112,14,.09);border:1px solid rgba(217,112,14,.28);border-left:4px solid #d9700e;border-radius:10px;padding:10px 14px;font-size:.8rem;color:#7a3a00;line-height:1.5;font-weight:700}
.gen-ls-empty{padding:8px 4px;font-size:.8rem;color:#4a7060;font-weight:600}

/* Dashboard general incidents attention card */
.gen-attn-card{border-left:5px solid #d9700e!important}
.gen-attn-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.gen-attn-item{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;background:rgba(217,112,14,.05);border:1px solid rgba(217,112,14,.14);border-radius:10px}
.gen-attn-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.gen-attn-type{font-size:.72rem;font-weight:800;color:#496674}
.gen-attn-desc{font-size:.84rem;color:#17313a;line-height:1.4}
.gen-attn-meta{font-size:.7rem;color:#8a9fa5}

/* DashboardFocus orange accent card */
.dfc-orange .dfc-count{background:rgba(217,112,14,.12);color:#d9700e}
.dfc-orange.dfc-active{border-color:#d9700e!important;box-shadow:0 8px 22px rgba(217,112,14,.18)!important}
.dfc-orange.dfc-active .dfc-count{background:#d9700e;color:#fff}

`;