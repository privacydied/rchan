// rchan UX layer — same-origin (CSP-safe) client enhancements.
// Floating nav buttons, per-post hide, keyboard shortcuts, image hover-zoom.
(function () {
  "use strict";

  var boardMatch = location.pathname.match(/^\/([^\/]+)\//);
  var boardUri = boardMatch ? boardMatch[1] : null;

  /* ---------- Floating nav buttons (top / bottom / catalog) ---------- */
  function buildNav() {
    if (document.getElementById("rchan-nav")) { return; }
    var wrap = document.createElement("div");
    wrap.id = "rchan-nav";
    function btn(label, title, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.title = title;
      b.addEventListener("click", fn);
      wrap.appendChild(b);
      return b;
    }
    btn("↑", "Top", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    // catalog only makes sense on a board/thread page
    if (boardUri && boardUri.charAt(0) !== ".") {
      btn("▦", "Catalog", function () { location.href = "/" + boardUri + "/catalog.html"; });
    }
    btn("↓", "Bottom", function () {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
    document.body.appendChild(wrap);
  }

  /* ---------- Per-post hide (persisted in localStorage) ---------- */
  var HIDE_KEY = "rchan_hidden";
  function hiddenSet() {
    try { return JSON.parse(localStorage.getItem(HIDE_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveHidden(arr) { try { localStorage.setItem(HIDE_KEY, JSON.stringify(arr.slice(-2000))); } catch (e) {} }
  function postId(inner) {
    var q = inner.querySelector(".linkQuote");
    return q ? (q.textContent || "").trim() : null;
  }
  function setHidden(inner, id, hide) {
    var arr = hiddenSet();
    var idx = arr.indexOf(id);
    if (hide && idx < 0) { arr.push(id); saveHidden(arr); }
    if (!hide && idx > -1) { arr.splice(idx, 1); saveHidden(arr); }
    var stub = inner.previousSibling && inner.previousSibling.className === "rchan-stub"
      ? inner.previousSibling : null;
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
    var posts = (root || document).querySelectorAll(".innerPost, .innerOP");
    var hidden = hiddenSet();
    for (var i = 0; i < posts.length; i++) {
      var inner = posts[i];
      if (inner.getAttribute("data-rchan-hide")) { continue; }
      inner.setAttribute("data-rchan-hide", "1");
      var id = postId(inner);
      var anchor = inner.querySelector(".linkQuote");
      if (anchor) {
        var t = document.createElement("span");
        t.className = "rchan-hide"; t.title = "Hide post"; t.textContent = "−"; // minus
        (function (innerRef, idRef) {
          t.addEventListener("click", function () { setHidden(innerRef, idRef, true); });
        })(inner, id);
        anchor.parentNode.insertBefore(t, anchor);
      }
      if (id && hidden.indexOf(id) > -1) { setHidden(inner, id, true); }
    }
  }

  /* ---------- Image hover-zoom ---------- */
  var zoom = null;
  function ensureZoom() {
    if (!zoom) { zoom = document.createElement("img"); zoom.id = "rchan-zoom"; document.body.appendChild(zoom); }
    return zoom;
  }
  function isImageHref(href) { return /\.(jpe?g|png|gif|webp|bmp)$/i.test(href || ""); }
  function onThumbOver(e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") { return; }
    var a = img.closest ? img.closest("a.imgLink, .imgLink") : null;
    if (!a) { a = img.parentNode; }
    var href = a && a.getAttribute ? a.getAttribute("href") : null;
    if (!isImageHref(href)) { return; }
    var z = ensureZoom();
    z.src = href; z.style.display = "block";
    moveZoom(e);
  }
  function moveZoom(e) {
    if (!zoom || zoom.style.display !== "block") { return; }
    var pad = 16, vw = window.innerWidth, vh = window.innerHeight;
    var x = e.clientX + pad, y = e.clientY + pad;
    if (x + zoom.offsetWidth > vw) { x = e.clientX - zoom.offsetWidth - pad; }
    if (y + zoom.offsetHeight > vh) { y = Math.max(4, vh - zoom.offsetHeight - 4); }
    zoom.style.left = Math.max(4, x) + "px";
    zoom.style.top = Math.max(4, y) + "px";
  }
  function onThumbOut(e) {
    var img = e.target;
    if (img && img.tagName === "IMG" && zoom) { zoom.style.display = "none"; zoom.src = ""; }
  }

  /* ---------- Keyboard shortcuts ---------- */
  function typing(e) {
    var t = e.target, tag = t && t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable);
  }
  function onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) { return; }
    switch (e.key) {
      case "t": window.scrollTo({ top: 0, behavior: "smooth" }); break;
      case "b": window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); break;
      case "c":
        if (boardUri && boardUri.charAt(0) !== ".") { location.href = "/" + boardUri + "/catalog.html"; }
        break;
      case "r": {
        var name = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
        if (name) { name.focus(); e.preventDefault(); }
        break;
      }
    }
  }

  /* ---------- init + observe (posts load client-side) ---------- */
  var pending = false;
  function refresh() { if (pending) { return; } pending = true; setTimeout(function () { pending = false; decorateHide(document); }, 80); }
  function init() {
    buildNav();
    decorateHide(document);
    document.addEventListener("mouseover", onThumbOver, true);
    document.addEventListener("mousemove", moveZoom, true);
    document.addEventListener("mouseout", onThumbOut, true);
    document.addEventListener("keydown", onKey);
    try { new MutationObserver(refresh).observe(document.documentElement, { subtree: true, childList: true }); } catch (e) {}
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
