// CSV import for unit inventory. An owner with a long starting list (a
// furnished apartment runs to a couple of hundred lines) loads it from a
// spreadsheet export instead of typing each item.
//
// Expected header row: area_en, area_es, name_en, name_es, count,
// note_en, note_es — in any order, any capitalisation; only one of the
// two name columns is required. An optional `required` column (yes / no)
// flags the items to count at every checkout.

// RFC 4180-style parse: quoted fields, doubled quotes, commas and line
// breaks inside quotes, CRLF or LF, optional BOM. Returns every row of
// cells, blank ones included, so callers can number rows as a
// spreadsheet does.
export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const isBlankRow = (cells) => !cells.some(c => String(c).trim() !== '');

const COLUMNS = {
  area_en: 'areaEn', area_es: 'areaEs',
  name_en: 'nameEn', name_es: 'nameEs',
  count: 'count', qty: 'count', quantity: 'count', cantidad: 'count',
  note_en: 'noteEn', note_es: 'noteEs',
  required: 'countRequired', count_required: 'countRequired', obligatorio: 'countRequired',
  cada_salida: 'countRequired', every_checkout: 'countRequired',
};

// What counts as "yes" in the optional required column. Anything else,
// including a blank cell, leaves the item not required — the default.
const YES = /^(y|yes|s|si|sí|true|1|x|★)$/i;

// Turns CSV text into items ready for POST …/items. Returns
// { items, problems } where each problem is { row, code } with `row`
// counted the way a spreadsheet shows it (header = row 1). `code` is one
// of 'noHeader' | 'needName' | 'badCount'.
export function itemsFromCsv(text) {
  const rows = parseCsv(text);
  // Leading blank lines aside, rows keep their position so a problem's
  // row number matches the spreadsheet; blank rows further down are
  // skipped without shifting the numbering.
  while (rows.length && isBlankRow(rows[0])) rows.shift();
  if (!rows.length) return { items: [], problems: [] };
  const header = rows[0].map(h => COLUMNS[String(h).trim().toLowerCase().replace(/\s+/g, '_')] || '');
  if (!header.includes('nameEn') && !header.includes('nameEs')) {
    return { items: [], problems: [{ row: 1, code: 'noHeader' }] };
  }
  const items = [];
  const problems = [];
  rows.slice(1).forEach((cells, idx) => {
    if (isBlankRow(cells)) return;
    const item = { areaEn: '', areaEs: '', nameEn: '', nameEs: '', noteEn: '', noteEs: '', count: '' };
    header.forEach((field, c) => { if (field) item[field] = String(cells[c] ?? '').trim(); });
    const rowNumber = idx + 2;
    if (!item.nameEn && !item.nameEs) { problems.push({ row: rowNumber, code: 'needName' }); return; }
    const countText = item.count === '' ? '1' : item.count;
    if (!/^\d{1,6}$/.test(countText)) { problems.push({ row: rowNumber, code: 'badCount' }); return; }
    items.push({ ...item, count: Number(countText), countRequired: YES.test(item.countRequired || '') });
  });
  return { items, problems };
}
