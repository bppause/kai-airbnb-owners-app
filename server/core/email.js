// Email send infrastructure — generic primitives only.
//
// Public exports (returned by the factory):
//   sendSpanishEmail    — low-level Resend wrapper (the name is historical;
//                         it handles both es-CO and en via the lang param)
//   getEmailTemplates   — merge platform + community template overrides
//   sendTemplatedEmail  — key-based send with per-recipient language grouping
//                         and community email-routing CC overlay
//   sendSplitEmail      — one-email-per-individual + one-combined-email-to-group
//
// Internal helpers (not exported): getEffectiveEmailFrom,
// getUserLanguageByEmail, renderTemplate, logEmailDelivery.
//
// Per-module senders (sendIncidentEmail, sendListingChangeEmail,
// sendRegistrationStatusEmail, …) still live in server.js for now and
// consume the factory output via dep injection. They will move into their
// respective modules in a later sub-stage. See
// docs/platform/PLATFORM_ARCHITECTURE.md §11.
//
// Lifted byte-identical from server.js stage 4c.

'use strict';

const { v4: uuidv4 } = require('uuid');
const { warn } = require('../../logger');
const {
  normalizeRecipients, escapeHtml, normalizeLanguage, safeJsonObject,
} = require('./utils');
const { DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_TEMPLATES_EN } = require('../templates/email-defaults');

// ─── Shared recipient helpers ────────────────────────────────────────────────
// Pure functions; exported at module scope (after the factory below) so
// per-module sender files can import them without going through the factory.
const getListingOwnerEmails = (listing) => normalizeRecipients([listing?.email, listing?.user_email, listing?.userEmail]);
const getListingOperatorEmails = (listing) => normalizeRecipients([listing?.operator_email, listing?.operatorEmail]);

module.exports = function createEmailHelpers({ supabase, resend, emailConfigured, EMAIL_FROM, getAppConfig }) {
  const getEffectiveEmailFrom = async (lang='es-CO') => {
    try {
      const cfg = await getAppConfig();
      const isEn = normalizeLanguage(lang) === 'en';
      const addr = ((isEn ? cfg.email_from_address_en : cfg.email_from_address) || '').trim();
      if (!addr) return EMAIL_FROM;
      const explicitName = ((isEn ? cfg.email_from_name_en : cfg.email_from_name) || '').trim();
      const communityName = ((isEn ? cfg.complex_name_en : cfg.complex_name_es) || '').trim();
      const name = explicitName || (communityName
        ? (isEn ? `${communityName} Community` : `Comunidad ${communityName}`)
        : '');
      return name ? `${name} <${addr}>` : addr;
    } catch(e) { /* fall through */ }
    return EMAIL_FROM;
  };

  const sendSpanishEmail = async ({ to, subject, text, html, lang='es-CO' }) => {
    if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render.' };
    const recipients = normalizeRecipients(to);
    if (!recipients.length) return { sent:false, skipped:true, reason:'Recipient email is missing.' };
    const from = await getEffectiveEmailFrom(lang);
    const { data, error: resendError } = await resend.emails.send({ from, to:recipients, subject, text, html });
    if (resendError) throw new Error(resendError.message || JSON.stringify(resendError));
    return { sent:true, skipped:false, id:data?.id || '' };
  };

  const getUserLanguageByEmail = async (email='') => {
    const em = String(email || '').trim().toLowerCase();
    if (!em) return 'es-CO';
    try {
      const { data } = await supabase.from('app_users').select('language_preference').eq('email', em).maybeSingle();
      return normalizeLanguage(data?.language_preference || 'es-CO');
    } catch(e) { return 'es-CO'; }
  };

  const getEmailTemplates = async (language='es-CO', communityId='__global__') => {
    const lang = normalizeLanguage(language);
    const merged = { ...(lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES) };
    const applyRows = (rows) => (rows||[]).forEach(t => {
      if (merged[t.key]) merged[t.key] = { ...merged[t.key], label:t.label || merged[t.key].label, subject:t.subject || merged[t.key].subject, text:t.text || merged[t.key].text, html:t.html || merged[t.key].html };
    });
    try {
      const { data: globalData, error: ge } = await supabase.from('email_templates').select('key,label,subject,text,html,language').eq('language', lang).eq('community_id', '__global__');
      if (ge) warn('Email template read failed: ' + ge.message);
      else applyRows(globalData);
      if (communityId && communityId !== '__global__') {
        const { data: communityData } = await supabase.from('email_templates').select('key,label,subject,text,html,language').eq('language', lang).eq('community_id', communityId);
        applyRows(communityData);
      }
    } catch(e) { warn('Email template read failed: ' + (e?.message || e)); }
    return merged;
  };

  const renderTemplate = (template, vars = {}) => String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key] ?? '';
    return /Html$/.test(key) ? String(value || '') : escapeHtml(value);
  });

  const logEmailDelivery = async ({ eventType='', recipients=[], subject='', status='', errorMessage='', relatedEntity='', relatedId='' }) => {
    try {
      await supabase.from('email_delivery_logs').insert({
        id:'eml_' + uuidv4().slice(0,10),
        event_type:String(eventType||''), recipients:normalizeRecipients(recipients), subject:String(subject||''),
        status:String(status||''), error_message:String(errorMessage||''), related_entity:String(relatedEntity||''), related_id:String(relatedId||''),
        created_at:new Date().toISOString()
      });
    } catch(e) { warn('Email delivery log failed: ' + (e?.message || e)); }
  };

  const sendTemplatedEmail = async ({ key, to, vars={}, language='auto', relatedEntity='', relatedId='', communityId='__global__' }) => {
    const recipients = normalizeRecipients(to);
    if (!recipients.length) {
      await logEmailDelivery({ eventType:key, recipients, subject:'', status:'skipped', errorMessage:'No recipient email provided', relatedEntity, relatedId });
      return { sent:false, skipped:true, reason:'Recipient email is missing.' };
    }
    // Master kill-switch + per-community override. Read with the call's
    // communityId so the layered config (community → global) gives us the
    // effective email_enabled flag. Logged either way so admins can audit
    // skipped sends.
    try {
      const cfg = await getAppConfig(communityId === '__global__' ? undefined : communityId);
      if (String(cfg.email_kill_switch || 'false') === 'true') {
        await logEmailDelivery({ eventType:key, recipients, subject:'', status:'skipped', errorMessage:'Global email kill-switch is ON', relatedEntity, relatedId });
        return { sent:false, skipped:true, reason:'Global email kill-switch is ON.' };
      }
      if (String(cfg.email_enabled || 'true') === 'false') {
        await logEmailDelivery({ eventType:key, recipients, subject:'', status:'skipped', errorMessage:`Email disabled for community ${communityId}`, relatedEntity, relatedId });
        return { sent:false, skipped:true, reason:`Email disabled for community ${communityId}.` };
      }
    } catch(e) { warn('email gate read failed: ' + (e?.message || e)); }
    const groups = {};
    if (language && language !== 'auto') {
      groups[normalizeLanguage(language)] = [...recipients];
    } else {
      for (const r of recipients) {
        const lang = await getUserLanguageByEmail(r);
        groups[lang] = groups[lang] || [];
        groups[lang].push(r);
      }
    }
    if (communityId && communityId !== '__global__') {
      try {
        const { data: routingRow } = await supabase.from('community_config').select('value').eq('community_id', communityId).eq('key', 'community_email_routing').maybeSingle();
        if (routingRow?.value) {
          const routing = safeJsonObject(routingRow.value, {});
          const eventCc = normalizeRecipients((routing[key] || {}).cc || []);
          for (const cc of eventCc) {
            const ccLang = await getUserLanguageByEmail(cc);
            groups[ccLang] = groups[ccLang] || [];
            if (!groups[ccLang].includes(cc)) groups[ccLang].push(cc);
          }
        }
      } catch(e) { warn('Community email routing failed: ' + (e?.message || e)); }
    }
    const results = [];
    for (const [lang, recips] of Object.entries(groups)) {
      const templates = await getEmailTemplates(lang, communityId);
      const defaults = lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES;
      const t = templates[key] || defaults[key];
      if (!t) throw new Error('Email template not found: ' + key);
      const subject = renderTemplate(t.subject, vars);
      const text = renderTemplate(t.text, vars);
      const html = renderTemplate(t.html, vars);
      try {
        const result = await sendSpanishEmail({ to:recips, subject, text, html, lang });
        await logEmailDelivery({ eventType:key, recipients:recips, subject, status:result.sent ? 'sent' : 'skipped', errorMessage:result.reason || '', relatedEntity, relatedId });
        results.push(result);
      } catch(e) {
        await logEmailDelivery({ eventType:key, recipients:recips, subject, status:'failed', errorMessage:e?.message || String(e), relatedEntity, relatedId });
        throw e;
      }
    }
    return { sent: results.some(r=>r.sent), skipped: results.every(r=>r.skipped), grouped:true };
  };

  const sendSplitEmail = async ({ key, individual, group, vars, relatedEntity, relatedId, communityId='__global__' }) => {
    if (!emailConfigured) return { sent:false, skipped:true, reason:'Resend email is not configured.' };
    // sendSplitEmail funnels its group hop through sendTemplatedEmail (which
    // already honors both gates), but the per-individual hops below call
    // sendSpanishEmail directly so we gate them here too. One read per call.
    try {
      const cfg = await getAppConfig(communityId === '__global__' ? undefined : communityId);
      const allRecipients = [...individual, ...group];
      if (String(cfg.email_kill_switch || 'false') === 'true') {
        await logEmailDelivery({ eventType:key, recipients:allRecipients, subject:'', status:'skipped', errorMessage:'Global email kill-switch is ON', relatedEntity, relatedId });
        return { sent:false, skipped:true, reason:'Global email kill-switch is ON.' };
      }
      if (String(cfg.email_enabled || 'true') === 'false') {
        await logEmailDelivery({ eventType:key, recipients:allRecipients, subject:'', status:'skipped', errorMessage:`Email disabled for community ${communityId}`, relatedEntity, relatedId });
        return { sent:false, skipped:true, reason:`Email disabled for community ${communityId}.` };
      }
    } catch(e) { warn('email gate read failed: ' + (e?.message || e)); }
    const results = [];

    for (const email of individual) {
      try {
        const lang = await getUserLanguageByEmail(email);
        const templates = await getEmailTemplates(lang, communityId);
        const defaults = lang === 'en' ? DEFAULT_EMAIL_TEMPLATES_EN : DEFAULT_EMAIL_TEMPLATES;
        const t = templates[key] || defaults[key];
        if (!t) continue;
        const subject = renderTemplate(t.subject, vars);
        const text    = renderTemplate(t.text,    vars);
        const html    = renderTemplate(t.html,    vars);
        const result  = await sendSpanishEmail({ to:[email], subject, text, html, lang });
        await logEmailDelivery({ eventType:key, recipients:[email], subject, status:result.sent?'sent':'skipped', errorMessage:result.reason||'', relatedEntity, relatedId });
        results.push(result);
      } catch(e) { warn(`Individual email (${key}) to ${email} failed: ${e?.message||e}`); }
    }

    if (group.length) {
      try {
        const result = await sendTemplatedEmail({ key, to:group, vars, relatedEntity, relatedId, communityId });
        results.push(result);
      } catch(e) { warn(`Group email (${key}) failed: ${e?.message||e}`); }
    }

    const sent = results.some(r => r?.sent);
    const skipped = results.length > 0 && results.every(r => r?.skipped);
    return { sent, skipped, results };
  };

  return { sendSpanishEmail, getEmailTemplates, sendTemplatedEmail, sendSplitEmail };
};

// Top-level helper exports for per-module sender files (no factory needed).
module.exports.getListingOwnerEmails = getListingOwnerEmails;
module.exports.getListingOperatorEmails = getListingOperatorEmails;
