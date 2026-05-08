// i18n loader — exposes the same names App.jsx used inline before stage F1
// so the call sites don't need to change.
//
// Locale data lives in es-CO.json and en.json. Per-module strings (e.g. the
// incident templates) live alongside their module: see
// client/src/modules/incidents/i18n/templates.json.
//
// `appText` (a separate richer system that pulls from APP_I18N + admin
// overrides) is not part of this loader; it stays in App.jsx for now and
// will move to its own helper in a later stage.

import esCO from './es-CO.json';
import en from './en.json';

export const TXT = { 'es-CO': esCO.txt, en: en.txt };
export const UI  = { 'es-CO': esCO.ui,  en: en.ui  };
export const I18N = en.translate;

export const LANGS = {
  'es-CO': { label: 'Español 🇨🇴', short: 'ES' },
  en:      { label: 'English 🇺🇸', short: 'EN' },
};

export const getT = (lang) => TXT[lang] || TXT['es-CO'];
export const ui   = (lang, key) => (UI[lang] || UI['es-CO'])[key] || UI['es-CO'][key] || key;
export const lt   = (lang, es) => lang === 'en' ? (I18N[es] || es) : es;
export const ltf  = (lang, es, en) => lang === 'en' ? (en || I18N[es] || es) : es;
