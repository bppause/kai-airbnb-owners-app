// The checkout video — recorded on the cleaning service's phone after
// cleaning, as a walk through the apartment.
//
// Recording happens in the page where the phone allows it (camera +
// MediaRecorder): that lets the page cap the quality at about 1 Mbit/s,
// so three minutes is ~25 MB instead of the hundreds a phone's own camera
// app produces. Where it doesn't (an old phone, camera access refused),
// the person records with the phone's camera app instead and the same
// size limit applies.
//
// The file never passes through this app's server: the server hands back
// a signed upload URL and the phone sends the video straight to storage,
// with a progress bar, then tells the server it has arrived.

import React, { useEffect, useRef, useState } from "react";
import { tr, formatWhen } from "../strings";

export const MAX_VIDEO_SECONDS = 180;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
// In order of preference: MP4 plays everywhere (iPhones included); WebM
// is what older Chrome and Firefox record.
const RECORD_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

const canRecordHere = () => typeof window !== 'undefined' && typeof window.MediaRecorder === 'function'
  && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const recordType = () => RECORD_TYPES.find(t => (window.MediaRecorder.isTypeSupported ? window.MediaRecorder.isTypeSupported(t) : false)) || '';

export const formatDuration = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const formatMb = (bytes) => (bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0);

// How long a video file plays, read from the file itself; 0 if it can't
// be told (some recordings don't say).
const readDuration = (url) => new Promise(resolve => {
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : 0);
  v.onerror = () => resolve(0);
  v.src = url;
});

// PUTs the file to the signed URL, reporting progress (0–100).
const putFile = (url, file, contentType, onProgress, xhrRef) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhrRef.current = xhr;
  xhr.open('PUT', url);
  xhr.setRequestHeader('Content-Type', contentType);
  xhr.setRequestHeader('x-upsert', 'false');
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
  xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
  xhr.onerror = () => reject(new Error('network'));
  xhr.onabort = () => reject(new Error('aborted'));
  xhr.send(file);
});

// The recorder. `canBegin()` may veto starting (the person's name is
// missing). `start({ contentType, size, duration })` asks the server for
// an upload URL → { video, uploadUrl, contentType }; `finish(videoId)`
// tells it the file arrived → the stored video. `onUploaded(video)` is
// called at the end.
export function VideoRecorder({ lang, canBegin, start, finish, onUploaded }) {
  const T = (k, v) => tr(lang, k, v);
  // idle → live (camera open) → recording → review → uploading
  // ('fallback' = this phone records with its own camera app)
  const [mode, setMode] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState(null);         // { blob, url, duration }
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState('');
  const liveRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const xhrRef = useRef(null);
  const fileRef = useRef(null);
  const boxRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    clearInterval(timerRef.current);
  };
  const dropClip = () => setClip(prev => { if (prev) URL.revokeObjectURL(prev.url); return null; });
  // Let go of the camera, the timer, any upload and the recorded file when leaving.
  useEffect(() => () => {
    stopCamera();
    if (xhrRef.current) xhrRef.current.abort();
    setClip(prev => { if (prev) URL.revokeObjectURL(prev.url); return prev; });
  }, []);
  // The live preview gets the camera once its <video> is on screen.
  useEffect(() => {
    if ((mode === 'live' || mode === 'recording') && liveRef.current && streamRef.current && liveRef.current.srcObject !== streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
    }
    if (boxRef.current && mode !== 'idle') boxRef.current.scrollIntoView({ block: 'center' });
  }, [mode]);

  const openCamera = async () => {
    if (canBegin && !canBegin()) return;
    setProblem(''); dropClip();
    if (!canRecordHere()) { setMode('fallback'); return; }
    setMode('starting');
    const video = { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } };
    try {
      // With sound, so the person can say what they see; without if the microphone is refused.
      try { streamRef.current = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
      catch (_e) { streamRef.current = await navigator.mediaDevices.getUserMedia({ video, audio: false }); }
      setMode('live');
    } catch (_e) {
      stopCamera();
      setProblem(T('videoCameraFail'));
      setMode('fallback');
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  };
  const startRecording = () => {
    const type = recordType();
    let rec;
    try {
      rec = new window.MediaRecorder(streamRef.current, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1000000, audioBitsPerSecond: 64000 });
    } catch (_e) {
      stopCamera(); setProblem(T('videoCameraFail')); setMode('fallback'); return;
    }
    const chunks = [];
    const began = Date.now();
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const duration = (Date.now() - began) / 1000;
      stopCamera();
      const blob = new Blob(chunks, { type: (rec.mimeType || type || 'video/webm').split(';')[0] });
      setClip({ blob, url: URL.createObjectURL(blob), duration });
      setMode('review');
    };
    recorderRef.current = rec;
    rec.start(1000);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      const s = (Date.now() - began) / 1000;
      setElapsed(s);
      if (s >= MAX_VIDEO_SECONDS) stopRecording();
    }, 250);
    setMode('recording');
  };
  const cancel = () => { stopRecording(); stopCamera(); dropClip(); setProblem(''); setMode('idle'); };

  // A video recorded with the phone's own camera app.
  const chosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!String(file.type).startsWith('video/')) { setProblem(T('videoNotVideo')); return; }
    const url = URL.createObjectURL(file);
    const duration = await readDuration(url);
    dropClip();
    setClip({ blob: file, url, duration });
    setProblem('');
    setMode('review');
  };

  const send = async () => {
    if (!clip) return;
    if (canBegin && !canBegin()) return;
    if (clip.blob.size > MAX_VIDEO_BYTES) { setProblem(T('videoTooBig', { mb: formatMb(clip.blob.size), max: formatMb(MAX_VIDEO_BYTES) })); return; }
    if (clip.duration > MAX_VIDEO_SECONDS + 15) { setProblem(T('videoTooLong', { n: MAX_VIDEO_SECONDS / 60 })); return; }
    setProblem(''); setProgress(0); setMode('uploading');
    try {
      const slot = await start({ contentType: clip.blob.type || 'video/mp4', size: clip.blob.size, duration: Math.round(clip.duration) });
      await putFile(slot.uploadUrl, clip.blob, slot.contentType, setProgress, xhrRef);
      const video = await finish(slot.video.id);
      dropClip();
      setMode('idle');
      onUploaded(video);
    } catch (err) {
      setProblem(T('videoUploadFail', { why: err?.message || String(err) }));
      setMode('review');
    }
  };

  return (
    <div className="uinv-rec" ref={boxRef}>
      {mode === 'idle' && <button type="button" className="uinv-btn uinv-btn-p uinv-rec-main" onClick={openCamera}>{T('videoRecord')}</button>}
      {mode === 'starting' && <p className="uinv-help">{T('loading')}</p>}
      {(mode === 'live' || mode === 'recording') && (
        <>
          <video ref={liveRef} className="uinv-rec-view" autoPlay muted playsInline />
          {mode === 'recording' && (
            <div className="uinv-rec-timer" role="timer">● {formatDuration(elapsed)} / {formatDuration(MAX_VIDEO_SECONDS)}</div>
          )}
          <div className="uinv-row">
            {mode === 'live'
              ? <button type="button" className="uinv-btn uinv-btn-danger uinv-rec-main" onClick={startRecording}>{T('videoStartRec')}</button>
              : <button type="button" className="uinv-btn uinv-btn-p uinv-rec-main" onClick={stopRecording}>{T('videoStop')}</button>}
            {mode === 'live' && <button type="button" className="uinv-btn" onClick={cancel}>{T('cancel')}</button>}
          </div>
        </>
      )}
      {mode === 'fallback' && (
        <>
          <input ref={fileRef} type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={chosen} />
          <p className="uinv-help">{T('videoFallbackHelp', { n: MAX_VIDEO_SECONDS / 60, max: formatMb(MAX_VIDEO_BYTES) })}</p>
          <div className="uinv-row">
            <button type="button" className="uinv-btn uinv-btn-p uinv-rec-main" onClick={() => fileRef.current && fileRef.current.click()}>{T('videoUseCamera')}</button>
            <button type="button" className="uinv-btn" onClick={cancel}>{T('cancel')}</button>
          </div>
        </>
      )}
      {(mode === 'review' || mode === 'uploading') && clip && (
        <>
          <video className="uinv-rec-view" src={clip.url} controls playsInline preload="metadata" />
          <div className="uinv-meta">{formatDuration(clip.duration)} · {formatMb(clip.blob.size)} MB</div>
          {mode === 'uploading'
            ? (
              <div className="uinv-upload" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="uinv-upload-bar" style={{ width: `${progress}%` }} />
                <span>{T('videoUploading', { p: progress })}</span>
              </div>
            )
            : (
              <div className="uinv-row">
                <button type="button" className="uinv-btn uinv-btn-p uinv-rec-main" onClick={send}>{T('videoUse')}</button>
                <button type="button" className="uinv-btn" onClick={openCamera}>{T('videoRedo')}</button>
              </div>
            )}
        </>
      )}
      {problem && <div className="uinv-msg uinv-msg-err" role="alert" style={{ margin: '8px 0 0' }}>{problem}</div>}
    </div>
  );
}

// A video in a checkout report: fetched (with a link to watch it) only
// when asked for. An empty answer means it is no longer kept.
// A checkout's video(s) in the owner's report: watch, download (to attach
// to an Airbnb damage claim) and keep as evidence so storage recycling
// never deletes it. `onKeep(video, keep)` saves the mark and returns the
// updated video; without it the keep button isn't shown.
export function ReportVideo({ lang, count, load, onKeep }) {
  const T = (k, v) => tr(lang, k, v);
  const [videos, setVideos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [problem, setProblem] = useState('');
  if (!count) return <p className="uinv-help">{T('reportVideoNone')}</p>;
  const open = async () => {
    setLoading(true);
    try { setVideos(await load()); } catch (_e) { setVideos([]); } finally { setLoading(false); }
  };
  const toggleKeep = async (v) => {
    setSaving(v.id); setProblem('');
    try {
      const next = await onKeep(v, !v.keep);
      setVideos(list => list.map(x => (x.id === v.id ? { ...x, keep: next.keep, keptBy: next.keptBy } : x)));
    } catch (e) { setProblem(e?.message || String(e)); } finally { setSaving(''); }
  };
  if (videos === null) return <button type="button" className="uinv-btn uinv-btn-sm" disabled={loading} onClick={open}>{loading ? T('loading') : T('reportVideoWatch')}</button>;
  if (!videos.length || !videos.some(v => v.url)) return <p className="uinv-help">{T('reportVideoGone')}</p>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {videos.filter(v => v.url).map(v => (
        <div key={v.id} className="uinv-evidence">
          <video className="uinv-rec-view" src={v.url} controls playsInline preload="metadata" />
          <div className="uinv-meta">{T('videoRecordedAt', { when: formatWhen(v.createdAt, lang) })} · {formatDuration(v.durationSeconds)} · {formatMb(v.sizeBytes)} MB · {v.takenBy}</div>
          {v.keep && <div className="uinv-kept">{T('videoKeptNote', { who: v.keptBy })}</div>}
          <div className="uinv-row">
            {v.downloadUrl && <a className="uinv-btn uinv-btn-sm" href={v.downloadUrl} download={v.fileName || true}>{T('videoDownload')}</a>}
            {onKeep && (
              <button type="button" className={`uinv-btn uinv-btn-sm${v.keep ? '' : ' uinv-btn-p'}`} aria-pressed={!!v.keep} disabled={saving === v.id} onClick={() => toggleKeep(v)}>
                {saving === v.id ? T('saving') : T(v.keep ? 'videoRelease' : 'videoKeep')}
              </button>
            )}
          </div>
        </div>
      ))}
      {problem && <div className="uinv-msg uinv-msg-err">{problem}</div>}
      <p className="uinv-help" style={{ margin: 0 }}>{T('videoEvidenceHelp')}</p>
    </div>
  );
}
