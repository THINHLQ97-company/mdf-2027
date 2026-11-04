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

function createEmails(siteRoot, baseUrl) {
  const O = loadObligation(siteRoot);

  function layout(title, bodyHtml, preheader) {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#eef1fb;font-family:Arial,Helvetica,sans-serif;color:#1b2347;">
<span style="display:none;max-height:0;overflow:hidden;">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1fb;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0b1440;padding:22px 28px;">
  <div style="font-size:12px;letter-spacing:2px;color:#7fe7ff;font-weight:bold;">MAT BAO · MDF PROGRAM 2027</div>
</td></tr>
<tr><td style="padding:28px 28px 8px;font-size:15px;line-height:23px;">${bodyHtml}</td></tr>
<tr><td style="padding:18px 28px 26px;font-size:12px;line-height:18px;color:#6b7395;border-top:1px solid #e3e7f5;">
  Mat Bao Corporation · matbao.net<br>Questions? Reply to this email or contact marcom@matbao.com · WhatsApp +84 78893 1808
</td></tr></table></td></tr></table></body></html>`;
  }
  const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td style="background:#2563eb;border-radius:8px;">
<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;color:#ffffff;font-weight:bold;text-decoration:none;font-size:15px;">${esc(label)}</a></td></tr></table>`;
  const h1 = (t) => `<h1 style="margin:0 0 14px;font-size:22px;line-height:30px;color:#0b1440;">${t}</h1>`;
  const p = (t) => `<p style="margin:0 0 14px;">${t}</p>`;

  function summary(r, lang) {
    const vi = lang === 'vi';
    const rows = [
      [vi ? 'Mã đăng ký' : 'Reference', `<b>${esc(r.ref)}</b>`],
      [vi ? 'Gói' : 'Package', `<b style="color:${PLAN_COLOR[r.plan]}">${esc(r.plan.toUpperCase())}</b> · ${money(r.price)}${r.billing === 'half' ? (vi ? '/nửa năm' : '/half-year') : (vi ? '/năm' : '/year')}${r.earlyBird ? (vi ? ' (early bird)' : ' (early bird)') : ''}`],
      [vi ? 'Registry' : 'Registry', esc(r.registry)],
      ['TLD(s)', esc(r.tlds.join(', '))],
      [vi ? 'Liên hệ' : 'Contact', esc(r.contactName) + (r.jobTitle ? ', ' + esc(r.jobTitle) : '') + '<br>' + esc(r.email) + (r.phone ? ' · ' + esc(r.phone) : '')]
    ];
    if (vi) rows.push(['Đã tham gia 2026', r.participated2026 ? 'Có' : 'Không']);
    if (r.notes) rows.push([vi ? 'Ghi chú' : 'Notes', esc(r.notes)]);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fd;border-radius:10px;margin:8px 0 16px;font-size:14px;">
${rows.map(([k, v]) => `<tr><td style="padding:9px 14px;color:#6b7395;width:34%;vertical-align:top;">${k}</td><td style="padding:9px 14px;">${v}</td></tr>`).join('')}</table>`;
  }

  function obligationHtml(r) {
    const sections = O.plans[r.plan] || [];
    const tld = r.tlds.join(', ');
    return `<h2 style="margin:24px 0 4px;font-size:19px;color:#0b1440;">${esc(O.title)}</h2>
<div style="font-size:13px;color:#3b4bd8;font-weight:bold;margin-bottom:10px;">For ${esc(tld)} · ${esc(r.plan.toUpperCase())} plan · Ref ${esc(r.ref)}</div>
<div style="font-size:13px;color:#6b7395;margin-bottom:6px;">${esc(O.program)} · Registrar: ${esc(O.registrar)} · Registry: ${esc(r.registry)} · Term: ${esc(O.term)}</div>
${sections.map((s) => `<h3 style="margin:16px 0 4px;font-size:15px;color:#0b1440;border-bottom:1px solid #dfe4f5;padding-bottom:3px;">${esc(s.h)}</h3>
<ul style="margin:0;padding-left:20px;font-size:14px;line-height:21px;">${s.items.map((i) => `<li style="margin:3px 0;">${esc(i.replace(/\{tld\}/g, tld))}</li>`).join('')}</ul>`).join('')}`;
  }

  const verifyLink = (r) => `${baseUrl}/api/verify?t=${encodeURIComponent(r.verifyToken)}`;
  const obligationLink = (r) => `${baseUrl}/obligation/${encodeURIComponent(r.obligationToken)}`;

  return {
    obligationHtml, obligationLink, layout,

    verify(r, s) {
      return {
        tag: 'verify', to: [r.email], replyTo: s.replyTo,
        subject: `Confirm your email to hold your ${r.plan.toUpperCase()} slot – Mat Bao MDF 2027`,
        html: layout('Confirm your email', h1('Confirm your email to hold your slot') +
          p(`Hi ${esc(r.contactName)},`) +
          p(`Thank you for registering for the Mat Bao MDF Program 2027. Please confirm this email address to place your <b>${esc(r.plan.toUpperCase())}</b> slot on hold.`) +
          button(verifyLink(r), 'Confirm and hold my slot') +
          p(`This link expires on <b>${fmt(r.verifyExpiresAt)}</b>. Until you confirm, the slot is not held and other registries can still book it.`) +
          summary(r) + p('If you did not request this, you can ignore this email.'), 'Confirm your email to hold your slot'),
        text: `Confirm your email to hold your ${r.plan.toUpperCase()} slot: ${verifyLink(r)} (expires ${fmt(r.verifyExpiresAt)}). Ref ${r.ref}.`
      };
    },

    received(r, s) {
      return {
        tag: 'received', to: [r.email], replyTo: s.replyTo,
        subject: `We've received your registration ${r.ref} – Mat Bao MDF 2027`,
        html: layout('Registration received', h1('Your slot is on hold') +
          p(`Hi ${esc(r.contactName)},`) +
          p(`We have received your registration for the <b>${esc(r.plan.toUpperCase())}</b> package. The Mat Bao team will confirm your package within <b>${s.holdHours} hours</b> (by ${fmt(r.holdUntil)}) and contact you about the next steps: contract, invoice and brand assets.`) +
          summary(r) +
          p('While we review, your slot stays on hold and other registries see it as reserved.'), 'Your slot is on hold'),
        text: `Your ${r.plan.toUpperCase()} slot is on hold (ref ${r.ref}). We will confirm within ${s.holdHours} hours.`
      };
    },

    waitlist(r, s) {
      return {
        tag: 'waitlist', to: [r.email], replyTo: s.replyTo,
        subject: `You're on the waitlist for ${r.plan.toUpperCase()} – Mat Bao MDF 2027`,
        html: layout('Waitlist', h1(`You're on the ${esc(r.plan.toUpperCase())} waitlist`) +
          p(`Hi ${esc(r.contactName)},`) +
          p(`All ${esc(r.plan.toUpperCase())} slots are currently reserved. We have added you to the waitlist in the order your registration arrived. If a slot is released, we will email you straight away.`) +
          summary(r) + p('Another package may still be available. Reply to this email and we can help you compare.'), 'You are on the waitlist'),
        text: `All ${r.plan.toUpperCase()} slots are reserved. You are on the waitlist (ref ${r.ref}).`
      };
    },

    promoted(r, s) {
      return {
        tag: 'promoted', to: [r.email], replyTo: s.replyTo,
        subject: `A ${r.plan.toUpperCase()} slot is now on hold for you – Mat Bao MDF 2027`,
        html: layout('Slot available', h1('Good news: a slot opened up') +
          p(`Hi ${esc(r.contactName)},`) +
          p(`A <b>${esc(r.plan.toUpperCase())}</b> slot has been released and is now on hold for you. The Mat Bao team will confirm your package by <b>${fmt(r.holdUntil)}</b>.`) +
          summary(r), 'A slot is now on hold for you'),
        text: `A ${r.plan.toUpperCase()} slot is now on hold for you (ref ${r.ref}).`
      };
    },

    confirmed(r, s) {
      return {
        tag: 'confirmed', to: [r.email], replyTo: s.replyTo,
        subject: `Confirmed: your ${r.plan.toUpperCase()} package ${r.ref} – Mat Bao MDF 2027`,
        html: layout('Package confirmed', h1(`Your ${esc(r.plan.toUpperCase())} package is confirmed`) +
          p(`Hi ${esc(r.contactName)},`) +
          p('Welcome to the Mat Bao MDF Program 2027. Your package is confirmed and the slot is now yours. Our team will send the contract and invoice shortly.') +
          summary(r) +
          p('Below is your <b>Registrar Obligation</b>, listing what Mat Bao commits to for your TLD. You can attach it to the agreement. A printable version is available here:') +
          button(obligationLink(r), 'Open printable Registrar Obligation') +
          obligationHtml(r), 'Your package is confirmed'),
        text: `Your ${r.plan.toUpperCase()} package (ref ${r.ref}) is confirmed. Registrar Obligation: ${obligationLink(r)}`
      };
    },

    released(r, s, note) {
      return {
        tag: 'released', to: [r.email], replyTo: s.replyTo,
        subject: `Update on your registration ${r.ref} – Mat Bao MDF 2027`,
        html: layout('Registration update', h1('Update on your registration') +
          p(`Hi ${esc(r.contactName)},`) +
          p(`We are unable to confirm the <b>${esc(r.plan.toUpperCase())}</b> package for this registration, and the slot has been released.`) +
          (note ? p('<b>Note from our team:</b> ' + esc(note)) : '') +
          summary(r) + p('Reply to this email if you would like to discuss another package.'), 'Update on your registration'),
        text: `We could not confirm registration ${r.ref}.` + (note ? ' Note: ' + note : '')
      };
    },

    teamNew(r, s, flags) {
      return {
        tag: 'team-new', to: s.teamEmails, replyTo: r.email,
        subject: `[MDF 2027] ${r.status === 'waitlist' ? 'Danh sách chờ' : 'Đăng ký mới'}: ${r.registry} – ${r.plan.toUpperCase()} (${r.ref})`,
        html: layout('Đăng ký mới', h1(r.status === 'waitlist' ? 'Có registry vào danh sách chờ' : 'Có registry vừa đăng ký') +
          p(r.status === 'waitlist'
            ? `Gói <b>${esc(r.plan.toUpperCase())}</b> đã hết suất, registry này được đưa vào danh sách chờ.`
            : `Suất <b>${esc(r.plan.toUpperCase())}</b> đang được giữ chỗ. Cần xác nhận trên dashboard trước <b>${fmt(r.holdUntil, 'vi')}</b>.`) +
          (flags.length ? p('<b style="color:#b45309">Lưu ý:</b> ' + flags.map(esc).join(' · ')) : '') +
          summary(r, 'vi') + button(`${baseUrl}/admin/#reg-${r.id}`, 'Mở dashboard'), 'Đăng ký mới'),
        text: `Đăng ký mới ${r.ref}: ${r.registry} – ${r.plan}. Dashboard: ${baseUrl}/admin/`
      };
    },

    teamOverdue(r, s) {
      return {
        tag: 'team-overdue', to: s.teamEmails,
        subject: `[MDF 2027] Quá hạn xác nhận: ${r.registry} – ${r.plan.toUpperCase()} (${r.ref})`,
        html: layout('Quá hạn xác nhận', h1('Đăng ký đã quá hạn xác nhận') +
          p(`Đăng ký này đã giữ chỗ quá ${s.holdHours} giờ (hạn ${fmt(r.holdUntil, 'vi')}). Vui lòng xác nhận hoặc từ chối để registry không phải chờ.`) +
          summary(r, 'vi') + button(`${baseUrl}/admin/#reg-${r.id}`, 'Mở dashboard'), 'Quá hạn xác nhận'),
        text: `Quá hạn xác nhận ${r.ref}.`
      };
    }
  };
}

module.exports = { createEmails, esc, money, fmt };
