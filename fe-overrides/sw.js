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
// Offline navigation fallback. NOTE: the page is (re)fetched at INSTALL time,
// and the SW only reinstalls when THIS file's bytes change — so bump the
// version below after any edit to fe-overrides/offline.html.
var OFFLINE_URL = "/.rchan/offline.html";   // offline.html v1

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(STATIC_CACHE).then(function (c) {
    return c.add(new Request(OFFLINE_URL, { cache: "reload" }));
  }).catch(function () {}));             // install must not fail if we're offline right now
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k !== STATIC_CACHE && k !== MEDIA_CACHE;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () {
    // navigation preload: we now respondWith() on navigations, which would
    // otherwise serialize them behind SW startup — let the network race it
    if (self.registration.navigationPreload) {
      return self.registration.navigationPreload.enable().catch(function () {});
    }
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

  // Navigations: network as always (HTML is live content, never cached), but a
  // network FAILURE — offline, DNS, origin down — lands on the branded offline
  // page instead of the browser's error screen. HTTP errors (404/500) are real
  // responses and pass through untouched.
  if (req.mode === "navigate") {
    e.respondWith(
      Promise.resolve(e.preloadResponse).then(function (pre) {
        return pre || fetch(req);
      }).catch(function () {
        return caches.match(OFFLINE_URL).then(function (hit) {
          return hit || fetch(req);      // no cached copy: surface the original failure
        });
      })
    );
    return;
  }

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

// ---- Web Push: server-sent reply notifications (fire with every tab closed) ----
// The webpush addon pushes a JSON payload {title, body, url, tag}; show it as a
// system notification and, on click, focus an existing tab (navigating it) or
// open a new one at the post.
self.addEventListener("push", function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = {}; }
  var title = data.title || "rchan";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "New activity",
    tag: data.tag || "rchan",
    renotify: !!data.tag,
    data: { url: data.url || "/" },
    icon: "/.rchan/icon-192.png",
    badge: "/.rchan/icon-192.png"
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || "/";
  // Defense-in-depth: the push payload is server-built from boardUri+threadId
  // today, but this handler shouldn't blindly trust whatever URL rides along
  // in a push message — pin navigation to same-origin only.
  try {
    var u = new URL(target, self.location.origin);
    if (u.origin !== self.location.origin) { target = "/"; }
  } catch (err) { target = "/"; }
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (wins) {
    for (var i = 0; i < wins.length; i++) {
      var w = wins[i];
      if ("focus" in w) {
        try { if ("navigate" in w) { w.navigate(target); } } catch (err) {}
        return w.focus();
      }
    }
    if (clients.openWindow) { return clients.openWindow(target); }
  }));
});
