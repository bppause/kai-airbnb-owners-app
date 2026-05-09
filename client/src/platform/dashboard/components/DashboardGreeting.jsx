// DashboardGreeting — personalized header card with avatar/initials,
// time-based greeting, role-aware status message, and urgent-action
// pills. Used at the top of the /my and /dashboard tabs.
//
// Lifted byte-identical from App.jsx in stage F26. Pulls lang via
// useApp(); user, role, counts, and click handlers stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F26.

import React from "react";
import { useApp } from "../../../core/app-state";

export default function DashboardGreeting({ user, role, pendingOwner=0, pendingOwnerResolution=0, pendingResolve=0, pendingRegistrations=0, myOpenCount=0, onOwnerClick, onResolveClick, onRegistrationsClick, setView }) {
  const { lang } = useApp();
  const isEn = lang==='en';
  const hour = new Date().getHours();
  const timeGreet = hour<12 ? (isEn?'Good morning':'Buenos días') : hour<17 ? (isEn?'Good afternoon':'Buenas tardes') : (isEn?'Good evening':'Buenas noches');
  const firstName = String(user?.name||'').split(' ')[0] || (isEn?'there':'hola');
  const urgentPills = [];
  let msg = '';

  if (role==='standard') {
    const parts=[], pills=[];
    if (pendingOwner>0) {
      parts.push(isEn?`${pendingOwner} incident${pendingOwner>1?'s':''} need your verification`:`${pendingOwner} incidente${pendingOwner>1?'s':''} esperan tu verificación`);
      pills.push(<button key="verify" className="dg-pill dg-pill-amber" onClick={onOwnerClick}>✅ {isEn?`Verify now (${pendingOwner})`:`Verificar ahora (${pendingOwner})`}</button>);
    }
    if (pendingOwnerResolution>0) {
      parts.push(isEn?`${pendingOwnerResolution} verified — add your resolution so admin can close`:`${pendingOwnerResolution} verificado${pendingOwnerResolution>1?'s':''} — agrega tu respuesta para que admin pueda cerrar`);
      pills.push(<button key="res" className="dg-pill dg-pill-amber" onClick={()=>setView('incidents')}>📝 {isEn?`Add resolution (${pendingOwnerResolution})`:`Agregar respuesta (${pendingOwnerResolution})`}</button>);
    }
    if (myOpenCount>0 && pendingOwner===0) {
      parts.push(isEn?`${myOpenCount} open report${myOpenCount>1?'s':''} on your units`:`${myOpenCount} reporte${myOpenCount>1?'s':''} abierto${myOpenCount>1?'s':''} en tus unidades`);
      if (pills.length===0) pills.push(<button key="open" className="dg-pill dg-pill-red" onClick={()=>setView('incidents')}>⚠️ {isEn?`View reports`:`Ver reportes`}</button>);
    }
    urgentPills.push(...pills);
    if (parts.length>0) {
      msg = (isEn?'Action needed: ':'Acción requerida: ')+parts.join(' · ')+'.';
    } else {
      msg = isEn ? "All units clear — no pending actions today! 🎉" : "¡Unidades al día — sin acciones pendientes hoy! 🎉";
    }
  } else if (role==='delegate') {
    const parts = [];
    if (pendingResolve>0) {
      parts.push(isEn?`${pendingResolve} ready to resolve`:`${pendingResolve} listos para resolver`);
      urgentPills.push(<button key="res" className="dg-pill dg-pill-green" onClick={onResolveClick}>🛠️ {isEn?`Resolve ${pendingResolve}`:`Resolver ${pendingResolve}`}</button>);
    }
    if (pendingRegistrations>0) {
      parts.push(isEn?`${pendingRegistrations} registration${pendingRegistrations>1?'s':''} pending`:`${pendingRegistrations} registro${pendingRegistrations>1?'s':''} pendiente${pendingRegistrations>1?'s':''}`);
      urgentPills.push(<button key="reg" className="dg-pill dg-pill-blue" onClick={onRegistrationsClick}>📝 {isEn?`Review ${pendingRegistrations}`:`Revisar ${pendingRegistrations}`}</button>);
    }
    msg = parts.length>0 ? (isEn?'Action needed: ':'Acción requerida: ')+parts.join(' · ')+'.' : (isEn?'No pending actions today — community is up to date!':'Sin acciones pendientes — la comunidad está al día.');
  } else {
    // global
    const parts = [];
    if (pendingResolve>0) { parts.push(isEn?`${pendingResolve} ready to resolve`:`${pendingResolve} listos para resolver`); urgentPills.push(<button key="res" className="dg-pill dg-pill-green" onClick={onResolveClick}>🛠️ {pendingResolve} {isEn?'to resolve':'por resolver'}</button>); }
    if (pendingOwner>0) { parts.push(isEn?`${pendingOwner} need verification`:`${pendingOwner} requieren verificación`); urgentPills.push(<button key="ver" className="dg-pill dg-pill-amber" onClick={onOwnerClick}>✅ {pendingOwner} {isEn?'need verification':'requieren verificación'}</button>); }
    if (pendingRegistrations>0) { parts.push(isEn?`${pendingRegistrations} pending registrations`:`${pendingRegistrations} registros pendientes`); urgentPills.push(<button key="reg" className="dg-pill dg-pill-blue" onClick={onRegistrationsClick}>📝 {pendingRegistrations} {isEn?'registrations':'registros'}</button>); }
    msg = parts.length>0 ? parts.join(' · ')+'.' : (isEn?'Community is up to date — no pending actions!':'¡Comunidad al día — sin acciones pendientes!');
  }

  const allClear = urgentPills.length===0;
  return (
    <div className={`dash-greeting${allClear?' dg-all-clear':''}`}>
      {user?.photo
        ? <img src={user.photo} className="dg-avatar" alt="" referrerPolicy="no-referrer"/>
        : <div className="dg-initials">{firstName.slice(0,1).toUpperCase()}</div>
      }
      <div className="dg-body">
        <div className="dg-hello">{timeGreet}, <span className="dg-name">{firstName}!</span> 👋</div>
        <p className="dg-msg">{msg}</p>
        {urgentPills.length>0 && <div className="dg-pills">{urgentPills}</div>}
      </div>
    </div>
  );
}
