// The lead nurture sequence: five emails over fourteen days.
//
// Audience: somebody who unlocked the red flags checklist and has not signed
// up. The checklist speaks to founders, not lawyers, so these do too.
//
// House rules that apply to every line in here:
//   - No em dashes or spaced double hyphens. The pre-commit hook enforces it.
//   - One new idea per email. A sequence that restates itself gets unsubscribed.
//   - Only the last three ask for the signup.
//
// Copy is deliberately separate from the cron that sends it, so editing a
// sentence never means touching the scheduling logic.

const { renderFooter } = require('./emails.js');
const { unsubscribeUrl } = require('./unsubscribe-token.js');

const BRAND_GREEN = '#5a8a00';
const SITE = 'https://www.midly.ai';
const APP_SIGNUP = 'https://app.midly.ai/sign-up';
const CALENDLY = 'https://calendly.com/patience-midly/midly-demo';

/** Tag every outbound link so the funnel is attributable in analytics. */
function tag(url, day) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=nurture&utm_medium=email&utm_campaign=red-flags&utm_content=day${day}`;
}

function link(url, day, text) {
  return `<a href="${tag(url, day)}" style="color:${BRAND_GREEN};font-weight:600;">${text}</a>`;
}

function button(url, day, text) {
  return `<p style="margin:22px 0;"><a href="${tag(url, day)}" style="display:inline-block;background:#c8f041;color:#0a0a0a;font-weight:700;font-size:15px;padding:12px 20px;border-radius:8px;text-decoration:none;">${text}</a></p>`;
}

const p = (s) => `<p style="margin:0 0 16px;">${s}</p>`;

// ---------------------------------------------------------------------------
// The sequence. `day` is days since the contact was created.
// ---------------------------------------------------------------------------
const SEQUENCE = [
  {
    step: 1,
    day: 2,
    subject: "The liability cap that isn't one",
    preview: 'Clause #1, one level deeper than the checklist went.',
    body: () =>
      p('You have clause #1 already: limitation of liability, and why the cap matters.') +
      p('Here is what the checklist did not have room for. A cap is only worth what sits inside it. The sentence to hunt for is the carve-out, usually some version of "except for breaches of confidentiality, indemnification obligations, and gross negligence." Everything on that list is uncapped.') +
      p('In most vendor paper those carve-outs are drafted broadly enough that the cap you negotiated covers almost nothing you were actually worried about.') +
      p('So the question is not whether there is a cap. It is what they lifted out of it.') +
      p(`I pulled apart a real MSA where the indemnity does exactly this: ${link(SITE + '/blog/teardown-velocity-global-msa', 2, 'Teardown: The Indemnity That Caps Itself')}`),
  },
  {
    step: 2,
    day: 4,
    subject: 'Why you skipped the review anyway',
    preview: 'It is not carelessness. It is arithmetic.',
    body: () =>
      p('Most founders I work with can spot a bad clause. They sign anyway.') +
      p('Not from carelessness. From arithmetic. A careful read of a 30 page MSA is three hours you do not have, or several hundred dollars you would rather put into the product. The deal feels worth more than the risk does, so the contract gets skimmed and signed.') +
      p('That arithmetic is the actual problem, and a checklist does not solve it, because a checklist still needs someone to sit down with the document.') +
      p(`I wrote up what the manual version really costs, including the parts that never show up as an invoice: ${link(SITE + '/blog/contract-workflow-cost', 4, 'The Real Cost of Manual Contract Workflows')}`) +
      p('What are you negotiating at the moment? Reply and tell me. I read every one.'),
  },
  {
    step: 3,
    day: 7,
    subject: 'Their paper, your terms, 15 minutes',
    preview: 'The hardest review there is, and how it goes faster.',
    body: () =>
      p("The hardest contract to review is the one that arrives on the other side's paper. Their template, their defaults, their carve-outs, and no clean version to compare it against.") +
      p('That is what I built Midly for. You upload the counterparty document and it comes back with the clauses that deviate, what each one exposes you to, and language to send back. Not a summary of the agreement. The specific clause, quoted, with the problem named.') +
      p(`The whole workflow, start to finish: ${link(SITE + '/blog/counterparty-paper-15-minutes', 7, 'Counterparty Paper, Reviewed in 15 Minutes')}`) +
      p('It is free to try. Bring a contract you are actually negotiating.') +
      button(APP_SIGNUP, 7, 'Run a review'),
  },
  {
    step: 4,
    day: 11,
    subject: 'Run it on a contract you already signed',
    preview: 'The only test of a contract tool worth anything.',
    body: () =>
      p('The reasonable objection to all of this: a model that has read the whole internet still has not read your contract, and legal judgment is not autocomplete.') +
      p(`Agreed. Which is why the thing that matters is whether the tool shows its work. Midly quotes the clause it is talking about, from your document, so you can check it against the page. A generic model will produce a confident paragraph about an indemnity that appears nowhere in your agreement. The difference, at length: ${link(SITE + '/blog/grounded-ai-vs-generic', 11, 'Grounded AI vs Generic AI')}`) +
      p('Here is the test I would run in your position. Take a contract you signed a year ago, one whose problems you already know, and put it through. If it finds what you already know, it has earned your next negotiation. If it does not, you are out four minutes.') +
      button(APP_SIGNUP, 11, 'Try it on an old contract'),
  },
  {
    step: 5,
    day: 14,
    subject: 'Last one from me',
    preview: 'Then I will leave you to it.',
    body: () =>
      p('This is the last email in this sequence, so I will be direct.') +
      p('You downloaded a checklist about clauses that burn founders. In my experience that means one of two things: there is a contract sitting in your inbox right now, or one you already signed has started to worry you.') +
      p('Either is worth twenty minutes on your own document.') +
      button(APP_SIGNUP, 14, 'Run a review') +
      p(`If you would rather talk to a person about a specific deal, my calendar is ${link(CALENDLY, 14, 'here')}.`) +
      p('And if the timing is simply wrong, that is fine. The checklist is yours either way.'),
  },
];

/** Render one step to sendable HTML. */
function renderNurtureEmail(step, { email }) {
  const entry = SEQUENCE.find((s) => s.step === step);
  if (!entry) throw new Error(`unknown nurture step: ${step}`);

  const unsub = unsubscribeUrl(email);
  const reason =
    'You are receiving this because you downloaded the contract red flags checklist on midly.ai.' +
    ` <a href="${unsub}" style="color:#888;">Unsubscribe</a>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${entry.subject}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f2;padding:32px 16px;line-height:1.6;color:#0a0a0a;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${entry.preview}</span>
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8e8e4;border-radius:12px;padding:36px 32px;">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_GREEN};font-weight:600;margin-bottom:24px;">Midly</div>
    <div style="font-size:15px;color:#1a1a1a;">
      ${entry.body()}
      <p style="margin:24px 0 0;color:#56564e;">Patience</p>
    </div>
    <hr style="border:none;border-top:1px solid #e8e8e4;margin:32px 0 20px;">
    ${renderFooter(reason)}
  </div>
</body></html>`;

  return { subject: entry.subject, html, unsubscribeUrl: unsub };
}

/**
 * The step a contact is due, given their age in days.
 *
 * Returns the LATEST step whose day has passed, not every missed one. If the
 * cron is down for a week, contacts get the message that fits where they are
 * now rather than four emails in one morning.
 */
function dueStep(ageInDays) {
  let due = null;
  for (const entry of SEQUENCE) {
    if (ageInDays >= entry.day) due = entry.step;
  }
  return due;
}

module.exports = { SEQUENCE, renderNurtureEmail, dueStep };
