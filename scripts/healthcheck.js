#!/usr/bin/env node
// Cranl Cron Job: checks TeleCRM + MongoDB, logs results, sends email on failure
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI;
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'abdulwajidck@gmail.com';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

async function sendEmail(subject, body) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('[NO SMTP CONFIGURED] Would have sent:', subject);
    return;
  }
  try {
    const nodemailer = require('nodemailer');
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await t.sendMail({ from: SMTP_USER, to: ALERT_EMAIL, subject, text: body });
    console.log('Alert email sent to', ALERT_EMAIL);
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

async function checkMongoDB() {
  let client;
  try {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const count = await client.db().collection('submissions').countDocuments();
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

(async () => {
  const now = new Date().toISOString();
  console.log(`[${now}] Health check started`);

  const [telecrm, mongodb] = await Promise.all([checkTeleCRM(), checkMongoDB()]);

  console.log(`  TeleCRM: ${telecrm.ok ? 'OK' : 'FAIL — ' + (telecrm.error || 'HTTP ' + telecrm.status)}`);
  console.log(`  MongoDB: ${mongodb.ok ? 'OK (' + mongodb.count + ' entries)' : 'FAIL — ' + mongodb.error}`);

  const failures = [];
  if (!telecrm.ok) failures.push('TeleCRM: ' + (telecrm.error || 'HTTP ' + telecrm.status));
  if (!mongodb.ok) failures.push('MongoDB: ' + mongodb.error);

  if (failures.length > 0) {
    console.log('  ALERT: Services down!');
    await sendEmail(
      'Gradiks API Alert — Service Down',
      `Services DOWN as of ${now}:\n\n${failures.join('\n')}\n\nCheck immediately.`
    );
    process.exit(1);
  }

  console.log('  All services healthy.');
  process.exit(0);
})();
