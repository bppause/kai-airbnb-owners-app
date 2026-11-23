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
import { tr, primaryText, formatWhen } from "../strings";
import { PhotoStrip, PhotoButton, ItemThumb } from "./Photos";

export const MAX_DAMAGE_PHOTOS = 4;

// Where a report points, as one phrase: area · item · exact spot.
const whereOf = (d, lang) => [primaryText(lang, d.areaEn, d.areaEs), primaryText(lang, d.itemNameEn, d.itemNameEs), d.location].filter(Boolean).join(' · ');

// Lower-case, without accents, for searching ("lampara" finds "Lámpara").
const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const MAX_HITS = 8;
const MAX_DESC_HITS = 3;

// Words in a damage description that say what happened rather than what
// the thing is ("toalla rota", "broken glass"), or say nothing — left out
// when matching the description against the inventory.
const NOT_THE_ITEM = new Set((
  'de del la las el los lo un una unos unas en con sin por para que y o u al se su sus mi esta estan este esto hay muy mas ' +
  'pero como otro otra tiene tienen parte lado encima debajo dentro afuera tambien ya ' +
  'roto rota rotos rotas danado danada danados danadas dano danos manchado manchada manchados manchadas mancha manchas ' +
  'sucio sucia sucios sucias falta faltan faltante faltantes perdido perdida perdidos perdidas quebrado quebrada quebrados ' +
  'quebradas rajado rajada rajados rajadas rayado rayada rayados rayadas rayon rayones partido partida desgastado ' +
  'desgastada despegado despegada suelto suelta hueco agujero quemado quemada doblado doblada funciona sirve enciende prende ' +
  'the of on in at with is are was it its and or to from has have one two broken damaged missing stained stain dirty ' +
  'cracked crack chipped chip torn scratched scratch burnt burned not working doesnt lost hole loose bent worn'
).split(' '));
// "toallas" → "toall", "blanca" → "blanc": plural and gender off, so the
// description's words match the start of the item's words either way.
const stem = (w) => {
  let s = w;
  if (s.length > 5 && s.endsWith('es')) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith('s')) s = s.slice(0, -1);
  if (s.length > 4 && /[ao]$/.test(s)) s = s.slice(0, -1);
  return s;
};
const wordsOf = (s) => plain(s).split(/[^a-z0-9ñ]+/).filter(Boolean);
// The items a description most likely means: each of its words found at
// the start of a word of the item's description counts 2, of its area or
// note 1; only items with at least one description word and more than
// half the best score (so "toalla de playa" doesn't also offer the CD
// "player"), best first.
export function matchDescription(description, allItems, max = MAX_DESC_HITS) {
  const stems = [...new Set(wordsOf(description).filter(w => w.length >= 3 && !NOT_THE_ITEM.has(w)).map(stem))];
  if (!stems.length) return [];
  const scored = allItems.map((x, i) => {
    const name = wordsOf(`${x.it.nameEn} ${x.it.nameEs}`);
    const rest = wordsOf(`${x.area.areaEn} ${x.area.areaEs} ${x.it.noteEn} ${x.it.noteEs}`);
    let named = 0, score = 0;
    for (const st of stems) {
      if (name.some(w => w.startsWith(st))) { named++; score += 2; } else if (rest.some(w => w.startsWith(st))) score += 1;
    }
    return { x, i, named, score };
  }).filter(r => r.named > 0).sort((a, b) => b.score - a.score || a.i - b.i);
  const top = scored.length ? scored[0].score : 0;
  return scored.filter(r => r.score * 2 > top).slice(0, max).map(r => r.x);
}

// The form the cleaning service fills in. `areas` come from groupByArea
// (each with its items; the area list leaves out the unnamed group, but
// its items can still be searched). `preset` is the item the form was opened from,
// if any. `onSend(damage)` resolves true when the report was accepted.
//
// Finding the item is the hard part in a list of a couple of hundred, so
// it can be searched by any word of its description or area (either
// language, accents optional), with its example photo beside each hit,
// and the damage description itself offers the items it most likely
// means (matchDescription). `loadFirst(item)` fetches that photo. With
// `suggest(photo, description)` — either may be empty; it resolves
// { seenEs, seenEn, matches: [{ itemId, confidence }] } — the first photo
// taken asks Claude which item it shows, and ✨ asks again (from the
// latest photo and the description, or the description alone), offering
// up to three to pick from; nothing is linked until the person taps one.
export function DamageForm({ lang, areas, preset, busy, onSend, onCancel, loadFirst, suggest }) {
  const T = (k, v) => tr(lang, k, v);
  const presetArea = preset ? areas.find(a => a.items.some(it => it.id === preset.id)) : null;
  const [description, setDescription] = useState('');
  const [areaKey, setAreaKey] = useState(presetArea ? presetArea.key : '');
  const [itemId, setItemId] = useState(preset ? preset.id : '');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState([]);
  const [problem, setProblem] = useState('');
  const [query, setQuery] = useState('');
  // Claude's suggestion: null | { state: 'asking' } | { state: 'done', seen, byPhoto, matches } | { state: 'failed' } | { state: 'picked' }
  const [hint, setHint] = useState(null);
  const askedFor = useRef(0);
  const autoAsked = useRef(false);
  const boxRef = useRef(null);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollIntoView({ block: 'start' }); }, []);

  const area = areas.find(a => a.key === areaKey) || null;
  const pickArea = (key) => { setAreaKey(key); setItemId(''); };
  const allItems = areas.flatMap(a => a.items.map(it => ({ it, area: a })));
  const found = allItems.find(x => x.it.id === itemId) || null;
  const pickItem = (id, fromSuggestion) => {
    const hit = allItems.find(x => x.it.id === id);
    if (!hit) return;
    setAreaKey(hit.area.key); setItemId(id); setQuery(''); setProblem('');
    // Picked from the suggestion shown by the photos: say so there, as the
    // item's own line is further up the form.
    setHint(fromSuggestion && photos.length ? { state: 'picked' } : null);
  };
  const words = plain(query).split(/\s+/).filter(Boolean);
  const hits = words.length ? allItems.filter(({ it, area: a }) => {
    const hay = plain([it.nameEn, it.nameEs, a.areaEn, a.areaEs, it.noteEn, it.noteEs].join(' '));
    return words.every(w => hay.includes(w));
  }).slice(0, MAX_HITS) : [];
  const descHits = !found && !words.length && (!hint || hint.state === 'failed') ? matchDescription(description, allItems) : [];
  const canAsk = !!suggest && !found && (photos.length > 0 || description.trim().length >= 3) && (!hint || hint.state !== 'asking');

  const askSuggestion = async (photo) => {
    const said = description.trim();
    if (!suggest || (!photo && !said)) return;
    const ticket = ++askedFor.current;
    setHint({ state: 'asking' });
    try {
      const d = await suggest(photo || '', said);
      if (ticket !== askedFor.current) return;
      const matches = (d.matches || []).map(m => ({ ...m, hit: allItems.find(x => x.it.id === m.itemId) })).filter(m => m.hit);
      setHint({ state: 'done', byPhoto: !!photo, seen: lang && String(lang).toLowerCase().startsWith('en') ? (d.seenEn || d.seenEs) : (d.seenEs || d.seenEn), matches });
    } catch (e) {
      if (ticket === askedFor.current) setHint({ state: 'failed' });
    }
  };
  const addPhoto = (data) => {
    setProblem('');
    setPhotos(prev => (prev.length < MAX_DAMAGE_PHOTOS ? [...prev, { data }] : prev));
    // The first photo, with no item chosen yet: ask which item it shows
    // (with the description, if there is one by now).
    if (!autoAsked.current && !itemId && suggest) { autoAsked.current = true; askSuggestion(data); }
  };
  const hitRow = (x, extra) => (
    <button key={x.it.id} type="button" className="uinv-dmg-hit" onClick={() => pickItem(x.it.id, !!extra)}>
      {loadFirst && <ItemThumb lang={lang} item={x.it} load={loadFirst} still small />}
      <span className="uinv-dmg-hit-text">
        <strong>{primaryText(lang, x.it.nameEn, x.it.nameEs)}</strong>
        <span className="uinv-meta">{x.area.label}{extra ? ` · ${extra}` : ''}</span>
      </span>
    </button>
  );
  const latestPhoto = photos.length ? photos[photos.length - 1].data : '';
  const suggestion = (
    <>
      {canAsk && (
        <button type="button" className="uinv-btn uinv-btn-sm" style={{ marginTop: 6, justifySelf: 'start' }} onClick={() => askSuggestion(latestPhoto)}>
          {T(photos.length ? (hint ? 'damageSuggestAgain' : 'damageSuggestBtn') : (hint ? 'damageSuggestAgainDesc' : 'damageSuggestBtnDesc'))}
        </button>
      )}
      {found && hint && hint.state === 'picked' && (
        <div className="uinv-dmg-suggest uinv-dmg-suggest-ok" role="status">
          {T('damageSuggestLinked', { name: primaryText(lang, found.it.nameEn, found.it.nameEs) })}
        </div>
      )}
      {!found && hint && hint.state !== 'picked' && (
        <div className="uinv-dmg-suggest" role="status">
          {hint.state === 'asking' && <span>{T('damageSuggesting')}</span>}
          {hint.state === 'failed' && <span>{T('damageSuggestFail')}</span>}
          {hint.state === 'done' && (
            <>
              {hint.seen && <div><strong>{T(hint.byPhoto ? 'damageSuggestSeen' : 'damageSuggestSeenDesc', { seen: hint.seen })}</strong></div>}
              {hint.matches.length ? (
                <>
                  <div className="uinv-meta">{T('damageSuggestPick')}</div>
                  <div className="uinv-dmg-hits">{hint.matches.map(m => hitRow(m.hit, T('conf_' + m.confidence)))}</div>
                  <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => setHint(null)}>{T('damageSuggestNone')}</button>
                </>
              ) : <div>{T('damageSuggestEmpty')}</div>}
            </>
          )}
        </div>
      )}
    </>
  );
  const send = async () => {
    if (!description.trim()) { setProblem(T('damageDescNeeded')); return; }
    setProblem('');
    const ok = await onSend({
      description: description.trim(),
      areaEn: area ? area.areaEn : '', areaEs: area ? area.areaEs : '',
      itemId, location: location.trim(), photos,
    });
    if (ok) { setDescription(''); setItemId(''); setLocation(''); setPhotos([]); setQuery(''); setHint(null); autoAsked.current = false; }
  };
  const working = busy;

  return (
    <div className="uinv-box uinv-damages" ref={boxRef}>
      <h2>{T('damageTitle')}</h2>
      <p className="uinv-help">{T('damageHelp')}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label className="uinv-field">{T('damageDesc')}
          <textarea className="uinv-textarea" value={description} maxLength={1000} placeholder={T('damageDescPh')}
            onChange={e => { setDescription(e.target.value); setProblem(''); }} />
        </label>
        <div className="uinv-field">{T('damageWhichItem')}
          {found ? (
            <div className="uinv-dmg-picked">
              {loadFirst && <ItemThumb lang={lang} item={found.it} load={loadFirst} still small />}
              <span className="uinv-dmg-hit-text">
                <strong>{primaryText(lang, found.it.nameEn, found.it.nameEs)}</strong>
                <span className="uinv-meta">{found.area.label}</span>
              </span>
              <button type="button" className="uinv-btn uinv-btn-sm" onClick={() => { setItemId(''); setHint(null); }}>{T('damageItemChange')}</button>
            </div>
          ) : (
            <>
              <input type="search" value={query} enterKeyHint="search" placeholder={T('damageItemSearchPh')} aria-label={T('damageItemSearch')}
                onChange={e => setQuery(e.target.value)} />
              {hits.length > 0 && <div className="uinv-dmg-hits">{hits.map(x => hitRow(x))}</div>}
              {words.length > 0 && !hits.length && <p className="uinv-help" style={{ margin: 0 }}>{T('damageItemNoHits')}</p>}
              {descHits.length > 0 && (
                <div className="uinv-dmg-suggest uinv-dmg-from-desc">
                  <div className="uinv-meta">{T('damageDescHits')}</div>
                  <div className="uinv-dmg-hits">{descHits.map(x => hitRow(x))}</div>
                </div>
              )}
            </>
          )}
          {!photos.length && suggestion}
        </div>
        <label className="uinv-field">{T('damageArea')}
          <select className="uinv-select" value={areaKey} onChange={e => pickArea(e.target.value)}>
            <option value="">{T('damageAreaNone')}</option>
            {areas.filter(a => a.areaEn || a.areaEs).map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        {area && (
          <label className="uinv-field">{T('damageItem')}
            <select className="uinv-select" value={itemId} onChange={e => setItemId(e.target.value)}>
              <option value="">{T('damageItemNone')}</option>
              {area.items.map(it => <option key={it.id} value={it.id}>{primaryText(lang, it.nameEn, it.nameEs)}</option>)}
            </select>
          </label>
        )}
        <label className="uinv-field">{T('damageLocation')}
          <input value={location} maxLength={200} enterKeyHint="done" onChange={e => setLocation(e.target.value)} />
        </label>
        <div className="uinv-field">{T('damagePhotos', { n: MAX_DAMAGE_PHOTOS })}
          <PhotoStrip photos={photos} lang={lang} onRemove={i => setPhotos(prev => prev.filter((_, j) => j !== i))} />
          {photos.length < MAX_DAMAGE_PHOTOS && (
            <PhotoButton lang={lang} room={MAX_DAMAGE_PHOTOS - photos.length} disabled={busy} className="uinv-btn"
              style={{ marginTop: 6, justifySelf: 'start' }} label={T('damageAddPhoto')} busyLabel={T('damagePhotoBusy')}
              onPhoto={addPhoto} onError={() => setProblem(T('damagePhotoBad'))} />
          )}
          {photos.length > 0 && suggestion}
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
  const where = whereOf(damage, lang);
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
