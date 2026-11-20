// Unit inventory — UI strings (Spanish + English) and the small helpers
// both screens share. Kept inside the module, like incidents/i18n, so the
// no-login cleaning-service page can load without the main app's bundle
// of strings.

const STR = {
  title:            { es: 'Inventario', en: 'Inventory' },
  apt:              { es: 'Apto', en: 'Apt' },
  loading:          { es: 'Cargando…', en: 'Loading…' },
  close:            { es: 'Cerrar', en: 'Close' },
  cancel:           { es: 'Cancelar', en: 'Cancel' },
  save:             { es: 'Guardar', en: 'Save' },
  saving:           { es: 'Guardando…', en: 'Saving…' },
  tabItems:         { es: 'Artículos', en: 'Items' },
  tabHistory:       { es: 'Historial', en: 'History' },
  noArea:           { es: 'Sin área', en: 'No area' },
  empty:            { es: 'Este apartamento aún no tiene inventario.', en: 'This unit has no inventory yet.' },
  emptyHint:        { es: 'Agrega artículos uno por uno o importa un archivo CSV.', en: 'Add items one at a time, or import a CSV file.' },
  addItem:          { es: '＋ Agregar artículo', en: '＋ Add item' },
  importCsv:        { es: 'Importar CSV', en: 'Import CSV' },
  changedSummary:   { es: '{d} de {n} artículos cambiaron frente a la línea base', en: '{d} of {n} items have changed from the baseline' },
  allMatch:         { es: 'Todo coincide con la línea base ({n} artículos).', en: 'Everything matches the baseline ({n} items).' },
  changedSummaryShared: { es: '{d} de {n} artículos no coinciden con lo esperado', en: '{d} of {n} items differ from the expected count' },
  allMatchShared:   { es: 'Todo coincide con lo esperado ({n} artículos).', en: 'Everything matches the expected count ({n} items).' },
  chipMissing:      { es: '▼ {n} con faltantes', en: '▼ {n} with items missing' },
  chipExtra:        { es: '▲ {n} con sobrantes', en: '▲ {n} with extras' },
  onlyChanged:      { es: 'Ver solo los cambios', en: 'Show only changed' },
  showAll:          { es: 'Ver todos', en: 'Show all' },
  areaChanged:      { es: '{n} con cambio', en: '{n} changed' },
  baseline:         { es: 'Línea base', en: 'Baseline' },
  count:            { es: 'Conteo', en: 'Count' },
  note:             { es: 'Nota', en: 'Note' },
  notePlaceholder:  { es: 'Nota (faltante, dañado, repuesto…)', en: 'Note (missing, damaged, replaced…)' },
  lastCounted:      { es: 'Último conteo: {when} · {who}', en: 'Last counted: {when} · {who}' },
  neverCounted:     { es: 'Sin conteos todavía', en: 'Not counted yet' },
  diffMissing:      { es: '▼ Faltan {n}', en: '▼ {n} missing' },
  diffExtra:        { es: '▲ Sobran {n}', en: '▲ {n} extra' },
  diffMissingOne:   { es: '▼ Falta 1', en: '▼ 1 missing' },
  diffExtraOne:     { es: '▲ Sobra 1', en: '▲ 1 extra' },
  edit:             { es: 'Editar', en: 'Edit' },
  delete:           { es: 'Eliminar', en: 'Delete' },
  deleteConfirm:    { es: '¿Eliminar "{name}" del inventario? Su historial se conserva.', en: 'Delete "{name}" from the inventory? Its history is kept.' },
  saveCounts:       { es: 'Guardar {n} cambio(s)', en: 'Save {n} change(s)' },
  countInvalid:     { es: 'Los conteos deben ser números enteros de 0 en adelante.', en: 'Counts must be whole numbers, 0 or more.' },
  saved:            { es: 'Guardado.', en: 'Saved.' },
  rebaselineAll:    { es: 'Actualizar línea base ({n})', en: 'Re-baseline ({n})' },
  rebaselineOne:    { es: 'Aceptar como línea base', en: 'Accept as baseline' },
  rebaselineHint:   { es: 'Acepta los conteos actuales como la nueva línea base. Solo el propietario puede hacerlo.', en: 'Accepts the current counts as the new baseline. Only the owner can do this.' },
  rebaselineConfirm:{ es: '¿Aceptar los conteos actuales de {n} artículo(s) como la nueva línea base? El cambio queda en el historial.', en: 'Accept the current counts of {n} item(s) as the new baseline? The change is recorded in the history.' },
  unsavedFirst:     { es: 'Guarda o descarta primero los conteos sin guardar.', en: 'Save or discard your unsaved counts first.' },

  formAdd:          { es: 'Nuevo artículo', en: 'New item' },
  formEdit:         { es: 'Editar artículo', en: 'Edit item' },
  areaEn:           { es: 'Área (inglés)', en: 'Area (English)' },
  areaEs:           { es: 'Área (español)', en: 'Area (Spanish)' },
  nameEn:           { es: 'Descripción (inglés)', en: 'Description (English)' },
  nameEs:           { es: 'Descripción (español)', en: 'Description (Spanish)' },
  noteEn:           { es: 'Nota del propietario (inglés)', en: 'Owner note (English)' },
  noteEs:           { es: 'Nota del propietario (español)', en: 'Owner note (Spanish)' },
  startCount:       { es: 'Cantidad inicial (línea base)', en: 'Starting count (baseline)' },
  nameRequired:     { es: 'Escribe la descripción en inglés o en español.', en: 'Enter the description in English or Spanish.' },
  baselineLocked:   { es: 'La línea base solo cambia al actualizarla desde los conteos.', en: 'The baseline only changes when you re-baseline from the counts.' },

  linkTitle:        { es: 'Enlace para el servicio de limpieza', en: 'Cleaning service link' },
  linkHelp:         { es: 'Quien tenga este enlace puede ver el inventario y actualizar conteos y notas sin iniciar sesión. No puede agregar ni eliminar artículos.', en: 'Anyone with this link can see the inventory and update counts and notes without signing in. They cannot add or delete items.' },
  linkCreate:       { es: 'Crear enlace', en: 'Create link' },
  linkCopy:         { es: 'Copiar', en: 'Copy' },
  linkCopied:       { es: 'Copiado', en: 'Copied' },
  linkDisable:      { es: 'Desactivar', en: 'Turn off' },
  linkEnable:       { es: 'Activar', en: 'Turn on' },
  linkRegenerate:   { es: 'Generar uno nuevo', en: 'Make a new one' },
  linkRegenConfirm: { es: 'El enlace actual dejará de funcionar. ¿Generar uno nuevo?', en: 'The current link will stop working. Make a new one?' },
  linkOff:          { es: 'El enlace está desactivado.', en: 'The link is turned off.' },

  importTitle:      { es: 'Importar desde CSV', en: 'Import from CSV' },
  importHelp:       { es: 'Columnas: area_en, area_es, name_en, name_es, count, note_en, note_es. La primera fila son los encabezados.', en: 'Columns: area_en, area_es, name_en, name_es, count, note_en, note_es. The first row is the header.' },
  importChoose:     { es: 'Elegir archivo…', en: 'Choose file…' },
  importPreview:    { es: '{n} artículos listos para importar.', en: '{n} items ready to import.' },
  importConfirm:    { es: 'Importar {n} artículos', en: 'Import {n} items' },
  importNoRows:     { es: 'No se encontraron artículos en el archivo.', en: 'No items were found in the file.' },
  importBadRow:     { es: 'Fila {row}: {problem}', en: 'Row {row}: {problem}' },
  importNeedName:   { es: 'falta la descripción', en: 'the description is missing' },
  importBadCount:   { es: 'la cantidad no es un número entero', en: 'the count is not a whole number' },
  importNoHeader:   { es: 'El archivo necesita una columna name_en o name_es.', en: 'The file needs a name_en or name_es column.' },

  histEmpty:        { es: 'Aún no hay cambios registrados.', en: 'No changes recorded yet.' },
  histCreated:      { es: 'Agregado con cantidad {n}', en: 'Added with count {n}' },
  histDeleted:      { es: 'Eliminado (conteo {n}, línea base {b})', en: 'Deleted (count {n}, baseline {b})' },
  histEdited:       { es: 'Descripción editada', en: 'Description edited' },
  histField:        { es: '{field}: "{a}" → "{b}"', en: '{field}: "{a}" → "{b}"' },
  histCount:        { es: 'Conteo {a} → {b}', en: 'Count {a} → {b}' },
  histNote:         { es: 'Nota: "{a}" → "{b}"', en: 'Note: "{a}" → "{b}"' },
  histRebaseline:   { es: 'Línea base {a} → {b}', en: 'Baseline {a} → {b}' },
  actorOwner:       { es: 'Propietario', en: 'Owner' },
  actorCleaner:     { es: 'Limpieza', en: 'Cleaning' },

  sharedSubtitle:   { es: 'Revisa cada artículo, corrige el conteo si cambió y deja una nota si hace falta.', en: 'Check each item, correct the count if it changed, and leave a note if needed.' },
  yourName:         { es: 'Tu nombre', en: 'Your name' },
  yourNameHint:     { es: 'Se guarda junto con tus cambios.', en: 'Saved with your changes.' },
  nameNeeded:       { es: 'Escribe tu nombre antes de guardar.', en: 'Enter your name before saving.' },
  expected:         { es: 'Esperado', en: 'Expected' },
  search:           { es: 'Buscar artículo…', en: 'Search items…' },
  noMatches:        { es: 'Ningún artículo coincide con la búsqueda.', en: 'No items match the search.' },
  sharedSaved:      { es: 'Cambios guardados. ¡Gracias!', en: 'Changes saved. Thank you!' },
  nothingToSave:    { es: 'Sin cambios por guardar', en: 'No changes to save' },
  linkInactive:     { es: 'Este enlace no está activo. Pide uno nuevo al propietario.', en: 'This link is not active. Ask the owner for a new one.' },
  itemsInArea:      { es: '{n} artículos', en: '{n} items' },

  // Phone-first list controls.
  openAll:          { es: 'Abrir todas las áreas', en: 'Open all areas' },
  closeAll:         { es: 'Cerrar todas las áreas', en: 'Close all areas' },
  addNote:          { es: '＋ Nota', en: '＋ Note' },
  more:             { es: 'Más opciones', en: 'More options' },
  less:             { es: 'Ocultar', en: 'Hide' },
  oneLess:          { es: 'Uno menos', en: 'One less' },
  oneMore:          { es: 'Uno más', en: 'One more' },
  discard:          { es: 'Descartar', en: 'Discard' },
  discardConfirm:   { es: '¿Descartar {n} cambio(s) sin guardar?', en: 'Discard {n} unsaved change(s)?' },
  unsavedClose:     { es: 'Tienes {n} cambio(s) sin guardar. ¿Cerrar sin guardar?', en: 'You have {n} unsaved change(s). Close without saving?' },
  draftRestored:    { es: 'Recuperamos {n} cambio(s) que no habías guardado. Revísalos y guarda.', en: 'We restored {n} change(s) you had not saved. Check them and save.' },
  dismiss:          { es: 'Cerrar aviso', en: 'Dismiss' },
  linkShare:        { es: 'Compartir', en: 'Share' },
  linkShareText:    { es: 'Inventario del apartamento {apt}: abre este enlace para actualizar los conteos.', en: 'Inventory for apartment {apt}: open this link to update the counts.' },
  linkOptions:      { es: 'Opciones', en: 'Options' },
  linkOnBadge:      { es: 'Activo', en: 'On' },
  linkOffBadge:     { es: 'Desactivado', en: 'Off' },
};

const isEnglish = (lang) => String(lang || '').toLowerCase().startsWith('en');

export const tr = (lang, key, vars = {}) => {
  const entry = STR[key];
  const raw = entry ? (isEnglish(lang) ? entry.en : entry.es) : key;
  return String(raw).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
};

// What the owner wrote about an item (area, description, note) is always
// shown Spanish first with English as the smaller second line, whatever
// language the screen's own labels are in: the people who count the unit
// work in Spanish, and one fixed order means the owner and the cleaning
// service are looking at the same line. Falls back to English when the
// Spanish was left blank.
export const primaryText = (en, es) => es || en || '';

// The English under it — only when both exist and actually differ.
export const secondaryText = (en, es) => (es && en && en !== es ? en : '');

// Items grouped by area in list order: [{ key, label, other, items }].
// `label` is the area in Spanish, `other` its English name.
export const groupByArea = (items, lang) => {
  const groups = [];
  const byKey = new Map();
  for (const it of items) {
    const key = `${it.areaEn}\u0001${it.areaEs}`;
    if (!byKey.has(key)) {
      const g = {
        key,
        label: primaryText(it.areaEn, it.areaEs) || tr(lang, 'noArea'),
        other: secondaryText(it.areaEn, it.areaEs),
        items: [],
      };
      byKey.set(key, g);
      groups.push(g);
    }
    byKey.get(key).items.push(it);
  }
  return groups;
};

export const formatWhen = (iso, lang) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(isEnglish(lang) ? 'en-US' : 'es-CO',
    { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// A count typed into a box: '' and anything that isn't a whole number
// from 0 up is invalid (null).
export const parseCountInput = (v) => {
  const s = String(v ?? '').trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  return Number(s);
};

// How far an item's count is from its baseline: negative = missing,
// positive = extra, 0 = matches. Pass what is typed in the count box to
// judge the unsaved value, so the highlight follows the typing; an entry
// that isn't a valid count falls back to the saved one.
export const diffFromBaseline = (item, typedCount) => {
  const typed = typedCount === undefined ? null : parseCountInput(typedCount);
  return (typed == null ? item.currentCount : typed) - item.baselineCount;
};

// The row class that paints an item by its difference from the baseline.
export const diffClass = (diff) => (diff < 0 ? ' uinv-item-miss' : diff > 0 ? ' uinv-item-extra' : '');

// How many items are below / above their baseline.
export const tallyDiffs = (items, diffOf) => {
  let missing = 0;
  let extra = 0;
  for (const it of items) {
    const d = diffOf(it);
    if (d < 0) missing++; else if (d > 0) extra++;
  }
  return { missing, extra, changed: missing + extra };
};

export const API_BASE = '/api/m/unit-inventory';
