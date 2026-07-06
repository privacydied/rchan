// rchan service worker — minimal, enables "Add to Home Screen"/install.
// Deliberately NO caching: an imageboard is live content, and a caching SW would serve
// stale threads. This is a pure passthrough (the fetch handler exists only so browsers
// consider the app installable).
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () { /* let the browser handle every request normally */ });
