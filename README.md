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
| `ADMIN_EMAIL` | Mailbox that receives dashboard verification codes (default `marcom@matbao.com`) |
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


## Dashboard security

- One account, tied to `ADMIN_EMAIL`. The password is stored hashed (scrypt) in `data/db.json`, never in env or git.
- **Sign-in:** password, then a code from an Authenticator app (mandatory). The first sign-in links the app by scanning a QR code and also needs a code emailed to `ADMIN_EMAIL`; it then shows 10 one-time recovery codes.
- **Forgot password:** code emailed to `ADMIN_EMAIL` + Authenticator (or a recovery code).
- **Change password, save settings, remove the Authenticator:** code emailed to `ADMIN_EMAIL` (changing the password or removing the app signs everyone out).
- **First deploy:** open `/admin/`, choose "Đặt mật khẩu lần đầu", get the emailed code, set a password, then sign in and link the app.
- **Locked out (phone and recovery codes lost):** someone with server access removes the `totp` field from `auth` in `data/db.json` and restarts; the next sign-in links a new phone.

## Partner outreach and reports

- Dashboard tab **Lịch gửi email**: eight send waves. Dates are computed from the programme settings (opening, early-bird end, closing) and can be overridden per wave. Each wave has a status, a note and, where it has a template, **Tải email (.msg)**: a zip of Outlook drafts (plus .eml copies) built at download time from the current settings, prices and slots left, grouped by recipient time zone.
- Registry contacts, the 2026 report PDFs and the internal report are imported once from a JSON bundle (**Nhập file**) and stored in `data/` only. They are never committed (the repository is public).
- Dashboard tab **Báo cáo 2026** shows the internal report and the registry PDFs to signed-in admins.
