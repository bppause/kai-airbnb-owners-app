// CommunitySwitch — header dropdown for users belonging to more than
// one community. Returns null when there's only one (or none).
//
// Lifted byte-identical from App.jsx in stage F27. Pulls lang via
// useApp(); communities, currentId, onChange, loading stay per-instance.
//
// LanguageSwitch + GoogleIcon already moved in stage F23 because the
// auth gates needed them. CommunitySwitch lands here too so all three
// tiny shared shells live in core/ui/.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F27.

import React from "react";
import { useApp } from "../app-state";

export default function CommunitySwitch({ communities=[], currentId='', onChange=()=>{}, loading=false }) {
  const { lang } = useApp();
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
