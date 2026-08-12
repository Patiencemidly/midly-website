// /api/contact — Vercel Function (Node runtime)
//
// Replaces the old Formspree pipeline. Accepts JSON form submissions from
// the marketing site, validates them, and sends two emails via Resend:
//   1. Notification to the team (default: patience@midly.ai)
//   2. Source-specific autoresponse to the submitter (from noreply@midly.ai)
//
// It then adds marketing leads to the Resend contact list, which is what makes
// a nurture sequence possible at all. Without it a captured email is only ever
// a notification sitting in an inbox, not a list anyone can send to.
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

// Which form sources join the marketing list. This is an allowlist, not a
// denylist, because the cost of the two mistakes is not symmetric: missing a
// lead is a lost email, while adding someone who only wanted to reach a human
// is unsolicited marketing. Investor enquiries (investor.html sends no source,
// so it lands on the 'Website' default) are deliberately absent.
const LIST_SOURCES = new Set([
  'Red Flag Checklist',
  'Demo Video Gate',
  'Sprint Page',
  'Enterprise Demo',
]);

// Add a lead to the contact list, without ever reviving an unsubscribe.
//
// contacts.create sets `unsubscribed: false`, so calling it for somebody who
// already opted out would silently opt them back in the next time they filled
// in any form. Look first, and leave an existing contact exactly as it is.
// Skipping rather than updating also preserves first-touch attribution: if a
// checklist reader later requests an enterprise demo, `source` should still
// say which asset actually earned the address.
async function addToList(resend, { email, name, source }) {
  const existing = await resend.contacts.get({ email });
  if (existing && existing.data) {
    return { skipped: 'already_on_list' };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  const created = await resend.contacts.create({
    email,
    unsubscribed: false,
    ...(parts.length ? { firstName: parts[0] } : {}),
    ...(parts.length > 1 ? { lastName: parts.slice(1).join(' ') } : {}),
    properties: { source },
  });

  if (created && created.error) {
    throw new Error(created.error.message || 'contact_create_failed');
  }
  return created;
}

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

    // Run these in parallel. Only the team notification is allowed to fail the
    // request: if the autoresponse or the audience write breaks, the lead is
    // still captured and we would rather log it than lose the submission.
    const tasks = [
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
    ];

    if (LIST_SOURCES.has(source)) {
      tasks.push(addToList(resend, { email, name, source }));
    }

    const [notifyResult, autoResult, listResult] = await Promise.allSettled(tasks);

    if (notifyResult.status === 'rejected') {
      console.error('[contact] notification send failed', notifyResult.reason);
      return res.status(500).json({ error: 'send_failed' });
    }
    if (autoResult.status === 'rejected') {
      console.warn('[contact] autoresponse send failed (non-blocking)', autoResult.reason);
    }
    if (listResult && listResult.status === 'rejected') {
      console.warn('[contact] contact list add failed (non-blocking)', listResult.reason);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] unexpected error', err);
    return res.status(500).json({ error: 'send_failed' });
  }
};
