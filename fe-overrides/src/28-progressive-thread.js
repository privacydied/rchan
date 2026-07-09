
  /* ==========================================================================
     PROGRESSIVE THREAD RENDERING + SCROLL ANCHORING
     A 500-post thread renders every post at once — the worst experience on the
     site, and it lands on exactly the good threads that grow long. Collapse all
     but the last KEEP replies behind one quiet stub at the top; it only appears
     past THRESHOLD, so short threads (the overwhelming majority) see nothing.
     Revealing the earlier posts inserts content ABOVE the viewport, so it is
     wrapped in a scroll-anchor that compensates scrollTop by the exact height
     change — the reader never feels the page jump. Browser overflow-anchor
     (enabled in ux.css) covers the WS-push / late-image cases the same way.
     ========================================================================== */
  var PROG_KEEP = 80;         // replies kept rendered at the bottom
  var PROG_THRESHOLD = 120;   // only collapse once a thread exceeds this many replies

  // Run fn (which mutates DOM above the fold) with the viewport pinned: the
  // element the reader is looking at stays put, whatever height appears above it.
  function withScrollAnchor(anchorEl, fn) {
    if (!anchorEl) { fn(); return; }
    var before = anchorEl.getBoundingClientRect().top;
    fn();
    var after = anchorEl.getBoundingClientRect().top;
    var delta = after - before;
    if (delta) {
      var prev = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";   // never animate a correction
      window.scrollBy(0, delta);
      document.documentElement.style.scrollBehavior = prev;
    }
  }

  function initProgressiveThread() {
    if (!curThreadId()) { return; }
    var wrap = document.querySelector(".divPosts");
    if (!wrap || wrap.getAttribute("data-prog")) { return; }
    var cells = Array.prototype.slice.call(wrap.querySelectorAll(":scope > .postCell"));
    if (cells.length <= PROG_THRESHOLD) { return; }
    var hidden = cells.slice(0, cells.length - PROG_KEEP);
    if (!hidden.length) { return; }

    // If the URL points at (or the reader has expanded) a post inside the
    // collapsed range, don't collapse at all — they came for that context.
    var hashId = (location.hash || "").replace(/^#/, "");
    if (hashId && /^\d+$/.test(hashId)) {
      for (var h = 0; h < hidden.length; h++) {
        if (hidden[h].id === hashId) { return; }
      }
    }
    wrap.setAttribute("data-prog", "1");

    for (var i = 0; i < hidden.length; i++) {
      hidden[i].style.setProperty("display", "none", "important");
      hidden[i].setAttribute("data-prog-hidden", "1");
    }
    var stub = document.createElement("div");
    stub.className = "rchan-earlier-stub";
    stub.setAttribute("role", "button");
    stub.setAttribute("tabindex", "0");
    var n = hidden.length;
    stub.setAttribute("aria-label", "Show " + n + " earlier posts");
    stub.setAttribute("data-tooltip", "Load the earlier posts in this thread");
    stub.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="18 15 12 9 6 15"/></svg><span>' + n + " earlier post" + (n === 1 ? "" : "s") + "</span>";
    function reveal() {
      if (!stub.parentNode) { return; }
      // anchor on the first still-visible reply so the viewport holds steady
      var anchor = wrap.querySelector(":scope > .postCell:not([data-prog-hidden])");
      withScrollAnchor(anchor, function () {
        for (var j = 0; j < hidden.length; j++) {
          hidden[j].style.removeProperty("display");
          hidden[j].removeAttribute("data-prog-hidden");
        }
        if (stub.parentNode) { stub.parentNode.removeChild(stub); }
      });
    }
    stub.addEventListener("click", reveal);
    stub.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); }
    });
    wrap.insertBefore(stub, wrap.firstChild);
  }
