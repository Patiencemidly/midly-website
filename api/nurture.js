// /api/nurture: the daily lead nurture drip.
//
// Sweeps the Resend contact list once a day and sends each contact the email
// that matches how long ago they joined. Same shape as the app's
// onboarding-drip cron, with one difference: the state lives on the Resend
// contact rather than on a Clerk user, because these people have no account.
//
// Required env vars:
//   RESEND_API_KEY
//   CRON_SECRET         Vercel sends this as `Authorization: Bearer <secret>`
//   UNSUBSCRIBE_SECRET  Signs the footer opt-out link
//
// Optional env vars:
//   NURTURE_ENABLED  Must be exactly "1" to actually send. Anything else runs
//                    a dry run that reports what it WOULD send and sends
//                    nothing, so deploying this file cannot email anyone by
//                    accident before the copy is signed off.
//   NURTURE_FROM     Default: "Patience at Midly <hello@midly.ai>"
//
// Idempotency: each send writes `nurture_step` on the contact. A step is only
// sent when the contact's recorded step is lower, so a retry, an overlapping
// run, or a manual re-trigger cannot double send.

const { Resend } = require('resend');
const { renderNurtureEmail, dueStep, SEQUENCE } = require('../lib/nurture-emails.js');

const FROM_ADDRESS = process.env.NURTURE_FROM || 'Patience at Midly <hello@midly.ai>';
const REPLY_TO = 'hello@midly.ai';
const DAY_MS = 24 * 60 * 60 * 1000;

// Bound the work one invocation will do. Nothing is silently dropped: if the
// cap is hit it is reported in the response and the rest go out tomorrow.
const MAX_SENDS_PER_RUN = 200;
const PAGE_SIZE = 100;

/** Resend returns properties as { key: { type, value } }. */
function readProperty(properties, key) {
  const entry = properties && properties[key];
  return entry && entry.value !== undefined ? entry.value : undefined;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[nurture] RESEND_API_KEY missing');
    return res.status(500).json({ error: 'config_missing' });
  }
  if (!process.env.UNSUBSCRIBE_SECRET) {
    // Without this the footer link cannot be signed, and mail with a dead
    // unsubscribe link is worse than mail not sent.
    console.error('[nurture] UNSUBSCRIBE_SECRET missing');
    return res.status(500).json({ error: 'config_missing' });
  }

  const dryRun = process.env.NURTURE_ENABLED !== '1';
  const resend = new Resend(apiKey);
  const now = Date.now();

  const summary = { dryRun, scanned: 0, due: 0, sent: 0, skipped: {}, capped: false, errors: [] };
  const skip = (reason) => {
    summary.skipped[reason] = (summary.skipped[reason] || 0) + 1;
  };

  try {
    let after;
    let more = true;

    while (more) {
      const page = await resend.contacts.list({ limit: PAGE_SIZE, ...(after ? { after } : {}) });
      if (page.error) throw new Error(page.error.message || 'list_failed');

      const contacts = (page.data && page.data.data) || [];
      if (!contacts.length) break;

      for (const contact of contacts) {
        summary.scanned += 1;

        if (contact.unsubscribed) {
          skip('unsubscribed');
          continue;
        }

        const joinedAt = Date.parse(contact.created_at);
        if (Number.isNaN(joinedAt)) {
          skip('bad_created_at');
          continue;
        }

        const step = dueStep(Math.floor((now - joinedAt) / DAY_MS));
        if (!step) {
          skip('too_new');
          continue;
        }
        summary.due += 1;

        // The list response carries no properties, so read the contact only
        // for the ones that could plausibly need a send today.
        const full = await resend.contacts.get({ email: contact.email });
        const properties = (full.data && full.data.properties) || {};

        if (readProperty(properties, 'converted') === 'yes') {
          skip('converted');
          continue;
        }

        const lastStep = Number(readProperty(properties, 'nurture_step') || 0);
        if (lastStep >= step) {
          skip('already_sent');
          continue;
        }

        if (summary.sent >= MAX_SENDS_PER_RUN) {
          summary.capped = true;
          break;
        }

        if (dryRun) {
          summary.sent += 1;
          console.log(`[nurture] DRY RUN would send step ${step} to ${contact.email}`);
          continue;
        }

        const mail = renderNurtureEmail(step, { email: contact.email });
        const sent = await resend.emails.send({
          from: FROM_ADDRESS,
          to: contact.email,
          replyTo: REPLY_TO,
          subject: mail.subject,
          html: mail.html,
          headers: {
            'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        if (sent && sent.error) throw new Error(sent.error.message || 'send_failed');

        // Record the step only after a successful send. The other order would
        // silently skip anyone whose send failed.
        await resend.contacts.update({
          email: contact.email,
          properties: { nurture_step: step, nurture_last_sent: new Date(now).toISOString() },
        });

        summary.sent += 1;
        await sleep(250);
      }

      if (summary.capped) break;
      more = Boolean(page.data && page.data.has_more);
      after = contacts[contacts.length - 1].id;
    }
  } catch (err) {
    console.error('[nurture] run failed', err);
    summary.errors.push(String((err && err.message) || err));
    return res.status(500).json(summary);
  }

  if (summary.capped) {
    console.warn(`[nurture] hit the ${MAX_SENDS_PER_RUN} send cap, remainder goes out tomorrow`);
  }
  console.log('[nurture]', JSON.stringify(summary));
  return res.status(200).json({ ...summary, steps: SEQUENCE.map((s) => ({ step: s.step, day: s.day })) });
};
