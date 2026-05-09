// CommunityMissionView — top-level /about tab (mission + community rules).
// Renders the configured mission text, the 4-card grid, and two side-by-
// side rule lists (participation + access).
//
// Lifted byte-identical from App.jsx in stage F23. Pulls lang via useApp();
// config stays per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F23.

import React from "react";
import { useApp } from "../../../core/app-state";
import { getComplexName } from "../../../core/i18n/app-text";
import { localizeMissionSections } from "../../../core/i18n/mission";
import CommunityMissionCards from "../components/CommunityMissionCards";

export default function CommunityMissionView({ config={} }) {
  const { lang } = useApp();
  const m = localizeMissionSections(config, lang);
  return (
    <div className="fade">
      <div className="ph"><div><h1 className="ptitle">{m.title}</h1><p className="psub">{m.subtitle}</p></div></div>
      <div className="card mission-main">
        <div className="welcome-brand inline-brand">
          <img src={config?.complex_logo || '/morros-kai.png'} className="welcome-logo small" alt={config?.complex_name_es || config?.complex_name_en || getComplexName('es-CO')}/>
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
