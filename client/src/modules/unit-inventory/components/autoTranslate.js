// Keeps the two languages of the owner's item form in sync. When the
// owner changes a field in one language (area, description or note), the
// same field in the other language is translated for them, a moment
// after they stop typing.
//
// - A field the owner has typed in is theirs: it is never overwritten.
//   (The item form lets the owner type only in their own language while
//   translation works, so in practice translation runs from that language
//   into the other, read-only one.)
// - An area the unit already has is matched to its existing name in the
//   other language instead of being translated, so areas stay grouped.
// - Saving waits for any translation still on its way (see `flush`).

import { useRef, useState } from 'react';

const DELAY_MS = 800;
const partnerOf = (field) => field.slice(0, -2) + (field.endsWith('En') ? 'Es' : 'En');

// `translate(text, to, kind)` → Promise<string>; `setField(field, value)`
// writes the form; `knownArea(field, text)` → the other language of an
// area the unit already has, or null.
export function useAutoTranslate({ enabled, translate, setField, knownArea }) {
  // field → { state: 'pending' | 'auto' | 'failed', why? }
  const [status, setStatus] = useState({});
  const touched = useRef(new Set());
  const timers = useRef({});
  const inflight = useRef({});
  const applied = useRef({});
  const seq = useRef({});
  const generation = useRef(0);

  const mark = (field, value) => setStatus(s => {
    const next = { ...s };
    if (value) next[field] = value; else delete next[field];
    return next;
  });
  const write = (field, value) => { applied.current[field] = value; setField(field, value); };

  // A new form (or a closed one): forget everything, drop late answers.
  const reset = () => {
    generation.current += 1;
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {}; inflight.current = {}; applied.current = {};
    touched.current = new Set();
    setStatus({});
  };

  const onOwnerEdit = (field, value) => {
    touched.current.add(field);
    delete applied.current[field];
    mark(field, null);
    schedule(partnerOf(field), field, value, DELAY_MS, true);
  };

  // Translate `sourceField`'s text into its partner now, without marking
  // the source as typed — e.g. to fill in the owner's language for an
  // item that so far only has the other one.
  const fillFrom = (sourceField, value) => schedule(partnerOf(sourceField), sourceField, value, 0, false);

  // `clearWithSource`: an emptied source also empties the target (the
  // owner can't type in it when it is read-only).
  const schedule = (target, field, value, delay, clearWithSource) => {
    if (!enabled || touched.current.has(target)) return;
    clearTimeout(timers.current[target]);
    delete timers.current[target];
    delete inflight.current[target];
    const n = (seq.current[target] = (seq.current[target] || 0) + 1);
    const gen = generation.current;
    const text = String(value || '').trim();
    if (!text) {
      mark(target, null);
      if (clearWithSource) write(target, '');
      return;
    }

    const known = field.startsWith('area') ? knownArea(field, text) : null;
    if (known) { write(target, known); mark(target, { state: 'auto' }); return; }

    mark(target, { state: 'pending' });
    let done;
    const promise = new Promise(r => { done = r; });
    const current = () => gen === generation.current && n === seq.current[target] && !touched.current.has(target);
    const fire = async () => {
      delete timers.current[target];
      try {
        const out = await translate(text, target.endsWith('Es') ? 'es' : 'en', target.slice(0, -2));
        if (current()) { write(target, out); mark(target, { state: 'auto' }); }
      } catch (e) {
        if (current()) mark(target, { state: 'failed', why: e?.message || String(e) });
      } finally {
        if (inflight.current[target] && inflight.current[target].promise === promise) delete inflight.current[target];
        done();
      }
    };
    inflight.current[target] = { promise, fire };
    timers.current[target] = setTimeout(fire, delay);
  };

  // Send any translation still waiting for the owner to stop typing, and
  // wait for all of them. Never throws.
  const flush = async () => {
    for (const field of Object.keys(timers.current)) {
      clearTimeout(timers.current[field]);
      const job = inflight.current[field];
      if (job) job.fire();
    }
    await Promise.all(Object.values(inflight.current).map(j => j.promise));
  };

  return {
    status,
    reset,
    onOwnerEdit,
    fillFrom,
    flush,
    waiting: () => Object.keys(inflight.current).length > 0,
    // What translation wrote since the form opened (and the owner hasn't
    // since typed over), for a save that runs before the form re-renders.
    applied: () => ({ ...applied.current }),
  };
}
