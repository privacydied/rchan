  /* ==========================================================================
     ACADEMIA — theme-specific chrome + the "keeps reading like an article"
     board-index infinite scroll. Gated to .theme_academia for now (ship
     theme-agnostic, enable per-theme). All DOM it builds is scoped by classes
     the ux.css .theme_academia block styles; nothing here runs under other
     themes, so Cream/Brutalist are untouched.
     ========================================================================== */

  function academiaOn() {
    try { return document.body.classList.contains("theme_academia"); } catch (e) { return false; }
  }

  /* ---------- Title eyebrow: tiny sans caps over the serif headline ----------
     The signature "eyebrow-over-serif" move applied to the page title:
     "IMAGEBOARD · RCHAN" sits above "Catalog of /gen/" / the board name. */
  function decorateAcademiaChrome() {
    if (!academiaOn()) { return; }
    var title = document.getElementById("catalogId")
      || document.querySelector(".boardHeader p#labelName");
    if (!title || title.previousElementSibling && title.previousElementSibling.className === "rchan-title-eyebrow") { return; }
    if (document.querySelector(".rchan-title-eyebrow")) { return; }
    var eb = document.createElement("span");
    eb.className = "rchan-title-eyebrow";
    eb.textContent = "Imageboard · Rchan".toUpperCase();
    title.parentNode.insertBefore(eb, title);
  }

  /* ---------- Board-index infinite scroll ----------
     LynxChan paginates the index (/<b>/, /<b>/2.html …). Near the bottom of the
     current page we fetch the next page's HTML, lift its <div.opCell> threads
     (dedup by id), append them below a serif page divider, replaceState the URL
     to the new page, and re-run the decoration pipeline so injected posts get
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

  function makeDivider(n) {
    var d = document.createElement("div");
    d.className = "rchan-pagedivider";
    var s = document.createElement("span");
    s.textContent = "— Page " + n + " —";
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
    e.textContent = "· fin ·";
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
    if (!academiaOn() || !isBoardIndex()) { return; }
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
