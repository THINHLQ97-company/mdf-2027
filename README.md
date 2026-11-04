# Mat Bao MDF Program 2027

Landing page, registration flow and admin dashboard for the Mat Bao MDF Program 2027.

## Run

Needs Node.js 18 or later. No database: data is stored in `data/db.json`.

```bash
cp .env.example .env   # then fill in the values
npm start              # http://localhost:8000  ·  dashboard: /admin/
```

Opening `index.html` directly as a file still works, but then the form stays in preview mode.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `PORT`, `PUBLIC_URL` | Port and the public address used in email links (e.g. `https://mdf.matbao.net`) |
| `ADMIN_PASSWORD` | Dashboard password (each person signs in with their own name for the activity log) |
| `SESSION_SECRET` | Random string used to sign dashboard sessions |
| `MAIL_PROVIDER` | `outbox` (save emails to `data/outbox/`, nothing is sent), `smtp` or `sendify` |
| `SENDIFY_API_URL`, `SENDIFY_API_KEY` | Sendify Email API (`https://sendify.vn/api/emails`, Bearer key) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP relay (run `npm install nodemailer`) |
| `EMAIL_ASSET_URL` | Public address that serves `images/` for email headers and logo (defaults to `PUBLIC_URL`) |
| `MAIL_FROM`, `MAIL_FROM_NAME` | Sender address (must be a verified sender domain in Sendify) |
| `TRUST_PROXY=1` | Set when running behind a reverse proxy so rate limits see the real visitor IP |

Program dates, prices, slots, hold time and team emails are edited in the dashboard (Cài đặt chương trình).

## Registration flow

1. Registry submits the form → **verification email** (slot not held yet).
2. Registry clicks the link → slot **on hold** (or **waitlist** if full) → "received" email to the registry + alert to the team.
3. Team confirms in the dashboard → **confirmation email with the Registrar Obligation** (and a printable link) → the slot counts as taken on the landing page.
4. Holds past the confirmation deadline trigger a reminder to the team; they are not released automatically.

Anti-spam: email verification before any hold, honeypot field, minimum fill time, rate limits per IP,
duplicate-request reuse, and a cap on active packages per email domain.

## Files

- `index.html`, `css/`, `js/`, `images/`, `fonts/` – landing page
- `js/mdf-api.js` – connects the page to the server (live slots, dates, registration)
- `admin/index.html` – dashboard
- `server/` – `server.js` (HTTP + API), `store.js` (JSON store), `mailer.js` (email transports), `emails.js` (templates)
