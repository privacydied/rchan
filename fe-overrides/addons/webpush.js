'use strict';

// webpush — server-sent reply notifications (works with the tab CLOSED).
//
// The bell/watcher only fires while a tab is open, so it must poll; users who
// want to be told about a reply have to leave a tab running (and keep polling).
// This addon closes that gap with the Web Push standard: the browser holds a
// push subscription, the SERVER pushes when a matching post appears, and the
// service worker shows the notification even with every tab shut. Net effect is
// LESS load, not more — a subscribed user stops leaving a polling tab open.
//
// ── Safety / isolation (this is the load-bearing property) ────────────────────
//   • Its OWN new collection, rchanPushSubs. It NEVER writes/deletes any engine
//     collection. It only READS the posts collection (one indexed creation-range
//     query per scan) to find what to notify about — the imageboard's data is
//     never mutated, so this cannot affect posting, moderation or the DB.
//   • Every hook is wrapped so a failure logs and returns — it can't throw into
//     the engine. If VAPID keys aren't configured it disables itself cleanly
//     (endpoints 503, no scanner), so a missing .env never breaks the engine.
//
// ── Config (settings/.env, loaded into the engine container) ──────────────────
//   VAPID_PUBLIC   — base64url VAPID public key (also served to the client)
//   VAPID_PRIVATE  — base64url VAPID private key (signs pushes; secret)
//   VAPID_SUBJECT  — mailto: or https: contact (optional, defaults to a mailto)
//   Generate once:  node -e "console.log(require('web-push').generateVAPIDKeys())"
//
// ── Endpoints (POST bodies are JSON; same-origin, so no CORS) ─────────────────
//   GET  /addon.js/webpush?action=key           -> { key }         VAPID public
//   POST /addon.js/webpush?action=subscribe      { sub, boards }   upsert sub
//   POST /addon.js/webpush?action=unsubscribe    { endpoint }      drop sub
//   POST /addon.js/webpush?action=test           { endpoint }      send a test push
//
// A subscription document:
//   { _id: sha256(endpoint), sub: <PushSubscription JSON>,
//     boards: { <uri>: { threads:[id…], you:[postId…] } }, ts: Date }
// TTL on ts auto-expires abandoned subs; the client re-syncs to keep them alive.

var db = require('../db');
var url = require('url');
var crypto = require('crypto');

var webpush = null;
try { webpush = require('web-push'); } catch (e) {
  console.log('[webpush] web-push module not found — addon disabled: ' + e);
}

exports.engineVersion = '2.3';

var SCAN_MS = 30 * 1000;        // how often to look for new posts to notify on
var SCAN_LIMIT = 500;           // most posts examined per scan (backstop)
var SUB_TTL_S = 60 * 24 * 3600; // drop a subscription 60d after its last sync
var MAX_IDS = 800;              // cap on threads/you ids stored per board
var LOCK_ID = '__scanlock';     // cross-worker single-flight lock doc (in rchanPushSubs)
var col = null, enabled = false, timer = null;

function subsCol() {
  if (!col) { col = db.conn().collection('rchanPushSubs'); }
  return col;
}
function postsCol() { return db.conn().collection('posts'); }
function hash(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

exports.init = function () {

  try {
    var pub = process.env.VAPID_PUBLIC, priv = process.env.VAPID_PRIVATE;
    if (!webpush || !pub || !priv) {
      console.log('[webpush] VAPID keys not configured (VAPID_PUBLIC/VAPID_PRIVATE) — endpoints will 503, no scanner');
      return;
    }
    var subject = process.env.VAPID_SUBJECT || 'mailto:admin@rchan.xyz';
    webpush.setVapidDetails(subject, pub, priv);
    enabled = true;

    subsCol().createIndex({ ts: 1 }, { expireAfterSeconds: SUB_TTL_S })
      .catch(function (e) { console.log('[webpush] index error: ' + e); });

    // LynxChan runs one addon instance PER worker process, so every worker's
    // init() fires this interval — but scanTick() is single-flighted across
    // workers by a Mongo lease lock, so only one worker scans+sends per tick
    // (no N-fold duplicate pushes). The scan cursor (lastScan) lives in the lock
    // doc, seeded to "now" on first claim, so a boot never replays a backlog.
    timer = setInterval(function () { try { scanTick(); } catch (e) { console.log('[webpush] scan throw: ' + e); } }, SCAN_MS);

    console.log('[webpush] enabled (/addon.js/webpush), scanning every ' + (SCAN_MS / 1000) + 's');
  } catch (e) {
    console.log('[webpush] init error: ' + e);
  }

};

// ── the scanner ───────────────────────────────────────────────────────────────
function parseQuotes(msg) {
  var out = [], m, re = />>(\d{1,12})/g;
  while ((m = re.exec(String(msg || ''))) !== null) { out.push(Number(m[1])); }
  return out;
}

function scanTick() {
  if (!enabled) { return; }
  var c = subsCol();
  var now = new Date();
  // Lease shorter than the tick interval so the lock reliably frees before the
  // next tick (some worker then claims it → ~every-SCAN_MS cadence), yet long
  // enough to cover a scan so two workers never scan the same tick at once. A
  // crashed holder's lock self-expires after this window.
  var lease = new Date(Date.now() + Math.floor(SCAN_MS * 0.8));

  // Atomically claim the lock IF it's free/expired, returning the PREVIOUS
  // doc so we learn the window to scan. A worker that doesn't win (lock held
  // fresh) gets value:null and does nothing this tick. NOTE: lastScan is
  // deliberately NOT advanced here — see doScan()'s comment on why jumping
  // the cursor to wall-clock "now" up front can permanently drop posts.
  c.findOneAndUpdate(
    { _id: LOCK_ID, until: { $lt: now } },
    { $set: { until: lease } },
    { returnDocument: 'before', includeResultMetadata: true }
  ).then(function (res) {
    var prev = res && res.value;
    if (!prev) {
      // No matching lock: either it doesn't exist yet (first run) or it's held
      // fresh by another worker. Try to create it — a duplicate-key error means
      // someone else owns it, so we simply skip. First creation seeds the cursor
      // to now, so the very first tick establishes a baseline and scans nothing.
      return c.insertOne({ _id: LOCK_ID, until: lease, lastScan: now }).catch(function () {});
    }
    var since = prev.lastScan || now;
    return doScan(since, now).then(function (newCursor) {
      return c.updateOne({ _id: LOCK_ID }, { $set: { lastScan: newCursor } });
    });
  }).catch(function (e) { console.log('[webpush] lock/scan error: ' + e); });
}

function doScan(since, now) {
  return postsCol().find({ creation: { $gt: since } },
      { projection: { boardUri: 1, threadId: 1, postId: 1, message: 1, creation: 1 } })
    .sort({ creation: 1 }).limit(SCAN_LIMIT).toArray().then(function (posts) {

    // Advance the cursor to the newest post actually processed this tick,
    // NOT to wall-clock "now": if a traffic spike produces more than
    // SCAN_LIMIT posts in one window, jumping straight to "now" would put
    // every post past the cap behind the new cursor forever — no future
    // tick's `creation > since` would ever see them again, silently and
    // permanently dropping their notifications. Only fall back to "now"
    // when the batch was smaller than the cap, i.e. we're genuinely caught
    // up (a batch smaller than SCAN_LIMIT means no post is waiting behind
    // the cursor right now).
    if (!posts || !posts.length) { return now; }
    var newCursor = (posts.length === SCAN_LIMIT) ? posts[posts.length - 1].creation : now;

    // Exclude the lock doc; real subscriptions have sha256-hex ids.
    return subsCol().find({ _id: { $ne: LOCK_ID } }).toArray().then(function (subs) {
      if (!subs || !subs.length) { return newCursor; }

      var jobs = {};   // subId -> { sub, hits:[{board,threadId,postId,you}] }
      posts.forEach(function (p) {
        var quoted = parseQuotes(p.message);
        subs.forEach(function (s) {
          var bd = s.boards && s.boards[p.boardUri];
          if (!bd) { return; }
          var you = (bd.you || []).some(function (id) { return quoted.indexOf(Number(id)) > -1; });
          var watch = (bd.threads || []).map(Number).indexOf(Number(p.threadId)) > -1;
          if (!you && !watch) { return; }
          var j = jobs[s._id] || (jobs[s._id] = { sub: s, hits: [] });
          j.hits.push({ board: p.boardUri, threadId: p.threadId, postId: p.postId, you: you });
        });
      });

      return Promise.all(Object.keys(jobs).map(function (id) { return sendFor(jobs[id]); }))
        .then(function () { return newCursor; });
    });

  }).catch(function (e) { console.log('[webpush] scan error: ' + e); return since; });
}

function sendFor(job) {
  var hits = job.hits;
  // Prefer a reply-to-you hit as the notification's landing target.
  var primary = null, youHits = 0;
  hits.forEach(function (h) { if (h.you) { youHits++; if (!primary) { primary = h; } } });
  if (!primary) { primary = hits[0]; }

  var title, body;
  if (hits.length === 1) {
    title = primary.you ? 'New reply to you' : 'New reply in a thread you follow';
    body = '/' + primary.board + '/ · thread ' + primary.threadId;
  } else {
    title = youHits ? (youHits + ' new repl' + (youHits === 1 ? 'y' : 'ies') + ' to you')
                    : (hits.length + ' new replies in threads you follow');
    body = 'in ' + hits.length + ' post' + (hits.length === 1 ? '' : 's') + ' · tap to open';
  }

  var payload = JSON.stringify({
    title: title, body: body,
    url: '/' + primary.board + '/res/' + primary.threadId + '.html#' + primary.postId,
    tag: 'rchan-' + primary.board + '-' + primary.threadId,
    count: hits.length
  });

  return webpush.sendNotification(job.sub.sub, payload).catch(function (err) {
    var code = err && err.statusCode;
    // 404/410 = the browser dropped this subscription; forget it (own collection).
    if (code === 404 || code === 410) {
      subsCol().deleteOne({ _id: job.sub._id })
        .catch(function (e) { console.log('[webpush] cleanup error: ' + e); });
    } else {
      console.log('[webpush] send error (' + code + '): ' + (err && err.message));
    }
  });
}

// ── request handling ──────────────────────────────────────────────────────────
function reply(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req, cb) {
  var data = '', over = false;
  req.on('data', function (c) {
    data += c;
    if (data.length > 262144 && !over) { over = true; try { req.destroy(); } catch (e) {} cb(null); }
  });
  req.on('end', function () { if (!over) { cb(data); } });
  req.on('error', function () { if (!over) { over = true; cb(null); } });
}

function sanitizeBoards(raw) {
  var out = {};
  if (!raw || typeof raw !== 'object') { return out; }
  Object.keys(raw).slice(0, 64).forEach(function (b) {
    if (!/^[a-zA-Z0-9]{1,32}$/.test(b)) { return; }
    var v = raw[b] || {};
    function nums(arr) {
      if (!Array.isArray(arr)) { return []; }
      var seen = {}, r = [];
      arr.forEach(function (x) {
        var n = Number(x);
        if (n > 0 && n < 1e12 && !seen[n] && r.length < MAX_IDS) { seen[n] = 1; r.push(n); }
      });
      return r;
    }
    var threads = nums(v.threads), you = nums(v.you);
    if (threads.length || you.length) { out[b] = { threads: threads, you: you }; }
  });
  return out;
}

function validSub(sub) {
  return sub && typeof sub.endpoint === 'string' &&
    /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 2048 &&
    sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
}

exports.formRequest = function (req, res) {

  try {
    var q = url.parse(req.url, true).query || {};
    var action = String(q.action || '');

    if (action === 'key') {
      if (!enabled) { return reply(res, 503, { status: 'error', data: 'push not configured' }); }
      return reply(res, 200, { status: 'ok', key: process.env.VAPID_PUBLIC });
    }

    if (!enabled) { return reply(res, 503, { status: 'error', data: 'push not configured' }); }

    if (action === 'subscribe' || action === 'unsubscribe' || action === 'test') {
      return readBody(req, function (raw) {
        var body;
        try { body = JSON.parse(raw || '{}'); } catch (e) {
          return reply(res, 400, { status: 'error', data: 'bad json' });
        }

        if (action === 'unsubscribe') {
          var ep = String(body.endpoint || '');
          if (!ep) { return reply(res, 400, { status: 'error', data: 'no endpoint' }); }
          return subsCol().deleteOne({ _id: hash(ep) }).then(function () {
            reply(res, 200, { status: 'ok' });
          })['catch'](function (e) { reply(res, 500, { status: 'error', data: String(e) }); });
        }

        if (action === 'test') {
          var tep = String(body.endpoint || '');
          if (!tep) { return reply(res, 400, { status: 'error', data: 'no endpoint' }); }
          return subsCol().findOne({ _id: hash(tep) }).then(function (doc) {
            if (!doc) { return reply(res, 404, { status: 'error', data: 'unknown subscription' }); }
            return webpush.sendNotification(doc.sub, JSON.stringify({
              title: 'rchan notifications on', body: 'You will be told about replies even with the tab closed.',
              url: '/', tag: 'rchan-test'
            })).then(function () { reply(res, 200, { status: 'ok' }); });
          })['catch'](function (e) { reply(res, 500, { status: 'error', data: String(e) }); });
        }

        // subscribe / re-sync
        if (!validSub(body.sub)) { return reply(res, 400, { status: 'error', data: 'bad subscription' }); }
        var doc = {
          _id: hash(body.sub.endpoint),
          sub: { endpoint: body.sub.endpoint, keys: { p256dh: body.sub.keys.p256dh, auth: body.sub.keys.auth } },
          boards: sanitizeBoards(body.boards),
          ts: new Date()
        };
        return subsCol().updateOne({ _id: doc._id }, { $set: doc }, { upsert: true }).then(function () {
          reply(res, 200, { status: 'ok' });
        })['catch'](function (e) { reply(res, 500, { status: 'error', data: String(e) }); });
      });
    }

    return reply(res, 400, { status: 'error', data: 'unknown action' });

  } catch (e) {
    reply(res, 500, { status: 'error', data: String(e) });
  }

};
