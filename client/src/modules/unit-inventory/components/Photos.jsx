// Photos — the pieces every photo feature in the inventory shares.
//
// Photos are shrunk in the browser before they go anywhere (compressImage,
// the helper incident photos use) and travel as JPEG data URLs. Lists
// never carry them: whoever wants to look at an item's or a report's
// photos fetches them then.

import React, { useRef, useState, useEffect } from "react";
import { compressImage } from "../../../core/utils";
import { tr } from "../strings";

export const MAX_ITEM_PHOTOS = 3;
export const MAX_PROOF_PHOTOS = 3;
// Proof photos are taken by the dozen at every checkout and only need to
// show the item and its state, so they are shrunk further than the rest.
const PROOF_SIZE = { maxPx: 720, quality: 0.6 };

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
// `camera` goes straight to the camera on a phone (proof photos are
// taken on the spot); `size` overrides how far the image is shrunk.
export function PhotoButton({ lang, room, disabled, busyLabel, label, ariaLabel, camera = false, size, onPhoto, onError, className = 'uinv-btn uinv-btn-sm' }) {
  const fileRef = useRef(null);
  const [working, setWorking] = useState(false);
  const chosen = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, room);
    e.target.value = '';
    if (!files.length) return;
    setWorking(true);
    for (const file of files) {
      let shrunk = null;
      try { shrunk = await compressImage(file, size); } catch (_e) { if (onError) onError(); }
      if (shrunk) await onPhoto(shrunk.data);
    }
    setWorking(false);
  };
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple={!camera && room > 1} capture={camera ? 'environment' : undefined} style={{ display: 'none' }} onChange={chosen} />
      <button type="button" className={className} disabled={disabled || working} aria-label={working ? undefined : ariaLabel} onClick={() => fileRef.current && fileRef.current.click()}>
        {working ? (busyLabel || tr(lang, 'damagePhotoBusy')) : (label || tr(lang, 'photoAdd'))}
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
// n)` keeps the list's own count in step. `noFirstAdd` leaves out the
// "📷 Add photo" of an item with none (the owner's card has its own 📷
// button for that); `alwaysOpen` shows the photos straight away, with no
// hide button (the edit form).
export function ItemPhotos({ lang, item, store, onCount, onError, showLabel = 'photosShow', noFirstAdd = false, alwaysOpen = false }) {
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
  useEffect(() => {
    if (alwaysOpen && photos === null) open();
    // A photo added elsewhere (the card's 📷 button) while these are shown.
    else if (photos !== null && (item.photoCount || 0) !== photos.length) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.photoCount, alwaysOpen]);
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
    if (alwaysOpen) return <p className="uinv-sub">{T('loading')}</p>;
    if (count > 0) return <div className="uinv-photos"><button type="button" className="uinv-btn uinv-btn-sm" disabled={loading} onClick={open}>{loading ? T('loading') : T(showLabel, { n: count })}</button></div>;
    if (!canEdit || noFirstAdd) return null;
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
        {!alwaysOpen && <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => setPhotos(null)}>{T('photosHide')}</button>}
      </div>
      {bad && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: 0 }}>{T('damagePhotoBad')}</div>}
    </div>
  );
}

// Photo(s) the cleaning service may take of an item at this checkout —
// optional, and offered above all for an item that is missing or
// damaged. Green once there is one. `count` is how many the server has
// for this visit; the pictures themselves are fetched only if the person
// asks to see them.
//
// `store` is { load(item) → photos, add(item, dataUrl) → { photo,
// proofCount }, remove(item, photo) → { proofCount } }.
export function ProofPhotos({ lang, item, count, store, onCount, onError }) {
  const T = (k, v) => tr(lang, k, v);
  const [photos, setPhotos] = useState(null);   // null = not fetched
  const [loading, setLoading] = useState(false);
  const [bad, setBad] = useState(false);
  const n = photos ? photos.length : (count || 0);

  // What is already stored for this visit, so a new one is added to it.
  const current = async () => (photos !== null ? photos : (n > 0 ? await store.load(item) : []));
  const add = async (data) => {
    setBad(false);
    try {
      const before = await current();
      const d = await store.add(item, data);
      setPhotos([...before, d.photo]);
      onCount(item, d.proofCount);
    } catch (e) { onError(e); }
  };
  const show = async () => {
    setLoading(true);
    try { setPhotos(await store.load(item)); } catch (e) { onError(e); } finally { setLoading(false); }
  };
  const remove = async (index) => {
    if (!window.confirm(T('proofRemoveConfirm'))) return;
    const photo = photos[index];
    try {
      const d = await store.remove(item, photo);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      onCount(item, d.proofCount);
    } catch (e) { onError(e); }
  };

  return (
    <div className={`uinv-proof${n ? ' uinv-proof-ok' : ' uinv-proof-opt'}`}>
      <div className="uinv-proof-state">{n ? T('proofHave', { n }) : <>{T('proofOptional')} <span className="uinv-meta">{T('proofOptionalHint')}</span></>}</div>
      {photos && <PhotoStrip photos={photos} lang={lang} alt={T('photoAlt')} removeLabel={T('photoRemove')} onRemove={remove} />}
      <div className="uinv-row">
        {n < MAX_PROOF_PHOTOS && (
          <PhotoButton lang={lang} room={1} camera size={PROOF_SIZE} busyLabel={T('photoAdding')}
            label={n ? T('proofAddMore') : T('proofTake')} className="uinv-btn uinv-btn-sm"
            onPhoto={add} onError={() => setBad(true)} />
        )}
        {photos === null && n > 0 && <button type="button" className="uinv-btn uinv-btn-sm" disabled={loading} onClick={show}>{loading ? T('loading') : T('proofView')}</button>}
      </div>
      {bad && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: 0 }}>{T('damagePhotoBad')}</div>}
    </div>
  );
}
