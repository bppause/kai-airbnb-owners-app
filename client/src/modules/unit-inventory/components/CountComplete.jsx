// Marking a count as complete — shared by both inventory screens.
//
// Saving counts only records what changed, so a pass through the unit
// that found everything in place would otherwise leave no trace. The box
// at the end of the list lets whoever counted say "I checked all of it";
// the line under the summary shows when that last happened and how the
// unit stood.

import React from "react";
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
export function CountComplete({ lang, unsaved, busy, onComplete }) {
  return (
    <div className="uinv-box uinv-done">
      <h2>{tr(lang, 'countDoneTitle')}</h2>
      <p className="uinv-help">{tr(lang, 'countDoneHelp')}</p>
      <button type="button" className="uinv-btn uinv-btn-p" disabled={busy} onClick={onComplete}>
        {unsaved ? tr(lang, 'countDoneBtnSave', { n: unsaved }) : tr(lang, 'countDoneBtn')}
      </button>
    </div>
  );
}
