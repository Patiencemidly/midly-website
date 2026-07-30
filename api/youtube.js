// /api/youtube — Vercel Function (Node runtime)
//
// Backs the private script studio at /youtube. Two stages:
//
//   POST /api/youtube?stage=topics   → pitches 3 stories from today's news
//   POST /api/youtube?stage=script   → writes the full script for the one she picked
//
// Both stages call Claude with web search turned on, so the output is grounded
// in real headlines from the last 48 hours rather than the model's memory.
//
// Responses are streamed back as NDJSON so the browser can show progress
// instead of a blank screen for two minutes. Each line is one JSON envelope:
//   {"t":"status","v":"Searching the news"}
//   {"t":"text","v":"partial model output"}
//   {"t":"done"}
//   {"t":"error","v":"message"}
//
// Required env vars:
//   ANTHROPIC_API_KEY   Claude API key
//   YOUTUBE_PASSCODE    Shared secret. The endpoint refuses to run without it,
//                       because this deploys to a public domain.

const Anthropic = require('@anthropic-ai/sdk');
const { PERSONA, topicsPrompt, scriptPrompt } = require('../lib/youtube-persona');

const MODEL = 'claude-opus-5';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Fail closed. An unset passcode on a public marketing domain would leave an
  // API-key-spending endpoint open to the internet.
  const expected = process.env.YOUTUBE_PASSCODE;
  if (!expected) {
    return res.status(503).json({ error: 'passcode_not_configured' });
  }
  if (req.headers['x-youtube-passcode'] !== expected) {
    return res.status(401).json({ error: 'bad_passcode' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'anthropic_key_missing' });
  }

  const stage = req.query.stage === 'script' ? 'script' : 'topics';
  const body = typeof req.body === 'object' && req.body ? req.body : {};

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  let prompt;
  if (stage === 'script') {
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!topic) return res.status(400).json({ error: 'missing_topic' });
    prompt = scriptPrompt(today, topic);
  } else {
    const avoid = Array.isArray(body.avoid)
      ? body.avoid.filter((a) => typeof a === 'string').slice(0, 20)
      : [];
    prompt = topicsPrompt(today, avoid);
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  // Nginx-style proxies buffer by default, which would defeat the streaming.
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (t, v) => {
    res.write(JSON.stringify(v === undefined ? { t } : { t, v }) + '\n');
  };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    send('status', stage === 'script' ? 'Pulling the primary sources' : 'Reading the news');

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: stage === 'script' ? 32000 : 8000,
      system: PERSONA,
      thinking: { type: 'adaptive' },
      output_config: { effort: stage === 'script' ? 'high' : 'medium' },
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: stage === 'script' ? 14 : 10 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 },
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    let searches = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'server_tool_use') {
          searches += 1;
          send('status', `Checking sources (${searches})`);
        } else if (block.type === 'text') {
          send('status', stage === 'script' ? 'Writing the script' : 'Picking the three');
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          send('text', event.delta.text);
        }
      }
    }

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      send('error', 'Claude declined this one. Try a different story.');
    } else if (message.stop_reason === 'max_tokens') {
      send('error', 'Ran out of room before finishing. Try again.');
    } else {
      send('done');
    }
  } catch (err) {
    console.error('youtube function error:', err);
    // Headers are already sent by this point, so the error has to ride the
    // stream rather than an HTTP status.
    send('error', err && err.message ? err.message : 'Something went wrong.');
  }

  res.end();
};
