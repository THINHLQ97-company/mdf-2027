'use strict';
/* Email delivery. MAIL_PROVIDER picks the transport:
   - outbox  (default) writes each email to data/outbox/ so it can be previewed without sending anything
   - smtp    sends through any SMTP relay, e.g. Sendify's SMTP credentials (needs `npm install nodemailer`)
   - sendify sends through the Sendify Email API (POST https://sendify.vn/api/emails). */
const fs = require('fs');
const path = require('path');

function createMailer(env, outboxDir) {
  const provider = (env.MAIL_PROVIDER || 'outbox').toLowerCase();
  const from = { email: env.MAIL_FROM || 'no-reply@news.matbao.com', name: env.MAIL_FROM_NAME || 'Mat Bao MDF Program' };
  let smtp = null;

  if (provider === 'smtp') {
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch (e) { throw new Error('MAIL_PROVIDER=smtp needs `npm install nodemailer`'); }
    smtp = nodemailer.createTransport({
      host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: String(env.SMTP_SECURE) === 'true',
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    });
  }

  // Sendify Email API (matbao.net/sendify): POST /v1/emails, Bearer auth, 202 { id, status: "queued" }.
  function buildSendifyRequest(msg) {
    return {
      url: env.SENDIFY_API_URL || 'https://sendify.vn/api/emails',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.SENDIFY_API_KEY },
      // Sendify accepts only: from, to, subject, html, text, template_id, variables, idempotency_key.
      body: {
        from: `${from.name} <${from.email}>`,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text ? msg.text + '\n\nThis is an automated email. Please do not reply. Questions: marcom@matbao.com' : undefined,
        idempotency_key: msg.idempotencyKey || require('crypto').randomUUID()
      }
    };
  }

  async function send(msg) {
    // msg: { to: [..], subject, html, text, replyTo, tag }
    if (provider === 'smtp') {
      const info = await smtp.sendMail({
        from: `"${from.name}" <${from.email}>`, to: msg.to.join(', '), replyTo: msg.replyTo,
        subject: msg.subject, html: msg.html, text: msg.text
      });
      return { provider, id: info.messageId };
    }
    if (provider === 'sendify') {
      if (!env.SENDIFY_API_KEY) throw new Error('SENDIFY_API_KEY is required');
      const req = buildSendifyRequest(msg);
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      if (!res.ok) throw new Error('Sendify ' + res.status + ': ' + body.slice(0, 300));
      let id = ''; try { id = JSON.parse(body).id || ''; } catch (e) { id = body.slice(0, 80); }
      return { provider, id };
    }
    fs.mkdirSync(outboxDir, { recursive: true });
    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + (msg.tag || 'mail');
    fs.writeFileSync(path.join(outboxDir, id + '.html'),
      `<!-- To: ${msg.to.join(', ')} | Subject: ${msg.subject.replace(/--/g, '-')} -->\n` + msg.html);
    return { provider: 'outbox', id };
  }

  return { send, provider, from };
}

module.exports = { createMailer };
