// UserTour — 7-step interactive onboarding modal. Each step has an icon
// + bilingual title/description, a custom mockup (mini app fragment),
// and an optional "Try it" CTA that calls back into the parent app.
//
// Internal language toggle (ES/EN buttons in the header) overrides the
// app-wide lang for the modal duration; initial value is seeded from
// useApp().lang.
//
// Lifted byte-identical from App.jsx in stage F24. Pulls lang via
// useApp() (used to seed tourLang); onClose, onGo, onReport, onAddListing
// stay as per-instance props.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F24.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";

export default function UserTour({ onClose=()=>{}, onGo=()=>{}, onReport=()=>{}, onAddListing=()=>{} }) {
  const { lang } = useApp();
  const [step, setStep] = useState(0);
  const [tourLang, setTourLang] = useState(lang);
  const isEn = tourLang === 'en';
  const T = (es, en) => isEn ? en : es;

  const steps = [
    {
      icon: '👋', color: '#2F4F3A', bg: '#e8f5ec',
      title: T('¡Bienvenido a la app!', 'Welcome to the app!'),
      desc: T(
        'Esta guía interactiva (7 pasos) te muestra todo lo que necesitas saber como propietario. Puedes cerrarla en cualquier momento y volver desde el menú de perfil → "Tour interactivo".',
        'This interactive guide (7 steps) shows you everything you need as a registered owner. Close anytime and return from the profile menu → "Interactive tour".'
      ),
      mockup: () => (
        <div style={{background:'#f5fbfd',borderRadius:10,padding:'14px 18px',border:'1px solid #cce7ee',fontSize:'.82rem',color:'#17313a'}}>
          <div style={{fontWeight:700,marginBottom:8,fontSize:'.9rem'}}>🏢 Propietarios Airbnb KAI</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {['📊 Dashboard','⚠️ Incidentes','🏠 Mis Unidades','🔔 Alertas','❓ Ayuda'].map(l=>(
              <span key={l} style={{background:'#fff',border:'1px solid #cce7ee',borderRadius:20,padding:'4px 12px',fontSize:'.75rem',color:'#2a5a6a'}}>{l}</span>
            ))}
          </div>
        </div>
      ),
      action: null,
    },
    {
      icon: '📊', color: '#1565C0', bg: '#e3f2fd',
      title: T('Panel principal (Dashboard)', 'Dashboard'),
      desc: T(
        'El Dashboard es tu pantalla de inicio. Muestra un resumen de incidentes abiertos, alertas de la comunidad y acciones pendientes en tus unidades. Todo de un vistazo.',
        'The Dashboard is your home screen. It shows a summary of open incidents, community alerts, and pending actions on your units — all at a glance.'
      ),
      mockup: () => (
        <div style={{background:'#f5fbfd',borderRadius:10,padding:'14px 18px',border:'1px solid #cce7ee',fontSize:'.8rem'}}>
          <div style={{display:'flex',gap:10,marginBottom:10,flexWrap:'wrap'}}>
            {[{n:'3',l:T('Abiertos','Open'),c:'#c62828'},{n:'1',l:T('Por verificar','To verify'),c:'#2F4F3A'},{n:'12',l:T('Mis unidades','My units'),c:'#1565C0'}].map(s=>(
              <div key={s.l} style={{flex:1,minWidth:70,background:'#fff',borderRadius:8,padding:'10px',border:'1px solid #e0f2f1',textAlign:'center'}}>
                <div style={{fontSize:'1.4rem',fontWeight:700,color:s.c}}>{s.n}</div>
                <div style={{fontSize:'.7rem',color:'#6b9ba8'}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{background:'#fff3e0',borderRadius:8,padding:'8px 12px',color:'#e65100',fontSize:'.75rem',fontWeight:600}}>
            ✅ {T('Tienes 1 incidente por verificar en tu unidad','You have 1 incident to verify on your unit')}
          </div>
        </div>
      ),
      action: { label: T('Ver mi Dashboard','Go to Dashboard'), fn: ()=>onGo('dashboard') },
    },
    {
      icon: '⚠️', color: '#C62828', bg: '#ffebee',
      title: T('Reportar un incidente', 'Report an Incident'),
      desc: T(
        'Cuando hay un problema en tu unidad o en la comunidad, presiona "Reportar incidente". Selecciona el tipo, categoría y describe el problema. El propietario y operador correctos reciben notificación automáticamente.',
        'When there\'s an issue in your unit or the community, press "Report Incident". Select the type, category, and describe the problem. The right owner and operator are notified automatically.'
      ),
      mockup: () => (
        <div style={{background:'#f5fbfd',borderRadius:10,padding:'14px 18px',border:'1px solid #cce7ee',fontSize:'.8rem'}}>
          <div style={{fontWeight:600,marginBottom:10,color:'#c62828'}}>⚠️ {T('Nuevo incidente','New Incident')}</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              {l:T('Apartamento','Apartment'), v:'KAI-501'},
              {l:T('Tipo','Type'), v:T('Daño físico','Physical damage')},
              {l:T('Categoría','Category'), v:T('Plomería','Plumbing')},
            ].map(f=>(
              <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #eef6f8'}}>
                <span style={{color:'#6b9ba8',fontSize:'.75rem'}}>{f.l}</span>
                <span style={{fontWeight:600,color:'#17313a',fontSize:'.78rem'}}>{f.v}</span>
              </div>
            ))}
            <div style={{marginTop:6}}>
              <div style={{color:'#6b9ba8',fontSize:'.75rem',marginBottom:4}}>{T('Descripción','Description')}</div>
              <div style={{background:'#fff',border:'1px solid #cce7ee',borderRadius:6,padding:'6px 10px',color:'#17313a',fontSize:'.78rem',fontStyle:'italic'}}>
                {T('Hay una fuga en el baño principal...','There is a leak in the main bathroom...')}
              </div>
            </div>
          </div>
          <button style={{marginTop:12,width:'100%',background:'#C62828',color:'#fff',border:'none',borderRadius:8,padding:'8px',fontWeight:700,fontSize:'.82rem',cursor:'default'}}>
            {T('📤 Enviar reporte','📤 Submit report')}
          </button>
        </div>
      ),
      action: { label: T('Reportar un incidente','Report an Incident'), fn: onReport },
    },
    {
      icon: '📋', color: '#6A1B9A', bg: '#f3e5f5',
      title: T('Seguimiento de incidentes', 'Track Incidents'),
      desc: T(
        'En "Incidentes" ves todos los reportes de la comunidad. Puedes filtrar por estado (abierto, verificado, resuelto), ver los de tus unidades específicamente, o agregar notas de resolución. Recibirás notificaciones cuando el estado cambie.',
        'In "Incidents" you see all community reports. Filter by status (open, verified, resolved), view only your units, or add resolution notes. You\'ll be notified when status changes.'
      ),
      mockup: () => (
        <div style={{background:'#f5fbfd',borderRadius:10,padding:'14px 18px',border:'1px solid #cce7ee',fontSize:'.8rem'}}>
          <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
            {[T('Todos','All'), T('Abiertos','Open'), T('Mis unidades','My units'), T('Por verificar','To verify')].map((f,i)=>(
              <span key={f} style={{padding:'3px 10px',borderRadius:20,border:'1px solid',borderColor:i===1?'#6A1B9A':'#cce7ee',background:i===1?'#6A1B9A':'#fff',color:i===1?'#fff':'#6b9ba8',fontSize:'.72rem',fontWeight:i===1?700:400}}>{f}</span>
            ))}
          </div>
          {[
            {apt:'KAI-501',type:T('Plomería','Plumbing'),status:T('Abierto','Open'),color:'#c62828'},
            {apt:'KAI-302',type:T('Eléctrico','Electrical'),status:T('En revisión','In review'),color:'#e65100'},
            {apt:'KAI-208',type:T('Limpieza','Cleaning'),status:T('Resuelto','Resolved'),color:'#2F4F3A'},
          ].map(r=>(
            <div key={r.apt} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #eef6f8'}}>
              <span style={{fontWeight:600,color:'#17313a'}}>🏠 {r.apt}</span>
              <span style={{color:'#6b9ba8',fontSize:'.75rem'}}>{r.type}</span>
              <span style={{fontSize:'.7rem',fontWeight:700,color:r.color,background:r.color+'15',padding:'2px 8px',borderRadius:12}}>{r.status}</span>
            </div>
          ))}
        </div>
      ),
      action: { label: T('Ver incidentes','View Incidents'), fn: ()=>onGo('incidents') },
    },
    {
      icon: '🏠', color: '#00695C', bg: '#e0f2f1',
      title: T('Mis unidades', 'My Units'),
      desc: T(
        'En "Mis Unidades" gestionas tus apartamentos registrados. Mantén actualizado el email y WhatsApp del operador — son clave para que las notificaciones de incidentes lleguen al responsable correcto.',
        'In "My Units" you manage your registered apartments. Keep the operator\'s email and WhatsApp up to date — they\'re key for incident notifications to reach the right person.'
      ),
      mockup: () => (
        <div style={{background:'#f5fbfd',borderRadius:10,padding:'14px 18px',border:'1px solid #cce7ee',fontSize:'.8rem'}}>
          <div style={{fontWeight:700,marginBottom:10,color:'#00695C'}}>🏠 KAI-501 · {T('Torre A, Piso 5','Tower A, Floor 5')}</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[
              {l:T('Propietario','Owner'), v:'María García · maria@email.com'},
              {l:T('Operador','Operator'), v:'Carlos López'},
              {l:T('WhatsApp operador','Operator WhatsApp'), v:'+57 300 123 4567'},
              {l:T('Estado','Status'), v:T('✅ Aprobado','✅ Approved'), c:'#2F4F3A'},
            ].map(f=>(
              <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #eef6f8'}}>
                <span style={{color:'#6b9ba8',fontSize:'.75rem'}}>{f.l}</span>
                <span style={{fontWeight:600,color:f.c||'#17313a',fontSize:'.78rem'}}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      action: { label: T('Ver mis unidades','View my units'), fn: ()=>onGo('my') },
    },
    {
      icon: '🔔', color: '#E65100', bg: '#fff3e0',
      title: T('Notificaciones y alertas', 'Notifications & Alerts'),
      desc: T(
        'El ícono de campana 🔔 en la barra de navegación muestra alertas de la comunidad. Recibirás notificaciones por email y en la app cuando cambien incidentes de tus unidades. Toca la campana para verlas todas.',
        'The 🔔 bell icon in the navigation bar shows community alerts. You\'ll receive email and in-app notifications when incidents on your units change status. Tap the bell to see them all.'
      ),
      mockup: () => (
        <div style={{background:'#f5fbfd',borderRadius:10,padding:'14px 18px',border:'1px solid #cce7ee',fontSize:'.8rem'}}>
          <div style={{fontWeight:600,marginBottom:10,color:'#e65100'}}>🔔 {T('Alertas recientes','Recent Alerts')}</div>
          {[
            {icon:'✅',msg:T('Tu incidente KAI-501 fue verificado','Your incident KAI-501 was verified'),time:T('hace 2h','2h ago')},
            {icon:'🛠️',msg:T('Nuevo comentario en KAI-302','New comment on KAI-302'),time:T('hace 5h','5h ago')},
            {icon:'📝',msg:T('Incidente resuelto en KAI-208','Incident resolved on KAI-208'),time:T('ayer','yesterday')},
          ].map((n,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'6px 0',borderBottom:'1px solid #eef6f8'}}>
              <span style={{fontSize:'1rem'}}>{n.icon}</span>
              <span style={{flex:1,color:'#17313a',lineHeight:1.4}}>{n.msg}</span>
              <span style={{color:'#aabcb8',fontSize:'.7rem',flexShrink:0}}>{n.time}</span>
            </div>
          ))}
        </div>
      ),
      action: { label: T('Ver notificaciones','View Notifications'), fn: ()=>onGo('notifications') },
    },
    {
      icon: '👤', color: '#37474F', bg: '#eceff1',
      title: T('Tu perfil y preferencias', 'Your Profile & Preferences'),
      desc: T(
        'En tu Perfil (menú superior derecho → "Mi perfil") puedes cambiar el idioma de la app entre español e inglés, actualizar tu WhatsApp de contacto, y gestionar tus preferencias. Los cambios aplican de inmediato en toda la app.',
        'In your Profile (top-right menu → "My profile") you can switch the app language between Spanish and English, update your contact WhatsApp, and manage your preferences. Changes apply immediately across the whole app.'
      ),
      mockup: () => (
        <div style={{background:'#f5fbfd',borderRadius:10,padding:'14px 18px',border:'1px solid #cce7ee',fontSize:'.8rem'}}>
          <div style={{fontWeight:700,marginBottom:10,color:'#37474F'}}>👤 {T('Mi perfil','My Profile')}</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              {l:T('Idioma de la app','App language'), v:'🇨🇴 Español / 🇺🇸 English'},
              {l:T('Email (Google)','Email (Google)'), v:'propietario@gmail.com'},
              {l:'WhatsApp', v:'+57 300 123 4567'},
              {l:T('País','Country'), v:'Colombia 🇨🇴'},
            ].map(f=>(
              <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #eef6f8'}}>
                <span style={{color:'#6b9ba8',fontSize:'.75rem'}}>{f.l}</span>
                <span style={{fontWeight:600,color:'#17313a',fontSize:'.78rem'}}>{f.v}</span>
              </div>
            ))}
          </div>
          <button style={{marginTop:12,width:'100%',background:'#2F4F3A',color:'#fff',border:'none',borderRadius:8,padding:'8px',fontWeight:700,fontSize:'.82rem',cursor:'default'}}>
            💾 {T('Guardar cambios','Save changes')}
          </button>
        </div>
      ),
      action: { label: T('Ir a mi perfil','Go to my profile'), fn: ()=>onGo('profile') },
    },
  ];

  const cur = steps[step];
  const total = steps.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  return (
    <div style={{position:'fixed',inset:0,zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',background:'rgba(10,25,18,.72)',backdropFilter:'blur(4px)'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'#fff',borderRadius:18,boxShadow:'0 24px 80px rgba(0,0,0,.28)',maxWidth:540,width:'100%',maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #eef6f8',flexShrink:0}}>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setTourLang('es')} style={{padding:'3px 10px',borderRadius:20,border:'1.5px solid',borderColor:!isEn?'#2F4F3A':'#cce7ee',background:!isEn?'#2F4F3A':'#fff',color:!isEn?'#fff':'#6b9ba8',fontSize:'.73rem',fontWeight:!isEn?700:400,cursor:'pointer'}}>🇨🇴 ES</button>
            <button onClick={()=>setTourLang('en')} style={{padding:'3px 10px',borderRadius:20,border:'1.5px solid',borderColor:isEn?'#2F4F3A':'#cce7ee',background:isEn?'#2F4F3A':'#fff',color:isEn?'#fff':'#6b9ba8',fontSize:'.73rem',fontWeight:isEn?700:400,cursor:'pointer'}}>🇺🇸 EN</button>
          </div>
          <div style={{fontSize:'.75rem',color:'#aabcb8',fontWeight:600}}>{T('Paso','Step')} {step+1} / {total}</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'1.3rem',cursor:'pointer',color:'#aabcb8',lineHeight:1,padding:'2px 6px'}} title={T('Cerrar','Close')}>✕</button>
        </div>

        {/* Body */}
        <div style={{overflowY:'auto',flex:1,padding:'24px 24px 16px'}}>
          {/* Step icon */}
          <div style={{display:'flex',justifyContent:'center',marginBottom:18}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:cur.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2.2rem',boxShadow:`0 4px 20px ${cur.color}22`}}>
              {cur.icon}
            </div>
          </div>
          <h2 style={{textAlign:'center',fontSize:'1.2rem',fontWeight:800,color:'#17313a',margin:'0 0 10px'}}>{cur.title}</h2>
          <p style={{textAlign:'center',color:'#4a6a72',fontSize:'.88rem',lineHeight:1.65,margin:'0 0 20px'}}>{cur.desc}</p>

          {/* Mockup */}
          {cur.mockup && <div style={{marginBottom:20}}>{cur.mockup()}</div>}

          {/* Try it action */}
          {cur.action && (
            <div style={{textAlign:'center',marginBottom:8}}>
              <button onClick={cur.action.fn} style={{background:cur.color,color:'#fff',border:'none',borderRadius:10,padding:'10px 24px',fontWeight:700,fontSize:'.88rem',cursor:'pointer',boxShadow:`0 4px 16px ${cur.color}44`}}>
                {cur.action.label} →
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'14px 24px 20px',borderTop:'1px solid #eef6f8',flexShrink:0}}>
          {/* Progress dots */}
          <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:16}}>
            {steps.map((_,i)=>(
              <button key={i} onClick={()=>setStep(i)}
                style={{width:i===step?24:8,height:8,borderRadius:4,border:'none',background:i===step?cur.color:'#d4e8ee',cursor:'pointer',transition:'all .2s',padding:0}}/>
            ))}
          </div>
          {/* Prev / Next */}
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button onClick={()=>setStep(s=>s-1)} disabled={isFirst}
              style={{flex:1,padding:'10px',borderRadius:10,border:'1.5px solid #cce7ee',background:isFirst?'#f5fbfd':'#fff',color:isFirst?'#aabcb8':'#2a5a6a',fontWeight:600,fontSize:'.85rem',cursor:isFirst?'default':'pointer'}}>
              ← {T('Anterior','Previous')}
            </button>
            {isLast ? (
              <button onClick={onClose}
                style={{flex:2,padding:'10px',borderRadius:10,border:'none',background:'#2F4F3A',color:'#fff',fontWeight:700,fontSize:'.88rem',cursor:'pointer'}}>
                🎉 {T('¡Listo, a explorar!','Done, let\'s explore!')}
              </button>
            ) : (
              <button onClick={()=>setStep(s=>s+1)}
                style={{flex:2,padding:'10px',borderRadius:10,border:'none',background:'#2F4F3A',color:'#fff',fontWeight:700,fontSize:'.88rem',cursor:'pointer'}}>
                {T('Siguiente','Next')} →
              </button>
            )}
          </div>
          {!isFirst && !isLast && <div style={{textAlign:'center',marginTop:10}}>
            <button onClick={onClose} style={{background:'none',border:'none',color:'#aabcb8',fontSize:'.75rem',cursor:'pointer',textDecoration:'underline'}}>{T('Saltar guía','Skip tour')}</button>
          </div>}
        </div>
      </div>
    </div>
  );
}
