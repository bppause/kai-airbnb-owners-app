// IRow — single-incident row used by IncidentsView (and embeds inside
// WorkflowGroup, MyListings dashboard cards, the dashboard recent-reports
// feed, etc.).
//
// Lifted byte-identical from App.jsx in stage F14. Pulls `user` and `lang`
// via useApp() (matches the F7+ pattern); listings + contactProps + the
// permission flags + all action callbacks stay as per-instance props
// because parents pass module-specific filters and handlers.
//
// All sub-component dependencies are now extracted:
//   - UnitMiniCard from platform/units (F12)
//   - UserContact from core/contacts (F13)
//   - INCIDENT_TYPES + GUEST_CATEGORIES from incidents/constants (F11)
//   - normalizeOwnerGuests, slaResInfo, fmtDate from core/utils (F2/F7)
//   - appText, incidentTypeLabel, categoryLabel from core/i18n/app-text (F6)
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F14.

import React from "react";
import { useApp } from "../../../core/app-state";
import { normalizeOwnerGuests, slaResInfo, fmtDate } from "../../../core/utils";
import { appText, incidentTypeLabel, categoryLabel } from "../../../core/i18n/app-text";
import UnitMiniCard from "../../../platform/units/components/UnitMiniCard";
import UserContact from "../../../core/contacts";
import { INCIDENT_TYPES, GUEST_CATEGORIES } from "../constants";

export default function IRow({ inc, listings = [], contactProps = {}, isGlobalAdmin = false, canUpdateGlobal = false, canDeleteGlobal = false, canResolveGlobal = false, onResolve, onDelete, onVerify, onAddResolution, onUnitDetail, onIncidentDetail, onAssign, onCloseGeneral, compact, naughtyMode, hideUnit = false, actionNeeded = false }) {
  const { user, lang } = useApp();
  const listing    = listings.find(l => l.id === inc.aptId);
  const isOwner    = Boolean(user?.uid && listing?.ownerUid === user.uid);
  const isReporter = Boolean(user?.uid && inc.reporterUid === user.uid);
  const guests     = normalizeOwnerGuests(inc);
  const ti = INCIDENT_TYPES.find(t => t.value === inc.type) || INCIDENT_TYPES[6];
  const ci = GUEST_CATEGORIES.find(c => c.value === inc.category);
  const isEn       = lang === 'en';
  const hasDetail  = !!onIncidentDetail;
  const hasPendingRes = inc.status === 'verified' && !String(inc.ownerResolution || '').trim();

  // Status strip config — matches idd-status-banner colours
  const statusMeta = inc.status === 'resolved'
    ? { cls:'ir-ss-resolved', icon:'✓',  label: isEn?'Closed':'Cerrado' }
    : inc.isGeneral && inc.status === 'open'
    ? { cls:'ir-ss-general',  icon:'📢', label: isEn?'General — Admin action needed':'General — Acción del admin requerida' }
    : inc.status === 'open'
    ? { cls:'ir-ss-open',     icon:'⚠️', label: isEn?'Open — verify required':'Abierto — verificación requerida' }
    : hasPendingRes
    ? { cls:'ir-ss-pres',     icon:'📝', label: isEn?'Verified — resolution needed':'Verificado — falta respuesta' }
    : { cls:'ir-ss-wait',     icon:'⏳', label: isEn?'Awaiting admin close':'En espera del admin' };

  return (
    <div className={`irow irow-card${naughtyMode?' irow-naughty':''}${actionNeeded?' irow-action-needed':''}`}>
      {/* ── Left sidebar: unit card + reporter context ── */}
      <div className="ir-l">
        {!hideUnit && (inc.isGeneral
          ? <div className="ir-apt-context"><div className="ir-apt ir-apt-general">📢 {isEn?'General':'General'}</div><div className="ir-apt-sub">{isEn?'Community — no unit':'Comunidad — sin unidad'}</div></div>
          : listing
            ? <UnitMiniCard listing={listing} onUnitDetail={onUnitDetail} isEn={isEn}/>
            : <div className="ir-apt-context"><div className="ir-apt">{inc.aptLabel}</div></div>
        )}
        {hideUnit && <div className="ir-apt-context"><div className="ir-apt">{inc.isGeneral?'📢 General':inc.aptLabel}</div></div>}
        {user&&(isReporter||isOwner)&&(
          <div className="ir-ctx-tags">
            {isReporter&&isOwner&&<span className="inc-ctx-tag inc-ctx-reporter">{isEn?'📋 I reported · my listing':'📋 Yo reporté · mi listing'}</span>}
            {isReporter&&!isOwner&&<span className="inc-ctx-tag inc-ctx-reporter">{isEn?'📋 I reported':'📋 Yo reporté'}</span>}
            {!isReporter&&isOwner&&<span className="inc-ctx-tag inc-ctx-mine">{isEn?'🏠 My listing':'🏠 Mi listing'}</span>}
          </div>
        )}
      </div>

      {/* ── Main content card ── */}
      <div className="ir-main">
        {/* Status strip + type/category chips + date + view details */}
        <div className={`ir-status-strip ${statusMeta.cls}`}>
          <span className="ir-ss-icon">{statusMeta.icon}</span>
          <span className="ir-ss-label">{statusMeta.label}</span>
          <div className="ir-ss-chips">
            <span className="ir-type" style={{background:ti.bg,color:ti.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px',fontWeight:700}}>{incidentTypeLabel(ti.value,lang)}</span>
            {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px'}}>{ci.icon} {categoryLabel(ci.value,lang)}</span>}
            {(()=>{
              if (hasPendingRes) {
                const sla = slaResInfo(inc);
                if (!sla) return null;
                if (sla.isBreached) return <span className="ir-sla-chip ir-sla-breached">🔴 {isEn?`${Math.abs(sla.hoursLeft)}h overdue`:`${Math.abs(sla.hoursLeft)}h retraso`}</span>;
                if (sla.hoursLeft<=4) return <span className="ir-sla-chip ir-sla-urgent">🟠 {isEn?`Due in ${sla.hoursLeft}h`:`Vence en ${sla.hoursLeft}h`}</span>;
                if (sla.cycleCount>0) return <span className="ir-sla-chip ir-sla-reminded">⏱️ {sla.cycleCount} {isEn?`reminder${sla.cycleCount>1?'s':''}`:`recordatorio${sla.cycleCount>1?'s':''}`}</span>;
                return <span className="ir-sla-chip">⏰ {isEn?`${sla.hoursLeft}h left`:`${sla.hoursLeft}h restantes`}</span>;
              }
              return inc.slaCycleCount>0 ? <span className="ir-sla-chip ir-sla-reminded">⏱️ SLA ×{inc.slaCycleCount}</span> : null;
            })()}
            <span className="ir-ss-date">📅 {fmtDate(inc.date)}</span>
          </div>
          {actionNeeded&&(
            <span className="ir-ss-action-mine">
              {isEn?'⚡ Your action':'⚡ Tu acción'}
            </span>
          )}
          {/* General incident quick actions — admin only */}
          {inc.isGeneral && (isGlobalAdmin||canResolveGlobal) && inc.status!=='resolved' && (
            <>
              <button type="button" className="ir-ss-act ir-ss-act-assign"
                onClick={e=>{e.stopPropagation();onAssign&&onAssign(inc);}}>
                🏠 {isEn?'Assign to unit':'Asignar a unidad'}
              </button>
              <button type="button" className="ir-ss-act ir-ss-act-close-gen"
                onClick={e=>{e.stopPropagation();onCloseGeneral&&onCloseGeneral(inc);}}>
                ✓ {isEn?'Close':'Cerrar'}
              </button>
            </>
          )}
          {/* Quick-action buttons — shown whenever owner action is required */}
          {user&&inc.status==='open'&&isOwner&&(
            <button type="button" className="ir-ss-act ir-ss-act-verify"
              onClick={e=>{e.stopPropagation();onVerify&&onVerify(inc);}}
              title={isEn?'Step 1: Verify guest details and document your action':'Paso 1: Verificar datos del huésped y documentar acción'}>
              ① {isEn?'Verify':'Verificar'}
            </button>
          )}
          {user&&inc.status==='verified'&&isOwner&&hasPendingRes&&(
            <button type="button" className="ir-ss-act ir-ss-act-resolve"
              onClick={e=>{e.stopPropagation();onAddResolution&&onAddResolution(inc);}}
              title={isEn?'Step 2: Add your resolution so admin can close':'Paso 2: Agrega tu respuesta para que el admin pueda cerrar'}>
              ② {isEn?'Add resolution':'Agregar respuesta'}
            </button>
          )}
          {user&&(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes&&(
            <button type="button" className="ir-ss-act ir-ss-act-close"
              onClick={e=>{e.stopPropagation();onResolve&&onResolve(inc.id);}}>
              {isEn?'Close':'Cerrar'}
            </button>
          )}
          {hasDetail&&(
            <button type="button" className="ir-detail-pill" onClick={()=>onIncidentDetail(inc.id)}>
              {isEn?'Details':'Detalles'} ›
            </button>
          )}
        </div>

        <div className="ir-body">
          {inc.desc&&<p className="ir-body-desc">{inc.desc}</p>}
          {/* ── Parties — reporter + owner always visible ── */}
          {compact?(
            <div className="ir-bparty-compact">
              {inc.reporterName&&<span className="ir-bpc-item" title={isEn?'Reporter':'Reportado por'}>📋 {inc.reporterName}</span>}
              {listing&&<span className="ir-bpc-item" title={isEn?'Owner':'Propietario'}>🏠 {listing.owner||listing.userEmail||'—'}</span>}
            </div>
          ):(
            <div className="ir-body-parties">
              <span className="ir-bparty">
                <span className="ir-bparty-lbl">📋 {isEn?'Reporter':'Reportado por'}</span>
                <UserContact name={inc.reporterName||'—'} uid={inc.reporterUid||''} {...contactProps}/>
              </span>
              {listing&&(
                <span className="ir-bparty">
                  <span className="ir-bparty-lbl">🏠 {isEn?'Owner':'Propietario'}</span>
                  <UserContact name={listing.owner||listing.userEmail||'—'} uid={listing.ownerUid||''} email={listing.userEmail||listing.email||''} whatsapp={listing.contact||''} {...contactProps}/>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Action footer — mirrors idd-actions ── */}
        {!compact&&user&&(
          <div className="ir-footer-acts">
            {/* General incident footer actions */}
            {inc.isGeneral && (isGlobalAdmin||canResolveGlobal) && inc.status!=='resolved' && (
              <>
                <button className="btn-p ir-act-btn" onClick={()=>onAssign&&onAssign(inc)}>
                  🏠 {isEn?'Assign to unit — owner will be notified':'Asignar a unidad — propietario recibirá aviso'}
                </button>
                <button className="btn-ghost ir-act-btn" onClick={()=>onCloseGeneral&&onCloseGeneral(inc)}>
                  ✓ {isEn?'Close directly':'Cerrar directamente'}
                </button>
              </>
            )}
            {inc.status==='open'&&isOwner&&(
              <>
                <button className="btn-p ir-act-btn" onClick={()=>onVerify&&onVerify(inc)}>
                  ① {isEn?'Verify — add guest info & action (Step 1 of 2)':'Verificar — agregar info y acción (Paso 1 de 2)'}
                </button>
                <div className="ir-act-steps-note">{isEn?'Step 2 (resolution) also required before admin can close':'El Paso 2 (respuesta) también es requerido para que el admin cierre'}</div>
              </>
            )}
            {inc.status==='verified'&&isOwner&&hasPendingRes&&(
              <button className="btn-p ir-act-btn" onClick={()=>onAddResolution&&onAddResolution(inc)}>
                ② {isEn?'Add resolution':'Agregar respuesta'}
              </button>
            )}
            {inc.status==='verified'&&isOwner&&!hasPendingRes&&(
              <div className="ir-act-done">✓ {isEn?'Both steps complete — awaiting admin close':'Pasos completados — esperando cierre del admin'}</div>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes&&(
              <button className="bsm bs-resolve ir-act-btn-sm" onClick={()=>onResolve&&onResolve(inc.id)}>
                {appText(lang,'reports.close')}
              </button>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&hasPendingRes&&(
              <div className="ir-act-waiting">🔒 {isEn?'Waiting for owner resolution':'Esperando respuesta del propietario'}</div>
            )}
            {(isGlobalAdmin||canDeleteGlobal)&&(
              <button className="bsm bs-del ir-act-del" title={isEn?'Delete incident (admin only)':'Eliminar incidente (solo admin)'} onClick={()=>onDelete&&onDelete(inc.id)}>🗑️</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
