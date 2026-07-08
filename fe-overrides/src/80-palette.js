  /* ---------- Command palette (Ctrl+K / Cmd+K) ----------
     One keystroke, every destination: boards, watched threads (unread
     flagged), recent threads, the threads on the open catalog, and the
     site's own actions (settings, gallery, filter, backup…). Fuzzy match:
     substring beats subsequence, earlier beats later. ↑/↓ + Enter or click. */
  var pal = null, palInput = null, palListEl = null, palSel = 0, palResults = [], palBoards = null;
  var palFixed = null;                                   // non-null: showing fixed results (cross-board search)
  /* Cross-board deep search: on a site this size the client can afford what
     big sites need servers for — fetch every board's catalog, then every
     thread's JSON (cached per session), and match the term against every
     post's subject/name/message/filenames. Results render in the palette
     itself, deep-linking to the matching post. */
  var xbCache = {};                                      // "board/threadId" -> parsed thread JSON
  function xbText(p) {
    return ((p.subject || "") + " " + (p.name || "") + " " + (p.message || "") + " " +
            (p.files || []).map(function (f) { return f.originalName || ""; }).join(" ")).toLowerCase();
  }
  function xbMatch(d, term) {                            // -> {p, s} of the first matching post, or null
    function snip(msg, from) {
      var s = String(msg || "").replace(/\s+/g, " ").trim();
      var start = Math.max(0, from - 30);
      return (start ? "…" : "") + s.slice(start, start + 90);
    }
    if (xbText(d).indexOf(term) > -1) {
      return { p: d.threadId, s: snip(d.message || d.subject, 0) };
    }
    var posts = d.posts || [];
    for (var i = 0; i < posts.length; i++) {
      if (xbText(posts[i]).indexOf(term) > -1) {
        var idx = String(posts[i].message || "").toLowerCase().indexOf(term);
        return { p: posts[i].postId, s: snip(posts[i].message, idx > -1 ? idx : 0) };
      }
    }
    return null;
  }
  function searchAllBoards(term) {
    var q = term.toLowerCase();
    palFixed = [{ kind: "search", title: "Searching every board for “" + term + "”…", sub: "", fn: function () {}, keepOpen: true }];
    palRender();
    fetch("/boards.js?json=1").then(function (r) { return r.json(); }).then(function (res) {
      var boards = ((res && res.data && res.data.boards) || []).slice(0, 12)
        .map(function (b) { return b.boardUri; });
      var hits = [], scanned = 0;
      return Promise.all(boards.map(function (b) {
        return fetch("/" + b + "/catalog.json").then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
          return Promise.all((list || []).slice(0, 60).map(function (t) {
            var key = b + "/" + t.threadId;
            var get = xbCache[key] ? Promise.resolve(xbCache[key])
              : fetch("/" + b + "/res/" + t.threadId + ".json")
                  .then(function (r) { return r.ok ? r.json() : null; })
                  .then(function (d) { if (d) { xbCache[key] = d; } return d; });
            return get.then(function (d) {
              if (!d) { return; }
              scanned++;
              var hit = xbMatch(d, q);
              if (hit && hits.length < 30) {
                hits.push({
                  kind: "hit",
                  title: "/" + b + "/ · " + ((d.subject || d.message || ("Thread " + t.threadId)).replace(/\s+/g, " ").trim().slice(0, 50)),
                  sub: hit.s,
                  url: "/" + b + "/res/" + t.threadId + ".html#" + hit.p
                });
              }
            }).catch(function () {});
          }));
        }).catch(function () {});
      })).then(function () {
        var head = { kind: "search", keepOpen: true, fn: function () {},
                     title: hits.length + " match" + (hits.length === 1 ? "" : "es") + " across " + boards.length + " board" + (boards.length === 1 ? "" : "s"),
                     sub: scanned + " threads scanned" + (hits.length >= 30 ? " · capped at 30 results" : "") };
        palFixed = [head].concat(hits);
        palSel = hits.length ? 1 : 0;
        palRender();
      });
    }).catch(function () {
      palFixed = [{ kind: "search", title: "Search failed — couldn't reach the board list", sub: "", fn: function () {}, keepOpen: true }];
      palRender();
    });
  }
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
    if (!entry.keepOpen) { closePalette(); }
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
    if (palFixed) {                                     // fixed results (cross-board search) until input changes
      palResults = palFixed.slice();
    } else {
    var src = pal.__sources || [];
    var scored = [];
    for (var i = 0; i < src.length; i++) {
      var sc = fuzzyScore(q, src[i].hay);
      if (sc > 0) { scored.push({ e: src[i], s: sc, i: i }); }
    }
    if (q) { scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; }); }
    palResults = scored.slice(0, 14).map(function (r) { return r.e; });
    // no destination matches: fall through to deep search — this board, then everywhere
    var pb = getBoard();
    if (!palResults.length && q) {
      var raw = palInput.value.trim();
      if (pb && pb.charAt(0) !== "." && !isOverboard(pb)) {
        palResults.push({
          kind: "search",
          title: "Search /" + pb + "/ for “" + raw + "”",
          sub: "deep search — matches inside every reply on the board",
          fn: (function (term) { return function () { deepSearchFor(term); }; })(raw)
        });
      }
      palResults.push({
        kind: "search", keepOpen: true,
        title: "Search all boards for “" + raw + "”",
        sub: "cross-board deep search, results right here",
        fn: (function (term) { return function () { searchAllBoards(term); }; })(raw)
      });
    }
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
      palInput.addEventListener("input", function () { palFixed = null; palSel = 0; palRender(); });
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
    palInput.value = ""; palSel = 0; palFixed = null;
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

