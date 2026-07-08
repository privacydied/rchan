
  /* ---------- Live updates: route LynxChan's separate-port WebSocket through the
     same-origin 443 path (/.ws) the reverse proxy upgrades. thread.js builds
     ws(s)://<hostname>:<wsPort>; behind Cloudflare that custom port isn't reachable,
     so rewrite any such same-host cross-port ws URL to wss://<host>/.ws. ---------- */
  (function patchWebSocket() {
    var Native = window.WebSocket;
    if (!Native) { return; }
    function Patched(url, protocols) {
      var track = false;
      try {
        var u = new URL(url, location.href);
        var wsish = (u.protocol === "ws:" || u.protocol === "wss:");
        if (wsish && u.hostname === location.hostname && u.port && u.port !== location.port) {
          u.protocol = (location.protocol === "https:") ? "wss:" : "ws:";
          u.port = "";
          u.pathname = "/.ws";
          url = u.toString();
          track = true;                              // this is the thread live-update socket
        }
      } catch (e) {}
      var sock = protocols === undefined ? new Native(url) : new Native(url, protocols);
      if (track) {                                   // surface connection health (wsStateChange is hoisted)
        try {
          sock.addEventListener("open", function () { wsStateChange("live"); });
          sock.addEventListener("close", function () { wsStateChange("down"); });
          sock.addEventListener("error", function () { wsStateChange("down"); });
        } catch (e2) {}
      }
      return sock;
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
  // When the quota trips, identity quietly stops persisting — every write
  // path swallowed the error. Say it once per session, with the fix attached.
  var storageWarned = false;
  function storageFailed() {
    if (storageWarned) { return; }
    storageWarned = true;
    try {
      toastAction("Browser storage is full — your rchan data may not be saving", "Back up now", exportData);
    } catch (e) {}
  }
  function save(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr.slice(-5000))); }
    catch (e) { storageFailed(); }
  }
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

