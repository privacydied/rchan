// rchan service worker — installability + SELECTIVE caching.
//
// HTML/JSON stay uncached (an imageboard is live content; a caching SW would
// serve stale threads). But two classes of request are immutable by
// construction and safe to cache-first:
//   1. anything with a ?v= content-hash token (ux.css/ux.js/… — a new deploy
//      changes the URL, so a cached entry can never go stale),
//   2. /.media/* — LynxChan media is content-addressed by hash; the bytes for
//      a given URL never change.
// Fonts under /.rchan/ are unversioned but effectively immutable →
// stale-while-revalidate. Range requests (video seeking) pass straight
// through: answering a Range request from a full cached response breaks
// playback.
var STATIC_CACHE = "rchan-static-v1";
var MEDIA_CACHE = "rchan-media-v1";
var MEDIA_LIMIT = 300;                 // LRU-ish cap so media can't eat the quota

self.addEventListener("install", function () { self.skipWaiting(); });

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k !== STATIC_CACHE && k !== MEDIA_CACHE;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function trimCache(name, limit) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (keys) {
      if (keys.length <= limit) { return; }
      return c.delete(keys[0]).then(function () { return trimCache(name, limit); });
    });
  });
}

function cacheFirst(req, cacheName, trim) {
  return caches.open(cacheName).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) { return hit; }
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          c.put(req, res.clone());
          if (trim) { trimCache(cacheName, MEDIA_LIMIT); }
        }
        return res;
      });
    });
  });
}

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function (c) {
    return c.match(req).then(function (hit) {
      var refetch = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") { c.put(req, res.clone()); }
        return res;
      }).catch(function () { return hit; });
      return hit || refetch;
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") { return; }
  if (req.headers.get("range")) { return; }            // video seeking: never intercept
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) { return; }

  if (/[?&]v=[A-Za-z0-9]+/.test(url.search)) {         // content-hashed statics
    e.respondWith(cacheFirst(req, STATIC_CACHE, false));
    return;
  }
  if (url.pathname.indexOf("/.media/") === 0) {        // hash-addressed media
    e.respondWith(cacheFirst(req, MEDIA_CACHE, true));
    return;
  }
  if (/^\/\.rchan\/.+\.woff2$/.test(url.pathname) ||   // fonts + static flag icons
      /^\/\.static\/flags\//.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }
  // everything else (HTML, JSON, live endpoints): browser default, no caching
});
