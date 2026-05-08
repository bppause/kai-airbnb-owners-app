// AdminFallback — error-boundary fallback for the /admin tab. Shows the
// thrown error, the previous saved UI error from localStorage, and
// reload / clear-saved-error buttons.
//
// Lifted byte-identical from App.jsx in stage F33. Pulls lang via
// useApp(); error stays per-instance.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F33.

import React from "react";
import { useApp } from "../../../core/app-state";
import { ui, lt } from "../../../core/i18n";

export default function AdminFallback({ error={} }){
  const { lang } = useApp();
  const saved = (()=>{ try { return localStorage.getItem('kai_last_ui_error') || localStorage.getItem('kai_last_admin_error') || ''; } catch(e) { return ''; } })();
  return <div className="fade"><div className="card" style={{borderLeft:'4px solid #d4634a'}}><h1 className="ptitle">{ui(lang,'adminCouldNotLoad')}</h1><p className="psub">{ui(lang,'adminErrorHelp')}</p>{error?.message && <div className="form-alert"><strong>Error:</strong> {error.message}</div>}{error?.stack && <pre className="codebox" style={{whiteSpace:'pre-wrap',marginTop:10}}>{error.stack}</pre>}{saved && <><div className="section-label" style={{marginTop:12}}>{lt(lang,'Último error de interfaz')}</div><pre className="codebox" style={{whiteSpace:'pre-wrap'}}>{saved}</pre></>}<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}><button className="btn-p" onClick={()=>window.location.reload()}>{ui(lang,'reload')}</button><button className="btn-ghost" onClick={()=>{try{localStorage.removeItem('kai_last_ui_error');localStorage.removeItem('kai_last_admin_error')}catch(e){};window.location.reload();}}>{lt(lang,'Limpiar error guardado')}</button></div></div></div>;
}
