// NavConfigEditor — admin editor for nav_config (per-role landing page +
// primary nav items). Rendered inside an AdminSection in AdminSettings.
//
// Co-located:
//   NAV_CONFIG_ITEMS — bilingual list of all navigable views
//   NAV_ROLES        — bilingual list of role tabs (user/delegate/global)
//   DEFAULT_NAV_CONFIG — fallback per-role config when no override is set
//
// Lifted byte-identical from App.jsx in stage F33. Pulls lang via
// useApp() (isEn derived internally — both `lang` and `isEn` were
// previously redundant props). Other props (config, onSave, showToast,
// defaultRole) stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F33.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";

// All navigable views and their labels (bilingual)
const NAV_CONFIG_ITEMS = [
  { id:'my',        labelEs:'Mis Unidades',        labelEn:'My Units' },
  { id:'incidents', labelEs:'Incidentes', labelEn:'Incidents' },
  { id:'general',   labelEs:'Incidentes Generales', labelEn:'General Incidents' },
  { id:'listings',  labelEs:'Inventario',    labelEn:'Inventory' },
  { id:'dashboard', labelEs:'Dashboard',     labelEn:'Dashboard' },
  { id:'notifications',labelEs:'Alertas',   labelEn:'Alerts' },
  { id:'about',     labelEs:'Misión',        labelEn:'Mission' },
  { id:'analytics', labelEs:'Analíticas',   labelEn:'Analytics' },
  { id:'approvals', labelEs:'Registros',    labelEn:'Registrations' },
  { id:'admin',     labelEs:'Admin',         labelEn:'Admin' },
];
const NAV_ROLES = [
  { key:'user',     labelEs:'Propietario',   labelEn:'Owner / User' },
  { key:'delegate', labelEs:'Admin Delegado',labelEn:'Delegate Admin' },
  { key:'global',   labelEs:'Admin Global',  labelEn:'Global Admin' },
];
const DEFAULT_NAV_CONFIG = {
  user:     { landing:'incidents', primary:['incidents','my','listings','dashboard'] },
  delegate: { landing:'incidents', primary:['incidents','my','listings','dashboard'] },
  global:   { landing:'incidents', primary:['incidents','my','listings','dashboard'] },
};

export default function NavConfigEditor({ config, onSave, showToast=()=>{}, defaultRole='global' }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [activeRole, setActiveRole] = useState(defaultRole);
  const [cfg, setCfg] = useState(()=>{
    try { return { ...DEFAULT_NAV_CONFIG, ...JSON.parse(config?.nav_config||'{}') }; }
    catch(e) { return { ...DEFAULT_NAV_CONFIG }; }
  });
  const [saving, setSaving] = useState(false);

  const roleCfg = cfg[activeRole] || DEFAULT_NAV_CONFIG[activeRole];

  const togglePrimary = (id) => {
    const cur = roleCfg.primary || [];
    const next = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id];
    setCfg(c=>({...c, [activeRole]:{...c[activeRole], primary:next}}));
  };
  const movePrimary = (id, dir) => {
    const cur = [...(roleCfg.primary||[])];
    const i = cur.indexOf(id); if(i<0) return;
    const j = i+dir; if(j<0||j>=cur.length) return;
    [cur[i],cur[j]] = [cur[j],cur[i]];
    setCfg(c=>({...c, [activeRole]:{...c[activeRole], primary:cur}}));
  };
  const setLanding = (v) => setCfg(c=>({...c, [activeRole]:{...c[activeRole], landing:v}}));

  const save = async () => {
    setSaving(true);
    await onSave(cfg);
    setSaving(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Role tabs */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {NAV_ROLES.map(r=>(
          <button key={r.key} type="button"
            style={{padding:'6px 14px',borderRadius:999,fontWeight:800,fontSize:'.78rem',border:'1.5px solid',cursor:'pointer',
              background:activeRole===r.key?'linear-gradient(135deg,#0b7f4f,#0b7f8c)':'rgba(255,255,255,.8)',
              color:activeRole===r.key?'#fff':'#17313a',borderColor:activeRole===r.key?'transparent':'rgba(47,79,58,.2)'}}
            onClick={()=>setActiveRole(r.key)}>
            {isEn?r.labelEn:r.labelEs}
          </button>
        ))}
      </div>
      {/* Landing page */}
      <div className="fg">
        <label>{isEn?'Default landing page':'Página de inicio por defecto'}</label>
        <select value={roleCfg.landing||'my'} onChange={e=>setLanding(e.target.value)}>
          {NAV_CONFIG_ITEMS.map(n=><option key={n.id} value={n.id}>{isEn?n.labelEn:n.labelEs}</option>)}
        </select>
      </div>
      {/* Primary nav items */}
      <div>
        <div style={{fontSize:'.78rem',fontWeight:900,color:'#17313a',marginBottom:8}}>{isEn?'Primary nav (shown in top bar)':'Nav principal (visible en la barra superior)'}</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {NAV_CONFIG_ITEMS.map(n=>{
            const inPrimary = (roleCfg.primary||[]).includes(n.id);
            const idx = (roleCfg.primary||[]).indexOf(n.id);
            return (
              <div key={n.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:inPrimary?'rgba(11,127,140,.06)':'rgba(47,79,58,.03)',borderRadius:8,border:'1px solid',borderColor:inPrimary?'rgba(11,127,140,.2)':'rgba(47,79,58,.1)'}}>
                <input type="checkbox" checked={inPrimary} onChange={()=>togglePrimary(n.id)} id={`ncp-${n.id}-${activeRole}`} style={{width:16,height:16,flexShrink:0,cursor:'pointer'}}/>
                <label htmlFor={`ncp-${n.id}-${activeRole}`} style={{flex:1,fontSize:'.82rem',fontWeight:700,color:'#17313a',cursor:'pointer'}}>{isEn?n.labelEn:n.labelEs}</label>
                {inPrimary&&<span style={{fontSize:'.7rem',color:'#496674',background:'rgba(47,79,58,.08)',padding:'2px 7px',borderRadius:999}}>#{idx+1}</span>}
                {inPrimary&&<button type="button" onClick={()=>movePrimary(n.id,-1)} disabled={idx===0} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.9rem',opacity:idx===0?.3:1,padding:'0 2px'}}>↑</button>}
                {inPrimary&&<button type="button" onClick={()=>movePrimary(n.id,1)} disabled={idx>=(roleCfg.primary||[]).length-1} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.9rem',opacity:idx>=(roleCfg.primary||[]).length-1?.3:1,padding:'0 2px'}}>↓</button>}
                {!inPrimary&&<span style={{fontSize:'.7rem',color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'More menu':'Menú más'}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <button className="btn-p" onClick={save} disabled={saving} style={{alignSelf:'flex-start'}}>
        {saving?(isEn?'Saving…':'Guardando…'):(isEn?'Save navigation config':'Guardar configuración de navegación')}
      </button>
    </div>
  );
}
