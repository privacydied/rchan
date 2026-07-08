  /* ---------- Find-in-thread: live post filter ----------
     `f` (or the magnifier in the nav) opens a bar that COLLAPSES non-matching
     posts instead of fighting Ctrl+F's lazy rendering. Plain text searches
     everything; `id:` `name:` `file:` `subj:` `no:` scope to a field. Every
     ID pill gets a funnel for one-click "show only this ID". The OP always
     stays visible; live WS posts are re-filtered by refresh(). */
  var SVG_FIND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>';
  var SVG_FUNNEL = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4h18l-7 9v5l-4 2v-7L3 4z"/></svg>';
  var findBar = null, findInput = null, findCount = null, findActive = false, findT = null;
  function buildFindIndex(cell) {
    if (cell.__find) { return cell.__find; }
    var inner = cell.querySelector(".innerPost, .innerOP, .markedPost") || cell;
    function grab(sel) {
      var els = inner.querySelectorAll(sel), s = "";
      for (var i = 0; i < els.length; i++) { s += " " + (els[i].textContent || ""); }
      return s.toLowerCase();
    }
    var msgEl = inner.querySelector(".divMessage"), msg = "";
    if (msgEl) {                                   // exclude inline-expanded quotes (other posts' text)
      var clone = msgEl.cloneNode(true);
      var inl = clone.querySelectorAll(".rchan-inline-quote");
      for (var j = inl.length - 1; j >= 0; j--) { inl[j].parentNode.removeChild(inl[j]); }
      msg = (clone.textContent || "").toLowerCase();
    }
    var f = {
      name: grab(".linkName, .labelName"),
      subj: grab(".labelSubject"),
      id: grab(".labelId").replace(/\s*\(\d+\)\s*/g, " ") + grab(".rchan-idname"),   // petnames filter too
      file: grab(".originalNameLink"),
      no: " " + (postIdOf(cell) || "")
    };
    f.all = msg + f.name + f.subj + f.id + f.file + f.no;
    cell.__find = f;
    return f;
  }
  function applyFind() {
    if (!findActive) { return; }
    var q = (findInput.value || "").trim().toLowerCase();
    var mode = "all", needle = q;
    var m = q.match(/^(id|name|file|subj|no):\s*(.*)$/);
    if (m) { mode = m[1]; needle = m[2]; }
    var posts = document.getElementsByClassName("postCell");
    var shown = 0;
    for (var i = 0; i < posts.length; i++) {
      var f = buildFindIndex(posts[i]);
      var hit = !needle || (f[mode] || "").indexOf(needle) > -1;
      posts[i].classList.toggle("rchan-findhide", !hit);
      if (hit) { shown++; }
    }
    findCount.textContent = needle ? (shown + " / " + posts.length) : (posts.length + " posts");
  }
  function closeFind() {
    if (!findBar) { return; }
    findBar.style.display = "none";
    findActive = false;
    var hidden = document.getElementsByClassName("rchan-findhide");
    for (var i = hidden.length - 1; i >= 0; i--) { hidden[i].classList.remove("rchan-findhide"); }
  }
  function toggleFind(preset) {
    if (!curThreadId()) { return; }
    closeConv();                                       // the two collapse modes are exclusive
    if (findBar && findBar.style.display === "flex" && preset == null) { closeFind(); return; }
    if (!findBar) {
      findBar = document.createElement("div"); findBar.id = "rchan-find";
      findBar.setAttribute("role", "search");
      findInput = document.createElement("input");
      findInput.type = "text"; findInput.placeholder = "Filter posts — text, id:, name:, file:, subj:, no:";
      findInput.setAttribute("aria-label", "Filter posts in this thread");
      findInput.addEventListener("input", function () {
        clearTimeout(findT); findT = setTimeout(applyFind, 150);
      });
      findInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { closeFind(); e.stopPropagation(); }
      });
      findCount = document.createElement("span"); findCount.className = "rchan-findcount";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Close filter"; x.setAttribute("aria-label", "Close filter");
      x.addEventListener("click", closeFind);
      findBar.appendChild(findInput); findBar.appendChild(findCount); findBar.appendChild(x);
      document.body.appendChild(findBar);
    }
    findBar.style.display = "flex";
    findActive = true;
    if (preset != null) { findInput.value = preset; }
    findInput.focus(); findInput.select();
    applyFind();
  }
  function buildFindButton() {
    if (!curThreadId() || document.getElementById("rchan-findbtn")) { return; }
    var nav = document.querySelector("nav, #dynamicHeader");
    if (!nav) { return; }
    var b = document.createElement("button");
    b.type = "button"; b.id = "rchan-findbtn";
    b.innerHTML = SVG_FIND;
    b.setAttribute("data-tooltip", "Filter posts in this thread (f)");
    b.setAttribute("aria-label", "Filter posts in this thread");
    b.addEventListener("click", function () { toggleFind(); });
    nav.insertBefore(b, document.getElementById("navOptionsSpan") || null);
  }

  /* ---------- Conversation view: isolate one quote chain ----------
     The structural reading primitive find-in-thread can't give you: a per-post
     control that collapses the thread to just that post's ancestors (what it
     quotes, transitively) + descendants (what quotes it, transitively). Three
     interleaved arguments become one readable conversation. Same collapse
     mechanics as the find bar; the two modes are mutually exclusive. */
  var SVG_CONV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8v-2z"/></svg>';
  var convRoot = null, convBar = null;
  function quoteGraph() {
    var cells = document.querySelectorAll(".opCell, .postCell");
    var quotes = {}, children = {};
    for (var i = 0; i < cells.length; i++) {
      var id = String(postIdOf(cells[i]) || "");
      if (!id) { continue; }
      var inner = cells[i].querySelector(".innerPost, .innerOP");
      if (!inner) { continue; }
      var qs = inner.getElementsByClassName("quoteLink");
      var list = [];
      for (var j = 0; j < qs.length; j++) {
        if (qs[j].closest && qs[j].closest(".rchan-inline-quote")) { continue; }
        var m = (qs[j].getAttribute("href") || "").match(/(\d+)\s*$/);
        if (m && list.indexOf(m[1]) < 0) { list.push(m[1]); }
      }
      quotes[id] = list;
      for (var k = 0; k < list.length; k++) {
        (children[list[k]] = children[list[k]] || []).push(id);
      }
    }
    return { quotes: quotes, children: children };
  }
  function convMembers(root) {
    var g = quoteGraph(), set = {};
    set[root] = 1;
    var stack = [root], cur, arr, i;
    while (stack.length) {                             // ancestors: what it quotes
      arr = g.quotes[stack.pop()] || [];
      for (i = 0; i < arr.length; i++) { if (!set[arr[i]]) { set[arr[i]] = 1; stack.push(arr[i]); } }
    }
    stack = [root];
    while (stack.length) {                             // descendants: what quotes it
      arr = g.children[stack.pop()] || [];
      for (i = 0; i < arr.length; i++) { if (!set[arr[i]]) { set[arr[i]] = 1; stack.push(arr[i]); } }
    }
    return set;
  }
  function applyConv() {
    if (!convRoot) { return; }
    var set = convMembers(convRoot);
    var posts = document.getElementsByClassName("postCell");
    var n = 0;
    for (var i = 0; i < posts.length; i++) {
      var hit = !!set[String(postIdOf(posts[i]) || "")];
      posts[i].classList.toggle("rchan-convhide", !hit);
      if (hit) { n++; }
    }
    if (convBar) {                                     // +1: the OP is always visible
      convBar.firstChild.textContent = "Conversation around No." + convRoot + " · " + (n + 1) + " posts";
    }
  }
  function closeConv() {
    convRoot = null;
    if (convBar) { convBar.style.display = "none"; }
    var hidden = document.getElementsByClassName("rchan-convhide");
    for (var i = hidden.length - 1; i >= 0; i--) { hidden[i].classList.remove("rchan-convhide"); }
  }
  function openConv(rootId) {
    closeFind();                                       // the two collapse modes are exclusive
    convRoot = String(rootId);
    if (!convBar) {
      convBar = document.createElement("div"); convBar.id = "rchan-conv";
      convBar.appendChild(document.createElement("span"));
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.title = "Exit conversation view";
      x.setAttribute("aria-label", "Exit conversation view");
      x.addEventListener("click", closeConv);
      convBar.appendChild(x);
      document.body.appendChild(convBar);
    }
    convBar.style.display = "flex";
    applyConv();
    var rootEl = document.getElementById(convRoot);
    if (rootEl) { try { rootEl.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {} }
  }
  function decorateConvButtons(root) {
    if (!curThreadId()) { return; }
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-conv")) { continue; }
      info.setAttribute("data-conv", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }   // embedded copies
      var cell = info.closest(".postCell, .opCell");
      if (!cell) { continue; }
      var id = postIdOf(cell);
      if (!id) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-convbtn";
      b.innerHTML = SVG_CONV;
      b.setAttribute("data-tooltip", "Show this conversation only");
      b.setAttribute("aria-label", "Show only the conversation around post " + id);
      b.addEventListener("click", (function (pid) {
        return function (ev) { ev.preventDefault(); ev.stopPropagation(); openConv(pid); };
      })(id));
      info.appendChild(b);
    }
  }

  /* ---------- GET celebration: dubs get checked ----------
     Classic chan culture: repeating trailing digits (dubs/trips/quads…) and
     round-number GETs earn a mark. Dubs stay subtle (gold underline on the
     post No.); trips and better — and 000 GETs — get a small gold badge.
     Play is retention on a small board. */
  function decorateGets(root) {
    var links = (root || document).getElementsByClassName("linkQuote");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-get")) { continue; }
      a.setAttribute("data-get", "1");
      if (a.closest && a.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var num = (a.textContent || "").replace(/\D/g, "");
      if (num.length < 2) { continue; }
      var label = null, tier = 0;
      var zeros = num.match(/0{3,}$/);
      var reps = num.match(/(\d)\1+$/);
      var repLen = reps ? reps[0].length : 0;
      if (zeros && zeros[0].length >= 3) { label = "GET"; tier = 3; }
      else if (repLen >= 5) { label = "quints"; tier = 3; }
      else if (repLen === 4) { label = "quads"; tier = 3; }
      else if (repLen === 3) { label = "trips"; tier = 2; }
      else if (repLen === 2) { tier = 1; }               // dubs: underline only
      if (!tier) { continue; }
      a.classList.add("rchan-get");
      if (tier === 1) {
        a.classList.add("rchan-get-dubs");
        a.setAttribute("data-tooltip", "dubs");
        continue;
      }
      var b = document.createElement("span");
      b.className = "rchan-getbadge";
      b.textContent = label;
      a.parentNode.insertBefore(b, a.nextSibling);
    }
  }

  /* ---------- Report shortcut: a visible lever on every post ----------
     The native flow (⋮ menu → Report) is invisible to people who don't
     already know it exists — and users can't help you moderate if they
     can't find the lever. Surface a hover-revealed flag on each post
     header that opens the NATIVE report modal (reason + captcha handling
     included); the modal itself is restyled to the design system in css. */
  var SVG_FLAG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>';
  function decorateReportButtons(root) {
    if (!window.postingMenu || !postingMenu.showReport) { return; }
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-report")) { continue; }
      info.setAttribute("data-report", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var cell = info.closest(".postCell, .opCell");
      var ids = cell && qmodIds(cell);
      if (!ids) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-reportbtn";
      b.innerHTML = SVG_FLAG;
      b.setAttribute("data-tooltip", "Report this post");
      b.setAttribute("aria-label", "Report post " + (ids.post || ids.thread));
      b.addEventListener("click", (function (d) {
        return function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          try { postingMenu.showReport(d.board, d.thread, d.post); } catch (e) {}
        };
      })(ids));
      info.appendChild(b);
    }
  }

  /* ---------- Staff quick-mod: one-click actions on post hover ----------
     The native ⋮ menu buries delete/ban under menu → modal → submit. For
     staff (body.rchan-staff, the same globalRole<=1 gate as the flag
     override — server enforces regardless) each post header gets a
     hover-revealed strip: del / ban+del / ip⌫ (wipe IP in thread). First
     click ARMS the button ("sure?", 2.5s), second click fires through the
     NATIVE postingMenu functions, so DOM cleanup and error handling stay
     engine-consistent. Errors surface via the alert→toast bridge. */
  function qmodIds(cell) {
    var checkbox = cell.querySelector(".deletionCheckBox");
    if (checkbox && checkbox.name) {
      var p = checkbox.name.split("-");
      return { board: p[0], thread: p[1], post: p[2] };            // post undefined for the OP
    }
    return null;
  }
  function qmodButton(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "rchan-qmod-btn"; b.textContent = label;
    b.setAttribute("data-tooltip", title); b.setAttribute("aria-label", title);
    var armT = null;
    b.addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (b.classList.contains("rchan-armed")) {
        clearTimeout(armT);
        b.classList.remove("rchan-armed"); b.textContent = label;
        fn();
        return;
      }
      b.classList.add("rchan-armed"); b.textContent = "sure?";
      armT = setTimeout(function () {
        b.classList.remove("rchan-armed"); b.textContent = label;
      }, 2500);
    });
    return b;
  }
  function decorateQuickMod(root) {
    if (!document.body.classList.contains("rchan-staff") || !window.postingMenu ||
        !postingMenu.deleteSinglePost) { return; }
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-qmod")) { continue; }
      info.setAttribute("data-qmod", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var cell = info.closest(".postCell, .opCell");
      var ids = cell && qmodIds(cell);
      if (!ids) { continue; }
      var innerPart = cell.querySelector(".innerPost, .innerOP");
      var strip = document.createElement("span");
      strip.className = "rchan-qmod";
      strip.appendChild(qmodButton("del", "Delete this post", (function (d, ip2) {
        return function () { postingMenu.deleteSinglePost(d.board, d.thread, d.post, null, null, null, ip2); };
      })(ids, innerPart)));
      strip.appendChild(qmodButton("ban+del", "Ban the poster's IP and delete the post", (function (d, ip2) {
        return function () {
          // defaults: IP ban, permanent, delete the post; ban captcha is skipped
          // for globalRole<4 (postingMenu.applySingleBan handles the rest)
          var dummy = document.createElement("div");
          postingMenu.applySingleBan("", 1, "rule violation (quick-mod)", "", 0, "", false, false,
              d.board, d.thread, d.post, ip2, dummy);
        };
      })(ids, innerPart)));
      strip.appendChild(qmodButton("ip⌫", "Delete every post by this IP in this thread", (function (d, ip2) {
        return function () {
          postingMenu.deleteSinglePost(d.board, d.thread, d.post, true, null, null, ip2, null, true);
        };
      })(ids, innerPart)));
      info.appendChild(strip);
    }
  }

  /* ---------- Delete own post: one visible lever on your (You) posts ----------
     LynxChan supports password deletion and the passwords are already stored
     (postCommon saves postingPasswords[b/t/p] on every post) — but the native
     flow is checkbox → scroll → password field → button, which nobody
     discovers. Your own posts get the same armed-confirm button staff have;
     it fires the NATIVE postingMenu.deleteSinglePost, which resolves the
     stored password itself, removes the DOM on success, and offers a
     password prompt if it ever mismatches. */
  function decorateOwnDelete(root) {
    if (!window.postingMenu || !postingMenu.deleteSinglePost) { return; }
    if (document.body.classList.contains("rchan-staff")) { return; }   // staff already have quick-mod
    var infos = (root || document).querySelectorAll(".innerPost .postInfo.title, .innerOP .opHead.title");
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.getAttribute("data-owndel")) { continue; }
      var inner = info.closest(".innerPost, .innerOP");
      if (!inner || !inner.classList.contains("rchan-you")) { continue; }   // decorateYou runs first
      info.setAttribute("data-owndel", "1");
      if (info.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var cell = info.closest(".postCell, .opCell");
      var ids = cell && qmodIds(cell);
      if (!ids) { continue; }
      var isOp = !ids.post;
      var strip = document.createElement("span");
      strip.className = "rchan-owndel";
      strip.appendChild(qmodButton(isOp ? "del thread" : "del",
        isOp ? "Delete your thread (uses your stored password)" : "Delete your post (uses your stored password)",
        (function (d, ip2) {
          return function () { postingMenu.deleteSinglePost(d.board, d.thread, d.post, null, null, null, ip2); };
        })(ids, inner)));
      info.appendChild(strip);
    }
  }
