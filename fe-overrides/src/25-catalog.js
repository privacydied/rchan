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
                                posts: t.postCount || 0, files: t.fileCount || 0,
                                autoSage: !!t.autoSage, cyclic: !!t.cyclic, page: t.page || 1 };
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
    loadCatMeta(function () {
      if (curSort !== "bump") { sortCatalog(curSort); }
      decorateCatalogFlags();
    });
    var threads = document.getElementById("divThreads");
    if (!threads || document.getElementById("rchan-cattools")) { return; }
    var bar = document.createElement("div"); bar.id = "rchan-cattools";
    var count = document.createElement("span"); count.id = "rchan-catcount";   // "N threads" (left of the controls)
    var nc = catCells().length;
    count.textContent = nc + (nc === 1 ? " thread" : " threads");
    bar.appendChild(count);
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
  /* ---------- Thread lifecycle chips: catalog side ----------
     The mechanics that decide a thread's fate were invisible — regulars
     learned about bump limit and cyclic rotation by being burned. The
     catalog payload carries autoSage/cyclic; chip them on the cards. */
  function decorateCatalogFlags() {
    if (!isCatalog() || !catMeta) { return; }
    catCells().forEach(function (cell) {
      if (cell.getAttribute("data-flagchip")) { return; }
      var m = catMeta[catThreadId(cell)];
      if (!m) { return; }
      cell.setAttribute("data-flagchip", "1");
      if (!m.autoSage && !m.cyclic) { return; }
      var stats = cell.getElementsByClassName("threadStats")[0] || cell;
      function chip(text, label, warn) {
        var s = document.createElement("span");
        s.className = "rchan-flagchip" + (warn ? " rchan-ts-warn" : "");
        s.textContent = text;
        s.setAttribute("data-tooltip", label);
        s.setAttribute("aria-label", label);
        stats.appendChild(s);
      }
      if (m.autoSage) { chip("bump limit", "Bump limit reached — replies no longer bump this thread", true); }
      if (m.cyclic) { chip("cyclic", "Cyclic thread — oldest replies rotate out"); }
    });
  }
  /* ---------- Neo-futurist catalog card: instrument labeling ----------
     Adds the parts the CSS can't derive: a top meta-strip (thread part-number +
     board tag), a zero-padded R·I·P readout, and a no-file flag. Gated to the
     brutalist theme so no other theme's catalog DOM is touched; idempotent per
     cell. The CSS (ux.css .theme_brutalist) styles/positions all of it. */
  function pad3(n) { n = String(n); return n.length >= 3 ? n : ("00" + n).slice(-3); }
  function pad4(n) { n = String(n); return n.length >= 4 ? n : ("000" + n).slice(-4); }
  function decorateCatalogCards(root) {
    // Two card registers share one decorator: Brutalist (instrument card, zero-
    // padded readout, bottom strip) and Academia (eyebrow-over-serif, readout in
    // the eyebrow). data-card stores the register so a live theme switch rebuilds.
    var acad = document.body.classList.contains("theme_academia");
    var brut = document.body.classList.contains("theme_brutalist");
    if (!isCatalog() || !(acad || brut)) { return; }
    var reg = acad ? "a" : "b";
    var b = getBoard(); if (!b) { return; }
    var tag = "/" + b.toUpperCase() + "/";
    var cells = (root || document).getElementsByClassName("catalogCell");
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.getAttribute("data-card") === reg) { continue; }
      if (cell.getAttribute("data-card")) {                    // switched register: strip old parts, rebuild
        var om = cell.querySelector(".rchan-cardmeta"); if (om) { om.parentNode.removeChild(om); }
        var ob = cell.querySelector(".rchan-nofile-band"); if (ob) { ob.parentNode.removeChild(ob); }
        cell.classList.remove("rchan-nofile");
      }
      cell.setAttribute("data-card", reg);
      var tid = catThreadId(cell);
      var reps = catNum(cell, "labelReplies"), imgs = catNum(cell, "labelImages"), pg = catNum(cell, "labelPage");
      var meta = document.createElement("div"); meta.className = "rchan-cardmeta";
      var l = document.createElement("span");
      var r = document.createElement("span"); r.className = "rchan-cardmeta-r";
      var stats = cell.getElementsByClassName("threadStats")[0];
      if (acad) {
        // eyebrow: "Nº 44 · /GEN/"  ....  "R 3 · I 2 · P 1" (plain, literary — no zero-pad)
        l.textContent = "Nº " + tid + " · " + tag;
        r.textContent = "R " + reps + " · I " + imgs + " · P " + pg;
        meta.appendChild(l); meta.appendChild(r);
        cell.insertBefore(meta, cell.firstChild);
      } else {
        // brutalist: THR//0044 .......... /GEN/  + zero-padded bottom readout strip
        l.textContent = "THR//" + pad4(tid);
        r.textContent = tag;
        meta.appendChild(l); meta.appendChild(r);
        cell.insertBefore(meta, cell.firstChild);
        if (stats && !stats.getAttribute("data-fmt")) {
          stats.setAttribute("data-fmt", "1");
          var badge = stats.getElementsByClassName("rchan-newbadge")[0];
          stats.innerHTML = 'R <span class="labelReplies">' + pad3(reps) +
            '</span> · I <span class="labelImages">' + pad3(imgs) +
            '</span> · P <span class="labelPage">' + pad3(pg) + '</span>';
          if (badge) { stats.appendChild(badge); }
        }
      }
      // no-file variant: placeholder band in the thumb slot ("TEXT ONLY" / "NO FILE")
      if (!cell.querySelector(".linkThumb img")) {
        cell.classList.add("rchan-nofile");
        if (!cell.querySelector(".rchan-nofile-band")) {
          var band = document.createElement("div"); band.className = "rchan-nofile-band";
          var lab = document.createElement("span"); lab.textContent = acad ? "TEXT ONLY" : "NO FILE";
          band.appendChild(lab);
          cell.insertBefore(band, meta.nextSibling);
        }
      }
    }
  }
  /* ---------- Cream (Dark) catalog polish: compact stat line + no-file cells ----------
     Separate from decorateCatalogCards' Brutalist/Academia register system (no
     eyebrow row here) — just the stat-line reformat ("R 1 · I 0 · P 1") and the
     no-image placeholder band, folding its "Open" link into the stat line. */
  function decorateCreamDarkCatalog(root) {
    if (!document.documentElement.classList.contains("rchan-warmdark") || !isCatalog()) { return; }
    var cells = (root || document).getElementsByClassName("catalogCell");
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.getAttribute("data-cdcat")) { continue; }
      cell.setAttribute("data-cdcat", "1");
      var stats = cell.getElementsByClassName("threadStats")[0];
      if (stats) {
        var reps = catNum(cell, "labelReplies"), imgs = catNum(cell, "labelImages"), pg = catNum(cell, "labelPage");
        var badge = stats.getElementsByClassName("rchan-newbadge")[0];
        stats.innerHTML = "R " + reps + " &middot; I " + imgs + " &middot; P " + pg;
        if (badge) { stats.appendChild(badge); }
      }
      var thumbLink = cell.querySelector("a.linkThumb");
      if (thumbLink && !thumbLink.querySelector("img")) {
        cell.classList.add("rchan-nofile");
        var glyph = document.createElement("span");
        glyph.className = "rchan-nofile-glyph";
        glyph.textContent = "TEXT";
        thumbLink.textContent = "";
        thumbLink.appendChild(glyph);
        if (stats && !stats.querySelector(".rchan-nofile-open")) {
          var openLink = document.createElement("a");
          openLink.className = "rchan-nofile-open";
          openLink.href = thumbLink.getAttribute("href") || "#";
          openLink.textContent = "Open";
          stats.appendChild(openLink);
        }
      }
    }
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
  var catPrevHideT = null;
  function cancelHideCatPreview() { if (catPrevHideT) { clearTimeout(catPrevHideT); catPrevHideT = null; } }
  function scheduleHideCatPreview() { cancelHideCatPreview(); catPrevHideT = setTimeout(hideCatPreview, 160); }
  function hideCatPreview() { cancelHideCatPreview(); if (catPrev) { catPrev.classList.remove("rchan-catprev-show"); catPrev.style.display = "none"; } catPrevFor = null; }
  function bindCatPrevHover() {   // hover bridge: staying over the popup keeps it open
    catPrev.addEventListener("mouseenter", cancelHideCatPreview);
    catPrev.addEventListener("mouseleave", scheduleHideCatPreview);
  }
  // only PAGE scroll dismisses; scrolls inside the popup or a teaser are ignored
  function onScrollMaybeHideCatPrev(e) {
    var t = e.target;
    if (t && t.nodeType === 1 && t.closest && (t.closest("#rchan-catprev") || t.closest(".catalogCell > .divMessage"))) { return; }
    hideCatPreview();
  }
  var TOUCH_ONLY = !!(window.matchMedia && matchMedia("(hover: none)").matches);
  function renderCatPreview(cell, data) {
    if (!catPrev) { catPrev = document.createElement("div"); catPrev.id = "rchan-catprev"; document.body.appendChild(catPrev); bindCatPrevHover(); }
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
      catPrev.style.left = ""; catPrev.style.top = ""; catPrev.style.width = "";
      catPrev.classList.add("rchan-catprev-show");
      return;
    }
    catPrev.classList.remove("rchan-catprev-sheet");
    // anchor BELOW the cell, aligned to its left edge, at the cell's width; right-
    // align if it would overflow the right edge; flip ABOVE if it clips the bottom.
    var r = cell.getBoundingClientRect(), m = 8;
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(Math.max(Math.round(r.width), 240), vw - 2 * m);
    catPrev.style.width = w + "px";
    var left = r.left;
    if (left + w > vw - m) { left = r.right - w; }              // flip to right-align
    left = Math.max(m, Math.min(left, vw - w - m));
    catPrev.style.left = left + "px";
    catPrev.style.top = "0px";                                  // measure at a stable spot
    var h = catPrev.offsetHeight;
    var top = r.bottom + 4;
    if (top + h > vh - m) {                                     // would clip below → open above
      var above = r.top - 4 - h;
      top = above >= m ? above : Math.max(m, vh - h - m);
    }
    catPrev.style.top = top + "px";
    catPrev.classList.add("rchan-catprev-show");
  }
  function showCatPreviewFor(cell) {                 // shared by hover, tap, keyboard and the sheet
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
  function onCatPrevOver(e, fromTap) {
    if (!setOn("catprev")) { return; }
    // touch taps fire a synthesized mouseover BEFORE click; if that path set
    // catPrevFor, the tap handler would think it's the 2nd tap and navigate.
    if (TOUCH_ONLY && !fromTap) { return; }
    if (!isCatalog()) { return; }
    var cell = e.target && e.target.closest ? e.target.closest(".catalogCell") : null;
    if (!cell) { return; }
    cancelHideCatPreview();                          // re-entering cancels a pending dismiss
    if (catPrevFor === cell) { return; }
    showCatPreviewFor(cell);
  }
  function onCatPrevOut(e) {
    var cell = e.target && e.target.closest ? e.target.closest(".catalogCell") : null;
    if (!cell) { return; }
    var to = e.relatedTarget;
    if (to && (cell.contains(to) || (catPrev && catPrev.contains(to)))) { return; }  // into cell or popup: stay
    scheduleHideCatPreview();                        // grace period bridges the gap to the popup
  }
  // Cream catalog: the whole card opens the thread — except the scrollable teaser,
  // links, and the watch button (those handle themselves). Desktop click parity
  // with the thumb link so title/stat-line are also live targets.
  function onCatCellOpen(e) {
    if (!isCatalog()) { return; }
    if (!(document.body.classList.contains("theme_cream") || document.documentElement.classList.contains("rchan-warmdark"))) { return; }
    var t = e.target;
    if (!t || !t.closest) { return; }
    var cell = t.closest(".catalogCell");
    if (!cell) { return; }
    if (t.closest("a, button, .divMessage")) { return; }   // links / buttons / teaser self-handle
    var a = cell.querySelector("a.linkThumb");
    var href = a && a.getAttribute("href");
    if (href) { window.location.href = href; }
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

  /* ---------- Watch from the catalog: bookmark without entering ----------
     Auto-watch covers threads you post in; the bell covers threads you're
     reading. From the catalog — the scanning surface — there was no watch
     affordance at all: you had to open a thread (loading its media, marking
     it read, losing your scan position) just to bookmark it. A hover 👁 on
     every card toggles the same watchedData record the native button writes. */
  var SVG_EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
  function catCellLabel(cell) {
    var subj = cell.querySelector(".labelSubject");
    if (subj && subj.textContent.trim()) { return subj.textContent.trim().slice(0, 70); }
    var msg = cell.querySelector(".divMessage");
    if (msg && msg.textContent.trim()) { return msg.textContent.replace(/\s+/g, " ").trim().slice(0, 70); }
    return "Thread " + catThreadId(cell);
  }
  function toggleCatalogWatch(cell, btn) {
    var b = getBoard(), tid = catThreadId(cell);
    if (!b || !tid) { return; }
    if (isWatched(b, String(tid))) {
      unwatchThread(b, String(tid));
      if (btn) { btn.classList.remove("rchan-on"); btn.setAttribute("data-tooltip", "Watch this thread"); }
      okToast("Unwatched");
    } else {
      watchThread(b, String(tid), catCellLabel(cell));
      if (btn) { btn.classList.add("rchan-on"); btn.setAttribute("data-tooltip", "Unwatch"); }
      okToast("Watching — replies will notify you");
    }
  }
  function decorateCatalogWatch(root) {
    if (!isCatalog()) { return; }
    var b = getBoard();
    if (!b || b.charAt(0) === "." || isOverboard(b)) { return; }
    var cells = (root || document).getElementsByClassName("catalogCell");
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.getAttribute("data-watchbtn")) { continue; }
      cell.setAttribute("data-watchbtn", "1");
      var tid = catThreadId(cell);
      if (!tid) { continue; }
      var watched = isWatched(b, String(tid));
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "rchan-catwatch" + (watched ? " rchan-on" : "");
      btn.innerHTML = SVG_EYE;
      btn.setAttribute("data-tooltip", watched ? "Unwatch" : "Watch this thread");
      btn.setAttribute("aria-label", "Watch thread " + tid);
      btn.addEventListener("click", (function (cell2, btn2) {
        return function (e) {
          e.preventDefault(); e.stopPropagation();
          toggleCatalogWatch(cell2, btn2);
        };
      })(cell, btn));
      cell.appendChild(btn);
    }
  }

