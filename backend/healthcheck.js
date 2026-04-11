#!/usr/bin/env node
// Cranl Cron Job: checks TeleCRM API, sends email alert on failure
// Zero dependencies — uses Node built-in fetch and SMTP via nodemailer-free approach

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'abdulwajidck@gmail.com';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

async function sendEmail(subject, body) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('[NO SMTP] Would have sent:', subject);
    return;
  }
  try {
    // Use Gmail SMTP via raw HTTPS request (no nodemailer needed)
    const auth = btoa(`${SMTP_USER}:${SMTP_PASS}`);
    const message = [
      `From: ${SMTP_USER}`,
      `To: ${ALERT_EMAIL}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\r\n');

    const raw = btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (res.ok) console.log('Alert email sent to', ALERT_EMAIL);
    else console.log('Email API returned', res.status, '— falling back to console alert');
  } catch (e) {
    console.error('Email send failed:', e.message);
    console.log('ALERT:', subject, '-', body);
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
    await sendEmail(
      'Gradiks Alert — TeleCRM Down',
      `TeleCRM API is DOWN as of ${now}.\n\n${result.error || 'HTTP ' + result.status}\n\nCheck immediately.`
    );
    process.exit(1);
  }

  console.log('  TeleCRM healthy.');
  process.exit(0);
})();
