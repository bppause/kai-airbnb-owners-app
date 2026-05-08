// Generic UI primitives: empty-state placeholders.
// Lifted byte-identical from App.jsx in stage F7. Used by every view that
// has a "nothing here yet" or "no results" state.
//
// Two variants because they exist in App.jsx today:
//   <EmptyState> — large placeholder with icon + title + sub
//   <Empty>      — compact one-line placeholder (icon + msg)
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F7.

import React from "react";

export function EmptyState({ icon, title, sub }) {
  return (
    <div className="empty">
      <div style={{fontSize:"3rem",marginBottom:12}}>{icon}</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.2rem",marginBottom:6}}>{title}</div>
      <div style={{fontSize:"0.82rem",color:"#3a5a6a"}}>{sub}</div>
    </div>
  );
}

export function Empty({ icon, msg }) {
  return (
    <div style={{textAlign:"center",padding:"20px 0",color:"#2a4a5a",fontSize:"0.82rem"}}>
      {icon} {msg}
    </div>
  );
}
