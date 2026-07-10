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
    if (kbCurEl && kbCurEl.classList) {
      kbCurEl.classList.remove("rchan-kbcur");
      kbCurEl.removeAttribute("tabindex");
    }
    kbCurEl = el;
    el.classList.add("rchan-kbcur");
    // Make the selection a real focus stop so screen readers follow j/k and
    // read the post the sighted highlight lands on (it was visual-only before).
    el.setAttribute("tabindex", "-1");
    try { el.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {}
    try { el.focus({ preventScroll: true }); } catch (e) {}
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

  // Catalog keyboard nav: the powers j/k grant on threads, on the scanning
  // surface too. Same selection ring, same viewport re-sync semantics.
  function navCatalog(dir) {
    var list = catCells().filter(function (c) { return c.offsetParent !== null; });   // skip search-hidden
    if (!list.length) { return; }
    var idx = -1;
    if (kbCurEl && document.contains(kbCurEl)) {
      var r = kbCurEl.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) { idx = list.indexOf(kbCurEl); }
    }
    if (idx < 0) {
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
  function catKey(e) {                                 // -> true when handled
    if (e.key === "j") { navCatalog(1); }
    else if (e.key === "k") { navCatalog(-1); }
    else if (e.key === "Enter" && kbCurEl && kbCurEl.classList.contains("catalogCell")) {
      var a = kbCurEl.querySelector("a.linkThumb");
      if (a && a.href) { location.href = a.href; }
    }
    else if (e.key === "e" && kbCurEl && kbCurEl.classList.contains("catalogCell")) {
      if (catPrevFor === kbCurEl) { hideCatPreview(); } else { showCatPreviewFor(kbCurEl); }
    }
    else if (e.key === "w" && kbCurEl && kbCurEl.classList.contains("catalogCell")) {
      toggleCatalogWatch(kbCurEl, kbCurEl.querySelector(".rchan-catwatch"));
    }
    else { return false; }
    e.preventDefault();
    return true;
  }
  function onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) { return; }
    if (e.key === "?") { toggleKeysOverlay(); e.preventDefault(); return; }   // always available
    if (!setOn("keys")) { return; }
    if (isCatalog() && catKey(e)) { return; }
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

