import { useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { taxApi } from '../api';

export default function LeadForm({ community, products }) {
  const { locale, t } = useT();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', productSlug: '', message: '', website: '',
  });
  const [status, setStatus] = useState({ kind: 'idle', message: '' });

  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status.kind === 'submitting') return;
    setStatus({ kind: 'submitting', message: '' });
    try {
      await taxApi.submitLead({
        communitySlug: community.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        productSlug: form.productSlug,
        message: form.message,
        locale,
        website: form.website,
      });
      setStatus({ kind: 'success', message: '' });
      setForm({ name: '', email: '', phone: '', productSlug: '', message: '', website: '' });
    } catch (err) {
      const isNetwork = !err?.status;
      setStatus({
        kind: 'error',
        message: isNetwork ? t('lead.error.network') : (err.message || t('lead.error.generic')),
      });
    }
  };

  if (status.kind === 'success') {
    return (
      <div className="tax-form" role="status">
        <div className="tax-msg tax-msg--success">
          <strong>{t('lead.success.heading')}</strong>
          <div style={{ marginTop: 6 }}>{t('lead.success.body')}</div>
        </div>
      </div>
    );
  }

  return (
    <form className="tax-form" onSubmit={onSubmit} noValidate>
      <div>
        <label htmlFor="lead-name">{t('lead.field.name')}</label>
        <input id="lead-name" name="name" type="text" required autoComplete="name"
               value={form.name} onChange={onChange} />
      </div>
      <div className="tax-form__row2">
        <div>
          <label htmlFor="lead-email">{t('lead.field.email')}</label>
          <input id="lead-email" name="email" type="email" required autoComplete="email"
                 value={form.email} onChange={onChange} />
        </div>
        <div>
          <label htmlFor="lead-phone">{t('lead.field.phone')}</label>
          <input id="lead-phone" name="phone" type="tel" autoComplete="tel"
                 value={form.phone} onChange={onChange} />
        </div>
      </div>
      <div>
        <label htmlFor="lead-product">{t('lead.field.product')}</label>
        <select id="lead-product" name="productSlug" value={form.productSlug} onChange={onChange}>
          <option value="">{t('lead.field.product.placeholder')}</option>
          {products.map(p => (
            <option key={p.id} value={p.slug}>{pickI18n(p.name_i18n, locale).value}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="lead-message">{t('lead.field.message')}</label>
        <textarea id="lead-message" name="message" rows={5}
                  placeholder={t('lead.field.message.placeholder')}
                  value={form.message} onChange={onChange} />
      </div>

      {/* Honeypot — bots fill this; real users never see it. */}
      <div className="tax-form__honeypot" aria-hidden="true">
        <label htmlFor="lead-website">Website</label>
        <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off"
               value={form.website} onChange={onChange} />
      </div>

      {status.kind === 'error' && (
        <div className="tax-msg tax-msg--error" role="alert">{status.message}</div>
      )}

      <button type="submit" className="tax-btn tax-btn--primary tax-btn--block"
              disabled={status.kind === 'submitting'}>
        {status.kind === 'submitting' ? t('lead.submitting') : t('lead.submit')}
      </button>
    </form>
  );
}
