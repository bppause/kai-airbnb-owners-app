// Tiny i18n for the tax module.
// - Two locale bundles (en, es) loaded statically.
// - Locale resolution: localStorage → browser Accept-Language → 'en'.
// - useT() returns t(key, vars?) and the active locale + setter.
// - Owner-authored content (product names, descriptions, tagline) is stored as
//   {en, es} JSONB on the server; pickI18n() does fallback to en when es missing.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.json';
import es from './es.json';

const BUNDLES = { en, es };
const STORAGE_KEY = 'tax_locale';

export function detectInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch (_e) {}
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function format(str, vars) {
  if (!vars) return str;
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

const TaxLocaleContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function TaxLocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(detectInitialLocale);

  const setLocale = useCallback((next) => {
    if (next !== 'en' && next !== 'es') return;
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_e) {}
    try { document.documentElement.lang = next; } catch (_e) {}
  }, []);

  useEffect(() => {
    try { document.documentElement.lang = locale; } catch (_e) {}
  }, [locale]);

  const t = useCallback((key, vars) => {
    const bundle = BUNDLES[locale] || BUNDLES.en;
    const raw = (key in bundle) ? bundle[key] : (key in BUNDLES.en ? BUNDLES.en[key] : key);
    return format(raw, vars);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <TaxLocaleContext.Provider value={value}>{children}</TaxLocaleContext.Provider>;
}

export function useT() {
  return useContext(TaxLocaleContext);
}

// Pick a localized string from a {en, es} JSONB field with English fallback.
// Returns { value, missing } so callers can show a "needs translation" badge
// in admin UIs (Phase 4).
export function pickI18n(field, locale) {
  const obj = (field && typeof field === 'object') ? field : {};
  const v = obj[locale];
  if (typeof v === 'string' && v.trim()) return { value: v, missing: false };
  const fallback = obj.en;
  if (typeof fallback === 'string' && fallback.trim()) return { value: fallback, missing: locale !== 'en' };
  return { value: '', missing: true };
}
