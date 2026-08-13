// Signed unsubscribe tokens.
//
// The unsubscribe link has to work without a login, from an email client, on a
// phone, months later. That means the address travels in the URL, so the token
// is what stops the endpoint becoming a way to unsubscribe anybody whose email
// you can guess.
//
// Required env var: UNSUBSCRIBE_SECRET (any long random string)

const crypto = require('crypto');

const SECRET = process.env.UNSUBSCRIBE_SECRET || '';

function normalize(email) {
  return String(email || '').trim().toLowerCase();
}

/** Deterministic token for an address. Empty string when no secret is set. */
function sign(email) {
  if (!SECRET) return '';
  return crypto.createHmac('sha256', SECRET).update(normalize(email)).digest('base64url');
}

/** Constant-time comparison, so the token cannot be guessed a byte at a time. */
function verify(email, token) {
  const expected = sign(email);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function unsubscribeUrl(email) {
  const e = encodeURIComponent(normalize(email));
  return `https://www.midly.ai/api/unsubscribe?e=${e}&t=${sign(email)}`;
}

module.exports = { sign, verify, unsubscribeUrl, normalize };
