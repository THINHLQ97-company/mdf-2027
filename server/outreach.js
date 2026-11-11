// Partner outreach: send schedule, registry contacts, emails built from the live programme settings,
// and the 2026 reports. Contacts and reports live in the data folder only (never in git).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CFB = require('./vendor/cfb');

const DAY = 864e5;
const TZ = {
  asia: { label: 'Châu Á', folder: '1 Asia - send 09.00 VN', time: '09:00' },
  europe: { label: 'Châu Âu', folder: '2 Europe - send 15.00 VN', time: '15:00' },
  americas: { label: 'Châu Mỹ', folder: '3 Americas - send 21.30 VN', time: '21:30' }
};
const ACTIVE = ['on_hold', 'confirmed', 'waitlist'];

/* ── dates (Vietnam calendar days, YYYY-MM-DD) ── */
const vnDay = (iso) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const weekdayBefore = (d) => { while (dow(d) === 0 || dow(d) === 6) d = addDays(d, -1); return d; };
const weekdayAfter = (d) => { while (dow(d) === 0 || dow(d) === 6) d = addDays(d, 1); return d; };
const today = () => vnDay(new Date().toISOString());

const WAVES = [
  { key: 'prep', title: 'Chuẩn bị nội bộ', who: 'Nội bộ', desc: 'Bổ sung người nhận còn thiếu. Đăng ký thử 1 lần trên trang thật bằng email nội bộ (nhận đủ email, dashboard thấy đăng ký), sau đó huỷ đăng ký thử.', date: (k) => weekdayBefore(addDays(k.start, -9)) },
  { key: 'offer', title: 'Package Offer + báo cáo 2026', who: 'Đối tác 2026', audience: 'partner', tpl: 'offer', desc: 'Đối tác cũ nhận trước: có thời gian đọc báo cáo và xin duyệt ngân sách trước ngày mở.', date: (k) => weekdayBefore(addDays(k.start, -5)) },
  { key: 'invite', title: 'Thư mời chung', who: 'Registry mới', audience: 'new', tpl: 'invite', desc: 'Thứ Ba – thứ Tư có tỉ lệ mở email cao; gửi vài ngày trước ngày mở.', date: (k) => weekdayBefore(addDays(k.start, -3)) },
  { key: 'followup', title: 'Nhắn riêng đối tác chưa phản hồi', who: 'Đối tác 2026 chưa trả lời', audience: 'partner-unreg', desc: 'Nhắn WhatsApp hoặc email: đã xem báo cáo chưa, cần trao đổi gì trước ngày mở. Không cần email mẫu.', date: (k) => weekdayBefore(addDays(k.start, -2)) },
  { key: 'open', title: 'Thông báo mở đăng ký', who: 'Tất cả chưa đăng ký', audience: 'unreg', tpl: 'open', desc: 'Ngày làm việc đầu tiên từ ngày mở. Email ngắn: đã mở, hạn early bird, số suất còn lại.', date: (k) => weekdayAfter(k.start) },
  { key: 'eb', title: 'Nhắc early bird lần cuối', who: 'Tất cả chưa đăng ký', audience: 'unreg', tpl: 'eb', desc: 'Khoảng 3 ngày làm việc trước khi hết early bird, kèm số suất còn lại.', date: (k) => (k.eb ? weekdayBefore(addDays(k.ebEnd, -3)) : null) },
  { key: 'final', title: 'Nhắc đóng đăng ký', who: 'Tất cả chưa đăng ký', audience: 'unreg', tpl: 'final', desc: 'Gửi trước ngày đóng, tránh tuần Giáng sinh.', date: (k) => weekdayBefore(addDays(k.end, -6)) },
  { key: 'thanks', title: 'Cảm ơn và bước tiếp theo', who: 'Registry đã đăng ký', audience: 'registered', tpl: 'thanks', desc: 'Sau khi đóng đăng ký: cảm ơn, nêu bước hợp đồng, hoá đơn, kick-off tháng 1; báo danh sách chờ.', date: (k) => weekdayAfter(addDays(k.end, 1)) }
];

/* ── small binary writers: .msg (MS-OXMSG via CFB), .eml, .zip ── */
const T = { I32: 0x0003, BOOL: 0x000B, STR: 0x001F, BIN: 0x0102, TIME: 0x0040 };
const tagHex = (id, type) => (((id << 16) | type) >>> 0).toString(16).toUpperCase().padStart(8, '0');
function propsBlock(props) {
  const entries = [], streams = {};
  for (const [id, type, value] of props) {
    if (value === undefined || value === null) continue;
    const e = Buffer.alloc(16);
    e.writeUInt32LE(((id << 16) | type) >>> 0, 0); e.writeUInt32LE(6, 4);
    if (type === T.I32) e.writeInt32LE(value | 0, 8);
    else if (type === T.BOOL) e.writeUInt16LE(value ? 1 : 0, 8);
    else if (type === T.TIME) e.writeBigUInt64LE(BigInt(value) * 10000n + 116444736000000000n, 8);
    else {
      // As Outlook writes it: the string stream ends with its UTF-16 terminator and the size field equals the stream length.
      const buf = type === T.STR ? Buffer.concat([Buffer.from(String(value), 'utf16le'), Buffer.alloc(2)]) : Buffer.from(value);
      streams['__substg1.0_' + tagHex(id, type)] = buf; e.writeUInt32LE(buf.length, 8);
    }
    entries.push(e);
  }
  return { fixed: Buffer.concat(entries), streams };
}
// One-off entry ID (MS-OXCDATA 2.2.5.1): Unicode, SMTP, plain-text/MIME preference as Outlook writes it.
function oneOffEntryId(name, email) {
  const uid = Buffer.from('812B1FA4BEA310199D6E00DD010F5402', 'hex');
  const z = (t) => Buffer.concat([Buffer.from(t, 'utf16le'), Buffer.alloc(2)]);
  return Buffer.concat([Buffer.alloc(4), uid, Buffer.alloc(2), Buffer.from([0x01, 0x80]), z(name), z('SMTP'), z(email)]);
}
function writeMsg(m) {
  const cfb = CFB.utils.cfb_new();
  const add = (p, b) => CFB.utils.cfb_add(cfb, p, b);
  const recips = [...m.to.map((r) => ({ ...r, type: 1 })), ...m.cc.map((r) => ({ ...r, type: 2 }))];
  const atts = m.attachments;
  const disp = (l) => l.map((r) => r.name || r.email).join('; ');
  const top = propsBlock([
    [0x001A, T.STR, 'IPM.Note'], [0x0037, T.STR, m.subject], [0x0E1D, T.STR, m.subject], [0x003D, T.STR, ''],
    [0x1000, T.STR, m.text], [0x1013, T.BIN, Buffer.from(m.html, 'utf8')], [0x3FDE, T.I32, 65001],
    [0x0E07, T.I32, 1 | 8 | (atts.some((a) => !a.cid) ? 0x10 : 0)], [0x0E1B, T.BOOL, atts.length > 0], [0x340D, T.I32, 0x00040000],
    [0x0017, T.I32, 1], [0x0036, T.I32, 0], [0x0070, T.STR, m.subject], [0x3007, T.TIME, Date.now()], [0x3008, T.TIME, Date.now()], [0x0E04, T.STR, disp(m.to)], [0x0E03, T.STR, disp(m.cc)], [0x0E02, T.STR, '']
  ]);
  const head = Buffer.alloc(32);
  head.writeUInt32LE(recips.length, 8); head.writeUInt32LE(atts.length, 12); head.writeUInt32LE(recips.length, 16); head.writeUInt32LE(atts.length, 20);
  add('/__properties_version1.0', Buffer.concat([head, top.fixed]));
  for (const [n, b] of Object.entries(top.streams)) add('/' + n, b);
  for (const s of ['00020102', '00030102', '00040102']) add('/__nameid_version1.0/__substg1.0_' + s, Buffer.alloc(0));
  recips.forEach((r, i) => {
    const dir = '/__recip_version1.0_#' + i.toString(16).toUpperCase().padStart(8, '0');
    const name = r.name || r.email, eid = oneOffEntryId(name, r.email);
    // A resolved SMTP recipient as Outlook writes it: one-off entry ID, search key and the sendable flag.
    const p = propsBlock([[0x0C15, T.I32, r.type], [0x3000, T.I32, i], [0x0FFE, T.I32, 6], [0x3900, T.I32, 0], [0x3001, T.STR, name],
      [0x5FF6, T.STR, name], [0x3A20, T.STR, name], [0x3002, T.STR, 'SMTP'], [0x3003, T.STR, r.email], [0x39FE, T.STR, r.email], [0x3A40, T.BOOL, false],
      [0x0FFF, T.BIN, eid], [0x5FF7, T.BIN, eid], [0x0FF9, T.BIN, eid], [0x300B, T.BIN, Buffer.from('SMTP:' + r.email.toUpperCase() + '\0', 'ascii')],
      [0x5FFD, T.I32, 1], [0x5FFF, T.I32, 0], [0x5FDF, T.I32, i], [0x0E0F, T.BOOL, true], [0x0FF6, T.BIN, crypto.randomBytes(4)]]);
    add(dir + '/__properties_version1.0', Buffer.concat([Buffer.alloc(8), p.fixed]));
    for (const [n, b] of Object.entries(p.streams)) add(dir + '/' + n, b);
  });
  atts.forEach((a, i) => {
    const dir = '/__attach_version1.0_#' + i.toString(16).toUpperCase().padStart(8, '0');
    const p = propsBlock([[0x3705, T.I32, 1], [0x0E21, T.I32, i], [0x0FFE, T.I32, 7], [0x370B, T.I32, -1],
      [0x3701, T.BIN, a.data], [0x3704, T.STR, a.filename], [0x3707, T.STR, a.filename], [0x3001, T.STR, a.filename], [0x370E, T.STR, a.mime],
      [0x3703, T.STR, path.extname(a.filename)], ...(a.cid ? [[0x3712, T.STR, a.cid], [0x7FFE, T.BOOL, true], [0x3714, T.I32, 4]] : [])]);
    add(dir + '/__properties_version1.0', Buffer.concat([Buffer.alloc(8), p.fixed]));
    for (const [n, b] of Object.entries(p.streams)) add(dir + '/' + n, b);
  });
  return Buffer.from(CFB.write(cfb, { type: 'buffer' }));
}
function writeEml(m) {
  const b = 'mdf' + crypto.randomBytes(8).toString('hex'), rel = 'rel' + crypto.randomBytes(8).toString('hex');
  const enc = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s).toString('base64') + '?=');
  const addr = (l) => l.map((r) => (r.name ? `"${enc(r.name).replace(/"/g, '')}" <${r.email}>` : `<${r.email}>`)).join(', ');
  const b64 = (buf) => buf.toString('base64').replace(/.{76}/g, '$&\r\n');
  let s = 'X-Unsent: 1\r\n' + (m.to.length ? 'To: ' + addr(m.to) + '\r\n' : '') + (m.cc.length ? 'Cc: ' + addr(m.cc) + '\r\n' : '') +
    'Subject: ' + enc(m.subject) + '\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="' + b + '"\r\n\r\n' +
    '--' + b + '\r\nContent-Type: multipart/related; boundary="' + rel + '"\r\n\r\n' +
    '--' + rel + '\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64(Buffer.from(m.html, 'utf8')) + '\r\n';
  for (const a of m.attachments.filter((x) => x.cid)) s += '--' + rel + `\r\nContent-Type: ${a.mime}; name="${a.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${a.cid}>\r\nContent-Disposition: inline; filename="${a.filename}"\r\n\r\n` + b64(a.data) + '\r\n';
  s += '--' + rel + '--\r\n';
  for (const a of m.attachments.filter((x) => !x.cid)) s += '--' + b + `\r\nContent-Type: ${a.mime}; name="${a.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${a.filename}"\r\n\r\n` + b64(a.data) + '\r\n';
  return Buffer.from(s + '--' + b + '--\r\n');
}
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (const x of buf) c = CRC[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const d = new Date(), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5);
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), crc = crc32(f.data), len = f.data.length;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(dosTime, 10); h.writeUInt16LE(dosDate, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(len, 18); h.writeUInt32LE(len, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, name, f.data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(dosTime, 12); c.writeUInt16LE(dosDate, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(len, 20); c.writeUInt32LE(len, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, name);
    off += 30 + name.length + len;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}

function createOutreach({ root, dataDir, baseUrl, db, store, availability }) {
  const REPORTS = path.join(dataDir, 'reports');
  db.outreach = db.outreach || {};
  db.outreach.contacts = db.outreach.contacts || [];
  db.outreach.waves = db.outreach.waves || {};
  const SIGNATURE = fs.readFileSync(path.join(__dirname, 'email-signature.html'), 'utf8').replace(/cid:[\w-]+/g, baseUrl + '/images/email-signature-mb.png');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const domain = (e) => String(e || '').split('@')[1] || '';

  /* ── programme facts from the dashboard settings ── */
  function facts() {
    const s = db.settings, p = s.program, av = availability();
    const pct = Number(p.earlyBirdPct) || 0;
    const eb = Date.parse(p.earlyBirdUntil) > Date.parse(p.startAt) && pct > 0;
    const fmt = (iso, opt) => new Date(iso).toLocaleDateString('en-GB', Object.assign({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }, opt || {}));
    const plans = {};
    for (const k of ['diamond', 'gold', 'silver']) plans[k] = { list: s.plans[k].list, eb: Math.round(s.plans[k].list * (100 - pct)) / 100, slots: s.plans[k].slots, left: av[k] ? av[k].available : s.plans[k].slots };
    return {
      start: vnDay(p.startAt), ebEnd: vnDay(p.earlyBirdUntil), end: vnDay(p.endAt), eb, pct, plans,
      startTxt: fmt(p.startAt), ebTxt: fmt(p.earlyBirdUntil), endTxt: fmt(p.endAt),
      startDay: fmt(p.startAt, { weekday: 'long', year: undefined }), ebDay: fmt(p.earlyBirdUntil, { weekday: 'long', year: undefined }), endDay: fmt(p.endAt, { weekday: 'long', year: undefined }),
      ebShort: fmt(p.earlyBirdUntil, { month: 'short', year: undefined }), ebDaysLeft: Math.max(0, Math.ceil((Date.parse(p.earlyBirdUntil) - Date.now()) / DAY)),
      endDaysLeft: Math.max(0, Math.ceil((Date.parse(p.endAt) - Date.now()) / DAY))
    };
  }

  /* ── contacts and who has registered ── */
  function registrationsOf(c) {
    const tl = new Set((c.tlds || []).map((t) => t.toLowerCase()));
    const doms = new Set([...(c.to || []), ...(c.cc || [])].map((x) => domain(x.email).toLowerCase()).filter((d) => d && d !== 'matbao.com'));
    return db.registrations.filter((r) => ACTIVE.includes(r.status) && (r.tlds.some((t) => tl.has(t)) || doms.has(domain(r.email).toLowerCase())));
  }
  const inAudience = (c, a) => {
    if (c.paused) return false;   // handled one to one (e.g. a custom deal), left out of every wave
    const reg = registrationsOf(c).length > 0;
    return a === 'partner' ? c.group === 'partner' : a === 'new' ? c.group === 'new' : a === 'unreg' ? !reg : a === 'partner-unreg' ? c.group === 'partner' && !reg : a === 'registered' ? reg : false;
  };
  const hasPdf = (c) => !!(c.pdf && fs.existsSync(path.join(REPORTS, c.pdf + '.pdf')));

  function schedule() {
    const k = facts(), t = today();
    return WAVES.map((w) => {
      const st = db.outreach.waves[w.key] || {};
      const auto = w.date(k);
      if (!auto && !st.date) return null;
      const list = w.audience ? db.outreach.contacts.filter((c) => inAudience(c, w.audience)) : [];
      const date = st.date || auto;
      return {
        key: w.key, title: w.title, who: w.who, desc: w.desc, date, autoDate: auto, members: list.map((c) => c.id), custom: !!st.date, status: st.status || 'todo', note: st.note || '',
        doneAt: st.doneAt || null, doneBy: st.doneBy || '', template: !!w.tpl, recipients: list.length,
        missingTo: list.filter((c) => !(c.to || []).length).map((c) => c.name),
        due: (st.status || 'todo') === 'todo' && date <= t, overdue: (st.status || 'todo') === 'todo' && date < t
      };
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ── email building blocks (Outlook-safe) ── */
  const FONT = "Aptos, Calibri, 'Segoe UI', Helvetica, Arial, sans-serif";
  const P = (h, x = '') => `<p style="margin:0 0 12px;font-family:${FONT};font-size:11.5pt;line-height:1.45;color:#1d1d1b;${x}">${h}</p>`;
  const H = (icon, t) => `<p style="margin:20px 0 8px;font-family:${FONT};font-size:12.5pt;font-weight:bold;color:#0b1550;">${t}</p>`;
  const UL = (items) => `<ul style="margin:0 0 12px 0;padding-left:22px;font-family:${FONT};font-size:11.5pt;line-height:1.45;color:#1d1d1b;">${items.map((x) => `<li style="margin:0 0 6px;">${x}</li>`).join('')}</ul>`;
  const OL = (items) => `<ol style="margin:0 0 12px 0;padding-left:22px;font-family:${FONT};font-size:11.5pt;line-height:1.45;color:#1d1d1b;">${items.map((x) => `<li style="margin:0 0 6px;">${x}</li>`).join('')}</ol>`;
  const TH = (t, r) => `<td style="padding:9px 12px;background:#0b1550;color:#ffffff;font-family:${FONT};font-size:10.5pt;font-weight:bold;${r ? 'text-align:right;' : ''}">${t}</td>`;
  const TD = (t, r, b, bg) => `<td style="padding:9px 12px;border-bottom:1px solid #d9def0;font-family:${FONT};font-size:11pt;color:#1d1d1b;${r ? 'text-align:right;white-space:nowrap;' : ''}${b ? 'font-weight:bold;' : ''}${bg ? 'background:' + bg + ';' : ''}">${t}</td>`;
  const TABLE = (head, rows) => `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;margin:4px 0 12px;border:1px solid #d9def0;"><tr>${head}</tr>${rows.join('')}</table>`;
  // Plain text from the dashboard: blank line = new paragraph, **bold**.
  const paras = (t) => String(t || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).map((x) => P(esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')));
  const NOTE = (t) => P(`<span style="color:#4b5470;font-size:10.5pt;">${t}</span>`);
  const planName = (k) => ({ diamond: 'Diamond', gold: 'Gold', silver: 'Silver' })[k] || k;
  const page = (inner) => `<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body style="margin:0;padding:0;background:#ffffff;"><div style="max-width:680px;">
<img src="${baseUrl}/images/email-banner-2027.jpg" width="640" alt="Mat Bao MDF Program 2027: Beyond Visibility, Guaranteed Growth" style="display:block;width:100%;max-width:640px;height:auto;border:0;margin:0 0 18px;">
${inner}${P('Warm regards,', 'font-weight:bold;margin-top:18px;')}</div>${SIGNATURE}</body></html>`;

  function datesBox(k) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;margin:4px 0 12px;background:#eef6ff;border-left:4px solid #22d3ee;"><tr><td style="padding:12px 16px;font-family:${FONT};font-size:11pt;line-height:1.6;color:#1d1d1b;">
<b>${k.startTxt}</b> &nbsp;Registration opens<br>${k.eb ? `<b>${k.ebTxt}</b> &nbsp;Last day of the ${k.pct}% early bird price (annual plans)<br>` : ''}<b>${k.endTxt}</b> &nbsp;Registration closes<br>
<span style="color:#4b5470;">Slots: Diamond ${k.plans.diamond.slots} · Gold ${k.plans.gold.slots} · Silver ${k.plans.silver.slots}. Each TLD takes one slot, first come, first served.</span></td></tr></table>`;
  }
  const howTo = (hint) => OL([
    `Visit the MDF 2027 page: <a href="${baseUrl}" style="color:#0b6bcb;">${baseUrl}</a>`, 'Enter the access password: <b>@mdf2027</b>',
    `Open <b>Book your plan</b>, add ${hint} and choose a package. You can add several TLDs, each with its own package and billing cycle (annual or half-year).`,
    'Click the link in the confirmation email to hold your slot. Our team confirms within 48 hours and sends the Registrar Obligation for your agreement.'
  ]);
  const whatsNew = () => UL([
    '<b>Registration Guarantee</b> (Diamond): we commit to a minimum number of new registrations. If we fall short, the gap becomes credit toward your 2028 package.',
    '<b>Bundle placements</b>: Gold gets a combo card next to .COM / .NET / .VN in search results; Diamond gets the cart pop-up offering your TLD free for the first year.',
    '<b>Smart Search &amp; Vibe Hosting</b>: your TLD is suggested in AI Search and the search bar, and offered when a new app on Vibe Hosting, our AI app builder, needs a domain.',
    '<b>Boosted ads</b> on Facebook &amp; Google, and <b>co-branded merchandise</b> at around 10 industry events a year.'
  ]);
  const slotsTable = (k, withLeft) => TABLE(TH('Package') + TH('Cost / 12 months', 1) + (k.eb ? TH(`Early bird (${k.pct}% off)`, 1) : '') + TH(withLeft ? 'Slots left' : 'Slots', 1),
    ['diamond', 'gold', 'silver'].map((p) => `<tr>${TD('<b>' + planName(p) + '</b>')}${TD(money(k.plans[p].list), 1)}${k.eb ? TD(money(k.plans[p].eb), 1) : ''}${TD(withLeft ? `${k.plans[p].left} of ${k.plans[p].slots}` : String(k.plans[p].slots), 1)}</tr>`));
  // Gold and Diamond: the bundle is optional; a registry can skip it, discuss later and pay less.
  function bundleNote(c, short) {
    if (!['gold', 'diamond'].includes(c.plan)) return '';
    const label = esc(c.label || 'your TLD');
    const what = c.plan === 'gold' ? `the combo card that shows ${label} next to .COM / .NET / .VN in search results` : `the cart pop-up that offers ${label} free for the first year at checkout`;
    if (short) return NOTE(`The bundle in ${planName(c.plan)} (${what}) is optional: if it does not fit your brand direction, we can leave it out, discuss it later and lower the package fee.`);
    return P(`<b>The bundle is optional.</b> ${planName(c.plan)} includes ${what}, but it is not a must. If it does not fit the brand direction of ${label}, we can simply leave it out for now, discuss it together later, and lower the package fee accordingly.`);
  }
  // A personal note for one registry (set in the dashboard), shown as a highlighted box.
  const callout = (c) => (c.note ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;margin:4px 0 14px;background:#fff8e6;border-left:4px solid #f5b400;"><tr><td style="padding:12px 16px;font-family:${FONT};font-size:11.5pt;line-height:1.5;color:#1d1d1b;">${esc(c.note).replace(/\n/g, '<br>')}</td></tr></table>` : '');
  const ebLine = (k) => (k.eb ? `the ${k.pct}% early bird price applies to annual plans booked by ${k.ebTxt}` : 'prices are per 12 months');

  const TEMPLATES = {
    offer(c, k) {
      const pl = k.plans[c.plan] || k.plans.silver;
      const price = k.eb ? pl.eb : pl.list;
      const alt = c.alt && c.alt !== c.plan && k.plans[c.alt] ? c.alt : '';
      const offerTable = alt
        ? TABLE(TH('Option') + TH('Package') + TH('Cost / 12 months', 1) + TH(k.eb ? `Early bird (until ${k.ebShort})` : 'Early bird', 1) + TH('Slots', 1),
          [[c.plan, 'Recommended'], [alt, 'Alternative']].map(([p, tag]) => `<tr>${TD('<b>' + tag + '</b>')}${TD(`<b>${planName(p)}</b> · ${esc(c.label)}${p === 'diamond' ? '<br><span style="font-size:10pt;color:#4b5470;">with Registration Guarantee</span>' : ''}`)}${TD(money(k.plans[p].list), 1)}${TD(k.eb ? money(k.plans[p].eb) : '–', 1, 1)}${TD(String(k.plans[p].slots), 1)}</tr>`))
        : TABLE(TH('Package (offer)') + TH('Qty', 1) + TH('Cost / 12 months', 1) + TH(k.eb ? `Early bird (${k.pct}% off)` : 'Early bird', 1) + TH('Total', 1), [
          `<tr>${TD(`<b>${planName(c.plan)}</b> · ${esc(c.label)}`)}${TD('1', 1)}${TD(money(pl.list), 1)}${TD(k.eb ? 'Yes, until ' + k.ebShort : '–', 1)}${TD(money(price), 1, 1)}</tr>`,
          `<tr>${TD('TOTAL', 0, 1, '#f3f5fb')}${TD('', 1, 0, '#f3f5fb')}${TD('', 1, 0, '#f3f5fb')}${TD('', 1, 0, '#f3f5fb')}${TD(money(price), 1, 1, '#f3f5fb')}</tr>`]);
      return {
        subject: c.subject || `Mat Bao MDF 2027: ${c.label} 2026 Results & Your Exclusive Offer`,
        inner: [P(`<b>${esc(c.greet)}</b>`), P('I hope this email finds you well.'),
          ...(c.intro ? paras(c.intro) : [P(`Thank you for being part of the Mat Bao MDF 2026 Program. As the year draws to a close, we have prepared a short report on how <b>${esc(c.label)}</b> performed at Mat Bao in 2026 (attached as PDF), together with our recommendation for <b>MDF 2027</b>, which opens for registration on <b>${k.startTxt}</b>.`)]),
          ...(c.results && c.results.length ? [H('', `${esc(c.label)} at Mat Bao in 2026`), UL(c.results)] : []),
          ...paras(c.resultsNote),
          H('', 'What’s new in MDF 2027: Beyond Visibility, Guaranteed Growth'), P('Every 2027 package is measured by new registrations of your TLD, not just impressions:'), whatsNew(),
          H('', `Our recommendation for ${esc(c.label)}`), ...paras(c.why), bundleNote(c), callout(c),
          offerTable,
          NOTE(`${alt ? 'Fees are per 12 months, January to December 2027' : planName(c.plan) + ' has ' + pl.slots + ' slots in 2027'}. Half-year billing is also available; ${ebLine(k)}.`),
          H('', 'Key dates'), datesBox(k), H('', 'How to register'), howTo('<b>' + esc((c.tlds && c.tlds[0]) || 'your TLD') + '</b>'),
          ...(c.closing ? paras(c.closing).map((x) => x.replace('<p style="', '<p style="font-weight:bold;')) : [P(`Let’s keep growing ${esc(c.label)} in Vietnam together in 2027!`, 'font-weight:bold;')])]
      };
    },
    invite(c, k) {
      const name = esc(c.label || 'your TLD');
      return {
        subject: `Mat Bao MDF 2027: Beyond Visibility, Guaranteed Growth - Registration Opens ${k.startTxt.replace(/ \d{4}$/, '')}`,
        inner: [P(`<b>${esc(c.greet)}</b>`), P('I hope this email finds you well.'),
          P(`Every year Mat Bao invites our registry partners to the MDF Program to grow their TLDs in the Vietnamese market, and I am delighted to invite ${name} to the <b>Mat Bao MDF 2027 Program</b>. Registration opens on <b>${k.startTxt}</b>.`),
          H('', 'Beyond Visibility, Guaranteed Growth'), P('In 2027 we move beyond awareness: every package is measured by new registrations of your TLD, and your TLD appears at the moments customers choose a domain.'), whatsNew(),
          H('', 'Packages'), slotsTable(k, false), NOTE(`The full benefit comparison is on the MDF 2027 page. Half-year billing is also available; ${ebLine(k)}.`),
          H('', 'Key dates'), datesBox(k), H('', 'How to register'), howTo('your TLD'),
          P(`If you would like our recommendation for ${name}, just reply to this email and we will put one together. We look forward to growing with you in 2027!`, 'font-weight:bold;')]
      };
    },
    open(c, k) {
      const rec = c.plan ? P(`Our recommendation for ${esc(c.label)} is <b>${planName(c.plan)}</b> (${money(k.eb ? k.plans[c.plan].eb : k.plans[c.plan].list)} per year${k.eb ? ' at the early bird price' : ''}). ${k.plans[c.plan].left} of ${k.plans[c.plan].slots} ${planName(c.plan)} slots are still available.`) : '';
      return {
        subject: 'Mat Bao MDF 2027: Registration Is Now Open',
        inner: [P(`<b>${esc(c.greet)}</b>`), P(`Registration for the <b>Mat Bao MDF 2027 Program</b> opened on ${k.startDay}. Slots are confirmed first come, first served${k.eb ? `, and the ${k.pct}% early bird price runs until <b>${k.ebDay}</b>` : ''}.`),
          rec, bundleNote(c, true), callout(c), H('', 'Slots available today'), slotsTable(k, true), H('', 'Book in a few minutes'), howTo(c.tlds && c.tlds[0] ? '<b>' + esc(c.tlds[0]) + '</b>' : 'your TLD'),
          P('Happy to answer any questions: just reply to this email or message me on WhatsApp at +84 788 931 808.')]
      };
    },
    eb(c, k) {
      return {
        subject: `Mat Bao MDF 2027: Early Bird Price Ends ${k.ebDay}`,
        inner: [P(`<b>${esc(c.greet)}</b>`), P(`A quick reminder: the <b>${k.pct}% early bird price</b> for Mat Bao MDF 2027 ends on <b>${k.ebDay}</b> (GMT+7). After that, annual plans return to the list price.`),
          c.plan ? P(`For ${esc(c.label)} we recommend <b>${planName(c.plan)}</b>: ${money(k.plans[c.plan].eb)} instead of ${money(k.plans[c.plan].list)} per year.`) : '', bundleNote(c, true), callout(c),
          H('', 'Prices and slots left today'), slotsTable(k, true), H('', 'How to book'), howTo(c.tlds && c.tlds[0] ? '<b>' + esc(c.tlds[0]) + '</b>' : 'your TLD'),
          P('If anything is holding you back, reply to this email and we will help.')]
      };
    },
    final(c, k) {
      return {
        subject: `Mat Bao MDF 2027: Registration Closes ${k.endDay}`,
        inner: [P(`<b>${esc(c.greet)}</b>`), P(`Registration for <b>Mat Bao MDF 2027</b> closes on <b>${k.endDay}</b> (GMT+7). The programme runs from January to December 2027, and slots that are not booked by then will not reopen this year.`),
          bundleNote(c, true), H('', 'Slots left today'), slotsTable(k, true), H('', 'How to book'), howTo(c.tlds && c.tlds[0] ? '<b>' + esc(c.tlds[0]) + '</b>' : 'your TLD'),
          P('We would be glad to have you with us in 2027. Reply to this email if you have any questions.')]
      };
    },
    thanks(c, k) {
      const regs = registrationsOf(c);
      const ST = { on_hold: 'Being confirmed', confirmed: 'Confirmed', waitlist: 'Waitlist' };
      return {
        subject: 'Mat Bao MDF 2027: Thank You and Next Steps',
        inner: [P(`<b>${esc(c.greet)}</b>`), P('Thank you for joining the <b>Mat Bao MDF 2027 Program</b>. Here is a summary of your registration and what happens next.'),
          TABLE(TH('TLD') + TH('Package') + TH('Status') + TH('Ref', 1), regs.map((r) => `<tr>${TD('<b>' + esc(r.tlds.join(', ')) + '</b>')}${TD(planName(r.plan) + (r.billing === 'half' ? ' · half-year' : ''))}${TD(ST[r.status] || r.status)}${TD(esc(r.ref), 1)}</tr>`)),
          H('', 'Next steps'), OL(['Agreement and invoice: we will send them in the coming days, together with the Registrar Obligation for each package.',
            'Kick-off in January 2027: we agree on campaign timing, creative assets and, for Diamond, the Registration Guarantee floor.',
            'Monthly updates: you receive the performance of your TLD at Mat Bao throughout the year.']),
          regs.some((r) => r.status === 'waitlist') ? NOTE('For packages on the waitlist, we will contact you as soon as a slot becomes available.') : '',
          P('We look forward to a strong 2027 together!', 'font-weight:bold;')]
      };
    }
  };

  const toText = (html) => html.replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|li|tr|div)>/g, '\n').replace(/<li[^>]*>/g, '• ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

  function buildEmail(waveKey, c) {
    const w = WAVES.find((x) => x.key === waveKey);
    const k = facts();
    const e = TEMPLATES[w.tpl](c, k);
    const html = page(e.inner.filter(Boolean).join('\n'));
    // No attachments: images load from the site and the report is a private link. Outlook (new) cannot handle attachments in imported .msg drafts.
    const attachments = [];
    return { subject: e.subject, html, text: toText(e.inner.filter(Boolean).join('\n')) + '\n\nLAM QUANG THINH (RICKY)\nSenior Marketing Executive\nMat Bao Corporation', to: c.to || [], cc: c.cc || [], attachments };
  }

  function waveZip(waveKey) {
    const w = WAVES.find((x) => x.key === waveKey);
    if (!w || !w.tpl) throw Object.assign(new Error('Đợt này không có email mẫu.'), { status: 400 });
    const list = db.outreach.contacts.filter((c) => inAudience(c, w.audience));
    if (!list.length) throw Object.assign(new Error('Không có người nhận nào trong đợt này.'), { status: 400 });
    const files = [], safe = (s) => String(s).replace(/[\\/:*?"<>|]/g, '').trim();
    for (const c of list) {
      const m = buildEmail(waveKey, c), tz = TZ[c.tz] || TZ.asia;
      const base = `${tz.folder}/${(c.to || []).length ? '' : '[NO-TO] '}${safe(c.name)} - ${safe(w.title)}`;
      files.push({ name: base + '.msg', data: writeMsg(m) });
      files.push({ name: 'eml/' + base + '.eml', data: writeEml(m) });
    }
    files.push({ name: 'README.txt', data: Buffer.from(`MDF 2027 · ${w.title}\r\nGenerated ${new Date().toISOString()} from the dashboard settings.\r\n\r\nOpen each .msg in Outlook: it opens as a ready-to-send draft. Check recipients, then Send.\r\nSend times (Vietnam time): Asia 09:00, Europe 15:00, Americas 21:30. In Outlook: Options > Delay Delivery.\r\nFiles starting with [NO-TO] have no recipient yet: add the To address before sending.\r\nThe eml folder has the same drafts as .eml (backup for Outlook versions that do not open .msg).\r\n`) });
    return { name: `MDF2027-${schedule().find((x) => x.key === waveKey).date}-${waveKey}.zip`, data: zip(files), count: list.length };
  }
  function preview(waveKey, contactId) {
    const w = WAVES.find((x) => x.key === waveKey);
    if (!w || !w.tpl) return null;
    const list = db.outreach.contacts.filter((c) => inAudience(c, w.audience));
    const c = list.find((x) => x.id === contactId) || list[0];
    if (!c) return null;
    const m = buildEmail(waveKey, c);
    const head = `<div style="font:13px/1.5 Arial,sans-serif;background:#f3f5fb;border-bottom:1px solid #d9def0;padding:10px 14px;margin:0 0 12px;"><b>Subject:</b> ${esc(m.subject)}<br><b>To:</b> ${esc(m.to.map((r) => r.email).join(', ') || '(chưa có)')}<br><b>Cc:</b> ${esc(m.cc.map((r) => r.email).join(', '))}${w.tpl === 'offer' && hasPdf(c) ? '<br><b>Attach:</b> Mat Bao MDF 2026 Results - ' + esc(c.label) + '.pdf (tab Báo cáo 2026)' : ''}</div>`;
    return m.html.split(baseUrl + '/images/').join('/images/').replace('<body style="margin:0;padding:0;background:#ffffff;">', '<body style="margin:0;padding:0 12px;background:#ffffff;">' + head);
  }

  /* ── edits ── */
  function cleanPeople(list) {
    return (Array.isArray(list) ? list : []).map((x) => ({ name: String(x.name || '').trim().slice(0, 80), email: String(x.email || '').trim().toLowerCase().slice(0, 120) }))
      .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email));
  }
  function cleanContact(x, id) {
    return {
      id: id || crypto.randomUUID(), name: String(x.name || '').trim().slice(0, 80) || 'Registry', label: String(x.label || '').trim().slice(0, 40),
      tlds: (Array.isArray(x.tlds) ? x.tlds : String(x.tlds || '').split(/[\s,]+/)).map((t) => String(t).trim().toLowerCase()).filter(Boolean).map((t) => (t[0] === '.' ? t : '.' + t)).slice(0, 10),
      group: x.group === 'partner' ? 'partner' : 'new', tz: TZ[x.tz] ? x.tz : 'asia', greet: String(x.greet || '').trim().slice(0, 160) || 'Dear Registry team,',
      to: cleanPeople(x.to), cc: cleanPeople(x.cc), plan: ['diamond', 'gold', 'silver'].includes(x.plan) ? x.plan : '',
      results: (Array.isArray(x.results) ? x.results : []).map((r) => String(r).slice(0, 600)).slice(0, 4), why: String(x.why || '').slice(0, 600),
      note: String(x.note || '').slice(0, 1200), paused: x.paused === true,
      subject: String(x.subject || '').trim().slice(0, 200), intro: String(x.intro || '').slice(0, 3000), resultsNote: String(x.resultsNote || '').slice(0, 3000),
      closing: String(x.closing || '').slice(0, 1500), alt: ['diamond', 'gold', 'silver'].includes(x.alt) ? x.alt : '',
      pdf: String(x.pdf || '').replace(/[^\w-]/g, '').slice(0, 30),
      pdfToken: /^[\w-]{20,64}$/.test(String(x.pdfToken || '')) ? x.pdfToken : (x.pdf ? crypto.randomBytes(18).toString('base64url') : '')
    };
  }
  function importBundle(b, who) {
    let n = 0;
    if (Array.isArray(b.contacts)) { db.outreach.contacts = b.contacts.slice(0, 200).map((x) => cleanContact(x)); n = db.outreach.contacts.length; }
    const r = b.reports || {}, saved = [];
    fs.mkdirSync(REPORTS, { recursive: true });
    if (typeof r.internal === 'string' && r.internal.length < 8e6) { fs.writeFileSync(path.join(REPORTS, 'internal.html'), r.internal); saved.push('internal'); }
    for (const [key, val] of Object.entries(r.pdf || {})) {
      const k = String(key).replace(/[^\w-]/g, ''), buf = Buffer.from(String(val), 'base64');
      if (k && buf.slice(0, 4).toString() === '%PDF' && buf.length < 8e6) { fs.writeFileSync(path.join(REPORTS, k + '.pdf'), buf); saved.push(k); }
    }
    store.audit('outreach import', null, who, `${n} liên hệ · ${saved.length} báo cáo`);
    store.save();
    return { contacts: n, reports: saved };
  }
  function updateContact(b, who) {
    if (b.remove) { db.outreach.contacts = db.outreach.contacts.filter((c) => c.id !== b.id); store.audit('contact removed', null, who, b.id); store.save(); return null; }
    const i = db.outreach.contacts.findIndex((c) => c.id === b.id);
    const prev = i >= 0 ? db.outreach.contacts[i] : {};
    const c = cleanContact(Object.assign({}, prev, b), prev.id);
    if (i >= 0) db.outreach.contacts[i] = c; else db.outreach.contacts.push(c);
    store.audit('contact saved', null, who, c.name); store.save();
    return c;
  }
  function updateWave(b, who) {
    const w = WAVES.find((x) => x.key === b.key);
    if (!w) throw Object.assign(new Error('Không tìm thấy đợt gửi.'), { status: 404 });
    const st = db.outreach.waves[w.key] = db.outreach.waves[w.key] || {};
    if (b.status && ['todo', 'done', 'skipped'].includes(b.status)) {
      st.status = b.status; st.doneAt = b.status === 'todo' ? null : new Date().toISOString(); st.doneBy = b.status === 'todo' ? '' : who;
      store.audit('wave ' + b.status, null, who, w.title);
    }
    if (typeof b.note === 'string') st.note = b.note.slice(0, 1000);
    if (b.date === '' || b.date === null) delete st.date;
    else if (typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) st.date = b.date;
    store.save();
  }
  function reportsList() {
    const out = [];
    try { for (const f of fs.readdirSync(REPORTS)) { const st = fs.statSync(path.join(REPORTS, f)); out.push({ file: f, size: st.size, at: st.mtime.toISOString() }); } } catch (e) { /* none yet */ }
    return out.sort((a, b) => a.file.localeCompare(b.file));
  }
  function reportFile(name) {
    const f = String(name || '');
    if (!/^[\w-]+\.(pdf|html)$/.test(f)) return null;
    const p = path.join(REPORTS, f);
    return fs.existsSync(p) ? { path: p, type: f.endsWith('.pdf') ? 'application/pdf' : 'text/html; charset=utf-8' } : null;
  }
  function summary() {
    return {
      today: today(), tz: TZ, waves: schedule(), reports: reportsList(),
      contacts: db.outreach.contacts.map((c) => Object.assign({}, c, { registered: registrationsOf(c).map((r) => ({ tld: r.tlds[0], plan: r.plan, status: r.status })), hasPdf: hasPdf(c) }))
    };
  }
  // Parts of one email for copy and paste into a new Outlook message (works in every Outlook version).
  function emailParts(waveKey, contactId) {
    const w = WAVES.find((x) => x.key === waveKey);
    if (!w || !w.tpl) return null;
    const list = db.outreach.contacts.filter((c) => inAudience(c, w.audience));
    const c = list.find((x) => x.id === contactId) || list[0];
    if (!c) return null;
    const m = buildEmail(waveKey, c);
    const addr = (l) => l.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join('; ');
    const body = m.html.replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '');
    return { contact: c.id, name: c.name, to: addr(m.to), cc: addr(m.cc), subject: m.subject, html: body, text: m.text, pdf: w.tpl === 'offer' && hasPdf(c) ? c.pdf + '.pdf' : '' };
  }
  // Private report link: /r/<token> serves that registry's PDF only.
  function reportByToken(tok) {
    const c = db.outreach.contacts.find((x) => x.pdfToken && x.pdfToken === tok);
    if (!c || !hasPdf(c)) return null;
    return { path: path.join(REPORTS, c.pdf + '.pdf'), filename: `Mat Bao MDF 2026 Results - ${c.label}.pdf`, name: c.name };
  }
  return { summary, waveZip, preview, emailParts, importBundle, updateContact, updateWave, reportFile, reportByToken };
}

module.exports = { createOutreach, writeMsg, writeEml, zip };
