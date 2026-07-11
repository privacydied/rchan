  /* ---------- Auto-filters: filename rules, stubs, recursive hiding ----------
     Extends the NATIVE filter machinery (settingsMenu.loadedFilters /
     localStorage.filterData, applied by hiding.js) rather than duplicating it:
     - a manager UI lives in the rchan settings panel (add/remove, regex),
     - new type 5 = Filename (native's switch ignores unknown types safely),
     - filtered posts leave a one-line stub with a session [show] instead of
       vanishing without a trace,
     - replies that quote a filtered/hidden post collapse too (toggleable). */
  var FILTER_TYPE_NAMES = ["Name", "Tripcode", "Subject", "Message", "ID", "Filename", "File hash"];
  // /.media/<hash>.<ext> (files) and /.media/t_<hash> (thumbs) share the content hash
  var MEDIA_HASH_RE = /\/\.media\/(?:t_)?([a-z0-9]{6,})(?:\.[a-z0-9]+)?(?:[?#]|$)/i;
  function mediaHashOf(s) {
    var m = (s || "").match(MEDIA_HASH_RE);
    return m ? m[1].toLowerCase() : null;
  }
  function cellMediaHashes(cell) {
    var inner = cell.querySelector(".innerPost, .innerOP") || cell;
    var out = {}, els = inner.querySelectorAll('a[href*="/.media/"], img[src*="/.media/"]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].closest && els[i].closest(".quoteTooltip, .rchan-inline-quote")) { continue; }
      var h = mediaHashOf(els[i].getAttribute("href") || els[i].getAttribute("src"));
      if (h) { out[h] = 1; }
    }
    return Object.keys(out);
  }
  function loadedFilters() {
    try {
      if (window.settingsMenu && settingsMenu.loadedFilters) { return settingsMenu.loadedFilters; }
      return JSON.parse(localStorage.filterData || "[]");
    } catch (e) { return []; }
  }
  function persistFilters(arr) {
    try { localStorage.filterData = JSON.stringify(arr); } catch (e) {}
    if (window.settingsMenu) { settingsMenu.loadedFilters = arr; }
  }
  function fMatch(s, f) {
    if (f.regex) { try { return new RegExp(f.filter).test(s); } catch (e) { return false; } }
    return s.indexOf(f.filter) >= 0;
  }
  function cellHidden(cell) {
    return cell.style.display === "none" || (cell.classList && cell.classList.contains("hidden"));
  }
  function addFilterStub(cell, label) {
    if (cell.__stub && cell.__stub.parentNode) { return; }
    var no = postIdOf(cell);
    var s = document.createElement("div");
    s.className = "rchan-filterstub";
    var txt = document.createElement("span");
    txt.textContent = label + (no ? " No." + no : "");
    var show = document.createElement("a"); show.href = "#"; show.textContent = "show";
    show.addEventListener("click", function (e) {
      e.preventDefault();
      cell.style.display = "";
      if (cell.classList) { cell.classList.remove("hidden"); }
      cell.__rchanShown = true;                       // don't re-hide this session
      if (s.parentNode) { s.parentNode.removeChild(s); }
    });
    s.appendChild(txt); s.appendChild(document.createTextNode(" — ")); s.appendChild(show);
    cell.parentNode.insertBefore(s, cell);
    cell.__stub = s;
  }
  function applyExtraFilters() {
    var cells = document.querySelectorAll(".postCell, .opCell");
    var all = loadedFilters();
    var fileFilters = all.filter(function (f) { return f.type === 5; });
    // mediaHashOf() always lowercases the extracted hash (hashes are
    // case-insensitive hex), but a user-entered plain-value filter pattern
    // was stored verbatim -- pasting an uppercase hash silently never
    // matched anything, with no error shown anywhere. Normalize non-regex
    // patterns here (regex patterns are left as-authored: case-sensitivity
    // there is the user's own explicit choice, not this bug).
    var hashFilters = all.filter(function (f) { return f.type === 6; })
      .map(function (f) { return f.regex ? f : { type: f.type, filter: String(f.filter || "").toLowerCase(), regex: f.regex }; });
    var i, cell, k;
    for (i = 0; i < cells.length; i++) {              // filename rules
      cell = cells[i];
      if (cell.__rchanShown || cellHidden(cell) || !fileFilters.length) { continue; }
      var inner = cell.querySelector(".innerPost, .innerOP") || cell;
      var names = inner.querySelectorAll(".originalNameLink");
      for (var n = 0; n < names.length && !cellHidden(cell); n++) {
        var fname = names[n].textContent || "";
        for (k = 0; k < fileFilters.length; k++) {
          if (fMatch(fname, fileFilters[k])) {
            cell.style.display = "none"; cell.__xhide = true;
            addFilterStub(cell, "Filtered file");
            break;
          }
        }
      }
    }
    for (i = 0; i < cells.length; i++) {              // file-hash rules
      cell = cells[i];
      if (cell.__rchanShown || cellHidden(cell) || !hashFilters.length) { continue; }
      var hashes = cellMediaHashes(cell);
      for (var h = 0; h < hashes.length && !cellHidden(cell); h++) {
        for (k = 0; k < hashFilters.length; k++) {
          if (fMatch(hashes[h], hashFilters[k])) {
            cell.style.display = "none"; cell.__xhide = true;
            addFilterStub(cell, "Filtered image");
            break;
          }
        }
      }
    }
    if (!setOn("filterrecurse")) { return; }
    var passes = 0, changed = true;
    while (changed && passes++ < 10) {                // chase quote chains
      changed = false;
      var hiddenIds = {};
      for (i = 0; i < cells.length; i++) {
        if (cellHidden(cells[i])) { var hid = postIdOf(cells[i]); if (hid) { hiddenIds[hid] = 1; } }
      }
      for (i = 0; i < cells.length; i++) {
        cell = cells[i];
        if (cell.__rchanShown || cellHidden(cell) || !cell.classList.contains("postCell")) { continue; }
        var inn = cell.querySelector(".innerPost") || cell;
        var qs = inn.getElementsByClassName("quoteLink");
        for (var q = 0; q < qs.length; q++) {
          if (qs[q].closest && qs[q].closest(".rchan-inline-quote")) { continue; }
          var m = (qs[q].getAttribute("href") || "").match(/(\d+)\s*$/);
          if (m && hiddenIds[m[1]]) {
            cell.style.display = "none"; cell.__xhide = true;
            addFilterStub(cell, "Reply to a filtered post");
            changed = true;
            break;
          }
        }
      }
    }
  }
  /* ---------- Undo on hide: "Post hidden — Undo" toast ----------
     hiding.js makes content vanish with only a tiny [Unhide] stub. Wrap
     hidePost/hideThread so USER-initiated hides (a click inside the hide
     menu within the last second — the same functions also re-apply stored
     hides at load/refresh, which must stay silent) get an undo toast that
     clicks the native unhide button. */
  var lastHideClick = 0;
  function hookHideUndo() {
    var h = window.hiding;
    if (!h || h.__rchanUndo || !h.hidePost || !h.hideThread) { return; }
    h.__rchanUndo = true;
    function wrap(orig, isThread) {
      return function (linkSelf) {
        var r = orig.apply(this, arguments);
        try {
          if (Date.now() - lastHideClick < 1000) {
            lastHideClick = 0;
            // native inserts its [Unhide] span right before the hidden element
            var hiddenEl = isThread ? linkSelf.parentNode.parentNode.parentNode
                                    : linkSelf.parentNode.parentNode;
            var btn = hiddenEl.previousSibling;
            if (btn && btn.className && String(btn.className).indexOf("unhideButton") > -1) {
              toastAction(isThread ? "Thread hidden" : "Post hidden", "Undo", function () { btn.click(); });
            }
          }
        } catch (e) {}
        return r;
      };
    }
    h.hidePost = wrap(h.hidePost, false);
    h.hideThread = wrap(h.hideThread, true);
  }

  function hookFilterStubs() {
    var h = window.hiding;
    if (!h || !h.hideForFilter || h.__rchanStub) { return; }
    h.__rchanStub = true;
    var origHide = h.hideForFilter;
    h.hideForFilter = function (linkSelf) {
      var r = origHide.apply(this, arguments);
      try { addFilterStub(linkSelf.parentNode.parentNode.parentNode, "Filtered post"); } catch (e) {}
      return r;
    };
    var origCheck = h.checkFilters;
    h.checkFilters = function () {
      var stubs = document.getElementsByClassName("rchan-filterstub");   // full re-evaluation: reset stubs
      for (var i = stubs.length - 1; i >= 0; i--) { stubs[i].parentNode.removeChild(stubs[i]); }
      var cells = document.querySelectorAll(".postCell, .opCell");       // and our own hides
      for (var j = 0; j < cells.length; j++) {
        if (cells[j].__xhide) { cells[j].style.display = ""; delete cells[j].__xhide; }
      }
      var r = origCheck.apply(this, arguments);
      applyExtraFilters();
      return r;
    };
    // initial page load already ran the native pass before we wrapped: redo it with stubs
    setTimeout(function () { try { h.checkFilters(); } catch (e) {} }, 0);
  }
  // Filter manager (rendered inside the settings panel)
  function buildFilterSection(box) {
    box.innerHTML = "";
    var head = document.createElement("div"); head.className = "rchan-set-sub";
    head.textContent = "Auto-filters";
    box.appendChild(head);
    var arr = loadedFilters();
    if (!arr.length) {
      var none = document.createElement("div"); none.className = "rchan-set-desc rchan-filter-none";
      none.textContent = "No filters yet — matching posts collapse to a one-line stub.";
      box.appendChild(none);
    }
    arr.forEach(function (f) {
      var row = document.createElement("div"); row.className = "rchan-filter-row";
      var ty = document.createElement("span"); ty.className = "rchan-filter-type";
      ty.textContent = FILTER_TYPE_NAMES[f.type] || ("Type " + f.type);
      var pat = document.createElement("span"); pat.className = "rchan-filter-pat";
      pat.textContent = f.regex ? ("/" + f.filter + "/") : f.filter;
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-hist-x";
      x.textContent = "×"; x.title = "Remove filter"; x.setAttribute("aria-label", "Remove filter");
      x.addEventListener("click", function () {
        var cur = loadedFilters();
        var idx = cur.indexOf(f);
        if (idx < 0) {                                 // panel re-opened: match by value
          for (var i2 = 0; i2 < cur.length; i2++) {
            if (cur[i2].filter === f.filter && cur[i2].type === f.type && !cur[i2].regex === !f.regex) { idx = i2; break; }
          }
        }
        if (idx > -1) { cur.splice(idx, 1); persistFilters(cur); }
        if (window.hiding && hiding.__rchanStub) { hiding.checkFilters(); } else { applyExtraFilters(); }
        buildFilterSection(box);
      });
      row.appendChild(ty); row.appendChild(pat); row.appendChild(x);
      box.appendChild(row);
    });
    var form = document.createElement("div"); form.className = "rchan-filter-form";
    var sel = document.createElement("select");
    FILTER_TYPE_NAMES.forEach(function (nm, i3) {
      var o = document.createElement("option"); o.value = i3; o.textContent = nm; sel.appendChild(o);
    });
    sel.value = "3";                                   // Message: the common case
    var inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "pattern";
    inp.setAttribute("aria-label", "Filter pattern");
    var reLab = document.createElement("label"); reLab.className = "rchan-filter-relab";
    var re = document.createElement("input"); re.type = "checkbox";
    reLab.appendChild(re); reLab.appendChild(document.createTextNode("regex"));
    var add = document.createElement("button"); add.type = "button"; add.textContent = "Add";
    function doAdd() {
      var v = inp.value.trim();
      if (!v) { return; }
      if (re.checked) { try { new RegExp(v); } catch (e) { toast("Invalid regex", true); return; } }
      var cur = loadedFilters();
      cur.push({ filter: v, regex: re.checked, type: parseInt(sel.value, 10) });
      persistFilters(cur);
      inp.value = "";
      if (window.hiding && hiding.__rchanStub) { hiding.checkFilters(); } else { applyExtraFilters(); }
      buildFilterSection(box);
    }
    add.addEventListener("click", doAdd);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { doAdd(); } });
    form.appendChild(sel); form.appendChild(inp); form.appendChild(reLab); form.appendChild(add);
    box.appendChild(form);
  }

