// NotificationsView — top-level view for the /notifications tab.
//
// Renders the alerts banner (smartAlerts) and the grouped alert history.
// Notifications are grouped by incidentId (or '__general__'), and each
// group's open/closed state is tracked locally; on first load groups
// with unread items auto-open.
//
// Lifted byte-identical from App.jsx in stage F17. Pulls lang via
// useApp(); incidents, listings, notifications, smartAlerts, contact-
// Props and callbacks stay as per-instance props.
//
// Two helpers move with this view because they are only referenced
// here:
//   - localizeNotification(n, lang) — light ES→EN string mapping
//   - SMART_TONE_COLOR              — tone → bg color map for badges
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F17.

import React, { useState, useEffect } from "react";
import { useApp } from "../../../core/app-state";
import { appText, aptDisplay } from "../../../core/i18n/app-text";
import EmptyState from "../../../core/ui/EmptyState";

const SMART_TONE_COLOR = { owner:'#c49a14', resolve:'#d96c1a', registration:'#2f6fbf', notice:'#6b44b8', serious:'#c0281e' };

const localizeNotification = (n={}, lang="es-CO") => {
  const title = String(n.title || '');
  const message = String(n.message || '');
  if (lang !== 'en') return { title, message };
  let outTitle = title
    .replace(/^Nuevo incidente abierto/i, 'New open incident')
    .replace(/^Nuevo registro pendiente/i, 'New pending registration')
    .replace(/^Registro aprobado/i, 'Registration approved')
    .replace(/^Registro rechazado/i, 'Registration declined')
    .replace(/^Listing actualizado/i, 'Listing updated')
    .replace(/^Listing eliminado/i, 'Listing deleted')
    .replace(/^Nuevo listing/i, 'New listing')
    .replace(/Apto\s+(\d+)/gi, 'Apartment $1');
  let outMessage = message
    .replace(/solicita acceso con (\d+) listing\(s\)\./i, 'requests access with $1 listing(s).')
    .replace(/Nuevo incidente reportado/i, 'New incident reported')
    .replace(/Pendiente de revisión/i, 'Pending review')
    .replace(/Apto\s+(\d+)/gi, 'Apartment $1');
  return { title: outTitle, message: outMessage };
};

export default function NotificationsView({ notifications, incidents, listings=[], contactProps={}, onRead, onReadAll, smartAlerts=[], onIncidentDetail=null }) {
  const { lang } = useApp();
  const isEn = lang==='en';
  const unread = notifications.filter(n => !n.isRead).length;
  const hasAlerts = smartAlerts.length > 0;
  // Group notifications by incidentId (or '__general__' for those without)
  const [openGroups, setOpenGroups] = useState({});
  const toggleGroup = (key) => setOpenGroups(s=>({...s,[key]:!s[key]}));

  const grouped = notifications.reduce((acc, n) => {
    const key = n.incidentId || '__general__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});
  // Sort group keys: incident groups with unread first (most recent), then general
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a==='__general__' && b!=='__general__') return 1;
    if (b==='__general__' && a!=='__general__') return -1;
    const aUnread = grouped[a].filter(n=>!n.isRead).length;
    const bUnread = grouped[b].filter(n=>!n.isRead).length;
    if (aUnread !== bUnread) return bUnread - aUnread;
    return new Date(grouped[b][0]?.createdAt||0) - new Date(grouped[a][0]?.createdAt||0);
  });
  // On first load, open groups that have unread notifications
  useEffect(() => {
    const init = {};
    groupKeys.forEach(k => {
      init[k] = grouped[k].some(n=>!n.isRead);
    });
    setOpenGroups(init);
  }, []); // eslint-disable-line

  const renderNotifCard = (n) => {
    const inc=incidents.find(i=>i.id===n.incidentId);
    const nt=localizeNotification(n,lang);
    const canOpenDetail = !!(inc && onIncidentDetail);
    return (
      <div key={n.id} className={`notice-card ${n.isRead?'notice-read':'notice-new'}${canOpenDetail?' notice-card-clickable':''}`}
        onClick={canOpenDetail?()=>onIncidentDetail(inc.id):undefined}
        role={canOpenDetail?'button':undefined}
        tabIndex={canOpenDetail?0:undefined}
        onKeyDown={canOpenDetail?e=>{if(e.key==='Enter'||e.key===' ')onIncidentDetail(inc.id);}:undefined}
        title={canOpenDetail?(isEn?'Click to view full incident details':'Clic para ver detalles del incidente'):undefined}
      >
        <div className="notice-main">
          <div className="notice-title">{n.isRead?'🔔':'🆕'} {nt.title}</div>
          <div className="notice-msg">{nt.message}</div>
          <div className="notice-meta">{new Date(n.createdAt).toLocaleString(isEn?'en-US':'es-CO')} · {appText(lang,'common.email')}: {n.emailSent?(appText(lang,'common.sent')+' ✅'):(appText(lang,'common.notSent')+' ⚠️')}{n.emailError?` · ${n.emailError}`:''}</div>
          {inc&&<div className="notice-inc-row">
            <span className="notice-inc-desc"><strong>{appText(lang,'notifications.detail')}:</strong> {String(inc.desc||'').slice(0,100)}{String(inc.desc||'').length>100?'…':''}</span>
            {canOpenDetail&&<span className="notice-inc-hint">{isEn?'View details':'Ver detalles'} ›</span>}
          </div>}
        </div>
        {!n.isRead&&<button className="bsm bs-resolve" onClick={e=>{e.stopPropagation();onRead(n.id);}}>{appText(lang,"notifications.markRead")}</button>}
      </div>
    );
  };

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <h1 className="ptitle">🔔 {isEn?'Notifications':'Notificaciones'}</h1>
          <p className="psub">{isEn
            ? `${hasAlerts?smartAlerts.length+' priority action'+(smartAlerts.length!==1?'s':'')+' · ':''}${unread} unread alert${unread!==1?'s':''}`
            : `${hasAlerts?smartAlerts.length+' acción'+(smartAlerts.length!==1?'es':'')+' prioritaria'+(smartAlerts.length!==1?'s':'')+' · ':''}${unread} aviso${unread!==1?'s':''} sin leer`}
          </p>
        </div>
        {unread>0 && <button className="btn-p" onClick={onReadAll}>{appText(lang,"notifications.markAll")}</button>}
      </div>

      {hasAlerts && (
        <div className="notif-alerts-section">
          <div className="section-label" style={{marginBottom:10}}>
            🎯 {isEn?'Priority actions — tap to act':'Acciones prioritarias — toca para actuar'}
          </div>
          <div className="notif-alerts-grid">
            {smartAlerts.map(a => (
              <button key={a.id} className={`smart-item smart-${a.tone}`} onClick={a.action}>
                <span className="smart-count" style={{background: SMART_TONE_COLOR[a.tone]||'#0b7f4f'}}>{a.count}</span>
                <span className="smart-title"><span className="smart-icon-inline" aria-hidden="true">{a.icon}</span>{a.title}</span>
                <span className="smart-arr" aria-hidden="true">›</span>
                <span className="smart-desc">{a.msg}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section-label" style={{margin:`${hasAlerts?20:0}px 0 10px`}}>
        {isEn?'Alert history':'Historial de avisos'}{groupKeys.length>1&&<span style={{fontWeight:'normal',fontSize:'.78rem',marginLeft:6,opacity:.7}}>({groupKeys.length} {isEn?'groups':'grupos'})</span>}
      </div>
      {notifications.length===0
        ? <EmptyState icon="🔔" title={appText(lang,"notifications.none")} sub={appText(lang,"notifications.noneSub")}/>
        : <div className="notice-groups">
            {groupKeys.map(gkey => {
              const groupNotifs = grouped[gkey];
              const inc = gkey!=='__general__' ? incidents.find(i=>i.id===gkey) : null;
              const listing = inc ? listings.find(l=>l.id===inc.aptId) : null;
              const gUnread = groupNotifs.filter(n=>!n.isRead).length;
              const isOpen = !!openGroups[gkey];
              const groupLabel = inc
                ? `${aptDisplay(listing?.apt||'',lang)} — ${String(inc.desc||'').slice(0,60)}${String(inc.desc||'').length>60?'…':''}`
                : (isEn?'General alerts':'Avisos generales');
              const groupIcon = inc ? (inc.status==='resolved'?'✓':inc.status==='open'?'⚠️':'📝') : '🔔';
              return (
                <div key={gkey} className={`notif-group${isOpen?' notif-group-open':''}`}>
                  <button type="button" className="notif-group-hdr" onClick={()=>toggleGroup(gkey)}>
                    <span className="notif-group-icon">{groupIcon}</span>
                    <span className="notif-group-label">{groupLabel}</span>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto',flexShrink:0}}>
                      {gUnread>0&&<span className="notif-group-badge">{gUnread}</span>}
                      <span className="notif-group-count">{groupNotifs.length} {isEn?'alert'+(groupNotifs.length!==1?'s':''):'aviso'+(groupNotifs.length!==1?'s':'')}</span>
                      {inc&&onIncidentDetail&&<button type="button" className="bsm" style={{fontSize:'.68rem',padding:'2px 8px'}} onClick={e=>{e.stopPropagation();onIncidentDetail(inc.id);}}>{isEn?'View incident':'Ver incidente'} ›</button>}
                      <span className={`notif-group-chev${isOpen?' notif-group-chev-open':''}`}>›</span>
                    </div>
                  </button>
                  {isOpen&&(
                    <div className="notice-list" style={{padding:'8px 14px 12px'}}>
                      {groupNotifs.map(n=>renderNotifCard(n))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}
