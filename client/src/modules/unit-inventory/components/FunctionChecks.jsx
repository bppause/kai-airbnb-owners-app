// Working checks: things the cleaning service tests at every visit —
// each burner of the stove, each TV and A/C with its remote, the A/C
// switching off when a door opens… The owner keeps the list
// (FunctionCheckEditor); the cleaning service answers each one "works" or
// "doesn't work" (FunctionCheckList) before the count can be completed,
// and the answers go into the checkout report (FunctionResults).

import React, { useEffect, useState } from "react";
import { tr, primaryText } from "../strings";
import { ItemThumb } from "./Photos";
import { useAutoTranslate } from "./autoTranslate";

const isEn = (lang) => String(lang || '').toLowerCase().startsWith('en');
const labelOf = (lang, c) => primaryText(lang, c.labelEn, c.labelEs);
const otherLabelOf = (lang, c) => {
  const own = labelOf(lang, c);
  const other = isEn(lang) ? c.labelEs : c.labelEn;
  return other && other !== own ? other : '';
};

// The cleaning service's list. `answers` is { [checkId]: { status, note,
// by } } for this visit. `onAnswer(check, status)` saves an answer and
// resolves true when it did; a "doesn't work" then calls
// `onBroken(check, item)` so the damage can be reported.
export function FunctionCheckList({ lang, checks, answers, items, busy, loadFirst, onAnswer, onBroken }) {
  const T = (k, v) => tr(lang, k, v);
  const [saving, setSaving] = useState('');
  const done = checks.filter(c => answers[c.id]).length;
  const failed = checks.filter(c => answers[c.id] && answers[c.id].status === 'fail').length;
  const answer = async (c, status) => {
    setSaving(c.id + status);
    try {
      const ok = await onAnswer(c, status);
      if (ok && status === 'fail') onBroken(c, items.find(it => it.id === c.itemId) || null);
    } finally { setSaving(''); }
  };
  return (
    <div className="uinv-box uinv-fn" id="uinv-functions">
      <div className="uinv-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>{T('fnTitle')}</h2>
        <span className={`uinv-progress${done === checks.length ? ' uinv-progress-done' : ''}`}>
          {T('fnProgress', { done, n: checks.length })}{failed ? ` · ${T('fnFailedCount', { n: failed })}` : ''}
        </span>
      </div>
      <p className="uinv-help">{T('fnHelp')}</p>
      <ol className="uinv-fn-list">
        {checks.map(c => {
          const a = answers[c.id];
          const item = c.itemId ? items.find(it => it.id === c.itemId) : null;
          const how = primaryText(lang, c.howEn, c.howEs);
          const other = otherLabelOf(lang, c);
          return (
            <li key={c.id} className={`uinv-fn-row${a ? ` uinv-fn-${a.status}` : ''}`}>
              <div className="uinv-fn-what">
                {item && loadFirst && <ItemThumb lang={lang} item={item} load={loadFirst} still small />}
                <div className="uinv-fn-text">
                  <strong>{labelOf(lang, c)}</strong>
                  {other && <span className="uinv-area-other">{other}</span>}
                  {how && <span className="uinv-meta">{how}</span>}
                  {item && <span className="uinv-meta">{T('fnItem', { name: primaryText(lang, item.nameEn, item.nameEs) })}</span>}
                </div>
              </div>
              <div className="uinv-fn-btns" role="group" aria-label={labelOf(lang, c)}>
                <button type="button" className={`uinv-btn uinv-fn-ok${a && a.status === 'ok' ? ' uinv-on' : ''}`} aria-pressed={!!a && a.status === 'ok'}
                  disabled={busy || !!saving} onClick={() => answer(c, 'ok')}>{saving === c.id + 'ok' ? '…' : T('fnWorks')}</button>
                <button type="button" className={`uinv-btn uinv-fn-fail${a && a.status === 'fail' ? ' uinv-on' : ''}`} aria-pressed={!!a && a.status === 'fail'}
                  disabled={busy || !!saving} onClick={() => answer(c, 'fail')}>{saving === c.id + 'fail' ? '…' : T('fnBroken')}</button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// A completed count's answers, for the checkout report: what didn't work
// first, then what did.
export function FunctionResults({ lang, results }) {
  const T = (k, v) => tr(lang, k, v);
  if (!results || !results.length) return null;
  const failed = results.filter(r => r.status === 'fail');
  const ok = results.filter(r => r.status !== 'fail');
  return (
    <div className="uinv-fn-results">
      <h3>{T('fnReportTitle', { ok: ok.length, n: results.length })}</h3>
      <ul>
        {[...failed, ...ok].map(r => (
          <li key={r.id} className={r.status === 'fail' ? 'uinv-fn-res-fail' : 'uinv-fn-res-ok'}>
            <span aria-hidden="true">{r.status === 'fail' ? '✗' : '✓'}</span>{' '}
            <span>{labelOf(lang, r)}{r.status === 'fail' ? ` — ${T('fnBrokenShort')}` : ''}{r.note ? ` · ${r.note}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Owner's editor ──────────────────────────────────────────────────

const ITEM_WORDS = {
  stove: /^(estufa|cocineta|parrilla)|^(gas |electric )?(cooktop|stove|range)/i,
  tvRemote: /^control (del|de la) (tv|televisor|amazon|roku|apple tv|fire)|(tv|fire tv|roku) remote/i,
  acRemote: /^control del aire|(ac|a\/c|air conditioner) remote/i,
  curtainRemote: /^control de (las )?cortinas|curtain remote/i,
  washer: /lavadora|washer/i,
  dryer: /secadora|(^|\/)\s*dryer/i,
  microwave: /^(horno )?microondas|^microwave/i,
  oven: /^horno(?! microondas)|^(built-in )?oven/i,
  tv: /^(televisor|tv\b)/i,
  ac: /^aires? acondicionados?|^(split )?ac units?|^air conditioner/i,
};
// Things named after an appliance that aren't one: "Microwave splatter
// cover", "Oven trays", "TV console"…
const ACCESSORY = /tapa|cover|guante|mitt|bandeja|tray|mueble|console|soporte|stand|canasta|basket|portavasos|coaster|campana|hood/i;
// "Gree AC remote "Sala"" → "Sala"; "Samsung TV remote (living room)" → "living room".
// Capitalised, without a repeated "Cortina" ("Cortina Niños" → "Niños").
const placeOf = (name) => {
  const m = /"([^"]+)"|\(([^)]+)\)/.exec(name || '');
  const p = m ? (m[1] || m[2]).trim().replace(/^(cortinas?|curtains?)\s+/i, '') : '';
  return p ? p[0].toUpperCase() + p.slice(1) : '';
};
const withPlace = (base, place) => (place ? `${base} "${place}"` : base);

// A first list for the unit, from its inventory: the stove, each TV and
// A/C with its remote, the A/C switching off with the doors open, each
// curtain remote, the washer, dryer, microwave and oven. Bilingual, tied
// to the item where there is one; the owner edits it before saving.
export function suggestFunctionChecks(items) {
  const out = [];
  const add = (labelEs, labelEn, howEs, howEn, item) => out.push({ labelEs, labelEn, howEs, howEn, itemId: item ? item.id : '' });
  const find = (re) => items.filter(it => (re.test(it.nameEs || '') || re.test(it.nameEn || '')) && !ACCESSORY.test(`${it.nameEs} ${it.nameEn}`));
  const stoves = find(ITEM_WORDS.stove);
  stoves.forEach(it => {
    const n = /(\d+)\s*(puestos|burners)/i.exec(`${it.nameEs} ${it.nameEn}`);
    add(n ? `Estufa: los ${n[1]} puestos prenden` : 'Estufa: todos los puestos prenden',
      n ? `Stove: all ${n[1]} burners light` : 'Stove: every burner lights',
      'Prende cada puesto uno por uno y apágalo.', 'Light each burner one at a time, then turn it off.', it);
  });
  if (!stoves.length) add('Estufa: todos los puestos prenden', 'Stove: every burner lights', 'Prende cada puesto uno por uno y apágalo.', 'Light each burner one at a time, then turn it off.', null);
  find(ITEM_WORDS.oven).forEach(it => add('Horno calienta', 'Oven heats up', 'Préndelo unos minutos y apágalo.', 'Turn it on for a few minutes, then off.', it));
  const tvRemotes = find(ITEM_WORDS.tvRemote);
  tvRemotes.forEach(it => {
    const fire = /fire|amazon|roku|apple/i.test(`${it.nameEs} ${it.nameEn}`);
    add(fire ? 'Control del Amazon Fire TV funciona' : withPlace('TV', placeOf(it.nameEs)) + ' prende y responde a su control',
      fire ? 'Amazon Fire TV remote works' : withPlace('TV', placeOf(it.nameEn)) + ' turns on and answers its remote',
      'Prende, cambia de canal o app, sube y baja volumen, apaga.', 'Turn on, change channel or app, volume up and down, turn off.', it);
  });
  if (!tvRemotes.length) find(ITEM_WORDS.tv).forEach(it => add('TV prende y responde a su control', 'TV turns on and answers its remote', 'Prende, sube y baja volumen, apaga.', 'Turn on, volume up and down, turn off.', it));
  const acRemotes = find(ITEM_WORDS.acRemote);
  acRemotes.forEach(it => add(withPlace('Aire', placeOf(it.nameEs)) + ' enfría y responde a su control',
    withPlace('A/C', placeOf(it.nameEn)) + ' cools and answers its remote',
    'Préndelo con el control, verifica que salga aire frío y apágalo.', 'Turn it on with the remote, check cold air comes out, turn it off.', it));
  if (!acRemotes.length) find(ITEM_WORDS.ac).forEach(it => add('Aire enfría y responde a su control', 'A/C cools and answers its remote', 'Préndelo, verifica que salga aire frío y apágalo.', 'Turn it on, check cold air comes out, turn it off.', it));
  if (acRemotes.length || find(ITEM_WORDS.ac).length) {
    add('Aire se apaga solo al abrir las puertas corredizas y la puerta principal', 'A/C switches off by itself when the sliding doors or the front door open',
      'Con el aire prendido abre cada puerta corrediza y la puerta principal: el aire debe apagarse.', 'With the A/C on, open each sliding door and the front door: the A/C should switch off.', null);
  }
  find(ITEM_WORDS.curtainRemote).forEach(it => add(withPlace('Cortinas', placeOf(it.nameEs)) + ': el control funciona en 0, 1 y 2',
    withPlace('Curtains', placeOf(it.nameEn)) + ': remote works on 0, 1 and 2',
    'En cada canal (0, 1 y 2) abre y cierra.', 'On each channel (0, 1 and 2) open and close.', it));
  const washers = find(ITEM_WORDS.washer);
  washers.forEach(it => add('Lavadora llena, lava y desagua', 'Washer fills, washes and drains', 'Un ciclo corto sin ropa, o revisa que arranque y llene.', 'A short cycle with no clothes, or check that it starts and fills.', it));
  find(ITEM_WORDS.dryer).filter(it => !/pelo|hair/i.test(`${it.nameEs} ${it.nameEn}`)).forEach(it => add('Secadora calienta y gira', 'Dryer heats and turns', 'Préndela unos minutos.', 'Run it for a few minutes.', it));
  find(ITEM_WORDS.microwave).forEach(it => add('Microondas calienta', 'Microwave heats', 'Calienta un vaso de agua 30 segundos.', 'Heat a glass of water for 30 seconds.', it));
  return out;
}

const blank = () => ({ key: Math.random().toString(36).slice(2), labelEn: '', labelEs: '', howEn: '', howEs: '', itemId: '' });

// One check in the editor: name and how-to-test in the owner's language,
// the other translated read-only when translation works (as in the item
// form), and the item it is about.
function CheckFields({ lang, check, items, canTranslate, translate, onChange }) {
  const T = (k, v) => tr(lang, k, v);
  const own = isEn(lang) ? 'En' : 'Es';
  const other = own === 'En' ? 'Es' : 'En';
  // The translation helper knows fields as name*/note*: label → name, how → note.
  const toField = { label: 'name', how: 'note' };
  const fromField = { name: 'label', note: 'how' };
  const tx = useAutoTranslate({
    enabled: canTranslate, translate, knownArea: () => null,
    setField: (field, value) => onChange({ [fromField[field.slice(0, -2)] + field.slice(-2)]: value }),
  });
  const field = (kind, suffix, max, ph) => {
    const key = kind + suffix;
    const txField = toField[kind] + suffix;
    const st = tx.status[txField];
    const ro = canTranslate && suffix === other && !(st && st.state === 'failed');
    const note = st && (st.state !== 'auto' || !ro)
      ? { cls: st.state, text: T(`tr_${st.state}`, { why: st.why || '' }) }
      : (ro ? { cls: 'ro', text: T('trReadonly', { from: T('lang' + own) }) } : null);
    return (
      <label key={key} className="uinv-field">{T(`fn_${kind}${suffix}`)}
        <input value={check[key]} maxLength={max} readOnly={ro} aria-readonly={ro || undefined} className={ro ? 'uinv-ro' : undefined}
          tabIndex={ro ? -1 : undefined} placeholder={suffix === own ? ph : ''}
          onChange={e => { if (ro) return; const v = e.target.value; onChange({ [key]: v }); tx.onOwnerEdit(txField, v); }} />
        {note && <span className={`uinv-tr uinv-tr-${note.cls}`} role="status">{note.text}</span>}
      </label>
    );
  };
  return (
    <div className="uinv-form">
      {field('label', own, 200, T('fnLabelPh'))}
      {field('label', other, 200)}
      {field('how', own, 300, T('fnHowPh'))}
      {field('how', other, 300)}
      <label className="uinv-field uinv-full">{T('fnItemPick')}
        <select className="uinv-select" value={check.itemId} onChange={e => onChange({ itemId: e.target.value })}>
          <option value="">{T('fnItemNone')}</option>
          {items.map(it => <option key={it.id} value={it.id}>{primaryText(lang, it.nameEn, it.nameEs)}</option>)}
        </select>
      </label>
    </div>
  );
}

// The owner's list: add, edit, reorder, remove, or start from the list
// suggested by the inventory; saved as a whole. `onSave(checks)` → true
// when saved.
export function FunctionCheckEditor({ lang, checks, items, busy, canTranslate, translate, onSave, onClose }) {
  const T = (k, v) => tr(lang, k, v);
  const [list, setList] = useState(() => checks.map(c => ({ ...c, key: c.id })));
  const [open, setOpen] = useState(null);
  const [problem, setProblem] = useState('');
  // Saved: start again from what the server now has (new checks got ids).
  useEffect(() => { setList(checks.map(c => ({ ...c, key: c.id }))); }, [checks]);
  const dirty = JSON.stringify(list.map(({ key, ...c }) => c)) !== JSON.stringify(checks);
  const sortedItems = [...items].sort((a, b) => primaryText(lang, a.nameEn, a.nameEs).localeCompare(primaryText(lang, b.nameEn, b.nameEs)));
  const change = (key, patch) => setList(l => l.map(c => (c.key === key ? { ...c, ...patch } : c)));
  const move = (i, d) => setList(l => { const n = [...l]; const [c] = n.splice(i, 1); n.splice(i + d, 0, c); return n; });
  const addSuggested = () => {
    const have = new Set(list.map(c => `${c.labelEs}|${c.itemId}`));
    const add = suggestFunctionChecks(items).filter(c => !have.has(`${c.labelEs}|${c.itemId}`)).map(c => ({ ...blank(), ...c }));
    setList(l => [...l, ...add]);
  };
  const save = async () => {
    setProblem('');
    const bad = list.findIndex(c => !c.labelEn.trim() && !c.labelEs.trim());
    if (bad >= 0) { setOpen(list[bad].key); setProblem(T('fnNeedName', { n: bad + 1 })); return; }
    const ok = await onSave(list.map(({ key, ...c }) => c));
    if (ok) setOpen(null);
  };
  return (
    <div className="uinv-box uinv-fn-editor">
      <div className="uinv-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{T('fnEditTitle')}</h2>
        <button type="button" className="uinv-btn uinv-btn-sm" onClick={onClose}>{T('close')}</button>
      </div>
      <p className="uinv-help">{T('fnEditHelp')}</p>
      {list.length === 0 && <p className="uinv-help"><strong>{T('fnEditEmpty')}</strong></p>}
      <ol className="uinv-fn-edit-list">
        {list.map((c, i) => {
          const item = c.itemId ? items.find(it => it.id === c.itemId) : null;
          const isOpen = open === c.key;
          return (
            <li key={c.key} className="uinv-fn-edit-row">
              <div className="uinv-fn-edit-head">
                <div className="uinv-fn-text">
                  <strong>{labelOf(lang, c) || T('fnUnnamed')}</strong>
                  {otherLabelOf(lang, c) && <span className="uinv-area-other">{otherLabelOf(lang, c)}</span>}
                  {item && <span className="uinv-meta">{T('fnItem', { name: primaryText(lang, item.nameEn, item.nameEs) })}</span>}
                </div>
                <div className="uinv-row uinv-fn-edit-btns">
                  <button type="button" className="uinv-btn uinv-btn-sm" aria-label={T('fnUp')} disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="uinv-btn uinv-btn-sm" aria-label={T('fnDown')} disabled={busy || i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="uinv-btn uinv-btn-sm" aria-expanded={isOpen} disabled={busy} onClick={() => setOpen(isOpen ? null : c.key)}>{T('edit')}</button>
                  <button type="button" className="uinv-btn uinv-btn-sm" aria-label={T('fnRemove', { name: labelOf(lang, c) })} disabled={busy}
                    onClick={() => setList(l => l.filter(x => x.key !== c.key))}>✕</button>
                </div>
              </div>
              {isOpen && <CheckFields lang={lang} check={c} items={sortedItems} canTranslate={canTranslate} translate={translate} onChange={p => change(c.key, p)} />}
            </li>
          );
        })}
      </ol>
      <div className="uinv-row" style={{ marginTop: 8 }}>
        <button type="button" className="uinv-btn" disabled={busy} onClick={() => { const b = blank(); setList(l => [...l, b]); setOpen(b.key); }}>{T('fnAdd')}</button>
        <button type="button" className="uinv-btn" disabled={busy || !items.length} onClick={addSuggested}>{T('fnSuggest')}</button>
      </div>
      {problem && <div className="uinv-msg uinv-msg-err" role="alert" style={{ marginTop: 8 }}>{problem}</div>}
      <div className="uinv-row" style={{ marginTop: 10 }}>
        <button type="button" className="uinv-btn uinv-btn-p" disabled={busy || !dirty} onClick={save}>{busy ? T('saving') : T('fnSave', { n: list.length })}</button>
        {dirty && <button type="button" className="uinv-btn" disabled={busy} onClick={() => { setList(checks.map(c => ({ ...c, key: c.id }))); setOpen(null); setProblem(''); }}>{T('fnUndo')}</button>}
      </div>
    </div>
  );
}
