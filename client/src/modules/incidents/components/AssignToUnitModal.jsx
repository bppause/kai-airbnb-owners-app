// "Assign general incident to a unit" modal — admin action that converts a
// community-wide incident into a unit-bound incident and switches it to the
// standard verify/resolve workflow.
//
// Lifted byte-identical from App.jsx in stage F9. Pulls `lang` from useApp();
// incident / listings / onSave / onClose stay as per-instance props.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F9.

import React, { useState } from "react";
import Overlay from "../../../core/ui/Overlay";
import UnitPicker from "../../../platform/units/components/UnitPicker";
import { useApp } from "../../../core/app-state";

export default function AssignToUnitModal({ incident, listings = [], onSave, onClose }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [aptId, setAptId] = useState('');
  return (
    <Overlay onClose={onClose}>
      <div className="modal-title">🏠 {isEn ? 'Assign incident to unit' : 'Asignar incidente a unidad'}</div>
      <div className="modal-sub">{isEn ? 'Select the unit this incident relates to. Once assigned it follows the standard workflow.' : 'Selecciona la unidad a la que aplica este incidente. Una vez asignado sigue el flujo estándar.'}</div>
      <div className="fg2">
        <div className="fg full">
          <div className="gen-inc-preview" style={{marginBottom:10}}>
            <span style={{fontSize:'.72rem',fontWeight:800,color:'#496674',textTransform:'uppercase',letterSpacing:'.06em'}}>{isEn ? 'Incident' : 'Incidente'}</span>
            <div style={{fontSize:'.84rem',color:'#17313a',marginTop:4,lineHeight:1.4}}>{String(incident.desc || '').slice(0, 120)}</div>
            <div style={{fontSize:'.72rem',color:'#8a9fa5',marginTop:4}}>{incident.type} · {incident.date}</div>
          </div>
          <label>{isEn ? 'Select unit to assign' : 'Seleccionar unidad para asignar'}</label>
          <UnitPicker listings={listings} value={aptId} onChange={setAptId} lang={lang}/>
        </div>
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{isEn ? 'Cancel' : 'Cancelar'}</button>
        <button className="btn-p" disabled={!aptId} onClick={() => aptId && onSave(aptId)}>
          🏠 {isEn ? 'Assign to unit' : 'Asignar a unidad'}
        </button>
      </div>
    </Overlay>
  );
}
