// Mission/community-rules content + ES↔EN translation helpers.
//
// Used by:
//   - CommunityMissionCards / CommunityMissionView (auth gates)
//   - AdminSettings (mission editor) — reads parseMissionSections + the
//     defaults + MISSION_EN_DEFAULTS to seed the editor
//
// The translation table is built from the matching DEFAULT_MISSION_SECTIONS
// (Spanish) and MISSION_EN_DEFAULTS (English) entries; if an admin customizes
// only the Spanish copy, English readers fall through to the same string.
//
// Lifted byte-identical from App.jsx in stage F23.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F23.

export const DEFAULT_MISSION_SECTIONS = {
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

export const MISSION_EN_DEFAULTS = {
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

export const normalizeMissionSections = (m={}) => { const base={...DEFAULT_MISSION_SECTIONS,...(m&&typeof m==='object'?m:{})}; const dc=DEFAULT_MISSION_SECTIONS.cards; const cards=Array.isArray(base.cards)?base.cards.map((c,i)=>({icon:String((c&&typeof c==='object'?c.icon:undefined)??dc[i]?.icon??'•'),title:String((c&&typeof c==='object'?c.title:undefined)??dc[i]?.title??''),text:String((c&&typeof c==='object'?c.text:undefined)??dc[i]?.text??'')})):dc; const participationRules=Array.isArray(base.participationRules)?base.participationRules.map(x=>String(x??'')):DEFAULT_MISSION_SECTIONS.participationRules; const accessRules=Array.isArray(base.accessRules)?base.accessRules.map(x=>String(x??'')):DEFAULT_MISSION_SECTIONS.accessRules; return {...base,cards,participationRules,accessRules}; };

export const parseMissionSections = (config={}) => { try { return normalizeMissionSections(JSON.parse(config?.mission_sections_es || '{}') || {}); } catch { return normalizeMissionSections({}); } };

export const localizeMissionSections = (config={}, lang='es-CO') => {
  const es = parseMissionSections(config);
  if (lang !== 'en') return es;
  return { ...es, title:translateToEnglish(es.title), subtitle:translateToEnglish(es.subtitle), sectionLabel:translateToEnglish(es.sectionLabel), heading:translateToEnglish(es.heading), body:translateToEnglish(es.body), cards:(es.cards||[]).map(c=>({icon:c.icon,title:translateToEnglish(c.title),text:translateToEnglish(c.text)})), participationTitle:translateToEnglish(es.participationTitle), participationRules:(es.participationRules||[]).map(translateToEnglish), accessTitle:translateToEnglish(es.accessTitle), accessRules:(es.accessRules||[]).map(translateToEnglish) };
};
