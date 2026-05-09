// MyListings — top-level /my tab body. Shows the owner's units with
// 5-stat workflow filter (all / verify / add resolution / admin review
// / closed), per-unit incident count pills, expand-to-detail (rendering
// UnitDetailCard inline), and a separate section for "incidents I
// reported" against other people's units.
//
// Lifted byte-identical from App.jsx in stage F31. Pulls lang via
// useApp(); listings, allListings, incidents, user, contactProps,
// permission flags, and all callbacks stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F31.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { appText, aptDisplay, getDefaultTower } from "../../../core/i18n/app-text";
import { EmptyState } from "../../../core/ui/EmptyState";
import IRow from "../../../modules/incidents/components/IRow";
import UnitPlate from "../components/UnitPlate";
import AptContactPopup from "../components/AptContactPopup";
import UnitDetailCard from "../components/UnitDetailCard";

export default function MyListings({ listings, allListings=listings, incidents, user, contactProps={}, isGlobalAdmin=false, canResolveGlobal=false, onAdd, onEdit, onDelete, onReport, onVerify, onResolve, onAddResolution, onNavigateToIncidents, onIncidentDetail=null, onAssign, onCloseGeneral }) {
  const { lang } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [statFilter, setStatFilter] = useState(null); // null | 'open' | 'pendingResolution' | 'awaitingAdmin' | 'resolved'
  const isEn = lang==='en';
  const myListingIds = new Set(listings.map(l=>l.id));
  const incAgainstMe = incidents.filter(i=>myListingIds.has(i.aptId));
  const incIReported = incidents.filter(i=>i.reporterUid===user.uid&&!myListingIds.has(i.aptId));
  const totalGuests  = listings.reduce((a,l)=>a+(l.guests||0),0);
  const openC          = incAgainstMe.filter(i=>i.status==='open').length;
  const pendingResC    = incAgainstMe.filter(i=>i.status==='verified'&&!String(i.ownerResolution||'').trim()).length;
  const awaitingAdminC = incAgainstMe.filter(i=>i.status==='verified'&& String(i.ownerResolution||'').trim()).length;
  const resolvedC      = incAgainstMe.filter(i=>i.status==='resolved').length;
  const allSorted = [...listings].sort((a,b)=>a.apt.localeCompare(b.apt));
  // Apply stat filter — verified is split into pendingResolution / awaitingAdmin
  const matchesStat = (l, sf) => incidents.some(i => i.aptId===l.id && (
    sf==='pendingResolution' ? (i.status==='verified'&&!String(i.ownerResolution||'').trim()) :
    sf==='awaitingAdmin'     ? (i.status==='verified'&& String(i.ownerResolution||'').trim()) :
    i.status===sf
  ));
  const sorted = statFilter ? allSorted.filter(l=>matchesStat(l,statFilter)) : allSorted;
  const toggleStat = (s) => { setStatFilter(f=>f===s?null:s); setSelectedId(null); };
  const goToIncidents = (l) => { /* now handled by UnitDetailCard's built-in incidents step */ };
  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang,"my.title")}</h1>
          <p className="psub">{user.name} · {listings.length} {appText(lang,"my.units")} · {totalGuests} {appText(lang,"my.guestsTotal")}</p>
        </div>
        <button className="btn-p" onClick={onAdd}>{appText(lang,"listings.add")}</button>
      </div>

      {/* ── Feature: Profile completeness warning ── */}
      {(()=>{
        const noEmailListings = listings.filter(l=>l.operator&&!l.operatorEmail);
        if(!noEmailListings.length) return null;
        return (
          <div className="profile-warn-banner">
            ⚠️ <strong>{isEn?'Incomplete operator profile':'Perfil de operador incompleto'}</strong>{' — '}
            {isEn
              ? `${noEmailListings.length} unit${noEmailListings.length!==1?'s':''} (${noEmailListings.map(l=>aptDisplay(l.apt,lang)).join(', ')}) have an operator name but no email — they won't receive incident notifications.`
              : `${noEmailListings.length} unidad${noEmailListings.length!==1?'es':''} (${noEmailListings.map(l=>aptDisplay(l.apt,lang)).join(', ')}) tienen operador sin email — no recibirán notificaciones de incidentes.`}
            {' '}<span style={{fontSize:'.78rem',opacity:.8}}>{isEn?'Edit each unit to add the operator email.':'Edita cada unidad para agregar el email del operador.'}</span>
          </div>
        );
      })()}

      {/* ── Feature: Action guide banner — "What do I do next?" ── */}
      {(openC>0||pendingResC>0)&&(
        <div className="action-guide-banner">
          <div className="agb-title">🎯 {isEn?'What do you need to do next?':'¿Qué debes hacer ahora?'}</div>
          <div className="agb-items">
            {openC>0&&(
              <button className="agb-item agb-item-warn" onClick={()=>toggleStat('open')}>
                <span className="agb-badge">{openC}</span>
                <span>⚠️ {isEn?`${openC} incident${openC!==1?'s':''} need Step 1 — verify guest & action taken`:`${openC} incidente${openC!==1?'s':''} necesita${openC!==1?'n':''} Paso 1 — verificar huésped y acción tomada`}</span>
                <span className="agb-arr">→</span>
              </button>
            )}
            {pendingResC>0&&(
              <button className="agb-item agb-item-res" onClick={()=>toggleStat('pendingResolution')}>
                <span className="agb-badge agb-badge-res">{pendingResC}</span>
                <span>📝 {isEn?`${pendingResC} incident${pendingResC!==1?'s':''} need Step 2 — add your resolution`:`${pendingResC} incidente${pendingResC!==1?'s':''} necesita${pendingResC!==1?'n':''} Paso 2 — agregar resolución`}</span>
                <span className="agb-arr">→</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Summary stats — 4 workflow states + total; click any to filter ── */}
      <div className="ml-stats">
        <div className={`ml-stat${!statFilter?' ml-stat-active':''}`} onClick={()=>toggleStat(null)} style={{cursor:'pointer'}} title={isEn?'Show all listings':'Ver todos los listings'}>
          <span className="ml-stat-val">{listings.length}</span>
          <span className="ml-stat-lbl">🏠 {isEn?'All':'Todos'}</span>
        </div>
        <div className={`ml-stat${openC>0?' ml-stat-warn':''}${statFilter==='open'?' ml-stat-active':''}`} onClick={()=>openC>0&&toggleStat('open')} style={{cursor:openC>0?'pointer':'default'}} title={isEn?'Step 1: Filter to listings needing your verification':'Paso 1: Ver listings que requieren tu verificación'}>
          <span className="ml-stat-val">{openC}</span>
          <span className="ml-stat-lbl">⚠️ {isEn?'Verify':'Verificar'}</span>
        </div>
        <div className={`ml-stat${pendingResC>0?' ml-stat-ver':''}${statFilter==='pendingResolution'?' ml-stat-active':''}`} onClick={()=>pendingResC>0&&toggleStat('pendingResolution')} style={{cursor:pendingResC>0?'pointer':'default'}} title={isEn?'Step 2: Filter to listings where you must add a resolution':'Paso 2: Ver listings donde debes agregar una resolución'}>
          <span className="ml-stat-val">{pendingResC}</span>
          <span className="ml-stat-lbl">📝 {isEn?'Add resolution':'Resolución'}</span>
        </div>
        <div className={`ml-stat${awaitingAdminC>0?' ml-stat-ver':''}${statFilter==='awaitingAdmin'?' ml-stat-active':''}`} onClick={()=>awaitingAdminC>0&&toggleStat('awaitingAdmin')} style={{cursor:awaitingAdminC>0?'pointer':'default'}} title={isEn?'Filter to listings with verified incidents awaiting admin review':'Ver listings con incidentes verificados esperando al admin'}>
          <span className="ml-stat-val">{awaitingAdminC}</span>
          <span className="ml-stat-lbl">⏳ {isEn?'Admin review':'Admin'}</span>
        </div>
        <div className={`ml-stat${resolvedC>0?' ml-stat-res':''}${statFilter==='resolved'?' ml-stat-active':''}`} onClick={()=>resolvedC>0&&toggleStat('resolved')} style={{cursor:resolvedC>0?'pointer':'default'}} title={isEn?'Filter to listings with closed incidents':'Ver listings con incidentes cerrados'}>
          <span className="ml-stat-val">{resolvedC}</span>
          <span className="ml-stat-lbl">✓ {isEn?'Closed':'Cerrados'}</span>
        </div>
      </div>
      {statFilter&&<div style={{fontSize:'.78rem',color:'#496674',marginBottom:6}}>
        {isEn?'Showing:':'Mostrando:'} <strong>{{
          open:isEn?'⚠️ Needs verification':'⚠️ Requieren verificación',
          pendingResolution:isEn?'📝 Needs resolution (Step 2)':'📝 Necesitan resolución (Paso 2)',
          awaitingAdmin:isEn?'⏳ Awaiting admin review':'⏳ Esperando revisión del admin',
          resolved:isEn?'✓ Closed':'✓ Cerrados',
        }[statFilter]}</strong> · {sorted.length} {isEn?(sorted.length===1?'listing':'listings'):'listing'+(sorted.length!==1?'s':'')} <span style={{color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'(click again to show all)':'(clic de nuevo para ver todos)'}</span>
      </div>}

      {/* ── My listings — click to see incidents ── */}
      <div className="ml-section">
        <div className="ml-section-hdr">🏠 {isEn?'My listings':'Mis listings'}</div>
        {listings.length===0
          ? <EmptyState icon="🏠" title={appText(lang,"my.noApts")} sub={appText(lang,"my.addFirst")}/>
          : sorted.map(l=>{
              const lInc  = incidents.filter(i=>i.aptId===l.id);
              const lOpen = lInc.filter(i=>i.status==='open').length;
              const lVer  = lInc.filter(i=>i.status==='verified').length;
              const lRes  = lInc.filter(i=>i.status==='resolved').length;
              const isSel = selectedId===l.id;
              return (
                <div key={l.id} className={`ml-listing${isSel?' ml-listing-sel':''}`}>
                  <div className="ml-listing-row apt-cpop-wrap" onClick={()=>{ setSelectedId(isSel?null:l.id); }}>
                    <UnitPlate apt={l.apt} tower={l.tower||getDefaultTower()} size="sm"/>
                    <div className="ml-listing-chips">
                      <span className="chip c-teal">🛏️ {l.rooms}</span>
                      <span className="chip c-blue">👥 {l.guests}</span>
                    </div>
                    <div className="ml-listing-inc-pills">
                      {lOpen>0&&<span className="ml-pill ml-pill-open" title={isEn?`${lOpen} open incident${lOpen>1?'s':''} — needs attention`:`${lOpen} incidente${lOpen>1?'s':''} abierto${lOpen>1?'s':''} — requiere atención`}>⚠️ {lOpen}</span>}
                      {(() => {
                        const verPendingRes = lInc.filter(i=>i.status==='verified'&&!String(i.ownerResolution||'').trim()).length;
                        const verReady      = lInc.filter(i=>i.status==='verified'&& String(i.ownerResolution||'').trim()).length;
                        return <>
                          {verPendingRes>0&&<span className="ml-pill ml-pill-ver" title={isEn?`${verPendingRes} verified — Step 2: add your resolution so admin can close`:`${verPendingRes} verificado${verPendingRes>1?'s':''} — Paso 2: agrega resolución para que el admin pueda cerrar`}>📝 {verPendingRes}</span>}
                          {verReady>0&&<span className="ml-pill ml-pill-ver" style={{background:'rgba(11,127,79,.15)',color:'#0b5f3a'}} title={isEn?'Verified — ready to close':'Verificado — listo para cerrar'}>👤 {verReady}</span>}
                        </>;
                      })()}
                      {lRes>0&&<span className="ml-pill ml-pill-res" title={isEn?`${lRes} closed incident${lRes>1?'s':''}`:`${lRes} incidente${lRes>1?'s':''} cerrado${lRes>1?'s':''}`}>✓ {lRes}</span>}
                    </div>
                    <div className="ml-listing-acts" onClick={e=>e.stopPropagation()}>
                      <button className="bsm bs-rep" onClick={()=>onReport(l)}>+ {isEn?'Report':'Reporte'}</button>
                      <button className="bsm bs-edit" onClick={()=>onEdit(l)}>✏️</button>
                      <button className="bsm bs-del" onClick={()=>onDelete(l)}>🗑️</button>
                    </div>
                    <span className={`fls-chev${isSel?' fls-chev-up':''}`} style={{marginLeft:'auto',flexShrink:0}}>›</span>
                    <AptContactPopup ownerName={l.owner} ownerEmail={l.userEmail||l.email} ownerWaRaw={l.contact} coOwners={l.coOwners||[]}/>
                  </div>
                  {isSel&&(
                    <div className="ml-listing-detail" onClick={e=>e.stopPropagation()}>
                      <UnitDetailCard
                        l={l}
                        incidents={incidents}
                        canEdit
                        canDelete
                        onEdit={()=>onEdit(l)}
                        onDelete={()=>onDelete(l)}
                        onReport={()=>onReport(l)}
                        user={user}
                        contactProps={contactProps}
                        isGlobalAdmin={isGlobalAdmin}
                        canResolveGlobal={canResolveGlobal}
                        onVerify={onVerify}
                        onResolve={onResolve}
                        onAddResolution={onAddResolution}
                      />
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* ── Incidents I reported against other apts ── */}
      {incIReported.length>0&&(
        <div className="ml-section" style={{marginTop:24}}>
          <div className="ml-section-hdr">📋 {isEn?'Incidents I reported':'Incidentes que reporté'}</div>
          {[...incIReported].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(i=>(
            <IRow key={i.id} inc={i} listings={allListings} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canResolveGlobal={canResolveGlobal} onResolve={onResolve} onDelete={()=>{}} onVerify={onVerify} onAddResolution={onAddResolution} onIncidentDetail={onIncidentDetail} onAssign={onAssign} onCloseGeneral={onCloseGeneral}/>
          ))}
        </div>
      )}
    </div>
  );
}
