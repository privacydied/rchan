// rchan UX layer — same-origin (CSP-safe) client enhancements.
// Nav buttons, per-post hide, "(You)" highlighting, image hover-zoom, keyboard shortcuts.
(function () {
  "use strict";

  function getBoard() {
    var el = document.getElementById("boardIdentifier");
    if (el && el.value) { return el.value; }
    var m = location.pathname.match(/^\/([^\/.]+)\//);
    return m ? m[1] : null;
  }
  var SVG_GRID = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  var SVG_LIST = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
  function isCatalog() { return /\/catalog(\.html)?$/.test(location.pathname); }
  function toggleCatalog() {
    var b = getBoard();
    if (!b || b.charAt(0) === ".") { return; }
    location.href = isCatalog() ? ("/" + b + "/") : ("/" + b + "/catalog.html");
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
    }
    btn("↑", "Top", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    if (getBoard()) {
      var onCat = isCatalog();
      btn(onCat ? SVG_LIST : SVG_GRID, onCat ? "Back to index view" : "Catalog view", toggleCatalog);
    }
    btn("↓", "Bottom", function () {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
    document.body.appendChild(wrap);
  }

  /* ---------- localStorage helpers ---------- */
  function load(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; } }
  function save(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr.slice(-5000))); } catch (e) {} }
  var HIDE_KEY = "rchan_hidden", YOU_KEY = "rchan_you";
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

  /* ---------- Per-post hide (persisted) ---------- */
  function setHidden(inner, id, hide) {
    var arr = load(HIDE_KEY), idx = arr.indexOf(id);
    if (hide && idx < 0) { arr.push(id); save(HIDE_KEY, arr); }
    if (!hide && idx > -1) { arr.splice(idx, 1); save(HIDE_KEY, arr); }
    var stub = inner.previousSibling && inner.previousSibling.className === "rchan-stub" ? inner.previousSibling : null;
    if (hide) {
      inner.style.display = "none";
      if (!stub) {
        stub = document.createElement("span");
        stub.className = "rchan-stub";
        stub.textContent = "[+] hidden post " + (id ? "#" + id : "");
        stub.addEventListener("click", function () { setHidden(inner, id, false); });
        inner.parentNode.insertBefore(stub, inner);
      }
    } else {
      inner.style.display = "";
      if (stub) { stub.remove(); }
    }
  }
  function decorateHide(root) {
    var posts = (root || document).querySelectorAll(".innerPost, .innerOP"), hidden = load(HIDE_KEY);
    for (var i = 0; i < posts.length; i++) {
      var inner = posts[i];
      if (inner.getAttribute("data-hide")) { continue; }
      inner.setAttribute("data-hide", "1");
      var id = postId(inner), anchor = inner.querySelector(".linkQuote");
      if (anchor) {
        var t = document.createElement("span");
        t.className = "rchan-hide"; t.title = "Hide post"; t.textContent = "−"; // −
        (function (ir, ii) { t.addEventListener("click", function () { setHidden(ir, ii, true); }); })(inner, id);
        anchor.parentNode.insertBefore(t, anchor);
      }
      if (id && hidden.indexOf(id) > -1) { setHidden(inner, id, true); }
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
  function onMove(e) {
    if (!zoom || zoom.style.display !== "block") { return; }
    var pad = 16, x = e.clientX + pad, y = e.clientY + pad;
    if (x + zoom.offsetWidth > window.innerWidth) { x = e.clientX - zoom.offsetWidth - pad; }
    if (y + zoom.offsetHeight > window.innerHeight) { y = Math.max(4, window.innerHeight - zoom.offsetHeight - 4); }
    zoom.style.left = Math.max(4, x) + "px"; zoom.style.top = Math.max(4, y) + "px";
  }
  function onOut(e) { if (e.target && e.target.tagName === "IMG") { hideZoom(); } }

  /* ---------- Keyboard shortcuts ---------- */
  function typing(e) {
    var t = e.target, g = t && t.tagName;
    return g === "INPUT" || g === "TEXTAREA" || g === "SELECT" || (t && t.isContentEditable);
  }
  function onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) { return; }
    if (e.key === "t") { window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (e.key === "b") { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
    else if (e.key === "c") { toggleCatalog(); }
    else if (e.key === "r") {
      var m = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
      if (m) { m.focus(); e.preventDefault(); }
    }
  }

  /* ---------- Catalog: card-size selector (S/M/L/XL, persisted) ---------- */
  var CAT_KEY = "rchan_catsize", CAT_SIZES = ["s", "m", "l", "xl"], CAT_NAMES = { s: "Small", m: "Medium", l: "Large", xl: "XL" };
  function applyCatSize(sz) {
    if (CAT_SIZES.indexOf(sz) < 0) { sz = "m"; }
    for (var i = 0; i < CAT_SIZES.length; i++) { document.body.classList.remove("rchan-cat-" + CAT_SIZES[i]); }
    document.body.classList.add("rchan-cat-" + sz);
  }
  function buildCatalogSize() {
    if (!isCatalog()) { return; }
    var cur = localStorage.getItem(CAT_KEY) || "m";
    applyCatSize(cur);
    var threads = document.getElementById("divThreads");
    if (!threads || document.getElementById("rchan-catsize")) { return; }
    var bar = document.createElement("div");
    bar.id = "rchan-catsize";
    var label = document.createElement("label");
    label.textContent = "Card size ";
    var sel = document.createElement("select");
    for (var i = 0; i < CAT_SIZES.length; i++) {
      var o = document.createElement("option");
      o.value = CAT_SIZES[i]; o.textContent = CAT_NAMES[CAT_SIZES[i]];
      if (CAT_SIZES[i] === cur) { o.selected = true; }
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () {
      localStorage.setItem(CAT_KEY, sel.value);
      applyCatSize(sel.value);
    });
    label.appendChild(sel);
    bar.appendChild(label);
    threads.parentNode.insertBefore(bar, threads);
  }

  /* ---------- Icon tooltips (secondaryBar + nav coloredIcons have no labels) ---------- */
  var ICON_TITLES = {
    linkBack: "Return to board index", linkReturn: "Return to board index",
    linkTop: "Go to top", linkBottom: "Go to bottom",
    navCatalog: "Catalog", linkLogs: "Board logs", linkRss: "RSS feed",
    navLinkHome: "Home", navBoardList: "Board list", navOverboard: "Overboard",
    navPosting: "Posting help", linkManagement: "Board management",
    linkModeration: "Moderate this board", navOptions: "Settings",
    linkAccount: "Your account", linkGlobalManagement: "Global management"
  };
  function humanizeId(id) {
    var s = id.replace(/^(link|nav)/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }
  function decorateIcons(root) {
    var icons = (root || document).querySelectorAll(".coloredIcon");
    for (var i = 0; i < icons.length; i++) {
      var a = icons[i];
      if (a.getAttribute("data-tip")) { continue; }
      a.setAttribute("data-tip", "1");
      var t = ICON_TITLES[a.id] || (a.id ? humanizeId(a.id) : "");
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

  /* ---------- init + observe ---------- */
  var pending = false;
  function refresh() { if (pending) { return; } pending = true; setTimeout(function () { pending = false; decorateHide(document); decorateYou(document); decorateIcons(document); }, 80); }
  function init() {
    buildNav();
    buildCatalogSize();
    decorateIcons(document);
    decorateHide(document);
    decorateYou(document);
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseout", onOut, true);
    // clicking a thumb expands it in place (thumb swapped out under a stationary cursor,
    // so no fresh mouseover fires) — drop the floating preview so it never sticks.
    document.addEventListener("click", hideZoom, true);
    // instant styled tooltips for [data-tooltip] icons
    document.addEventListener("mouseover", onTipOver, true);
    document.addEventListener("mouseout", onTipOut, true);
    document.addEventListener("focusin", onTipOver, true);
    document.addEventListener("focusout", hideTip, true);
    document.addEventListener("scroll", hideTip, true);
    document.addEventListener("click", hideTip, true);
    document.addEventListener("keydown", onKey);
    try { new MutationObserver(refresh).observe(document.documentElement, { subtree: true, childList: true }); } catch (e) {}
  }
  hookPostCapture(); // wrap request APIs early, before any post is sent
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
