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
  function goCatalog() {
    var b = getBoard();
    if (b && b.charAt(0) !== ".") { location.href = "/" + b + "/catalog.html"; }
  }

  /* ---------- Floating nav buttons (top / catalog / bottom) ---------- */
  function buildNav() {
    if (document.getElementById("rchan-nav")) { return; }
    var wrap = document.createElement("div");
    wrap.id = "rchan-nav";
    function btn(label, title, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.title = title;
      b.addEventListener("click", fn);
      wrap.appendChild(b);
    }
    btn("↑", "Top", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    if (getBoard()) { btn("☷", "Catalog", goCatalog); } // ☷ grid glyph
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
  function onOver(e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") { return; }
    var a = (img.closest && img.closest("a")) || img.parentNode;
    var href = a && a.getAttribute ? a.getAttribute("href") : null;
    if (!isImg(href)) { return; }
    if (!zoom) { zoom = document.createElement("img"); zoom.id = "rchan-zoom"; document.body.appendChild(zoom); }
    zoom.src = href; zoom.style.display = "block"; onMove(e);
  }
  function onMove(e) {
    if (!zoom || zoom.style.display !== "block") { return; }
    var pad = 16, x = e.clientX + pad, y = e.clientY + pad;
    if (x + zoom.offsetWidth > window.innerWidth) { x = e.clientX - zoom.offsetWidth - pad; }
    if (y + zoom.offsetHeight > window.innerHeight) { y = Math.max(4, window.innerHeight - zoom.offsetHeight - 4); }
    zoom.style.left = Math.max(4, x) + "px"; zoom.style.top = Math.max(4, y) + "px";
  }
  function onOut(e) { if (e.target && e.target.tagName === "IMG" && zoom) { zoom.style.display = "none"; zoom.src = ""; } }

  /* ---------- Keyboard shortcuts ---------- */
  function typing(e) {
    var t = e.target, g = t && t.tagName;
    return g === "INPUT" || g === "TEXTAREA" || g === "SELECT" || (t && t.isContentEditable);
  }
  function onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) { return; }
    if (e.key === "t") { window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (e.key === "b") { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
    else if (e.key === "c") { goCatalog(); }
    else if (e.key === "r") {
      var m = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
      if (m) { m.focus(); e.preventDefault(); }
    }
  }

  /* ---------- init + observe ---------- */
  var pending = false;
  function refresh() { if (pending) { return; } pending = true; setTimeout(function () { pending = false; decorateHide(document); decorateYou(document); }, 80); }
  function init() {
    buildNav();
    decorateHide(document);
    decorateYou(document);
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("keydown", onKey);
    try { new MutationObserver(refresh).observe(document.documentElement, { subtree: true, childList: true }); } catch (e) {}
  }
  hookPostCapture(); // wrap request APIs early, before any post is sent
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
