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
      return frame(searchBox(28) +
        '<rect x="14" y="46" width="160" height="62" rx="4" fill="#fff" fill-opacity=".08" stroke="' + C.line + '"/>' +
        hi(18, 50, 152, 13) + t(24, 59, 'mybrand.yourtld', 7.5, C.txt, null, 600) + tier(162, 56.5, 'D') +
        hi(18, 66, 152, 13) + t(24, 75, 'mybrand.yourtld', 7.5, C.txt) + tier(162, 72.5, 'G') +
        bar(18, 84, 152, 9) + bar(18, 96, 120, 9) +
        t(14, 126, 'Suggestions drop down while the customer types', 7, C.mute));
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
    combo: function () {
      var h = searchBox(26) + t(14, 56, 'mybrand.com  289.000 đ', 8, C.txt, null, 600) + '<line x1="14" y1="64" x2="226" y2="64" stroke="' + C.line + '"/>';
      h += hi(14, 70, 104, 64) + t(20, 81, 'Suggested for you', 6.5, C.txt) + t(112, 81, '65 left', 6, C.hi, 'end');
      h += '<rect x="20" y="88" width="20" height="10" rx="5" fill="none" stroke="#7ac943"/>' + t(30, 95.5, '.com', 5.5, C.txt, 'middle');
      h += t(44, 95.5, '+', 7, C.txt) + '<rect x="50" y="88" width="34" height="10" rx="5" fill="' + C.hi + '"/>' + t(67, 95.5, '.yourtld', 5.5, '#06102e', 'middle', 700);
      h += t(88, 95.5, '+ …', 7, C.txt) + t(20, 112, 'Combo, first year', 6.5, C.mute) + t(20, 126, '349.000 đ', 9, '#ff6b6b', null, 700) + tier(108, 126, 'G');
      h += bar(122, 70, 104, 64);
      return frame(h);
    },
    cartpopup: function () {
      function cb(y, name, tierL) {
        return '<rect x="52" y="' + y + '" width="136" height="14" rx="4" fill="' + C.hiFill + '" stroke="' + C.hi + '"/>' +
          '<rect x="57" y="' + (y + 3.5) + '" width="7" height="7" rx="1.5" fill="none" stroke="' + C.txt + '"/>' +
          t(70, y + 9.8, 'Claim ' + name, 6.8, C.txt) + tier(178, y + 7, tierL);
      }
      return frame(searchBox(26) + bar(14, 50, 212, 22) + bar(14, 78, 104, 50) + bar(122, 78, 104, 50) +
        '<rect x="1" y="21" width="238" height="128" fill="#000" fill-opacity=".5"/>' +
        '<rect x="40" y="30" width="160" height="104" rx="6" fill="' + C.frame + '" stroke="' + C.hi + '" stroke-width="1.5"/>' +
        t(120, 44, 'Free for the first year!', 8.5, C.txt, 'middle', 700) +
        t(120, 56, 'mybrand.cloud & mybrand.asia for 0 đ', 6.5, C.hi, 'middle') +
        cb(62, 'mybrand.asia', 'D') + cb(80, 'mybrand.cloud', 'D') +
        '<rect x="52" y="102" width="40" height="14" rx="4" fill="rgba(255,255,255,.25)"/>' + t(72, 111.5, 'Skip', 6.5, C.txt, 'middle') +
        '<rect x="98" y="102" width="90" height="14" rx="4" fill="#7ac943"/>' + t(143, 111.5, 'Claim & go to cart', 6.5, '#06102e', 'middle', 700) +
        t(120, 128, 'Renews from year 2 at the standard price', 5.5, C.mute, 'middle') +
        t(120, 143, 'Each ticked domain is added to the cart', 7, C.mute, 'middle'));
    }
  };

  window.MDF_WF = function (kind) { return WF[kind] ? WF[kind]() : ''; };

  window.MDF_TIPS = {
    resultsPopularity: {
      title: 'Search Results (Popularity view)',
      body: 'After a customer searches a name, matbao.net lists other extensions below the main result. This is where your TLD ranks in that list in the default popularity view.',
      wf: 'results'
    },
    resultsNational: {
      title: 'Search Results (National view)',
      body: 'Your TLD’s rank when the customer switches the extension list to the national view. Diamond ranks first, Gold on page 1, Silver on pages 2–3.',
      wf: 'results'
    },
    homepageBanner: {
      title: 'Homepage Banner',
      body: 'Your TLD banner in the rotating slider at the top of the matbao.net homepage. The slot is your place in the rotation: lower slots are shown sooner and more often. Diamond takes slots 1–5, Gold 3–7, Silver 5–9.',
      wf: 'banner'
    },
    promoPage: {
      title: 'Promo-page Presence',
      body: 'Your TLD featured on the domain promotions page. Diamond takes the leading spots, Gold the next priority spots.',
      wf: 'promo'
    },
    searchBar: {
      title: 'Search Bar Suggestion',
      body: 'As the customer types a name, a drop-down suggests complete domains before they press search. Your TLD appears in that list (Diamond first, then Gold).',
      wf: 'searchbar'
    },
    aiSearch: {
      title: 'AI Search Suggestion',
      body: 'Mat Bao’s AI generates domain name ideas from what the customer types. Your TLD is used in those ideas: Standard (Silver), Priority (Gold) or Top (Diamond).',
      wf: 'ai'
    },
    vibe: {
      title: 'Vibe Hosting Domain Suggestion',
      body: 'Vibe Hosting lets users build and deploy apps with AI. Right after an app goes live, we ask them to add a custom domain. There are 4 suggestions: Diamond is the top pick and is pre-selected, .COM stays second, and the 3 Gold partners rotate through the last 2 spots.',
      wf: 'vibe'
    },
    bundlePlacement: {
      title: 'Bundle Placement',
      body: 'Gold: your TLD sits inside a combo card (“Suggested for you”) on the search results page, sold together with .COM / .NET / .VN at a first-year combo price. Diamond: when the customer clicks “Go to cart”, a pop-up offers the searched name with your TLD free for the first year. Both Diamond TLDs appear together, each with its own tick box, and every ticked domain is added to the cart.',
      wf: 'combo'
    },
    bundleExposure: {
      title: 'Bundle Exposure',
      body: 'matbao.net has 2 combo cards and 1 cart pop-up, so bundles are capped at 5 partners. The 3 Gold partners rotate through the 2 combo cards, so each Gold appears in about 2 of every 3 searches that show combos. Both Diamond partners appear together in the cart pop-up at every checkout, with the order switching between customers so neither always comes first.',
      wf: 'cartpopup'
    },
    bundleOffer: {
      title: 'Customer Offer',
      body: 'What the customer sees. Gold: a discounted first-year combo price. Diamond: your TLD at 0 đ for the first year when checking out. The offer is funded by your registry promo pricing, and quantities are agreed with you before launch.',
      wf: 'cartpopup'
    },
    bundleFunding: { title: 'Offer Funding', body: 'The combo discount and the free first year are funded by your registry promo pricing. Mat Bao provides the placement and the checkout flow. You only fund domains that customers actually register through the offer.' },
    campaignGoal: { title: 'Campaign Goal', body: 'The objective we optimise your boosted ads for: Reach & Impressions (Silver) or Traffic & Engagement (Gold, Diamond).' },
    alwaysOnAds: { title: 'Always-on Boosted Ads', body: 'Paid ads on Facebook and Google that run all year. Silver shares one carousel ad with other partners. Gold and Diamond get their own campaign. No organic posts are included.' },
    highlightBoost: { title: 'Highlight Boost Campaigns', body: 'Short, high-budget bursts around your key moments (launches, price promotions). 3 per year for Gold, 6 for Diamond.' },
    reporting: { title: 'Campaign Reporting', body: 'How you receive results: in the general partner report (Silver) or a dedicated quarterly report (Gold, Diamond).' },
    guaranteeMin: { title: 'Guaranteed Minimum New Registrations', body: 'A committed floor of new registrations for your TLD over the 12-month term, agreed before signing. See the Guarantee section for how it works.' },
    guaranteeCredit: { title: 'Shortfall Credit', body: 'If we miss the floor, the shortfall becomes credit toward your MDF 2028 package, up to 50% of the package fee. Not cash, not transferable.' },
    merchItems: { title: 'Co-brand Items', body: 'Merchandise produced with Mat Bao and your TLD branding, handed out at industry events through the year.' },
    merchOwn: { title: 'Registry’s Own Merchandise Distribution', body: 'We bring and distribute your own merchandise at the events we attend.' }
  };
})();
