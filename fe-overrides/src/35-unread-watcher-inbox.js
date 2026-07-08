  /* ---------- New-since-last-visit (thread + catalog) + replies-to-you ---------- */
  var SEEN_KEY = "rchan_seen", NOTIFY_KEY = "rchan_notify";
  // Tab-title unread counter: "(3) /rdr/ - thread" while the tab is hidden.
  var baseTitle = document.title, unseenCount = 0;
  function setFavBadge(n) {  // favicon.js exposes the badge compositor
    try { if (window.rchanSetFaviconBadge) { rchanSetFaviconBadge(n); } } catch (e) {}
  }
  // Cross-tab once-guard: localStorage is shared synchronously between tabs,
  // so stamping a key before notifying/chiming stops two open tabs from both
  // firing for the same event. Stamps are pruned after an hour and excluded
  // from backups.
  function onceAcross(key, ms) {
    try {
      var k = "rchan_once_" + key, now = Date.now();
      var prev = parseInt(localStorage.getItem(k), 10) || 0;
      if (now - prev < ms) { return false; }
      localStorage.setItem(k, String(now));
      return true;
    } catch (e) { return true; }
  }
  function pruneOnceStamps() {
    try {
      var now = Date.now(), del = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("rchan_once_") === 0 &&
            now - (parseInt(localStorage.getItem(k), 10) || 0) > 3600000) { del.push(k); }
      }
      for (var j = 0; j < del.length; j++) { localStorage.removeItem(del[j]); }
    } catch (e) {}
  }
  function setTitleUnread(n) {                  // absolute count (board pages diff, not accumulate)
    unseenCount = Math.max(0, n | 0);
    document.title = unseenCount ? "(" + unseenCount + ") " + baseTitle : baseTitle;
    setFavBadge(unseenCount);
  }
  function bumpTitleUnread(n) { setTitleUnread(unseenCount + n); }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && unseenCount) { unseenCount = 0; document.title = baseTitle; setFavBadge(0); }
  });
  // "▼ N new" pill when new posts land outside the viewport; hides once seen.
  var newPill = null, pillIO = null, pillTotal = 0;
  function hideNewPill() {
    if (newPill) { newPill.style.display = "none"; }
    if (pillIO) { pillIO.disconnect(); pillIO = null; }
    pillTotal = 0;
  }
  function showNewPill(count, target) {
    pillTotal += count;
    if (!newPill) {
      newPill = document.createElement("button");
      newPill.id = "rchan-newpill"; newPill.type = "button";
      newPill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg><span></span>';
      newPill.addEventListener("click", function () {
        var t = document.getElementById("rchan-newline") || newPill.__target;
        if (t) { try { t.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
        hideNewPill();
      });
      document.body.appendChild(newPill);
    }
    newPill.__target = target;
    newPill.lastChild.textContent = pillTotal + " new post" + (pillTotal > 1 ? "s" : "");
    newPill.style.display = "inline-flex";
    if (window.IntersectionObserver) {
      if (pillIO) { pillIO.disconnect(); }
      pillIO = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { hideNewPill(); return; }
        }
      });
      pillIO.observe(target);
    }
  }
  function seenAll() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { return {}; } }
  var SEEN_MAX = 400;                                    // one record per thread ever visited — cap it
  function seenSave(o) {
    try {
      var keys = Object.keys(o);
      if (keys.length > SEEN_MAX) {                      // evict: legacy no-ts entries first, then oldest
        keys.sort(function (a, b) { return (o[a].ts || 0) - (o[b].ts || 0); });
        for (var i = 0; i < keys.length - SEEN_MAX; i++) { delete o[keys[i]]; }
      }
      localStorage.setItem(SEEN_KEY, JSON.stringify(o));
    } catch (e) {}
  }
  function curThreadId() {
    var t = document.getElementById("threadIdentifier");
    if (t && t.value) { return t.value; }
    var m = location.pathname.match(/\/res\/(\d+)/); return m ? m[1] : null;
  }
  function postIdOf(cell) {
    var q = cell.getElementsByClassName("linkQuote")[0];
    return q ? (parseInt((q.textContent || "").replace(/\D/g, ""), 10) || 0) : 0;
  }
  // Gentle two-note chime for replies quoting your posts (opt-in). WebAudio =
  // CSP-safe, no asset fetch. The context is armed on the first user gesture
  // (autoplay policy: contexts created outside a gesture start suspended).
  var audioCtx = null;
  function armAudio() {
    if (audioCtx) { return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return; }
    try { audioCtx = new AC(); } catch (e) {}
  }
  function youChime() {
    if (!setOn("yousound", false)) { return; }
    try {
      armAudio();
      if (!audioCtx) { return; }
      if (audioCtx.state === "suspended") { audioCtx.resume().catch(function () {}); }
      var t = audioCtx.currentTime;
      [[880, 0], [1174.66, 0.09]].forEach(function (nt) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = nt[0];
        g.gain.setValueAtTime(0.0001, t + nt[1]);
        g.gain.exponentialRampToValueAtTime(0.12, t + nt[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + nt[1] + 0.18);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t + nt[1]); o.stop(t + nt[1] + 0.22);
      });
    } catch (e) {}
  }
  // Does this post's OWN message quote one of my (You) posts?
  function quotesMine(cell, mineSet) {
    var inner = cell.querySelector(".innerPost, .innerOP") || cell;
    var qs = inner.getElementsByClassName("quoteLink");
    for (var j = 0; j < qs.length; j++) {
      if (qs[j].closest && qs[j].closest(".rchan-inline-quote")) { continue; }
      var m = (qs[j].getAttribute("href") || "").match(/(\d+)\s*$/) || (qs[j].textContent || "").match(/(\d+)/);
      if (m && mineSet[m[1]]) { return true; }
    }
    return false;
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
    var curMax = rec.maxId, firstNew = null, newCount = 0, youNew = 0, firstYou = null;
    var mine = load(YOU_KEY), mineSet = {};
    for (var k = 0; k < mine.length; k++) { mineSet[mine[k]] = 1; }
    for (var i = 0; i < posts.length; i++) {
      var id = postIdOf(posts[i]);
      if (id > curMax) { curMax = id; }
      if (rec.maxId && id > rec.maxId && !posts[i].getAttribute("data-new")) {
        posts[i].setAttribute("data-new", "1");
        posts[i].classList.add("rchan-new");
        if (!firstNew) { firstNew = posts[i]; }
        newCount++;
        // not your own fresh post (it lands as "new" too and may quote your earlier posts)
        if (!mineSet[String(id)] && quotesMine(posts[i], mineSet)) {
          youNew++;
          if (!firstYou) { firstYou = posts[i]; }
          // persist into the (You) inbox; already-read when you're looking at it
          var msgEl = posts[i].querySelector(".divMessage");
          youboxAdd(board, tid, id, msgEl ? msgEl.textContent : "", Date.now(), !document.hidden);
        }
      }
    }
    if (youNew > 0) {
      if (onceAcross("chime-" + key + "-" + postIdOf(firstYou), 15000)) { youChime(); }
      updateYouboxBadge();
    }
    if (!document.hidden) { youboxMarkThreadRead(board, tid); }   // being here = reading it
    if (firstNew && !document.getElementById("rchan-newline")) {
      var d = document.createElement("div"); d.id = "rchan-newline";
      d.textContent = newCount + " new post" + (newCount > 1 ? "s" : "") + " since last visit";
      firstNew.parentNode.insertBefore(d, firstNew);
    }
    all[key] = { maxId: curMax, replies: posts.length, ts: Date.now() };
    seenSave(all);
    if (newCount > 0) {
      if (document.hidden) { bumpTitleUnread(newCount); }
      // Follow mode: watching a live thread FROM the bottom shouldn't mean
      // chasing it — if you're already within ~600px of the end, new posts
      // scroll into view on arrival. Scroll up even slightly past that and
      // it stands down instantly (the "N new" pill takes over below).
      var followed = false;
      if (!document.hidden && setOn("follow") &&
          (window.innerHeight + (window.scrollY || 0)) > (document.documentElement.scrollHeight - 600)) {
        try { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: SB }); followed = true; } catch (e4) {}
      }
      // pill only when the first new post is fully outside the viewport
      var fr = firstNew.getBoundingClientRect();
      if (!followed && (fr.top > window.innerHeight || fr.bottom < 0)) { showNewPill(newCount, firstNew); }
    }
    // Foreground desktop notification when new posts land while the tab is hidden (opt-in via 🔔).
    // Replies quoting one of YOUR posts get top billing, and clicking the
    // notification deep-links to the first relevant post instead of just focusing.
    if (newCount > 0 && document.hidden && "Notification" in window &&
        Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "1" &&
        onceAcross("ntf-" + key + "-" + curMax, 15000)) {
      try {
        var title = youNew > 0
          ? "rchan — " + youNew + " repl" + (youNew > 1 ? "ies" : "y") + " to you"
          : "rchan — " + newCount + " new repl" + (newCount > 1 ? "ies" : "y");
        var target = firstYou || firstNew;
        var n = new Notification(title, {
          body: "/" + board + "/ · " + threadTitle(), icon: "/.rchan/icon-192.png", tag: "rchan-" + board + "-" + tid
        });
        n.onclick = function () {
          window.focus();
          try {
            if (target && document.contains(target)) { target.scrollIntoView({ behavior: SB, block: "center" }); }
          } catch (e2) {}
          this.close();
        };
      } catch (e) {}
    }
  }
  /* ---------- Watcher sanity: throttle the poll, unwatch the dead ----------
     The native watcher re-checks EVERY watched thread every ~10s (tuned for
     people who watch two threads); auto-watch now adds one per post, so a
     regular quickly reaches 30+ watched threads = 30 fetches every 10s per
     tab, forever — including threads pruned months ago, which 404 eternally
     because nothing ever unwatches them. Fix both:
     - 75s cadence, skipped while hidden, and cross-tab aware (lastWatchCheck
       is shared localStorage, so if another tab just ran the sweep this one
       waits its turn); returning to the tab runs a stale check immediately.
     - three consecutive failed polls (404/network) = the thread is gone:
       unwatch it and drop its menu cell. A single blip never unwatches. */
  function hookWatcherThrottle() {
    var w = window.watcher;
    if (!w || !w.runWatchedThreadsCheck || !w.iterateWatchedThreads || w.__rchanThrottle) { return; }
    w.__rchanThrottle = true;
    var PERIOD = 75000, DEAD_KEY = "rchan_watchdead";
    w.scheduleWatchedThreadsCheck = function () {
      var last = parseInt(localStorage.lastWatchCheck, 10) || 0;
      var wait = Math.max(5000, last + PERIOD - Date.now());
      setTimeout(function () {
        var l2 = parseInt(localStorage.lastWatchCheck, 10) || 0;
        if (document.hidden || Date.now() - l2 < PERIOD - 2000) {   // hidden, or another tab covered it
          w.scheduleWatchedThreadsCheck();
          return;
        }
        try { w.runWatchedThreadsCheck(); } catch (e) { w.scheduleWatchedThreadsCheck(); }
      }, wait);
    };
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { return; }
      var last = parseInt(localStorage.lastWatchCheck, 10) || 0;
      if (Date.now() - last > PERIOD) { try { w.runWatchedThreadsCheck(); } catch (e) {} }
    });
    function strikes() { try { return JSON.parse(localStorage.getItem(DEAD_KEY) || "{}"); } catch (e) { return {}; } }
    function unwatchDead(b, t) {
      try {
        var wd = JSON.parse(localStorage.watchedData || "{}");
        if (wd[b]) {
          delete wd[b][t];
          if (!Object.keys(wd[b]).length) { delete wd[b]; }
        }
        localStorage.watchedData = JSON.stringify(wd);
      } catch (e) {}
      try {   // drop the menu cell: notification span -> label -> cell -> wrapper
        var rel = w.elementRelation && w.elementRelation[b] && w.elementRelation[b][t];
        if (rel) {
          var wrap = rel.parentNode && rel.parentNode.parentNode && rel.parentNode.parentNode.parentNode;
          if (wrap && wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
          delete w.elementRelation[b][t];
        }
      } catch (e2) {}
    }
    w.iterateWatchedThreads = function (urls, index) {
      index = index || 0;
      if (index >= urls.length) {
        w.updateWatcherCounter();
        w.scheduleWatchedThreadsCheck();
        return;
      }
      var u = urls[index];
      api.localRequest("/" + u.board + "/res/" + u.thread + ".json", function (error, data) {
        try {
          var s = strikes(), k = u.board + "/" + u.thread;
          if (error) {
            s[k] = (s[k] || 0) + 1;
            if (s[k] >= 3) { unwatchDead(u.board, String(u.thread)); delete s[k]; }
            localStorage.setItem(DEAD_KEY, JSON.stringify(s));
          } else if (s[k]) {
            delete s[k];
            localStorage.setItem(DEAD_KEY, JSON.stringify(s));
          }
        } catch (e) {}
        if (error) { w.iterateWatchedThreads(urls, ++index); }
        else { w.processThread(urls, index, data); }
      });
    };
  }
  /* Watched threads: the native watcher polls every watched thread's JSON and
     tallies unread into its nav counter — but silently. Wrap the tally so a
     thread that BECOMES unread while this tab is hidden raises a system
     notification (same opt-in as the bell). The first tally after page load
     only seeds the baseline, so navigating around never re-notifies old unread. */
  function hookWatcherNotify() {
    var w = window.watcher;
    if (!w || w.__rchanNotify || !w.updateWatcherCounter) { return; }
    w.__rchanNotify = true;
    var prevUnread = null;
    var orig = w.updateWatcherCounter;
    function unescapeHtml(s) { var d = document.createElement("textarea"); d.innerHTML = s || ""; return d.value; }
    w.updateWatcherCounter = function () {
      var r = orig.apply(this, arguments);
      try {
        var data = JSON.parse(localStorage.watchedData || "{}");
        var unread = {};
        Object.keys(data).forEach(function (b) {
          Object.keys(data[b] || {}).forEach(function (t) {
            var rec = data[b][t];
            if (rec && (rec.lastReplied || 0) > (rec.lastSeen || 0)) { unread[b + "/" + t] = rec; }
          });
        });
        if (prevUnread && document.hidden && "Notification" in window &&
            Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "1") {
          Object.keys(unread).forEach(function (k2) {
            if (prevUnread[k2]) { return; }
            var parts = k2.split("/");
            // the open thread notifies with full context via markNewInThread — skip it here
            if (parts[0] === getBoard() && parts[1] === curThreadId()) { return; }
            // every open tab polls the watcher — only one gets to notify
            if (!onceAcross("watch-" + k2 + "-" + (unread[k2].lastReplied || 0), 30000)) { return; }
            try {
              var n = new Notification("rchan — watched thread updated", {
                body: (unread[k2].label ? unescapeHtml(unread[k2].label) + " · " : "") + "/" + parts[0] + "/ · thread " + parts[1],
                icon: "/.rchan/icon-192.png", tag: "rchan-watch-" + k2
              });
              n.onclick = function () {
                window.focus();
                try { location.href = "/" + parts[0] + "/res/" + parts[1]; } catch (e3) {}
                this.close();
              };
            } catch (e2) {}
          });
        }
        prevUnread = unread;
      } catch (e) {}
      return r;
    };
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
  // On the catalog: dim threads you've already read (visited AND nothing new
  // since — a visited thread with fresh replies is effectively unread again,
  // so it keeps full strength alongside its "+N new" badge). Scanning the
  // catalog becomes a diff against your own memory. Toggleable; re-evaluated
  // on every refresh so flipping the setting applies live.
  function markVisitedInCatalog() {
    if (!isCatalog()) { return; }
    var board = getBoard(); if (!board) { return; }
    var on = setOn("visiteddim");
    var all = seenAll(), cells = catCells();
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i], tid = catThreadId(cell);
      var rec = tid && all[board + "/" + tid];
      var dim = !!(on && rec && catNum(cell, "labelReplies") <= (rec.replies || 0));
      cell.classList.toggle("rchan-visited", dim);
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
      // Scope to the cell's OWN message container: the opCell CONTAINS every
      // reply postCell (.divPosts), so scanning the whole cell counted each
      // reply's quotes AGAIN for the OP — inflating the count.
      var inner = posts[i].querySelector(".innerPost, .innerOP, .markedPost");
      if (!inner || set[postId(inner)]) { continue; }               // missing / your own post
      var qs = inner.getElementsByClassName("quoteLink");
      for (var j = 0; j < qs.length; j++) {
        if (qs[j].closest && qs[j].closest(".rchan-inline-quote")) { continue; }  // embedded copy, not this post's quote
        var m = (qs[j].getAttribute("href") || "").match(/(\d+)\s*$/) || (qs[j].textContent || "").match(/(\d+)/);
        if (m && set[m[1]]) { youHits.push(posts[i]); break; }
      }
    }
    if (!youHits.length) { if (youBtn) { youBtn.style.display = "none"; } return; }
    if (!youBtn) {
      youBtn = document.createElement("button"); youBtn.id = "rchan-youbtn"; youBtn.type = "button";
      youBtn.title = "Jump to replies to your posts";
      youBtn.setAttribute("aria-label", "Jump to replies to your posts");
      youBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg><span></span>';
      youBtn.addEventListener("click", function () {
        youIdx = (youIdx + 1) % youHits.length;
        youHits[youIdx].scrollIntoView({ behavior: SB, block: "center" });
      });
      document.body.appendChild(youBtn);
    }
    youBtn.style.display = "";
    youBtn.lastChild.textContent = youHits.length + " repl" + (youHits.length > 1 ? "ies" : "y") + " to you";
  }

  /* ---------- (You) inbox: replies to your posts, persisted ----------
     Notifications are ephemeral and scanRepliesToYou only sees the open page —
     miss the toast and a reply to you is silently gone. The native watcher
     already fetches every watched thread's full JSON every poll; scan those
     posts for quotes of your recorded (You) ids and persist the hits. Opening
     the thread marks its entries read, like any inbox. Combined with
     auto-watch, every reply to anything you posted lands here. */
  var YOUBOX_KEY = "rchan_youbox", YOUBOX_MAX = 200;
  function youboxAll() { try { return JSON.parse(localStorage.getItem(YOUBOX_KEY) || "{}"); } catch (e) { return {}; } }
  function youboxSave(o) {
    var keys = Object.keys(o);
    if (keys.length > YOUBOX_MAX) {                              // prune oldest
      keys.sort(function (a, b) { return (o[a].ts || 0) - (o[b].ts || 0); });
      for (var i = 0; i < keys.length - YOUBOX_MAX; i++) { delete o[keys[i]]; }
    }
    try { localStorage.setItem(YOUBOX_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function youboxAdd(b, t, p, snippet, ts, read) {
    var o = youboxAll(), key = b + "/" + t + "/" + p;
    if (o[key]) { return false; }
    o[key] = { b: b, t: String(t), p: String(p),
               s: String(snippet || "").replace(/\s+/g, " ").trim().slice(0, 90),
               ts: ts || Date.now(), r: read ? 1 : 0 };
    youboxSave(o);
    return true;
  }
  function youboxMarkThreadRead(b, t) {
    var o = youboxAll(), changed = false;
    Object.keys(o).forEach(function (k) {
      if (o[k].b === b && o[k].t === String(t) && !o[k].r) { o[k].r = 1; changed = true; }
    });
    if (changed) { youboxSave(o); updateYouboxBadge(); }
  }
  function youboxUnread() {
    var o = youboxAll(), n = 0;
    Object.keys(o).forEach(function (k) { if (!o[k].r) { n++; } });
    return n;
  }
  function updateYouboxBadge() {
    var btn = document.getElementById("rchan-youboxbtn");
    if (!btn) { return; }
    var n = youboxUnread();
    btn.lastChild.textContent = n ? (n > 99 ? "99+" : String(n)) : "";
    btn.classList.toggle("rchan-on", n > 0);
  }
  // Scan a thread's posts (watcher poll JSON) for quotes of your (You) ids
  function scanPostsForYou(b, t, posts) {
    var mine = load(YOU_KEY);
    if (!mine.length || !posts || !posts.length) { return; }
    var set = {};
    for (var i = 0; i < mine.length; i++) { set[mine[i]] = 1; }
    var added = 0;
    for (var j = 0; j < posts.length; j++) {
      var p = posts[j], pid = String(p.postId);
      if (set[pid]) { continue; }                                // your own post
      var quotes = (p.message || "").match(/>>(\d+)/g) || [];
      for (var q = 0; q < quotes.length; q++) {
        if (set[quotes[q].slice(2)]) {
          if (youboxAdd(b, t, pid, p.message, Date.parse(p.creation) || Date.now(),
                        b === getBoard() && String(t) === curThreadId() && !document.hidden)) { added++; }
          break;
        }
      }
    }
    if (added) { updateYouboxBadge(); }
  }
  function hookYouboxScan() {
    var w = window.watcher;
    if (!w || !w.processThread || w.__rchanYoubox) { return; }
    w.__rchanYoubox = true;
    var orig = w.processThread;
    w.processThread = function (urls, index, data) {
      try {
        var u = urls[index];
        var d = JSON.parse(data);
        scanPostsForYou(u.board, String(u.thread), d.posts || []);
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  }
  var youboxPanel = null;
  function renderYoubox() {
    var list = youboxPanel.lastChild;
    var o = youboxAll();
    var entries = Object.keys(o).map(function (k) { return o[k]; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    list.innerHTML = "";
    if (!entries.length) {
      var empty = document.createElement("div"); empty.className = "rchan-hist-empty";
      empty.textContent = "No replies to your posts yet";
      list.appendChild(empty);
      return;
    }
    entries.forEach(function (e) {
      var row = document.createElement("a");
      row.className = "rchan-hist-row rchan-yb-row" + (e.r ? "" : " rchan-yb-unread");
      row.href = "/" + e.b + "/res/" + e.t + ".html#" + e.p;
      var title = document.createElement("span"); title.className = "rchan-hist-title";
      title.textContent = "/" + e.b + "/ · " + (e.s || (">>" + e.p));
      var meta = document.createElement("span"); meta.className = "rchan-hist-meta";
      meta.textContent = fmtAgo(e.ts);
      meta.setAttribute("data-ts", e.ts);
      row.appendChild(title); row.appendChild(meta);
      row.addEventListener("click", function () {                // navigating = reading
        var cur = youboxAll(), k = e.b + "/" + e.t + "/" + e.p;
        if (cur[k] && !cur[k].r) { cur[k].r = 1; youboxSave(cur); updateYouboxBadge(); }
      });
      list.appendChild(row);
    });
  }
  function toggleYoubox() {
    if (youboxPanel && youboxPanel.style.display === "block") { youboxPanel.style.display = "none"; return; }
    if (!youboxPanel) {
      youboxPanel = document.createElement("div"); youboxPanel.id = "rchan-youbox";
      youboxPanel.setAttribute("role", "dialog"); youboxPanel.setAttribute("aria-label", "Replies to your posts");
      var head = document.createElement("div"); head.className = "rchan-hist-head";
      var ttl = document.createElement("span"); ttl.textContent = "Replies to you";
      var mark = document.createElement("button"); mark.type = "button"; mark.className = "rchan-hist-clear";
      mark.textContent = "Mark read";
      mark.addEventListener("click", function () {
        var o = youboxAll();
        Object.keys(o).forEach(function (k) { o[k].r = 1; });
        youboxSave(o); updateYouboxBadge(); renderYoubox();
      });
      var clr = document.createElement("button"); clr.type = "button"; clr.className = "rchan-hist-clear";
      clr.textContent = "Clear";
      clr.addEventListener("click", function () {
        try { localStorage.removeItem(YOUBOX_KEY); } catch (e) {}
        updateYouboxBadge(); renderYoubox();
      });
      head.appendChild(ttl); head.appendChild(mark); head.appendChild(clr);
      youboxPanel.appendChild(head);
      youboxPanel.appendChild(document.createElement("div"));    // list container (lastChild)
      document.body.appendChild(youboxPanel);
      document.addEventListener("click", function (ev) {         // click-away closes
        if (youboxPanel.style.display !== "block") { return; }
        var t2 = ev.target;
        if (youboxPanel.contains(t2) || (t2.closest && t2.closest("#rchan-nav"))) { return; }
        youboxPanel.style.display = "none";
      }, true);
    }
    renderYoubox();
    youboxPanel.style.display = "block";
    dialogOpened(youboxPanel);
  }

