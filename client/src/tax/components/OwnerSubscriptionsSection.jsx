import { useEffect, useMemo, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { taxApi } from '../api';

// Subscription editor used inside OwnerCustomerDetail. Renders a list of
// the customer's subscriptions, with per-row Edit (status + active schedule
// subset) and Cancel actions, plus an "Add subscription" form that hits
// POST /admin/customers/:id/subscriptions. Reminder offsets/channels stay
// at defaults — Phase 4c will surface those when there's owner demand to
// override them; the customer also self-serves channels via /portal/profile.
export default function OwnerSubscriptionsSection({ customer, subscriptions, auth, onChange, locale, t }) {
  const [products, setProducts] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!customer?.community_id) return;
    taxApi.adminListProducts(auth, customer.community_id)
      .then(d => setProducts(d.products || []))
      .catch(() => setProducts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.community_id]);

  // Index products by id for quick schedule lookups in the existing-row
  // editor. Note product id is `community:slug` (e.g.
  // 'tax-america-services:sales-tax').
  const productById = useMemo(() => {
    const m = new Map();
    for (const p of products || []) m.set(p.id, p);
    return m;
  }, [products]);

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{t('owner.customer.section.subscriptions')}</h3>
        <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                onClick={() => setAdding(a => !a)}>
          {adding ? t('owner.customer.subscription.cancelAdd') : t('owner.customer.subscription.addBtn')}
        </button>
      </div>

      {adding && (
        <AddSubscriptionForm
          customer={customer} products={products || []} auth={auth}
          existingProductIds={new Set((subscriptions || []).map(s => s.product_id))}
          onDone={() => { setAdding(false); onChange(); }}
          onCancel={() => setAdding(false)} locale={locale} t={t} />
      )}

      {(subscriptions || []).length === 0
        ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.customer.subscription.empty')}</p>
        : <div style={{ display: 'grid', gap: 8 }}>
            {subscriptions.map(s => (
              <SubscriptionRow key={s.id} sub={s} product={productById.get(s.product_id)}
                               auth={auth} onChange={onChange} locale={locale} t={t} />
            ))}
          </div>}
    </section>
  );
}

function statusColor(status) {
  if (status === 'paused') return { bg: '#fff7e6', fg: '#a65b00' };
  if (status === 'cancelled') return { bg: '#f3f3f3', fg: '#666' };
  return { bg: 'color-mix(in srgb, var(--tax-brand-primary) 10%, #fff)', fg: 'var(--tax-brand-primary)' };
}

function SubscriptionRow({ sub, product, auth, onChange, locale, t }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(sub.status || 'active');
  const [activeSlugs, setActiveSlugs] = useState(Array.isArray(sub.active_schedule_slugs) ? sub.active_schedule_slugs : []);
  // Phase 4d: reminder offsets + channels are now editable from the panel.
  // Offsets render as a CSV (-14, -7, -3) for easy reading and entry.
  const initialOffsets = Array.isArray(sub.reminder_offsets_days) && sub.reminder_offsets_days.length
    ? sub.reminder_offsets_days : [-14, -7, -3];
  const initialChannels = Array.isArray(sub.reminder_channels) && sub.reminder_channels.length
    ? sub.reminder_channels : ['email', 'in_app'];
  // Phase 4g: custom info checklist override. null on the row → using the
  // schedule's default; non-null array → override with these items.
  const [checklist, setChecklist] = useState(
    Array.isArray(sub.custom_info_checklist) ? sub.custom_info_checklist : null
  );
  const [offsetsCsv, setOffsetsCsv] = useState(initialOffsets.join(', '));
  const [chEmail, setChEmail] = useState(initialChannels.includes('email'));
  const [chInApp, setChInApp] = useState(initialChannels.includes('in_app'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const c = statusColor(sub.status);
  const productName = product
    ? (pickI18n(product.name_i18n, locale).value || product.slug || sub.product_id)
    : sub.product_id;
  const schedules = product?.schedules || [];

  const onSave = async () => {
    setBusy(true); setErr('');

    // Parse offsets CSV → integer array. Server re-validates the range.
    const offsetTokens = offsetsCsv.split(',').map(s => s.trim()).filter(Boolean);
    const offsets = offsetTokens.map(n => Number(n)).filter(Number.isFinite).map(n => Math.trunc(n));
    if (offsetTokens.length && offsets.length !== offsetTokens.length) {
      setErr(t('owner.customer.subscription.errOffsets')); setBusy(false); return;
    }
    if (!offsets.length) {
      setErr(t('owner.customer.subscription.errOffsetsEmpty')); setBusy(false); return;
    }
    const channels = [];
    if (chInApp) channels.push('in_app');
    if (chEmail) channels.push('email');
    if (!channels.length) {
      setErr(t('owner.customer.subscription.errChannels')); setBusy(false); return;
    }

    try {
      await taxApi.adminUpdateSubscription(auth, sub.id, {
        status,
        // Empty array tells the server to treat as "all schedules"
        // (active_schedule_slugs = NULL).
        activeScheduleSlugs: activeSlugs,
        reminderOffsetsDays: offsets,
        reminderChannels: channels,
        // Phase 4g: customInfoChecklist — null clears the override.
        customInfoChecklist: checklist,
      });
      setEditing(false);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  const onCancel = async () => {
    if (!window.confirm(t('owner.customer.subscription.confirmCancel', { name: productName }))) return;
    setBusy(true); setErr('');
    try {
      await taxApi.adminCancelSubscription(auth, sub.id);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  const toggleSlug = (slug) =>
    setActiveSlugs(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);

  return (
    <div className="tax-contact-item" style={{ opacity: sub.status === 'cancelled' ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {productName}
            <span style={{
              marginLeft: 8, padding: '1px 8px', borderRadius: 999,
              background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            }}>{sub.status}</span>
          </div>
          {Array.isArray(sub.active_schedule_slugs) && sub.active_schedule_slugs.length > 0 ? (
            <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 4 }}>
              {t('owner.customer.subscription.schedules')}: {sub.active_schedule_slugs.join(', ')}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 4 }}>
              {t('owner.customer.subscription.allSchedules')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!editing && sub.status !== 'cancelled' && (
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    onClick={() => setEditing(true)} style={{ color: 'var(--tax-text)' }}>
              {t('owner.customer.subscription.edit')}
            </button>
          )}
          {!editing && sub.status !== 'cancelled' && (
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    onClick={onCancel} disabled={busy}
                    style={{ color: 'var(--tax-error)', borderColor: 'var(--tax-error)' }}>
              {t('owner.customer.subscription.cancel')}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--tax-bg-alt)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                {t('owner.customer.subscription.status')}
              </label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                      style={{ padding: '8px 10px', border: '1px solid var(--tax-border)', borderRadius: 8 }}>
                <option value="active">{t('owner.customer.subscription.status.active')}</option>
                <option value="paused">{t('owner.customer.subscription.status.paused')}</option>
              </select>
            </div>

            {schedules.length > 0 && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  {t('owner.customer.subscription.activeSchedules')}
                </label>
                <p style={{ fontSize: 12, color: 'var(--tax-muted)', margin: '0 0 8px' }}>
                  {t('owner.customer.subscription.activeSchedulesHint')}
                </p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {schedules.map(sch => (
                    <label key={sch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                      <input type="checkbox" checked={activeSlugs.includes(sch.slug)}
                             onChange={() => toggleSlug(sch.slug)} />
                      <span>
                        {pickI18n(sch.name_i18n, locale).value || sch.slug}
                        <span style={{ color: 'var(--tax-muted)', fontSize: 12, marginLeft: 6 }}>
                          ({sch.jurisdiction}, {sch.cadence})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor={`sub-offsets-${sub.id}`} style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                {t('owner.customer.subscription.offsets')}
              </label>
              <p style={{ fontSize: 12, color: 'var(--tax-muted)', margin: '0 0 8px' }}>
                {t('owner.customer.subscription.offsetsHint')}
              </p>
              <input id={`sub-offsets-${sub.id}`} type="text" value={offsetsCsv}
                     onChange={e => setOffsetsCsv(e.target.value)}
                     placeholder="-14, -7, -3" maxLength={80}
                     style={{ padding: '8px 10px', border: '1px solid var(--tax-border)',
                              borderRadius: 8, font: 'inherit', fontSize: 14, maxWidth: 240 }} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                {t('owner.customer.subscription.channels')}
              </label>
              <p style={{ fontSize: 12, color: 'var(--tax-muted)', margin: '0 0 8px' }}>
                {t('owner.customer.subscription.channelsHint')}
              </p>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={chEmail} onChange={e => setChEmail(e.target.checked)} />
                  <span>{t('portal.profile.channel.email')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={chInApp} onChange={e => setChInApp(e.target.checked)} />
                  <span>{t('portal.profile.channel.inApp')}</span>
                </label>
              </div>
            </div>

            <ChecklistEditor
              value={checklist}
              onChange={setChecklist}
              schedules={schedules}
              activeSlugs={activeSlugs}
              locale={locale}
              t={t} />

            {err && <div className="tax-msg tax-msg--error">{err}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                      onClick={onSave} disabled={busy}>
                {busy ? t('lead.submitting') : t('owner.customer.subscription.save')}
              </button>
              <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                      onClick={() => setEditing(false)}
                      style={{ color: 'var(--tax-text)' }}>
                {t('owner.customer.subscription.cancelEdit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddSubscriptionForm({ customer, products, existingProductIds, auth, onDone, onCancel, locale, t }) {
  const available = products.filter(p => !existingProductIds.has(p.id));
  const [productId, setProductId] = useState('');
  const [scheduleSlugs, setScheduleSlugs] = useState([]); // empty array = "all"
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const selectedProduct = products.find(p => p.id === productId);
  const schedules = selectedProduct?.schedules || [];

  const toggleSlug = (slug) =>
    setScheduleSlugs(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!productId) { setErr(t('owner.customer.subscription.errProduct')); return; }
    setBusy(true); setErr('');
    try {
      await taxApi.adminAddSubscription(auth, customer.id, {
        productId,
        activeScheduleSlugs: scheduleSlugs.length ? scheduleSlugs : null,
      });
      onDone();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={onSubmit} className="tax-contact-item" style={{ marginBottom: 12, padding: 16 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
            {t('owner.customer.subscription.product')}
          </label>
          {available.length === 0 ? (
            <p style={{ color: 'var(--tax-muted)', fontSize: 13, margin: 0 }}>
              {t('owner.customer.subscription.noProductsLeft')}
            </p>
          ) : (
            <select value={productId} onChange={e => { setProductId(e.target.value); setScheduleSlugs([]); }}
                    style={{ padding: '8px 10px', border: '1px solid var(--tax-border)', borderRadius: 8, minWidth: 280 }}>
              <option value="">{t('owner.customer.subscription.chooseProduct')}</option>
              {available.map(p => (
                <option key={p.id} value={p.id}>
                  {pickI18n(p.name_i18n, locale).value || p.slug}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedProduct && schedules.length > 0 && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
              {t('owner.customer.subscription.activeSchedules')}
            </label>
            <p style={{ fontSize: 12, color: 'var(--tax-muted)', margin: '0 0 8px' }}>
              {t('owner.customer.subscription.activeSchedulesHint')}
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {schedules.map(sch => (
                <label key={sch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={scheduleSlugs.includes(sch.slug)}
                         onChange={() => toggleSlug(sch.slug)} />
                  <span>
                    {pickI18n(sch.name_i18n, locale).value || sch.slug}
                    <span style={{ color: 'var(--tax-muted)', fontSize: 12, marginLeft: 6 }}>
                      ({sch.jurisdiction}, {sch.cadence})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {err && <div className="tax-msg tax-msg--error">{err}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="tax-btn tax-btn--primary tax-btn--sm"
                  disabled={busy || available.length === 0 || !productId}>
            {busy ? t('lead.submitting') : t('owner.customer.subscription.create')}
          </button>
          <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                  onClick={onCancel} style={{ color: 'var(--tax-text)' }}>
            {t('owner.customer.subscription.cancelAdd')}
          </button>
        </div>
      </div>
    </form>
  );
}

// Phase 4g: custom info checklist editor.
//
// Two display modes:
//   value === null  → "Using schedule defaults" + lists the read-only
//                     defaults from the first active schedule. Button to
//                     "Customize this checklist" copies those into editable
//                     state.
//   value is array  → editable rows: key, type, required, EN label, ES label.
//                     Add/remove/reorder controls. "Reset to default"
//                     button to revert to null.
//
// Key constraints (mirrored server-side): lowercase snake_case, unique
// within the checklist. At least one of EN/ES labels must be filled.
function ChecklistEditor({ value, onChange, schedules, activeSlugs, locale, t }) {
  // Pick the default checklist to show as the "current default": when
  // active_slugs is empty (= all schedules), use the first schedule. When
  // a specific subset is active, use the first one in that subset.
  const primarySchedule = (() => {
    if (!schedules || !schedules.length) return null;
    if (activeSlugs && activeSlugs.length) {
      return schedules.find(s => activeSlugs.includes(s.slug)) || schedules[0];
    }
    return schedules[0];
  })();
  const defaultChecklist = Array.isArray(primarySchedule?.info_checklist) ? primarySchedule.info_checklist : [];

  const isCustom = Array.isArray(value);

  const startCustomize = () => {
    // Seed the editable state with a deep clone of the default so the
    // owner has something to work from without losing the default.
    onChange(defaultChecklist.map(item => ({
      key: String(item.key || ''),
      type: ['currency', 'number', 'text'].includes(item.type) ? item.type : 'text',
      required: !!item.required,
      label_i18n: {
        en: item.label_i18n?.en || '',
        es: item.label_i18n?.es || '',
      },
    })));
  };

  const resetToDefault = () => {
    if (window.confirm(t('owner.customer.subscription.checklist.confirmReset'))) {
      onChange(null);
    }
  };

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
        {t('owner.customer.subscription.checklist.title')}
      </label>
      <p style={{ fontSize: 12, color: 'var(--tax-muted)', margin: '0 0 8px' }}>
        {t('owner.customer.subscription.checklist.hint')}
      </p>

      {!isCustom ? (
        <div style={{
          padding: 12, background: '#fff', border: '1px dashed var(--tax-border)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginBottom: 8 }}>
            {primarySchedule
              ? t('owner.customer.subscription.checklist.usingDefault', { name: pickI18n(primarySchedule.name_i18n, locale).value || primarySchedule.slug })
              : t('owner.customer.subscription.checklist.usingDefaultNoSchedule')}
          </div>
          {defaultChecklist.length > 0 && (
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 13 }}>
              {defaultChecklist.map(item => (
                <li key={item.key} style={{ marginBottom: 4 }}>
                  <strong>{pickI18n(item.label_i18n, locale).value || item.key}</strong>
                  <span style={{ color: 'var(--tax-muted)', fontSize: 12, marginLeft: 6 }}>
                    ({item.type}{item.required ? ', ' + t('owner.customer.subscription.checklist.required') : ''})
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                  onClick={startCustomize} style={{ color: 'var(--tax-text)' }}>
            {t('owner.customer.subscription.checklist.customize')}
          </button>
        </div>
      ) : (
        <CustomChecklistEditor
          items={value}
          onChange={onChange}
          onReset={resetToDefault}
          t={t} />
      )}
    </div>
  );
}

function CustomChecklistEditor({ items, onChange, onReset, t }) {
  const update = (idx, patch) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const updateLabel = (idx, lang, val) => {
    const next = items.slice();
    next[idx] = { ...next[idx], label_i18n: { ...next[idx].label_i18n, [lang]: val } };
    onChange(next);
  };
  const removeItem = (idx) => {
    if (!window.confirm(t('owner.customer.subscription.checklist.confirmRemove'))) return;
    onChange(items.filter((_, i) => i !== idx));
  };
  const move = (idx, delta) => {
    const j = idx + delta;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const addItem = () => {
    onChange([...items, {
      key: `item_${items.length + 1}`,
      type: 'text', required: false,
      label_i18n: { en: '', es: '' },
    }]);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--tax-border)', borderRadius: 8, padding: 12 }}>
      {items.length === 0 ? (
        <p style={{ color: 'var(--tax-muted)', margin: '0 0 8px' }}>
          {t('owner.customer.subscription.checklist.emptyCustom')}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{
              padding: 10, background: 'var(--tax-bg-alt)',
              border: '1px solid var(--tax-border)', borderRadius: 6,
              display: 'grid', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tax-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  {t('owner.customer.subscription.checklist.itemN', { n: idx + 1 })}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                          aria-label={t('owner.customer.subscription.checklist.moveUp')}
                          style={{ border: '1px solid var(--tax-border)', background: '#fff',
                                   padding: '2px 8px', borderRadius: 4, cursor: idx === 0 ? 'default' : 'pointer',
                                   opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}
                          aria-label={t('owner.customer.subscription.checklist.moveDown')}
                          style={{ border: '1px solid var(--tax-border)', background: '#fff',
                                   padding: '2px 8px', borderRadius: 4,
                                   cursor: idx === items.length - 1 ? 'default' : 'pointer',
                                   opacity: idx === items.length - 1 ? 0.4 : 1 }}>↓</button>
                  <button type="button" onClick={() => removeItem(idx)}
                          aria-label={t('owner.customer.subscription.checklist.remove')}
                          style={{ border: '1px solid var(--tax-error)', background: '#fff',
                                   color: 'var(--tax-error)', padding: '2px 8px', borderRadius: 4,
                                   cursor: 'pointer', fontSize: 12 }}>×</button>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0, 1fr) 130px 90px' }}>
                <input type="text" value={item.key}
                       onChange={e => update(idx, { key: e.target.value })}
                       placeholder={t('owner.customer.subscription.checklist.keyPlaceholder')}
                       maxLength={80}
                       style={{ padding: 6, border: '1px solid var(--tax-border)', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }} />
                <select value={item.type} onChange={e => update(idx, { type: e.target.value })}
                        style={{ padding: 6, border: '1px solid var(--tax-border)', borderRadius: 4, fontSize: 13 }}>
                  <option value="text">{t('owner.customer.subscription.checklist.type.text')}</option>
                  <option value="number">{t('owner.customer.subscription.checklist.type.number')}</option>
                  <option value="currency">{t('owner.customer.subscription.checklist.type.currency')}</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <input type="checkbox" checked={!!item.required}
                         onChange={e => update(idx, { required: e.target.checked })} />
                  {t('owner.customer.subscription.checklist.required')}
                </label>
              </div>
              <div className="tax-form__row2">
                <input type="text" value={item.label_i18n?.en || ''}
                       onChange={e => updateLabel(idx, 'en', e.target.value)}
                       placeholder={t('owner.customer.subscription.checklist.labelEn')}
                       maxLength={240}
                       style={{ padding: 6, border: '1px solid var(--tax-border)', borderRadius: 4, fontSize: 13, width: '100%' }} />
                <input type="text" value={item.label_i18n?.es || ''}
                       onChange={e => updateLabel(idx, 'es', e.target.value)}
                       placeholder={t('owner.customer.subscription.checklist.labelEs')}
                       maxLength={240}
                       style={{ padding: 6, border: '1px solid var(--tax-border)', borderRadius: 4, fontSize: 13, width: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                onClick={addItem} style={{ color: 'var(--tax-text)' }}>
          {t('owner.customer.subscription.checklist.addItem')}
        </button>
        <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                onClick={onReset} style={{ color: 'var(--tax-muted)' }}>
          {t('owner.customer.subscription.checklist.resetToDefault')}
        </button>
      </div>
    </div>
  );
}
