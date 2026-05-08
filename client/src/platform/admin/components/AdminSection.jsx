// AdminSection — collapsible card wrapper used dozens of times inside
// AdminSettings to group related admin controls (SLA, mission, branding,
// permissions, navigation, UI labels, tooltips, email templates, audit
// log, etc.). Header is clickable / Enter-Space accessible; an optional
// `action` slot (typically a Save button) sits on the right and stops
// click propagation so it doesn't toggle the section.
//
// Lifted byte-identical from App.jsx in stage F33. Pure presentational
// — no lang dependency.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F33.

import React from "react";

export default function AdminSection({ title, subtitle, action, open, onToggle, children }) {
  return (
    <div className="card admin-section" style={{marginBottom:18}}>
      <div className="admin-sec-hdr" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onToggle();}} aria-expanded={String(!!open)}>
        <div className="admin-sec-info">
          <span className="card-title">{title}</span>
          {subtitle && <div className="psub" style={{margin:'3px 0 0',fontWeight:400}}>{subtitle}</div>}
        </div>
        {action && <div className="admin-sec-action" onClick={e=>e.stopPropagation()}>{action}</div>}
        <span className={`admin-sec-chevron${open?' asc-up':''}`}>{open?'▲':'▼'}</span>
      </div>
      {open && <div className="admin-sec-body">{children}</div>}
    </div>
  );
}
