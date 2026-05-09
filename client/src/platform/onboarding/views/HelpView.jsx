// HelpView — top-level /help tab. Role-aware bilingual help directory:
// search box + category filter pills + grid of help topics. Selecting a
// topic shows a full article with optional CTA buttons (Quick actions)
// that call back into the parent app (open modals, switch view, set
// quick filters).
//
// Lifted byte-identical from App.jsx in stage F24. Pulls lang via
// useApp(); other props (effectiveRole, effectiveIsGlobalAdmin,
// delegatePerms, listings, incidents, user, setView, onReport,
// onAddListing, setIncidentQuickFilter, openMore, onStartTour) stay
// per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F24.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import { HELP_TOPICS, HELP_ACTIONS } from "../help-content";
import { HL } from "../../../core/utils";

export default function HelpView({ effectiveRole, effectiveIsGlobalAdmin, listings=[], incidents=[], user,
                    setView=()=>{}, onReport=()=>{}, onAddListing=()=>{}, setIncidentQuickFilter=()=>{}, openMore=()=>{}, onStartTour=()=>{} }) {
  const { lang } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const L = s => s?.[lang === 'en' ? 'en' : 'es'] ?? '';
  const role = effectiveIsGlobalAdmin ? 'global_admin' : (effectiveRole || 'user');
  const topics = HELP_TOPICS.filter(t => t.roles.includes(role));
  const filtered = topics.filter(t => {
    if (category !== 'all' && t.category !== category) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return L(t.title).toLowerCase().includes(q) || L(t.summary).toLowerCase().includes(q) ||
      t.sections.some(s => L(s.h).toLowerCase().includes(q) || L(s.b).toLowerCase().includes(q));
  });
  const CATS = [
    { id:'all', icon:'🔍', label:HL('Todo','All') },
    { id:'basics', icon:'📖', label:HL('Básicos','Basics') },
    { id:'incidents', icon:'⚠️', label:HL('Incidentes','Incidents') },
    { id:'admin', icon:'⚙️', label:HL('Admin','Admin') },
    { id:'account', icon:'👤', label:HL('Cuenta','Account') },
  ].filter(c => c.id === 'all' || topics.some(t => t.category === c.id));
  const handlers = { setView, onReport, onAddListing, setQuickFilter: setIncidentQuickFilter, openMore };

  if (selected) {
    const t = selected;
    const actions = (HELP_ACTIONS[t.id] || []).filter(a => {
      // hide admin-only actions for non-admins
      if ((t.id==='approvals'||t.id==='users'||t.id==='settings'||t.id==='analytics') && !effectiveIsGlobalAdmin && role!=='delegate_admin') return false;
      return true;
    });
    return (
      <div className="fade">
        <button className="btn-ghost" style={{marginBottom:18}} onClick={() => setSelected(null)}>
          ← {lang === 'en' ? 'Back to Help' : 'Volver a Ayuda'}
        </button>
        <div className="card help-article">
          <div className="help-article-hdr">
            <span className="help-article-icon">{t.icon}</span>
            <div>
              <h1 className="ptitle" style={{margin:0,fontSize:'1.55rem'}}>{L(t.title)}</h1>
              <p className="psub" style={{margin:'6px 0 0'}}>{L(t.summary)}</p>
            </div>
          </div>
          {t.sections.map((s, i) => (
            <div key={i} className="help-section">
              <h3 className="help-section-h">{L(s.h)}</h3>
              <p className="help-section-b">{L(s.b)}</p>
            </div>
          ))}
          {actions.length > 0 && (
            <div className="help-actions">
              <span className="help-actions-label">{lang==='en'?'Quick actions':'Acciones rápidas'}</span>
              <div className="help-actions-row">
                {actions.map((a,i) => (
                  <button key={i}
                    className={a.primary ? 'btn-p help-action-btn' : 'btn-ghost help-action-btn'}
                    onClick={() => a.fn(handlers)}>
                    {a.icon} {L(a.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="help-article-foot">
            <button className="btn-ghost" onClick={() => setSelected(null)}>← {lang === 'en' ? 'Back to Help' : 'Volver a Ayuda'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade">
      <div className="ph" style={{alignItems:'flex-end'}}>
        <div>
          <h1 className="ptitle">❓ {lang === 'en' ? 'Help & Guide' : 'Ayuda y guía'}</h1>
          <p className="psub">{lang === 'en' ? 'Browse topics or search for any feature.' : 'Explora temas o busca cualquier función.'}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <button className="btn-p" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',fontSize:'.85rem'}} onClick={onStartTour}>
            🎯 {lang === 'en' ? 'Interactive Tour' : 'Tour interactivo'}
          </button>
          <a href="/tutorial-short.html" target="_blank" rel="noopener noreferrer"
             style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',fontSize:'.85rem',fontWeight:700,borderRadius:8,background:'#fff',color:'#0b7f4f',border:'1.5px solid rgba(11,127,79,.35)',textDecoration:'none'}}>
            ▶ {lang === 'en' ? 'Short tutorial' : 'Tutorial corto'}
          </a>
          <a href="/tutorial-full.html" target="_blank" rel="noopener noreferrer"
             style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',fontSize:'.85rem',fontWeight:700,borderRadius:8,background:'#fff',color:'#0b7f8c',border:'1.5px solid rgba(11,127,140,.35)',textDecoration:'none'}}>
            🎥 {lang === 'en' ? 'Full tutorial' : 'Tutorial completo'}
          </a>
          <a href="/guide.html" target="_blank" rel="noopener noreferrer"
             style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',fontSize:'.85rem',fontWeight:700,borderRadius:8,background:'#fff',color:'#235f72',border:'1.5px solid rgba(35,95,114,.3)',textDecoration:'none'}}>
            📖 {lang === 'en' ? 'Written guide' : 'Guía escrita'}
          </a>
          <span className="help-topic-count">{filtered.length} {lang === 'en' ? (filtered.length===1?'topic':'topics') : (filtered.length===1?'tema':'temas')}</span>
        </div>
      </div>
      <input className="search" type="search"
        placeholder={lang === 'en' ? '🔍  Search topics…' : '🔍  Buscar temas…'}
        value={query} onChange={e => setQuery(e.target.value)}
        style={{marginBottom:14,maxWidth:480,display:'block'}}
      />
      <div className="filter-row" style={{marginBottom:20}}>
        {CATS.map(c => (
          <button key={c.id} className={`fchip ${category === c.id ? 'fchip-on' : ''}`} onClick={() => setCategory(c.id)}>
            {c.icon} {L(c.label)}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="empty"><p>{lang === 'en' ? 'No topics match your search.' : 'Ningún tema coincide con tu búsqueda.'}</p></div>
        : <div className="help-grid">
            {filtered.map(t => (
              <button key={t.id} className="help-card" onClick={() => setSelected(t)}>
                <span className="help-card-icon">{t.icon}</span>
                <span className="help-card-body">
                  <strong>{L(t.title)}</strong>
                  <span>{L(t.summary)}</span>
                </span>
                <span className="help-card-arr">›</span>
              </button>
            ))}
          </div>
      }
    </div>
  );
}
