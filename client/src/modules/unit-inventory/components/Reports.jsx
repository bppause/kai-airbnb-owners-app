// Checkout reports — the owner's dated record of each completed
// inventory: who counted and when, what was off its baseline or carried
// a note at that moment, and the damage reported during that visit with
// its photos. The list is summaries; a report's detail is fetched when
// it is opened, and stays as it was however the inventory changes later.

import React, { useEffect, useState } from "react";
import { api } from "../../../core/api";
import { tr, primaryText, secondaryText, formatWhen, checkSummary, noteForViewer } from "../strings";
import { DamageCard } from "./Damages";
import { PhotoStrip } from "./Photos";
import { ReportVideo, formatMb } from "./Video";
import { NoteTranslation } from "./ItemList";

// One item's proof photos in a report: fetched when asked for. An empty
// answer means the report is older than the ones photos are kept for.
function ReportPhotos({ lang, count, load }) {
  const [photos, setPhotos] = useState(null);
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try { setPhotos(await load()); } catch (_e) { setPhotos([]); } finally { setLoading(false); }
  };
  if (photos === null) return <div><button type="button" className="uinv-btn uinv-btn-sm" disabled={loading} onClick={open}>{loading ? tr(lang, 'loading') : tr(lang, 'reportPhotos', { n: count })}</button></div>;
  if (!photos.length) return <div className="uinv-meta">{tr(lang, 'reportPhotosGone')}</div>;
  return <PhotoStrip photos={photos} lang={lang} alt={tr(lang, 'photoAlt')} />;
}

// `loadPhotos(itemId)` fetches one item's photos for this report;
// `loadVideos()` the checkout's video(s).
function ReportDetail({ lang, check, detail, loadPhotos, loadVideos, keepVideo, unitName }) {
  const T = (k, v) => tr(lang, k, v);
  const { results, damages } = detail;
  return (
    <div className="uinv-report-body">
      {check.actorType === 'cleaner' && (
        <div>
          <h2>{T('reportVideo')}</h2>
          <div style={{ marginTop: 6 }}><ReportVideo lang={lang} count={check.videosCount} load={loadVideos} onKeep={keepVideo} unitName={unitName} /></div>
        </div>
      )}
      <div>
        <h2>{T('reportDiffs', { n: results.length })}</h2>
        {results.length === 0 && <p className="uinv-help">{T('reportNoDiffs')}</p>}
        {results.map(r => {
          const diff = r.count - r.baseline;
          const other = secondaryText(lang, r.nameEn, r.nameEs);
          return (
            <div key={r.itemId} className="uinv-report-row">
              <div className="uinv-name">{primaryText(lang, r.nameEn, r.nameEs)}{r.required && ' ★'}</div>
              {other && <div className="uinv-other">{other}</div>}
              <div className={diff < 0 ? 'uinv-report-miss' : diff > 0 ? 'uinv-report-extra' : ''}>
                {T('reportExpected', { a: r.baseline, b: r.count })}
                {diff !== 0 && ` (${T(Math.abs(diff) === 1 ? (diff < 0 ? 'diffMissingOne' : 'diffExtraOne') : (diff < 0 ? 'diffMissing' : 'diffExtra'), { n: Math.abs(diff) })})`}
                {diff === 0 && ` · ✓ ${T('reportMatched')}`}
              </div>
              {r.note && (() => {
                const view = noteForViewer(lang, { currentNote: r.note, currentNoteLang: r.noteLang, currentNoteTranslation: r.noteTranslation });
                return <><div className="uinv-onote">{view.text}</div><NoteTranslation lang={lang} view={view} /></>;
              })()}
              {r.photos > 0 && <ReportPhotos lang={lang} count={r.photos} load={() => loadPhotos(r.itemId)} />}
              <div className="uinv-meta">{primaryText(lang, r.areaEn, r.areaEs)}</div>
            </div>
          );
        })}
      </div>
      <div>
        <h2>{T('reportDamages', { n: damages.length })}</h2>
        {damages.length === 0 && <p className="uinv-help">{T('reportNoDamages')}</p>}
        {damages.map(d => <DamageCard key={d.id} lang={lang} damage={d} photos={d.photos} />)}
      </div>
    </div>
  );
}

// `unitBase` is the unit's API path; `ownerUid` proves who is asking.
export default function CheckoutReports({ lang, unitBase, ownerUid, unitName, onError }) {
  const T = (k, v) => tr(lang, k, v);
  const [checks, setChecks] = useState(null);
  // What the checkout videos take up, all units together: { used, limit }.
  const [storage, setStorage] = useState(null);
  const [openId, setOpenId] = useState('');
  // Fetched report details by check id.
  const [details, setDetails] = useState({});
  const q = `ownerUid=${encodeURIComponent(ownerUid)}`;

  useEffect(() => {
    api.get(`${unitBase}/checks?${q}`)
      .then(d => { setChecks(d.checks || []); setStorage(d.videoStorage || null); })
      .catch(e => { setChecks([]); onError(e); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitBase]);

  const toggle = (check) => {
    if (openId === check.id) { setOpenId(''); return; }
    setOpenId(check.id);
    if (details[check.id]) return;
    api.get(`${unitBase}/checks/${encodeURIComponent(check.id)}?${q}`)
      .then(d => setDetails(prev => ({ ...prev, [check.id]: { results: d.results || [], damages: d.damages || [] } })))
      .catch(e => { setOpenId(''); onError(e); });
  };

  if (checks === null) return <p className="uinv-sub">{T('loading')}</p>;
  if (!checks.length) return <p className="uinv-sub">{T('reportsEmpty')}</p>;
  return (
    <div>
      <p className="uinv-help" style={{ marginTop: 0 }}>{T('reportsHelp')}</p>
      {storage && storage.limit > 0 && (
        <p className={`uinv-help uinv-storage${storage.used / storage.limit >= 0.9 ? ' uinv-storage-full' : ''}`}>
          {T('videoStorageUse', { used: formatMb(storage.used), limit: formatMb(storage.limit), pct: Math.round((storage.used / storage.limit) * 100), days: storage.protectDays || 30 })}
          {storage.over && <><br /><strong>{T('videoStorageOver')}</strong></>}
        </p>
      )}
      {checks.map(check => {
        const open = openId === check.id;
        return (
          <div key={check.id} className="uinv-report">
            <div className="uinv-report-when">{formatWhen(check.createdAt, lang)}</div>
            <div>{checkSummary(lang, check)}</div>
            <div className="uinv-meta">{T(check.actorType === 'cleaner' ? 'actorCleaner' : 'actorOwner')}{check.actorName ? ` · ${check.actorName}` : ''}</div>
            <div className="uinv-row" style={{ marginTop: 4 }}>
              <button type="button" className="uinv-btn uinv-btn-sm" aria-expanded={open} onClick={() => toggle(check)}>{T(open ? 'reportClose' : 'reportOpen')}</button>
            </div>
            {open && (details[check.id]
              ? <ReportDetail lang={lang} check={check} detail={details[check.id]} unitName={unitName}
                  loadPhotos={async (itemId) => (await api.get(`${unitBase}/checks/${encodeURIComponent(check.id)}/items/${encodeURIComponent(itemId)}/photos?${q}`)).photos || []}
                  loadVideos={async () => (await api.get(`${unitBase}/checks/${encodeURIComponent(check.id)}/videos?${q}`)).videos || []}
                  keepVideo={async (video, keep) => (await api.post(`${unitBase}/videos/${encodeURIComponent(video.id)}/keep`, { ownerUid, keep })).video} />
              : <p className="uinv-sub" style={{ margin: '8px 0 0' }}>{T('loading')}</p>)}
          </div>
        );
      })}
    </div>
  );
}
