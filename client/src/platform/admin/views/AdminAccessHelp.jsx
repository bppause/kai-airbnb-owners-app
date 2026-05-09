// AdminAccessHelp — shown on the /admin tab when the current user is
// signed in but not recognized as a global admin. Surfaces the email
// + detected role and gives copy-paste instructions for adding the
// email to GLOBAL_ADMIN_EMAILS.
//
// Lifted byte-identical from App.jsx in stage F33. Pulls lang via
// useApp(); user, adminInfo stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F33.

import React from "react";
import { useApp } from "../../../core/app-state";

export default function AdminAccessHelp({ user, adminInfo }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  return <div className="fade"><div className="card"><h1 className="ptitle">⚙️ Admin</h1><p className="psub">{isEn ? 'This account is not being recognized as a global admin yet.' : 'Esta cuenta no está siendo reconocida como administrador global todavía.'}</p><div className="form-alert"><strong>{isEn ? 'Current email' : 'Email actual'}:</strong> {user?.email || 'No disponible'}<br/><strong>{isEn ? 'Detected role' : 'Rol detectado'}:</strong> {adminInfo?.role || 'user'}</div><p className="psub">{isEn ? 'In Render, add this email to GLOBAL_ADMIN_EMAILS, save changes, and redeploy. You can use several emails separated by commas.' : 'En Render agrega este email en GLOBAL_ADMIN_EMAILS, guarda cambios y redeploy. Puedes usar varios separados por coma.'}</p><pre className="codebox">GLOBAL_ADMIN_EMAILS={user?.email || 'tuemail@gmail.com'}</pre><button className="btn-p" onClick={()=>window.location.reload()}>{isEn ? 'Check again' : 'Volver a verificar'}</button></div></div>;
}
