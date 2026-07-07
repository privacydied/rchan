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
  function isCatalog() { return /\/catalog(\.html)?$/.test(location.pathname); }
  function toggleCatalog() {
    var b = getBoard();
    if (!b || b.charAt(0) === ".") { return; }
    // "?index" bypasses the router's board-root -> catalog redirect (see nginx default.conf)
    location.href = isCatalog() ? ("/" + b + "/?index") : ("/" + b + "/catalog");
  }

  /* ---------- Floating nav buttons (top / catalog-toggle / bottom) ---------- */
  function buildNav() {
    if (document.getElementById("rchan-nav")) { return; }
    var wrap = document.createElement("div");
    wrap.id = "rchan-nav";
    function btn(html, title, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.innerHTML = html; b.title = title;
      b.addEventListener("click", fn);
      wrap.appendChild(b);
      return b;
    }
    btn("↑", "Top", function () { window.scrollTo({ top: 0, behavior: SB }); });
    if (getBoard()) {
      var onCat = isCatalog();
      btn(onCat ? SVG_LIST : SVG_GRID, onCat ? "Back to index view" : "Catalog view", toggleCatalog);
    }
    if (document.querySelector("#fieldMessage, #qrbody, textarea[name=message]")) {
      btn("✎", "Reply / post", function () {
        var pf = document.getElementById("postingForm");                 // expand if collapsed
        if (pf && pf.classList.contains("rchan-collapsed")) {
          pf.classList.remove("rchan-collapsed");
          var t = document.getElementById("rchan-formtoggle");
          if (t) { t.textContent = formLabels().hide; t.setAttribute("aria-expanded", "true"); }
          try { localStorage.removeItem("rchan_form_collapsed"); } catch (e) {}
        }
        var m = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
        if (m) { m.focus(); try { m.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
      });
    }
    if (curThreadId() && "Notification" in window) {
      var bell = btn("🔔", "Notify me of new replies in this thread (while this tab is open)", function () {
        if (localStorage.getItem(NOTIFY_KEY) === "1") { localStorage.removeItem(NOTIFY_KEY); bell.classList.remove("rchan-on"); return; }
        Notification.requestPermission().then(function (p) {
          if (p === "granted") { localStorage.setItem(NOTIFY_KEY, "1"); bell.classList.add("rchan-on"); }
        });
      });
      if (localStorage.getItem(NOTIFY_KEY) === "1") { bell.classList.add("rchan-on"); }
    }
    btn("↓", "Bottom", function () {
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

  /* ---------- "(You)" — record your own posts, then highlight ---------- */
  function addYou(id) {
    id = String(id).replace(/\D/g, "");
    if (!id) { return; }
    var a = load(YOU_KEY);
    if (a.indexOf(id) < 0) { a.push(id); save(YOU_KEY, a); refresh(); }
  }
  function hookPostCapture() {
    var re = /\/(replyThread|newThread)\.js/;
    var oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return oOpen.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
      var x = this;
      this.addEventListener("load", function () {
        try {
          if (re.test(x.__u || "")) {
            var r = JSON.parse(x.responseText);
            if (r && r.status === "ok" && r.data != null) { addYou(r.data); }
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
              if (r && r.status === "ok" && r.data != null) { addYou(r.data); }
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
    vidzoom.style.display = "block";
    var p = vidzoom.play(); if (p && p.catch) { p.catch(function () {}); }
    placeFloat(vidzoom, e);
  }
  function onVidOut(e) { if (e.target && e.target.tagName === "IMG") { hideVidZoom(); } }

  /* ---------- Keyboard shortcuts ---------- */
  function typing(e) {
    var t = e.target, g = t && t.tagName;
    return g === "INPUT" || g === "TEXTAREA" || g === "SELECT" || (t && t.isContentEditable);
  }
  function onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) { return; }
    if (e.key === "t") { window.scrollTo({ top: 0, behavior: SB }); }
    else if (e.key === "b") { window.scrollTo({ top: document.body.scrollHeight, behavior: SB }); }
    else if (e.key === "c") { toggleCatalog(); }
    else if (e.key === "r") {
      var m = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
      if (m) { m.focus(); e.preventDefault(); }
    }
  }

  /* ---------- Catalog toolbar: sort + card-size (persisted) + prefetch-on-hover ---------- */
  var CAT_KEY = "rchan_catsize", CAT_SIZES = ["s", "m", "l", "xl"], CAT_NAMES = { s: "Small", m: "Medium", l: "Large", xl: "XL" };
  var SORT_KEY = "rchan_catsort", SORT_MODES = ["bump", "new", "replies", "images"];
  var SORT_NAMES = { bump: "Bump order", new: "Newest", replies: "Most replies", images: "Most images" };
  function applyCatSize(sz) {
    if (CAT_SIZES.indexOf(sz) < 0) { sz = "m"; }
    for (var i = 0; i < CAT_SIZES.length; i++) { document.body.classList.remove("rchan-cat-" + CAT_SIZES[i]); }
    document.body.classList.add("rchan-cat-" + sz);
  }
  var catalogOrig = null;
  function catCells() { var t = document.getElementById("divThreads"); return t ? Array.prototype.slice.call(t.getElementsByClassName("catalogCell")) : []; }
  function catNum(cell, cls) { var e = cell.getElementsByClassName(cls)[0]; return e ? (parseInt((e.textContent || "").replace(/\D/g, ""), 10) || 0) : 0; }
  function catThreadId(cell) { var a = cell.getElementsByClassName("linkThumb")[0]; var m = a && (a.getAttribute("href") || "").match(/\/res\/(\d+)/); return m ? parseInt(m[1], 10) : 0; }
  function sortCatalog(mode) {
    var t = document.getElementById("divThreads"); if (!t) { return; }
    var cells = catCells(); if (!cells.length) { return; }
    if (!catalogOrig) { catalogOrig = cells.slice(); }         // capture bump (server) order once
    var s;
    if (mode === "new") { s = cells.slice().sort(function (a, b) { return catThreadId(b) - catThreadId(a); }); }
    else if (mode === "replies") { s = cells.slice().sort(function (a, b) { return catNum(b, "labelReplies") - catNum(a, "labelReplies"); }); }
    else if (mode === "images") { s = cells.slice().sort(function (a, b) { return catNum(b, "labelImages") - catNum(a, "labelImages"); }); }
    else { s = catalogOrig.filter(function (c) { return c.parentNode === t; }); }
    s.forEach(function (c) { t.appendChild(c); });             // appendChild moves existing nodes → reorders
  }
  function mkSelect(id, modes, names, cur, onChange) {
    var s = document.createElement("select"); s.id = id;
    for (var i = 0; i < modes.length; i++) {
      var o = document.createElement("option"); o.value = modes[i]; o.textContent = names[modes[i]];
      if (modes[i] === cur) { o.selected = true; } s.appendChild(o);
    }
    s.addEventListener("change", function () { onChange(s.value); });
    var l = document.createElement("label"); l.appendChild(s); return l;
  }
  function buildCatalogTools() {
    if (!isCatalog()) { return; }
    var curSize = localStorage.getItem(CAT_KEY) || "m"; applyCatSize(curSize);
    var curSort = localStorage.getItem(SORT_KEY) || "bump"; if (curSort !== "bump") { sortCatalog(curSort); }
    var threads = document.getElementById("divThreads");
    if (!threads || document.getElementById("rchan-cattools")) { return; }
    var bar = document.createElement("div"); bar.id = "rchan-cattools";
    var s1 = mkSelect("rchan-catsort", SORT_MODES, SORT_NAMES, curSort, function (v) { localStorage.setItem(SORT_KEY, v); sortCatalog(v); });
    s1.insertBefore(document.createTextNode("Sort "), s1.firstChild);
    var s2 = mkSelect("rchan-catsize", CAT_SIZES, CAT_NAMES, curSize, function (v) { localStorage.setItem(CAT_KEY, v); applyCatSize(v); });
    s2.insertBefore(document.createTextNode("Card size "), s2.firstChild);
    bar.appendChild(s1); bar.appendChild(s2);
    threads.parentNode.insertBefore(bar, threads);
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
    var r = cell.getBoundingClientRect(), w = 360;
    var x = r.right + 8, y = r.top;
    if (x + w > window.innerWidth - 8) { x = Math.max(8, r.left - w - 8); }   // flip to the left edge
    catPrev.style.left = x + "px";
    catPrev.style.top = "0px";                                                 // measure at a stable position
    var h = catPrev.offsetHeight;
    if (y + h > window.innerHeight - 8) { y = Math.max(8, window.innerHeight - h - 8); }
    catPrev.style.top = y + "px";
  }
  function onCatPrevOver(e) {
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
    linkQuote: "Reply — quotes this post"       // clicking a post No. opens Quick Reply with >>N
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
  function decorateIcons(root) {
    var icons = (root || document).querySelectorAll(".coloredIcon, #favouriteButton, .watchButton, .linkQuote");
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
  // On a thread: highlight posts newer than the last time you viewed it, drop a divider,
  // then record the current high-water mark. Re-runs on live WS posts (highlights those too).
  function markNewInThread() {
    if (isCatalog()) { return; }
    var board = getBoard(), tid = curThreadId();
    if (!board || !tid) { return; }
    var posts = document.getElementsByClassName("postCell");
    if (!posts.length) { return; }
    var key = board + "/" + tid, all = seenAll(), rec = all[key] || { maxId: 0, replies: 0 };
    var curMax = rec.maxId, firstNew = null, newCount = 0;
    for (var i = 0; i < posts.length; i++) {
      var id = postIdOf(posts[i]);
      if (id > curMax) { curMax = id; }
      if (rec.maxId && id > rec.maxId && !posts[i].getAttribute("data-new")) {
        posts[i].setAttribute("data-new", "1");
        posts[i].classList.add("rchan-new");
        if (!firstNew) { firstNew = posts[i]; }
        newCount++;
      }
    }
    if (firstNew && !document.getElementById("rchan-newline")) {
      var d = document.createElement("div"); d.id = "rchan-newline";
      d.textContent = newCount + " new post" + (newCount > 1 ? "s" : "") + " since last visit";
      firstNew.parentNode.insertBefore(d, firstNew);
    }
    all[key] = { maxId: curMax, replies: posts.length };
    seenSave(all);
    // Foreground desktop notification when new posts land while the tab is hidden (opt-in via 🔔).
    if (newCount > 0 && document.hidden && "Notification" in window &&
        Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "1") {
      try {
        var n = new Notification("rchan — " + newCount + " new repl" + (newCount > 1 ? "ies" : "y"), {
          body: "/" + board + "/ · thread " + tid, icon: "/.rchan/icon-192.png", tag: "rchan-" + board + "-" + tid
        });
        n.onclick = function () { window.focus(); this.close(); };
      } catch (e) {}
    }
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
      if (set[postIdOf(posts[i])]) { continue; }                    // skip your own posts
      var qs = posts[i].getElementsByClassName("quoteLink");
      for (var j = 0; j < qs.length; j++) {
        var m = (qs[j].getAttribute("href") || "").match(/(\d+)\s*$/) || (qs[j].textContent || "").match(/(\d+)/);
        if (m && set[m[1]]) { youHits.push(posts[i]); break; }
      }
    }
    if (!youHits.length) { if (youBtn) { youBtn.style.display = "none"; } return; }
    if (!youBtn) {
      youBtn = document.createElement("button"); youBtn.id = "rchan-youbtn"; youBtn.type = "button";
      youBtn.title = "Jump to replies to your posts";
      youBtn.addEventListener("click", function () {
        youIdx = (youIdx + 1) % youHits.length;
        youHits[youIdx].scrollIntoView({ behavior: SB, block: "center" });
      });
      document.body.appendChild(youBtn);
    }
    youBtn.style.display = "";
    youBtn.textContent = "↩ " + youHits.length + " repl" + (youHits.length > 1 ? "ies" : "y") + " to you";
  }

  /* ---------- Post form: formatting toolbar, char counter, paste/drop, file previews ---------- */
  var MAX_FILE = 32 * 1048576;   // maxFileSizeMB
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
    var count = document.createElement("span"); count.className = "rchan-charcount"; bar.appendChild(count);
    var upd = function () { count.textContent = msg.value.length + " chars"; };
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
  }
  function enhancePostForm() {
    var form = document.getElementById("postingForm");
    if (!form || form.getAttribute("data-enh")) { return; }
    var msg = document.getElementById("fieldMessage");
    var input = document.getElementById("inputFiles");
    if (!msg && !input) { return; }
    form.setAttribute("data-enh", "1");

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
    tog.addEventListener("click", function () {
      var collapse = !form.classList.contains("rchan-collapsed");   // visible now → collapse
      setCollapsed(collapse);
      try { collapse ? localStorage.setItem(COLLAPSE_KEY, "1") : localStorage.removeItem(COLLAPSE_KEY); } catch (e) {}
    });
    if (localStorage.getItem(COLLAPSE_KEY) === "1") {                // apply initial state w/o animating
      form.style.transition = "none"; setCollapsed(true); void form.offsetHeight; form.style.transition = "";
    } else { setCollapsed(false); }
    if (msg) {
      msg.parentNode.insertBefore(buildFmtBar(msg), msg);
      if (input) {
        msg.addEventListener("paste", function (e) {
          var items = e.clipboardData && e.clipboardData.items; if (!items) { return; }
          var add = [];
          for (var i = 0; i < items.length; i++) { if (items[i].kind === "file") { var f = items[i].getAsFile(); if (f) { add.push(f); } } }
          if (add.length) { addFiles(input, add); }
        });
      }
    }
    if (input) {
      var tray = document.createElement("div"); tray.id = "rchan-filetray"; tray.className = "rchan-filetray";
      (input.parentNode || form).appendChild(tray);
      input.addEventListener("change", function () { renderTray(input); });
      form.addEventListener("dragover", function (e) { e.preventDefault(); form.classList.add("rchan-dragover"); });
      form.addEventListener("dragleave", function (e) { if (e.target === form) { form.classList.remove("rchan-dragover"); } });
      form.addEventListener("drop", function (e) {
        e.preventDefault(); form.classList.remove("rchan-dragover");
        var fs = e.dataTransfer && e.dataTransfer.files;
        if (fs && fs.length) { addFiles(input, Array.prototype.slice.call(fs)); }
      });
      renderTray(input);
    }
  }

  /* ---------- init + observe ---------- */
  var pending = false;
  function refresh() { if (pending) { return; } pending = true; setTimeout(function () { pending = false; decorateYou(document); decorateIcons(document); decorateThumbs(document); markNewInThread(); scanRepliesToYou(); enhancePostForm(); enhanceQuickReply(); }, 80); }
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
    // instant styled tooltips for [data-tooltip] icons
    document.addEventListener("mouseover", onTipOver, true);
    document.addEventListener("mouseout", onTipOut, true);
    document.addEventListener("focusin", onTipOver, true);
    document.addEventListener("focusout", hideTip, true);
    document.addEventListener("scroll", hideTip, true);
    document.addEventListener("click", hideTip, true);
    document.addEventListener("keydown", onKey);
    // Enhancers — each guarded so one failure can't cascade and kill the rest (or the listeners above).
    [buildNav, buildCatalogTools, function () { decorateIcons(document); }, function () { decorateThumbs(document); },
     function () { decorateYou(document); }, markNewInThread, markNewInCatalog, scanRepliesToYou, enhancePostForm, enhanceQuickReply
    ].forEach(function (fn) { try { fn(); } catch (e) { if (window.console) { console.error("[ux] init step failed", e); } } });
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
