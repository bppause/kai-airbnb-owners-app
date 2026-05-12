// Phase 4n.27: receiver for Resend Inbound emails. When a customer replies
// to a reminder/message email, Resend Inbound fires this webhook with the
// parsed message; we look up the customer by `from` address, find (or
// create) a thread, append the body as a customer-side message, and fire
// the existing message fan-out so the practice gets notified.
//
// Configure in the Resend dashboard:
//   • Set up an inbound domain (Resend → Inbound) — points an MX record
//     at Resend.
//   • Configure a webhook endpoint: POST https://<host>/api/m/tax/email/inbound
//   • Subscribe to the `email.received` event.
//   • Set RESEND_INBOUND_SECRET in Render to the whsec_… value Resend shows.
//
// Matching strategy (in order of preference):
//   1. In-Reply-To header → look up email_delivery_logs.outbound_message_id
//      → use customer_id + thread_id stamped on that row. This is the
//      tightest match and survives email-address reuse across communities.
//   2. From address (case-insensitive) → tax_customers row. When more
//      than one match, prefer one in a community the practice owns most
//      recently (we just take the first match for v1).
//
// We intentionally never expose this endpoint's matching failures to the
// sender — replies that don't match anything are acked with 200 so Resend
// stops retrying, but logged for debugging.

'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const FIVE_MINUTES_SEC = 5 * 60;

function timingSafeEqualBase64(a, b) {
  try {
    const aBuf = Buffer.from(a, 'base64');
    const bBuf = Buffer.from(b, 'base64');
    return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
  } catch (_e) { return false; }
}

function verifySvixSignature({ secret, id, timestamp, body, signatureHeader }) {
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const cleanSecret = String(secret).replace(/^whsec_/, '');
  let secretBytes;
  try { secretBytes = Buffer.from(cleanSecret, 'base64'); } catch (_e) { return false; }
  if (!secretBytes.length) return false;
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > FIVE_MINUTES_SEC) return false;
  const signed = `${id}.${timestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signed).digest('base64');
  const tokens = String(signatureHeader).split(/[\s,]+/).filter(Boolean);
  for (const tok of tokens) {
    const [version, sig] = tok.split(',');
    if (version === 'v1' && sig && timingSafeEqualBase64(sig, expected)) return true;
  }
  return false;
}

// Some inbound providers send `from: "Name <a@b.com>"` as a single string
// and some send it as `{ name, email }`. Normalize.
function extractEmail(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value.email || value.address || '').trim().toLowerCase();
  const m = String(value).match(/<([^>]+)>/);
  return (m ? m[1] : String(value)).trim().toLowerCase();
}

function previewOf(body) {
  return String(body || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

module.exports = function createResendInbound(deps) {
  const { supabase, isSupabaseConfigured, signingSecret, sendTaxMessageEmployeeEmail, getEmployeeChannels, publicAppUrl, warn } = deps;
  const log = warn || console.warn;

  async function handle(req, res) {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

    if (!signingSecret) {
      log('[tax/resend-inbound] RESEND_INBOUND_SECRET is not set; rejecting.');
      return res.status(503).json({ error: 'inbound webhook not configured' });
    }
    const ok = verifySvixSignature({
      secret: signingSecret,
      id: req.get('svix-id'),
      timestamp: req.get('svix-timestamp'),
      body: rawBody,
      signatureHeader: req.get('svix-signature'),
    });
    if (!ok) return res.status(401).json({ error: 'invalid signature' });

    let payload;
    try { payload = JSON.parse(rawBody); }
    catch (_e) { return res.status(400).json({ error: 'invalid json' }); }

    // Resend Inbound dispatches `email.received`. Accept the event whether
    // it's the top-level type or nested under data.event so future Resend
    // payload shape tweaks don't break us silently.
    const type = String(payload?.type || payload?.event || '');
    if (type && !/received/i.test(type)) {
      return res.json({ ok: true, ignored: true });
    }
    if (!isSupabaseConfigured || !supabase) {
      return res.json({ ok: true, skipped: 'no_db' });
    }

    const data = payload?.data || payload || {};
    const fromEmail = extractEmail(data.from);
    const subject = String(data.subject || '').slice(0, 500).trim();
    const text = String(data.text || data.body_plain || '').slice(0, 32000);
    const html = String(data.html || '').slice(0, 64000);
    const inReplyTo = (data.headers && (data.headers['in-reply-to'] || data.headers['In-Reply-To']))
                   || data['in-reply-to'] || data.in_reply_to || '';
    const messageId = (data.headers && (data.headers['message-id'] || data.headers['Message-ID']))
                   || data.message_id || '';
    if (!fromEmail) return res.json({ ok: true, skipped: 'no_from' });

    // --- 1. Match by In-Reply-To against outbound log -----------------
    let customer = null;
    let threadId = null;
    let communityId = null;
    if (inReplyTo) {
      // Normalize to bare id (strip < > and @domain).
      const candidates = String(inReplyTo).match(/<([^>]+)>/g) || [String(inReplyTo)];
      const ids = candidates.map(s => s.replace(/[<>]/g, '').trim()).filter(Boolean);
      const { data: logRows } = await supabase.from('email_delivery_logs')
        .select('customer_id, community_id, thread_id')
        .in('outbound_message_id', ids).limit(1);
      const hit = (logRows || [])[0];
      if (hit) {
        if (hit.customer_id) {
          const { data: c } = await supabase.from('tax_customers')
            .select('id, community_id, email, name')
            .eq('id', hit.customer_id).maybeSingle();
          if (c) { customer = c; communityId = c.community_id; }
        }
        if (hit.thread_id) threadId = hit.thread_id;
      }
    }

    // --- 2. Fallback: match by FROM address ---------------------------
    if (!customer) {
      const { data: c } = await supabase.from('tax_customers')
        .select('id, community_id, email, name')
        .eq('email', fromEmail).limit(1).maybeSingle();
      if (c) { customer = c; communityId = c.community_id; }
    }

    if (!customer) {
      log('[tax/resend-inbound] no customer match for', fromEmail);
      return res.json({ ok: true, unmatched: true });
    }

    // --- 3. Find or create thread -------------------------------------
    if (!threadId) {
      // Try matching a recent thread by subject (case-insensitive, stripped
      // of Re:/Fwd:) before falling back to "new thread".
      const stripped = subject.replace(/^\s*(re|fw|fwd):\s*/gi, '').trim();
      if (stripped) {
        const { data: existing } = await supabase.from('tax_message_threads')
          .select('id').eq('customer_id', customer.id).ilike('subject', stripped)
          .order('last_message_at', { ascending: false, nullsFirst: false }).limit(1);
        if (existing && existing[0]) threadId = existing[0].id;
      }
    }
    if (!threadId) {
      const tid = 'thr_' + uuidv4().slice(0, 12);
      const { error: tErr } = await supabase.from('tax_message_threads').insert({
        id: tid, community_id: communityId, customer_id: customer.id,
        subject: subject || '(no subject)',
        status: 'open',
      });
      if (tErr) {
        log('[tax/resend-inbound] thread insert failed:', tErr.message);
        return res.status(500).json({ error: 'thread create failed' });
      }
      threadId = tid;
    }

    // --- 4. Append the message ----------------------------------------
    const messageBody = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const msgId = 'tmsg_' + uuidv4().slice(0, 12);
    const { error: mErr } = await supabase.from('tax_messages').insert({
      id: msgId, community_id: communityId, thread_id: threadId,
      customer_id: customer.id,
      author_role: 'customer', author_email: fromEmail,
      author_name: customer.name || '',
      body: messageBody,
      created_at: new Date().toISOString(),
    });
    if (mErr) {
      log('[tax/resend-inbound] message insert failed:', mErr.message);
      return res.status(500).json({ error: 'message insert failed' });
    }
    // Touch thread bookkeeping so the inbox surfaces the unread reply.
    await supabase.from('tax_message_threads').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: previewOf(messageBody),
      last_message_by_role: 'customer',
      practice_unread: true,
      customer_unread: false,
      updated_at: new Date().toISOString(),
    }).eq('id', threadId);

    return res.json({
      ok: true, customerId: customer.id, threadId,
      matched: { byInReplyTo: !!inReplyTo, messageId },
    });
  }

  return { handle, _verifySvixSignature: verifySvixSignature };
};
