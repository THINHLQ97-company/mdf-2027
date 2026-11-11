/* Hover / tap explanations for each benefit row in the comparison table.
   Each tip: title, body text, and an optional schematic of where the placement appears on matbao.net.
   Schematics are drawn as small inline SVGs (240 x 150) by window.MDF_WF(kind). */
(function () {
  'use strict';

  var C = { frame: '#0b1440', line: 'rgba(255,255,255,.18)', soft: 'rgba(255,255,255,.08)', hi: '#22D3EE', hiFill: 'rgba(34,211,238,.22)', violet: '#8B5CF6', txt: '#ffffff', mute: 'rgba(255,255,255,.55)' };
  var F = 'font-family="Poppins,Arial,sans-serif"';

  function frame(inner) {
    return '<svg viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" role="img">' +
      '<rect x="1" y="1" width="238" height="148" rx="10" fill="' + C.frame + '" stroke="' + C.line + '"/>' +
      '<circle cx="12" cy="11" r="2.5" fill="' + C.line + '"/><circle cx="21" cy="11" r="2.5" fill="' + C.line + '"/><circle cx="30" cy="11" r="2.5" fill="' + C.line + '"/>' +
      '<line x1="1" y1="20" x2="239" y2="20" stroke="' + C.soft + '"/>' + inner + '</svg>';
  }
  function bar(x, y, w, h, fill) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + (fill || C.soft) + '"/>'; }
  function hi(x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="' + C.hiFill + '" stroke="' + C.hi + '" stroke-width="1.5"/>'; }
  function t(x, y, s, size, fill, anchor, weight) {
    return '<text x="' + x + '" y="' + y + '" ' + F + ' font-size="' + (size || 8) + '" fill="' + (fill || C.txt) + '"' +
      (anchor ? ' text-anchor="' + anchor + '"' : '') + (weight ? ' font-weight="' + weight + '"' : '') + '>' + s + '</text>';
  }
  function tier(x, y, label) {
    var col = label === 'D' ? C.hi : (label === 'G' ? '#FFE770' : '#d6d6d6');
    return '<circle cx="' + x + '" cy="' + y + '" r="6" fill="' + col + '"/>' + t(x, y + 2.8, label, 7, '#06102e', 'middle', 700);
  }
  function searchBox(y) {
    return '<rect x="14" y="' + y + '" width="160" height="16" rx="4" fill="#fff" fill-opacity=".9"/>' + t(20, y + 11, 'mybrand', 8, '#06102e') +
      '<rect x="178" y="' + y + '" width="22" height="16" rx="4" fill="#7ac943"/><rect x="204" y="' + y + '" width="22" height="16" rx="4" fill="#ff7a1a"/>';
  }

  var WF = {
    // Search results list, ranking positions by tier
    results: function () {
      var rows = '';
      var labels = ['mybrand.com', '.yourtld', '.net', '.yourtld', '.vn', '.org', '.yourtld'];
      var tiers = [null, 'D', null, 'G', null, null, 'S'];
      for (var i = 0; i < 7; i++) {
        var y = 50 + i * 13;
        if (tiers[i]) rows += hi(14, y - 2, 212, 11);
        else rows += bar(14, y - 2, 212, 11, C.soft);
        rows += t(20, y + 6, labels[i], 7, tiers[i] ? C.txt : C.mute);
        if (tiers[i]) rows += tier(214, y + 3.5, tiers[i]);
      }
      return frame(searchBox(26) + rows);
    },
    searchbar: function () {
      function chip(x, w, label, tl) { return hi(x, 50, w, 13) + t(x + w / 2 - (tl ? 4 : 0), 59, label, 7, C.txt, 'middle', 600) + (tl ? tier(x + w - 6, 56.5, tl) : ''); }
      return frame(searchBox(28) +
        chip(14, 64, '.yourtld', 'D') + bar(82, 50, 40, 13) + bar(126, 50, 40, 13) + bar(170, 50, 40, 13) +
        t(14, 82, 'TLDs shown under the search bar, in slides', 7, C.mute) +
        '<circle cx="104" cy="96" r="3" fill="' + C.hi + '"/><circle cx="114" cy="96" r="3" fill="#FFE770"/><circle cx="124" cy="96" r="3" fill="#d6d6d6"/>' +
        t(104, 110, '1', 6.5, C.mute, 'middle') + t(114, 110, '2', 6.5, C.mute, 'middle') + t(124, 110, '3', 6.5, C.mute, 'middle') +
        t(14, 132, 'Slide 1: Diamond · Slide 2: Gold · Slide 3: Silver', 7, C.mute));
    },
    ai: function () {
      return frame(searchBox(28) +
        t(14, 60, '✦ AI name ideas', 8, C.hi, null, 600) +
        hi(14, 66, 64, 16) + t(46, 77, 'getmybrand.yourtld', 5.6, C.txt, 'middle') +
        hi(84, 66, 64, 16) + t(116, 77, 'mybrandhq.yourtld', 5.6, C.txt, 'middle') +
        bar(154, 66, 64, 16) + bar(14, 88, 64, 16) + bar(84, 88, 64, 16) + bar(154, 88, 64, 16) +
        t(14, 126, 'AI suggests names built on your TLD', 7, C.mute));
    },
    vibe: function () {
      var rows = [['myapp.yourtld', 'D', 'Top pick · pre-selected'], ['myapp.com', null, ''], ['myapp.yourtld', 'G', ''], ['myapp.yourtld', 'G', '']];
      var h = t(14, 36, '$ vibe deploy  ✓ app is live', 8, C.hi) + t(14, 52, 'Add a custom domain', 8, C.txt, null, 600);
      rows.forEach(function (r, i) {
        var y = 60 + i * 20;
        h += r[1] ? hi(14, y, 212, 16) : bar(14, y, 212, 16);
        h += '<circle cx="24" cy="' + (y + 8) + '" r="3.5" fill="none" stroke="' + C.txt + '"/>' + (i === 0 ? '<circle cx="24" cy="' + (y + 8) + '" r="1.8" fill="' + C.hi + '"/>' : '');
        h += t(34, y + 11, r[0], 7.5, r[1] ? C.txt : C.mute, null, i === 0 ? 600 : null);
        if (r[2]) h += t(130, y + 11, r[2], 6.5, C.hi);
        if (r[1]) h += tier(214, y + 8, r[1]);
      });
      return frame(h);
    },
    banner: function () {
      var h = bar(14, 28, 60, 8) + bar(150, 28, 76, 8);
      h += hi(14, 42, 212, 62) + t(120, 70, '.yourtld', 14, C.txt, 'middle', 700) + t(120, 86, 'Homepage banner slider', 7, C.txt, 'middle');
      var dots = '';
      for (var i = 0; i < 9; i++) {
        var x = 80 + i * 10, col = i < 5 ? C.hi : (i < 7 ? '#FFE770' : '#d6d6d6');
        dots += '<circle cx="' + x + '" cy="114" r="3" fill="' + col + '"' + (i === 0 ? '' : ' fill-opacity=".75"') + '/>';
      }
      h += dots + t(120, 128, 'slot 1 → 9 in the rotation', 6.5, C.mute, 'middle');
      h += bar(14, 134, 100, 10) + bar(126, 134, 100, 10);
      return frame(h);
    },
    promo: function () {
      var h = t(14, 36, 'Domain promotions', 8, C.txt, null, 600);
      h += hi(14, 44, 68, 44) + t(48, 70, '.yourtld', 9, C.txt, 'middle', 700) + tier(74, 50, 'D');
      h += hi(86, 44, 68, 44) + t(120, 70, '.yourtld', 9, C.txt, 'middle', 700) + tier(146, 50, 'G');
      h += bar(158, 44, 68, 44) + bar(14, 94, 68, 44) + bar(86, 94, 68, 44) + bar(158, 94, 68, 44);
      return frame(h);
    },
    // Your TLD always comes first, the bundled extension after it.
    combo: function () {
      var h = searchBox(26) + t(14, 56, 'Search: mybrand', 8, C.txt, null, 600) + '<line x1="14" y1="64" x2="226" y2="64" stroke="' + C.line + '"/>';
      h += hi(14, 70, 112, 64) + t(20, 81, 'Suggested for you', 6.5, C.txt) + t(120, 81, '65 left', 6, C.hi, 'end');
      h += '<rect x="20" y="88" width="40" height="11" rx="5.5" fill="' + C.hi + '"/>' + t(40, 95.8, '.yourtld', 5.6, '#06102e', 'middle', 700);
      h += t(63, 96, '+', 7, C.txt) + '<rect x="69" y="88" width="22" height="11" rx="5.5" fill="none" stroke="#7ac943"/>' + t(80, 95.8, '.com', 5.5, C.txt, 'middle');
      h += t(94, 96, '+ …', 7, C.txt) + t(20, 107, 'Your TLD + .com / .net / .vn', 5.6, C.mute);
      h += t(20, 119, 'Combo, first year', 6.5, C.mute) + t(20, 130, 'Combo price', 8.5, '#ff6b6b', null, 700) + tier(116, 127, 'G');
      h += bar(132, 70, 94, 64);
      return frame(h);
    },
    cartpopup: function () {
      function cb(y, name, sub, tierL, mine) {
        return '<rect x="48" y="' + y + '" width="144" height="16" rx="4" fill="' + (mine ? C.hiFill : 'rgba(255,255,255,.06)') + '" stroke="' + (mine ? C.hi : C.line) + '"/>' +
          '<rect x="53" y="' + (y + 4.5) + '" width="7" height="7" rx="1.5" fill="none" stroke="' + C.txt + '"/>' +
          t(65, y + 8.2, 'Claim ' + name, 6.6, C.txt, null, mine ? 700 : null) + t(65, y + 13.6, sub, 4.8, mine ? C.hi : C.mute) + tier(182, y + 8, tierL);
      }
      return frame(searchBox(26) + bar(14, 50, 212, 22) + bar(14, 78, 104, 50) + bar(122, 78, 104, 50) +
        '<rect x="1" y="21" width="238" height="128" fill="#000" fill-opacity=".5"/>' +
        '<rect x="38" y="28" width="164" height="108" rx="6" fill="' + C.frame + '" stroke="' + C.hi + '" stroke-width="1.5"/>' +
        t(120, 41, 'Free for the first year!', 8.5, C.txt, 'middle', 700) +
        t(120, 52, 'with your new mybrand.com', 6, C.mute, 'middle') +
        cb(58, 'mybrand.yourtld', 'Your TLD · shown first or second', 'D', true) + cb(77, 'mybrand.other', 'Other Diamond TLD', 'D', false) +
        '<rect x="48" y="100" width="40" height="14" rx="4" fill="rgba(255,255,255,.25)"/>' + t(68, 109.5, 'Skip', 6.5, C.txt, 'middle') +
        '<rect x="94" y="100" width="98" height="14" rx="4" fill="#7ac943"/>' + t(143, 109.5, 'Claim & go to cart', 6.5, '#06102e', 'middle', 700) +
        t(120, 128, 'Renews from year 2 at the standard price', 5.5, C.mute, 'middle') +
        t(120, 143, 'Your TLD + .com / .net / .vn / .com.vn / .net.vn', 6.4, C.mute, 'middle'));
    }
  };

  window.MDF_WF = function (kind) { return WF[kind] ? WF[kind]() : ''; };

  /* One source for the comparison table AND the benefit pop-ups.
     Each row: key, title, isNew, plans {silver, gold, diamond: [value, detail]}, what, where, notes[], wf (schematic).
     Values 'yes' / 'no' render as tick / cross. Keep in sync with js/mdf-obligation.js. */
  var NO = ['no', 'Not included'];
  window.MDF_BENEFITS = [
    { group: 'Visibility on matbao.net', icon: 1, rows: [
      { key: 'homepageBanner', title: 'Homepage Banner', wf: 'banner',
        plans: { silver: ['Slot 5–9', 'In the homepage slider all term'], gold: ['Slot 3–7', 'In the homepage slider all term'], diamond: ['Slot 1–5', 'Leading slots of the slider'] },
        what: 'A banner for your TLD in the rotating slider at the top of the matbao.net homepage.',
        where: 'matbao.net homepage, top slider, on desktop and mobile.',
        notes: ['The slot is your position in the rotation: lower numbers are shown earlier and more often.', 'Your banner stays in the slider for the whole 12-month term.', 'Banner sizes are shared after signing so your team can supply artwork.'] },
      { key: 'searchBar', title: 'TLD under the Search Bar', wf: 'searchbar',
        plans: { silver: ['Slide 3', 'Shown at all times'], gold: ['Slide 2', 'Shown at all times'], diamond: ['Slide 1', 'First slide, shown at all times'] },
        what: 'Your TLD is listed in the row of extensions directly under the main domain search bar.',
        where: 'matbao.net homepage and domain pages, under the search bar.',
        notes: ['The extension row rotates in slides. Slide 1 is shown first when the page loads.'] },
      { key: 'resultsPopularity', title: 'Search Results (Popular)', wf: 'results',
        plans: { silver: ['Page 2–3', 'Popular category'], gold: ['Page 1–2', 'Popular category'], diamond: ['Page 1', 'Popular category'] },
        what: 'After a customer searches a name, matbao.net lists other available extensions. This is your rank in the Popular category.',
        where: 'Domain search results page, Popular category.',
        notes: ['Ranking applies to the default view customers see after searching.'] },
      { key: 'resultsNational', title: 'Search Results (International gTLDs)', wf: 'results',
        plans: { silver: ['Page 2–3', 'International (gTLDs) category'], gold: ['Page 1', 'International (gTLDs) category'], diamond: ['Page 1', 'International (gTLDs) category'] },
        what: 'Your rank in the International (gTLDs) category of the search results.',
        where: 'Domain search results page, International (gTLDs) category.',
        notes: [] },
      { key: 'promoPage', title: 'Promo-page Banner', wf: 'promo',
        plans: { silver: ['Banner 8th–12th', 'Standard banner'], gold: ['Banner 5th–8th', 'Standard banner'], diamond: ['Banner 1st–4th', 'Leading positions'] },
        what: 'A standard banner for your TLD on the matbao.net domain promotions page.',
        where: 'matbao.net promotions page.',
        notes: ['Position order is fixed for the term and follows your plan tier.'] },
      { key: 'promoPrice', title: 'Promo-page Price Highlight', isNew: true, wf: 'promo',
        plans: { silver: NO, gold: NO, diamond: ['yes', '1 slot featuring your discounted price'] },
        what: 'A dedicated slot on the promotions page that shows your TLD with its current discounted price.',
        where: 'matbao.net promotions page, price highlight area.',
        notes: ['The price shown is your registry promotional price for the period.'] }
    ] },
    { group: 'Smart Search & Vibe Hosting', icon: 2, rows: [
      { key: 'aiSearch', title: 'AI Search Suggestion', wf: 'ai',
        plans: { silver: ['Standard', 'Included in AI name ideas'], gold: ['Priority', 'Suggested ahead of standard TLDs'], diamond: ['Top', 'First in AI name ideas'] },
        what: 'Mat Bao’s AI generates domain name ideas from what the customer types. Your TLD is used in those ideas.',
        where: 'matbao.net domain search, AI suggestions block.',
        notes: ['Suggestions are only shown when the matching domain is available.'] },
      { key: 'vibe', title: 'Vibe Hosting Domain Suggestion', isNew: true, wf: 'vibe',
        plans: { silver: NO, gold: ['Listed', 'Rotates through 2 of the 4 suggestions'], diamond: ['Top pick', 'Pre-selected, first of 4 suggestions'] },
        what: 'Vibe Hosting lets users build and deploy apps with AI. Right after an app goes live, the user is asked to add a custom domain.',
        where: 'Vibe Hosting, “Add a custom domain” step after deployment.',
        notes: ['There are 4 suggestions: Diamond first (pre-selected), .COM second, Gold partners rotate through the last 2.', 'Limited to the partners in Gold and Diamond.'] }
    ] },
    { group: 'Bundle (max. 5 partners)', icon: 3, rows: [
      { key: 'bundlePlacement', title: 'Bundle Placement', isNew: true, wf: 'combo',
        plans: { silver: NO, gold: ['Combo card', 'Your TLD + .COM / .NET / .VN in search results'], diamond: ['Cart pop-up', 'Your TLD offered when the customer goes to the cart'] },
        what: 'Your TLD is offered together with the popular domain the customer is buying.',
        where: 'Gold: “Suggested for you” combo cards on the search results page, your TLD first, then .COM / .NET / .VN. Diamond: pop-up after “Go to cart”, offering your TLD for the name in the cart.',
        notes: ['Diamond: each offered domain has its own tick box and is added to the cart only when ticked.'] },
      { key: 'bundleTrigger', title: 'Triggering Domains', isNew: true, wf: 'cartpopup',
        plans: { silver: NO, gold: ['Your TLD + .COM · .NET · .VN', 'Your TLD shown first in the combo'], diamond: ['Your TLD + 5 extensions', '.com · .net · .vn · .com.vn · .net.vn'] },
        what: 'The new domain registrations that trigger your bundle offer.',
        where: 'Search results (Gold) and cart (Diamond).',
        notes: ['The offered name exactly matches the name the customer is registering (e.g. mybrand.com → mybrand.yourtld).'] },
      { key: 'bundleExposure', title: 'Bundle Exposure', isNew: true, wf: 'cartpopup',
        plans: { silver: NO, gold: ['~2 of 3 searches', '2 combo cards rotate among 3 Gold'], diamond: ['100% of checkouts', 'Shared with max. 1 other Diamond'] },
        what: 'How often your bundle offer is shown.',
        where: 'Search results (Gold) and cart (Diamond).',
        notes: ['matbao.net has 2 combo cards and 1 cart pop-up, so bundles are capped at 5 partners.', 'Diamond: the order of the two TLDs alternates between customers so neither always comes first.'] },
      { key: 'bundleOffer', title: 'Customer Offer', isNew: true, wf: 'cartpopup',
        plans: { silver: NO, gold: ['Combo price', 'Discounted first year'], diamond: ['Free first year', 'For the matching domain'] },
        what: 'What the customer sees and gets.',
        where: 'Combo card (Gold) and cart pop-up (Diamond).',
        notes: ['Renewal from year 2 is at the standard price.', 'The number of offers is agreed with you before launch.'] },
      { key: 'bundleFunding', title: 'Offer Funding', wf: 'cartpopup',
        plans: { silver: NO, gold: ['Registry promo price', 'You fund only redeemed domains'], diamond: ['Registry promo price', 'You fund only redeemed domains'] },
        what: 'The combo discount and the free first year are funded by your registry promotional pricing.',
        where: 'Agreed in the contract.',
        notes: ['Mat Bao provides the placement and the checkout flow.', 'You only fund domains that customers actually register through the offer.'] }
    ] },
    { group: 'Boosted Ads (Facebook & Google)', icon: 4, rows: [
      { key: 'adPlatforms', title: 'Ad Platforms', isNew: true,
        plans: { silver: ['Facebook · Google', 'Paid, boosted ads'], gold: ['Facebook · Google', 'Paid, boosted ads'], diamond: ['Facebook · Google', 'Paid, boosted ads'] },
        what: 'All MDF 2027 advertising is paid, boosted ads on Facebook and Google.',
        where: 'Facebook and Google ad networks, targeting Vietnam.',
        notes: ['No organic social posts are included in MDF 2027.'] },
      { key: 'campaignGoal', title: 'Campaign Goal',
        plans: { silver: ['Reach', 'Reach & impressions'], gold: ['Traffic', 'Traffic & engagement'], diamond: ['Traffic', 'Traffic & engagement'] },
        what: 'The objective your boosted ads are optimised for.',
        where: 'Facebook and Google campaign settings.',
        notes: [] },
      { key: 'alwaysOnAds', title: 'Always-on Boosted Ads',
        plans: { silver: ['Shared', 'One carousel with other partners'], gold: ['Separate', 'Your own campaign'], diamond: ['Separate', 'Your own campaign'] },
        what: 'Ads that run throughout the term to keep your TLD visible.',
        where: 'Facebook and Google.',
        notes: [] },
      { key: 'highlightBoost', title: 'Highlight Boost Campaigns',
        plans: { silver: NO, gold: ['3 campaigns', 'During the term'], diamond: ['6 campaigns', 'During the term'] },
        what: 'Short, higher-budget bursts around your key moments, such as a launch or a price promotion.',
        where: 'Facebook and Google.',
        notes: ['Timing is planned with you at the start of each quarter.'] },
      { key: 'reporting', title: 'Campaign Reporting',
        plans: { silver: ['General report', 'Shared partner report'], gold: ['Quarterly', 'Dedicated quarterly report'], diamond: ['Quarterly', 'Dedicated quarterly report'] },
        what: 'How you receive campaign results.',
        where: 'Sent by email to your contact.',
        notes: [] }
    ] },
    { group: 'Registration Guarantee', icon: 5, rows: [
      { key: 'guaranteeMin', title: 'Guaranteed Minimum New Registrations', isNew: true,
        plans: { silver: NO, gold: NO, diamond: ['yes', 'Floor agreed before signing'] },
        what: 'A committed minimum number of new registrations of your TLD at Mat Bao over the 12-month term.',
        where: 'Set in the contract, based on your 2026 performance at Mat Bao and 2027 retail price.',
        notes: ['All new registrations count: search, AI suggestions, Vibe Hosting, bundles and boosted ads.', 'Renewals and transfers do not count.'] },
      { key: 'guaranteeCredit', title: 'Shortfall Credit toward MDF 2028', isNew: true,
        plans: { silver: NO, gold: NO, diamond: ['Up to 50%', 'Of the package fee'] },
        what: 'If the floor is not reached, the shortfall becomes credit toward your MDF 2028 package.',
        where: 'Settled at the end of the term.',
        notes: ['Credit = Package fee × (Guaranteed − Actual) ÷ Guaranteed, capped at 50% of the package fee.', 'Credit is not cash and cannot be transferred.'] },
      { key: 'guaranteeTerms', title: 'Guarantee Eligibility', isNew: true,
        plans: { silver: NO, gold: NO, diamond: ['Annual plan', 'Not for half-year billing'] },
        what: 'Conditions for the Registration Guarantee.',
        where: 'Contract terms.',
        notes: ['Your TLD stays available for registration through the term.', 'No wholesale price increase during the term.', 'Brand assets are delivered on time.'] }
    ] },
    { group: 'Event Merchandise Package', icon: 6, rows: [
      { key: 'merchItems', title: 'Co-brand Items',
        plans: { silver: NO, gold: ['150 items', 'Mat Bao × your TLD'], diamond: ['300 items', 'Mat Bao × your TLD'] },
        what: 'Merchandise produced with Mat Bao and your TLD branding.',
        where: 'Handed out at industry events Mat Bao attends.',
        notes: ['Item types are agreed with you; artwork follows both brand guidelines.'] },
      { key: 'merchOwn', title: 'Registry’s Own Merchandise Distribution',
        plans: { silver: ['Up to 3 events', 'Your items, our booth'], gold: ['Up to 6 events', 'Your items, our booth'], diamond: ['Up to 10 events', 'Your items, our booth'] },
        what: 'We bring and hand out your own merchandise at the events we attend.',
        where: 'About 10 major industry events per year.',
        notes: ['Shipping of your items to Mat Bao is arranged by the registry.'] }
    ] }
  ];

  // Flat lookup used by the hover preview.
  window.MDF_TIPS = {};
  window.MDF_BENEFITS.forEach(function (g) { g.rows.forEach(function (r) { r.group = g.group; window.MDF_TIPS[r.key] = { title: r.title, body: r.what, wf: r.wf }; }); });
})();
