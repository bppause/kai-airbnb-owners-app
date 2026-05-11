// Per-module email senders for the tax module (Phase 1).
//
// Phase 1 only sends the lead-arrival notification to the community's
// configured contact email. It uses the generic sendSpanishEmail primitive
// directly (no template row needed yet) — Phase 4b will move tax email copy
// into the editable email_templates table with `tax_*` keys.

'use strict';

const { escapeHtml } = require('../../core/utils');

module.exports = function createTaxSenders(deps) {
  const { sendSpanishEmail, emailConfigured } = deps;

  const sendTaxLeadEmail = async ({ community, lead }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'Email not configured.' };
    const to = String(community?.contact_email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'Community has no contact_email.' };

    const lines = [
      `New lead via ${community.name} landing page:`,
      '',
      `Name:    ${lead.name}`,
      `Email:   ${lead.email}`,
      `Phone:   ${lead.phone || '—'}`,
      `Service: ${lead.product_slug || '—'}`,
      `Locale:  ${lead.preferred_locale}`,
      '',
      'Message:',
      lead.message || '(none)',
      '',
      `Lead ID: ${lead.id}`,
      `Submitted: ${lead.created_at}`,
    ];
    const text = lines.join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px">
        <h2 style="margin-top:0">New lead — ${escapeHtml(community.name)}</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 8px;color:#555">Name</td><td style="padding:6px 8px"><strong>${escapeHtml(lead.name)}</strong></td></tr>
          <tr><td style="padding:6px 8px;color:#555">Email</td><td style="padding:6px 8px"><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
          <tr><td style="padding:6px 8px;color:#555">Phone</td><td style="padding:6px 8px">${escapeHtml(lead.phone || '—')}</td></tr>
          <tr><td style="padding:6px 8px;color:#555">Service</td><td style="padding:6px 8px">${escapeHtml(lead.product_slug || '—')}</td></tr>
          <tr><td style="padding:6px 8px;color:#555">Locale</td><td style="padding:6px 8px">${escapeHtml(lead.preferred_locale)}</td></tr>
        </table>
        <h3>Message</h3>
        <div style="white-space:pre-wrap;background:#f7f7f7;padding:12px;border-radius:8px">${escapeHtml(lead.message || '(none)')}</div>
        <p style="color:#888;font-size:12px;margin-top:24px">Lead ID: ${escapeHtml(lead.id)}<br/>Submitted: ${escapeHtml(lead.created_at)}</p>
      </div>
    `;

    return sendSpanishEmail({
      to,
      subject: `[${community.name}] New lead from ${lead.name}`,
      text, html,
      lang: lead.preferred_locale === 'en' ? 'en' : 'es-CO',
    });
  };

  // ── Reminder email (Phase 1.5) ───────────────────────────────────────────
  // Formal bilingual reminder asking the customer for the info needed to
  // complete a filing. Tone consciously formal per owner preference. Lang
  // chosen from cust.locale ('en' or 'es'); falls back to 'es'.
  const sendTaxReminderEmail = async ({ row, cust, sch, sub, magicUrl, offsetDays, tips }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    const to = String(cust?.email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'customer_email_missing' };

    const lang = cust.locale === 'en' ? 'en' : 'es';
    const langTag = lang === 'en' ? 'en' : 'es-CO';
    const filingName = pickName(sch.name_i18n, lang);
    const filingDesc = pickName(sch.description_i18n, lang);
    const checklist = effectiveChecklist(sub, sch);
    const formalGreeting = formalSalutation(cust.name, lang);
    const closing = (lang === 'en'
      ? 'Sincerely,\nTax America Services'
      : 'Atentamente,\nTax America Services');

    const daysWord = Math.abs(offsetDays) === 1
      ? (lang === 'en' ? 'day' : 'día')
      : (lang === 'en' ? 'days' : 'días');
    const subject = lang === 'en'
      ? `Reminder: ${filingName} due ${row.due_date} (${Math.abs(offsetDays)} ${daysWord} away)`
      : `Recordatorio: ${filingName} vence el ${row.due_date} (${Math.abs(offsetDays)} ${daysWord} restantes)`;

    const introLines = lang === 'en' ? [
      `${formalGreeting}`,
      ``,
      `This is a reminder that the filing "${filingName}" for the period ${row.period_label} is due on ${row.due_date}.`,
      filingDesc ? `${filingDesc}` : null,
      ``,
      `In order to prepare and submit this filing on your behalf, we will need the following information from you:`,
    ].filter(Boolean) : [
      `${formalGreeting}`,
      ``,
      `Le escribimos para recordarle que la declaración "${filingName}" correspondiente al período ${row.period_label} vence el ${row.due_date}.`,
      filingDesc ? `${filingDesc}` : null,
      ``,
      `Para poder preparar y presentar esta declaración en su nombre, necesitamos la siguiente información:`,
    ].filter(Boolean);

    const checklistTextLines = checklist.map(item =>
      `  • ${pickName(item.label_i18n, lang)}${item.required ? '' : (lang === 'en' ? ' (optional)' : ' (opcional)')}`);
    const checklistHtmlLines = checklist.map(item =>
      `<li>${escapeHtml(pickName(item.label_i18n, lang))}${item.required ? '' : `<span style="color:#666"> ${lang === 'en' ? '(optional)' : '(opcional)'}</span>`}</li>`);

    const ctaText = lang === 'en'
      ? `Please submit your information via the secure link below. The link is unique to this filing and will expire after the due date.`
      : `Por favor envíe su información usando el enlace seguro a continuación. El enlace es único para esta declaración y expirará después de la fecha de vencimiento.`;
    const ctaLabel = lang === 'en' ? 'Submit information' : 'Enviar información';

    // Phase 2c: relationship-aware tips, injected above the closing.
    const tipsArr = Array.isArray(tips) ? tips : [];
    const tipsHeading = lang === 'en' ? 'Helpful reminders for your services' : 'Recordatorios útiles para sus servicios';
    const tipsTextLines = tipsArr.map(t => `  • ${pickName(t.tip_i18n, lang)}`);
    const tipsHtml = tipsArr.length ? `
      <div style="margin:24px 0;padding:16px 18px;background:#f4f7fb;border-left:3px solid #1d3a6d;border-radius:6px">
        <div style="font-weight:600;margin-bottom:8px">${escapeHtml(tipsHeading)}</div>
        <ul style="margin:0;padding-left:20px">
          ${tipsArr.map(t => `<li style="margin:4px 0">${escapeHtml(pickName(t.tip_i18n, lang))}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const text = [
      ...introLines,
      ...checklistTextLines,
      ``,
      ctaText,
      magicUrl,
      ...(tipsTextLines.length ? [``, tipsHeading + ':', ...tipsTextLines] : []),
      ``,
      closing,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#111">
        <p>${escapeHtml(formalGreeting)}</p>
        <p>${introLines.slice(2).filter(s => s !== '').map(escapeHtml).join('</p><p>')}</p>
        <ul>${checklistHtmlLines.join('')}</ul>
        <p>${escapeHtml(ctaText)}</p>
        <p style="margin:24px 0">
          <a href="${magicUrl}" style="background:#1d3a6d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(ctaLabel)}</a>
        </p>
        <p style="color:#666;font-size:13px">${escapeHtml(magicUrl)}</p>
        ${tipsHtml}
        <p style="white-space:pre-line">${escapeHtml(closing)}</p>
      </div>
    `;

    return sendSpanishEmail({ to, subject, text, html, lang: langTag });
  };

  function pickName(obj, lang) {
    if (obj && typeof obj === 'object') {
      const v = obj[lang];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof obj.en === 'string') return obj.en;
    }
    return '';
  }

  function effectiveChecklist(sub, sch) {
    if (Array.isArray(sub?.custom_info_checklist) && sub.custom_info_checklist.length) {
      return sub.custom_info_checklist;
    }
    return Array.isArray(sch?.info_checklist) ? sch.info_checklist : [];
  }

  function formalSalutation(name, lang) {
    const n = String(name || '').trim();
    if (lang === 'en') return n ? `Dear ${n},` : 'Dear customer,';
    return n ? `Estimado/a ${n}:` : 'Estimado/a cliente:';
  }

  // ── Document-available email (Phase 2d) ──────────────────────────────────
  // Sent when the practice uploads a document to the customer's portal —
  // typically a completed return, K-1, or signed engagement letter. Tone
  // matches the formal reminder email; CTA is the portal home.
  const sendTaxDocumentEmail = async ({ cust, community, doc, portalUrl }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    const to = String(cust?.email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'customer_email_missing' };

    const lang = cust.locale === 'en' ? 'en' : 'es';
    const langTag = lang === 'en' ? 'en' : 'es-CO';
    const practiceName = community?.name || 'Tax America Services';
    const formalGreeting = formalSalutation(cust.name, lang);
    const closing = lang === 'en'
      ? `Sincerely,\n${practiceName}`
      : `Atentamente,\n${practiceName}`;

    const subject = lang === 'en'
      ? `New document available in your portal — ${doc.file_name}`
      : `Nuevo documento disponible en su portal — ${doc.file_name}`;

    const intro = lang === 'en'
      ? `${practiceName} has uploaded a new document to your secure portal:`
      : `${practiceName} ha cargado un documento nuevo en su portal seguro:`;
    const ctaText = lang === 'en'
      ? `Please sign in to review and download it. If you have questions about this document, reply to this email or contact our office.`
      : `Por favor inicie sesión para revisarlo y descargarlo. Si tiene preguntas sobre este documento, responda a este correo o contacte a nuestra oficina.`;
    const ctaLabel = lang === 'en' ? 'Open my portal' : 'Abrir mi portal';

    const text = [
      formalGreeting,
      '',
      intro,
      `  • ${doc.file_name}`,
      '',
      ctaText,
      portalUrl || '',
      '',
      closing,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#111">
        <p>${escapeHtml(formalGreeting)}</p>
        <p>${escapeHtml(intro)}</p>
        <p style="background:#f4f7fb;border-left:3px solid #1d3a6d;padding:10px 14px;border-radius:6px;margin:16px 0">
          <strong>${escapeHtml(doc.file_name)}</strong>
        </p>
        <p>${escapeHtml(ctaText)}</p>
        ${portalUrl ? `
          <p style="margin:24px 0">
            <a href="${portalUrl}" style="background:#1d3a6d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(ctaLabel)}</a>
          </p>
          <p style="color:#666;font-size:13px">${escapeHtml(portalUrl)}</p>
        ` : ''}
        <p style="white-space:pre-line">${escapeHtml(closing)}</p>
      </div>
    `;

    return sendSpanishEmail({ to, subject, text, html, lang: langTag });
  };

  return { sendTaxLeadEmail, sendTaxReminderEmail, sendTaxDocumentEmail };
};
