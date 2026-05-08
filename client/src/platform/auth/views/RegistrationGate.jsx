// RegistrationGate — full-page gate shown after Google sign-in for users
// whose registration is pending, declined, or not yet submitted. Status-
// dependent banner + the registration form inline, plus a sticky language
// switch and sign-out button.
//
// Lifted byte-identical from App.jsx in stage F23. Pulls lang via useApp();
// user, registration, onSubmit, onLogout, syncing, toast, setLang, complex-
// Logo/Name/Location/Bg stay as per-instance props.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F23.

import React from "react";
import { useApp } from "../../../core/app-state";
import { getT } from "../../../core/i18n";
import { CSS } from "../../../core/styles";
import LanguageSwitch from "../../../core/ui/LanguageSwitch";
import RegistrationListingForm from "../components/RegistrationListingForm";

export default function RegistrationGate({ user, registration, onSubmit, onLogout, syncing, toast, setLang=()=>{}, complexLogo='', complexName='Propietarios Airbnb KAI', complexLocation='Serena del Mar · Cartagena 🇨🇴', complexBg='/morros-kai-bg.jpg' }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const logoSrc = complexLogo || '/morros-kai.png';
  const t = getT(lang);
  const status = registration?.status || 'none';
  const bgStyle = complexBg ? { backgroundImage:`url(${complexBg})`, backgroundSize:'cover', backgroundPosition:'center' } : {};
  return (
    <div className="app-shell gate-shell gate-shell-bg" style={bgStyle}><style>{CSS}</style>
      <div className="gate-shell-overlay"/>
      <div className="gate-card gate-wide">
        <div className="gate-top">{complexLogo ? <img src={complexLogo} className="gate-logo-img" alt={complexName}/> : <div className="logo-mark"><span className="logo-k">K</span><span className="logo-wave">~</span></div>}<LanguageSwitch lang={lang} setLang={setLang} /><button className="btn-ghost" onClick={onLogout}>{isEn ? 'Sign out' : 'Salir'}</button></div>
        <h1 className="ptitle">{isEn ? `${complexName} — Owner registration` : `Registro de propietario ${complexName}`}</h1>
        <p className="psub">{isEn ? `Hi ${user.name}. To use the app you must register one or more apartments that belong to you.` : `Hola ${user.name}. Para usar la aplicación debes registrar uno o más apartamentos que son tuyos.`}</p>
        {status === 'pending' && <div className="status-box pending"><h3>⏳ {isEn ? 'Registration pending approval' : 'Registro pendiente de aprobación'}</h3><p>{isEn ? 'Your request was received. An approved owner will review your information. We will email you when the status changes.' : 'Tu solicitud fue recibida. Un propietario aprobado revisará tus datos. Te enviaremos un email cuando cambie el estado.'}</p></div>}
        {status === 'declined' && <div className="status-box declined"><h3>🚫 {isEn ? 'Registration declined' : 'Registro rechazado'}</h3><p><strong>{isEn ? 'Reason:' : 'Motivo:'}</strong> {registration.reason || (isEn ? 'No reason provided.' : 'No se indicó motivo.')}</p><p>{isEn ? 'You can correct the information and submit a new request.' : 'Puedes corregir la información y enviar una nueva solicitud.'}</p><RegistrationListingForm user={user} onSubmit={onSubmit} submitText={isEn ? "Resubmit registration" : "Reenviar registro"} /></div>}
        {(status === 'none' || status === 'error') && <RegistrationListingForm user={user} onSubmit={onSubmit} submitText={isEn ? "Submit registration for approval" : "Enviar registro para aprobación"} />}
      </div>
      {syncing && <div className="sync-overlay"><div className="spinner-sm"/><span>{isEn ? "Saving to server..." : "Guardando en servidor..."}</span></div>}
      {toast && <div className={`toast ${toast.err?"toast-err":""}`}>{toast.msg}</div>}
    </div>
  );
}
