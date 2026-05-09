// RegistrationListingForm — multi-listing registration form rendered
// inside RegistrationGate. Captures owner profile (country, WhatsApp)
// + one or more apartments with operator details. Validates apt format,
// duplicate apt within submission, and remote uniqueness via
// checkApartmentUnique. Tower auto-fills from the active community.
//
// Lifted byte-identical from App.jsx in stage F23. Pulls lang via useApp();
// user, onSubmit, submitText stay as per-instance props.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F23.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { appText, localizedTooltips, getDefaultTower } from "../../../core/i18n/app-text";
import { OWNER_COUNTRIES, applyDialCode, validateWhatsApp, validateEmail } from "../../../core/utils";
import { checkApartmentUnique } from "../../../core/api";
import Tip from "../../../core/ui/Tip";

export default function RegistrationListingForm({ user, onSubmit, submitText }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const tips = localizedTooltips({}, lang); // default tooltips — no admin config available at registration time
  const makeBlank = () => ({ apt:'', tower:getDefaultTower(), rooms:'2', guests:4, operator:'', operatorEmail:'', operatorWhatsapp:'', airbnb:'' });
  const [items,setItems]=useState([makeBlank()]);
  const [country,setCountry]=useState('Colombia');
  const [whatsapp,setWhatsapp]=useState('+57 ');
  const [errors,setErrors]=useState({});
  const [checking,setChecking]=useState({});
  const handleCountryChange = (val) => {
    const code = OWNER_COUNTRIES.find(c=>c.name===val)?.code||'';
    setCountry(val);
    setWhatsapp(applyDialCode(whatsapp, code));
    setErrors(e=>({...e,whatsapp:undefined}));
  };
  const setVal=(idx,k,v)=>{ setItems(rows=>rows.map((r,i)=>i===idx?{...r,[k]:v}:r)); setErrors(e=>({...e,[`${k}_${idx}`]:undefined})); };
  const checkApt=async(idx)=>{
    const apt=String(items[idx]?.apt||'').trim();
    if(!apt || !/^[0-9]{3}$/.test(apt)) return;
    const duplicatedLocal = items.some((row,i)=>i!==idx && String(row.apt||'').trim()===apt);
    if(duplicatedLocal){ setErrors(e=>({...e,[`apt_${idx}`]:appText(lang,'validation.aptDuplicateLocal')})); return; }
    setChecking(c=>({...c,[idx]:true}));
    try{
      const r = await checkApartmentUnique({ apt, ownerUid:user?.uid });
      if(!r.available) setErrors(e=>({...e,[`apt_${idx}`]:r.message || appText(lang,'validation.aptTaken')}));
    }catch(e){ setErrors(er=>({...er,[`apt_${idx}`]:appText(lang,'validation.aptCheckFailed')})); }
    finally{ setChecking(c=>({...c,[idx]:false})); }
  };
  const validate=()=>{
    const e={};
    // Profile validation — WhatsApp required
    if(!String(whatsapp||'').trim()) e.whatsapp = isEn ? 'WhatsApp is required' : 'WhatsApp es requerido';
    else { const waErr=validateWhatsApp(whatsapp,lang); if(waErr) e.whatsapp=waErr; }
    // Listing validation
    const seen={};
    items.forEach((f,i)=>{
      const apt=String(f.apt||'').trim();
      if(!apt) e[`apt_${i}`]=appText(lang,'validation.aptRequired');
      else if(!/^[0-9]{3}$/.test(apt)) e[`apt_${i}`]=appText(lang,'validation.aptFormat');
      else if(seen[apt]) e[`apt_${i}`]=appText(lang,'validation.aptDuplicateLocal');
      seen[apt]=true;
      if(!String(f.rooms||'').trim()) e[`rooms_${i}`]=appText(lang,'validation.roomsRequired');
      if(!f.guests || Number(f.guests)<1) e[`guests_${i}`]=appText(lang,'validation.capacityRequired');
      if(String(f.operatorEmail||'').trim() && !validateEmail(f.operatorEmail)) e[`operatorEmail_${i}`]=appText(lang,'validation.operatorEmailInvalid');
      const waOpErr=validateWhatsApp(f.operatorWhatsapp,lang); if(waOpErr) e[`operatorWhatsapp_${i}`]=waOpErr;
      if(f.airbnb && !/^https?:\/\/.+/i.test(String(f.airbnb).trim())) e[`airbnb_${i}`]=appText(lang,'validation.urlInvalid');
    });
    setErrors(prev=>({...prev,...e})); return Object.keys({...errors,...e}).filter(k=>({...errors,...e})[k]).length===0;
  };
  const cls=(k)=>errors[k]?'field-error':'';
  const optLabel = <span style={{color:"#70d6c6",fontStyle:"italic",textTransform:"none",letterSpacing:0,fontSize:"0.68rem"}}>({isEn?'optional':'opcional'})</span>;
  return <div>
    <div className="form-alert">{appText(lang,'modal.listing.registrationHelp')}</div>

    {/* ── Owner Profile ─────────────────────────────────────── */}
    <div className="reg-listing-box reg-profile-box">
      <div className="card-hdr"><span className="card-title">👤 {isEn?'Your contact information':'Tu información de contacto'}</span></div>
      <div className="fg2">
        <div className="fg full" style={{display:'flex',flexDirection:'column',gap:'6px',padding:'4px 0'}}>
          <div style={{fontSize:'.82rem',color:'#2a5a6a'}}><strong>{isEn?'Name:':'Nombre:'}</strong> {user?.name}</div>
          <div style={{fontSize:'.82rem',color:'#2a5a6a'}}><strong>Email:</strong> {user?.email}</div>
        </div>
        <div className="fg full">
          <label>🌍 {isEn?'Country':'País'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
          <select value={country} onChange={e=>handleCountryChange(e.target.value)}>
            {OWNER_COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.name}{c.code?' ('+c.code+')':''}</option>)}
          </select>
        </div>
        <div className="fg full">
          <label>WhatsApp <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
          <input className={cls('whatsapp')} type="tel" value={whatsapp} onChange={e=>{setWhatsapp(e.target.value);setErrors(er=>({...er,whatsapp:undefined}));}} onBlur={e=>{let v=String(e.target.value||'').trim();if(!v){setErrors(er=>({...er,whatsapp:isEn?'WhatsApp is required':'WhatsApp es requerido'}));return;}const digits=v.replace(/[^0-9]/g,'');if(!v.startsWith('+')&&digits.length>=10){v='+'+digits;setWhatsapp(v);}const err=validateWhatsApp(v,lang);setErrors(er=>({...er,whatsapp:err||undefined}));}} placeholder="+57 300 000 0000"/>
          {errors.whatsapp?<span className="err-msg">{errors.whatsapp}</span>:<span className="help-msg">{isEn?'Your WhatsApp with country code — used for all your listings':'Tu WhatsApp con código de país — se usará en todos tus listings'}</span>}
        </div>
      </div>
    </div>

    {/* ── Listings ──────────────────────────────────────────── */}
    {items.map((f,i)=><div key={i} className="reg-listing-box">
      <div className="card-hdr"><span className="card-title">🏠 {isEn?'Listing':'Listing'} #{i+1}</span>{items.length>1&&<button className="bsm bs-del" onClick={()=>setItems(rows=>rows.filter((_,x)=>x!==i))}>Quitar</button>}</div>
      <div className="fg2">
        {/* ── Listing ──────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🏠 {isEn?'Listing details':'Datos del listing'}</div>
        <div className="fg"><label>{appText(lang,"form.aptNumber")} <Tip text={tips.aptNumber}/></label><input className={cls(`apt_${i}`)} value={f.apt} onChange={e=>setVal(i,'apt',e.target.value)} onBlur={()=>checkApt(i)} placeholder="000"/>{checking[i]&&<span className="help-msg">{appText(lang,'validation.aptChecking')}</span>}{errors[`apt_${i}`]&&<span className="err-msg">{errors[`apt_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value={getDefaultTower()} readOnly disabled className="locked-field"/></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={cls(`rooms_${i}`)} value={f.rooms} onChange={e=>setVal(i,'rooms',e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors[`rooms_${i}`]&&<span className="err-msg">{errors[`rooms_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={cls(`guests_${i}`)} type="number" value={f.guests} onChange={e=>setVal(i,'guests',parseInt(e.target.value)||'')} min={1}/>{errors[`guests_${i}`]&&<span className="err-msg">{errors[`guests_${i}`]}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} {optLabel}</label><input className={cls(`airbnb_${i}`)} value={f.airbnb} onChange={e=>setVal(i,'airbnb',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`airbnb_${i}`;if(v&&!/^https?:\/\/.+/i.test(v))setErrors(p=>({...p,[key]:appText(lang,'validation.urlInvalid')}));else setErrors(p=>({...p,[key]:undefined}));}} placeholder="https://www.airbnb.com/rooms/..."/>{errors[`airbnb_${i}`]&&<span className="err-msg">{errors[`airbnb_${i}`]}</span>}</div>
        {/* ── Operator ─────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🔧 {isEn?'Operator (optional)':'Operador (opcional)'}</div>
        <div className="fg full" style={{marginTop:-4,marginBottom:4}}><span className="help-msg">{isEn?'Leave blank if you self-manage. Operator receives all incident notifications for this unit.':'Déjalo en blanco si gestionas tú mismo. El operador recibe todas las notificaciones de incidentes de esta unidad.'}</span></div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} {optLabel} <Tip text={tips.operator}/></label><input className={cls(`operator_${i}`)} value={f.operator} onChange={e=>setVal(i,'operator',e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors[`operator_${i}`]&&<span className="err-msg">{errors[`operator_${i}`]}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} <Tip text={tips.operatorEmail}/></label><input className={cls(`operatorEmail_${i}`)} type="email" value={f.operatorEmail} onChange={e=>setVal(i,'operatorEmail',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`operatorEmail_${i}`;if(v&&!validateEmail(v))setErrors(p=>({...p,[key]:appText(lang,'validation.operatorEmailInvalid')}));else setErrors(p=>({...p,[key]:undefined}));}} placeholder="operador@email.com"/>{errors[`operatorEmail_${i}`]&&<span className="err-msg">{errors[`operatorEmail_${i}`]}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.operatorWhatsappOptional")} <Tip text={tips.operatorWhatsapp}/></label><input className={cls(`operatorWhatsapp_${i}`)} type="tel" value={f.operatorWhatsapp} onChange={e=>setVal(i,'operatorWhatsapp',e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const key=`operatorWhatsapp_${i}`;const err=validateWhatsApp(v,lang);setErrors(p=>({...p,[key]:err||undefined}));}} placeholder="+57 300 000 0000"/>{errors[`operatorWhatsapp_${i}`]?<span className="err-msg">{errors[`operatorWhatsapp_${i}`]}</span>:<span className="help-msg">{isEn?'With country code, e.g. +57':'Con código de país, ej. +57'}</span>}</div>
      </div>
    </div>)}
    <div className="mact"><button className="btn-ghost" onClick={()=>setItems(rows=>[...rows, makeBlank()])}>{appText(lang,"form.addAnotherListing")}</button><button className="btn-p" onClick={()=>{ if(validate()) onSubmit({ listings: items.map(x=>({...x,apt:String(x.apt).trim(),tower:x.tower||getDefaultTower(),operatorEmail:String(x.operatorEmail||'').trim().toLowerCase(),operatorWhatsapp:String(x.operatorWhatsapp||'').trim(),airbnb:String(x.airbnb||'').trim()})), profile:{ whatsapp:whatsapp.trim(), country } }); }}>{submitText}</button></div>
  </div>;
}
