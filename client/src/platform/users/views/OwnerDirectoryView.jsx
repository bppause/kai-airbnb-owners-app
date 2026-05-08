// OwnerDirectoryView — searchable list of owners + co-owners across all
// listings. Used by ListingsView's directory tab.
//
// Builds a flat result list per query:
//   - Each listing's primary owner (matches name/email/userEmail/apt/contact)
//   - Each listing's co-owners (matches full-name/whatsapp/apt)
//
// Lifted byte-identical from App.jsx in stage F18. Pulls lang via
// useApp(); listings stays as a per-instance prop.
//
// Opens the platform/users/ folder for future user-directory views
// (admin user list, role assignment UI, etc.).
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F18.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import EmptyState from "../../../core/ui/EmptyState";

export default function OwnerDirectoryView({ listings }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();

  // Build a flat list of owner entries (primary + co-owners) with their listing reference
  const results = [];
  for (const l of listings) {
    // Primary owner
    const primaryMatch = !ql ||
      String(l.owner||'').toLowerCase().includes(ql) ||
      String(l.email||'').toLowerCase().includes(ql) ||
      String(l.userEmail||'').toLowerCase().includes(ql) ||
      String(l.apt||'').includes(ql) ||
      String(l.contact||'').replace(/\s/g,'').includes(ql.replace(/\s/g,''));
    if (primaryMatch) {
      results.push({ type:'primary', name:l.owner||'—', email:l.email||l.userEmail||'', whatsapp:l.contact||'', apt:l.apt, listingId:l.id });
    }
    // Co-owners
    for (const co of (l.coOwners||[])) {
      const fullName = [co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ');
      const coMatch = !ql ||
        fullName.toLowerCase().includes(ql) ||
        String(co.whatsapp||'').replace(/\s/g,'').includes(ql.replace(/\s/g,'')) ||
        String(l.apt||'').includes(ql);
      if (coMatch) {
        results.push({ type:'co', name:fullName||'—', email:'', whatsapp:co.whatsapp||'', apt:l.apt, listingId:l.id });
      }
    }
  }

  return (
    <div>
      <div style={{position:'relative',marginBottom:14}}>
        <input className="search" style={{paddingRight:36}} placeholder={isEn?'Search by name, email, unit or WhatsApp…':'Buscar por nombre, email, unidad o WhatsApp…'} value={q} onChange={e=>setQ(e.target.value)}/>
        {q&&<button className="inc-search-clear" onClick={()=>setQ('')}>✕</button>}
      </div>
      {results.length===0
        ? <EmptyState icon="👤" title={isEn?'No owners found':'Sin resultados'} sub={isEn?'Try a different search term.':'Intenta con otro término.'}/>
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {results.map((r,i)=>(
              <div key={i} style={{background:'#fff',border:'1px solid #cce7ee',borderRadius:10,padding:'12px 16px',display:'flex',flexWrap:'wrap',gap:'6px 20px',alignItems:'flex-start'}}>
                <div style={{flex:'1 1 160px'}}>
                  <div style={{fontWeight:700,fontSize:'.93rem',color:'#1a4a5a'}}>{r.name}</div>
                  {r.type==='co'&&<div style={{fontSize:'.72rem',color:'#70d6c6',marginTop:1}}>{isEn?'Co-owner':'Propietario adicional'}</div>}
                </div>
                <div style={{flex:'1 1 130px',fontSize:'.83rem',color:'#4a7a8a'}}>
                  <span style={{fontWeight:600,marginRight:4}}>{isEn?'Unit':'Unidad'}:</span>{r.apt}
                </div>
                {r.email&&<div style={{flex:'1 1 180px',fontSize:'.83rem',color:'#4a7a8a',wordBreak:'break-all'}}>
                  <span style={{fontWeight:600,marginRight:4}}>Email:</span>{r.email}
                </div>}
                {r.whatsapp&&<div style={{flex:'1 1 150px',fontSize:'.83rem',color:'#4a7a8a'}}>
                  <span style={{fontWeight:600,marginRight:4}}>WhatsApp:</span>{r.whatsapp}
                </div>}
              </div>
            ))}
          </div>
      }
      <div style={{fontSize:'.75rem',color:'#8ab0bb',marginTop:10,textAlign:'right'}}>{results.length} {isEn?'result(s)':'resultado(s)'}</div>
    </div>
  );
}
