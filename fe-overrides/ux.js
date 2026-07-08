// rchan UX layer — same-origin (CSP-safe) client enhancements.
// Nav buttons, "(You)" highlighting, image hover-zoom, catalog card-size, icon tooltips,
// keyboard shortcuts. Post hiding is intentionally NOT here — PenumbraLynx's native
// hiding.js already provides a richer hide menu (hide post/OP/thread, filter name/ID/etc.).
(function () {
  "use strict";

  /* ---------- Live updates: route LynxChan's separate-port WebSocket through the
     same-origin 443 path (/.ws) the reverse proxy upgrades. thread.js builds
     ws(s)://<hostname>:<wsPort>; behind Cloudflare that custom port isn't reachable,
     so rewrite any such same-host cross-port ws URL to wss://<host>/.ws. ---------- */
  (function patchWebSocket() {
    var Native = window.WebSocket;
    if (!Native) { return; }
    function Patched(url, protocols) {
      try {
        var u = new URL(url, location.href);
        var wsish = (u.protocol === "ws:" || u.protocol === "wss:");
        if (wsish && u.hostname === location.hostname && u.port && u.port !== location.port) {
          u.protocol = (location.protocol === "https:") ? "wss:" : "ws:";
          u.port = "";
          u.pathname = "/.ws";
          url = u.toString();
        }
      } catch (e) {}
      return protocols === undefined ? new Native(url) : new Native(url, protocols);
    }
    Patched.prototype = Native.prototype;
    Patched.CONNECTING = Native.CONNECTING; Patched.OPEN = Native.OPEN;
    Patched.CLOSING = Native.CLOSING; Patched.CLOSED = Native.CLOSED;
    window.WebSocket = Patched;
  })();

  // Respect the OS "reduce motion" preference for our scripted scrolling.
  var SB = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth";

  // Default theme is cream for everyone (server sets body.theme_cream). Dark is opt-in via the
  // theme switcher — we intentionally do NOT auto-switch to dark based on the OS preference.

  function getBoard() {
    var el = document.getElementById("boardIdentifier");
    if (el && el.value) { return el.value; }
    var m = location.pathname.match(/^\/([^\/.]+)\//);
    return m ? m[1] : null;
  }
  // Contextual post-form labels: a thread page replies, a board index makes a thread.
  function formLabels() {
    var inThread = /\/res\//.test(location.pathname);
    return inThread ? { show: "＋ Reply to thread", hide: "－ Hide reply form" }
                    : { show: "＋ Create new thread", hide: "－ Hide thread form" };
  }
  var SVG_GRID = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  var SVG_LIST = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
  var SVG_UP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="20" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
  var SVG_DOWN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg>';
  var SVG_PEN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
  var SVG_BELL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
  var SVG_CLOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><polyline points="12 7.5 12 12 15.2 13.8"/></svg>';
  var SVG_GEAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.484.484 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.61 3.61 0 0 1 8.4 12c0-1.98 1.62-3.6 3.6-3.6s3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';
  function isCatalog() { return /\/catalog(\.html)?$/.test(location.pathname); }
  function toggleCatalog() {
    var b = getBoard();
    if (!b || b.charAt(0) === ".") { return; }
    var toIndex = isCatalog();
    // remember the choice as the preferred board landing view: the router's
    // board-root -> catalog redirect reads this cookie and steps aside for
    // "index" (see nginx default.conf). "?index" still bypasses it in-page.
    try { document.cookie = "rchan_view=" + (toIndex ? "index" : "catalog") + "; path=/; max-age=31536000; SameSite=Lax"; } catch (e) {}
    location.href = toIndex ? ("/" + b + "/?index") : ("/" + b + "/catalog");
  }

  /* ---------- Floating nav buttons (top / catalog-toggle / bottom) ---------- */
  function buildNav() {
    if (document.getElementById("rchan-nav")) { return; }
    var wrap = document.createElement("div");
    wrap.id = "rchan-nav";
    function btn(html, title, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.innerHTML = html; b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", fn);
      wrap.appendChild(b);
      return b;
    }
    btn(SVG_UP, "Top", function () { window.scrollTo({ top: 0, behavior: SB }); });
    if (getBoard()) {
      var onCat = isCatalog();
      btn(onCat ? SVG_LIST : SVG_GRID, onCat ? "Back to index view" : "Catalog view", toggleCatalog);
    }
    if (document.querySelector("#fieldMessage, #qrbody, textarea[name=message]")) {
      var pen = btn(SVG_PEN, "Reply / post", function () {
        var q = window.qr;
        if (q && q.qrPanel) {                                            // thread: open the floating QR
          q.qrPanel.style.display = "block";
          if (q.qrPanel.getBoundingClientRect().top < 0) { q.qrPanel.style.top = "25px"; }
          var b = document.getElementById("qrbody");
          if (b) { b.focus(); }
          return;
        }
        var t = document.getElementById("rchan-formtoggle");             // board/catalog: floating new-thread box
        if (t) { t.click(); return; }
        var m = document.querySelector("#fieldMessage, textarea[name=message]");
        if (m) { m.focus(); try { m.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
      });
      pen.id = "rchan-penbtn";   // mobile CSS promotes it to the primary FAB
    }
    if (curThreadId() && "Notification" in window) {
      var bell = btn(SVG_BELL, "Notify me of new replies — this thread and watched threads (while a tab is open)", function () {
        if (localStorage.getItem(NOTIFY_KEY) === "1") { localStorage.removeItem(NOTIFY_KEY); bell.classList.remove("rchan-on"); return; }
        Notification.requestPermission().then(function (p) {
          if (p === "granted") { localStorage.setItem(NOTIFY_KEY, "1"); bell.classList.add("rchan-on"); }
        });
      });
      bell.id = "rchan-bellbtn";
      if (localStorage.getItem(NOTIFY_KEY) === "1") { bell.classList.add("rchan-on"); }
    }
    btn(SVG_GEAR, "Site settings", toggleSetPanel);
    btn(SVG_CLOCK, "Recently visited threads", toggleHistPanel);
    btn(SVG_DOWN, "Bottom", function () {
      window.scrollTo({ top: document.body.scrollHeight, behavior: SB });
    });
    document.body.appendChild(wrap);
  }

  /* ---------- Thumbnail skeletons (shimmer until the image loads) ---------- */
  function decorateThumbs(root) {
    var imgs = (root || document).querySelectorAll(".imgLink img, .linkThumb img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.getAttribute("data-skel")) { continue; }
      img.setAttribute("data-skel", "1");
      if (!img.getAttribute("loading")) { img.setAttribute("loading", "lazy"); img.setAttribute("decoding", "async"); }
      if (img.complete && img.naturalWidth > 0) { continue; }     // already loaded
      var wrap = img.parentNode;
      if (wrap && wrap.classList) { wrap.classList.add("rchan-skel"); }
      var clear = function () { if (this.parentNode && this.parentNode.classList) { this.parentNode.classList.remove("rchan-skel"); } };
      img.addEventListener("load", clear); img.addEventListener("error", clear);
    }
  }

  /* ---------- localStorage helpers ---------- */
  function load(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; } }
  function save(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr.slice(-5000))); } catch (e) {} }
  var YOU_KEY = "rchan_you";
  function postId(inner) {
    var q = inner.querySelector(".linkQuote");
    return q ? (q.textContent || "").replace(/\D/g, "") : null;
  }

  /* ---------- Toast notifications (styled replacement for alert()) ----------
     LynxChan's FE reports every posting error/notice via alert(). Convert those
     into a dismissable toast; flood errors ("wait N more seconds") additionally
     start a live cooldown countdown on the Post/Reply buttons. */
  var toastBox = null, toastTimer = null;
  function toast(msg, isErr) {
    if (!toastBox) {
      toastBox = document.createElement("div"); toastBox.id = "rchan-toast";
      toastBox.setAttribute("role", "alert");
      toastBox.addEventListener("click", function () { toastBox.style.display = "none"; });
      document.body.appendChild(toastBox);
    }
    toastBox.textContent = msg;
    toastBox.classList.toggle("rchan-toast-err", !!isErr);
    toastBox.classList.remove("rchan-toast-ok");
    toastBox.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastBox.style.display = "none"; }, 7000);
  }
  function okToast(msg) {              // green success variant (shorter-lived)
    toast(msg, false);
    toastBox.classList.add("rchan-toast-ok");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastBox.style.display = "none"; }, 3500);
  }
  function toastAction(msg, label, fn) {   // toast with a trailing action link ("Undo")
    okToast(msg);
    var a = document.createElement("a");
    a.href = "#"; a.className = "rchan-toast-act"; a.textContent = label;
    a.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      toastBox.style.display = "none";
      fn();
    });
    toastBox.appendChild(document.createTextNode(" "));
    toastBox.appendChild(a);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastBox.style.display = "none"; }, 8000);
  }
  var cdTimer = null;
  function startCooldown(secs) {
    var btns = [document.getElementById("qrbutton"), document.getElementById("formButton")]
      .filter(Boolean).map(function (b) { return { el: b, txt: b.textContent }; });
    if (!btns.length) { return; }
    clearInterval(cdTimer);
    var left = secs;
    function tick() {
      if (left <= 0) {
        clearInterval(cdTimer); cdTimer = null;
        btns.forEach(function (b) { b.el.disabled = false; b.el.textContent = b.txt; });
        return;
      }
      btns.forEach(function (b) { b.el.disabled = true; b.el.textContent = b.txt + " (" + left + "s)"; });
      left--;
    }
    tick();
    cdTimer = setInterval(tick, 1000);
  }
  function hookAlerts() {
    var nativeAlert = window.alert;
    window.alert = function (msg) {
      try {
        msg = String(msg == null ? "" : msg).replace(/:\s*(null|undefined|\{\}|"")\s*$/, "");
        var m = msg.match(/wait (\d+) more second/i);
        if (m) { startCooldown(parseInt(m[1], 10)); }
        var err = /error|fail|flood|banned|wait|invalid|expired|wrong|mandatory|too long|not allowed|denied/i.test(msg);
        toast(msg, err);
      } catch (e) { nativeAlert.call(window, msg); }
    };
  }

  /* ---------- Draft autosave (per board/thread, cleared on successful post) ---------- */
  var DRAFT_NS = "rchan_draft:";
  function draftKey() {
    var b = getBoard(); if (!b || b.charAt(0) === ".") { return null; }
    return DRAFT_NS + b + "/" + (curThreadId() || "index");
  }
  var draftT = null;
  function saveDraftFrom(el) {
    if (!setOn("drafts")) { return; }
    clearTimeout(draftT);
    draftT = setTimeout(function () {
      var key = draftKey(); if (!key) { return; }
      try {
        var v = el.value || "";
        if (v.trim()) { localStorage.setItem(key, v); } else { localStorage.removeItem(key); }
      } catch (e) {}
    }, 400);
  }
  function clearDraft() {
    var key = draftKey(); if (!key) { return; }
    try { localStorage.removeItem(key); } catch (e) {}   // native replyCallback clears the fields
  }
  function initDrafts() {
    var key = draftKey(); if (!key) { return; }
    var msg = document.getElementById("fieldMessage");
    if (!msg || msg.getAttribute("data-draft")) { return; }
    msg.setAttribute("data-draft", "1");
    try {
      var d = setOn("drafts") ? localStorage.getItem(key) : null;
      if (d && !msg.value) {
        msg.value = d;
        msg.dispatchEvent(new Event("input", { bubbles: true }));  // syncs #qrbody + counters
      }
    } catch (e) {}
    msg.addEventListener("input", function () { saveDraftFrom(msg); });
  }
  function hookQrDraft() {  // #qrbody is built lazily by qr.js; its input doesn't re-fire on #fieldMessage
    var ta = document.getElementById("qrbody");
    if (!ta || ta.getAttribute("data-draft")) { return; }
    ta.setAttribute("data-draft", "1");
    ta.addEventListener("input", function () { saveDraftFrom(ta); });
  }

  /* ---------- "(You)" — record your own posts, then highlight ---------- */
  var flashId = null, flashDeadline = 0;
  function addYou(id) {
    id = String(id).replace(/\D/g, "");
    if (!id) { return; }
    clearDraft();                                   // post landed — the draft served its purpose
    flashId = id; flashDeadline = Date.now() + 20000;
    var a = load(YOU_KEY);
    if (a.indexOf(id) < 0) { a.push(id); save(YOU_KEY, a); refresh(); }
  }
  // After a successful reply, scroll to your post once it renders and flash it.
  function tryFlashOwnPost() {
    if (!flashId) { return; }
    if (Date.now() > flashDeadline) { flashId = null; return; }
    if (!curThreadId()) { return; }                 // new-thread posts navigate away anyway
    var el = document.getElementById(flashId);
    if (!el) { return; }
    var inner = el.querySelector(".innerPost, .innerOP") || el;
    flashId = null;
    try { el.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {}
    inner.classList.add("rchan-flash");
    setTimeout(function () { inner.classList.remove("rchan-flash"); }, 2600);
  }
  function hookPostCapture() {
    var re = /\/(replyThread|newThread)\.js/;
    var oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return oOpen.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (body) {
      // admin flag override: ride the outgoing posting FormData (the engine's
      // fe JS builds its payload from a fixed field list, so a plain <select>
      // in the form would never be sent). Server re-checks the role anyway.
      try {
        var sel = document.getElementById("rchan-flagoverride");
        if (sel && /^[a-z]{2}$/i.test(sel.value) && re.test(this.__u || "") &&
            typeof FormData !== "undefined" && body instanceof FormData) {
          body.append("flagOverride", sel.value.toUpperCase());
        }
      } catch (e) {}
      var x = this;
      this.addEventListener("load", function () {
        try {
          if (re.test(x.__u || "")) {
            var r = JSON.parse(x.responseText);
            if (r && r.status === "ok" && r.data != null) {
              addYou(r.data);
              okToast(/newThread/.test(x.__u) ? "Thread created" : "Reply posted");
            }
          }
        } catch (e) {}
      });
      return oSend.apply(this, arguments);
    };
    if (window.fetch) {
      var oF = window.fetch;
      window.fetch = function (input) {
        var url = (typeof input === "string") ? input : (input && input.url) || "";
        var p = oF.apply(this, arguments);
        if (re.test(url)) {
          p.then(function (res) {
            res.clone().json().then(function (r) {
              if (r && r.status === "ok" && r.data != null) {
                addYou(r.data);
                okToast(/newThread/.test(url) ? "Thread created" : "Reply posted");
              }
            }).catch(function () {});
          }).catch(function () {});
        }
        return p;
      };
    }
  }
  function decorateYou(root) {
    var mine = load(YOU_KEY);
    if (!mine.length) { return; }
    var posts = (root || document).querySelectorAll(".innerPost, .innerOP");
    for (var i = 0; i < posts.length; i++) {
      var id = postId(posts[i]);
      if (id && mine.indexOf(id) > -1) { posts[i].classList.add("rchan-you"); }
    }
    var quotes = (root || document).querySelectorAll(".quoteLink");
    for (var j = 0; j < quotes.length; j++) {
      var a = quotes[j];
      if (a.getAttribute("data-you")) { continue; }
      var m = (a.getAttribute("href") || "").match(/#(?:q)?(\d+)/) || (a.textContent || "").match(/(\d+)/);
      if (m && mine.indexOf(m[1]) > -1) {
        a.setAttribute("data-you", "1");
        a.appendChild(document.createTextNode(" (You)"));
      }
    }
  }

  /* ---------- Image hover-zoom ---------- */
  var zoom = null;
  function isImg(h) { return /\.(jpe?g|png|gif|webp|bmp)$/i.test(h || ""); }
  function hideZoom() { if (zoom) { zoom.style.display = "none"; zoom.src = ""; } }
  // True when this <img> is LynxChan's already-expanded inline full image (click-to-expand
  // appends <img class="imgExpanded"> and hides the thumb). Don't float a duplicate over it.
  function isExpanded(img, a) {
    if (img.classList && img.classList.contains("imgExpanded")) { return true; }
    if (a && a.querySelector) {
      var exp = a.querySelector(".imgExpanded");
      if (exp && exp.style.display !== "none") { return true; }
    }
    return false;
  }
  // Full-image URL for a hovered thumbnail. Thread/index: the imgLink href IS the file.
  // Catalog: the linkThumb href points at the thread, so derive the file from the thumb
  // src (/.media/t_<hash>) plus the cell's data-filemime (/.media/<hash>.<ext>).
  var MIME_EXT = { "image/jpeg": "jpg", "image/pjpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp" };
  function resolveFull(img, a, href) {
    if (isImg(href)) { return href; }
    if (a && a.classList && a.classList.contains("linkThumb")) {
      var ext = MIME_EXT[(a.getAttribute("data-filemime") || "").toLowerCase()];
      var m = (img.getAttribute("src") || "").match(/\/\.media\/t_([a-z0-9]+)$/i);
      if (ext && m) { return "/.media/" + m[1] + "." + ext; }
    }
    return null;
  }
  function onOver(e) {
    if (!setOn("hoverzoom")) { return; }
    var img = e.target;
    if (!img || img.tagName !== "IMG") { return; }
    var a = (img.closest && img.closest("a")) || img.parentNode;
    var href = a && a.getAttribute ? a.getAttribute("href") : null;
    var full = resolveFull(img, a, href);
    if (!full || isExpanded(img, a)) { hideZoom(); return; }
    if (!zoom) { zoom = document.createElement("img"); zoom.id = "rchan-zoom"; document.body.appendChild(zoom); }
    zoom.src = full; zoom.style.display = "block"; onMove(e);
  }
  // Position a floating preview element (image or video) next to the cursor,
  // flipping sides / clamping so it stays on-screen.
  function placeFloat(el, e) {
    var pad = 16, x = e.clientX + pad, y = e.clientY + pad;
    if (x + el.offsetWidth > window.innerWidth) { x = e.clientX - el.offsetWidth - pad; }
    if (y + el.offsetHeight > window.innerHeight) { y = Math.max(4, window.innerHeight - el.offsetHeight - 4); }
    el.style.left = Math.max(4, x) + "px"; el.style.top = Math.max(4, y) + "px";
  }
  function onMove(e) {
    if (zoom && zoom.style.display === "block") { placeFloat(zoom, e); }
    if (vidzoom && vidzoom.style.display === "block") { placeFloat(vidzoom, e); }
  }
  function onOut(e) { if (e.target && e.target.tagName === "IMG") { hideZoom(); } }

  /* ---------- Video: floating autoplay pop-out on hover (mirrors image zoom) ----------
   * NOTE: LynxChan's native thumbs.js (setPlayer) rewrites every video/audio thumbnail at
   * load: it REMOVES the original <a class="imgLink" data-filemime="video/…"> and replaces
   * it with <span><a class="hideLink"/><video controls/><a href="/.media/x.mp4"><img
   * class="imgLink"></a></span>. So after load the anchor has NO imgLink class and NO
   * data-filemime — the only reliable signal is the anchor href's video extension. Catalog
   * (linkThumb) is NOT processed by thumbs.js, so it keeps data-filemime + a thread href. */
  var VID_EXT = { "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogg" };
  var VID_RE = /\.(mp4|webm|ogg)(?:\?|#|$)/i;
  var vidzoom = null;
  // Resolve the playable video URL for a hovered thumbnail <img>, or null if it isn't a video.
  function videoUrlFor(img) {
    var a = img.closest ? img.closest("a[href]") : null;
    if (!a) { return null; }
    var href = a.getAttribute("href") || "";
    if (VID_RE.test(href)) {                                       // thread/index (incl. native-processed)
      // .ogg/.webm can be audio; native setPlayer builds an <audio> sibling for those — skip them.
      var box = a.parentNode;
      if (box && box.getElementsByTagName && box.getElementsByTagName("audio").length) { return null; }
      return { a: a, url: href };
    }
    if (a.classList.contains("linkThumb")) {                       // catalog: derive from thumb src + mime
      var mime = (a.getAttribute("data-filemime") || "").toLowerCase();
      var ext = VID_EXT[mime];
      var m = (img.getAttribute("src") || "").match(/\/\.media\/t_([a-z0-9]+)$/i);
      if (/^video\//.test(mime) && ext && m) { return { a: a, url: "/.media/" + m[1] + "." + ext }; }
    }
    return null;
  }
  function hideVidZoom() {
    if (!vidzoom) { return; }
    try { vidzoom.pause(); } catch (e) {}
    vidzoom.style.display = "none";
    vidzoom.removeAttribute("src"); vidzoom.load();   // stop buffering the file
  }
  function onVidOver(e) {
    if (!setOn("vidpop")) { return; }
    var img = e.target;
    if (!img || img.tagName !== "IMG") { return; }     // only the thumbnail image, like image-zoom
    var info = videoUrlFor(img); if (!info) { return; }
    var a = info.a, url = info.url;
    if (!vidzoom) {
      vidzoom = document.createElement("video");
      vidzoom.id = "rchan-vidzoom";
      vidzoom.muted = true; vidzoom.loop = true; vidzoom.autoplay = true; vidzoom.playsInline = true;
      vidzoom.setAttribute("muted", ""); vidzoom.setAttribute("playsinline", "");
      document.body.appendChild(vidzoom);
      // once dimensions are known, size to the video (capped to viewport) unless already sized from data-*
      vidzoom.addEventListener("loadedmetadata", function () {
        if (vidzoom.dataset.sized === "1" || !vidzoom.videoWidth) { return; }
        var s2 = Math.min(window.innerWidth * 0.9 / vidzoom.videoWidth, window.innerHeight * 0.9 / vidzoom.videoHeight, 1);
        vidzoom.style.width = Math.round(vidzoom.videoWidth * s2) + "px";
        vidzoom.style.height = Math.round(vidzoom.videoHeight * s2) + "px";
      });
    }
    if (vidzoom.getAttribute("src") !== url) { vidzoom.src = url; }
    // Size immediately from data-file dims when the anchor still carries them (catalog / unprocessed);
    // otherwise clear and let loadedmetadata size it. Either way it's capped by CSS max-width/height.
    var nw = parseInt(a.getAttribute("data-filewidth"), 10) || 0, nh = parseInt(a.getAttribute("data-fileheight"), 10) || 0;
    if (nw && nh) {
      var s = Math.min(window.innerWidth * 0.9 / nw, window.innerHeight * 0.9 / nh, 1);
      vidzoom.style.width = Math.round(nw * s) + "px"; vidzoom.style.height = Math.round(nh * s) + "px";
      vidzoom.dataset.sized = "1";
    } else { vidzoom.style.width = ""; vidzoom.style.height = ""; vidzoom.dataset.sized = "0"; }
    // opt-in sound on the hover preview; volume follows the site-wide saved level
    var snd = setOn("vidpopsound", false);
    vidzoom.muted = !snd;
    if (snd) {
      var sv = loadVol();
      try { vidzoom.volume = (sv && typeof sv.v === "number") ? sv.v : 0.5; } catch (e2) {}
    }
    vidzoom.style.display = "block";
    var p = vidzoom.play(); if (p && p.catch) { p.catch(function () {}); }
    placeFloat(vidzoom, e);
  }
  function onVidOut(e) { if (e.target && e.target.tagName === "IMG") { hideVidZoom(); } }

  /* ---------- Video QoL: volume + mute persist site-wide ----------
     The engine's players forget volume on every page. Remember the last
     volume/mute the user set on any native player and apply it the first
     time each player starts. (The hover pop-out is excluded: it manages
     its own muted state via the "Sound on video hover" setting.) */
  var VOL_KEY = "rchan_vol";
  function loadVol() { try { return JSON.parse(localStorage.getItem(VOL_KEY) || "null"); } catch (e) { return null; } }
  function hookVolumePersistence() {
    document.addEventListener("volumechange", function (e) {
      var el = e.target;
      if (!el || (el.tagName !== "VIDEO" && el.tagName !== "AUDIO") || el.id === "rchan-vidzoom") { return; }
      if (!el.__rchanVol) { return; }                  // ignore our own initial application
      try { localStorage.setItem(VOL_KEY, JSON.stringify({ v: el.volume, m: el.muted })); } catch (e2) {}
    }, true);
    document.addEventListener("play", function (e) {
      var el = e.target;
      if (!el || (el.tagName !== "VIDEO" && el.tagName !== "AUDIO") || el.id === "rchan-vidzoom") { return; }
      if (el.__rchanVol) { return; }
      var s = loadVol();
      if (s && typeof s.v === "number") { try { el.volume = s.v; el.muted = !!s.m; } catch (e2) {} }
      el.__rchanVol = true;                            // set AFTER applying: the apply above must not persist
    }, true);
  }

  /* ---------- qr.showQr patch: greentext EVERY line of the selection ----------
     Native showQr already appends the selection but only prefixes '>' on the
     first line; re-implement with per-line greentext (same side effects). */
  function patchShowQr() {
    var q = window.qr;
    if (!q || !q.showQr || q.__rchanShowQr) { return; }
    q.__rchanShowQr = true;
    q.showQr = function (quote) {
      q.qrPanel.style.display = "block";
      if (q.qrPanel.getBoundingClientRect().top < 0) { q.qrPanel.style.top = "25px"; }
      var body = document.getElementById("qrbody");
      var field = document.getElementById("fieldMessage");
      if (!body) { return; }
      var txt = ">>" + quote + "\n";
      var sel = String(window.getSelection() || "");
      if (sel.trim()) {
        txt += sel.replace(/\r/g, "").split("\n").map(function (l) { return ">" + l; }).join("\n") + "\n";
      }
      body.value += txt;
      if (field) { field.value = body.value; }
      body.dispatchEvent(new Event("input", { bubbles: true }));   // char counters + draft
      try { if (window.postCommon && postCommon.updateCurrentChar) { postCommon.updateCurrentChar(); } } catch (e) {}
      body.focus();
    };
  }

  /* ---------- Inline quote expansion: click a >>quote to embed the post ----------
     Plain left-click on a quoteLink/backlink toggles the quoted post inline
     (4chan-X style) instead of jumping. Reuses tooltips.js's loadedContent
     cache + loadQuote fetcher (its checkHeight() sets style.top, which is a
     no-op on a static-positioned div). Modified clicks (ctrl/middle/…) keep
     native navigation. This is also how touch users read quote chains. */
  function onQuoteClick(e) {
    if (!setOn("inlinequote")) { return; }             // off: native jump
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) { return; }
    var a = e.target && e.target.closest ? e.target.closest(".quoteLink, .panelBacklinks a") : null;
    if (!a || a.closest(".quoteTooltip")) { return; }         // inside a hover preview: leave native
    var open = a.__rchanInline;
    if (open) {                                               // toggle closed
      e.preventDefault(); e.stopPropagation();
      if (open.parentNode) { open.parentNode.removeChild(open); }
      a.__rchanInline = null; a.classList.remove("rchan-inlined");
      return;
    }
    var tt = window.tooltips;
    if (!tt || (!tt.loadedContent && !tt.loadQuote)) { return; }  // no machinery: native jump
    e.preventDefault(); e.stopPropagation();
    // touch fires mouseenter (spawning the hover tooltip) with no mouseout to
    // clean it up — drop any lingering hover previews before expanding inline
    var tips = document.getElementsByClassName("quoteTooltip");
    for (var i = tips.length - 1; i >= 0; i--) { tips[i].remove(); }
    var box = document.createElement("div");
    box.className = "rchan-inline-quote";
    var url = a.href;
    if (tt.loadedContent && tt.loadedContent[url]) {
      box.innerHTML = tt.loadedContent[url];
    } else {
      box.textContent = "Loading…";
      try { tt.loadQuote(box, url); } catch (err) { box.textContent = "Couldn't load post."; }
    }
    a.parentNode.insertBefore(box, a.nextSibling);
    a.__rchanInline = box; a.classList.add("rchan-inlined");
  }

  /* ---------- Relative timestamps, default ON (native supports it, opt-in) ----------
     posting.js honours localStorage.relativeTime/localTime but only reads them
     during ITS init, which ran before this script. Default both on for users
     who never touched the setting (settings menu still overrides), and apply
     immediately on this page load. */
  var relTimer = null;
  function enableRelativeTimes() {
    try {
      if (localStorage.relativeTime === undefined) { localStorage.relativeTime = "true"; }
      if (localStorage.localTime === undefined) { localStorage.localTime = "true"; }
      var P = window.posting;
      if (!P || !P.updateAllRelativeTimes || !JSON.parse(localStorage.relativeTime)) { return; }
      if (!P.localTimes && JSON.parse(localStorage.localTime)) {
        var times = document.getElementsByClassName("labelCreated");
        for (var i = 0; i < times.length; i++) { try { P.setLocalTime(times[i]); } catch (e1) {} }
        P.localTimes = true;
      }
      P.updateAllRelativeTimes();
      if (!relTimer) { relTimer = setInterval(function () { try { P.updateAllRelativeTimes(); } catch (e2) {} }, 60000); }
    } catch (e) {}
  }

  /* ---------- Keyboard shortcuts ---------- */
  function typing(e) {
    var t = e.target, g = t && t.tagName;
    return g === "INPUT" || g === "TEXTAREA" || g === "SELECT" || (t && t.isContentEditable);
  }
  // j/k: step through posts (vim-style). First press selects the post at the
  // top of the viewport; after that, steps from the selection — unless you
  // scrolled it offscreen, in which case it re-syncs to where you're looking.
  var kbCurEl = null;
  function kbSelect(el) {
    if (kbCurEl && kbCurEl.classList) { kbCurEl.classList.remove("rchan-kbcur"); }
    kbCurEl = el;
    el.classList.add("rchan-kbcur");
    try { el.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {}
  }
  function navPosts(dir) {
    var list = Array.prototype.slice.call(document.querySelectorAll(".opCell, .postCell"));
    if (!list.length) { return; }
    var idx = -1;
    if (kbCurEl && document.contains(kbCurEl)) {
      var r = kbCurEl.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) { idx = list.indexOf(kbCurEl); }
    }
    if (idx < 0) {                                       // no live selection: sync to viewport
      for (var i = 0; i < list.length; i++) {
        var rr = list[i].getBoundingClientRect();
        if (rr.bottom > 60) { idx = i; break; }          // first post not scrolled past
      }
      if (idx < 0) { idx = list.length - 1; }
      kbSelect(list[idx]);                               // first press = select, don't step
      return;
    }
    kbSelect(list[Math.max(0, Math.min(list.length - 1, idx + dir))]);
  }
  /* ---------- Media keyboard nav: e expands, ←/→ step file posts, Esc collapses ----------
     Rides the j/k selection. Expansion goes through the NATIVE anchor click
     (thumbs.expandImage), so state stays consistent with mouse use. */
  function findImgLink(cell) {
    var inner = cell.querySelector(".innerPost, .innerOP") || cell;   // own content, not nested replies
    var links = inner.querySelectorAll("a.imgLink");
    for (var i = 0; i < links.length; i++) {
      if (isImg(links[i].getAttribute("href") || "")) { return links[i]; }
    }
    return null;
  }
  function navFilePosts(dir) {
    var list = Array.prototype.slice.call(document.querySelectorAll(".opCell, .postCell"))
      .filter(function (c) { return !!findImgLink(c); });
    if (!list.length) { return; }
    var idx = -1;
    if (kbCurEl && document.contains(kbCurEl)) {
      var r = kbCurEl.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) { idx = list.indexOf(kbCurEl); }
    }
    if (idx < 0) {                                       // no live selection: sync to viewport
      for (var i = 0; i < list.length; i++) {
        var rr = list[i].getBoundingClientRect();
        if (rr.bottom > 60) { idx = i; break; }
      }
      if (idx < 0) { idx = list.length - 1; }
      kbSelect(list[idx]);
      return;
    }
    kbSelect(list[Math.max(0, Math.min(list.length - 1, idx + dir))]);
  }
  function toggleKbExpand() {
    if (!kbCurEl || !document.contains(kbCurEl)) { navFilePosts(1); }
    if (!kbCurEl) { return; }
    var a = findImgLink(kbCurEl);
    if (a) { a.click(); }                                // native expandImage toggles
  }
  // "Expand all images" toggle (thread pages; button rides the nav)
  var expandAllOn = false;
  function setExpandAll(on) {
    expandAllOn = on;
    var links = document.querySelectorAll("a.imgLink");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (!isImg(a.getAttribute("href") || "")) { continue; }
      if (a.closest && a.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var exp = a.querySelector(".imgExpanded");
      var isOpen = !!(exp && exp.style.display !== "none");
      if (on !== isOpen) { a.click(); }
    }
    var b = document.getElementById("rchan-expandbtn");
    if (b) { b.classList.toggle("rchan-on2", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
  }
  var SVG_EXPAND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10L21 11z"/></svg>';
  function buildExpandButton() {
    if (!curThreadId() || document.getElementById("rchan-expandbtn")) { return; }
    var nav = document.querySelector("nav, #dynamicHeader");
    if (!nav) { return; }
    var b = document.createElement("button");
    b.type = "button"; b.id = "rchan-expandbtn";
    b.innerHTML = SVG_EXPAND;
    b.setAttribute("data-tooltip", "Expand all images");
    b.setAttribute("aria-label", "Expand all images");
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () { setExpandAll(!expandAllOn); });
    nav.insertBefore(b, document.getElementById("rchan-findbtn") || document.getElementById("navOptionsSpan") || null);
  }

  function onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) { return; }
    if (e.key === "?") { toggleKeysOverlay(); e.preventDefault(); return; }   // always available
    if (!setOn("keys")) { return; }
    if (e.key === "t") { window.scrollTo({ top: 0, behavior: SB }); }
    else if (e.key === "b") { window.scrollTo({ top: document.body.scrollHeight, behavior: SB }); }
    else if (e.key === "c") { toggleCatalog(); }
    else if (e.key === "j") { navPosts(1); e.preventDefault(); }
    else if (e.key === "k") { navPosts(-1); e.preventDefault(); }
    else if (e.key === "r") {
      var m = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
      if (m) { m.focus(); e.preventDefault(); }
    }
    else if (e.key === "f") { toggleFind(); e.preventDefault(); }
    else if (e.key === "e") { toggleKbExpand(); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (window.gallery && gallery.viewingGallery) { return; }   // native gallery owns the arrows
      navFilePosts(e.key === "ArrowRight" ? 1 : -1);
      e.preventDefault();
    }
  }

  /* ---------- Catalog toolbar: Index Sort + Size + View (persisted) + prefetch ----------
     Sort keys come from /<board>/catalog.json, fetched ONCE and mapped by threadId
     (lastBump, pinned, postCount, fileCount). "Last reply", "Last long reply" and
     "Posts per minute" need reply timestamps/lengths + OP creation, which the
     catalog payload does NOT expose — those modes lazily fetch /res/<id>.json once
     per thread on first use (cached). "Creation date" uses threadId (monotonic).
     Pinned threads always sort first. All modes descending, ties: newest first. */
  var CAT_KEY = "rchan_catsize", CAT_SIZES = ["small", "large"], CAT_NAMES = { small: "Small", large: "Large" };
  var CAT_CLASS = { small: "rchan-cat-s", large: "rchan-cat-l" };
  var SORT_KEY = "rchan_catsort";
  var SORT_MODES = ["bump", "lastreply", "longreply", "new", "replies", "images", "ppm"];
  var SORT_NAMES = { bump: "Bump order", lastreply: "Last reply", longreply: "Last long reply",
                     "new": "Creation date", replies: "Reply count", images: "File count", ppm: "Posts per minute" };
  var VIEW_MODES = ["catalog", "index"], VIEW_NAMES = { catalog: "Catalog", index: "Index" };
  var LONG_REPLY_MIN = 400;   // chars — what counts as a "real" reply for Last long reply
  function applyCatSize(sz) {
    if (sz === "s" || sz === "m") { sz = "small"; }            // migrate old s/m/l/xl values
    if (sz === "l" || sz === "xl" || CAT_SIZES.indexOf(sz) < 0) { sz = "large"; }
    document.body.classList.remove("rchan-cat-s", "rchan-cat-m", "rchan-cat-l", "rchan-cat-xl");
    document.body.classList.add(CAT_CLASS[sz]);
    return sz;
  }
  var catalogOrig = null, catMeta = null, catDetails = {};
  function catCells() { var t = document.getElementById("divThreads"); return t ? Array.prototype.slice.call(t.getElementsByClassName("catalogCell")) : []; }
  function catNum(cell, cls) { var e = cell.getElementsByClassName(cls)[0]; return e ? (parseInt((e.textContent || "").replace(/\D/g, ""), 10) || 0) : 0; }
  function catThreadId(cell) { var a = cell.getElementsByClassName("linkThumb")[0]; var m = a && (a.getAttribute("href") || "").match(/\/res\/(\d+)/); return m ? parseInt(m[1], 10) : 0; }
  function loadCatMeta(done) {                                 // one catalog.json fetch per page load
    if (catMeta) { if (done) { done(); } return; }
    var b = getBoard(); if (!b) { return; }
    fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); }).then(function (list) {
      catMeta = {};
      (list || []).forEach(function (t) {
        catMeta[t.threadId] = { bump: Date.parse(t.lastBump) || 0, pinned: !!t.pinned,
                                posts: t.postCount || 0, files: t.fileCount || 0 };
      });
      if (done) { done(); }
    }).catch(function () { catMeta = {}; if (done) { done(); } });   // no JSON -> DOM-count fallbacks
  }
  function loadCatDetail(b, id) {                              // per-thread detail for the 3 deep modes
    return fetch("/" + b + "/res/" + id + ".json").then(function (r) { return r.json(); }).then(function (d) {
      var posts = d.posts || [];
      var creation = Date.parse(d.creation) || 0;
      var lastReply = posts.length ? (Date.parse(posts[posts.length - 1].creation) || 0) : creation;
      var lastLong = creation;                                 // fallback: thread creation
      for (var i = posts.length - 1; i >= 0; i--) {
        if (((posts[i].message) || "").length >= LONG_REPLY_MIN) { lastLong = Date.parse(posts[i].creation) || 0; break; }
      }
      catDetails[id] = { lastReply: lastReply, lastLong: lastLong, creation: creation, replies: posts.length };
    }).catch(function () { catDetails[id] = { lastReply: 0, lastLong: 0, creation: 0, replies: 0 }; });
  }
  function sortCatalog(mode) {
    var t = document.getElementById("divThreads"); if (!t) { return; }
    var cells = catCells(); if (!cells.length) { return; }
    if (!catalogOrig) { catalogOrig = cells.slice(); }         // capture bump (server) order once
    var needsDetail = mode === "lastreply" || mode === "longreply" || mode === "ppm";
    if (needsDetail) {
      var b = getBoard();
      var missing = cells.map(catThreadId).filter(function (id) { return id && !catDetails[id]; });
      if (missing.length) {                                    // fetch once, then re-enter
        Promise.all(missing.map(function (id) { return loadCatDetail(b, id); }))
          .then(function () { sortCatalog(mode); });
        return;
      }
    }
    function keyOf(cell) {
      var id = catThreadId(cell);
      var m = (catMeta && catMeta[id]) || null, d = catDetails[id] || null;
      switch (mode) {
        case "lastreply": return d ? d.lastReply : 0;
        case "longreply": return d ? d.lastLong : 0;
        case "new":       return id;                           // threadIds are monotonic = creation order
        case "replies":   return m ? m.posts : catNum(cell, "labelReplies");
        case "images":    return m ? m.files : catNum(cell, "labelImages");
        case "ppm":
          var reps = m ? m.posts : catNum(cell, "labelReplies");
          var mins = d && d.creation ? Math.max(1, (Date.now() - d.creation) / 60000) : 0;
          return mins ? reps / mins : 0;
        default:          return m ? m.bump : 0;               // bump order
      }
    }
    var s;
    if (mode === "bump" && !(catMeta && Object.keys(catMeta).length)) {
      s = catalogOrig.filter(function (c) { return c.parentNode === t; });   // server order fallback
    } else {
      s = cells.slice().sort(function (a, b2) {
        var ia = catThreadId(a), ib = catThreadId(b2);
        var pa = catMeta && catMeta[ia] && catMeta[ia].pinned ? 1 : 0;
        var pb = catMeta && catMeta[ib] && catMeta[ib].pinned ? 1 : 0;
        if (pa !== pb) { return pb - pa; }                     // pinned always on top
        var ka = keyOf(a), kb = keyOf(b2);
        if (kb !== ka) { return kb - ka; }                     // descending
        return ib - ia;                                        // tie-break: newest thread first
      });
    }
    s.forEach(function (c) { t.appendChild(c); });             // appendChild moves existing nodes → reorders
  }
  function mkSelect(id, label, modes, names, cur, onChange) {
    var s = document.createElement("select"); s.id = id;
    var head = document.createElement("option");         // greyed-out label inside the dropdown
    head.textContent = label; head.disabled = true;
    s.appendChild(head);
    for (var i = 0; i < modes.length; i++) {
      var o = document.createElement("option"); o.value = modes[i]; o.textContent = names[modes[i]];
      if (modes[i] === cur) { o.selected = true; } s.appendChild(o);
    }
    s.addEventListener("change", function () { onChange(s.value); });
    var l = document.createElement("label"); l.appendChild(s); return l;
  }
  function buildCatalogTools() {
    if (!isCatalog()) { return; }
    var curSize = applyCatSize(localStorage.getItem(CAT_KEY) || "large");
    var curSort = localStorage.getItem(SORT_KEY) || "bump";
    if (SORT_MODES.indexOf(curSort) < 0) { curSort = "bump"; }
    loadCatMeta(function () { if (curSort !== "bump") { sortCatalog(curSort); } });
    var threads = document.getElementById("divThreads");
    if (!threads || document.getElementById("rchan-cattools")) { return; }
    var bar = document.createElement("div"); bar.id = "rchan-cattools";
    bar.appendChild(mkSelect("rchan-catsort", "Index Sort", SORT_MODES, SORT_NAMES, curSort, function (v) { localStorage.setItem(SORT_KEY, v); sortCatalog(v); }));
    bar.appendChild(mkSelect("rchan-catsize", "Size", CAT_SIZES, CAT_NAMES, curSize, function (v) { localStorage.setItem(CAT_KEY, v); applyCatSize(v); }));
    // "Index" = the REAL old-school board index (OP + last replies, pages) at
    // /<board>/?index — not a CSS re-layout of the catalog cells. Remember the
    // choice as the preferred board landing view (same cookie toggleCatalog sets).
    bar.appendChild(mkSelect("rchan-catview", "View", VIEW_MODES, VIEW_NAMES, "catalog", function (v) {
      if (v !== "index") { return; }
      var b = getBoard(); if (!b) { return; }
      try { document.cookie = "rchan_view=index; path=/; max-age=31536000; SameSite=Lax"; } catch (e) {}
      location.href = "/" + b + "/?index";
    }));
    threads.parentNode.insertBefore(bar, threads);
  }
  /* ---------- Deep search: reply-level search across the whole board ----------
     Native catalog search only sees OP subject/message. On a small board the
     client can afford what big boards need servers for: fetch every
     res/<id>.json once (cached for the page's life) and match the term
     against EVERY reply's name/message/filenames. Wraps catalog.search, so
     the native input listener drives both paths; with deep on, matching
     hides/shows the existing DOM cells (sort order + badges survive). */
  var DEEP_KEY = "rchan_deepsearch", deepCache = {}, deepNote = null;
  function deepEnabled() { try { return localStorage.getItem(DEEP_KEY) === "1"; } catch (e) { return false; } }
  function deepText(d) {
    var parts = [];
    function one(p) {
      parts.push(p.subject || "", p.name || "", p.message || "");
      (p.files || []).forEach(function (f) { parts.push(f.originalName || ""); });
    }
    one(d);
    (d.posts || []).forEach(one);
    return parts.join(" ").toLowerCase();
  }
  function ensureDeepData(ids, done) {
    var b = getBoard();
    var missing = ids.filter(function (id) { return id && deepCache[id] == null; });
    if (!missing.length) { done(); return; }
    if (deepNote) { deepNote.textContent = "fetching " + missing.length + " thread" + (missing.length > 1 ? "s" : "") + "…"; }
    Promise.all(missing.map(function (id) {
      return fetch("/" + b + "/res/" + id + ".json")
        .then(function (r) { return r.json(); })
        .then(function (d) { deepCache[id] = deepText(d); })
        .catch(function () { deepCache[id] = ""; });
    })).then(done);
  }
  function applyDeepSearch() {                          // true = deep handled this search
    var field = document.getElementById("catalogSearchField");
    if (!field) { return false; }
    var term = field.value.trim().toLowerCase();
    var cells = catCells();
    if (!deepEnabled() || !term) {
      for (var i = 0; i < cells.length; i++) { cells[i].classList.remove("rchan-deephide"); }
      if (deepNote) { deepNote.textContent = ""; }
      return false;
    }
    ensureDeepData(cells.map(catThreadId), function () {
      var shown = 0;
      cells.forEach(function (cell) {
        var hit = (deepCache[catThreadId(cell)] || "").indexOf(term) > -1;
        cell.classList.toggle("rchan-deephide", !hit);
        if (hit) { shown++; }
      });
      if (deepNote) { deepNote.textContent = shown + "/" + cells.length + " threads match"; }
    });
    return true;
  }
  function hookDeepSearch() {
    if (!isCatalog()) { return; }
    var field = document.getElementById("catalogSearchField");
    if (!field || document.getElementById("rchan-deeplab")) { return; }
    var lab = document.createElement("label"); lab.id = "rchan-deeplab";
    lab.setAttribute("data-tooltip", "Search inside every thread's replies, not just OPs");
    var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = deepEnabled();
    cb.setAttribute("aria-label", "Deep search: match inside replies too");
    lab.appendChild(cb); lab.appendChild(document.createTextNode("deep"));
    deepNote = document.createElement("span"); deepNote.id = "rchan-deepnote";
    field.parentNode.insertBefore(lab, field.nextSibling);
    lab.parentNode.insertBefore(deepNote, lab.nextSibling);
    cb.addEventListener("change", function () {
      try { localStorage.setItem(DEEP_KEY, cb.checked ? "1" : "0"); } catch (e) {}
      if (!applyDeepSearch() && window.catalog && catalog.search) {
        try { catalog.search(); } catch (e2) {}
      }
    });
    if (window.catalog && catalog.search && !catalog.__rchanDeep) {
      catalog.__rchanDeep = true;
      var orig = catalog.search;
      catalog.search = function () {
        if (applyDeepSearch()) { return; }              // deep handled it
        return orig.apply(this, arguments);
      };
    }
  }

  // prefetch a thread page when hovering its catalog cell (snappier open)
  var prefetched = {};
  function onCatHover(e) {
    var a = e.target && e.target.closest ? e.target.closest("a.linkThumb") : null;
    if (!a) { return; }
    var href = a.getAttribute("href");
    if (!href || prefetched[href]) { return; }
    prefetched[href] = 1;
    var l = document.createElement("link"); l.rel = "prefetch"; l.href = href; document.head.appendChild(l);
  }

  /* ---------- Catalog: last-replies hover preview (native 4chan catalog style) ----------
     Hovering a catalog cell shows the thread's last 5 replies in a floating panel,
     fetched once from /<board>/res/<id>.json and cached. The panel is
     pointer-events:none, so mouseout handling stays trivial. */
  var catPrev = null, catPrevFor = null, catPrevCache = {};
  function escHtml(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
  function hideCatPreview() { if (catPrev) { catPrev.style.display = "none"; } catPrevFor = null; }
  var TOUCH_ONLY = !!(window.matchMedia && matchMedia("(hover: none)").matches);
  function renderCatPreview(cell, data) {
    if (!catPrev) { catPrev = document.createElement("div"); catPrev.id = "rchan-catprev"; document.body.appendChild(catPrev); }
    var posts = (data.posts || []).slice(-5);
    var html = "";
    if (!posts.length) { html = '<div class="rchan-catprev-empty">No replies yet</div>'; }
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      html += '<div class="rchan-catprev-post"><span class="rchan-catprev-name">' +
        escHtml(p.name || "Anonymous") + '</span> <span class="rchan-catprev-id">No.' + escHtml(String(p.postId)) + '</span>' +
        '<div class="rchan-catprev-msg">' + (p.markdown || "") + '</div></div>';   // markdown = engine-sanitised HTML
    }
    catPrev.innerHTML = html;
    catPrev.style.display = "block";
    if (window.innerWidth < 480) {                 // phones: bottom sheet instead of side panel
      catPrev.classList.add("rchan-catprev-sheet");
      catPrev.style.left = ""; catPrev.style.top = "";
      return;
    }
    catPrev.classList.remove("rchan-catprev-sheet");
    var r = cell.getBoundingClientRect(), w = 360;
    var x = r.right + 8, y = r.top;
    if (x + w > window.innerWidth - 8) { x = Math.max(8, r.left - w - 8); }   // flip to the left edge
    catPrev.style.left = x + "px";
    catPrev.style.top = "0px";                                                 // measure at a stable position
    var h = catPrev.offsetHeight;
    if (y + h > window.innerHeight - 8) { y = Math.max(8, window.innerHeight - h - 8); }
    catPrev.style.top = y + "px";
  }
  function onCatPrevOver(e, fromTap) {
    if (!setOn("catprev")) { return; }
    // touch taps fire a synthesized mouseover BEFORE click; if that path set
    // catPrevFor, the tap handler would think it's the 2nd tap and navigate.
    if (TOUCH_ONLY && !fromTap) { return; }
    if (!isCatalog()) { return; }
    var cell = e.target && e.target.closest ? e.target.closest(".catalogCell") : null;
    if (!cell || catPrevFor === cell) { return; }
    catPrevFor = cell;
    var a = cell.querySelector("a.linkThumb");
    var m = (a && a.getAttribute("href") || "").match(/^\/([^\/]+)\/res\/(\d+)/);
    if (!m) { return; }
    var url = "/" + m[1] + "/res/" + m[2] + ".json";
    if (catPrevCache[url]) { renderCatPreview(cell, catPrevCache[url]); return; }
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      catPrevCache[url] = d;
      if (catPrevFor === cell) { renderCatPreview(cell, d); }
    }).catch(function () {});
  }
  function onCatPrevOut(e) {
    var cell = e.target && e.target.closest ? e.target.closest(".catalogCell") : null;
    if (!cell) { return; }
    var to = e.relatedTarget;
    if (to && cell.contains(to)) { return; }
    hideCatPreview();
  }
  // Touch devices have no hover: first tap on a catalog thumb shows the
  // last-replies preview, second tap (same cell) navigates into the thread.
  // Tapping anywhere else dismisses the preview.
  function onCatTap(e) {
    if (!setOn("catprev")) { return; }                 // previews off: first tap navigates
    if (!TOUCH_ONLY || !isCatalog()) { return; }
    var a = e.target && e.target.closest ? e.target.closest("a.linkThumb") : null;
    if (!a) {
      if (!(e.target.closest && e.target.closest("#rchan-catprev"))) { hideCatPreview(); }
      return;
    }
    var cell = a.closest(".catalogCell");
    if (!cell || catPrevFor === cell) { return; }  // second tap: fall through to navigation
    e.preventDefault(); e.stopPropagation();
    onCatPrevOver(e, true);                        // renders + caches, sets catPrevFor
  }

  /* ---------- Icon tooltips (secondaryBar + nav coloredIcons have no labels) ---------- */
  var ICON_TITLES = {
    linkBack: "Return to board index", linkReturn: "Return to board index",
    linkTop: "Go to top", linkBottom: "Go to bottom",
    navCatalog: "Catalog", linkLogs: "Board logs", linkRss: "RSS feed",
    navLinkHome: "Home", navBoardList: "Board list", navOverboard: "Overboard",
    navPosting: "Posting help", linkManagement: "Board management",
    linkModeration: "Moderate this board", navOptions: "Settings",
    linkAccount: "Your account", linkGlobalManagement: "Global management",
    // native modules that auto-inject their icons (watcher/gallery/favourite/side-catalog)
    watcherButton: "Watch this thread", galleryLink: "Gallery view",
    favouriteButton: "Favourite this board", navSideCatalog: "Toggle side catalog",
    closeWatcherMenuButton: "Close", closeSideCatalogButton: "Close side catalog"
  };
  var CLASS_TITLES = {                          // labelled by class (these have no usable id)
    watchButton: "Watch this thread",
    linkQuote: "Reply — quotes this post",      // clicking a post No. opens Quick Reply with >>N
    nameLink: "Open file",                      // words replaced by SVG icons in ux.css
    hideFileButton: "Hide / show this file"
  };
  function humanizeId(id) {
    var s = id.replace(/^(link|nav)/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }
  function iconLabel(el) {
    if (el.id && ICON_TITLES[el.id]) { return ICON_TITLES[el.id]; }
    for (var k in CLASS_TITLES) { if (el.classList && el.classList.contains(k)) { return CLASS_TITLES[k]; } }
    return el.id ? humanizeId(el.id) : "";
  }
  // side-catalog "Refresh" word -> SVG refresh icon (server-rendered button)
  function decorateSideCatalog() {
    var b = document.getElementById("sideCatalogRefreshButton");
    if (!b || b.getAttribute("data-svg")) { return; }
    b.setAttribute("data-svg", "1");
    b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4l-2.35 2.35z"/></svg>';
    b.setAttribute("data-tooltip", "Refresh side catalog");
    b.setAttribute("aria-label", "Refresh side catalog");
  }
  function decorateIcons(root) {
    var icons = (root || document).querySelectorAll(".coloredIcon, #favouriteButton, .watchButton, .linkQuote, .nameLink, .hideFileButton");
    for (var i = 0; i < icons.length; i++) {
      var a = icons[i];
      if (a.getAttribute("data-tip")) { continue; }
      a.setAttribute("data-tip", "1");
      var t = iconLabel(a);
      if (!t) { continue; }
      a.setAttribute("data-tooltip", t);           // styled tooltip source (no native title)
      if (!a.getAttribute("aria-label")) { a.setAttribute("aria-label", t); }
    }
  }

  /* ---------- Reverse image search links on file rows ---------- */
  var RIS_EXT = /\.(jpe?g|png|gif|webp|bmp)(?:$|\?)/i;
  var RIS_SVCS = [
    ["iqdb", "https://iqdb.org/?url="],
    ["sauce", "https://saucenao.com/search.php?url="],
    ["lens", "https://lens.google.com/uploadbyurl?url="],
    ["tineye", "https://tineye.com/search?url="]
  ];
  function decorateFileSearch(root) {
    var links = (root || document).getElementsByClassName("originalNameLink");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-ris")) { continue; }
      a.setAttribute("data-ris", "1");
      var href = a.getAttribute("href") || "";
      if (!RIS_EXT.test(href)) { continue; }               // images only, not video/audio
      var abs = encodeURIComponent(location.origin + href);
      var s = document.createElement("span");
      s.className = "rchan-ris";
      for (var j = 0; j < RIS_SVCS.length; j++) {
        if (j) { s.appendChild(document.createTextNode(" · ")); }
        var l = document.createElement("a");
        l.href = RIS_SVCS[j][1] + abs;
        l.target = "_blank"; l.rel = "noopener noreferrer";
        l.textContent = RIS_SVCS[j][0];
        s.appendChild(l);
      }
      a.parentNode.appendChild(s);                          // lands after the ")" span
    }
  }

  /* ---------- Instant styled tooltip (any element with data-tooltip) ---------- */
  var tip = null;
  function tipTarget(el) {
    while (el && el.getAttribute) {
      if (el.getAttribute("data-tooltip")) { return el; }
      el = el.parentNode;
    }
    return null;
  }
  function showTip(el) {
    if (!tip) { tip = document.createElement("div"); tip.id = "rchan-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.textContent = el.getAttribute("data-tooltip");
    tip.style.display = "block";
    var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = r.left + r.width / 2 - tw / 2;
    var y = r.bottom + 8;                                   // below the icon by default
    if (y + th > window.innerHeight - 4) { y = r.top - th - 8; }  // flip above if no room
    x = Math.max(4, Math.min(x, window.innerWidth - tw - 4));
    tip.style.left = x + "px"; tip.style.top = Math.max(4, y) + "px";
  }
  function hideTip() { if (tip) { tip.style.display = "none"; } }
  function onTipOver(e) { var el = tipTarget(e.target); if (el) { showTip(el); } }
  function onTipOut(e) {
    var el = tipTarget(e.target);
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) { hideTip(); }
  }

  /* ---------- New-since-last-visit (thread + catalog) + replies-to-you ---------- */
  var SEEN_KEY = "rchan_seen", NOTIFY_KEY = "rchan_notify";
  // Tab-title unread counter: "(3) /rdr/ - thread" while the tab is hidden.
  var baseTitle = document.title, unseenCount = 0;
  function setFavBadge(n) {  // favicon.js exposes the badge compositor
    try { if (window.rchanSetFaviconBadge) { rchanSetFaviconBadge(n); } } catch (e) {}
  }
  function setTitleUnread(n) {                  // absolute count (board pages diff, not accumulate)
    unseenCount = Math.max(0, n | 0);
    document.title = unseenCount ? "(" + unseenCount + ") " + baseTitle : baseTitle;
    setFavBadge(unseenCount);
  }
  function bumpTitleUnread(n) { setTitleUnread(unseenCount + n); }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && unseenCount) { unseenCount = 0; document.title = baseTitle; setFavBadge(0); }
  });
  // "▼ N new" pill when new posts land outside the viewport; hides once seen.
  var newPill = null, pillIO = null, pillTotal = 0;
  function hideNewPill() {
    if (newPill) { newPill.style.display = "none"; }
    if (pillIO) { pillIO.disconnect(); pillIO = null; }
    pillTotal = 0;
  }
  function showNewPill(count, target) {
    pillTotal += count;
    if (!newPill) {
      newPill = document.createElement("button");
      newPill.id = "rchan-newpill"; newPill.type = "button";
      newPill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg><span></span>';
      newPill.addEventListener("click", function () {
        var t = document.getElementById("rchan-newline") || newPill.__target;
        if (t) { try { t.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
        hideNewPill();
      });
      document.body.appendChild(newPill);
    }
    newPill.__target = target;
    newPill.lastChild.textContent = pillTotal + " new post" + (pillTotal > 1 ? "s" : "");
    newPill.style.display = "inline-flex";
    if (window.IntersectionObserver) {
      if (pillIO) { pillIO.disconnect(); }
      pillIO = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { hideNewPill(); return; }
        }
      });
      pillIO.observe(target);
    }
  }
  function seenAll() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { return {}; } }
  function seenSave(o) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e) {} }
  function curThreadId() {
    var t = document.getElementById("threadIdentifier");
    if (t && t.value) { return t.value; }
    var m = location.pathname.match(/\/res\/(\d+)/); return m ? m[1] : null;
  }
  function postIdOf(cell) {
    var q = cell.getElementsByClassName("linkQuote")[0];
    return q ? (parseInt((q.textContent || "").replace(/\D/g, ""), 10) || 0) : 0;
  }
  // Gentle two-note chime for replies quoting your posts (opt-in). WebAudio =
  // CSP-safe, no asset fetch. The context is armed on the first user gesture
  // (autoplay policy: contexts created outside a gesture start suspended).
  var audioCtx = null;
  function armAudio() {
    if (audioCtx) { return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return; }
    try { audioCtx = new AC(); } catch (e) {}
  }
  function youChime() {
    if (!setOn("yousound", false)) { return; }
    try {
      armAudio();
      if (!audioCtx) { return; }
      if (audioCtx.state === "suspended") { audioCtx.resume().catch(function () {}); }
      var t = audioCtx.currentTime;
      [[880, 0], [1174.66, 0.09]].forEach(function (nt) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = nt[0];
        g.gain.setValueAtTime(0.0001, t + nt[1]);
        g.gain.exponentialRampToValueAtTime(0.12, t + nt[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + nt[1] + 0.18);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t + nt[1]); o.stop(t + nt[1] + 0.22);
      });
    } catch (e) {}
  }
  // Does this post's OWN message quote one of my (You) posts?
  function quotesMine(cell, mineSet) {
    var inner = cell.querySelector(".innerPost, .innerOP") || cell;
    var qs = inner.getElementsByClassName("quoteLink");
    for (var j = 0; j < qs.length; j++) {
      if (qs[j].closest && qs[j].closest(".rchan-inline-quote")) { continue; }
      var m = (qs[j].getAttribute("href") || "").match(/(\d+)\s*$/) || (qs[j].textContent || "").match(/(\d+)/);
      if (m && mineSet[m[1]]) { return true; }
    }
    return false;
  }
  // On a thread: highlight posts newer than the last time you viewed it, drop a divider,
  // then record the current high-water mark. Re-runs on live WS posts (highlights those too).
  function markNewInThread() {
    if (isCatalog()) { return; }
    var board = getBoard(), tid = curThreadId();
    if (!board || !tid) { return; }
    var posts = document.getElementsByClassName("postCell");
    if (!posts.length) { return; }
    var key = board + "/" + tid, all = seenAll(), rec = all[key] || { maxId: 0, replies: 0 };
    var curMax = rec.maxId, firstNew = null, newCount = 0, youNew = 0, firstYou = null;
    var mine = load(YOU_KEY), mineSet = {};
    for (var k = 0; k < mine.length; k++) { mineSet[mine[k]] = 1; }
    for (var i = 0; i < posts.length; i++) {
      var id = postIdOf(posts[i]);
      if (id > curMax) { curMax = id; }
      if (rec.maxId && id > rec.maxId && !posts[i].getAttribute("data-new")) {
        posts[i].setAttribute("data-new", "1");
        posts[i].classList.add("rchan-new");
        if (!firstNew) { firstNew = posts[i]; }
        newCount++;
        // not your own fresh post (it lands as "new" too and may quote your earlier posts)
        if (!mineSet[String(id)] && quotesMine(posts[i], mineSet)) {
          youNew++;
          if (!firstYou) { firstYou = posts[i]; }
        }
      }
    }
    if (youNew > 0) { youChime(); }
    if (firstNew && !document.getElementById("rchan-newline")) {
      var d = document.createElement("div"); d.id = "rchan-newline";
      d.textContent = newCount + " new post" + (newCount > 1 ? "s" : "") + " since last visit";
      firstNew.parentNode.insertBefore(d, firstNew);
    }
    all[key] = { maxId: curMax, replies: posts.length };
    seenSave(all);
    if (newCount > 0) {
      if (document.hidden) { bumpTitleUnread(newCount); }
      // pill only when the first new post is fully outside the viewport
      var fr = firstNew.getBoundingClientRect();
      if (fr.top > window.innerHeight || fr.bottom < 0) { showNewPill(newCount, firstNew); }
    }
    // Foreground desktop notification when new posts land while the tab is hidden (opt-in via 🔔).
    // Replies quoting one of YOUR posts get top billing, and clicking the
    // notification deep-links to the first relevant post instead of just focusing.
    if (newCount > 0 && document.hidden && "Notification" in window &&
        Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "1") {
      try {
        var title = youNew > 0
          ? "rchan — " + youNew + " repl" + (youNew > 1 ? "ies" : "y") + " to you"
          : "rchan — " + newCount + " new repl" + (newCount > 1 ? "ies" : "y");
        var target = firstYou || firstNew;
        var n = new Notification(title, {
          body: "/" + board + "/ · " + threadTitle(), icon: "/.rchan/icon-192.png", tag: "rchan-" + board + "-" + tid
        });
        n.onclick = function () {
          window.focus();
          try {
            if (target && document.contains(target)) { target.scrollIntoView({ behavior: SB, block: "center" }); }
          } catch (e2) {}
          this.close();
        };
      } catch (e) {}
    }
  }
  /* Watched threads: the native watcher polls every watched thread's JSON and
     tallies unread into its nav counter — but silently. Wrap the tally so a
     thread that BECOMES unread while this tab is hidden raises a system
     notification (same opt-in as the bell). The first tally after page load
     only seeds the baseline, so navigating around never re-notifies old unread. */
  function hookWatcherNotify() {
    var w = window.watcher;
    if (!w || w.__rchanNotify || !w.updateWatcherCounter) { return; }
    w.__rchanNotify = true;
    var prevUnread = null;
    var orig = w.updateWatcherCounter;
    function unescapeHtml(s) { var d = document.createElement("textarea"); d.innerHTML = s || ""; return d.value; }
    w.updateWatcherCounter = function () {
      var r = orig.apply(this, arguments);
      try {
        var data = JSON.parse(localStorage.watchedData || "{}");
        var unread = {};
        Object.keys(data).forEach(function (b) {
          Object.keys(data[b] || {}).forEach(function (t) {
            var rec = data[b][t];
            if (rec && (rec.lastReplied || 0) > (rec.lastSeen || 0)) { unread[b + "/" + t] = rec; }
          });
        });
        if (prevUnread && document.hidden && "Notification" in window &&
            Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "1") {
          Object.keys(unread).forEach(function (k2) {
            if (prevUnread[k2]) { return; }
            var parts = k2.split("/");
            // the open thread notifies with full context via markNewInThread — skip it here
            if (parts[0] === getBoard() && parts[1] === curThreadId()) { return; }
            try {
              var n = new Notification("rchan — watched thread updated", {
                body: (unread[k2].label ? unescapeHtml(unread[k2].label) + " · " : "") + "/" + parts[0] + "/ · thread " + parts[1],
                icon: "/.rchan/icon-192.png", tag: "rchan-watch-" + k2
              });
              n.onclick = function () {
                window.focus();
                try { location.href = "/" + parts[0] + "/res/" + parts[1]; } catch (e3) {}
                this.close();
              };
            } catch (e2) {}
          });
        }
        prevUnread = unread;
      } catch (e) {}
      return r;
    };
  }
  // On the catalog: badge threads that gained replies since you last opened them.
  function markNewInCatalog() {
    if (!isCatalog()) { return; }
    var board = getBoard(); if (!board) { return; }
    var all = seenAll(), cells = catCells();
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.getAttribute("data-newbadge")) { continue; }
      var tid = catThreadId(cell); if (!tid) { continue; }
      cell.setAttribute("data-newbadge", "1");
      var rec = all[board + "/" + tid]; if (!rec) { continue; }
      var diff = catNum(cell, "labelReplies") - (rec.replies || 0);
      if (diff > 0) {
        var b = document.createElement("span"); b.className = "rchan-newbadge"; b.textContent = "+" + diff + " new";
        var stats = cell.getElementsByClassName("threadStats")[0] || cell;
        stats.appendChild(b);
      }
    }
  }
  // Replies to your (You) posts: a floating indicator that cycles through them.
  var youHits = [], youIdx = -1, youBtn = null;
  function scanRepliesToYou() {
    var mine = load(YOU_KEY); if (!mine.length) { if (youBtn) { youBtn.style.display = "none"; } return; }
    var set = {}; for (var k = 0; k < mine.length; k++) { set[mine[k]] = 1; }
    var posts = document.querySelectorAll(".postCell, .opCell");
    youHits = [];
    for (var i = 0; i < posts.length; i++) {
      // Scope to the cell's OWN message container: the opCell CONTAINS every
      // reply postCell (.divPosts), so scanning the whole cell counted each
      // reply's quotes AGAIN for the OP — inflating the count.
      var inner = posts[i].querySelector(".innerPost, .innerOP, .markedPost");
      if (!inner || set[postId(inner)]) { continue; }               // missing / your own post
      var qs = inner.getElementsByClassName("quoteLink");
      for (var j = 0; j < qs.length; j++) {
        if (qs[j].closest && qs[j].closest(".rchan-inline-quote")) { continue; }  // embedded copy, not this post's quote
        var m = (qs[j].getAttribute("href") || "").match(/(\d+)\s*$/) || (qs[j].textContent || "").match(/(\d+)/);
        if (m && set[m[1]]) { youHits.push(posts[i]); break; }
      }
    }
    if (!youHits.length) { if (youBtn) { youBtn.style.display = "none"; } return; }
    if (!youBtn) {
      youBtn = document.createElement("button"); youBtn.id = "rchan-youbtn"; youBtn.type = "button";
      youBtn.title = "Jump to replies to your posts";
      youBtn.setAttribute("aria-label", "Jump to replies to your posts");
      youBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg><span></span>';
      youBtn.addEventListener("click", function () {
        youIdx = (youIdx + 1) % youHits.length;
        youHits[youIdx].scrollIntoView({ behavior: SB, block: "center" });
      });
      document.body.appendChild(youBtn);
    }
    youBtn.style.display = "";
    youBtn.lastChild.textContent = youHits.length + " repl" + (youHits.length > 1 ? "ies" : "y") + " to you";
  }

  /* ---------- Recently visited threads: history panel (🕘 in the nav column) ----------
     Every thread view is recorded (board, id, OP subject/snippet, when, reply
     count). The panel lists them newest-first with a "+N new" badge computed
     from ONE catalog.json fetch per distinct board, diffed against the reply
     counts rchan_seen already tracks. */
  var HIST_KEY = "rchan_hist", HIST_MAX = 50;
  function histLoad() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; } }
  function histSave(a) { try { localStorage.setItem(HIST_KEY, JSON.stringify(a.slice(0, HIST_MAX))); } catch (e) {} }
  function threadTitle() {
    var s = document.querySelector(".innerOP .labelSubject");
    if (s && s.textContent.trim()) { return s.textContent.trim().slice(0, 70); }
    var m = document.querySelector(".innerOP .divMessage");
    if (m && m.textContent.trim()) { return m.textContent.trim().replace(/\s+/g, " ").slice(0, 70); }
    return "Thread " + curThreadId();
  }
  function recordVisit() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t || b.charAt(0) === ".") { return; }
    var a = histLoad().filter(function (e) { return !(e.b === b && e.t === t); });
    a.unshift({ b: b, t: t, s: threadTitle(), ts: Date.now() });
    histSave(a);
  }
  function fmtAgo(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) { return "now"; }
    if (m < 60) { return m + "m"; }
    var h = Math.round(m / 60);
    if (h < 24) { return h + "h"; }
    return Math.round(h / 24) + "d";
  }
  var histPanel = null;
  function renderHist() {
    var list = histPanel.lastChild;
    var a = histLoad();
    list.innerHTML = "";
    if (!a.length) {
      var empty = document.createElement("div"); empty.className = "rchan-hist-empty";
      empty.textContent = "No threads visited yet";
      list.appendChild(empty);
      return;
    }
    var seen = seenAll(), rows = [];
    a.forEach(function (e) {
      var row = document.createElement("a");
      row.className = "rchan-hist-row";
      row.href = "/" + e.b + "/res/" + e.t;
      var title = document.createElement("span"); title.className = "rchan-hist-title";
      title.textContent = "/" + e.b + "/ · " + (e.s || ("Thread " + e.t));
      var badge = document.createElement("span"); badge.className = "rchan-newbadge"; badge.style.display = "none";
      var meta = document.createElement("span"); meta.className = "rchan-hist-meta"; meta.textContent = fmtAgo(e.ts);
      meta.setAttribute("data-ts", e.ts);                    // live time-ago ticker reads this
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-hist-x"; x.textContent = "×"; x.title = "Remove from history";
      x.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        histSave(histLoad().filter(function (o) { return !(o.b === e.b && o.t === e.t); }));
        renderHist();
      });
      row.appendChild(title); row.appendChild(badge); row.appendChild(meta); row.appendChild(x);
      list.appendChild(row);
      rows.push({ e: e, badge: badge });
    });
    // unread badges: one catalog fetch per distinct board in the list
    var boards = {};
    a.forEach(function (e) { boards[e.b] = 1; });
    Object.keys(boards).forEach(function (b) {
      fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); }).then(function (cat) {
        var counts = {};
        (cat || []).forEach(function (t) { counts[t.threadId] = t.postCount || 0; });
        rows.forEach(function (ro) {
          if (ro.e.b !== b || counts[ro.e.t] == null) { return; }
          var rec = seen[b + "/" + ro.e.t];
          var diff = counts[ro.e.t] - ((rec && rec.replies) || 0);
          if (rec && diff > 0) {
            ro.badge.textContent = "+" + diff + " new";
            ro.badge.style.display = "";
          }
        });
      }).catch(function () {});
    });
  }
  var HIST_SCROLL = "rchan_hist_scroll", histScrollT = null;
  function toggleHistPanel() {
    if (histPanel && histPanel.style.display === "block") { histPanel.style.display = "none"; return; }
    if (!histPanel) {
      histPanel = document.createElement("div"); histPanel.id = "rchan-hist";
      histPanel.setAttribute("role", "dialog"); histPanel.setAttribute("aria-label", "Recently visited threads");
      var head = document.createElement("div"); head.className = "rchan-hist-head";
      var ttl = document.createElement("span"); ttl.textContent = "Recent threads";
      var clr = document.createElement("button"); clr.type = "button"; clr.className = "rchan-hist-clear"; clr.textContent = "Clear";
      clr.addEventListener("click", function () { histSave([]); renderHist(); });
      head.appendChild(ttl); head.appendChild(clr);
      histPanel.appendChild(head);
      histPanel.appendChild(document.createElement("div"));   // list container (lastChild)
      document.body.appendChild(histPanel);
      document.addEventListener("click", function (ev) {      // click-away closes
        if (histPanel.style.display !== "block") { return; }
        var t = ev.target;
        if (histPanel.contains(t) || (t.closest && t.closest("#rchan-nav"))) { return; }
        histPanel.style.display = "none";
      }, true);
      // remember scroll position (survives close/reopen and page navigations)
      histPanel.addEventListener("scroll", function () {
        clearTimeout(histScrollT);
        histScrollT = setTimeout(function () {
          try { sessionStorage.setItem(HIST_SCROLL, String(histPanel.scrollTop)); } catch (e) {}
        }, 150);
      });
      // live time-ago: tick the row timestamps while the panel is open
      setInterval(function () {
        if (histPanel.style.display !== "block") { return; }
        var metas = histPanel.getElementsByClassName("rchan-hist-meta");
        for (var i = 0; i < metas.length; i++) {
          var ts = parseInt(metas[i].getAttribute("data-ts"), 10);
          if (ts) { metas[i].textContent = fmtAgo(ts); }
        }
      }, 30000);
    }
    renderHist();
    histPanel.style.display = "block";
    try { histPanel.scrollTop = parseInt(sessionStorage.getItem(HIST_SCROLL), 10) || 0; } catch (e) {}
  }

  /* ---------- Captcha expiry feedback ----------
     captchaUtils already counts down and AUTO-RELOADS the captcha at expiry —
     but that also clears whatever you'd typed, silently. Wrap the reload so
     the auto-expiry path (cu.reloading, set only by its timer loop) toasts
     when it eats a typed answer. Manual Reload clicks bypass the wrapper
     (they were bound by reference at init) — correctly so. */
  function hookCaptchaReload() {
    var cu = window.captchaUtils;
    if (!cu || !cu.reloadCaptcha || cu.__rchan) { return; }
    cu.__rchan = true;
    var orig = cu.reloadCaptcha;
    cu.reloadCaptcha = function () {
      try {
        if (cu.reloading) {                                  // auto-expiry path only
          var fields = document.getElementsByClassName("captchaField");
          for (var i = 0; i < fields.length; i++) {
            if (fields[i].value.trim()) {
              toast("Captcha expired — a fresh one loaded, please re-solve", true);
              break;
            }
          }
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  /* ---------- Per-board accent identity ----------
     Every board renders identically; a stable per-board hue (hash of the
     URI, same trick as the ID pills) tints the board title so each board
     reads as a *place*. One custom property; CSS keeps the saturation and
     lightness on-palette per theme. Toggleable in site settings. */
  function applyBoardAccent() {
    var rootEl = document.documentElement;
    var b = getBoard();
    if (!b || b.charAt(0) === "." || !setOn("accent")) {
      rootEl.classList.remove("rchan-accented");
      return;
    }
    var h = 0;
    for (var i = 0; i < b.length; i++) { h = (h * 31 + b.charCodeAt(i)) >>> 0; }
    rootEl.style.setProperty("--bah", h % 360);
    rootEl.classList.add("rchan-accented");
  }

  /* ---------- Empty-state: a quiet board shouldn't read as a dead one ----------
     Zero threads on a board/catalog renders a real invitation with a CTA
     that opens the floating new-thread form, instead of engine whitespace.
     Re-checked by refresh() so it clears itself when a thread appears. */
  function syncEmptyState() {
    var b = getBoard(), t = document.getElementById("divThreads");
    if (!b || b.charAt(0) === "." || !t || curThreadId()) { return; }
    if (!document.getElementById("postingForm")) { return; }     // can't post here (overboard etc.)
    var has = t.getElementsByClassName(isCatalog() ? "catalogCell" : "opCell").length;
    var el = document.getElementById("rchan-empty");
    if (has) { if (el && el.parentNode) { el.parentNode.removeChild(el); } return; }
    if (el) { return; }
    var box = document.createElement("div"); box.id = "rchan-empty";
    var ttl = document.createElement("div"); ttl.className = "rchan-empty-title";
    ttl.textContent = "No threads yet";
    var sub = document.createElement("div"); sub.className = "rchan-empty-sub";
    sub.textContent = "/" + b + "/ is a blank canvas — be the one who starts the conversation.";
    var cta = document.createElement("button"); cta.type = "button"; cta.className = "rchan-empty-cta";
    cta.textContent = "＋ Create the first thread";
    cta.addEventListener("click", function () {
      var tog = document.getElementById("rchan-formtoggle");
      if (tog) { tog.click(); return; }
      var m = document.getElementById("fieldMessage");
      if (m) { m.focus(); try { m.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
    });
    box.appendChild(ttl); box.appendChild(sub); box.appendChild(cta);
    t.parentNode.insertBefore(box, t);
  }

  /* ---------- Rotating board banners ----------
     LynxChan serves /randomBanner.js?boardUri=x (302 to a random uploaded
     banner, or to /defaultBanner.png when the board has none — in which
     case we render NOTHING rather than the engine's stock art). Click the
     banner to roll another. Upload banners per-board via board management. */
  function buildBanner() {
    if (!setOn("banners")) { return; }
    var b = getBoard();
    if (!b || b.charAt(0) === "." || document.getElementById("rchan-bannerwrap")) { return; }
    var anchor = document.querySelector(".boardHeader, #catalogId");
    if (!anchor) { return; }
    var url = "/randomBanner.js?boardUri=" + encodeURIComponent(b);
    fetch(url).then(function (r) {
      if (!r.ok || /defaultBanner/.test(r.url || "")) { return; }
      if (document.getElementById("rchan-bannerwrap")) { return; }
      var img = document.createElement("img");
      img.id = "rchan-banner";
      img.alt = "/" + b + "/ banner";
      img.src = r.url;
      img.setAttribute("data-tooltip", "Another banner");
      img.addEventListener("click", function () {
        fetch(url + "&r=" + Date.now()).then(function (r2) {
          if (r2.ok && !/defaultBanner/.test(r2.url || "")) { img.src = r2.url; }
        }).catch(function () {});
      });
      img.addEventListener("error", function () {
        var w = document.getElementById("rchan-bannerwrap");
        if (w && w.parentNode) { w.parentNode.removeChild(w); }
      });
      var wrap = document.createElement("div"); wrap.id = "rchan-bannerwrap";
      wrap.appendChild(img);
      anchor.parentNode.insertBefore(wrap, anchor);
    }).catch(function () {});
  }

  /* ---------- Per-thread scroll resume ----------
     Jump-to-new answers "what's unread"; this answers "where was I".
     Last scroll position is saved per thread (only after a real user
     scroll, so a glance at the top never clobbers a deep bookmark) and a
     quiet pill offers to jump back on the next visit. Auto-dismisses when
     you scroll most of the way there yourself. */
  var SCROLL_KEY = "rchan_scrollpos", SCROLL_MAX = 100, scrollSaveT = null;
  function scrollMap() { try { return JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}"); } catch (e) { return {}; } }
  function saveScrollPos() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t) { return; }
    var map = scrollMap();
    map[b + "/" + t] = { y: Math.round(window.scrollY || 0), ts: Date.now() };
    var keys = Object.keys(map);
    if (keys.length > SCROLL_MAX) {                    // prune oldest
      keys.sort(function (a, b2) { return (map[a].ts || 0) - (map[b2].ts || 0); });
      for (var i = 0; i < keys.length - SCROLL_MAX; i++) { delete map[keys[i]]; }
    }
    try { localStorage.setItem(SCROLL_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function initScrollResume() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t) { return; }
    var armed = false;                                 // only save after a real user scroll
    window.addEventListener("scroll", function () {
      armed = true;
      clearTimeout(scrollSaveT); scrollSaveT = setTimeout(saveScrollPos, 300);
    }, { passive: true });
    window.addEventListener("pagehide", function () { if (armed) { saveScrollPos(); } });
    if (location.hash) { return; }                     // deep link wins
    var rec = scrollMap()[b + "/" + t];
    if (!rec || rec.y < window.innerHeight) { return; }
    var pill = document.createElement("button");
    pill.id = "rchan-resume"; pill.type = "button";
    pill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><polyline points="12 7.5 12 12 15.2 13.8"/></svg><span>Resume reading</span>';
    function hidePill() { if (pill.parentNode) { pill.parentNode.removeChild(pill); } }
    pill.addEventListener("click", function () {
      window.scrollTo({ top: rec.y, behavior: SB });
      hidePill();
    });
    document.body.appendChild(pill);
    setTimeout(hidePill, 20000);
    window.addEventListener("scroll", function selfScrolled() {
      if ((window.scrollY || 0) > rec.y * 0.8) {       // found their own way back
        hidePill();
        window.removeEventListener("scroll", selfScrolled);
      }
    }, { passive: true });
  }

  /* ---------- Proactive captcha lifecycle ----------
     The native loop only reacts AT expiry (auto-reload, which eats typed
     answers — hookCaptchaReload toasts after the fact). Get ahead of it:
     - field EMPTY and <6s left  -> silently swap in a fresh captcha now
       (nothing to lose; the manual-reload path, so no expiry toast fires),
     - field TYPED and <12s left -> warn once so the user can submit before
       the native timer wipes the answer. */
  function initCaptchaLifecycle() {
    if (initCaptchaLifecycle.__on || !window.captchaUtils || !captchaUtils.reloadCaptcha ||
        !window.api || !api.getCookies) { return; }
    if (!document.getElementsByClassName("captchaField").length) { return; }
    initCaptchaLifecycle.__on = true;
    var warnedFor = 0, freshenedFor = 0;
    setInterval(function () {
      try {
        var fields = document.getElementsByClassName("captchaField");
        if (!fields.length) { return; }
        var c = api.getCookies();
        if (!c.captchaexpiration) { return; }
        var exp = new Date(c.captchaexpiration).getTime();
        if (!exp) { return; }
        var left = exp - Date.now();
        if (left <= 1500 || left > 12500) { return; }   // native handles actual expiry
        var typed = false;
        for (var i = 0; i < fields.length; i++) { if (fields[i].value.trim()) { typed = true; break; } }
        if (typed) {
          if (warnedFor !== exp) {
            warnedFor = exp;
            toast("Captcha expires in " + Math.round(left / 1000) + "s — post now or it will reload", true);
          }
        } else if (freshenedFor !== exp && left <= 6500) {
          freshenedFor = exp;
          captchaUtils.reloadCaptcha();                 // silent early swap: nothing typed to lose
        }
      } catch (e) {}
    }, 1000);
  }

  /* ---------- Board liveness: index/catalog pages stop being frozen ----------
     Threads live-update over the websocket; board surfaces are a snapshot
     from page load. Diff catalog.json against the load-time snapshot every
     60s (visible tabs only) and offer a gentle "N new — refresh" pill
     instead of silently going stale. */
  function initBoardLiveness() {
    var b = getBoard();
    if (!b || b.charAt(0) === "." || curThreadId()) { return; }
    if (!document.getElementById("divThreads")) { return; }        // board index or catalog only
    var base = null, pill = null;
    function snapshot(list) {
      var m = { total: 0, threads: {} };
      (list || []).forEach(function (t) {
        m.total += (t.postCount || 0) + 1;                         // +1: the OP itself
        m.threads[t.threadId] = 1;
      });
      return m;
    }
    function check() {
      fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); }).then(function (list) {
        var cur = snapshot(list);
        if (!base) { base = cur; return; }
        var newThreads = 0;
        Object.keys(cur.threads).forEach(function (id) { if (!base.threads[id]) { newThreads++; } });
        var newPosts = Math.max(0, cur.total - base.total) - newThreads;
        // hidden tab: board pages get the same "(N)" title + favicon badge threads have
        if (document.hidden) { setTitleUnread(newThreads + newPosts); }
        if (newThreads <= 0 && newPosts <= 0) { if (pill) { pill.style.display = "none"; } return; }
        if (!pill) {
          pill = document.createElement("button");
          pill.id = "rchan-boardpill"; pill.type = "button";
          pill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4l-2.35 2.35z"/></svg><span></span>';
          pill.setAttribute("aria-label", "New activity — refresh the page");
          pill.addEventListener("click", function () { location.reload(); });
          document.body.appendChild(pill);
        }
        var txt = [];
        if (newThreads > 0) { txt.push(newThreads + " new thread" + (newThreads > 1 ? "s" : "")); }
        if (newPosts > 0) { txt.push(newPosts + " new post" + (newPosts > 1 ? "s" : "")); }
        pill.lastChild.textContent = txt.join(" · ") + " — refresh";
        pill.style.display = "inline-flex";
      }).catch(function () {});
    }
    fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); })
      .then(function (list) { base = snapshot(list); }).catch(function () {});
    setInterval(check, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { check(); } });
  }

  /* ---------- Presence: "N anons here" (rides the thread status line) ----------
     Heartbeat ping to the presence addon every 45s while the tab is visible;
     the response is how many distinct session ids pinged this thread in the
     last 90s. The count folds into updateThreadStat's line. */
  var presenceCount = 0;
  function presenceSid() {
    try {
      var s = sessionStorage.getItem("rchan_sid");
      if (!s) {
        s = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
        sessionStorage.setItem("rchan_sid", s);
      }
      return s;
    } catch (e) { return "sidfallback" + (Date.now() % 1e8); }
  }
  function pingPresence() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t || document.hidden) { return; }
    fetch("/addon.js/presence?boardUri=" + encodeURIComponent(b) + "&threadId=" +
          encodeURIComponent(t) + "&sid=" + presenceSid())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.status === "ok" && typeof d.count === "number") {
          presenceCount = d.count;
          updateThreadStat();
        }
      }).catch(function () {});
  }
  function initPresence() {
    if (!curThreadId()) { return; }
    pingPresence();
    setInterval(pingPresence, 45000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) { pingPresence(); }
    });
  }

  /* ---------- Sticky thread status line (lives in the fixed nav) ----------
     "412 replies · 96 files · 31 IDs · updated 3m ago" — the "is this thread
     worth my scroll" answer, always visible. Counts come straight from the
     DOM; last-activity parses the newest labelCreated the same way the
     engine's relative-time code does (localTimes-aware). */
  function parseCreated(el) {
    var v = (el.textContent || "").trim();
    if (!v) { return 0; }
    var d = new Date(v + (window.posting && posting.localTimes ? "" : " UTC"));
    return +d || 0;
  }
  function updateThreadStat() {
    if (!curThreadId()) { return; }
    var nav = document.querySelector("nav, #dynamicHeader");
    if (!nav) { return; }
    var el = document.getElementById("rchan-threadstat");
    if (!el) {
      el = document.createElement("span");
      el.id = "rchan-threadstat";
      nav.insertBefore(el, document.getElementById("navOptionsSpan") || null);
    }
    var replies = document.getElementsByClassName("postCell").length;
    var files = document.getElementsByClassName("originalNameLink").length;
    var ids = {}, idEls = document.getElementsByClassName("labelId");
    for (var i = 0; i < idEls.length; i++) {
      var v = (idEls[i].textContent || "").replace(/\s*\(\d+\)\s*$/, "").trim();  // hover appends "(n)"
      if (v) { ids[v] = 1; }
    }
    var idCount = Object.keys(ids).length;
    var last = 0, times = document.getElementsByClassName("labelCreated");
    for (var j = 0; j < times.length; j++) {
      var t = parseCreated(times[j]);
      if (t > last) { last = t; }
    }
    var ago = last ? fmtAgo(last) : "";
    el.textContent = replies + (replies === 1 ? " reply" : " replies") +
      " · " + files + (files === 1 ? " file" : " files") +
      (idCount ? " · " + idCount + (idCount === 1 ? " ID" : " IDs") : "") +
      (last ? " · updated " + (ago === "now" ? "just now" : ago + " ago") : "") +
      (presenceCount ? " · " + presenceCount + (presenceCount === 1 ? " anon here" : " anons here") : "");
  }

  /* ---------- Find-in-thread: live post filter ----------
     `f` (or the magnifier in the nav) opens a bar that COLLAPSES non-matching
     posts instead of fighting Ctrl+F's lazy rendering. Plain text searches
     everything; `id:` `name:` `file:` `subj:` `no:` scope to a field. Every
     ID pill gets a funnel for one-click "show only this ID". The OP always
     stays visible; live WS posts are re-filtered by refresh(). */
  var SVG_FIND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>';
  var SVG_FUNNEL = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4h18l-7 9v5l-4 2v-7L3 4z"/></svg>';
  var findBar = null, findInput = null, findCount = null, findActive = false, findT = null;
  function buildFindIndex(cell) {
    if (cell.__find) { return cell.__find; }
    var inner = cell.querySelector(".innerPost, .innerOP, .markedPost") || cell;
    function grab(sel) {
      var els = inner.querySelectorAll(sel), s = "";
      for (var i = 0; i < els.length; i++) { s += " " + (els[i].textContent || ""); }
      return s.toLowerCase();
    }
    var msgEl = inner.querySelector(".divMessage"), msg = "";
    if (msgEl) {                                   // exclude inline-expanded quotes (other posts' text)
      var clone = msgEl.cloneNode(true);
      var inl = clone.querySelectorAll(".rchan-inline-quote");
      for (var j = inl.length - 1; j >= 0; j--) { inl[j].parentNode.removeChild(inl[j]); }
      msg = (clone.textContent || "").toLowerCase();
    }
    var f = {
      name: grab(".linkName, .labelName"),
      subj: grab(".labelSubject"),
      id: grab(".labelId").replace(/\s*\(\d+\)\s*/g, " "),
      file: grab(".originalNameLink"),
      no: " " + (postIdOf(cell) || "")
    };
    f.all = msg + f.name + f.subj + f.id + f.file + f.no;
    cell.__find = f;
    return f;
  }
  function applyFind() {
    if (!findActive) { return; }
    var q = (findInput.value || "").trim().toLowerCase();
    var mode = "all", needle = q;
    var m = q.match(/^(id|name|file|subj|no):\s*(.*)$/);
    if (m) { mode = m[1]; needle = m[2]; }
    var posts = document.getElementsByClassName("postCell");
    var shown = 0;
    for (var i = 0; i < posts.length; i++) {
      var f = buildFindIndex(posts[i]);
      var hit = !needle || (f[mode] || "").indexOf(needle) > -1;
      posts[i].classList.toggle("rchan-findhide", !hit);
      if (hit) { shown++; }
    }
    findCount.textContent = needle ? (shown + " / " + posts.length) : (posts.length + " posts");
  }
  function closeFind() {
    if (!findBar) { return; }
    findBar.style.display = "none";
    findActive = false;
    var hidden = document.getElementsByClassName("rchan-findhide");
    for (var i = hidden.length - 1; i >= 0; i--) { hidden[i].classList.remove("rchan-findhide"); }
  }
  function toggleFind(preset) {
    if (!curThreadId()) { return; }
    closeConv();                                       // the two collapse modes are exclusive
    if (findBar && findBar.style.display === "flex" && preset == null) { closeFind(); return; }
    if (!findBar) {
      findBar = document.createElement("div"); findBar.id = "rchan-find";
      findBar.setAttribute("role", "search");
      findInput = document.createElement("input");
      findInput.type = "text"; findInput.placeholder = "Filter posts — text, id:, name:, file:, subj:, no:";
      findInput.setAttribute("aria-label", "Filter posts in this thread");
      findInput.addEventListener("input", function () {
        clearTimeout(findT); findT = setTimeout(applyFind, 150);
      });
      findInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { closeFind(); e.stopPropagation(); }
      });
      findCount = document.createElement("span"); findCount.className = "rchan-findcount";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Close filter"; x.setAttribute("aria-label", "Close filter");
      x.addEventListener("click", closeFind);
      findBar.appendChild(findInput); findBar.appendChild(findCount); findBar.appendChild(x);
      document.body.appendChild(findBar);
    }
    findBar.style.display = "flex";
    findActive = true;
    if (preset != null) { findInput.value = preset; }
    findInput.focus(); findInput.select();
    applyFind();
  }
  function buildFindButton() {
    if (!curThreadId() || document.getElementById("rchan-findbtn")) { return; }
    var nav = document.querySelector("nav, #dynamicHeader");
    if (!nav) { return; }
    var b = document.createElement("button");
    b.type = "button"; b.id = "rchan-findbtn";
    b.innerHTML = SVG_FIND;
    b.setAttribute("data-tooltip", "Filter posts in this thread (f)");
    b.setAttribute("aria-label", "Filter posts in this thread");
    b.addEventListener("click", function () { toggleFind(); });
    nav.insertBefore(b, document.getElementById("navOptionsSpan") || null);
  }

  /* ---------- Conversation view: isolate one quote chain ----------
     The structural reading primitive find-in-thread can't give you: a per-post
     control that collapses the thread to just that post's ancestors (what it
     quotes, transitively) + descendants (what quotes it, transitively). Three
     interleaved arguments become one readable conversation. Same collapse
     mechanics as the find bar; the two modes are mutually exclusive. */
  var SVG_CONV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8v-2z"/></svg>';
  var convRoot = null, convBar = null;
  function quoteGraph() {
    var cells = document.querySelectorAll(".opCell, .postCell");
    var quotes = {}, children = {};
    for (var i = 0; i < cells.length; i++) {
      var id = String(postIdOf(cells[i]) || "");
      if (!id) { continue; }
      var inner = cells[i].querySelector(".innerPost, .innerOP");
      if (!inner) { continue; }
      var qs = inner.getElementsByClassName("quoteLink");
      var list = [];
      for (var j = 0; j < qs.length; j++) {
        if (qs[j].closest && qs[j].closest(".rchan-inline-quote")) { continue; }
        var m = (qs[j].getAttribute("href") || "").match(/(\d+)\s*$/);
        if (m && list.indexOf(m[1]) < 0) { list.push(m[1]); }
      }
      quotes[id] = list;
      for (var k = 0; k < list.length; k++) {
        (children[list[k]] = children[list[k]] || []).push(id);
      }
    }
    return { quotes: quotes, children: children };
  }
  function convMembers(root) {
    var g = quoteGraph(), set = {};
    set[root] = 1;
    var stack = [root], cur, arr, i;
    while (stack.length) {                             // ancestors: what it quotes
      arr = g.quotes[stack.pop()] || [];
      for (i = 0; i < arr.length; i++) { if (!set[arr[i]]) { set[arr[i]] = 1; stack.push(arr[i]); } }
    }
    stack = [root];
    while (stack.length) {                             // descendants: what quotes it
      arr = g.children[stack.pop()] || [];
      for (i = 0; i < arr.length; i++) { if (!set[arr[i]]) { set[arr[i]] = 1; stack.push(arr[i]); } }
    }
    return set;
  }
  function applyConv() {
    if (!convRoot) { return; }
    var set = convMembers(convRoot);
    var posts = document.getElementsByClassName("postCell");
    var n = 0;
    for (var i = 0; i < posts.length; i++) {
      var hit = !!set[String(postIdOf(posts[i]) || "")];
      posts[i].classList.toggle("rchan-convhide", !hit);
      if (hit) { n++; }
    }
    if (convBar) {                                     // +1: the OP is always visible
      convBar.firstChild.textContent = "Conversation around No." + convRoot + " · " + (n + 1) + " posts";
    }
  }
  function closeConv() {
    convRoot = null;
    if (convBar) { convBar.style.display = "none"; }
    var hidden = document.getElementsByClassName("rchan-convhide");
    for (var i = hidden.length - 1; i >= 0; i--) { hidden[i].classList.remove("rchan-convhide"); }
  }
  function openConv(rootId) {
    closeFind();                                       // the two collapse modes are exclusive
    convRoot = String(rootId);
    if (!convBar) {
      convBar = document.createElement("div"); convBar.id = "rchan-conv";
      convBar.appendChild(document.createElement("span"));
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Exit conversation view";
      x.setAttribute("aria-label", "Exit conversation view");
      x.addEventListener("click", closeConv);
      convBar.appendChild(x);
      document.body.appendChild(convBar);
    }
    convBar.style.display = "flex";
    applyConv();
    var rootEl = document.getElementById(convRoot);
    if (rootEl) { try { rootEl.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
  }
  function decorateConvButtons(root) {
    if (!curThreadId()) { return; }
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-conv")) { continue; }
      info.setAttribute("data-conv", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }   // embedded copies
      var cell = info.closest(".postCell, .opCell");
      if (!cell) { continue; }
      var id = postIdOf(cell);
      if (!id) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-convbtn";
      b.innerHTML = SVG_CONV;
      b.setAttribute("data-tooltip", "Show this conversation only");
      b.setAttribute("aria-label", "Show only the conversation around post " + id);
      b.addEventListener("click", (function (pid) {
        return function (ev) { ev.preventDefault(); ev.stopPropagation(); openConv(pid); };
      })(id));
      info.appendChild(b);
    }
  }

  /* ---------- GET celebration: dubs get checked ----------
     Classic chan culture: repeating trailing digits (dubs/trips/quads…) and
     round-number GETs earn a mark. Dubs stay subtle (gold underline on the
     post No.); trips and better — and 000 GETs — get a small gold badge.
     Play is retention on a small board. */
  function decorateGets(root) {
    var links = (root || document).getElementsByClassName("linkQuote");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-get")) { continue; }
      a.setAttribute("data-get", "1");
      if (a.closest && a.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var num = (a.textContent || "").replace(/\D/g, "");
      if (num.length < 2) { continue; }
      var label = null, tier = 0;
      var zeros = num.match(/0{3,}$/);
      var reps = num.match(/(\d)\1+$/);
      var repLen = reps ? reps[0].length : 0;
      if (zeros && zeros[0].length >= 3) { label = "GET"; tier = 3; }
      else if (repLen >= 5) { label = "quints"; tier = 3; }
      else if (repLen === 4) { label = "quads"; tier = 3; }
      else if (repLen === 3) { label = "trips"; tier = 2; }
      else if (repLen === 2) { tier = 1; }               // dubs: underline only
      if (!tier) { continue; }
      a.classList.add("rchan-get");
      if (tier === 1) {
        a.classList.add("rchan-get-dubs");
        a.setAttribute("data-tooltip", "dubs");
        continue;
      }
      var b = document.createElement("span");
      b.className = "rchan-getbadge";
      b.textContent = label;
      a.parentNode.insertBefore(b, a.nextSibling);
    }
  }

  /* ---------- Report shortcut: a visible lever on every post ----------
     The native flow (⋮ menu → Report) is invisible to people who don't
     already know it exists — and users can't help you moderate if they
     can't find the lever. Surface a hover-revealed flag on each post
     header that opens the NATIVE report modal (reason + captcha handling
     included); the modal itself is restyled to the design system in css. */
  var SVG_FLAG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>';
  function decorateReportButtons(root) {
    if (!window.postingMenu || !postingMenu.showReport) { return; }
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-report")) { continue; }
      info.setAttribute("data-report", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var cell = info.closest(".postCell, .opCell");
      var ids = cell && qmodIds(cell);
      if (!ids) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-reportbtn";
      b.innerHTML = SVG_FLAG;
      b.setAttribute("data-tooltip", "Report this post");
      b.setAttribute("aria-label", "Report post " + (ids.post || ids.thread));
      b.addEventListener("click", (function (d) {
        return function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          try { postingMenu.showReport(d.board, d.thread, d.post); } catch (e) {}
        };
      })(ids));
      info.appendChild(b);
    }
  }

  /* ---------- Staff quick-mod: one-click actions on post hover ----------
     The native ⋮ menu buries delete/ban under menu → modal → submit. For
     staff (body.rchan-staff, the same globalRole<=1 gate as the flag
     override — server enforces regardless) each post header gets a
     hover-revealed strip: del / ban+del / ip⌫ (wipe IP in thread). First
     click ARMS the button ("sure?", 2.5s), second click fires through the
     NATIVE postingMenu functions, so DOM cleanup and error handling stay
     engine-consistent. Errors surface via the alert→toast bridge. */
  function qmodIds(cell) {
    var checkbox = cell.querySelector(".deletionCheckBox");
    if (checkbox && checkbox.name) {
      var p = checkbox.name.split("-");
      return { board: p[0], thread: p[1], post: p[2] };            // post undefined for the OP
    }
    return null;
  }
  function qmodButton(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "rchan-qmod-btn"; b.textContent = label;
    b.setAttribute("data-tooltip", title); b.setAttribute("aria-label", title);
    var armT = null;
    b.addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (b.classList.contains("rchan-armed")) {
        clearTimeout(armT);
        b.classList.remove("rchan-armed"); b.textContent = label;
        fn();
        return;
      }
      b.classList.add("rchan-armed"); b.textContent = "sure?";
      armT = setTimeout(function () {
        b.classList.remove("rchan-armed"); b.textContent = label;
      }, 2500);
    });
    return b;
  }
  function decorateQuickMod(root) {
    if (!document.body.classList.contains("rchan-staff") || !window.postingMenu ||
        !postingMenu.deleteSinglePost) { return; }
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-qmod")) { continue; }
      info.setAttribute("data-qmod", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var cell = info.closest(".postCell, .opCell");
      var ids = cell && qmodIds(cell);
      if (!ids) { continue; }
      var innerPart = cell.querySelector(".innerPost, .innerOP");
      var strip = document.createElement("span");
      strip.className = "rchan-qmod";
      strip.appendChild(qmodButton("del", "Delete this post", (function (d, ip2) {
        return function () { postingMenu.deleteSinglePost(d.board, d.thread, d.post, null, null, null, ip2); };
      })(ids, innerPart)));
      strip.appendChild(qmodButton("ban+del", "Ban the poster's IP and delete the post", (function (d, ip2) {
        return function () {
          // defaults: IP ban, permanent, delete the post; ban captcha is skipped
          // for globalRole<4 (postingMenu.applySingleBan handles the rest)
          var dummy = document.createElement("div");
          postingMenu.applySingleBan("", 1, "rule violation (quick-mod)", "", 0, "", false, false,
              d.board, d.thread, d.post, ip2, dummy);
        };
      })(ids, innerPart)));
      strip.appendChild(qmodButton("ip⌫", "Delete every post by this IP in this thread", (function (d, ip2) {
        return function () {
          postingMenu.deleteSinglePost(d.board, d.thread, d.post, true, null, null, ip2, null, true);
        };
      })(ids, innerPart)));
      info.appendChild(strip);
    }
  }

  /* ---------- Auto-filters: filename rules, stubs, recursive hiding ----------
     Extends the NATIVE filter machinery (settingsMenu.loadedFilters /
     localStorage.filterData, applied by hiding.js) rather than duplicating it:
     - a manager UI lives in the rchan settings panel (add/remove, regex),
     - new type 5 = Filename (native's switch ignores unknown types safely),
     - filtered posts leave a one-line stub with a session [show] instead of
       vanishing without a trace,
     - replies that quote a filtered/hidden post collapse too (toggleable). */
  var FILTER_TYPE_NAMES = ["Name", "Tripcode", "Subject", "Message", "ID", "Filename"];
  function loadedFilters() {
    try {
      if (window.settingsMenu && settingsMenu.loadedFilters) { return settingsMenu.loadedFilters; }
      return JSON.parse(localStorage.filterData || "[]");
    } catch (e) { return []; }
  }
  function persistFilters(arr) {
    try { localStorage.filterData = JSON.stringify(arr); } catch (e) {}
    if (window.settingsMenu) { settingsMenu.loadedFilters = arr; }
  }
  function fMatch(s, f) {
    if (f.regex) { try { return new RegExp(f.filter).test(s); } catch (e) { return false; } }
    return s.indexOf(f.filter) >= 0;
  }
  function cellHidden(cell) {
    return cell.style.display === "none" || (cell.classList && cell.classList.contains("hidden"));
  }
  function addFilterStub(cell, label) {
    if (cell.__stub && cell.__stub.parentNode) { return; }
    var no = postIdOf(cell);
    var s = document.createElement("div");
    s.className = "rchan-filterstub";
    var txt = document.createElement("span");
    txt.textContent = label + (no ? " No." + no : "");
    var show = document.createElement("a"); show.href = "#"; show.textContent = "show";
    show.addEventListener("click", function (e) {
      e.preventDefault();
      cell.style.display = "";
      if (cell.classList) { cell.classList.remove("hidden"); }
      cell.__rchanShown = true;                       // don't re-hide this session
      if (s.parentNode) { s.parentNode.removeChild(s); }
    });
    s.appendChild(txt); s.appendChild(document.createTextNode(" — ")); s.appendChild(show);
    cell.parentNode.insertBefore(s, cell);
    cell.__stub = s;
  }
  function applyExtraFilters() {
    var cells = document.querySelectorAll(".postCell, .opCell");
    var fileFilters = loadedFilters().filter(function (f) { return f.type === 5; });
    var i, cell;
    for (i = 0; i < cells.length; i++) {              // filename rules
      cell = cells[i];
      if (cell.__rchanShown || cellHidden(cell) || !fileFilters.length) { continue; }
      var inner = cell.querySelector(".innerPost, .innerOP") || cell;
      var names = inner.querySelectorAll(".originalNameLink");
      for (var n = 0; n < names.length && !cellHidden(cell); n++) {
        var fname = names[n].textContent || "";
        for (var k = 0; k < fileFilters.length; k++) {
          if (fMatch(fname, fileFilters[k])) {
            cell.style.display = "none"; cell.__xhide = true;
            addFilterStub(cell, "Filtered file");
            break;
          }
        }
      }
    }
    if (!setOn("filterrecurse")) { return; }
    var passes = 0, changed = true;
    while (changed && passes++ < 10) {                // chase quote chains
      changed = false;
      var hiddenIds = {};
      for (i = 0; i < cells.length; i++) {
        if (cellHidden(cells[i])) { var hid = postIdOf(cells[i]); if (hid) { hiddenIds[hid] = 1; } }
      }
      for (i = 0; i < cells.length; i++) {
        cell = cells[i];
        if (cell.__rchanShown || cellHidden(cell) || !cell.classList.contains("postCell")) { continue; }
        var inn = cell.querySelector(".innerPost") || cell;
        var qs = inn.getElementsByClassName("quoteLink");
        for (var q = 0; q < qs.length; q++) {
          if (qs[q].closest && qs[q].closest(".rchan-inline-quote")) { continue; }
          var m = (qs[q].getAttribute("href") || "").match(/(\d+)\s*$/);
          if (m && hiddenIds[m[1]]) {
            cell.style.display = "none"; cell.__xhide = true;
            addFilterStub(cell, "Reply to a filtered post");
            changed = true;
            break;
          }
        }
      }
    }
  }
  /* ---------- Undo on hide: "Post hidden — Undo" toast ----------
     hiding.js makes content vanish with only a tiny [Unhide] stub. Wrap
     hidePost/hideThread so USER-initiated hides (a click inside the hide
     menu within the last second — the same functions also re-apply stored
     hides at load/refresh, which must stay silent) get an undo toast that
     clicks the native unhide button. */
  var lastHideClick = 0;
  function hookHideUndo() {
    var h = window.hiding;
    if (!h || h.__rchanUndo || !h.hidePost || !h.hideThread) { return; }
    h.__rchanUndo = true;
    function wrap(orig, isThread) {
      return function (linkSelf) {
        var r = orig.apply(this, arguments);
        try {
          if (Date.now() - lastHideClick < 1000) {
            lastHideClick = 0;
            // native inserts its [Unhide] span right before the hidden element
            var hiddenEl = isThread ? linkSelf.parentNode.parentNode.parentNode
                                    : linkSelf.parentNode.parentNode;
            var btn = hiddenEl.previousSibling;
            if (btn && btn.className && String(btn.className).indexOf("unhideButton") > -1) {
              toastAction(isThread ? "Thread hidden" : "Post hidden", "Undo", function () { btn.click(); });
            }
          }
        } catch (e) {}
        return r;
      };
    }
    h.hidePost = wrap(h.hidePost, false);
    h.hideThread = wrap(h.hideThread, true);
  }

  function hookFilterStubs() {
    var h = window.hiding;
    if (!h || !h.hideForFilter || h.__rchanStub) { return; }
    h.__rchanStub = true;
    var origHide = h.hideForFilter;
    h.hideForFilter = function (linkSelf) {
      var r = origHide.apply(this, arguments);
      try { addFilterStub(linkSelf.parentNode.parentNode.parentNode, "Filtered post"); } catch (e) {}
      return r;
    };
    var origCheck = h.checkFilters;
    h.checkFilters = function () {
      var stubs = document.getElementsByClassName("rchan-filterstub");   // full re-evaluation: reset stubs
      for (var i = stubs.length - 1; i >= 0; i--) { stubs[i].parentNode.removeChild(stubs[i]); }
      var cells = document.querySelectorAll(".postCell, .opCell");       // and our own hides
      for (var j = 0; j < cells.length; j++) {
        if (cells[j].__xhide) { cells[j].style.display = ""; delete cells[j].__xhide; }
      }
      var r = origCheck.apply(this, arguments);
      applyExtraFilters();
      return r;
    };
    // initial page load already ran the native pass before we wrapped: redo it with stubs
    setTimeout(function () { try { h.checkFilters(); } catch (e) {} }, 0);
  }
  // Filter manager (rendered inside the settings panel)
  function buildFilterSection(box) {
    box.innerHTML = "";
    var head = document.createElement("div"); head.className = "rchan-set-sub";
    head.textContent = "Auto-filters";
    box.appendChild(head);
    var arr = loadedFilters();
    if (!arr.length) {
      var none = document.createElement("div"); none.className = "rchan-set-desc rchan-filter-none";
      none.textContent = "No filters yet — matching posts collapse to a one-line stub.";
      box.appendChild(none);
    }
    arr.forEach(function (f) {
      var row = document.createElement("div"); row.className = "rchan-filter-row";
      var ty = document.createElement("span"); ty.className = "rchan-filter-type";
      ty.textContent = FILTER_TYPE_NAMES[f.type] || ("Type " + f.type);
      var pat = document.createElement("span"); pat.className = "rchan-filter-pat";
      pat.textContent = f.regex ? ("/" + f.filter + "/") : f.filter;
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-hist-x";
      x.textContent = "×"; x.title = "Remove filter"; x.setAttribute("aria-label", "Remove filter");
      x.addEventListener("click", function () {
        var cur = loadedFilters();
        var idx = cur.indexOf(f);
        if (idx < 0) {                                 // panel re-opened: match by value
          for (var i2 = 0; i2 < cur.length; i2++) {
            if (cur[i2].filter === f.filter && cur[i2].type === f.type && !cur[i2].regex === !f.regex) { idx = i2; break; }
          }
        }
        if (idx > -1) { cur.splice(idx, 1); persistFilters(cur); }
        if (window.hiding && hiding.__rchanStub) { hiding.checkFilters(); } else { applyExtraFilters(); }
        buildFilterSection(box);
      });
      row.appendChild(ty); row.appendChild(pat); row.appendChild(x);
      box.appendChild(row);
    });
    var form = document.createElement("div"); form.className = "rchan-filter-form";
    var sel = document.createElement("select");
    FILTER_TYPE_NAMES.forEach(function (nm, i3) {
      var o = document.createElement("option"); o.value = i3; o.textContent = nm; sel.appendChild(o);
    });
    sel.value = "3";                                   // Message: the common case
    var inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "pattern";
    inp.setAttribute("aria-label", "Filter pattern");
    var reLab = document.createElement("label"); reLab.className = "rchan-filter-relab";
    var re = document.createElement("input"); re.type = "checkbox";
    reLab.appendChild(re); reLab.appendChild(document.createTextNode("regex"));
    var add = document.createElement("button"); add.type = "button"; add.textContent = "Add";
    function doAdd() {
      var v = inp.value.trim();
      if (!v) { return; }
      if (re.checked) { try { new RegExp(v); } catch (e) { toast("Invalid regex", true); return; } }
      var cur = loadedFilters();
      cur.push({ filter: v, regex: re.checked, type: parseInt(sel.value, 10) });
      persistFilters(cur);
      inp.value = "";
      if (window.hiding && hiding.__rchanStub) { hiding.checkFilters(); } else { applyExtraFilters(); }
      buildFilterSection(box);
    }
    add.addEventListener("click", doAdd);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { doAdd(); } });
    form.appendChild(sel); form.appendChild(inp); form.appendChild(reLab); form.appendChild(add);
    box.appendChild(form);
  }

  /* ---------- Homepage: "Active threads" strip ----------
     Top threads by last bump across boards (boards list -> one catalog.json
     each, capped at 8 boards), rendered as cards under the board list. Makes
     the front page a destination instead of a signpost. */
  function buildActiveThreads() {
    if (!/^\/(index\.html)?$/.test(location.pathname)) { return; }
    var anchor = document.getElementById("divBoards");
    if (!anchor || document.getElementById("rchan-active")) { return; }
    fetch("/boards.js?json=1").then(function (r) { return r.json(); }).then(function (res) {
      var boards = ((res && res.data && res.data.boards) || []).slice(0, 8)
        .map(function (b) { return b.boardUri; });
      if (!boards.length) { return; }
      Promise.all(boards.map(function (b) {
        return fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); })
          .then(function (list) { return (list || []).map(function (t) { t.__b = b; return t; }); })
          .catch(function () { return []; });
      })).then(function (all) {
        var threads = Array.prototype.concat.apply([], all).sort(function (a, b2) {
          return (Date.parse(b2.lastBump) || 0) - (Date.parse(a.lastBump) || 0);
        }).slice(0, 6);
        if (!threads.length || document.getElementById("rchan-active")) { return; }
        var box = document.createElement("div"); box.id = "rchan-active";
        var head = document.createElement("div"); head.id = "rchan-active-head";
        head.textContent = "Active threads";
        box.appendChild(head);
        threads.forEach(function (t) {
          var a = document.createElement("a");
          a.className = "rchan-active-cell";
          a.href = "/" + t.__b + "/res/" + t.threadId;
          if (t.thumb) {
            var im = document.createElement("img");
            im.src = t.thumb; im.loading = "lazy"; im.alt = "";
            a.appendChild(im);
          }
          var txt = document.createElement("span"); txt.className = "rchan-active-text";
          var ttl = document.createElement("span"); ttl.className = "rchan-active-title";
          var label = (t.subject || t.message || ("Thread " + t.threadId)).replace(/\s+/g, " ").trim();
          ttl.textContent = "/" + t.__b + "/ · " + label.slice(0, 60);
          var meta = document.createElement("span"); meta.className = "rchan-active-meta";
          var bump = Date.parse(t.lastBump) || 0;
          meta.setAttribute("data-ts", bump);
          meta.setAttribute("data-r", t.postCount || 0);
          meta.textContent = (t.postCount || 0) + " replies" + (bump ? " · " + fmtAgo(bump) + " ago" : "");
          txt.appendChild(ttl); txt.appendChild(meta); a.appendChild(txt);
          box.appendChild(a);
        });
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
        setInterval(function () {                        // live time-ago ticker
          var metas = box.getElementsByClassName("rchan-active-meta");
          for (var i = 0; i < metas.length; i++) {
            var ts = parseInt(metas[i].getAttribute("data-ts"), 10);
            if (ts) { metas[i].textContent = metas[i].getAttribute("data-r") + " replies · " + fmtAgo(ts) + " ago"; }
          }
        }, 30000);
      });
    }).catch(function () {});
  }

  /* ---------- Post form: formatting toolbar, char counter, paste/drop, file previews ----------
     IMPORTANT: the engine uploads ONLY from postCommon.selectedFiles (its own
     array, rendered as .selectedCell chips) — it never reads input.files at
     submit, and its picker even wipes #inputFiles after consuming it. So every
     paste/drop we accept MUST go through postCommon.addSelectedFile; the
     DataTransfer/input.files path below is only a fallback for pages where
     postCommon isn't wired (it previously ATE dropped files silently). */
  var MAX_FILE = 32 * 1048576;   // maxFileSizeMB
  function nativeFilePipe() {
    return !!(window.postCommon && postCommon.addSelectedFile && postCommon.selectedDiv);
  }
  function engineAddFiles(files) {  // -> true when the engine's pipeline took them
    if (!nativeFilePipe()) { return false; }
    for (var i = 0; i < files.length; i++) {
      try { postCommon.addSelectedFile(files[i]); } catch (e) { return false; }
    }
    return true;
  }
  function collectPastedFiles(e) {
    var items = e.clipboardData && e.clipboardData.items, add = [];
    if (!items) { return add; }
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file") { var f = items[i].getAsFile(); if (f) { add.push(f); } }
    }
    return add;
  }
  function bytesHuman(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : n + " B"; }
  function mimeOk(input, file) {
    var acc = (input.getAttribute("accept") || "").toLowerCase().split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!acc.length) { return true; }
    var mime = (file.type || "").toLowerCase();
    return acc.some(function (a) { return a.slice(-2) === "/*" ? mime.indexOf(a.slice(0, -1)) === 0 : a === mime; });
  }
  function currentFiles(input) { return input.files ? Array.prototype.slice.call(input.files) : []; }
  function setFiles(input, arr) {
    try { var dt = new DataTransfer(); arr.forEach(function (f) { dt.items.add(f); }); input.files = dt.files; return true; }
    catch (e) { return false; }   // unsupported browser: leave as-is
  }
  function addFiles(input, files) { setFiles(input, currentFiles(input).concat(files)); renderTray(input); }
  function renderTray(input) {
    var tray = document.getElementById("rchan-filetray"); if (!tray) { return; }
    tray.innerHTML = "";
    currentFiles(input).forEach(function (f, idx) {
      var chip = document.createElement("div"); chip.className = "rchan-filechip";
      if (!(mimeOk(input, f) && f.size <= MAX_FILE)) { chip.classList.add("rchan-filebad"); chip.title = "Unsupported type or over 32 MB"; }
      if (/^image\//.test(f.type)) {
        var im = document.createElement("img"); im.src = URL.createObjectURL(f);
        im.onload = function () { URL.revokeObjectURL(im.src); }; chip.appendChild(im);
      }
      var meta = document.createElement("span"); meta.className = "rchan-filemeta";
      meta.textContent = f.name + " · " + bytesHuman(f.size); chip.appendChild(meta);
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-filex"; x.textContent = "×"; x.title = "Remove";
      x.addEventListener("click", function (ev) { ev.preventDefault(); var a = currentFiles(input); a.splice(idx, 1); setFiles(input, a); renderTray(input); });
      chip.appendChild(x); tray.appendChild(chip);
    });
  }
  function wrapSel(ta, pre, post) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e);
    ta.value = v.slice(0, s) + pre + sel + post + v.slice(e);
    ta.focus();
    var caret = sel ? s + pre.length + sel.length + post.length : s + pre.length;
    ta.setSelectionRange(sel ? caret : s + pre.length, caret);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function prefixLines(ta, prefix) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var ls = v.lastIndexOf("\n", s - 1) + 1, block = v.slice(ls, e) || v.slice(ls);
    var rep = block.replace(/^/gm, prefix);
    ta.value = v.slice(0, ls) + rep + v.slice(ls + block.length);
    ta.focus(); ta.setSelectionRange(ls, ls + rep.length);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  /* ---------- Live post preview ----------
     Client-side re-render of LynxChan's markup ('''b''' ''i'' **sp** ~~s~~
     ==red== [code] >green >>123 URLs) so what you see before posting is what
     lands. Reuses the site's real content classes (greenText, spoiler,
     quoteLink…) so the preview inherits every theme automatically. */
  function renderMarkup(src) {
    var esc = escHtml(src);
    var codes = [];                                              // protect [code] bodies from inline markup
    esc = esc.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, function (m, body) {
      codes.push(body); return "\u0000C" + (codes.length - 1) + "\u0000";
    });
    esc = esc
      .replace(/'''([\s\S]+?)'''/g, "<strong>$1</strong>")
      .replace(/''([\s\S]+?)''/g, "<em>$1</em>")
      .replace(/\*\*([\s\S]+?)\*\*/g, '<span class="spoiler">$1</span>')
      .replace(/~~([\s\S]+?)~~/g, "<s>$1</s>")
      .replace(/==([^\n=]+?)==/g, '<span class="redText">$1</span>')
      .replace(/&gt;&gt;&gt;\/(\w+)\/(\d*)/g, '<span class="quoteLink">&gt;&gt;&gt;/$1/$2</span>')
      .replace(/&gt;&gt;(\d+)/g, '<span class="quoteLink">&gt;&gt;$1</span>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    esc = esc.split("\n").map(function (l) {
      return /^&gt;(?!&gt;)/.test(l) ? '<span class="greenText">' + l + "</span>" : l;
    }).join("<br>");
    return esc.replace(/\u0000C(\d+)\u0000/g, function (m, i) { return "<code>" + codes[+i] + "</code>"; });
  }
  // Formatting toolbar for a message textarea (main post form + quick reply).
  function buildFmtBar(msg) {
    var bar = document.createElement("div"); bar.className = "rchan-fmtbar";
    // LynxChan markup: '''bold''' ''italic'' **spoiler** ~~strike~~ ==heading== [code] >greentext
    var FMT = [["B", "'''", "'''", "Bold"], ["I", "''", "''", "Italic"], ["Spoiler", "**", "**", "Spoiler"],
               ["S", "~~", "~~", "Strikethrough"], ["==", "==", "==", "Heading"], ["code", "[code]", "[/code]", "Code"]];
    FMT.forEach(function (f) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = f[0]; b.title = f[3];
      if (f[3] === "Strikethrough") { b.style.textDecoration = "line-through"; }  // CSS, not a combining char
      else if (f[3] === "Italic") { b.style.fontStyle = "italic"; }
      b.addEventListener("click", function (ev) { ev.preventDefault(); wrapSel(msg, f[1], f[2]); });
      bar.appendChild(b);
    });
    var qb = document.createElement("button"); qb.type = "button"; qb.textContent = ">"; qb.title = "Greentext";
    qb.addEventListener("click", function (ev) { ev.preventDefault(); prefixLines(msg, ">"); }); bar.appendChild(qb);
    // live preview toggle: rendered pane right under the textarea
    var pvBox = null;
    var pv = document.createElement("button"); pv.type = "button"; pv.textContent = "Preview";
    pv.title = "Live preview of the rendered post";
    pv.setAttribute("aria-pressed", "false");
    function pvUpdate() {
      if (!pvBox || pvBox.style.display === "none") { return; }
      var v = msg.value;
      pvBox.innerHTML = v.trim() ? renderMarkup(v) : '<span class="rchan-pv-empty">Nothing to preview yet</span>';
    }
    pv.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (!pvBox) {
        pvBox = document.createElement("div"); pvBox.className = "rchan-preview";
        msg.parentNode.insertBefore(pvBox, msg.nextSibling);
      }
      var show = pvBox.style.display === "none" || !pvBox.firstChild;
      pvBox.style.display = show ? "block" : "none";
      pv.classList.toggle("rchan-pvon", show);
      pv.setAttribute("aria-pressed", show ? "true" : "false");
      pvUpdate();
    });
    bar.appendChild(pv);
    var count = document.createElement("span"); count.className = "rchan-charcount"; bar.appendChild(count);
    var upd = function () { count.textContent = msg.value.length + " chars"; pvUpdate(); };
    msg.addEventListener("input", upd); upd();
    return bar;
  }
  // Quick Reply is built lazily by qr.js (innerHTML); the MutationObserver-driven
  // refresh() lands here once #qrbody exists. wrapSel/prefixLines dispatch an
  // "input" event, which qr.js's registerSync mirrors into #fieldMessage.
  function enhanceQuickReply() {
    var ta = document.getElementById("qrbody");
    if (!ta || ta.getAttribute("data-fmt")) { return; }
    ta.setAttribute("data-fmt", "1");
    ta.parentNode.insertBefore(buildFmtBar(ta), ta);
    // paste an image straight into the QR textarea
    ta.addEventListener("paste", function (e) {
      var add = collectPastedFiles(e);
      if (add.length) { engineAddFiles(add); }
    });
    // and accept drops anywhere on the QR panel, not just its little dropzone
    var panel = document.getElementById("quick-reply");
    if (panel && !panel.getAttribute("data-drop")) {
      panel.setAttribute("data-drop", "1");
      panel.addEventListener("dragover", function (e) { e.preventDefault(); });
      panel.addEventListener("drop", function (e) {
        e.preventDefault();
        var fs = e.dataTransfer && e.dataTransfer.files;
        if (fs && fs.length) { engineAddFiles(Array.prototype.slice.call(fs)); }
      });
    }
  }

  /* ---------- Poster ID pills (boards with IDs on) ----------
     LynxChan IDs are 6 hex chars — use the ID itself as the pill colour,
     text black/white by luminance. Click-to-highlight + hover post count are
     native (posting.processIdLabel swaps .innerPost -> .markedPost); the CSS
     side makes .markedPost actually visible in our themes. */
  function decorateIdPills(root) {
    var ids = (root || document).getElementsByClassName("labelId");
    for (var i = 0; i < ids.length; i++) {
      var el = ids[i];
      if (el.getAttribute("data-pill")) { continue; }
      el.setAttribute("data-pill", "1");
      var id = (el.textContent || "").trim();
      var c;
      if (/^[0-9a-f]{6}$/i.test(id)) { c = id.toLowerCase(); }
      else {                                       // non-hex ID: stable hash -> colour
        var h = 0;
        for (var j = 0; j < id.length; j++) { h = (h * 31 + id.charCodeAt(j)) >>> 0; }
        c = ("00000" + (h & 0xffffff).toString(16)).slice(-6);
      }
      // Mute the raw ID colour (the engine inlines background:#<id>, which is
      // often neon): keep the HUE so IDs stay distinguishable, but cap
      // saturation and pin lightness to a soft band that sits with the cream
      // palette. Our style assignment overwrites the engine's inline value.
      var r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      var h = 0;
      if (d) {
        if (max === r) { h = ((g - b) / d) % 6; }
        else if (max === g) { h = (b - r) / d + 2; }
        else { h = (r - g) / d + 4; }
        h = Math.round(h * 60); if (h < 0) { h += 360; }
      }
      // Only the HUE is per-ID; each theme renders it at its own muted
      // saturation/lightness via CSS (see body .labelId / .theme_dark
      // .labelId), so pills sit on-palette in cream AND dark. The CSS
      // !important also beats the engine's inline neon background-color.
      el.classList.add("rchan-idpill");
      el.style.setProperty("--idh", h);
      el.style.backgroundColor = "";                       // drop the engine's inline neon
      // funnel: one-click "show only this ID" via the find-in-thread bar
      if (curThreadId() && !el.closest(".rchan-inline-quote") && !el.closest(".quoteTooltip")) {
        var fn = document.createElement("button");
        fn.type = "button"; fn.className = "rchan-idfunnel";
        fn.innerHTML = SVG_FUNNEL;
        fn.setAttribute("data-tooltip", "Show only this ID");
        fn.setAttribute("aria-label", "Show only posts by ID " + id);
        fn.addEventListener("click", (function (idText) {
          return function (ev) { ev.preventDefault(); ev.stopPropagation(); toggleFind("id:" + idText); };
        })(id.toLowerCase()));
        el.parentNode.insertBefore(fn, el.nextSibling);
      }
    }
  }
  /* ---------- Admin-only flag override (cosmetic half — the ENFORCEMENT is the
     flagoverride addon server-side). LynxChan serves one cached page to every
     role, so per-role markup can't be server-rendered; instead the dropdown is
     built only after /account.js confirms globalRole <= 1. A normal poster
     never gets the control, and hand-crafting the field is rejected by the
     addon's role check anyway. ---------- */
  function buildFlagOverride(form, msg) {
    if (document.getElementById("rchan-flagoverride")) { return; }
    fetch("/account.js?json=1").then(function (r) { return r.json(); }).then(function (acc) {
      if (!acc || acc.status !== "ok" || !acc.data) { return; }
      if (typeof acc.data.globalRole !== "number" || acc.data.globalRole > 1) { return; }
      document.body.classList.add("rchan-staff");   // reveals staff-only controls (e.g. "No location")
      try { refresh(); } catch (e0) {}              // class flip is an attribute change — the childList observer won't fire
      try { decorateQuickMod(document); } catch (e1) {}
      if (document.getElementById("rchan-flagoverride")) { return; }
      fetch("/.rchan/flags.json").then(function (r) { return r.json(); }).then(function (codes) {
        var names; try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { names = null; }
        var row = document.createElement("div"); row.id = "rchan-flagrow";
        row.appendChild(document.createTextNode("Flag "));
        var sel = document.createElement("select"); sel.id = "rchan-flagoverride"; sel.name = "flagOverride";
        var auto = document.createElement("option"); auto.value = ""; auto.textContent = "Auto";
        sel.appendChild(auto);
        var natives = document.getElementById("flagCombobox");   // board custom flags (native field)
        if (natives && natives.options.length > 1) {
          var gB = document.createElement("optgroup"); gB.label = "Board flags";
          for (var i = 0; i < natives.options.length; i++) {
            var no = natives.options[i]; if (!no.value) { continue; }
            var ob = document.createElement("option"); ob.value = "b:" + no.value; ob.textContent = no.textContent;
            gB.appendChild(ob);
          }
          sel.appendChild(gB);
        }
        var gC = document.createElement("optgroup"); gC.label = "Countries";
        (codes || []).map(function (c) {
          var C = c.toUpperCase(), n = C;
          try { n = (names && names.of(C)) || C; } catch (e2) {}
          return { c: C, n: n };
        }).sort(function (a, b) { return a.n < b.n ? -1 : 1; }).forEach(function (o) {
          var op = document.createElement("option"); op.value = o.c; op.textContent = o.n;
          gC.appendChild(op);
        });
        sel.appendChild(gC);
        sel.addEventListener("change", function () {
          var v = sel.value;
          if (natives) { natives.value = v.indexOf("b:") === 0 ? v.slice(2) : ""; }
          // country codes ride the XHR hook; b: values only set the native combobox
        });
        row.appendChild(sel);
        (msg ? msg.parentNode : form).insertBefore(row, msg || null);
      }).catch(function () {});
    }).catch(function () {});
  }

  function enhancePostForm() {
    var form = document.getElementById("postingForm");
    if (!form || form.getAttribute("data-enh")) { return; }
    var msg = document.getElementById("fieldMessage");
    var input = document.getElementById("inputFiles");
    if (!msg && !input) { return; }
    form.setAttribute("data-enh", "1");
    buildFlagOverride(form, msg);

    // Collapsible posting form with a slide animation. The toggle sits *before* #postingForm
    // (so it survives the collapse and dodges the "#postingForm button" sizing). Collapse is a
    // grid-template-rows 1fr->0fr transition (animates true auto height); state is persisted.
    var COLLAPSE_KEY = "rchan_form_collapsed";
    var tog = document.createElement("button");
    tog.type = "button"; tog.id = "rchan-formtoggle";
    form.parentNode.insertBefore(tog, form);
    form.classList.add("rchan-form");
    var setCollapsed = function (c) {
      form.classList.toggle("rchan-collapsed", c);
      var L = formLabels();
      tog.textContent = c ? L.show : L.hide;
      tog.setAttribute("aria-expanded", c ? "false" : "true");
    };
    function slideToggle() {
      var collapse = !form.classList.contains("rchan-collapsed");   // visible now → collapse
      setCollapsed(collapse);
      try { collapse ? localStorage.setItem(COLLAPSE_KEY, "1") : localStorage.removeItem(COLLAPSE_KEY); } catch (e) {}
    }

    /* On board/catalog pages (no native quick reply there — qr.js is thread-only)
       the toggle opens the REAL posting form in a floating draggable/resizable
       box instead of sliding it inline; an "Original Form" link underneath keeps
       the classic slide-out behaviour. The form element itself is MOVED (not
       cloned), so captcha, file tray and fmtbar keep working. */
    var inThread = /\/res\//.test(location.pathname);
    var qrBox = null, origLink = null;
    function closeFloatForm() {
      if (!qrBox) { return; }
      qrBox.style.display = "none";
      if (form.parentNode !== origLink.parentNode) {
        origLink.parentNode.insertBefore(form, origLink.nextSibling);  // put it back under the links
      }
      setCollapsed(true);
    }
    function openFloatForm() {
      if (!qrBox) {
        qrBox = document.createElement("div"); qrBox.id = "rchan-qr";
        var head = document.createElement("div"); head.id = "rchan-qr-header";
        var ttl = document.createElement("span"); ttl.textContent = "New Thread";
        var x = document.createElement("button"); x.type = "button"; x.id = "rchan-qr-close"; x.textContent = "✕"; x.title = "Close";
        x.addEventListener("click", closeFloatForm);
        head.appendChild(ttl); head.appendChild(x);
        qrBox.appendChild(head);
        var bodyDiv = document.createElement("div"); bodyDiv.id = "rchan-qr-body";
        qrBox.appendChild(bodyDiv);
        document.body.appendChild(qrBox);
        (function () {                                            // drag by the header
          var drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
          head.addEventListener("mousedown", function (e) {
            if (e.target === x) { return; }
            drag = true; sx = e.clientX; sy = e.clientY;
            var r = qrBox.getBoundingClientRect(); ox = r.left; oy = r.top;
            e.preventDefault();
          });
          document.addEventListener("mousemove", function (e) {
            if (!drag) { return; }
            qrBox.style.left = (ox + e.clientX - sx) + "px";
            qrBox.style.top = (oy + e.clientY - sy) + "px";
            qrBox.style.right = "auto";
          });
          document.addEventListener("mouseup", function () { drag = false; });
        })();
      }
      document.getElementById("rchan-qr-body").appendChild(form); // move the real form in
      form.classList.remove("rchan-collapsed");
      qrBox.style.display = "block";
      if (msg) { msg.focus(); }
    }
    // "Original Form" link (all pages): slides the classic inline form out.
    origLink = document.createElement("a");
    origLink.id = "rchan-origform"; origLink.href = "#"; origLink.textContent = "Original Form";
    form.parentNode.insertBefore(origLink, form);
    origLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (qrBox && qrBox.style.display === "block") {           // pull it out of the float
        qrBox.style.display = "none";
        origLink.parentNode.insertBefore(form, origLink.nextSibling);
        setCollapsed(false);
        return;
      }
      slideToggle();
    });
    if (!inThread) {
      tog.addEventListener("click", openFloatForm);             // our floating new-thread box
    } else {
      tog.addEventListener("click", function () {               // native floating quick reply
        var q = window.qr;
        if (q && q.qrPanel) {
          q.qrPanel.style.display = "block";                    // qr.showQr minus the ">>quote" insert
          if (q.qrPanel.getBoundingClientRect().top < 0) { q.qrPanel.style.top = "25px"; }
          var b = document.getElementById("qrbody");
          if (b) { b.focus(); }
        } else { slideToggle(); }                               // qr.js missing -> classic slide
      });
    }
    // start collapsed everywhere: the button's primary action is the floating box
    form.style.transition = "none"; setCollapsed(true); void form.offsetHeight; form.style.transition = "";
    if (msg) {
      msg.parentNode.insertBefore(buildFmtBar(msg), msg);
      if (input) {
        msg.addEventListener("paste", function (e) {
          var add = collectPastedFiles(e);
          if (add.length && !engineAddFiles(add)) { addFiles(input, add); }
        });
      }
    }
    if (input) {
      // drops anywhere on the form feed the engine's pipeline (the native
      // dropzone stopPropagation()s its own drops, so no double-add there)
      form.addEventListener("dragover", function (e) { e.preventDefault(); form.classList.add("rchan-dragover"); });
      form.addEventListener("dragleave", function (e) { if (e.target === form) { form.classList.remove("rchan-dragover"); } });
      form.addEventListener("drop", function (e) {
        e.preventDefault(); form.classList.remove("rchan-dragover");
        var fs = e.dataTransfer && e.dataTransfer.files;
        if (!fs || !fs.length) { return; }
        var arr = Array.prototype.slice.call(fs);
        if (!engineAddFiles(arr)) { addFiles(input, arr); }
      });
      // custom chip tray ONLY as the fallback UI — with the native pipeline the
      // engine renders its own .selectedCell chips (and resets input.files)
      if (!nativeFilePipe()) {
        var tray = document.createElement("div"); tray.id = "rchan-filetray"; tray.className = "rchan-filetray";
        (input.parentNode || form).appendChild(tray);
        input.addEventListener("change", function () { renderTray(input); });
        renderTray(input);
      }
    }
  }

  /* ---------- Unified settings panel (gear in the nav column) + "?" cheat-sheet ----------
     Every rchan toggle in ONE discoverable place. Feature guards read setOn()
     at event time, so changes apply instantly — no reload. Two rows bridge
     NATIVE storage (relativeTime, rchan_notify) instead of duplicating it. */
  var SET_NS = "rchan_set_";
  function setOn(k, def) {                             // def defaults to true; pass false for opt-in features
    try { var v = localStorage.getItem(SET_NS + k); return v === null ? def !== false : v === "1"; }
    catch (e) { return def !== false; }
  }
  function setPut(k, on) { try { localStorage.setItem(SET_NS + k, on ? "1" : "0"); } catch (e) {} }
  function syncBell(on) {
    var b = document.getElementById("rchan-bellbtn");
    if (b) { b.classList.toggle("rchan-on", on); }
  }
  var SET_ROWS = [
    { k: "hoverzoom", t: "Image hover zoom", d: "Full-size floating preview while hovering a thumbnail" },
    { k: "vidpop", t: "Video hover pop-out", d: "Muted autoplay preview while hovering a video thumbnail" },
    { k: "catprev", t: "Catalog thread previews", d: "Last replies shown when hovering (or tapping) a catalog card" },
    { k: "inlinequote", t: "Inline quote expansion", d: "Click a >>quote to embed the post instead of jumping to it" },
    { k: "keys", t: "Keyboard shortcuts", d: "j/k posts · t/b top/bottom · c catalog · r reply — press ? for the full list" },
    { k: "drafts", t: "Draft autosave", d: "Keep unposted reply text per thread until it's posted" },
    { k: "filterrecurse", t: "Hide replies to filtered posts", d: "Collapse posts that quote a filtered or hidden post" },
    { k: "banners", t: "Board banners", d: "Rotating banner above the board title (boards that have banners uploaded)" },
    { k: "vidpopsound", def: false, t: "Sound on video hover", d: "Unmute the floating hover preview — volume follows your saved level" },
    { k: "yousound", def: false, t: "Sound on replies to you", d: "Short chime when a new post quotes one of yours" },
    { t: "Board accent colors", d: "Each board tints its title with its own stable hue",
      get: function () { return setOn("accent"); },
      set: function (on) { setPut("accent", on); applyBoardAccent(); } },
    { t: "Loop videos", d: "Restart videos when they end (native players)",
      get: function () { try { return !JSON.parse(localStorage.noAutoLoop || "false"); } catch (e) { return true; } },
      set: function (on) {
        try { localStorage.noAutoLoop = JSON.stringify(!on); } catch (e) {}
        var vids = document.getElementsByTagName("video");
        for (var i = 0; i < vids.length; i++) {
          if (vids[i].id !== "rchan-vidzoom") { vids[i].loop = on; }
        }
      } },
    { t: "Relative timestamps", d: "“14 minutes ago” next to post dates",
      get: function () { try { return JSON.parse(localStorage.relativeTime || "true"); } catch (e) { return true; } },
      set: function (on) {
        try { localStorage.relativeTime = on ? "true" : "false"; } catch (e) {}
        if (on) { enableRelativeTimes(); return; }
        if (relTimer) { clearInterval(relTimer); relTimer = null; }
        var els = document.getElementsByClassName("relativeTime");
        for (var i = els.length - 1; i >= 0; i--) { els[i].parentNode.removeChild(els[i]); }
      } },
    { t: "Desktop notifications", d: "System notification when a hidden tab gets replies — this thread or any watched thread (same as the bell button)",
      get: function () { try { return localStorage.getItem(NOTIFY_KEY) === "1"; } catch (e) { return false; } },
      set: function (on, report) {
        if (!on) {
          try { localStorage.removeItem(NOTIFY_KEY); } catch (e) {}
          syncBell(false); if (report) { report(false); }
          return;
        }
        if (!("Notification" in window)) { toast("This browser doesn't support notifications", true); if (report) { report(false); } return; }
        Notification.requestPermission().then(function (p) {
          var ok = p === "granted";
          if (ok) { try { localStorage.setItem(NOTIFY_KEY, "1"); } catch (e) {} }
          else { toast("Notifications are blocked by the browser", true); }
          syncBell(ok); if (report) { report(ok); }
        });
      } }
  ];
  /* ---------- Backup / restore: the user's whole rchan identity ----------
     Everything accumulated ((You)s, watched, history, filters, drafts,
     settings…) lives in localStorage — one cleared cache and it's gone.
     Export writes every rchan_* key + the native keys to a JSON file;
     import MERGES (union arrays, keep-newest maps) so restoring on a
     second device adds to it instead of clobbering it. */
  var EXPORT_NATIVE = ["filterData", "hidingData", "watchedData", "relativeTime",
                       "localTime", "selectedTheme", "noAutoLoop", "deletionPassword", "postingPasswords"];
  function exportData() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("rchan_") === 0) { out[k] = localStorage.getItem(k); }
      }
      EXPORT_NATIVE.forEach(function (k2) {
        var v = localStorage.getItem(k2);
        if (v !== null) { out[k2] = v; }
      });
    } catch (e) { toast("Couldn't read local data", true); return; }
    var blob = new Blob([JSON.stringify({ rchanBackup: 1, exported: new Date().toISOString(), data: out })],
                        { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rchan-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    okToast("Backup downloaded");
  }
  function mergeJson(k, oldRaw, newRaw) {
    try {
      var a = JSON.parse(oldRaw), b = JSON.parse(newRaw);
      if (Array.isArray(a) && Array.isArray(b)) {
        if (k === "rchan_hist") {                      // newest-first, dedup by board/thread
          var seen = {};
          var all = b.concat(a).filter(function (e) {
            var kk = e && (e.b + "/" + e.t);
            if (!kk || seen[kk]) { return false; }
            seen[kk] = 1; return true;
          }).sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
          return JSON.stringify(all.slice(0, HIST_MAX));
        }
        if (k === "filterData") {                      // dedup by (type, pattern, regex)
          var have = {}, outArr = a.slice();
          a.forEach(function (f) { have[f.type + "|" + f.filter + "|" + !!f.regex] = 1; });
          b.forEach(function (f) {
            if (!have[f.type + "|" + f.filter + "|" + !!f.regex]) { outArr.push(f); }
          });
          return JSON.stringify(outArr);
        }
        var u = a.slice();                             // generic array (rchan_you): union
        b.forEach(function (v) { if (u.indexOf(v) < 0) { u.push(v); } });
        return JSON.stringify(u);
      }
      if (a && b && typeof a === "object" && typeof b === "object") {
        if (k === "rchan_seen") {                      // keep whichever read further
          Object.keys(b).forEach(function (kk) {
            if (!a[kk] || (b[kk].maxId || 0) > (a[kk].maxId || 0)) { a[kk] = b[kk]; }
          });
          return JSON.stringify(a);
        }
        if (k === "hidingData") {                      // per-board union of threads/posts
          Object.keys(b).forEach(function (bd) {
            if (!a[bd]) { a[bd] = b[bd]; return; }
            ["threads", "posts"].forEach(function (f2) {
              var cur = a[bd][f2] = a[bd][f2] || [];
              (b[bd][f2] || []).forEach(function (v) { if (cur.indexOf(v) < 0) { cur.push(v); } });
            });
          });
          return JSON.stringify(a);
        }
        Object.keys(b).forEach(function (kk) { if (!(kk in a)) { a[kk] = b[kk]; } });
        return JSON.stringify(a);
      }
    } catch (e) {}
    return newRaw;                                     // scalars / mismatch: imported wins
  }
  function importData(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var parsed = JSON.parse(fr.result);
        if (!parsed || parsed.rchanBackup !== 1 || !parsed.data) { toast("Not an rchan backup file", true); return; }
        var d = parsed.data, n = 0;
        Object.keys(d).forEach(function (k) {
          if (k.indexOf("rchan_") !== 0 && EXPORT_NATIVE.indexOf(k) < 0) { return; }   // whitelist only
          if (typeof d[k] !== "string") { return; }
          var cur = localStorage.getItem(k);
          try { localStorage.setItem(k, cur === null ? d[k] : mergeJson(k, cur, d[k])); n++; } catch (e) {}
        });
        okToast("Restored " + n + " entries — reloading");
        setTimeout(function () { location.reload(); }, 900);
      } catch (e) { toast("Couldn't read that backup file", true); }
    };
    fr.readAsText(file);
  }

  var setPanel = null;
  function buildSetRow(row) {
    var lab = document.createElement("label"); lab.className = "rchan-set-row";
    var txt = document.createElement("span"); txt.className = "rchan-set-text";
    var t = document.createElement("span"); t.className = "rchan-set-title"; t.textContent = row.t;
    var d = document.createElement("span"); d.className = "rchan-set-desc"; d.textContent = row.d;
    txt.appendChild(t); txt.appendChild(d);
    var cb = document.createElement("input"); cb.type = "checkbox";
    cb.checked = row.get ? !!row.get() : setOn(row.k, row.def);
    cb.addEventListener("change", function () {
      if (row.set) { row.set(cb.checked, function (v) { cb.checked = !!v; }); }
      else { setPut(row.k, cb.checked); }
    });
    lab.appendChild(txt); lab.appendChild(cb);
    return lab;
  }
  function setFootLink(text, fn) {
    var a = document.createElement("a"); a.href = "#"; a.textContent = text;
    a.addEventListener("click", function (e) { e.preventDefault(); fn(); });
    return a;
  }
  function toggleSetPanel() {
    if (setPanel && setPanel.style.display === "block") { setPanel.style.display = "none"; return; }
    if (!setPanel) {
      setPanel = document.createElement("div"); setPanel.id = "rchan-set";
      setPanel.setAttribute("role", "dialog"); setPanel.setAttribute("aria-label", "Site settings");
      var head = document.createElement("div"); head.className = "rchan-set-head";
      var ttl = document.createElement("span"); ttl.textContent = "Site settings";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Close"; x.setAttribute("aria-label", "Close settings");
      x.addEventListener("click", function () { setPanel.style.display = "none"; });
      head.appendChild(ttl); head.appendChild(x);
      setPanel.appendChild(head);
      setPanel.appendChild(document.createElement("div"));       // rows container
      setPanel.appendChild(document.createElement("div"));       // filter manager container
      var foot = document.createElement("div"); foot.className = "rchan-set-foot";
      foot.appendChild(setFootLink("Keyboard shortcuts (?)", function () { setPanel.style.display = "none"; toggleKeysOverlay(); }));
      var eng = document.getElementById("settingsButton");        // native menu: filters / custom CSS / JS
      if (eng) {
        foot.appendChild(setFootLink("Filters & engine settings", function () { setPanel.style.display = "none"; eng.click(); }));
      }
      foot.appendChild(setFootLink("Backup data", exportData));
      var restoreInput = document.createElement("input");
      restoreInput.type = "file"; restoreInput.accept = ".json,application/json";
      restoreInput.style.display = "none";
      restoreInput.addEventListener("change", function () {
        if (restoreInput.files && restoreInput.files[0]) { importData(restoreInput.files[0]); }
        restoreInput.value = "";
      });
      foot.appendChild(setFootLink("Restore", function () { restoreInput.click(); }));
      foot.appendChild(restoreInput);
      setPanel.appendChild(foot);
      document.body.appendChild(setPanel);
      document.addEventListener("click", function (ev) {          // click-away closes
        if (setPanel.style.display !== "block") { return; }
        var t2 = ev.target;
        if (setPanel.contains(t2) || (t2.closest && t2.closest("#rchan-nav"))) { return; }
        setPanel.style.display = "none";
      }, true);
    }
    var list = setPanel.children[1];                              // rebuild → checkboxes reflect live state
    list.innerHTML = "";
    SET_ROWS.forEach(function (row) { list.appendChild(buildSetRow(row)); });
    buildFilterSection(setPanel.children[2]);
    setPanel.style.display = "block";
  }
  /* "?" cheat-sheet overlay (works even with shortcuts toggled off) */
  var KEYS_LIST = [
    ["j / k", "Next / previous post"],
    ["← / →", "Previous / next post with a file"],
    ["e", "Expand / collapse the selected post's image"],
    ["t", "Jump to top"],
    ["b", "Jump to bottom"],
    ["c", "Toggle catalog ↔ index view"],
    ["r", "Focus the reply box"],
    ["f", "Filter posts in the thread"],
    ["?", "This cheat-sheet"],
    ["Esc", "Close panels · collapse the expanded image"]
  ];
  var keysOverlay = null;
  function toggleKeysOverlay() {
    if (keysOverlay && keysOverlay.style.display === "flex") { keysOverlay.style.display = "none"; return; }
    if (!keysOverlay) {
      keysOverlay = document.createElement("div"); keysOverlay.id = "rchan-keys";
      keysOverlay.setAttribute("role", "dialog"); keysOverlay.setAttribute("aria-label", "Keyboard shortcuts");
      var box = document.createElement("div"); box.className = "rchan-keys-box";
      var head = document.createElement("div"); head.className = "rchan-set-head";
      var ttl = document.createElement("span"); ttl.textContent = "Keyboard shortcuts";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Close"; x.setAttribute("aria-label", "Close shortcuts");
      x.addEventListener("click", function () { keysOverlay.style.display = "none"; });
      head.appendChild(ttl); head.appendChild(x);
      box.appendChild(head);
      var list = document.createElement("div"); list.className = "rchan-keys-list";
      box.appendChild(list);
      keysOverlay.appendChild(box);
      keysOverlay.addEventListener("click", function (e) {        // backdrop click closes
        if (e.target === keysOverlay) { keysOverlay.style.display = "none"; }
      });
      document.body.appendChild(keysOverlay);
    }
    var list2 = keysOverlay.firstChild.lastChild;                 // rebuilt each open (rows grow with features)
    list2.innerHTML = "";
    KEYS_LIST.forEach(function (k) {
      var row = document.createElement("div"); row.className = "rchan-keys-row";
      var kbd = document.createElement("kbd"); kbd.textContent = k[0];
      var lbl = document.createElement("span"); lbl.textContent = k[1];
      row.appendChild(kbd); row.appendChild(lbl);
      list2.appendChild(row);
    });
    keysOverlay.style.display = "flex";
  }
  function onEscKey(e) {
    if (e.key !== "Escape") { return; }
    if (keysOverlay && keysOverlay.style.display === "flex") { keysOverlay.style.display = "none"; return; }
    if (convRoot) { closeConv(); return; }
    if (findBar && findBar.style.display === "flex") { closeFind(); return; }
    if (setPanel && setPanel.style.display === "block") { setPanel.style.display = "none"; return; }
    if (histPanel && histPanel.style.display === "block") { histPanel.style.display = "none"; return; }
    if (kbCurEl && document.contains(kbCurEl)) {         // collapse the selected post's expanded image
      var inner = kbCurEl.querySelector(".innerPost, .innerOP");
      var exp = inner && inner.querySelector(".imgExpanded");
      if (exp && exp.style.display !== "none") {
        var a = findImgLink(kbCurEl);
        if (a) { a.click(); }
      }
    }
  }

  /* ---------- init + observe ---------- */
  var pending = false;
  function refresh() { if (pending) { return; } pending = true; setTimeout(function () { pending = false; decorateYou(document); decorateIcons(document); decorateThumbs(document); decorateIdPills(document); decorateFileSearch(document); decorateSideCatalog(); markNewInThread(); scanRepliesToYou(); enhancePostForm(); enhanceQuickReply(); initDrafts(); hookQrDraft(); patchShowQr(); tryFlashOwnPost(); updateThreadStat(); tidyWatcherBadge(); applyFind(); applyConv(); decorateConvButtons(document); decorateReportButtons(document); decorateQuickMod(document); decorateGets(document); applyExtraFilters(); syncEmptyState(); if (expandAllOn) { setExpandAll(true); } }, 80); }
  // native watcher renders its unread count as "(3)" text — strip the parens
  // so the CSS badge (#watcherButton span) reads as a clean red counter
  function tidyWatcherBadge() {
    var wc = document.querySelector("#watcherButton span");
    if (wc && wc.textContent.indexOf("(") > -1) { wc.textContent = wc.textContent.replace(/[()]/g, ""); }
  }
  function init() {
    // Bind interaction listeners FIRST, so a throw in any decorate/build step below
    // can never leave hover-zoom / video-pop-out / tooltips unwired.
    document.addEventListener("mouseover", onCatHover, true);
    // catalog last-replies hover preview
    document.addEventListener("mouseover", onCatPrevOver, true);
    document.addEventListener("mouseout", onCatPrevOut, true);
    document.addEventListener("scroll", hideCatPreview, true);
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseout", onOut, true);
    // video hover-to-play pop-out preview
    document.addEventListener("mouseover", onVidOver, true);
    document.addEventListener("mouseout", onVidOut, true);
    // clicking a thumb expands it in place (thumb swapped out under a stationary cursor,
    // so no fresh mouseover fires) — drop the floating previews so they never stick.
    document.addEventListener("click", hideZoom, true);
    document.addEventListener("click", hideVidZoom, true);
    // inline quote expansion (click a >>quote) + touch catalog tap-preview
    document.addEventListener("click", onQuoteClick, true);
    document.addEventListener("click", onCatTap, true);
    // instant styled tooltips for [data-tooltip] icons
    document.addEventListener("mouseover", onTipOver, true);
    document.addEventListener("mouseout", onTipOut, true);
    document.addEventListener("focusin", onTipOver, true);
    document.addEventListener("focusout", hideTip, true);
    document.addEventListener("scroll", hideTip, true);
    document.addEventListener("click", hideTip, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onEscKey);
    // arm the WebAudio context inside a real user gesture so later chimes can play
    document.addEventListener("pointerdown", armAudio, { once: true, capture: true });
    document.addEventListener("keydown", armAudio, { once: true, capture: true });
    // remember hide-menu clicks so hookHideUndo can tell user hides from
    // the silent stored-hide re-application at load/refresh
    document.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".hideMenu")) { lastHideClick = Date.now(); }
    }, true);
    // keep the pre-paint dark hint (html.predark, set by an inline head script the
    // router injects) in sync when the user switches themes mid-session
    try { if (!/theme_dark/.test(document.body.className)) { document.documentElement.classList.remove("predark"); } } catch (e) {}
    document.addEventListener("change", function (e) {
      if (e.target && e.target.id === "themeSelector") {
        try { document.documentElement.classList.toggle("predark", localStorage.selectedTheme === "dark"); } catch (e2) {}
      }
    });
    // Enhancers — each guarded so one failure can't cascade and kill the rest (or the listeners above).
    [buildNav, buildCatalogTools, hookDeepSearch, function () { decorateIcons(document); }, function () { decorateThumbs(document); },
     function () { decorateYou(document); }, markNewInThread, markNewInCatalog, scanRepliesToYou, enhancePostForm, enhanceQuickReply,
     hookAlerts, hookCaptchaReload, initCaptchaLifecycle, hookFilterStubs, hookHideUndo, hookWatcherNotify, initDrafts, hookQrDraft, patchShowQr, enableRelativeTimes, recordVisit, initScrollResume, initPresence, initBoardLiveness, hookVolumePersistence,
     function () { decorateIdPills(document); }, function () { decorateFileSearch(document); }, decorateSideCatalog, updateThreadStat, buildFindButton, buildExpandButton, buildBanner, syncEmptyState, applyBoardAccent,
     function () { decorateConvButtons(document); }, function () { decorateReportButtons(document); },
     function () { decorateGets(document); }, buildActiveThreads
    ].forEach(function (fn) { try { fn(); } catch (e) { if (window.console) { console.error("[ux] init step failed", e); } } });
    if (curThreadId()) { setInterval(function () { try { updateThreadStat(); } catch (e) {} }, 30000); }  // keep "updated X ago" ticking
    try { new MutationObserver(refresh).observe(document.documentElement, { subtree: true, childList: true }); } catch (e) {}
  }
  // PWA: register the (cache-free) service worker so the site is installable.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/.rchan/sw.js", { scope: "/" }).catch(function () {});
    });
  }

  hookPostCapture(); // wrap request APIs early, before any post is sent
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
