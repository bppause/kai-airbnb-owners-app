// ListingsView — top-level /listings tab. Toolbar with mode toggle
// (building / owner-directory) and scope filter (all / mine), plus a
// search box. In building mode renders one BuildingFloor per unique
// floor number; in directory mode delegates to OwnerDirectoryView.
//
// Lifted byte-identical from App.jsx in stage F31. Pulls lang via
// useApp(); listings, incidents, user, contactProps, permission flags,
// floor open state + toggle, and all callbacks stay per-instance.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F31.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { appText } from "../../../core/i18n/app-text";
import { getFloorNum } from "../../../core/utils";
import { EmptyState } from "../../../core/ui/EmptyState";
import OwnerDirectoryView from "../../users/views/OwnerDirectoryView";
import BuildingFloor from "../components/BuildingFloor";

export default function ListingsView({ listings, incidents, user, contactProps={}, isGlobalAdmin=false, canEditGlobal=false, canDeleteGlobal=false, canResolveGlobal=false, floorOpenState={}, onFloorToggle, onAdd, onEdit, onDelete, onReport, onVerify, onResolve, onAddResolution, onFloorFilter, onAssign, onCloseGeneral, onIncidentDetail }) {
  const { lang } = useApp();
  const [search, setSearch]   = useState('');
  const [scope, setScope]     = useState('all');
  const [mode, setMode]       = useState('building');
  const isEn = lang === 'en';

  const scoped   = scope==='mine'&&user ? listings.filter(l=>l.ownerUid===user.uid) : listings;
  const filtered = scoped.filter(l=>{
    const q=search.toLowerCase();
    const coMatch=(l.coOwners||[]).some(co=>[co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)||String(co.whatsapp||'').includes(q));
    return !q||String(l.apt||'').includes(q)||String(l.owner||'').toLowerCase().includes(q)||String(l.operator||'').toLowerCase().includes(q)||String(l.email||'').toLowerCase().includes(q)||String(l.userEmail||'').toLowerCase().includes(q)||coMatch;
  });
  const sorted    = [...filtered].sort((a,b)=>String(a.apt||'').localeCompare(String(b.apt||'')));
  // Ascending floor order (floor 1 at top, floor 9 at bottom)
  const floorNums = [...new Set(sorted.map(l=>getFloorNum(l.apt)))].sort((a,b)=>a-b);
  const byFloor   = (f) => sorted.filter(l=>getFloorNum(l.apt)===f);

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang,'listings.title')}</h1>
          <p className="psub">{appText(lang,'listings.subtitle',{count:scoped.length})}</p>
        </div>
        {user&&<button className="btn-p" onClick={onAdd}>{appText(lang,'listings.add')}</button>}
      </div>

      <div className="fls-toolbar" style={{marginTop:14}}>
        <div className="filter-row" style={{margin:0,gap:6,flexWrap:'wrap'}}>
          <button className={`fchip ${mode==='building'?'fchip-on':''}`} onClick={()=>setMode('building')}>🏠 {isEn?'Building':'Edificio'}</button>
          <button className={`fchip ${mode==='directory'?'fchip-on':''}`} onClick={()=>setMode('directory')}>👤 {isEn?'Owner directory':'Directorio'}</button>
          {mode==='building'&&user&&<>
            <button className={`fchip ${scope==='all'?'fchip-on':''}`} onClick={()=>setScope('all')}>{appText(lang,'filters.scopeAll')}</button>
            <button className={`fchip ${scope==='mine'?'fchip-on':''}`} onClick={()=>setScope('mine')}>🔑 {isEn?'Mine':'Mis apts'}</button>
          </>}
        </div>
      </div>

      {mode==='directory'
        ? <OwnerDirectoryView listings={listings}/>
        : <>
            <div style={{position:'relative',marginBottom:14}}>
              <input className="search" style={{paddingRight:36}} placeholder={isEn?'Search by unit, owner, operator, email…':appText(lang,'listings.search')} value={search} onChange={e=>setSearch(e.target.value)}/>
              {search&&<button className="inc-search-clear" onClick={()=>setSearch('')}>✕</button>}
            </div>
            {filtered.length===0
              ? <EmptyState icon="🏠" title={appText(lang,'listings.none')} sub={appText(lang,'listings.noResults')}/>
              : <div className="bld-building">{floorNums.map(f=><BuildingFloor key={f} floor={f} apts={byFloor(f)} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={isGlobalAdmin} canEditGlobal={canEditGlobal} canDeleteGlobal={canDeleteGlobal} canResolveGlobal={canResolveGlobal} onEdit={onEdit} onDelete={onDelete} onReport={onReport} onVerify={onVerify} onResolve={onResolve} onAddResolution={onAddResolution} onFloorFilter={onFloorFilter} isOpen={!!floorOpenState[f]} onToggle={()=>onFloorToggle(f)}/>)}</div>
            }
          </>
      }
    </div>
  );
}
