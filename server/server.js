'use strict';
/* MDF Program 2027 server: serves the landing page, the public registration API,
   the email-verification + hold flow, and the admin dashboard API. No framework, no database. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');
const { createMailer } = require('./mailer');
const { createEmails, esc, money, fmt } = require('./emails');

const ROOT = path.resolve(__dirname, '..');

/* ── env ── */
(function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();
const env = process.env;
const PORT = Number(env.PORT || 8000);
const BASE_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DATA_DIR = path.resolve(ROOT, env.DATA_DIR || 'data');
let ADMIN_PASSWORD = env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { ADMIN_PASSWORD = crypto.randomBytes(9).toString('base64url'); console.warn('ADMIN_PASSWORD not set. Temporary password:', ADMIN_PASSWORD); }
const SESSION_SECRET = env.SESSION_SECRET || crypto.createHash('sha256').update('mdf2027:' + ADMIN_PASSWORD).digest('hex');

const store = createStore(path.join(DATA_DIR, 'db.json'));
const db = store.db;
const mailer = createMailer(env, path.join(DATA_DIR, 'outbox'));
const emails = createEmails(ROOT, BASE_URL, env.EMAIL_ASSET_URL);

const PLAN_KEYS = ['silver', 'gold', 'diamond'];
const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|proton|protonmail|qq|163|126|mail|gmx|yandex|zoho)\./i;
const ACTIVE = ['on_hold', 'confirmed'];

/* ── helpers ── */
const now = () => Date.now();
const iso = (t) => new Date(t).toISOString();
const token = () => crypto.randomBytes(24).toString('base64url');
const domainOf = (email) => String(email).split('@')[1].toLowerCase();

function programState(s) {
  const t = now();
  if (t < Date.parse(s.program.startAt)) return 'upcoming';
  if (t > Date.parse(s.program.endAt)) return 'closed';
  return 'open';
}
function availability() {
  const out = {};
  for (const k of PLAN_KEYS) {
    const p = db.settings.plans[k];
    const regs = db.registrations.filter((r) => r.plan === k);
    const confirmed = regs.filter((r) => r.status === 'confirmed').length;
    const onHold = regs.filter((r) => r.status === 'on_hold').length;
    const waitlist = regs.filter((r) => r.status === 'waitlist').length;
    out[k] = { total: p.slots, confirmed, onHold, waitlist, available: Math.max(0, p.slots - confirmed - onHold), list: p.list, half: p.half };
  }
  return out;
}
function priceFor(plan, billing) {
  const s = db.settings, p = s.plans[plan];
  if (billing === 'half') return { price: p.half, earlyBird: false };
  const early = now() < Date.parse(s.program.earlyBirdUntil);
  return { price: early ? Math.round(p.list * (100 - s.program.earlyBirdPct)) / 100 : p.list, earlyBird: early };
}
function nextRef(plan) {
  let ref;
  do { ref = 'MDF27-' + plan[0].toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
  while (db.registrations.some((r) => r.ref === ref));
  return ref;
}
async function sendMail(msg, reg) {
  const entry = { at: new Date().toISOString(), tag: msg.tag, to: msg.to.join(', '), subject: msg.subject, regId: reg ? reg.id : null };
  try {
    const res = await mailer.send(msg);
    Object.assign(entry, { ok: true, provider: res.provider, id: res.id });
  } catch (e) {
    Object.assign(entry, { ok: false, error: String(e.message || e).slice(0, 300) });
    console.error('mail failed', msg.tag, e.message);
  }
  db.mailLog.unshift(entry);
  if (db.mailLog.length > 1000) db.mailLog.length = 1000;
  store.save();
  return entry.ok;
}
function flagsFor(r) {
  const f = [];
  if (FREE_MAIL.test(r.email)) f.push('Email cá nhân (không phải email công ty)');
  const sameDomain = db.registrations.filter((x) => x.id !== r.id && domainOf(x.email) === domainOf(r.email) && ['on_hold', 'confirmed', 'waitlist'].includes(x.status));
  if (sameDomain.length) f.push(`Cùng tên miền email với ${sameDomain.length} đăng ký khác`);
  return f;
}

/* ── rate limiting (in memory) ── */
const buckets = new Map();
function limited(key, max, windowMs) {
  const t = now(), b = (buckets.get(key) || []).filter((x) => t - x < windowMs);
  b.push(t); buckets.set(key, b);
  return b.length > max;
}
setInterval(() => { const t = now(); for (const [k, v] of buckets) if (!v.some((x) => t - x < 3600e3)) buckets.delete(k); }, 600e3).unref();

/* ── HTTP plumbing ── */
function clientIp(req) { return (env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || ''; }
function send(res, status, body, headers) {
  const isStr = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, Object.assign({
    'Content-Type': isStr ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(isStr ? body : JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 32e3) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}

/* ── admin session (signed cookie) ── */
function sign(v) { return crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url'); }
function makeSession(name) { const v = Buffer.from(JSON.stringify({ n: name, e: now() + 12 * 3600e3 })).toString('base64url'); return v + '.' + sign(v); }
function readSession(req) {
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)mdf_admin=([^;]+)/);
  if (!m) return null;
  const [v, sig] = m[1].split('.');
  if (!v || !sig) return null;
  const expected = sign(v);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { const s = JSON.parse(Buffer.from(v, 'base64url').toString()); return s.e > now() ? s : null; } catch (e) { return null; }
}
const cookieFlags = BASE_URL.startsWith('https') ? '; Secure' : '';

/* ── public API ── */
function publicStatus() {
  const s = db.settings;
  return {
    state: programState(s), now: iso(now()),
    program: s.program, holdHours: s.holdHours,
    plans: availability()
  };
}

async function register(req, res) {
  const ip = clientIp(req);
  if (limited('reg:' + ip, Number(env.REG_LIMIT_PER_HOUR || 10), 3600e3)) return send(res, 429, { error: 'Too many registrations from this network. Please try again later or email marcom@matbao.com.' });
  const b = await readJson(req);
  // Bot traps: hidden field must stay empty, and a human takes more than a few seconds to fill the form.
  if (b.website || (typeof b.elapsedMs === 'number' && b.elapsedMs < 4000)) return send(res, 400, { error: 'Please try again.' });
  const s = db.settings;
  const state = programState(s);
  if (state !== 'open') return send(res, 409, { error: state === 'upcoming' ? `Registration opens on ${fmt(s.program.startAt)}.` : 'Registration for MDF 2027 is closed.' });

  const billing = b.billing === 'half' ? 'half' : 'annual';
  const email = String(b.email || '').trim().toLowerCase();
  const normTld = (x) => { x = String(x || '').trim().toLowerCase(); return x ? (x[0] === '.' ? x : '.' + x) : ''; };
  // New form sends items [{ tld, plan }]: one package per TLD. Older clients sent one plan + several TLDs.
  let items = Array.isArray(b.items) ? b.items.map((x) => ({ tld: normTld(x && x.tld), plan: String((x && x.plan) || '') }))
    : (Array.isArray(b.tlds) ? b.tlds : []).map((t) => ({ tld: normTld(t), plan: String(b.plan || '') }));
  items = items.filter((x) => x.tld || x.plan).slice(0, 5);
  const text = (v, max) => String(v || '').trim().slice(0, max);
  const errors = {};
  if (!items.length) errors.tld0 = 'Add at least one TLD.';
  const seen = {};
  items.forEach((x, i) => {
    if (!/^\.[\p{L}\p{N}-]{2,63}$/u.test(x.tld)) errors['tld' + i] = 'Enter a valid TLD, for example .cloud';
    else if (seen[x.tld]) errors['tld' + i] = 'This TLD is already in your list.';
    else if (db.registrations.some((r) => ['on_hold', 'confirmed', 'waitlist'].includes(r.status) && r.tlds.includes(x.tld) && r.email !== email))
      errors['tld' + i] = `${x.tld} is already registered in MDF 2027. Email marcom@matbao.com if this is your TLD.`;
    seen[x.tld] = 1;
    if (!PLAN_KEYS.includes(x.plan)) errors['plan' + i] = 'Choose a package for this TLD.';
  });
  if (text(b.registry, 120).length < 2) errors.registry = 'Enter your registry or company name.';
  if (text(b.contactName, 80).length < 2) errors.contactName = 'Enter the contact person.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) errors.email = 'Enter a valid work email.';
  if (b.consent !== true) errors.consent = 'Please confirm to reserve your slots.';
  if (Object.keys(errors).length) return send(res, 400, { error: 'Please check the highlighted fields.', fields: errors });

  // Same person sending the same TLDs again while the first link is still valid: resend instead of creating duplicates.
  const pending = db.registrations.filter((r) => r.status === 'unverified' && r.email === email && items.some((x) => r.tlds.includes(x.tld)));
  if (pending.length) {
    if (limited('resend:' + email, 1, 600e3)) return send(res, 429, { error: 'We already sent a confirmation link to this email. Check your inbox (and spam folder).' });
    const group = db.registrations.filter((r) => r.verifyToken === pending[0].verifyToken);
    await sendMail(emails.verifyGroup(group, s), group[0]);
    return send(res, 200, { items: group.map((r) => ({ ref: r.ref, tld: r.tlds[0], plan: r.plan })), email, verifyExpiresAt: group[0].verifyExpiresAt, resent: true });
  }
  // Cap active packages per organisation (email domain), so one sender cannot lock every slot.
  const activeForDomain = db.registrations.filter((r) => ACTIVE.includes(r.status) && domainOf(r.email) === domainOf(email)).length;
  if (activeForDomain + items.length > s.maxActivePerDomain) return send(res, 409, { error: `Your organisation can hold up to ${s.maxActivePerDomain} packages in MDF 2027 (currently ${activeForDomain}). Please email marcom@matbao.com to book more.` });

  const groupId = crypto.randomUUID(), verifyToken = token(), at = iso(now()), verifyExpiresAt = iso(now() + s.verifyHours * 3600e3);
  const group = items.map((x) => {
    const { price, earlyBird } = priceFor(x.plan, billing);
    return {
      id: crypto.randomUUID(), ref: nextRef(x.plan), groupId, status: 'unverified',
      plan: x.plan, billing, price, earlyBird,
      registry: text(b.registry, 120), tlds: [x.tld], contactName: text(b.contactName, 80), jobTitle: text(b.jobTitle, 80),
      email, phone: text(b.phone, 40), participated2026: b.participated2026 === true, notes: text(b.notes, 1000),
      createdAt: at, verifyToken, verifyExpiresAt,
      obligationToken: token(), ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
      payment: 'unpaid', contractSigned: false, internalNote: '', history: [{ at, by: 'registry', action: 'submitted' + (items.length > 1 ? ` (${items.length} TLDs)` : '') }]
    };
  });
  group.forEach((r) => { db.registrations.push(r); store.audit('submitted', r.id, 'registry', `${r.registry} · ${r.tlds[0]} · ${r.plan}`); });
  const ok = await sendMail(emails.verifyGroup(group, s), group[0]);
  if (!ok) {
    db.registrations = db.registrations.filter((x) => x.groupId !== groupId); store.save();
    return send(res, 502, { error: 'We could not send the confirmation email. Please try again or contact marcom@matbao.com.' });
  }
  store.save();
  send(res, 200, { items: group.map((r) => ({ ref: r.ref, tld: r.tlds[0], plan: r.plan })), email, verifyExpiresAt });
}

function page(title, heading, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Mat Bao MDF 2027</title>
<link rel="stylesheet" href="/css/fonts.css"><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;box-sizing:border-box;font-family:Poppins,Arial,sans-serif;color:#fff;
background:#060a26 url(/images/background.jpg) center 74%/cover no-repeat}
body::before{content:'';position:fixed;inset:0;backdrop-filter:blur(10px);background:rgba(3,6,24,.55)}
.card{position:relative;max-width:560px;width:100%;padding:32px 28px;border-radius:18px;background:rgba(10,16,53,.82);border:1px solid rgba(127,231,255,.35);box-shadow:0 30px 80px rgba(0,0,0,.5)}
h1{margin:0 0 10px;font-size:26px;line-height:34px;color:#7fe7ff}p{margin:0 0 12px;line-height:24px;color:rgba(255,255,255,.88)}b{color:#fff}
.tag{display:inline-block;margin-bottom:14px;font-size:12px;letter-spacing:2px;color:#7fe7ff;font-weight:600}
a.btn{display:inline-block;margin-top:10px;padding:12px 20px;border-radius:8px;background:linear-gradient(90deg,#22d3ee,#4f6bff);color:#fff;font-weight:700;text-decoration:none}
</style></head><body><main class="card"><div class="tag">MAT BAO · MDF PROGRAM 2027</div><h1>${heading}</h1>${body}<a class="btn" href="/">Back to the MDF 2027 page</a></main></body></html>`;
}

async function verify(req, res, url) {
  const t = url.searchParams.get('t') || '';
  const group = db.registrations.filter((x) => x.verifyToken === t);
  if (!group.length) return send(res, 404, page('Link not found', 'This link is not valid', '<p>The confirmation link is incorrect or has been replaced by a newer one. Please use the latest email we sent, or register again.</p>'));
  const s = db.settings, r0 = group[0];
  group.forEach((r) => { if (r.status === 'unverified' && now() > Date.parse(r.verifyExpiresAt)) r.status = 'expired'; });
  if (group.every((r) => r.status === 'expired')) { store.save(); return send(res, 410, page('Link expired', 'This link has expired', `<p>Registration <b>${esc(group.map((r) => r.ref).join(', '))}</b> was not confirmed within ${s.verifyHours} hours, so no slot was held. Please register again on the MDF 2027 page.</p>`)); }
  const fresh = group.filter((r) => r.status === 'unverified');
  if (fresh.length) {
    const at = iso(now());
    for (const r of fresh) {   // in order, so a registry booking 2 Gold with 1 free slot gets 1 hold + 1 waitlist
      r.verifiedAt = at;
      if (availability()[r.plan].available > 0) { r.status = 'on_hold'; r.holdUntil = iso(now() + s.holdHours * 3600e3); }
      else r.status = 'waitlist';
      r.history.push({ at, by: 'registry', action: 'email verified → ' + r.status });
      store.audit('verified', r.id, 'registry', r.status);
    }
    store.save();
    await sendMail(emails.receivedGroup(fresh, s), r0);
    await sendMail(emails.teamNewGroup(fresh, s, flagsFor(r0)), r0);
  }
  const label = { on_hold: 'On hold, Mat Bao confirms within ' + s.holdHours + ' hours', waitlist: 'Waitlist, all slots reserved', confirmed: 'Confirmed', rejected: 'Not confirmed', cancelled: 'Cancelled', expired: 'Expired' };
  const rows = group.map((r) => `<li><b>${esc(r.tlds[0])}</b> · ${esc(r.plan.toUpperCase())} · ${esc(r.ref)}<br><span style="color:#7fe7ff">${esc(label[r.status] || r.status)}</span></li>`).join('');
  const held = group.filter((r) => r.status === 'on_hold');
  const heading = held.length ? (group.length > 1 ? 'Your slots are on hold' : 'Your slot is on hold') : group.some((r) => r.status === 'waitlist') ? 'You are on the waitlist' : 'Registration status';
  send(res, 200, page('Registration status', heading, `<p>Thank you, ${esc(r0.contactName)}. Here is the status of your registration:</p><ul style="padding-left:18px;line-height:24px">${rows}</ul>` +
    (held.length ? `<p>The Mat Bao team will confirm by <b>${esc(fmt(held[0].holdUntil))}</b> and contact you about the next steps.</p>` : '')));
}

function obligationPage(req, res, tok) {
  const r = db.registrations.find((x) => x.obligationToken === tok && x.status === 'confirmed');
  if (!r) return send(res, 404, page('Not found', 'Document not available', '<p>This Registrar Obligation is not available. It is published once the package is confirmed.</p>'));
  send(res, 200, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registrar Obligation ${esc(r.ref)}</title>
<style>body{margin:0;background:#eef1fb;font-family:Arial,Helvetica,sans-serif;color:#1b2347}main{max-width:760px;margin:24px auto;padding:36px 40px;background:#fff;border-radius:12px}
.bar{max-width:760px;margin:24px auto 0;display:flex;justify-content:flex-end}button{padding:10px 18px;border:0;border-radius:8px;background:#0b1440;color:#fff;font-weight:700;cursor:pointer}
@media print{body{background:#fff}.bar{display:none}main{margin:0;padding:0}}@media(max-width:600px){main{padding:22px 18px;margin:12px}}</style></head>
<body><div class="bar"><button onclick="window.print()">Save as PDF / Print</button></div><main>${emails.obligationHtml(r, true)}
<p style="margin-top:24px;font-size:12px;color:#6b7395">This document lists Mat Bao's obligations under the MDF Program 2027 and is intended to be attached to the agreement between the Registry and Mat Bao. Confirmed on ${esc(fmt(r.confirmedAt))}.</p></main></body></html>`);
}

/* ── admin API ── */
function stats() {
  const regs = db.registrations;
  const sum = (arr) => arr.reduce((a, r) => a + r.price, 0);
  const byStatus = {};
  for (const r of regs) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const confirmed = regs.filter((r) => r.status === 'confirmed');
  const byPlan = {};
  for (const k of PLAN_KEYS) {
    const c = confirmed.filter((r) => r.plan === k), h = regs.filter((r) => r.plan === k && r.status === 'on_hold');
    byPlan[k] = { confirmedValue: sum(c), onHoldValue: sum(h) };
  }
  return {
    byStatus, byPlan,
    confirmedValue: sum(confirmed), onHoldValue: sum(regs.filter((r) => r.status === 'on_hold')),
    paidValue: sum(confirmed.filter((r) => r.payment === 'paid')), invoicedValue: sum(confirmed.filter((r) => r.payment === 'invoiced')),
    earlyBirdDiscount: confirmed.filter((r) => r.earlyBird).reduce((a, r) => a + (db.settings.plans[r.plan].list - r.price), 0)
  };
}
const publicReg = (r) => { const { verifyToken, obligationToken, ...rest } = r; return Object.assign(rest, { obligationUrl: r.status === 'confirmed' ? emails.obligationLink(r) : null, flags: flagsFor(r) }); };

async function adminAction(req, res, id, who) {
  const r = db.registrations.find((x) => x.id === id);
  if (!r) return send(res, 404, { error: 'Registration not found.' });
  const b = await readJson(req);
  const s = db.settings, act = b.action, note = String(b.note || '').slice(0, 500);
  const log = (action) => { r.history.push({ at: iso(now()), by: who, action, note }); store.audit(action, r.id, who, note); };
  const bad = (m) => send(res, 409, { error: m });

  if (act === 'confirm') {
    if (r.status !== 'on_hold') return bad('Only registrations on hold can be confirmed.');
    r.status = 'confirmed'; r.confirmedAt = iso(now()); r.confirmedBy = who; log('confirmed');
    store.save(); await sendMail(emails.confirmed(r, s), r);
  } else if (act === 'reject') {
    if (!['unverified', 'on_hold', 'waitlist'].includes(r.status)) return bad('This registration cannot be rejected.');
    const notify = r.status !== 'unverified';
    r.status = 'rejected'; log('rejected'); store.save();
    if (notify && b.notify !== false) await sendMail(emails.released(r, s, note), r);
  } else if (act === 'cancel') {
    if (r.status !== 'confirmed') return bad('Only confirmed registrations can be cancelled.');
    r.status = 'cancelled'; log('cancelled'); store.save();
    if (b.notify) await sendMail(emails.released(r, s, note), r);
  } else if (act === 'promote') {
    if (r.status !== 'waitlist') return bad('Only waitlisted registrations can be moved to on hold.');
    if (availability()[r.plan].available < 1) return bad('No free slot in this package. Increase slots or release a hold first.');
    r.status = 'on_hold'; r.holdUntil = iso(now() + s.holdHours * 3600e3); r.overdueNotified = false; log('promoted from waitlist');
    store.save(); await sendMail(emails.promoted(r, s), r);
  } else if (act === 'resend') {
    const map = { unverified: 'verify', on_hold: 'received', waitlist: 'waitlist', confirmed: 'confirmed' };
    if (!map[r.status]) return bad('Nothing to resend for this status.');
    if (r.status === 'unverified') { r.verifyExpiresAt = iso(now() + s.verifyHours * 3600e3); }
    log('resent ' + map[r.status] + ' email'); store.save();
    if (r.status === 'unverified') { const g = db.registrations.filter((x) => x.verifyToken === r.verifyToken && x.status === 'unverified'); g.forEach((x) => { x.verifyExpiresAt = r.verifyExpiresAt; }); await sendMail(emails.verifyGroup(g, s), r); }
    else await sendMail(emails[map[r.status]](r, s), r);
  } else if (act === 'update') {
    if (['unpaid', 'invoiced', 'paid'].includes(b.payment)) r.payment = b.payment;
    if (typeof b.contractSigned === 'boolean') r.contractSigned = b.contractSigned;
    if (typeof b.internalNote === 'string') r.internalNote = b.internalNote.slice(0, 2000);
    if (typeof b.price === 'number' && b.price >= 0 && b.price < 1e6) r.price = b.price;
    log('updated'); store.save();
  } else return send(res, 400, { error: 'Unknown action.' });
  send(res, 200, { ok: true, registration: publicReg(r) });
}

function updateSettings(b, who) {
  const s = db.settings;
  const d = (v) => (v && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  if (b.program) {
    for (const k of ['startAt', 'endAt', 'earlyBirdUntil']) if (d(b.program[k])) s.program[k] = d(b.program[k]);
    if (Number.isFinite(b.program.earlyBirdPct) && b.program.earlyBirdPct >= 0 && b.program.earlyBirdPct <= 50) s.program.earlyBirdPct = b.program.earlyBirdPct;
  }
  if (b.plans) for (const k of PLAN_KEYS) {
    const p = b.plans[k]; if (!p) continue;
    for (const f of ['list', 'half', 'slots']) if (Number.isFinite(p[f]) && p[f] >= 0 && p[f] < 1e6) s.plans[k][f] = f === 'slots' ? Math.floor(p[f]) : p[f];
  }
  for (const f of ['holdHours', 'verifyHours', 'maxActivePerDomain']) if (Number.isFinite(b[f]) && b[f] > 0 && b[f] < 1000) s[f] = Math.floor(b[f]);
  if (Array.isArray(b.teamEmails)) s.teamEmails = b.teamEmails.map((e) => String(e).trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 20);
  if (typeof b.replyTo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.replyTo)) s.replyTo = b.replyTo;
  store.audit('settings updated', null, who); store.save();
}

function csv() {
  const cols = ['ref', 'status', 'plan', 'billing', 'price', 'earlyBird', 'registry', 'tlds', 'contactName', 'jobTitle', 'email', 'phone', 'participated2026', 'payment', 'contractSigned', 'createdAt', 'verifiedAt', 'holdUntil', 'confirmedAt', 'confirmedBy', 'notes', 'internalNote'];
  const cell = (v) => { let s = Array.isArray(v) ? v.join(' ') : String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return '﻿' + [cols.join(',')].concat(db.registrations.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n');
}

async function admin(req, res, url) {
  const p = url.pathname;
  if (p === '/admin/api/login' && req.method === 'POST') {
    if (limited('login:' + clientIp(req), 10, 900e3)) return send(res, 429, { error: 'Too many attempts. Wait 15 minutes.' });
    const b = await readJson(req);
    const name = String(b.name || '').trim().slice(0, 40);
    const a = Buffer.from(String(b.password || '')), e = Buffer.from(ADMIN_PASSWORD);
    if (!name || a.length !== e.length || !crypto.timingSafeEqual(a, e)) return send(res, 401, { error: 'Wrong name or password.' });
    store.audit('login', null, name);
    return send(res, 200, { ok: true, name }, { 'Set-Cookie': `mdf_admin=${makeSession(name)}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=43200${cookieFlags}` });
  }
  const sess = readSession(req);
  if (!sess) return send(res, 401, { error: 'Please sign in.' });
  // CSRF: SameSite=Strict cookie plus a custom header that cross-site forms cannot set.
  if (req.method !== 'GET' && req.headers['x-mdf-admin'] !== '1') return send(res, 403, { error: 'Missing header.' });
  const who = sess.n;
  if (p === '/admin/api/logout') return send(res, 200, { ok: true }, { 'Set-Cookie': `mdf_admin=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0${cookieFlags}` });
  if (p === '/admin/api/data' && req.method === 'GET') {
    return send(res, 200, {
      me: who, mailProvider: mailer.provider, baseUrl: BASE_URL, status: publicStatus(), settings: db.settings, stats: stats(),
      registrations: db.registrations.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicReg),
      audit: db.audit.slice(0, 200), mailLog: db.mailLog.slice(0, 200)
    });
  }
  const m = p.match(/^\/admin\/api\/reg\/([\w-]+)$/);
  if (m && req.method === 'POST') return adminAction(req, res, m[1], who);
  if (p === '/admin/api/settings' && req.method === 'POST') { updateSettings(await readJson(req), who); return send(res, 200, { ok: true, settings: db.settings }); }
  if (p === '/admin/api/export.csv' && req.method === 'GET') return send(res, 200, csv(), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="mdf-2027-registrations.csv"' });
  if (p === '/admin/api/test-email' && req.method === 'POST') {
    const b = await readJson(req);
    const to = String(b.to || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return send(res, 400, { error: 'Enter a valid email.' });
    const ok = await sendMail({ tag: 'test', to: [to], subject: 'MDF 2027 test email', html: emails.layout('Test', '<p>This is a test email from the MDF 2027 dashboard.</p>'), text: 'Test email from the MDF 2027 dashboard.' });
    return send(res, ok ? 200 : 502, ok ? { ok: true } : { error: db.mailLog[0].error });
  }
  send(res, 404, { error: 'Not found.' });
}

/* ── static files ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json' };
const BLOCKED = /^\/(server|data|node_modules|\.git|\.env|\.env\.example|\.dockerignore|Dockerfile|index\.js|package(-lock)?\.json|README\.md|\.gitignore)(\/|$)/;
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (BLOCKED.test(p) || p.includes('\0')) return send(res, 404, 'Not found');
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 404, 'Not found');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ── router ── */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/status' && req.method === 'GET') {
      if (limited('status:' + clientIp(req), 120, 60e3)) return send(res, 429, { error: 'Slow down.' });
      return send(res, 200, publicStatus());
    }
    if (url.pathname === '/api/register' && req.method === 'POST') return await register(req, res);
    if (url.pathname === '/api/verify' && req.method === 'GET') return await verify(req, res, url);
    const ob = url.pathname.match(/^\/obligation\/([\w-]+)$/);
    if (ob && req.method === 'GET') return obligationPage(req, res, ob[1]);
    if (url.pathname.startsWith('/admin/api/')) return await admin(req, res, url);
    if (url.pathname === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url);
    send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
});

/* ── background sweep: expire unverified requests, remind the team about overdue holds ── */
async function sweep() {
  const s = db.settings, t = now();
  let changed = false;
  for (const r of db.registrations) {
    if (r.status === 'unverified' && t > Date.parse(r.verifyExpiresAt)) {
      r.status = 'expired'; r.history.push({ at: iso(t), by: 'system', action: 'verification expired' }); store.audit('expired', r.id); changed = true;
    }
    if (r.status === 'on_hold' && !r.overdueNotified && t > Date.parse(r.holdUntil)) {
      r.overdueNotified = true; changed = true;
      await sendMail(emails.teamOverdue(r, s), r);
    }
  }
  if (changed) store.save();
}
setInterval(() => sweep().catch((e) => console.error('sweep', e)), 60e3).unref();

function start() {
  server.listen(PORT, '0.0.0.0', () => console.log(`MDF 2027 server on port ${PORT} · public ${BASE_URL} · mail: ${mailer.provider}`));
}
if (require.main === module) start();
module.exports = { server, sweep, db, start };
