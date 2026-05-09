// CommunityCrudModal — create/edit a community. Captures id (slug, only
// on create), bilingual name + description, tower label, location, logo
// + background images (URL or file upload), and an active flag (edit
// only).
//
// Lifted byte-identical from App.jsx in stage F33. Pulls lang via
// useApp(); mode, initial, onSave, onClose stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F33.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import Overlay from "../../../core/ui/Overlay";

export default function CommunityCrudModal({ mode='create', initial={}, onSave, onClose }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const isEdit = mode === 'edit';
  const [f, setF] = useState({
    id: initial.id || '',
    name: initial.name || '',
    nameEn: initial.name_en || '',
    tower: initial.tower || '',
    city: initial.city || '',
    state: initial.state || '',
    country: initial.country || 'Colombia',
    logoUrl: initial.logo_url || '',
    backgroundUrl: initial.background_url || '',
    description: initial.description || '',
    descriptionEn: initial.description_en || '',
    isActive: initial.is_active !== false,
  });
  const [logoMode, setLogoMode] = useState('url');
  const [bgMode, setBgMode] = useState('url');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const s = (k, v) => setF(p => ({...p, [k]: v}));

  const validate = () => {
    const e = {};
    if (!isEdit && !String(f.id||'').trim()) e.id = isEn ? 'ID is required' : 'ID es requerido';
    else if (!isEdit && f.id && !/^[a-z0-9-]+$/.test(f.id)) e.id = isEn ? 'Lowercase letters, numbers, and hyphens only' : 'Solo letras minúsculas, números y guiones';
    if (!String(f.name||'').trim()) e.name = isEn ? 'Name (Spanish) is required' : 'Nombre (Español) es requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(f); } catch(e) { setSaving(false); }
  };

  const imgField = (label, urlKey, mode, setMode) => (
    <div className="fg full">
      <label>{label}</label>
      <div style={{display:'flex',gap:8,marginBottom:6}}>
        <button type="button" className={`chip ${mode==='url'?'chip-active':''}`} onClick={()=>setMode('url')}>URL</button>
        <button type="button" className={`chip ${mode==='file'?'chip-active':''}`} onClick={()=>setMode('file')}>{isEn?'Upload':'Subir'}</button>
      </div>
      {mode==='url' && <input value={f[urlKey]} onChange={e=>s(urlKey,e.target.value)} placeholder="https://..." className="input" style={{marginBottom:6}}/>}
      {mode==='file' && <input type="file" accept="image/*" style={{marginBottom:6}} onChange={e=>{const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=ev=>s(urlKey,ev.target?.result||'');r.readAsDataURL(file);}}/>}
      {f[urlKey] && <div style={{marginTop:4,padding:6,background:'#f5fbfd',borderRadius:6,display:'inline-block'}}>
        <img src={f[urlKey]} alt="preview" style={{maxHeight:48,maxWidth:180,objectFit:'contain',display:'block'}} onError={e=>{e.target.style.display='none';}}/>
      </div>}
      {f[urlKey] && <button type="button" className="btn-ghost" style={{fontSize:'.72rem',padding:'2px 8px',marginTop:4}} onClick={()=>s(urlKey,'')}>{isEn?'Remove':'Quitar'}</button>}
    </div>
  );

  return (
    <Overlay onClose={onClose}>
      <div className="modal-title">{isEdit?(isEn?'✏️ Edit community':'✏️ Editar comunidad'):(isEn?'＋ New community':'＋ Nueva comunidad')}</div>
      <div className="fg2">
        {!isEdit && (
          <div className="fg full">
            <label>{isEn?'Community ID (slug)':'ID de comunidad (slug)'} <span style={{color:'#e53935',fontSize:'.75rem'}}>*</span></label>
            <input value={f.id} onChange={e=>s('id',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="my-community" className={errors.id?'field-error':''}/>
            <span className="help-msg">{isEn?'Lowercase letters, numbers, hyphens. Cannot be changed after creation.':'Letras minúsculas, números, guiones. No se puede cambiar luego.'}</span>
            {errors.id && <span className="err-msg">{errors.id}</span>}
          </div>
        )}
        <div className="fg">
          <label>{isEn?'Name (Spanish)':'Nombre (Español)'} <span style={{color:'#e53935',fontSize:'.75rem'}}>*</span></label>
          <input value={f.name} onChange={e=>s('name',e.target.value)} className={errors.name?'field-error':''}/>
          {errors.name && <span className="err-msg">{errors.name}</span>}
        </div>
        <div className="fg">
          <label>{isEn?'Name (English)':'Nombre (Inglés)'}</label>
          <input value={f.nameEn} onChange={e=>s('nameEn',e.target.value)}/>
        </div>
        <div className="fg">
          <label>{isEn?'Tower label':'Etiqueta de torre'}</label>
          <input value={f.tower} onChange={e=>s('tower',e.target.value)} placeholder="KAI"/>
          <span className="help-msg">{isEn?'Short label shown on unit plates (e.g. KAI, OLAS, NORTE).':'Etiqueta corta en fichas de unidad (ej. KAI, OLAS, NORTE).'}</span>
        </div>
        <div className="fg">
          <label>{isEn?'City':'Ciudad'}</label>
          <input value={f.city} onChange={e=>s('city',e.target.value)} placeholder="Cartagena"/>
        </div>
        <div className="fg">
          <label>{isEn?'State / Province':'Departamento / Provincia'}</label>
          <input value={f.state} onChange={e=>s('state',e.target.value)} placeholder={isEn?'e.g. Bolívar':'ej. Bolívar'}/>
        </div>
        <div className="fg">
          <label>{isEn?'Country':'País'}</label>
          <input value={f.country} onChange={e=>s('country',e.target.value)} placeholder="Colombia"/>
        </div>
        {imgField(isEn?'Logo':'Logo', 'logoUrl', logoMode, setLogoMode)}
        {imgField(isEn?'Background image (login / registration screens)':'Imagen de fondo (login y registro)', 'backgroundUrl', bgMode, setBgMode)}
        <div className="fg full">
          <label>{isEn?'Description (Spanish)':'Descripción (Español)'}</label>
          <textarea className="admin-textarea" rows={2} value={f.description} onChange={e=>s('description',e.target.value)}/>
        </div>
        <div className="fg full">
          <label>{isEn?'Description (English)':'Descripción (Inglés)'}</label>
          <textarea className="admin-textarea" rows={2} value={f.descriptionEn} onChange={e=>s('descriptionEn',e.target.value)}/>
        </div>
        {isEdit && (
          <div className="fg full">
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none'}}>
              <input type="checkbox" checked={f.isActive} onChange={e=>s('isActive',e.target.checked)} style={{width:16,height:16}}/>
              {isEn?'Active (visible and accessible to users)':'Activa (visible y accesible para usuarios)'}
            </label>
          </div>
        )}
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{isEn?'Cancel':'Cancelar'}</button>
        <button className="btn-p" onClick={handleSave} disabled={saving}>{saving?(isEn?'Saving...':'Guardando...'):`💾 ${isEn?'Save':'Guardar'}`}</button>
      </div>
    </Overlay>
  );
}
