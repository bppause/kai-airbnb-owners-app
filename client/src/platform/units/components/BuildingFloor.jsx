// BuildingFloor — collapsible per-floor section in ListingsView's
// building mode. Header shows floor number + counts (units, open
// incidents, verified pending resolution, awaiting admin, closed).
// Body renders an AptDoor grid; clicking a unit's number plate opens
// a UnitDetailCard overlay that lets the user drill from unit info
// → incidents list → incident detail.
//
// Lifted byte-identical from App.jsx in stage F30. Pulls lang via
// useApp() (isEn derived internally — both `lang` and `isEn` were
// previously redundant props). Other props (floor, apts, incidents,
// user, contactProps, perm flags, callbacks, isOpen, onToggle) stay
// per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F30.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { floorColor } from "../../../core/utils";
import Overlay from "../../../core/ui/Overlay";
import AptDoor from "./AptDoor";
import UnitDetailCard from "./UnitDetailCard";

export default function BuildingFloor({ floor, apts, incidents, user, contactProps, isGlobalAdmin, canEditGlobal, canDeleteGlobal, canResolveGlobal, onEdit, onDelete, onReport, onVerify, onResolve, onAddResolution, onFloorFilter, isOpen, onToggle }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [unitDetailAptId, setUnitDetailAptId] = useState(null);
  const [unitDetailStep, setUnitDetailStep] = useState('info');
  const color = floorColor(floor);
  const floorInc       = incidents.filter(i=>apts.some(l=>l.id===i.aptId));
  const openCount      = floorInc.filter(i=>i.status==='open').length;
  const verPendingRes  = floorInc.filter(i=>i.status==='verified'&&!String(i.ownerResolution||'').trim()).length;
  const verAwaiting    = floorInc.filter(i=>i.status==='verified'&& String(i.ownerResolution||'').trim()).length;
  const resCount       = floorInc.filter(i=>i.status==='resolved').length;
  return (
    <div className="bld-floor">
      <button className="bld-floor-hdr" style={{borderLeftColor:color}} onClick={onToggle}>
        <div className="bld-floor-id">
          <span className="bld-floor-level">{isEn?'FLOOR':'PISO'}</span>
          <span className="bld-floor-num" style={{color}}>{floor}</span>
        </div>
        <div className="bld-floor-stats">
          <span className="bld-stat-pill bld-stat-apts" title={isEn?`${apts.length} unit${apts.length===1?'':'s'} on this floor`:`${apts.length} unidad${apts.length===1?'':'es'} en este piso`}>🏠 {apts.length} {isEn?(apts.length===1?'apt':'apts'):'apto'+(apts.length>1?'s':'')}</span>
          {openCount>0     && <button type="button" className="bld-stat-pill bld-stat-inc bld-stat-btn" title={isEn?`${openCount} open — Step 1: verify required · click to filter`:`${openCount} abierto${openCount>1?'s':''} — Paso 1: verificación requerida`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'open'});}}>⚠️ {openCount} {isEn?'verify':'verificar'}</button>}
          {verPendingRes>0 && <button type="button" className="bld-stat-pill bld-stat-ver bld-stat-btn" title={isEn?`${verPendingRes} verified — Step 2: add resolution · click to filter`:`${verPendingRes} verificado${verPendingRes>1?'s':''} — Paso 2: agregar resolución`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'pendingResolution'});}}>📝 {verPendingRes} {isEn?'add res.':'resolución'}</button>}
          {verAwaiting>0   && <button type="button" className="bld-stat-pill bld-stat-ver bld-stat-btn" style={{background:'rgba(11,127,79,.08)',color:'#0b5f3a',borderColor:'rgba(11,127,79,.2)'}} title={isEn?`${verAwaiting} awaiting admin review · click to filter`:`${verAwaiting} esperando revisión del admin`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'awaitingAdmin'});}}>⏳ {verAwaiting} {isEn?'admin':'admin'}</button>}
          {resCount>0      && <button type="button" className="bld-stat-pill bld-stat-res bld-stat-btn" title={isEn?`${resCount} closed · click to filter`:`${resCount} cerrado${resCount>1?'s':''}`} onClick={e=>{e.stopPropagation();onFloorFilter&&onFloorFilter({aptIds:apts.map(a=>a.id),status:'resolved'});}}>✓ {resCount} {isEn?'closed':'cerrados'}</button>}
        </div>
        <span className={`bld-chev${isOpen?' bld-chev-up':''}`}>›</span>
      </button>

      {isOpen && (
        <div className="bld-floor-body">
          <div className="bld-door-grid">
            {apts.map(l=>(
              <AptDoor
                key={l.id}
                l={l}
                incidents={incidents}
                onUnitDetail={id=>{setUnitDetailAptId(id);setUnitDetailStep('info');}}
                onViewIncidents={id=>{setUnitDetailAptId(id);setUnitDetailStep('incidents');}}
                onPillFilter={f=>{onFloorFilter&&onFloorFilter(f);}}
              />
            ))}
          </div>
        </div>
      )}
      {/* Unit detail overlay — opens on number plate click; incidents expand inside */}
      {unitDetailAptId && (() => {
        const udApt = apts.find(l=>l.id===unitDetailAptId);
        if (!udApt) return null;
        return (
          <Overlay onClose={()=>{setUnitDetailAptId(null);setUnitDetailStep('info');}} wide>
            <UnitDetailCard
              key={`${udApt.id}-${unitDetailStep}`}
              l={udApt}
              incidents={incidents}
              canEdit={user?.uid===udApt.ownerUid||isGlobalAdmin||canEditGlobal}
              canDelete={user?.uid===udApt.ownerUid||isGlobalAdmin||canDeleteGlobal}
              onEdit={()=>{setUnitDetailAptId(null);onEdit(udApt);}}
              onDelete={()=>{setUnitDetailAptId(null);onDelete(udApt);}}
              onReport={()=>{setUnitDetailAptId(null);onReport(udApt);}}
              user={user}
              contactProps={contactProps}
              isGlobalAdmin={isGlobalAdmin}
              canResolveGlobal={canResolveGlobal}
              onVerify={onVerify}
              onResolve={onResolve}
              onAddResolution={onAddResolution}
              defaultStep={unitDetailStep}
            />
          </Overlay>
        );
      })()}
    </div>
  );
}
