// Unit plate — small badge showing apartment number + tower.
// Renders as a button when onClick is provided (so it's keyboard-accessible),
// otherwise a div. Three sizes: 'sm' | 'md' (default) | 'lg' via the size
// prop driving CSS class `unit-plate-${size}`.
//
// Lifted byte-identical from App.jsx in stage F12. Uses getDefaultTower()
// from core/i18n/app-text — that returns the current community's tower
// label (e.g. "KAI", "Tower-A") and updates when admin config changes.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F12.

import React from "react";
import { getDefaultTower } from "../../../core/i18n/app-text";

export default function UnitPlate({ apt, tower = getDefaultTower(), size = 'md', onClick, title, className = '' }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`unit-plate unit-plate-${size}${className ? ' ' + className : ''}`}
      onClick={onClick}
      title={title}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick(e); } : undefined}
    >
      <span className="unit-plate-num">{apt}</span>
      {tower && <span className="unit-plate-tower">{tower}</span>}
    </Tag>
  );
}
