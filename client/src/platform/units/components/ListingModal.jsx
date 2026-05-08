// ListingModal — add/edit a unit. Captures apt + tower (auto-filled
// from community config), rooms/guests, optional operator info, and up
// to 3 co-owners. Validates apt format + uniqueness against the server,
// emails, and WhatsApp formats. Used for both create (modal.type=
// 'addListing') and edit (modal.type='editListing') flows in App.jsx.
//
// Lifted byte-identical from App.jsx in stage F32. Pulls lang via
// useApp(); title, user, initial, onSave, onClose, config stay per-
// instance.
//
// Co-located: EMPTY_CO_OWNER blank shape (only used here).
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F32.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { appText, localizedTooltips, getDefaultTower } from "../../../core/i18n/app-text";
import { validateWhatsApp, validateEmail } from "../../../core/utils";
import { checkApartmentUnique } from "../../../core/api";
import Overlay from "../../../core/ui/Overlay";
import Tip from "../../../core/ui/Tip";

const EMPTY_CO_OWNER = { firstName:'', middleName:'', lastName:'', whatsapp:'' };

export default function ListingModal({ title, user, initial={}, onSave, onClose, config={} }) {
  const { lang } = useApp();
  const tips = localizedTooltips(config, lang);
  const isEn = lang === 'en';
  const [f,setF]=useState({apt:"",rooms:"2",guests:4,operator:"",operatorEmail:"",operatorWhatsapp:"",airbnb:"",...initial,tower:initial.tower||config?.community_tower||'KAI'});
  const [coOwners,setCoOwners]=useState(Array.isArray(initial?.coOwners)&&initial.coOwners.length?initial.coOwners:[]);
  const [errors,setErrors]=useState({});
  const [coErrors,setCoErrors]=useState([]);
  const [checkingApt,setCheckingApt]=useState(false);
  const s=(k,v)=>{ setF(p=>({...p,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };

  const setCo=(i,k,v)=>setCoOwners(prev=>prev.map((o,idx)=>idx===i?{...o,[k]:v}:o));
  const addCoOwner=()=>{ if(coOwners.length<3) setCoOwners(p=>[...p,{...EMPTY_CO_OWNER}]); };
  const removeCoOwner=(i)=>{ setCoOwners(p=>p.filter((_,idx)=>idx!==i)); setCoErrors(p=>p.filter((_,idx)=>idx!==i)); };

  const checkApt=async()=>{
    const apt=String(f.apt||'').trim();
    if(!apt || !/^[0-9]{3}$/.test(apt)) return;
    setCheckingApt(true);
    try{
      const r = await checkApartmentUnique({ apt, ownerUid:user?.uid, excludeListingId:initial?.id || '' });
      if(!r.available) setErrors(e=>({...e,apt:r.message || appText(lang,'validation.aptTaken')}));
    }catch(e){ setErrors(er=>({...er,apt:appText(lang,'validation.aptCheckFailed')})); }
    finally{ setCheckingApt(false); }
  };

  const validateCoOwners=()=>{
    const errs=coOwners.map(o=>{
      const e={};
      if(!String(o.firstName||'').trim()) e.firstName=isEn?'First name required':'Nombre requerido';
      if(!String(o.lastName||'').trim()) e.lastName=isEn?'Last name required':'Apellido requerido';
      const waErr=validateWhatsApp(o.whatsapp,lang); if(waErr) e.whatsapp=waErr;
      return e;
    });
    setCoErrors(errs);
    return errs.every(e=>Object.keys(e).length===0);
  };

  const validate=()=>{
    const e={};
    if(!String(f.apt||"").trim()) e.apt=appText(lang,'validation.aptRequired');
    else if(!/^[0-9]{3}$/.test(String(f.apt).trim())) e.apt=appText(lang,'validation.aptFormat');
    if(!String(f.rooms||"").trim()) e.rooms=appText(lang,'validation.roomsRequired');
    if(!f.guests || Number(f.guests)<1) e.guests=appText(lang,'validation.capacityRequired');
    if(String(f.operatorEmail||"").trim() && !validateEmail(f.operatorEmail)) e.operatorEmail=appText(lang,'validation.operatorEmailInvalid');
    const waOpErr=validateWhatsApp(f.operatorWhatsapp,lang); if(waOpErr) e.operatorWhatsapp=waOpErr;
    if(f.airbnb && !/^https?:\/\/.+/i.test(String(f.airbnb).trim())) e.airbnb=appText(lang,'validation.urlInvalid');
    setErrors(e);
    const coOk=validateCoOwners();
    return Object.keys(e).length===0 && coOk;
  };

  const inputCls=(k)=>errors[k]?"field-error":"";
  const optLabel = <span style={{color:"#70d6c6",fontStyle:"italic",textTransform:"none",letterSpacing:0,fontSize:"0.68rem"}}>({appText(lang,"form.optional")})</span>;
  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">{title}</div>
      <div className="modal-sub">{appText(lang,"modal.listing.ownerPrefix")}: {user?.name}</div>
      <div className="form-alert" style={{marginBottom:8}}>
        {isEn ? 'Your Google email and profile WhatsApp are used as contact details for this listing.' : 'Tu email de Google y WhatsApp del perfil se usan como contacto para este listing.'}
      </div>
      <div className="fg2">
        {/* ── Listing ──────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🏠 {isEn?'Listing details':'Datos del listing'}</div>
        <div className="fg"><label>{appText(lang,"form.aptNumber")} <Tip text={tips.aptNumber}/></label><input className={inputCls("apt")} value={f.apt} onChange={e=>s("apt",e.target.value)} onBlur={checkApt} placeholder="000"/>{checkingApt&&<span className="help-msg">{appText(lang,'validation.aptChecking')}</span>}{errors.apt&&<span className="err-msg">{errors.apt}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.tower")}</label><input value={f.tower} readOnly disabled className="locked-field"/></div>
        <div className="fg"><label>{appText(lang,"form.rooms")}</label><select className={inputCls("rooms")} value={f.rooms} onChange={e=>s("rooms",e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>{errors.rooms&&<span className="err-msg">{errors.rooms}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.guestCapacity")}</label><input className={inputCls("guests")} type="number" value={f.guests} onChange={e=>s("guests",parseInt(e.target.value)||"")} min={1} max={20}/>{errors.guests&&<span className="err-msg">{errors.guests}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.airbnbOptional")} {optLabel}</label><input className={inputCls("airbnb")} value={f.airbnb} onChange={e=>s("airbnb",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!/^https?:\/\/.+/i.test(v))setErrors(p=>({...p,airbnb:appText(lang,'validation.urlInvalid')}));else setErrors(p=>({...p,airbnb:undefined}));}} placeholder="https://www.airbnb.com/rooms/..."/>{errors.airbnb&&<span className="err-msg">{errors.airbnb}</span>}</div>
        {/* ── Operator ─────────────────────────────────────── */}
        <div className="fg full form-section-hdr">🔧 {isEn?'Operator (optional)':'Operador (opcional)'}</div>
        <div className="fg full" style={{marginTop:-4,marginBottom:4}}><span className="help-msg">{isEn?'Leave blank if you self-manage. Operator receives all incident notifications for this unit.':'Déjalo en blanco si gestionas tú mismo. El operador recibe todas las notificaciones de incidentes de esta unidad.'}</span></div>
        <div className="fg"><label>{appText(lang,"form.operatorOptional")} {optLabel}</label><input className={inputCls("operator")} value={f.operator} onChange={e=>s("operator",e.target.value)} placeholder={appText(lang,"form.operatorPlaceholder")}/>{errors.operator&&<span className="err-msg">{errors.operator}</span>}</div>
        <div className="fg"><label>{appText(lang,"form.operatorEmailOptional")} {optLabel}</label><input className={inputCls("operatorEmail")} type="email" value={f.operatorEmail} onChange={e=>s("operatorEmail",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();if(v&&!validateEmail(v))setErrors(p=>({...p,operatorEmail:appText(lang,'validation.operatorEmailInvalid')}));else setErrors(p=>({...p,operatorEmail:undefined}));}} placeholder="operador@email.com"/>{errors.operatorEmail&&<span className="err-msg">{errors.operatorEmail}</span>}</div>
        <div className="fg full"><label>{appText(lang,"form.operatorWhatsappOptional")} {optLabel}</label><input className={inputCls("operatorWhatsapp")} type="tel" value={f.operatorWhatsapp} onChange={e=>s("operatorWhatsapp",e.target.value)} onBlur={e=>{const v=String(e.target.value||'').trim();const err=validateWhatsApp(v,lang);setErrors(p=>({...p,operatorWhatsapp:err||undefined}));}} placeholder="+57 300 000 0000"/>{errors.operatorWhatsapp?<span className="err-msg">{errors.operatorWhatsapp}</span>:<span className="help-msg">{isEn?'With country code, e.g. +57':'Con código de país, ej. +57'}</span>}</div>
        {/* ── Co-owners ────────────────────────────────────── */}
        <div className="fg full form-section-hdr">👥 {isEn?'Additional owners':'Propietarios adicionales'} {optLabel}</div>
        {coOwners.length===0&&<div className="fg full" style={{color:'#6b9ba8',fontSize:'.83rem',margin:'-4px 0 4px'}}>{isEn?'Up to 3 additional owners can be added to this unit.':'Se pueden agregar hasta 3 propietarios adicionales a esta unidad.'}</div>}
        {coOwners.map((co,i)=>(
          <div key={i} className="fg full" style={{border:'1px solid #cce7ee',borderRadius:8,padding:'12px 14px',marginBottom:4,background:'#f5fbfd'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontWeight:600,fontSize:'.85rem',color:'#1a4a5a'}}>{isEn?`Co-owner ${i+1}`:`Propietario ${i+1}`}</span>
              <button type="button" style={{background:'none',border:'none',color:'#e53935',cursor:'pointer',fontSize:'1rem',padding:'0 2px'}} onClick={()=>removeCoOwner(i)}>✕</button>
            </div>
            <div className="fg2">
              <div className="fg">
                <label>{isEn?'First name':'Nombre'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
                <input className={coErrors[i]?.firstName?'field-error':''} value={co.firstName} onChange={e=>setCo(i,'firstName',e.target.value)} placeholder={isEn?'First name':'Nombre'}/>
                {coErrors[i]?.firstName&&<span className="err-msg">{coErrors[i].firstName}</span>}
              </div>
              <div className="fg">
                <label>{isEn?'Middle name':'Segundo nombre'} {optLabel}</label>
                <input value={co.middleName} onChange={e=>setCo(i,'middleName',e.target.value)} placeholder={isEn?'Middle name (optional)':'Segundo nombre (opcional)'}/>
              </div>
              <div className="fg">
                <label>{isEn?'Last name':'Apellido'} <span style={{color:'#e53935',fontSize:'0.75rem'}}>*</span></label>
                <input className={coErrors[i]?.lastName?'field-error':''} value={co.lastName} onChange={e=>setCo(i,'lastName',e.target.value)} placeholder={isEn?'Last name':'Apellido'}/>
                {coErrors[i]?.lastName&&<span className="err-msg">{coErrors[i].lastName}</span>}
              </div>
              <div className="fg">
                <label>WhatsApp {optLabel}</label>
                <input className={coErrors[i]?.whatsapp?'field-error':''} type="tel" value={co.whatsapp} onChange={e=>setCo(i,'whatsapp',e.target.value)} onBlur={e=>{const err=validateWhatsApp(e.target.value,lang);setCoErrors(p=>p.map((ce,idx)=>idx===i?{...ce,whatsapp:err||undefined}:ce));}} placeholder="+57 300 000 0000"/>
                {coErrors[i]?.whatsapp?<span className="err-msg">{coErrors[i].whatsapp}</span>:<span className="help-msg">{isEn?'With country code':'Con código de país'}</span>}
              </div>
            </div>
          </div>
        ))}
        {coOwners.length<3&&<div className="fg full"><button type="button" className="btn-ghost" style={{fontSize:'.83rem',padding:'6px 14px'}} onClick={addCoOwner}>+ {isEn?'Add co-owner':'Agregar propietario'}</button></div>}
      </div>
      <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" onClick={()=>{if(validate()) onSave({...f,apt:String(f.apt).trim(),tower:f.tower||getDefaultTower(),operatorEmail:String(f.operatorEmail||"").trim().toLowerCase(),operatorWhatsapp:String(f.operatorWhatsapp||"").trim(),airbnb:String(f.airbnb||"").trim(),coOwners:coOwners.map(o=>({...o,firstName:o.firstName.trim(),middleName:o.middleName.trim(),lastName:o.lastName.trim(),whatsapp:o.whatsapp.trim()}))});}}>{appText(lang,"form.save")}</button></div>
    </Overlay>
  );
}
