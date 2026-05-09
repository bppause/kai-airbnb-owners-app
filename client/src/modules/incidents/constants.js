// Incident type + guest-category reference data.
// Lifted byte-identical from App.jsx in stage F11. Used by the new-incident
// form, the row component, the workflow group headers, and any place that
// needs to color-code or label an incident.
//
// Labels here are the Spanish defaults; localized labels at render time
// come through incidentTypeLabel / categoryLabel from core/i18n/app-text.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F11.

export const INCIDENT_TYPES = [
  { value:"noise",        label:"🔊 Ruido excesivo",           color:"#e65100", bg:"#fff3e0" },
  { value:"damage",       label:"💥 Daños al apartamento",     color:"#c62828", bg:"#fde8e4" },
  { value:"rules",        label:"📋 Incumplimiento de normas", color:"#6a1b9a", bg:"#f3e5f5" },
  { value:"payment",      label:"💳 Problemas de pago",        color:"#1565c0", bg:"#e3f2fd" },
  { value:"unauthorized", label:"🚫 Personas no autorizadas",  color:"#bf360c", bg:"#fbe9e7" },
  { value:"cleanliness",  label:"🧹 Suciedad / limpieza",      color:"#558b2f", bg:"#f1f8e9" },
  { value:"other",        label:"❓ Otro",                     color:"#37474f", bg:"#eceff1" },
];

export const GUEST_CATEGORIES = [
  { value:"serious", label:"Incidente Grave",  icon:"⚠️", color:"#e65100", bg:"#ffe0b2" },
  { value:"watch",   label:"En Observación",   icon:"👁️", color:"#4527a0", bg:"#ede7f6" },
  { value:"minor",   label:"Incidente Menor",  icon:"📝", color:"#1565c0", bg:"#bbdefb" },
];
