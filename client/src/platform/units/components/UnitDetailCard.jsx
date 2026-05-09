// UnitDetailCard — 3-step in-overlay navigator: Unit info → Incident
// list → Incident detail. Used wherever a unit needs a deep-dive view
// (Building view's number plate click, owner attention card click,
// notification deep-link, MyListings expanded row).
//
// Step routing is internal: defaultStep + defaultIncidentId props seed
// the initial step, and the component navigates between steps via its
// own setStep/setSelectedIncId.
//
// Lifted byte-identical from App.jsx in stage F30. Pulls lang via
// useApp() (isEn derived internally — both `lang` and `isEn` were
// previously redundant props). Other props (l, incidents, perm flags,
// callbacks, defaultStep, defaultIncidentId) stay per-instance.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F30.

import React, { useState } from "react";
import { useApp } from "../../../core/app-state";
import {
  appText, aptDisplay, getDefaultTower,
  incidentTypeLabel, categoryLabel,
} from "../../../core/i18n/app-text";
import {
  normalizePhoneForWhatsApp, fmtDate, fmtDateTime, slaResInfo,
  normalizeOwnerGuests, guestFullName, guestLocation,
} from "../../../core/utils";
import { INCIDENT_TYPES, GUEST_CATEGORIES } from "../../../modules/incidents/constants";
import UserContact from "../../../core/contacts";
import { IconEmail, IconWhatsApp } from "../../../core/ui/Icons";

export default function UnitDetailCard({ l, incidents, canEdit=false, canDelete=false, onEdit, onDelete, onReport,
  user, contactProps={}, isGlobalAdmin=false, canResolveGlobal=false,
  onVerify, onResolve, onAddResolution,
  defaultStep='info', defaultIncidentId=null }) {
  const { lang } = useApp();
  const isEn = lang === 'en';

  // step: 'info' | 'incidents' | 'incident'
  const [step, setStep] = useState(defaultStep||'info');
  const [selectedIncId, setSelectedIncId] = useState(defaultIncidentId||null);

  const goToIncident = (id) => { setSelectedIncId(id); setStep('incident'); };
  const goToList     = ()  => { setStep('incidents'); setSelectedIncId(null); };
  const goToInfo     = ()  => { setStep('info'); setSelectedIncId(null); };

  const aptInc = [...incidents.filter(i => i.aptId === l.id)]
    .sort((a,b) => new Date(b.createdAtFull||b.createdAt) - new Date(a.createdAtFull||a.createdAt));
  const ownerWa    = normalizePhoneForWhatsApp(l.contact);
  const opWa       = normalizePhoneForWhatsApp(l.operatorWhatsapp);
  const ownerEmail = l.userEmail || l.email || '';
  const hasOp      = !!(l.operator || l.operatorEmail || l.operatorWhatsapp);

  // ── Shared unit hero (always visible at top) ──────────────────────────
  const UnitHero = () => (
    <div className="adp-unit-hero">
      <div className="adp-unit-plate">
        <span className="adp-unit-num">{l.apt}</span>
        {l.tower&&<span className="adp-unit-tower">{l.tower}</span>}
      </div>
      <div className="adp-unit-meta">
        <span className="chip c-teal">🛏️ {l.rooms}</span>
        <span className="chip c-blue">👥 {l.guests}</span>
        {l.airbnb&&<a className="adp-airbnb-lnk" href={l.airbnb} target="_blank" rel="noreferrer">🔗 Airbnb</a>}
      </div>
      <div className="adp-unit-acts">
        {onReport&&<button className="bsm bs-rep" onClick={onReport}>+ {isEn?'Report':'Reporte'}</button>}
        {canEdit&&<button className="bsm bs-edit" onClick={onEdit}>✏️</button>}
        {canDelete&&<button className="bsm bs-del" onClick={onDelete}>🗑️</button>}
      </div>
    </div>
  );

  // ── Breadcrumb back navigation ────────────────────────────────────────
  const Breadcrumb = ({ crumbs }) => (
    <nav className="udc-breadcrumb" aria-label="breadcrumb">
      {crumbs.map((c,i)=>(
        <span key={i} className="udc-bc-item">
          {i>0&&<span className="udc-bc-sep">›</span>}
          {c.onClick
            ? <button type="button" className="udc-bc-link" onClick={c.onClick}>‹ {c.label}</button>
            : <span className="udc-bc-current">{c.label}</span>
          }
        </span>
      ))}
    </nav>
  );

  // ── STEP 1: Unit info + people ────────────────────────────────────────
  if (step === 'info') return (
    <div className="udc-wrap">
      <UnitHero/>
      {/* Listing details */}
      <div className="adp-section-lbl">🏠 {isEn?'Listing details':'Datos del listing'}</div>
      <div className="udc-fields">
        <span className="udc-field-lbl">{isEn?'Apt. #':'Apto. #'}</span>
        <span className="udc-field-val udc-apt-num">{l.apt}</span>
        <span className="udc-field-lbl">{isEn?'Tower':'Torre'}</span>
        <span className="udc-field-val">{l.tower||getDefaultTower()}</span>
        <span className="udc-field-lbl">{isEn?'Bedrooms':'Habitaciones'}</span>
        <span className="udc-field-val">🛏️ {l.rooms}</span>
        <span className="udc-field-lbl">{isEn?'Guests':'Huéspedes'}</span>
        <span className="udc-field-val">👥 {l.guests}</span>
        <span className="udc-field-lbl">Airbnb</span>
        <span className="udc-field-val">
          {l.airbnb ? <a href={l.airbnb} target="_blank" rel="noreferrer" className="adp-airbnb-lnk udc-airbnb-pill">🔗 {isEn?'View listing':'Ver listing'}</a> : <span className="udc-field-empty">{isEn?'No link':'Sin enlace'}</span>}
        </span>
        {l.createdAt&&<>
          <span className="udc-field-lbl">{isEn?'Date added':'Fecha de registro'}</span>
          <span className="udc-field-val" style={{color:'#496674',fontSize:'.8rem'}}>📅 {fmtDate(l.createdAt)}</span>
        </>}
      </div>
      {/* People */}
      <div className="adp-section-lbl">👥 {isEn?'People':'Personas'}</div>
      <div className="adp-contacts">
        <div className="adp-party">
          <div className="adp-party-lbl">👤 {isEn?'Owner':'Propietario'}</div>
          <div className="adp-party-row">
            <UserContact name={l.owner} uid={l.ownerUid} email={ownerEmail} whatsapp={l.contact} apartments={l.apt?[aptDisplay(l.apt,lang)]:[]} {...contactProps}/>
            <div className="adp-party-cbtns">
              {ownerEmail&&<a href={`mailto:${ownerEmail}`} className="ac-cbtn" title={ownerEmail}><IconEmail/></a>}
              {ownerWa&&<a href={`https://wa.me/${ownerWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer"><IconWhatsApp/></a>}
            </div>
          </div>
        </div>
        {(l.coOwners||[]).filter(co=>co.firstName||co.lastName).map((co,i)=>{
          const coName=[co.firstName,co.middleName,co.lastName].filter(Boolean).join(' ');
          const coWa=normalizePhoneForWhatsApp(co.whatsapp);
          return (
            <div key={i} className="adp-party">
              <div className="adp-party-lbl">👤 {isEn?`Co-owner ${i+1}`:`Copropietario ${i+1}`}</div>
              <div className="adp-party-row">
                <UserContact name={coName} email="" whatsapp={co.whatsapp} apartments={[]} {...contactProps}/>
                <div className="adp-party-cbtns">
                  {coWa&&<a href={`https://wa.me/${coWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer"><IconWhatsApp/></a>}
                </div>
              </div>
            </div>
          );
        })}
        {hasOp ? (
          <div className="adp-party">
            <div className="adp-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
            <div className="adp-party-row">
              {l.operator ? <UserContact name={l.operator} email={l.operatorEmail} whatsapp={l.operatorWhatsapp} apartments={[]} {...contactProps}/> : <span style={{fontSize:'.8rem',color:'#8a9fa5'}}>{l.operatorEmail||'—'}</span>}
              <div className="adp-party-cbtns">
                {l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="ac-cbtn" title={l.operatorEmail}><IconEmail/></a>}
                {opWa&&<a href={`https://wa.me/${opWa}`} className="ac-cbtn ac-cbtn-wa" target="_blank" rel="noreferrer"><IconWhatsApp/></a>}
              </div>
            </div>
          </div>
        ) : (
          <div className="adp-party adp-party-none">
            <div className="adp-party-lbl">🔧 {isEn?'Operator':'Operador'}</div>
            <span className="adp-no-op">{isEn?'No operator assigned':'Sin operador asignado'}</span>
          </div>
        )}
      </div>
      {/* Navigate to incidents */}
      <button type="button" className="udc-nav-btn" onClick={()=>setStep('incidents')}>
        📋 {isEn?'View incidents':'Ver incidentes'}
        {aptInc.length>0&&<span className="udc-nav-badge">{aptInc.length}</span>}
        <span className="udc-nav-chev">›</span>
      </button>
    </div>
  );

  // ── STEP 2: Incident list (click → Step 3 detail) ─────────────────────
  if (step === 'incidents') return (
    <div className="udc-wrap">
      <UnitHero/>
      <Breadcrumb crumbs={[
        {label:`${isEn?'Unit':'Unidad'} ${l.apt}`, onClick: goToInfo},
        {label: isEn?'Incidents':'Incidentes'}
      ]}/>
      {aptInc.length===0
        ? <div className="adp-inc-empty" style={{marginTop:16}}>✅ {isEn?'No incidents on record':'Sin incidentes registrados'}</div>
        : <div className="udc-inc-list">
            {aptInc.map(inc=>{
              const ti = INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6];
              const ci = GUEST_CATEGORIES.find(c=>c.value===inc.category);
              const guests = normalizeOwnerGuests(inc);
              const hasPendingRes = inc.status==='verified'&&!String(inc.ownerResolution||'').trim();
              const hasAwaitingAdmin = inc.status==='verified'&&String(inc.ownerResolution||'').trim();
              const statusLabel = inc.status==='resolved'
                ? {label: isEn?'Closed':'Cerrado',   cls:'udc-s-res',  icon:'✓'}
                : inc.status==='open'
                ? {label: isEn?'Open':'Abierto',      cls:'udc-s-open', icon:'⚠️'}
                : hasPendingRes
                ? {label: isEn?'Resolution':'Respuesta', cls:'udc-s-pres', icon:'📝'}
                : {label: isEn?'Awaiting admin':'Admin', cls:'udc-s-wait', icon:'⏳'};
              return (
                <button key={inc.id} type="button" className="udc-inc-row" onClick={()=>goToIncident(inc.id)}>
                  <div className="udc-inc-row-left">
                    <div className="udc-inc-row-badges">
                      <span className="ir-type" style={{background:ti.bg,color:ti.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px',fontWeight:700}}>{incidentTypeLabel(ti.value,lang)}</span>
                      {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color,fontSize:'.63rem',padding:'2px 8px',borderRadius:'999px'}}>{ci.icon} {categoryLabel(ci.value,lang)}</span>}
                    </div>
                    <div className="udc-inc-row-desc">{String(inc.desc||'').slice(0,100)}{String(inc.desc||'').length>100?'…':''}</div>
                    <div className="udc-inc-row-meta">
                      {guests.length>0&&<span className="udc-inc-row-guests">👥 {guests.slice(0,2).map(guestFullName).join(' · ')}{guests.length>2?` +${guests.length-2}`:''}</span>}
                      <span className="udc-inc-row-date">📅 {fmtDate(inc.date)}</span>
                    </div>
                  </div>
                  <div className="udc-inc-row-right">
                    <span className={`udc-inc-status ${statusLabel.cls}`}>{statusLabel.icon} {statusLabel.label}</span>
                    <span className="udc-inc-row-chev">›</span>
                  </div>
                </button>
              );
            })}
          </div>
      }
    </div>
  );

  // ── STEP 3: Full incident detail ───────────────────────────────────────
  if (step === 'incident') {
    const inc = incidents.find(i=>i.id===selectedIncId) || aptInc.find(i=>i.id===selectedIncId);
    if (!inc) return (
      <div className="udc-wrap">
        <UnitHero/>
        <Breadcrumb crumbs={[
          {label:`${isEn?'Unit':'Unidad'} ${l.apt}`, onClick: goToInfo},
          {label: isEn?'Incidents':'Incidentes', onClick: goToList},
          {label: isEn?'Detail':'Detalle'}
        ]}/>
        <div className="adp-inc-empty" style={{marginTop:16}}>⚠️ {isEn?'Incident not found':'Incidente no encontrado'}</div>
      </div>
    );
    const ti = INCIDENT_TYPES.find(t=>t.value===inc.type)||INCIDENT_TYPES[6];
    const ci = GUEST_CATEGORIES.find(c=>c.value===inc.category);
    const guests = normalizeOwnerGuests(inc);
    const isOwner = Boolean(user?.uid && l.ownerUid === user.uid);
    const hasPendingRes = inc.status==='verified'&&!String(inc.ownerResolution||'').trim();
    const statusMeta = inc.status==='resolved'
      ? {label: isEn?'Closed':'Cerrado',         cls:'idd-status-resolved', icon:'✓'}
      : inc.status==='open'
      ? {label: isEn?'Open — action needed':'Abierto — acción requerida', cls:'idd-status-open', icon:'⚠️'}
      : hasPendingRes
      ? {label: isEn?'Verified — resolution needed':'Verificado — falta respuesta', cls:'idd-status-pres', icon:'📝'}
      : {label: isEn?'Awaiting admin close':'En espera del admin', cls:'idd-status-wait', icon:'⏳'};

    // Timeline step: icon lives inside the dot circle, title + timestamp inline
    const TlStep = ({icon, title, ts, accent, children}) => (
      <div className={`idd-tl-step${accent?' idd-tl-'+accent:''}`}>
        <div className="idd-tl-dot">{icon}</div>
        <div className="idd-tl-body">
          <div className="idd-tl-header">
            <span className="idd-tl-title">{title}</span>
            {ts&&<span className="idd-tl-ts">{fmtDateTime(ts, lang)}</span>}
          </div>
          {children&&<div className="idd-tl-content">{children}</div>}
        </div>
      </div>
    );

    return (
      <div className="udc-wrap idd-wrap">
        {/* ── Compact header bar instead of full UnitHero at step 3 ── */}
        <div className="idd-top-bar">
          <div className="idd-top-plate">
            <span className="idd-top-num">{l.apt}</span>
            <span className="idd-top-tower">{l.tower||getDefaultTower()}</span>
          </div>
          <div className="idd-top-breadcrumb">
            <button type="button" className="idd-bc-btn" onClick={goToInfo}>{isEn?'Unit':'Unidad'} {l.apt}</button>
            <span className="idd-bc-sep">›</span>
            <button type="button" className="idd-bc-btn" onClick={goToList}>{isEn?'Incidents':'Incidentes'}</button>
            <span className="idd-bc-sep">›</span>
            <span className="idd-bc-cur">{incidentTypeLabel(ti.value,lang)}</span>
          </div>
        </div>

        {/* ── Status + meta row ── */}
        <div className={`idd-status-banner ${statusMeta.cls}`}>
          <span className="idd-status-icon">{statusMeta.icon}</span>
          <span className="idd-status-label">{statusMeta.label}</span>
          <div className="idd-status-chips">
            <span className="ir-type" style={{background:ti.bg,color:ti.color,padding:'3px 9px',borderRadius:'999px',fontSize:'.67rem',fontWeight:700}}>{ti.icon||''} {incidentTypeLabel(ti.value,lang)}</span>
            {ci&&<span className="ir-cat" style={{background:ci.bg,color:ci.color,padding:'3px 9px',borderRadius:'999px',fontSize:'.67rem'}}>{ci.icon} {categoryLabel(ci.value,lang)}</span>}
            <span className="idd-chip-date">📅 {fmtDate(inc.date)}</span>
          </div>
        </div>

        {/* ── Owner CTA — top of view so it's the first thing seen on mobile ── */}
        {user&&isOwner&&inc.status!=='resolved'&&(inc.status==='open'||hasPendingRes)&&(
          <div className="idd-cta-top">
            <div className="idd-cta-top-label">
              {inc.status==='open'
                ? (isEn?'① Your action is needed — Step 1 of 2':'① Tu acción es requerida — Paso 1 de 2')
                : (isEn?'② Your action is needed — Step 2 of 2':'② Tu acción es requerida — Paso 2 de 2')}
            </div>
            <div className="idd-cta-top-hint">
              {inc.status==='open'
                ? (isEn?'Confirm who your guest was and document what you did about it.':'Confirma quién fue tu huésped y documenta qué hiciste al respecto.')
                : (isEn?'Add your resolution so the admin can officially close this incident.':'Agrega tu respuesta para que el admin pueda cerrar este incidente.')}
            </div>
            {inc.status==='open'&&(
              <button className="btn-p idd-act-btn idd-cta-btn" onClick={()=>onVerify&&onVerify(inc)}>
                ① {isEn?'Verify now — add guest info & action':'Verificar ahora — agregar info del huésped y acción'}
              </button>
            )}
            {inc.status==='verified'&&hasPendingRes&&(
              <button className="btn-p idd-act-btn idd-cta-btn" onClick={()=>onAddResolution&&onAddResolution(inc)}>
                ② {isEn?'Add your resolution now':'Agregar tu respuesta ahora'}
              </button>
            )}
          </div>
        )}

        {/* ── Responsible parties ── */}
        <div className="idd-parties">
          <div className="idd-parties-hdr">👥 {isEn?'Incident Parties':'Partes del Incidente'}</div>
          <div className="idd-parties-grid">
            <div className="idd-pi-item">
              <span className="idd-pi-role">📋 {isEn?'Reporter':'Reportado por'}</span>
              <span className="idd-pi-name">{inc.reporterName||'—'}</span>
            </div>
            <div className="idd-pi-item idd-pi-owner">
              <span className="idd-pi-role">🏠 {isEn?'Owner':'Propietario'}{inc.status!=='resolved'&&<span className="idd-pi-resp-badge">{isEn?'Responsible — Steps 1 & 2':'Responsable — Pasos 1 y 2'}</span>}</span>
              <span className="idd-pi-name">{l.owner||ownerEmail||'—'}</span>
              {(ownerEmail||ownerWa)&&(
                <div className="idd-pi-contacts">
                  {ownerEmail&&<a href={`mailto:${ownerEmail}`} className="idd-pi-link">✉️ {ownerEmail}</a>}
                  {ownerWa&&<a href={`https://wa.me/${ownerWa}`} target="_blank" rel="noopener noreferrer" className="idd-pi-link idd-pi-wa">💬 WhatsApp</a>}
                </div>
              )}
            </div>
            <div className="idd-pi-item">
              <span className="idd-pi-role">🔧 {isEn?'Operator':'Operador'}</span>
              {hasOp?(
                <>
                  <span className="idd-pi-name">{l.operator||l.operatorEmail||'—'}</span>
                  {(l.operatorEmail||opWa)&&(
                    <div className="idd-pi-contacts">
                      {l.operatorEmail&&<a href={`mailto:${l.operatorEmail}`} className="idd-pi-link">✉️ {l.operatorEmail}</a>}
                      {opWa&&<a href={`https://wa.me/${opWa}`} target="_blank" rel="noopener noreferrer" className="idd-pi-link idd-pi-wa">💬 WhatsApp</a>}
                    </div>
                  )}
                </>
              ):(
                <span className="idd-pi-none">{isEn?'No operator assigned':'Sin operador asignado'}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Owner action callout ── */}
        {user&&inc.status!=='resolved'&&isOwner&&(
          <div className={`udc-action-needed${inc.status==='open'?' udc-an-step1':' udc-an-step2'}`}>
            <div className="udc-an-step-num">{inc.status==='open'?'①':'②'}</div>
            <div className="udc-an-body">
              <strong>{inc.status==='open'?(isEn?'Your action needed — Step 1 of 2':'Tu acción — Paso 1 de 2'):(isEn?'Your action needed — Step 2 of 2':'Tu acción — Paso 2 de 2')}</strong>
              <span>{inc.status==='open'?(isEn?'Confirm guest details and document your immediate action.':'Confirma datos del huésped y documenta tu acción inmediata.'):(isEn?'Add your resolution so admin can close this incident.':'Agrega tu respuesta para que el admin pueda cerrar.')}</span>
              {inc.status==='open'&&<span className="udc-an-hint">{isEn?'Step 2 (resolution) will also be required before admin can close.':'El Paso 2 (respuesta) también será requerido para que el admin pueda cerrar.'}</span>}
              {inc.status==='verified'&&hasPendingRes&&(()=>{
                const sla = slaResInfo(inc);
                if (!sla) return null;
                const label = sla.isBreached
                  ? `⏰ ${isEn?`SLA breached — ${Math.abs(sla.hoursLeft)}h overdue`:`SLA vencido — ${Math.abs(sla.hoursLeft)}h de retraso`}${sla.cycleCount>0?` · ${sla.cycleCount} ${isEn?`reminder${sla.cycleCount>1?'s':''} sent`:`recordatorio${sla.cycleCount>1?'s':''} enviado${sla.cycleCount>1?'s':''}`}`:''}`
                  : `⏰ ${isEn?`Resolution due in ${sla.hoursLeft}h`:`Respuesta requerida en ${sla.hoursLeft}h`}${sla.cycleCount>0?` · ${sla.cycleCount} ${isEn?`reminder${sla.cycleCount>1?'s':''} sent`:`recordatorio${sla.cycleCount>1?'s':''} enviado${sla.cycleCount>1?'s':''}`}`:''}`;
                return <span className={`udc-sla-dl${sla.isBreached?' udc-sla-breached':sla.hoursLeft<=4?' udc-sla-urgent':''}`}>{label}</span>;
              })()}
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        <div className="idd-timeline">
          <TlStep icon="📋" title={isEn?'Filed':'Reportado'} ts={inc.createdAtFull||inc.createdAt} accent="filed"/>

          <TlStep icon="📝" title={isEn?'Description':'Descripción'} accent="desc">
            <p className="idd-tl-desc">{inc.desc}</p>
            {Array.isArray(inc.photos)&&inc.photos.length>0&&(
              <div className="inc-photo-row" style={{marginTop:8}}>
                {inc.photos.map((p,i)=>(
                  <img key={i} src={p.data} alt={p.name||`photo-${i+1}`} className="inc-photo-thumb"
                    title={isEn?'Click to view full size':'Clic para ver tamaño completo'}
                    onClick={()=>window.open(p.data,'_blank')}/>
                ))}
              </div>
            )}
          </TlStep>

          {guests.length>0&&(
            <TlStep icon="👥" title={isEn?'Guests':'Huéspedes'} ts={inc.ownerVerifiedAt} accent="guests">
              <div className="idd-tl-guests">
                {guests.map((g,i)=>(
                  <div key={i} className="idd-tl-guest-row">
                    <span className="idd-tl-guest-name">{guestFullName(g)}</span>
                    {guestLocation(g)&&<span className="idd-tl-guest-loc">📍 {guestLocation(g)}</span>}
                  </div>
                ))}
              </div>
            </TlStep>
          )}

          {inc.ownerComments&&(
            <TlStep icon="✅" title={isEn?'Action taken':'Acción tomada'} ts={inc.ownerVerifiedAt} accent="action">
              <blockquote className="idd-tl-blockquote">{inc.ownerComments}</blockquote>
            </TlStep>
          )}

          {inc.ownerResolution&&(
            <TlStep icon="🔍" title={isEn?'Resolution':'Respuesta'} ts={inc.ownerResolutionAt||inc.ownerVerifiedAt} accent="resolution">
              <blockquote className="idd-tl-blockquote idd-tl-blockquote-res">{inc.ownerResolution}</blockquote>
            </TlStep>
          )}

          {inc.status==='resolved'&&(
            <TlStep icon="🏁" title={isEn?'Closed':'Cerrado'} ts={inc.resolvedAt} accent="closed">
              {inc.resolvedBy&&<span className="idd-tl-reporter">{isEn?'Closed by':'Cerrado por'}: <strong>{inc.resolvedBy}</strong></span>}
              {inc.resolutionComments&&<blockquote className="idd-tl-blockquote" style={{marginTop:6}}>{inc.resolutionComments}</blockquote>}
            </TlStep>
          )}
        </div>

        {/* ── Workflow progress ── */}
        {(()=>{
          const steps = [
            { label: isEn?'Reported':'Reportado',       done: true,                                                                          mine: false },
            { label: isEn?'Owner verifies':'Verifica',   done: inc.status!=='open',                                                           mine: inc.status==='open'&&isOwner },
            { label: isEn?'Owner resolves':'Responde',   done: Boolean(String(inc.ownerResolution||'').trim()),                               mine: inc.status==='verified'&&hasPendingRes&&isOwner },
            { label: isEn?'Admin closes':'Admin cierra', done: inc.status==='resolved',                                                       mine: (isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes },
          ];
          const nodes = [];
          steps.forEach((s,i)=>{
            if (i>0) nodes.push(<div key={`l${i}`} className={`inc-step-line${steps[i-1].done?' isl-done':''}`}/>);
            nodes.push(
              <div key={`s${i}`} className={`inc-step${s.done?' inc-step-done':s.mine?' inc-step-active':' inc-step-idle'}`}>
                <span className="inc-step-dot">{s.done?'✓':i+1}</span>
                <span className="inc-step-lbl">{s.label}</span>
                {s.mine&&<span className="inc-step-you">{isEn?'← yours':'← tú'}</span>}
              </div>
            );
          });
          return <div className="inc-steps">{nodes}</div>;
        })()}

        {/* ── Bottom action bar — admin actions + owner completion state ── */}
        {user&&inc.status!=='resolved'&&(
          <div className="idd-actions">
            {isOwner&&inc.status==='verified'&&!hasPendingRes&&(
              <div className="udc-step-done">
                ✓ {isEn?'Both steps complete — awaiting admin close':'Pasos completados — esperando cierre del admin'}
              </div>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&!hasPendingRes&&(
              <button className="bsm bs-resolve idd-act-btn" onClick={()=>onResolve&&onResolve(inc.id)}>
                {isEn?'Close incident':'Cerrar incidente'}
              </button>
            )}
            {(isGlobalAdmin||canResolveGlobal)&&inc.status==='verified'&&hasPendingRes&&(
              <div className="udc-admin-waiting" style={{textAlign:'center',width:'100%'}}>
                🔒 {isEn?'Waiting for owner resolution (Step 2)':'Esperando respuesta del propietario (Paso 2)'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
