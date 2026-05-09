// LanguageSwitch — bilingual ES/EN selector. Used by AuthGate, Registration-
// Gate, and the main app header. Lifted byte-identical from App.jsx in
// stage F23.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F23.

import React from "react";

export default function LanguageSwitch({ lang, setLang }) {
  return <select className="lang-switch" value={lang} onChange={e=>setLang(e.target.value)} aria-label="Language"><option value="es-CO">Español 🇨🇴</option><option value="en">English 🇺🇸</option></select>;
}
