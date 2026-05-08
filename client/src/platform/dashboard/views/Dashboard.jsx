// Dashboard — top-level /dashboard view. Shows the page header with a
// "Report incident" button, the role-aware DashboardFocus card, the
// community-goals progress card (when configured), an "owner attention
// needed" card listing the user's incidents that require Step 1 (verify)
// or Step 2 (add resolution), an admin-only general-incidents review
// card, the 4-stat health grid, and a "Recent activity" feed.
//
// Lifted byte-identical from App.jsx in stage F26. Pulls lang via useApp();
// listings, incidents, user, contactProps, setView, onReport, role flags,
// counts, click handlers, communityGoals stay per-instance.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F26.

import React from "react";
import { useApp } from "../../../core/app-state";
import { appText, localizedTooltips, incidentTypeLabel, categoryLabel } from "../../../core/i18n/app-text";
import { slaResInfo, fmtDate } from "../../../core/utils";
import { Empty } from "../../../core/ui/EmptyState";
import IRow from "../../../modules/incidents/components/IRow";
import DashboardFocus from "../components/DashboardFocus";

export default function Dashboard({ listings, incidents, user, contactProps={}, setView, onReport, showBlacklist=false,
  effectiveIsGlobalAdmin=false, effectiveRole='user', delegatePerms={},
  pendingOwner=0, pendingOwnerResolution=0, pendingResolve=0, pendingRegistrations=0,
  canResolve=false, canManageRegistrations=false,
  onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{}, onAddResClick=()=>{},
  onIncidentDetail=null, communityGoals=null, communityGoalsLoading=false }) {
  const { lang } = useApp();
  const isEn = lang==='en';
  const open       = incidents.filter(i=>i.status==="open");
  const resolved   = incidents.filter(i=>i.status==="resolved");
  const pendingRes = incidents.filter(i=>i.status==="verified"&&!String(i.ownerResolution||'').trim());
  const recent     = [...incidents].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  const myListings = user ? listings.filter(l=>l.ownerUid===user.uid) : [];
  const myOpen     = incidents.filter(i=>myListings.some(l=>l.id===i.aptId)&&i.status==="open");
  const generalOpen = incidents.filter(i=>i.isGeneral&&i.status!=='resolved');
  const dashRole   = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'standard';

  const stats = [
    { icon:"🏠", val:listings.length,    label:isEn?"Registered units":"Unidades registradas", color:"#2a9aaa", click:()=>setView("listings") },
    { icon:"⚠️", val:open.length,        label:isEn?"Open reports":"Reportes abiertos",         color:"#d4634a", click:()=>setView("incidents") },
    { icon:"⏳", val:pendingRes.length,   label:isEn?"Pending resolution":"Respuesta pendiente", color:"#e07b2a", click:()=>setView("incidents") },
    { icon:"✅", val:resolved.length,     label:isEn?"Closed this cycle":"Cerrados",              color:"#2e7d32" },
  ];

  return (
    <div className="fade">
      <div className="ph" style={{alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <h1 className="ptitle" style={{fontSize:'1.5rem',marginBottom:4}}>{appText(lang,"dashboard.title")}</h1>
          <p className="psub" style={{marginBottom:0}}>{appText(lang,"dashboard.subtitle")}</p>
        </div>
        {user&&<button className="btn-p btn-report" title={localizedTooltips({},lang).reportIncident} onClick={onReport}>{appText(lang,"dashboard.reportIncident")}</button>}
      </div>

      <DashboardFocus effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} effectiveRole={effectiveRole} delegatePerms={delegatePerms} pendingOwner={pendingOwner} pendingOwnerResolution={pendingOwnerResolution} pendingResolve={pendingResolve} pendingRegistrations={pendingRegistrations} openCount={open.length} myListingCount={myListings.length} myOpenCount={myOpen.length} pendingGeneral={generalOpen.length} canResolve={canResolve} canManageRegistrations={canManageRegistrations} onOwnerClick={onOwnerClick} onResolveClick={onResolveClick} onRegistrationsClick={onRegistrationsClick} onOpenClick={()=>setView('incidents')} setView={setView} onAddResClick={onAddResClick} onGeneralClick={()=>setView('general')} />

      {/* ── Collective Goals ── */}
      {(communityGoals || communityGoalsLoading) && (()=>{
        const g = communityGoals;
        const rate = g?.resolutionRate;
        const goal = g?.goalTarget ?? 90;
        const progress = rate !== null && rate !== undefined ? Math.min(rate, 100) : null;
        const met = g?.goalMet;
        const color = met ? '#1eaa64' : progress !== null && progress >= 70 ? '#d9b45a' : '#d4634a';
        const reportLink = typeof window !== 'undefined' ? window.location.origin + '/?action=report' : '/?action=report';
        return (
          <div className="card" style={{marginBottom:16,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginBottom:14}}>
              <div>
                <div style={{fontWeight:900,color:'#2F4F3A',fontSize:'1rem'}}>🎯 {isEn?'Community Goal — This Quarter':'Meta Comunitaria — Este Trimestre'}</div>
                <div style={{fontSize:'.78rem',color:'#6b9ba8',marginTop:2}}>{isEn?`Target: ${goal}% of incidents resolved`:`Meta: ${goal}% de incidentes resueltos`}</div>
              </div>
              {met && <span style={{background:'#e8f5ec',color:'#2F4F3A',border:'1px solid #b2dfdb',borderRadius:999,padding:'4px 12px',fontSize:'.78rem',fontWeight:700}}>🏆 {isEn?'Goal met!':'¡Meta alcanzada!'}</span>}
            </div>
            {communityGoalsLoading && <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading…':'Cargando…'}</div>}
            {g && <>
              <div style={{background:'#f0f8fb',borderRadius:10,height:14,overflow:'hidden',marginBottom:10}}>
                <div style={{height:'100%',borderRadius:10,background:`linear-gradient(90deg,${color},${color}cc)`,width:`${progress??0}%`,transition:'width .6s ease'}}/>
              </div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:14}}>
                <div style={{textAlign:'center',flex:'1 1 80px'}}>
                  <div style={{fontFamily:'Playfair Display,serif',fontSize:'1.4rem',fontWeight:900,color:color}}>{rate !== null ? rate+'%' : '—'}</div>
                  <div style={{fontSize:'.72rem',color:'#6b9ba8'}}>{isEn?'Resolution rate':'Tasa de resolución'}</div>
                </div>
                <div style={{textAlign:'center',flex:'1 1 80px'}}>
                  <div style={{fontFamily:'Playfair Display,serif',fontSize:'1.4rem',fontWeight:900,color:'#2F4F3A'}}>{g.resolvedQ ?? '—'}/{g.totalQ ?? '—'}</div>
                  <div style={{fontSize:'.72rem',color:'#6b9ba8'}}>{isEn?'Resolved / Total':'Resueltos / Total'}</div>
                </div>
                {g.openPastSla > 0 && <div style={{textAlign:'center',flex:'1 1 80px'}}>
                  <div style={{fontFamily:'Playfair Display,serif',fontSize:'1.4rem',fontWeight:900,color:'#d4634a'}}>{g.openPastSla}</div>
                  <div style={{fontSize:'.72rem',color:'#6b9ba8'}}>{isEn?'Past SLA':'Fuera de SLA'}</div>
                </div>}
                {g.engagementRate !== null && <div style={{textAlign:'center',flex:'1 1 80px'}}>
                  <div style={{fontFamily:'Playfair Display,serif',fontSize:'1.4rem',fontWeight:900,color:'#2a9aaa'}}>{g.engagementRate}%</div>
                  <div style={{fontSize:'.72rem',color:'#6b9ba8'}}>{isEn?'Owners reporting':'Propietarios activos'}</div>
                </div>}
              </div>
              {!met && rate !== null && <div style={{fontSize:'.8rem',color:'#7a5a00',background:'#fff8e1',border:'1px solid #ffe082',borderRadius:8,padding:'8px 12px',marginBottom:12}}>
                {isEn ? `${goal - rate} percentage point${goal-rate===1?'':'s'} to reach the community goal. Every report resolved counts.`
                       : `Faltan ${goal - rate} punto${goal-rate===1?'':'s'} porcentuales para la meta. Cada incidente resuelto cuenta.`}
              </div>}
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',paddingTop:4,borderTop:'1px solid rgba(90,105,80,.10)'}}>
                <span style={{fontSize:'.75rem',color:'#6b9ba8',flex:1}}>
                  💬 {isEn?'Share this link to invite owners to report:':'Comparte este enlace para invitar a reportar:'}
                </span>
                <code style={{fontSize:'.72rem',background:'#f0f8fb',padding:'3px 8px',borderRadius:6,color:'#2a5a6a',flex:'2 1 180px',wordBreak:'break-all'}}>{reportLink}</code>
                <button className="btn-ghost" style={{fontSize:'.72rem',padding:'4px 10px',flexShrink:0}} onClick={()=>{try{navigator.clipboard.writeText(reportLink);}catch(e){}}}>📋 {isEn?'Copy':'Copiar'}</button>
              </div>
            </>}
          </div>
        );
      })()}

      {/* ── My attention needed — owner's actionable incidents ── */}
      {user && myListings.length>0 && (()=>{
        const myAttnOpen = myOpen;
        const myAttnPending = incidents.filter(i=>myListings.some(l=>l.id===i.aptId)&&i.status==='verified'&&!String(i.ownerResolution||'').trim());
        if(!myAttnOpen.length&&!myAttnPending.length) return null;
        return (
          <div className="card attn-card">
            <div className="card-hdr">
              <span className="card-title">🚨 {isEn?'Needs your attention':'Requiere tu atención'}</span>
              <span className="attn-badge">{myAttnOpen.length+myAttnPending.length}</span>
            </div>
            <div className="attn-sub">{isEn?'These incidents on your units need action before admin can close them.':'Estos incidentes en tus unidades requieren tu acción antes de que el admin pueda cerrarlos.'}</div>
            {myAttnOpen.length>0&&<div className="attn-group-lbl">⚠️ {isEn?'Step 1 — Verify':'Paso 1 — Verificar'}</div>}
            {myAttnOpen.map(i=><IRow key={i.id} inc={i} compact listings={listings} contactProps={contactProps} onIncidentDetail={onIncidentDetail}/>)}
            {myAttnPending.length>0&&(()=>{
              const breached = myAttnPending.filter(i=>{const s=slaResInfo(i);return s&&s.isBreached;});
              const urgent   = myAttnPending.filter(i=>{const s=slaResInfo(i);return s&&!s.isBreached&&s.hoursLeft<=4;});
              return (<>
                <div className="attn-group-lbl" style={{marginTop:myAttnOpen.length?10:0}}>
                  📝 {isEn?'Step 2 — Add resolution':'Paso 2 — Agregar respuesta'}
                  {breached.length>0&&<span className="attn-sla-pill attn-sla-breached">{breached.length} SLA {isEn?'breached':'vencido'}</span>}
                  {!breached.length&&urgent.length>0&&<span className="attn-sla-pill attn-sla-urgent">{urgent.length} {isEn?'due soon':'por vencer'}</span>}
                </div>
                {myAttnPending.map(i=><IRow key={i.id} inc={i} compact listings={listings} contactProps={contactProps} onIncidentDetail={onIncidentDetail}/>)}
              </>);
            })()}
          </div>
        );
      })()}

      {/* ── General incidents admin attention card ── */}
      {user && (effectiveIsGlobalAdmin || effectiveRole==='delegate_admin') && generalOpen.length>0 && (
        <div className="card attn-card gen-attn-card">
          <div className="card-hdr">
            <span className="card-title">📢 {isEn?'General incidents need review':'Incidentes generales requieren revisión'}</span>
            <span className="attn-badge" style={{background:'#d9700e'}}>{generalOpen.length}</span>
          </div>
          <div className="attn-sub">{isEn
            ?'These incidents are not linked to any unit. Assign to the responsible unit (owner gets notified) or close directly.'
            :'Estos incidentes no están vinculados a ninguna unidad. Asigna a la unidad responsable (el propietario recibe aviso) o cierra directamente.'
          }</div>
          <div className="gen-attn-list">
            {generalOpen.slice(0,3).map(inc=>(
              <div key={inc.id} className="gen-attn-item">
                <span className={`gen-card-status-dot ${inc.status==='open'?'gen-dot-open':'gen-dot-wait'}`} style={{marginTop:2,flexShrink:0}}/>
                <div className="gen-attn-body">
                  <span className="gen-attn-type">{incidentTypeLabel(inc.type,lang)} · {categoryLabel(inc.category,lang)}</span>
                  <span className="gen-attn-desc">{String(inc.desc||'').slice(0,120)}{inc.desc&&inc.desc.length>120?'…':''}</span>
                  <span className="gen-attn-meta">📅 {fmtDate(inc.date)}{inc.reporterName?` · ${inc.reporterName}`:''}{inc.slaCycleCount>0?` · ⏱️ SLA ×${inc.slaCycleCount}`:''}</span>
                </div>
              </div>
            ))}
            {generalOpen.length>3&&<div style={{fontSize:'.76rem',color:'#496674',marginTop:6,paddingLeft:16}}>+{generalOpen.length-3} {isEn?'more':'más'}</div>}
          </div>
          <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn-p bsm" onClick={()=>setView('listings')}>🏠 {isEn?'Review in Inventory':'Revisar en Inventario'}</button>
            <button className="btn-ghost bsm" onClick={()=>setView('general')}>📢 {isEn?'Community tab':'Pestaña Comunidad'}</button>
          </div>
        </div>
      )}

      {/* ── Community health stats — 4 focused metrics ── */}
      <div className="stats6" style={{gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))'}}>
        {stats.map((s,i)=>(
          <div key={i} className="scard" style={{borderTop:`3px solid ${s.color}`,cursor:s.click?"pointer":"default"}} onClick={s.click}>
            <div style={{fontSize:"1.5rem"}}>{s.icon}</div>
            <div className="sval" style={{color:s.color}}>{s.val}</div>
            <div className="slabel">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Recent incident activity ── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">🕐 {isEn?'Recent incident activity':'Actividad reciente de incidentes'}</span>
          <button className="lnk" onClick={()=>setView("incidents")}>{appText(lang,"dashboard.viewAll")}</button>
        </div>
        {recent.length===0
          ? <Empty icon="✅" msg={appText(lang,"dashboard.noReports")}/>
          : recent.map(i=><IRow key={i.id} inc={i} compact listings={listings} contactProps={contactProps} onIncidentDetail={onIncidentDetail}/>)
        }
      </div>
    </div>
  );
}
