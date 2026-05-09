// IncidentsView — top-level view for the /incidents tab.
//
// Owns the tab switcher (Unit / General), all filtering UI (status,
// category, scope, search, date range, floor filter banner from quick-
// filter deep links), the wfg group expand/collapse state with
// localStorage persistence, and the list of WorkflowGroup sections.
//
// Lifted byte-identical from App.jsx in stage F16. Pulls user + lang via
// useApp(); incidents, listings, contactProps, the permission flags, the
// quick-filter handshake, and all action callbacks stay as per-instance
// props. defaultTab is set by App.jsx based on whether the active view is
// 'incidents' or 'general'.
//
// All sub-component dependencies are now extracted:
//   - GeneralIncidentsView (F7)
//   - WorkflowGroup (F15) → IRow (F14) → UnitMiniCard (F12) + UserContact (F13)
//   - GUEST_CATEGORIES (F11)
//   - appText, categoryLabel (F6)
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F16.

import React, { useState, useEffect } from "react";
import { useApp } from "../../../core/app-state";
import { appText, categoryLabel } from "../../../core/i18n/app-text";
import { GUEST_CATEGORIES } from "../constants";
import GeneralIncidentsView from "./GeneralIncidentsView";
import WorkflowGroup from "../components/WorkflowGroup";

export default function IncidentsView({ incidents, listings, quickFilter = null, onQuickFilterApplied = () => {}, contactProps = {}, isGlobalAdmin = false, canUpdateGlobal = false, canDeleteGlobal = false, canResolveGlobal = false, onAdd, onResolve, onDelete, onVerify, onAddResolution, onUnitDetail, onIncidentDetail, onAssign, onCloseGeneral, defaultTab = 'unit' }) {
  const { user, lang } = useApp();
  const [sf, setSf] = useState("all"), [cf, setCf] = useState("all"), [scope, setScope] = useState("all"), [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tab, setTab] = useState(defaultTab || 'unit');
  const unitOpenCount = incidents.filter(i => !i.isGeneral && i.status === 'open').length;
  const generalOpenCount = incidents.filter(i => i.isGeneral && i.status !== 'resolved').length;
  // Floor filter: set when user clicks a stat pill on the Units page floor header
  const [floorFilter, setFloorFilter] = useState(null); // {aptIds:string[], status:string, label:string} | null
  useEffect(() => {
    if (!quickFilter) return;
    if (typeof quickFilter === 'object' && quickFilter.type === 'floorFilter') {
      setFloorFilter({ aptIds: quickFilter.aptIds, status: quickFilter.status });
      setScope("all");
      // Map sub-statuses to the sf dropdown; pendingResolution/awaitingAdmin both sit under 'verified'
      const sfVal = quickFilter.status === 'pendingResolution' || quickFilter.status === 'awaitingAdmin' ? 'verified' : (quickFilter.status || 'all');
      setSf(sfVal); setCf("all"); setSearch("");
      onQuickFilterApplied(); return;
    }
    if (quickFilter === "ownerVerification") { setScope("ownerVerification"); setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "needsResolution")   { setScope("needsResolution");   setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "requiresResolution") { setScope("requiresResolution"); setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "seriousOpen") { setScope("all"); setSf("all"); setCf("serious"); setFloorFilter(null); onQuickFilterApplied(); }
    if (quickFilter === "generalIncidents") { setTab('general'); setSf("all"); setCf("all"); setFloorFilter(null); onQuickFilterApplied(); return; }
  }, [quickFilter, onQuickFilterApplied]);
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const myListingIds = new Set((user ? listings.filter(l => l.ownerUid === user.uid) : []).map(l => l.id));
  let list = [...incidents];
  list = list.filter(i => !i.isGeneral);
  // "I reported" — incidents the current user filed (any apartment)
  if (scope === "iReported"   && user) list = list.filter(i => i.reporterUid === user.uid);
  // "My listings" — incidents against apartments the user owns
  if (scope === "myListings"  && user) list = list.filter(i => myListingIds.has(i.aptId));
  // "Pending resolution" — verified incidents where owner_resolution is still missing
  // Owners see only their listings; admins/delegates see all
  if (scope === "needsResolution") list = list.filter(i =>
    i.status === "verified" && !String(i.ownerResolution || '').trim() &&
    (isGlobalAdmin || canResolveGlobal || (user && myListingIds.has(i.aptId)))
  );
  // Legacy quickFilter scopes (used by dashboard action pills)
  if (scope === "ownerVerification" && user) list = list.filter(i => i.status === "open" && myListingIds.has(i.aptId));
  // "Requires resolution" (admin) — verified WITH owner resolution, truly ready to close
  if (scope === "requiresResolution") list = list.filter(i =>
    i.status === "verified" && String(i.ownerResolution || '').trim() && (isGlobalAdmin || canResolveGlobal)
  );
  // Floor filter — restricts to specific apt IDs + optional sub-status from the Units page
  if (floorFilter?.aptIds) {
    list = list.filter(i => floorFilter.aptIds.includes(i.aptId));
    if (floorFilter.status === 'pendingResolution') list = list.filter(i => i.status === 'verified' && !String(i.ownerResolution || '').trim());
    else if (floorFilter.status === 'awaitingAdmin') list = list.filter(i => i.status === 'verified' && String(i.ownerResolution || '').trim());
    else if (floorFilter.status && floorFilter.status !== 'all') list = list.filter(i => i.status === floorFilter.status);
  }
  if (sf !== "all") list = list.filter(i => i.status === sf);
  if (cf !== "all") list = list.filter(i => i.category === cf);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(i => {
      const apt      = String(i.aptLabel || '').toLowerCase();
      const owner    = String(listingMap[i.aptId]?.owner || '').toLowerCase();
      const operator = String(listingMap[i.aptId]?.operator || '').toLowerCase();
      const desc     = String(i.desc || '').toLowerCase();
      const type     = String(i.type || '').toLowerCase();
      const reporter = String(i.reporterName || '').toLowerCase();
      // General incident keyword — matches "general" and "comunidad/community"
      const genFlag  = i.isGeneral ? 'general comunidad community' : '';
      // Initial report guest fields
      const guest    = String(i.guestName || '').toLowerCase();
      const city     = String(i.guestCity || '').toLowerCase();
      const country  = String(i.guestCountry || '').toLowerCase();
      // Owner-verified guest fields (set during verification step)
      const vGuests  = String(i.ownerGuestNames || '').toLowerCase();
      const vCity    = String(i.ownerGuestCity || '').toLowerCase();
      const vCountry = String(i.ownerGuestCountry || '').toLowerCase();
      // Individual verified guest records (firstName, lastName, city, country)
      const guestDetails = Array.isArray(i.ownerGuests)
        ? i.ownerGuests.map(g => [g.firstName, g.middleName, g.lastName, g.city, g.country].filter(Boolean).join(' ')).join(' ').toLowerCase()
        : '';
      return apt.includes(q) || owner.includes(q) || operator.includes(q) || desc.includes(q) || type.includes(q) || reporter.includes(q) || genFlag.includes(q) || guest.includes(q) || city.includes(q) || country.includes(q) || vGuests.includes(q) || vCity.includes(q) || vCountry.includes(q) || guestDetails.includes(q);
    });
  }
  // Date range filter — filter by incident date (i.date is YYYY-MM-DD)
  if (dateFrom) list = list.filter(i => String(i.date || i.createdAt || '').slice(0, 10) >= dateFrom);
  if (dateTo)   list = list.filter(i => String(i.date || i.createdAt || '').slice(0, 10) <= dateTo);
  const actionWeight = (inc) => {
    if (!user?.uid) return 2;
    const isMyListing = listings.find(l => l.id === inc.aptId)?.ownerUid === user.uid;
    const hasPendingRes = inc.status === 'verified' && !String(inc.ownerResolution || '').trim();
    if ((inc.status === 'open' || hasPendingRes) && isMyListing) return 0;
    if ((isGlobalAdmin || canResolveGlobal) && inc.status === 'verified' && String(inc.ownerResolution || '').trim()) return 1;
    return 2;
  };
  list.sort((a, b) => {
    const wa = actionWeight(a), wb = actionWeight(b);
    if (wa !== wb) return wa - wb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const isEn = lang === 'en';
  const anyFilter = sf !== 'all' || cf !== 'all' || scope !== 'all' || search.trim() !== '' || !!floorFilter || !!dateFrom || !!dateTo;
  const resetAll = () => { setSf('all'); setCf('all'); setScope('all'); setSearch(''); setFloorFilter(null); setDateFrom(''); setDateTo(''); };
  // ── Persist group open/close to localStorage; restore on mount ──────────────
  const WFG_KEY = 'kai_wfg_state';
  const [groupOpen, setGroupOpen] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(WFG_KEY) || '{}');
      return { open: s.open !== false, verified: !!s.verified, resolved: !!s.resolved };
    } catch { return { open: true, verified: false, resolved: false }; }
  });
  const toggleGroup = (k) => {
    setGroupOpen(s => {
      const n = { ...s, [k]: !s[k] };
      try { localStorage.setItem(WFG_KEY, JSON.stringify(n)); } catch {}
      return n;
    });
  };

  // ── Auto-expand/collapse based on active filter results ────────────────────
  // When a filter is active, expand groups that have matching incidents and
  // collapse empty groups.  Specific scope filters force-open the target group.
  useEffect(() => {
    const openC     = list.filter(i => i.status === 'open').length;
    const verifiedC = list.filter(i => i.status === 'verified').length;
    const resolvedC = list.filter(i => i.status === 'resolved').length;
    const noFilter  = scope === 'all' && sf === 'all' && cf === 'all' && !search.trim();

    if (noFilter) return; // No filter → leave user's saved state untouched

    setGroupOpen(prev => {
      const next = {
        // Groups with content stay open; empty groups collapse
        open:     openC > 0     ? (scope === 'ownerVerification' ? true : prev.open)     : false,
        verified: verifiedC > 0 ? (scope === 'needsResolution' || scope === 'requiresResolution' ? true : prev.verified) : false,
        resolved: resolvedC > 0 ? prev.resolved : false,
      };
      // Force-open the primary group for each focused scope
      if (scope === 'ownerVerification'  && openC > 0)     next.open = true;
      if (scope === 'needsResolution'    && verifiedC > 0) next.verified = true;
      if (scope === 'requiresResolution' && verifiedC > 0) next.verified = true;
      if (scope === 'iReported' || scope === 'myListings') {
        if (openC > 0)     next.open = true;
        if (verifiedC > 0) next.verified = true;
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, sf, cf, search]);

  // Break verified group down so users understand which are blocked vs ready
  const verifiedAll = list.filter(i => i.status === 'verified');
  const verifiedPendingRes = verifiedAll.filter(i => !String(i.ownerResolution || '').trim()).length;
  const verifiedReady      = verifiedAll.filter(i =>  String(i.ownerResolution || '').trim()).length;
  const verifiedSublabel = verifiedAll.length === 0
    ? (isEn ? 'Awaiting admin resolution' : 'Esperando resolución del admin')
    : verifiedPendingRes > 0 && verifiedReady > 0
      ? (isEn ? `${verifiedPendingRes} awaiting owner resolution · ${verifiedReady} ready to close` : `${verifiedPendingRes} esperan resolución del propietario · ${verifiedReady} listos para cerrar`)
      : verifiedPendingRes > 0
        ? (isEn ? `${verifiedPendingRes} awaiting owner resolution` : `${verifiedPendingRes} esperan resolución del propietario`)
        : (isEn ? `${verifiedReady} ready to close` : `${verifiedReady} listos para cerrar`);

  const wfGroups = [
    { key:'open',     icon:'⚠️', color:'#d4634a', label: isEn ? '1 · Verify — Owner action required' : '1 · Verificar — Acción del propietario',  sublabel: isEn ? 'Step 1: Owner verifies incident and documents immediate action taken' : 'Paso 1: El propietario verifica el incidente y documenta la acción inmediata tomada' },
    { key:'verified', icon:'📝', color:'#0b7f4f', label: isEn ? '2 · In Progress' : '2 · En Progreso',                                              sublabel: verifiedSublabel },
    { key:'resolved', icon:'✓',  color:'#2e7d32', label: isEn ? '3 · Closed' : '3 · Cerrado',                                                       sublabel: isEn ? 'Resolved and filed by management' : 'Resuelto y archivado por administración' },
  ];

  return (
    <div className="fade">
      <div className="inc-tab-bar">
        <button className={`inc-tab${tab === 'unit' ? ' inc-tab-on' : ''}`} onClick={() => setTab('unit')}>
          ⚠️ {isEn ? 'Unit Incidents' : 'Incidentes de Unidad'}
          {unitOpenCount > 0 && <span className="inc-tab-badge">{unitOpenCount}</span>}
        </button>
        <button className={`inc-tab${tab === 'general' ? ' inc-tab-on' : ''}`} onClick={() => setTab('general')}>
          📢 {isEn ? 'General Incidents' : 'Incidentes Generales'}
          {generalOpenCount > 0 && <span className="inc-tab-badge">{generalOpenCount}</span>}
        </button>
      </div>
      {tab === 'general'
        ? <GeneralIncidentsView canResolveGlobal={canResolveGlobal} onIncidentDetail={onIncidentDetail} onAssign={onAssign} onClose={onCloseGeneral} embedded={true}/>
        : <>
      <div className="ph">
        <div>
          <h1 className="ptitle">{appText(lang, "reports.title")}</h1>
          <p className="psub">{appText(lang, "reports.subtitle", { total: list.length, open: list.filter(i => i.status === "open").length })}</p>
        </div>
        {user && <button className="btn-p btn-report" onClick={onAdd}>{appText(lang, "reports.reportIncident")}</button>}
      </div>

      {/* Floor filter banner — shown when navigated from Units page stat pill or unit detail */}
      {floorFilter && (
        <div className="floor-filter-banner">
          <span>🏢 {isEn ? 'Filtered to unit' : 'Filtrado a unidad'}{floorFilter.aptIds?.length === 1 ? ' ' + floorFilter.aptIds[0] : ''}{floorFilter.status && floorFilter.status !== 'all' ? ' · ' : ''}<strong>{{
            open:             isEn ? '⚠️ Needs verification' : '⚠️ Requieren verificación',
            pendingResolution:isEn ? '📝 Needs resolution (Step 2)' : '📝 Necesitan resolución (Paso 2)',
            awaitingAdmin:    isEn ? '⏳ Awaiting admin review' : '⏳ Esperando revisión del admin',
            resolved:         isEn ? '✓ Closed' : '✓ Cerrados',
            verified:         isEn ? 'In progress' : 'En progreso',
            all:              '',
          }[floorFilter.status] || floorFilter.status}</strong></span>
          <button className="ffb-clear" onClick={() => setFloorFilter(null)}>✕ {isEn ? 'Show all' : 'Ver todos'}</button>
        </div>
      )}
      <div className="inc-filters-bar">
        <div className="inc-search-wrap" style={{flex:'1 1 200px',minWidth:0}}>
          <input className="search inc-search" placeholder={appText(lang, "incidents.search")} value={search} onChange={e => setSearch(e.target.value)}/>
          {search && <button className="inc-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="inc-date-range">
          <label className="inc-date-lbl">{isEn ? 'From' : 'Desde'}</label>
          <input type="date" className="inc-date-input" value={dateFrom} max={dateTo || ''} onChange={e => setDateFrom(e.target.value)}/>
          <span className="inc-date-sep">–</span>
          <label className="inc-date-lbl">{isEn ? 'To' : 'Hasta'}</label>
          <input type="date" className="inc-date-input" value={dateTo} min={dateFrom || ''} onChange={e => setDateTo(e.target.value)}/>
          {(dateFrom || dateTo) && <button className="inc-search-clear" style={{position:'static',transform:'none',marginLeft:2}} onClick={() => { setDateFrom(''); setDateTo(''); }}>✕</button>}
        </div>
      </div>

      <div className="wfg-filters">
        <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
          <button className={`fchip fchip-sm ${scope === 'all' ? 'fchip-on' : ''}`} onClick={() => { setScope('all'); setSf('all'); }}>
            {isEn ? 'All' : 'Todos'}
          </button>
          {user && <>
            <button className={`fchip fchip-sm ${scope === 'iReported' ? 'fchip-on' : ''}`} onClick={() => { setScope(scope === 'iReported' ? 'all' : 'iReported'); setSf('all'); }}>
              📋 {isEn ? 'I reported' : 'Yo reporté'}
            </button>
            <button className={`fchip fchip-sm ${scope === 'myListings' ? 'fchip-on' : ''}`} onClick={() => { setScope(scope === 'myListings' ? 'all' : 'myListings'); setSf('all'); }}>
              🏠 {isEn ? 'My listings' : 'Mis listings'}
            </button>
          </>}
          {/* Pending resolution — available to all authenticated users:
              owners see their listings waiting for their resolution note;
              admins/delegates see all verified incidents missing a resolution */}
          <button className={`fchip fchip-sm ${scope === 'needsResolution' ? 'fchip-on fchip-warn' : ''}`} onClick={() => { setScope(scope === 'needsResolution' ? 'all' : 'needsResolution'); setSf('all'); setFloorFilter(null); }}>
            📝 {isEn ? 'Add resolution' : 'Agregar resolución'}
          </button>
          {/* Ready to close — admins/delegates only: verified + owner resolution provided */}
          {(isGlobalAdmin || canResolveGlobal) && (
            <button className={`fchip fchip-sm ${scope === 'requiresResolution' ? 'fchip-on fchip-resolve' : ''}`} onClick={() => { setScope(scope === 'requiresResolution' ? 'all' : 'requiresResolution'); setSf('all'); }}>
              🛠️ {isEn ? 'Ready to close' : 'Listos para cerrar'}
            </button>
          )}
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
          {GUEST_CATEGORIES.map(c => <button key={c.value} className={`fchip fchip-sm ${cf === c.value ? 'fchip-on' : ''}`} onClick={() => setCf(cf === c.value ? 'all' : c.value)}>{c.icon} {categoryLabel(c.value, lang)}</button>)}
          {anyFilter && <button className="fchip fchip-sm fchip-reset" onClick={resetAll}>✕ {isEn ? 'Reset' : 'Limpiar'}</button>}
        </div>
      </div>

      <div className="wfg-list">
        {wfGroups.map(g => (
          <WorkflowGroup
            key={g.key}
            statusKey={g.key}
            icon={g.icon}
            color={g.color}
            label={g.label}
            sublabel={g.sublabel}
            incidents={list.filter(i => i.status === g.key)}
            listings={listings}
            isOpen={groupOpen[g.key]}
            onToggle={() => toggleGroup(g.key)}
            contactProps={contactProps}
            isGlobalAdmin={isGlobalAdmin}
            canUpdateGlobal={canUpdateGlobal}
            canDeleteGlobal={canDeleteGlobal}
            canResolveGlobal={canResolveGlobal}
            onResolve={onResolve}
            onDelete={onDelete}
            onVerify={onVerify}
            onAddResolution={onAddResolution}
            onUnitDetail={onUnitDetail}
            onIncidentDetail={onIncidentDetail}
            onAssign={onAssign}
            onCloseGeneral={onCloseGeneral}
          />
        ))}
      </div>
      </>}
    </div>
  );
}
