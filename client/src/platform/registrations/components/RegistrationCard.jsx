// RegistrationCard — single pending or historical registration row.
// Shows requester name/email, listing count, status, optional approve/
// decline action buttons, and a per-listing details block.
//
// Co-located here:
//   - registrationStatusLabel — pending/approved/declined → bilingual label
//   - ListingDetailsBlock     — per-listing detail grid (only used here)
//
// Lifted byte-identical from App.jsx in stage F21. Pulls lang via useApp();
// r, actions, onApprove, onDecline stay as per-instance props.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F21.

import React from "react";
import { useApp } from "../../../core/app-state";
import { appText, getDefaultTower } from "../../../core/i18n/app-text";

export function registrationStatusLabel(status, lang="es-CO") {
  if (status === 'approved') return appText(lang,'registrations.statusApproved');
  if (status === 'declined') return appText(lang,'registrations.statusDeclined');
  return appText(lang,'registrations.statusPending');
}

function ListingDetailsBlock({ listings=[], lang="es-CO" }) {
  return <div className="listing-detail-grid">{listings.map(l=><div key={l.id} className="listing-detail-card">
    <div className="ld-title">🏠 {appText(lang,"listing.apt")} {l.apt} · {appText(lang,"listing.tower")} {l.tower||getDefaultTower()}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.owner")}:</strong> {l.owner || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.googleEmail")}:</strong> {l.userEmail || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.listingEmail")}:</strong> {l.email || l.userEmail || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.ownerWhatsapp")}:</strong> {l.contact || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.roomsGuests")}:</strong> {l.rooms || 'N/A'} {appText(lang,"listing.roomsShort")} · {l.guests || 'N/A'} {appText(lang,"listing.guests")}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.operator")}:</strong> {l.operator || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.operatorEmail")}:</strong> {l.operatorEmail || 'N/A'}</div>
    <div className="ld-row"><strong>{appText(lang,"listing.operatorWhatsapp")}:</strong> {l.operatorWhatsapp || 'N/A'}</div>
    {l.airbnb && <div className="ld-row"><strong>Airbnb:</strong> <a href={l.airbnb} target="_blank" rel="noreferrer">{appText(lang,"listing.openLink")}</a></div>}
  </div>)}</div>;
}

export default function RegistrationCard({ r, actions=false, onApprove, onDecline }) {
  const { lang } = useApp();
  return <div className="notice-card notice-new reg-card reg-detail-card">
    <div style={{flex:1}}>
      <div className="notice-title">{r.userName || appText(lang,'registrations.userNoName')}</div>
      <div className="notice-meta">{r.userEmail || appText(lang,'registrations.noEmail')} · {r.listings?.length || 0} {lang === 'en' ? 'apartment(s)' : 'apartamento(s)'} · {r.createdAt ? new Date(r.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO') : ''}</div>
      <div className="notice-meta"><strong>{appText(lang,'registrations.status')}:</strong> {registrationStatusLabel(r.status || (actions ? 'pending' : 'approved'), lang)}</div>
      {r.reviewedAt && <div className="notice-meta">{appText(lang,'registrations.approvedBy')} {r.reviewedByName || 'N/A'} · {new Date(r.reviewedAt).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO')}</div>}
      <ListingDetailsBlock listings={r.listings || []} lang={lang}/>
    </div>
    {actions && <div className="ir-acts"><button className="bsm bs-resolve" onClick={()=>onApprove(r.id)}>{appText(lang,"registrations.approve")}</button><button className="bsm bs-del" onClick={()=>onDecline(r.id)}>{appText(lang,"registrations.decline")}</button></div>}
  </div>;
}
