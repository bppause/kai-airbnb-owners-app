// The unit's history as one timeline, newest first: every change to an
// item (added, edited, counted, re-baselined, deleted) and every
// completed count. Shown to the owner and, read-only, to the cleaning
// service.

import React from "react";
import { tr, primaryText, secondaryText, formatWhen, checkSummary } from "../strings";

// The descriptive fields an edit can change, the viewer's language first
// in each pair (as in the item form).
const editFields = (lang) => {
  const [first, second] = String(lang || '').toLowerCase().startsWith('en') ? ['En', 'Es'] : ['Es', 'En'];
  return ['area', 'name', 'note'].flatMap(f => [f + first, f + second]);
};

const actorLabel = (lang, type, name) => `${tr(lang, type === 'cleaner' ? 'actorCleaner' : 'actorOwner')}${name ? ` · ${name}` : ''}`;

// `history` is { events, checks }: item changes and completed counts,
// shown together in one timeline, newest first.
export function HistoryList({ history, lang }) {
  if (history === null) return <p className="uinv-sub">{tr(lang, 'loading')}</p>;
  const entries = [
    ...history.events.map(ev => ({ at: ev.createdAt, ev })),
    ...history.checks.map(check => ({ at: check.createdAt, check })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!entries.length) return <p className="uinv-sub">{tr(lang, 'histEmpty')}</p>;
  return (
    <div>
      {entries.map(({ ev, check }) => {
        if (check) {
          return (
            <div key={check.id} className="uinv-hist uinv-hist-check">
              <div className="uinv-name">{tr(lang, 'histCheck')}</div>
              <div>{checkSummary(lang, check)}</div>
              <div className="uinv-hist-when">{formatWhen(check.createdAt, lang)} · {actorLabel(lang, check.actorType, check.actorName)}</div>
            </div>
          );
        }
        const lines = [];
        if (ev.type === 'created') {
          // An item the cleaning service proposed names who asked for it.
          const line = tr(lang, 'histCreated', { n: ev.countAfter });
          const proposedBy = ev.changes && ev.changes.proposedBy;
          lines.push(proposedBy ? tr(lang, 'histProposedBy', { line, who: proposedBy }) : line);
        }
        if (ev.type === 'deleted') lines.push(tr(lang, 'histDeleted', { n: ev.countBefore, b: ev.baselineBefore }));
        if (ev.type === 'edited') {
          // One line per field the edit changed, labelled as in the form.
          const changed = editFields(lang).filter(f => ev.changes && ev.changes[f]);
          if (!changed.length) lines.push(tr(lang, 'histEdited'));
          for (const f of changed) lines.push(tr(lang, 'histField', { field: tr(lang, f), a: ev.changes[f].before, b: ev.changes[f].after }));
        }
        if (ev.type === 'rebaseline') lines.push(tr(lang, 'histRebaseline', { a: ev.baselineBefore, b: ev.baselineAfter }));
        if (ev.type === 'count') {
          if (ev.countBefore !== ev.countAfter) lines.push(tr(lang, 'histCount', { a: ev.countBefore, b: ev.countAfter }));
          if (ev.noteBefore !== ev.noteAfter) lines.push(tr(lang, 'histNote', { a: ev.noteBefore, b: ev.noteAfter }));
        }
        const actor = actorLabel(lang, ev.actorType, ev.actorName);
        const other = secondaryText(lang, ev.itemNameEn, ev.itemNameEs);
        return (
          <div key={ev.id} className="uinv-hist">
            <div className="uinv-name">{primaryText(lang, ev.itemNameEn, ev.itemNameEs)}</div>
            {other && <div className="uinv-other">{other}</div>}
            {lines.map((l, i) => <div key={i}>{l}</div>)}
            <div className="uinv-hist-when">{formatWhen(ev.createdAt, lang)} · {actor}</div>
          </div>
        );
      })}
    </div>
  );
}
