// WorkflowGroup — collapsible status section that contains a list of IRows.
// Headers show count + an "X need your action" badge when relevant.
//
// Lifted byte-identical from App.jsx in stage F15. Pulls user + lang via
// useApp() (`isEn` derived internally). The status / appearance config
// (statusKey, icon, label, color, sublabel), the filtered incidents +
// listings slice, and the IRow callbacks all stay as per-instance props.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F15.

import React from "react";
import { useApp } from "../../../core/app-state";
import IRow from "./IRow";

export default function WorkflowGroup({ statusKey, icon, label, sublabel, color, incidents, listings, isOpen, onToggle, contactProps, isGlobalAdmin, canUpdateGlobal, canDeleteGlobal, canResolveGlobal, onResolve, onDelete, onVerify, onAddResolution, onUnitDetail, onIncidentDetail, onAssign, onCloseGeneral, hideUnit = false }) {
  const { user, lang } = useApp();
  const isEn = lang === 'en';
  const count = incidents.length;
  const myActionCount = !user?.uid ? 0 : incidents.filter(inc => {
    const isMyListing = listings.find(l => l.id === inc.aptId)?.ownerUid === user.uid;
    const hasPendingRes = inc.status === 'verified' && !String(inc.ownerResolution || '').trim();
    return (inc.status === 'open' || hasPendingRes) && isMyListing;
  }).length;
  return (
    <div className={`wfg-section${statusKey === 'resolved' ? ' wfg-section-resolved' : ''}`}>
      <button className={`wfg-hdr${myActionCount > 0 ? ' wfg-hdr-urgent' : ''}`} style={{borderLeftColor: color}} onClick={onToggle}>
        <span className="wfg-icon">{icon}</span>
        <div className="wfg-hdr-body">
          <span className="wfg-label">{label}</span>
          {sublabel && <span className="wfg-sublabel">{sublabel}</span>}
        </div>
        {myActionCount > 0 && <span className="wfg-my-badge">{myActionCount} {isEn ? 'need your action' : 'necesitan tu acción'}</span>}
        <span className="wfg-badge" style={{background: color + '22', color}}>{count}</span>
        <span className={`fls-chev${isOpen ? ' fls-chev-up' : ''}`}>›</span>
      </button>
      {isOpen && (
        <div className="wfg-body">
          {count === 0
            ? <div className="wfg-empty">✓ {isEn ? 'None here' : 'Nada aquí'}</div>
            : incidents.map(inc => {
                const isMyListing = !!(user?.uid && listings.find(l => l.id === inc.aptId)?.ownerUid === user.uid);
                const hasPendingRes = inc.status === 'verified' && !String(inc.ownerResolution || '').trim();
                const actionNeeded = (inc.status === 'open' || hasPendingRes) && isMyListing;
                return <IRow key={inc.id} inc={inc} listings={listings} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canUpdateGlobal={canUpdateGlobal} canDeleteGlobal={canDeleteGlobal} canResolveGlobal={canResolveGlobal} onResolve={onResolve} onDelete={onDelete} onVerify={onVerify} onAddResolution={onAddResolution} onUnitDetail={onUnitDetail} onIncidentDetail={onIncidentDetail} onAssign={onAssign} onCloseGeneral={onCloseGeneral} hideUnit={hideUnit} actionNeeded={actionNeeded}/>;
              })
          }
        </div>
      )}
    </div>
  );
}
