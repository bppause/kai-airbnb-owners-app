// AptDoor — large "apartment door" card used in the building view. Shows
// status colour bar (clean / warn / alert), the unit number plate, owner
// + operator names, room/guest chips, incident-count pills (filterable),
// a hover contact popup, and a footer button that opens the per-unit
// incidents popup.
//
// Co-located helper:
//   aptDoorStatus(listing, incidents) — derives 'clean' | 'warn' | 'alert'
//                                        from open incidents on the unit.
//
// Lifted byte-identical from App.jsx in stage F28. Pulls lang via
// useApp() (isEn derived internally — both `lang` and `isEn` were
// previously redundant props). Other props (l, incidents, callbacks)
// stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F28.

import React from "react";
import { useApp } from "../../../core/app-state";
import { getDefaultTower } from "../../../core/i18n/app-text";
import UnitPlate from "./UnitPlate";
import AptContactPopup from "./AptContactPopup";

export function aptDoorStatus(l, incidents) {
  const open = incidents.filter(i=>i.aptId===l.id&&i.status==='open');
  if (open.some(i=>i.category==='serious')) return 'alert';
  if (open.length>0) return 'warn';
  return 'clean';
}

export default function AptDoor({ l, incidents, onUnitDetail, onViewIncidents, onPillFilter }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const status = aptDoorStatus(l, incidents);
  const aptInc         = incidents.filter(i => i.aptId === l.id);
  const openCount      = aptInc.filter(i => i.status === 'open').length;
  const pendingResCount= aptInc.filter(i => i.status === 'verified' && !String(i.ownerResolution||'').trim()).length;
  const awaitingCount  = aptInc.filter(i => i.status === 'verified' &&  String(i.ownerResolution||'').trim()).length;
  const resolvedCount  = aptInc.filter(i => i.status === 'resolved').length;
  const totalCount     = aptInc.length;
  const ownerEmail = l.userEmail || l.email || '';
  const ownerWaRaw = l.contact || '';
  return (
    <div className={`apt-door apt-door-${status} apt-cpop-wrap`}>
      {/* Status colour bar */}
      <div className={`door-status-bar door-sb-${status}`}/>

      {/* ★ CLICKABLE: Number plate — uses UnitPlate for consistent style */}
      <UnitPlate
        apt={l.apt}
        tower={l.tower||getDefaultTower()}
        size="door"
        onClick={()=>onUnitDetail&&onUnitDetail(l.id)}
        title={isEn?'View unit details':'Ver detalles de la unidad'}
        className="door-num-plate door-num-plate-btn"
      />

      {/* Display-only card body — hover reveals contact popup */}
      <div className="door-body">
        <div className="door-owner" title={l.owner}>{l.owner||'—'}</div>
        {l.operator&&<div className="door-op" title={l.operator}>🔧 {l.operator}</div>}
        <div className="door-chips">
          <span className="door-chip">🛏️ {l.rooms}</span>
          <span className="door-chip">👥 {l.guests}</span>
        </div>
      </div>

      {/* ★ CLICKABLE: Incident count pills → navigate to filtered incidents */}
      <div className="door-inc-summary">
        {totalCount===0
          ? <span className="dis-clean">✅ {isEn?'No incidents':'Sin incidentes'}</span>
          : <>
              {openCount>0      &&<button type="button" className="dis-pill dis-open"        onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'open'})}          title={isEn?`${openCount} open — click to filter`:`${openCount} abierto${openCount>1?'s':''} — clic para filtrar`}>⚠️ {openCount}</button>}
              {pendingResCount>0&&<button type="button" className="dis-pill dis-pending-res" onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'pendingResolution'})} title={isEn?`${pendingResCount} add resolution — click to filter`:`${pendingResCount} agregar resolución — clic para filtrar`}>📝 {pendingResCount}</button>}
              {awaitingCount>0  &&<button type="button" className="dis-pill dis-ver"         onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'awaitingAdmin'})}  title={isEn?`${awaitingCount} awaiting admin — click to filter`:`${awaitingCount} esperando admin — clic para filtrar`}>⏳ {awaitingCount}</button>}
              {resolvedCount>0  &&<button type="button" className="dis-pill dis-res"         onClick={()=>onPillFilter&&onPillFilter({aptIds:[l.id],status:'resolved'})}      title={isEn?`${resolvedCount} closed — click to filter`:`${resolvedCount} cerrado${resolvedCount>1?'s':''} — clic para filtrar`}>✓ {resolvedCount}</button>}
            </>
        }
      </div>

      {/* Contact popup — hover only, not a click target */}
      <AptContactPopup ownerName={l.owner} ownerEmail={ownerEmail} ownerWaRaw={ownerWaRaw} operatorName={l.operator} operatorEmail={l.operatorEmail} opWaRaw={l.operatorWhatsapp} coOwners={l.coOwners||[]}/>

      {/* ★ CLICKABLE: Footer → open incident popup for this unit */}
      <button
        type="button"
        className="door-footer door-footer-btn"
        onClick={()=>onViewIncidents&&onViewIncidents(l.id)}
        title={isEn?'View incidents for this unit':'Ver incidentes de esta unidad'}
      >
        👆 {isEn?'View incidents':'Ver incidentes'}
      </button>
    </div>
  );
}
