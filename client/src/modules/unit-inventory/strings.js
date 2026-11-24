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
  areaRename:       { es: '✏️ Renombrar área', en: '✏️ Rename area' },
  areaRenameTitle:  { es: 'Renombrar área', en: 'Rename area' },
  areaRenameHelp:   { es: 'El nuevo nombre se aplica a los {n} artículos de esta área.', en: 'The new name applies to the {n} items in this area.' },
  areaRenameMerge:  { es: 'Ya existe el área “{name}” ({n} artículos): al guardar, las dos se juntan en una.', en: 'The area “{name}” already exists ({n} items): saving combines the two.' },
  areaRenameSave:   { es: 'Guardar ({n} artículo(s))', en: 'Save ({n} item(s))' },
  areaRenamed:      { es: 'Área renombrada: {n} artículo(s) actualizado(s).', en: 'Area renamed: {n} item(s) updated.' },
  areaNameNeeded:   { es: 'Escribe el nombre del área.', en: 'Type the area’s name.' },
  areaPick:         { es: 'Área', en: 'Area' },
  areaPickChoose:   { es: '— Elige un área —', en: '— Choose an area —' },
  areaPickNew:      { es: '＋ Nueva área…', en: '＋ New area…' },
  orgOpen:          { es: '🗂️ Organizar áreas', en: '🗂️ Organize areas' },
  orgTitle:         { es: '🗂️ Organizar áreas', en: '🗂️ Organize areas' },
  orgHelp:          { es: 'Renombra un área, combina dos en una, o divide una moviendo algunos de sus artículos a otra área (existente o nueva). Los conteos y fotos no cambian.', en: 'Rename an area, combine two into one, or split one by moving some of its items to another area (existing or new). Counts and photos don’t change.' },
  orgRename:        { es: '✏️ Renombrar', en: '✏️ Rename' },
  orgCombine:       { es: '🔀 Combinar con…', en: '🔀 Combine with…' },
  orgSplit:         { es: '✂️ Dividir…', en: '✂️ Split…' },
  orgCombineInto:   { es: 'Mover sus {n} artículos al área', en: 'Move its {n} items into the area' },
  orgCombineHelp:   { es: '“{from}” desaparece y sus artículos pasan a “{to}” ({n} en total).', en: '“{from}” goes away and its items join “{to}” ({n} in all).' },
  orgCombineSave:   { es: 'Combinar: mover {n} a “{to}”', en: 'Combine: move {n} to “{to}”' },
  orgCombineSaveNone: { es: 'Combinar', en: 'Combine' },
  orgSplitHelp:     { es: 'Marca los artículos que pasan a otra área.', en: 'Tick the items that go to another area.' },
  orgSplitPick:     { es: 'Artículos a mover', en: 'Items to move' },
  orgSplitTo:       { es: 'Mover los {n} marcados a', en: 'Move the {n} ticked to' },
  orgSplitNewHelp:  { es: 'Nombre de la nueva área:', en: 'Name of the new area:' },
  orgSplitSave:     { es: 'Mover {n} artículo(s)', en: 'Move {n} item(s)' },
  itemsMoved:       { es: '{n} artículo(s) movido(s).', en: '{n} item(s) moved.' },
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
  introStepsVideo:  { es: 'Con el apartamento ya limpio: cuenta los artículos, reporta cualquier daño o faltante (aunque el artículo no tenga ★), graba un video corto del apartamento y toca “✓ Conteo completo”. Toma unos minutos. 🎥 El video es obligatorio: sin él no puedes terminar.', en: 'With the apartment clean: count the items, report any damage or missing item (even without ★), record a short video of the apartment and tap “✓ Count complete”. It takes a few minutes. 🎥 The video is required: you can’t finish without it.' },
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
  damageWhichItem:  { es: '¿Qué artículo? (opcional, aunque no esté en la lista de conteo)', en: 'Which item? (optional, even if it is not on the count list)' },
  damageItemSearch: { es: 'Buscar el artículo en el inventario', en: 'Search the inventory for the item' },
  damageItemSearchPh:{ es: '🔎 Buscar: toalla, vaso, lámpara…', en: '🔎 Search: towel, glass, lamp…' },
  damageItemNoHits: { es: 'Ningún artículo coincide. Prueba otra palabra, o elige solo el área abajo.', en: 'No item matches. Try another word, or just pick the area below.' },
  damageItemChange: { es: 'Cambiar', en: 'Change' },
  damageSuggestBtn: { es: '✨ Sugerir artículo por la foto', en: '✨ Suggest the item from the photo' },
  damageSuggestBtnDesc:{ es: '✨ Sugerir artículo por la descripción', en: '✨ Suggest the item from the description' },
  damageSuggestAgainDesc:{ es: '✨ Sugerir de nuevo', en: '✨ Suggest again' },
  damageSuggestSeenDesc:{ es: 'Parece ser: {seen}', en: 'It seems to be: {seen}' },
  damageDescHits:   { es: 'Según la descripción, ¿es alguno de estos? Toca para vincularlo:', en: 'From the description, is it one of these? Tap to link it:' },
  damageSuggestAgain:{ es: '✨ Sugerir de nuevo (última foto)', en: '✨ Suggest again (latest photo)' },
  damageSuggesting: { es: '✨ Buscando en el inventario qué artículo es…', en: '✨ Looking through the inventory for this item…' },
  damageSuggestSeen:{ es: 'La foto parece: {seen}', en: 'The photo looks like: {seen}' },
  damageSuggestPick:{ es: '¿Es alguno de estos? Toca para vincularlo:', en: 'Is it one of these? Tap to link it:' },
  damageSuggestNone:{ es: 'Ninguno de estos', en: 'None of these' },
  damageSuggestEmpty:{ es: 'No encontramos ese artículo en el inventario. Búscalo arriba o envía el reporte sin artículo.', en: 'We did not find that item in the inventory. Search for it above or send the report without an item.' },
  damageSuggestFail:{ es: 'No se pudo sugerir un artículo ahora. Búscalo arriba.', en: 'Could not suggest an item right now. Search for it above.' },
  damageSuggestLinked:{ es: '✓ Vinculado a: {name}', en: '✓ Linked to: {name}' },
  conf_high:        { es: 'muy probable', en: 'very likely' },
  conf_medium:      { es: 'probable', en: 'likely' },
  conf_low:         { es: 'posible', en: 'possible' },
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
  photosShow:       { es: '📷 Fotos de ejemplo ({n})', en: '📷 Example photos ({n})' },
  photosHide:       { es: 'Ocultar fotos', en: 'Hide photos' },
  photoAdd:         { es: '📷 Agregar foto', en: '📷 Add photo' },
  photoTakeCamera:  { es: '📷 Tomar foto', en: '📷 Take photo' },
  photoFromGallery: { es: '🖼️ Elegir de la galería', en: '🖼️ Choose from gallery' },
  photoPrimaryAlt:  { es: 'Foto de ejemplo: {name}', en: 'Example photo: {name}' },
  photoPrimaryOpen: { es: 'Ver en grande la foto de ejemplo: {name}', en: 'View the example photo full size: {name}' },
  photoQuick:       { es: '📷 Foto', en: '📷 Photo' },
  photoQuickAria:   { es: 'Agregar foto de ejemplo: {name}', en: 'Add example photo: {name}' },
  photoQuickSaved:  { es: 'Foto de ejemplo guardada.', en: 'Example photo saved.' },
  formPhotosHelp:   { es: 'Muestran al servicio de limpieza cómo se ve el artículo.', en: 'They show the cleaning service what the item looks like.' },
  photoAdding:      { es: 'Guardando foto…', en: 'Saving photo…' },
  photoAlt:         { es: 'Foto de ejemplo del artículo', en: 'Example photo of the item' },
  photoRemove:      { es: 'Eliminar foto', en: 'Delete photo' },
  photoRemoveConfirm: { es: '¿Eliminar esta foto?', en: 'Delete this photo?' },
  photoMax:         { es: 'Máximo {n} fotos por artículo.', en: 'At most {n} photos per item.' },
  photoHas:         { es: 'Tiene fotos', en: 'Has photos' },
  formPhotos:       { es: 'Fotos de ejemplo (hasta {n})', en: 'Example photos (up to {n})' },
  photosShowRef:    { es: '📷 Fotos de ejemplo ({n})', en: '📷 Example photos ({n})' },

  // The checkout video (required).
  videoTitle:       { es: '🎥 Video del apartamento (obligatorio)', en: '🎥 Video of the apartment (required)' },
  videoHelp:        { es: 'Después de limpiar, graba un recorrido por todo el apartamento: cada habitación, baños, cocina y balcones. Este video es la evidencia ante Airbnb si un huésped causa daños: camina despacio, con buena luz, y muestra muebles, paredes, pisos, puertas y electrodomésticos. Máximo {n} minutos.', en: 'After cleaning, record a walk through the whole apartment: every room, bathroom, kitchen and balcony. This video is the evidence for Airbnb if a guest causes damage: walk slowly, with good light, and show furniture, walls, floors, doors and appliances. At most {n} minutes.' },
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
  taskVideo:        { es: 'Graba un video corto recorriendo todo el apartamento limpio (obligatorio). Es la evidencia ante Airbnb si un huésped causa daños.', en: 'Record a short video walking through the whole clean apartment (required). It is the evidence for Airbnb if a guest causes damage.' },
  taskVideoDone:    { es: '✓ Video subido', en: '✓ Video uploaded' },
  taskVideoPending: { es: '🎥 Falta el video', en: '🎥 Video still needed' },
  taskPhotoOptional:{ es: 'Si algo falta o está dañado, puedes tomarle una foto (opcional).', en: 'If something is missing or damaged, you can take a photo of it (optional).' },
  // People with their own link, notes for the next visit, damage replies, inbox (OwnerService.jsx)
  peopleTitle:      { es: '👤 Enlace personal para cada persona', en: '👤 A personal link for each person' },
  peopleHelp:       { es: 'Agrega a cada persona del servicio de limpieza y mándale su propio enlace: todo lo que haga queda con su nombre, y puedes desactivar a una sola persona sin cambiar el enlace de las demás.', en: 'Add each person of the cleaning service and send them their own link: everything they do carries their name, and you can switch one person off without changing anyone else’s link.' },
  personName:       { es: 'Nombre', en: 'Name' },
  personPhone:      { es: 'WhatsApp (opcional)', en: 'WhatsApp (optional)' },
  personAdd:        { es: '＋ Agregar persona', en: '＋ Add a person' },
  personWhatsapp:   { es: '💬 Enviar por WhatsApp', en: '💬 Send by WhatsApp' },
  personDisable:    { es: 'Desactivar', en: 'Switch off' },
  personEnable:     { es: 'Activar', en: 'Switch on' },
  personNewLink:    { es: 'Nuevo enlace', en: 'New link' },
  personOff:        { es: 'Desactivado: su enlace no funciona', en: 'Switched off: their link doesn’t work' },
  personSeen:       { es: 'Último uso: {when}', en: 'Last used: {when}' },
  personNeverSeen:  { es: 'Aún no ha abierto su enlace', en: 'Hasn’t opened their link yet' },
  personOffConfirm: { es: '¿Desactivar el enlace de {name}? Dejará de funcionar hasta que lo actives de nuevo.', en: 'Switch off {name}’s link? It stops working until you switch it on again.' },
  personNewLinkConfirm:{ es: '¿Darle a {name} un enlace nuevo? El anterior deja de funcionar; tendrás que enviarle el nuevo.', en: 'Give {name} a new link? The old one stops working; you’ll need to send them the new one.' },
  personShareText:  { es: 'Hola {name}, este es tu enlace para el inventario del {apt}. Ábrelo cada vez que termines la limpieza después de una salida de Airbnb: {url}', en: 'Hi {name}, this is your link for the inventory of {apt}. Open it each time you finish cleaning after an Airbnb checkout: {url}' },
  personSaved:      { es: 'Guardado.', en: 'Saved.' },
  peopleNeedsUpdate:{ es: 'Para los enlaces personales y las notas, ejecuta supabase/unit_inventory.sql en el editor SQL de Supabase.', en: 'For personal links and notes, run supabase/unit_inventory.sql in the Supabase SQL Editor.' },
  linkGeneralTitle: { es: 'Enlace general (escriben su nombre)', en: 'General link (they type their name)' },
  sharedHello:      { es: '👋 Hola, {name}', en: '👋 Hi, {name}' },
  sharedHelloHint:  { es: 'Este es tu enlace personal: lo que hagas queda con tu nombre.', en: 'This is your personal link: what you do carries your name.' },
  tasksTitle:       { es: '📝 Notas para la próxima visita', en: '📝 Notes for the next visit' },
  tasksHelp:        { es: 'Lo que quieres que el servicio de limpieza haga o revise en su próxima visita. Aparece arriba en su página; lo marcan como hecho y te enteras aquí.', en: 'What you want the cleaning service to do or check on their next visit. It shows at the top of their page; they tick it off and you see it here.' },
  tasksDoneTitle:   { es: '✓ Hechas ({n})', en: '✓ Done ({n})' },
  tasksOpenTitle:   { es: 'Por hacer ({n})', en: 'To do ({n})' },
  taskNew:          { es: 'Nueva nota', en: 'New note' },
  taskNewPh:        { es: 'Ej.: Cambié las pilas del control Niños, verifica que funcione', en: 'E.g. I changed the batteries in the Niños remote, check it works' },
  taskAdd:          { es: '＋ Agregar nota', en: '＋ Add note' },
  taskAdded:        { es: 'Nota agregada: la verán en su próxima visita.', en: 'Note added: they’ll see it on their next visit.' },
  taskDelete:       { es: 'Quitar', en: 'Remove' },
  taskDeleteAria:   { es: 'Quitar nota: {text}', en: 'Remove note: {text}' },
  taskArchive:      { es: '✓ Visto', en: '✓ Seen' },
  taskReopen:       { es: 'Volver a pedir', en: 'Ask again' },
  taskDoneBy:       { es: 'Hecho por {who} · {when}', en: 'Done by {who} · {when}' },
  ownerNotesTitle:  { es: '📝 Del propietario', en: '📝 From the owner' },
  ownerNotesHelp:   { es: 'El propietario pidió {n} cosa(s) para esta visita. Márcalas cuando las hagas.', en: 'The owner asked for {n} thing(s) this visit. Tick them off when done.' },
  ownerNotesAllDone:{ es: '✓ Todo lo que pidió el propietario está hecho.', en: '✓ Everything the owner asked for is done.' },
  taskDone:         { es: '✓ Hecho', en: '✓ Done' },
  taskDoneWithNote: { es: '✓ Hecho, con nota', en: '✓ Done, with a note' },
  taskNotePh:       { es: 'Ej.: Listo, ya funciona', en: 'E.g. Done, it works now' },
  taskUndo:         { es: 'Deshacer', en: 'Undo' },
  damageNewsTitle:  { es: 'Daños que el propietario ya resolvió', en: 'Damage the owner has dealt with' },
  resRepaired:      { es: '🔧 Reparado', en: '🔧 Repaired' },
  resReplaced:      { es: '🆕 Reemplazado', en: '🆕 Replaced' },
  resOther:         { es: 'Otro', en: 'Other' },
  resResolved:      { es: 'Resuelto', en: 'Resolved' },
  resHow:           { es: '¿Cómo se resolvió? (opcional)', en: 'How was it solved? (optional)' },
  resRestore:       { es: 'Ya está repuesto: “{name}” vuelve de {a} a {b}', en: 'It’s back: “{name}” goes from {a} to {b}' },
  resReply:         { es: 'Respuesta al servicio de limpieza (opcional)', en: 'Reply to the cleaning service (optional)' },
  resReplyPh:       { es: 'Ej.: Gracias, compré otro', en: 'E.g. Thanks, I bought a new one' },
  resSave:          { es: '✓ Marcar resuelto', en: '✓ Mark resolved' },
  damageAlready:    { es: '⚠️ Ya reportado', en: '⚠️ Already reported' },
  damageAlreadyAria:{ es: 'Ya tiene un daño reportado y pendiente', en: 'Already has damage reported, pending' },
  damageAlreadyForm:{ es: 'Este artículo ya tiene un daño reportado ({when}): “{desc}”. Envía otro reporte solo si es algo nuevo.', en: 'This item already has damage reported ({when}): “{desc}”. Only send another report if it’s something new.' },
  inboxTitle:       { es: '📥 Pendientes ({n})', en: '📥 Waiting for you ({n})' },
  inboxClear:       { es: '✓ Nada pendiente.', en: '✓ Nothing waiting.' },
  inboxProposals:   { es: 'Artículos propuestos por aprobar', en: 'Proposed items to approve' },
  inboxDamages:     { es: 'Daños abiertos', en: 'Open damage reports' },
  inboxTasksDone:   { es: 'Notas hechas por revisar', en: 'Done notes to look at' },
  inboxFnFailed:    { es: 'Pruebas que fallaron en el último conteo', en: 'Checks that failed at the last count' },
  inboxMissing:     { es: 'Artículos con faltantes', en: 'Items with something missing' },
  inboxTasksOpen:   { es: 'Notas que aún no hacen', en: 'Notes not done yet' },
  areaAllGood:      { es: '✓ Todo bien en esta área', en: '✓ All good in this area' },
  areaAllGoodAria:  { es: 'Todo bien en {area}: lo esperado está y pasar a la siguiente', en: 'All good in {area}: everything expected is there, go to the next' },
  areaReviewed:     { es: '✓ Revisada', en: '✓ Checked' },
  areaReviewedUndo: { es: 'Volver a revisar', en: 'Check again' },
  areasProgress:    { es: 'Áreas revisadas: {done} de {n}', en: 'Areas checked: {done} of {n}' },
  areasContinue:    { es: '▶ Seguir con: {area}', en: '▶ Continue with: {area}' },
  areasAllDone:     { es: '✓ Revisaste todas las áreas.', en: '✓ You checked every area.' },
  // Working checks (FunctionChecks.jsx)
  checkFnOk:        { es: '🔌 {n} pruebas OK', en: '🔌 {n} checks OK' },
  checkFnFailed:    { es: '🔌 {n} no funciona(n)', en: '🔌 {n} not working' },
  fnTitle:          { es: '🔌 Revisa que funcione', en: '🔌 Check that it works' },
  fnHelp:           { es: 'Prueba cada uno y marca si funciona. Si algo no funciona, toca “✗ No funciona” y envía el reporte de daño.', en: 'Test each one and mark whether it works. If something doesn’t work, tap “✗ Doesn’t work” and send the damage report.' },
  fnProgress:       { es: '{done} de {n} revisados', en: '{done} of {n} checked' },
  fnFailedCount:    { es: '{n} no funciona(n)', en: '{n} not working' },
  fnBatteries:      { es: '🔋 Cambié las pilas y funciona', en: '🔋 Changed the batteries, it works' },
  fnBatteriesShort: { es: '🔋 pilas cambiadas', en: '🔋 batteries changed' },
  fnBatteriesHelp:  { es: 'Si un control o la cerradura no responde, cambia las pilas primero: si así funciona, toca “🔋 Cambié las pilas y funciona” para que el propietario compre más.', en: 'If a remote or the lock doesn’t respond, change the batteries first: if it then works, tap “🔋 Changed the batteries, it works” so the owner buys more.' },
  fnUsesBatteries:  { es: '🔋 Usa pilas (control, cerradura…): el servicio puede marcar “Cambié las pilas y funciona”', en: '🔋 Runs on batteries (remote, lock…): the service can mark “Changed the batteries, it works”' },
  fnUsesBatteriesShort:{ es: '🔋 Usa pilas', en: '🔋 Runs on batteries' },
  fnSuggestReplace: { es: '✨ Reemplazar por la lista sugerida', en: '✨ Replace with the suggested list' },
  fnSuggestReplaceConfirm:{ es: '¿Cambiar las {n} pruebas por la lista sugerida? Nada se guarda hasta que toques Guardar.', en: 'Replace the {n} checks with the suggested list? Nothing is saved until you tap Save.' },
  checkFnBatteries: { es: '🔋 {n} cambio(s) de pilas', en: '🔋 {n} battery change(s)' },
  inboxBatteries:   { es: 'Pilas cambiadas en el último conteo (compra repuestos)', en: 'Batteries changed at the last count (buy more)' },
  fnPhotosTitle:    { es: '📷 Fotos de ejemplo (el servicio de limpieza las ve junto a la prueba)', en: '📷 Example photos (the cleaning service sees them beside the check)' },
  fnPhotosSaveFirst:{ es: 'Guarda la prueba para agregarle fotos.', en: 'Save the check to add photos to it.' },
  fnPhotosCount:    { es: '📷 {n} foto(s) de ejemplo', en: '📷 {n} example photo(s)' },
  fnPhotosShow:     { es: '📷 Ver las {n} fotos', en: '📷 See the {n} photos' },
  fnProofHint:      { es: 'Útil si no funciona o algo se ve mal.', en: 'Useful if it doesn’t work or something looks wrong.' },
  fnWorks:          { es: '✓ Funciona', en: '✓ Works' },
  fnBroken:         { es: '✗ No funciona', en: '✗ Doesn’t work' },
  fnBrokenShort:    { es: 'no funciona', en: 'doesn’t work' },
  fnItem:           { es: 'Artículo: {name}', en: 'Item: {name}' },
  fnMissing:        { es: 'Falta revisar {n} prueba(s) de funcionamiento: marca si funcionan antes de terminar.', en: '{n} working check(s) still to answer: mark whether they work before finishing.' },
  fnFailDesc:       { es: 'No funciona: {label}. ', en: 'Doesn’t work: {label}. ' },
  taskFunctions:    { es: 'Prueba que los aparatos funcionen ({n} pruebas, obligatorio): estufa, TV y aires con su control, cortinas, lavadora…', en: 'Test that the appliances work ({n} tests, required): stove, TVs and A/Cs with their remotes, curtains, washer…' },
  finishFunctions:  { es: 'Probaste las {n} pruebas de funcionamiento.', en: 'You did the {n} working checks.' },
  fnReportTitle:    { es: '🔌 Pruebas de funcionamiento: {ok} de {n} funcionan', en: '🔌 Working checks: {ok} of {n} work' },
  fnOpen:           { es: '🔌 Pruebas de funcionamiento ({n})', en: '🔌 Working checks ({n})' },
  fnEditTitle:      { es: '🔌 Pruebas de funcionamiento', en: '🔌 Working checks' },
  fnEditHelp:       { es: 'Lo que el servicio de limpieza debe probar en cada visita (cada puesto de la estufa, cada TV y aire con su control, las cortinas…). Debe marcar cada una “Funciona” o “No funciona” antes de terminar el conteo; lo que no funciona te llega como daño. Vincula una prueba a un artículo para que vea su foto.', en: 'What the cleaning service must test at every visit (each burner of the stove, each TV and A/C with its remote, the curtains…). They must mark each one “Works” or “Doesn’t work” before finishing the count; anything that doesn’t work reaches you as damage. Link a check to an item so they see its photo.' },
  fnEditEmpty:      { es: 'Aún no hay pruebas. Toca “✨ Agregar las sugeridas” para empezar con una lista hecha a partir de tu inventario.', en: 'No checks yet. Tap “✨ Add the suggested ones” to start from a list made from your inventory.' },
  fnUnnamed:        { es: '(sin nombre)', en: '(no name)' },
  fn_labelEs:       { es: 'Qué probar (español)', en: 'What to test (Spanish)' },
  fn_labelEn:       { es: 'Qué probar (inglés)', en: 'What to test (English)' },
  fn_howEs:         { es: 'Cómo probarlo (español, opcional)', en: 'How to test it (Spanish, optional)' },
  fn_howEn:         { es: 'Cómo probarlo (inglés, opcional)', en: 'How to test it (English, optional)' },
  fnLabelPh:        { es: 'Ej.: Estufa: los 4 puestos prenden', en: 'E.g. Stove: all 4 burners light' },
  fnHowPh:          { es: 'Ej.: Prende cada puesto uno por uno', en: 'E.g. Light each burner one at a time' },
  fnItemPick:       { es: 'Artículo del inventario (opcional)', en: 'Inventory item (optional)' },
  fnItemNone:       { es: '— Ninguno —', en: '— None —' },
  fnUp:             { es: 'Subir', en: 'Move up' },
  fnDown:           { es: 'Bajar', en: 'Move down' },
  fnRemove:         { es: 'Quitar: {name}', en: 'Remove: {name}' },
  fnAdd:            { es: '＋ Agregar prueba', en: '＋ Add a check' },
  fnSuggest:        { es: '✨ Agregar las sugeridas', en: '✨ Add the suggested ones' },
  fnSave:           { es: 'Guardar ({n} pruebas)', en: 'Save ({n} checks)' },
  fnUndo:           { es: 'Deshacer cambios', en: 'Undo changes' },
  fnNeedName:       { es: 'La prueba {n} necesita un nombre.', en: 'Check {n} needs a name.' },
  fnSaved:          { es: 'Pruebas de funcionamiento guardadas.', en: 'Working checks saved.' },
  fnNeedsUpdate:    { es: 'Para usar las pruebas de funcionamiento, ejecuta supabase/unit_inventory.sql en el editor SQL de Supabase.', en: 'To use working checks, run supabase/unit_inventory.sql in the Supabase SQL Editor.' },
  finishMissingTitle:{ es: 'Antes de terminar falta:', en: 'Still needed before finishing:' },
  videoAlertTitle:  { es: '🎥 El video es obligatorio', en: '🎥 The video is required' },
  videoAlertBody:   { es: 'Para terminar el inventario debes grabar un video corto del apartamento ya limpio. Sin video no se puede terminar. Hazlo al final, después de limpiar.', en: 'To finish the inventory you must record a short video of the clean apartment. Without it the inventory can’t be finished. Do it at the end, after cleaning.' },
  videoAlertGo:     { es: '🎥 Ir a grabar el video', en: '🎥 Go to record the video' },
  videoMissingShort:{ es: '🎥 El video del apartamento (obligatorio)', en: '🎥 The video of the apartment (required)' },
  fnMissingShort:   { es: '🔌 {n} prueba(s) de funcionamiento sin responder', en: '🔌 {n} working check(s) not answered' },
  fnMissingGo:      { es: '🔌 Ir a las pruebas', en: '🔌 Go to the checks' },
  histTitle:        { es: '📜 Historial del inventario', en: '📜 Inventory history' },
  histHelpShared:   { es: 'Todo lo que se ha hecho en este apartamento: cada inventario completado (con daños, fotos, pruebas y video) y cada cambio a los artículos.', en: 'Everything done in this apartment: every completed inventory (with damage, photos, checks and video) and every change to the items.' },
  histOpen:         { es: '📜 Ver el historial', en: '📜 See the history' },
  histTabReports:   { es: 'Inventarios completados', en: 'Completed inventories' },
  histTabChanges:   { es: 'Todos los cambios', en: 'All changes' },
  finishVideo:      { es: 'El video del apartamento está subido.', en: 'The video of the apartment is uploaded.' },
  reportVideo:      { es: '🎥 Video del apartamento', en: '🎥 Video of the apartment' },
  reportVideoWatch: { es: '▶ Ver video', en: '▶ Watch video' },
  reportVideoNone:  { es: 'Este inventario no tiene video.', en: 'This inventory has no video.' },
  videoStorageOver: { es: '⚠️ El espacio de videos pasó el límite: todo lo que queda es de los últimos 30 días o está guardado como evidencia. Quita “Guardar como evidencia” de los que ya no necesites, o aumenta el límite (INVENTORY_VIDEO_STORAGE_MB) con un plan de Supabase más grande.', en: '⚠️ Video storage is over the limit: everything left is from the last 30 days or kept as evidence. Release videos you no longer need, or raise the limit (INVENTORY_VIDEO_STORAGE_MB) with a larger Supabase plan.' },
  videoRecordedAt:  { es: 'Grabado: {when}', en: 'Recorded: {when}' },
  videoDownload:    { es: '⬇ Descargar video', en: '⬇ Download video' },
  videoShare:       { es: '📤 Compartir (WhatsApp…)', en: '📤 Share (WhatsApp…)' },
  videoSharePreparing: { es: 'Preparando video…', en: 'Preparing video…' },
  videoShareSend:   { es: '📤 Enviar video', en: '📤 Send video' },
  videoShareText:   { es: 'Video del inventario · {unit} · grabado {when} · {who}', en: 'Inventory video · {unit} · recorded {when} · {who}' },
  videoShareLinkNote: { es: '(El enlace funciona durante {n} días.)', en: '(The link works for {n} days.)' },
  videoKeep:        { es: '📌 Guardar como evidencia', en: '📌 Keep as evidence' },
  videoRelease:     { es: 'Quitar de evidencia', en: 'Release' },
  videoKeptNote:    { es: '📌 Guardado como evidencia ({who}): no se borrará hasta que lo quites.', en: '📌 Kept as evidence ({who}): it won’t be deleted until you release it.' },
  videoEvidenceHelp:{ es: 'Para un reclamo de daños en Airbnb (dentro de los 14 días después de la salida del huésped): descarga el video (o compártelo) y adjúntalo en el Centro de resoluciones. Mientras el reclamo esté abierto, guárdalo como evidencia.', en: 'For an Airbnb damage claim (within 14 days of the guest’s checkout): download the video (or share it) and attach it in the Resolution Center. While the claim is open, keep it as evidence.' },
  reportVideoGone:  { es: 'El video ya no se conserva: cuando se llena el espacio de videos, los más antiguos (de más de 30 días y no guardados como evidencia) se borran solos.', en: 'The video is no longer kept: when video storage fills up, the oldest (over 30 days old and not kept as evidence) are deleted automatically.' },
  videoStorageUse:  { es: '🎥 Espacio de videos: {used} MB de {limit} MB ({pct}%). Cuando se llena, se borran los más antiguos — nunca los de los últimos {days} días ni los guardados como evidencia.', en: '🎥 Video storage: {used} MB of {limit} MB ({pct}%). When it fills up, the oldest are deleted — never those from the last {days} days or those kept as evidence.' },
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
  (check.functionResults || []).length
    ? (check.functionsFailed ? tr(lang, 'checkFnFailed', { n: check.functionsFailed }) : tr(lang, 'checkFnOk', { n: check.functionResults.length }))
    : '',
  (check.functionResults || []).some(f => f.batteries)
    ? tr(lang, 'checkFnBatteries', { n: check.functionResults.filter(f => f.batteries).length }) : '',
].filter(Boolean).join(' · ');

export const API_BASE = '/api/m/unit-inventory';
