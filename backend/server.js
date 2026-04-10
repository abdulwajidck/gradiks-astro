require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI;

app.use(express.json());
app.use(cors({ origin: true }));
app.set('trust proxy', true);

// --- DB Connection ---
let db;
async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB');
  await db.collection('submissions').createIndex({ submitted_at: -1 });
  await db.collection('submissions').createIndex({ form_type: 1 });
}

// --- API: Form Submission ---
app.post('/api/submit', async (req, res) => {
  try {
    const d = req.body;
    await db.collection('submissions').insertOne({
      form_type: d.form_type || 'unknown',
      page_url: d.page_url || '',
      name: d.name || '',
      phone: d.phone || '',
      email: d.email || '',
      neet_score: d.neet_score || '',
      pcb_percentage: d.pcb_percentage || '',
      preferred_country: d.preferred_country || '',
      program_interest: d.program_interest || '',
      questions: d.questions || '',
      message: d.message || '',
      gclid: d.gclid || '',
      utm_source: d.utm_source || '',
      utm_medium: d.utm_medium || '',
      utm_campaign: d.utm_campaign || '',
      utm_term: d.utm_term || '',
      utm_content: d.utm_content || '',
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      user_agent: req.headers['user-agent'] || '',
      referrer: d.referrer || req.headers['referer'] || '',
      submitted_at: new Date(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// --- Admin: View Data (password-protected) ---
const ADMIN_KEY = process.env.ADMIN_KEY || 'gradiks2026';

app.get('/admin/data', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'Add ?key=YOUR_KEY to access' });
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const filter = {};
    if (req.query.type) filter.form_type = req.query.type;
    if (req.query.search) {
      const s = req.query.search;
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }
    const [entries, total, formTypes] = await Promise.all([
      db.collection('submissions').find(filter).sort({ submitted_at: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      db.collection('submissions').countDocuments(filter),
      db.collection('submissions').distinct('form_type'),
    ]);
    res.json({ total, page, pages: Math.ceil(total / limit), formTypes, entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/export', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).send('Unauthorized');
  try {
    const filter = {};
    if (req.query.type) filter.form_type = req.query.type;
    const entries = await db.collection('submissions').find(filter).sort({ submitted_at: -1 }).toArray();
    const headers = ['Date','Form Type','Name','Phone','Email','NEET Score','PCB %','Country','Program','Questions','Message','GCLID','UTM Source','UTM Medium','UTM Campaign','IP','Page URL'];
    const rows = [headers.join(',')];
    for (const e of entries) {
      rows.push([e.submitted_at?new Date(e.submitted_at).toISOString():'', e.form_type,e.name,e.phone,e.email,e.neet_score,e.pcb_percentage,e.preferred_country,e.program_interest,e.questions,e.message,e.gclid,e.utm_source,e.utm_medium,e.utm_campaign,e.ip,e.page_url].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));
    }
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition',`attachment; filename=gradiks-leads-${new Date().toISOString().slice(0,10)}.csv`);
    res.send(rows.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Serve Astro static build ---
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  const fs = require('fs');
  const clean = req.path.replace(/\/$/, '');
  const htmlFile = path.join(distPath, clean, 'index.html');
  const directFile = path.join(distPath, clean + '.html');
  if (fs.existsSync(htmlFile)) return res.sendFile(htmlFile);
  if (fs.existsSync(directFile)) return res.sendFile(directFile);
  res.status(404).sendFile(path.join(distPath, '404.html'), err => {
    if (err) res.status(404).send('Page not found');
  });
});

// --- Start ---
connectDB().then(() => {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}).catch(err => {
  console.error('MongoDB failed:', err.message);
  app.listen(PORT, () => console.log(`API running on port ${PORT} (no DB)`));
});
