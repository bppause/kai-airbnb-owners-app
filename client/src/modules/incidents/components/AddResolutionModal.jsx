// "Step 2" modal: owner adds their resolution to a verified incident,
// notifying admins that the incident is ready to be closed.
//
// Lifted byte-identical from App.jsx in stage F8. Pulls `lang` from
// useApp() instead of receiving it as a prop, matching the pattern set
// in F7 (GeneralIncidentsView).
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F8.

import React, { useState } from "react";
import Overlay from "../../../core/ui/Overlay";
import { appText } from "../../../core/i18n/app-text";
import { useApp } from "../../../core/app-state";

export default function AddResolutionModal({ incident, onSave, onClose }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [text, setText] = useState(incident?.ownerResolution || '');
  const [err, setErr] = useState('');
  const submit = () => {
    if (!String(text || '').trim()) {
      setErr(isEn ? 'Resolution is required.' : 'Tu respuesta es requerida.');
      return;
    }
    onSave(text);
  };
  return <Overlay onClose={onClose}>
    <div className="modal-title">{isEn ? '📝 Add resolution' : '📝 Agregar respuesta'}</div>
    <div className="modal-sub">{incident?.aptLabel || ''}</div>
    <div className="form-alert">{isEn ? 'Once you add your resolution, the admin will be notified and can close the incident.' : 'Al agregar tu respuesta el administrador será notificado y podrá cerrar el incidente.'}</div>
    <div className="fg full">
      <label>{appText(lang, "form.ownerResolution")} *</label>
      <textarea className={err ? 'field-error' : ''} value={text} onChange={e => { setText(e.target.value); setErr(''); }} rows={4} placeholder={appText(lang, "form.ownerResolutionPlaceholder")}/>
      {err && <span className="err-msg">{err}</span>}
    </div>
    <div className="mact">
      <button className="btn-ghost" onClick={onClose}>{appText(lang, "form.cancel")}</button>
      <button className="btn-p" onClick={submit}>{isEn ? 'Save resolution' : 'Guardar respuesta'}</button>
    </div>
  </Overlay>;
}
