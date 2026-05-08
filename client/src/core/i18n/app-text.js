// Application text / labels (the richer i18n system).
//
// Different from the simple TXT/UI/I18N exports in ./index.js — that one is
// a per-screen string bundle. This one is keyed by dotted "namespace.key"
// (e.g. "dashboard.title", "form.cancel") with admin-editable overrides
// stored in `community_config.ui_labels_*`. Every view in App.jsx reads
// labels through appText(lang, key, vars).
//
// State lives at module scope:
//   _customLabels — admin overrides per language
//   _complexName  — current community display name + tower
//
// App.jsx (or any future caller) updates these via setCustomLabels(cfg)
// when admin config changes. Module-scope state is fine here because ESM
// modules are singletons — every consumer gets the same _customLabels
// without ceremony.
//
// Lifted byte-identical from App.jsx in stage F6. The 271-entry APP_I18N
// data block moved into ./app-strings.json.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F6.

import APP_I18N from "./app-strings.json";
import { parseJsonObject } from "../utils";

// Re-export so callers (e.g. App.jsx's DEFAULT_TOOLTIPS) can read raw
// entries without going through the appText() lookup chain.
export { APP_I18N };

let _customLabels = { es: {}, en: {} };
let _complexName = { es:'Propietarios Airbnb KAI', en:'KAI Airbnb Owners', tower:'KAI' };

export const setCustomLabels = (cfg={}) => {
  cfg = cfg || {};
  try { _customLabels.es = JSON.parse(cfg.ui_labels_es || '{}') || {}; } catch(e) { _customLabels.es = {}; }
  try { _customLabels.en = JSON.parse(cfg.ui_labels_en || '{}') || {}; } catch(e) { _customLabels.en = {}; }
  _complexName.es = cfg.complex_name_es || 'Propietarios Airbnb KAI';
  _complexName.en = cfg.complex_name_en || 'KAI Airbnb Owners';
  _complexName.tower = cfg.community_tower || 'KAI';
};

export const getDefaultTower = () => _complexName.tower || 'KAI';

// Resolve the current complex display name for either language. Auth/mission
// views fall back to this when the per-render config doesn't provide one.
export const getComplexName = (lang='es-CO') => {
  const langKey = lang === 'en' ? 'en' : 'es';
  return _complexName[langKey] || _complexName.es;
};

export const appText = (lang, key, vars={}) => {
  const langKey = lang === 'en' ? 'en' : 'es';
  // Custom admin override takes priority over built-in defaults
  const custom = _customLabels[langKey]?.[key] ?? _customLabels['es']?.[key];
  const v = custom ?? (APP_I18N[key]?.[langKey]) ?? APP_I18N[key]?.es ?? key;
  // Auto-inject {complex} and {tower} from community config so i18n strings stay generic
  const merged = { complex: _complexName[langKey] || _complexName.es, tower: _complexName.tower, ...vars };
  return String(v).replace(/\{(\w+)\}/g, (_,k)=> merged[k] ?? '');
};

export const aptDisplay = (apt, lang='es-CO') => `${appText(lang,'listing.apt')} ${apt || ''}`.trim();
export const incidentTypeLabel = (value, lang='es-CO') => appText(lang, `incidentType.${value || 'other'}`);
export const categoryLabel = (value, lang='es-CO') => appText(lang, `category.${value || 'minor'}`);

// ─── Tooltips (extracted in stage F10) ───────────────────────────────────────
// Default tooltip strings come from APP_I18N entries keyed `tooltip.*`. The
// admin can override each in community_config.tooltips_es / tooltips_en.

export const DEFAULT_TOOLTIPS = {
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

export const localizedTooltips = (config={}, lang='es-CO') => {
  const esOverrides = parseJsonObject(config?.tooltips_es, {});
  const enOverrides = parseJsonObject(config?.tooltips_en, {});
  const isEn = lang === 'en';
  const out = {};
  Object.keys(DEFAULT_TOOLTIPS).forEach(k => { out[k] = (isEn ? enOverrides[k] : esOverrides[k]) || DEFAULT_TOOLTIPS[k][isEn ? 'en' : 'es'] || ''; });
  return out;
};
