// Damage reports — shared pieces for both inventory screens.
//
// The cleaning service reports damage from their page: what is damaged,
// where (an area, the item if it concerns one, and a free-text spot) and
// photos. The owner sees open reports on the inventory panel and every
// report again inside the checkout it was found at.
//
// Photos are shrunk in the browser before they are sent (compressImage,
// the same helper incident photos use) and travel as JPEG data URLs.
// Lists never carry them: `loadPhotos` fetches one report's photos when
// someone asks to see them.

import React, { useEffect, useRef, useState } from "react";
import { compressImage } from "../../../core/utils";
import { tr, primaryText, formatWhen } from "../strings";

export const MAX_DAMAGE_PHOTOS = 4;

// Thumbnails that open full-screen on a tap. `onRemove(index)` adds a
// remove corner to each (the form, before sending).
export function PhotoStrip({ photos, lang, onRemove }) {
  const [open, setOpen] = useState(null);
  if (!photos || !photos.length) return null;
  return (
    <>
      <div className="uinv-thumbs">
        {photos.map((p, i) => (
          <div key={i} className="uinv-thumb" role="button" tabIndex={0} onClick={() => setOpen(i)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(i); }}>
            <img src={p.data} alt={tr(lang, 'damagePhotoAlt')} />
            {onRemove && (
              <button type="button" className="uinv-thumb-x" aria-label={tr(lang, 'damagePhotoRemove')}
                onClick={e => { e.stopPropagation(); onRemove(i); }}>✕</button>
            )}
          </div>
        ))}
      </div>
      {open !== null && photos[open] && (
        <div className="uinv-lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <img src={photos[open].data} alt={tr(lang, 'damagePhotoAlt')} />
        </div>
      )}
    </>
  );
}

// Where a report points, as one phrase: area · item · exact spot.
const whereOf = (d) => [primaryText(d.areaEn, d.areaEs), primaryText(d.itemNameEn, d.itemNameEs), d.location].filter(Boolean).join(' · ');

// The form the cleaning service fills in. `areas` come from groupByArea
// (each with its items). `preset` is the item the form was opened from,
// if any. `onSend(damage)` resolves true when the report was accepted.
export function DamageForm({ lang, areas, preset, busy, onSend, onCancel }) {
  const T = (k, v) => tr(lang, k, v);
  const presetArea = preset ? areas.find(a => a.items.some(it => it.id === preset.id)) : null;
  const [description, setDescription] = useState('');
  const [areaKey, setAreaKey] = useState(presetArea ? presetArea.key : '');
  const [itemId, setItemId] = useState(preset ? preset.id : '');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState('');
  const boxRef = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollIntoView({ block: 'start' }); }, []);

  const area = areas.find(a => a.key === areaKey) || null;
  const pickArea = (key) => { setAreaKey(key); setItemId(''); };
  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_DAMAGE_PHOTOS - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setPreparing(true); setProblem('');
    for (const file of files) {
      try {
        const shrunk = await compressImage(file);
        setPhotos(prev => (prev.length < MAX_DAMAGE_PHOTOS ? [...prev, { data: shrunk.data }] : prev));
      } catch (_e) { setProblem(T('damagePhotoBad')); }
    }
    setPreparing(false);
  };
  const send = async () => {
    if (!description.trim()) { setProblem(T('damageDescNeeded')); return; }
    setProblem('');
    const ok = await onSend({
      description: description.trim(),
      areaEn: area ? area.areaEn : '', areaEs: area ? area.areaEs : '',
      itemId, location: location.trim(), photos,
    });
    if (ok) { setDescription(''); setItemId(''); setLocation(''); setPhotos([]); }
  };
  const working = busy || preparing;

  return (
    <div className="uinv-box uinv-damages" ref={boxRef}>
      <h2>{T('damageTitle')}</h2>
      <p className="uinv-help">{T('damageHelp')}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label className="uinv-field">{T('damageDesc')}
          <textarea className="uinv-textarea" value={description} maxLength={1000} placeholder={T('damageDescPh')}
            onChange={e => { setDescription(e.target.value); setProblem(''); }} />
        </label>
        <label className="uinv-field">{T('damageArea')}
          <select className="uinv-select" value={areaKey} onChange={e => pickArea(e.target.value)}>
            <option value="">{T('damageAreaNone')}</option>
            {areas.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        {area && (
          <label className="uinv-field">{T('damageItem')}
            <select className="uinv-select" value={itemId} onChange={e => setItemId(e.target.value)}>
              <option value="">{T('damageItemNone')}</option>
              {area.items.map(it => <option key={it.id} value={it.id}>{primaryText(it.nameEn, it.nameEs)}</option>)}
            </select>
          </label>
        )}
        <label className="uinv-field">{T('damageLocation')}
          <input value={location} maxLength={200} enterKeyHint="done" onChange={e => setLocation(e.target.value)} />
        </label>
        <div className="uinv-field">{T('damagePhotos', { n: MAX_DAMAGE_PHOTOS })}
          <PhotoStrip photos={photos} lang={lang} onRemove={i => setPhotos(prev => prev.filter((_, j) => j !== i))} />
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={addPhotos} />
          {photos.length < MAX_DAMAGE_PHOTOS && (
            <button type="button" className="uinv-btn" style={{ marginTop: 6, justifySelf: 'start' }} disabled={working}
              onClick={() => fileRef.current && fileRef.current.click()}>{preparing ? T('damagePhotoBusy') : T('damageAddPhoto')}</button>
          )}
        </div>
      </div>
      {problem && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: '10px 0 0' }}>{problem}</div>}
      <div className="uinv-row" style={{ marginTop: 12 }}>
        <button type="button" className="uinv-btn uinv-btn-p" style={{ flex: '1 1 160px' }} disabled={working} onClick={send}>{busy ? T('saving') : T('damageSend')}</button>
        <button type="button" className="uinv-btn" disabled={working} onClick={onCancel}>{T('close')}</button>
      </div>
    </div>
  );
}

// One report. `photos` are shown if given; otherwise, with `loadPhotos`
// and a photo count, a button fetches them. `actions` are the owner's
// buttons.
export function DamageCard({ lang, damage, photos, loadPhotos, actions }) {
  const T = (k, v) => tr(lang, k, v);
  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(false);
  const shown = photos || loaded;
  const where = whereOf(damage);
  const fetchPhotos = async () => {
    setLoading(true);
    try { setLoaded(await loadPhotos(damage)); } catch (_e) { setLoaded([]); } finally { setLoading(false); }
  };
  return (
    <div className={`uinv-dmg${damage.status === 'resolved' ? ' uinv-dmg-resolved' : ''}`}>
      <div className="uinv-name">
        {damage.description}
        {damage.status === 'resolved' && <> <span className="uinv-badge uinv-badge-on">{T('damageResolved')}</span></>}
      </div>
      {where && <div className="uinv-dmg-where">{where}</div>}
      <div className="uinv-meta">{T('damageBy', { who: damage.reportedBy, when: formatWhen(damage.createdAt, lang) })}</div>
      {shown && <PhotoStrip photos={shown} lang={lang} />}
      {!shown && damage.photoCount > 0 && !loadPhotos && <div className="uinv-meta">{T('damagePhotoCount', { n: damage.photoCount })}</div>}
      {((!shown && damage.photoCount > 0 && loadPhotos) || actions) && (
        <div className="uinv-prop-actions">
          {!shown && damage.photoCount > 0 && loadPhotos && (
            <button type="button" className="uinv-btn" disabled={loading} onClick={fetchPhotos}>{loading ? T('loading') : T('damageShowPhotos', { n: damage.photoCount })}</button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

// A titled box of reports; renders nothing when there are none.
export function DamageList({ lang, title, damages, loadPhotos, actionsFor }) {
  if (!damages || !damages.length) return null;
  return (
    <div className="uinv-box uinv-damages">
      <h2>⚠️ {title}</h2>
      {damages.map(d => <DamageCard key={d.id} lang={lang} damage={d} loadPhotos={loadPhotos} actions={actionsFor ? actionsFor(d) : null} />)}
    </div>
  );
}
