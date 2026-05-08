// Generic modal overlay — backdrop + centered modal box + close X button.
// Lifted byte-identical from App.jsx in stage F8. Used by every modal in
// the app (incidents, registrations, admin, …).
//
// Click outside the modal box closes it; the X button also closes it.
// `wide` prop opts into the wider (`modal-w`) layout.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F8.

import React from "react";

export default function Overlay({ children, onClose, wide }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-w" : ""}`}>
        {children}
        <button className="btn-x" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
