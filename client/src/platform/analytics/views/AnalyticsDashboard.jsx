// AnalyticsDashboard — admin/owner analytics view (KPIs, breach table,
// rankings). Fetches /api/analytics with either a preset window
// (30/90/180/365/all days) or a custom date range. Owner sees their own
// listings; global admin sees portfolio-wide.
//
// Lifted byte-identical from App.jsx in stage F19. Pulls lang via
// useApp(); user, contactProps, showToast, isGlobalAdmin stay as
// per-instance props.
//
// Opens the platform/analytics/ folder for future analytics views
// (per-listing trends, owner reports, SLA dashboards, etc.).
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F19.

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../../core/app-state";
import { api } from "../../../core/api";
import { appText, aptDisplay } from "../../../core/i18n/app-text";
import { Empty } from "../../../core/ui/EmptyState";
import UserContact from "../../../core/contacts";

export default function AnalyticsDashboard({ user, contactProps={}, showToast=()=>{}, isGlobalAdmin=false }) {
  const { lang } = useApp();
  const [rangeMode, setRangeMode] = useState('preset');   // 'preset' | 'custom'
  const [days, setDays]           = useState('90');        // preset: 30|90|180|365|all
  const [startDate, setStartDate] = useState('');          // custom YYYY-MM-DD
  const [endDate, setEndDate]     = useState('');          // custom YYYY-MM-DD
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const isEn = lang==='en';

  // Today's date for max constraint on date inputs
  const todayISO = new Date().toISOString().slice(0,10);

  const buildUrl = useCallback(() => {
    let url = '/api/analytics?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '');
    if (rangeMode === 'custom' && startDate && endDate) {
      url += '&start=' + encodeURIComponent(startDate) + '&end=' + encodeURIComponent(endDate);
    } else {
      url += '&days=' + encodeURIComponent(days);
    }
    return url;
  }, [user?.uid, user?.email, rangeMode, days, startDate, endDate]);

  const load = useCallback(() => {
    if (!user?.uid) return;
    if (rangeMode === 'custom' && (!startDate || !endDate)) {
      showToast(isEn ? 'Select both start and end date' : 'Selecciona fecha inicio y fin', true);
      return;
    }
    setLoading(true);
    api.get(buildUrl())
      .then(setData)
      .catch(e => showToast((isEn ? 'Error loading analytics: ' : 'Error cargando analíticas: ') + (e.message || ''), true))
      .finally(() => setLoading(false));
  }, [buildUrl, user?.uid, rangeMode, startDate, endDate]);

  // Auto-load when preset changes
  useEffect(() => { if (rangeMode === 'preset') load(); }, [days, rangeMode]);
  // Initial load
  useEffect(() => { load(); }, [user?.uid]);

  const s = data?.summary || {};
  const bar=(rows=[])=> rows.length ? <div className="bar-list">{rows.map(r=>{ const max=Math.max(...rows.map(x=>x.count||0),1); return <div key={r.name} className="bar-row"><div className="bar-label">{r.name}</div><div className="bar-track"><span style={{width:`${Math.max(6,(r.count/max)*100)}%`}}/></div><div className="bar-count">{r.count}</div></div>;})}</div> : <Empty icon="📭" msg={appText(lang,"analytics.noData")}/>;
  const fmt=(d)=>d?new Date(d).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO',{dateStyle:'medium',timeStyle:'short'}):'';

  const windowDesc = data?.windowLabel
    ? (isEn ? `Showing: ${data.windowLabel}` : `Mostrando: ${data.windowLabel}`)
    : '';

  const presets = [
    { v:'30',  label: isEn ? '30 days' : '30 días' },
    { v:'90',  label: isEn ? '90 days' : '90 días' },
    { v:'180', label: isEn ? '180 days' : '180 días' },
    { v:'365', label: isEn ? '1 year'  : '1 año'   },
    { v:'all', label: isEn ? 'All time' : 'Todo el tiempo' },
  ];

  return <div className="fade">
    <div className="ph">
      <div>
        <h1 className="ptitle">{appText(lang,"analytics.title")}</h1>
        <p className="psub">{isGlobalAdmin ? appText(lang,"analytics.subtitleAdmin") : appText(lang,"analytics.subtitleUser")} · {appText(lang,"analytics.subtitleRest")}</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
        {/* ── Mode toggle ── */}
        <div className="an-range-bar">
          <div className="an-mode-toggle">
            <button className={`an-mode-btn${rangeMode==='preset'?' an-mode-on':''}`} onClick={()=>setRangeMode('preset')}>
              {isEn?'Presets':'Predefinido'}
            </button>
            <button className={`an-mode-btn${rangeMode==='custom'?' an-mode-on':''}`} onClick={()=>setRangeMode('custom')}>
              📅 {isEn?'Date range':'Rango de fechas'}
            </button>
          </div>
          {/* ── Preset pills ── */}
          {rangeMode==='preset' && (
            <div className="an-preset-pills">
              {presets.map(p=>(
                <button key={p.v} className={`an-preset-pill${days===p.v?' an-preset-on':''}`} onClick={()=>setDays(p.v)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {/* ── Custom date range ── */}
          {rangeMode==='custom' && (
            <div className="an-custom-range">
              <div className="an-date-group">
                <label className="an-date-lbl">{isEn?'From':'Desde'}</label>
                <input type="date" className="an-date-input" value={startDate} max={endDate||todayISO} onChange={e=>setStartDate(e.target.value)}/>
              </div>
              <span className="an-date-sep">→</span>
              <div className="an-date-group">
                <label className="an-date-lbl">{isEn?'To':'Hasta'}</label>
                <input type="date" className="an-date-input" value={endDate} min={startDate} max={todayISO} onChange={e=>setEndDate(e.target.value)}/>
              </div>
              <button className="btn-p" style={{alignSelf:'flex-end'}} onClick={load} disabled={!startDate||!endDate||loading}>
                {loading ? appText(lang,'analytics.loading') : (isEn?'Apply':'Aplicar')}
              </button>
            </div>
          )}
          {rangeMode==='preset' && <button className="btn-p" onClick={load} disabled={loading}>
            {loading ? appText(lang,'analytics.loading') : appText(lang,'analytics.refresh')}
          </button>}
        </div>
        {windowDesc && <div className="an-window-desc">{windowDesc}</div>}
      </div>
    </div>
    <div className="stats6">{[
      ['⚠️',s.openIncidents||0,appText(lang,'analytics.open'),'#d4634a'],['🚨',s.breachedSla||0,appText(lang,'analytics.breached'),'#c62828'],['⏳',s.dueSoon24h||0,appText(lang,'analytics.dueSoon'),'#e19a4b'],['✅',s.verifiedIncidents||0,appText(lang,'analytics.verified'),'#2F8F46'],['⏱️',`${s.avgResponseHours||0}h`,appText(lang,'analytics.avgResponse'),'#0b7f8c'],['🔁',s.escalationCycles||0,appText(lang,'analytics.cycles'),'#6a1b9a']
    ].map((x,i)=><div className="scard" key={i} style={{borderTop:`3px solid ${x[3]}`}}><div style={{fontSize:'1.4rem'}}>{x[0]}</div><div className="sval" style={{color:x[3]}}>{x[1]}</div><div className="slabel">{x[2]}</div></div>)}</div>
    <div className="card" style={{marginBottom:18}}><div className="card-hdr"><div><div className="card-title">{appText(lang,"analytics.breachedIncidents")}</div><div className="psub">{appText(lang,"analytics.breachedSub")}</div></div></div>{(data?.breachRows||[]).length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>{appText(lang,"analytics.table.apt")}</th><th>{appText(lang,"analytics.table.owner")}</th><th>{appText(lang,"analytics.table.operator")}</th><th>{appText(lang,"analytics.table.type")}</th><th>{appText(lang,"analytics.table.cycles")}</th><th>{appText(lang,"analytics.table.hoursOverdue")}</th><th>{appText(lang,"analytics.table.nextSla")}</th><th>{appText(lang,"analytics.table.desc")}</th></tr></thead><tbody>{data.breachRows.map(r=><tr key={r.id}><td><strong>{r.apt}</strong></td><td><UserContact name={r.owner} email={r.ownerEmail} apartments={r.apt?[aptDisplay(r.apt, lang)]:[]} {...contactProps}/><br/><small>{r.ownerEmail}</small></td><td><UserContact name={r.operator || (lang==='en'?'No operator':'Sin operador')} email={r.operatorEmail} apartments={r.apt?[aptDisplay(r.apt, lang)]:[]} {...contactProps}/><br/><small>{r.operatorEmail}</small></td><td>{r.type}<br/><small>{r.category}</small></td><td>{r.slaCycleCount}</td><td><strong style={{color:'#c62828'}}>{r.hoursOverdue}h</strong></td><td>{fmt(r.nextSlaReminderAt)}</td><td>{String(r.description||'').slice(0,120)}</td></tr>)}</tbody></table></div> : <Empty icon="✅" msg={appText(lang,"analytics.noBreached")}/>}</div>
    <div className="analytics-grid"><div className="card"><div className="card-title">{appText(lang,"analytics.topApartments")}</div>{bar(data?.rankings?.byApartment||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.topOperators")}</div>{bar(data?.rankings?.byOperator||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byType")}</div>{bar(data?.rankings?.byType||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byCategory")}</div>{bar(data?.rankings?.byCategory||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byStatus")}</div>{bar(data?.rankings?.byStatus||[])}</div><div className="card"><div className="card-title">{appText(lang,"analytics.byMonth")}</div>{bar(data?.rankings?.byMonth||[])}</div></div>
  </div>;
}
