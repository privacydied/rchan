'use strict';

// sitemap — live XML sitemap for search engines, served at /addon.js/sitemap
// (the router exposes it as https://boards.rchan.xyz/sitemap.xml and both
// hosts' robots.txt point at it).
//
// Threads are the content that matters and they die (pruned off the last
// page, rotated out of cyclic threads) — a static sitemap would advertise
// dead URLs and miss new ones. Building it live from the DB keeps it exact:
// search engines see every living thread with an honest <lastmod>, and
// nothing else.
//
// Also: IndexNow auto-ping. Every PING_MS one worker (cross-worker lease
// lock, same pattern as the webpush addon) collects threads whose lastBump
// moved since the last ping — new threads and fresh replies both bump — and
// POSTs their URLs to api.indexnow.org, so Bing/Yandex/Seznam/Naver index
// new content in minutes instead of at next crawl. Saged replies don't move
// lastBump and are deliberately not pinged (they're minor updates; the next
// bump or crawl picks them up).
//
// ── Safety / isolation ────────────────────────────────────────────────────
//   • The sitemap itself is READ-ONLY: two find() projections, no writes.
//   • The pinger's ONLY write is its own single lock/cursor document in its
//     OWN new collection (rchanSeo) — engine data is never touched.
//   • Everything is try/caught; a failed ping logs and waits for the next
//     tick, a failed request returns a plain 500 — nothing can throw into
//     the engine.

var db = require('../db');
var https = require('https');

exports.engineVersion = '2.3';

var APEX = 'https://rchan.xyz';
var SITE = 'https://boards.rchan.xyz';
var CACHE_MS = 10 * 60 * 1000;
var MAX_URLS = 5000;             // sitemap spec allows 50k; far beyond need
var cachedXml = null, cachedAt = 0;

// IndexNow: the key is public by design (ownership proof is serving it at
// /<key>.txt — the router does; see nginx/default.conf).
var IN_KEY = 'b0df0ad131c7bcf890cfffaa9d4e60c7cd74207a71702eeb';
var IN_HOST = 'boards.rchan.xyz';
var PING_MS = 5 * 60 * 1000;     // scan cadence
var PING_MAX = 500;              // URLs per submission (API allows 10k)
var LOCK_ID = 'indexnow-lock';   // lease lock + cursor doc, in rchanSeo

function seoCol() { return db.conn().collection('rchanSeo'); }

exports.init = function () {
  // Every worker arms the timer; the lease lock makes exactly one of them
  // ping per tick. First claim seeds the cursor to "now" — no backlog replay.
  setInterval(function () {
    try { pingTick(); } catch (e) { console.log('[sitemap] ping throw: ' + e); }
  }, PING_MS);
  console.log('[sitemap] live sitemap enabled (/addon.js/sitemap), IndexNow ping every '
    + (PING_MS / 60000) + 'min');
};

function pingTick() {
  var c = seoCol();
  var now = new Date();
  var lease = new Date(Date.now() + Math.floor(PING_MS * 0.8));
  c.findOneAndUpdate(
    { _id : LOCK_ID, until : { $lt : now } },
    { $set : { until : lease, lastPing : now } },
    { returnDocument : 'before', includeResultMetadata : true }
  ).then(function (res) {
    var prev = res && res.value;
    if (!prev) {
      // first run creates the doc (seeding the cursor); a duplicate-key error
      // just means another worker holds it — skip this tick either way.
      return c.insertOne({ _id : LOCK_ID, until : lease, lastPing : now })
        .catch(function () {});
    }
    return doPing(prev.lastPing || now);
  }).catch(function (e) { console.log('[sitemap] ping lock error: ' + e); });
}

function doPing(since) {
  return db.conn().collection('threads')
    .find({ lastBump : { $gt : since }, trash : { $ne : true } },
      { projection : { boardUri : 1, threadId : 1 } })
    .limit(PING_MAX).toArray().then(function (ts) {

    var urls = (ts || []).filter(function (t) { return t.boardUri && t.threadId; })
      .map(function (t) { return SITE + '/' + t.boardUri + '/res/' + t.threadId; });
    if (!urls.length) { return; }

    var body = JSON.stringify({
      host : IN_HOST,
      key : IN_KEY,
      keyLocation : SITE + '/' + IN_KEY + '.txt',
      urlList : urls
    });

    return new Promise(function (resolve) {
      var req = https.request({
        hostname : 'api.indexnow.org', path : '/indexnow', method : 'POST',
        headers : { 'Content-Type' : 'application/json; charset=utf-8',
                    'Content-Length' : Buffer.byteLength(body) },
        timeout : 20000
      }, function (res) {
        res.resume();   // drain
        console.log('[sitemap] IndexNow ping: ' + res.statusCode + ' for '
          + urls.length + ' url' + (urls.length === 1 ? '' : 's'));
        resolve();
      });
      req.on('error', function (e) {
        console.log('[sitemap] IndexNow ping failed: ' + e.message);
        resolve();
      });
      req.on('timeout', function () { req.destroy(new Error('timeout')); });
      req.end(body);
    });

  }).catch(function (e) { console.log('[sitemap] ping error: ' + e); });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function iso(d) {
  try { return new Date(d).toISOString(); } catch (e) { return null; }
}

function buildXml() {

  var boards = db.conn().collection('boards');
  var threads = db.conn().collection('threads');

  return boards.find({}, { projection: { boardUri: 1 } }).toArray().then(function (bs) {

    return threads.find({ trash: { $ne: true } },
        { projection: { boardUri: 1, threadId: 1, lastBump: 1, creation: 1 } })
      .sort({ lastBump: -1 }).limit(MAX_URLS).toArray().then(function (ts) {

      var out = ['<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

      // the one canonical homepage (apex — matches the canonical tags)
      out.push('<url><loc>' + APEX + '/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>');

      // each board's landing view (the catalog — matches the canonical tags)
      (bs || []).forEach(function (b) {
        if (!b.boardUri || !/^[a-zA-Z0-9]{1,32}$/.test(b.boardUri)) { return; }
        out.push('<url><loc>' + SITE + '/' + esc(b.boardUri) +
          '/catalog</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>');
      });

      // every living thread, clean URL, honest lastmod
      (ts || []).forEach(function (t) {
        if (!t.boardUri || !t.threadId) { return; }
        var mod = iso(t.lastBump || t.creation);
        out.push('<url><loc>' + SITE + '/' + esc(t.boardUri) + '/res/' + t.threadId +
          '</loc>' + (mod ? '<lastmod>' + mod + '</lastmod>' : '') + '</url>');
      });

      out.push('</urlset>');
      return out.join('\n');
    });
  });
}

exports.formRequest = function (req, res) {

  try {

    if (cachedXml && (Date.now() - cachedAt) < CACHE_MS) {
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600'
      });
      return res.end(cachedXml);
    }

    buildXml().then(function (xml) {
      cachedXml = xml; cachedAt = Date.now();
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600'
      });
      res.end(xml);
    })['catch'](function (e) {
      console.log('[sitemap] build error: ' + e);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('sitemap unavailable');
    });

  } catch (e) {
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('sitemap unavailable');
    } catch (e2) {}
  }

};
