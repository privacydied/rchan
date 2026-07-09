  /* ---------- Dialog focus management: trap Tab inside, restore on close ----------
     Every overlay we ship (gallery, palette, action sheet, image editor,
     settings, history, inbox, cheat-sheet) is a dialog; keyboard users must
     not Tab out into the page behind it, and closing should hand focus back
     to wherever they came from. Click-away closes deliberately DON'T restore
     (the user just placed focus somewhere else). */
  function dlgFocusables(panel) {
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(panel.querySelectorAll(sel), function (el) {
      return el.offsetParent !== null;
    });
  }
  function trapDialog(panel) {
    if (panel.__rchanTrap) { return; }
    panel.__rchanTrap = true;
    panel.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") { return; }
      var f = dlgFocusables(panel);
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === panel)) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && a === last) { first.focus(); e.preventDefault(); }
    });
  }
  function dialogOpened(panel, focusEl) {
    trapDialog(panel);
    panel.__opener = document.activeElement;
    var target = focusEl || dlgFocusables(panel)[0] || panel;
    try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) {} }
  }
  function dialogClosed(panel) {
    if (!panel) { return; }
    var op = panel.__opener;
    panel.__opener = null;
    if (op && document.contains(op)) {
      try { op.focus({ preventScroll: true }); } catch (e) { try { op.focus(); } catch (e2) {} }
    }
  }

  /* ---------- Gallery mode: media-first fullscreen overlay (g) ----------
     The native gallery is desktop-only, image-only and bare (no filmstrip, no
     videos, no way back to the post). This one: current media centered, a
     thumbnail filmstrip along the bottom, ←/→ (and clicks) to step, Home/End,
     Esc closes AND drops you at the post you were looking at. Works on
     thread, index and catalog pages; videos play with the site-wide saved
     volume. Touch swipe rides the same show()/step() machinery. */
  var gal = null, galItems = [], galIdx = 0, galOpen = false, galMedia = null;
  // Zoom state (images only — video keeps native controls untouched)
  var galScale = 1, galPanX = 0, galPanY = 0, galLastPinch = 0, galSlideT = null;
  function galZoomable() { return galMedia && galMedia.tagName === "IMG"; }
  function applyGalTransform() {
    if (!galZoomable()) { return; }
    if (galScale < 1.05) { galScale = 1; galPanX = 0; galPanY = 0; }   // snap back to fit
    galMedia.style.transform = galScale === 1 ? "" :
      "translate(" + Math.round(galPanX) + "px," + Math.round(galPanY) + "px) scale(" + galScale + ")";
    if (gal) { gal.classList.toggle("rchan-gal-zoomed", galScale > 1); }
  }
  function galResetZoom() { galScale = 1; galPanX = 0; galPanY = 0; applyGalTransform(); }
  // zoom toward a screen point (mx,my relative to the stage center)
  function galZoomTo(newScale, mx, my) {
    if (!galZoomable()) { return; }
    newScale = Math.max(1, Math.min(8, newScale));
    var ux = (mx - galPanX) / galScale, uy = (my - galPanY) / galScale;   // content point under the cursor
    galPanX = mx - ux * newScale;
    galPanY = my - uy * newScale;
    galScale = newScale;
    applyGalTransform();
  }
  function galStageCenter() {
    var r = gal.querySelector(".rchan-gal-main").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function toggleSlideshow() {
    var link = gal && gal.querySelector(".rchan-gal-slide");
    if (galSlideT) {
      clearInterval(galSlideT); galSlideT = null;
      if (link) { link.textContent = "slideshow"; }
      return;
    }
    galSlideT = setInterval(function () {
      if (!galOpen) { toggleSlideshow(); return; }
      galShow(galIdx >= galItems.length - 1 ? 0 : galIdx + 1);     // wrap around
    }, 3500);
    if (link) { link.textContent = "⏸ stop"; }
  }
  function initGalleryZoom(main) {
    main.style.touchAction = "none";
    var pointers = {}, pinch = null, pan = null, lastTap = 0;
    function count() { return Object.keys(pointers).length; }
    function two() { var k = Object.keys(pointers); return [pointers[k[0]], pointers[k[1]]]; }
    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy) || 1; }
    main.addEventListener("pointerdown", function (e) {
      if (!galOpen || e.target.tagName === "VIDEO") { return; }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { main.setPointerCapture(e.pointerId); } catch (e2) {}
      if (count() === 2) {
        galLastPinch = Date.now();
        var p = two(), c = galStageCenter();
        pinch = { d: dist(p[0], p[1]), s: galScale,
                  ux: ((p[0].x + p[1].x) / 2 - c.x - galPanX) / galScale,
                  uy: ((p[0].y + p[1].y) / 2 - c.y - galPanY) / galScale };
        pan = null;
      } else if (count() === 1) {
        var now = Date.now();
        if (now - lastTap < 300 && galZoomable()) {                // double-tap: toggle fit ↔ 2.5×
          var c2 = galStageCenter();
          if (galScale > 1.01) { galResetZoom(); }
          else { galZoomTo(2.5, e.clientX - c2.x, e.clientY - c2.y); }
          lastTap = 0;
        } else { lastTap = now; }
        if (galScale > 1.01) { pan = { x: e.clientX, y: e.clientY, px: galPanX, py: galPanY }; }
      }
    });
    main.addEventListener("pointermove", function (e) {
      if (!pointers[e.pointerId]) { return; }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (count() === 2 && pinch) {
        galLastPinch = Date.now();
        var p = two(), c = galStageCenter();
        var s = Math.max(1, Math.min(8, pinch.s * dist(p[0], p[1]) / pinch.d));
        var mx = (p[0].x + p[1].x) / 2 - c.x, my = (p[0].y + p[1].y) / 2 - c.y;
        galScale = s;
        galPanX = mx - pinch.ux * s;                               // pinch midpoint stays put
        galPanY = my - pinch.uy * s;
        gal.__galDrag = Date.now();                                // a drag isn't a backdrop click
        applyGalTransform();
      } else if (pan && galScale > 1.01) {
        galPanX = pan.px + (e.clientX - pan.x);
        galPanY = pan.py + (e.clientY - pan.y);
        if (Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 8) { gal.__galDrag = Date.now(); }
        applyGalTransform();
      }
    });
    function up(e) {
      delete pointers[e.pointerId];
      if (count() < 2) { pinch = null; }
      if (!count()) { pan = null; applyGalTransform(); }           // snap-back check
    }
    main.addEventListener("pointerup", up);
    main.addEventListener("pointercancel", up);
    main.addEventListener("wheel", function (e) {                  // desktop: wheel-zoom at the cursor
      if (!galOpen || !galZoomable()) { return; }
      e.preventDefault();
      var c = galStageCenter();
      galZoomTo(galScale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - c.x, e.clientY - c.y);
    }, { passive: false });
  }
  function galCollect() {
    var items = [], seen = {};
    function push(url, type, thumb, cell, name) {
      if (!url || seen[url]) { return; }
      seen[url] = 1;
      items.push({ url: url, type: type, thumb: thumb, cell: cell, name: name || url.split("/").pop() });
    }
    // NOTE: native thumbs.js rewrites video posts so the imgLink class sits on
    // the THUMB IMG (inside a plain <a href="/.media/x.mp4">), not the anchor —
    // collect both shapes and normalise to the anchor.
    var nodes = document.querySelectorAll("a.imgLink[href], a.linkThumb[href], img.imgLink");
    var links = [];
    for (var n0 = 0; n0 < nodes.length; n0++) {
      var cand = nodes[n0].tagName === "IMG" ? (nodes[n0].closest && nodes[n0].closest("a[href]")) : nodes[n0];
      if (cand && links.indexOf(cand) < 0) { links.push(cand); }
    }
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.closest(".quoteTooltip, .rchan-inline-quote, #rchan-gallery")) { continue; }
      var cell = a.closest(".postCell, .opCell, .catalogCell");
      if (cell && cell.offsetParent === null) { continue; }        // hidden/filtered post
      var img = a.querySelector("img");
      var thumb = img ? img.getAttribute("src") : null;
      var href = a.getAttribute("href") || "";
      var nameEl = null, up = a.closest(".uploadCell");
      if (up) { nameEl = up.querySelector(".originalNameLink"); }
      var nm = nameEl ? nameEl.textContent : null;
      if (isImg(href)) { push(href, "img", thumb, cell, nm); continue; }
      if (VID_RE.test(href)) {                                     // thread/index video (skip audio)
        var box = a.parentNode;
        if (box && box.getElementsByTagName && box.getElementsByTagName("audio").length) { continue; }
        push(href, "video", thumb, cell, nm); continue;
      }
      if (a.classList.contains("linkThumb") && img) {              // catalog: derive from mime + thumb hash
        var full = resolveFull(img, a, href);
        if (full) { push(full, "img", thumb, cell, nm); continue; }
        var vi = videoUrlFor(img);
        if (vi) { push(vi.url, "video", thumb, cell, nm); }
      }
    }
    return items;
  }
  function galStopMedia() {
    if (galMedia && galMedia.tagName === "VIDEO") {
      try { galMedia.pause(); } catch (e) {}
      galMedia.removeAttribute("src"); try { galMedia.load(); } catch (e2) {}
    }
  }
  function galShow(i) {
    if (!galOpen || !galItems.length) { return; }
    galIdx = Math.max(0, Math.min(galItems.length - 1, i));
    var it = galItems[galIdx];
    var main = gal.querySelector(".rchan-gal-main");
    galStopMedia();
    galScale = 1; galPanX = 0; galPanY = 0;                        // each file starts fitted
    if (gal) { gal.classList.remove("rchan-gal-zoomed"); }
    main.innerHTML = "";
    if (it.type === "video") {
      var v = document.createElement("video");
      v.controls = true; v.autoplay = true; v.loop = true; v.playsInline = true;
      v.setAttribute("playsinline", "");
      var sv = loadVol();
      if (sv && typeof sv.v === "number") { try { v.volume = sv.v; v.muted = !!sv.m; } catch (e) {} }
      v.__rchanVol = true;                       // volume persistence hook may now record user changes
      v.src = it.url;
      galMedia = v;
    } else {
      var im = document.createElement("img");
      im.src = it.url; im.alt = it.name;
      galMedia = im;
    }
    main.appendChild(galMedia);
    // preload neighbours (images only — videos buffer on demand); Data Saver opts out
    if (!dataSaver()) {
      [galIdx - 1, galIdx + 1].forEach(function (n) {
        var nx = galItems[n];
        if (nx && nx.type === "img") { var p = new Image(); p.src = nx.url; }
      });
    }
    var meta = gal.querySelector(".rchan-gal-meta");
    meta.firstChild.textContent = (galIdx + 1) + " / " + galItems.length + " · " + it.name;
    // download keeps the ORIGINAL filename (media URLs are content hashes, so
    // right-click → save loses it); open gives the raw file in a new tab
    var dl = meta.querySelector(".rchan-gal-dl");
    if (dl) { dl.href = it.url; dl.setAttribute("download", it.name || ""); }
    var op = meta.querySelector(".rchan-gal-open");
    if (op) { op.href = it.url; }
    // filmstrip: highlight + keep the current thumb in view
    var strips = gal.querySelectorAll(".rchan-gal-thumb");
    for (var s = 0; s < strips.length; s++) {
      strips[s].classList.toggle("rchan-gal-cur", s === galIdx);
    }
    var curThumb = strips[galIdx];
    if (curThumb && curThumb.scrollIntoView) {
      try { curThumb.scrollIntoView({ behavior: SB, block: "nearest", inline: "center" }); } catch (e3) {}
    }
    var pv = gal.querySelector(".rchan-gal-prev"), nb = gal.querySelector(".rchan-gal-next");
    if (pv) { pv.disabled = galIdx === 0; }
    if (nb) { nb.disabled = galIdx === galItems.length - 1; }
  }
  function galStep(dir) { galShow(galIdx + dir); }
  function closeGallery(jump) {
    if (!galOpen) { return; }
    galOpen = false;
    if (galSlideT) { clearInterval(galSlideT); galSlideT = null; }
    var sl = gal && gal.querySelector(".rchan-gal-slide");
    if (sl) { sl.textContent = "slideshow"; }
    galStopMedia();
    if (gal) { gal.style.display = "none"; dialogClosed(gal); }
    document.documentElement.classList.remove("rchan-noscroll");
    var it = galItems[galIdx];
    if (jump && it && it.cell && document.contains(it.cell)) {
      try { it.cell.scrollIntoView({ behavior: SB, block: "center" }); } catch (e) {}
      if (it.cell.classList.contains("postCell") || it.cell.classList.contains("opCell")) { kbSelect(it.cell); }
    }
  }
  function galKeydown(e) {
    if (!galOpen) { return; }
    if (e.key === "Escape") {
      if (galScale > 1.01) { galResetZoom(); }                     // first Esc un-zooms, second closes
      else { closeGallery(true); }
    }
    else if (e.key === "ArrowLeft") { galStep(-1); }
    else if (e.key === "ArrowRight") { galStep(1); }
    else if (e.key === "Home") { galShow(0); }
    else if (e.key === "End") { galShow(galItems.length - 1); }
    else if (e.key === "s" && !typing(e)) { toggleSlideshow(); }
    else if (e.key === "g" && !typing(e)) { closeGallery(false); }
    else { return; }
    e.preventDefault(); e.stopPropagation();
  }
  function buildGallery() {
    if (gal) { return; }
    gal = document.createElement("div");
    gal.id = "rchan-gallery";
    gal.setAttribute("role", "dialog"); gal.setAttribute("aria-label", "Media gallery");
    var main = document.createElement("div"); main.className = "rchan-gal-main";
    // click outside the media (the empty main area) closes, like a lightbox
    // backdrop — but the tail end of a pan/pinch is not a click
    main.addEventListener("click", function (e) {
      if (e.target === main && Date.now() - (gal.__galDrag || 0) > 300) { closeGallery(true); }
    });
    initGalleryZoom(main);
    var meta = document.createElement("div"); meta.className = "rchan-gal-meta";
    meta.appendChild(document.createElement("span"));
    var jump = document.createElement("a"); jump.href = "#"; jump.textContent = "open post";
    jump.addEventListener("click", function (e) { e.preventDefault(); closeGallery(true); });
    meta.appendChild(jump);
    var slide = document.createElement("a"); slide.href = "#"; slide.className = "rchan-gal-slide";
    slide.textContent = "slideshow";
    slide.setAttribute("aria-label", "Toggle slideshow");
    slide.addEventListener("click", function (e) { e.preventDefault(); toggleSlideshow(); });
    meta.appendChild(slide);
    var dl = document.createElement("a"); dl.className = "rchan-gal-dl";
    dl.textContent = "download";
    dl.setAttribute("aria-label", "Download this file with its original name");
    meta.appendChild(dl);
    var op = document.createElement("a"); op.className = "rchan-gal-open";
    op.textContent = "open";
    op.target = "_blank"; op.rel = "noopener noreferrer";
    op.setAttribute("aria-label", "Open the raw file in a new tab");
    meta.appendChild(op);
    var x = document.createElement("button"); x.type = "button"; x.className = "rchan-gal-x";
    x.innerHTML = "✕"; x.setAttribute("aria-label", "Close gallery");
    x.addEventListener("click", function () { closeGallery(false); });
    var prev = document.createElement("button"); prev.type = "button"; prev.className = "rchan-gal-prev";
    prev.innerHTML = "‹"; prev.setAttribute("aria-label", "Previous file");
    prev.addEventListener("click", function () { galStep(-1); });
    var next = document.createElement("button"); next.type = "button"; next.className = "rchan-gal-next";
    next.innerHTML = "›"; next.setAttribute("aria-label", "Next file");
    next.addEventListener("click", function () { galStep(1); });
    var strip = document.createElement("div"); strip.className = "rchan-gal-strip";
    gal.appendChild(main); gal.appendChild(meta); gal.appendChild(strip);
    gal.appendChild(x); gal.appendChild(prev); gal.appendChild(next);
    document.body.appendChild(gal);
    document.addEventListener("keydown", galKeydown, true);       // capture: owns keys while open
  }
  function openGallery(startIdx) {
    galItems = galCollect();
    if (!galItems.length) { toast("No images or videos on this page"); return; }
    buildGallery();
    var strip = gal.querySelector(".rchan-gal-strip");
    strip.innerHTML = "";
    galItems.forEach(function (it, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-gal-thumb";
      b.setAttribute("aria-label", "File " + (i + 1) + ": " + it.name);
      if (it.thumb) {
        var im = document.createElement("img"); im.src = it.thumb; im.alt = ""; im.loading = "lazy";
        b.appendChild(im);
      } else { b.textContent = it.type === "video" ? "▶" : "…"; }
      if (it.type === "video") { b.classList.add("rchan-gal-vid"); }
      b.addEventListener("click", function () { galShow(i); });
      strip.appendChild(b);
    });
    gal.style.display = "flex";
    galOpen = true;
    dialogOpened(gal, gal.querySelector(".rchan-gal-x"));
    document.documentElement.classList.add("rchan-noscroll");
    var start = 0;
    if (typeof startIdx === "number") { start = startIdx; }
    else if (kbCurEl && document.contains(kbCurEl)) {             // start at the selected post's file
      for (var i = 0; i < galItems.length; i++) {
        if (galItems[i].cell === kbCurEl) { start = i; break; }
      }
    }
    galShow(start);
  }
  function toggleGallery() { if (galOpen) { closeGallery(false); } else { openGallery(); } }
  var SVG_GAL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
  function buildGalleryButton() {
    if (document.getElementById("rchan-galbtn")) { return; }
    var nav = document.querySelector("nav, #dynamicHeader");
    if (!nav || !document.querySelector("a.imgLink, a.linkThumb")) { return; }
    var b = document.createElement("button");
    b.type = "button"; b.id = "rchan-galbtn";
    b.innerHTML = SVG_GAL;
    b.setAttribute("data-tooltip", "Gallery mode (g)");
    b.setAttribute("aria-label", "Open the media gallery");
    b.addEventListener("click", function () { toggleGallery(); });
    nav.insertBefore(b, document.getElementById("rchan-expandbtn") || document.getElementById("rchan-findbtn") || document.getElementById("navOptionsSpan") || null);
    // native gallery icon (thread pages, desktop): point it at ours instead
    var natLink = document.getElementById("galleryLink");
    if (natLink) { natLink.onclick = function () { toggleGallery(); return false; }; }
  }

