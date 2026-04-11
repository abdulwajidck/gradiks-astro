#!/usr/bin/env node
// Cranl Cron Job: checks TeleCRM API, sends email alert on failure via AgentMail
// Zero dependencies — uses Node built-in fetch

const AGENTMAIL_API_KEY = 'am_us_1e68249cc9475f6db7a14a01a6a7fdd3a6be7be04b5c65ba13d98ca00baf3673';
const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';
const ALERT_EMAIL = 'abdulwajidck@gmail.com';
const FROM_INBOX = 'stakque@agentmail.to';

async function sendAlert(subject, body) {
  try {
    const res = await fetch(`${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(FROM_INBOX)}/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: ALERT_EMAIL,
        subject: subject,
        text: body,
      }),
    });
    if (res.ok) {
      console.log('Alert email sent to', ALERT_EMAIL, 'via AgentMail');
    } else {
      const err = await res.text();
      console.log('AgentMail returned', res.status, err);
    }
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
}

async function checkTeleCRM() {
  try {
    const res = await fetch('https://next-api.telecrm.in/enterprise/69a16e9a4ce16643f28061a1/autoupdatelead', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer bc0b7478-97ce-49b2-b96c-13ef444898311775379897519:0ba13bb8-04fb-4ec6-a9f8-e2ba4e6879f7',
      },
      body: JSON.stringify({ fields: { name: '__healthcheck__', phone: '+910000000000' } }),
    });
    return { ok: res.status === 200, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  const now = new Date().toISOString();
  console.log(`[${now}] TeleCRM health check started`);

  const result = await checkTeleCRM();
  console.log(`  TeleCRM: ${result.ok ? 'OK (HTTP ' + result.status + ')' : 'FAIL — ' + (result.error || 'HTTP ' + result.status)}`);

  if (!result.ok) {
    console.log('  ALERT: TeleCRM is down!');
    await sendAlert(
      'Gradiks Alert — TeleCRM Down',
      `TeleCRM API is DOWN as of ${now}.\n\n${result.error || 'HTTP ' + result.status}\n\nCheck immediately.`
    );
    process.exit(1);
  }

  console.log('  TeleCRM healthy.');
  process.exit(0);
})();
