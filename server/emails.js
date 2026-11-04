'use strict';
/* Email templates. Registry-facing emails are in English; team alerts are in Vietnamese.
   Layout uses tables + inline styles so it renders in Outlook and Gmail. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmt = (iso, lang) => new Date(iso).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT+7)';
const PLAN_COLOR = { silver: '#8a94a6', gold: '#c99a00', diamond: '#3b82c4' };

// Reuse the same obligation text the landing page shows.
function loadObligation(siteRoot) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(siteRoot, 'js/mdf-obligation.js'), 'utf8'), ctx);
  return ctx.window.MDF_OBLIGATION;
}

function createEmails(siteRoot, baseUrl, assetUrl) {
  const O = loadObligation(siteRoot);
  const ASSET = (assetUrl || baseUrl).replace(/\/$/, '');
  // Palette mirrors the landing page: night navy, cyan + violet glow.
  const C = { bg: '#060a26', card: '#0c1442', panel: '#121c56', line: '#26327a', ink: '#ffffff', body: '#d7defc', mute: '#8f9bd0', cyan: '#7fe7ff', cyan2: '#22d3ee', blue: '#4f6bff', violet: '#8b5cf6' };
  const PLAN_TXT = { silver: '#e3e7f0', gold: '#ffe770', diamond: '#add2f4' };
  const FONT = "'Poppins','Segoe UI',Arial,Helvetica,sans-serif";

  function layout(title, bodyHtml, preheader) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(title)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
@media (max-width:620px){.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:22px!important;line-height:30px!important}.stack td{display:block!important;width:100%!important}}
a{color:${C.cyan}}</style></head>
<body style="margin:0;padding:0;background:${C.bg};" bgcolor="${C.bg}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}" style="background:${C.bg};"><tr><td align="center" style="padding:24px 10px 36px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="padding:0 4px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${ASSET}/images/email-logo.png" width="118" height="35" alt="MATBAO" style="display:block;border:0;font:700 20px/35px ${FONT};letter-spacing:1px;color:#ffffff;"></td>
    <td align="right" style="font:600 11px/16px ${FONT};letter-spacing:2px;color:${C.cyan};">MDF PROGRAM 2027</td>
  </tr></table>
</td></tr>
<tr><td style="border-radius:16px 16px 0 0;overflow:hidden;background:${C.card};" bgcolor="${C.card}">
  <img src="${ASSET}/images/email-header.jpg" width="600" alt="Mat Bao MDF Program 2027" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:16px 16px 0 0;background:${C.panel};background-image:linear-gradient(135deg,#0b1a5c,#3b1e9a);font:700 18px/24px ${FONT};color:${C.cyan};text-align:center;">
</td></tr>
<tr><td class="px" bgcolor="${C.card}" style="background:${C.card};padding:30px 36px 12px;border-left:1px solid ${C.line};border-right:1px solid ${C.line};font:400 15px/24px ${FONT};color:${C.body};">
${bodyHtml}
</td></tr>
<tr><td class="px" bgcolor="${C.card}" style="background:${C.card};padding:6px 36px 28px;border:1px solid ${C.line};border-top:0;border-radius:0 0 16px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${C.line};padding-top:18px;font:400 12px/19px ${FONT};color:${C.mute};">
  <b style="color:${C.ink};">This is an automated email. Please do not reply.</b><br>
  For any questions, email <a href="mailto:marcom@matbao.com" style="color:${C.cyan};text-decoration:none;font-weight:600;">marcom@matbao.com</a> (Ricky) · WhatsApp +84 78893 1808
  </td></tr></table>
</td></tr>
<tr><td align="center" style="padding:18px 10px 0;font:400 11px/17px ${FONT};color:${C.mute};">
  Mat Bao Corporation · <a href="https://www.matbao.net" style="color:${C.mute};">matbao.net</a>
</td></tr></table></td></tr></table></body></html>`;
  }
  const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 20px;"><tr>
<td bgcolor="${C.cyan2}" style="border-radius:10px;background:${C.cyan2};background-image:linear-gradient(90deg,${C.cyan2},${C.blue});">
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font:700 15px/20px ${FONT};color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)} &rarr;</a></td></tr></table>`;
  const eyebrow = (t) => `<div style="font:600 11px/16px ${FONT};letter-spacing:2px;text-transform:uppercase;color:${C.cyan};margin:0 0 8px;">${t}</div>`;
  const h1 = (t) => `<h1 class="h1" style="margin:0 0 16px;font:700 26px/34px ${FONT};color:${C.ink};">${t}</h1>`;
  const p = (t) => `<p style="margin:0 0 14px;font:400 15px/24px ${FONT};color:${C.body};">${t}</p>`;
  const b = (t) => `<b style="color:${C.ink};">${t}</b>`;
  const planTag = (k) => `<span style="font-weight:700;letter-spacing:1px;color:${PLAN_TXT[k] || C.ink};">${esc(k.toUpperCase())}</span>`;

  // Step tracker: where the registry is in the flow.
  function steps(active, lang) {
    const L = lang === 'vi' ? ['Đăng ký', 'Xác thực email', 'Mắt Bão xác nhận', 'Hợp đồng'] : ['Registered', 'Email confirmed', 'Mat Bao confirms', 'Contract'];
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr>${L.map((l, i) => {
      const done = i < active, cur = i === active;
      const dot = done ? `background:${C.cyan2};color:${C.bg};` : cur ? `background:${C.bg};color:${C.cyan};border:2px solid ${C.cyan};` : `background:${C.panel};color:${C.mute};border:2px solid ${C.line};`;
      return `<td width="25%" align="center" valign="top" style="font:600 11px/15px ${FONT};color:${done || cur ? C.ink : C.mute};">
<div style="width:26px;height:26px;line-height:${done ? 26 : 22}px;border-radius:50%;margin:0 auto 6px;font-size:12px;font-weight:700;${dot}">${done ? '&#10003;' : i + 1}</div>${l}</td>`;
    }).join('')}</tr></table>`;
  }

  function summary(r, lang) {
    const vi = lang === 'vi';
    const rows = [
      [vi ? 'Mã đăng ký' : 'Reference', b(esc(r.ref))],
      [vi ? 'Gói' : 'Package', `${planTag(r.plan)} &nbsp;·&nbsp; ${money(r.price)}${r.billing === 'half' ? (vi ? '/nửa năm' : '/half-year') : (vi ? '/năm' : '/year')}`],
      ['Registry', esc(r.registry)],
      ['TLD(s)', b(esc(r.tlds.join(', ')))],
      [vi ? 'Liên hệ' : 'Contact', esc(r.contactName) + (r.jobTitle ? ', ' + esc(r.jobTitle) : '') + '<br>' + esc(r.email) + (r.phone ? ' · ' + esc(r.phone) : '')]
    ];
    if (vi) rows.push(['Đã tham gia 2026', r.participated2026 ? 'Có' : 'Không']);
    if (r.notes) rows.push([vi ? 'Ghi chú' : 'Notes', esc(r.notes)]);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.panel}" style="background:${C.panel};border:1px solid ${C.line};border-radius:12px;margin:8px 0 18px;">
${rows.map(([k, v], i) => `<tr><td style="padding:11px 16px;${i ? `border-top:1px solid ${C.line};` : ''}width:32%;vertical-align:top;font:400 13px/20px ${FONT};color:${C.mute};">${k}</td><td style="padding:11px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:400 14px/21px ${FONT};color:${C.body};">${v}</td></tr>`).join('')}</table>`;
  }

  function obligationHtml(r, light) {
    const P = light ? Object.assign({}, C, { panel: '#ffffff', line: '#dfe4f5', ink: '#0b1440', body: '#1f274d', mute: '#5a6390', cyan: '#3b4bd8', cyan2: '#2f5bea' }) : C;
    const sections = O.plans[r.plan] || [];
    const tld = r.tlds.join(', ');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border:1px solid ${P.line};border-radius:12px;" bgcolor="${P.panel}"><tr><td style="padding:20px 20px 10px;">
<div style="font:600 11px/16px ${FONT};letter-spacing:2px;text-transform:uppercase;color:${P.cyan};margin:0 0 8px;">Attach to your agreement</div>
<div style="font:700 20px/28px ${FONT};color:${P.ink};">${esc(O.title)}</div>
<div style="font:600 13px/20px ${FONT};color:${P.cyan};margin:2px 0 6px;">For ${esc(tld)} · ${esc(r.plan.toUpperCase())} plan · Ref ${esc(r.ref)}</div>
<div style="font:400 12px/18px ${FONT};color:${P.mute};margin-bottom:6px;">${esc(O.program)} · Registrar: ${esc(O.registrar)} · Registry: ${esc(r.registry)} · Term: ${esc(O.term)}</div>
${sections.map((s) => `<div style="margin:16px 0 6px;padding-bottom:5px;border-bottom:1px solid ${P.line};font:600 14px/20px ${FONT};color:${P.cyan};">${esc(s.h)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.items.map((i) => `<tr><td width="18" valign="top" style="font:700 14px/22px ${FONT};color:${P.cyan2};">&#10003;</td><td style="padding:0 0 6px;font:400 14px/22px ${FONT};color:${P.body};">${esc(i.replace(/\{tld\}/g, tld))}</td></tr>`).join('')}</table>`).join('')}
</td></tr></table>`;
  }

  const verifyLink = (r) => `${baseUrl}/api/verify?t=${encodeURIComponent(r.verifyToken)}`;
  const obligationLink = (r) => `${baseUrl}/obligation/${encodeURIComponent(r.obligationToken)}`;

  return {
    obligationHtml, obligationLink, layout,

    verify(r, s) {
      return {
        tag: 'verify', to: [r.email], replyTo: s.replyTo,
        subject: `Confirm your email to hold your ${r.plan.toUpperCase()} slot – Mat Bao MDF 2027`,
        html: layout('Confirm your email', eyebrow('Step 2 of 4 · Action needed') + h1('Confirm your email to hold your slot') + steps(1) +
          p(`Hi ${b(esc(r.contactName))},`) +
          p(`Thank you for registering for the Mat Bao MDF Program 2027. Please confirm this email address to place your <b style="color:#ffffff;">${esc(r.plan.toUpperCase())}</b> slot on hold.`) +
          button(verifyLink(r), 'Confirm and hold my slot') +
          p(`This link expires on <b style="color:#ffffff;">${fmt(r.verifyExpiresAt)}</b>. Until you confirm, the slot is not held and other registries can still book it.`) +
          summary(r) + p('If you did not request this, you can ignore this email.'), 'Confirm your email to hold your slot'),
        text: `Confirm your email to hold your ${r.plan.toUpperCase()} slot: ${verifyLink(r)} (expires ${fmt(r.verifyExpiresAt)}). Ref ${r.ref}.`
      };
    },

    received(r, s) {
      return {
        tag: 'received', to: [r.email], replyTo: s.replyTo,
        subject: `We've received your registration ${r.ref} – Mat Bao MDF 2027`,
        html: layout('Registration received', eyebrow('Registration received') + h1('Your slot is on hold') + steps(2) +
          p(`Hi ${b(esc(r.contactName))},`) +
          p(`We have received your registration for the <b style="color:#ffffff;">${esc(r.plan.toUpperCase())}</b> package. The Mat Bao team will confirm your package within <b style="color:#ffffff;">${s.holdHours} hours</b> (by ${fmt(r.holdUntil)}) and contact you about the next steps: contract, invoice and brand assets.`) +
          summary(r) +
          p('While we review, your slot stays on hold and other registries see it as reserved.'), 'Your slot is on hold'),
        text: `Your ${r.plan.toUpperCase()} slot is on hold (ref ${r.ref}). We will confirm within ${s.holdHours} hours.`
      };
    },

    waitlist(r, s) {
      return {
        tag: 'waitlist', to: [r.email], replyTo: s.replyTo,
        subject: `You're on the waitlist for ${r.plan.toUpperCase()} – Mat Bao MDF 2027`,
        html: layout('Waitlist', eyebrow('Waitlist') + h1(`You're on the ${esc(r.plan.toUpperCase())} waitlist`) +
          p(`Hi ${b(esc(r.contactName))},`) +
          p(`All ${esc(r.plan.toUpperCase())} slots are currently reserved. We have added you to the waitlist in the order your registration arrived. If a slot is released, we will email you straight away.`) +
          summary(r) + p('Another package may still be available. Email marcom@matbao.com and we can help you compare.'), 'You are on the waitlist'),
        text: `All ${r.plan.toUpperCase()} slots are reserved. You are on the waitlist (ref ${r.ref}).`
      };
    },

    promoted(r, s) {
      return {
        tag: 'promoted', to: [r.email], replyTo: s.replyTo,
        subject: `A ${r.plan.toUpperCase()} slot is now on hold for you – Mat Bao MDF 2027`,
        html: layout('Slot available', eyebrow('Slot available') + h1('Good news: a slot opened up') + steps(2) +
          p(`Hi ${b(esc(r.contactName))},`) +
          p(`A <b style="color:#ffffff;">${esc(r.plan.toUpperCase())}</b> slot has been released and is now on hold for you. The Mat Bao team will confirm your package by <b style="color:#ffffff;">${fmt(r.holdUntil)}</b>.`) +
          summary(r), 'A slot is now on hold for you'),
        text: `A ${r.plan.toUpperCase()} slot is now on hold for you (ref ${r.ref}).`
      };
    },

    confirmed(r, s) {
      return {
        tag: 'confirmed', to: [r.email], replyTo: s.replyTo,
        subject: `Confirmed: your ${r.plan.toUpperCase()} package ${r.ref} – Mat Bao MDF 2027`,
        html: layout('Package confirmed', eyebrow('Welcome to MDF 2027') + h1(`Your ${planTag(r.plan)} package is confirmed`) + steps(3) +
          p(`Hi ${b(esc(r.contactName))},`) +
          p('Welcome to the Mat Bao MDF Program 2027. Your package is confirmed and the slot is now yours. Our team will send the contract and invoice shortly.') +
          summary(r) +
          p('Your <b style="color:#ffffff;">Registrar Obligation</b> lists the commitments for your package and can be attached to the agreement. Open it here and use “Save as PDF” to keep a copy:') +
          button(obligationLink(r), 'Open your Registrar Obligation'), 'Your package is confirmed'),
        text: `Your ${r.plan.toUpperCase()} package (ref ${r.ref}) is confirmed. Registrar Obligation: ${obligationLink(r)}`
      };
    },

    released(r, s, note) {
      return {
        tag: 'released', to: [r.email], replyTo: s.replyTo,
        subject: `Update on your registration ${r.ref} – Mat Bao MDF 2027`,
        html: layout('Registration update', eyebrow('Registration update') + h1('Update on your registration') +
          p(`Hi ${b(esc(r.contactName))},`) +
          p(`We are unable to confirm the <b style="color:#ffffff;">${esc(r.plan.toUpperCase())}</b> package for this registration, and the slot has been released.`) +
          (note ? p('<b style="color:#ffffff;">Note from our team:</b> ' + esc(note)) : '') +
          summary(r) + p('To discuss another package, email marcom@matbao.com.'), 'Update on your registration'),
        text: `We could not confirm registration ${r.ref}.` + (note ? ' Note: ' + note : '')
      };
    },

    teamNew(r, s, flags) {
      return {
        tag: 'team-new', to: s.teamEmails, replyTo: r.email,
        subject: `[MDF 2027] ${r.status === 'waitlist' ? 'Danh sách chờ' : 'Đăng ký mới'}: ${r.registry} – ${r.plan.toUpperCase()} (${r.ref})`,
        html: layout('Đăng ký mới', eyebrow('Thông báo nội bộ') + h1(r.status === 'waitlist' ? 'Có registry vào danh sách chờ' : 'Có registry vừa đăng ký') +
          p(r.status === 'waitlist'
            ? `Gói <b style="color:#ffffff;">${esc(r.plan.toUpperCase())}</b> đã hết suất, registry này được đưa vào danh sách chờ.`
            : `Suất <b style="color:#ffffff;">${esc(r.plan.toUpperCase())}</b> đang được giữ chỗ. Cần xác nhận trên dashboard trước <b style="color:#ffffff;">${fmt(r.holdUntil, 'vi')}</b>.`) +
          (flags.length ? p('<b style="color:#ffcf4d">Lưu ý:</b> ' + flags.map(esc).join(' · ')) : '') +
          summary(r, 'vi') + button(`${baseUrl}/admin/#reg-${r.id}`, 'Mở dashboard'), 'Đăng ký mới'),
        text: `Đăng ký mới ${r.ref}: ${r.registry} – ${r.plan}. Dashboard: ${baseUrl}/admin/`
      };
    },

    teamOverdue(r, s) {
      return {
        tag: 'team-overdue', to: s.teamEmails,
        subject: `[MDF 2027] Quá hạn xác nhận: ${r.registry} – ${r.plan.toUpperCase()} (${r.ref})`,
        html: layout('Quá hạn xác nhận', eyebrow('Nhắc việc') + h1('Đăng ký đã quá hạn xác nhận') +
          p(`Đăng ký này đã giữ chỗ quá ${s.holdHours} giờ (hạn ${fmt(r.holdUntil, 'vi')}). Vui lòng xác nhận hoặc từ chối để registry không phải chờ.`) +
          summary(r, 'vi') + button(`${baseUrl}/admin/#reg-${r.id}`, 'Mở dashboard'), 'Quá hạn xác nhận'),
        text: `Quá hạn xác nhận ${r.ref}.`
      };
    }
  };
}

module.exports = { createEmails, esc, money, fmt };
