// Help for the cleaning service on its inventory page, which they use
// each time they finish cleaning after an Airbnb checkout: a short welcome
// shown on the first visit, and a step-by-step guide behind the "❓"
// button in the page header. Written for someone using the page for the
// first time on a phone, in plain words, naming the buttons as they
// appear on the page.
//
// The guide's text lives here rather than in strings.js: it is one long
// piece in each language, not labels shared between screens. Steps that
// depend on the unit (★ items, the checkout video) only appear when they
// apply.

import React, { useEffect, useRef } from "react";
import { tr } from "../strings";

const english = (lang) => String(lang || '').toLowerCase().startsWith('en');

// Each section: { icon, title, points: [string] }. `opts` says which
// parts apply to this unit.
const guide = (lang, { required, videoRequired, proofEnabled }) => {
  const en = english(lang);
  const pick = (es, enText) => (en ? enText : es);
  const sections = [
    {
      icon: '🕒',
      title: pick('Cuándo usarlo', 'When to use it'),
      points: [
        pick('Cada vez que salen los huéspedes de Airbnb, cuando ya terminaste de limpiar el apartamento. No antes ni a mitad de la limpieza: el conteo y el video deben mostrar el apartamento listo para el siguiente huésped.',
          'Each time Airbnb guests check out, once you have finished cleaning the apartment. Not before or halfway through: the count and the video should show the apartment ready for the next guest.'),
        pick('Si mientras limpias encuentras algo roto o que falta, recuérdalo (o tómale una foto) y repórtalo aquí al terminar.',
          'If you find something broken or missing while cleaning, remember it (or take a photo) and report it here when you finish.'),
      ],
    },
    {
      icon: '👤',
      title: pick('Antes de empezar', 'Before you start'),
      points: [
        pick('Escribe tu nombre en “Tu nombre”. Queda guardado con tus cambios para que el propietario sepa quién revisó.',
          'Type your name under “Your name”. It is saved with your changes so the owner knows who checked.'),
        pick('No necesitas cuenta ni contraseña: este enlace es solo para este apartamento.',
          'You don’t need an account or password: this link is only for this apartment.'),
      ],
    },
    {
      icon: '🔢',
      title: pick('1. Cuenta los artículos', '1. Count the items'),
      points: [
        required > 0
          ? pick(`Los ${required} artículos marcados ★ se cuentan en cada salida. Los demás están en la lista para que el propietario sepa todo lo que hay: no hace falta contarlos uno por uno (toca “Todos” para verlos).`,
            `The ${required} items marked ★ are counted at every checkout. The others are on the list so the owner knows everything in the apartment: they don’t need counting one by one (tap “All” to see them).`)
          : pick('Revisa todos los artículos de la lista.', 'Check every item on the list.'),
        ...(required > 0 ? [pick('⚠️ Importante: aunque un artículo no tenga ★, si notas que falta o está dañado, repórtalo igual. Búscalo con el buscador, corrige el número y deja una nota, o toca “⚠️ Daño” en el artículo.',
          '⚠️ Important: even if an item has no ★, if you notice it is missing or damaged, report it anyway. Find it with the search box, correct the number and leave a note, or tap “⚠️ Damage” on the item.')] : []),
        pick('Toca el nombre de un área (Cocina, Baño…) para abrirla o cerrarla. Usa el buscador para encontrar un artículo rápido.',
          'Tap an area’s name (Kitchen, Bathroom…) to open or close it. Use the search box to find an item quickly.'),
        pick('“Esperado” es lo que debería haber. Usa − y + o escribe el número que encontraste.',
          '“Expected” is what should be there. Use − and + or type the number you found.'),
        pick('Si el número no coincide, el artículo se pinta: rojo ▼ si falta, azul ▲ si sobra.',
          'If the number doesn’t match, the item changes colour: red ▼ if something is missing, blue ▲ if there is extra.'),
      ],
    },
    {
      icon: '📝',
      title: pick('Si algo falta o está dañado (con o sin ★)', 'If something is missing or damaged (with or without ★)'),
      points: [
        pick('Pon el número real. Si un artículo ya no está, pon 0.',
          'Enter the real number. If an item is gone, set it to 0.'),
        pick('No puedes cambiar la descripción de un artículo ni borrarlo: eso solo lo hace el propietario. Si la descripción no es correcta, escríbelo en una nota.',
          'You can’t change an item’s description or remove it: only the owner can. If the description is wrong, say so in a note.'),
        pick('Toca “＋ Nota” en el artículo para explicar qué pasó (roto, manchado, se lo llevaron…).',
          'Tap “＋ Note” on the item to explain what happened (broken, stained, taken…).'),
        ...(proofEnabled ? [pick('Puedes tomarle una foto con “📷 Foto (opcional)”. No es obligatorio, pero ayuda mucho cuando algo falta o está dañado.',
          'You can take a photo with “📷 Photo (optional)”. It isn’t required, but it helps a lot when something is missing or damaged.')] : []),
      ],
    },
    {
      icon: '⚠️',
      title: pick('2. Reporta daños', '2. Report damage'),
      points: [
        pick('Para un artículo: toca “⚠️ Daño”, arriba a la derecha del artículo.',
          'For an item: tap “⚠️ Damage” at the top right of the item.'),
        pick('Para algo que no está en la lista (pared, puerta, piso, mueble…): toca “⚠️ Reportar un daño” más abajo en la página.',
          'For something that isn’t on the list (wall, door, floor, furniture…): tap “⚠️ Report damage” further down the page.'),
        pick('Describe el daño, di dónde está y toma una o más fotos.',
          'Describe the damage, say where it is and take one or more photos.'),
      ],
    },
    {
      icon: '＋',
      title: pick('¿Encontraste algo que no está en la lista?', 'Found something that isn’t on the list?'),
      points: [
        pick('Toca “＋ Agregar un artículo que no está en la lista” y descríbelo. No se agrega de una vez: queda pendiente hasta que el propietario lo apruebe.',
          'Tap “＋ Add an item that is not on the list” and describe it. It isn’t added right away: it waits until the owner approves it.'),
      ],
    },
    {
      icon: '💾',
      title: pick('Guardar', 'Saving'),
      points: [
        pick('Cuando cambias algo aparece abajo el botón “Guardar”. Guarda cada tanto.',
          'When you change something, a “Save” button appears at the bottom. Save every so often.'),
        pick('Si se cae la señal o se cierra la página, tus cambios quedan en el teléfono: abre el mismo enlace y los recuperas.',
          'If the signal drops or the page closes, your changes stay on the phone: open the same link and they come back.'),
      ],
    },
  ];
  if (videoRequired) {
    sections.push({
      icon: '🎥',
      title: pick('3. Graba el video (obligatorio)', '3. Record the video (required)'),
      points: [
        pick('Con el apartamento ya limpio, toca “🎥 Grabar video” y luego “● Empezar a grabar”.',
          'With the apartment clean, tap “🎥 Record video” and then “● Start recording”.'),
        pick('Camina despacio por todo el apartamento: cada habitación, baños, cocina y balcones. Máximo 3 minutos.',
          'Walk slowly through the whole apartment: every bedroom, bathroom, kitchen and balcony. At most 3 minutes.'),
        pick('Toca “■ Detener”, míralo y toca “✓ Enviar este video”. Si puedes, usa Wi-Fi: sube más rápido.',
          'Tap “■ Stop”, watch it and tap “✓ Send this video”. Use Wi-Fi if you can: it uploads faster.'),
      ],
    });
  }
  sections.push(
    {
      icon: '✅',
      title: videoRequired ? pick('4. Termina', '4. Finish') : pick('3. Termina', '3. Finish'),
      points: [
        pick('Al final de la página toca “✓ Conteo completo” (o “Guardar … y completar” si tienes cambios sin guardar).',
          'At the bottom of the page tap “✓ Count complete” (or “Save … and complete” if you have unsaved changes).'),
        pick('Te preguntará si hay daños para reportar. Responde y listo: el propietario recibe el reporte con fecha y hora.',
          'It asks whether there is damage to report. Answer and you’re done: the owner gets the report with the date and time.'),
        pick('Hazlo aunque nada haya cambiado: así queda registrado quién revisó y cuándo.',
          'Do it even if nothing changed: it records who checked and when.'),
      ],
    },
    {
      icon: '🛟',
      title: pick('Si algo no funciona', 'If something doesn’t work'),
      points: [
        pick('La cámara no abre: permite el acceso a la cámara cuando el teléfono lo pida, o usa “🎥 Grabar con la cámara del teléfono”.',
          'The camera won’t open: allow camera access when the phone asks, or use “🎥 Record with the phone’s camera”.'),
        pick('El video no sube: conéctate a Wi-Fi e inténtalo de nuevo.',
          'The video won’t upload: connect to Wi-Fi and try again.'),
        pick('El enlace dice que no está activo: pídele uno nuevo al propietario.',
          'The link says it is not active: ask the owner for a new one.'),
      ],
    },
  );
  return sections;
};

// The welcome card, shown until the person closes it once on this phone.
export function CleanerIntro({ lang, videoRequired, onDismiss, onHelp }) {
  const T = (k, v) => tr(lang, k, v);
  return (
    <div className="uinv-box uinv-intro" role="region" aria-label={T('introTitle')}>
      <h2>{T('introTitle')}</h2>
      <p>{T('introBody')}</p>
      <p>{T(videoRequired ? 'introStepsVideo' : 'introSteps')}</p>
      <div className="uinv-row">
        <button type="button" className="uinv-btn uinv-btn-p" onClick={onDismiss}>{T('introOk')}</button>
        <button type="button" className="uinv-btn" onClick={onHelp}>{T('introHow')}</button>
      </div>
    </div>
  );
}

// The full guide, over the page. Closes with ✕, the button at the end,
// Escape, or a tap outside it.
export function CleanerHelp({ lang, required, videoRequired, proofEnabled, onClose }) {
  const T = (k, v) => tr(lang, k, v);
  const closeRef = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (before && before.focus) before.focus();
    };
  }, [onClose]);
  const sections = guide(lang, { required, videoRequired, proofEnabled });
  return (
    <div className="uinv-help-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="uinv-help-sheet" role="dialog" aria-modal="true" aria-labelledby="uinv-help-title">
        <div className="uinv-help-head">
          <h2 id="uinv-help-title">{T('helpTitle')}</h2>
          <button type="button" ref={closeRef} className="uinv-x" onClick={onClose} aria-label={T('close')}>✕</button>
        </div>
        <p className="uinv-help">{T('helpIntro')}</p>
        {sections.map(s => (
          <section key={s.title} className="uinv-help-sec">
            <h3><span aria-hidden="true">{s.icon}</span> {s.title}</h3>
            <ul>{s.points.map(p => <li key={p}>{p}</li>)}</ul>
          </section>
        ))}
        <button type="button" className="uinv-btn uinv-btn-p uinv-help-done" onClick={onClose}>{T('helpDone')}</button>
      </div>
    </div>
  );
}
