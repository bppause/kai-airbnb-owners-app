// Phase 4n: receiver for Resend webhook events. Resend signs payloads with
// Svix headers (svix-id, svix-timestamp, svix-signature). We verify the
// signature with the dashboard-configured `whsec_…` secret and update the
// corresponding row in email_delivery_logs.
//
// Configure in the Resend dashboard:
//   Endpoint URL: https://<your-host>/api/m/tax/resend/webhook
//   Events:       email.delivered, email.opened, email.clicked,
//                 email.bounced, email.complained
//   Set RESEND_WEBHOOK_SECRET in Render to the whsec_... value Resend shows.
//
// IMPORTANT caveats (call out in docs / UI):
//   - Apple Mail Privacy Protection pre-fetches the open pixel, so opens are
//     noisy on iOS. Clicks are more reliable.
//   - The svix-timestamp window is 5 minutes; older requests are rejected to
//     prevent replay attacks.

'use strict';

const crypto = require('crypto');

const FIVE_MINUTES_SEC = 5 * 60;

function timingSafeEqualBase64(a, b) {
  try {
    const aBuf = Buffer.from(a, 'base64');
    const bBuf = Buffer.from(b, 'base64');
    return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
  } catch (_e) { return false; }
}

// Svix-style: HMAC-SHA256(`${id}.${timestamp}.${body}`) with the base64-decoded
// secret (the `whsec_` prefix is stripped). The signature header can contain
// multiple comma- or space-separated `v1,<sig>` tokens; any match passes.
function verifySvixSignature({ secret, id, timestamp, body, signatureHeader }) {
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const cleanSecret = String(secret).replace(/^whsec_/, '');
  let secretBytes;
  try { secretBytes = Buffer.from(cleanSecret, 'base64'); }
  catch (_e) { return false; }
  if (!secretBytes.length) return false;

  // Reject stale or future-dated requests (replay window).
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > FIVE_MINUTES_SEC) return false;

  const signed = `${id}.${timestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signed).digest('base64');

  // signatureHeader is e.g. "v1,abc... v1,def..."  — accept any match.
  const tokens = String(signatureHeader).split(/[\s,]+/).filter(Boolean);
  for (const tok of tokens) {
    const [version, sig] = tok.split(',');
    if (version === 'v1' && sig && timingSafeEqualBase64(sig, expected)) return true;
  }
  return false;
}

// Resend event types we care about → column to stamp.
const EVENT_COLUMN = {
  'email.delivered': { ts: 'delivered_at' },
  'email.opened':    { ts: 'opened_at',  counter: 'open_count' },
  'email.clicked':   { ts: 'clicked_at', counter: 'click_count' },
  'email.bounced':   { ts: 'bounced_at' },
  'email.complained':{ ts: 'complained_at' },
};

module.exports = function createResendWebhook(deps) {
  const { supabase, isSupabaseConfigured, signingSecret } = deps;

  async function handle(req, res) {
    // express.raw gives us a Buffer.
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

    // Signature verification. If no secret is configured, refuse — fail closed
    // rather than accept anonymous writes to email_delivery_logs.
    if (!signingSecret) {
      console.warn('[tax/resend-webhook] RESEND_WEBHOOK_SECRET is not set; rejecting.');
      return res.status(503).json({ error: 'webhook not configured' });
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

    const type = String(payload?.type || '');
    const data = payload?.data || {};
    const emailId = String(data?.email_id || data?.id || '');
    const cfg = EVENT_COLUMN[type];

    // Unknown event types: ack with 200 so Resend doesn't retry forever.
    if (!cfg || !emailId) return res.json({ ok: true, ignored: true });
    if (!isSupabaseConfigured || !supabase) return res.json({ ok: true, skipped: 'no_db' });

    try {
      // Find existing row by resend_id; stamp the relevant column.
      const { data: rows, error: selErr } = await supabase
        .from('email_delivery_logs').select('id, open_count, click_count')
        .eq('resend_id', emailId).limit(1);
      if (selErr) {
        console.warn('[tax/resend-webhook] select failed:', selErr.message);
        return res.status(500).json({ error: 'lookup failed' });
      }
      if (!rows || !rows.length) {
        // Webhook for an email we didn't log (e.g. sent before tracking was
        // wired up). Ack so Resend stops retrying.
        return res.json({ ok: true, unmatched: true });
      }
      const row = rows[0];
      const update = { [cfg.ts]: new Date().toISOString() };
      if (cfg.counter) {
        update[cfg.counter] = (row[cfg.counter] || 0) + 1;
      }
      const { error: updErr } = await supabase
        .from('email_delivery_logs').update(update).eq('id', row.id);
      if (updErr) {
        console.warn('[tax/resend-webhook] update failed:', updErr.message);
        return res.status(500).json({ error: 'update failed' });
      }
      return res.json({ ok: true });
    } catch (e) {
      console.warn('[tax/resend-webhook] handler error:', e?.message || e);
      return res.status(500).json({ error: 'handler error' });
    }
  }

  return { handle, _verifySvixSignature: verifySvixSignature };
};
