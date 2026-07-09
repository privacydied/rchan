  /* ---------- init + observe ---------- */
  var pending = false, refreshWhenVisible = false;
  function refresh() {
    if (document.hidden) { refreshWhenVisible = true; return; }    // hidden tabs defer the whole pipeline
    if (pending) { return; }
    pending = true;
    setTimeout(function () { pending = false; applyWarmDark(); decorateYou(document); decorateIcons(document); decorateThumbs(document); bustThumbCache(document); decorateCodeBlocks(document); decorateIdPills(document); decorateFileSearch(document); decorateFileFilterButtons(document); decorateSideCatalog(); decorateCatalogCards(document); decorateCreamDarkCatalog(document); decorateAcademiaChrome(); markNewInThread(); markVisitedInCatalog(); decorateCatalogFlags(); decorateCatalogWatch(document); scanRepliesToYou(); enhancePostForm(); enhanceQuickReply(); initDrafts(); hookQrDraft(); patchShowQr(); tryFlashOwnPost(); updateThreadStat(); tidyWatcherBadge(); applyFind(); applyConv(); decorateConvButtons(document); decorateReportButtons(document); decorateQuickMod(document); decorateGets(document); decorateOwnDelete(document); applyExtraFilters(); syncEmptyState(); buildGalleryButton(); decorateSelectedCells(document); refreshMinimap(); if (expandAllOn) { setExpandAll(true); } }, 80);
  }
  /* The observer used to re-run that ~30-scan pipeline on EVERY childList
     mutation — including our own: each decoration, each status-line rewrite
     (every 30s) re-triggered the full document sweep, and the cost grew with
     every feature and every post. Filter first: a mutation batch that touched
     only rchan-owned nodes (our ids/classes, or anything inside our chrome)
     needs no re-decoration. Foreign changes — a WS post arriving, the engine
     redrawing something — still refresh as before. */
  function isOurNode(n) {
    if (!n) { return true; }
    if (n.nodeType === 3) { return true; }                         // bare text: judged by its target below
    if (n.nodeType !== 1) { return true; }
    if ((n.id || "").indexOf("rchan-") === 0) { return true; }
    var cls = typeof n.className === "string" ? n.className : "";
    return (" " + cls + " ").indexOf(" rchan-") > -1;
  }
  function insideOurChrome(el) {
    while (el && el.nodeType === 1) {
      if ((el.id || "").indexOf("rchan-") === 0) { return true; }
      el = el.parentNode;
    }
    return false;
  }
  function onMutations(muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i], t = m.target;
      if (t && (isOurNode(t) || insideOurChrome(t))) { continue; } // writes into our own chrome
      var foreign = false, j;
      for (j = 0; j < m.addedNodes.length && !foreign; j++) {
        if (!isOurNode(m.addedNodes[j])) { foreign = true; }
      }
      for (j = 0; j < m.removedNodes.length && !foreign; j++) {
        if (!isOurNode(m.removedNodes[j])) { foreign = true; }
      }
      if (!m.addedNodes.length && !m.removedNodes.length) { continue; }
      if (foreign) { refresh(); return; }                          // one foreign change = full pass, as before
    }
  }
  // native watcher renders its unread count as "(3)" text — strip the parens
  // so the CSS badge (#watcherButton span) reads as a clean red counter
  function tidyWatcherBadge() {
    var wc = document.querySelector("#watcherButton span");
    if (wc && wc.textContent.indexOf("(") > -1) { wc.textContent = wc.textContent.replace(/[()]/g, ""); }
  }
  function init() {
    // Bind interaction listeners FIRST, so a throw in any decorate/build step below
    // can never leave hover-zoom / video-pop-out / tooltips unwired.
    document.addEventListener("mouseover", onCatHover, true);
    // catalog last-replies hover preview
    document.addEventListener("mouseover", onCatPrevOver, true);
    document.addEventListener("mouseout", onCatPrevOut, true);
    document.addEventListener("scroll", onScrollMaybeHideCatPrev, true);
    document.addEventListener("click", onCatCellOpen);
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseout", onOut, true);
    // video hover-to-play pop-out preview
    document.addEventListener("mouseover", onVidOver, true);
    document.addEventListener("mouseout", onVidOut, true);
    // clicking a thumb expands it in place (thumb swapped out under a stationary cursor,
    // so no fresh mouseover fires) — drop the floating previews so they never stick.
    document.addEventListener("click", hideZoom, true);
    document.addEventListener("click", hideVidZoom, true);
    // inline quote expansion (click a >>quote) + touch catalog tap-preview
    document.addEventListener("click", onQuoteClick, true);
    document.addEventListener("click", onCatTap, true);
    // instant styled tooltips for [data-tooltip] icons
    document.addEventListener("mouseover", onTipOver, true);
    document.addEventListener("mouseout", onTipOut, true);
    document.addEventListener("focusin", onTipOver, true);
    document.addEventListener("focusout", hideTip, true);
    document.addEventListener("scroll", hideTip, true);
    document.addEventListener("click", hideTip, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("keydown", onPaletteKey, true);   // Ctrl/Cmd+K, even while typing
    document.addEventListener("keydown", onSubmitKey);          // Ctrl/Cmd+Enter submits the reply
    // arm the WebAudio context inside a real user gesture so later chimes can play
    document.addEventListener("pointerdown", armAudio, { once: true, capture: true });
    document.addEventListener("keydown", armAudio, { once: true, capture: true });
    // (You) inbox: other tabs' scans update our badge; returning to a thread reads it
    window.addEventListener("storage", function (e) {
      if (e.key === YOUBOX_KEY) { updateYouboxBadge(); }
    });
    document.addEventListener("visibilitychange", function () {
      var b = getBoard(), t = curThreadId();
      if (!document.hidden && b && t) { youboxMarkThreadRead(b, t); }
    });
    // remember hide-menu clicks so hookHideUndo can tell user hides from
    // the silent stored-hide re-application at load/refresh
    document.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".hideMenu")) { lastHideClick = Date.now(); }
    }, true);
    // keep the pre-paint dark hint (html.predark, set by an inline head script the
    // router injects) in sync when the user switches themes mid-session
    try { if (!/theme_dark/.test(document.body.className)) { document.documentElement.classList.remove("predark"); } } catch (e) {}
    document.addEventListener("change", function (e) {
      if (e.target && e.target.id === "themeSelector") {
        try { document.documentElement.classList.toggle("predark", localStorage.selectedTheme === "dark"); } catch (e2) {}
      }
    });
    // Enhancers — each guarded so one failure can't cascade and kill the rest (or the listeners above).
    [applyWarmDark, buildNav, ensureNavSettings, buildCatalogTools, hookDeepSearch, function () { decorateIcons(document); }, function () { decorateThumbs(document); }, function () { bustThumbCache(document); }, function () { decorateCodeBlocks(document); },
     function () { decorateYou(document); }, function () { decorateCatalogCards(document); }, function () { decorateCreamDarkCatalog(document); }, decorateAcademiaChrome, initInfiniteScroll, initCatalogInfiniteScroll, markNewInThread, markNewInCatalog, markVisitedInCatalog, function () { decorateCatalogWatch(document); }, scanRepliesToYou, enhancePostForm, enhanceQuickReply,
     hookAlerts, hookCaptchaReload, initCaptchaLifecycle, hookFilterStubs, hookHideUndo, hookWatcherThrottle, hookWatcherNotify, hookYouboxScan, updateYouboxBadge, hookFilePrivacy, initDrafts, hookQrDraft, patchShowQr, enableRelativeTimes, recordVisit, initScrollResume, initPresence, initSitePresence, initThreadFlags, initWsHealth, initStickyOp, initMinimap, initBoardLiveness, hookVolumePersistence,
     function () { decorateIdPills(document); }, function () { decorateFileSearch(document); }, function () { decorateFileFilterButtons(document); }, decorateSideCatalog, updateThreadStat, buildFindButton, buildExpandButton, buildGalleryButton, buildBanner, syncEmptyState, applyBoardAccent,
     function () { decorateConvButtons(document); }, function () { decorateReportButtons(document); },
     function () { decorateGets(document); }, function () { decorateOwnDelete(document); }, buildYourThreads, buildActiveThreads,
     initGallerySwipe, initLongPress, initPullRefresh, initAutoTheme, applyCustomCss, applyWorkSafe, applyTextSize, initFirstVisitHint, initBackupNudge, pruneOnceStamps
    ].forEach(function (fn) { try { fn(); } catch (e) { if (window.console) { console.error("[ux] init step failed", e); } } });
    if (curThreadId()) { setInterval(function () { try { updateThreadStat(); } catch (e) {} }, 30000); }  // keep "updated X ago" ticking
    document.addEventListener("visibilitychange", function () {   // catch up on what happened while hidden
      if (!document.hidden && refreshWhenVisible) { refreshWhenVisible = false; refresh(); }
    });
    try { new MutationObserver(onMutations).observe(document.documentElement, { subtree: true, childList: true }); } catch (e) {}
  }
  // PWA: register the (cache-free) service worker so the site is installable.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/.rchan/sw.js", { scope: "/" }).catch(function () {});
    });
  }

  hookPostCapture(); // wrap request APIs early, before any post is sent
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
