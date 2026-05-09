// ProfileView — top-level /profile tab. Three editable sections (contact
// WhatsApp, optional notification email, communities switcher) plus a
// reputation/trust-score panel. Read-only Google account display at top.
//
// Lifted byte-identical from App.jsx in stage F22. Pulls lang via useApp();
// user, userProfile, communities/currentCommunityId/onSwitchCommunity,
// reputation/reputationLoading/loadReputation, and onSave stay as
// per-instance props.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F22.

import React, { useState, useEffect } from "react";
import { useApp } from "../../../core/app-state";
import { OWNER_COUNTRIES, applyDialCode, validateWhatsApp } from "../../../core/utils";

export default function ProfileView({ user, userProfile, onSave, communities=[], currentCommunityId='', onSwitchCommunity, reputation=null, reputationLoading=false, loadReputation=()=>{} }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [country, setCountry] = useState(userProfile.country || 'Colombia');
  const [whatsapp, setWhatsapp] = useState(userProfile.whatsapp || '');
  const [notificationEmail, setNotificationEmail] = useState(userProfile.notificationEmail || '');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Sync when profile loads from server
  useEffect(() => { setWhatsapp(userProfile.whatsapp || ''); }, [userProfile.whatsapp]);
  useEffect(() => { setCountry(userProfile.country || 'Colombia'); }, [userProfile.country]);
  useEffect(() => { setNotificationEmail(userProfile.notificationEmail || ''); }, [userProfile.notificationEmail]);

  const handleCountryChange = (val) => {
    const code = OWNER_COUNTRIES.find(c=>c.name===val)?.code||'';
    setCountry(val);
    setWhatsapp(applyDialCode(whatsapp, code));
    setError('');
  };

  const validate = () => {
    if (!String(whatsapp||'').trim()) { setError(isEn ? 'WhatsApp is required' : 'WhatsApp es requerido'); return false; }
    const err = validateWhatsApp(whatsapp, lang);
    if (err) { setError(err); return false; }
    setError('');
    const ne = String(notificationEmail||'').trim();
    if (ne && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) {
      setEmailError(isEn ? 'Enter a valid email address' : 'Ingresa un email válido');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave({ whatsapp: whatsapp.trim(), country, notificationEmail: notificationEmail.trim() }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">👤 {isEn ? 'My profile' : 'Mi perfil'}</h1>
          <p className="psub">{isEn ? 'Your contact info is used across all your listings.' : 'Tu información de contacto se usa en todos tus listings.'}</p>
        </div>
      </div>

      <div className="prof-card">
        {/* ── Account (read-only) ─────────────────── */}
        <div className="prof-section">
          <div className="prof-section-hdr">🔒 {isEn ? 'Account (Google)' : 'Cuenta (Google)'}</div>
          <div className="prof-ro-grid">
            <div className="prof-ro-row">
              <span className="prof-ro-lbl">{isEn ? 'Name' : 'Nombre'}</span>
              <span className="prof-ro-val">{user.name || '—'}</span>
            </div>
            <div className="prof-ro-row">
              <span className="prof-ro-lbl">Email</span>
              <span className="prof-ro-val">{user.email || '—'}</span>
            </div>
          </div>
        </div>

        {/* ── Editable contact ────────────────────── */}
        <div className="prof-section">
          <div className="prof-section-hdr">📱 {isEn ? 'Contact' : 'Contacto'}</div>
          <p style={{fontSize:'.84rem',color:'#2a5a6a',margin:'0 0 14px',lineHeight:1.5}}>
            {isEn ? 'Used as the contact WhatsApp for all your listings. Updating this will apply to all apartments you own.' : 'Se usa como WhatsApp de contacto en todos tus listings. Al actualizar aquí se aplica a todos tus apartamentos.'}
          </p>
          <div className="fg2" style={{maxWidth:360}}>
            <div className="fg full">
              <label>🌍 {isEn ? 'Country' : 'País'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
              <select value={country} onChange={e=>handleCountryChange(e.target.value)}>
                {OWNER_COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.name}{c.code?' ('+c.code+')':''}</option>)}
              </select>
            </div>
            <div className="fg full">
              <label>WhatsApp <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
              <input className={error?'field-error':''} type="tel" value={whatsapp} onChange={e=>{setWhatsapp(e.target.value);setError('');}} onBlur={e=>{let v=String(e.target.value||'').trim();if(!v){setError(isEn?'WhatsApp is required':'WhatsApp es requerido');return;}const digits=v.replace(/[^0-9]/g,'');if(!v.startsWith('+')&&digits.length>=10){v='+'+digits;setWhatsapp(v);}const err=validateWhatsApp(v,lang);if(err)setError(err);else setError('');}} placeholder="+57 300 000 0000"/>
              {error ? <span className="err-msg">{error}</span> : <span className="help-msg">{isEn?'With country code, e.g. +57 300 000 0000':'Con código de país, ej. +57 300 000 0000'}</span>}
            </div>
          </div>
        </div>

        {/* ── Notification email ───────────────────── */}
        <div className="prof-section">
          <div className="prof-section-hdr">✉️ {isEn ? 'Notification email' : 'Email de notificaciones'}</div>
          <p style={{fontSize:'.84rem',color:'#2a5a6a',margin:'0 0 14px',lineHeight:1.5}}>
            {isEn
              ? 'Optional. If set, notifications will be sent here instead of your Google email.'
              : 'Opcional. Si lo configuras, las notificaciones llegarán aquí en lugar de a tu email de Google.'}
          </p>
          <div className="fg2" style={{maxWidth:360}}>
            <div className="fg full">
              <label>{isEn ? 'Notification email' : 'Email alternativo'} <span style={{color:'#70d6c6',fontStyle:'italic',fontSize:'0.68rem'}}>({isEn?'optional':'opcional'})</span></label>
              <input className={emailError?'field-error':''} type="email" value={notificationEmail} onChange={e=>{setNotificationEmail(e.target.value);setEmailError('');}} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))setEmailError(isEn?'Enter a valid email address':'Ingresa un email válido');else setEmailError('');}} placeholder="otro@email.com"/>
              {emailError ? <span className="err-msg">{emailError}</span> : <span className="help-msg">{isEn?'Leave blank to use your Google email':'Deja en blanco para usar tu email de Google'}</span>}
            </div>
          </div>
        </div>

        {/* ── Communities ─────────────────────────── */}
        {communities.length > 0 && (
          <div className="prof-section">
            <div className="prof-section-hdr">🌐 {isEn ? 'My communities' : 'Mis comunidades'}</div>
            <p style={{fontSize:'.84rem',color:'#2a5a6a',margin:'0 0 14px',lineHeight:1.5}}>
              {isEn ? 'Communities you belong to. Switch without logging out.' : 'Comunidades a las que perteneces. Cambia sin cerrar sesión.'}
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {communities.map(c => {
                const isCurrent = c.id === currentCommunityId;
                const label = isEn ? (c.name_en || c.name) : c.name;
                const location = [c.city, c.country].filter(Boolean).join(', ');
                return (
                  <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,border:`1.5px solid ${isCurrent?'#2F4F3A':'#cce7ee'}`,background:isCurrent?'#f0f8f4':'#fafcfe',flexWrap:'wrap'}}>
                    {c.logo_url && <img src={c.logo_url} alt="" style={{width:32,height:32,objectFit:'contain',borderRadius:6,background:'#f5fbfd',padding:2,flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'.88rem',color:'#17313a'}}>{label}</div>
                      {(location || c.tower) && <div style={{fontSize:'.73rem',color:'#6b9ba8',marginTop:1}}>{[c.tower, location].filter(Boolean).join(' · ')}</div>}
                      {c.memberRole === 'community_admin' && <span className="chip c-teal" style={{fontSize:'.65rem',padding:'1px 7px',marginTop:3,display:'inline-block'}}>{isEn?'Admin':'Administrador'}</span>}
                    </div>
                    {isCurrent
                      ? <span className="chip c-teal" style={{fontSize:'.72rem',padding:'2px 10px',flexShrink:0}}>{isEn?'Current':'Actual'}</span>
                      : <button className="btn-ghost" style={{fontSize:'.78rem',padding:'5px 14px',flexShrink:0,minHeight:32}}
                          disabled={switching}
                          onClick={async()=>{setSwitching(true);try{await onSwitchCommunity?.(c.id);}finally{setSwitching(false);}}}>
                          {switching?'…':(isEn?'Switch':'Cambiar')}
                        </button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Reputation / Trust Score ── */}
        <div className="prof-section">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}>
            <div className="prof-section-hdr" style={{margin:0}}>🏅 {isEn?'Community reputation':'Reputación en la comunidad'}</div>
            {!reputation && !reputationLoading && <button className="btn-ghost" style={{fontSize:'.75rem',padding:'4px 10px'}} onClick={loadReputation}>{isEn?'Load':'Cargar'}</button>}
            {reputationLoading && <span className="spinner-sm"/>}
          </div>
          {!reputation && !reputationLoading && (
            <p style={{fontSize:'.82rem',color:'#6b9ba8',margin:0}}>{isEn?'Your trust score based on reporting history, response time, and community engagement.':'Tu puntuación de confianza basada en tu historial de reportes, tiempo de respuesta y participación comunitaria.'}</p>
          )}
          {reputation && (()=>{
            const r = reputation;
            const tierColor = r.tier==='pillar'?'#2F4F3A':r.tier==='active'?'#d9b45a':'#6b9ba8';
            const tierBg = r.tier==='pillar'?'#e8f5ec':r.tier==='active'?'#fef9c3':'#f0f8fb';
            const tierLabel = isEn ? r.tierEn : r.tierEs;
            return (
              <div>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14,flexWrap:'wrap'}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontFamily:'Playfair Display,serif',fontSize:'2rem',fontWeight:900,color:tierColor,lineHeight:1}}>{r.score}</div>
                    <div style={{fontSize:'.68rem',color:'#6b9ba8'}}>{isEn?'/ 100 pts':'/ 100 pts'}</div>
                  </div>
                  <div>
                    <span style={{background:tierBg,color:tierColor,border:`1px solid ${tierColor}44`,borderRadius:999,padding:'5px 14px',fontWeight:800,fontSize:'.85rem'}}>{tierLabel}</span>
                    <div style={{fontSize:'.72rem',color:'#6b9ba8',marginTop:6}}>
                      {r.tier==='resident'&&(isEn?'Keep reporting to become an Active Member':'Sigue reportando para convertirte en Miembro Activo')}
                      {r.tier==='active'&&(isEn?'Excellent! Keep it up to reach Community Pillar':'¡Excelente! Sigue así para alcanzar Pilar de la Comunidad')}
                      {r.tier==='pillar'&&(isEn?'Top tier — thank you for your commitment to the community':'Nivel máximo — gracias por tu compromiso con la comunidad')}
                    </div>
                  </div>
                </div>
                <div style={{background:'#f0f8fb',borderRadius:10,height:10,overflow:'hidden',marginBottom:14}}>
                  <div style={{height:'100%',borderRadius:10,background:`linear-gradient(90deg,${tierColor},${tierColor}bb)`,width:`${r.score}%`,transition:'width .6s'}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8}}>
                  {[
                    {label:isEn?'Reports submitted':'Reportes enviados', val:r.stats.reportCount, icon:'📋'},
                    {label:isEn?'Resolved reports':'Reportes resueltos', val:r.stats.resolvedReports, icon:'✅'},
                    {label:isEn?'Days in community':'Días en comunidad', val:r.stats.tenureDays, icon:'📅'},
                    {label:isEn?'My listings':'Mis listings', val:r.stats.listingCount, icon:'🏠'},
                  ].map(({label,val,icon})=>(
                    <div key={label} style={{background:'rgba(255,255,255,.85)',border:'1px solid rgba(47,79,58,.12)',borderRadius:12,padding:'10px',textAlign:'center'}}>
                      <div style={{fontSize:'1.1rem'}}>{icon}</div>
                      <div style={{fontFamily:'Playfair Display,serif',fontWeight:900,fontSize:'1.1rem',color:'#17313a'}}>{val}</div>
                      <div style={{fontSize:'.68rem',color:'#6b9ba8',lineHeight:1.3}}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:10,fontSize:'.72rem',color:'#8a9fa5',textAlign:'right'}}>
                  <button className="btn-ghost" style={{fontSize:'.7rem',padding:'2px 8px'}} onClick={loadReputation}>↻ {isEn?'Refresh':'Actualizar'}</button>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="prof-footer">
          <button className="btn-p" onClick={handleSave} disabled={saving}>
            {saving ? (isEn ? 'Saving…' : 'Guardando…') : (isEn ? '💾 Save changes' : '💾 Guardar cambios')}
          </button>
        </div>
      </div>
    </div>
  );
}
