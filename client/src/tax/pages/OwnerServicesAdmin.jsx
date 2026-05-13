import { useEffect, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

// Owner-admin editor for the landing-page service cards. Mirrors the
// OwnerFaqAdmin / OwnerHelpAdmin layout — each row is one tax_products
// row, click Edit to surface bilingual fields for name, short description,
// long description (for the detail modal), and required-document bullets.
//
// tax_products rows are already per-community, so there's no "default vs
// override" distinction here like FAQs have: editing is in place.

export default function OwnerServicesAdmin() {
  const { locale, t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [products, setProducts] = useState(null);
  const [err, setErr] = useState('');

  const load = () => {
    if (!fbUser || !community) return;
    taxApi.adminListProducts(auth, community.id)
      .then(d => setProducts(d.products || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };
  useEffect(load, [fbUser, community]); // eslint-disable-line react-hooks/exhaustive-deps

  if (employee && employee.role !== 'admin') {
    return <EmployeeShell community={community}>
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }

  return (
    <EmployeeShell community={community} active="service-catalog">
      <h2 style={{ margin: 0 }}>{t('owner.services.title')}</h2>
      <p className="tax-section__lede">{t('owner.services.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {products === null ? <p>{t('loading')}</p>
        : products.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>{t('owner.services.empty')}</p>
          : <div style={{ display: 'grid', gap: 10 }}>
              {products.map(p => (
                <ServiceRow key={p.id} product={p} auth={auth}
                            onChange={load} locale={locale} t={t} />
              ))}
            </div>}
    </EmployeeShell>
  );
}

function ServiceRow({ product: p, auth, onChange, locale, t }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const name = pickI18n(p.name_i18n, locale).value || p.slug;
  const desc = pickI18n(p.description_i18n, locale).value;
  const longDesc = pickI18n(p.long_description_i18n, locale).value;
  const reqs = Array.isArray(p.required_documents) ? p.required_documents : [];

  const toggleEnabled = async () => {
    setBusy(true); setErr('');
    try {
      await taxApi.adminUpdateProduct(auth, p.id, { enabled: !p.enabled });
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    // First attempt is a plain delete. The server refuses with 409 +
    // `usage` counts when active subscriptions reference the service;
    // we surface those numbers to the owner and require a second
    // confirm before re-trying with force=1.
    if (!window.confirm(t('owner.services.deleteConfirm', { name }))) return;
    setBusy(true); setErr('');
    try {
      await taxApi.adminDeleteProduct(auth, p.id);
      onChange();
      return;
    } catch (e) {
      const u = e?.body?.usage;
      if (e?.body?.error === 'product_in_use' && u) {
        const proceed = window.confirm(t('owner.services.deleteForceConfirm', {
          name, subs: u.active_subscriptions || 0,
          schedules: u.filing_schedules || 0,
        }));
        if (!proceed) {
          setErr(t('owner.services.deleteCancelled'));
          setBusy(false);
          return;
        }
        try {
          await taxApi.adminDeleteProduct(auth, p.id, { force: true });
          onChange();
          return;
        } catch (e2) {
          setErr(e2?.message || '');
        }
      } else {
        setErr(e?.message || '');
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="tax-contact-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {name}
            <span style={{
              marginLeft: 8, padding: '1px 8px', borderRadius: 999,
              background: 'var(--tax-bg-alt)', color: 'var(--tax-muted)',
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            }}>{p.category}</span>
            {!p.enabled && (
              <span style={{
                marginLeft: 6, padding: '1px 8px', borderRadius: 999,
                background: '#fee2e2', color: '#991b1b',
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              }}>{t('owner.services.hidden')}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 2 }}>
            {t('owner.services.slug')}: {p.slug} • {t('owner.services.displayOrder')}: {p.display_order}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!editing && (
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    onClick={() => setEditing(true)} style={{ color: 'var(--tax-text)' }}>
              {t('owner.services.edit')}
            </button>
          )}
          {!editing && (
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    onClick={toggleEnabled} disabled={busy}
                    style={{ color: 'var(--tax-muted)' }}>
              {p.enabled ? t('owner.services.hide') : t('owner.services.show')}
            </button>
          )}
          {!editing && (
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    onClick={onDelete} disabled={busy}
                    style={{ color: 'var(--tax-error)', borderColor: 'var(--tax-error)' }}>
              {t('owner.services.delete')}
            </button>
          )}
        </div>
      </div>

      {err && <div className="tax-msg tax-msg--error" style={{ marginTop: 8 }}>{err}</div>}

      {editing ? (
        <ProductEditor product={p} auth={auth}
                       onDone={() => { setEditing(false); onChange(); }}
                       onCancel={() => setEditing(false)} t={t} />
      ) : (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--tax-muted)',
                      whiteSpace: 'pre-wrap' }}>
          <div>{desc || <em>{t('owner.services.descMissing')}</em>}</div>
          {longDesc && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <strong style={{ color: 'var(--tax-text)' }}>{t('owner.services.longLabel')}:</strong>{' '}
              {longDesc.length > 200 ? `${longDesc.slice(0, 200)}…` : longDesc}
            </div>
          )}
          {reqs.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <strong style={{ color: 'var(--tax-text)' }}>{t('owner.services.requiresLabel')}:</strong>{' '}
              {reqs.length} {t('owner.services.requiresItems')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductEditor({ product: p, auth, onDone, onCancel, t }) {
  const [nameEn, setNameEn] = useState(p.name_i18n?.en || '');
  const [nameEs, setNameEs] = useState(p.name_i18n?.es || '');
  const [descEn, setDescEn] = useState(p.description_i18n?.en || '');
  const [descEs, setDescEs] = useState(p.description_i18n?.es || '');
  const [longEn, setLongEn] = useState(p.long_description_i18n?.en || '');
  const [longEs, setLongEs] = useState(p.long_description_i18n?.es || '');
  // required_documents accepts strings or {en,es} objects. Surface as
  // bilingual rows so the owner can author both languages at once.
  const initialReqs = Array.isArray(p.required_documents) ? p.required_documents : [];
  const [reqs, setReqs] = useState(() => initialReqs.map(d => (
    typeof d === 'string' ? { en: d, es: '' } : { en: d.en || '', es: d.es || '' }
  )));
  const [order, setOrder] = useState(String(p.display_order || 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const updateReq = (i, lang, v) =>
    setReqs(prev => prev.map((r, idx) => idx === i ? { ...r, [lang]: v } : r));
  const addReq = () => setReqs(prev => [...prev, { en: '', es: '' }]);
  const removeReq = (i) => setReqs(prev => prev.filter((_, idx) => idx !== i));

  const onSave = async () => {
    setBusy(true); setErr('');
    try {
      const cleanedReqs = reqs
        .map(r => ({ en: r.en.trim(), es: r.es.trim() }))
        .filter(r => r.en || r.es);
      await taxApi.adminUpdateProduct(auth, p.id, {
        nameI18n: { en: nameEn.trim(), es: nameEs.trim() },
        descriptionI18n: { en: descEn.trim(), es: descEs.trim() },
        longDescriptionI18n: { en: longEn.trim(), es: longEs.trim() },
        requiredDocuments: cleanedReqs,
        displayOrder: Number(order) || 0,
      });
      onDone();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, padding: 12, background: 'var(--tax-bg-alt)',
                  borderRadius: 8, display: 'grid', gap: 12 }}>
      <div className="tax-form__row2">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)' }}>{t('owner.services.nameEn')}</label>
          <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} maxLength={200}
                 style={{ width: '100%', padding: 8, border: '1px solid var(--tax-border)', borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)' }}>{t('owner.services.nameEs')}</label>
          <input type="text" value={nameEs} onChange={e => setNameEs(e.target.value)} maxLength={200}
                 style={{ width: '100%', padding: 8, border: '1px solid var(--tax-border)', borderRadius: 6 }} />
        </div>
      </div>

      <div className="tax-form__row2">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)' }}>{t('owner.services.descEn')}</label>
          <textarea rows={2} value={descEn} onChange={e => setDescEn(e.target.value)} maxLength={400}
                    style={{ width: '100%', padding: 8, border: '1px solid var(--tax-border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)' }}>{t('owner.services.descEs')}</label>
          <textarea rows={2} value={descEs} onChange={e => setDescEs(e.target.value)} maxLength={400}
                    style={{ width: '100%', padding: 8, border: '1px solid var(--tax-border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 }} />
        </div>
      </div>

      <div className="tax-form__row2">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)' }}>{t('owner.services.longEn')}</label>
          <textarea rows={6} value={longEn} onChange={e => setLongEn(e.target.value)} maxLength={4000}
                    placeholder={t('owner.services.longPlaceholder')}
                    style={{ width: '100%', padding: 8, border: '1px solid var(--tax-border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)' }}>{t('owner.services.longEs')}</label>
          <textarea rows={6} value={longEs} onChange={e => setLongEs(e.target.value)} maxLength={4000}
                    placeholder={t('owner.services.longPlaceholder')}
                    style={{ width: '100%', padding: 8, border: '1px solid var(--tax-border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 }} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)' }}>
          {t('owner.services.requiresLabel')}
        </label>
        <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
          {reqs.map((r, i) => (
            <div key={i} className="tax-form__row2" style={{ alignItems: 'center', gap: 8 }}>
              <input type="text" value={r.en} onChange={e => updateReq(i, 'en', e.target.value)}
                     placeholder="English" maxLength={200}
                     style={{ padding: 6, border: '1px solid var(--tax-border)', borderRadius: 6 }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="text" value={r.es} onChange={e => updateReq(i, 'es', e.target.value)}
                       placeholder="Español" maxLength={200}
                       style={{ flex: 1, padding: 6, border: '1px solid var(--tax-border)', borderRadius: 6 }} />
                <button type="button" onClick={() => removeReq(i)}
                        style={{ border: 0, background: 'transparent', color: 'var(--tax-error)', cursor: 'pointer', fontSize: 18 }}>
                  ×
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addReq}
                  className="tax-btn tax-btn--ghost tax-btn--sm"
                  style={{ color: 'var(--tax-brand-primary)', justifySelf: 'start' }}>
            + {t('owner.services.requiresAdd')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--tax-muted)' }}>
          {t('owner.services.displayOrder')}:&nbsp;
          <input type="number" value={order} onChange={e => setOrder(e.target.value)} min="0" max="10000"
                 style={{ width: 80, padding: '4px 6px', border: '1px solid var(--tax-border)', borderRadius: 4 }} />
        </label>
      </div>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                onClick={onSave} disabled={busy}>
          {busy ? t('lead.submitting') : t('owner.services.save')}
        </button>
        <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                onClick={onCancel} style={{ color: 'var(--tax-text)' }}>
          {t('owner.services.cancel')}
        </button>
      </div>
    </div>
  );
}
