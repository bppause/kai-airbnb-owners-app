// Compact unit card — apartment plate + owner name + email/WhatsApp links.
// Used by IRow (incident row) and other places that need a small, dense
// unit summary that's clickable through to the unit detail overlay.
//
// Lifted byte-identical from App.jsx in stage F12. Lives under platform/
// units/ because units are platform-level (multiple modules consume this).
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F12.

import React from "react";
import { normalizePhoneForWhatsApp } from "../../../core/utils";
import { getDefaultTower } from "../../../core/i18n/app-text";
import UnitPlate from "./UnitPlate";

export default function UnitMiniCard({ listing, onUnitDetail, isEn = false }) {
  if (!listing) return null;
  const ownerEmail = listing.userEmail || listing.email || '';
  const ownerWaRaw = listing.contact || '';
  const ownerWa = normalizePhoneForWhatsApp(ownerWaRaw);
  return (
    <div className="unit-mini-card">
      <UnitPlate
        apt={listing.apt}
        tower={listing.tower || getDefaultTower()}
        size="sm"
        onClick={onUnitDetail ? () => onUnitDetail(listing.id) : undefined}
        title={onUnitDetail ? (isEn ? 'View unit details' : 'Ver detalles de la unidad') : undefined}
        className="umc-plate-unit"
      />
      <div className="umc-body">
        <div className="umc-party">
          <div className="umc-owner" title={listing.owner || '—'}>
            <span className="umc-role-lbl">{isEn ? 'Owner' : 'Propietario'}</span> {listing.owner || '—'}
          </div>
          {(ownerEmail || ownerWa) && (
            <div className="umc-contacts">
              {ownerEmail && <a href={`mailto:${ownerEmail}`} className="idd-pi-link" onClick={e => e.stopPropagation()}>✉️ {ownerEmail}</a>}
              {ownerWa && <a href={`https://wa.me/${ownerWa}`} target="_blank" rel="noopener noreferrer" className="idd-pi-link idd-pi-wa" onClick={e => e.stopPropagation()}>💬 WhatsApp</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
