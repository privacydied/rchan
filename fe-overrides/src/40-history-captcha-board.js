  /* ---------- Recently visited threads: history panel (🕘 in the nav column) ----------
     Every thread view is recorded (board, id, OP subject/snippet, when, reply
     count). The panel lists them newest-first with a "+N new" badge computed
     from ONE catalog.json fetch per distinct board, diffed against the reply
     counts rchan_seen already tracks. */
  var HIST_KEY = "rchan_hist", HIST_MAX = 50;
  function histLoad() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; } }
  function histSave(a) { try { localStorage.setItem(HIST_KEY, JSON.stringify(a.slice(0, HIST_MAX))); } catch (e) {} }
  function threadTitle() {
    var s = document.querySelector(".innerOP .labelSubject");
    if (s && s.textContent.trim()) { return s.textContent.trim().slice(0, 70); }
    var m = document.querySelector(".innerOP .divMessage");
    if (m && m.textContent.trim()) { return m.textContent.trim().replace(/\s+/g, " ").slice(0, 70); }
    return "Thread " + curThreadId();
  }
  function recordVisit() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t || b.charAt(0) === ".") { return; }
    var a = histLoad().filter(function (e) { return !(e.b === b && e.t === t); });
    a.unshift({ b: b, t: t, s: threadTitle(), ts: Date.now() });
    histSave(a);
  }
  function fmtAgo(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) { return "now"; }
    if (m < 60) { return m + "m"; }
    var h = Math.round(m / 60);
    if (h < 24) { return h + "h"; }
    return Math.round(h / 24) + "d";
  }
  var histPanel = null;
  function renderHist() {
    var list = histPanel.lastChild;
    var a = histLoad();
    list.innerHTML = "";
    if (!a.length) {
      var empty = document.createElement("div"); empty.className = "rchan-hist-empty";
      empty.textContent = "No threads visited yet";
      list.appendChild(empty);
      return;
    }
    var seen = seenAll(), rows = [];
    a.forEach(function (e) {
      var row = document.createElement("a");
      row.className = "rchan-hist-row";
      row.href = "/" + e.b + "/res/" + e.t;
      var title = document.createElement("span"); title.className = "rchan-hist-title";
      title.textContent = "/" + e.b + "/ · " + (e.s || ("Thread " + e.t));
      var badge = document.createElement("span"); badge.className = "rchan-newbadge"; badge.style.display = "none";
      var meta = document.createElement("span"); meta.className = "rchan-hist-meta"; meta.textContent = fmtAgo(e.ts);
      meta.setAttribute("data-ts", e.ts);                    // live time-ago ticker reads this
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-hist-x"; x.textContent = "×"; x.title = "Remove from history";
      x.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        histSave(histLoad().filter(function (o) { return !(o.b === e.b && o.t === e.t); }));
        renderHist();
      });
      row.appendChild(title); row.appendChild(badge); row.appendChild(meta); row.appendChild(x);
      list.appendChild(row);
      rows.push({ e: e, badge: badge, row: row });
    });
    // unread badges + dead markers: one catalog fetch per distinct board in
    // the list. A thread missing from its board's catalog is pruned/archived —
    // grey it out and say so instead of leaving a link that 404s unannounced.
    var boards = {};
    a.forEach(function (e) { boards[e.b] = 1; });
    Object.keys(boards).forEach(function (b) {
      fetch("/" + b + "/catalog.json").then(function (r) {
        if (!r.ok) { throw new Error("no catalog"); }
        return r.json();
      }).then(function (cat) {
        var counts = {};
        (cat || []).forEach(function (t) { counts[t.threadId] = t.postCount || 0; });
        rows.forEach(function (ro) {
          if (ro.e.b !== b) { return; }
          if (counts[ro.e.t] == null) {                          // gone from the board
            ro.row.classList.add("rchan-hist-dead");
            ro.badge.className = "rchan-deadbadge";
            ro.badge.textContent = "gone";
            ro.badge.style.display = "";
            return;
          }
          var rec = seen[b + "/" + ro.e.t];
          var diff = counts[ro.e.t] - ((rec && rec.replies) || 0);
          if (rec && diff > 0) {
            ro.badge.textContent = "+" + diff + " new";
            ro.badge.style.display = "";
          }
        });
      }).catch(function () {});                                  // board unreachable: mark nothing
    });
  }
  var HIST_SCROLL = "rchan_hist_scroll", histScrollT = null;
  function toggleHistPanel() {
    if (histPanel && histPanel.style.display === "block") { histPanel.style.display = "none"; return; }
    if (!histPanel) {
      histPanel = document.createElement("div"); histPanel.id = "rchan-hist";
      histPanel.setAttribute("role", "dialog"); histPanel.setAttribute("aria-label", "Recently visited threads");
      var head = document.createElement("div"); head.className = "rchan-hist-head";
      var ttl = document.createElement("span"); ttl.textContent = "Recent threads";
      var clr = document.createElement("button"); clr.type = "button"; clr.className = "rchan-hist-clear"; clr.textContent = "Clear";
      clr.addEventListener("click", function () { histSave([]); renderHist(); });
      head.appendChild(ttl); head.appendChild(clr);
      histPanel.appendChild(head);
      histPanel.appendChild(document.createElement("div"));   // list container (lastChild)
      document.body.appendChild(histPanel);
      document.addEventListener("click", function (ev) {      // click-away closes
        if (histPanel.style.display !== "block") { return; }
        var t = ev.target;
        if (histPanel.contains(t) || (t.closest && t.closest("#rchan-nav"))) { return; }
        histPanel.style.display = "none";
      }, true);
      // remember scroll position (survives close/reopen and page navigations)
      histPanel.addEventListener("scroll", function () {
        clearTimeout(histScrollT);
        histScrollT = setTimeout(function () {
          try { sessionStorage.setItem(HIST_SCROLL, String(histPanel.scrollTop)); } catch (e) {}
        }, 150);
      });
      // live time-ago: tick the row timestamps while the panel is open
      setInterval(function () {
        if (histPanel.style.display !== "block") { return; }
        var metas = histPanel.getElementsByClassName("rchan-hist-meta");
        for (var i = 0; i < metas.length; i++) {
          var ts = parseInt(metas[i].getAttribute("data-ts"), 10);
          if (ts) { metas[i].textContent = fmtAgo(ts); }
        }
      }, 30000);
    }
    renderHist();
    histPanel.style.display = "block";
    dialogOpened(histPanel);
    try { histPanel.scrollTop = parseInt(sessionStorage.getItem(HIST_SCROLL), 10) || 0; } catch (e) {}
  }

  /* ---------- Captcha expiry feedback ----------
     captchaUtils already counts down and AUTO-RELOADS the captcha at expiry —
     but that also clears whatever you'd typed, silently. Wrap the reload so
     the auto-expiry path (cu.reloading, set only by its timer loop) toasts
     when it eats a typed answer. Manual Reload clicks bypass the wrapper
     (they were bound by reference at init) — correctly so. */
  function hookCaptchaReload() {
    var cu = window.captchaUtils;
    if (!cu || !cu.reloadCaptcha || cu.__rchan) { return; }
    cu.__rchan = true;
    var orig = cu.reloadCaptcha;
    cu.reloadCaptcha = function () {
      try {
        if (cu.reloading) {                                  // auto-expiry path only
          var fields = document.getElementsByClassName("captchaField");
          for (var i = 0; i < fields.length; i++) {
            if (fields[i].value.trim()) {
              toast("Captcha expired — a fresh one loaded, please re-solve", true);
              break;
            }
          }
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  /* ---------- Per-board accent identity ----------
     Every board renders identically; a stable per-board hue (hash of the
     URI, same trick as the ID pills) tints the board title so each board
     reads as a *place*. One custom property; CSS keeps the saturation and
     lightness on-palette per theme. Toggleable in site settings. */
  function applyBoardAccent() {
    var rootEl = document.documentElement;
    var b = getBoard();
    if (!b || b.charAt(0) === "." || !setOn("accent")) {
      rootEl.classList.remove("rchan-accented");
      return;
    }
    var h = 0;
    for (var i = 0; i < b.length; i++) { h = (h * 31 + b.charCodeAt(i)) >>> 0; }
    rootEl.style.setProperty("--bah", h % 360);
    rootEl.classList.add("rchan-accented");
  }

  /* ---------- Empty-state: a quiet board shouldn't read as a dead one ----------
     Zero threads on a board/catalog renders a real invitation with a CTA
     that opens the floating new-thread form, instead of engine whitespace.
     Re-checked by refresh() so it clears itself when a thread appears. */
  function syncEmptyState() {
    var b = getBoard(), t = document.getElementById("divThreads");
    if (!b || b.charAt(0) === "." || !t || curThreadId()) { return; }
    if (!document.getElementById("postingForm")) { return; }     // can't post here (overboard etc.)
    var has = t.getElementsByClassName(isCatalog() ? "catalogCell" : "opCell").length;
    var el = document.getElementById("rchan-empty");
    if (has) { if (el && el.parentNode) { el.parentNode.removeChild(el); } return; }
    if (el) { return; }
    var box = document.createElement("div"); box.id = "rchan-empty";
    var ttl = document.createElement("div"); ttl.className = "rchan-empty-title";
    ttl.textContent = "No threads yet";
    var sub = document.createElement("div"); sub.className = "rchan-empty-sub";
    sub.textContent = "/" + b + "/ is a blank canvas — be the one who starts the conversation.";
    var cta = document.createElement("button"); cta.type = "button"; cta.className = "rchan-empty-cta";
    cta.textContent = "＋ Create the first thread";
    cta.addEventListener("click", function () {
      var tog = document.getElementById("rchan-formtoggle");
      if (tog) { tog.click(); return; }
      var m = document.getElementById("fieldMessage");
      if (m) { m.focus(); try { m.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
    });
    box.appendChild(ttl); box.appendChild(sub); box.appendChild(cta);
    t.parentNode.insertBefore(box, t);
  }

  /* ---------- Rotating board banners ----------
     LynxChan serves /randomBanner.js?boardUri=x (302 to a random uploaded
     banner, or to /defaultBanner.png when the board has none — in which
     case we render NOTHING rather than the engine's stock art). Click the
     banner to roll another. Upload banners per-board via board management. */
  function buildBanner() {
    if (!setOn("banners")) { return; }
    var b = getBoard();
    if (!b || b.charAt(0) === "." || document.getElementById("rchan-bannerwrap")) { return; }
    var anchor = document.querySelector(".boardHeader, #catalogId");
    if (!anchor) { return; }
    var url = "/randomBanner.js?boardUri=" + encodeURIComponent(b);
    fetch(url).then(function (r) {
      if (!r.ok || /defaultBanner/.test(r.url || "")) { return; }
      if (document.getElementById("rchan-bannerwrap")) { return; }
      var img = document.createElement("img");
      img.id = "rchan-banner";
      img.alt = "/" + b + "/ banner";
      img.src = r.url;
      img.setAttribute("data-tooltip", "Another banner");
      img.addEventListener("click", function () {
        fetch(url + "&r=" + Date.now()).then(function (r2) {
          if (r2.ok && !/defaultBanner/.test(r2.url || "")) { img.src = r2.url; }
        }).catch(function () {});
      });
      img.addEventListener("error", function () {
        var w = document.getElementById("rchan-bannerwrap");
        if (w && w.parentNode) { w.parentNode.removeChild(w); }
      });
      var wrap = document.createElement("div"); wrap.id = "rchan-bannerwrap";
      wrap.appendChild(img);
      anchor.parentNode.insertBefore(wrap, anchor);
    }).catch(function () {});
  }

  /* ---------- Per-thread scroll resume ----------
     Jump-to-new answers "what's unread"; this answers "where was I".
     Last scroll position is saved per thread (only after a real user
     scroll, so a glance at the top never clobbers a deep bookmark) and a
     quiet pill offers to jump back on the next visit. Auto-dismisses when
     you scroll most of the way there yourself. */
  var SCROLL_KEY = "rchan_scrollpos", SCROLL_MAX = 100, scrollSaveT = null;
  function scrollMap() { try { return JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}"); } catch (e) { return {}; } }
  function saveScrollPos() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t) { return; }
    var map = scrollMap();
    map[b + "/" + t] = { y: Math.round(window.scrollY || 0), ts: Date.now() };
    var keys = Object.keys(map);
    if (keys.length > SCROLL_MAX) {                    // prune oldest
      keys.sort(function (a, b2) { return (map[a].ts || 0) - (map[b2].ts || 0); });
      for (var i = 0; i < keys.length - SCROLL_MAX; i++) { delete map[keys[i]]; }
    }
    try { localStorage.setItem(SCROLL_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function initScrollResume() {
    var b = getBoard(), t = curThreadId();
    if (!b || !t) { return; }
    var armed = false;                                 // only save after a real user scroll
    window.addEventListener("scroll", function () {
      armed = true;
      clearTimeout(scrollSaveT); scrollSaveT = setTimeout(saveScrollPos, 300);
    }, { passive: true });
    window.addEventListener("pagehide", function () { if (armed) { saveScrollPos(); } });
    if (location.hash) { return; }                     // deep link wins
    var rec = scrollMap()[b + "/" + t];
    if (!rec || rec.y < window.innerHeight) { return; }
    var pill = document.createElement("button");
    pill.id = "rchan-resume"; pill.type = "button";
    pill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><polyline points="12 7.5 12 12 15.2 13.8"/></svg><span>Resume reading</span>';
    function hidePill() { if (pill.parentNode) { pill.parentNode.removeChild(pill); } }
    pill.addEventListener("click", function () {
      window.scrollTo({ top: rec.y, behavior: SB });
      hidePill();
    });
    document.body.appendChild(pill);
    setTimeout(hidePill, 20000);
    window.addEventListener("scroll", function selfScrolled() {
      if ((window.scrollY || 0) > rec.y * 0.8) {       // found their own way back
        hidePill();
        window.removeEventListener("scroll", selfScrolled);
      }
    }, { passive: true });
  }

  /* ---------- Proactive captcha lifecycle ----------
     The native loop only reacts AT expiry (auto-reload, which eats typed
     answers — hookCaptchaReload toasts after the fact). Get ahead of it:
     - field EMPTY and <6s left  -> silently swap in a fresh captcha now
       (nothing to lose; the manual-reload path, so no expiry toast fires),
     - field TYPED and <12s left -> warn once so the user can submit before
       the native timer wipes the answer. */
  function initCaptchaLifecycle() {
    if (initCaptchaLifecycle.__on || !window.captchaUtils || !captchaUtils.reloadCaptcha ||
        !window.api || !api.getCookies) { return; }
    if (!document.getElementsByClassName("captchaField").length) { return; }
    initCaptchaLifecycle.__on = true;
    var warnedFor = 0, freshenedFor = 0;
    setInterval(function () {
      try {
        var fields = document.getElementsByClassName("captchaField");
        if (!fields.length) { return; }
        var c = api.getCookies();
        if (!c.captchaexpiration) { return; }
        var exp = new Date(c.captchaexpiration).getTime();
        if (!exp) { return; }
        var left = exp - Date.now();
        if (left <= 1500 || left > 12500) { return; }   // native handles actual expiry
        var typed = false;
        for (var i = 0; i < fields.length; i++) { if (fields[i].value.trim()) { typed = true; break; } }
        if (typed) {
          if (warnedFor !== exp) {
            warnedFor = exp;
            toast("Captcha expires in " + Math.round(left / 1000) + "s — post now or it will reload", true);
          }
        } else if (freshenedFor !== exp && left <= 6500) {
          freshenedFor = exp;
          captchaUtils.reloadCaptcha();                 // silent early swap: nothing typed to lose
        }
      } catch (e) {}
    }, 1000);
  }

