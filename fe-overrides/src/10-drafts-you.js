  /* ---------- Draft autosave (per board/thread, cleared on successful post) ---------- */
  var DRAFT_NS = "rchan_draft:";
  function draftKey() {
    var b = getBoard(); if (!b || b.charAt(0) === ".") { return null; }
    return DRAFT_NS + b + "/" + (curThreadId() || "index");
  }
  var draftT = null;
  function saveDraftFrom(el) {
    if (!setOn("drafts")) { return; }
    clearTimeout(draftT);
    draftT = setTimeout(function () {
      var key = draftKey(); if (!key) { return; }
      try {
        var v = el.value || "";
        if (v.trim()) { localStorage.setItem(key, v); } else { localStorage.removeItem(key); }
      } catch (e) {}
    }, 400);
  }
  function clearDraft() {
    var key = draftKey(); if (!key) { return; }
    try { localStorage.removeItem(key); } catch (e) {}   // native replyCallback clears the fields
  }
  function initDrafts() {
    var key = draftKey(); if (!key) { return; }
    var msg = document.getElementById("fieldMessage");
    if (!msg || msg.getAttribute("data-draft")) { return; }
    msg.setAttribute("data-draft", "1");
    try {
      var d = setOn("drafts") ? localStorage.getItem(key) : null;
      if (d && !msg.value) {
        msg.value = d;
        msg.dispatchEvent(new Event("input", { bubbles: true }));  // syncs #qrbody + counters
      }
    } catch (e) {}
    msg.addEventListener("input", function () { saveDraftFrom(msg); });
  }
  function hookQrDraft() {  // #qrbody is built lazily by qr.js; its input doesn't re-fire on #fieldMessage
    var ta = document.getElementById("qrbody");
    if (!ta || ta.getAttribute("data-draft")) { return; }
    ta.setAttribute("data-draft", "1");
    ta.addEventListener("input", function () { saveDraftFrom(ta); });
  }

  /* ---------- "(You)" — record your own posts, then highlight ---------- */
  var flashId = null, flashDeadline = 0;
  // Watch primitives — shared by auto-watch (below), the catalog watch button
  // and the catalog keyboard/long-press actions. Same watchedData records the
  // native watch button writes; labels escaped the same way (addWatchedCell
  // innerHTMLs them).
  function isWatched(board, threadId) {
    try {
      var wd = JSON.parse(localStorage.watchedData || "{}");
      return !!(wd[board] && wd[board][threadId]);
    } catch (e) { return false; }
  }
  function watchThread(board, threadId, label) {
    if (!board || !threadId) { return false; }
    try {
      var wd = JSON.parse(localStorage.watchedData || "{}");
      if (wd[board] && wd[board][threadId]) { return false; }      // already watched
      var now = Date.now();
      var rec = { lastSeen: now, lastReplied: now, label: escHtml(String(label || "").slice(0, 70)) || null };
      (wd[board] = wd[board] || {})[threadId] = rec;
      localStorage.watchedData = JSON.stringify(wd);
      if (window.watcher && watcher.addWatchedCell) {              // render the menu cell live
        try { watcher.addWatchedCell(board, String(threadId), rec); } catch (e2) {}
      }
      if (typeof pushSync === "function") { pushSync(); }          // keep server push targets current
      return true;
    } catch (e) { return false; }
  }
  function unwatchThread(board, threadId) {
    try {
      var wd = JSON.parse(localStorage.watchedData || "{}");
      if (wd[board]) {
        delete wd[board][threadId];
        if (!Object.keys(wd[board]).length) { delete wd[board]; }
      }
      localStorage.watchedData = JSON.stringify(wd);
    } catch (e) {}
    try {   // drop the menu cell: notification span -> label -> cell -> wrapper
      var w = window.watcher;
      var rel = w && w.elementRelation && w.elementRelation[board] && w.elementRelation[board][threadId];
      if (rel) {
        var wrap = rel.parentNode && rel.parentNode.parentNode && rel.parentNode.parentNode.parentNode;
        if (wrap && wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
        delete w.elementRelation[board][threadId];
      }
    } catch (e2) {}
    if (typeof pushSync === "function") { pushSync(); }             // server push targets changed
  }
  // Auto-watch: posting in a thread (or creating one) adds it to the native
  // watcher, so the whole notification pipeline fires without the manual
  // bell click. Default ON, toggleable in settings.
  function autoWatch(board, threadId, label) {
    if (!setOn("autowatch")) { return; }
    watchThread(board, threadId, label);
  }
  function addYou(id) {
    id = String(id).replace(/\D/g, "");
    if (!id) { return; }
    clearDraft();                                   // post landed — the draft served its purpose
    flashId = id; flashDeadline = Date.now() + 20000;
    var a = load(YOU_KEY);
    if (a.indexOf(id) < 0) { a.push(id); save(YOU_KEY, a); refresh(); if (typeof pushSync === "function") { pushSync(); } }
    var t = curThreadId();
    if (t) { autoWatch(getBoard(), t, threadTitle()); }
  }
  // After a successful reply, scroll to your post once it renders and flash it.
  function tryFlashOwnPost() {
    if (!flashId) { return; }
    if (Date.now() > flashDeadline) { flashId = null; return; }
    if (!curThreadId()) { return; }                 // new-thread posts navigate away anyway
    var el = document.getElementById(flashId);
    if (!el) { return; }
    var inner = el.querySelector(".innerPost, .innerOP") || el;
    flashId = null;
    try { el.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {}
    inner.classList.add("rchan-flash");
    setTimeout(function () { inner.classList.remove("rchan-flash"); }, 2600);
  }
  // Label for a just-created thread (subject field, else message snippet)
  function newThreadLabel() {
    var s = document.getElementById("fieldSubject");
    if (s && s.value.trim()) { return s.value.trim().slice(0, 70); }
    var m = document.getElementById("fieldMessage");
    if (m && m.value.trim()) { return m.value.trim().replace(/\s+/g, " ").slice(0, 70); }
    return null;
  }
  function hookPostCapture() {
    var re = /\/(replyThread|newThread)\.js/;
    var oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return oOpen.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (body) {
      // admin flag override: ride the outgoing posting FormData (the engine's
      // fe JS builds its payload from a fixed field list, so a plain <select>
      // in the form would never be sent). Server re-checks the role anyway.
      try {
        var sel = document.getElementById("rchan-flagoverride");
        if (sel && /^[a-z]{2}$/i.test(sel.value) && re.test(this.__u || "") &&
            typeof FormData !== "undefined" && body instanceof FormData) {
          body.append("flagOverride", sel.value.toUpperCase());
        }
      } catch (e) {}
      var x = this;
      this.addEventListener("load", function () {
        try {
          if (re.test(x.__u || "")) {
            var r = JSON.parse(x.responseText);
            if (r && r.status === "ok" && r.data != null) {
              addYou(r.data);
              if (/newThread/.test(x.__u)) { autoWatch(getBoard(), r.data, newThreadLabel()); }
              okToast(/newThread/.test(x.__u) ? "Thread created" : "Reply posted");
            }
          }
        } catch (e) {}
      });
      return oSend.apply(this, arguments);
    };
    if (window.fetch) {
      var oF = window.fetch;
      window.fetch = function (input) {
        var url = (typeof input === "string") ? input : (input && input.url) || "";
        var p = oF.apply(this, arguments);
        if (re.test(url)) {
          p.then(function (res) {
            res.clone().json().then(function (r) {
              if (r && r.status === "ok" && r.data != null) {
                addYou(r.data);
                if (/newThread/.test(url)) { autoWatch(getBoard(), r.data, newThreadLabel()); }
                okToast(/newThread/.test(url) ? "Thread created" : "Reply posted");
              }
            }).catch(function () {});
          }).catch(function () {});
        }
        return p;
      };
    }
  }
  function decorateYou(root) {
    var mine = load(YOU_KEY);
    if (!mine.length) { return; }
    var posts = (root || document).querySelectorAll(".innerPost, .innerOP");
    for (var i = 0; i < posts.length; i++) {
      var id = postId(posts[i]);
      if (id && mine.indexOf(id) > -1) { posts[i].classList.add("rchan-you"); }
    }
    var quotes = (root || document).querySelectorAll(".quoteLink");
    for (var j = 0; j < quotes.length; j++) {
      var a = quotes[j];
      if (a.getAttribute("data-you")) { continue; }
      var m = (a.getAttribute("href") || "").match(/#(?:q)?(\d+)/) || (a.textContent || "").match(/(\d+)/);
      if (m && mine.indexOf(m[1]) > -1) {
        a.setAttribute("data-you", "1");
        a.appendChild(document.createTextNode(" (You)"));
      }
    }
  }

