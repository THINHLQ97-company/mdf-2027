/* MDF Program 2027 — standalone behaviour (no framework, no build step).
   Ported from the Next.js page: slide deck (wheel / touch / menu), mobile menu, early-bird countdown,
   Packages <-> Add-ons toggle, 3-step "Book your plan" form and the password gate. */
(function () {
  'use strict';

  var D = window.MDF_DATA;
  var PASSWORD = '@mdf2027';
  var STORAGE_KEY = 'mdf2027-authed';
  // Early bird deadline (GMT+7). Prices drop back to list price automatically after this moment.
  var EARLY_BIRD_DEADLINE = new Date('2026-11-30T23:59:59+07:00');
  function isEarlyBird() { return Date.now() < EARLY_BIRD_DEADLINE.getTime(); }
  var SLIDES = ['hero', 'sec-intro', 'sec-benefits', 'sec-guarantee', 'sec-packages', 'sec-comparison', 'sec-about', 'sec-book'];
  // Pages with their own scroll: wheel scrolls the page first, only switches slide at the top/bottom edge.
  var INTERNAL_SCROLL = ['sec-benefits', 'sec-guarantee', 'sec-packages', 'sec-comparison', 'sec-about', 'sec-book'];

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
    root.setAttribute('data-slide', key);
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

  function modalOpen() { var m = document.getElementById('ob-modal'), b = document.getElementById('bd-modal'); return (m && !m.hidden) || (b && !b.hidden); }

  function onWheel(e) {
    if (modalOpen()) return;
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
    if (modalOpen()) return;
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
    var title = wrap && wrap.querySelector('strong');
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    // Before opening: count down to opening. During early bird: count down to its end. Otherwise hidden.
    function target() {
      var t0 = Date.parse(PROGRAM.startAt);
      if (Date.now() < t0) return { t: t0, label: 'Registration opens in' };
      if (isEarlyBird() && Date.now() <= Date.parse(PROGRAM.endAt)) return { t: EARLY_BIRD_DEADLINE.getTime(), label: 'Early bird offer ends in' };
      return null;
    }
    function tick() {
      var tg = target();
      if (wrap) wrap.style.display = tg ? '' : 'none';
      if (!tg) return;
      if (title && title.textContent !== tg.label) title.textContent = tg.label;
      var total = Math.floor(Math.max(0, tg.t - Date.now()) / 1000);
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
    renderComparison();
    renderForm();
    startCountdown();
    renderTimelines();
    window.setInterval(renderTimelines, 60000);
    window.setInterval(tickCountdowns, 1000);
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
    { key: 'silver', list: 900, half: 500, slots: 4, total: 4, features: ['searchSilver', 'aiStandard', 'sharedBoost', 'quarterlyRefresh'] },
    { key: 'gold', list: 4200, half: 2310, slots: 3, total: 3, popular: true, features: ['searchGold', 'suggestGold', 'vibeGold', 'comboCard', 'boostGold', 'merchGold'], isNew: ['vibeGold', 'comboCard'] },
    { key: 'diamond', list: 6500, half: 3575, slots: 2, total: 2, features: ['searchDiamond', 'suggestDiamond', 'vibeDiamond', 'cartPopup', 'guarantee', 'boostDiamond', 'merchDiamond'], isNew: ['vibeDiamond', 'cartPopup', 'guarantee'] }
  ];
  var EARLY_DISCOUNT = 0.05;
  var PROGRAM = { state: 'open', startAt: '2026-11-21T00:00:00+07:00', endAt: '2026-12-21T23:59:59+07:00', live: false };
  var PROGRAM_RUNS = new Date('2027-01-01T00:00:00+07:00');

  /* ───────────── Timeline: opens → early bird ends → closes → programme runs ───────────── */
  function dayLabel(d) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }); }
  function daysUntil(t) { return Math.max(0, Math.ceil((t - Date.now()) / 864e5)); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function timelineHtml(compact) {
    var t0 = Date.parse(PROGRAM.startAt), tEb = EARLY_BIRD_DEADLINE.getTime(), tEnd = Date.parse(PROGRAM.endAt), t1 = PROGRAM_RUNS.getTime(), now = Date.now();
    var hasEb = tEb > t0 && EARLY_DISCOUNT > 0;
    var pct = Math.round(EARLY_DISCOUNT * 100);
    // Milestones are evenly spaced so labels never collide; time between two milestones fills that gap linearly.
    var stops = hasEb ? [t0, tEb, tEnd, t1] : [t0, tEnd, t1];
    var pos = function (t) {
      if (t <= stops[0]) return 0;
      for (var k = 1; k < stops.length; k++) if (t <= stops[k]) return ((k - 1) + (t - stops[k - 1]) / (stops[k] - stops[k - 1])) / (stops.length - 1) * 100;
      return 100;
    };
    var status, cls = '';
    if (now < t0) status = 'Registration opens in <b>' + plural(daysUntil(t0), 'day') + '</b>' + (hasEb ? ' · early bird −' + pct + '% for the first ' + plural(Math.round((tEb - t0) / 864e5), 'day') : '');
    else if (now <= tEb && hasEb && now <= tEnd) { status = 'Early bird −' + pct + '% ends in <b>' + plural(daysUntil(tEb), 'day') + '</b> · ' + dayLabel(tEb); cls = ' eb'; }
    else if (now <= tEnd) status = 'Registration open · closes in <b>' + plural(daysUntil(tEnd), 'day') + '</b>';
    else if (now < t1) status = 'Registration closed · programme starts ' + dayLabel(t1) + ' 2027';
    else status = 'MDF Program 2027 is running';
    var ms = [
      { t: t0, d: dayLabel(t0), l: 'Registration opens', s: 'Opens' },
      hasEb ? { t: tEb, d: dayLabel(tEb), l: 'Early bird ends', s: '−' + pct + '% ends', eb: 1 } : null,
      { t: tEnd, d: dayLabel(tEnd), l: 'Registration closes', s: 'Closes' },
      { t: t1, d: 'Jan 2027', l: 'Programme starts', s: 'Starts' }
    ].filter(Boolean);
    var fill = now <= t0 ? 0 : pos(now);
    return '<div class="mdf-tl' + (compact ? ' compact' : '') + cls + '" role="group" aria-label="MDF 2027 timeline">' +
      '<p class="tl-status">' + status + '</p>' +
      '<div class="tl-track">' +
        (hasEb ? '<div class="tl-eb" style="left:0;width:' + pos(tEb) + '%"><span>Early bird −' + pct + '% · ' + dayLabel(t0) + '–' + dayLabel(tEb) + '</span></div>' : '') +
        '<div class="tl-fill" style="width:' + fill + '%"></div>' +
        (now > t0 && now < t1 ? '<i class="tl-now" style="left:' + fill + '%" title="Today"></i>' : '') +
        ms.map(function (m, i) {
          var done = now >= m.t;
          return '<div class="tl-m' + (m.eb ? ' is-eb' : '') + (done ? ' done' : '') + (i === 0 ? ' first' : '') + (i === ms.length - 1 ? ' last' : '') + '" style="left:' + pos(m.t) + '%"><i></i><b>' + m.d + '</b><span class="l">' + m.l + '</span><span class="s">' + m.s + '</span></div>';
        }).join('') +
      '</div></div>';
  }
  // Days / hours / minutes / seconds boxes, refreshed every second for every [data-countdown] on the page.
  function countdownHtml(iso) {
    var s = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000));
    var v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    return ['Days', 'Hours', 'Minutes', 'Seconds'].map(function (l, i) { return '<span><b>' + (v[i] < 10 ? '0' : '') + v[i] + '</b><i>' + l + '</i></span>'; }).join('');
  }
  function tickCountdowns() {
    root.querySelectorAll('[data-countdown]').forEach(function (el) {
      el.innerHTML = countdownHtml(el.getAttribute('data-countdown'));
      // Opening time reached: reload state from the server so the form unlocks by itself.
      if (Date.parse(el.getAttribute('data-countdown')) <= Date.now() && !el._done) { el._done = true; if (window.MDF_REFRESH) window.MDF_REFRESH(); else { PROGRAM.state = 'open'; renderForm(); } }
    });
  }
  function renderTimelines() {
    root.querySelectorAll('[data-tl]').forEach(function (el) { el.innerHTML = timelineHtml(el.getAttribute('data-tl') === 'compact'); });
  }
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
        '<div class="note">' + (p.slots > 0
          ? esc(p.key === 'diamond' ? t.exclusive : t.limited) + ' <b>' + p.slots + '</b> ' + esc(p.slots === 1 ? t.slotAvailable : t.slotsAvailable)
          : '<b>Fully booked</b> · waitlist open') +
          (p.onHold ? '<span class="hold-note">' + p.onHold + ' on hold, awaiting confirmation</span>' : '') + '</div></div>';
    }).join('') + '</div>';
    box.insertAdjacentHTML('beforeend', h);
    box.querySelectorAll('[data-book]').forEach(function (b) {
      b.addEventListener('click', function () { bookPlan(b.getAttribute('data-book')); });
    });
  }

  /* ───────────── Book your plan: TLDs & plans → Details → Review & reserve ─────────────
     A registry can book several TLDs; each TLD takes its own package (and its own slot).
     State lives in `bk`. A draft is kept in localStorage so a half-filled form survives a reload. */
  var HOLD_HOURS = 48;
  var MAX_LINES = 5;
  var DRAFT_KEY = 'mdf2027-booking-draft-v2';
  var formStartedAt = Date.now();
  var BK_STEPS = ['plan', 'details', 'review'];
  var bk = {
    step: 0, done: null, errors: {},
    lines: [{ tld: '', plan: '', billing: 'annual' }],
    registry: '', contactName: '', jobTitle: '', email: '', phone: '', participated: '', notes: '', consent: false
  };
  var BK_FIELDS = ['registry', 'contactName', 'jobTitle', 'email', 'phone', 'participated', 'notes'];

  function loadDraft() {
    try {
      var d = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return;
      BK_FIELDS.forEach(function (k) { if (typeof d[k] === 'string') bk[k] = d[k]; });
      if (Array.isArray(d.lines) && d.lines.length) bk.lines = d.lines.slice(0, MAX_LINES).map(function (l) { return { tld: String(l.tld || ''), plan: String(l.plan || ''), billing: (l.billing || d.billing) === 'half' ? 'half' : 'annual' }; });
    } catch (e) { /* storage blocked: start empty */ }
  }
  function saveDraft() {
    try {
      var d = { lines: bk.lines }; BK_FIELDS.forEach(function (k) { d[k] = bk[k]; });
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* ignore */ }
  }
  function clearDraft() { try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  function fmtDate(d) { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT+7)'; }
  function slotText(p) {
    var s = p.slots > 0 ? p.slots + ' ' + (p.slots === 1 ? 'slot' : 'slots') + ' left' : 'Fully booked · join the waitlist';
    return s + (p.onHold ? ' · ' + p.onHold + ' on hold' : '');
  }
  function planOf(key) { return PACKAGES.filter(function (p) { return p.key === key; })[0]; }
  function normTld(x) { x = String(x || '').trim().toLowerCase(); return x ? (x.charAt(0) === '.' ? x : '.' + x) : ''; }
  function validTld(x) { return /^\.[\p{L}\p{N}-]{2,63}$/u.test(x); }
  function lineTlds() { return bk.lines.map(function (l) { return normTld(l.tld); }).filter(Boolean); }
  function priceLine(p, billing) { return billing === 'half' ? p.half : priceOf(p); }
  function unitOf(billing) { return billing === 'half' ? '/half-year' : '/year'; }
  // Priced lines, in order, flagging those that would go to the waitlist because the cart takes more slots than are free.
  function cart() {
    var used = {}, out = [], total = 0;
    bk.lines.forEach(function (l, i) {
      var p = planOf(l.plan); if (!p) return;
      used[p.key] = (used[p.key] || 0) + 1;
      var billing = l.billing === 'half' ? 'half' : 'annual', amount = priceLine(p, billing); total += amount;
      out.push({ i: i, tld: normTld(l.tld), plan: p, billing: billing, unit: unitOf(billing), amount: amount, early: billing === 'annual' && isEarlyBird(), waitlist: used[p.key] > Math.max(0, p.slots) });
    });
    var units = out.map(function (x) { return x.unit; }).filter(function (u, i, a) { return a.indexOf(u) === i; });
    // Mixed cycles: the total is the first payment, so no single unit applies.
    return { lines: out, total: total, unit: units.length === 1 ? units[0] : '', mixed: units.length > 1, early: out.some(function (x) { return x.early; }) };
  }

  function validate(step) {
    var e = {};
    if (step === 0) {
      var seen = {};
      bk.lines.forEach(function (l, i) {
        var t = normTld(l.tld);
        if (!t) e['tld' + i] = 'Enter the TLD, for example .cloud';
        else if (!validTld(t)) e['tld' + i] = 'Check the TLD format, for example .cloud';
        else if (seen[t]) e['tld' + i] = 'This TLD is already in your list.';
        seen[t] = 1;
        if (!planOf(l.plan)) e['plan' + i] = 'Choose a package for this TLD.';
      });
    } else if (step === 1) {
      if (!bk.registry.trim()) e.registry = 'Enter your registry or company name.';
      if (!bk.contactName.trim()) e.contactName = 'Enter the name of the person we should contact.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(bk.email.trim())) e.email = 'Enter a valid work email, for example name@registry.com';
      if (!bk.participated) e.participated = 'Let us know if you joined in 2026.';
    } else if (step === 2) {
      if (!bk.consent) e.consent = 'Please confirm to reserve your slots.';
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
      var label = { plan: 'TLDs & plans', details: 'Your details', review: 'Review & reserve' }[k];
      return '<li class="' + cls + '">' + (i < bk.step ? '<button type="button" data-bk-go="' + i + '"><i>✓</i>' + label + '</button>' : '<span><i>' + (i + 1) + '</i>' + label + '</span>') + '</li>';
    }).join('') + '</ol>';
  }

  function renderPlanStep() {
    if (PROGRAM.state !== 'open') {
      return '<div class="bk-closed"><strong>' + (PROGRAM.state === 'upcoming' ? 'Registration opens soon' : 'Registration is closed') + '</strong><p>' +
        (PROGRAM.state === 'upcoming' ? 'Bookings for MDF 2027 open on <b>' + esc(fmtDate(PROGRAM.startAt)) + '</b>.' : 'MDF 2027 bookings closed on <b>' + esc(fmtDate(PROGRAM.endAt)) + '</b>.') +
        (PROGRAM.state === 'upcoming' ? '</p><div class="bk-cd" data-countdown="' + esc(PROGRAM.startAt) + '" role="timer" aria-label="Time until registration opens">' + countdownHtml(PROGRAM.startAt) + '</div><p>' : '') +
        ' Questions? Email marcom@matbao.com.</p></div>';
    }
    var c = cart(), wl = {};
    c.lines.forEach(function (x) { if (x.waitlist) wl[x.i] = 1; });
    var h = '<p class="bk-intro">Add each TLD you want to promote and choose a package for it. Every TLD takes its own slot, so you can mix packages, for example <b>.asia on Diamond</b> and <b>.cloud on Gold</b>.</p>' +
      '<div class="bk-lines">' + bk.lines.map(function (l, i) {
        return '<div class="bk-line' + (bk.errors['tld' + i] || bk.errors['plan' + i] ? ' has-err' : '') + '">' +
          '<div class="bk-line-head"><span class="bk-line-no">TLD ' + (i + 1) + '</span>' +
          (bk.lines.length > 1 ? '<button type="button" class="bk-line-x" data-li-remove="' + i + '" aria-label="Remove TLD ' + (i + 1) + '">Remove</button>' : '') + '</div>' +
          '<div class="bk-line-body"><div class="bk-field bk-tld"><label for="bk-tld-' + i + '">Your TLD <span class="req">*</span></label>' +
          '<input id="bk-tld-' + i + '" data-li-tld="' + i + '" type="text" placeholder="e.g. .asia" value="' + esc(l.tld) + '" autocomplete="off">' + err('tld' + i) + '</div>' +
          '<div class="bk-field bk-pick"><span class="bk-lbl" id="pl-lbl-' + i + '">Package <span class="req">*</span></span><div class="bk-chips" role="radiogroup" aria-labelledby="pl-lbl-' + i + '">' +
          PACKAGES.map(function (p) {
            var on = l.plan === p.key;
            return '<label class="bk-chip ' + p.key + (on ? ' sel' : '') + (p.slots <= 0 ? ' full' : '') + '"><input type="radio" name="bk-li-' + i + '" value="' + p.key + '"' + (on ? ' checked' : '') + '>' +
              '<span class="nm">' + p.key.toUpperCase() + '</span><span class="pr">' + money(priceLine(p, l.billing)) + '</span><span class="sl">' + (p.slots > 0 ? p.slots + ' left' : 'Waitlist') + '</span></label>';
          }).join('') + '</div>' + err('plan' + i) +
          '<div class="bk-line-bill"><span class="bk-lbl" id="bl-lbl-' + i + '">Billing</span><div class="bk-seg sm" role="radiogroup" aria-labelledby="bl-lbl-' + i + '">' +
          '<label class="' + (l.billing !== 'half' ? 'sel' : '') + '"><input type="radio" name="bk-bill-' + i + '" value="annual"' + (l.billing !== 'half' ? ' checked' : '') + '>Annual</label>' +
          '<label class="' + (l.billing === 'half' ? 'sel' : '') + '"><input type="radio" name="bk-bill-' + i + '" value="half"' + (l.billing === 'half' ? ' checked' : '') + '>Half-year</label></div>' +
          (l.plan === 'diamond' && l.billing === 'half' ? '<span class="bk-warn">Registration Guarantee applies to annual Diamond only.</span>' : (l.billing !== 'half' && isEarlyBird() ? '<span class="bk-hint">Early bird price</span>' : '')) + '</div>' +
          (wl[i] ? '<p class="bk-warn">No free ' + esc(l.plan.toUpperCase()) + ' slot for this TLD: it will join the waitlist.</p>' : '') + '</div></div></div>';
      }).join('') + '</div>' +
      (bk.lines.length < MAX_LINES ? '<button type="button" class="bk-add" data-li-add>+ Add another TLD</button>' : '<p class="bk-hint">Up to ' + MAX_LINES + ' TLDs per registration. Email marcom@matbao.com for more.</p>');
    h += '<div class="bk-actions"><button type="button" class="bk-btn primary" data-bk-act="next">Continue</button></div>';
    return h;
  }

  function renderDetailsStep() {
    var h = '<div class="bk-grid">' +
      field('registry', 'Registry / company', 'text', 'e.g. DotAsia Organisation', true) +
      field('contactName', 'Contact person', 'text', 'Full name', true) +
      field('jobTitle', 'Job title', 'text', 'e.g. Channel Manager', false) +
      field('email', 'Work email', 'email', 'name@registry.com', true, 'Your confirmation and contract are sent here.') +
      field('phone', 'WhatsApp / phone', 'tel', '+65 …', false) +
      '</div>' +
      '<div class="bk-field' + (bk.errors.participated ? ' has-err' : '') + '"><span class="bk-lbl" id="part-lbl">Did you join the Mat Bao MDF Program in 2026? <span class="req">*</span></span><div class="bk-seg" role="radiogroup" aria-labelledby="part-lbl">' +
      '<label class="' + (bk.participated === 'yes' ? 'sel' : '') + '"><input type="radio" name="bk-part" value="yes"' + (bk.participated === 'yes' ? ' checked' : '') + '>Yes</label>' +
      '<label class="' + (bk.participated === 'no' ? 'sel' : '') + '"><input type="radio" name="bk-part" value="no"' + (bk.participated === 'no' ? ' checked' : '') + '>No</label></div>' + err('participated') + '</div>' +
      field('notes', 'Anything we should know?', 'textarea', 'Launch plans, promo pricing, preferred start month…', false) +
      '<div class="bk-hp" aria-hidden="true"><label for="bk-website">Website</label><input id="bk-website" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<div class="bk-actions"><button type="button" class="bk-btn ghost" data-bk-act="back">Back</button><button type="button" class="bk-btn primary" data-bk-act="next">Review</button></div>';
    return h;
  }

  function row(label, value, goStep) {
    return '<div class="bk-row"><dt>' + esc(label) + '</dt><dd>' + value + '</dd>' + (goStep != null ? '<button type="button" class="bk-edit" data-bk-go="' + goStep + '">Edit</button>' : '') + '</div>';
  }
  function renderReviewStep() {
    var c = cart();
    var lines = c.lines.map(function (x) {
      return '<span class="bk-rl"><b>' + esc(x.tld) + '</b> · ' + esc(x.plan.key.toUpperCase()) + ' · ' + money(x.amount) + esc(x.unit) + (x.waitlist ? ' <span class="pill wl">Waitlist</span>' : '') + '</span>';
    }).join('');
    var h = '<dl class="bk-review">' +
      row(c.lines.length > 1 ? 'TLDs & packages' : 'TLD & package', lines + (c.early ? '<span class="pill">Early bird</span>' : ''), 0) +
      (c.lines.length > 1 ? row(c.mixed ? 'First payment' : 'Total', '<b>' + money(c.total) + esc(c.unit) + '</b>', 0) : '') +
      row('Registry', esc(bk.registry), 1) +
      row('Contact', esc(bk.contactName) + (bk.jobTitle ? ', ' + esc(bk.jobTitle) : '') + '<br>' + esc(bk.email) + (bk.phone ? ' · ' + esc(bk.phone) : ''), 1) +
      row('Joined in 2026', bk.participated === 'yes' ? 'Yes' : 'No', 1) +
      (bk.notes.trim() ? row('Notes', esc(bk.notes), 1) : '') + '</dl>' +
      '<label class="bk-consent' + (bk.errors.consent ? ' has-err' : '') + '" for="bk-consent"><input type="checkbox" id="bk-consent"' + (bk.consent ? ' checked' : '') + '>' +
      '<span>I understand my slots are only held after I confirm my email address, and that Mat Bao will confirm each package within ' + HOLD_HOURS + ' hours.</span></label>' + err('consent') +
      '<div class="bk-actions"><button type="button" class="bk-btn ghost" data-bk-act="back">Back</button><button type="button" class="bk-btn primary" data-bk-act="submit">' + (c.lines.length > 1 ? 'Reserve my ' + c.lines.length + ' slots' : 'Reserve my slot') + '</button></div>';
    return h;
  }

  function renderDone() {
    var d = bk.done;
    var refs = '<ul class="bk-refs">' + d.items.map(function (x) { return '<li><b>' + esc(x.tld) + '</b> · ' + esc(x.plan.toUpperCase()) + ' · <span>' + esc(x.ref) + '</span></li>'; }).join('') + '</ul>';
    if (!d.preview) {
      return '<div class="bk-done"><div class="bk-tick mail" aria-hidden="true">✉</div><strong>Check your inbox</strong>' +
        '<p>We sent one confirmation link to <b>' + esc(d.email) + '</b> for ' + (d.items.length > 1 ? 'all ' + d.items.length + ' TLDs' : 'your TLD') + '.</p>' + refs +
        '<ol class="bk-next"><li><b>Now</b> Open the email and click “Confirm and hold my slot”' + (d.verifyBy ? ' before ' + esc(d.verifyBy) : '') + '</li>' +
        '<li><b>After you confirm</b> ' + (d.anyWaitlist ? 'Slots that are free are held; the others join the waitlist' : 'Your slots are on hold and shown as reserved to other registries') + '</li>' +
        '<li><b>Within ' + HOLD_HOURS + ' hours</b> Mat Bao confirms each package and sends its Registrar Obligation</li>' +
        '<li><b>Then</b> Contract, invoice and kick-off</li></ol>' +
        '<p class="bk-small">No email? Check your spam folder, or email marcom@matbao.com.</p>' +
        '<button type="button" class="bk-btn ghost" data-bk-act="restart">Book more TLDs</button></div>';
    }
    return '<div class="bk-done"><div class="bk-tick" aria-hidden="true">✓</div><strong>Your slots are reserved</strong>' + refs +
      '<p class="bk-preview">Preview mode: this registration was not sent anywhere yet.</p>' +
      '<button type="button" class="bk-btn ghost" data-bk-act="restart">Book more TLDs</button></div>';
  }

  function renderSummary() {
    var box = document.getElementById('mdf-summary');
    if (!box) return;
    var c = cart();
    var bar = document.getElementById('mdf-sumbar');
    if (bar) {
      bar.hidden = !c.lines.length || !!bk.done;
      if (c.lines.length) bar.innerHTML = '<span class="pl">' + (c.lines.length === 1 ? '<span class="' + c.lines[0].plan.key + '">' + c.lines[0].plan.key.toUpperCase() + '</span>' : c.lines.length + ' TLDs') + '</span><b>' + money(c.total) + '<small>' + (c.mixed ? ' total' : c.unit) + '</small></b><span class="sl">' + c.lines.map(function (x) { return esc(x.tld || '?'); }).join(' · ') + '</span>';
    }
    var h = '<strong>Your reservation</strong>';
    if (!c.lines.length) {
      h += '<p class="bk-sum-empty">Add a TLD and choose a package to see your price and available slots.</p>';
    } else {
      h += '<ul class="bk-sum-lines">' + c.lines.map(function (x) {
        return '<li><span class="t">' + esc(x.tld || 'TLD ' + (x.i + 1)) + '</span><span class="bk-sum-plan ' + x.plan.key + '">' + x.plan.key.toUpperCase() + '</span><span class="a">' + money(x.amount) + '<small>' + (x.billing === 'half' ? '/6 mo' : '/yr') + '</small></span>' +
          (x.waitlist ? '<em>Waitlist</em>' : '') + '</li>';
      }).join('') + '</ul>' +
        '<div class="bk-sum-price">' + money(c.total) + '<small>' + (c.mixed ? ' first payment' : c.unit) + '</small></div>' +
        (c.early ? '<div class="bk-sum-save">Early bird: you save ' + money(c.lines.reduce(function (n, x) { return n + (x.early ? x.plan.list - priceOf(x.plan) : 0); }, 0)) + '</div>' : '') +
        '<ul class="bk-sum-list">' + PACKAGES.filter(function (p) { return c.lines.some(function (x) { return x.plan.key === p.key; }); }).map(function (p) { return '<li>' + p.key.toUpperCase() + ': ' + slotText(p) + ' (of ' + p.total + ')</li>'; }).join('') +
        '<li>Slots held once you confirm your email · Mat Bao confirms within ' + HOLD_HOURS + ' hours</li></ul>';
    }
    h += '<p class="bk-sum-foot">First come, first served. Slots are confirmed in the order registrations arrive.</p>';
    box.innerHTML = h;
  }

  function renderForm() {
    var el = document.getElementById('mdf-form');
    if (!el) return;
    if (bk.done) el.innerHTML = renderDone();
    else el.innerHTML = '<div data-tl="compact">' + timelineHtml(true) + '</div>' + renderSteps() + '<div class="bk-body">' + [renderPlanStep, renderDetailsStep, renderReviewStep][bk.step]() + '</div>';
    renderSummary();
  }
  function focusFirstError() {
    var first = root.querySelector('#mdf-form .has-err input, #mdf-form .has-err textarea, #mdf-form .bk-err');
    if (first && first.focus) first.focus();
  }

  function submitRegistration(payload) {
    if (typeof window.MDF_SUBMIT === 'function') return window.MDF_SUBMIT(payload);
    return Promise.resolve({
      preview: true, holdUntil: new Date(Date.now() + HOLD_HOURS * 3600 * 1000).toISOString(),
      items: payload.items.map(function (x) { return { tld: x.tld, plan: x.plan, ref: 'MDF27-' + x.plan.charAt(0).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase() }; })
    });
  }

  // "Book this plan" on a package card: fill the first line without a package, or add a new line.
  function bookPlan(key) {
    if (planOf(key)) {
      var free = bk.lines.filter(function (l) { return !l.plan; })[0];
      if (free) free.plan = key;
      else if (bk.lines.length < MAX_LINES) bk.lines.push({ tld: '', plan: key, billing: 'annual' });
      bk.step = 0; bk.errors = {}; bk.done = null; saveDraft();
    }
    setActive('sec-book');
    renderForm();
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t.closest || !t.closest('#mdf-form')) return;
    var go = t.closest('[data-bk-go]');
    if (go) { bk.step = +go.getAttribute('data-bk-go'); bk.errors = {}; renderForm(); return; }
    if (t.closest('[data-li-add]')) {
      if (bk.lines.length < MAX_LINES) bk.lines.push({ tld: '', plan: '', billing: 'annual' });
      saveDraft(); renderForm();
      var inp = document.getElementById('bk-tld-' + (bk.lines.length - 1)); if (inp) inp.focus();
      return;
    }
    var rm = t.closest('[data-li-remove]');
    if (rm) { bk.lines.splice(+rm.getAttribute('data-li-remove'), 1); bk.errors = {}; saveDraft(); renderForm(); return; }
    var btn = t.closest('[data-bk-act]');
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
      var c = cart();
      var payload = {
        items: c.lines.map(function (x) { return { tld: x.tld, plan: x.plan.key, billing: x.billing }; }),
        registry: bk.registry.trim(), contactName: bk.contactName.trim(), jobTitle: bk.jobTitle.trim(),
        email: bk.email.trim(), phone: bk.phone.trim(), participated2026: bk.participated === 'yes', notes: bk.notes.trim(),
        submittedAt: new Date().toISOString(), consent: true,
        website: (document.getElementById('bk-website') || {}).value || '', elapsedMs: Date.now() - formStartedAt
      };
      submitRegistration(payload).then(function (res) {
        bk.done = {
          email: payload.email, preview: !!res.preview, registry: payload.registry,
          items: res.items || [], anyWaitlist: c.lines.some(function (x) { return x.waitlist; }),
          verifyBy: res.verifyExpiresAt ? fmtDate(res.verifyExpiresAt) : ''
        };
        clearDraft();
        renderForm();
      }, function (er) {
        btn.disabled = false; btn.textContent = 'Reserve my slot';
        var f = (er && er.fields) || {};
        bk.errors = Object.assign({}, f, { consent: (er && er.message) || 'We could not reserve your slots. Check your connection and try again, or email marcom@matbao.com.' });
        if (f.registry || f.contactName || f.email) bk.step = 1;
        if (Object.keys(f).some(function (k) { return /^(tld|plan)\d/.test(k); })) bk.step = 0;
        renderForm();
      });
    } else if (act === 'restart') {
      bk.done = null; bk.step = 0; bk.lines = [{ tld: '', plan: '', billing: 'annual' }]; bk.consent = false; bk.notes = ''; bk.errors = {};
      renderForm();
    }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    var li = el.getAttribute && el.getAttribute('data-li-tld');
    if (li != null) {
      bk.lines[+li].tld = el.value;
      if (bk.errors['tld' + li]) { delete bk.errors['tld' + li]; var fe = el.parentNode.querySelector('.bk-err'); if (fe) fe.remove(); }
      saveDraft(); renderSummary(); return;
    }
    var k = el.getAttribute && el.getAttribute('data-bk');
    if (!k) return;
    bk[k] = el.value;
    if (bk.errors[k]) { delete bk.errors[k]; var f = el.closest('.bk-field'); if (f) { f.classList.remove('has-err'); var m = f.querySelector('.bk-err'); if (m) m.remove(); el.removeAttribute('aria-invalid'); } }
    saveDraft();
    renderSummary();
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el.closest || !el.closest('#mdf-form')) return;
    var m = /^bk-li-(\d+)$/.exec(el.name || '');
    if (m) { bk.lines[+m[1]].plan = el.value; delete bk.errors['plan' + m[1]]; }
    else if ((m = /^bk-bill-(\d+)$/.exec(el.name || ''))) bk.lines[+m[1]].billing = el.value === 'half' ? 'half' : 'annual';
    else if (el.name === 'bk-part') { bk.participated = el.value; delete bk.errors.participated; }
    else if (el.id === 'bk-consent') { bk.consent = el.checked; delete bk.errors.consent; }
    else if (el.getAttribute('data-li-tld') != null) { el.value = normTld(el.value); bk.lines[+el.getAttribute('data-li-tld')].tld = el.value; saveDraft(); renderSummary(); return; }
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

  /* ───────────── Comparison: plan switcher (phones) ───────────── */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-cmp]');
    if (!b) return;
    var n = b.getAttribute('data-cmp'), tbl = root.querySelector('.border-table table');
    if (tbl) tbl.className = 'cmp-show-' + n;
    root.querySelectorAll('[data-cmp]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
  });

  /* ───────────── Comparison table (built from window.MDF_BENEFITS) ───────────── */
  var TIER = ['silver', 'gold', 'diamond'];
  function cellHtml(v) {
    if (v[0] === 'no') return '<span class="matbao-cancel-red" aria-label="Not included"></span>';
    var main = v[0] === 'yes' ? '<span class="matbao-check-ok" aria-label="Included"></span>' : '<b class="cv">' + esc(v[0]) + '</b>';
    return main + (v[1] ? '<small class="cd">' + esc(v[1]) + '</small>' : '');
  }
  function renderComparison() {
    var body = document.getElementById('cmp-body');
    if (!body || !window.MDF_BENEFITS) return;
    var h = '';
    window.MDF_BENEFITS.forEach(function (g) {
      h += '<tr><td colspan="4"><i class="icon-' + g.icon + '" aria-hidden="true"></i>' + esc(g.group) + '</td></tr>';
      g.rows.forEach(function (r) {
        h += '<tr><td class="row-title"><span class="tip-trigger" data-tip="' + r.key + '" tabindex="0" role="button" aria-haspopup="dialog" aria-label="' + esc(r.title) + ': open details">' + esc(r.title) + '</span>' +
          (r.isNew ? ' <em class="tag-new">NEW</em>' : '') + '</td>' + TIER.map(function (k) { return '<td>' + cellHtml(r.plans[k]) + '</td>'; }).join('') + '</tr>';
      });
    });
    h += '<tr><td colspan="4"><i class="icon-1" aria-hidden="true"></i>Price &amp; availability</td></tr>' +
      '<tr class="row-price"><td class="row-title">Annual price</td>' + PACKAGES.map(function (p) { return '<td>' + money(priceOf(p)) + (isEarlyBird() ? '<small class="cd">Early bird · list ' + money(p.list) + '</small>' : '') + '</td>'; }).join('') + '</tr>' +
      '<tr><td class="row-title">Half-year price</td>' + PACKAGES.map(function (p) { return '<td><b class="cv">' + money(p.half) + '</b><small class="cd">No Registration Guarantee</small></td>'; }).join('') + '</tr>' +
      '<tr class="row-slots"><td class="row-title">Partner slots</td>' + PACKAGES.map(function (p) { return '<td><b class="cv">' + p.total + '</b><small class="cd">' + esc(slotText(p)) + '</small></td>'; }).join('') + '</tr>';
    body.innerHTML = h;
  }

  /* ───────────── Benefit explanations: hover preview + click for full details ───────────── */
  var tipOpenFor = null;
  function tipBox() { return document.getElementById('mdf-tip'); }
  // Wireframes say ".yourtld"; once the registry has typed its TLDs in the booking form, show those instead.
  function yourTlds() { return lineTlds().filter(validTld); }
  function wfFor(kind) {
    var svg = window.MDF_WF(kind), t = yourTlds()[0];
    return t ? svg.replace(/\.yourtld/g, esc(t.length > 12 ? t.slice(0, 12) : t)) : svg;
  }
  function yourTldNote() {
    var t = yourTlds();
    return t.length ? '<p class="tip-yours">Shown with your TLD' + (t.length > 1 ? 's' : '') + ': <b>' + t.map(esc).join(' · ') + '</b></p>' : '';
  }
  function legendFor(wf) { return /^(results|vibe|searchbar|promo|banner)$/.test(wf || '') ? '<div class="legend"><i class="d">D</i>Diamond<i class="g">G</i>Gold<i class="s">S</i>Silver</div>' : ''; }
  function showTip(trigger) {
    var box = tipBox(), tip = window.MDF_TIPS && window.MDF_TIPS[trigger.getAttribute('data-tip')];
    if (!box || !tip) return;
    box.innerHTML = '<b>' + esc(tip.title) + '</b><p>' + esc(tip.body) + '</p>' + (tip.wf ? '<div class="wf">' + wfFor(tip.wf) + '</div>' : '') +
      legendFor(tip.wf) + (tip.wf ? yourTldNote() : '') + '<p class="tip-more">Click for full details →</p>';
    box.hidden = false;
    var r = trigger.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    box.style.left = Math.min(Math.max(12, r.left), vw - bw - 12) + 'px';
    var top = r.bottom + 10;
    if (top + bh > vh - 12) top = Math.max(12, r.top - bh - 10);
    box.style.top = top + 'px';
    tipOpenFor = trigger;
  }
  function hideTip() { var box = tipBox(); if (box) box.hidden = true; tipOpenFor = null; }

  var bdList = [], bdIndex = 0, bdLastFocus = null;
  function flatBenefits() { var out = []; (window.MDF_BENEFITS || []).forEach(function (g) { g.rows.forEach(function (r) { out.push(r); }); }); return out; }
  function renderBenefit() {
    var r = bdList[bdIndex], el = document.getElementById('bd-body');
    var labels = { silver: 'Silver', gold: 'Gold', diamond: 'Diamond' };
    el.innerHTML = '<div class="bd-group">' + esc(r.group) + '</div>' +
      '<h3 id="bd-title">' + esc(r.title) + (r.isNew ? ' <em class="tag-new">NEW</em>' : '') + '</h3>' +
      '<div class="bd-grid">' +
        (r.wf ? '<div class="bd-fig">' + wfFor(r.wf) + legendFor(r.wf) + yourTldNote() + '</div>' : '') +
        '<div class="bd-text"><div class="bd-sec"><span>What it is</span><p>' + esc(r.what) + '</p></div>' +
        '<div class="bd-sec"><span>Where it appears</span><p>' + esc(r.where) + '</p></div></div>' +
      '</div>' +
      '<div class="bd-plans">' + TIER.map(function (k) {
        var v = r.plans[k], off = v[0] === 'no';
        return '<div class="bd-plan ' + k + (off ? ' off' : '') + '"><span class="nm">' + labels[k] + '</span>' +
          '<b>' + (off ? 'Not included' : v[0] === 'yes' ? 'Included' : esc(v[0])) + '</b>' + (off ? '' : '<small>' + esc(v[1] || '') + '</small>') + '</div>';
      }).join('') + '</div>' +
      (r.notes && r.notes.length ? '<div class="bd-notes"><span>Notes</span><ul>' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '');
    document.getElementById('bd-count').textContent = (bdIndex + 1) + ' / ' + bdList.length;
    el.scrollTop = 0;
  }
  function openBenefit(key) {
    bdList = flatBenefits();
    bdIndex = Math.max(0, bdList.map(function (r) { return r.key; }).indexOf(key));
    if (!bdList.length) return;
    hideTip();
    bdLastFocus = document.activeElement;
    renderBenefit();
    var m = document.getElementById('bd-modal'); m.hidden = false; document.body.classList.add('ob-open');
    m.querySelector('.bd-dialog').focus();
  }
  function closeBenefit() {
    var m = document.getElementById('bd-modal'); if (!m || m.hidden) return;
    m.hidden = true; document.body.classList.remove('ob-open');
    if (bdLastFocus && bdLastFocus.focus) bdLastFocus.focus();
  }
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  document.addEventListener('mouseover', function (ev) {
    if (!canHover || modalOpen()) return;
    var tr = ev.target.closest && ev.target.closest('[data-tip]');
    if (tr) showTip(tr); else if (tipOpenFor && !(ev.target.closest && ev.target.closest('#mdf-tip'))) hideTip();
  });
  // Click / tap / Enter opens the full details pop-up.
  document.addEventListener('click', function (ev) {
    var tr = ev.target.closest && ev.target.closest('[data-tip]');
    if (tr) { openBenefit(tr.getAttribute('data-tip')); return; }
    if (ev.target.closest && ev.target.closest('#mdf-tip') && tipOpenFor) { openBenefit(tipOpenFor.getAttribute('data-tip')); return; }
    if (ev.target.closest && ev.target.closest('[data-bd-close]')) { closeBenefit(); return; }
    var st = ev.target.closest && ev.target.closest('[data-bd-step]');
    if (st) { bdIndex = (bdIndex + Number(st.getAttribute('data-bd-step')) + bdList.length) % bdList.length; renderBenefit(); return; }
    if (tipOpenFor) hideTip();
  });
  document.addEventListener('keydown', function (ev) {
    var m = document.getElementById('bd-modal');
    if (m && !m.hidden) {
      if (ev.key === 'Escape') { closeBenefit(); return; }
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { bdIndex = (bdIndex + (ev.key === 'ArrowRight' ? 1 : -1) + bdList.length) % bdList.length; renderBenefit(); return; }
      if (ev.key === 'Tab') {
        var f = m.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
      return;
    }
    if (ev.key === 'Escape') { hideTip(); return; }
    var tr = ev.target.closest && ev.target.closest('[data-tip]');
    if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openBenefit(tr.getAttribute('data-tip')); }
  });
  document.addEventListener('focusin', function (ev) { if (modalOpen()) return; var tr = ev.target.closest && ev.target.closest('[data-tip]'); if (tr && canHover) showTip(tr); });
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

  /* ───────────── Live data from the server (js/mdf-api.js calls this) ───────────── */
  window.MDF_APP = {
    applyStatus: function (st) {
      if (!st || !st.plans) return;
      PROGRAM.live = true; PROGRAM.state = st.state; PROGRAM.startAt = st.program.startAt; PROGRAM.endAt = st.program.endAt;
      EARLY_BIRD_DEADLINE = new Date(st.program.earlyBirdUntil);
      EARLY_DISCOUNT = (st.program.earlyBirdPct || 0) / 100;
      if (st.holdHours) HOLD_HOURS = st.holdHours;
      PACKAGES.forEach(function (p) {
        var s = st.plans[p.key]; if (!s) return;
        p.list = s.list; p.half = s.half; p.total = s.total; p.slots = s.available; p.onHold = s.onHold;
      });
      if (document.getElementById('pkg-container')) { renderPackages(); renderComparison(); renderForm(); }
      renderTimelines();
    }
  };

  /* ───────────── Start ───────────── */
  if (isAuthed()) mountDeck(); else mountGate();
})();
