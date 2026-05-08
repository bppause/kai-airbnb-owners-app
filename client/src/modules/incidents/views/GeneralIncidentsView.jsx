// General incidents view — building/community-wide incidents not tied to a
// specific unit.
//
// First view extracted from App.jsx in stage F7. Demonstrates the target
// pattern: a module-scoped view that pulls shared data via useApp() and
// receives only its presentation flag + action callbacks as props.
//
// Body lifted byte-identical from App.jsx (the previous inline definition).
// Three previously-unused props (listings, user, contactProps) were dropped
// because the body never referenced them.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F7.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { fmtDate } from "../../../core/utils";
import { incidentTypeLabel, categoryLabel } from "../../../core/i18n/app-text";
import { EmptyState } from "../../../core/ui/EmptyState";

export default function GeneralIncidentsView({
  canResolveGlobal = false,
  onIncidentDetail = null,
  onAssign,
  onClose: onCloseGeneral,
  embedded = false,
}) {
  const { incidents, lang, effectiveIsGlobalAdmin: isGlobalAdmin } = useApp();
  const isEn = lang === 'en';
  const general = incidents.filter(i => i.isGeneral).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const open = general.filter(i => i.status !== 'resolved');
  const closed = general.filter(i => i.status === 'resolved');
  const [showClosed, setShowClosed] = useState(false);
  const canAct = isGlobalAdmin || canResolveGlobal;
  const inner = (
    <>
      <div className="gen-info-banner">
        {isEn
          ? '📢 General incidents affect the building or community and are not specific to one unit. Anyone can report them. Admins can assign them to a unit (switching to normal workflow) or close them directly.'
          : '📢 Los incidentes generales afectan el edificio o la comunidad y no están vinculados a una unidad específica. Cualquier usuario puede reportarlos. Los admins pueden asignarlos a una unidad (flujo normal) o cerrarlos directamente.'}
      </div>

      {open.length===0 && <EmptyState icon="✅" title={isEn?'No open general incidents':'Sin incidentes generales abiertos'} sub={isEn?'All community incidents have been addressed.':'Todos los incidentes de la comunidad han sido atendidos.'}/>}

      {open.length>0&&<div className="gen-list">
        {open.map(inc=>(
          <div key={inc.id} className={`gen-card${inc.status==='resolved'?' gen-card-closed':''}`}>
            <div className="gen-card-header">
              <span className={`gen-card-status-dot ${inc.status==='open'?'gen-dot-open':'gen-dot-wait'}`}/>
              <span className="gen-card-type">{incidentTypeLabel(inc.type,lang)}</span>
              <span className="gen-card-cat">{categoryLabel(inc.category,lang)}</span>
              <span className="gen-card-date">📅 {fmtDate(inc.date)}</span>
              {(()=>{
                const now = new Date();
                const deadline = inc.nextSlaReminderAt ? new Date(inc.nextSlaReminderAt) : null;
                const hoursLeft = deadline ? Math.round((deadline - now) / 3600000) : null;
                if (inc.slaCycleCount > 0 && hoursLeft !== null && hoursLeft < 0) {
                  return <span className="gen-card-sla gen-card-sla-breach">🔴 SLA {isEn?'overdue':'vencido'} ×{inc.slaCycleCount}</span>;
                }
                if (inc.slaCycleCount > 0) return <span className="gen-card-sla">⏱️ ×{inc.slaCycleCount}</span>;
                if (hoursLeft !== null && hoursLeft <= 4 && hoursLeft >= 0) return <span className="gen-card-sla gen-card-sla-urgent">🟠 {isEn?`${hoursLeft}h`:`${hoursLeft}h`}</span>;
                return null;
              })()}
              {onIncidentDetail&&<button className="ir-detail-pill" onClick={()=>onIncidentDetail(inc.id)}>{isEn?'Details':'Detalles'} ›</button>}
            </div>
            <p className="gen-card-desc">{inc.desc}</p>
            {inc.reporterName&&<div className="gen-card-reporter">📋 {isEn?'Reported by':'Reportado por'}: {inc.reporterName}</div>}
            {Array.isArray(inc.photos)&&inc.photos.length>0&&(
              <div className="inc-photo-row">
                {inc.photos.map((p,i)=><img key={i} src={p.data} alt={p.name||`photo-${i+1}`} className="inc-photo-thumb" onClick={()=>window.open(p.data,'_blank')}/>)}
              </div>
            )}
            {canAct&&inc.status!=='resolved'&&(
              <div className="gen-card-acts">
                <button className="btn-p bsm" onClick={()=>onAssign&&onAssign(inc)}>🏠 {isEn?'Assign to unit':'Asignar a unidad'}</button>
                <button className="btn-ghost bsm" onClick={()=>onCloseGeneral&&onCloseGeneral(inc)}>✓ {isEn?'Close directly':'Cerrar directamente'}</button>
              </div>
            )}
          </div>
        ))}
      </div>}

      {closed.length>0&&(
        <div style={{marginTop:16}}>
          <button className="btn-ghost bsm" onClick={()=>setShowClosed(s=>!s)}>
            {showClosed?(isEn?'▲ Hide closed':'▲ Ocultar cerrados'):(isEn?`▼ Show ${closed.length} closed`:`▼ Ver ${closed.length} cerrados`)}
          </button>
          {showClosed&&<div className="gen-list" style={{marginTop:8,opacity:.75}}>
            {closed.map(inc=>(
              <div key={inc.id} className="gen-card gen-card-closed">
                <div className="gen-card-header">
                  <span className="gen-card-status-dot gen-dot-closed"/>
                  <span className="gen-card-type">{incidentTypeLabel(inc.type,lang)}</span>
                  <span className="gen-card-date">📅 {fmtDate(inc.date)}</span>
                  {onIncidentDetail&&<button className="ir-detail-pill" onClick={()=>onIncidentDetail(inc.id)}>{isEn?'Details':'Detalles'} ›</button>}
                </div>
                <p className="gen-card-desc">{inc.desc}</p>
                {inc.resolutionComments&&<div className="gen-card-resolution">✓ {inc.resolutionComments}</div>}
              </div>
            ))}
          </div>}
        </div>
      )}
    </>
  );
  return embedded ? inner : (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">📢 {isEn?'General Incidents':'Incidentes Generales'}</h1>
          <p className="psub">{isEn?`Community-wide incidents not tied to a specific unit · ${open.length} open`:`Incidentes de la comunidad no asociados a una unidad · ${open.length} abiertos`}</p>
        </div>
      </div>
      {inner}
    </div>
  );
}
