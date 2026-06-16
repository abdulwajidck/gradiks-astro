# Gradiks — Lead Capture & Landing Page Site

**Live:** [learn.gradiks.com](https://learn.gradiks.com)
**Repo:** `abdulwajidck/gradiks-astro` (public)
**Stack:** Astro 6 · Tailwind CSS 4 · InstantDB · Express.js · Hermes AI Chat

---

## What This Is

This is the **lead generation and landing page site** for Gradiks Global — a study abroad consultancy based in Kerala, India, targeting Indian students (17–25) looking to study MBBS or Nursing abroad.

The site has two functions:
1. **Landing pages** for Google Ads / Meta Ads campaigns (country-specific, course-specific)
2. **AI-powered chat widget** ("Priya") that captures leads in real-time and pushes them to TeleCRM

---

## Architecture

```
Browser (landing page)
  ├── InstantDB SDK → Lead form submissions → InstantDB cloud
  └── Chat Widget (chat-client.js)
        ↓
      Express API (chat-server.js, port 3002)
        ↓
      Hermes subprocess (`hermes chat -q`)
        ↓
      MiniMax LLM → AI response
        ↓
      TeleCRM API → Lead pushed to CRM
```

---

## Project Structure

```
gradiks-astro/
├── public/
│   ├── chat/
│   │   └── chat-client.js          # Chat widget frontend (inline script)
│   ├── students/                    # Student testimonial photos
│   ├── russia/                      # Country-specific SVG assets
│   ├── gradiks-logo.png
│   ├── logo-2x.webp
│   └── favicon.*
├── src/
│   ├── components/
│   │   ├── Navigation.astro         # Site navbar
│   │   ├── Footer.astro             # Site footer
│   │   ├── MbbsCountryLp.astro      # Reusable MBBS landing page template
│   │   ├── NursingCountryLp.astro   # Reusable Nursing landing page template
│   │   ├── NursingHero.astro        # Nursing hero section
│   │   └── PageData.astro           # Injects page context for chat widget
│   ├── layouts/
│   │   ├── MainLayout.astro         # Warm theme (home page)
│   │   └── CountryLayout.astro      # Dark theme (country pages)
│   ├── pages/                       # All route pages (see below)
│   ├── scripts/
│   │   └── instantdb.js             # InstantDB lead capture
│   └── styles/
│       └── global.css               # Tailwind CSS imports
├── backend/
│   ├── chat-server.js               # Express API for Hermes chat
│   ├── server.js                    # Express form submission API (legacy)
│   ├── gradiks-chat-system-prompt.md # Priya AI persona prompt
│   ├── healthcheck.js               # Health endpoint
│   ├── cert.pem / key.pem          # SSL certs for HTTPS
│   ├── package.json
│   └── package-lock.json
├── .github/workflows/
│   └── deploy.yml                   # Cloudflare Pages CI/CD
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

---

## Pages (Routes)

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Main MBBS Abroad landing |
| MBBS New LP | `/mbbs-new-lp/` | New MBBS landing page variant |
| MBBS Thank You | `/mbbs-thank-you/` | Post-form submission thank you |
| Nursing Abroad | `/nursing-abroad/` | Nursing programs overview |
| Nursing College | `/nursing-college/` | Nursing college landing |
| Nursing Thank You | `/nursing-thank-you/` | Post-nursing-form thank you |
| Russia Study | `/russia-study/` | Russia MBBS landing |
| Kazakhstan Study | `/kazakhstan-study/` | Kazakhstan MBBS landing |
| Kyrgyzstan Study | `/kyrgyzstan-study/` | Kyrgyzstan MBBS landing |
| Georgia Study | `/georgia-study/` | Georgia MBBS landing |
| Uzbekistan Study | `/uzbekistan-study/` | Uzbekistan MBBS landing |
| UK Study | `/uk-study/` | UK programs landing |
| UK MBBS | `/uk-mbbs/` | UK MBBS specific |
| Germany Study | `/germany-study/` | Germany programs landing |
| Ireland Study | `/ireland-study/` | Ireland programs landing |
| India Medical | `/india-medical/` | NEET counselling landing |
| Nursing UK | `/nursing-uk/` | Nursing in UK |
| Nursing Malta | `/nursing-malta/` | Nursing in Malta |
| Nursing Bulgaria | `/nursing-bulgaria/` | Nursing in Bulgaria |
| Nursing Georgia | `/nursing-georgia/` | Nursing in Georgia |
| Nursing Albania | `/nursing-albania/` | Nursing in Albania |

**Adding a new country page:** Copy an existing `*CountryLp.astro` component, update the data props (country name, universities, fees, FAQ), and create a new `.astro` file in `src/pages/`.

---

## Theming

Two themes coexist:

- **MainLayout (Warm):** Coral, teal, cream — used for the home page
- **CountryLayout (Dark):** Red, black, gold — used for country-specific landing pages

---

## External Services

### InstantDB (Lead Storage)
- **App ID:** `c3c22ee1-9ee9-4a5f-89ae-0e5fa0085767`
- **Purpose:** Stores form submissions (leads) with UTM tracking, page URL, referrer
- **Schema:** `leads` collection with fields: name, email, phone, country, course, gclid, utm_*, page_url, referrer, submitted_at
- **Script:** `src/scripts/instantdb.js`

### TeleCRM (Lead CRM)
- **Endpoint:** `https://next-api.telecrm.in/enterprise/69a16e9a4ce16643f28061a1/autoupdatelead`
- **Purpose:** Pushes qualified chat leads to CRM for sales follow-up
- **Auth:** Bearer token (in chat-client.js)

### Hermes AI Chat ("Priya")
- **Backend:** `backend/chat-server.js` (Express, port 3002)
- **Architecture:** Widget → Express → `hermes chat -q` subprocess → MiniMax LLM
- **Persona:** Senior advisor at Gradiks Global, helps students with MBBS/Nursing abroad
- **Lead capture stages:**
  1. ENGAGED — just chatting, no asks
  2. WARM — ask for name naturally
  3. HOT — ask for email when serious about a country
  4. QUALIFIED — ask for WhatsApp when they say "call me"
- **System prompt:** `backend/gradiks-chat-system-prompt.md`
- **Session store:** In-memory Map (sessions reset on server restart)

### Cloudflare Pages (Hosting)
- **Deployment:** Automatic on push to `main` branch
- **Config:** `.github/workflows/deploy.yml`
- **Secrets required:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

## Setup & Development

### Prerequisites
- Node.js >= 22.12.0
- npm

### Local Development

```bash
# Frontend
npm install
npm run dev
# → http://localhost:4321

# Backend (chat server) — separate terminal
cd backend
npm install
node --watch server.js
# → https://localhost:3002 (needs cert.pem + key.pem)
```

### Build & Deploy

```bash
npm run build    # Outputs to ./dist/
npm run preview  # Preview build locally
```

Push to `main` → GitHub Actions → Cloudflare Pages auto-deploys.

---

## Environment Variables

The frontend has **no .env file** — all config is hardcoded (InstantDB app ID, TeleCRM endpoint).

The backend uses `dotenv` but no `.env` file is committed. Required vars:
- None currently — TeleCRM key is hardcoded in `chat-client.js`
- SSL certs (`cert.pem`, `key.pem`) are committed for the chat server

---

## Key Technical Notes

1. **Chat widget is a vanilla JS file** (`public/chat/chat-client.js`) — no framework, no build step. Embed with `<script src="/chat/chat-client.js" is:inline></script>`
2. **PageData.astro** injects `window.__GRADIKS_PAGE_DATA__` with country info, FAQs, key facts — the chat widget reads this to provide context-aware responses
3. **InstantDB is client-side only** — leads are written directly from the browser to InstantDB cloud (no server needed)
4. **Two themes** — MainLayout (warm) and CountryLayout (dark) use completely different color palettes
5. **Backend server** runs on a separate VPS (84.247.128.155:3002) — NOT on Cloudflare Pages

---

## Secrets / Access Needed for Handover

| Secret | Where | Purpose |
|--------|-------|---------|
| Cloudflare API Token | GitHub Actions | Deploy to Cloudflare Pages |
| Cloudflare Account ID | GitHub Actions | Deploy to Cloudflare Pages |
| InstantDB App ID | `src/scripts/instantdb.js` | Lead storage |
| TeleCRM Bearer Token | `public/chat/chat-client.js` | CRM lead push |
| Hermes API Key | Backend server env | AI chat LLM calls |
| SSL Certs | `backend/cert.pem`, `backend/key.pem` | Chat server HTTPS |

---

## Known Issues / Tech Debt

1. **Chat server runs on a bare VPS** (84.247.128.155) — no Docker, no process manager visible. Needs proper deployment (Docker + Dokploy or similar)
2. **TeleCRM key is hardcoded** in the client-side JS — should be server-side only
3. **Session store is in-memory** — chat history lost on server restart
4. **Backend has legacy `server.js`** (form API) that may not be in use — verify before removing
5. **No .env files committed** — environment setup undocumented

---

*Last updated: June 2026*
