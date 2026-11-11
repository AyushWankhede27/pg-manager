# PG Manager (MERN) — rent, electricity bills, tenant portal, UPI, AI insights

## Run locally
1. MongoDB running locally (or an Atlas URI).
2. `cd server && cp .env.example .env` → set JWT_SECRET → `npm install && npm run dev`
3. `cd client && npm install && npm run dev` → http://localhost:5173
4. Optional demo data: `cd server && npm run seed` (owner 9999999999 / demo12345; tenants 98000001xx / tenant123)
5. Tests: `cd server && npm test`

## Run with Docker (one command)
Create `.env` with `JWT_SECRET=<32+ random chars>`, then `docker compose up -d --build` → http://localhost:8080

## Deploy (free-tier friendly)
- DB: MongoDB Atlas. API: Render/Railway (root `server`, start `npm start`, env from `.env.example`, NODE_ENV=production, CLIENT_URL = your site URL).
- Client: Vercel/Netlify/Cloudflare Pages (root `client`, build `npm run build`, output `dist`, env `VITE_API=https://<api>/api`).
- Installable on phones (PWA); wrap with PWABuilder for an APK.

## What's built in
Owner: rooms, meter readings → bills, UPI ID, confirm/reject payment claims (with UTR), complaints, WhatsApp reminders.
Tenant: forced password change on first login, bill + UPI pay button, usage chart, claims, complaints.
AI: usage anomaly alerts, forecast, chase ranking, tone-aware reminders (LLM when ANTHROPIC_API_KEY is set).
Security: bcrypt, JWT (7d), helmet, rate limits, ownership checks on every route, unique bill per room/month, production secret check.

## Still to do before real customers
Not yet implemented: automatic UPI payment confirmation (claims are owner-verified), password reset/OTP, WhatsApp Business API (links open WhatsApp manually), refresh tokens, API integration tests, backups/monitoring, privacy policy. Review before storing real tenant data.
