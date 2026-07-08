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
  // The overboard is a pseudo-board: no catalog.json, no res/<id>.json, no
  // posting form. Board-scoped features that fetch those must step aside.
  function isOverboard(b) { return b === "overboard"; }
  function toggleCatalog() {
    var b = getBoard();
    if (!b || b.charAt(0) === "." || isOverboard(b)) { return; }   // overboard has no catalog view
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
    if (getBoard() && !isOverboard(getBoard())) {
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
    var SVG_INBOX = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>';
    var inbox = btn(SVG_INBOX + "<span></span>", "Replies to your posts", toggleYoubox);
    inbox.id = "rchan-youboxbtn";
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
  // Auto-watch: posting in a thread (or creating one) adds it to the native
  // watcher, so the whole notification pipeline fires without the manual
  // bell click. Default ON, toggleable in settings.
  function autoWatch(board, threadId, label) {
    if (!setOn("autowatch") || !board || !threadId) { return; }
    try {
      var wd = JSON.parse(localStorage.watchedData || "{}");
      if (wd[board] && wd[board][threadId]) { return; }            // already watched
      var now = Date.now();
      // native addWatchedCell innerHTMLs the label — escape like the native watch button does
      var rec = { lastSeen: now, lastReplied: now, label: escHtml(String(label || "").slice(0, 70)) || null };
      (wd[board] = wd[board] || {})[threadId] = rec;
      localStorage.watchedData = JSON.stringify(wd);
      if (window.watcher && watcher.addWatchedCell) {              // render the menu cell live
        try { watcher.addWatchedCell(board, String(threadId), rec); } catch (e2) {}
      }
    } catch (e) {}
  }
  function addYou(id) {
    id = String(id).replace(/\D/g, "");
    if (!id) { return; }
    clearDraft();                                   // post landed — the draft served its purpose
    flashId = id; flashDeadline = Date.now() + 20000;
    var a = load(YOU_KEY);
    if (a.indexOf(id) < 0) { a.push(id); save(YOU_KEY, a); refresh(); }
    var t = curThreadId();
    if (t) { autoWatch(getBoard(), t, threadTitle()); }
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
  // Label for a just-created thread (subject field, else message snippet)
  function newThreadLabel() {
    var s = document.getElementById("fieldSubject");
    if (s && s.value.trim()) { return s.value.trim().slice(0, 70); }
    var m = document.getElementById("fieldMessage");
    if (m && m.value.trim()) { return m.value.trim().replace(/\s+/g, " ").slice(0, 70); }
    return null;
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
              if (/newThread/.test(x.__u)) { autoWatch(getBoard(), r.data, newThreadLabel()); }
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
                if (/newThread/.test(url)) { autoWatch(getBoard(), r.data, newThreadLabel()); }
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
    else if (e.key === "g") { toggleGallery(); e.preventDefault(); }
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
    // a palette search from another page left a pending term — run it now
    var pending = null;
    try {
      pending = sessionStorage.getItem(DEEP_PENDING);
      if (pending) { sessionStorage.removeItem(DEEP_PENDING); }
    } catch (e4) {}
    if (pending) {
      cb.checked = true;
      try { localStorage.setItem(DEEP_KEY, "1"); } catch (e5) {}
      field.value = pending;
      applyDeepSearch();
    }
  }

  // Deep-search for a term from anywhere on the board: on the catalog, arm the
  // deep checkbox and run it; elsewhere, stash the term and go to the catalog
  // (hookDeepSearch picks the pending term up on load).
  var DEEP_PENDING = "rchan_deep_pending";
  function deepSearchFor(term) {
    if (!term) { return; }
    try { localStorage.setItem(DEEP_KEY, "1"); } catch (e) {}
    if (isCatalog()) {
      var f = document.getElementById("catalogSearchField");
      var cb = document.querySelector("#rchan-deeplab input");
      if (f) {
        if (cb) { cb.checked = true; }
        f.value = term;
        applyDeepSearch();
        try { f.scrollIntoView({ behavior: SB, block: "center" }); f.focus(); } catch (e2) {}
        return;
      }
    }
    try { sessionStorage.setItem(DEEP_PENDING, term); } catch (e3) {}
    location.href = "/" + getBoard() + "/catalog";
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

  /* ---------- "Filter this image": one-click never-see-again on file rows ----------
     Adds a type-6 (File hash) auto-filter for the file's /.media/ content
     hash — the same image reposted under any filename stays hidden. One
     click, with an Undo on the toast instead of an arming step. */
  var SVG_BLOCK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0 1 20 12c0 4.42-3.58 8-8 8z"/></svg>';
  function rerunFilters() {
    if (window.hiding && hiding.__rchanStub) { try { hiding.checkFilters(); return; } catch (e) {} }
    applyExtraFilters();
  }
  function decorateFileFilterButtons(root) {
    var links = (root || document).getElementsByClassName("originalNameLink");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-fhash")) { continue; }
      a.setAttribute("data-fhash", "1");
      if (a.closest && a.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var hash = mediaHashOf(a.getAttribute("href") || "");
      if (!hash) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-fhash";
      b.innerHTML = SVG_BLOCK;
      b.setAttribute("data-tooltip", "Filter this image — hide it everywhere, any filename");
      b.setAttribute("aria-label", "Filter this image everywhere");
      b.addEventListener("click", (function (h2) {
        return function (e) {
          e.preventDefault(); e.stopPropagation();
          var cur = loadedFilters();
          for (var j = 0; j < cur.length; j++) {
            if (cur[j].type === 6 && !cur[j].regex && cur[j].filter === h2) { okToast("Already filtered"); return; }
          }
          cur.push({ filter: h2, regex: false, type: 6 });
          persistFilters(cur);
          rerunFilters();
          toastAction("Image filtered — matching posts hidden", "Undo", function () {
            persistFilters(loadedFilters().filter(function (f) {
              return !(f.type === 6 && !f.regex && f.filter === h2);
            }));
            rerunFilters();
          });
        };
      })(hash));
      a.parentNode.appendChild(b);
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
  // Cross-tab once-guard: localStorage is shared synchronously between tabs,
  // so stamping a key before notifying/chiming stops two open tabs from both
  // firing for the same event. Stamps are pruned after an hour and excluded
  // from backups.
  function onceAcross(key, ms) {
    try {
      var k = "rchan_once_" + key, now = Date.now();
      var prev = parseInt(localStorage.getItem(k), 10) || 0;
      if (now - prev < ms) { return false; }
      localStorage.setItem(k, String(now));
      return true;
    } catch (e) { return true; }
  }
  function pruneOnceStamps() {
    try {
      var now = Date.now(), del = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("rchan_once_") === 0 &&
            now - (parseInt(localStorage.getItem(k), 10) || 0) > 3600000) { del.push(k); }
      }
      for (var j = 0; j < del.length; j++) { localStorage.removeItem(del[j]); }
    } catch (e) {}
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
  var SEEN_MAX = 400;                                    // one record per thread ever visited — cap it
  function seenSave(o) {
    try {
      var keys = Object.keys(o);
      if (keys.length > SEEN_MAX) {                      // evict: legacy no-ts entries first, then oldest
        keys.sort(function (a, b) { return (o[a].ts || 0) - (o[b].ts || 0); });
        for (var i = 0; i < keys.length - SEEN_MAX; i++) { delete o[keys[i]]; }
      }
      localStorage.setItem(SEEN_KEY, JSON.stringify(o));
    } catch (e) {}
  }
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
          // persist into the (You) inbox; already-read when you're looking at it
          var msgEl = posts[i].querySelector(".divMessage");
          youboxAdd(board, tid, id, msgEl ? msgEl.textContent : "", Date.now(), !document.hidden);
        }
      }
    }
    if (youNew > 0) {
      if (onceAcross("chime-" + key + "-" + postIdOf(firstYou), 15000)) { youChime(); }
      updateYouboxBadge();
    }
    if (!document.hidden) { youboxMarkThreadRead(board, tid); }   // being here = reading it
    if (firstNew && !document.getElementById("rchan-newline")) {
      var d = document.createElement("div"); d.id = "rchan-newline";
      d.textContent = newCount + " new post" + (newCount > 1 ? "s" : "") + " since last visit";
      firstNew.parentNode.insertBefore(d, firstNew);
    }
    all[key] = { maxId: curMax, replies: posts.length, ts: Date.now() };
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
        Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "1" &&
        onceAcross("ntf-" + key + "-" + curMax, 15000)) {
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
  /* ---------- Watcher sanity: throttle the poll, unwatch the dead ----------
     The native watcher re-checks EVERY watched thread every ~10s (tuned for
     people who watch two threads); auto-watch now adds one per post, so a
     regular quickly reaches 30+ watched threads = 30 fetches every 10s per
     tab, forever — including threads pruned months ago, which 404 eternally
     because nothing ever unwatches them. Fix both:
     - 75s cadence, skipped while hidden, and cross-tab aware (lastWatchCheck
       is shared localStorage, so if another tab just ran the sweep this one
       waits its turn); returning to the tab runs a stale check immediately.
     - three consecutive failed polls (404/network) = the thread is gone:
       unwatch it and drop its menu cell. A single blip never unwatches. */
  function hookWatcherThrottle() {
    var w = window.watcher;
    if (!w || !w.runWatchedThreadsCheck || !w.iterateWatchedThreads || w.__rchanThrottle) { return; }
    w.__rchanThrottle = true;
    var PERIOD = 75000, DEAD_KEY = "rchan_watchdead";
    w.scheduleWatchedThreadsCheck = function () {
      var last = parseInt(localStorage.lastWatchCheck, 10) || 0;
      var wait = Math.max(5000, last + PERIOD - Date.now());
      setTimeout(function () {
        var l2 = parseInt(localStorage.lastWatchCheck, 10) || 0;
        if (document.hidden || Date.now() - l2 < PERIOD - 2000) {   // hidden, or another tab covered it
          w.scheduleWatchedThreadsCheck();
          return;
        }
        try { w.runWatchedThreadsCheck(); } catch (e) { w.scheduleWatchedThreadsCheck(); }
      }, wait);
    };
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { return; }
      var last = parseInt(localStorage.lastWatchCheck, 10) || 0;
      if (Date.now() - last > PERIOD) { try { w.runWatchedThreadsCheck(); } catch (e) {} }
    });
    function strikes() { try { return JSON.parse(localStorage.getItem(DEAD_KEY) || "{}"); } catch (e) { return {}; } }
    function unwatchDead(b, t) {
      try {
        var wd = JSON.parse(localStorage.watchedData || "{}");
        if (wd[b]) {
          delete wd[b][t];
          if (!Object.keys(wd[b]).length) { delete wd[b]; }
        }
        localStorage.watchedData = JSON.stringify(wd);
      } catch (e) {}
      try {   // drop the menu cell: notification span -> label -> cell -> wrapper
        var rel = w.elementRelation && w.elementRelation[b] && w.elementRelation[b][t];
        if (rel) {
          var wrap = rel.parentNode && rel.parentNode.parentNode && rel.parentNode.parentNode.parentNode;
          if (wrap && wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
          delete w.elementRelation[b][t];
        }
      } catch (e2) {}
    }
    w.iterateWatchedThreads = function (urls, index) {
      index = index || 0;
      if (index >= urls.length) {
        w.updateWatcherCounter();
        w.scheduleWatchedThreadsCheck();
        return;
      }
      var u = urls[index];
      api.localRequest("/" + u.board + "/res/" + u.thread + ".json", function (error, data) {
        try {
          var s = strikes(), k = u.board + "/" + u.thread;
          if (error) {
            s[k] = (s[k] || 0) + 1;
            if (s[k] >= 3) { unwatchDead(u.board, String(u.thread)); delete s[k]; }
            localStorage.setItem(DEAD_KEY, JSON.stringify(s));
          } else if (s[k]) {
            delete s[k];
            localStorage.setItem(DEAD_KEY, JSON.stringify(s));
          }
        } catch (e) {}
        if (error) { w.iterateWatchedThreads(urls, ++index); }
        else { w.processThread(urls, index, data); }
      });
    };
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
            // every open tab polls the watcher — only one gets to notify
            if (!onceAcross("watch-" + k2 + "-" + (unread[k2].lastReplied || 0), 30000)) { return; }
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
  // On the catalog: dim threads you've already read (visited AND nothing new
  // since — a visited thread with fresh replies is effectively unread again,
  // so it keeps full strength alongside its "+N new" badge). Scanning the
  // catalog becomes a diff against your own memory. Toggleable; re-evaluated
  // on every refresh so flipping the setting applies live.
  function markVisitedInCatalog() {
    if (!isCatalog()) { return; }
    var board = getBoard(); if (!board) { return; }
    var on = setOn("visiteddim");
    var all = seenAll(), cells = catCells();
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i], tid = catThreadId(cell);
      var rec = tid && all[board + "/" + tid];
      var dim = !!(on && rec && catNum(cell, "labelReplies") <= (rec.replies || 0));
      cell.classList.toggle("rchan-visited", dim);
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

  /* ---------- (You) inbox: replies to your posts, persisted ----------
     Notifications are ephemeral and scanRepliesToYou only sees the open page —
     miss the toast and a reply to you is silently gone. The native watcher
     already fetches every watched thread's full JSON every poll; scan those
     posts for quotes of your recorded (You) ids and persist the hits. Opening
     the thread marks its entries read, like any inbox. Combined with
     auto-watch, every reply to anything you posted lands here. */
  var YOUBOX_KEY = "rchan_youbox", YOUBOX_MAX = 200;
  function youboxAll() { try { return JSON.parse(localStorage.getItem(YOUBOX_KEY) || "{}"); } catch (e) { return {}; } }
  function youboxSave(o) {
    var keys = Object.keys(o);
    if (keys.length > YOUBOX_MAX) {                              // prune oldest
      keys.sort(function (a, b) { return (o[a].ts || 0) - (o[b].ts || 0); });
      for (var i = 0; i < keys.length - YOUBOX_MAX; i++) { delete o[keys[i]]; }
    }
    try { localStorage.setItem(YOUBOX_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function youboxAdd(b, t, p, snippet, ts, read) {
    var o = youboxAll(), key = b + "/" + t + "/" + p;
    if (o[key]) { return false; }
    o[key] = { b: b, t: String(t), p: String(p),
               s: String(snippet || "").replace(/\s+/g, " ").trim().slice(0, 90),
               ts: ts || Date.now(), r: read ? 1 : 0 };
    youboxSave(o);
    return true;
  }
  function youboxMarkThreadRead(b, t) {
    var o = youboxAll(), changed = false;
    Object.keys(o).forEach(function (k) {
      if (o[k].b === b && o[k].t === String(t) && !o[k].r) { o[k].r = 1; changed = true; }
    });
    if (changed) { youboxSave(o); updateYouboxBadge(); }
  }
  function youboxUnread() {
    var o = youboxAll(), n = 0;
    Object.keys(o).forEach(function (k) { if (!o[k].r) { n++; } });
    return n;
  }
  function updateYouboxBadge() {
    var btn = document.getElementById("rchan-youboxbtn");
    if (!btn) { return; }
    var n = youboxUnread();
    btn.lastChild.textContent = n ? (n > 99 ? "99+" : String(n)) : "";
    btn.classList.toggle("rchan-on", n > 0);
  }
  // Scan a thread's posts (watcher poll JSON) for quotes of your (You) ids
  function scanPostsForYou(b, t, posts) {
    var mine = load(YOU_KEY);
    if (!mine.length || !posts || !posts.length) { return; }
    var set = {};
    for (var i = 0; i < mine.length; i++) { set[mine[i]] = 1; }
    var added = 0;
    for (var j = 0; j < posts.length; j++) {
      var p = posts[j], pid = String(p.postId);
      if (set[pid]) { continue; }                                // your own post
      var quotes = (p.message || "").match(/>>(\d+)/g) || [];
      for (var q = 0; q < quotes.length; q++) {
        if (set[quotes[q].slice(2)]) {
          if (youboxAdd(b, t, pid, p.message, Date.parse(p.creation) || Date.now(),
                        b === getBoard() && String(t) === curThreadId() && !document.hidden)) { added++; }
          break;
        }
      }
    }
    if (added) { updateYouboxBadge(); }
  }
  function hookYouboxScan() {
    var w = window.watcher;
    if (!w || !w.processThread || w.__rchanYoubox) { return; }
    w.__rchanYoubox = true;
    var orig = w.processThread;
    w.processThread = function (urls, index, data) {
      try {
        var u = urls[index];
        var d = JSON.parse(data);
        scanPostsForYou(u.board, String(u.thread), d.posts || []);
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  }
  var youboxPanel = null;
  function renderYoubox() {
    var list = youboxPanel.lastChild;
    var o = youboxAll();
    var entries = Object.keys(o).map(function (k) { return o[k]; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    list.innerHTML = "";
    if (!entries.length) {
      var empty = document.createElement("div"); empty.className = "rchan-hist-empty";
      empty.textContent = "No replies to your posts yet";
      list.appendChild(empty);
      return;
    }
    entries.forEach(function (e) {
      var row = document.createElement("a");
      row.className = "rchan-hist-row rchan-yb-row" + (e.r ? "" : " rchan-yb-unread");
      row.href = "/" + e.b + "/res/" + e.t + ".html#" + e.p;
      var title = document.createElement("span"); title.className = "rchan-hist-title";
      title.textContent = "/" + e.b + "/ · " + (e.s || (">>" + e.p));
      var meta = document.createElement("span"); meta.className = "rchan-hist-meta";
      meta.textContent = fmtAgo(e.ts);
      meta.setAttribute("data-ts", e.ts);
      row.appendChild(title); row.appendChild(meta);
      row.addEventListener("click", function () {                // navigating = reading
        var cur = youboxAll(), k = e.b + "/" + e.t + "/" + e.p;
        if (cur[k] && !cur[k].r) { cur[k].r = 1; youboxSave(cur); updateYouboxBadge(); }
      });
      list.appendChild(row);
    });
  }
  function toggleYoubox() {
    if (youboxPanel && youboxPanel.style.display === "block") { youboxPanel.style.display = "none"; return; }
    if (!youboxPanel) {
      youboxPanel = document.createElement("div"); youboxPanel.id = "rchan-youbox";
      youboxPanel.setAttribute("role", "dialog"); youboxPanel.setAttribute("aria-label", "Replies to your posts");
      var head = document.createElement("div"); head.className = "rchan-hist-head";
      var ttl = document.createElement("span"); ttl.textContent = "Replies to you";
      var mark = document.createElement("button"); mark.type = "button"; mark.className = "rchan-hist-clear";
      mark.textContent = "Mark read";
      mark.addEventListener("click", function () {
        var o = youboxAll();
        Object.keys(o).forEach(function (k) { o[k].r = 1; });
        youboxSave(o); updateYouboxBadge(); renderYoubox();
      });
      var clr = document.createElement("button"); clr.type = "button"; clr.className = "rchan-hist-clear";
      clr.textContent = "Clear";
      clr.addEventListener("click", function () {
        try { localStorage.removeItem(YOUBOX_KEY); } catch (e) {}
        updateYouboxBadge(); renderYoubox();
      });
      head.appendChild(ttl); head.appendChild(mark); head.appendChild(clr);
      youboxPanel.appendChild(head);
      youboxPanel.appendChild(document.createElement("div"));    // list container (lastChild)
      document.body.appendChild(youboxPanel);
      document.addEventListener("click", function (ev) {         // click-away closes
        if (youboxPanel.style.display !== "block") { return; }
        var t2 = ev.target;
        if (youboxPanel.contains(t2) || (t2.closest && t2.closest("#rchan-nav"))) { return; }
        youboxPanel.style.display = "none";
      }, true);
    }
    renderYoubox();
    youboxPanel.style.display = "block";
    dialogOpened(youboxPanel);
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
      rows.push({ e: e, badge: badge, row: row });
    });
    // unread badges + dead markers: one catalog fetch per distinct board in
    // the list. A thread missing from its board's catalog is pruned/archived —
    // grey it out and say so instead of leaving a link that 404s unannounced.
    var boards = {};
    a.forEach(function (e) { boards[e.b] = 1; });
    Object.keys(boards).forEach(function (b) {
      fetch("/" + b + "/catalog.json").then(function (r) {
        if (!r.ok) { throw new Error("no catalog"); }
        return r.json();
      }).then(function (cat) {
        var counts = {};
        (cat || []).forEach(function (t) { counts[t.threadId] = t.postCount || 0; });
        rows.forEach(function (ro) {
          if (ro.e.b !== b) { return; }
          if (counts[ro.e.t] == null) {                          // gone from the board
            ro.row.classList.add("rchan-hist-dead");
            ro.badge.className = "rchan-deadbadge";
            ro.badge.textContent = "gone";
            ro.badge.style.display = "";
            return;
          }
          var rec = seen[b + "/" + ro.e.t];
          var diff = counts[ro.e.t] - ((rec && rec.replies) || 0);
          if (rec && diff > 0) {
            ro.badge.textContent = "+" + diff + " new";
            ro.badge.style.display = "";
          }
        });
      }).catch(function () {});                                  // board unreachable: mark nothing
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
    dialogOpened(histPanel);
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
    if (!b || b.charAt(0) === "." || isOverboard(b) || curThreadId()) { return; }   // no catalog.json to diff on the overboard
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
  var presenceCount = 0, presenceTyping = 0, lastTypedAt = 0;
  function isTypingNow() { return Date.now() - lastTypedAt < 8000; }
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
          encodeURIComponent(t) + "&sid=" + presenceSid() + (isTypingNow() ? "&typing=1" : ""))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.status === "ok" && typeof d.count === "number") {
          presenceCount = d.count;
          presenceTyping = typeof d.typing === "number" ? d.typing : 0;
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
    // typing: stamp activity from either message box; while active, ping on a
    // faster 8s cadence so "N typing…" appears (and expires) responsively —
    // the server's typing window is 15s
    document.addEventListener("input", function (e) {
      var t2 = e.target;
      if (!t2 || (t2.id !== "qrbody" && t2.id !== "fieldMessage")) { return; }
      var was = isTypingNow();
      lastTypedAt = (t2.value || "").trim() ? Date.now() : 0;
      if (!was && isTypingNow()) { pingPresence(); }   // rising edge: announce now
    });
    setInterval(function () { if (isTypingNow()) { pingPresence(); } }, 8000);
  }

  /* ---------- Site-wide presence: "N anons browsing now" ----------
     Typing presence made threads feel alive; the front page and board pages
     were still corpses. Every page heartbeats a site-scope ping (same addon,
     pseudo-board '@site'); the homepage gets a pulsing-dot line above the
     board list, board index/catalog pages show it in the nav. Thread pages
     already have their own richer per-thread presence. */
  var sitePresenceCount = 0;
  function renderSitePresence() {
    var n = sitePresenceCount;
    if (!n) { return; }
    var txt = n + (n === 1 ? " anon" : " anons") + " browsing now";
    if (/^\/(index\.html)?$/.test(location.pathname)) {
      var el = document.getElementById("rchan-sitestat");
      if (!el) {
        var anchor = document.getElementById("rchan-active") || document.getElementById("divBoards");
        if (!anchor) { return; }
        el = document.createElement("div"); el.id = "rchan-sitestat";
        anchor.parentNode.insertBefore(el, anchor);
      }
      el.innerHTML = '<span class="rchan-sitedot" aria-hidden="true"></span> ' + escHtml(txt);
      return;
    }
    if (getBoard() && !curThreadId()) {
      var nav = document.querySelector("nav, #dynamicHeader");
      if (!nav) { return; }
      var el2 = document.getElementById("rchan-sitestat-nav");
      if (!el2) {
        el2 = document.createElement("span"); el2.id = "rchan-sitestat-nav";
        nav.insertBefore(el2, document.getElementById("navOptionsSpan") || null);
      }
      el2.innerHTML = '<span class="rchan-sitedot" aria-hidden="true"></span> ' + escHtml(txt);
    }
  }
  function pingSitePresence() {
    if (document.hidden) { return; }
    fetch("/addon.js/presence?site=1&sid=" + presenceSid())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.status === "ok" && typeof d.count === "number") {
          sitePresenceCount = d.count;
          renderSitePresence();
        }
      }).catch(function () {});
  }
  function initSitePresence() {
    pingSitePresence();
    setInterval(pingSitePresence, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) { pingSitePresence(); }
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
  // Icons instead of words: "412 💬 · 96 🖼 · 31 🏷 · 3m 🕐 · 2 👤" — each
  // segment carries the full sentence as tooltip + aria-label, so nothing is
  // lost to screen readers or the curious hover.
  var TS_SVG = {
    reply: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    file: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    id: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.22-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>',
    clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><polyline points="12 7.5 12 12 15.2 13.8"/></svg>',
    anon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    pen: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'
  };
  function tsSeg(text, svg, label) {
    return '<span class="rchan-ts-seg" data-tooltip="' + escHtml(label) + '" aria-label="' +
           escHtml(label) + '">' + escHtml(text) + " " + svg + "</span>";
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
    var segs = [
      tsSeg(String(replies), TS_SVG.reply, replies + (replies === 1 ? " reply" : " replies")),
      tsSeg(String(files), TS_SVG.file, files + (files === 1 ? " file" : " files"))
    ];
    if (idCount) { segs.push(tsSeg(String(idCount), TS_SVG.id, idCount + (idCount === 1 ? " unique ID" : " unique IDs"))); }
    if (last) { segs.push(tsSeg(ago, TS_SVG.clock, "updated " + (ago === "now" ? "just now" : ago + " ago"))); }
    if (presenceCount) { segs.push(tsSeg(String(presenceCount), TS_SVG.anon, presenceCount + (presenceCount === 1 ? " anon here now" : " anons here now"))); }
    if (presenceTyping) { segs.push(tsSeg(String(presenceTyping), TS_SVG.pen, presenceTyping + (presenceTyping === 1 ? " anon typing…" : " anons typing…"))); }
    el.innerHTML = segs.join('<span class="rchan-ts-dot" aria-hidden="true">·</span>');
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

  /* ---------- Delete own post: one visible lever on your (You) posts ----------
     LynxChan supports password deletion and the passwords are already stored
     (postCommon saves postingPasswords[b/t/p] on every post) — but the native
     flow is checkbox → scroll → password field → button, which nobody
     discovers. Your own posts get the same armed-confirm button staff have;
     it fires the NATIVE postingMenu.deleteSinglePost, which resolves the
     stored password itself, removes the DOM on success, and offers a
     password prompt if it ever mismatches. */
  function decorateOwnDelete(root) {
    if (!window.postingMenu || !postingMenu.deleteSinglePost) { return; }
    if (document.body.classList.contains("rchan-staff")) { return; }   // staff already have quick-mod
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-owndel")) { continue; }
      var inner = info.closest(".innerPost, .innerOP");
      if (!inner || !inner.classList.contains("rchan-you")) { continue; }   // decorateYou runs first
      info.setAttribute("data-owndel", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var cell = info.closest(".postCell, .opCell");
      var ids = cell && qmodIds(cell);
      if (!ids) { continue; }
      var isOp = !ids.post;
      var strip = document.createElement("span");
      strip.className = "rchan-owndel";
      strip.appendChild(qmodButton(isOp ? "del thread" : "del",
        isOp ? "Delete your thread (uses your stored password)" : "Delete your post (uses your stored password)",
        (function (d, ip2) {
          return function () { postingMenu.deleteSinglePost(d.board, d.thread, d.post, null, null, null, ip2); };
        })(ids, inner)));
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
  var FILTER_TYPE_NAMES = ["Name", "Tripcode", "Subject", "Message", "ID", "Filename", "File hash"];
  // /.media/<hash>.<ext> (files) and /.media/t_<hash> (thumbs) share the content hash
  var MEDIA_HASH_RE = /\/\.media\/(?:t_)?([a-z0-9]{6,})(?:\.[a-z0-9]+)?(?:[?#]|$)/i;
  function mediaHashOf(s) {
    var m = (s || "").match(MEDIA_HASH_RE);
    return m ? m[1].toLowerCase() : null;
  }
  function cellMediaHashes(cell) {
    var inner = cell.querySelector(".innerPost, .innerOP") || cell;
    var out = {}, els = inner.querySelectorAll('a[href*="/.media/"], img[src*="/.media/"]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].closest && els[i].closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var h = mediaHashOf(els[i].getAttribute("href") || els[i].getAttribute("src"));
      if (h) { out[h] = 1; }
    }
    return Object.keys(out);
  }
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
    var all = loadedFilters();
    var fileFilters = all.filter(function (f) { return f.type === 5; });
    var hashFilters = all.filter(function (f) { return f.type === 6; });
    var i, cell, k;
    for (i = 0; i < cells.length; i++) {              // filename rules
      cell = cells[i];
      if (cell.__rchanShown || cellHidden(cell) || !fileFilters.length) { continue; }
      var inner = cell.querySelector(".innerPost, .innerOP") || cell;
      var names = inner.querySelectorAll(".originalNameLink");
      for (var n = 0; n < names.length && !cellHidden(cell); n++) {
        var fname = names[n].textContent || "";
        for (k = 0; k < fileFilters.length; k++) {
          if (fMatch(fname, fileFilters[k])) {
            cell.style.display = "none"; cell.__xhide = true;
            addFilterStub(cell, "Filtered file");
            break;
          }
        }
      }
    }
    for (i = 0; i < cells.length; i++) {              // file-hash rules
      cell = cells[i];
      if (cell.__rchanShown || cellHidden(cell) || !hashFilters.length) { continue; }
      var hashes = cellMediaHashes(cell);
      for (var h = 0; h < hashes.length && !cellHidden(cell); h++) {
        for (k = 0; k < hashFilters.length; k++) {
          if (fMatch(hashes[h], hashFilters[k])) {
            cell.style.display = "none"; cell.__xhide = true;
            addFilterStub(cell, "Filtered image");
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
  /* ---------- File privacy: EXIF strip + filename anonymize + rotate/crop ----------
     Every upload funnels through postCommon.addSelectedFile (picker, drop,
     paste) — wrap it once:
     - "Strip image metadata" (default ON): decode → canvas → re-encode, so
       EXIF/GPS never leaves the device. JPEG/PNG/WebP only (a canvas pass
       would flatten GIF animation); browsers bake EXIF orientation in while
       drawing, so stripped photos can't render sideways.
     - "Anonymize filenames" (opt-in): timestamp names, 4chan-style.
     - Each selected-file chip gets a ✎ that opens a rotate/crop editor;
       Apply removes the old file through the chip's own native remove
       button and re-adds the edited one, so main form + QR clones stay
       in sync via the engine's own rendering. */
  var STRIP_TYPES = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 };
  var TYPE_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
                   "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/ogg": "ogg", "application/pdf": "pdf" };
  function anonName(file) {
    var ext = TYPE_EXT[(file.type || "").toLowerCase()] ||
              ((file.name || "").match(/\.([a-z0-9]{1,5})$/i) || [])[1] || "bin";
    return String(Date.now()) + String(Math.floor(Math.random() * 900) + 100) + "." + ext.toLowerCase();
  }
  function loadBitmap(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("decode failed")); };
      img.src = url;
    });
  }
  function reencodeImage(file) {                          // -> Promise<File> with metadata gone
    return loadBitmap(file).then(function (b) {
      return new Promise(function (res, rej) {
        try {
          var w = b.img.naturalWidth, h = b.img.naturalHeight;
          if (!w || !h || w * h > 50e6) { URL.revokeObjectURL(b.url); rej(new Error("too large")); return; }
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(b.img, 0, 0);
          URL.revokeObjectURL(b.url);
          c.toBlob(function (blob) {
            if (!blob || blob.size > MAX_FILE) { rej(new Error("encode failed")); return; }
            res(new File([blob], file.name, { type: file.type }));
          }, file.type, file.type === "image/jpeg" ? 0.92 : undefined);
        } catch (e) { URL.revokeObjectURL(b.url); rej(e); }
      });
    });
  }
  // Duplicate guard: the /.media/<hash> URLs in the thread ARE sha256 hashes
  // (the engine dedups uploads by that digest) — hash the file we're about to
  // attach and warn if the thread already has it. Advisory only; posting a
  // dupe on purpose stays possible.
  function threadMediaHashes() {
    var set = {}, els = document.querySelectorAll('a[href*="/.media/"], img[src*="/.media/"]');
    for (var i = 0; i < els.length; i++) {
      var h = mediaHashOf(els[i].getAttribute("href") || els[i].getAttribute("src"));
      if (h) { set[h] = 1; }
    }
    return set;
  }
  function warnIfDuplicate(file) {
    if (!curThreadId() || !file || !window.crypto || !crypto.subtle ||
        typeof file.arrayBuffer !== "function") { return; }
    file.arrayBuffer().then(function (buf) {
      return crypto.subtle.digest("SHA-256", buf);
    }).then(function (hb) {
      var hex = Array.prototype.map.call(new Uint8Array(hb), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      if (threadMediaHashes()[hex]) {
        toast("Heads up: “" + file.name + "” is already posted in this thread", true);
      }
    }).catch(function () {});
  }
  function hookFilePrivacy() {
    if (!window.postCommon || !postCommon.addSelectedFile || postCommon.__rchanPriv) { return; }
    postCommon.__rchanPriv = true;
    var orig = postCommon.addSelectedFile;
    postCommon.addSelectedFile = function (file) {
      try {
        var strip = setOn("stripexif") && file && STRIP_TYPES[(file.type || "").toLowerCase()];
        var anon = setOn("anonname", false) && file && typeof File === "function";
        if (!strip && !anon) {
          warnIfDuplicate(file);                       // fire-and-forget, never blocks the add
          return orig.call(postCommon, file);
        }
        var finish = function (f) {
          if (anon) { try { f = new File([f], anonName(f), { type: f.type }); } catch (e) {} }
          warnIfDuplicate(f);                          // hash the FINAL bytes (post strip/rename)
          orig.call(postCommon, f);
        };
        if (!strip) { finish(file); return; }
        reencodeImage(file).then(finish, function () {
          toast("Couldn't strip metadata from " + file.name + " — uploading as-is", true);
          finish(file);
        });
      } catch (e) { return orig.call(postCommon, file); }
    };
  }
  // --- Rotate/crop editor over a selected file chip ---
  var edPanel = null, edState = null;   // { file, chip, img, url, rot, crop, scale }
  function edWorkCanvas() {             // full-res, rotation applied
    var img = edState.img, rot = edState.rot;
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement("canvas");
    if (rot % 2) { c.width = h; c.height = w; } else { c.width = w; c.height = h; }
    var x = c.getContext("2d");
    x.translate(c.width / 2, c.height / 2);
    x.rotate(rot * Math.PI / 2);
    x.drawImage(img, -w / 2, -h / 2);
    return c;
  }
  function edRender() {
    var work = edWorkCanvas();
    var disp = edPanel.querySelector("canvas");
    var maxW = Math.min(window.innerWidth * 0.86, 720), maxH = window.innerHeight * 0.55;
    var s = Math.min(maxW / work.width, maxH / work.height, 1);
    disp.width = Math.max(1, Math.round(work.width * s));
    disp.height = Math.max(1, Math.round(work.height * s));
    disp.getContext("2d").drawImage(work, 0, 0, disp.width, disp.height);
    edState.scale = s;
    edState.work = work;
    edDrawCrop();
  }
  function edDrawCrop() {
    var disp = edPanel.querySelector("canvas");
    var box = edPanel.querySelector(".rchan-ed-crop");
    var cr = edState.crop;
    if (!cr || cr.w < 4 || cr.h < 4) { box.style.display = "none"; return; }
    var r = disp.getBoundingClientRect(), host = box.parentNode.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = (r.left - host.left + cr.x) + "px";
    box.style.top = (r.top - host.top + cr.y) + "px";
    box.style.width = cr.w + "px"; box.style.height = cr.h + "px";
  }
  function edClose() {
    if (edPanel && edPanel.style.display === "flex") { edPanel.style.display = "none"; dialogClosed(edPanel); }
    if (edState && edState.url) { URL.revokeObjectURL(edState.url); }
    edState = null;
  }
  function edApply() {
    if (!edState) { return; }
    var out = edState.work;
    var cr = edState.crop, s = edState.scale;
    if (cr && cr.w >= 4 && cr.h >= 4) {
      var sx = Math.max(0, Math.round(cr.x / s)), sy = Math.max(0, Math.round(cr.y / s));
      var sw = Math.min(out.width - sx, Math.round(cr.w / s)), sh = Math.min(out.height - sy, Math.round(cr.h / s));
      if (sw > 0 && sh > 0) {
        var c2 = document.createElement("canvas"); c2.width = sw; c2.height = sh;
        c2.getContext("2d").drawImage(out, sx, sy, sw, sh, 0, 0, sw, sh);
        out = c2;
      }
    }
    var file = edState.file, chip = edState.chip;
    var type = STRIP_TYPES[(file.type || "").toLowerCase()] ? file.type : "image/png";
    out.toBlob(function (blob) {
      if (!blob) { toast("Couldn't export the edited image", true); return; }
      try {
        var f2 = new File([blob], file.name, { type: type });
        // native removal (splices selectedFiles + drops the QR clone), then re-add
        var rm = chip.getElementsByClassName("removeButton")[0];
        if (rm) { rm.onclick(); }
        var orig2 = postCommon.addSelectedFile;
        orig2.call(postCommon, f2);
        okToast("Image edited");
      } catch (e) { toast("Couldn't replace the file", true); }
      edClose();
    }, type, type === "image/jpeg" ? 0.92 : undefined);
  }
  function edButton(label, fn) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = label;
    b.addEventListener("click", function (e) { e.preventDefault(); fn(); });
    return b;
  }
  function openEditor(file, chip) {
    if (!edPanel) {
      edPanel = document.createElement("div"); edPanel.id = "rchan-imgedit";
      edPanel.setAttribute("role", "dialog"); edPanel.setAttribute("aria-label", "Edit image");
      var box = document.createElement("div"); box.className = "rchan-ed-box";
      var head = document.createElement("div"); head.className = "rchan-set-head";
      var ttl = document.createElement("span"); ttl.textContent = "Edit image";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.setAttribute("aria-label", "Close editor");
      x.addEventListener("click", edClose);
      head.appendChild(ttl); head.appendChild(x);
      box.appendChild(head);
      var stage = document.createElement("div"); stage.className = "rchan-ed-stage";
      var cv = document.createElement("canvas");
      var cropBox = document.createElement("div"); cropBox.className = "rchan-ed-crop";
      stage.appendChild(cv); stage.appendChild(cropBox);
      box.appendChild(stage);
      var hint = document.createElement("div"); hint.className = "rchan-set-desc rchan-ed-hint";
      hint.textContent = "Drag on the image to crop · rotate with the buttons";
      box.appendChild(hint);
      var bar = document.createElement("div"); bar.className = "rchan-ed-bar";
      bar.appendChild(edButton("⟲ Rotate left", function () { if (edState) { edState.rot = (edState.rot + 3) % 4; edState.crop = null; edRender(); } }));
      bar.appendChild(edButton("⟳ Rotate right", function () { if (edState) { edState.rot = (edState.rot + 1) % 4; edState.crop = null; edRender(); } }));
      bar.appendChild(edButton("Clear crop", function () { if (edState) { edState.crop = null; edDrawCrop(); } }));
      var apply = edButton("Apply", edApply); apply.className = "rchan-ed-apply";
      bar.appendChild(apply);
      bar.appendChild(edButton("Cancel", edClose));
      box.appendChild(bar);
      edPanel.appendChild(box);
      edPanel.addEventListener("click", function (e) { if (e.target === edPanel) { edClose(); } });
      document.body.appendChild(edPanel);
      // crop drag (pointer events cover mouse + touch)
      var drag = null;
      cv.style.touchAction = "none";
      cv.addEventListener("pointerdown", function (e) {
        if (!edState) { return; }
        var r = cv.getBoundingClientRect();
        drag = { x: e.clientX - r.left, y: e.clientY - r.top };
        edState.crop = { x: drag.x, y: drag.y, w: 0, h: 0 };
        try { cv.setPointerCapture(e.pointerId); } catch (e2) {}
        e.preventDefault();
      });
      cv.addEventListener("pointermove", function (e) {
        if (!drag || !edState) { return; }
        var r = cv.getBoundingClientRect();
        var px = Math.max(0, Math.min(cv.width, e.clientX - r.left));
        var py = Math.max(0, Math.min(cv.height, e.clientY - r.top));
        edState.crop = {
          x: Math.min(drag.x, px), y: Math.min(drag.y, py),
          w: Math.abs(px - drag.x), h: Math.abs(py - drag.y)
        };
        edDrawCrop();
      });
      var endDrag = function () { drag = null; };
      cv.addEventListener("pointerup", endDrag);
      cv.addEventListener("pointercancel", endDrag);
    }
    loadBitmap(file).then(function (b) {
      edState = { file: file, chip: chip, img: b.img, url: b.url, rot: 0, crop: null, scale: 1 };
      edPanel.style.display = "flex";
      edRender();
      dialogOpened(edPanel);
    }).catch(function () { toast("Couldn't open that image", true); });
  }
  function chipFile(chip) {                      // chip -> its File via position among siblings
    var host = chip.parentNode;
    if (!host || !window.postCommon || !postCommon.selectedFiles) { return null; }
    var cells = host.getElementsByClassName("selectedCell");
    for (var i = 0; i < cells.length; i++) {
      if (cells[i] === chip) { return postCommon.selectedFiles[i] || null; }
    }
    return null;
  }
  function decorateSelectedCells(root) {
    if (!window.postCommon || !postCommon.selectedFiles) { return; }
    var chips = (root || document).getElementsByClassName("selectedCell");
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      if (chip.getAttribute("data-edit")) { continue; }
      chip.setAttribute("data-edit", "1");
      var f = chipFile(chip);
      if (!f || !/^image\/(jpeg|png|webp)$/.test((f.type || "").toLowerCase())) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-chipedit";
      b.innerHTML = SVG_PEN;
      b.setAttribute("data-tooltip", "Rotate / crop before upload");
      b.setAttribute("aria-label", "Edit " + f.name + " before upload");
      b.addEventListener("click", (function (chip2) {
        return function (e) {
          e.preventDefault(); e.stopPropagation();
          var cur = chipFile(chip2);              // re-resolve: list may have shifted
          if (cur) { openEditor(cur, chip2); }
        };
      })(chip));
      chip.appendChild(b);
    }
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
    // sage: the folklore, as a checkbox (threads only — saging a new thread is meaningless)
    if (curThreadId()) {
      var sageLab = document.createElement("label"); sageLab.className = "rchan-sagelab";
      sageLab.setAttribute("data-tooltip", "Reply without bumping the thread (sets email to sage)");
      var sage = document.createElement("input"); sage.type = "checkbox";
      sage.setAttribute("aria-label", "Sage — reply without bumping the thread");
      var emailSel = function () { return document.getElementById(msg.id === "qrbody" ? "qremail" : "fieldEmail"); };
      var em0 = emailSel() || document.getElementById("fieldEmail");
      sage.checked = !!(em0 && /^sage$/i.test((em0.value || "").trim()));
      sage.addEventListener("change", function () {
        var em = emailSel() || document.getElementById("fieldEmail");
        if (!em) { return; }
        if (sage.checked) { em.__presage = em.value; em.value = "sage"; }
        else { em.value = (em.__presage && !/^sage$/i.test(em.__presage)) ? em.__presage : ""; }
        em.dispatchEvent(new Event("input", { bubbles: true }));  // qr.registerSync mirrors the twin field
      });
      sageLab.appendChild(sage); sageLab.appendChild(document.createTextNode("sage"));
      bar.appendChild(sageLab);
    }
    var count = document.createElement("span"); count.className = "rchan-charcount"; bar.appendChild(count);
    var upd = function () {
      var n = msg.value.length, lim = msgLimit();
      count.textContent = lim ? n + " / " + lim : n + " chars";
      count.classList.toggle("rchan-charwarn", !!(lim && n > lim * 0.9));
      pvUpdate();
    };
    msg.addEventListener("input", upd); upd();
    return bar;
  }
  // Board message limit: the engine renders it as #labelMessageLength ("4096")
  function msgLimit() {
    var lab = document.getElementById("labelMessageLength");
    var n = lab ? parseInt((lab.textContent || "").replace(/\D/g, ""), 10) : 0;
    if (!n) {
      var f = document.getElementById("fieldMessage");
      if (f && f.maxLength > 0) { n = f.maxLength; }
    }
    return n || 0;
  }
  // Quick Reply is built lazily by qr.js (innerHTML); the MutationObserver-driven
  // refresh() lands here once #qrbody exists. wrapSel/prefixLines dispatch an
  // "input" event, which qr.js's registerSync mirrors into #fieldMessage.
  // Staff flag-override twin inside the Quick Reply. The XHR hook only reads
  // the MAIN #rchan-flagoverride select, so the twin just mirrors into it
  // (both ways) — QR users get the same control without a second code path.
  // Separate from enhanceQuickReply's data-fmt guard: the main select is built
  // asynchronously (after /account.js confirms the role), usually later.
  function buildQrFlagOverride() {
    var main = document.getElementById("rchan-flagoverride");
    var body = document.getElementById("qrbody");
    if (!main || !body || document.getElementById("rchan-flagoverride-qr")) { return; }
    var row = document.createElement("div"); row.id = "rchan-qr-flagrow"; row.className = "rchan-flagrow";
    row.appendChild(document.createTextNode("Flag "));
    var sel = main.cloneNode(true);
    sel.id = "rchan-flagoverride-qr"; sel.removeAttribute("name");
    sel.value = main.value;
    sel.addEventListener("change", function () {
      main.value = sel.value;
      main.dispatchEvent(new Event("change"));           // runs the native-combobox sync
      var nat = document.getElementById("flagCombobox"), natQr = document.getElementById("qrFlagCombobox");
      if (nat && natQr) { natQr.value = nat.value; }     // keep the QR's board-flag combo honest too
    });
    main.addEventListener("change", function () { sel.value = main.value; });
    row.appendChild(sel);
    var bar = body.parentNode.querySelector(".rchan-fmtbar");
    body.parentNode.insertBefore(row, bar || body);
  }
  function enhanceQuickReply() {
    buildQrFlagOverride();
    var ta = document.getElementById("qrbody");
    if (!ta || ta.getAttribute("data-fmt")) { return; }
    ta.setAttribute("data-fmt", "1");
    ta.parentNode.insertBefore(buildFmtBar(ta), ta);
    // board flags are a visible identity choice on the main form but the QR
    // buries them in the collapsed "Extra" section — promote the row up next
    // to the rest of the visible fields
    var qrFlags = document.getElementById("qrFlagsDiv");
    if (qrFlags) {
      var tr = qrFlags.closest("tr");
      var moreRow = document.getElementById("qrFormMore");
      if (tr && moreRow && tr.parentNode && tr.parentNode.id === "qrExtra") {
        moreRow.parentNode.insertBefore(tr, moreRow);
      }
    }
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
    { k: "visiteddim", t: "Dim read threads in the catalog", d: "Threads you've opened (with nothing new since) fade back so the unread ones pop" },
    { t: "Work-safe mode", d: "Blur every thumbnail, image and video until you hover it — for reading in public",
      get: function () { return setOn("wsmode", false); },
      set: function (on) { setPut("wsmode", on); applyWorkSafe(); } },
    { k: "vidpopsound", def: false, t: "Sound on video hover", d: "Unmute the floating hover preview — volume follows your saved level" },
    { k: "autowatch", t: "Watch threads you post in", d: "Posting adds the thread to your watcher, so replies notify you automatically" },
    { k: "yousound", def: false, t: "Sound on replies to you", d: "Short chime when a new post quotes one of yours" },
    { k: "stripexif", t: "Strip image metadata", d: "Re-encode JPEG/PNG/WebP uploads in the browser so EXIF/GPS never leaves your device (GIFs excluded)" },
    { k: "anonname", def: false, t: "Anonymize filenames", d: "Rename uploads to a timestamp before they upload" },
    { t: "Board accent colors", d: "Each board tints its title with its own stable hue",
      get: function () { return setOn("accent"); },
      set: function (on) { setPut("accent", on); applyBoardAccent(); } },
    { t: "Auto theme (follow OS)", d: "Dark when your system is dark, cream otherwise — switches live",
      get: autoThemeOn,
      set: function (on) {
        try { on ? localStorage.setItem(THEME_AUTO_KEY, "1") : localStorage.removeItem(THEME_AUTO_KEY); } catch (e) {}
        if (on) { applyAutoTheme(); }
        syncAutoThemeOption();
      } },
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
                       "localTime", "selectedTheme", "noAutoLoop", "deletionPassword", "postingPasswords", "customCSS"];
  function backupPayload() {                            // -> JSON string, or null on storage failure
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("rchan_once_") === 0) { continue; }   // ephemeral cross-tab stamps
        if (k === "rchan_watchdead") { continue; }               // ephemeral strike counters
        if (k && k.indexOf("rchan_") === 0) { out[k] = localStorage.getItem(k); }
      }
      EXPORT_NATIVE.forEach(function (k2) {
        var v = localStorage.getItem(k2);
        if (v !== null) { out[k2] = v; }
      });
    } catch (e) { return null; }
    return JSON.stringify({ rchanBackup: 1, exported: new Date().toISOString(), data: out });
  }
  function stampBackedUp() { try { localStorage.setItem("rchan_lastbackup", String(Date.now())); } catch (e) {} }
  function exportData() {
    var payload = backupPayload();
    if (!payload) { toast("Couldn't read local data", true); return; }
    var blob = new Blob([payload], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rchan-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    stampBackedUp();
    okToast("Backup downloaded");
  }
  // String transport: on phones, downloading and re-uploading a JSON file is
  // genuinely painful — copy/paste the same payload instead.
  function copyIdentity() {
    var payload = backupPayload();
    if (!payload) { toast("Couldn't read local data", true); return; }
    var done = function () { stampBackedUp(); okToast("Identity copied — paste it on the other device"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(done, function () {
        window.prompt("Copy your identity string:", payload); stampBackedUp();
      });
    } else {
      window.prompt("Copy your identity string:", payload); stampBackedUp();
    }
  }
  function pasteIdentity() {
    var s = window.prompt("Paste your rchan identity string:");
    if (s && s.trim()) { applyBackupString(s.trim()); }
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
  function applyBackupString(txt) {
    try {
      var parsed = JSON.parse(txt);
      if (!parsed || parsed.rchanBackup !== 1 || !parsed.data) { toast("Not an rchan backup", true); return; }
      var d = parsed.data, n = 0;
      Object.keys(d).forEach(function (k) {
        if (k.indexOf("rchan_") !== 0 && EXPORT_NATIVE.indexOf(k) < 0) { return; }   // whitelist only
        if (typeof d[k] !== "string") { return; }
        var cur = localStorage.getItem(k);
        try { localStorage.setItem(k, cur === null ? d[k] : mergeJson(k, cur, d[k])); n++; } catch (e) {}
      });
      okToast("Restored " + n + " entries — reloading");
      setTimeout(function () { location.reload(); }, 900);
    } catch (e) { toast("Couldn't read that backup", true); }
  }
  function importData(file) {
    var fr = new FileReader();
    fr.onload = function () { applyBackupString(fr.result); };
    fr.readAsText(file);
  }
  // Everything the user is lives in this browser's localStorage; one cleared
  // cache erases months of identity silently. Nudge gently: after two weeks
  // with no backup ever, or a month since the last one — at most weekly.
  function initBackupNudge() {
    try {
      var now = Date.now();
      var first = parseInt(localStorage.getItem("rchan_firstseen"), 10) || 0;
      if (!first) { localStorage.setItem("rchan_firstseen", String(now)); return; }
      var lastB = parseInt(localStorage.getItem("rchan_lastbackup"), 10) || 0;
      var lastN = parseInt(localStorage.getItem("rchan_nudge"), 10) || 0;
      var due = lastB ? (now - lastB > 30 * 86400e3) : (now - first > 14 * 86400e3);
      if (!due || now - lastN < 7 * 86400e3) { return; }
      localStorage.setItem("rchan_nudge", String(now));
      toastAction("Your (You)s, filters and watched threads live only in this browser", "Back up", exportData);
    } catch (e) {}
  }

  /* ---------- Auto theme: follow the OS light/dark preference ----------
     "Auto (OS)" joins the theme dropdown (and a settings row): dark when the
     OS is dark, cream otherwise, live-switching on the matchMedia change
     event. Implemented by steering the NATIVE selectedTheme + themeLoader
     (and the pre-paint predark hint), so every page renders consistently. */
  var THEME_AUTO_KEY = "rchan_theme_auto";
  function autoThemeOn() { try { return localStorage.getItem(THEME_AUTO_KEY) === "1"; } catch (e) { return false; } }
  function applyAutoTheme() {
    if (!autoThemeOn()) { return; }
    var dark = !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    try {
      delete localStorage.manualDefault;
      localStorage.selectedTheme = dark ? "dark" : "cream";
    } catch (e) {}
    try { if (window.themeLoader && themeLoader.load) { themeLoader.load(); } } catch (e2) {}
    try { document.documentElement.classList.toggle("predark", dark); } catch (e3) {}
  }
  function syncAutoThemeOption() {
    var sel = document.getElementById("themeSelector");
    if (!sel) { return; }
    var o = sel.querySelector("option[data-auto]");
    if (o && autoThemeOn()) { o.selected = true; }
  }
  function initAutoTheme() {
    var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq) {
      var onChange = function () { applyAutoTheme(); syncAutoThemeOption(); };
      if (mq.addEventListener) { mq.addEventListener("change", onChange); }
      else if (mq.addListener) { mq.addListener(onChange); }
    }
    applyAutoTheme();
    var sel = document.getElementById("themeSelector");
    if (sel && !sel.querySelector("option[data-auto]")) {
      var o = document.createElement("option");
      o.textContent = "Auto (OS)";
      o.setAttribute("data-auto", "1");
      sel.appendChild(o);
      if (autoThemeOn()) { o.selected = true; }
      // themes.js binds onchange as a property and indexes into ITS OWN theme
      // list — selecting our appended option through that handler would throw.
      var orig = sel.onchange;
      sel.onchange = function () {
        var cur = sel.options[sel.selectedIndex];
        if (cur && cur.getAttribute("data-auto")) {
          try { localStorage.setItem(THEME_AUTO_KEY, "1"); } catch (e) {}
          applyAutoTheme();
          return;
        }
        try { localStorage.removeItem(THEME_AUTO_KEY); } catch (e2) {}
        if (orig) { return orig.apply(this, arguments); }
      };
    }
  }
  /* ---------- Work-safe mode: blur all media until hovered ---------- */
  function applyWorkSafe() {
    try { document.body.classList.toggle("rchan-ws", setOn("wsmode", false)); } catch (e) {}
  }
  /* ---------- Custom CSS (settings panel; bridges the native customCSS key) ---------- */
  function applyCustomCss() {
    var css = "";
    try { css = localStorage.customCSS || ""; } catch (e) {}
    var el = document.getElementById("rchan-customcss");
    if (!css.trim()) { if (el && el.parentNode) { el.parentNode.removeChild(el); } return; }
    if (!el) { el = document.createElement("style"); el.id = "rchan-customcss"; }
    el.textContent = css;
    document.head.appendChild(el);            // (re-)append LAST so it wins the cascade
  }
  function buildCssSection(box) {
    box.innerHTML = "";
    var head = document.createElement("div"); head.className = "rchan-set-sub";
    head.textContent = "Custom CSS";
    box.appendChild(head);
    var desc = document.createElement("div"); desc.className = "rchan-set-desc";
    desc.textContent = "Applied on every page, after every theme. Yours to break.";
    box.appendChild(desc);
    var ta = document.createElement("textarea");
    ta.className = "rchan-css-input"; ta.rows = 5;
    ta.placeholder = ".divMessage { font-size: 15px; }";
    ta.setAttribute("aria-label", "Custom CSS");
    try { ta.value = localStorage.customCSS || ""; } catch (e) {}
    box.appendChild(ta);
    var save = document.createElement("button"); save.type = "button";
    save.className = "rchan-css-save"; save.textContent = "Save CSS";
    save.addEventListener("click", function () {
      var prev = "";
      try { prev = localStorage.customCSS || ""; } catch (e) {}
      // the native settings menu injected an anonymous <style> with the old
      // value at load — clear it so deletions actually disappear this session
      if (prev) {
        var styles = document.head.getElementsByTagName("style");
        for (var i = 0; i < styles.length; i++) {
          if (!styles[i].id && styles[i].textContent === prev) { styles[i].textContent = ""; }
        }
      }
      try { localStorage.customCSS = ta.value; } catch (e2) {}
      var inp = document.getElementById("cssInput");     // keep the native menu's box in sync
      if (inp) { inp.value = ta.value; }
      applyCustomCss();
      okToast("Custom CSS saved");
    });
    box.appendChild(save);
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
      x.addEventListener("click", function () { setPanel.style.display = "none"; dialogClosed(setPanel); });
      head.appendChild(ttl); head.appendChild(x);
      setPanel.appendChild(head);
      setPanel.appendChild(document.createElement("div"));       // rows container
      setPanel.appendChild(document.createElement("div"));       // filter manager container
      setPanel.appendChild(document.createElement("div"));       // custom CSS container
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
      foot.appendChild(setFootLink("Copy identity", copyIdentity));
      foot.appendChild(setFootLink("Paste identity", pasteIdentity));
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
    var news = document.createElement("div"); news.className = "rchan-set-news";
    news.textContent = "Recently added: auto-watch on post · replies-to-you inbox · Ctrl+Enter · sage · work-safe mode · gallery (g) · Ctrl+K palette";
    list.appendChild(news);
    SET_ROWS.forEach(function (row) { list.appendChild(buildSetRow(row)); });
    buildFilterSection(setPanel.children[2]);
    buildCssSection(setPanel.children[3]);
    setPanel.style.display = "block";
    dialogOpened(setPanel);
  }
  /* "?" cheat-sheet overlay (works even with shortcuts toggled off) */
  var KEYS_LIST = [
    ["j / k", "Next / previous post"],
    ["← / →", "Previous / next post with a file"],
    ["e", "Expand / collapse the selected post's image"],
    ["g", "Gallery mode — every file on the page, fullscreen"],
    ["t", "Jump to top"],
    ["b", "Jump to bottom"],
    ["c", "Toggle catalog ↔ index view"],
    ["r", "Focus the reply box"],
    ["Ctrl+Enter", "Submit the reply"],
    ["f", "Filter posts in the thread"],
    ["Ctrl+K", "Command palette — boards, threads, actions"],
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
      x.addEventListener("click", function () { keysOverlay.style.display = "none"; dialogClosed(keysOverlay); });
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
    dialogOpened(keysOverlay);
  }
  /* ---------- Dialog focus management: trap Tab inside, restore on close ----------
     Every overlay we ship (gallery, palette, action sheet, image editor,
     settings, history, inbox, cheat-sheet) is a dialog; keyboard users must
     not Tab out into the page behind it, and closing should hand focus back
     to wherever they came from. Click-away closes deliberately DON'T restore
     (the user just placed focus somewhere else). */
  function dlgFocusables(panel) {
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(panel.querySelectorAll(sel), function (el) {
      return el.offsetParent !== null;
    });
  }
  function trapDialog(panel) {
    if (panel.__rchanTrap) { return; }
    panel.__rchanTrap = true;
    panel.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") { return; }
      var f = dlgFocusables(panel);
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === panel)) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && a === last) { first.focus(); e.preventDefault(); }
    });
  }
  function dialogOpened(panel, focusEl) {
    trapDialog(panel);
    panel.__opener = document.activeElement;
    var target = focusEl || dlgFocusables(panel)[0] || panel;
    try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) {} }
  }
  function dialogClosed(panel) {
    if (!panel) { return; }
    var op = panel.__opener;
    panel.__opener = null;
    if (op && document.contains(op)) {
      try { op.focus({ preventScroll: true }); } catch (e) { try { op.focus(); } catch (e2) {} }
    }
  }

  /* ---------- Gallery mode: media-first fullscreen overlay (g) ----------
     The native gallery is desktop-only, image-only and bare (no filmstrip, no
     videos, no way back to the post). This one: current media centered, a
     thumbnail filmstrip along the bottom, ←/→ (and clicks) to step, Home/End,
     Esc closes AND drops you at the post you were looking at. Works on
     thread, index and catalog pages; videos play with the site-wide saved
     volume. Touch swipe rides the same show()/step() machinery. */
  var gal = null, galItems = [], galIdx = 0, galOpen = false, galMedia = null;
  // Zoom state (images only — video keeps native controls untouched)
  var galScale = 1, galPanX = 0, galPanY = 0, galLastPinch = 0, galSlideT = null;
  function galZoomable() { return galMedia && galMedia.tagName === "IMG"; }
  function applyGalTransform() {
    if (!galZoomable()) { return; }
    if (galScale < 1.05) { galScale = 1; galPanX = 0; galPanY = 0; }   // snap back to fit
    galMedia.style.transform = galScale === 1 ? "" :
      "translate(" + Math.round(galPanX) + "px," + Math.round(galPanY) + "px) scale(" + galScale + ")";
    if (gal) { gal.classList.toggle("rchan-gal-zoomed", galScale > 1); }
  }
  function galResetZoom() { galScale = 1; galPanX = 0; galPanY = 0; applyGalTransform(); }
  // zoom toward a screen point (mx,my relative to the stage center)
  function galZoomTo(newScale, mx, my) {
    if (!galZoomable()) { return; }
    newScale = Math.max(1, Math.min(8, newScale));
    var ux = (mx - galPanX) / galScale, uy = (my - galPanY) / galScale;   // content point under the cursor
    galPanX = mx - ux * newScale;
    galPanY = my - uy * newScale;
    galScale = newScale;
    applyGalTransform();
  }
  function galStageCenter() {
    var r = gal.querySelector(".rchan-gal-main").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function toggleSlideshow() {
    var link = gal && gal.querySelector(".rchan-gal-slide");
    if (galSlideT) {
      clearInterval(galSlideT); galSlideT = null;
      if (link) { link.textContent = "slideshow"; }
      return;
    }
    galSlideT = setInterval(function () {
      if (!galOpen) { toggleSlideshow(); return; }
      galShow(galIdx >= galItems.length - 1 ? 0 : galIdx + 1);     // wrap around
    }, 3500);
    if (link) { link.textContent = "⏸ stop"; }
  }
  function initGalleryZoom(main) {
    main.style.touchAction = "none";
    var pointers = {}, pinch = null, pan = null, lastTap = 0;
    function count() { return Object.keys(pointers).length; }
    function two() { var k = Object.keys(pointers); return [pointers[k[0]], pointers[k[1]]]; }
    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy) || 1; }
    main.addEventListener("pointerdown", function (e) {
      if (!galOpen || e.target.tagName === "VIDEO") { return; }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { main.setPointerCapture(e.pointerId); } catch (e2) {}
      if (count() === 2) {
        galLastPinch = Date.now();
        var p = two(), c = galStageCenter();
        pinch = { d: dist(p[0], p[1]), s: galScale,
                  ux: ((p[0].x + p[1].x) / 2 - c.x - galPanX) / galScale,
                  uy: ((p[0].y + p[1].y) / 2 - c.y - galPanY) / galScale };
        pan = null;
      } else if (count() === 1) {
        var now = Date.now();
        if (now - lastTap < 300 && galZoomable()) {                // double-tap: toggle fit ↔ 2.5×
          var c2 = galStageCenter();
          if (galScale > 1.01) { galResetZoom(); }
          else { galZoomTo(2.5, e.clientX - c2.x, e.clientY - c2.y); }
          lastTap = 0;
        } else { lastTap = now; }
        if (galScale > 1.01) { pan = { x: e.clientX, y: e.clientY, px: galPanX, py: galPanY }; }
      }
    });
    main.addEventListener("pointermove", function (e) {
      if (!pointers[e.pointerId]) { return; }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (count() === 2 && pinch) {
        galLastPinch = Date.now();
        var p = two(), c = galStageCenter();
        var s = Math.max(1, Math.min(8, pinch.s * dist(p[0], p[1]) / pinch.d));
        var mx = (p[0].x + p[1].x) / 2 - c.x, my = (p[0].y + p[1].y) / 2 - c.y;
        galScale = s;
        galPanX = mx - pinch.ux * s;                               // pinch midpoint stays put
        galPanY = my - pinch.uy * s;
        gal.__galDrag = Date.now();                                // a drag isn't a backdrop click
        applyGalTransform();
      } else if (pan && galScale > 1.01) {
        galPanX = pan.px + (e.clientX - pan.x);
        galPanY = pan.py + (e.clientY - pan.y);
        if (Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 8) { gal.__galDrag = Date.now(); }
        applyGalTransform();
      }
    });
    function up(e) {
      delete pointers[e.pointerId];
      if (count() < 2) { pinch = null; }
      if (!count()) { pan = null; applyGalTransform(); }           // snap-back check
    }
    main.addEventListener("pointerup", up);
    main.addEventListener("pointercancel", up);
    main.addEventListener("wheel", function (e) {                  // desktop: wheel-zoom at the cursor
      if (!galOpen || !galZoomable()) { return; }
      e.preventDefault();
      var c = galStageCenter();
      galZoomTo(galScale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - c.x, e.clientY - c.y);
    }, { passive: false });
  }
  function galCollect() {
    var items = [], seen = {};
    function push(url, type, thumb, cell, name) {
      if (!url || seen[url]) { return; }
      seen[url] = 1;
      items.push({ url: url, type: type, thumb: thumb, cell: cell, name: name || url.split("/").pop() });
    }
    // NOTE: native thumbs.js rewrites video posts so the imgLink class sits on
    // the THUMB IMG (inside a plain <a href="/.media/x.mp4">), not the anchor —
    // collect both shapes and normalise to the anchor.
    var nodes = document.querySelectorAll("a.imgLink[href], a.linkThumb[href], img.imgLink");
    var links = [];
    for (var n0 = 0; n0 < nodes.length; n0++) {
      var cand = nodes[n0].tagName === "IMG" ? (nodes[n0].closest && nodes[n0].closest("a[href]")) : nodes[n0];
      if (cand && links.indexOf(cand) < 0) { links.push(cand); }
    }
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.closest(".quoteTooltip, .rchan-inline-quote, #rchan-gallery")) { continue; }
      var cell = a.closest(".postCell, .opCell, .catalogCell");
      if (cell && cell.offsetParent === null) { continue; }        // hidden/filtered post
      var img = a.querySelector("img");
      var thumb = img ? img.getAttribute("src") : null;
      var href = a.getAttribute("href") || "";
      var nameEl = null, up = a.closest(".uploadCell");
      if (up) { nameEl = up.querySelector(".originalNameLink"); }
      var nm = nameEl ? nameEl.textContent : null;
      if (isImg(href)) { push(href, "img", thumb, cell, nm); continue; }
      if (VID_RE.test(href)) {                                     // thread/index video (skip audio)
        var box = a.parentNode;
        if (box && box.getElementsByTagName && box.getElementsByTagName("audio").length) { continue; }
        push(href, "video", thumb, cell, nm); continue;
      }
      if (a.classList.contains("linkThumb") && img) {              // catalog: derive from mime + thumb hash
        var full = resolveFull(img, a, href);
        if (full) { push(full, "img", thumb, cell, nm); continue; }
        var vi = videoUrlFor(img);
        if (vi) { push(vi.url, "video", thumb, cell, nm); }
      }
    }
    return items;
  }
  function galStopMedia() {
    if (galMedia && galMedia.tagName === "VIDEO") {
      try { galMedia.pause(); } catch (e) {}
      galMedia.removeAttribute("src"); try { galMedia.load(); } catch (e2) {}
    }
  }
  function galShow(i) {
    if (!galOpen || !galItems.length) { return; }
    galIdx = Math.max(0, Math.min(galItems.length - 1, i));
    var it = galItems[galIdx];
    var main = gal.querySelector(".rchan-gal-main");
    galStopMedia();
    galScale = 1; galPanX = 0; galPanY = 0;                        // each file starts fitted
    if (gal) { gal.classList.remove("rchan-gal-zoomed"); }
    main.innerHTML = "";
    if (it.type === "video") {
      var v = document.createElement("video");
      v.controls = true; v.autoplay = true; v.loop = true; v.playsInline = true;
      v.setAttribute("playsinline", "");
      var sv = loadVol();
      if (sv && typeof sv.v === "number") { try { v.volume = sv.v; v.muted = !!sv.m; } catch (e) {} }
      v.__rchanVol = true;                       // volume persistence hook may now record user changes
      v.src = it.url;
      galMedia = v;
    } else {
      var im = document.createElement("img");
      im.src = it.url; im.alt = it.name;
      galMedia = im;
    }
    main.appendChild(galMedia);
    // preload neighbours (images only — videos buffer on demand)
    [galIdx - 1, galIdx + 1].forEach(function (n) {
      var nx = galItems[n];
      if (nx && nx.type === "img") { var p = new Image(); p.src = nx.url; }
    });
    var meta = gal.querySelector(".rchan-gal-meta");
    meta.firstChild.textContent = (galIdx + 1) + " / " + galItems.length + " · " + it.name;
    // filmstrip: highlight + keep the current thumb in view
    var strips = gal.querySelectorAll(".rchan-gal-thumb");
    for (var s = 0; s < strips.length; s++) {
      strips[s].classList.toggle("rchan-gal-cur", s === galIdx);
    }
    var curThumb = strips[galIdx];
    if (curThumb && curThumb.scrollIntoView) {
      try { curThumb.scrollIntoView({ behavior: SB, block: "nearest", inline: "center" }); } catch (e3) {}
    }
    var pv = gal.querySelector(".rchan-gal-prev"), nb = gal.querySelector(".rchan-gal-next");
    if (pv) { pv.disabled = galIdx === 0; }
    if (nb) { nb.disabled = galIdx === galItems.length - 1; }
  }
  function galStep(dir) { galShow(galIdx + dir); }
  function closeGallery(jump) {
    if (!galOpen) { return; }
    galOpen = false;
    if (galSlideT) { clearInterval(galSlideT); galSlideT = null; }
    var sl = gal && gal.querySelector(".rchan-gal-slide");
    if (sl) { sl.textContent = "slideshow"; }
    galStopMedia();
    if (gal) { gal.style.display = "none"; dialogClosed(gal); }
    document.documentElement.classList.remove("rchan-noscroll");
    var it = galItems[galIdx];
    if (jump && it && it.cell && document.contains(it.cell)) {
      try { it.cell.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {}
      if (it.cell.classList.contains("postCell") || it.cell.classList.contains("opCell")) { kbSelect(it.cell); }
    }
  }
  function galKeydown(e) {
    if (!galOpen) { return; }
    if (e.key === "Escape") {
      if (galScale > 1.01) { galResetZoom(); }                     // first Esc un-zooms, second closes
      else { closeGallery(true); }
    }
    else if (e.key === "ArrowLeft") { galStep(-1); }
    else if (e.key === "ArrowRight") { galStep(1); }
    else if (e.key === "Home") { galShow(0); }
    else if (e.key === "End") { galShow(galItems.length - 1); }
    else if (e.key === "s" && !typing(e)) { toggleSlideshow(); }
    else if (e.key === "g" && !typing(e)) { closeGallery(false); }
    else { return; }
    e.preventDefault(); e.stopPropagation();
  }
  function buildGallery() {
    if (gal) { return; }
    gal = document.createElement("div");
    gal.id = "rchan-gallery";
    gal.setAttribute("role", "dialog"); gal.setAttribute("aria-label", "Media gallery");
    var main = document.createElement("div"); main.className = "rchan-gal-main";
    // click outside the media (the empty main area) closes, like a lightbox
    // backdrop — but the tail end of a pan/pinch is not a click
    main.addEventListener("click", function (e) {
      if (e.target === main && Date.now() - (gal.__galDrag || 0) > 300) { closeGallery(true); }
    });
    initGalleryZoom(main);
    var meta = document.createElement("div"); meta.className = "rchan-gal-meta";
    meta.appendChild(document.createElement("span"));
    var jump = document.createElement("a"); jump.href = "#"; jump.textContent = "open post";
    jump.addEventListener("click", function (e) { e.preventDefault(); closeGallery(true); });
    meta.appendChild(jump);
    var slide = document.createElement("a"); slide.href = "#"; slide.className = "rchan-gal-slide";
    slide.textContent = "slideshow";
    slide.setAttribute("aria-label", "Toggle slideshow");
    slide.addEventListener("click", function (e) { e.preventDefault(); toggleSlideshow(); });
    meta.appendChild(slide);
    var x = document.createElement("button"); x.type = "button"; x.className = "rchan-gal-x";
    x.innerHTML = "✕"; x.setAttribute("aria-label", "Close gallery");
    x.addEventListener("click", function () { closeGallery(false); });
    var prev = document.createElement("button"); prev.type = "button"; prev.className = "rchan-gal-prev";
    prev.innerHTML = "‹"; prev.setAttribute("aria-label", "Previous file");
    prev.addEventListener("click", function () { galStep(-1); });
    var next = document.createElement("button"); next.type = "button"; next.className = "rchan-gal-next";
    next.innerHTML = "›"; next.setAttribute("aria-label", "Next file");
    next.addEventListener("click", function () { galStep(1); });
    var strip = document.createElement("div"); strip.className = "rchan-gal-strip";
    gal.appendChild(main); gal.appendChild(meta); gal.appendChild(strip);
    gal.appendChild(x); gal.appendChild(prev); gal.appendChild(next);
    document.body.appendChild(gal);
    document.addEventListener("keydown", galKeydown, true);       // capture: owns keys while open
  }
  function openGallery(startIdx) {
    galItems = galCollect();
    if (!galItems.length) { toast("No images or videos on this page"); return; }
    buildGallery();
    var strip = gal.querySelector(".rchan-gal-strip");
    strip.innerHTML = "";
    galItems.forEach(function (it, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-gal-thumb";
      b.setAttribute("aria-label", "File " + (i + 1) + ": " + it.name);
      if (it.thumb) {
        var im = document.createElement("img"); im.src = it.thumb; im.alt = ""; im.loading = "lazy";
        b.appendChild(im);
      } else { b.textContent = it.type === "video" ? "▶" : "…"; }
      if (it.type === "video") { b.classList.add("rchan-gal-vid"); }
      b.addEventListener("click", function () { galShow(i); });
      strip.appendChild(b);
    });
    gal.style.display = "flex";
    galOpen = true;
    dialogOpened(gal, gal.querySelector(".rchan-gal-x"));
    document.documentElement.classList.add("rchan-noscroll");
    var start = 0;
    if (typeof startIdx === "number") { start = startIdx; }
    else if (kbCurEl && document.contains(kbCurEl)) {             // start at the selected post's file
      for (var i = 0; i < galItems.length; i++) {
        if (galItems[i].cell === kbCurEl) { start = i; break; }
      }
    }
    galShow(start);
  }
  function toggleGallery() { if (galOpen) { closeGallery(false); } else { openGallery(); } }
  var SVG_GAL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
  function buildGalleryButton() {
    if (document.getElementById("rchan-galbtn")) { return; }
    var nav = document.querySelector("nav, #dynamicHeader");
    if (!nav || !document.querySelector("a.imgLink, a.linkThumb")) { return; }
    var b = document.createElement("button");
    b.type = "button"; b.id = "rchan-galbtn";
    b.innerHTML = SVG_GAL;
    b.setAttribute("data-tooltip", "Gallery mode (g)");
    b.setAttribute("aria-label", "Open the media gallery");
    b.addEventListener("click", function () { toggleGallery(); });
    nav.insertBefore(b, document.getElementById("rchan-expandbtn") || document.getElementById("rchan-findbtn") || document.getElementById("navOptionsSpan") || null);
    // native gallery icon (thread pages, desktop): point it at ours instead
    var natLink = document.getElementById("galleryLink");
    if (natLink) { natLink.onclick = function () { toggleGallery(); return false; }; }
  }

  /* ---------- Command palette (Ctrl+K / Cmd+K) ----------
     One keystroke, every destination: boards, watched threads (unread
     flagged), recent threads, the threads on the open catalog, and the
     site's own actions (settings, gallery, filter, backup…). Fuzzy match:
     substring beats subsequence, earlier beats later. ↑/↓ + Enter or click. */
  var pal = null, palInput = null, palListEl = null, palSel = 0, palResults = [], palBoards = null;
  function fuzzyScore(q, s) {
    if (!q) { return 1; }
    s = s.toLowerCase();
    var idx = s.indexOf(q);
    if (idx > -1) { return 1000 - Math.min(idx, 500); }
    var qi = 0, score = 0, last = -2;
    for (var i = 0; i < s.length && qi < q.length; i++) {
      if (s.charAt(i) === q.charAt(qi)) {
        score += (last === i - 1) ? 3 : 1;
        last = i; qi++;
      }
    }
    return qi === q.length ? score : 0;
  }
  function palUnescape(s) { var d = document.createElement("textarea"); d.innerHTML = s || ""; return d.value; }
  function palGo(entry) {
    closePalette();
    if (entry.fn) { entry.fn(); return; }
    if (entry.url) { location.href = entry.url; }
  }
  function palSources() {
    var out = [];
    function add(kind, title, sub, urlOrFn) {
      var e = { kind: kind, title: title, sub: sub || "" };
      if (typeof urlOrFn === "function") { e.fn = urlOrFn; } else { e.url = urlOrFn; }
      e.hay = (title + " " + e.sub).toLowerCase();
      out.push(e);
    }
    // actions (context-aware)
    add("action", "Site settings", "toggles, filters, custom CSS", toggleSetPanel);
    add("action", "Keyboard shortcuts", "the ? cheat-sheet", toggleKeysOverlay);
    if (document.querySelector("a.imgLink, a.linkThumb")) {
      add("action", "Gallery mode", "every file on this page (g)", function () { openGallery(); });
    }
    if (getBoard() && !curThreadId()) {
      add("action", isCatalog() ? "Switch to index view" : "Switch to catalog view", "this board (c)", toggleCatalog);
    }
    if (curThreadId()) {
      add("action", "Filter posts in this thread", "find bar (f)", function () { toggleFind(); });
      add("action", "Expand all images", "this thread (e per post)", function () { setExpandAll(!expandAllOn); });
    }
    add("action", "Replies to you", "the (You) inbox" + (youboxUnread() ? " — " + youboxUnread() + " unread" : ""), toggleYoubox);
    add("action", (setOn("wsmode", false) ? "Disable" : "Enable") + " work-safe mode", "blur all media until hovered", function () {
      setPut("wsmode", !setOn("wsmode", false)); applyWorkSafe();
      okToast("Work-safe mode " + (setOn("wsmode", false) ? "on" : "off"));
    });
    add("action", "Recent threads panel", "history (🕘)", toggleHistPanel);
    add("action", "Backup my rchan data", "download a merge-safe JSON", exportData);
    add("action", "Home", "front page", "/");
    add("action", "Overboard", "all boards, one stream", "/overboard/");
    // watched threads (unread first-class)
    try {
      var wd = JSON.parse(localStorage.watchedData || "{}");
      Object.keys(wd).forEach(function (b) {
        Object.keys(wd[b] || {}).forEach(function (t) {
          var rec = wd[b][t] || {};
          var unread = (rec.lastReplied || 0) > (rec.lastSeen || 0);
          add("watched", "/" + b + "/ · " + (palUnescape(rec.label) || ("Thread " + t)),
              unread ? "● new replies" : "watched", "/" + b + "/res/" + t);
        });
      });
    } catch (e) {}
    // recent threads
    histLoad().forEach(function (h) {
      add("recent", "/" + h.b + "/ · " + (h.s || ("Thread " + h.t)), fmtAgo(h.ts) + " ago", "/" + h.b + "/res/" + h.t);
    });
    // boards
    (palBoards || []).forEach(function (b) {
      add("board", "/" + b.boardUri + "/ — " + (b.boardName || b.boardUri), b.boardDescription || "", "/" + b.boardUri + "/");
    });
    // threads on the open catalog
    if (isCatalog()) {
      catCells().forEach(function (cell) {
        var a = cell.querySelector("a.linkThumb");
        var href = a && a.getAttribute("href");
        if (!href) { return; }
        var subj = cell.querySelector(".labelSubject");
        var msg = cell.querySelector(".divMessage");
        var label = (subj && subj.textContent.trim()) ||
                    (msg && msg.textContent.replace(/\s+/g, " ").trim().slice(0, 60)) ||
                    ("Thread " + catThreadId(cell));
        add("thread", label, "on this catalog", href);
      });
    }
    return out;
  }
  function palRender() {
    var q = (palInput.value || "").trim().toLowerCase();
    var src = pal.__sources || [];
    var scored = [];
    for (var i = 0; i < src.length; i++) {
      var sc = fuzzyScore(q, src[i].hay);
      if (sc > 0) { scored.push({ e: src[i], s: sc, i: i }); }
    }
    if (q) { scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; }); }
    palResults = scored.slice(0, 14).map(function (r) { return r.e; });
    // no destination matches: fall through to a board-wide deep search for the query
    var pb = getBoard();
    if (!palResults.length && q && pb && pb.charAt(0) !== "." && !isOverboard(pb)) {
      palResults = [{
        kind: "search",
        title: "Search /" + pb + "/ for “" + palInput.value.trim() + "”",
        sub: "deep search — matches inside every reply on the board",
        fn: (function (term) { return function () { deepSearchFor(term); }; })(palInput.value.trim())
      }];
    }
    palSel = Math.max(0, Math.min(palSel, palResults.length - 1));
    palListEl.innerHTML = "";
    if (!palResults.length) {
      var none = document.createElement("div"); none.className = "rchan-pal-none";
      none.textContent = "Nothing matches";
      palListEl.appendChild(none);
      return;
    }
    palResults.forEach(function (e, idx) {
      var row = document.createElement("div");
      row.className = "rchan-pal-row" + (idx === palSel ? " rchan-pal-sel" : "");
      var kind = document.createElement("span"); kind.className = "rchan-pal-kind rchan-pal-" + e.kind;
      kind.textContent = e.kind;
      var ttl = document.createElement("span"); ttl.className = "rchan-pal-title"; ttl.textContent = e.title;
      var sub = document.createElement("span"); sub.className = "rchan-pal-sub"; sub.textContent = e.sub;
      row.appendChild(kind); row.appendChild(ttl); row.appendChild(sub);
      row.addEventListener("mouseenter", function () { palSel = idx; palPaint(); });
      row.addEventListener("click", function () { palGo(e); });
      palListEl.appendChild(row);
    });
  }
  function palPaint() {                          // reselect without a full rebuild
    var rows = palListEl.getElementsByClassName("rchan-pal-row");
    for (var i = 0; i < rows.length; i++) { rows[i].classList.toggle("rchan-pal-sel", i === palSel); }
  }
  function closePalette() { if (pal && pal.style.display === "flex") { pal.style.display = "none"; dialogClosed(pal); } }
  function openPalette() {
    if (!pal) {
      pal = document.createElement("div"); pal.id = "rchan-palette";
      pal.setAttribute("role", "dialog"); pal.setAttribute("aria-label", "Command palette");
      var box = document.createElement("div"); box.className = "rchan-pal-box";
      palInput = document.createElement("input");
      palInput.type = "text"; palInput.placeholder = "Jump to a board, thread, or action…";
      palInput.setAttribute("aria-label", "Search boards, threads and actions");
      palListEl = document.createElement("div"); palListEl.className = "rchan-pal-list";
      box.appendChild(palInput); box.appendChild(palListEl);
      pal.appendChild(box);
      pal.addEventListener("click", function (e) { if (e.target === pal) { closePalette(); } });
      palInput.addEventListener("input", function () { palSel = 0; palRender(); });
      palInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { closePalette(); e.stopPropagation(); }
        else if (e.key === "ArrowDown") { palSel = Math.min(palResults.length - 1, palSel + 1); palPaint(); e.preventDefault(); }
        else if (e.key === "ArrowUp") { palSel = Math.max(0, palSel - 1); palPaint(); e.preventDefault(); }
        else if (e.key === "Enter") { if (palResults[palSel]) { palGo(palResults[palSel]); } e.preventDefault(); }
      });
      document.body.appendChild(pal);
    }
    pal.__sources = palSources();
    if (palBoards === null) {                    // one boards fetch per page, merged in when it lands
      palBoards = [];                            // don't refetch on every open
      fetch("/boards.js?json=1").then(function (r) { return r.json(); }).then(function (res) {
        palBoards = (res && res.data && res.data.boards) || [];
        if (pal.style.display === "flex") { pal.__sources = palSources(); palRender(); }
      }).catch(function () {});
    }
    pal.style.display = "flex";
    palInput.value = ""; palSel = 0;
    palRender();
    dialogOpened(pal, palInput);
  }
  function onPaletteKey(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault(); e.stopPropagation();
      if (pal && pal.style.display === "flex") { closePalette(); } else { openPalette(); }
    }
  }

  // Ctrl/Cmd+Enter in a message box submits (through the native button, so
  // captcha handling, cooldown disabling and callbacks all stay engine-owned)
  function onSubmitKey(e) {
    if (e.key !== "Enter" || (!e.ctrlKey && !e.metaKey) || e.altKey || e.shiftKey) { return; }
    var t = e.target;
    if (!t || t.tagName !== "TEXTAREA") { return; }
    var btn = null;
    if (t.id === "qrbody") { btn = document.getElementById("qrbutton"); }
    else if (t.id === "fieldMessage" || t.getAttribute("name") === "message") { btn = document.getElementById("formButton"); }
    if (!btn || btn.disabled) { return; }
    e.preventDefault();
    btn.click();
  }

  function onEscKey(e) {
    if (e.key !== "Escape") { return; }
    if (pal && pal.style.display === "flex") { closePalette(); return; }
    if (edPanel && edPanel.style.display === "flex") { edClose(); return; }
    if (sheet && sheet.style.display === "flex") { closeSheet(); return; }
    if (youboxPanel && youboxPanel.style.display === "block") { youboxPanel.style.display = "none"; dialogClosed(youboxPanel); return; }
    if (keysOverlay && keysOverlay.style.display === "flex") { keysOverlay.style.display = "none"; dialogClosed(keysOverlay); return; }
    if (convRoot) { closeConv(); return; }
    if (findBar && findBar.style.display === "flex") { closeFind(); return; }
    if (setPanel && setPanel.style.display === "block") { setPanel.style.display = "none"; dialogClosed(setPanel); return; }
    if (histPanel && histPanel.style.display === "block") { histPanel.style.display = "none"; dialogClosed(histPanel); return; }
    if (kbCurEl && document.contains(kbCurEl)) {         // collapse the selected post's expanded image
      var inner = kbCurEl.querySelector(".innerPost, .innerOP");
      var exp = inner && inner.querySelector(".imgExpanded");
      if (exp && exp.style.display !== "none") {
        var a = findImgLink(kbCurEl);
        if (a) { a.click(); }
      }
    }
  }

  /* ---------- First-visit hint: the features exist — say so, once ----------
     ~15 features live behind ?, g, f, Ctrl+K, long-press and the gear; a
     first-time visitor sees plain Yotsuba and learns none of it. One pill,
     one visit, gone on any keypress/dismiss/20s. */
  function initFirstVisitHint() {
    try {
      if (localStorage.getItem("rchan_hinted")) { return; }
      localStorage.setItem("rchan_hinted", "1");               // one shot, ever
    } catch (e) { return; }
    var pill = document.createElement("div");
    pill.id = "rchan-hint";
    pill.setAttribute("role", "status");
    pill.appendChild(document.createTextNode(TOUCH_ONLY
      ? "Tip: long-press a post for actions · the ⚙ button has all the toggles"
      : "Tip: press ? for shortcuts · Ctrl+K jumps anywhere"));
    var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
    x.textContent = "×"; x.setAttribute("aria-label", "Dismiss tip");
    function hide() { if (pill.parentNode) { pill.parentNode.removeChild(pill); } }
    x.addEventListener("click", hide);
    pill.appendChild(x);
    document.body.appendChild(pill);
    setTimeout(hide, 20000);
    document.addEventListener("keydown", function once() {
      hide(); document.removeEventListener("keydown", once);
    });
  }

  /* ---------- Mobile gestures: swipe, long-press action sheet, pull-to-refresh ----------
     Everything keyboard users get from j/k/e/f lives behind keys a phone
     doesn't have. Three touch-native equivalents:
     - swipe left/right in the gallery steps files (same show()/step() path),
     - long-press a post opens a bottom action sheet (Reply / Conversation /
       Copy link / Report / Hide) — the touch twin of the hover strips,
     - pull-down at the top of a board/catalog page refreshes it (the touch
       twin of the liveness pill). */
  function initGallerySwipe() {
    var sx = 0, sy = 0, st = 0, live = false;
    document.addEventListener("touchstart", function (e) {
      if (!galOpen || e.touches.length !== 1) { live = false; return; }
      var t = e.target;
      if (t && (t.tagName === "VIDEO" || (t.closest && t.closest(".rchan-gal-strip")))) { live = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); live = true;
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!live || !galOpen) { return; }
      live = false;
      // zoomed or mid-pinch: the finger is panning/zooming, not paging
      if (galScale > 1.01 || Date.now() - galLastPinch < 500) { return; }
      var t = e.changedTouches && e.changedTouches[0];
      if (!t || Date.now() - st > 600) { return; }
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 2) { return; }
      galStep(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  // Long-press action sheet
  var sheet = null, lpTimer = null, lpCell = null, lpArmed = false, lpSheetAt = 0, lpReleasedAt = 0;
  function closeSheet() { if (sheet && sheet.style.display === "flex") { sheet.style.display = "none"; dialogClosed(sheet); } }
  function sheetBtn(label, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.addEventListener("click", function () { closeSheet(); fn(); });
    return b;
  }
  function openSheet(cell) {
    var ids = qmodIds(cell);
    var no = postIdOf(cell);
    if (!ids && !no) { return; }
    if (!sheet) {
      sheet = document.createElement("div"); sheet.id = "rchan-sheet";
      sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Post actions");
      sheet.addEventListener("click", function (e) { if (e.target === sheet) { closeSheet(); } });
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = "";
    var box = document.createElement("div"); box.className = "rchan-sheet-box";
    var head = document.createElement("div"); head.className = "rchan-sheet-head";
    head.textContent = "No." + (no || (ids && ids.thread));
    box.appendChild(head);
    var isOp = cell.classList.contains("opCell") || !!cell.querySelector(":scope > .innerOP");
    box.appendChild(sheetBtn("Reply — quote this post", function () {
      var q = window.qr;
      if (q && q.showQr) { q.showQr(no); return; }
      var m = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
      if (m) {
        m.value += ">>" + no + "\n";
        m.dispatchEvent(new Event("input", { bubbles: true }));
        m.focus();
      }
    }));
    if (curThreadId()) {
      box.appendChild(sheetBtn("Show this conversation only", function () { openConv(no); }));
    }
    box.appendChild(sheetBtn("Copy link to post", function () {
      var b2 = getBoard(), t2 = ids ? ids.thread : curThreadId();
      var url = location.origin + "/" + b2 + "/res/" + t2 + ".html#" + no;
      var done = function () { okToast("Link copied"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () { toast(url); });
      } else { toast(url); }
    }));
    if (ids && window.postingMenu && postingMenu.showReport) {
      box.appendChild(sheetBtn("Report this post", function () {
        try { postingMenu.showReport(ids.board, ids.thread, ids.post); } catch (e) {}
      }));
    }
    var innerYou = cell.querySelector(".innerPost, .innerOP");
    if (ids && innerYou && innerYou.classList.contains("rchan-you") &&
        window.postingMenu && postingMenu.deleteSinglePost) {
      box.appendChild(sheetBtn(ids.post ? "Delete my post" : "Delete my thread", function () {
        postingMenu.deleteSinglePost(ids.board, ids.thread, ids.post, null, null, null, innerYou);
      }));
    }
    if (ids && window.hiding && hiding.hidePost && hiding.hideThread) {
      var linkSelf = cell.querySelector(".linkSelf");
      if (linkSelf) {
        box.appendChild(sheetBtn(isOp ? "Hide this thread" : "Hide this post", function () {
          lastHideClick = Date.now();                    // arm the Undo toast wrapper
          try {
            if (isOp) { hiding.hideThread(linkSelf, ids.board, ids.thread); }
            else { hiding.hidePost(linkSelf, ids.board, ids.thread, ids.post); }
          } catch (e) {}
        }));
      }
    }
    var cancel = sheetBtn("Cancel", function () {});
    cancel.className = "rchan-sheet-cancel";
    box.appendChild(cancel);
    sheet.appendChild(box);
    sheet.style.display = "flex";
    dialogOpened(sheet, box.querySelector("button"));
    try { if (navigator.vibrate) { navigator.vibrate(10); } } catch (e) {}
  }
  function initLongPress() {
    if (!TOUCH_ONLY) { return; }
    document.addEventListener("touchstart", function (e) {
      clearTimeout(lpTimer); lpCell = null;
      if (e.touches.length !== 1 || galOpen) { return; }
      var t = e.target;
      if (!t || !t.closest) { return; }
      // pressing media/links/buttons keeps native behaviour (save image, etc.)
      if (t.closest("a, img, video, audio, button, input, textarea, select, .rchan-inline-quote, .quoteTooltip")) { return; }
      var cell = t.closest(".postCell, .opCell");
      if (!cell) { return; }
      var x0 = e.touches[0].clientX, y0 = e.touches[0].clientY;
      lpCell = cell;
      lpTimer = setTimeout(function () {
        if (lpCell) { lpArmed = true; lpSheetAt = Date.now(); openSheet(lpCell); }
      }, 500);
      var cancel = function (ev) {
        if (ev.type === "touchmove" && ev.touches.length === 1) {
          var dx = ev.touches[0].clientX - x0, dy = ev.touches[0].clientY - y0;
          if (dx * dx + dy * dy < 100) { return; }       // <10px wobble: still a press
        }
        // the ghost click fires at RELEASE (touchend), which can be long after
        // the 500ms timer — stamp the release so the swallower keys off it
        if (lpArmed && ev.type !== "touchmove") { lpReleasedAt = Date.now(); lpArmed = false; }
        clearTimeout(lpTimer); lpCell = null;
        document.removeEventListener("touchmove", cancel);
        document.removeEventListener("touchend", cancel);
        document.removeEventListener("touchcancel", cancel);
      };
      document.addEventListener("touchmove", cancel, { passive: true });
      document.addEventListener("touchend", cancel, { passive: true });
      document.addEventListener("touchcancel", cancel, { passive: true });
    }, { passive: true });
    // the release that ends a long-press also fires a click — swallow it unless
    // it's a deliberate tap on the sheet's own buttons
    document.addEventListener("click", function (e) {
      if (Date.now() - lpReleasedAt < 500 &&
          !(e.target.closest && e.target.closest(".rchan-sheet-box"))) {
        e.preventDefault(); e.stopPropagation();
      }
    }, true);
    // block the OS context menu around the long-press (Android fires it ~the
    // same moment our timer does; lpArmed covers held-down, the stamp covers release)
    document.addEventListener("contextmenu", function (e) {
      if (lpArmed || Date.now() - lpSheetAt < 1200) { e.preventDefault(); }
    });
  }
  // Pull-to-refresh (board index/catalog; threads live-update over the WS already)
  function initPullRefresh() {
    if (!TOUCH_ONLY) { return; }
    var b = getBoard();
    if (!b || b.charAt(0) === "." || curThreadId()) { return; }
    if (!document.getElementById("divThreads")) { return; }
    document.documentElement.classList.add("rchan-ptr");   // overscroll-behavior: contain
    var startY = 0, pulling = false, dist = 0, ind = null;
    var ARM = 120;                                          // px of pull that triggers a refresh
    function indicator() {
      if (!ind) {
        ind = document.createElement("div"); ind.id = "rchan-ptrind";
        ind.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4l-2.35 2.35z"/></svg><span></span>';
        document.body.appendChild(ind);
      }
      return ind;
    }
    document.addEventListener("touchstart", function (e) {
      pulling = false;
      if (e.touches.length !== 1 || galOpen || (window.scrollY || 0) > 0) { return; }
      startY = e.touches[0].clientY; pulling = true; dist = 0;
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!pulling) { return; }
      dist = e.touches[0].clientY - startY;
      if (dist <= 12 || (window.scrollY || 0) > 0) {
        if (ind) { ind.style.opacity = "0"; }
        return;
      }
      var el = indicator();
      el.style.opacity = String(Math.min(1, dist / ARM));
      el.style.transform = "translate(-50%," + Math.min(dist / 2, 70) + "px)";
      el.classList.toggle("rchan-ptr-armed", dist > ARM);
      el.lastChild.textContent = dist > ARM ? "Release to refresh" : "Pull to refresh";
    }, { passive: true });
    document.addEventListener("touchend", function () {
      if (!pulling) { return; }
      pulling = false;
      if (!ind) { return; }
      if (dist > ARM) {
        ind.lastChild.textContent = "Refreshing…";
        location.reload();
      } else {
        ind.style.opacity = "0"; ind.style.transform = "translate(-50%,0)";
      }
    }, { passive: true });
  }

  /* ---------- init + observe ---------- */
  var pending = false;
  function refresh() { if (pending) { return; } pending = true; setTimeout(function () { pending = false; decorateYou(document); decorateIcons(document); decorateThumbs(document); decorateIdPills(document); decorateFileSearch(document); decorateFileFilterButtons(document); decorateSideCatalog(); markNewInThread(); markVisitedInCatalog(); scanRepliesToYou(); enhancePostForm(); enhanceQuickReply(); initDrafts(); hookQrDraft(); patchShowQr(); tryFlashOwnPost(); updateThreadStat(); tidyWatcherBadge(); applyFind(); applyConv(); decorateConvButtons(document); decorateReportButtons(document); decorateQuickMod(document); decorateGets(document); decorateOwnDelete(document); applyExtraFilters(); syncEmptyState(); buildGalleryButton(); decorateSelectedCells(document); if (expandAllOn) { setExpandAll(true); } }, 80); }
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
    document.addEventListener("keydown", onPaletteKey, true);   // Ctrl/Cmd+K, even while typing
    document.addEventListener("keydown", onSubmitKey);          // Ctrl/Cmd+Enter submits the reply
    // arm the WebAudio context inside a real user gesture so later chimes can play
    document.addEventListener("pointerdown", armAudio, { once: true, capture: true });
    document.addEventListener("keydown", armAudio, { once: true, capture: true });
    // (You) inbox: other tabs' scans update our badge; returning to a thread reads it
    window.addEventListener("storage", function (e) {
      if (e.key === YOUBOX_KEY) { updateYouboxBadge(); }
    });
    document.addEventListener("visibilitychange", function () {
      var b = getBoard(), t = curThreadId();
      if (!document.hidden && b && t) { youboxMarkThreadRead(b, t); }
    });
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
     function () { decorateYou(document); }, markNewInThread, markNewInCatalog, markVisitedInCatalog, scanRepliesToYou, enhancePostForm, enhanceQuickReply,
     hookAlerts, hookCaptchaReload, initCaptchaLifecycle, hookFilterStubs, hookHideUndo, hookWatcherThrottle, hookWatcherNotify, hookYouboxScan, updateYouboxBadge, hookFilePrivacy, initDrafts, hookQrDraft, patchShowQr, enableRelativeTimes, recordVisit, initScrollResume, initPresence, initSitePresence, initBoardLiveness, hookVolumePersistence,
     function () { decorateIdPills(document); }, function () { decorateFileSearch(document); }, function () { decorateFileFilterButtons(document); }, decorateSideCatalog, updateThreadStat, buildFindButton, buildExpandButton, buildGalleryButton, buildBanner, syncEmptyState, applyBoardAccent,
     function () { decorateConvButtons(document); }, function () { decorateReportButtons(document); },
     function () { decorateGets(document); }, function () { decorateOwnDelete(document); }, buildActiveThreads,
     initGallerySwipe, initLongPress, initPullRefresh, initAutoTheme, applyCustomCss, applyWorkSafe, initFirstVisitHint, initBackupNudge, pruneOnceStamps
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
