// Per-module email senders for the tax module (Phase 1).
//
// Phase 1 only sends the lead-arrival notification to the community's
// configured contact email. It uses the generic sendSpanishEmail primitive
// directly (no template row needed yet) — Phase 4b will move tax email copy
// into the editable email_templates table with `tax_*` keys.

'use strict';

const { escapeHtml } = require('../../core/utils');

module.exports = function createTaxSenders(deps) {
  const { sendSpanishEmail, emailConfigured, loadTaxEmailTemplate } = deps;

  // Phase 4i: owner-editable subject + intro paragraph per (template_key, lang).
  // Senders compute their defaults as before; if an override row exists and
  // is enabled, the subject / intro_text / intro_html are replaced with the
  // overridden values, after {{var}} substitution. Structural content
  // (bullets, CTAs, footers) stays hardcoded.
  async function loadOverride(communityId, key, lang) {
    if (typeof loadTaxEmailTemplate !== 'function' || !communityId) return null;
    try { return await loadTaxEmailTemplate(communityId, key, lang); }
    catch (_e) { return null; }
  }
  function interpolate(tpl, vars) {
    if (typeof tpl !== 'string' || !tpl) return tpl;
    return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
      const v = vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '';
      return v == null ? '' : String(v);
    });
  }
  // Apply per-field override: if the override field is non-empty after trim,
  // use it (interpolated); otherwise keep the default. Lets owners override
  // just the subject and leave the body as the system default, etc.
  async function applyOverride({ communityId, key, lang, vars, defaults }) {
    const ov = await loadOverride(communityId, key, lang);
    if (!ov) return defaults;
    const pick = (oField, dField) => {
      const s = (typeof ov[oField] === 'string' ? ov[oField] : '').trim();
      return s ? interpolate(ov[oField], vars || {}) : defaults[dField];
    };
    return {
      subject: pick('subject', 'subject'),
      text:    pick('body_text', 'text'),
      html:    pick('body_html', 'html'),
    };
  }

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

    const defaults = {
      subject: `[${community.name}] New lead from ${lead.name}`,
      text, html,
    };
    const vars = {
      practice_name: community.name,
      lead_name: lead.name, lead_email: lead.email, lead_phone: lead.phone || '',
      lead_service: lead.product_slug || '', lead_locale: lead.preferred_locale,
      lead_message: lead.message || '', lead_id: lead.id, lead_submitted: lead.created_at,
    };
    const finalCopy = await applyOverride({
      communityId: community.id, key: 'lead',
      lang: lead.preferred_locale === 'en' ? 'en' : 'es',
      vars, defaults,
    });
    return sendSpanishEmail({
      to,
      subject: finalCopy.subject, text: finalCopy.text, html: finalCopy.html,
      lang: lead.preferred_locale === 'en' ? 'en' : 'es-CO',
    });
  };

  // ── Reminder email (Phase 1.5) ───────────────────────────────────────────
  // Formal bilingual reminder asking the customer for the info needed to
  // complete a filing. Tone consciously formal per owner preference. Lang
  // chosen from cust.locale ('en' or 'es'); falls back to 'es'.
  const sendTaxReminderEmail = async ({ row, cust, sch, sub, magicUrl, offsetDays, tips, extraDocs }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    // Prefer the customer's chosen communication email (Phase 2e) when set;
    // otherwise fall back to the login email.
    const to = String(cust?.preferred_communication_email || cust?.email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'customer_email_missing' };

    const lang = cust.locale === 'en' ? 'en' : 'es';
    const langTag = lang === 'en' ? 'en' : 'es-CO';
    const filingName = pickName(sch.name_i18n, lang);
    const filingDesc = pickName(sch.description_i18n, lang);
    const checklist = effectiveChecklist(sub, sch, extraDocs);
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

    const defaults = { subject, text, html };
    const vars = {
      customer_name: cust.name || '', practice_name: 'Tax America Services',
      filing_name: filingName, filing_description: filingDesc || '',
      period_label: row.period_label, due_date: row.due_date,
      offset_days: Math.abs(offsetDays), magic_url: magicUrl,
    };
    const finalCopy = await applyOverride({
      communityId: cust.community_id, key: 'reminder', lang, vars, defaults,
    });
    return sendSpanishEmail({
      to, subject: finalCopy.subject, text: finalCopy.text, html: finalCopy.html, lang: langTag,
    });
  };

  function pickName(obj, lang) {
    if (obj && typeof obj === 'object') {
      const v = obj[lang];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof obj.en === 'string') return obj.en;
    }
    return '';
  }

  function effectiveChecklist(sub, sch, extraDocs) {
    // Per-subscription override completely replaces the schedule default.
    const base = (Array.isArray(sub?.custom_info_checklist) && sub.custom_info_checklist.length)
      ? sub.custom_info_checklist
      : (Array.isArray(sch?.info_checklist) ? sch.info_checklist : []);
    // Relationship-driven extras append on top, deduped by `key`.
    if (!Array.isArray(extraDocs) || !extraDocs.length) return base;
    const seen = new Set(base.map(i => i?.key).filter(Boolean));
    const merged = base.slice();
    for (const x of extraDocs) {
      if (!x || (x.key && seen.has(x.key))) continue;
      merged.push(x);
      if (x.key) seen.add(x.key);
    }
    return merged;
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
    // Prefer the customer's chosen communication email (Phase 2e) when set;
    // otherwise fall back to the login email.
    const to = String(cust?.preferred_communication_email || cust?.email || '').trim();
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

    const defaults = { subject, text, html };
    const vars = {
      customer_name: cust.name || '', practice_name: practiceName,
      file_name: doc.file_name || '', portal_url: portalUrl || '',
    };
    const finalCopy = await applyOverride({
      communityId: cust.community_id, key: 'document', lang, vars, defaults,
    });
    return sendSpanishEmail({
      to, subject: finalCopy.subject, text: finalCopy.text, html: finalCopy.html, lang: langTag,
    });
  };

  // ── Customer message email (Phase 2f) ────────────────────────────────────
  // Sent when the practice posts a reply to a thread. Includes a short
  // preview of the message body and a CTA back to the customer's portal.
  // Routes to cust.preferred_communication_email when set (Phase 2e).
  const sendTaxMessageEmail = async ({ cust, community, thread, message, portalUrl }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    const to = String(cust?.preferred_communication_email || cust?.email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'customer_email_missing' };

    const lang = cust.locale === 'en' ? 'en' : 'es';
    const langTag = lang === 'en' ? 'en' : 'es-CO';
    const practiceName = community?.name || 'Tax America Services';
    const subject = lang === 'en'
      ? `New message from ${practiceName}${thread?.subject ? `: ${thread.subject}` : ''}`
      : `Nuevo mensaje de ${practiceName}${thread?.subject ? `: ${thread.subject}` : ''}`;

    const formalGreeting = formalSalutation(cust.name, lang);
    const intro = lang === 'en'
      ? `${practiceName} has sent you a new message through your portal:`
      : `${practiceName} le ha enviado un nuevo mensaje a través de su portal:`;
    const ctaText = lang === 'en'
      ? `Sign in to view the full thread and reply.`
      : `Inicie sesión para ver la conversación completa y responder.`;
    const ctaLabel = lang === 'en' ? 'Open my portal' : 'Abrir mi portal';
    const closing = lang === 'en'
      ? `Sincerely,\n${practiceName}`
      : `Atentamente,\n${practiceName}`;

    // Truncate preview for emails — full body lives in the portal.
    const preview = String(message?.body || '').slice(0, 500);
    const truncated = (message?.body || '').length > 500;
    const previewLine = preview + (truncated ? '…' : '');

    const text = [
      formalGreeting, '', intro,
      thread?.subject ? `\n${lang === 'en' ? 'Subject' : 'Asunto'}: ${thread.subject}` : '',
      '',
      previewLine,
      '',
      ctaText,
      portalUrl || '',
      '',
      closing,
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#111">
        <p>${escapeHtml(formalGreeting)}</p>
        <p>${escapeHtml(intro)}</p>
        ${thread?.subject ? `<p style="color:#444"><strong>${lang === 'en' ? 'Subject' : 'Asunto'}:</strong> ${escapeHtml(thread.subject)}</p>` : ''}
        <blockquote style="margin:16px 0;padding:12px 16px;background:#f4f7fb;border-left:3px solid #1d3a6d;border-radius:6px;white-space:pre-wrap">${escapeHtml(previewLine)}</blockquote>
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

    const msgDefaults = { subject, text, html };
    const msgVars = {
      customer_name: cust.name || '', practice_name: practiceName,
      thread_subject: thread?.subject || '', portal_url: portalUrl || '',
      author_name: message?.author_name || practiceName,
      message_preview: message?.body || '',
    };
    const msgFinal = await applyOverride({
      communityId: cust.community_id, key: 'message_to_customer', lang, vars: msgVars, defaults: msgDefaults,
    });
    return sendSpanishEmail({
      to, subject: msgFinal.subject, text: msgFinal.text, html: msgFinal.html, lang: langTag,
    });
  };

  // ── Practice notification email (Phase 2f) ───────────────────────────────
  // Sent to the community's contact_email when a CUSTOMER posts a message.
  // English-only for v1 since it goes to the practice operator, not the
  // customer. Full thread lives in the (future) owner dashboard; the email
  // is a "go check it" signal.
  const sendTaxMessagePracticeEmail = async ({ community, customer, thread, message }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    const to = String(community?.contact_email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'community_contact_email_missing' };

    const subject = `[${community.name}] New customer message from ${customer?.name || customer?.email || 'a customer'}`;
    const preview = String(message?.body || '').slice(0, 500);
    const truncated = (message?.body || '').length > 500;
    const previewLine = preview + (truncated ? '…' : '');

    const lines = [
      `New customer message via ${community.name} portal:`,
      '',
      `From:     ${customer?.name || ''} <${customer?.email || ''}>`,
      thread?.subject ? `Subject:  ${thread.subject}` : '',
      `Thread:   ${thread?.id || ''}`,
      `Posted:   ${message?.created_at || ''}`,
      '',
      'Message:',
      previewLine,
    ].filter(Boolean);
    const text = lines.join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#111">
        <h3 style="margin:0 0 12px">New customer message — ${escapeHtml(community.name)}</h3>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 8px;color:#555">From</td><td style="padding:6px 8px"><strong>${escapeHtml(customer?.name || '')}</strong> &lt;${escapeHtml(customer?.email || '')}&gt;</td></tr>
          ${thread?.subject ? `<tr><td style="padding:6px 8px;color:#555">Subject</td><td style="padding:6px 8px">${escapeHtml(thread.subject)}</td></tr>` : ''}
          <tr><td style="padding:6px 8px;color:#555">Thread ID</td><td style="padding:6px 8px;color:#666;font-family:monospace;font-size:12px">${escapeHtml(thread?.id || '')}</td></tr>
        </table>
        <h4>Message</h4>
        <blockquote style="margin:8px 0;padding:12px 16px;background:#f7f7f7;border-radius:8px;white-space:pre-wrap">${escapeHtml(previewLine)}</blockquote>
      </div>
    `;

    const pDefaults = { subject, text, html };
    const pVars = {
      customer_name: customer?.name || '', customer_email: customer?.email || '',
      practice_name: community?.name || '', thread_subject: thread?.subject || '',
      thread_id: thread?.id || '', message_preview: previewLine,
    };
    const pFinal = await applyOverride({
      communityId: community?.id, key: 'message_to_practice', lang: 'en', vars: pVars, defaults: pDefaults,
    });
    return sendSpanishEmail({
      to, subject: pFinal.subject, text: pFinal.text, html: pFinal.html, lang: 'en',
    });
  };

  // ── Employee message email (Phase 3) ─────────────────────────────────────
  // Sent to an individual employee when a customer posts on a thread, IF
  // that employee has 'email' in their notification_channels. Routes to
  // employee.preferred_communication_email when set, falls back to
  // employee.email. Locale follows employee.locale.
  const sendTaxMessageEmployeeEmail = async ({ community, customer, employee, thread, message }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    const to = String(employee?.preferred_communication_email || employee?.email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'employee_email_missing' };

    const lang = employee?.locale === 'es' ? 'es' : 'en';
    const langTag = lang === 'en' ? 'en' : 'es-CO';
    const practiceName = community?.name || 'Your tax practice';
    const subject = lang === 'en'
      ? `[${practiceName}] New message from ${customer?.name || customer?.email || 'customer'}${thread?.subject ? ` — ${thread.subject}` : ''}`
      : `[${practiceName}] Nuevo mensaje de ${customer?.name || customer?.email || 'cliente'}${thread?.subject ? ` — ${thread.subject}` : ''}`;

    const greeting = employee?.name
      ? (lang === 'en' ? `Hi ${employee.name},` : `Hola ${employee.name},`)
      : (lang === 'en' ? 'Hello,' : 'Hola,');
    const intro = lang === 'en'
      ? `A customer just posted a message on a thread you can see in the staff portal:`
      : `Un cliente acaba de publicar un mensaje en un hilo visible en el portal del personal:`;
    const ctaText = lang === 'en'
      ? `Sign in to the staff portal to view the full thread and reply.`
      : `Inicie sesión en el portal del personal para ver el hilo completo y responder.`;

    const preview = String(message?.body || '').slice(0, 500);
    const truncated = (message?.body || '').length > 500;
    const previewLine = preview + (truncated ? '…' : '');

    const text = [
      greeting, '', intro,
      `From:    ${customer?.name || ''} <${customer?.email || ''}>`,
      thread?.subject ? `Subject: ${thread.subject}` : '',
      '',
      previewLine,
      '',
      ctaText,
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#111">
        <p>${escapeHtml(greeting)}</p>
        <p>${escapeHtml(intro)}</p>
        <table style="border-collapse:collapse;margin:8px 0">
          <tr><td style="padding:4px 8px;color:#555">From</td><td style="padding:4px 8px"><strong>${escapeHtml(customer?.name || '')}</strong> &lt;${escapeHtml(customer?.email || '')}&gt;</td></tr>
          ${thread?.subject ? `<tr><td style="padding:4px 8px;color:#555">Subject</td><td style="padding:4px 8px">${escapeHtml(thread.subject)}</td></tr>` : ''}
        </table>
        <blockquote style="margin:12px 0;padding:12px 16px;background:#f4f7fb;border-left:3px solid #1d3a6d;border-radius:6px;white-space:pre-wrap">${escapeHtml(previewLine)}</blockquote>
        <p style="color:#555">${escapeHtml(ctaText)}</p>
      </div>
    `;

    const eDefaults = { subject, text, html };
    const eVars = {
      customer_name: customer?.name || '', customer_email: customer?.email || '',
      employee_name: employee?.name || '', practice_name: community?.name || '',
      thread_subject: thread?.subject || '', message_preview: previewLine,
    };
    const eFinal = await applyOverride({
      communityId: community?.id, key: 'message_to_employee', lang, vars: eVars, defaults: eDefaults,
    });
    return sendSpanishEmail({
      to, subject: eFinal.subject, text: eFinal.text, html: eFinal.html, lang: langTag,
    });
  };

  // ── Welcome / portal-invite email ────────────────────────────────────────
  // Sent when an owner manually creates a customer + opts in to a welcome
  // email (default behavior on the Add form). Locale picked from
  // cust.locale; relationships list rendered in the same language. Goes to
  // cust.email (the sign-in identity) — preferred_communication_email is
  // not used here because at first-sign-in time the two are the same and
  // the welcome IS the invitation to use this email to sign in.
  const sendTaxWelcomeEmail = async ({ cust, community, relationships = [], portalUrl }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    const to = String(cust?.email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'customer_email_missing' };

    const lang = cust?.locale === 'en' ? 'en' : 'es';
    const langTag = lang === 'en' ? 'en' : 'es-CO';
    const practiceName = community?.name || 'Tax America Services';
    const formalGreeting = formalSalutation(cust.name, lang);
    const closing = (lang === 'en'
      ? `Sincerely,\n${practiceName}`
      : `Atentamente,\n${practiceName}`);

    const subject = lang === 'en'
      ? `Welcome to your portal at ${practiceName}`
      : `Bienvenido/a a su portal en ${practiceName}`;

    const introLines = lang === 'en' ? [
      formalGreeting,
      '',
      `${practiceName} has set up a secure online portal for you to manage your tax services with us. From the portal you can:`,
      '',
      '  • Receive filing reminders and upload the documents we need',
      '  • View completed returns and other documents we share with you',
      '  • Message us directly with questions',
    ] : [
      formalGreeting,
      '',
      `${practiceName} ha configurado un portal seguro en línea para que administre sus servicios de impuestos con nosotros. Desde el portal puede:`,
      '',
      '  • Recibir recordatorios de declaración y subir los documentos que necesitamos',
      '  • Ver declaraciones completadas y otros documentos que compartimos con usted',
      '  • Enviarnos mensajes directamente con preguntas',
    ];

    // Relationship list. relationships is the array of joined rows from
    // tax_customer_relationships → tax_relationship_types. We use the
    // localized name_i18n for each. Skipped entirely if empty.
    const relNames = (relationships || [])
      .map(r => pickName(r.type?.name_i18n, lang))
      .filter(Boolean);
    const relHeader = lang === 'en'
      ? 'We have you set up for the following services:'
      : 'Lo tenemos configurado para los siguientes servicios:';
    const relSection = relNames.length
      ? ['', relHeader, '', ...relNames.map(n => `  • ${n}`)]
      : [];

    const signInLines = lang === 'en' ? [
      '',
      'To sign in for the first time, visit:',
      '',
      `  ${portalUrl}`,
      '',
      `You can sign in with Google or create a password using this email address (${to}).`,
      '',
      'If you have any questions about getting started, simply reply to this email.',
    ] : [
      '',
      'Para iniciar sesión por primera vez, visite:',
      '',
      `  ${portalUrl}`,
      '',
      `Puede iniciar sesión con Google o crear una contraseña usando este correo (${to}).`,
      '',
      'Si tiene alguna pregunta sobre cómo comenzar, simplemente responda a este correo.',
    ];

    const text = [...introLines, ...relSection, ...signInLines, '', closing].join('\n');

    const relHtml = relNames.length
      ? `
        <p style="margin:16px 0 6px">${escapeHtml(relHeader)}</p>
        <ul style="margin:0 0 16px">
          ${relNames.map(n => `<li>${escapeHtml(n)}</li>`).join('')}
        </ul>` : '';
    const ctaLabel = lang === 'en' ? 'Open my portal' : 'Abrir mi portal';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#111">
        <p>${escapeHtml(formalGreeting)}</p>
        <p>${escapeHtml(introLines[2])}</p>
        <ul>
          <li>${escapeHtml(introLines[4].replace(/^\s*•\s*/, ''))}</li>
          <li>${escapeHtml(introLines[5].replace(/^\s*•\s*/, ''))}</li>
          <li>${escapeHtml(introLines[6].replace(/^\s*•\s*/, ''))}</li>
        </ul>
        ${relHtml}
        <p style="margin:24px 0">
          <a href="${portalUrl}" style="background:#1d3a6d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(ctaLabel)}</a>
        </p>
        <p style="color:#666;font-size:13px">${escapeHtml(portalUrl)}</p>
        <p style="color:#444;font-size:14px">
          ${escapeHtml(lang === 'en'
            ? `You can sign in with Google or create a password using this email address (${to}).`
            : `Puede iniciar sesión con Google o crear una contraseña usando este correo (${to}).`)}
        </p>
        <p style="color:#444;font-size:14px">
          ${escapeHtml(lang === 'en'
            ? 'If you have any questions about getting started, simply reply to this email.'
            : 'Si tiene alguna pregunta sobre cómo comenzar, simplemente responda a este correo.')}
        </p>
        <p style="white-space:pre-line">${escapeHtml(closing)}</p>
      </div>
    `;

    const wDefaults = { subject, text, html };
    const wVars = {
      customer_name: cust.name || '', practice_name: practiceName,
      customer_email: to, portal_url: portalUrl || '',
      relationships_list: relNames.join(', '),
    };
    const wFinal = await applyOverride({
      communityId: cust.community_id, key: 'welcome_customer', lang, vars: wVars, defaults: wDefaults,
    });
    return sendSpanishEmail({
      to, subject: wFinal.subject, text: wFinal.text, html: wFinal.html, lang: langTag,
    });
  };

  // Staff onboarding email — sent when an owner adds an employee row.
  // Mirrors sendTaxWelcomeEmail but points at the /employee URL and uses
  // role-aware copy (admin vs staff). Locale follows emp.locale.
  const sendTaxStaffWelcomeEmail = async ({ emp, community, employeeUrl }) => {
    if (!emailConfigured) return { sent: false, skipped: true, reason: 'email_not_configured' };
    const to = String(emp?.email || '').trim();
    if (!to) return { sent: false, skipped: true, reason: 'employee_email_missing' };

    const lang = emp?.locale === 'en' ? 'en' : 'es';
    const langTag = lang === 'en' ? 'en' : 'es-CO';
    const practiceName = community?.name || 'Tax America Services';
    const isAdmin = emp?.role === 'admin';
    const formalGreeting = formalSalutation(emp.name, lang);
    const closing = (lang === 'en'
      ? `Sincerely,\n${practiceName}`
      : `Atentamente,\n${practiceName}`);

    const roleLabel = lang === 'en'
      ? (isAdmin ? 'an administrator' : 'a staff member')
      : (isAdmin ? 'administrador/a' : 'miembro del personal');

    const subject = lang === 'en'
      ? `You've been added as ${roleLabel} at ${practiceName}`
      : `Le hemos agregado como ${roleLabel} en ${practiceName}`;

    const adminBullets = lang === 'en' ? [
      '  • Manage customers, staff, leads, and community settings',
      '  • Send filing reminders, share documents, and reply to customer messages',
      '  • Edit FAQs and help articles, and view the audit log',
    ] : [
      '  • Administrar clientes, personal, prospectos y configuración de la comunidad',
      '  • Enviar recordatorios de declaración, compartir documentos y responder mensajes de clientes',
      '  • Editar FAQs y artículos de ayuda, y ver el registro de auditoría',
    ];
    const staffBullets = lang === 'en' ? [
      '  • See the customers assigned to you',
      '  • Respond to customer messages and share documents',
      '  • Update your profile and notification preferences',
    ] : [
      '  • Ver los clientes asignados a usted',
      '  • Responder mensajes de clientes y compartir documentos',
      '  • Actualizar su perfil y preferencias de notificación',
    ];
    const bullets = isAdmin ? adminBullets : staffBullets;

    const introLines = lang === 'en' ? [
      formalGreeting,
      '',
      `${practiceName} has added you to the staff portal as ${roleLabel}. From the portal you can:`,
      '',
      ...bullets,
    ] : [
      formalGreeting,
      '',
      `${practiceName} le ha agregado al portal del personal como ${roleLabel}. Desde el portal puede:`,
      '',
      ...bullets,
    ];

    const signInLines = lang === 'en' ? [
      '',
      'To sign in for the first time, visit:',
      '',
      `  ${employeeUrl}`,
      '',
      `You can sign in with Google or create a password using this email address (${to}).`,
      '',
      'If you have any questions about getting started, simply reply to this email.',
    ] : [
      '',
      'Para iniciar sesión por primera vez, visite:',
      '',
      `  ${employeeUrl}`,
      '',
      `Puede iniciar sesión con Google o crear una contraseña usando este correo (${to}).`,
      '',
      'Si tiene alguna pregunta sobre cómo comenzar, simplemente responda a este correo.',
    ];

    const text = [...introLines, ...signInLines, '', closing].join('\n');
    const ctaLabel = lang === 'en' ? 'Open staff portal' : 'Abrir portal del personal';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#111">
        <p>${escapeHtml(formalGreeting)}</p>
        <p>${escapeHtml(introLines[2])}</p>
        <ul>
          ${bullets.map(b => `<li>${escapeHtml(b.replace(/^\s*•\s*/, ''))}</li>`).join('')}
        </ul>
        <p style="margin:24px 0">
          <a href="${employeeUrl}" style="background:#1d3a6d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(ctaLabel)}</a>
        </p>
        <p style="color:#666;font-size:13px">${escapeHtml(employeeUrl)}</p>
        <p style="color:#444;font-size:14px">
          ${escapeHtml(lang === 'en'
            ? `You can sign in with Google or create a password using this email address (${to}).`
            : `Puede iniciar sesión con Google o crear una contraseña usando este correo (${to}).`)}
        </p>
        <p style="color:#444;font-size:14px">
          ${escapeHtml(lang === 'en'
            ? 'If you have any questions about getting started, simply reply to this email.'
            : 'Si tiene alguna pregunta sobre cómo comenzar, simplemente responda a este correo.')}
        </p>
        <p style="white-space:pre-line">${escapeHtml(closing)}</p>
      </div>
    `;

    const sDefaults = { subject, text, html };
    const sVars = {
      staff_name: emp.name || '', practice_name: practiceName,
      staff_email: to, role: emp.role || 'staff', role_label: roleLabel,
      employee_url: employeeUrl || '',
    };
    const sFinal = await applyOverride({
      communityId: emp.community_id, key: 'welcome_staff', lang, vars: sVars, defaults: sDefaults,
    });
    return sendSpanishEmail({
      to, subject: sFinal.subject, text: sFinal.text, html: sFinal.html, lang: langTag,
    });
  };

  return {
    sendTaxLeadEmail,
    sendTaxReminderEmail,
    sendTaxDocumentEmail,
    sendTaxMessageEmail,
    sendTaxMessagePracticeEmail,
    sendTaxMessageEmployeeEmail,
    sendTaxWelcomeEmail,
    sendTaxStaffWelcomeEmail,
  };
};
