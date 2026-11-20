// The marks that make a changed count stand out, shared by the owner's
// panel and the cleaning service's page: a badge on the item and a
// summary above the list. Colour is never the only signal — each mark
// carries an arrow and words (▼ missing, ▲ extra).

import React from "react";
import { tr } from "../strings";

// `diff` is count − baseline (see diffFromBaseline).
export function DiffBadge({ diff, lang }) {
  if (!diff) return null;
  // Spanish needs its own singular ("Falta 1", not "Faltan 1").
  const one = Math.abs(diff) === 1 ? 'One' : '';
  return diff < 0
    ? <span className="uinv-badge uinv-badge-miss">{tr(lang, `diffMissing${one}`, { n: -diff })}</span>
    : <span className="uinv-badge uinv-badge-extra">{tr(lang, `diffExtra${one}`, { n: diff })}</span>;
}

// `tally` comes from tallyDiffs. `shared` picks the cleaning service's
// wording ("expected" rather than "baseline"). Passing `onToggle` adds the
// button that narrows the list to changed items.
export function DiffSummary({ lang, total, tally, shared = false, onlyChanged = false, onToggle }) {
  if (!tally.changed) {
    return <div className="uinv-sum uinv-sum-ok">✓ {tr(lang, shared ? 'allMatchShared' : 'allMatch', { n: total })}</div>;
  }
  return (
    <div className="uinv-sum">
      <strong>{tr(lang, shared ? 'changedSummaryShared' : 'changedSummary', { d: tally.changed, n: total })}</strong>
      <span className="uinv-row">
        {tally.missing > 0 && <span className="uinv-badge uinv-badge-miss">{tr(lang, 'chipMissing', { n: tally.missing })}</span>}
        {tally.extra > 0 && <span className="uinv-badge uinv-badge-extra">{tr(lang, 'chipExtra', { n: tally.extra })}</span>}
        {onToggle && (
          <button type="button" className="uinv-btn uinv-btn-sm" aria-pressed={onlyChanged} onClick={onToggle}>
            {tr(lang, onlyChanged ? 'showAll' : 'onlyChanged')}
          </button>
        )}
      </span>
    </div>
  );
}
