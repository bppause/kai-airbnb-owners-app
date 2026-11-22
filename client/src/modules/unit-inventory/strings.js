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
  duplicate:        { es: 'Duplicar', en: 'Duplicate' },
  duplicateHint:    { es: 'Agregar un artículo nuevo a partir de este', en: 'Add a new item starting from this one' },
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
  formDuplicate:    { es: 'Duplicar artículo', en: 'Duplicate item' },
  formTranslateHelp: { es: '🌐 Escribe en {own}; el {other} se traduce solo y no se edita aquí.', en: '🌐 Type in {own}; the {other} is translated for you and can’t be edited here.' },
  trReadonly:       { es: '🌐 Traducción automática del {from}. Para cambiarla, edita el {from}.', en: '🌐 Translated from {from}. To change it, edit the {from}.' },
  noteTrLabel:      { es: '🌐 En {lang} (traducción automática):', en: '🌐 In {lang} (automatic translation):' },
  noteOrigLabel:    { es: '🌐 En {lang} (original):', en: '🌐 In {lang} (original):' },
  langEn:           { es: 'inglés', en: 'English' },
  langEs:           { es: 'español', en: 'Spanish' },
  tr_pending:       { es: '🌐 Traduciendo…', en: '🌐 Translating…' },
  tr_auto:          { es: '🌐 Traducido automáticamente — revísalo', en: '🌐 Translated automatically — check it' },
  tr_failed:        { es: 'No se pudo traducir ({why}). Escríbelo tú aquí.', en: 'Couldn’t translate ({why}). Type it here yourself.' },
  formDuplicateHelp: { es: 'Es una copia: cambia lo que sea distinto y guarda. Se agrega como artículo nuevo; las fotos no se copian.', en: 'This is a copy: change what is different and save. It is added as a new item; photos are not copied.' },
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
  linkHelp:         { es: 'Envíaselo al servicio de limpieza: lo usa cada vez que termina la limpieza después de una salida de Airbnb. Quien tenga este enlace puede ver el inventario y actualizar conteos y notas sin iniciar sesión. No puede agregar ni eliminar artículos.', en: 'Send it to the cleaning service: they use it each time they finish cleaning after an Airbnb checkout. Anyone with this link can see the inventory and update counts and notes without signing in. They cannot add or delete items.' },
  linkCreate:       { es: 'Crear enlace', en: 'Create link' },
  linkCopy:         { es: 'Copiar', en: 'Copy' },
  linkCopied:       { es: 'Copiado', en: 'Copied' },
  linkDisable:      { es: 'Desactivar', en: 'Turn off' },
  linkEnable:       { es: 'Activar', en: 'Turn on' },
  linkRegenerate:   { es: 'Generar uno nuevo', en: 'Make a new one' },
  linkRegenConfirm: { es: 'El enlace actual dejará de funcionar. ¿Generar uno nuevo?', en: 'The current link will stop working. Make a new one?' },
  linkOff:          { es: 'El enlace está desactivado.', en: 'The link is turned off.' },

  importTitle:      { es: 'Importar desde CSV', en: 'Import from CSV' },
  importHelp:       { es: 'Columnas: area_en, area_es, name_en, name_es, count, note_en, note_es. La primera fila son los encabezados. Opcional: required (sí/no) para marcar lo que se cuenta en cada salida.', en: 'Columns: area_en, area_es, name_en, name_es, count, note_en, note_es. The first row is the header. Optional: required (yes/no) to mark what is counted at every checkout.' },
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
  linkShareText:    { es: 'Inventario del apartamento {apt}: ábrelo cada vez que termines la limpieza después de una salida de Airbnb. Si es tu primera vez, toca ❓ Ayuda.', en: 'Inventory for apartment {apt}: open it each time you finish cleaning after an Airbnb checkout. First time? Tap ❓ Help.' },
  linkOptions:      { es: 'Opciones', en: 'Options' },
  linkOnBadge:      { es: 'Activo', en: 'On' },
  linkOffBadge:     { es: 'Desactivado', en: 'Off' },

  // Marking a count as complete.
  countDoneTitle:   { es: '¿Terminaste de revisar todo?', en: 'Finished checking everything?' },
  countDoneHelp:    { es: 'Marca el conteo como completo para que quede registrado quién revisó y cuándo, aunque nada haya cambiado.', en: 'Mark the count as complete so there is a record of who checked and when, even if nothing changed.' },
  countDoneBtn:     { es: '✓ Conteo completo', en: '✓ Count complete' },
  countDoneBtnSave: { es: '✓ Guardar {n} cambio(s) y completar', en: '✓ Save {n} change(s) and complete' },
  countDoneConfirm: { es: '¿Confirmas que revisaste los {n} artículos de este apartamento?', en: 'Confirm that you checked all {n} items in this unit?' },
  countDoneSaved:   { es: 'Conteo completo registrado. ¡Gracias!', en: 'Count recorded as complete. Thank you!' },
  lastCheck:        { es: 'Último conteo completo: {when} · {who}', en: 'Last complete count: {when} · {who}' },
  lastCheckNever:   { es: 'Aún no se ha registrado un conteo completo.', en: 'No complete count has been recorded yet.' },
  histCheck:        { es: '✓ Conteo completo', en: '✓ Count complete' },
  checkTotal:       { es: '{n} artículos', en: '{n} items' },
  checkMissing:     { es: '{n} con faltantes', en: '{n} with items missing' },
  checkExtra:       { es: '{n} con sobrantes', en: '{n} with extras' },

  // Items the cleaning service proposes, and the owner's decision.
  proposeBtn:       { es: '＋ Agregar un artículo que no está en la lista', en: '＋ Add an item that is not on the list' },
  proposeTitle:     { es: 'Artículo nuevo', en: 'New item' },
  proposeHelp:      { es: 'El propietario debe aprobarlo antes de que quede en el inventario.', en: 'The owner must approve it before it joins the inventory.' },
  proposeName:      { es: 'Descripción', en: 'Description' },
  proposeArea:      { es: 'Área', en: 'Area' },
  proposeAreaOther: { es: 'Otra área…', en: 'Another area…' },
  proposeAreaNew:   { es: 'Nombre del área', en: 'Area name' },
  proposeCount:     { es: 'Cantidad', en: 'Quantity' },
  proposeSend:      { es: 'Enviar al propietario', en: 'Send to the owner' },
  proposeSent:      { es: 'Enviado. El propietario lo revisará.', en: 'Sent. The owner will review it.' },
  proposeNameNeeded:{ es: 'Escribe la descripción del artículo.', en: 'Enter the description of the item.' },
  pendingShared:    { es: 'Esperando aprobación del propietario ({n})', en: 'Waiting for the owner to approve ({n})' },
  pendingSharedHelp:{ es: 'Estos artículos aún no hacen parte del inventario.', en: 'These items are not part of the inventory yet.' },
  pendingOwner:     { es: 'Propuestos por el servicio de limpieza ({n})', en: 'Proposed by the cleaning service ({n})' },
  pendingOwnerHelp: { es: 'No hacen parte del inventario hasta que los apruebes. Al aprobar, la cantidad propuesta queda como línea base.', en: 'They are not part of the inventory until you approve them. On approval the proposed count becomes the baseline.' },
  proposedQty:      { es: 'Cantidad: {n}', en: 'Quantity: {n}' },
  proposedBy:       { es: 'Propuesto por {who} · {when}', en: 'Proposed by {who} · {when}' },
  approve:          { es: '✓ Aprobar', en: '✓ Approve' },
  reject:           { es: 'Rechazar', en: 'Reject' },
  rejectConfirm:    { es: '¿Rechazar "{name}"? No se agregará al inventario.', en: 'Reject "{name}"? It will not be added to the inventory.' },
  approvedMsg:      { es: 'Agregado al inventario.', en: 'Added to the inventory.' },
  rejectedMsg:      { es: 'Propuesta rechazada.', en: 'Proposal rejected.' },
  histProposedBy:   { es: '{line} · propuesto por {who}', en: '{line} · proposed by {who}' },

  // Items that must be counted at every checkout (★). Off by default.
  reqBadge:         { es: '★ Cada salida', en: '★ Every checkout' },
  reqTurnOn:        { es: 'Pedir que se cuente en cada salida', en: 'Require counting at every checkout' },
  reqTurnOff:       { es: 'Dejar de exigir el conteo en cada salida', en: 'Stop requiring a count at every checkout' },
  viewRequired:     { es: '★ Cada salida ({n})', en: '★ Every checkout ({n})' },
  viewAll:          { es: 'Todos ({n})', en: 'All ({n})' },
  filterRequired:   { es: 'Ver solo los de cada salida', en: 'Show only every-checkout items' },
  reqHintShared:    { es: 'Los artículos con ★ deben contarse en cada salida. Los demás no hace falta contarlos uno por uno, pero si ves que alguno falta o está dañado, repórtalo igual.', en: 'Items marked ★ must be counted at every checkout. The others don’t need counting one by one, but if you see one is missing or damaged, report it anyway.' },
  reqHintOwner:     { es: 'Marca con ★ lo que el servicio de limpieza debe contar en cada salida. Lo demás queda en la lista como referencia.', en: 'Mark with ★ what the cleaning service must count at every checkout. Everything else stays on the list for reference.' },
  areaReqAll:       { es: '★ Toda el área', en: '★ Whole area' },
  areaReqNone:      { es: '☆ Quitar del área', en: '☆ Clear area' },
  areaReqCount:     { es: '★ {n}', en: '★ {n}' },
  formRequired:     { es: 'Contar en cada salida (★)', en: 'Count at every checkout (★)' },
  countDoneConfirmReq: { es: '¿Confirmas que revisaste los {n} artículos que se cuentan en cada salida?', en: 'Confirm that you checked the {n} items counted at every checkout?' },
  checkRequired:    { es: '{n} de cada salida revisados', en: '{n} every-checkout items checked' },
  checkMatch:       { es: 'todo coincide', en: 'everything matched' },

  // What the cleaning service is asked to do, step by step.
  taskTitle:        { es: 'Al terminar la limpieza de esta salida', en: 'When the checkout cleaning is done' },
  helpBtn:          { es: '❓ Ayuda', en: '❓ Help' },
  helpTitle:        { es: 'Cómo usar el inventario', en: 'How to use the inventory' },
  helpIntro:        { es: 'Esta página es la lista de todo lo que hay en el apartamento. Úsala cada vez que salen los huéspedes de Airbnb, cuando ya terminaste de limpiar. El propietario ve el resultado con fecha y hora.', en: 'This page is the list of everything in the apartment. Use it each time Airbnb guests check out, once you have finished cleaning. The owner sees the result with the date and time.' },
  helpDone:         { es: 'Entendido', en: 'Got it' },
  introTitle:       { es: '👋 Bienvenido/a al inventario', en: '👋 Welcome to the inventory' },
  introBody:        { es: 'Aquí está todo lo que hay en el apartamento. Úsalo cada vez que salen los huéspedes de Airbnb, cuando ya terminaste de limpiar. No necesitas cuenta: solo este enlace.', en: 'Everything in the apartment is listed here. Use it each time Airbnb guests check out, once you have finished cleaning. You don’t need an account: just this link.' },
  introSteps:       { es: 'Con el apartamento ya limpio: cuenta los artículos, reporta cualquier daño o faltante (aunque el artículo no tenga ★) y toca “✓ Conteo completo”. Toma unos minutos.', en: 'With the apartment clean: count the items, report any damage or missing item (even without ★) and tap “✓ Count complete”. It takes a few minutes.' },
  introStepsVideo:  { es: 'Con el apartamento ya limpio: cuenta los artículos, reporta cualquier daño o faltante (aunque el artículo no tenga ★), graba un video corto del apartamento y toca “✓ Conteo completo”. Toma unos minutos.', en: 'With the apartment clean: count the items, report any damage or missing item (even without ★), record a short video of the apartment and tap “✓ Count complete”. It takes a few minutes.' },
  introOk:          { es: 'Entendido', en: 'Got it' },
  introHow:         { es: '❓ Ver cómo funciona', en: '❓ See how it works' },
  taskCountReq:     { es: 'Cuenta los {n} artículos marcados ★.', en: 'Count the {n} items marked ★.' },
  taskCountAll:     { es: 'Cuenta todos los artículos de la lista ({n}).', en: 'Count every item on the list ({n}).' },
  taskCountHow:     { es: 'Corrige el número si cambió. Si algo ya no está, pon 0 y deja una nota.', en: 'Correct the number if it changed. If something is gone, set 0 and leave a note.' },
  taskDamageHow:    { es: 'Si falta algo sin ★, búscalo con el buscador, corrige el número y deja una nota. Si está dañado, toca “⚠️ Daño” en el artículo y toma una foto.', en: 'If something without ★ is missing, find it with the search box, correct the number and leave a note. If it is damaged, tap “⚠️ Damage” on the item and take a photo.' },
  finishAlsoUnflagged: { es: 'Si notaste algo dañado o que falta en artículos sin ★, repórtalo antes de finalizar.', en: 'If you noticed something damaged or missing among items without ★, report it before finishing.' },
  taskDamage:       { es: 'Reporta cualquier daño o faltante que veas, también en artículos sin ★.', en: 'Report any damage or missing item you see, including items without ★.' },
  taskFinish:       { es: 'Al terminar, toca “Conteo completo”.', en: 'When you finish, tap “Count complete”.' },

  // Damage reports.
  damageBtn:        { es: '⚠️ Reportar un daño', en: '⚠️ Report damage' },
  damageBtnItem:    { es: '⚠️ Reportar daño', en: '⚠️ Report damage' },
  damageQuick:      { es: '⚠️ Daño', en: '⚠️ Damage' },
  damageQuickAria:  { es: 'Reportar daño en: {name}', en: 'Report damage on: {name}' },
  damageTitle:      { es: 'Reportar un daño', en: 'Report damage' },
  damageHelp:       { es: 'El propietario recibe el reporte con las fotos.', en: 'The owner receives the report with the photos.' },
  damageDesc:       { es: '¿Qué está dañado?', en: 'What is damaged?' },
  damageDescPh:     { es: 'Ej.: vidrio de la mesa rajado', en: 'E.g. cracked glass on the table' },
  damageArea:       { es: 'Área', en: 'Area' },
  damageAreaNone:   { es: 'General / otra', en: 'General / other' },
  damageItem:       { es: 'Artículo (si aplica)', en: 'Item (if it applies)' },
  damageItemNone:   { es: '— No aplica —', en: '— Does not apply —' },
  damageLocation:   { es: 'Lugar exacto (opcional)', en: 'Exact spot (optional)' },
  damagePhotos:     { es: 'Fotos (hasta {n})', en: 'Photos (up to {n})' },
  damageAddPhoto:   { es: '📷 Agregar foto', en: '📷 Add photo' },
  damagePhotoRemove:{ es: 'Quitar foto', en: 'Remove photo' },
  damagePhotoBusy:  { es: 'Preparando foto…', en: 'Preparing photo…' },
  damagePhotoBad:   { es: 'No se pudo usar esa foto. Prueba con otra.', en: 'That photo could not be used. Try another.' },
  damageSend:       { es: 'Enviar reporte', en: 'Send report' },
  damageSent:       { es: 'Daño reportado. El propietario fue avisado.', en: 'Damage reported. The owner has been told.' },
  damageDescNeeded: { es: 'Describe el daño.', en: 'Describe the damage.' },
  damagesVisit:     { es: 'Daños reportados en esta visita ({n})', en: 'Damage reported this visit ({n})' },
  damagesOpen:      { es: 'Daños abiertos ({n})', en: 'Open damage reports ({n})' },
  damagePhotoCount: { es: '📷 {n} foto(s)', en: '📷 {n} photo(s)' },
  damageShowPhotos: { es: '📷 Ver fotos ({n})', en: '📷 View photos ({n})' },
  damagePhotoAlt:   { es: 'Foto del daño', en: 'Photo of the damage' },
  damageResolve:    { es: '✓ Marcar resuelto', en: '✓ Mark resolved' },
  damageResolved:   { es: 'Resuelto', en: 'Resolved' },
  damageResolvedMsg:{ es: 'Daño marcado como resuelto.', en: 'Damage marked as resolved.' },
  damageBy:         { es: 'Reportado por {who} · {when}', en: 'Reported by {who} · {when}' },

  // The step before a count is finalized.
  finishTitle:      { es: 'Antes de finalizar', en: 'Before you finish' },
  finishCoversReq:  { es: 'Al finalizar confirmas que revisaste los {n} artículos marcados ★.', en: 'By finishing you confirm that you checked the {n} items marked ★.' },
  finishCoversAll:  { es: 'Al finalizar confirmas que revisaste los {n} artículos de la lista.', en: 'By finishing you confirm that you checked the {n} items on the list.' },
  finishAsk:        { es: '¿Hay algún daño que reportar?', en: 'Is there any damage to report?' },
  finishReported:   { es: 'Ya reportaste {n} en esta visita.', en: 'You have already reported {n} this visit.' },
  finishYes:        { es: '⚠️ Sí, reportar un daño', en: '⚠️ Yes, report damage' },
  finishNo:         { es: '✓ No hay daños · Finalizar', en: '✓ No damage · Finish' },
  finishNoMore:     { es: '✓ No hay más daños · Finalizar', en: '✓ No more damage · Finish' },
  finishBack:       { es: 'Volver', en: 'Back' },

  // The owner's report for each checkout.
  tabReports:       { es: 'Reportes de salida', en: 'Checkout reports' },
  reportsHelp:      { es: 'Un reporte por cada inventario completado, con fecha y hora.', en: 'One report for each completed inventory, with its date and time.' },
  reportsEmpty:     { es: 'Aún no hay inventarios completados.', en: 'No completed inventories yet.' },
  reportOpen:       { es: 'Ver reporte ▾', en: 'View report ▾' },
  reportClose:      { es: 'Ocultar ▴', en: 'Hide ▴' },
  reportDiffs:      { es: 'Artículos contados (★), con diferencia o con nota ({n})', en: 'Items counted (★), off baseline or noted ({n})' },
  reportNoDiffs:    { es: 'Todos los artículos coincidieron con la línea base.', en: 'Every item matched its baseline.' },
  reportExpected:   { es: 'Esperado {a} · contado {b}', en: 'Expected {a} · counted {b}' },
  reportDamages:    { es: 'Daños reportados ({n})', en: 'Damage reported ({n})' },
  reportNoDamages:  { es: 'Sin daños reportados.', en: 'No damage reported.' },
  checkDamages:     { es: '⚠️ {n} daño(s)', en: '⚠️ {n} damage report(s)' },

  // Photos the owner attaches to an item.
  photosShow:       { es: '📷 Fotos ({n})', en: '📷 Photos ({n})' },
  photosHide:       { es: 'Ocultar fotos', en: 'Hide photos' },
  photoAdd:         { es: '📷 Agregar foto', en: '📷 Add photo' },
  photoAdding:      { es: 'Guardando foto…', en: 'Saving photo…' },
  photoAlt:         { es: 'Foto del artículo', en: 'Photo of the item' },
  photoRemove:      { es: 'Eliminar foto', en: 'Delete photo' },
  photoRemoveConfirm: { es: '¿Eliminar esta foto?', en: 'Delete this photo?' },
  photoMax:         { es: 'Máximo {n} fotos por artículo.', en: 'At most {n} photos per item.' },
  photoHas:         { es: 'Tiene fotos', en: 'Has photos' },
  formPhotos:       { es: 'Fotos del artículo (hasta {n})', en: 'Photos of the item (up to {n})' },
  photosShowRef:    { es: '📷 Fotos de referencia ({n})', en: '📷 Reference photos ({n})' },

  // The checkout video (required).
  videoTitle:       { es: '🎥 Video del apartamento (obligatorio)', en: '🎥 Video of the apartment (required)' },
  videoHelp:        { es: 'Después de limpiar, graba un recorrido corto por todo el apartamento: cada habitación, baños, cocina y balcones. Máximo {n} minutos.', en: 'After cleaning, record a short walk through the whole apartment: every room, bathrooms, kitchen and balconies. At most {n} minutes.' },
  videoRecord:      { es: '🎥 Grabar video', en: '🎥 Record video' },
  videoStartRec:    { es: '● Empezar a grabar', en: '● Start recording' },
  videoStop:        { es: '■ Detener', en: '■ Stop' },
  videoUse:         { es: '✓ Enviar este video', en: '✓ Send this video' },
  videoRedo:        { es: 'Grabar de nuevo', en: 'Record again' },
  videoUploading:   { es: 'Subiendo video… {p}%', en: 'Uploading video… {p}%' },
  videoUploaded:    { es: '✓ Video subido · {dur} · {mb} MB', en: '✓ Video uploaded · {dur} · {mb} MB' },
  videoDelete:      { es: 'Eliminar y grabar otro', en: 'Delete and record another' },
  videoDeleteConfirm: { es: '¿Eliminar este video?', en: 'Delete this video?' },
  videoTooBig:      { es: 'El video pesa {mb} MB y el máximo es {max} MB. Graba uno más corto.', en: 'The video is {mb} MB and the most is {max} MB. Record a shorter one.' },
  videoTooLong:     { es: 'El video dura más de {n} minutos. Graba uno más corto.', en: 'The video is longer than {n} minutes. Record a shorter one.' },
  videoNotVideo:    { es: 'Ese archivo no es un video.', en: 'That file is not a video.' },
  videoCameraFail:  { es: 'No se pudo abrir la cámara en esta página.', en: 'The camera could not be opened in this page.' },
  videoFallbackHelp:{ es: 'Graba con la cámara del teléfono. Que sea corto: máximo {n} minutos y {max} MB.', en: 'Record with the phone’s camera. Keep it short: at most {n} minutes and {max} MB.' },
  videoUseCamera:   { es: '🎥 Grabar con la cámara del teléfono', en: '🎥 Record with the phone’s camera' },
  videoUploadFail:  { es: 'No se pudo subir el video ({why}). Revisa la conexión e inténtalo de nuevo.', en: 'The video could not be uploaded ({why}). Check the connection and try again.' },
  videoSent:        { es: 'Video subido. ¡Gracias!', en: 'Video uploaded. Thank you!' },
  videoMissing:     { es: 'Falta el video del apartamento. Grábalo antes de finalizar.', en: 'The video of the apartment is missing. Record it before finishing.' },
  taskVideo:        { es: 'Graba un video corto recorriendo todo el apartamento limpio (obligatorio).', en: 'Record a short video walking through the whole clean apartment (required).' },
  taskVideoDone:    { es: '✓ Video subido', en: '✓ Video uploaded' },
  taskVideoPending: { es: '🎥 Falta el video', en: '🎥 Video still needed' },
  taskPhotoOptional:{ es: 'Si algo falta o está dañado, puedes tomarle una foto (opcional).', en: 'If something is missing or damaged, you can take a photo of it (optional).' },
  finishVideo:      { es: 'El video del apartamento está subido.', en: 'The video of the apartment is uploaded.' },
  reportVideo:      { es: '🎥 Video del apartamento', en: '🎥 Video of the apartment' },
  reportVideoWatch: { es: '▶ Ver video', en: '▶ Watch video' },
  reportVideoNone:  { es: 'Este inventario no tiene video.', en: 'This inventory has no video.' },
  reportVideoGone:  { es: 'El video ya no se conserva (se guardan los de los 10 inventarios más recientes).', en: 'The video is no longer kept (those of the 10 most recent inventories are).' },
  checkVideo:       { es: '🎥 video', en: '🎥 video' },

  // Item photos the cleaning service may take (optional).
  proofOptional:    { es: '📷 Foto (opcional)', en: '📷 Photo (optional)' },
  proofOptionalHint:{ es: 'Útil si falta o está dañado.', en: 'Useful if it is missing or damaged.' },

  // Item photos the cleaning service takes at a checkout.
  proofHave:        { es: '✓ {n} foto(s)', en: '✓ {n} photo(s)' },
  proofTake:        { es: '📷 Tomar foto', en: '📷 Take photo' },
  proofAddMore:     { es: '📷 Otra foto', en: '📷 Another photo' },
  proofView:        { es: 'Ver fotos', en: 'View photos' },
  proofRemoveConfirm: { es: '¿Eliminar esta foto de prueba?', en: 'Delete this proof photo?' },
  reportPhotos:     { es: '📷 Ver fotos ({n})', en: '📷 View photos ({n})' },
  reportPhotosGone: { es: 'Las fotos de este inventario ya no se conservan (se guardan las de los 12 más recientes).', en: 'The photos of this inventory are no longer kept (those of the 12 most recent are).' },
  reportMatched:    { es: 'coincide', en: 'matches' },
  checkPhotos:      { es: '📷 {n} foto(s)', en: '📷 {n} photo(s)' },
  photoSomeFailed:  { es: 'El artículo se guardó, pero una foto no se pudo guardar: {why}', en: 'The item was saved, but a photo could not be saved: {why}' },
};

const isEnglish = (lang) => String(lang || '').toLowerCase().startsWith('en');

// A count note as a viewer reads it. With a translation stored, the note
// is shown in the viewer's language (`text`, the box they can edit) and
// in the other language read-only (`other`, language `otherLang`);
// `otherIsOriginal` says the read-only one is what was actually typed.
// Without a translation, `text` is the note as written and `other` is ''.
export const noteForViewer = (lang, { currentNote, currentNoteLang, currentNoteTranslation }) => {
  const note = currentNote || '';
  const translation = currentNoteTranslation || '';
  if (!note || !translation) return { text: note, other: '', otherLang: '', otherIsOriginal: false };
  const written = currentNoteLang === 'en' ? 'en' : 'es';
  const viewer = isEnglish(lang) ? 'en' : 'es';
  return viewer === written
    ? { text: note, other: translation, otherLang: written === 'en' ? 'es' : 'en', otherIsOriginal: false }
    : { text: translation, other: note, otherLang: written, otherIsOriginal: true };
};

export const tr = (lang, key, vars = {}) => {
  const entry = STR[key];
  const raw = entry ? (isEnglish(lang) ? entry.en : entry.es) : key;
  return String(raw).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
};

// What the owner wrote about an item (area, description, note) is shown
// in the viewer's language — the owner's app setting, or the language
// picked on the cleaning-service page — with the other language as the
// smaller second line. Falls back to the other language when the
// viewer's was left blank.
export const primaryText = (lang, en, es) => (isEnglish(lang) ? (en || es || '') : (es || en || ''));

// The other language under it — only when both exist and actually differ.
export const secondaryText = (lang, en, es) => {
  if (!en || !es || en === es) return '';
  return isEnglish(lang) ? es : en;
};

// Items grouped by area in list order:
// [{ key, label, other, areaEn, areaEs, items }]. `label` is the area in
// the viewer's language, `other` its name in the other one.
export const groupByArea = (items, lang) => {
  const groups = [];
  const byKey = new Map();
  for (const it of items) {
    const key = `${it.areaEn}\u0001${it.areaEs}`;
    if (!byKey.has(key)) {
      const g = {
        key,
        label: primaryText(lang, it.areaEn, it.areaEs) || tr(lang, 'noArea'),
        other: secondaryText(lang, it.areaEn, it.areaEs),
        areaEn: it.areaEn, areaEs: it.areaEs,
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

// One line describing a completed count: what it covered — the items
// flagged for every checkout if there were any, otherwise the whole list
// — how the unit stood, and any damage reported with it:
// "259 items · everything matched",
// "42 every-checkout items checked · 2 with items missing · ⚠️ 1 damage report(s)".
export const checkSummary = (lang, check) => [
  check.itemsRequired ? tr(lang, 'checkRequired', { n: check.itemsRequired }) : tr(lang, 'checkTotal', { n: check.itemsTotal }),
  check.itemsMissing ? tr(lang, 'checkMissing', { n: check.itemsMissing }) : '',
  check.itemsExtra ? tr(lang, 'checkExtra', { n: check.itemsExtra }) : '',
  !check.itemsMissing && !check.itemsExtra ? tr(lang, 'checkMatch') : '',
  check.damagesCount ? tr(lang, 'checkDamages', { n: check.damagesCount }) : '',
  check.photosCount ? tr(lang, 'checkPhotos', { n: check.photosCount }) : '',
  check.videosCount ? tr(lang, 'checkVideo') : '',
].filter(Boolean).join(' · ');

export const API_BASE = '/api/m/unit-inventory';
