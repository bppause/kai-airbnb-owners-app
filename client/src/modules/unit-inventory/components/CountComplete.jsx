// Marking a count as complete — shared by both inventory screens.
//
// Saving counts only records what changed, so a pass through the unit
// that found everything in place would otherwise leave no trace. The box
// at the end of the list lets whoever counted say "I checked all of it";
// the line under the summary shows when that last happened and how the
// unit stood.
//
// For the cleaning service, finishing is two steps: the box first asks
// whether there is damage to report, so a count is never closed without
// that question having been put.

import React, { useEffect, useRef, useState } from "react";
import { tr, formatWhen, checkSummary } from "../strings";

// `lastCheck` is the server's record of the latest completed count, or null.
export function LastCheckLine({ lang, lastCheck }) {
  if (!lastCheck) return <p className="uinv-last">{tr(lang, 'lastCheckNever')}</p>;
  return (
    <p className="uinv-last">
      <strong>{tr(lang, 'lastCheck', { when: formatWhen(lastCheck.createdAt, lang), who: lastCheck.actorName })}</strong>
      {' — '}{checkSummary(lang, lastCheck)}
    </p>
  );
}

// `unsaved` is how many counts are typed but not saved: completing saves
// them in the same step, and the button says so.
//
// With `damagePrompt` — { covers, reported, onReport } — the button opens
// a second step instead of completing: it states what finishing confirms
// (`covers`), asks about damage (`reported` = how many were already
// reported this visit), and offers to report one (`onReport`) or to
// finish. `canStart()` may veto opening that step (name missing, a count
// that isn't a number). Without `damagePrompt`, the button completes at
// once (the owner's panel confirms on its own).
export function CountComplete({ lang, unsaved, busy, onComplete, damagePrompt, canStart }) {
  const T = (k, v) => tr(lang, k, v);
  const [asking, setAsking] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => { if (asking && boxRef.current) boxRef.current.scrollIntoView({ block: 'center' }); }, [asking]);

  const start = () => {
    if (!damagePrompt) { onComplete(); return; }
    if (canStart && !canStart()) return;
    setAsking(true);
  };
  const finish = async () => { await onComplete(); setAsking(false); };

  if (asking && damagePrompt) {
    return (
      <div className="uinv-box uinv-done" ref={boxRef}>
        <h2>{T('finishTitle')}</h2>
        <p className="uinv-help">{damagePrompt.covers}</p>
        <div className="uinv-finish">
          <strong>{T('finishAsk')}</strong>
          {damagePrompt.reported > 0 && <span className="uinv-meta">{T('finishReported', { n: damagePrompt.reported })}</span>}
          <button type="button" className="uinv-btn uinv-btn-danger" disabled={busy} onClick={damagePrompt.onReport}>{T('finishYes')}</button>
          <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={finish}>{busy ? T('saving') : T(damagePrompt.reported > 0 ? 'finishNoMore' : 'finishNo')}</button>
          <button type="button" className="uinv-btn" disabled={busy} onClick={() => setAsking(false)}>{T('finishBack')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="uinv-box uinv-done" ref={boxRef}>
      <h2>{T('countDoneTitle')}</h2>
      <p className="uinv-help">{T('countDoneHelp')}</p>
      <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={start}>
        {unsaved ? T('countDoneBtnSave', { n: unsaved }) : T('countDoneBtn')}
      </button>
    </div>
  );
}
