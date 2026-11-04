'use strict';
/* Tiny JSON store. The whole program has at most a few dozen registrations, so one file is enough.
   Writes go through a queue and land atomically (temp file + rename), so a crash never leaves half a file. */
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  program: {
    startAt: '2026-11-21T00:00:00+07:00',
    endAt: '2026-12-21T23:59:59+07:00',
    earlyBirdUntil: '2026-11-30T23:59:59+07:00',
    earlyBirdPct: 5
  },
  plans: {
    silver: { list: 900, half: 500, slots: 4 },
    gold: { list: 4200, half: 2310, slots: 3 },
    diamond: { list: 6500, half: 3575, slots: 2 }
  },
  holdHours: 48,              // Mat Bao promises to confirm within this time
  verifyHours: 24,            // unverified requests expire after this
  maxActivePerDomain: 2,      // active holds + confirmed per email domain
  teamEmails: ['marcom@matbao.com'],
  replyTo: 'marcom@matbao.com'
};

function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let db;
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { db = {}; }
  db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
  db.settings.program = Object.assign({}, DEFAULT_SETTINGS.program, db.settings.program || {});
  db.settings.plans = Object.assign({}, DEFAULT_SETTINGS.plans, db.settings.plans || {});
  db.registrations = db.registrations || [];
  db.audit = db.audit || [];
  db.mailLog = db.mailLog || [];

  let queue = Promise.resolve();
  function save() {
    const snapshot = JSON.stringify(db, null, 2);
    queue = queue.then(() => new Promise((resolve) => {
      const tmp = file + '.tmp';
      fs.writeFile(tmp, snapshot, (err) => {
        if (err) { console.error('store write failed', err); return resolve(); }
        fs.rename(tmp, file, (err2) => { if (err2) console.error('store rename failed', err2); resolve(); });
      });
    }));
    return queue;
  }
  function audit(action, regId, by, detail) {
    db.audit.unshift({ at: new Date().toISOString(), action, regId: regId || null, by: by || 'system', detail: detail || '' });
    if (db.audit.length > 2000) db.audit.length = 2000;
  }
  save();
  return { db, save, audit };
}

module.exports = { createStore, DEFAULT_SETTINGS };
