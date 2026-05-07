/**
 * chat-server.js — Gradiks Hermes Chat API
 *
 * Architecture:
 *   Widget → Express → hermes subprocess (hermes chat -q)
 *            → session store → response + action → widget
 *
 * Hermes does all reasoning. Express is a thin relay + session manager.
 */

require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const PORT = process.env.CHAT_PORT || 3002;

// ─── Session Store ────────────────────────────────────────────────────────────
const sessions = new Map();

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── System Prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(pageData, lead, stage) {
  const stageDescriptions = {
    1: 'ENGAGED — just started chatting. Do not ask for any information yet.',
    2: 'WARM — shown interest in a topic. Consider asking their name naturally.',
    3: 'HOT — provided their name. Ask for email when they seem serious about a country.',
    4: 'QUALIFIED — have name + email. Ask for WhatsApp when they say "call me" or "interested".',
  };

  let countryContext = '';
  if (pageData?.country) {
    countryContext = `\nThe visitor is on a page about ${pageData.country}.`;
  } else if (pageData?.countries?.length > 0) {
    const names = pageData.countries.map(c => `${c.flag} ${c.name}`).join(', ');
    countryContext = `\nAvailable countries: ${names}.`;
  }

  let factsContext = '';
  if (pageData?.keyFacts?.length > 0) {
    factsContext = '\nKey facts:\n' + pageData.keyFacts.map(f => `• ${f}`).join('\n');
  }

  let faqsContext = '';
  if (pageData?.faqs?.length > 0) {
    faqsContext = '\nFAQs:\n' + pageData.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
  }

  return `You are Priya, a senior advisor at Gradiks Global — a study abroad consultancy in Kerala, India. You help Indian students (17–25, just finished 12th) figure out nursing or MBBS abroad.

PERSONALITY: Warm, direct, honest. Real numbers. Real university names. No hype. Ask questions to qualify — don't pitch until you understand their profile.

STAGE: ${stageDescriptions[stage] || 'ENGAGED'}

${lead?.name ? `Visitor's name: ${lead.name}` : ''}
${lead?.email ? `Visitor's email: ${lead.email}` : ''}
${lead?.phone ? `Visitor's phone: ${lead.phone}` : ''}

PAGE CONTEXT:
Program: ${pageData?.program || 'nursing/mbbs'}
Page: ${pageData?.pageKey || 'unknown'}
Title: ${pageData?.pageTitle || ''}${countryContext}${factsContext}${faqsContext}

RULES:
- Answer using the page data provided. If you don't have specific info, say so honestly.
- Collect name → email → phone in that order, one at a time, at appropriate moments.
- Never ask for all fields at once.
- When you have name + email + phone, respond with action: "qualify_lead" in your JSON.
- Never say you're an AI. Never break character.

Response format (JSON only, no markdown, no explanation):
{
  "text": "your message to the visitor",
  "action": null | "ask_name" | "ask_email" | "ask_phone" | "qualify_lead",
  "nextStage": 1 | 2 | 3 | 4,
  "captureField": null | "name" | "email" | "phone",
  "capturePrompt": null | "question to ask"
}`;
}

// ─── Hermes Integration ───────────────────────────────────────────────────────
function callHermes(systemPrompt, conversationHistory) {
  return new Promise((resolve, reject) => {
    const historyText = conversationHistory
      .map(m => `${m.from === 'visitor' ? 'Visitor' : 'Priya'}: ${m.text}`)
      .join('\n');

    const fullPrompt = historyText
      ? `${systemPrompt}\n\nCONVERSATION SO FAR:\n${historyText}\n\nVisitor's next message:`
      : `${systemPrompt}\n\nStart the conversation with a greeting and an open question about what they're looking for.`;

    const args = [
      'chat',
      '-q', fullPrompt,
      '--provider', 'minimax',
      '--model', 'MiniMax-M2.7-highspeed',
      '--quiet',
    ];

    const proc = spawn('hermes', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('error', (err) => {
      reject(new Error(`Hermes spawn error: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0 && stderr) {
        console.error('[Hermes stderr]', stderr.slice(-500));
      }

      // Parse JSON from stdout
      const trimmed = stdout.trim();

      // Try to extract JSON block
      let jsonStr = trimmed;
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      try {
        const parsed = JSON.parse(jsonStr);
        resolve(parsed);
      } catch (e) {
        // Fallback: return as plain text reply
        console.warn('[Hermes] Could not parse JSON, using raw text:', trimmed.slice(0, 200));
        resolve({
          text: trimmed || "I'm having trouble responding right now. Please try again.",
          action: null,
          nextStage: 1,
          captureField: null,
          capturePrompt: null,
        });
      }
    });
  });
}

// ─── TeleCRM ─────────────────────────────────────────────────────────────────
async function sendToTeleCRM(lead, pageKey, tracking, pageData) {
  const TELECRM_URL = 'https://next-api.telecrm.in/enterprise/69a16e9a4ce16643f28061a1/autoupdatelead';
  const TELECRM_KEY = process.env.TELECRM_KEY || 'Bearer bc0b7478-97ce-49b2-b96c-13ef444898311775379897519:0ba13bb8-04fb-4ec6-a9f8-e2ba4e6879f7';

  function formatPhone(p) {
    p = (p || '').replace(/[\s\-]/g, '');
    return p.startsWith('+') ? p : '+91' + p.replace(/^0+/, '');
  }

  const notes = [
    'Source: Gradiks Chat Widget',
    `Program: ${pageData?.program || pageKey}`,
    `Country: ${pageData?.country || 'not specified'}`,
    tracking?.gclid ? `GCLID: ${tracking.gclid}` : '',
    tracking?.utm_source ? `UTM: ${tracking.utm_source}/${tracking.utm_campaign}` : '',
  ].filter(Boolean).join(' | ');

  const payload = {
    fields: {
      name: lead?.name || '',
      phone: formatPhone(lead?.phone || ''),
      email: lead?.email || '',
      lead_source: 'Chat Widget',
      facebook_campaign_name: pageKey || 'gradiks-web',
      notes,
    },
  };

  try {
    await fetch(TELECRM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': TELECRM_KEY },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    console.log(`[TeleCRM] Lead sent: ${lead?.name} (${lead?.phone})`);
  } catch (err) {
    console.error('[TeleCRM] Error:', err.message);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/chat/start */
app.post('/api/chat/start', (req, res) => {
  const { pageKey, program, country, tracking } = req.body;
  const sessionId = uid();
  sessions.set(sessionId, {
    id: sessionId,
    pageKey,
    program,
    country,
    stage: 1,
    lead: { name: '', email: '', phone: '' },
    messages: [],
    pageData: null,
    tracking: tracking || {},
    createdAt: new Date(),
    lastSeen: new Date(),
  });
  res.json({ ok: true, sessionId });
});

/** POST /api/chat/message */
app.post('/api/chat/message', async (req, res) => {
  const { sessionId, message, pageData: clientPageData } = req.body;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(400).json({ error: 'No session found. POST /start first.' });
  }

  // Update session page data from client (may be more current)
  if (clientPageData) {
    session.pageData = clientPageData;
  }

  session.messages.push({ from: 'visitor', text: message, ts: Date.now() });
  session.lastSeen = new Date();

  const systemPrompt = buildSystemPrompt(session.pageData, session.lead, session.stage);

  try {
    const hermesResponse = await callHermes(systemPrompt, session.messages);

    session.messages.push({ from: 'bot', text: hermesResponse.text, ts: Date.now() });
    session.lastSeen = new Date();

    // Update lead from hermes action
    if (hermesResponse.captureField && hermesResponse.action) {
      // Field capture is handled client-side
      // Server tracks stage
      if (hermesResponse.nextStage > session.stage) {
        session.stage = hermesResponse.nextStage;
      }
    }

    // If qualify_lead, send to TeleCRM
    if (hermesResponse.action === 'qualify_lead') {
      await sendToTeleCRM(session.lead, session.pageKey, session.tracking, session.pageData);
    }

    res.json({
      ok: true,
      text: hermesResponse.text,
      action: hermesResponse.action,
      nextStage: hermesResponse.nextStage,
      captureField: hermesResponse.captureField,
      capturePrompt: hermesResponse.capturePrompt,
    });
  } catch (err) {
    console.error('[message] Error:', err.message);
    res.status(500).json({ error: 'Failed to get response', detail: err.message });
  }
});

/** POST /api/chat/capture — visitor submitted a field (name/email/phone) */
app.post('/api/chat/capture', (req, res) => {
  const { sessionId, field, value } = req.body;
  const session = sessions.get(sessionId);

  if (session && field) {
    session.lead[field] = value;
  }

  // Determine next stage
  let nextStage = 1;
  if (field === 'name') nextStage = 2;
  if (field === 'email') nextStage = 3;
  if (field === 'phone') nextStage = 4;

  if (session) {
    session.stage = nextStage;
    session.lastSeen = new Date();
  }

  res.json({ ok: true, nextStage });
});

/** GET /api/chat/poll/:sessionId — long-poll for bot response (future real-time) */
app.get('/poll/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.json({ reply: null, action: null, nextStage: null });
  }

  // For now, response is synchronous via /message
  // This endpoint exists for future WebSocket upgrades
  res.json({ reply: null, action: null, nextStage: null });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Gradiks Chat] API running on port ${PORT}`);
  console.log(`[Gradiks Chat] Hermes model: MiniMax-M2.7-highspeed`);
});
