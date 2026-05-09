// Unit picker — searchable dropdown for selecting a unit (apartment) from a
// list of approved listings. Groups results by floor.
//
// Lifted byte-identical from App.jsx in stage F9. Lives under platform/units/
// because units are a platform-level entity (multiple modules — incidents,
// registrations, future operator portal — all need to pick a unit).
//
// Inputs: listings, value, onChange, lang, error, disabled.
// Self-contained except for `aptDisplay` from core/i18n/app-text.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F9.

import React from "react";
import { aptDisplay } from "../../../core/i18n/app-text";

export default function UnitPicker({ listings=[], value='', onChange=()=>{}, lang='es-CO', error=false, disabled=false }) {
  const isEn = lang === 'en';
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const inputRef = React.useRef(null);

  const selected = listings.find(l => l.id === value) || null;

  // Close on outside click / Escape
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const sorted = React.useMemo(() => [...listings].sort((a,b) => a.apt.localeCompare(b.apt, undefined, {numeric:true})), [listings]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(l =>
      l.apt.toLowerCase().includes(q) ||
      String(l.owner||'').toLowerCase().includes(q) ||
      String(l.email||'').toLowerCase().includes(q) ||
      String(l.contact||l.whatsapp||'').toLowerCase().includes(q)
    );
  }, [sorted, query]);

  // Always group by floor
  const grouped = React.useMemo(() => {
    const map = {};
    for (const l of filtered) {
      const num = parseInt(l.apt, 10);
      const floor = Number.isFinite(num) ? String(Math.floor(num / 100)) : '?';
      (map[floor] = map[floor] || []).push(l);
    }
    return Object.entries(map)
      .sort(([a],[b]) => (a==='?'?999:Number(a)) - (b==='?'?999:Number(b)))
      .map(([floor, units]) => ({ floor, units }));
  }, [filtered]);

  const select = (l) => { onChange(l.id); setOpen(false); setQuery(''); };
  const clear   = () => { onChange('');   setOpen(true);  setQuery(''); setTimeout(()=>inputRef.current?.focus(),30); };

  return (
    <div className={`upk-wrap${error?' upk-error':''}${disabled?' upk-disabled':''}`} ref={ref}>
      {selected ? (
        <div className="upk-selected" onClick={()=>!disabled&&clear()}>
          <span className="upk-sel-apt">{aptDisplay(selected.apt, lang)}</span>
          <span className="upk-sel-owner">{selected.owner}</span>
          {!disabled && <button type="button" className="upk-clear" onClick={e=>{e.stopPropagation();clear();}} aria-label="Clear">✕</button>}
        </div>
      ) : (
        <div className="upk-input-wrap">
          <span className="upk-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="upk-input"
            value={query}
            disabled={disabled}
            placeholder={isEn ? 'Search by unit #, owner name, email, or WhatsApp…' : 'Buscar por número, nombre, email o WhatsApp…'}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
          {query && <button type="button" className="upk-clear" onClick={()=>setQuery('')}>✕</button>}
        </div>
      )}
      {open && !selected && (
        <div className="upk-dropdown">
          {filtered.length === 0 && (
            <div className="upk-empty">{isEn ? 'No units match your search.' : 'Ninguna unidad coincide.'}</div>
          )}
          {grouped.map(({ floor, units }) => (
            <div key={floor ?? 'all'}>
              <div className="upk-floor-hdr">
                {isEn ? `Floor ${floor}` : `Piso ${floor}`}
                <span className="upk-floor-count">{units.length}</span>
              </div>
              {units.map(l => {
                const ownerEmail = l.email || '';
                const ownerWa = l.contact || l.whatsapp || '';
                return (
                  <button key={l.id} type="button" className="upk-item" onMouseDown={e=>{e.preventDefault();select(l);}}>
                    <div className="upk-item-row">
                      <strong className="upk-item-apt">{l.apt}</strong>
                      <span className="upk-item-owner">{l.owner}</span>
                      {(ownerEmail || ownerWa) && (
                        <span className="upk-item-contact">
                          {ownerEmail && <span className="upk-item-email" title={ownerEmail}>✉</span>}
                          {ownerWa && <span className="upk-item-wa" title={ownerWa}>📱</span>}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
