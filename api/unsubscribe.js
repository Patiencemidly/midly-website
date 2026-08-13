// /api/unsubscribe: one click opt out from the nurture sequence.
//
// Reached from a link in the email footer and from the List-Unsubscribe header,
// so it must work with no session, from any mail client, long after the send.
// The address is in the query string and the signature is what stops this being
// a way to unsubscribe anyone whose email you can guess.
//
// Required env vars: RESEND_API_KEY, UNSUBSCRIBE_SECRET

const { Resend } = require('resend');
const { verify, normalize } = require('../lib/unsubscribe-token.js');

function page(title, message) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f5f3;color:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
  <div style="max-width:460px;background:#fff;border:1px solid #e8e8e4;border-radius:12px;padding:36px 32px;">
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5a8a00;font-weight:600;margin-bottom:20px;">Midly</div>
    <h1 style="font-size:20px;margin:0 0 10px;letter-spacing:-.02em;">${title}</h1>
    <p style="margin:0;color:#56564e;line-height:1.6;font-size:15px;">${message}</p>
    <p style="margin:24px 0 0;font-size:14px;"><a href="https://www.midly.ai" style="color:#5a8a00;font-weight:600;">Back to midly.ai</a></p>
  </div>
</body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const query = req.query || {};
  const email = normalize(query.e);
  const token = query.t;

  if (!email || !verify(email, token)) {
    // Deliberately vague: this page should not confirm whether an address is
    // on the list to somebody guessing at links.
    return res
      .status(400)
      .send(page('That link did not work', 'It may have been truncated by your email client. Reply to any of our emails and we will take you off the list by hand.'));
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[unsubscribe] RESEND_API_KEY missing');
    return res.status(500).send(page('Something went wrong', 'Please reply to any of our emails and we will take you off the list.'));
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.contacts.update({ email, unsubscribed: true });
    if (result && result.error) throw new Error(result.error.message || 'update_failed');
  } catch (err) {
    console.error('[unsubscribe] failed', err);
    return res.status(500).send(page('Something went wrong', 'Please reply to any of our emails and we will take you off the list.'));
  }

  return res
    .status(200)
    .send(page('You are unsubscribed', 'You will not get any more marketing email from us. The red flags checklist is still yours to keep.'));
};
