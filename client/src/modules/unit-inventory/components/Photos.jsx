// Photos — the pieces every photo feature in the inventory shares.
//
// Photos are shrunk in the browser before they go anywhere (compressImage,
// the helper incident photos use) and travel as JPEG data URLs. Lists
// never carry them: whoever wants to look at an item's or a report's
// photos fetches them then.

import React, { useRef, useState } from "react";
import { compressImage } from "../../../core/utils";
import { tr } from "../strings";

export const MAX_ITEM_PHOTOS = 3;

// Thumbnails that open full-screen on a tap. `onRemove(index)` adds a
// remove corner to each. `alt` / `removeLabel` word them for whatever
// the photos are of.
export function PhotoStrip({ photos, lang, onRemove, alt, removeLabel }) {
  const [open, setOpen] = useState(null);
  if (!photos || !photos.length) return null;
  const altText = alt || tr(lang, 'damagePhotoAlt');
  return (
    <>
      <div className="uinv-thumbs">
        {photos.map((p, i) => (
          <div key={p.id || i} className="uinv-thumb" role="button" tabIndex={0} onClick={() => setOpen(i)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(i); }}>
            <img src={p.data} alt={altText} />
            {onRemove && (
              <button type="button" className="uinv-thumb-x" aria-label={removeLabel || tr(lang, 'damagePhotoRemove')}
                onClick={e => { e.stopPropagation(); onRemove(i); }}>✕</button>
            )}
          </div>
        ))}
      </div>
      {open !== null && photos[open] && (
        <div className="uinv-lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <img src={photos[open].data} alt={altText} />
        </div>
      )}
    </>
  );
}

// A button that opens the phone's camera / photo library and hands back
// each chosen image, shrunk, through `onPhoto(dataUrl)` — one at a time,
// at most `room` of them. `onError()` is told when a file can't be used.
export function PhotoButton({ lang, room, disabled, busyLabel, onPhoto, onError, className = 'uinv-btn uinv-btn-sm' }) {
  const fileRef = useRef(null);
  const [working, setWorking] = useState(false);
  const chosen = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, room);
    e.target.value = '';
    if (!files.length) return;
    setWorking(true);
    for (const file of files) {
      let shrunk = null;
      try { shrunk = await compressImage(file); } catch (_e) { if (onError) onError(); }
      if (shrunk) await onPhoto(shrunk.data);
    }
    setWorking(false);
  };
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple={room > 1} style={{ display: 'none' }} onChange={chosen} />
      <button type="button" className={className} disabled={disabled || working} onClick={() => fileRef.current && fileRef.current.click()}>
        {working ? (busyLabel || tr(lang, 'damagePhotoBusy')) : tr(lang, 'photoAdd')}
      </button>
    </>
  );
}

// Photos picked for something not saved yet (the add-item form): held in
// the form's state as [{ data }] until it is saved.
export function PhotoPicker({ lang, photos, onChange, max, disabled }) {
  const [bad, setBad] = useState(false);
  return (
    <div className="uinv-photos">
      <PhotoStrip photos={photos} lang={lang} alt={tr(lang, 'photoAlt')} removeLabel={tr(lang, 'photoRemove')}
        onRemove={i => onChange(photos.filter((_, j) => j !== i))} />
      {photos.length < max && (
        <PhotoButton lang={lang} room={max - photos.length} disabled={disabled} className="uinv-btn"
          onPhoto={data => { setBad(false); onChange(prev => [...(Array.isArray(prev) ? prev : photos), { data }].slice(0, max)); }}
          onError={() => setBad(true)} />
      )}
      {bad && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: 0 }}>{tr(lang, 'damagePhotoBad')}</div>}
    </div>
  );
}

// An item's photos on its card. Closed, it is a "📷 Photos (n)" button
// (or, for the owner of an item that has none, "📷 Add photo"); opened,
// the photos themselves, fetched then. Only the owner — `store.add` and
// `store.remove` given — can add or delete; the cleaning service looks.
//
// `store` is { load(item) → photos, add?(item, dataUrl) → { photo,
// photoCount }, remove?(item, photo) → { photoCount } }. `onCount(item,
// n)` keeps the list's own count in step.
export function ItemPhotos({ lang, item, store, onCount, onError }) {
  const T = (k, v) => tr(lang, k, v);
  const canEdit = !!store.add;
  const [photos, setPhotos] = useState(null);   // null = not opened yet
  const [loading, setLoading] = useState(false);
  const [bad, setBad] = useState(false);
  const count = photos ? photos.length : (item.photoCount || 0);

  const open = async () => {
    setLoading(true);
    try { setPhotos(await store.load(item)); } catch (e) { onError(e); } finally { setLoading(false); }
  };
  const add = async (data) => {
    setBad(false);
    try {
      const d = await store.add(item, data);
      // Adding from the closed state (an item with no photos yet) opens it.
      setPhotos(prev => [...(prev || []), d.photo]);
      onCount(item, d.photoCount);
    } catch (e) { onError(e); }
  };
  const remove = async (index) => {
    if (!window.confirm(T('photoRemoveConfirm'))) return;
    const photo = photos[index];
    try {
      const d = await store.remove(item, photo);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      onCount(item, d.photoCount);
    } catch (e) { onError(e); }
  };

  if (photos === null) {
    if (count > 0) return <div className="uinv-photos"><button type="button" className="uinv-btn uinv-btn-sm" disabled={loading} onClick={open}>{loading ? T('loading') : T('photosShow', { n: count })}</button></div>;
    if (!canEdit) return null;
    return (
      <div className="uinv-photos uinv-photo-first">
        <PhotoButton lang={lang} room={1} busyLabel={T('photoAdding')} onPhoto={add} onError={() => setBad(true)} />
        {bad && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: 0 }}>{T('damagePhotoBad')}</div>}
      </div>
    );
  }
  return (
    <div className="uinv-photos">
      <PhotoStrip photos={photos} lang={lang} alt={T('photoAlt')} removeLabel={T('photoRemove')} onRemove={canEdit ? remove : undefined} />
      <div className="uinv-row">
        {canEdit && photos.length < MAX_ITEM_PHOTOS && <PhotoButton lang={lang} room={MAX_ITEM_PHOTOS - photos.length} busyLabel={T('photoAdding')} onPhoto={add} onError={() => setBad(true)} />}
        {canEdit && photos.length >= MAX_ITEM_PHOTOS && <span className="uinv-meta">{T('photoMax', { n: MAX_ITEM_PHOTOS })}</span>}
        <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => setPhotos(null)}>{T('photosHide')}</button>
      </div>
      {bad && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: 0 }}>{T('damagePhotoBad')}</div>}
    </div>
  );
}
