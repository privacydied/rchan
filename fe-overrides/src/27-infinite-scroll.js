  /* ==========================================================================
     INFINITE SCROLL — board index (fetch-next-page) + catalog (chunk-reveal).
     Theme-agnostic (used to be an Academia-only feature) and gated behind the
     "Infinite scroll" setting so anyone can turn it off; native pagination
     (index) / the full catalog list (all cards already server-rendered) is
     the always-present no-JS fallback either way.
     ========================================================================== */
  function infScrollOn() { return setOn("infscroll"); }

  /* ---------- Board index: fetch the next page's HTML, splice in its threads ----------
     LynxChan paginates the index (/<b>/, /<b>/2.html …). Near the bottom of the
     current page we fetch the next page's HTML, lift its <div.opCell> threads
     (dedup by id), append them below a page divider, replaceState the URL to
     the new page, and re-run the decoration pipeline so injected posts get
     every binding (quote previews, hide, image expansion — most are delegated
     at document level, the rest are refreshed via refresh()). Normal pagination
     links stay intact as the no-JS fallback. */
  var isState = { loading: false, ended: false, cur: 1, max: 1, board: null, seen: null, sentinel: null, io: null };

  function isBoardIndex() {
    var b = getBoard();
    if (!b || isOverboard(b)) { return false; }
    if (/\/res\//.test(location.pathname)) { return false; }   // a thread
    if (isCatalog()) { return false; }                         // the catalog
    var dt = document.getElementById("divThreads");
    return !!(dt && dt.querySelector(".opCell") && !dt.querySelector(".catalogCell"));
  }
  function currentPageNum() {
    // /gen/, /gen/index, /gen/index.html -> 1 ; /gen/2, /gen/2.html, /gen/2/ -> 2
    var m = location.pathname.match(/\/(\d+)(?:\.html)?\/?$/);
    return m ? parseInt(m[1], 10) : 1;
  }
  function maxPageNum() {
    // pagelist hrefs are clean-URL stripped: "index", "2", "3" (or "2.html").
    var mx = isState.cur;
    var links = document.querySelectorAll("#divPages a, .divPages a, .pagelist a");
    for (var i = 0; i < links.length; i++) {
      var m = (links[i].getAttribute("href") || "").match(/(?:^|\/)(\d+)(?:\.html)?\/?$/);
      if (m) { mx = Math.max(mx, parseInt(m[1], 10)); }
    }
    return mx;
  }
  function threadIdOf(op) {
    if (op.id && /^\d+$/.test(op.id)) { return op.id; }
    var a = op.querySelector('a[href*="/res/"]');
    var m = a && (a.getAttribute("href") || "").match(/\/res\/(\d+)/);
    return m ? m[1] : null;
  }
  function pageUrl(n) { return "/" + isState.board + "/" + (n <= 1 ? "index.html" : n + ".html"); }

  // Cream + Cream (Dark) get the theme's one ornament (⁂, a printer's asterism)
  // in place of plain punctuation — the signature terminator mark. Every other
  // theme (Academia has its own styling for these, Brutalist/Dark/base don't
  // want the glyph) keeps the plain text.
  function isCreamTheme() {
    return document.body.classList.contains("theme_cream") || document.documentElement.classList.contains("rchan-warmdark");
  }
  function makeDivider(n) {
    var d = document.createElement("div");
    d.className = "rchan-pagedivider";
    var s = document.createElement("span");
    s.textContent = isCreamTheme() ? "⁂ Page " + n + " ⁂" : "— Page " + n + " —";
    d.appendChild(s);
    return d;
  }
  function makeLoader() {
    var w = document.createElement("div");
    w.className = "rchan-scroll-loader"; w.setAttribute("aria-live", "polite");
    w.innerHTML = '<span class="rchan-ellipsis" role="status" aria-label="Loading more threads"><span>·</span><span>·</span><span>·</span></span>';
    return w;
  }
  function showEnd() {
    if (document.querySelector(".rchan-scroll-end")) { return; }
    var e = document.createElement("div");
    e.className = "rchan-scroll-end";
    e.textContent = isCreamTheme() ? "⁂" : "· fin ·";
    var dt = document.getElementById("divThreads");
    if (isState.sentinel && isState.sentinel.parentNode === dt) { dt.insertBefore(e, isState.sentinel); }
    else if (dt) { dt.appendChild(e); }
  }

  function loadNext() {
    if (isState.loading || isState.ended) { return; }
    var next = isState.cur + 1;
    if (next > isState.max) { isState.ended = true; showEnd(); return; }
    isState.loading = true;
    var dt = document.getElementById("divThreads");
    var loader = makeLoader();
    if (isState.sentinel && isState.sentinel.parentNode === dt) { dt.insertBefore(loader, isState.sentinel); }
    else { dt.appendChild(loader); }

    fetch(pageUrl(next), { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) { throw new Error("http " + r.status); } return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var srcThreads = doc.getElementById("divThreads");
        var ops = srcThreads ? srcThreads.querySelectorAll(".opCell") : [];
        var fresh = [];
        for (var i = 0; i < ops.length; i++) {
          var id = threadIdOf(ops[i]);
          if (id && isState.seen.has(id)) { continue; }
          if (id) { isState.seen.add(id); }
          fresh.push(ops[i]);
        }
        if (loader.parentNode) { loader.parentNode.removeChild(loader); }
        if (!fresh.length) { isState.ended = true; showEnd(); isState.loading = false; return; }

        var anchor = isState.sentinel && isState.sentinel.parentNode === dt ? isState.sentinel : null;
        var divider = makeDivider(next);
        if (anchor) { dt.insertBefore(divider, anchor); } else { dt.appendChild(divider); }
        for (var j = 0; j < fresh.length; j++) {
          var node = document.importNode(fresh[j], true);
          node.classList.add("rchan-appeared");
          if (anchor) { dt.insertBefore(node, anchor); } else { dt.appendChild(node); }
        }
        isState.cur = next;
        try { history.replaceState(null, "", pageUrl(next) + location.search); } catch (e) {}
        // re-run the decoration pipeline over the whole document (idempotent —
        // every decorate* guards with data-attrs; delegated listeners already
        // cover the new nodes). refresh() is defined in 95-init.
        try { if (typeof refresh === "function") { refresh(); } } catch (e2) {}
        isState.loading = false;
        if (isState.cur >= isState.max) { isState.ended = true; showEnd(); }
      })
      .catch(function () {
        if (loader.parentNode) { loader.parentNode.removeChild(loader); }
        isState.loading = false;   // leave native pagination as the fallback; retry on next intersect
      });
  }

  function initInfiniteScroll() {
    if (!infScrollOn() || !isBoardIndex()) { return; }
    if (!("IntersectionObserver" in window)) { return; }
    var dt = document.getElementById("divThreads");
    if (!dt || dt.getAttribute("data-inf")) { return; }
    dt.setAttribute("data-inf", "1");
    isState.board = getBoard();
    isState.cur = currentPageNum();
    isState.max = maxPageNum();
    isState.seen = new Set();
    var ops = dt.querySelectorAll(".opCell");
    for (var i = 0; i < ops.length; i++) { var id = threadIdOf(ops[i]); if (id) { isState.seen.add(id); } }
    if (isState.cur >= isState.max) { showEnd(); return; }   // single page: nothing to stream

    var sentinel = document.createElement("div");
    sentinel.className = "rchan-scroll-sentinel"; sentinel.style.cssText = "width:100%;height:1px;";
    dt.appendChild(sentinel);
    isState.sentinel = sentinel;
    isState.io = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) { if (entries[k].isIntersecting) { loadNext(); } }
    }, { root: null, rootMargin: "0px 0px 800px 0px", threshold: 0 });
    isState.io.observe(sentinel);
  }

  /* ---------- Catalog: chunk-reveal ----------
     The catalog isn't paginated — LynxChan renders every active thread's card
     server-side in one page. So "infinite scroll" here is client-side: hide
     everything past the first chunk, and reveal another chunk each time the
     last VISIBLE card scrolls near the viewport (re-targeting the observer
     each reveal, rather than inserting a sentinel node — Cream's catalog grid
     has a fixed grid-auto-rows, and a foreign node dropped into it would claim
     a full fixed-height row and leave an ugly gap). */
  var csState = { inited: false, chunk: 16, io: null };

  function catalogCells() {
    var dt = document.getElementById("divThreads");
    return dt ? Array.prototype.slice.call(dt.querySelectorAll(".catalogCell")) : [];
  }
  function lastVisibleCatalogCell() {
    var cells = catalogCells();
    for (var i = cells.length - 1; i >= 0; i--) {
      if (!cells[i].hasAttribute("data-inf-hidden")) { return cells[i]; }
    }
    return null;
  }
  function showCatalogEnd() {
    var dt = document.getElementById("divThreads");
    if (!dt || !dt.parentNode || document.querySelector(".rchan-scroll-end")) { return; }
    var e = document.createElement("div");
    e.className = "rchan-scroll-end rchan-cat-scroll-marker";
    e.textContent = isCreamTheme() ? "⁂" : "· fin ·";
    dt.parentNode.insertBefore(e, dt.nextSibling);   // OUTSIDE the grid, never a grid item
  }
  function retargetCatalogObserver() {
    if (!csState.io) { return; }
    csState.io.disconnect();
    var t = lastVisibleCatalogCell();
    if (t) { csState.io.observe(t); }
  }
  function revealNextCatalogChunk() {
    var hidden = catalogCells().filter(function (c) { return c.hasAttribute("data-inf-hidden"); });
    if (!hidden.length) { if (csState.io) { csState.io.disconnect(); } showCatalogEnd(); return; }
    var batch = hidden.slice(0, csState.chunk);
    for (var i = 0; i < batch.length; i++) {
      batch[i].removeAttribute("data-inf-hidden");
      batch[i].style.removeProperty("display");   // NOT "" — Cream's grid CSS sets display:flex
      batch[i].classList.add("rchan-appeared");   // !important; only removeProperty lets it re-apply
    }
    var remaining = catalogCells().filter(function (c) { return c.hasAttribute("data-inf-hidden"); });
    if (!remaining.length) { if (csState.io) { csState.io.disconnect(); } showCatalogEnd(); return; }
    retargetCatalogObserver();
  }
  function initCatalogInfiniteScroll() {
    if (!infScrollOn() || !isCatalog()) { return; }
    if (!("IntersectionObserver" in window)) { return; }
    var dt = document.getElementById("divThreads");
    if (!dt || dt.getAttribute("data-catinf")) { return; }
    var all = catalogCells();
    if (all.length <= csState.chunk) { return; }   // small board: nothing to defer
    dt.setAttribute("data-catinf", "1");
    for (var i = csState.chunk; i < all.length; i++) {
      // Cream's catalog grid sets `.catalogCell { display: flex !important }` —
      // a plain style.display="none" loses that specificity fight and the card
      // stays visually shown (only the hidden ATTRIBUTE would be set), so the
      // IntersectionObserver sees a full-looking grid and reveals everything
      // almost immediately. setProperty(...,'important') actually hides it.
      all[i].style.setProperty("display", "none", "important");
      all[i].setAttribute("data-inf-hidden", "1");
    }
    // ~200px lookahead: enough to feel proactive without firing near-instantly on
    // load — catalog cards run ~360-410px tall, so the index's 1000px (tuned for
    // that fetch's network latency) put the trigger row within range at first
    // paint with zero scrolling.
    csState.io = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) { if (entries[k].isIntersecting) { revealNextCatalogChunk(); } }
    }, { root: null, rootMargin: "0px 0px 200px 0px", threshold: 0 });
    var t = lastVisibleCatalogCell();
    if (t) { csState.io.observe(t); }
  }
