  /* ---------- Board liveness: index/catalog pages stop being frozen ----------
     Threads live-update over the websocket; board surfaces are a snapshot
     from page load. Diff catalog.json against the load-time snapshot every
     60s (visible tabs only) and offer a gentle "N new — refresh" pill
     instead of silently going stale. */
  function initBoardLiveness() {
    var b = getBoard();
    if (!b || b.charAt(0) === "." || isOverboard(b) || curThreadId()) { return; }   // no catalog.json to diff on the overboard
    if (!document.getElementById("divThreads")) { return; }        // board index or catalog only
    var base = null, pill = null;
    // per-thread post counts (not just a grand total) -- needed so a brand
    // new thread that already picked up a reply or two before this poll
    // caught it doesn't get those replies miscounted as "new posts" in an
    // ALREADY-known thread (see check(), below).
    function snapshot(list) {
      var m = { threads: {} };
      (list || []).forEach(function (t) {
        m.threads[t.threadId] = (t.postCount || 0) + 1;             // +1: the OP itself
      });
      return m;
    }
    function check() {
      fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); }).then(function (list) {
        var cur = snapshot(list);
        if (!base) { base = cur; return; }
        var newThreads = 0, newPosts = 0;
        Object.keys(cur.threads).forEach(function (id) {
          if (!base.threads[id]) { newThreads++; return; }          // brand new thread: its whole post
          // count is "new threads", not "new posts" -- even if it already
          // has replies by the time this poll saw it.
          var delta = cur.threads[id] - base.threads[id];
          if (delta > 0) { newPosts += delta; }                     // ignore shrinkage (pruned/deleted posts)
        });
        // hidden tab: board pages get the same "(N)" title + favicon badge threads have
        if (document.hidden) { setTitleUnread(newThreads + newPosts); }
        if (newThreads <= 0 && newPosts <= 0) { if (pill) { pill.style.display = "none"; } return; }
        if (!pill) {
          pill = document.createElement("button");
          pill.id = "rchan-boardpill"; pill.type = "button";
          pill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4l-2.35 2.35z"/></svg><span></span>';
          pill.setAttribute("aria-label", "New activity — refresh the page");
          pill.addEventListener("click", function () { location.reload(); });
          document.body.appendChild(pill);
        }
        var txt = [];
        if (newThreads > 0) { txt.push(newThreads + " new thread" + (newThreads > 1 ? "s" : "")); }
        if (newPosts > 0) { txt.push(newPosts + " new post" + (newPosts > 1 ? "s" : "")); }
        pill.lastChild.textContent = txt.join(" · ") + " — refresh";
        pill.style.display = "inline-flex";
      }).catch(function () {});
    }
    fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); })
      .then(function (list) { base = snapshot(list); }).catch(function () {});
    setInterval(check, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { check(); } });
  }

  /* ---------- Presence: "N anons here" (rides the thread status line) ----------
     Heartbeat ping to the presence addon every 45s while the tab is visible;
     the response is how many distinct session ids pinged this thread in the
     last 90s. The count folds into updateThreadStat's line. */
  var presenceCount = 0, presenceTyping = 0, lastTypedAt = 0;
  function isTypingNow() { return Date.now() - lastTypedAt < 8000; }
  // Presence id is per-BROWSER, not per-tab: localStorage (shared across a
  // browser's tabs) instead of sessionStorage (a fresh id per tab), so opening
  // several tabs no longer inflates the "N browsing" count into several people.
  // On the apex the id is seeded from the board origin via the bridge (see
  // initSitePresence) so the same person isn't double-counted across hosts.
  function presenceSid() {
    try {
      var s = localStorage.getItem("rchan_sid");
      if (!s) {
        s = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
        localStorage.setItem("rchan_sid", s);
      }
      return s;
    } catch (e) { return "sidfallback" + (Date.now() % 1e8); }
  }
  function pingPresence() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t || document.hidden) { return; }
    fetch("/addon.js/presence?boardUri=" + encodeURIComponent(b) + "&threadId=" +
          encodeURIComponent(t) + "&sid=" + presenceSid() + (isTypingNow() ? "&typing=1" : ""))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.status === "ok" && typeof d.count === "number") {
          presenceCount = d.count;
          presenceTyping = typeof d.typing === "number" ? d.typing : 0;
          updateThreadStat();
        }
      }).catch(function () {});
  }
  function initPresence() {
    if (!curThreadId()) { return; }
    pingPresence();
    setInterval(pingPresence, 45000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) { pingPresence(); }
    });
    // typing: stamp activity from either message box; while active, ping on a
    // faster 8s cadence so "N typing…" appears (and expires) responsively —
    // the server's typing window is 15s
    document.addEventListener("input", function (e) {
      var t2 = e.target;
      if (!t2 || (t2.id !== "qrbody" && t2.id !== "fieldMessage")) { return; }
      var was = isTypingNow();
      lastTypedAt = (t2.value || "").trim() ? Date.now() : 0;
      if (!was && isTypingNow()) { pingPresence(); }   // rising edge: announce now
    });
    setInterval(function () { if (isTypingNow()) { pingPresence(); } }, 8000);
  }

  /* ---------- Site-wide presence: "N anons browsing now" ----------
     Typing presence made threads feel alive; the front page and board pages
     were still corpses. Every page heartbeats a site-scope ping (same addon,
     pseudo-board '@site'); the homepage gets a pulsing-dot line above the
     board list, board index/catalog pages show it in the nav. Thread pages
     already have their own richer per-thread presence. */
  var sitePresenceCount = 0;
  function renderSitePresence() {
    var n = sitePresenceCount;
    // n===0 must still run through: presence is dynamic (tabs close, pings
    // age out) and legitimately drops to zero. Bailing out here used to leave
    // whatever the LAST nonzero count was on screen forever -- once it ticked
    // up once, it could never tick back down (or to 0) again for the rest of
    // the page's life. Only skip creating brand-new DOM for a first-ever 0
    // (nothing to show yet); an already-rendered element still gets hidden.
    if (/^\/(index\.html)?$/.test(location.pathname)) {
      var el = document.getElementById("rchan-sitestat");
      if (!n) { if (el) { el.style.display = "none"; } return; }
      var txt = n + (n === 1 ? " anon" : " anons") + " browsing now";
      if (!el) {
        var anchor = document.getElementById("rchan-active") || document.getElementById("divBoards");
        if (!anchor) { return; }
        el = document.createElement("div"); el.id = "rchan-sitestat";
        anchor.parentNode.insertBefore(el, anchor);
      }
      el.style.display = "";
      el.innerHTML = '<span class="rchan-sitedot" aria-hidden="true"></span> ' + escHtml(txt);
      return;
    }
    if (getBoard() && !curThreadId()) {
      var nav = document.querySelector("nav, #dynamicHeader");
      if (!nav) { return; }
      var el2 = document.getElementById("rchan-sitestat-nav");
      if (!n) { if (el2) { el2.style.display = "none"; } return; }
      var txt2 = n + (n === 1 ? " anon" : " anons") + " browsing now";
      if (!el2) {
        el2 = document.createElement("span"); el2.id = "rchan-sitestat-nav";
        nav.insertBefore(el2, document.getElementById("navOptionsSpan") || null);
      }
      el2.style.display = "";
      // icon form, matching the thread status line: "1 👤" + full sentence on hover
      el2.setAttribute("data-tooltip", txt2);
      el2.setAttribute("aria-label", txt2);
      el2.innerHTML = '<span class="rchan-sitedot" aria-hidden="true"></span>' + n + " " + TS_SVG.anon;
    }
  }
  function pingSitePresence() {
    if (document.hidden) { return; }
    fetch("/addon.js/presence?site=1&sid=" + presenceSid())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.status === "ok" && typeof d.count === "number") {
          sitePresenceCount = d.count;
          renderSitePresence();
        }
      }).catch(function () {});
  }
  function initSitePresence() {
    function start() {
      pingSitePresence();
      setInterval(pingSitePresence, 60000);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { pingSitePresence(); }
      });
    }
    // On the apex, adopt the board origin's presence id first (boardsStorage is
    // a direct read on the board origin, so this only bridges on rchan.xyz) —
    // otherwise the homepage tab and a board tab would count as two people.
    if (typeof boardsStorage === "function" && !onBoardsOrigin()) {
      boardsStorage(["rchan_sid"], function (v) {
        try { if (v && v.rchan_sid) { localStorage.setItem("rchan_sid", v.rchan_sid); } } catch (e) {}
        start();
      });
    } else {
      start();
    }
  }

  /* ---------- Live-update health: the thread says "live" — now it says "dead" too ----------
     When the WebSocket drops (or the machine goes offline) the page silently
     stopped being live: the user kept reading a frozen thread believing they
     were current. The WS constructor patch (05-core) reports open/close/error
     for the thread socket; here that becomes a status-line dot (green live /
     amber paused), and on reconnect or coming back online we diff the thread
     JSON against the DOM and offer a "missed N posts — refresh" pill. */
  var wsState = null, wsPill = null;
  function wsStateChange(s) {
    if (wsState === s) { return; }
    var was = wsState;
    wsState = s;
    try { updateThreadStat(); } catch (e) {}
    if (s === "live") {
      if (wsPill) { wsPill.style.display = "none"; }
      if (was === "down") { checkMissedPosts(); }
    }
  }
  function checkMissedPosts() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t) { return; }
    fetch("/" + b + "/res/" + t + ".json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) { return; }
      var domMax = 0, cells = document.getElementsByClassName("postCell");
      for (var i = 0; i < cells.length; i++) {
        var id = postIdOf(cells[i]);
        if (id > domMax) { domMax = id; }
      }
      var missed = 0, posts = d.posts || [];
      for (var j = 0; j < posts.length; j++) {
        if ((posts[j].postId || 0) > domMax) { missed++; }
      }
      if (missed > 0) { showWsPill(missed); }
    }).catch(function () {});
  }
  function showWsPill(n) {
    if (!wsPill) {
      wsPill = document.createElement("button");
      wsPill.id = "rchan-wspill"; wsPill.type = "button";
      wsPill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4l-2.35 2.35z"/></svg><span></span>';
      wsPill.setAttribute("aria-label", "Posts arrived while disconnected — refresh");
      wsPill.addEventListener("click", function () { location.reload(); });
      document.body.appendChild(wsPill);
    }
    wsPill.lastChild.textContent = "Missed " + n + " post" + (n > 1 ? "s" : "") + " while disconnected — refresh";
    wsPill.style.display = "inline-flex";
  }
  function initWsHealth() {
    if (!curThreadId()) { return; }
    window.addEventListener("offline", function () { if (wsState) { wsStateChange("down"); } });
    window.addEventListener("online", function () {
      // the socket may or may not resurrect itself — check what we missed either way
      if (wsState) { checkMissedPosts(); }
    });
  }

  /* ---------- Sticky thread status line (lives in the fixed nav) ----------
     "412 replies · 96 files · 31 IDs · updated 3m ago" — the "is this thread
     worth my scroll" answer, always visible. Counts come straight from the
     DOM; last-activity parses the newest labelCreated the same way the
     engine's relative-time code does (localTimes-aware). */
  function parseCreated(el) {
    var v = (el.textContent || "").trim();
    if (!v) { return 0; }
    var d = new Date(v + (window.posting && posting.localTimes ? "" : " UTC"));
    return +d || 0;
  }
  // Icons instead of words: "412 💬 · 96 🖼 · 31 🏷 · 3m 🕐 · 2 👤" — each
  // segment carries the full sentence as tooltip + aria-label, so nothing is
  // lost to screen readers or the curious hover.
  var TS_SVG = {
    reply: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    file: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    id: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.22-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>',
    clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><polyline points="12 7.5 12 12 15.2 13.8"/></svg>',
    anon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    pen: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'
  };
  function tsSeg(text, svg, label) {
    return '<span class="rchan-ts-seg" data-tooltip="' + escHtml(label) + '" aria-label="' +
           escHtml(label) + '">' + escHtml(text) + " " + svg + "</span>";
  }
  function tsChip(text, label, warn) {
    return '<span class="rchan-ts-chip' + (warn ? " rchan-ts-warn" : "") + '" data-tooltip="' +
           escHtml(label) + '" aria-label="' + escHtml(label) + '">' + escHtml(text) + "</span>";
  }
  // Thread lifecycle (thread-page side): one catalog.json fetch resolves this
  // thread's autoSage/cyclic flags + its page position for the status line.
  var threadFlags = null;
  function initThreadFlags() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t || b.charAt(0) === "." || isOverboard(b)) { return; }
    fetch("/" + b + "/catalog.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (list) {
      if (!list) { return; }
      var maxPage = 1, mine = null;
      list.forEach(function (e) {
        if ((e.page || 1) > maxPage) { maxPage = e.page; }
        if (String(e.threadId) === String(t)) { mine = e; }
      });
      if (!mine) { return; }
      threadFlags = { autoSage: !!mine.autoSage, cyclic: !!mine.cyclic, page: mine.page || 1, maxPage: maxPage };
      updateThreadStat();
    }).catch(function () {});
  }
  function updateThreadStat() {
    if (!curThreadId()) { return; }
    var nav = document.querySelector("nav, #dynamicHeader");
    if (!nav) { return; }
    var el = document.getElementById("rchan-threadstat");
    if (!el) {
      el = document.createElement("span");
      el.id = "rchan-threadstat";
      nav.insertBefore(el, document.getElementById("navOptionsSpan") || null);
    }
    var replies = document.getElementsByClassName("postCell").length;
    var files = document.getElementsByClassName("originalNameLink").length;
    var ids = {}, idEls = document.getElementsByClassName("labelId");
    for (var i = 0; i < idEls.length; i++) {
      var v = (idEls[i].textContent || "").replace(/\s*\(\d+\)\s*$/, "").trim();  // hover appends "(n)"
      if (v) { ids[v] = 1; }
    }
    var idCount = Object.keys(ids).length;
    var last = 0, times = document.getElementsByClassName("labelCreated");
    for (var j = 0; j < times.length; j++) {
      var t = parseCreated(times[j]);
      if (t > last) { last = t; }
    }
    var ago = last ? fmtAgo(last) : "";
    var segs = [];
    if (wsState) {                                   // connection dot leads the line
      var liveTip = wsState === "live" ? "Live updates connected"
                                       : "Live updates paused — new posts won't appear until it reconnects";
      segs.push('<span class="rchan-wsdot ' + (wsState === "live" ? "rchan-ws-live" : "rchan-ws-down") +
                '" data-tooltip="' + escHtml(liveTip) + '" aria-label="' + escHtml(liveTip) + '"></span>');
    }
    segs = segs.concat([
      tsSeg(String(replies), TS_SVG.reply, replies + (replies === 1 ? " reply" : " replies")),
      tsSeg(String(files), TS_SVG.file, files + (files === 1 ? " file" : " files"))
    ]);
    if (idCount) { segs.push(tsSeg(String(idCount), TS_SVG.id, idCount + (idCount === 1 ? " unique ID" : " unique IDs"))); }
    if (last) { segs.push(tsSeg(ago, TS_SVG.clock, "updated " + (ago === "now" ? "just now" : ago + " ago"))); }
    if (presenceCount) { segs.push(tsSeg(String(presenceCount), TS_SVG.anon, presenceCount + (presenceCount === 1 ? " anon here now" : " anons here now"))); }
    if (presenceTyping) { segs.push(tsSeg(String(presenceTyping), TS_SVG.pen, presenceTyping + (presenceTyping === 1 ? " anon typing…" : " anons typing…"))); }
    if (threadFlags) {
      // Bump-limit awareness: nothing normally, one warning segment once the
      // thread is within ~10% of the limit (default autoSageLimit 500; this
      // site sets no override) so posters learn a thread is dying while it
      // still matters — not only after it has already stopped bumping.
      var BUMP_LIMIT = 500;
      if (threadFlags.autoSage) {
        segs.push(tsChip("bump limit", "Bump limit reached — replies no longer bump this thread", true));
      } else if (replies >= Math.floor(BUMP_LIMIT * 0.9)) {
        segs.push(tsChip("near bump limit", "Approaching the bump limit (~" + BUMP_LIMIT + " replies) — this thread will soon stop bumping", true));
      }
      if (threadFlags.cyclic) { segs.push(tsChip("cyclic", "Cyclic thread — oldest replies rotate out")); }
    }
    var html = segs.join('<span class="rchan-ts-dot" aria-hidden="true">·</span>');
    el.innerHTML = html;
    // Phones hide the nav status line (the nav has no room) — which meant a
    // phone user saw NONE of the stats/lifecycle/presence layer. Render the
    // same segments as an in-flow strip under the OP; CSS shows it ≤640px.
    var mEl = document.getElementById("rchan-mstats");
    if (!mEl) {
      var op = document.querySelector(".innerOP");
      if (op && op.parentNode) {
        mEl = document.createElement("div");
        mEl.id = "rchan-mstats";
        mEl.setAttribute("aria-hidden", "true");     // duplicate of the nav line for small screens
        op.parentNode.insertBefore(mEl, op.nextSibling);
      }
    }
    if (mEl) { mEl.innerHTML = html; }
  }

  /* ---------- Sticky OP: keep the thread's context while scrolled deep ----------
     Once the OP leaves the viewport, a slim bar under the nav shows its thumb
     + subject; click jumps back to the top. IntersectionObserver-driven, so
     it costs nothing while the OP is visible. ---------- */
  function initStickyOp() {
    if (!curThreadId() || !window.IntersectionObserver) { return; }
    var op = document.querySelector(".innerOP");
    if (!op) { return; }
    var bar = null;
    function build() {
      bar = document.createElement("button");
      bar.id = "rchan-stickyop"; bar.type = "button";
      bar.setAttribute("aria-label", "Back to the start of the thread");
      bar.setAttribute("data-tooltip", "Back to the OP");
      var img = op.querySelector(".imgLink img, img.imgLink");
      if (img && img.getAttribute("src")) {
        var th = document.createElement("img");
        th.src = img.getAttribute("src"); th.alt = "";
        bar.appendChild(th);
      }
      var txt = document.createElement("span");
      txt.textContent = threadTitle();
      bar.appendChild(txt);
      bar.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: SB }); });
      document.body.appendChild(bar);
    }
    var io = new IntersectionObserver(function (entries) {
      var e = entries[0];
      var show = !e.isIntersecting && e.boundingClientRect.bottom < 0 && setOn("stickyop");
      if (show && !bar) { build(); }
      if (bar) { bar.style.display = show ? "flex" : "none"; }
    });
    io.observe(op);
  }

  /* ---------- Thread minimap: the whole thread at a glance ----------
     j/k, find and conversation view are all LOCAL moves; a 400-post thread
     had no global structure. A thin canvas on the right edge maps every post
     to a tick — your posts red, replies to you green, image posts amber —
     with a translucent viewport window. Click or drag to jump. Desktop only,
     threads of 30+ posts, toggleable. ---------- */
  var mmap = null, mmapCv = null, mmapPosts = null, mmapDoc = 1, mmapRaf = 0;
  var MMAP_COLORS = ["rgba(120,120,120,.55)", "#d29a2b", "#2ea043", "#c8102e"];
  function mmapCollect() {
    var cells = document.querySelectorAll(".opCell, .postCell");
    if (cells.length < 30) { mmapPosts = null; if (mmap) { mmap.style.display = "none"; } return; }
    var mine = load(YOU_KEY), set = {};
    for (var m = 0; m < mine.length; m++) { set[mine[m]] = 1; }
    var arr = [];
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].offsetParent === null) { continue; }            // hidden/filtered
      var r = cells[i].getBoundingClientRect();
      var inner = cells[i].querySelector(".innerPost, .innerOP");
      var kind = 0;
      if (inner && inner.classList.contains("rchan-you")) { kind = 3; }
      else if (quotesMine(cells[i], set)) { kind = 2; }
      else if (findImgLink(cells[i])) { kind = 1; }
      arr.push({ y: r.top + (window.scrollY || 0), k: kind });
    }
    mmapPosts = arr;
    mmapDoc = Math.max(1, document.documentElement.scrollHeight);
    if (mmap) { mmap.style.display = ""; }
  }
  function mmapDraw() {
    mmapRaf = 0;
    if (!mmapCv || !mmapPosts || !setOn("minimap")) { return; }
    var W = mmapCv.width, H = mmapCv.height;
    var x = mmapCv.getContext("2d");
    x.clearRect(0, 0, W, H);
    for (var i = 0; i < mmapPosts.length; i++) {
      var p = mmapPosts[i];
      x.fillStyle = MMAP_COLORS[p.k];
      x.fillRect(1, Math.round(p.y / mmapDoc * H), W - 2, p.k ? 3 : 2);
    }
    var vy = (window.scrollY || 0) / mmapDoc * H;
    var vh = Math.max(8, window.innerHeight / mmapDoc * H);
    x.fillStyle = "rgba(39,74,107,.18)";
    x.fillRect(0, vy, W, vh);
    x.strokeStyle = "rgba(39,74,107,.6)";
    x.strokeRect(0.5, vy + 0.5, W - 1, vh - 1);
  }
  function mmapQueue() { if (!mmapRaf) { mmapRaf = requestAnimationFrame(mmapDraw); } }
  function mmapJump(e) {
    var r = mmapCv.getBoundingClientRect();
    var frac = (e.clientY - r.top) / r.height;
    window.scrollTo({ top: Math.max(0, frac * mmapDoc - window.innerHeight / 2) });
  }
  function initMinimap() {
    if (!curThreadId() || !setOn("minimap")) { return; }
    if (!(window.matchMedia && matchMedia("(min-width: 1000px)").matches)) { return; }
    if (document.getElementById("rchan-minimap")) { return; }
    mmap = document.createElement("div"); mmap.id = "rchan-minimap";
    mmap.setAttribute("aria-hidden", "true");                      // pointer shortcut, not the primary nav
    mmapCv = document.createElement("canvas");
    mmap.appendChild(mmapCv);
    document.body.appendChild(mmap);
    function size() {
      mmapCv.width = mmap.offsetWidth || 14;
      mmapCv.height = mmap.offsetHeight || 300;
    }
    size();
    mmapCollect();
    if (!mmapPosts) { return; }                                    // under 30 posts: stays hidden until WS grows it
    mmapDraw();
    var drag = false;
    mmapCv.addEventListener("pointerdown", function (e) {
      drag = true; mmapJump(e);
      try { mmapCv.setPointerCapture(e.pointerId); } catch (e2) {}
      e.preventDefault();
    });
    mmapCv.addEventListener("pointermove", function (e) { if (drag) { mmapJump(e); } });
    mmapCv.addEventListener("pointerup", function () { drag = false; });
    window.addEventListener("scroll", mmapQueue, { passive: true });
    window.addEventListener("resize", function () { size(); mmapCollect(); mmapQueue(); });
  }
  function refreshMinimap() {                                      // called from refresh(): new posts shift everything
    if (!mmap) { return; }
    mmapCollect();
    mmapQueue();
  }

