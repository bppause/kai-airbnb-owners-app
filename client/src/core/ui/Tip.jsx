// Tooltip primitive — small ⓘ marker that pops a fixed-position bubble on
// hover/focus. Used throughout the app for help text on form fields and
// action buttons.
//
// Lifted byte-identical from App.jsx in stage F10. Self-contained — no
// shared state, no Context.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F10.

import React, { useState } from "react";

export default function Tip({ text }) {
  const [tp, setTp] = useState(null);
  if (!text) return null;
  const show = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const mw = Math.min(300, window.innerWidth - 24);
    const cx = r.left + r.width / 2;
    setTp({ x: Math.max(mw / 2 + 8, Math.min(cx, window.innerWidth - mw / 2 - 8)), y: r.bottom + 8, mw });
  };
  const hide = () => setTp(null);
  return (
    <span className="tip" tabIndex="0" aria-label={text}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      ⓘ
      {tp && <span style={{position:'fixed',left:tp.x,top:tp.y,transform:'translateX(-50%)',maxWidth:tp.mw+'px',background:'#17313a',color:'#fff',borderRadius:'12px',padding:'10px 12px',fontSize:'.78rem',fontWeight:700,lineHeight:'1.35',boxShadow:'0 14px 34px rgba(0,0,0,.28)',whiteSpace:'normal',pointerEvents:'none',zIndex:2147483647,textAlign:'left'}}>{text}</span>}
    </span>
  );
}
