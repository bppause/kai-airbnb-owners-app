// AptContactPopup — hover card showing owner email + WhatsApp (+ co-owners
// + operator if present) with branded icons and direct mailto / wa.me
// links. Wrapped by any unit row/door in <div className="apt-cpop-wrap">
// to get hover behavior; popup itself has pointer-events:none on the
// shell so the underlying click target still fires.
//
// Lifted byte-identical from App.jsx in stage F28. Pulls lang via
// useApp() (isEn derived internally — `isEn` was previously a redundant
// prop). Other props (owner/operator name/email/whatsapp, co-owners)
// stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F28.

import React from "react";
import { useApp } from "../../../core/app-state";
import { normalizePhoneForWhatsApp } from "../../../core/utils";
import { IconEmail, IconWhatsApp } from "../../../core/ui/Icons";

export default function AptContactPopup({ ownerName='', ownerEmail='', ownerWaRaw='', operatorName='', operatorEmail='', opWaRaw='', coOwners=[] }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const ownerWaDigits = normalizePhoneForWhatsApp(ownerWaRaw);
  const opWaDigits    = normalizePhoneForWhatsApp(opWaRaw);
  const ownerWaOk     = !ownerWaRaw || ownerWaRaw.trim().startsWith('+');
  const hasOperator   = !!(operatorEmail || opWaDigits);
  return (
    <div className="apt-cpop" onClick={e=>e.stopPropagation()}>
      {/* Owner */}
      <div className="apt-cpop-section">
        <span className="apt-cpop-lbl">👤 {isEn?'Owner':'Propietario'}{ownerName ? ` · ${ownerName}` : ''}</span>
        {ownerEmail
          ? <a className="apt-cpop-link" href={`mailto:${ownerEmail}`}><IconEmail/><span>{ownerEmail}</span></a>
          : <span className="apt-cpop-miss">{isEn?'No email':'Sin email'}</span>}
        {ownerWaDigits
          ? <a className="apt-cpop-link" href={`https://wa.me/${ownerWaDigits}`} target="_blank" rel="noreferrer"><IconWhatsApp/><span>{ownerWaRaw}{!ownerWaOk&&<span style={{color:'#f0c040'}}> ⚠️</span>}</span></a>
          : <span className="apt-cpop-miss">{isEn?'No WhatsApp':'Sin WhatsApp'}</span>}
      </div>
      {/* Co-owners */}
      {coOwners.filter(co=>co.firstName||co.lastName).map((co,i)=>{
        const coName=[co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ');
        const coWaDigits=normalizePhoneForWhatsApp(co.whatsapp);
        return (
          <div key={i} className="apt-cpop-section">
            <span className="apt-cpop-lbl">👤 {isEn?'Co-owner':'Copropietario'}{coName?` · ${coName}`:''}</span>
            {coWaDigits
              ? <a className="apt-cpop-link" href={`https://wa.me/${coWaDigits}`} target="_blank" rel="noreferrer"><IconWhatsApp/><span>{co.whatsapp}</span></a>
              : <span className="apt-cpop-miss">{isEn?'No WhatsApp':'Sin WhatsApp'}</span>}
          </div>
        );
      })}
      {/* Operator — only if any contact info exists */}
      {hasOperator && (
        <div className="apt-cpop-section">
          <span className="apt-cpop-lbl">🔧 {isEn?'Operator':'Operador'}{operatorName ? ` · ${operatorName}` : ''}</span>
          {operatorEmail
            ? <a className="apt-cpop-link" href={`mailto:${operatorEmail}`}><IconEmail/><span>{operatorEmail}</span></a>
            : null}
          {opWaDigits
            ? <a className="apt-cpop-link" href={`https://wa.me/${opWaDigits}`} target="_blank" rel="noreferrer"><IconWhatsApp/><span>{opWaRaw}</span></a>
            : null}
        </div>
      )}
    </div>
  );
}
