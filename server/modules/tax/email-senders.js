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

  return { sendTaxLeadEmail };
};
