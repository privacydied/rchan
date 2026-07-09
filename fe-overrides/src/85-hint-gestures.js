  /* ---------- First-visit hint: the features exist — say so, once ----------
     ~15 features live behind ?, g, f, Ctrl+K, long-press and the gear; a
     first-time visitor sees plain Yotsuba and learns none of it. One pill,
     one visit, gone on any keypress/dismiss/20s. */
  function initFirstVisitHint() {
    try {
      if (localStorage.getItem("rchan_hinted")) { return; }
      localStorage.setItem("rchan_hinted", "1");               // one shot, ever
    } catch (e) { return; }
    var pill = document.createElement("div");
    pill.id = "rchan-hint";
    pill.setAttribute("role", "status");
    pill.appendChild(document.createTextNode(TOUCH_ONLY
      ? "Tip: long-press a post for actions · the ⚙ button has all the toggles"
      : "Tip: press ? for shortcuts · Ctrl+K jumps anywhere"));
    var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
    x.textContent = "×"; x.setAttribute("aria-label", "Dismiss tip");
    function hide() { if (pill.parentNode) { pill.parentNode.removeChild(pill); } }
    x.addEventListener("click", hide);
    pill.appendChild(x);
    document.body.appendChild(pill);
    setTimeout(hide, 20000);
    document.addEventListener("keydown", function once() {
      hide(); document.removeEventListener("keydown", once);
    });
  }

  /* ---------- Mobile gestures: swipe, long-press action sheet, pull-to-refresh ----------
     Everything keyboard users get from j/k/e/f lives behind keys a phone
     doesn't have. Three touch-native equivalents:
     - swipe left/right in the gallery steps files (same show()/step() path),
     - long-press a post opens a bottom action sheet (Reply / Conversation /
       Copy link / Report / Hide) — the touch twin of the hover strips,
     - pull-down at the top of a board/catalog page refreshes it (the touch
       twin of the liveness pill). */
  function initGallerySwipe() {
    var sx = 0, sy = 0, st = 0, live = false;
    document.addEventListener("touchstart", function (e) {
      if (!galOpen || e.touches.length !== 1) { live = false; return; }
      var t = e.target;
      if (t && (t.tagName === "VIDEO" || (t.closest && t.closest(".rchan-gal-strip")))) { live = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); live = true;
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!live || !galOpen) { return; }
      live = false;
      // zoomed or mid-pinch: the finger is panning/zooming, not paging
      if (galScale > 1.01 || Date.now() - galLastPinch < 500) { return; }
      var t = e.changedTouches && e.changedTouches[0];
      if (!t || Date.now() - st > 600) { return; }
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 2) { return; }
      galStep(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  // Long-press action sheet
  var sheet = null, lpTimer = null, lpCell = null, lpArmed = false, lpSheetAt = 0, lpReleasedAt = 0;
  function closeSheet() { if (sheet && sheet.style.display === "flex") { sheet.style.display = "none"; dialogClosed(sheet); } }
  function sheetBtn(label, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.addEventListener("click", function () { closeSheet(); fn(); });
    return b;
  }
  function openSheet(cell) {
    var ids = qmodIds(cell);
    var no = postIdOf(cell);
    if (!ids && !no) { return; }
    if (!sheet) {
      sheet = document.createElement("div"); sheet.id = "rchan-sheet";
      sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Post actions");
      sheet.addEventListener("click", function (e) { if (e.target === sheet) { closeSheet(); } });
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = "";
    var box = document.createElement("div"); box.className = "rchan-sheet-box";
    var head = document.createElement("div"); head.className = "rchan-sheet-head";
    head.textContent = "No." + (no || (ids && ids.thread));
    box.appendChild(head);
    var isOp = cell.classList.contains("opCell") || !!cell.querySelector(":scope > .innerOP");
    box.appendChild(sheetBtn("Reply — quote this post", function () {
      var q = window.qr;
      if (q && q.showQr) { q.showQr(no); return; }
      var m = document.querySelector("#qrbody, #fieldMessage, textarea[name=message]");
      if (m) {
        m.value += ">>" + no + "\n";
        m.dispatchEvent(new Event("input", { bubbles: true }));
        m.focus();
      }
    }));
    if (curThreadId()) {
      box.appendChild(sheetBtn("Show this conversation only", function () { openConv(no); }));
      box.appendChild(sheetBtn("Save this thread", function () { saveThreadArchive(); }));
    }
    box.appendChild(sheetBtn("Copy link to post", function () {
      var b2 = getBoard(), t2 = ids ? ids.thread : curThreadId();
      var url = location.origin + "/" + b2 + "/res/" + t2 + ".html#" + no;
      var done = function () { okToast("Link copied"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () { toast(url); });
      } else { toast(url); }
    }));
    if (ids && window.postingMenu && postingMenu.showReport) {
      box.appendChild(sheetBtn("Report this post", function () {
        try { postingMenu.showReport(ids.board, ids.thread, ids.post); } catch (e) {}
      }));
    }
    var innerYou = cell.querySelector(".innerPost, .innerOP");
    if (ids && innerYou && innerYou.classList.contains("rchan-you") &&
        window.postingMenu && postingMenu.deleteSinglePost) {
      box.appendChild(sheetBtn(ids.post ? "Delete my post" : "Delete my thread", function () {
        postingMenu.deleteSinglePost(ids.board, ids.thread, ids.post, null, null, null, innerYou);
      }));
    }
    if (ids && window.hiding && hiding.hidePost && hiding.hideThread) {
      var linkSelf = cell.querySelector(".linkSelf");
      if (linkSelf) {
        box.appendChild(sheetBtn(isOp ? "Hide this thread" : "Hide this post", function () {
          lastHideClick = Date.now();                    // arm the Undo toast wrapper
          try {
            if (isOp) { hiding.hideThread(linkSelf, ids.board, ids.thread); }
            else { hiding.hidePost(linkSelf, ids.board, ids.thread, ids.post); }
          } catch (e) {}
        }));
      }
    }
    var cancel = sheetBtn("Cancel", function () {});
    cancel.className = "rchan-sheet-cancel";
    box.appendChild(cancel);
    sheet.appendChild(box);
    sheet.style.display = "flex";
    dialogOpened(sheet, box.querySelector("button"));
    try { if (navigator.vibrate) { navigator.vibrate(10); } } catch (e) {}
  }
  // Catalog cells are one big link, so the "skip links/images" rule would make
  // them un-pressable — they get their own sheet (Open / Watch / Preview / Copy).
  function openCatalogSheet(cell) {
    var b = getBoard(), tid = catThreadId(cell);
    if (!b || !tid) { return; }
    if (!sheet) {
      sheet = document.createElement("div"); sheet.id = "rchan-sheet";
      sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Thread actions");
      sheet.addEventListener("click", function (e) { if (e.target === sheet) { closeSheet(); } });
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = "";
    var box = document.createElement("div"); box.className = "rchan-sheet-box";
    var head = document.createElement("div"); head.className = "rchan-sheet-head";
    head.textContent = catCellLabel(cell);
    box.appendChild(head);
    var href = (cell.querySelector("a.linkThumb") || {}).href;
    if (href) { box.appendChild(sheetBtn("Open thread", function () { location.href = href; })); }
    box.appendChild(sheetBtn(isWatched(b, String(tid)) ? "Unwatch this thread" : "Watch this thread", function () {
      var btn = cell.querySelector(".rchan-catwatch");
      toggleCatalogWatch(cell, btn);
    }));
    box.appendChild(sheetBtn("Preview last replies", function () { showCatPreviewFor(cell); }));
    box.appendChild(sheetBtn("Copy link", function () {
      var url = location.origin + "/" + b + "/res/" + tid;
      var done = function () { okToast("Link copied"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () { toast(url); });
      } else { toast(url); }
    }));
    var cancel = sheetBtn("Cancel", function () {});
    cancel.className = "rchan-sheet-cancel";
    box.appendChild(cancel);
    sheet.appendChild(box);
    sheet.style.display = "flex";
    dialogOpened(sheet, box.querySelector("button"));
    try { if (navigator.vibrate) { navigator.vibrate(10); } } catch (e) {}
  }
  function initLongPress() {
    if (!TOUCH_ONLY) { return; }
    document.addEventListener("touchstart", function (e) {
      clearTimeout(lpTimer); lpCell = null;
      if (e.touches.length !== 1 || galOpen) { return; }
      var t = e.target;
      if (!t || !t.closest) { return; }
      var cell, isCat = false;
      var catCell = isCatalog() ? t.closest(".catalogCell") : null;
      if (catCell && !t.closest("button, input, textarea, select")) {
        cell = catCell; isCat = true;                  // cards are one big link — allow the press
      } else {
        // pressing media/links/buttons keeps native behaviour (save image, etc.)
        if (t.closest("a, img, video, audio, button, input, textarea, select, .rchan-inline-quote, .quoteTooltip")) { return; }
        cell = t.closest(".postCell, .opCell");
      }
      if (!cell) { return; }
      var x0 = e.touches[0].clientX, y0 = e.touches[0].clientY;
      lpCell = cell;
      lpTimer = setTimeout(function () {
        if (lpCell) {
          lpArmed = true; lpSheetAt = Date.now();
          if (isCat) { openCatalogSheet(lpCell); } else { openSheet(lpCell); }
        }
      }, 500);
      var cancel = function (ev) {
        if (ev.type === "touchmove" && ev.touches.length === 1) {
          var dx = ev.touches[0].clientX - x0, dy = ev.touches[0].clientY - y0;
          if (dx * dx + dy * dy < 100) { return; }       // <10px wobble: still a press
        }
        // the ghost click fires at RELEASE (touchend), which can be long after
        // the 500ms timer — stamp the release so the swallower keys off it
        if (lpArmed && ev.type !== "touchmove") { lpReleasedAt = Date.now(); lpArmed = false; }
        clearTimeout(lpTimer); lpCell = null;
        document.removeEventListener("touchmove", cancel);
        document.removeEventListener("touchend", cancel);
        document.removeEventListener("touchcancel", cancel);
      };
      document.addEventListener("touchmove", cancel, { passive: true });
      document.addEventListener("touchend", cancel, { passive: true });
      document.addEventListener("touchcancel", cancel, { passive: true });
    }, { passive: true });
    // the release that ends a long-press also fires a click — swallow it unless
    // it's a deliberate tap on the sheet's own buttons
    document.addEventListener("click", function (e) {
      if (Date.now() - lpReleasedAt < 500 &&
          !(e.target.closest && e.target.closest(".rchan-sheet-box"))) {
        e.preventDefault(); e.stopPropagation();
      }
    }, true);
    // block the OS context menu around the long-press (Android fires it ~the
    // same moment our timer does; lpArmed covers held-down, the stamp covers release)
    document.addEventListener("contextmenu", function (e) {
      if (lpArmed || Date.now() - lpSheetAt < 1200) { e.preventDefault(); }
    });
  }
  // Pull-to-refresh (board index/catalog; threads live-update over the WS already)
  function initPullRefresh() {
    if (!TOUCH_ONLY) { return; }
    var b = getBoard();
    if (!b || b.charAt(0) === "." || curThreadId()) { return; }
    if (!document.getElementById("divThreads")) { return; }
    document.documentElement.classList.add("rchan-ptr");   // overscroll-behavior: contain
    var startY = 0, pulling = false, dist = 0, ind = null;
    var ARM = 120;                                          // px of pull that triggers a refresh
    function indicator() {
      if (!ind) {
        ind = document.createElement("div"); ind.id = "rchan-ptrind";
        ind.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4l-2.35 2.35z"/></svg><span></span>';
        document.body.appendChild(ind);
      }
      return ind;
    }
    document.addEventListener("touchstart", function (e) {
      pulling = false;
      if (e.touches.length !== 1 || galOpen || (window.scrollY || 0) > 0) { return; }
      startY = e.touches[0].clientY; pulling = true; dist = 0;
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!pulling) { return; }
      dist = e.touches[0].clientY - startY;
      if (dist <= 12 || (window.scrollY || 0) > 0) {
        if (ind) { ind.style.opacity = "0"; }
        return;
      }
      var el = indicator();
      el.style.opacity = String(Math.min(1, dist / ARM));
      el.style.transform = "translate(-50%," + Math.min(dist / 2, 70) + "px)";
      el.classList.toggle("rchan-ptr-armed", dist > ARM);
      el.lastChild.textContent = dist > ARM ? "Release to refresh" : "Pull to refresh";
    }, { passive: true });
    document.addEventListener("touchend", function () {
      if (!pulling) { return; }
      pulling = false;
      if (!ind) { return; }
      if (dist > ARM) {
        ind.lastChild.textContent = "Refreshing…";
        location.reload();
      } else {
        ind.style.opacity = "0"; ind.style.transform = "translate(-50%,0)";
      }
    }, { passive: true });
  }

