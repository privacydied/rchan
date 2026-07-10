  /* ---------- OP header first ----------
     The engine renders the OP as [file panel, header, ipPanel, message] — the
     file-info line and thumbnail land ABOVE the poster/date/No. line. Replies
     are [header, files, message]. Move the OP header above its file panel so
     both shapes read: header row, file-info row, thumb+text. A DOM move (not
     CSS order): the layout is plain block flow + floats, which can't reorder.
     Same-parent relocation of untouched nodes — native JS finds these by
     class/id lookups, not position. */
  function fixOpHeaderOrder(root) {
    var ops = (root || document).querySelectorAll(".innerOP");
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op.__rchanHeadFix) { continue; }
      op.__rchanHeadFix = true;
      var head = op.querySelector(":scope > .opHead");
      var panel = op.querySelector(":scope > .panelUploads, :scope > .opUploadPanel");
      if (head && panel && (panel.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        op.insertBefore(head, panel);
      }
    }
  }

  /* ---------- Icon tooltips (secondaryBar + nav coloredIcons have no labels) ---------- */
  var ICON_TITLES = {
    linkBack: "Return to board index", linkReturn: "Return to board index",
    linkTop: "Go to top", linkBottom: "Go to bottom",
    navCatalog: "Catalog", linkLogs: "Board logs", linkRss: "RSS feed",
    navLinkHome: "Home", navBoardList: "Board list", navOverboard: "Overboard",
    navPosting: "Posting help", linkManagement: "Board management",
    linkModeration: "Moderate this board", navOptions: "Settings",
    linkAccount: "Your account", linkGlobalManagement: "Global management",
    // native modules that auto-inject their icons (watcher/gallery/favourite/side-catalog)
    watcherButton: "Watch this thread", galleryLink: "Gallery view",
    favouriteButton: "Favourite this board", navSideCatalog: "Toggle side catalog",
    closeWatcherMenuButton: "Close", closeSideCatalogButton: "Close side catalog"
  };
  var CLASS_TITLES = {                          // labelled by class (these have no usable id)
    watchButton: "Watch this thread",
    linkQuote: "Reply — quotes this post",      // clicking a post No. opens Quick Reply with >>N
    nameLink: "Open file",                      // words replaced by SVG icons in ux.css
    hideFileButton: "Hide / show this file"
  };
  function humanizeId(id) {
    var s = id.replace(/^(link|nav)/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }
  function iconLabel(el) {
    if (el.id && ICON_TITLES[el.id]) { return ICON_TITLES[el.id]; }
    for (var k in CLASS_TITLES) { if (el.classList && el.classList.contains(k)) { return CLASS_TITLES[k]; } }
    return el.id ? humanizeId(el.id) : "";
  }
  // side-catalog "Refresh" word -> SVG refresh icon (server-rendered button)
  function decorateSideCatalog() {
    var b = document.getElementById("sideCatalogRefreshButton");
    if (!b || b.getAttribute("data-svg")) { return; }
    b.setAttribute("data-svg", "1");
    b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08a6 6 0 1 1-1.41-6.24L13 11h7V4l-2.35 2.35z"/></svg>';
    b.setAttribute("data-tooltip", "Refresh side catalog");
    b.setAttribute("aria-label", "Refresh side catalog");
  }
  function decorateIcons(root) {
    var icons = (root || document).querySelectorAll(".coloredIcon, #favouriteButton, .watchButton, .linkQuote, .nameLink, .hideFileButton");
    for (var i = 0; i < icons.length; i++) {
      var a = icons[i];
      if (a.getAttribute("data-tip")) { continue; }
      a.setAttribute("data-tip", "1");
      var t = iconLabel(a);
      if (!t) { continue; }
      // don't clobber a hand-authored label (e.g. settingsButton's "Settings")
      // with the humanizeId fallback ("Settings Button")
      if (!a.getAttribute("data-tooltip")) { a.setAttribute("data-tooltip", t); }   // styled tooltip source (no native title)
      if (!a.getAttribute("aria-label")) { a.setAttribute("aria-label", t); }
    }
  }

  /* ---------- Reverse image search links on file rows ---------- */
  var RIS_EXT = /\.(jpe?g|png|gif|webp|bmp)(?:$|\?)/i;
  var RIS_SVCS = [
    ["iqdb", "https://iqdb.org/?url="],
    ["sauce", "https://saucenao.com/search.php?url="],
    ["lens", "https://lens.google.com/uploadbyurl?url="],
    ["tineye", "https://tineye.com/search?url="]
  ];
  function decorateFileSearch(root) {
    var links = (root || document).getElementsByClassName("originalNameLink");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-ris")) { continue; }
      a.setAttribute("data-ris", "1");
      var href = a.getAttribute("href") || "";
      if (!RIS_EXT.test(href)) { continue; }               // images only, not video/audio
      var abs = encodeURIComponent(location.origin + href);
      var s = document.createElement("span");
      s.className = "rchan-ris";
      for (var j = 0; j < RIS_SVCS.length; j++) {
        if (j) { s.appendChild(document.createTextNode(" · ")); }
        var l = document.createElement("a");
        l.href = RIS_SVCS[j][1] + abs;
        l.target = "_blank"; l.rel = "noopener noreferrer";
        l.textContent = RIS_SVCS[j][0];
        s.appendChild(l);
      }
      a.parentNode.appendChild(s);                          // lands after the ")" span
    }
  }

  /* ---------- "Filter this image": one-click never-see-again on file rows ----------
     Adds a type-6 (File hash) auto-filter for the file's /.media/ content
     hash — the same image reposted under any filename stays hidden. One
     click, with an Undo on the toast instead of an arming step. */
  var SVG_BLOCK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0 1 20 12c0 4.42-3.58 8-8 8z"/></svg>';
  function rerunFilters() {
    if (window.hiding && hiding.__rchanStub) { try { hiding.checkFilters(); return; } catch (e) {} }
    applyExtraFilters();
  }
  function decorateFileFilterButtons(root) {
    var links = (root || document).getElementsByClassName("originalNameLink");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-fhash")) { continue; }
      a.setAttribute("data-fhash", "1");
      if (a.closest && a.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var hash = mediaHashOf(a.getAttribute("href") || "");
      if (!hash) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-fhash";
      b.innerHTML = SVG_BLOCK;
      b.setAttribute("data-tooltip", "Filter this image — hide it everywhere, any filename");
      b.setAttribute("aria-label", "Filter this image everywhere");
      b.addEventListener("click", (function (h2) {
        return function (e) {
          e.preventDefault(); e.stopPropagation();
          var cur = loadedFilters();
          for (var j = 0; j < cur.length; j++) {
            if (cur[j].type === 6 && !cur[j].regex && cur[j].filter === h2) { okToast("Already filtered"); return; }
          }
          cur.push({ filter: h2, regex: false, type: 6 });
          persistFilters(cur);
          rerunFilters();
          toastAction("Image filtered — matching posts hidden", "Undo", function () {
            persistFilters(loadedFilters().filter(function (f) {
              return !(f.type === 6 && !f.regex && f.filter === h2);
            }));
            rerunFilters();
          });
        };
      })(hash));
      a.parentNode.appendChild(b);
    }
  }

  /* ---------- Click-to-embed external video ----------
     A bare YouTube/Vimeo link in a post is a tab-switch away from the thread.
     Append a small ▶ affordance; on click it swaps in an inline player. Nothing
     auto-loads and NO third-party request is made until the reader asks — so it
     stays private (youtube-nocookie) and clutter-free (one glyph, click to play,
     click to remove). CSP here is script-src 'self' only, so external <iframe>
     frames are permitted. */
  var EMBED_PLAY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  function embedUrlFor(href) {
    try {
      var u = new URL(href, location.href), host = u.hostname.replace(/^www\./, ""), id;
      if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
        if (u.pathname === "/watch") { id = u.searchParams.get("v"); }
        else { var m = u.pathname.match(/^\/(?:shorts|embed|v)\/([\w-]{6,})/); if (m) { id = m[1]; } }
        if (id && /^[\w-]{6,}$/.test(id)) { return "https://www.youtube-nocookie.com/embed/" + id; }
      } else if (host === "youtu.be") {
        id = u.pathname.slice(1).split("/")[0];
        if (id && /^[\w-]{6,}$/.test(id)) { return "https://www.youtube-nocookie.com/embed/" + id; }
      } else if (host === "vimeo.com" || host === "player.vimeo.com") {
        var mm = u.pathname.match(/\/(\d{6,})/);
        if (mm) { return "https://player.vimeo.com/video/" + mm[1]; }
      }
    } catch (e) {}
    return null;
  }
  function decorateEmbeds(root) {
    var links = (root || document).querySelectorAll(".divMessage a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-embed")) { continue; }
      a.setAttribute("data-embed", "1");
      if (a.closest && a.closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var eu = embedUrlFor(a.getAttribute("href") || a.href);
      if (!eu) { continue; }
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "rchan-embed-btn";
      btn.innerHTML = EMBED_PLAY;
      btn.setAttribute("data-tooltip", "Play inline");
      btn.setAttribute("aria-label", "Play this video inline");
      btn.addEventListener("click", (function (url, anchor, b) {
        return function (e) {
          e.preventDefault(); e.stopPropagation();
          if (b.__box) {                                   // toggle closed
            if (b.__box.parentNode) { b.__box.parentNode.removeChild(b.__box); }
            b.__box = null; b.classList.remove("rchan-embed-on");
            return;
          }
          var box = document.createElement("div");
          box.className = "rchan-embed";
          var fr = document.createElement("iframe");
          fr.src = url; fr.loading = "lazy"; fr.allowFullscreen = true;
          fr.setAttribute("allow", "fullscreen; encrypted-media; picture-in-picture");
          fr.setAttribute("referrerpolicy", "no-referrer");
          box.appendChild(fr);
          anchor.parentNode.insertBefore(box, anchor.nextSibling);
          b.__box = box; b.classList.add("rchan-embed-on");
        };
      })(eu, a, btn));
      a.parentNode.insertBefore(btn, a.nextSibling);
    }
  }

  /* ---------- Instant styled tooltip (any element with data-tooltip) ---------- */
  var tip = null;
  function tipTarget(el) {
    while (el && el.getAttribute) {
      if (el.getAttribute("data-tooltip")) { return el; }
      el = el.parentNode;
    }
    return null;
  }
  function showTip(el) {
    if (!tip) { tip = document.createElement("div"); tip.id = "rchan-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.textContent = el.getAttribute("data-tooltip");
    tip.style.display = "block";
    var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = r.left + r.width / 2 - tw / 2;
    var y = r.bottom + 8;                                   // below the icon by default
    if (y + th > window.innerHeight - 4) { y = r.top - th - 8; }  // flip above if no room
    x = Math.max(4, Math.min(x, window.innerWidth - tw - 4));
    tip.style.left = x + "px"; tip.style.top = Math.max(4, y) + "px";
  }
  function hideTip() { if (tip) { tip.style.display = "none"; } }
  function onTipOver(e) { var el = tipTarget(e.target); if (el) { showTip(el); } }
  function onTipOut(e) {
    var el = tipTarget(e.target);
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) { hideTip(); }
  }

