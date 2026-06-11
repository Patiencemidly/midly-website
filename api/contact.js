// /api/contact — Vercel Function (Node runtime)
//
// Replaces the old Formspree pipeline. Accepts JSON form submissions from
// the marketing site, validates them, and sends two emails via Resend:
//   1. Notification to the team (default: patience@midly.ai)
//   2. Source-specific autoresponse to the submitter (from noreply@midly.ai)
//
// Required env vars:
//   RESEND_API_KEY  (set automatically by the Vercel Resend integration)
//
// Optional env vars:
//   NOTIFY_EMAIL    Default: patience@midly.ai
//   FROM_EMAIL      Default: "Midly <noreply@midly.ai>"
//
// Behavior:
//   POST JSON body         → { ok: true } on success, { error: <code> } on failure
//   Other methods          → 405
//   Honeypot _hp filled    → silent 200 (don't tell bots they failed)
//   Missing/invalid email  → 400 invalid_email

const { Resend } = require('resend');
const { renderAutoresponse, renderNotification } = require('../lib/emails.js');

const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'patience@midly.ai';
const FROM_ADDRESS = process.env.FROM_EMAIL || 'Midly <noreply@midly.ai>';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Vercel auto-parses application/json into req.body when Content-Type is set.
  // Fall back to manual parse if it arrives as a string.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: if a bot filled the hidden _hp field, fake success.
  if (body._hp && String(body._hp).trim()) {
    return res.status(200).json({ ok: true });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 200);
  const source = String(body.source || 'Website').trim().slice(0, 80) || 'Website';

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  // Strip control fields from the notification payload.
  const { _hp, _subject, ...rest } = body;
  // Always include email + name as the first rows for readability.
  const fields = { email, ...(name ? { name } : {}), ...rest };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY missing');
    return res.status(500).json({ error: 'config_missing' });
  }
  const resend = new Resend(apiKey);

  try {
    const notification = renderNotification({ source, fields, email, name });
    const autoresponse = renderAutoresponse({ source, name });

    // Send both in parallel. If the autoresponse fails we still consider the
    // submission successful — the team got the lead.
    const [notifyResult, autoResult] = await Promise.allSettled([
      resend.emails.send({
        from: FROM_ADDRESS,
        to: NOTIFY_TO,
        replyTo: email,
        subject: body._subject || notification.subject,
        html: notification.html,
      }),
      resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: autoresponse.subject,
        html: autoresponse.html,
      }),
    ]);

    if (notifyResult.status === 'rejected') {
      console.error('[contact] notification send failed', notifyResult.reason);
      return res.status(500).json({ error: 'send_failed' });
    }
    if (autoResult.status === 'rejected') {
      console.warn('[contact] autoresponse send failed (non-blocking)', autoResult.reason);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] unexpected error', err);
    return res.status(500).json({ error: 'send_failed' });
  }
};
