// New-incident form modal — primary "Report incident" UI.
//
// Lifted byte-identical from App.jsx in stage F11. Pulls `lang` via useApp();
// listings/user/presetApt/onSave/onClose/config stay as per-instance props.
//
// Features (preserved):
//   - Excludes the caller's own units from the picker (incidents are filed
//     against another unit).
//   - localStorage draft auto-save / restore (key: kai_incident_draft).
//   - "General community incident" toggle that bypasses unit selection.
//   - Category chip + bilingual quick-fill template chips.
//   - Up to 3 photos with client-side compression.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F11.

import React, { useState, useEffect, useMemo } from "react";
import Overlay from "../../../core/ui/Overlay";
import Tip from "../../../core/ui/Tip";
import UnitPicker from "../../../platform/units/components/UnitPicker";
import { compressImage, today } from "../../../core/utils";
import { appText, incidentTypeLabel, categoryLabel, localizedTooltips } from "../../../core/i18n/app-text";
import { useApp } from "../../../core/app-state";
import { INCIDENT_TYPES, GUEST_CATEGORIES } from "../constants";
import INCIDENT_TEMPLATES from "../i18n/templates.json";

export default function IncidentModal({ listings, user, presetApt, onSave, onClose, config = {} }) {
  const { lang } = useApp();
  // Exclude units the current user owns — incidents are filed against other units.
  // Check both ownerUid (camelCase from API) and userEmail (Google email) to cover
  // legacy listings that may have been created before owner_uid was reliably stored.
  const reportableListings = useMemo(() => {
    if (!user?.uid && !user?.email) return listings;
    return listings.filter(l => {
      const uid = l.ownerUid || l.owner_uid;
      if (uid && user.uid) return uid !== user.uid;
      // Fallback: match by Google account email for listings without a stored uid
      const gEmail = (l.userEmail || '').toLowerCase();
      return !gEmail || !user.email || gEmail !== user.email.toLowerCase();
    });
  }, [listings, user?.uid, user?.email]);
  const tips = localizedTooltips(config, lang);
  const isEn = lang === 'en';
  const DRAFT_KEY = 'kai_incident_draft';
  // Restore draft from localStorage if no preset apt; save draft on every change
  const [f, setF] = useState(() => {
    if (presetApt) return { aptId: presetApt, date: today(), type: "noise", category: "minor", desc: "" };
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (saved && typeof saved === 'object' && (saved.aptId || saved.desc))
        return { aptId: saved.aptId || '', date: saved.date || today(), type: saved.type || 'noise', category: saved.category || 'minor', desc: saved.desc || '' };
    } catch {}
    return { aptId: "", date: today(), type: "noise", category: "minor", desc: "" };
  });
  const [draftRestored] = useState(() => {
    if (presetApt) return false;
    try { const s = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return !!(s && typeof s === 'object' && (s.aptId || s.desc)); } catch { return false; }
  });
  const [errors, setErrors] = useState({});
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [isGeneral, setIsGeneral] = useState(false);
  // Auto-save draft on every field change (skip when preset apt is used)
  useEffect(() => {
    if (presetApt) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch {}
  }, [f]); // eslint-disable-line

  const handlePhotoAdd = async (files) => {
    const remaining = 3 - photos.length;
    if (remaining <= 0) { setPhotoError(isEn ? 'Maximum 3 photos allowed.' : 'Máximo 3 fotos permitidas.'); return; }
    const toProcess = Array.from(files).slice(0, remaining);
    setPhotoLoading(true); setPhotoError('');
    const results = []; const errs = [];
    await Promise.all(toProcess.map(async file => {
      try { results.push(await compressImage(file)); } catch (e) {
        const raw = e.message || '';
        let msg;
        if (raw.includes('too large') || raw.includes('10 MB') || raw.includes('10MB'))
          msg = isEn
            ? '⚠️ Photo too large — max 10 MB per image before compression. Please choose a smaller file.'
            : '⚠️ Foto demasiado grande — máx 10 MB por imagen antes de comprimir. Elige un archivo más pequeño.';
        else if (raw.includes('Only image') || raw.includes('image files'))
          msg = isEn
            ? '⚠️ Only image files are allowed (JPEG, PNG, WebP).'
            : '⚠️ Solo se permiten imágenes (JPEG, PNG, WebP).';
        else if (raw.includes('Could not read') || raw.includes('Could not decode'))
          msg = isEn
            ? '⚠️ Could not read this image file. Try a different format.'
            : '⚠️ No se pudo leer la imagen. Intenta con otro formato.';
        else
          msg = isEn ? `⚠️ Photo error: ${raw}` : `⚠️ Error en foto: ${raw}`;
        errs.push(msg);
      }
    }));
    if (errs.length) setPhotoError(errs.join(' '));
    if (results.length) setPhotos(p => [...p, ...results].slice(0, 3));
    setPhotoLoading(false);
  };
  const removePhoto = (i) => setPhotos(p => p.filter((_, idx) => idx !== i));
  const s = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };
  const validate = () => {
    const e = {};
    if (!f.aptId) e.aptId = appText(lang, "validation.apartment");
    if (!f.date) e.date = appText(lang, "validation.date");
    if (!f.type) e.type = appText(lang, "validation.type");
    if (!f.category) e.category = appText(lang, "validation.category");
    if (!String(f.desc || "").trim()) e.desc = appText(lang, "validation.description");
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const inputCls = (k) => errors[k] ? "field-error" : "";

  // Build template chips for the selected category — one per incident type
  const categoryChips = INCIDENT_TYPES.map(t => {
    const key = `${t.value}_${f.category}`;
    const tmpl = INCIDENT_TEMPLATES[key];
    if (!tmpl) return null;
    return { typeValue: t.value, typeLabel: incidentTypeLabel(t.value, lang), typeMeta: t, text: isEn ? tmpl.en : tmpl.es };
  }).filter(Boolean);

  const applyChip = (chip) => {
    setF(p => ({ ...p, type: chip.typeValue, desc: chip.text }));
    setErrors(e => ({ ...e, type: undefined, desc: undefined }));
  };

  // Placeholder: prefix with "(Example) " so it's unmistakably not real content
  const currentChip = categoryChips.find(c => c.typeValue === f.type);
  const _examplePrefix = isEn ? '(Example) ' : '(Ejemplo) ';
  const descPlaceholder = (!String(f.desc || '').trim() && currentChip)
    ? _examplePrefix + currentChip.text
    : appText(lang, "form.descriptionPlaceholder");

  return (
    <Overlay onClose={onClose} wide>
      <div className="modal-title">{appText(lang, "modal.report.title")}</div>
      <div className="inc-modal-meta">{appText(lang, "modal.report.sub", { name: user?.name || "" })} · <span className="inc-modal-hint">{appText(lang, "modal.report.help")}</span></div>

      {draftRestored && (
        <div className="draft-restored-banner">
          📋 <strong>{isEn ? 'Draft restored' : 'Borrador restaurado'}</strong> — {isEn ? 'Your last unsaved report has been loaded.' : 'Se cargó tu último reporte sin guardar.'}
          <button type="button" className="btn-ghost bsm" style={{marginLeft:8,fontSize:'.68rem'}}
            onClick={() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} setF({ aptId: presetApt || '', date: today(), type: 'noise', category: 'minor', desc: '' }); }}>
            {isEn ? 'Clear draft' : 'Limpiar'}
          </button>
        </div>
      )}

      {/* ── General incident toggle ── */}
      <div className="gen-toggle-wrap">
        <label className="gen-toggle-label">
          <input type="checkbox" checked={isGeneral} onChange={e => { setIsGeneral(e.target.checked); if (e.target.checked) s('aptId', ''); }}/>
          <span className="gen-toggle-box"/>
          <span>📢 {isEn ? 'This is a general community incident (not specific to one unit)' : 'Este es un incidente general de la comunidad (no específico de una unidad)'}</span>
        </label>
        {isGeneral && <div className="gen-toggle-hint">{isEn ? 'A global/delegate admin will review, assign to a unit, or close this incident.' : 'Un admin global/delegado revisará, asignará a una unidad, o cerrará este incidente.'}</div>}
      </div>

      <div className="fg2 inc-form-grid">
        {/* Row 1: Unit + Date */}
        {!isGeneral && <div className="fg"><label>{appText(lang, "form.apartment")} <Tip text={tips.incidentApartment}/></label>
          {!presetApt && <div className="upk-own-hint">
            <span>ⓘ</span>
            {isEn ? 'Incidents are filed against another unit. Your own units are excluded.' : 'Los incidentes se reportan contra otra unidad. Tus propias unidades no aparecen.'}
          </div>}
          <UnitPicker listings={reportableListings} value={f.aptId} onChange={v => s("aptId", v)} lang={lang} error={!!errors.aptId} disabled={!!presetApt}/>
          {errors.aptId && <span className="err-msg">{errors.aptId}</span>}
        </div>}
        <div className="fg"><label>{appText(lang, "form.date")}</label>
          <input className={inputCls("date")} type="date" value={f.date} onChange={e => s("date", e.target.value)}/>
          {errors.date && <span className="err-msg">{errors.date}</span>}
        </div>

        {/* Row 2: Category chips (full width, inline) */}
        <div className="fg full">
          <label>{appText(lang, "form.category")} <Tip text={tips.incidentCategory}/></label>
          <div className="inc-cat-row">
            {GUEST_CATEGORIES.map(c => (
              <button key={c.value} type="button"
                className={`inc-cat-btn${f.category === c.value ? ' inc-cat-btn-on' : ''}`}
                style={f.category === c.value ? { background: c.bg, color: c.color, borderColor: c.color } : {}}
                onClick={() => s("category", c.value)}>
                {c.icon} {categoryLabel(c.value, lang)}
              </button>
            ))}
          </div>
          {errors.category && <span className="err-msg">{errors.category}</span>}
        </div>

        {/* Row 3: Examples grid (compact 2-col, type name + tap to pre-fill) */}
        <div className="fg full">
          <label>💡 {isEn ? 'Quick-fill examples — tap a chip to pre-fill the type and description with sample text (you can edit it)' : 'Ejemplos rápidos — toca un chip para pre-completar tipo y descripción con texto de muestra (puedes editarlo)'}</label>
          <div className="inc-chips-grid">
            {categoryChips.map(chip => (
              <button key={chip.typeValue} type="button"
                className={`inc-chip-sm${f.type === chip.typeValue && String(f.desc || '').trim() === chip.text ? ' inc-chip-sm-on' : ''}`}
                title={chip.text}
                onClick={() => applyChip(chip)}>
                <span className="inc-chip-sm-lbl" style={{ color: chip.typeMeta.color }}>{chip.typeLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 4: Type selector (auto-set by chip, or manual) + Description */}
        <div className="fg"><label>{appText(lang, "form.type")} <Tip text={tips.incidentType}/></label>
          <select className={inputCls("type")} value={f.type} onChange={e => s("type", e.target.value)}>
            {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{incidentTypeLabel(t.value, lang)}</option>)}
          </select>
          {errors.type && <span className="err-msg">{errors.type}</span>}
        </div>
        <div className="fg full">
          <label>{appText(lang, "form.description")} <Tip text={tips.incidentDescription}/></label>
          <textarea className={inputCls("desc")} value={f.desc} onChange={e => s("desc", e.target.value)}
            placeholder={descPlaceholder} rows={3}/>
          {!String(f.desc || '').trim() && currentChip && (
            <span className="help-msg" style={{ fontStyle: 'italic', color: '#8a9fa5' }}>
              ✏️ {isEn ? 'The gray text above is an example — start typing to replace it, or tap a chip to pre-fill.' : 'El texto gris de arriba es un ejemplo — empieza a escribir para reemplazarlo, o toca un chip para pre-completar.'}
            </span>
          )}
          {errors.desc && <span className="err-msg">{errors.desc}</span>}
        </div>

        {/* Photo attachments — inside fg2 grid so layout stays consistent */}
        <div className="fg full">
          <label>📷 {isEn ? `Photos — up to 3 (JPEG/PNG/WebP, max 10 MB each before compression)` : `Fotos — hasta 3 (JPEG/PNG/WebP, máx 10 MB antes de comprimir)`}</label>
          <div className="inc-photo-upload-area">
            {photos.map((p, i) => (
              <div key={i} className="inc-photo-preview">
                <img src={p.data} alt={p.name} className="inc-photo-preview-img"/>
                <button type="button" className="inc-photo-remove" onClick={() => removePhoto(i)} title={isEn ? 'Remove' : 'Quitar'}>✕</button>
                <span className="inc-photo-size">{p.size > 1024 * 1024 ? `${(p.size / 1024 / 1024).toFixed(1)}MB` : `${Math.round(p.size / 1024)}KB`}</span>
              </div>
            ))}
            {photos.length < 3 && (
              <label className="inc-photo-add-btn" title={isEn ? 'Add photo' : 'Agregar foto'}>
                {photoLoading ? <span className="spinner-sm"/> : <>📷 {isEn ? 'Add' : 'Agregar'}</>}
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={photoLoading}
                  onChange={e => { handlePhotoAdd(e.target.files); e.target.value = ''; }}/>
              </label>
            )}
          </div>
          {photoError && <span className="err-msg">{photoError}</span>}
          <span className="help-msg">{isEn ? 'Photos are compressed automatically. Click a thumbnail to view full size.' : 'Las fotos se comprimen automáticamente. Clic en la miniatura para ver tamaño completo.'}</span>
        </div>
      </div>
      <div className="mact">
        <button className="btn-ghost" onClick={onClose}>{appText(lang, "form.cancel")}</button>
        <button className="btn-danger" title={tips.reportIncident} onClick={() => {
          // For general incidents, aptId is not required
          const valid = isGeneral
            ? (f.date && f.type && f.category && String(f.desc || '').trim())
            : validate();
          if (valid) { try { localStorage.removeItem(DRAFT_KEY); } catch {} onSave({ ...f, photos, isGeneral, aptId: isGeneral ? '' : f.aptId }); }
        }}>{appText(lang, "form.registerReport")}</button>
      </div>
    </Overlay>
  );
}
