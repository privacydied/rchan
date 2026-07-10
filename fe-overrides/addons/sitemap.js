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
// ── Safety / isolation ────────────────────────────────────────────────────
//   • READ-ONLY: two indexed find()s (boards, threads projections); it never
//     writes anything, anywhere. No new collections, no state.
//   • The result is cached in memory for 10 minutes, so crawler traffic
//     costs at most one pair of queries per window per worker.
//   • formRequest is try/caught — a failure returns a plain 500 and can
//     never throw into the engine.

var db = require('../db');

exports.engineVersion = '2.3';

var APEX = 'https://rchan.xyz';
var SITE = 'https://boards.rchan.xyz';
var CACHE_MS = 10 * 60 * 1000;
var MAX_URLS = 5000;             // sitemap spec allows 50k; far beyond need
var cachedXml = null, cachedAt = 0;

exports.init = function () {
  console.log('[sitemap] live sitemap enabled (/addon.js/sitemap)');
};

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
