  /* ---------- Unified settings panel (gear in the nav column) + "?" cheat-sheet ----------
     Every rchan toggle in ONE discoverable place. Feature guards read setOn()
     at event time, so changes apply instantly — no reload. Two rows bridge
     NATIVE storage (relativeTime, rchan_notify) instead of duplicating it. */
  var SET_NS = "rchan_set_";
  function setOn(k, def) {                             // def defaults to true; pass false for opt-in features
    try { var v = localStorage.getItem(SET_NS + k); return v === null ? def !== false : v === "1"; }
    catch (e) { return def !== false; }
  }
  function setPut(k, on) { try { localStorage.setItem(SET_NS + k, on ? "1" : "0"); } catch (e) {} }
  function syncBell(on) {
    var b = document.getElementById("rchan-bellbtn");
    if (b) { b.classList.toggle("rchan-on", on); }
  }
  var SET_ROWS = [
    { g: "Media", k: "hoverzoom", t: "Image hover zoom", d: "Full-size floating preview while hovering a thumbnail" },
    { g: "Media", k: "vidpop", t: "Video hover pop-out", d: "Muted autoplay preview while hovering a video thumbnail" },
    { g: "Reading", k: "catprev", t: "Catalog thread previews", d: "Last replies shown when hovering (or tapping) a catalog card" },
    { g: "Reading", k: "inlinequote", t: "Inline quote expansion", d: "Click a >>quote to embed the post instead of jumping to it" },
    { g: "Advanced", k: "keys", t: "Keyboard shortcuts", d: "j/k posts · t/b top/bottom · c catalog · r reply — press ? for the full list" },
    { g: "Posting", k: "drafts", t: "Draft autosave", d: "Keep unposted reply text per thread until it's posted" },
    { g: "Advanced", k: "filterrecurse", t: "Hide replies to filtered posts", d: "Collapse posts that quote a filtered or hidden post" },
    { g: "Appearance", k: "banners", t: "Board banners", d: "Rotating banner above the board title (boards that have banners uploaded)" },
    { g: "Reading", k: "visiteddim", def: false, t: "Dim read threads in the catalog", d: "Threads you've opened (with nothing new since) fade back so the unread ones pop" },
    { g: "Advanced", k: "stickyop", t: "Sticky OP bar", d: "When the OP scrolls away, a slim bar keeps its thumb + subject — click to jump back" },
    { g: "Advanced", k: "minimap", t: "Thread minimap", d: "Long threads (30+ posts, desktop) get a right-edge map — your posts red, replies to you green, images amber" },
    { g: "Advanced", k: "follow", t: "Follow live threads", d: "Reading at the bottom? New posts scroll into view as they arrive; scroll up and it stands down" },
    { g: "Reading", t: "Infinite scroll", d: "Board index and catalog load more automatically as you scroll near the bottom, instead of paging",
      get: function () { return infScrollOn(); },
      set: function (on) {
        setPut("infscroll", on);
        if (on) { initInfiniteScroll(); initCatalogInfiniteScroll(); }
        else {
          // best-effort teardown so it stops immediately instead of waiting for a reload
          if (isState.io) { isState.io.disconnect(); }
          if (csState.io) { csState.io.disconnect(); }
          var hidden = document.querySelectorAll(".catalogCell[data-inf-hidden]");
          for (var i = 0; i < hidden.length; i++) { hidden[i].style.removeProperty("display"); hidden[i].removeAttribute("data-inf-hidden"); }
        }
      } },
    { g: "Media", t: "Work-safe mode", d: "Blur every thumbnail, image and video until you hover it — for reading in public",
      get: function () { return setOn("wsmode", false); },
      set: function (on) { setPut("wsmode", on); applyWorkSafe(); } },
    { g: "Advanced", k: "vidpopsound", def: false, t: "Sound on video hover", d: "Unmute the floating hover preview — volume follows your saved level" },
    { g: "Posting", k: "autowatch", t: "Watch threads you post in", d: "Posting adds the thread to your watcher, so replies notify you automatically" },
    { g: "Notifications", k: "yousound", def: false, t: "Sound on replies to you", d: "Short chime when a new post quotes one of yours" },
    { g: "Posting", k: "stripexif", t: "Strip image metadata", d: "Re-encode JPEG/PNG/WebP uploads in the browser so EXIF/GPS never leaves your device (GIFs excluded)" },
    { g: "Advanced", k: "anonname", def: false, t: "Anonymize filenames", d: "Rename uploads to a timestamp before they upload" },
    { g: "Advanced", t: "Board accent colors", d: "Each board tints its title with its own stable hue",
      get: function () { return setOn("accent"); },
      set: function (on) { setPut("accent", on); applyBoardAccent(); } },
    { g: "Appearance", t: "Text size", d: "Scales every piece of text (the rem scale) without zooming the whole page",
      options: [["s", "Small"], ["m", "Default"], ["l", "Large"], ["xl", "Extra large"]],
      get: function () { try { return localStorage.getItem(TEXTSIZE_KEY) || "m"; } catch (e) { return "m"; } },
      set: function (v) {
        try { v === "m" ? localStorage.removeItem(TEXTSIZE_KEY) : localStorage.setItem(TEXTSIZE_KEY, v); } catch (e) {}
        applyTextSize();
      } },
    { g: "Appearance", t: "Auto theme (follow OS)", d: "Dark when your system is dark, cream otherwise — switches live",
      get: autoThemeOn,
      set: function (on) {
        try { on ? localStorage.setItem(THEME_AUTO_KEY, "1") : localStorage.removeItem(THEME_AUTO_KEY); } catch (e) {}
        if (on) { applyAutoTheme(); }
        syncAutoThemeOption();
      } },
    { g: "Advanced", t: "Loop videos", d: "Restart videos when they end (native players)",
      get: function () { try { return !JSON.parse(localStorage.noAutoLoop || "false"); } catch (e) { return true; } },
      set: function (on) {
        try { localStorage.noAutoLoop = JSON.stringify(!on); } catch (e) {}
        var vids = document.getElementsByTagName("video");
        for (var i = 0; i < vids.length; i++) {
          if (vids[i].id !== "rchan-vidzoom") { vids[i].loop = on; }
        }
      } },
    { g: "Reading", t: "Relative timestamps", d: "“14 minutes ago” next to post dates",
      get: function () { try { return JSON.parse(localStorage.relativeTime || "true"); } catch (e) { return true; } },
      set: function (on) {
        try { localStorage.relativeTime = on ? "true" : "false"; } catch (e) {}
        if (on) { enableRelativeTimes(); return; }
        if (relTimer) { clearInterval(relTimer); relTimer = null; }
        var els = document.getElementsByClassName("relativeTime");
        for (var i = els.length - 1; i >= 0; i--) { els[i].parentNode.removeChild(els[i]); }
      } },
    { g: "Notifications", t: "Desktop notifications", d: "System notification when a hidden tab gets replies — this thread or any watched thread (same as the bell button)",
      get: function () { try { return localStorage.getItem(NOTIFY_KEY) === "1"; } catch (e) { return false; } },
      set: function (on, report) {
        if (!on) {
          try { localStorage.removeItem(NOTIFY_KEY); } catch (e) {}
          syncBell(false); if (report) { report(false); }
          return;
        }
        if (!("Notification" in window)) { toast("This browser doesn't support notifications", true); if (report) { report(false); } return; }
        Notification.requestPermission().then(function (p) {
          var ok = p === "granted";
          if (ok) { try { localStorage.setItem(NOTIFY_KEY, "1"); } catch (e) {} }
          else { toast("Notifications are blocked by the browser", true); }
          syncBell(ok); if (report) { report(ok); }
        });
      } }
  ];
  /* ---------- Backup / restore: the user's whole rchan identity ----------
     Everything accumulated ((You)s, watched, history, filters, drafts,
     settings…) lives in localStorage — one cleared cache and it's gone.
     Export writes every rchan_* key + the native keys to a JSON file;
     import MERGES (union arrays, keep-newest maps) so restoring on a
     second device adds to it instead of clobbering it. */
  var EXPORT_NATIVE = ["filterData", "hidingData", "watchedData", "relativeTime",
                       "localTime", "selectedTheme", "noAutoLoop", "deletionPassword", "postingPasswords", "customCSS"];
  function backupPayload() {                            // -> JSON string, or null on storage failure
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("rchan_once_") === 0) { continue; }   // ephemeral cross-tab stamps
        if (k === "rchan_watchdead") { continue; }               // ephemeral strike counters
        if (k && k.indexOf("rchan_") === 0) { out[k] = localStorage.getItem(k); }
      }
      EXPORT_NATIVE.forEach(function (k2) {
        var v = localStorage.getItem(k2);
        if (v !== null) { out[k2] = v; }
      });
    } catch (e) { return null; }
    return JSON.stringify({ rchanBackup: 1, exported: new Date().toISOString(), data: out });
  }
  function stampBackedUp() { try { localStorage.setItem("rchan_lastbackup", String(Date.now())); } catch (e) {} }
  function exportData() {
    var payload = backupPayload();
    if (!payload) { toast("Couldn't read local data", true); return; }
    var blob = new Blob([payload], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rchan-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    stampBackedUp();
    okToast("Backup downloaded");
  }
  // String transport: on phones, downloading and re-uploading a JSON file is
  // genuinely painful — copy/paste the same payload instead.
  function copyIdentity() {
    var payload = backupPayload();
    if (!payload) { toast("Couldn't read local data", true); return; }
    var done = function () { stampBackedUp(); okToast("Identity copied — paste it on the other device"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(done, function () {
        window.prompt("Copy your identity string:", payload); stampBackedUp();
      });
    } else {
      window.prompt("Copy your identity string:", payload); stampBackedUp();
    }
  }
  function pasteIdentity() {
    var s = window.prompt("Paste your rchan identity string:");
    if (s && s.trim()) { applyBackupString(s.trim()); }
  }
  function mergeJson(k, oldRaw, newRaw) {
    try {
      var a = JSON.parse(oldRaw), b = JSON.parse(newRaw);
      if (Array.isArray(a) && Array.isArray(b)) {
        if (k === "rchan_hist") {                      // newest-first, dedup by board/thread
          var seen = {};
          var all = b.concat(a).filter(function (e) {
            var kk = e && (e.b + "/" + e.t);
            if (!kk || seen[kk]) { return false; }
            seen[kk] = 1; return true;
          }).sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
          return JSON.stringify(all.slice(0, HIST_MAX));
        }
        if (k === "filterData") {                      // dedup by (type, pattern, regex)
          var have = {}, outArr = a.slice();
          a.forEach(function (f) { have[f.type + "|" + f.filter + "|" + !!f.regex] = 1; });
          b.forEach(function (f) {
            if (!have[f.type + "|" + f.filter + "|" + !!f.regex]) { outArr.push(f); }
          });
          return JSON.stringify(outArr);
        }
        var u = a.slice();                             // generic array (rchan_you): union
        b.forEach(function (v) { if (u.indexOf(v) < 0) { u.push(v); } });
        return JSON.stringify(u);
      }
      if (a && b && typeof a === "object" && typeof b === "object") {
        if (k === "rchan_seen") {                      // keep whichever read further
          Object.keys(b).forEach(function (kk) {
            if (!a[kk] || (b[kk].maxId || 0) > (a[kk].maxId || 0)) { a[kk] = b[kk]; }
          });
          return JSON.stringify(a);
        }
        if (k === "hidingData") {                      // per-board union of threads/posts
          Object.keys(b).forEach(function (bd) {
            if (!a[bd]) { a[bd] = b[bd]; return; }
            ["threads", "posts"].forEach(function (f2) {
              var cur = a[bd][f2] = a[bd][f2] || [];
              (b[bd][f2] || []).forEach(function (v) { if (cur.indexOf(v) < 0) { cur.push(v); } });
            });
          });
          return JSON.stringify(a);
        }
        Object.keys(b).forEach(function (kk) { if (!(kk in a)) { a[kk] = b[kk]; } });
        return JSON.stringify(a);
      }
    } catch (e) {}
    return newRaw;                                     // scalars / mismatch: imported wins
  }
  function applyBackupString(txt) {
    try {
      var parsed = JSON.parse(txt);
      if (!parsed || parsed.rchanBackup !== 1 || !parsed.data) { toast("Not an rchan backup", true); return; }
      var d = parsed.data, n = 0;
      Object.keys(d).forEach(function (k) {
        if (k.indexOf("rchan_") !== 0 && EXPORT_NATIVE.indexOf(k) < 0) { return; }   // whitelist only
        if (typeof d[k] !== "string") { return; }
        var cur = localStorage.getItem(k);
        try { localStorage.setItem(k, cur === null ? d[k] : mergeJson(k, cur, d[k])); n++; } catch (e) {}
      });
      okToast("Restored " + n + " entries — reloading");
      setTimeout(function () { location.reload(); }, 900);
    } catch (e) { toast("Couldn't read that backup", true); }
  }
  function importData(file) {
    var fr = new FileReader();
    fr.onload = function () { applyBackupString(fr.result); };
    fr.readAsText(file);
  }
  // Everything the user is lives in this browser's localStorage; one cleared
  // cache erases months of identity silently. Nudge gently: after two weeks
  // with no backup ever, or a month since the last one — at most weekly.
  function initBackupNudge() {
    try {
      var now = Date.now();
      var first = parseInt(localStorage.getItem("rchan_firstseen"), 10) || 0;
      if (!first) { localStorage.setItem("rchan_firstseen", String(now)); return; }
      var lastB = parseInt(localStorage.getItem("rchan_lastbackup"), 10) || 0;
      var lastN = parseInt(localStorage.getItem("rchan_nudge"), 10) || 0;
      var due = lastB ? (now - lastB > 30 * 86400e3) : (now - first > 14 * 86400e3);
      if (!due || now - lastN < 7 * 86400e3) { return; }
      localStorage.setItem("rchan_nudge", String(now));
      toastAction("Your (You)s, filters and watched threads live only in this browser", "Back up", exportData);
    } catch (e) {}
  }

  /* ---------- Auto theme: follow the OS light/dark preference ----------
     "Auto (OS)" joins the theme dropdown (and a settings row): dark when the
     OS is dark, cream otherwise, live-switching on the matchMedia change
     event. Implemented by steering the NATIVE selectedTheme + themeLoader
     (and the pre-paint predark hint), so every page renders consistently. */
  var THEME_AUTO_KEY = "rchan_theme_auto";
  function autoThemeOn() { try { return localStorage.getItem(THEME_AUTO_KEY) === "1"; } catch (e) { return false; } }
  function applyAutoTheme() {
    if (!autoThemeOn()) { return; }
    var dark = !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    try {
      delete localStorage.manualDefault;
      localStorage.selectedTheme = dark ? "dark" : "cream";
    } catch (e) {}
    try { if (window.themeLoader && themeLoader.load) { themeLoader.load(); } } catch (e2) {}
    try { document.documentElement.classList.toggle("predark", dark); } catch (e3) {}
  }
  function syncAutoThemeOption() {
    var sel = document.getElementById("themeSelector");
    if (!sel) { return; }
    var o = sel.querySelector("option[data-auto]");
    if (o && autoThemeOn()) { o.selected = true; }
  }
  function initAutoTheme() {
    var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq) {
      var onChange = function () { applyAutoTheme(); syncAutoThemeOption(); };
      if (mq.addEventListener) { mq.addEventListener("change", onChange); }
      else if (mq.addListener) { mq.addListener(onChange); }
    }
    applyAutoTheme();
    var sel = document.getElementById("themeSelector");
    if (sel && !sel.querySelector("option[data-auto]")) {
      // Custom themes whose CSS lives in ux.css (not in themes.js's native list).
      // Append AFTER the native options so their indices stay valid for the
      // native onchange handler; our wrapper intercepts the custom ones first.
      var bo = document.createElement("option");
      bo.textContent = "Brutalist";
      bo.setAttribute("data-rchan-theme", "brutalist");
      sel.appendChild(bo);
      var ao = document.createElement("option");
      ao.textContent = "Academia";
      ao.setAttribute("data-rchan-theme", "academia");
      sel.appendChild(ao);
      // Cream (Dark): rides on native "dark" (data-rchan-theme=dark) + warm marker.
      var cdo = document.createElement("option");
      cdo.textContent = "Cream (Dark)";
      cdo.setAttribute("data-rchan-theme", "dark");
      cdo.setAttribute("data-rchan-warm", "1");
      sel.appendChild(cdo);
      var o = document.createElement("option");
      o.textContent = "Auto (OS)";
      o.setAttribute("data-auto", "1");
      sel.appendChild(o);
      if (autoThemeOn()) { o.selected = true; }
      else { try {
        if (localStorage.selectedTheme === "brutalist") { bo.selected = true; }
        else if (localStorage.selectedTheme === "academia") { ao.selected = true; }
        else if (localStorage.selectedTheme === "dark" && warmDarkOn()) { cdo.selected = true; }
      } catch (e0) {} }
      // themes.js binds onchange as a property and indexes into ITS OWN theme
      // list — selecting an appended option through that handler would throw.
      var orig = sel.onchange;
      sel.onchange = function () {
        var cur = sel.options[sel.selectedIndex];
        if (cur && cur.getAttribute("data-auto")) {
          try { localStorage.setItem(THEME_AUTO_KEY, "1"); } catch (e) {}
          setWarmDark(false);
          applyAutoTheme();
          return;
        }
        try { localStorage.removeItem(THEME_AUTO_KEY); } catch (e2) {}
        if (cur && cur.getAttribute("data-rchan-theme")) {   // Brutalist / Academia / Cream (Dark)
          setWarmDark(cur.getAttribute("data-rchan-warm") === "1");
          try { delete localStorage.manualDefault; localStorage.selectedTheme = cur.getAttribute("data-rchan-theme"); } catch (e3) {}
          try { document.documentElement.classList.remove("predark"); } catch (e4) {}
          if (window.themeLoader && themeLoader.load) { themeLoader.load(); }
          applyWarmDark();
          return;
        }
        setWarmDark(false);   // any native option (Default/Clear/Cyber/Cream/Dark) clears the warm tint
        if (orig) { return orig.apply(this, arguments); }
      };
    }
  }
  /* ---------- Work-safe mode: blur all media until hovered ---------- */
  function applyWorkSafe() {
    try { document.body.classList.toggle("rchan-ws", setOn("wsmode", false)); } catch (e) {}
  }
  /* ---------- Custom CSS (settings panel; bridges the native customCSS key) ---------- */
  function applyCustomCss() {
    var css = "";
    try { css = localStorage.customCSS || ""; } catch (e) {}
    var el = document.getElementById("rchan-customcss");
    if (!css.trim()) { if (el && el.parentNode) { el.parentNode.removeChild(el); } return; }
    if (!el) { el = document.createElement("style"); el.id = "rchan-customcss"; }
    el.textContent = css;
    document.head.appendChild(el);            // (re-)append LAST so it wins the cascade
  }
  function buildCssSection(box) {
    box.innerHTML = "";
    var head = document.createElement("div"); head.className = "rchan-set-sub";
    head.textContent = "Custom CSS";
    box.appendChild(head);
    var desc = document.createElement("div"); desc.className = "rchan-set-desc";
    desc.textContent = "Applied on every page, after every theme. Yours to break.";
    box.appendChild(desc);
    var ta = document.createElement("textarea");
    ta.className = "rchan-css-input"; ta.rows = 5;
    ta.placeholder = ".divMessage { font-size: 15px; }";
    ta.setAttribute("aria-label", "Custom CSS");
    try { ta.value = localStorage.customCSS || ""; } catch (e) {}
    box.appendChild(ta);
    var save = document.createElement("button"); save.type = "button";
    save.className = "rchan-css-save"; save.textContent = "Save CSS";
    save.addEventListener("click", function () {
      var prev = "";
      try { prev = localStorage.customCSS || ""; } catch (e) {}
      // the native settings menu injected an anonymous <style> with the old
      // value at load — clear it so deletions actually disappear this session
      if (prev) {
        var styles = document.head.getElementsByTagName("style");
        for (var i = 0; i < styles.length; i++) {
          if (!styles[i].id && styles[i].textContent === prev) { styles[i].textContent = ""; }
        }
      }
      try { localStorage.customCSS = ta.value; } catch (e2) {}
      var inp = document.getElementById("cssInput");     // keep the native menu's box in sync
      if (inp) { inp.value = ta.value; }
      applyCustomCss();
      okToast("Custom CSS saved");
    });
    box.appendChild(save);
  }

  /* ---------- Text size: the comfort knob the rem scale earned ----------
     The whole type scale is rem-based, so one root font-size adjustment
     scales every piece of text (browser page-zoom scales all the chrome
     too; this scales just the type). Applied pre-init AND live. */
  var TEXTSIZE_KEY = "rchan_textsize";
  var TEXT_SIZES = { s: "14px", m: "", l: "18px", xl: "20px" };
  function applyTextSize() {
    var v = "m";
    try { v = localStorage.getItem(TEXTSIZE_KEY) || "m"; } catch (e) {}
    if (!(v in TEXT_SIZES)) { v = "m"; }
    document.documentElement.style.fontSize = TEXT_SIZES[v];
  }

  /* ---------- "Cream (Dark)" theme ----------
     A warm-brown dark variant. It rides on the native "dark" theme (so every
     dark-styled surface is inherited for free) and layers a warm tint via an
     html.rchan-warmdark marker class — the class lives on <html> so the native
     themeLoader, which rewrites body.className, can't clobber it. */
  var WARMDARK_KEY = "rchan_warmdark";
  function warmDarkOn() { try { return localStorage.getItem(WARMDARK_KEY) === "1"; } catch (e) { return false; } }
  function applyWarmDark() {
    try { document.documentElement.classList.toggle("rchan-warmdark", warmDarkOn()); } catch (e) {}
  }
  function setWarmDark(on) {
    try { if (on) { localStorage.setItem(WARMDARK_KEY, "1"); } else { localStorage.removeItem(WARMDARK_KEY); } } catch (e) {}
    applyWarmDark();
  }

  /* ---------- Feedback lever: forty features, zero ways to say one is broken ----------
     Point FEEDBACK_THREAD at a sticky meta thread ({ board, thread }) to send
     feedback into the board itself (the QR is one tap away there); until one
     exists it falls back to the contact page. This link is how we find out
     which features earn their keep — from users instead of from guessing. */
  var FEEDBACK_THREAD = null;                          // e.g. { board: "rdr", thread: 123 }
  function openFeedback() {
    if (FEEDBACK_THREAD && FEEDBACK_THREAD.board && FEEDBACK_THREAD.thread) {
      location.href = "/" + FEEDBACK_THREAD.board + "/res/" + FEEDBACK_THREAD.thread;
      return;
    }
    location.href = "/.static/pages/contact";
  }

  var setPanel = null;
  function buildSetRow(row) {
    var lab = document.createElement("label"); lab.className = "rchan-set-row";
    var txt = document.createElement("span"); txt.className = "rchan-set-text";
    var t = document.createElement("span"); t.className = "rchan-set-title"; t.textContent = row.t;
    var d = document.createElement("span"); d.className = "rchan-set-desc"; d.textContent = row.d;
    txt.appendChild(t); txt.appendChild(d);
    if (row.options) {                               // select row (e.g. text size)
      var sel = document.createElement("select");
      sel.className = "rchan-set-select";
      row.options.forEach(function (o) {
        var op = document.createElement("option");
        op.value = o[0]; op.textContent = o[1];
        sel.appendChild(op);
      });
      sel.value = row.get ? row.get() : "";
      sel.addEventListener("change", function () { if (row.set) { row.set(sel.value); } });
      lab.appendChild(txt); lab.appendChild(sel);
      return lab;
    }
    var cb = document.createElement("input"); cb.type = "checkbox";
    cb.checked = row.get ? !!row.get() : setOn(row.k, row.def);
    cb.addEventListener("change", function () {
      if (row.set) { row.set(cb.checked, function (v) { cb.checked = !!v; }); }
      else { setPut(row.k, cb.checked); }
    });
    lab.appendChild(txt); lab.appendChild(cb);
    return lab;
  }
  function setFootLink(text, fn) {
    var a = document.createElement("a"); a.href = "#"; a.textContent = text;
    a.addEventListener("click", function (e) { e.preventDefault(); fn(); });
    return a;
  }
  function toggleSetPanel() {
    if (setPanel && setPanel.style.display === "block") { setPanel.style.display = "none"; return; }
    if (!setPanel) {
      setPanel = document.createElement("div"); setPanel.id = "rchan-set";
      setPanel.setAttribute("role", "dialog"); setPanel.setAttribute("aria-label", "Site settings");
      var head = document.createElement("div"); head.className = "rchan-set-head";
      var ttl = document.createElement("span"); ttl.textContent = "Site settings";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Close"; x.setAttribute("aria-label", "Close settings");
      x.addEventListener("click", function () { setPanel.style.display = "none"; dialogClosed(setPanel); });
      head.appendChild(ttl); head.appendChild(x);
      setPanel.appendChild(head);
      setPanel.appendChild(document.createElement("div"));       // rows container
      setPanel.appendChild(document.createElement("div"));       // filter manager container
      setPanel.appendChild(document.createElement("div"));       // custom CSS container
      var foot = document.createElement("div"); foot.className = "rchan-set-foot";
      foot.appendChild(setFootLink("Feature guide", function () { setPanel.style.display = "none"; toggleGuide(); }));
      foot.appendChild(setFootLink("Keyboard shortcuts (?)", function () { setPanel.style.display = "none"; toggleKeysOverlay(); }));
      var eng = document.getElementById("settingsButton");        // native menu: filters / custom CSS / JS
      if (eng) {
        foot.appendChild(setFootLink("Filters & engine settings", function () { setPanel.style.display = "none"; eng.click(); }));
      }
      foot.appendChild(setFootLink("Backup data", exportData));
      var restoreInput = document.createElement("input");
      restoreInput.type = "file"; restoreInput.accept = ".json,application/json";
      restoreInput.style.display = "none";
      restoreInput.addEventListener("change", function () {
        if (restoreInput.files && restoreInput.files[0]) { importData(restoreInput.files[0]); }
        restoreInput.value = "";
      });
      foot.appendChild(setFootLink("Restore", function () { restoreInput.click(); }));
      foot.appendChild(restoreInput);
      foot.appendChild(setFootLink("Copy identity", copyIdentity));
      foot.appendChild(setFootLink("Paste identity", pasteIdentity));
      foot.appendChild(setFootLink("Report a bug / suggest", openFeedback));
      setPanel.appendChild(foot);
      document.body.appendChild(setPanel);
      document.addEventListener("click", function (ev) {          // click-away closes
        if (setPanel.style.display !== "block") { return; }
        var t2 = ev.target;
        if (setPanel.contains(t2) || (t2.closest && t2.closest("#rchan-nav"))) { return; }
        setPanel.style.display = "none";
      }, true);
    }
    var list = setPanel.children[1];                              // rebuild → checkboxes reflect live state
    list.innerHTML = "";
    var news = document.createElement("div"); news.className = "rchan-set-news";
    news.textContent = "Recently added: save a thread (Ctrl+K) · click-to-play video links · long-thread folding · honours Data Saver — all automatic, nothing to switch on";
    list.appendChild(news);
    // grouped into collapsible sections — 20+ flat toggles had become a wall.
    // Open/closed state persists per group; first visit opens Reading only.
    var SET_GROUPS = ["Reading", "Media", "Posting", "Notifications", "Appearance", "Advanced"];
    SET_GROUPS.forEach(function (gname) {
      var rows = SET_ROWS.filter(function (r) { return (r.g || "Advanced") === gname; });
      if (!rows.length) { return; }
      var det = document.createElement("details");
      det.className = "rchan-set-group";
      var saved = null;
      try { saved = localStorage.getItem("rchan_setgrp_" + gname); } catch (e) {}
      det.open = saved === null ? gname === "Reading" : saved === "1";
      var sum = document.createElement("summary");
      sum.textContent = gname + " ";
      var cnt = document.createElement("span"); cnt.className = "rchan-set-grpcount";
      cnt.textContent = String(rows.length);
      sum.appendChild(cnt);
      det.appendChild(sum);
      rows.forEach(function (row) { det.appendChild(buildSetRow(row)); });
      det.addEventListener("toggle", function () {
        try { localStorage.setItem("rchan_setgrp_" + gname, det.open ? "1" : "0"); } catch (e) {}
      });
      list.appendChild(det);
    });
    buildFilterSection(setPanel.children[2]);
    buildCssSection(setPanel.children[3]);
    setPanel.style.display = "block";
    dialogOpened(setPanel);
  }
  /* "?" cheat-sheet overlay (works even with shortcuts toggled off) */
  var KEYS_LIST = [
    ["j / k", "Next / previous post — on the catalog: next / previous thread"],
    ["Enter / e / w", "Catalog: open · preview replies · watch the selected thread"],
    ["← / →", "Previous / next post with a file"],
    ["e", "Expand / collapse the selected post's image"],
    ["g", "Gallery mode — every file on the page, fullscreen"],
    ["t", "Jump to top"],
    ["b", "Jump to bottom"],
    ["c", "Toggle catalog ↔ index view"],
    ["r", "Focus the reply box"],
    ["Ctrl+Enter", "Submit the reply"],
    ["f", "Filter posts in the thread"],
    ["Ctrl+K", "Command palette — boards, threads, actions"],
    ["?", "This cheat-sheet"],
    ["Esc", "Close panels · collapse the expanded image"]
  ];
  /* ---------- Feature guide: forty features deserve a manual ----------
     The hint pill fires once and ? documents only keys — petnames, the
     inbox, watch-from-catalog, work-safe mode and the rest were rediscovered
     by accident or never. One curated overlay, grouped like the settings. */
  var GUIDE = [
    ["Reading", [
      ["Gallery", "g or the 🖼 nav icon — fullscreen media with filmstrip, pinch-zoom, slideshow (s), download"],
      ["Hover previews", "hover a thumbnail for full-size; hover a catalog card for its last replies"],
      ["Inline quotes", "click any >>quote to embed the post; the ⇄ icon isolates one conversation"],
      ["Find in thread", "f — live filter with id: name: file: subj: no: prefixes; funnels on ID pills"],
      ["Long threads", "minimap on the right edge (your posts red, replies to you green) · sticky OP bar · very long threads fold old posts behind a stub"],
      ["Play video links", "a ▶ appears next to YouTube/Vimeo links — click to play inline, nothing loads until you do"],
      ["Work-safe mode", "blur all media until hovered — toggle in settings or via Ctrl+K"]
    ]],
    ["Staying current", [
      ["Auto-watch", "posting watches the thread; replies notify you (bell / settings opt-in)"],
      ["(You) inbox", "✉ in the corner column — every reply to your posts, unread-tracked, cross-device via backup"],
      ["Watch from catalog", "👁 on any card, or w with the keyboard selection"],
      ["Connection dot", "green = live updates flowing; amber = paused, with a missed-posts pill on reconnect"],
      ["History", "🕘 recent threads with unread counts; pruned threads marked \"gone\""]
    ]],
    ["Posting", [
      ["Submit fast", "Ctrl+Enter posts; sage is a checkbox; the counter knows the board limit"],
      ["Live preview", "Preview button renders the markup exactly as it will land"],
      ["File privacy", "EXIF/GPS stripped in-browser by default; optional filename anonymizing; ✎ crops/rotates"],
      ["Duplicate warning", "attaching a file already in the thread warns before you post"],
      ["Delete own post", "hover your (You) posts for the del button — uses your stored password"]
    ]],
    ["Navigation", [
      ["Command palette", "Ctrl+K — boards, threads, watched, history, actions, deep search everywhere"],
      ["Keyboard", "j/k posts and catalog cards · Enter/e/w on the catalog · full list under ?"],
      ["Deep search", "the \"deep\" checkbox on catalog search matches inside every reply"]
    ]],
    ["Identity", [
      ["Save a thread", "Ctrl+K → \"Save this thread\" (or long-press on mobile) writes a self-contained HTML archive"],
      ["It's all local", "(You)s, watched, filters, names — this browser only; export it under settings"],
      ["Move devices", "Copy identity / Paste identity in the settings footer — merge-safe"],
      ["ID petnames", "✎ next to an ID pill names it locally; the name filters in find (id:)"],
      ["Filters", "name/text/regex/filename/image-hash rules — 🚫 on any file row filters that image forever"],
      ["Appearance", "themes + auto (OS), text size, custom CSS — all under ⚙"]
    ]]
  ];
  var guideOverlay = null;
  function toggleGuide() {
    if (guideOverlay && guideOverlay.style.display === "flex") { guideOverlay.style.display = "none"; dialogClosed(guideOverlay); return; }
    if (!guideOverlay) {
      guideOverlay = document.createElement("div"); guideOverlay.id = "rchan-guide";
      guideOverlay.setAttribute("role", "dialog"); guideOverlay.setAttribute("aria-label", "Feature guide");
      var box = document.createElement("div"); box.className = "rchan-keys-box rchan-guide-box";
      var head = document.createElement("div"); head.className = "rchan-set-head";
      var ttl = document.createElement("span"); ttl.textContent = "Everything rchan does";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Close"; x.setAttribute("aria-label", "Close the feature guide");
      x.addEventListener("click", function () { guideOverlay.style.display = "none"; dialogClosed(guideOverlay); });
      head.appendChild(ttl); head.appendChild(x);
      box.appendChild(head);
      var list = document.createElement("div"); list.className = "rchan-guide-list";
      GUIDE.forEach(function (grp) {
        var h = document.createElement("div"); h.className = "rchan-guide-h"; h.textContent = grp[0];
        list.appendChild(h);
        grp[1].forEach(function (row) {
          var r = document.createElement("div"); r.className = "rchan-guide-row";
          var term = document.createElement("span"); term.className = "rchan-guide-term"; term.textContent = row[0];
          var desc = document.createElement("span"); desc.className = "rchan-guide-desc"; desc.textContent = row[1];
          r.appendChild(term); r.appendChild(desc);
          list.appendChild(r);
        });
      });
      box.appendChild(list);
      guideOverlay.appendChild(box);
      guideOverlay.addEventListener("click", function (e) {
        if (e.target === guideOverlay) { guideOverlay.style.display = "none"; }
      });
      document.body.appendChild(guideOverlay);
    }
    guideOverlay.style.display = "flex";
    dialogOpened(guideOverlay);
  }

  var keysOverlay = null;
  function toggleKeysOverlay() {
    if (keysOverlay && keysOverlay.style.display === "flex") { keysOverlay.style.display = "none"; return; }
    if (!keysOverlay) {
      keysOverlay = document.createElement("div"); keysOverlay.id = "rchan-keys";
      keysOverlay.setAttribute("role", "dialog"); keysOverlay.setAttribute("aria-label", "Keyboard shortcuts");
      var box = document.createElement("div"); box.className = "rchan-keys-box";
      var head = document.createElement("div"); head.className = "rchan-set-head";
      var ttl = document.createElement("span"); ttl.textContent = "Keyboard shortcuts";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Close"; x.setAttribute("aria-label", "Close shortcuts");
      x.addEventListener("click", function () { keysOverlay.style.display = "none"; dialogClosed(keysOverlay); });
      head.appendChild(ttl); head.appendChild(x);
      box.appendChild(head);
      var list = document.createElement("div"); list.className = "rchan-keys-list";
      box.appendChild(list);
      keysOverlay.appendChild(box);
      keysOverlay.addEventListener("click", function (e) {        // backdrop click closes
        if (e.target === keysOverlay) { keysOverlay.style.display = "none"; }
      });
      document.body.appendChild(keysOverlay);
    }
    var list2 = keysOverlay.firstChild.lastChild;                 // rebuilt each open (rows grow with features)
    list2.innerHTML = "";
    KEYS_LIST.forEach(function (k) {
      var row = document.createElement("div"); row.className = "rchan-keys-row";
      var kbd = document.createElement("kbd"); kbd.textContent = k[0];
      var lbl = document.createElement("span"); lbl.textContent = k[1];
      row.appendChild(kbd); row.appendChild(lbl);
      list2.appendChild(row);
    });
    var more = document.createElement("a");                       // keys are a tenth of it
    more.href = "#"; more.className = "rchan-keys-more"; more.textContent = "Full feature guide →";
    more.addEventListener("click", function (e) {
      e.preventDefault();
      keysOverlay.style.display = "none";
      toggleGuide();
    });
    list2.appendChild(more);
    keysOverlay.style.display = "flex";
    dialogOpened(keysOverlay);
  }
