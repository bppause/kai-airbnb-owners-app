// AuditLogViewer — admin view of /api/admin/audit-logs with entity/actor/
// date filters and pagination. Entity chips with emoji icons; per-row
// before/after diff details (collapsible).
//
// Lifted byte-identical from App.jsx in stage F20. Pulls user + lang
// via useApp() (isEn derived internally — both `lang` and `isEn` were
// previously redundant props).
//
// AUDIT_ENTITIES is co-located here since it was only referenced by
// this component.
//
// Opens platform/audit/ for future audit views (per-entity history,
// actor activity, etc.).
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F20.

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../../core/app-state";
import { api } from "../../../core/api";

const AUDIT_ENTITIES = ['all','listing','incident','user_role','app_config','registration','email_template'];

export default function AuditLogViewer() {
  const { user, lang } = useApp();
  const isEn = lang === 'en';
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState('all');
  const [actor, setActor] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const load = useCallback(async (off=0, ps=pageSize) => {
    if(!user?.uid) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ uid:user.uid, email:user.email||'', limit:ps, offset:off });
      if(entity && entity!=='all') p.set('entity', entity);
      if(actor.trim()) p.set('actor', actor.trim());
      if(dateFrom) p.set('dateFrom', dateFrom);
      if(dateTo) p.set('dateTo', dateTo);
      const r = await api.get('/api/admin/audit-logs?' + p.toString());
      setLogs(r.logs || []);
      setTotal(r.total || 0);
      setOffset(off);
    } catch(e) { console.error('[AUDIT_LOG]', e); }
    finally { setLoading(false); }
  }, [user?.uid, user?.email, entity, actor, dateFrom, dateTo]);
  useEffect(() => { load(0); }, []); // eslint-disable-line
  const fmt = (ts) => { try{ return new Date(ts).toLocaleString(isEn?'en-US':'es-CO',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch{ return ts||''; }};
  const entityLabel = (e) => ({ listing:'🏠',incident:'⚠️',user_role:'👥',app_config:'⚙️',registration:'📝',email_template:'📨' }[e]||'•') + ' ' + (e||'');
  return (
    <div className="audit-wrap">
      {/* Filters */}
      <div className="audit-filters">
        <select className="audit-select" value={entity} onChange={e=>setEntity(e.target.value)}>
          {AUDIT_ENTITIES.map(e=><option key={e} value={e}>{e==='all'?(isEn?'All entities':'Todas las entidades'):entityLabel(e)}</option>)}
        </select>
        <input className="audit-input" placeholder={isEn?'Filter by actor email…':'Filtrar por email del actor…'} value={actor} onChange={e=>setActor(e.target.value)}/>
        <input type="date" className="audit-input audit-date" value={dateFrom} max={dateTo||''} onChange={e=>setDateFrom(e.target.value)} title={isEn?'From date':'Desde'}/>
        <span style={{color:'#8a9fa5',flexShrink:0}}>–</span>
        <input type="date" className="audit-input audit-date" value={dateTo} min={dateFrom||''} onChange={e=>setDateTo(e.target.value)} title={isEn?'To date':'Hasta'}/>
        <select className="audit-select" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); load(0, Number(e.target.value));}}>
          {[10,25,50,100].map(n=><option key={n} value={n}>{n} {isEn?'per page':'por página'}</option>)}
        </select>
        <button className="btn-p" style={{minHeight:36,padding:'6px 14px',flexShrink:0}} onClick={()=>load(0)} disabled={loading}>
          {loading?'…':(isEn?'Search':'Buscar')}
        </button>
        {(entity!=='all'||actor||dateFrom||dateTo)&&
          <button className="btn-ghost" style={{minHeight:36,padding:'6px 10px',flexShrink:0}} onClick={()=>{setEntity('all');setActor('');setDateFrom('');setDateTo('');setTimeout(()=>load(0),0);}}>✕</button>}
      </div>
      {/* Stats bar */}
      <div className="audit-stats-bar">
        <span>{isEn?`${total} total entries`:`${total} entradas totales`}</span>
        {total>pageSize&&<span style={{opacity:.6}}>{isEn?`Showing ${offset+1}–${Math.min(offset+pageSize,total)}`:`Mostrando ${offset+1}–${Math.min(offset+pageSize,total)}`}</span>}
      </div>
      {/* Table */}
      {loading
        ? <div style={{padding:'18px 0',color:'#2a5a6a',display:'flex',alignItems:'center',gap:8}}><span className="spinner-sm"/> {isEn?'Loading…':'Cargando…'}</div>
        : logs.length===0
          ? <div style={{padding:'20px 0',color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'No entries found for the selected filters.':'No se encontraron entradas con los filtros seleccionados.'}</div>
          : <div className="table-wrap">
              <table className="admin-table audit-table">
                <thead><tr>
                  <th>{isEn?'Time':'Fecha/hora'}</th>
                  <th>{isEn?'Entity':'Entidad'}</th>
                  <th>{isEn?'Action':'Acción'}</th>
                  <th>{isEn?'Actor':'Actor'}</th>
                  <th>{isEn?'Details':'Detalles'}</th>
                </tr></thead>
                <tbody>
                  {logs.map((r,i)=>(
                    <tr key={r.id||i}>
                      <td style={{whiteSpace:'nowrap',fontSize:'.72rem',color:'#496674'}}>{fmt(r.created_at)}</td>
                      <td><span className="audit-entity-chip">{entityLabel(r.entity)}</span>{r.entity_id&&<code className="audit-id">{String(r.entity_id).slice(0,8)}…</code>}</td>
                      <td><span className="audit-action">{r.action}</span></td>
                      <td style={{fontSize:'.74rem',color:'#17313a',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.actor_email||r.actor_uid||'—'}</td>
                      <td>
                        {(r.before||r.after)&&(
                          <details className="audit-detail">
                            <summary className="audit-detail-toggle">{isEn?'diff':'diff'}</summary>
                            <div className="audit-detail-body">
                              {r.before&&<div><strong>Before:</strong><pre className="audit-json">{JSON.stringify(r.before,null,2)}</pre></div>}
                              {r.after&&<div><strong>After:</strong><pre className="audit-json">{JSON.stringify(r.after,null,2)}</pre></div>}
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
      {/* Pagination */}
      {total>pageSize&&(
        <div className="audit-pagination">
          <button className="btn-ghost bsm" disabled={offset===0||loading} onClick={()=>load(Math.max(0,offset-pageSize))}>← {isEn?'Prev':'Anterior'}</button>
          <span style={{fontSize:'.78rem',color:'#496674'}}>{Math.floor(offset/pageSize)+1} / {Math.ceil(total/pageSize)}</span>
          <button className="btn-ghost bsm" disabled={offset+pageSize>=total||loading} onClick={()=>load(offset+pageSize)}>{isEn?'Next':'Siguiente'} →</button>
        </div>
      )}
    </div>
  );
}
