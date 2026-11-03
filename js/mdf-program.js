/* MDF Program 2027 — standalone behaviour (no framework, no build step).
   Ported from the Next.js page: slide deck (wheel / touch / menu), mobile menu, early-bird countdown,
   Packages <-> Add-ons toggle, 3-step "Book your plan" form and the password gate. */
(function () {
  'use strict';

  var D = window.MDF_DATA;
  var PASSWORD = '@mdf2027';
  var STORAGE_KEY = 'mdf2027-authed';
  // Early bird deadline (GMT+7). Prices drop back to list price automatically after this moment.
  var EARLY_BIRD_DEADLINE = new Date('2026-12-31T23:59:59+07:00');
  function isEarlyBird() { return Date.now() < EARLY_BIRD_DEADLINE.getTime(); }
  var SLIDES = ['hero', 'sec-intro', 'sec-benefits', 'sec-guarantee', 'sec-packages', 'sec-comparison', 'sec-about', 'sec-book'];
  // Pages with their own scroll: wheel scrolls the page first, only switches slide at the top/bottom edge.
  var INTERNAL_SCROLL = ['sec-benefits', 'sec-guarantee', 'sec-packages', 'sec-comparison', 'sec-book'];

  var root = document.getElementById('mdf-root');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isAuthed() {
    try { return window.sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  /* ───────────── Password gate ───────────── */
  function mountGate() {
    root.appendChild(document.getElementById('tpl-gate').content.cloneNode(true));
    var form = document.getElementById('login_area');
    var input = form.querySelector('input');
    input.focus();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (input.value !== PASSWORD) return;
      try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* private mode: still let the visitor in */ }
      root.innerHTML = '';
      mountDeck();
    });
  }

  /* ───────────── Deck ───────────── */
  var active = 'hero';
  var wheelLock = false;
  var touchStartY = 0;
  var pages, navItems, menuBox, menuBtn, scrollHint;

  function setActive(key) {
    if (SLIDES.indexOf(key) < 0) return;
    active = key;
    pages.forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-slide') === key); });
    navItems.forEach(function (li) { li.classList.toggle('active', li.getAttribute('data-target') === key); });
    scrollHint.style.display = key === 'hero' ? '' : 'none';
    hideTip();
    setMenu(false);
  }

  function setMenu(open) {
    menuBox.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.textContent = open ? menuBtn.getAttribute('data-close') : menuBtn.getAttribute('data-menu');
  }

  function go(direction) {
    if (wheelLock) return;
    var next = SLIDES.indexOf(active) + direction;
    if (next < 0 || next >= SLIDES.length) return;
    wheelLock = true;
    setActive(SLIDES[next]);
    window.setTimeout(function () { wheelLock = false; }, 700);
  }

  function activePageEl() {
    return root.querySelector('.mdf-page.active');
  }

  function onWheel(e) {
    if (window.innerWidth <= 900) return;
    if (INTERNAL_SCROLL.indexOf(active) >= 0) {
      var el = activePageEl();
      if (el) {
        if (e.deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 2) return;
        if (e.deltaY < 0 && el.scrollTop > 2) return;
      }
    }
    e.preventDefault();
    go(e.deltaY > 0 ? 1 : -1);
  }

  function onTouchStart(e) { touchStartY = e.touches[0].screenY; }
  function onTouchEnd(e) {
    var deltaY = touchStartY - e.changedTouches[0].screenY;
    if (Math.abs(deltaY) < 50) return;
    // Mobile: every slide scrolls internally first; desktop: only packages / comparison.
    var isMobile = window.innerWidth <= 900;
    if (isMobile || INTERNAL_SCROLL.indexOf(active) >= 0) {
      var el = activePageEl();
      if (el) {
        if (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 2) return;
        if (deltaY < 0 && el.scrollTop > 2) return;
      }
    }
    go(deltaY > 0 ? 1 : -1);
  }

  function startCountdown() {
    var wrap = root.querySelector('.title-countdown');
    var units = root.querySelectorAll('.time-countdown u');
    if (units.length < 3) return;
    if (!isEarlyBird()) { if (wrap) wrap.style.display = 'none'; return; }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var total = Math.floor(Math.max(0, EARLY_BIRD_DEADLINE.getTime() - Date.now()) / 1000);
      if (total === 0 && wrap) wrap.style.display = 'none';
      var vals = [Math.floor(total / 86400), Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60)];
      units.forEach(function (u, i) { u.lastChild.nodeValue = pad(vals[i]); });
    }
    tick();
    window.setInterval(tick, 1000);
  }

  function mountDeck() {
    root.appendChild(document.getElementById('tpl-deck').content.cloneNode(true));
    pages = Array.prototype.slice.call(root.querySelectorAll('.mdf-page'));
    navItems = Array.prototype.slice.call(root.querySelectorAll('.topmenu ul li'));
    menuBox = root.querySelector('.topmenu');
    menuBtn = root.querySelector('.topmenu-toggle');
    scrollHint = document.getElementById('mdf-scroll-hint');

    menuBtn.addEventListener('click', function () { setMenu(!menuBox.classList.contains('open')); });
    navItems.forEach(function (li) {
      li.addEventListener('click', function () { setActive(li.getAttribute('data-target')); });
    });
    root.querySelectorAll('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { setActive(b.getAttribute('data-goto')); });
    });

    renderPackages();
    renderForm();
    startCountdown();
    setActive('hero');

    if (!mountDeck.bound) {
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
      mountDeck.bound = true;
    }
  }

  /* ───────────── Packages / Add-ons ───────────── */
  // list = annual list price; half = half-year price. Early-bird price (5% off) is computed.
  var PACKAGES = [
    { key: 'silver', list: 900, half: 500, slots: 5, total: 5, features: ['searchSilver', 'aiStandard', 'sharedBoost', 'quarterlyRefresh'] },
    { key: 'gold', list: 4200, half: 2310, slots: 3, total: 3, popular: true, features: ['searchGold', 'suggestGold', 'vibeGold', 'comboCard', 'boostGold', 'merchGold'], isNew: ['vibeGold', 'comboCard'] },
    { key: 'diamond', list: 6500, half: 3575, slots: 2, total: 2, features: ['searchDiamond', 'suggestDiamond', 'vibeDiamond', 'cartPopup', 'guarantee', 'boostDiamond', 'merchDiamond'], isNew: ['vibeDiamond', 'cartPopup', 'guarantee'] }
  ];
  var EARLY_DISCOUNT = 0.05;
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function priceOf(p) { return isEarlyBird() ? p.list * (1 - EARLY_DISCOUNT) : p.list; }

  function renderPackages() {
    var box = document.getElementById('pkg-container');
    var desc = document.getElementById('pkg-desc');
    if (desc) desc.textContent = isEarlyBird() ? D.packages.subtitle.replace('{deadline}', EARLY_BIRD_DEADLINE.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })) : D.packages.subtitleAfter;
    box.querySelectorAll('.group').forEach(function (n) { n.remove(); });
    var t = D.packages, h = '';
    h += '<div class="group">' + PACKAGES.map(function (p) {
      return '<div class="item ' + p.key + '">' +
        (p.popular ? '<div class="hot">' + esc(t.mostPopular) + '</div>' : '') +
        '<strong>' + esc(t.items[p.key].title) + '</strong><span class="desc">' + esc(t.items[p.key].desc) + '</span>' +
        (isEarlyBird() ? '<s>' + money(p.list) + '</s>' : '') + '<b>' + money(priceOf(p)) + '<i> ' + esc(t.perYear) + '</i></b>' +
        '<u>' + esc(t.halfYearPrefix) + ' ' + money(p.half) + esc(t.halfYearSuffix) + '</u>' +
        '<button type="button" class="cta" data-book="' + p.key + '">' + esc(t.cta) + '</button>' +
          '<button type="button" class="ob-link" data-ob="' + p.key + '">View Registrar Obligation</button>' +
        '<ul>' + p.features.map(function (f) { return '<li' + (p.isNew && p.isNew.indexOf(f) >= 0 ? ' class="new"' : '') + '>' + esc(t.features[f]) + '</li>'; }).join('') + '</ul>' +
        '<div class="note">' + esc(p.key === 'diamond' ? t.exclusive : t.limited) + ' <b>' + p.slots + '</b> ' + esc(p.slots === 1 ? t.slotAvailable : t.slotsAvailable) + '</div></div>';
    }).join('') + '</div>';
    box.insertAdjacentHTML('beforeend', h);
    box.querySelectorAll('[data-book]').forEach(function (b) {
      b.addEventListener('click', function () { bookPlan(b.getAttribute('data-book')); });
    });
  }

  /* ───────────── Book your plan: Plan → Details → Review & reserve ─────────────
     State lives in `bk`. A draft is kept in localStorage so a half-filled form survives a reload.
     submitRegistration() is the hand-off point for the backend / Sendify flow (part 3). */
  var HOLD_HOURS = 72;
  var DRAFT_KEY = 'mdf2027-booking-draft';
  var BK_STEPS = ['plan', 'details', 'review'];
  var bk = {
    step: 0, done: null, errors: {},
    plan: '', billing: 'annual',
    registry: '', tlds: '', contactName: '', jobTitle: '', email: '', phone: '', participated: '', notes: '', consent: false
  };
  var BK_FIELDS = ['plan', 'billing', 'registry', 'tlds', 'contactName', 'jobTitle', 'email', 'phone', 'participated', 'notes'];

  function loadDraft() {
    try {
      var d = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
      if (d) BK_FIELDS.forEach(function (k) { if (typeof d[k] === 'string') bk[k] = d[k]; });
    } catch (e) { /* storage blocked: start empty */ }
  }
  function saveDraft() {
    try {
      var d = {}; BK_FIELDS.forEach(function (k) { d[k] = bk[k]; });
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* ignore */ }
  }
  function clearDraft() { try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  function planOf(key) { return PACKAGES.filter(function (p) { return p.key === key; })[0]; }
  function parseTlds(s) {
    return String(s).split(/[\s,;]+/).map(function (x) { x = x.trim().toLowerCase(); return x ? (x.charAt(0) === '.' ? x : '.' + x) : ''; })
      .filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
  }
  function quote() {
    var p = planOf(bk.plan);
    if (!p) return null;
    var half = bk.billing === 'half';
    return { plan: p, amount: half ? p.half : priceOf(p), unit: half ? '/half-year' : '/year', early: !half && isEarlyBird() };
  }

  function validate(step) {
    var e = {};
    if (step === 0) {
      if (!bk.plan) e.plan = 'Choose a package to continue.';
    } else if (step === 1) {
      if (!bk.registry.trim()) e.registry = 'Enter your registry or company name.';
      var t = parseTlds(bk.tlds);
      if (!t.length) e.tlds = 'Enter at least one TLD, for example .cloud';
      else if (t.some(function (x) { return !/^\.[\p{L}\p{N}-]{2,63}$/u.test(x); })) e.tlds = 'Check the TLD format, for example .cloud, .asia';
      if (!bk.contactName.trim()) e.contactName = 'Enter the name of the person we should contact.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(bk.email.trim())) e.email = 'Enter a valid work email, for example name@registry.com';
      if (!bk.participated) e.participated = 'Let us know if you joined in 2026.';
    } else if (step === 2) {
      if (!bk.consent) e.consent = 'Please confirm to reserve your slot.';
    }
    bk.errors = e;
    return !Object.keys(e).length;
  }

  function err(k) { return bk.errors[k] ? '<p class="bk-err" id="err-' + k + '">' + esc(bk.errors[k]) + '</p>' : ''; }
  function field(id, label, type, ph, required, hint) {
    var v = bk[id];
    return '<div class="bk-field' + (bk.errors[id] ? ' has-err' : '') + '"><label for="bk-' + id + '">' + esc(label) + (required ? ' <span class="req">*</span>' : ' <span class="opt">(optional)</span>') + '</label>' +
      (type === 'textarea'
        ? '<textarea id="bk-' + id + '" data-bk="' + id + '" rows="3" placeholder="' + esc(ph) + '">' + esc(v) + '</textarea>'
        : '<input id="bk-' + id + '" data-bk="' + id + '" type="' + type + '" placeholder="' + esc(ph) + '" value="' + esc(v) + '"' + (bk.errors[id] ? ' aria-invalid="true" aria-describedby="err-' + id + '"' : '') + '>') +
      (hint ? '<p class="bk-hint">' + hint + '</p>' : '') + err(id) + '</div>';
  }

  function renderSteps() {
    return '<ol class="bk-steps">' + BK_STEPS.map(function (k, i) {
      var cls = i === bk.step ? 'active' : (i < bk.step ? 'done' : '');
      var label = { plan: 'Choose plan', details: 'Your details', review: 'Review & reserve' }[k];
      return '<li class="' + cls + '">' + (i < bk.step ? '<button type="button" data-bk-go="' + i + '"><i>✓</i>' + label + '</button>' : '<span><i>' + (i + 1) + '</i>' + label + '</span>') + '</li>';
    }).join('') + '</ol>';
  }

  function renderPlanStep() {
    var h = '<div class="bk-plans" role="radiogroup" aria-label="Package">' + PACKAGES.map(function (p) {
      var full = p.slots <= 0;
      return '<label class="bk-plan ' + p.key + (bk.plan === p.key ? ' sel' : '') + (full ? ' full' : '') + '" for="bk-plan-' + p.key + '">' +
        '<input type="radio" name="bk-plan" id="bk-plan-' + p.key + '" value="' + p.key + '"' + (bk.plan === p.key ? ' checked' : '') + '>' +
        '<span class="nm">' + p.key.toUpperCase() + (p.popular ? ' <em>Most popular</em>' : '') + '</span>' +
        '<span class="pr">' + money(priceOf(p)) + '<small>/year</small></span>' +
        '<span class="sl">' + (full ? 'Fully booked · join the waitlist' : p.slots + ' ' + (p.slots === 1 ? 'slot' : 'slots') + ' left') + '</span></label>';
    }).join('') + '</div>' + err('plan');
    var p = planOf(bk.plan);
    h += '<div class="bk-field"><span class="bk-lbl" id="bill-lbl">Billing cycle</span><div class="bk-seg" role="radiogroup" aria-labelledby="bill-lbl">' +
      '<label class="' + (bk.billing === 'annual' ? 'sel' : '') + '"><input type="radio" name="bk-billing" value="annual"' + (bk.billing === 'annual' ? ' checked' : '') + '>Annual' + (p ? ' · ' + money(priceOf(p)) : '') + '</label>' +
      '<label class="' + (bk.billing === 'half' ? 'sel' : '') + '"><input type="radio" name="bk-billing" value="half"' + (bk.billing === 'half' ? ' checked' : '') + '>Half-year' + (p ? ' · ' + money(p.half) : '') + '</label></div>' +
      (bk.plan === 'diamond' && bk.billing === 'half' ? '<p class="bk-warn">The Registration Guarantee applies to annual Diamond plans only.</p>' : '') + '</div>';
    h += '<div class="bk-actions"><button type="button" class="bk-btn primary" data-bk-act="next">Continue</button></div>';
    return h;
  }

  function renderDetailsStep() {
    var tl = parseTlds(bk.tlds);
    var h = '<div class="bk-grid">' +
      field('registry', 'Registry / company', 'text', 'e.g. DotAsia Organisation', true) +
      field('tlds', 'TLD(s) to promote', 'text', 'e.g. .asia, .cloud', true, tl.length ? 'Will be listed as: <b>' + tl.map(esc).join(' · ') + '</b>' : 'Separate several TLDs with a comma.') +
      field('contactName', 'Contact person', 'text', 'Full name', true) +
      field('jobTitle', 'Job title', 'text', 'e.g. Channel Manager', false) +
      field('email', 'Work email', 'email', 'name@registry.com', true, 'Your confirmation and contract are sent here.') +
      field('phone', 'WhatsApp / phone', 'tel', '+65 …', false) +
      '</div>' +
      '<div class="bk-field' + (bk.errors.participated ? ' has-err' : '') + '"><span class="bk-lbl" id="part-lbl">Did you join the Mat Bao MDF Program in 2026? <span class="req">*</span></span><div class="bk-seg" role="radiogroup" aria-labelledby="part-lbl">' +
      '<label class="' + (bk.participated === 'yes' ? 'sel' : '') + '"><input type="radio" name="bk-part" value="yes"' + (bk.participated === 'yes' ? ' checked' : '') + '>Yes</label>' +
      '<label class="' + (bk.participated === 'no' ? 'sel' : '') + '"><input type="radio" name="bk-part" value="no"' + (bk.participated === 'no' ? ' checked' : '') + '>No</label></div>' + err('participated') + '</div>' +
      field('notes', 'Anything we should know?', 'textarea', 'Launch plans, promo pricing, preferred start month…', false) +
      '<div class="bk-actions"><button type="button" class="bk-btn ghost" data-bk-act="back">Back</button><button type="button" class="bk-btn primary" data-bk-act="next">Review</button></div>';
    return h;
  }

  function row(label, value, goStep) {
    return '<div class="bk-row"><dt>' + esc(label) + '</dt><dd>' + value + '</dd>' + (goStep != null ? '<button type="button" class="bk-edit" data-bk-go="' + goStep + '">Edit</button>' : '') + '</div>';
  }
  function renderReviewStep() {
    var q = quote();
    var h = '<dl class="bk-review">' +
      row('Package', esc(q.plan.key.toUpperCase()) + ' · ' + money(q.amount) + esc(q.unit) + (q.early ? ' <span class="pill">Early bird</span>' : ''), 0) +
      row('Registry', esc(bk.registry), 1) +
      row('TLD(s)', parseTlds(bk.tlds).map(esc).join(' · '), 1) +
      row('Contact', esc(bk.contactName) + (bk.jobTitle ? ', ' + esc(bk.jobTitle) : '') + '<br>' + esc(bk.email) + (bk.phone ? ' · ' + esc(bk.phone) : ''), 1) +
      row('Joined in 2026', bk.participated === 'yes' ? 'Yes' : 'No', 1) +
      (bk.notes.trim() ? row('Notes', esc(bk.notes), 1) : '') + '</dl>' +
      '<label class="bk-consent' + (bk.errors.consent ? ' has-err' : '') + '" for="bk-consent"><input type="checkbox" id="bk-consent"' + (bk.consent ? ' checked' : '') + '>' +
      '<span>I understand my slot is held for ' + HOLD_HOURS + ' hours. If the contract is not signed in that time, the slot is released to the next registry.</span></label>' + err('consent') +
      '<div class="bk-actions"><button type="button" class="bk-btn ghost" data-bk-act="back">Back</button><button type="button" class="bk-btn primary" data-bk-act="submit">Reserve my slot</button></div>';
    return h;
  }

  function renderDone() {
    var d = bk.done;
    return '<div class="bk-done"><div class="bk-tick" aria-hidden="true">✓</div><strong>Your slot is reserved</strong>' +
      '<p>Reference <b>' + esc(d.ref) + '</b> · ' + esc(d.plan.toUpperCase()) + '</p>' +
      '<p>Held until <b>' + esc(d.holdUntil) + '</b> (GMT+7)</p>' +
      '<ol class="bk-next"><li><b>Now</b> Confirmation email to ' + esc(d.email) + '</li><li><b>Within 1 business day</b> Contract and invoice from our team</li><li><b>Before the hold ends</b> Sign the contract to secure your slot</li><li><b>After payment</b> Kick-off and your benefits go live</li></ol>' +
      '<button type="button" class="bk-btn primary bk-ob" data-ob="' + esc(d.plan) + '" data-ob-tlds="' + esc(d.tlds.join(', ')) + '" data-ob-ref="' + esc(d.ref) + '" data-ob-reg="' + esc(d.registry) + '">View your Registrar Obligation</button>' +
      (d.preview ? '<p class="bk-preview">Preview mode: this registration was not sent anywhere yet.</p>' : '') +
      '<button type="button" class="bk-btn ghost" data-bk-act="restart">Book another package</button></div>';
  }

  function renderSummary() {
    var box = document.getElementById('mdf-summary');
    if (!box) return;
    var q = quote();
    var h = '<strong>Your reservation</strong>';
    if (!q) {
      h += '<p class="bk-sum-empty">Choose a package to see your price and available slots.</p>';
    } else {
      h += '<div class="bk-sum-plan ' + q.plan.key + '">' + q.plan.key.toUpperCase() + '</div>' +
        '<div class="bk-sum-price">' + money(q.amount) + '<small>' + q.unit + '</small></div>' +
        (q.early ? '<div class="bk-sum-save">Early bird: you save ' + money(q.plan.list - priceOf(q.plan)) + '</div>' : '') +
        '<ul class="bk-sum-list"><li>' + (q.plan.slots > 0 ? q.plan.slots + ' of ' + q.plan.total + ' slots left' : 'Fully booked') + '</li>' +
        '<li>Slot held ' + HOLD_HOURS + ' hours after you submit</li>' +
        (bk.tlds && parseTlds(bk.tlds).length ? '<li>TLD(s): ' + parseTlds(bk.tlds).map(esc).join(' · ') + '</li>' : '') + '</ul>';
    }
    h += '<p class="bk-sum-foot">First come, first served. Slots are confirmed in the order registrations arrive.</p>';
    box.innerHTML = h;
  }

  function renderForm() {
    var el = document.getElementById('mdf-form');
    if (!el) return;
    if (bk.done) el.innerHTML = renderDone();
    else el.innerHTML = renderSteps() + '<div class="bk-body">' + [renderPlanStep, renderDetailsStep, renderReviewStep][bk.step]() + '</div>';
    renderSummary();
  }
  function focusFirstError() {
    var first = root.querySelector('#mdf-form .has-err input, #mdf-form .has-err textarea, #mdf-form .bk-err');
    if (first && first.focus) first.focus();
  }

  // Hand-off point for part 3: replace with a POST to the backend, which holds the slot and triggers Sendify.
  function submitRegistration(payload) {
    if (typeof window.MDF_SUBMIT === 'function') return window.MDF_SUBMIT(payload);
    var ref = 'MDF27-' + payload.plan.toUpperCase().slice(0, 1) + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    return Promise.resolve({ ref: ref, holdUntil: new Date(Date.now() + HOLD_HOURS * 3600 * 1000).toISOString(), preview: true });
  }

  function bookPlan(key) {
    if (planOf(key)) { bk.plan = key; bk.step = 0; bk.errors = {}; saveDraft(); }
    setActive('sec-book');
    renderForm();
  }

  document.addEventListener('click', function (ev) {
    var go = ev.target.closest && ev.target.closest('#mdf-form [data-bk-go]');
    if (go) { bk.step = +go.getAttribute('data-bk-go'); bk.errors = {}; renderForm(); return; }
    var btn = ev.target.closest && ev.target.closest('#mdf-form [data-bk-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-bk-act');
    if (act === 'next') {
      if (validate(bk.step)) { bk.step = Math.min(2, bk.step + 1); renderForm(); }
      else { renderForm(); focusFirstError(); }
    } else if (act === 'back') {
      bk.errors = {}; bk.step = Math.max(0, bk.step - 1); renderForm();
    } else if (act === 'submit') {
      if (!validate(2)) { renderForm(); focusFirstError(); return; }
      btn.disabled = true; btn.textContent = 'Reserving…';
      var q = quote();
      var payload = {
        plan: bk.plan, billing: bk.billing, price: q.amount, earlyBird: q.early,
        registry: bk.registry.trim(), tlds: parseTlds(bk.tlds), contactName: bk.contactName.trim(), jobTitle: bk.jobTitle.trim(),
        email: bk.email.trim(), phone: bk.phone.trim(), participated2026: bk.participated === 'yes', notes: bk.notes.trim(),
        submittedAt: new Date().toISOString()
      };
      submitRegistration(payload).then(function (res) {
        bk.done = {
          ref: res.ref, plan: bk.plan, email: payload.email, preview: !!res.preview, tlds: payload.tlds, registry: payload.registry,
          holdUntil: new Date(res.holdUntil).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
        };
        clearDraft();
        renderForm();
      }, function () {
        btn.disabled = false; btn.textContent = 'Reserve my slot';
        bk.errors = { consent: 'We could not reserve your slot. Check your connection and try again, or email marcom@matbao.com.' };
        renderForm();
      });
    } else if (act === 'restart') {
      var keep = { registry: bk.registry, tlds: bk.tlds, contactName: bk.contactName, jobTitle: bk.jobTitle, email: bk.email, phone: bk.phone, participated: bk.participated };
      bk.done = null; bk.step = 0; bk.plan = ''; bk.consent = false; bk.notes = ''; bk.errors = {};
      Object.keys(keep).forEach(function (k) { bk[k] = keep[k]; });
      renderForm();
    }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target, k = el.getAttribute && el.getAttribute('data-bk');
    if (!k) return;
    bk[k] = el.value;
    if (bk.errors[k]) { delete bk.errors[k]; var f = el.closest('.bk-field'); if (f) { f.classList.remove('has-err'); var m = f.querySelector('.bk-err'); if (m) m.remove(); el.removeAttribute('aria-invalid'); } }
    if (k === 'tlds') {
      var hint = el.parentNode.querySelector('.bk-hint'), tl = parseTlds(bk.tlds);
      if (hint) hint.innerHTML = tl.length ? 'Will be listed as: <b>' + tl.map(esc).join(' · ') + '</b>' : 'Separate several TLDs with a comma.';
    }
    saveDraft();
    renderSummary();
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el.closest || !el.closest('#mdf-form')) return;
    if (el.name === 'bk-plan') { bk.plan = el.value; delete bk.errors.plan; }
    else if (el.name === 'bk-billing') bk.billing = el.value;
    else if (el.name === 'bk-part') { bk.participated = el.value; delete bk.errors.participated; }
    else if (el.id === 'bk-consent') { bk.consent = el.checked; delete bk.errors.consent; }
    else return;
    saveDraft();
    if (el.id !== 'bk-consent') renderForm(); else renderSummary();
  });
  // Enter in a text field moves to the next step instead of doing nothing.
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || !ev.target.matches || !ev.target.matches('#mdf-form input[type="text"], #mdf-form input[type="email"], #mdf-form input[type="tel"]')) return;
    ev.preventDefault();
    var next = root.querySelector('#mdf-form [data-bk-act="next"], #mdf-form [data-bk-act="submit"]');
    if (next) next.click();
  });
  loadDraft();

  /* ───────────── Benefit explanations (hover / tap) ───────────── */
  var tipOpenFor = null;
  function tipBox() { return document.getElementById('mdf-tip'); }
  function showTip(trigger) {
    var box = tipBox(), tip = window.MDF_TIPS && window.MDF_TIPS[trigger.getAttribute('data-tip')];
    if (!box || !tip) return;
    box.innerHTML = '<b>' + esc(tip.title) + '</b><p>' + esc(tip.body) + '</p>' + (tip.wf ? '<div class="wf">' + window.MDF_WF(tip.wf) + '</div>' : '') +
      (tip.wf === 'results' || tip.wf === 'vibe' || tip.wf === 'searchbar' || tip.wf === 'promo' || tip.wf === 'banner' ? '<div class="legend"><i class="d">D</i>Diamond<i class="g">G</i>Gold<i class="s">S</i>Silver</div>' : '');
    box.hidden = false;
    var r = trigger.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(12, r.left), vw - bw - 12);
    var top = r.bottom + 10;
    if (top + bh > vh - 12) top = Math.max(12, r.top - bh - 10);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    tipOpenFor = trigger;
  }
  function hideTip() { var box = tipBox(); if (box) box.hidden = true; tipOpenFor = null; }
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  document.addEventListener('mouseover', function (ev) {
    if (!canHover) return;
    var tr = ev.target.closest && ev.target.closest('[data-tip]');
    if (tr) showTip(tr); else if (tipOpenFor && !(ev.target.closest && ev.target.closest('#mdf-tip'))) hideTip();
  });
  // Touch: tap toggles. Mouse: hover shows, click keeps it open. Keyboard: Enter / Space toggles.
  document.addEventListener('click', function (ev) {
    var tr = ev.target.closest && ev.target.closest('[data-tip]');
    if (tr) { if (canHover) showTip(tr); else if (tipOpenFor === tr) hideTip(); else showTip(tr); return; }
    if (tipOpenFor && !(ev.target.closest && ev.target.closest('#mdf-tip'))) hideTip();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { hideTip(); return; }
    var tr = ev.target.closest && ev.target.closest('[data-tip]');
    if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); if (tipOpenFor === tr) hideTip(); else showTip(tr); }
  });
  document.addEventListener('scroll', hideTip, true);

  /* ───────────── Registrar Obligation viewer ───────────── */
  var obLastFocus = null, obText = '';
  function openObligation(plan, tlds, ref, registry) {
    var O = window.MDF_OBLIGATION, sections = O && O.plans[plan];
    var modal = document.getElementById('ob-modal'), doc = document.getElementById('ob-doc');
    if (!sections || !modal) return;
    var tldLabel = tlds || '[Your TLD]';
    var meta = [['Program', O.program], ['Registrar', O.registrar], ['Registry', registry || '[Registry name]'], ['TLD(s)', tldLabel],
      ['Plan', plan.toUpperCase()], ['Term', O.term]];
    if (ref) meta.push(['Reference', ref]);
    var html = '<h2 id="ob-title">' + esc(O.title) + '</h2><p class="ob-sub">For ' + esc(tldLabel) + ' · ' + esc(plan.toUpperCase()) + ' plan</p>' +
      '<dl class="ob-meta">' + meta.map(function (m) { return '<div><dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd></div>'; }).join('') + '</dl>';
    var text = O.title + '\n' + 'For ' + tldLabel + ' – ' + plan.toUpperCase() + ' plan\n\n' + meta.map(function (m) { return m[0] + ': ' + m[1]; }).join('\n') + '\n';
    sections.forEach(function (s) {
      html += '<h3>' + esc(s.h) + '</h3><ul>' + s.items.map(function (i) { return '<li>' + esc(i.replace(/\{tld\}/g, tldLabel)) + '</li>'; }).join('') + '</ul>';
      text += '\n' + s.h + '\n' + s.items.map(function (i) { return '  • ' + i.replace(/\{tld\}/g, tldLabel); }).join('\n') + '\n';
    });
    html += '<p class="ob-foot">This document lists Mat Bao’s obligations under the MDF Program 2027 and is intended to be attached to the agreement between the Registry and Mat Bao. Placements are shown on matbao.net unless stated otherwise.</p>';
    doc.innerHTML = html;
    obText = text;
    obLastFocus = document.activeElement;
    hideTip();
    modal.hidden = false;
    document.body.classList.add('ob-open');
    modal.querySelector('.ob-dialog').focus();
  }
  function closeObligation() {
    var modal = document.getElementById('ob-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('ob-open');
    if (obLastFocus && obLastFocus.focus) obLastFocus.focus();
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ob]');
    if (t) { openObligation(t.getAttribute('data-ob'), t.getAttribute('data-ob-tlds'), t.getAttribute('data-ob-ref'), t.getAttribute('data-ob-reg')); return; }
    if (ev.target.closest && ev.target.closest('[data-ob-close]')) { closeObligation(); return; }
    var cp = ev.target.closest && ev.target.closest('[data-ob-copy]');
    if (cp) {
      var done = function () { cp.textContent = 'Copied'; window.setTimeout(function () { cp.textContent = 'Copy text'; }, 1600); };
      var fallback = function () {
        var r = document.createRange(); r.selectNodeContents(document.getElementById('ob-doc'));
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        cp.textContent = 'Text selected: press Ctrl+C';
      };
      try { navigator.clipboard.writeText(obText).then(done, fallback); } catch (e) { fallback(); }
      return;
    }
    if (ev.target.closest && ev.target.closest('[data-ob-print]')) { window.print(); }
  });
  document.addEventListener('keydown', function (ev) {
    var modal = document.getElementById('ob-modal');
    if (!modal || modal.hidden) return;
    if (ev.key === 'Escape') { closeObligation(); return; }
    if (ev.key === 'Tab') {
      var f = modal.querySelectorAll('button'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /* ───────────── Start ───────────── */
  if (isAuthed()) mountDeck(); else mountGate();
})();
