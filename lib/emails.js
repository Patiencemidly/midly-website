// Email templates for the /api/contact endpoint.
// All HTML is inline-styled so it renders correctly across email clients
// (Gmail strips <style> blocks, Outlook ignores most external CSS).

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const BRAND_GREEN = '#5a8a00';

// ──────────────────────────────────────────────────────────────────────────
// Notification email (sent to the team when a form is submitted)
// ──────────────────────────────────────────────────────────────────────────
function renderNotification({ source, fields, email, name }) {
  const rows = Object.entries(fields)
    .filter(([k, v]) => v != null && String(v).trim() !== '' && !k.startsWith('_'))
    .map(([k, v]) => `<tr>
      <td style="padding:10px 14px;background:#f7f7f5;font-size:12px;font-weight:600;color:#3a3a3a;letter-spacing:0.02em;text-transform:uppercase;border-bottom:1px solid #e8e8e4;vertical-align:top;width:160px;">${escapeHtml(k)}</td>
      <td style="padding:10px 14px;font-size:14px;color:#0a0a0a;border-bottom:1px solid #e8e8e4;line-height:1.5;">${escapeHtml(v).replace(/\n/g, '<br>')}</td>
    </tr>`)
    .join('');

  const subject = `New ${source} submission${name ? ' from ' + name : ''}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f2;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e8e8e4;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 28px;border-bottom:1px solid #e8e8e4;">
      <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND_GREEN};font-weight:600;margin-bottom:6px;">${escapeHtml(source)}</div>
      <h1 style="font-size:18px;margin:0;color:#0a0a0a;font-weight:700;letter-spacing:-0.01em;">New form submission</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
    <div style="padding:16px 28px;font-size:12px;color:#666;background:#f7f7f5;border-top:1px solid #e8e8e4;">
      Reply directly to <a href="mailto:${escapeHtml(email)}" style="color:${BRAND_GREEN};text-decoration:none;font-weight:500;">${escapeHtml(email)}</a> to respond.
    </div>
  </div>
</body></html>`;

  return { subject, html };
}

// ──────────────────────────────────────────────────────────────────────────
// Autoresponse (sent to the submitter from noreply@midly.ai)
// ──────────────────────────────────────────────────────────────────────────
const TEMPLATES = {
  'Demo Video Gate': {
    subject: 'Thanks for watching the Midly demo',
    body: (name) => `<p style="margin:0 0 16px;">Hi ${name || 'there'},</p>
<p style="margin:0 0 16px;">Thanks for unlocking our product demo. Glad you got to see Midly in action.</p>
<p style="margin:0 0 16px;">If you'd like a deeper walkthrough tailored to your team's deal flow, you can book a 15-minute call directly: <a href="https://calendly.com/patience-midly/midly-demo" style="color:${BRAND_GREEN};">calendly.com/patience-midly/midly-demo</a></p>
<p style="margin:0 0 24px;">Or just hit reply with any questions. I read every email.</p>
<p style="margin:0;">Patience<br><span style="color:#666;font-size:14px;">Founder, Midly</span></p>`
  },
  'Sprint Page': {
    subject: 'Welcome to the Midly 5-Day Sprint',
    body: (name) => `<p style="margin:0 0 16px;">Hi ${name || 'there'},</p>
<p style="margin:0 0 16px;">You're in. We'll send the sprint resources over the next few days: what to set up, what to skip, and how to get your contract process airtight, day by day.</p>
<p style="margin:0 0 16px;">If you want a head start, you can create your free Midly account right now: <a href="https://app.midly.ai/sign-up" style="color:${BRAND_GREEN};">app.midly.ai/sign-up</a></p>
<p style="margin:0 0 24px;">Talk soon.</p>
<p style="margin:0;">Patience<br><span style="color:#666;font-size:14px;">Founder, Midly</span></p>`
  },
  'Sprint CTA': {
    subject: 'Welcome to the Midly 5-Day Sprint',
    body: (name) => `<p style="margin:0 0 16px;">Hi ${name || 'there'},</p>
<p style="margin:0 0 16px;">Glad you're getting started. We'll send the sprint resources over the next few days: what to set up, what to skip, and how to get your contract process airtight, day by day.</p>
<p style="margin:0 0 24px;">Your account is ready: <a href="https://app.midly.ai/sign-up" style="color:${BRAND_GREEN};">app.midly.ai/sign-up</a></p>
<p style="margin:0;">Patience<br><span style="color:#666;font-size:14px;">Founder, Midly</span></p>`
  },
  'Enterprise Demo': {
    subject: 'Your Midly demo request: next steps',
    body: (name) => `<p style="margin:0 0 16px;">Hi ${name || 'there'},</p>
<p style="margin:0 0 16px;">Thanks for requesting a Midly demo. I'll review your note and reach out within one business day to set up your 30-minute call.</p>
<p style="margin:0 0 16px;">If you'd rather pick a time now, you can book directly: <a href="https://calendly.com/patience-midly/midly-demo" style="color:${BRAND_GREEN};">calendly.com/patience-midly/midly-demo</a></p>
<p style="margin:0 0 24px;">Or just reply to this email with any questions. I read every one.</p>
<p style="margin:0;">Patience<br><span style="color:#666;font-size:14px;">Founder, Midly</span></p>`
  },
  'Red Flag Checklist': {
    subject: 'Your Founder\'s Contract Red-Flag Checklist',
    body: (name) => `<p style="margin:0 0 16px;">Hi ${name || 'there'},</p>
<p style="margin:0 0 16px;">Here's your copy of the checklist, so you've got it even if you close the tab: the 7 clauses I've seen burn founders most often, in plain English, with what to check instead.</p>
<ol style="margin:0 0 20px;padding-left:20px;">
  <li style="margin-bottom:14px;"><strong>Limitation of liability.</strong> Cap it at the fees paid (usually 12 months), and make sure the cap runs both ways.</li>
  <li style="margin-bottom:14px;"><strong>Indemnification.</strong> If it only obligates you to cover their claims, you're insuring their risk for free. Make it mutual and scope it to your own breach or negligence.</li>
  <li style="margin-bottom:14px;"><strong>Auto-renewal.</strong> Miss a 30- or 60-day cancellation window and you're locked in again. Shorten the notice window or strike it, and calendar the deadline the day you sign.</li>
  <li style="margin-bottom:14px;"><strong>IP assignment.</strong> Broad "work made for hire" language can sweep in tools or templates you built before the engagement, not just what you built for it. Carve out your pre-existing IP by name.</li>
  <li style="margin-bottom:14px;"><strong>Personal guarantee.</strong> Buried in an otherwise standard vendor agreement, it erases the liability protection your entity is supposed to give you. Read every signature block.</li>
  <li style="margin-bottom:14px;"><strong>Termination for convenience.</strong> If only the other side can walk away with no notice, you're carrying all the risk. Push for mutual rights or a real notice period.</li>
  <li style="margin-bottom:0;"><strong>Payment terms.</strong> Vague deadlines or an undated "pending review" clause is how a finished job turns into an unpaid invoice. Get fixed deadlines and late fees in writing.</li>
</ol>
<p style="margin:0 0 16px;">Midly checks for all seven of these automatically, against your own playbook, before you send or sign anything: <a href="https://app.midly.ai/sign-up" style="color:${BRAND_GREEN};">app.midly.ai/sign-up</a></p>
<p style="margin:0 0 24px;">Reply any time if you want a second set of eyes on something specific. I read every email.</p>
<p style="margin:0;">Patience<br><span style="color:#666;font-size:14px;">Founder &amp; Attorney, Midly</span></p>`
  },
  'Investor Inquiry': {
    subject: 'Thanks for your interest in Midly',
    body: (name) => `<p style="margin:0 0 16px;">Hi ${name || 'there'},</p>
<p style="margin:0 0 16px;">Thanks for reaching out about Midly. I'll review your note personally and be in touch within 24 hours with next steps.</p>
<p style="margin:0 0 24px;">In the meantime, our latest investor update and product walkthrough are available on request. Just reply to this email.</p>
<p style="margin:0;">Patience Babajide<br><span style="color:#666;font-size:14px;">Founder, Midly</span></p>`
  },
  'default': {
    subject: 'Thanks for reaching out to Midly',
    body: (name) => `<p style="margin:0 0 16px;">Hi ${name || 'there'},</p>
<p style="margin:0 0 24px;">Thanks for your message. We'll be in touch shortly.</p>
<p style="margin:0;">The Midly team</p>`
  }
};

function renderAutoresponse({ source, name }) {
  const tpl = TEMPLATES[source] || TEMPLATES.default;
  const safeName = escapeHtml(name);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(tpl.subject)}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f2;padding:32px 16px;line-height:1.6;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8e8e4;border-radius:12px;padding:36px 32px;">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_GREEN};font-weight:600;margin-bottom:24px;">Midly</div>
    <div style="font-size:15px;color:#1a1a1a;">
      ${tpl.body(safeName)}
    </div>
    <hr style="border:none;border-top:1px solid #e8e8e4;margin:32px 0 20px;">
    <div style="font-size:12px;color:#888;line-height:1.5;">
      Midly Labs Inc. &middot; <a href="https://midly.ai" style="color:#888;">midly.ai</a><br>
      You're receiving this because you submitted a form on midly.ai.
    </div>
  </div>
</body></html>`;

  return { subject: tpl.subject, html };
}

module.exports = { renderNotification, renderAutoresponse };
