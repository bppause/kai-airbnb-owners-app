// "Step 1: Verify incident" modal — owner confirms guest details and
// documents the immediate action they took. Optionally also adds the
// resolution at this point (Step 2). Required to unblock admin closure.
//
// Lifted byte-identical from App.jsx in stage F10. Pulls `lang` via
// useApp(); incident/onSave/onClose/config stay as per-instance props
// (config flows through from adminInfo and powers the per-community
// tooltip overrides).
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F10.

import React, { useState } from "react";
import Overlay from "../../../core/ui/Overlay";
import Tip from "../../../core/ui/Tip";
import { COUNTRIES, normalizeOwnerGuests } from "../../../core/utils";
import { appText, localizedTooltips } from "../../../core/i18n/app-text";
import { useApp } from "../../../core/app-state";

export default function VerifyIncidentModal({ incident, onSave, onClose, config = {} }) {
  const { lang } = useApp();
  const tips = localizedTooltips(config, lang);
  const isEn = lang === 'en';
  const blankGuest = () => ({ firstName:'', middleName:'', lastName:'', city:'', state:'', country:'Colombia' });
  const initialGuests = normalizeOwnerGuests(incident);
  const [guests, setGuests] = useState(initialGuests.length ? initialGuests : [blankGuest()]);
  const [ownerComments, setOwnerComments] = useState(incident?.ownerComments || '');
  const [ownerResolution, setOwnerResolution] = useState(incident?.ownerResolution || '');
  const [errors, setErrors] = useState({});
  const setGuest = (idx, field, value) => {
    setGuests(gs => gs.map((g,i) => i===idx ? {...g, [field]: value} : g));
    setErrors(e => ({...e, [`${field}_${idx}`]: undefined}));
  };
  const addGuest = () => setGuests(gs => [...gs, blankGuest()]);
  const removeGuest = (idx) => setGuests(gs => gs.length <= 1 ? gs : gs.filter((_,i) => i !== idx));
  const validate = () => {
    const e = {};
    guests.forEach((g, i) => {
      if (!String(g.firstName||'').trim()) e[`firstName_${i}`] = appText(lang, 'validation.guestFirstName');
      if (!String(g.lastName||'').trim()) e[`lastName_${i}`] = appText(lang, 'validation.guestLastName');
      if (!String(g.city||'').trim()) e[`city_${i}`] = appText(lang, 'validation.city');
      if (!String(g.country||'').trim()) e[`country_${i}`] = appText(lang, 'validation.country');
    });
    if (!String(ownerComments||'').trim()) e.ownerComments = appText(lang, 'validation.ownerComments');
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  return <Overlay onClose={onClose} wide>
    <div className="modal-title">{appText(lang,"modal.verify.title")}</div>
    <div className="modal-sub">{appText(lang,"modal.verify.sub",{apt:incident?.aptLabel||""})}</div>
    <div className="form-alert">{appText(lang,"modal.verify.help")}</div>
    <div className="guest-editor-list">
      {guests.map((g, idx) => <div key={idx} className="guest-editor-card">
        <div className="guest-editor-title"><strong>{appText(lang,'form.guestNumber',{count:idx+1})}</strong>{guests.length>1 && <button type="button" className="btn-mini-danger" onClick={()=>removeGuest(idx)}>🗑️ {appText(lang,'form.removeGuest')}</button>}</div>
        <div className="fg2 guest-grid">
          <div className="fg"><label>{appText(lang,'form.guestFirstName')} *</label><input className={errors[`firstName_${idx}`]?'field-error':''} value={g.firstName} onChange={e=>setGuest(idx,'firstName',e.target.value)} autoComplete="given-name"/>{errors[`firstName_${idx}`] && <span className="err-msg">{errors[`firstName_${idx}`]}</span>}</div>
          <div className="fg"><label>{appText(lang,'form.guestLastName')} *</label><input className={errors[`lastName_${idx}`]?'field-error':''} value={g.lastName} onChange={e=>setGuest(idx,'lastName',e.target.value)} autoComplete="family-name"/>{errors[`lastName_${idx}`] && <span className="err-msg">{errors[`lastName_${idx}`]}</span>}</div>
          <div className="fg"><label>{appText(lang,'form.guestMiddleName')} <span style={{fontSize:'.65rem',color:'#8a9fa5',fontWeight:400}}>{isEn?'(optional)':'(opcional)'}</span></label><input value={g.middleName} onChange={e=>setGuest(idx,'middleName',e.target.value)} /></div>
          <div className="fg"><label>{appText(lang,"form.city")} *</label><input className={errors[`city_${idx}`]?'field-error':''} value={g.city} onChange={e=>setGuest(idx,'city',e.target.value)} placeholder="Bogotá" autoComplete="address-level2"/>{errors[`city_${idx}`] && <span className="err-msg">{errors[`city_${idx}`]}</span>}</div>
          <div className="fg"><label>{isEn?'State / Province':'Departamento / Estado'} <span style={{fontSize:'.65rem',color:'#8a9fa5',fontWeight:400}}>{isEn?'(optional)':'(opcional)'}</span></label><input value={g.state||''} onChange={e=>setGuest(idx,'state',e.target.value)} placeholder={isEn?'e.g. Cundinamarca':'ej. Cundinamarca'} autoComplete="address-level1"/></div>
          <div className="fg full"><label>{appText(lang,"form.country")} *</label><select className={errors[`country_${idx}`]?'field-error':''} value={g.country} onChange={e=>setGuest(idx,'country',e.target.value)}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select>{errors[`country_${idx}`] && <span className="err-msg">{errors[`country_${idx}`]}</span>}</div>
        </div>
      </div>)}
      <button type="button" className="btn-ghost" onClick={addGuest}>{appText(lang,'form.addGuest')}</button>
    </div>
    {/* Immediate action — REQUIRED */}
    <div className="fg full">
      <label>{appText(lang,"form.immediateAction")} <Tip text={tips.verifyIncident}/></label>
      <textarea className={errors.ownerComments?'field-error':''} value={ownerComments} onChange={e=>{setOwnerComments(e.target.value); setErrors(er=>({...er, ownerComments: undefined}));}} rows={3} placeholder={appText(lang,"form.immediateActionPlaceholder")}/>
      {errors.ownerComments && <span className="err-msg">{errors.ownerComments}</span>}
    </div>
    {/* Your answer — OPTIONAL now, required later before admin can close */}
    <div className="fg full">
      <label>{appText(lang,"form.ownerResolution")}</label>
      <div className="verify-resolution-hint">{isEn?'Optional now — admin cannot close the incident until your resolution is provided.':'Opcional ahora — el admin no puede cerrar el incidente hasta que agregues tu respuesta.'}</div>
      <textarea value={ownerResolution} onChange={e=>setOwnerResolution(e.target.value)} rows={3} placeholder={appText(lang,"form.ownerResolutionPlaceholder")}/>
    </div>
    <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,"form.cancel")}</button><button className="btn-p" title={tips.verifyIncident} onClick={()=>{ if (validate()) onSave({guests, ownerComments, ownerResolution}); }}>{appText(lang,"form.saveVerification")}</button></div>
  </Overlay>;
}
