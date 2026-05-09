// DashboardFocus — role-aware focus card shown at the top of the
// /dashboard view. Renders a role title + sub + a grid of action cards
// (each with icon, count, label, sub, click handler). The card set is
// different for owner / delegate / global admin.
//
// Lifted byte-identical from App.jsx in stage F26. Pulls lang via
// useApp(); other props (effective role flags, counts, click handlers)
// stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F26.

import React from "react";
import { useApp } from "../../../core/app-state";

export default function DashboardFocus({ effectiveIsGlobalAdmin=false, effectiveRole='user', delegatePerms={},
  pendingOwner=0, pendingOwnerResolution=0, pendingResolve=0, pendingRegistrations=0, openCount=0,
  myListingCount=0, myOpenCount=0, pendingGeneral=0,
  canResolve=false, canManageRegistrations=false,
  onOwnerClick=()=>{}, onResolveClick=()=>{}, onRegistrationsClick=()=>{}, onOpenClick=()=>{}, setView=()=>{}, onAddResClick=()=>{}, onGeneralClick=()=>{} }) {
  const { lang } = useApp();
  const isEn = lang==='en';
  const role = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'standard';

  // Role-specific card sets — each role sees only what matters to them
  const cards = role==='standard' ? [
    { id:'verify',        icon:'⚠️', count:pendingOwner,           label:isEn?'⚠️ Verify now':'⚠️ Verificar',        sub:isEn?'Step 1 · Open incidents on your units requiring verification':'Paso 1 · Incidentes abiertos en tus unidades que requieren verificación', accent:'red',   onClick:onOwnerClick,   show:true },
    { id:'addResolution', icon:'📝', count:pendingOwnerResolution, label:isEn?'📝 Add resolution':'📝 Agregar respuesta', sub:isEn?'Step 2 · Verified — add your resolution to allow admin to close':'Paso 2 · Verificados — agrega tu respuesta para que admin pueda cerrar', accent:'amber', onClick:onAddResClick,  show:true },
    { id:'myListings',    icon:'🏠', count:myListingCount,         label:isEn?'My listings':'Mis listings',             sub:isEn?'Your registered units':'Tus unidades registradas',                                                                                       accent:'teal',  onClick:()=>setView('my'), show:true },
  ].filter(c=>c.show!==false) : role==='delegate' ? [
    { id:'general',           icon:'📢', count:pendingGeneral,         label:isEn?'General incidents':'Incidentes generales',     sub:isEn?'Unassigned — assign or close':'Sin unidad — asigna o cierra',         accent:'orange',onClick:onGeneralClick,       show:canResolve&&pendingGeneral>0 },
    { id:'ownerVerification', icon:'✅', count:pendingOwner,           label:isEn?'Need verification':'Requieren verificación',   sub:isEn?'Awaiting owner confirmation':'Esperando confirmación propietario',  accent:'amber', onClick:onOwnerClick,         show:true },
    { id:'requiresResolution',icon:'🛠️',count:pendingResolve,         label:isEn?'Ready to resolve':'Listos para resolver',       sub:isEn?'Verified, ready to close':'Verificados, listos para cerrar',        accent:'green', onClick:onResolveClick,       show:canResolve },
    { id:'registrations',     icon:'📝', count:pendingRegistrations,   label:isEn?'Registrations':'Registros',                   sub:isEn?'Pending approval':'Pendientes de aprobación',                         accent:'blue',  onClick:onRegistrationsClick, show:canManageRegistrations },
    { id:'allOpen',           icon:'⚠️', count:openCount,              label:isEn?'All open':'Total abiertos',                   sub:isEn?'Community incidents in progress':'Incidentes activos comunidad',       accent:null,    onClick:onOpenClick,          show:true },
  ].filter(x=>x.show!==false) : [
    { id:'general',           icon:'📢', count:pendingGeneral,         label:isEn?'General incidents':'Incidentes generales',     sub:isEn?'Unassigned — assign or close':'Sin unidad — asigna o cierra',         accent:'orange',onClick:onGeneralClick,       show:pendingGeneral>0 },
    { id:'allOpen',           icon:'⚠️', count:openCount,              label:isEn?'Open incidents':'Incidentes abiertos',         sub:isEn?'Community-wide open reports':'Reportes abiertos en comunidad',        accent:'red',   onClick:onOpenClick },
    { id:'ownerVerification', icon:'✅', count:pendingOwner,           label:isEn?'Need verification':'Requieren verificación',   sub:isEn?'Awaiting owner action':'Esperando acción del propietario',            accent:'amber', onClick:onOwnerClick },
    { id:'requiresResolution',icon:'🛠️',count:pendingResolve,         label:isEn?'Ready to resolve':'Listos para resolver',       sub:isEn?'Verified, ready to close':'Verificados, listos para cerrar',         accent:'green', onClick:onResolveClick },
    { id:'registrations',     icon:'📝', count:pendingRegistrations,   label:isEn?'Pending registrations':'Registros pendientes', sub:isEn?'Awaiting approval':'Esperando aprobación',                           accent:'blue',  onClick:onRegistrationsClick, show:canManageRegistrations },
  ].filter(x=>x.show!==false);

  const roleConfig = {
    standard: { icon:'🏠', title:isEn?'Your focus':'Tu enfoque',
      sub: isEn?'Verify incidents on your units and keep your listing info current.':'Verifica incidentes en tus unidades y mantén tu listing actualizado.',
      actions:[{label:isEn?'Verify pending':'Verificar pendientes',view:'incidents'},{label:isEn?'Update listing info':'Actualizar listing',view:'my'}] },
    delegate: { icon:'🛡️', title:isEn?'Delegate admin':'Admin delegado',
      sub: isEn?'Review pending registrations and resolve verified community incidents.':'Revisa registros pendientes y cierra incidentes verificados de la comunidad.',
      actions:[{label:isEn?'Registrations':'Registros',view:'approvals'},...(canResolve?[{label:isEn?'Resolve incidents':'Resolver incidentes',view:'incidents'}]:[])].slice(0,2) },
    global:   { icon:'🌐', title:isEn?'Community overview':'Vista comunidad',
      sub: isEn?'Full access — manage settings, users, analytics, and all incidents.':'Acceso total — gestiona configuración, usuarios, analíticas e incidentes.',
      actions:[{label:isEn?'Analytics':'Analíticas',view:'analytics'},{label:isEn?'Settings':'Configuración',view:'admin'}] },
  }[role];

  return (
    <div className="dash-focus card">
      <div className="dash-focus-head">
        <div>
          <strong className="dfc-role-title">{roleConfig.icon} {roleConfig.title}</strong>
          {roleConfig.sub && <p className="dfc-role-sub">{roleConfig.sub}</p>}
        </div>
        <div className="dash-focus-actions">
          {roleConfig.actions.map((a,i)=><button key={i} type="button" className="role-chip" onClick={()=>setView(a.view)}>{a.label}</button>)}
        </div>
      </div>
      <div className="dash-focus-grid">
        {cards.map(card=>(
          <button key={card.id} type="button"
            className={`dash-focus-card${card.count>0?' dfc-active':''}${card.accent?' dfc-'+card.accent:''}`}
            onClick={card.onClick} title={card.sub}>
            <span className="dfc-icon">{card.icon}</span>
            <span className="dfc-copy"><strong>{card.label}</strong><small>{card.sub}</small></span>
            <span className="dfc-count">{card.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
