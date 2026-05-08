// "Close general incident directly" modal — admin path that closes a
// community-wide incident without assigning it to a unit.
//
// Lifted byte-identical from App.jsx in stage F10. Pulls `lang` via
// useApp(); incident / onSave / onClose stay as per-instance props.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F10.

import React, { useState } from "react";
import Overlay from "../../../core/ui/Overlay";
import { useApp } from "../../../core/app-state";

export default function CloseGeneralModal({ incident, onSave, onClose }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [action, setAction] = useState('');
  const [resolution, setResolution] = useState('');
  const [comments, setComments] = useState('');
  const canSave = String(action || '').trim().length > 3 && String(resolution || '').trim().length > 3;
  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">✓ {isEn ? 'Close general incident' : 'Cerrar incidente general'}</div>
      <div className="modal-sub">{isEn ? 'Provide the action taken and resolution. This closes the incident without assigning it to a unit.' : 'Indica la acción tomada y la resolución. Esto cierra el incidente sin asignarlo a una unidad.'}</div>
      <div className="fg2">
        <div className="fg full">
          <div className="gen-inc-preview">
            <span style={{fontSize:'.72rem',fontWeight:800,color:'#496674',textTransform:'uppercase',letterSpacing:'.06em'}}>{isEn ? 'Incident' : 'Incidente'}</span>
            <div style={{fontSize:'.84rem',color:'#17313a',marginTop:4,lineHeight:1.4}}>{String(incident.desc || '').slice(0, 160)}</div>
            <div style={{fontSize:'.72rem',color:'#8a9fa5',marginTop:4}}>{incident.type} · {incident.date}</div>
          </div>
        </div>
        <div className="fg full">
          <label>✅ {isEn ? 'Action taken *' : 'Acción tomada *'}</label>
          <textarea rows={3} value={action} onChange={e => setAction(e.target.value)} placeholder={isEn ? 'Describe the action taken to address this incident...' : 'Describe la acción tomada para atender este incidente...'}/>
        </div>
        <div className="fg full">
          <label>🔍 {isEn ? 'Resolution *' : 'Resolución *'}</label>
          <textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)} placeholder={isEn ? 'How was this resolved? What is the outcome?' : '¿Cómo se resolvió? ¿Cuál es el resultado?'}/>
        </div>
        <div className="fg full">
          <label>💬 {isEn ? 'Closing notes (optional)' : 'Notas de cierre (opcional)'}</label>
          <textarea rows={2} value={comments} onChange={e => setComments(e.target.value)} placeholder={isEn ? 'Any additional closing notes...' : 'Notas adicionales de cierre...'}/>
        </div>
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{isEn ? 'Cancel' : 'Cancelar'}</button>
        <button className="btn-p" disabled={!canSave} onClick={() => canSave && onSave({ action: action.trim(), resolution: resolution.trim(), resolutionComments: comments.trim() })}>
          ✓ {isEn ? 'Close incident' : 'Cerrar incidente'}
        </button>
      </div>
    </Overlay>
  );
}
