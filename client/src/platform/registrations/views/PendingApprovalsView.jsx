// PendingApprovalsView — top-level /approvals tab. Lets admins review
// pending registration requests with date/owner/apt/status filters,
// then approve or decline each one. Also shows a history section of
// already-actioned registrations.
//
// Lifted byte-identical from App.jsx in stage F21. Pulls lang via
// useApp(); pending/active lists and approve/decline callbacks stay as
// per-instance props.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F21.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { appText } from "../../../core/i18n/app-text";
import { EmptyState } from "../../../core/ui/EmptyState";
import RegistrationCard from "../components/RegistrationCard";

export default function PendingApprovalsView({ pending, active=[], onApprove, onDecline }) {
  const { lang } = useApp();
  const [dateFilter,setDateFilter]=useState('');
  const [ownerFilter,setOwnerFilter]=useState('');
  const [aptFilter,setAptFilter]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const applyFilters = (items=[]) => items.filter(r => {
    const created = r.createdAt ? new Date(r.createdAt) : null;
    const d = created && !Number.isNaN(created.getTime()) ? created.toISOString().slice(0,10) : '';
    const ownerText = `${r.userName || ''} ${r.userEmail || ''}`.toLowerCase();
    const aptText = (r.listings || []).map(l => l.apt || l.apartment || '').join(' ').toLowerCase();
    const st = r.status || 'pending';
    return (!dateFilter || d === dateFilter)
      && (!ownerFilter || ownerText.includes(ownerFilter.toLowerCase()))
      && (!aptFilter || aptText.includes(aptFilter.toLowerCase()))
      && (statusFilter === 'all' || st === statusFilter);
  });
  const pendingFiltered = applyFilters(pending.map(r=>({...r,status:r.status || 'pending'})));
  const historyFiltered = applyFilters(active.map(r=>({...r,status:r.status || 'approved'})));
  const clear=()=>{setDateFilter('');setOwnerFilter('');setAptFilter('');setStatusFilter('all');};
  return <div className="fade">
    <div className="ph"><div><h1 className="ptitle">{appText(lang,"registrations.title")}</h1><p className="psub">{appText(lang,"registrations.subtitle")}</p></div></div>

    <div className="card reg-filters" style={{marginBottom:18}}>
      <div className="card-title">🔎 {appText(lang,'registrations.filtersTitle')}</div>
      <div className="reg-filter-grid">
        <div className="fg"><label>{appText(lang,'registrations.filterDate')}</label><input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} /></div>
        <div className="fg"><label>{appText(lang,'registrations.filterOwner')}</label><input value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} placeholder={appText(lang,'registrations.filterOwner')} /></div>
        <div className="fg"><label>{appText(lang,'registrations.filterApartment')}</label><input value={aptFilter} onChange={e=>setAptFilter(e.target.value)} placeholder="000" /></div>
        <div className="fg"><label>{appText(lang,'registrations.filterStatus')}</label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">{appText(lang,'registrations.filterAll')}</option><option value="pending">{appText(lang,'registrations.statusPending')}</option><option value="approved">{appText(lang,'registrations.statusApproved')}</option><option value="declined">{appText(lang,'registrations.statusDeclined')}</option></select></div>
        <button className="btn-ghost reg-clear" onClick={clear}>{appText(lang,'registrations.clearFilters')}</button>
      </div>
    </div>

    <div className="card" style={{marginBottom:18}}>
      <div className="card-hdr"><div><div className="card-title">{appText(lang,"registrations.pendingTitle")}</div><div className="psub">{appText(lang,"registrations.pendingSub",{count:pendingFiltered.length})}</div></div></div>
      {pendingFiltered.length===0?<EmptyState icon="✅" title={appText(lang,"registrations.nonePending")} sub={appText(lang,"registrations.nonePendingSub")}/>:<div className="notice-list">{pendingFiltered.map(r=><RegistrationCard key={r.id} r={r} actions onApprove={onApprove} onDecline={onDecline}/>)}</div>}
    </div>

    <div className="card">
      <div className="card-hdr"><div><div className="card-title">{appText(lang,"registrations.activeTitle")}</div><div className="psub">{appText(lang,"registrations.activeSub",{count:historyFiltered.length})}</div></div></div>
      {historyFiltered.length===0?<EmptyState icon="🏠" title={appText(lang,"registrations.noneActive")} sub={appText(lang,"registrations.noneActiveSub")}/>:<div className="notice-list">{historyFiltered.map(r=><RegistrationCard key={r.id} r={r}/>)}</div>}
    </div>
  </div>;
}
