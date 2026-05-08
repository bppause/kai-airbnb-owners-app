// CommunityMissionCards — 4-card grid summarizing the community mission.
// Used inline by AuthGate (compact mode) and CommunityMissionView (full).
//
// Lifted byte-identical from App.jsx in stage F23.

import React from "react";
import { localizeMissionSections } from "../../../core/i18n/mission";

export default function CommunityMissionCards({ compact=false, lang="es-CO", config={} }) {
  const m = localizeMissionSections(config, lang);
  const items = (m.cards || []).map(x=>({icon:x.icon,title:x.title,text:x.text}));
  return <div className={compact ? 'mission-grid mission-grid-compact' : 'mission-grid'}>{items.map((x,i)=><div key={i} className="mission-card"><div className="mission-icon">{x.icon}</div><div><h3>{x.title}</h3><p>{x.text}</p></div></div>)}</div>;
}
