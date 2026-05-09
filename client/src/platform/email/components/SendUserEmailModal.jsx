// SendUserEmailModal — admin-triggered "send email to user" modal.
// Captures subject + message and posts via the parent's onSend callback,
// which routes to /api/admin/send-user-email.
//
// Lifted byte-identical from App.jsx in stage F25. Pulls lang via
// useApp(); contact, fromUser, onSend, onClose stay as per-instance
// props.
//
// Opens platform/email/ as a peer to the server-side server/platform/email/
// for future email-related views (delivery log viewer, template preview,
// etc.).
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F25.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { appText } from "../../../core/i18n/app-text";
import Overlay from "../../../core/ui/Overlay";

export default function SendUserEmailModal({ contact, fromUser, onSend, onClose }) {
  const { lang } = useApp();
  const [subject,setSubject]=useState('');
  const [message,setMessage]=useState('');
  const [err,setErr]=useState('');
  return <Overlay onClose={onClose} wide>
    <div className="modal-title">{lang==='en'?'Send email':'Enviar email'}</div>
    <div className="modal-sub">{contact?.name || contact?.email} · {contact?.email}</div>
    <div className="fg full"><label>{lang==='en'?'Subject *':'Asunto *'}</label><input value={subject} onChange={e=>{setSubject(e.target.value);setErr('');}} placeholder={lang==='en'?'Message subject':'Asunto del mensaje'} /> </div>
    <div className="fg full"><label>{lang==='en'?'Message *':'Mensaje *'}</label><textarea value={message} onChange={e=>{setMessage(e.target.value);setErr('');}} rows={6} placeholder={lang==='en'?'Write your message...':'Escribe tu mensaje...'} /></div>
    {err && <div className="err-msg">{err}</div>}
    <div className="mact"><button className="btn-ghost" onClick={onClose}>{appText(lang,'form.cancel')}</button><button className="btn-p" onClick={()=>{ if(!subject.trim() || !message.trim()){setErr(lang==='en'?'Subject and message are required.':'Asunto y mensaje son requeridos.'); return;} onSend({ to:contact.email, toName:contact.name, subject, message }); }}>{lang==='en'?'Send':'Enviar'}</button></div>
  </Overlay>;
}
