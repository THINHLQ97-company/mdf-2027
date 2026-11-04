/* Connects the landing page to the MDF server: live slots / program dates, and real registration.
   When the page is opened as a plain file (no server), nothing here runs and the form stays in preview mode. */
(function () {
  'use strict';
  if (!/^https?:$/.test(location.protocol)) return;

  function refresh() {
    return fetch('/api/status', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (st) { if (st && window.MDF_APP) window.MDF_APP.applyStatus(st); return st; })
      .catch(function () { return null; });
  }

  refresh().then(function (st) {
    if (!st) return;   // no server behind this page: keep preview mode
    window.MDF_SUBMIT = function (payload) {
      return fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) { var e = new Error(body.error || 'Registration failed.'); e.fields = body.fields; throw e; }
          refresh();
          return body;
        });
      });
    };
    // Keep slot counts current while the page is open.
    setInterval(function () { if (!document.hidden) refresh(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  });
})();
