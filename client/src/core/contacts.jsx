// Contact directory + display.
//
// Helpers (no React):
//   copyText(text, showToast, lang)         clipboard write with toast feedback
//   buildContactDirectory(listings)         Map keyed by uid|email|name
//   lookupContact(directory, { uid, email, name })  find a contact, fall back
//
// Component:
//   <UserContact>   hover button → fixed-position card with email/WhatsApp
//                   actions, copy buttons, brand icons.
//
// Lifted byte-identical from App.jsx in stage F13. The two SVG brand icons
// (IconEmail, IconWhatsApp) live in core/ui/Icons.jsx so other places can
// reuse them.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F13.

import React, { useState, useRef } from "react";
import { normalizePhoneForWhatsApp } from "./utils";
import { IconEmail, IconWhatsApp } from "./ui/Icons";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const copyText = async (text, showToast = () => {}, lang = 'es-CO') => {
  const value = String(text || '').trim();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    showToast(lang === 'en' ? 'Copied to clipboard' : 'Copiado al portapapeles');
  } catch (e) {
    window.prompt(lang === 'en' ? 'Copy this value:' : 'Copia este valor:', value);
  }
};

export const buildContactDirectory = (listings = []) => {
  const byKey = new Map();
  const put = (key, data) => {
    if (!key) return;
    const existing = byKey.get(key) || { name: '', email: '', whatsapp: '', apartments: [] };
    const apartments = Array.from(new Set([...(existing.apartments || []), ...(data.apartments || []).filter(Boolean)]));
    byKey.set(key, { ...existing, ...data, apartments, name: data.name || existing.name, email: data.email || existing.email, whatsapp: data.whatsapp || existing.whatsapp });
  };
  listings.forEach(l => {
    const apt = l?.apt ? `Apt ${l.apt}` : '';
    const owner = { uid: l.ownerUid, name: l.owner || '', email: l.email || l.ownerEmail || '', whatsapp: l.contact || l.whatsapp || '', apartments: [apt].filter(Boolean) };
    put(l.ownerUid || '', owner); put(String(owner.email || '').toLowerCase(), owner); put(String(owner.name || '').toLowerCase(), owner);
    const op = { name: l.operator || '', email: l.operatorEmail || l.operator_email || '', whatsapp: l.operatorWhatsapp || l.operator_whatsapp || '', apartments: [apt].filter(Boolean) };
    put(String(op.email || '').toLowerCase(), op); put(String(op.name || '').toLowerCase(), op);
  });
  return byKey;
};

export const lookupContact = (directory, { uid = '', email = '', name = '' } = {}) => {
  return directory.get(String(uid || '')) || directory.get(String(email || '').toLowerCase()) || directory.get(String(name || '').toLowerCase()) || { name: name || '', email: email || '', whatsapp: '', apartments: [] };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function UserContact({ name = '', email = '', whatsapp = '', apartments = [], directory, uid = '', showToast = () => {}, onEmail = () => {}, lang = 'es-CO', children }) {
  const [cardPos, setCardPos] = useState(null);
  const hideTimer = useRef(null);
  const btnRef = useRef(null);
  const c = lookupContact(directory || new Map(), { uid, email, name });
  const finalName = name || c.name || email || (lang === 'en' ? 'User' : 'Usuario');
  const finalEmail = email || c.email || '';
  const finalWhatsapp = whatsapp || c.whatsapp || '';
  const aptList = Array.from(new Set([...(apartments || []), ...(c.apartments || [])].filter(Boolean)));
  const waDigits = normalizePhoneForWhatsApp(finalWhatsapp);
  const schedHide = () => { if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setCardPos(null), 220); };
  const cancelHide = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  const openCard = () => {
    cancelHide();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const cardW = 296;
      const x = Math.max(8, Math.min(r.left, window.innerWidth - cardW - 8));
      const y = Math.min(r.bottom + 6, window.innerHeight - 190);
      setCardPos({ x, y });
    }
  };
  return (
    <span className="contact-hover-wrap" onMouseEnter={openCard} onMouseLeave={schedHide}>
      <button type="button" ref={btnRef} className="contact-name-btn"
        onFocus={openCard} onBlur={schedHide} onClick={e => e.preventDefault()}>
        {children || finalName}
      </button>
      {cardPos && (
        <span className="contact-card"
          style={{display:'flex',flexDirection:'column',gap:'7px',position:'fixed',left:cardPos.x,top:cardPos.y,zIndex:2147483646}}
          onClick={e => e.stopPropagation()} onMouseEnter={cancelHide} onMouseLeave={schedHide}>
          <strong style={{color:'#203f2b'}}>{finalName}</strong>
          {aptList.length > 0 && <span style={{fontSize:'.75rem',color:'#235f72'}}>🏠 {aptList.join(', ')}</span>}
          {finalEmail && (
            <span className="contact-line">
              <span className="contact-line-val">✉️ {finalEmail}</span>
              <button type="button" title={lang==='en'?'Copy email':'Copiar email'} onClick={() => copyText(finalEmail, showToast, lang)}>📋</button>
              <a href={`mailto:${finalEmail}`} className="contact-action-link" target="_blank" rel="noreferrer" title={lang==='en'?'Open in email app':'Abrir en app de email'}><IconEmail/> {lang==='en'?'Email':'Email'}</a>
            </span>
          )}
          {finalWhatsapp && (
            <span className="contact-line">
              <span className="contact-line-val">📲 {finalWhatsapp}</span>
              <button type="button" title={lang==='en'?'Copy number':'Copiar número'} onClick={() => copyText(finalWhatsapp, showToast, lang)}>📋</button>
              {waDigits && <a href={`https://wa.me/${waDigits}`} className="contact-action-link" target="_blank" rel="noreferrer" title={lang==='en'?'Open in WhatsApp':'Abrir en WhatsApp'}><IconWhatsApp/> WhatsApp</a>}
            </span>
          )}
          {!finalEmail && !finalWhatsapp && <span style={{color:'#607063',fontSize:'.75rem'}}>{lang === 'en' ? 'No contact info' : 'Sin info de contacto'}</span>}
        </span>
      )}
    </span>
  );
}
