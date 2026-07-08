'use strict';

// presence — "N anons in this thread": anonymous viewer counts per thread.
//
// Lurkers are invisible, so threads read emptier than they are. The front-end
// pings GET /addon.js/presence?boardUri=x&threadId=y&sid=<random session id>
// every 45s while the tab is visible; each ping upserts a heartbeat document
// and returns how many distinct session ids pinged this thread in the last
// 90 seconds. ux.js renders that as "N anons here" in the thread status line.
//
// Storage: its OWN new collection (rchanPresence) — never touches any engine
// collection. Documents are ephemeral heartbeats {_id, b, t, ts} auto-expired
// by a TTL index; the imageboard's data is never read or written.
//
// Counts are heartbeat-based (shared MongoDB) rather than WebSocket-based
// deliberately: WS connections are tracked per worker process, so any single
// worker only sees a slice; the DB sees everyone, including viewers whose
// socket dropped. A session id is client-generated and trivially spoofable —
// this is a mood light, not an audit metric.

var db = require('../db');
var url = require('url');

exports.engineVersion = '2.3';

var WINDOW_MS = 90 * 1000;      // a viewer counts for 90s after their last ping
var TYPING_MS = 15 * 1000;      // a typist counts for 15s after their last typing ping
var col = null;

function collection() {
  if (!col) { col = db.conn().collection('rchanPresence'); }
  return col;
}

exports.init = function() {

  // addons start after bootDb, so the connection exists; TTL sweep clears
  // stale heartbeats (only ever this addon's own documents).
  try {
    collection().createIndex({ ts : 1 }, { expireAfterSeconds : 180 })
      .catch(function(e) { console.log('[presence] index error: ' + e); });
    collection().createIndex({ b : 1, t : 1, ts : 1 })
      .catch(function(e) { console.log('[presence] index error: ' + e); });
  } catch (e) { console.log('[presence] init error: ' + e); }

  console.log('[presence] thread presence endpoint enabled (/addon.js/presence)');

};

function reply(res, code, obj) {
  res.writeHead(code, {
    'Content-Type' : 'application/json',
    'Cache-Control' : 'no-store'
  });
  res.end(JSON.stringify(obj));
}

exports.formRequest = function(req, res) {

  try {

    var q = url.parse(req.url, true).query || {};

    var board = String(q.boardUri || '');
    var thread = String(q.threadId || '');
    var sid = String(q.sid || '');

    if (!/^[a-z0-9]{8,40}$/i.test(sid)) {
      return reply(res, 400, { status : 'error', data : 'bad parameters' });
    }

    var c = collection();

    // site-wide scope: ?site=1&sid=… from ANY page — "N anons browsing now".
    // Same heartbeat mechanics, pseudo-board '@site' (no real board can have
    // an @ in its uri), same TTL sweep.
    if (String(q.site || '') === '1') {

      return c.updateOne({ _id : 'site-' + sid },
          { $set : { b : '@site', t : '0', ts : new Date() } },
          { upsert : true }).then(function() {

        return c.countDocuments({
          b : '@site',
          ts : { $gt : new Date(Date.now() - WINDOW_MS) }
        });

      }).then(function(n) {
        reply(res, 200, { status : 'ok', count : n });
      })['catch'](function(e) {
        reply(res, 500, { status : 'error', data : String(e) });
      });

    }

    if (!/^[a-zA-Z0-9]{1,32}$/.test(board) || !/^\d{1,12}$/.test(thread)) {
      return reply(res, 400, { status : 'error', data : 'bad parameters' });
    }

    // typing=1 stamps a short-lived "typing" timestamp on the heartbeat;
    // anything else clears it (stopped typing / cleared the box).
    var docId = board + '-' + thread + '-' + sid;
    var update = { $set : { b : board, t : thread, ts : new Date() } };

    if (String(q.typing || '') === '1') {
      update.$set.ty = new Date();
    } else {
      update.$unset = { ty : '' };
    }

    c.updateOne({ _id : docId }, update, { upsert : true }).then(function() {

      return Promise.all([ c.countDocuments({
        b : board,
        t : thread,
        ts : { $gt : new Date(Date.now() - WINDOW_MS) }
      }), c.countDocuments({
        b : board,
        t : thread,
        _id : { $ne : docId },        // your own typing isn't news to you
        ty : { $gt : new Date(Date.now() - TYPING_MS) }
      }) ]);

    }).then(function(counts) {
      reply(res, 200, { status : 'ok', count : counts[0], typing : counts[1] });
    })['catch'](function(e) {
      reply(res, 500, { status : 'error', data : String(e) });
    });

  } catch (e) {
    reply(res, 500, { status : 'error', data : String(e) });
  }

};
