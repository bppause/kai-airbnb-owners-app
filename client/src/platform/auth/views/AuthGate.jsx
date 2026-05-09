// AuthGate — full-page sign-in gate. Shows community selector (when more
// than one is enabled), brand logo + welcome copy, mission cards, login
// rules, first-access banner, tutorial links, and the Google sign-in
// button. Persists the selected community to localStorage so the same
// brand renders on the next visit.
//
// Lifted byte-identical from App.jsx in stage F23. Pulls lang via useApp();
// onLogin, setLang, complexLogo/NameEs/NameEn/Location/Bg, onCommunity-
// Select stay as per-instance props.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F23.

import React, { useState, useEffect } from "react";
import { APP_VERSION } from "../../../version.js";
import { useApp } from "../../../core/app-state";
import { getT } from "../../../core/i18n";
import { appText } from "../../../core/i18n/app-text";
import { CSS } from "../../../core/styles";
import LanguageSwitch from "../../../core/ui/LanguageSwitch";
import GoogleIcon from "../../../core/ui/GoogleIcon";
import CommunityMissionCards from "../components/CommunityMissionCards";

export default function AuthGate({ onLogin, setLang=()=>{}, complexLogo='', complexNameEs='Propietarios Airbnb KAI', complexNameEn='KAI Airbnb Owners', complexLocation='Serena del Mar · Cartagena 🇨🇴', complexBg='/morros-kai-bg.jpg', onCommunitySelect }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [communities, setCommunities] = useState([]);
  const [selectedId, setSelectedId] = useState(() => { try { return localStorage.getItem('kai_community') || ''; } catch(e) { return ''; } });
  const [search, setSearch] = useState('');
  const [displayLogo, setDisplayLogo] = useState(complexLogo);
  const [displayNameEs, setDisplayNameEs] = useState(complexNameEs);
  const [displayNameEn, setDisplayNameEn] = useState(complexNameEn);
  const [displayLocation, setDisplayLocation] = useState(complexLocation);
  const [displayBg, setDisplayBg] = useState(complexBg);

  useEffect(() => {
    fetch('/api/communities/public').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      if (!d.communitiesEnabled) {
        // feature disabled — auto-select the default
        const defId = d.defaultCommunityId || 'kai';
        if (!selectedId) {
          setSelectedId(defId);
          onCommunitySelect?.(defId, null);
        }
        return;
      }
      if (d.communities?.length) {
        setCommunities(d.communities);
        const saved = selectedId || '';
        const match = d.communities.find(c => c.id === saved);
        if (match) { applyCommunityCfg(match); onCommunitySelect?.(match.id, match); }
        else if (d.communities.length === 1) {
          const c = d.communities[0];
          setSelectedId(c.id); applyCommunityCfg(c); onCommunitySelect?.(c.id, c);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/communities/${selectedId}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { applyCommunityCfg(d); onCommunitySelect?.(selectedId, d); }
    }).catch(() => {});
  }, [selectedId]);

  const applyCommunityCfg = (cfg) => {
    if (!cfg) return;
    if (cfg.name) setDisplayNameEs(cfg.name);
    if (cfg.name_en || cfg.name) setDisplayNameEn(cfg.name_en || cfg.name);
    if (cfg.city || cfg.country) setDisplayLocation([cfg.city, cfg.country].filter(Boolean).join(' · '));
    if (cfg.logo_url) setDisplayLogo(cfg.logo_url);
    if (cfg.background_url) setDisplayBg(cfg.background_url);
  };

  const handleCommunityChange = (id) => {
    setSelectedId(id);
    try { localStorage.setItem('kai_community', id); } catch(e) {}
    const c = communities.find(x => x.id === id);
    if (c) { applyCommunityCfg(c); onCommunitySelect?.(id, c); }
  };

  const complexName = isEn ? displayNameEn : displayNameEs;
  const loginTitle = isEn ? `Welcome to ${displayNameEn}` : `Bienvenido a ${displayNameEs}`;
  const loginSub = `${complexName} · ${displayLocation}`;
  const logoSrc = displayLogo || '/morros-kai.png';
  const t = getT(lang);
  const bgStyle = displayBg ? { backgroundImage:`url(${displayBg})`, backgroundSize:'cover', backgroundPosition:'center' } : {};
  return (
    <div className="app-shell gate-shell gate-shell-bg" style={bgStyle}><style>{CSS}</style>
      <div className="gate-shell-overlay"/>
      <div className="gate-card welcome-card">
        <div className="gate-lang"><LanguageSwitch lang={lang} setLang={setLang} /></div>
        {communities.length > 1 && (
          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:'.75rem',fontWeight:600,color:'rgba(47,79,58,.7)',marginBottom:4}}>{isEn ? 'Select your community' : 'Selecciona tu comunidad'}</label>
            <input
              type="text"
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder={isEn ? 'Search communities...' : 'Buscar comunidad...'}
              style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1.5px solid rgba(47,79,58,.25)',fontSize:'.9rem',background:'rgba(255,255,255,.85)',color:'#1a3c2a',boxSizing:'border-box',marginBottom:6}}
            />
            <div style={{maxHeight:180,overflowY:'auto',borderRadius:8,border:'1px solid rgba(47,79,58,.15)',background:'rgba(255,255,255,.9)'}}>
              {communities.filter(c=>{
                if(!search.trim()) return true;
                const q=search.trim().toLowerCase();
                return [c.name,c.name_en,c.city,c.country,c.tower].filter(Boolean).some(v=>v.toLowerCase().includes(q));
              }).map(c=>(
                <div key={c.id}
                  onClick={()=>handleCommunityChange(c.id)}
                  style={{padding:'8px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid rgba(47,79,58,.08)',background:selectedId===c.id?'rgba(47,79,58,.1)':'transparent'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:'.85rem',color:'#1a3c2a'}}>{isEn?(c.name_en||c.name):c.name}</div>
                    {(c.city||c.country)&&<div style={{fontSize:'.73rem',color:'rgba(47,79,58,.6)'}}>{[c.city,c.country].filter(Boolean).join(' · ')}</div>}
                  </div>
                  {selectedId===c.id&&<span style={{color:'#2F4F3A',fontSize:'1rem'}}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="welcome-brand">
          <img src={logoSrc} className="welcome-logo" alt={complexName}/>
          <div>
            <h1 className="ptitle">{loginTitle}</h1>
            <p className="psub">{loginSub}</p>
          </div>
        </div>
        <div className="welcome-hero">
          <p>{t.loginHero}</p>
        </div>
        <CommunityMissionCards compact lang={lang} config={{}} />
        <div className="login-rules">
          <h3>{t.rulesTitle}</h3>
          <ul>{t.rules.map((r,i)=><li key={i}>{r}</li>)}</ul>
        </div>
        <div className="first-access-box">
          <strong>{t.firstAccess}</strong> {t.firstAccessText}
        </div>
        <p className="secure-copy">{t.secure}</p>
        <div className="login-tutorials" style={{margin:'14px 0 6px',padding:'12px',borderRadius:12,background:'rgba(11,127,79,.06)',border:'1px solid rgba(11,127,79,.18)'}}>
          <div style={{fontSize:'.78rem',fontWeight:800,color:'#0b7f4f',textAlign:'center',marginBottom:8,letterSpacing:'.02em'}}>
            {lang==='en' ? '🎬 New here? Watch a quick tutorial' : '🎬 ¿Nuevo aquí? Mira un tutorial rápido'}
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
            <a href="/tutorial-short.html" target="_blank" rel="noopener noreferrer"
               style={{flex:'1 1 150px',padding:'10px 12px',borderRadius:10,background:'linear-gradient(135deg,#0b7f4f,#0b7f8c)',color:'#fff',fontWeight:800,fontSize:'.82rem',textDecoration:'none',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:6,boxShadow:'0 4px 12px rgba(11,127,79,.22)'}}>
              ▶ {lang==='en' ? 'Short tutorial · 90 s' : 'Tutorial corto · 90 s'}
            </a>
            <a href="/tutorial-full.html" target="_blank" rel="noopener noreferrer"
               style={{flex:'1 1 150px',padding:'10px 12px',borderRadius:10,background:'#fff',color:'#0b7f4f',fontWeight:800,fontSize:'.82rem',textDecoration:'none',textAlign:'center',border:'1.5px solid rgba(11,127,79,.35)',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              🎥 {lang==='en' ? 'Full tutorial' : 'Tutorial completo'}
            </a>
          </div>
          <div style={{marginTop:10,padding:'8px 10px',background:'rgba(11,127,140,.08)',borderRadius:8,fontSize:'.74rem',color:'#235f72',lineHeight:1.45}}>
            📧 <strong>{lang==='en' ? 'Email notifications:' : 'Notificaciones por email:'}</strong>{' '}
            {lang==='en'
              ? 'each tutorial slide shows exactly which emails you\'ll receive (registration, listing, incident step 1/2, SLA reminders) and which mailbox they\'ll arrive at — your Google account and the operator email if different.'
              : 'cada slide del tutorial indica exactamente qué emails recibirás (registro, listing, incidente paso 1/2, recordatorios SLA) y a qué buzón llegan — tu cuenta de Google y el email del operador si es distinto.'}
          </div>
          <div style={{textAlign:'center',marginTop:8}}>
            <a href="/guide.html" target="_blank" rel="noopener noreferrer" style={{fontSize:'.78rem',color:'#0b7f8c',fontWeight:700,textDecoration:'none'}}>
              {lang==='en' ? '📖 Or read the written guide' : '📖 O lee la guía escrita'}
            </a>
          </div>
        </div>
        <div className="google-switch-help"><strong>{appText(lang,"login.switchGoogleTitle")}</strong><br/>{appText(lang,"login.switchGoogleHelp")}<br/><span>{appText(lang,"login.switchGoogleSteps")}</span></div>
        <button className="btn-google gate-btn" onClick={onLogin} title={appText(lang,"login.switchGoogleHelp")}><GoogleIcon/> {t.google}</button>
        <div style={{marginTop:16,fontSize:'.68rem',color:'rgba(47,79,58,.4)',textAlign:'center',letterSpacing:'.04em'}}>{complexName} · v{APP_VERSION}</div>
      </div>
    </div>
  );
}
