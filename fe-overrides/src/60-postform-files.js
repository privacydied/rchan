  /* ---------- Homepage: "Your threads" strip ----------
     The front page showed global activity but nothing personal — your watched
     threads with unread replies and your inbox count were sitting in
     localStorage the whole time. Chips: inbox first (opens the panel),
     unread watched threads next (green dot), then the rest by recency. */
  // The user's watched/inbox state lives in localStorage under the BOARD origin.
  // When this same page is served at the apex (rchan.xyz) it's a different origin
  // with empty storage, so read the board origin's storage through a tiny broker
  // page loaded in a hidden iframe (postMessage). On the board origin itself it's
  // a direct synchronous read. Whitelisted, read-only — see the bridge in nginx.
  var BOARDS_ORIGIN = "https://boards.rchan.xyz";
  function onBoardsOrigin() { return location.origin === BOARDS_ORIGIN; }
  function boardsStorage(keys, cb) {
    if (onBoardsOrigin()) {
      var v = {};
      keys.forEach(function (k) { try { v[k] = localStorage.getItem(k); } catch (e) {} });
      cb(v); return;
    }
    var frame = document.createElement("iframe");
    frame.style.display = "none"; frame.setAttribute("aria-hidden", "true");
    frame.src = BOARDS_ORIGIN + "/.rchan/bridge.html";
    var done = false, timer = null;
    function finish(values) {
      if (done) { return; }
      done = true; clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      if (frame.parentNode) { frame.parentNode.removeChild(frame); }
      cb(values);
    }
    function onMsg(e) {
      if (e.origin !== BOARDS_ORIGIN || !e.data || e.data.__rchanBridge !== 1 || !e.data.values) { return; }
      finish(e.data.values);
    }
    window.addEventListener("message", onMsg);
    frame.addEventListener("load", function () {
      try { frame.contentWindow.postMessage({ __rchanBridge: 1, req: keys }, BOARDS_ORIGIN); } catch (e) {}
    });
    timer = setTimeout(function () { finish({}); }, 4000);
    document.body.appendChild(frame);
  }
  function renderYourThreads(watchedRaw, youboxRaw) {
    if (document.getElementById("rchan-yours")) { return; }
    var base = onBoardsOrigin() ? "" : BOARDS_ORIGIN;   // apex chips point at the board host
    var entries = [];
    try {
      var wd = JSON.parse(watchedRaw || "{}");
      Object.keys(wd).forEach(function (b) {
        Object.keys(wd[b] || {}).forEach(function (t) {
          var rec = wd[b][t] || {};
          entries.push({ b: b, t: t, label: rec.label,
                         unread: (rec.lastReplied || 0) > (rec.lastSeen || 0),
                         ts: rec.lastReplied || 0 });
        });
      });
    } catch (e) {}
    var inboxN = 0;
    try {
      var yb = JSON.parse(youboxRaw || "{}");
      Object.keys(yb).forEach(function (k) { if (yb[k] && !yb[k].r) { inboxN++; } });
    } catch (e2) {}
    if (!entries.length && !inboxN) { return; }
    entries.sort(function (a, b) { return (b.unread - a.unread) || (b.ts - a.ts); });
    entries = entries.slice(0, 8);
    var box = document.createElement("div"); box.id = "rchan-yours";
    var head = document.createElement("div"); head.id = "rchan-yours-head";
    head.textContent = "Your threads";
    box.appendChild(head);
    var wrap = document.createElement("div"); wrap.className = "rchan-yours-chips";
    if (inboxN) {
      var ibText = "✉ " + inboxN + " repl" + (inboxN > 1 ? "ies" : "y") + " to you";
      if (onBoardsOrigin()) {                          // local inbox panel is available here
        var ib = document.createElement("button");
        ib.type = "button"; ib.className = "rchan-yours-chip rchan-yours-unread";
        ib.textContent = ibText;
        ib.addEventListener("click", toggleYoubox);
        wrap.appendChild(ib);
      } else {                                         // apex: the inbox lives on the board host
        var iba = document.createElement("a");
        iba.className = "rchan-yours-chip rchan-yours-unread";
        iba.href = base + "/"; iba.textContent = ibText;
        wrap.appendChild(iba);
      }
    }
    var unesc = document.createElement("textarea");    // labels were escHtml'd at write time
    entries.forEach(function (e) {
      var a = document.createElement("a");
      a.className = "rchan-yours-chip" + (e.unread ? " rchan-yours-unread" : "");
      a.href = base + "/" + e.b + "/res/" + e.t;
      unesc.innerHTML = e.label || "";
      a.textContent = (e.unread ? "● " : "") + "/" + e.b + "/ · " + (unesc.value || ("Thread " + e.t));
      wrap.appendChild(a);
    });
    box.appendChild(wrap);
    var anchor = document.getElementById("divBoards");
    if (anchor) { anchor.parentNode.insertBefore(box, anchor); }
  }
  function buildYourThreads() {
    if (!/^\/(index\.html)?$/.test(location.pathname)) { return; }
    if (document.getElementById("rchan-yours") || buildYourThreads.__done) { return; }
    buildYourThreads.__done = true;                    // async on the apex — build once
    boardsStorage(["watchedData", YOUBOX_KEY], function (v) {
      renderYourThreads(v.watchedData, v[YOUBOX_KEY]);
    });
  }

  /* ---------- Homepage: "Active threads" strip ----------
     Top threads by last bump across boards (boards list -> one catalog.json
     each, capped at 8 boards), rendered as cards under the board list. Makes
     the front page a destination instead of a signpost. */
  function buildActiveThreads() {
    if (!/^\/(index\.html)?$/.test(location.pathname)) { return; }
    var anchor = document.getElementById("divBoards");
    if (!anchor || document.getElementById("rchan-active")) { return; }
    fetch("/boards.js?json=1").then(function (r) { return r.json(); }).then(function (res) {
      var boards = ((res && res.data && res.data.boards) || []).slice(0, 8)
        .map(function (b) { return b.boardUri; });
      if (!boards.length) { return; }
      Promise.all(boards.map(function (b) {
        return fetch("/" + b + "/catalog.json").then(function (r) { return r.json(); })
          .then(function (list) { return (list || []).map(function (t) { t.__b = b; return t; }); })
          .catch(function () { return []; });
      })).then(function (all) {
        var threads = Array.prototype.concat.apply([], all).sort(function (a, b2) {
          return (Date.parse(b2.lastBump) || 0) - (Date.parse(a.lastBump) || 0);
        }).slice(0, 6);
        if (!threads.length || document.getElementById("rchan-active")) { return; }
        var box = document.createElement("div"); box.id = "rchan-active";
        var head = document.createElement("div"); head.id = "rchan-active-head";
        head.textContent = "Active threads";
        box.appendChild(head);
        threads.forEach(function (t) {
          var a = document.createElement("a");
          a.className = "rchan-active-cell";
          a.href = "/" + t.__b + "/res/" + t.threadId;
          if (t.thumb) {
            var im = document.createElement("img");
            im.src = t.thumb; im.loading = "lazy"; im.alt = "";
            a.appendChild(im);
          }
          var txt = document.createElement("span"); txt.className = "rchan-active-text";
          var ttl = document.createElement("span"); ttl.className = "rchan-active-title";
          var label = (t.subject || t.message || ("Thread " + t.threadId)).replace(/\s+/g, " ").trim();
          ttl.textContent = "/" + t.__b + "/ · " + label.slice(0, 60);
          var meta = document.createElement("span"); meta.className = "rchan-active-meta";
          var bump = Date.parse(t.lastBump) || 0;
          meta.setAttribute("data-ts", bump);
          meta.setAttribute("data-r", t.postCount || 0);
          meta.textContent = (t.postCount || 0) + " replies" + (bump ? " · " + fmtAgo(bump) + " ago" : "");
          txt.appendChild(ttl); txt.appendChild(meta); a.appendChild(txt);
          box.appendChild(a);
        });
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
        setInterval(function () {                        // live time-ago ticker
          var metas = box.getElementsByClassName("rchan-active-meta");
          for (var i = 0; i < metas.length; i++) {
            var ts = parseInt(metas[i].getAttribute("data-ts"), 10);
            if (ts) { metas[i].textContent = metas[i].getAttribute("data-r") + " replies · " + fmtAgo(ts) + " ago"; }
          }
        }, 30000);
      });
    }).catch(function () {});
  }

  /* ---------- Post form: formatting toolbar, char counter, paste/drop, file previews ----------
     IMPORTANT: the engine uploads ONLY from postCommon.selectedFiles (its own
     array, rendered as .selectedCell chips) — it never reads input.files at
     submit, and its picker even wipes #inputFiles after consuming it. So every
     paste/drop we accept MUST go through postCommon.addSelectedFile; the
     DataTransfer/input.files path below is only a fallback for pages where
     postCommon isn't wired (it previously ATE dropped files silently). */
  var MAX_FILE = 32 * 1048576;   // maxFileSizeMB
  function nativeFilePipe() {
    return !!(window.postCommon && postCommon.addSelectedFile && postCommon.selectedDiv);
  }
  function engineAddFiles(files) {  // -> true when the engine's pipeline took them
    if (!nativeFilePipe()) { return false; }
    for (var i = 0; i < files.length; i++) {
      try { postCommon.addSelectedFile(files[i]); } catch (e) { return false; }
    }
    return true;
  }
  function collectPastedFiles(e) {
    var items = e.clipboardData && e.clipboardData.items, add = [];
    if (!items) { return add; }
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file") { var f = items[i].getAsFile(); if (f) { add.push(f); } }
    }
    return add;
  }
  function bytesHuman(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : n + " B"; }
  function mimeOk(input, file) {
    var acc = (input.getAttribute("accept") || "").toLowerCase().split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!acc.length) { return true; }
    var mime = (file.type || "").toLowerCase();
    return acc.some(function (a) { return a.slice(-2) === "/*" ? mime.indexOf(a.slice(0, -1)) === 0 : a === mime; });
  }
  function currentFiles(input) { return input.files ? Array.prototype.slice.call(input.files) : []; }
  function setFiles(input, arr) {
    try { var dt = new DataTransfer(); arr.forEach(function (f) { dt.items.add(f); }); input.files = dt.files; return true; }
    catch (e) { return false; }   // unsupported browser: leave as-is
  }
  function addFiles(input, files) { setFiles(input, currentFiles(input).concat(files)); renderTray(input); }
  function renderTray(input) {
    var tray = document.getElementById("rchan-filetray"); if (!tray) { return; }
    tray.innerHTML = "";
    currentFiles(input).forEach(function (f, idx) {
      var chip = document.createElement("div"); chip.className = "rchan-filechip";
      if (!(mimeOk(input, f) && f.size <= MAX_FILE)) { chip.classList.add("rchan-filebad"); chip.title = "Unsupported type or over 32 MB"; }
      if (/^image\//.test(f.type)) {
        var im = document.createElement("img"); im.src = URL.createObjectURL(f);
        im.onload = function () { URL.revokeObjectURL(im.src); }; chip.appendChild(im);
      }
      var meta = document.createElement("span"); meta.className = "rchan-filemeta";
      meta.textContent = f.name + " · " + bytesHuman(f.size); chip.appendChild(meta);
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-filex"; x.textContent = "×"; x.title = "Remove";
      x.addEventListener("click", function (ev) { ev.preventDefault(); var a = currentFiles(input); a.splice(idx, 1); setFiles(input, a); renderTray(input); });
      chip.appendChild(x); tray.appendChild(chip);
    });
  }
  /* ---------- File privacy: EXIF strip + filename anonymize + rotate/crop ----------
     Every upload funnels through postCommon.addSelectedFile (picker, drop,
     paste) — wrap it once:
     - "Strip image metadata" (default ON): decode → canvas → re-encode, so
       EXIF/GPS never leaves the device. JPEG/PNG/WebP only (a canvas pass
       would flatten GIF animation); browsers bake EXIF orientation in while
       drawing, so stripped photos can't render sideways.
     - "Anonymize filenames" (opt-in): timestamp names, 4chan-style.
     - Each selected-file chip gets a ✎ that opens a rotate/crop editor;
       Apply removes the old file through the chip's own native remove
       button and re-adds the edited one, so main form + QR clones stay
       in sync via the engine's own rendering. */
  var STRIP_TYPES = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 };
  var TYPE_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
                   "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/ogg": "ogg", "application/pdf": "pdf" };
  function anonName(file) {
    var ext = TYPE_EXT[(file.type || "").toLowerCase()] ||
              ((file.name || "").match(/\.([a-z0-9]{1,5})$/i) || [])[1] || "bin";
    return String(Date.now()) + String(Math.floor(Math.random() * 900) + 100) + "." + ext.toLowerCase();
  }
  function loadBitmap(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("decode failed")); };
      img.src = url;
    });
  }
  function reencodeImage(file) {                          // -> Promise<File> with metadata gone
    return loadBitmap(file).then(function (b) {
      return new Promise(function (res, rej) {
        try {
          var w = b.img.naturalWidth, h = b.img.naturalHeight;
          if (!w || !h || w * h > 50e6) { URL.revokeObjectURL(b.url); rej(new Error("too large")); return; }
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(b.img, 0, 0);
          URL.revokeObjectURL(b.url);
          c.toBlob(function (blob) {
            if (!blob || blob.size > MAX_FILE) { rej(new Error("encode failed")); return; }
            res(new File([blob], file.name, { type: file.type }));
          }, file.type, file.type === "image/jpeg" ? 0.92 : undefined);
        } catch (e) { URL.revokeObjectURL(b.url); rej(e); }
      });
    });
  }
  // Duplicate guard: the /.media/<hash> URLs in the thread ARE sha256 hashes
  // (the engine dedups uploads by that digest) — hash the file we're about to
  // attach and warn if the thread already has it. Advisory only; posting a
  // dupe on purpose stays possible.
  function threadMediaHashes() {
    var set = {}, els = document.querySelectorAll('a[href*="/.media/"], img[src*="/.media/"]');
    for (var i = 0; i < els.length; i++) {
      var h = mediaHashOf(els[i].getAttribute("href") || els[i].getAttribute("src"));
      if (h) { set[h] = 1; }
    }
    return set;
  }
  function warnIfDuplicate(file) {
    if (!curThreadId() || !file || !window.crypto || !crypto.subtle ||
        typeof file.arrayBuffer !== "function") { return; }
    file.arrayBuffer().then(function (buf) {
      return crypto.subtle.digest("SHA-256", buf);
    }).then(function (hb) {
      var hex = Array.prototype.map.call(new Uint8Array(hb), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      if (threadMediaHashes()[hex]) {
        toast("Heads up: “" + file.name + "” is already posted in this thread", true);
      }
    }).catch(function () {});
  }
  function hookFilePrivacy() {
    if (!window.postCommon || !postCommon.addSelectedFile || postCommon.__rchanPriv) { return; }
    postCommon.__rchanPriv = true;
    var orig = postCommon.addSelectedFile;
    postCommon.addSelectedFile = function (file) {
      try {
        var strip = setOn("stripexif") && file && STRIP_TYPES[(file.type || "").toLowerCase()];
        var anon = setOn("anonname", false) && file && typeof File === "function";
        if (!strip && !anon) {
          warnIfDuplicate(file);                       // fire-and-forget, never blocks the add
          return orig.call(postCommon, file);
        }
        var finish = function (f) {
          if (anon) { try { f = new File([f], anonName(f), { type: f.type }); } catch (e) {} }
          warnIfDuplicate(f);                          // hash the FINAL bytes (post strip/rename)
          orig.call(postCommon, f);
        };
        if (!strip) { finish(file); return; }
        reencodeImage(file).then(finish, function () {
          toast("Couldn't strip metadata from " + file.name + " — uploading as-is", true);
          finish(file);
        });
      } catch (e) { return orig.call(postCommon, file); }
    };
  }
  // --- Rotate/crop editor over a selected file chip ---
  var edPanel = null, edState = null;   // { file, chip, img, url, rot, crop, scale }
  function edWorkCanvas() {             // full-res, rotation applied
    var img = edState.img, rot = edState.rot;
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement("canvas");
    if (rot % 2) { c.width = h; c.height = w; } else { c.width = w; c.height = h; }
    var x = c.getContext("2d");
    x.translate(c.width / 2, c.height / 2);
    x.rotate(rot * Math.PI / 2);
    x.drawImage(img, -w / 2, -h / 2);
    return c;
  }
  function edRender() {
    var work = edWorkCanvas();
    var disp = edPanel.querySelector("canvas");
    var maxW = Math.min(window.innerWidth * 0.86, 720), maxH = window.innerHeight * 0.55;
    var s = Math.min(maxW / work.width, maxH / work.height, 1);
    disp.width = Math.max(1, Math.round(work.width * s));
    disp.height = Math.max(1, Math.round(work.height * s));
    disp.getContext("2d").drawImage(work, 0, 0, disp.width, disp.height);
    edState.scale = s;
    edState.work = work;
    edDrawCrop();
  }
  function edDrawCrop() {
    var disp = edPanel.querySelector("canvas");
    var box = edPanel.querySelector(".rchan-ed-crop");
    var cr = edState.crop;
    if (!cr || cr.w < 4 || cr.h < 4) { box.style.display = "none"; return; }
    var r = disp.getBoundingClientRect(), host = box.parentNode.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = (r.left - host.left + cr.x) + "px";
    box.style.top = (r.top - host.top + cr.y) + "px";
    box.style.width = cr.w + "px"; box.style.height = cr.h + "px";
  }
  function edClose() {
    if (edPanel && edPanel.style.display === "flex") { edPanel.style.display = "none"; dialogClosed(edPanel); }
    if (edState && edState.url) { URL.revokeObjectURL(edState.url); }
    edState = null;
  }
  function edApply() {
    if (!edState) { return; }
    var out = edState.work;
    var cr = edState.crop, s = edState.scale;
    if (cr && cr.w >= 4 && cr.h >= 4) {
      var sx = Math.max(0, Math.round(cr.x / s)), sy = Math.max(0, Math.round(cr.y / s));
      var sw = Math.min(out.width - sx, Math.round(cr.w / s)), sh = Math.min(out.height - sy, Math.round(cr.h / s));
      if (sw > 0 && sh > 0) {
        var c2 = document.createElement("canvas"); c2.width = sw; c2.height = sh;
        c2.getContext("2d").drawImage(out, sx, sy, sw, sh, 0, 0, sw, sh);
        out = c2;
      }
    }
    var file = edState.file, chip = edState.chip;
    var type = STRIP_TYPES[(file.type || "").toLowerCase()] ? file.type : "image/png";
    out.toBlob(function (blob) {
      if (!blob) { toast("Couldn't export the edited image", true); return; }
      try {
        var f2 = new File([blob], file.name, { type: type });
        // native removal (splices selectedFiles + drops the QR clone), then re-add
        var rm = chip.getElementsByClassName("removeButton")[0];
        if (rm) { rm.onclick(); }
        var orig2 = postCommon.addSelectedFile;
        orig2.call(postCommon, f2);
        okToast("Image edited");
      } catch (e) { toast("Couldn't replace the file", true); }
      edClose();
    }, type, type === "image/jpeg" ? 0.92 : undefined);
  }
  function edButton(label, fn) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = label;
    b.addEventListener("click", function (e) { e.preventDefault(); fn(); });
    return b;
  }
  function openEditor(file, chip) {
    if (!edPanel) {
      edPanel = document.createElement("div"); edPanel.id = "rchan-imgedit";
      edPanel.setAttribute("role", "dialog"); edPanel.setAttribute("aria-label", "Edit image");
      var box = document.createElement("div"); box.className = "rchan-ed-box";
      var head = document.createElement("div"); head.className = "rchan-set-head";
      var ttl = document.createElement("span"); ttl.textContent = "Edit image";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.setAttribute("aria-label", "Close editor");
      x.addEventListener("click", edClose);
      head.appendChild(ttl); head.appendChild(x);
      box.appendChild(head);
      var stage = document.createElement("div"); stage.className = "rchan-ed-stage";
      var cv = document.createElement("canvas");
      var cropBox = document.createElement("div"); cropBox.className = "rchan-ed-crop";
      stage.appendChild(cv); stage.appendChild(cropBox);
      box.appendChild(stage);
      var hint = document.createElement("div"); hint.className = "rchan-set-desc rchan-ed-hint";
      hint.textContent = "Drag on the image to crop · rotate with the buttons";
      box.appendChild(hint);
      var bar = document.createElement("div"); bar.className = "rchan-ed-bar";
      bar.appendChild(edButton("⟲ Rotate left", function () { if (edState) { edState.rot = (edState.rot + 3) % 4; edState.crop = null; edRender(); } }));
      bar.appendChild(edButton("⟳ Rotate right", function () { if (edState) { edState.rot = (edState.rot + 1) % 4; edState.crop = null; edRender(); } }));
      bar.appendChild(edButton("Clear crop", function () { if (edState) { edState.crop = null; edDrawCrop(); } }));
      var apply = edButton("Apply", edApply); apply.className = "rchan-ed-apply";
      bar.appendChild(apply);
      bar.appendChild(edButton("Cancel", edClose));
      box.appendChild(bar);
      edPanel.appendChild(box);
      edPanel.addEventListener("click", function (e) { if (e.target === edPanel) { edClose(); } });
      document.body.appendChild(edPanel);
      // crop drag (pointer events cover mouse + touch)
      var drag = null;
      cv.style.touchAction = "none";
      cv.addEventListener("pointerdown", function (e) {
        if (!edState) { return; }
        var r = cv.getBoundingClientRect();
        drag = { x: e.clientX - r.left, y: e.clientY - r.top };
        edState.crop = { x: drag.x, y: drag.y, w: 0, h: 0 };
        try { cv.setPointerCapture(e.pointerId); } catch (e2) {}
        e.preventDefault();
      });
      cv.addEventListener("pointermove", function (e) {
        if (!drag || !edState) { return; }
        var r = cv.getBoundingClientRect();
        var px = Math.max(0, Math.min(cv.width, e.clientX - r.left));
        var py = Math.max(0, Math.min(cv.height, e.clientY - r.top));
        edState.crop = {
          x: Math.min(drag.x, px), y: Math.min(drag.y, py),
          w: Math.abs(px - drag.x), h: Math.abs(py - drag.y)
        };
        edDrawCrop();
      });
      var endDrag = function () { drag = null; };
      cv.addEventListener("pointerup", endDrag);
      cv.addEventListener("pointercancel", endDrag);
    }
    loadBitmap(file).then(function (b) {
      edState = { file: file, chip: chip, img: b.img, url: b.url, rot: 0, crop: null, scale: 1 };
      edPanel.style.display = "flex";
      edRender();
      dialogOpened(edPanel);
    }).catch(function () { toast("Couldn't open that image", true); });
  }
  function chipFile(chip) {                      // chip -> its File via position among siblings
    var host = chip.parentNode;
    if (!host || !window.postCommon || !postCommon.selectedFiles) { return null; }
    var cells = host.getElementsByClassName("selectedCell");
    for (var i = 0; i < cells.length; i++) {
      if (cells[i] === chip) { return postCommon.selectedFiles[i] || null; }
    }
    return null;
  }
  function decorateSelectedCells(root) {
    if (!window.postCommon || !postCommon.selectedFiles) { return; }
    var chips = (root || document).getElementsByClassName("selectedCell");
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      if (chip.getAttribute("data-edit")) { continue; }
      chip.setAttribute("data-edit", "1");
      var f = chipFile(chip);
      if (!f || !/^image\/(jpeg|png|webp)$/.test((f.type || "").toLowerCase())) { continue; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "rchan-chipedit";
      b.innerHTML = SVG_PEN;
      b.setAttribute("data-tooltip", "Rotate / crop before upload");
      b.setAttribute("aria-label", "Edit " + f.name + " before upload");
      b.addEventListener("click", (function (chip2) {
        return function (e) {
          e.preventDefault(); e.stopPropagation();
          var cur = chipFile(chip2);              // re-resolve: list may have shifted
          if (cur) { openEditor(cur, chip2); }
        };
      })(chip));
      chip.appendChild(b);
    }
  }

  function wrapSel(ta, pre, post) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e);
    ta.value = v.slice(0, s) + pre + sel + post + v.slice(e);
    ta.focus();
    var caret = sel ? s + pre.length + sel.length + post.length : s + pre.length;
    ta.setSelectionRange(sel ? caret : s + pre.length, caret);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function prefixLines(ta, prefix) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var ls = v.lastIndexOf("\n", s - 1) + 1, block = v.slice(ls, e) || v.slice(ls);
    var rep = block.replace(/^/gm, prefix);
    ta.value = v.slice(0, ls) + rep + v.slice(ls + block.length);
    ta.focus(); ta.setSelectionRange(ls, ls + rep.length);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  /* ---------- Live post preview ----------
     Client-side re-render of LynxChan's markup ('''b''' ''i'' **sp** ~~s~~
     ==red== [code] >green >>123 URLs) so what you see before posting is what
     lands. Reuses the site's real content classes (greenText, spoiler,
     quoteLink…) so the preview inherits every theme automatically. */
  function renderMarkup(src) {
    var esc = escHtml(src);
    var codes = [];                                              // protect [code] bodies from inline markup
    esc = esc.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, function (m, body) {
      codes.push(body); return "\u0000C" + (codes.length - 1) + "\u0000";
    });
    esc = esc
      .replace(/'''([\s\S]+?)'''/g, "<strong>$1</strong>")
      .replace(/''([\s\S]+?)''/g, "<em>$1</em>")
      .replace(/\*\*([\s\S]+?)\*\*/g, '<span class="spoiler">$1</span>')
      .replace(/~~([\s\S]+?)~~/g, "<s>$1</s>")
      .replace(/==([^\n=]+?)==/g, '<span class="redText">$1</span>')
      .replace(/&gt;&gt;&gt;\/(\w+)\/(\d*)/g, '<span class="quoteLink">&gt;&gt;&gt;/$1/$2</span>')
      .replace(/&gt;&gt;(\d+)/g, '<span class="quoteLink">&gt;&gt;$1</span>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    esc = esc.split("\n").map(function (l) {
      return /^&gt;(?!&gt;)/.test(l) ? '<span class="greenText">' + l + "</span>" : l;
    }).join("<br>");
    return esc.replace(/\u0000C(\d+)\u0000/g, function (m, i) { return "<code>" + codes[+i] + "</code>"; });
  }
  // Formatting toolbar for a message textarea (main post form + quick reply).
  function buildFmtBar(msg) {
    var bar = document.createElement("div"); bar.className = "rchan-fmtbar";
    // LynxChan markup: '''bold''' ''italic'' **spoiler** ~~strike~~ ==heading== [code] >greentext
    var FMT = [["B", "'''", "'''", "Bold"], ["I", "''", "''", "Italic"], ["Spoiler", "**", "**", "Spoiler"],
               ["S", "~~", "~~", "Strikethrough"], ["==", "==", "==", "Heading"], ["code", "[code]", "[/code]", "Code"]];
    FMT.forEach(function (f) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = f[0]; b.title = f[3];
      if (f[3] === "Strikethrough") { b.style.textDecoration = "line-through"; }  // CSS, not a combining char
      else if (f[3] === "Italic") { b.style.fontStyle = "italic"; }
      b.addEventListener("click", function (ev) { ev.preventDefault(); wrapSel(msg, f[1], f[2]); });
      bar.appendChild(b);
    });
    var qb = document.createElement("button"); qb.type = "button"; qb.textContent = ">"; qb.title = "Greentext";
    qb.addEventListener("click", function (ev) { ev.preventDefault(); prefixLines(msg, ">"); }); bar.appendChild(qb);
    // live preview toggle: rendered pane right under the textarea
    var pvBox = null;
    var pv = document.createElement("button"); pv.type = "button"; pv.textContent = "Preview";
    pv.title = "Live preview of the rendered post";
    pv.setAttribute("aria-pressed", "false");
    function pvUpdate() {
      if (!pvBox || pvBox.style.display === "none") { return; }
      var v = msg.value;
      pvBox.innerHTML = v.trim() ? renderMarkup(v) : '<span class="rchan-pv-empty">Nothing to preview yet</span>';
    }
    pv.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (!pvBox) {
        pvBox = document.createElement("div"); pvBox.className = "rchan-preview";
        msg.parentNode.insertBefore(pvBox, msg.nextSibling);
      }
      var show = pvBox.style.display === "none" || !pvBox.firstChild;
      pvBox.style.display = show ? "block" : "none";
      pv.classList.toggle("rchan-pvon", show);
      pv.setAttribute("aria-pressed", show ? "true" : "false");
      pvUpdate();
    });
    bar.appendChild(pv);
    // sage: the folklore, as a checkbox (threads only — saging a new thread is meaningless)
    if (curThreadId()) {
      var sageLab = document.createElement("label"); sageLab.className = "rchan-sagelab";
      sageLab.setAttribute("data-tooltip", "Reply without bumping the thread (sets email to sage)");
      var sage = document.createElement("input"); sage.type = "checkbox";
      sage.setAttribute("aria-label", "Sage — reply without bumping the thread");
      var emailSel = function () { return document.getElementById(msg.id === "qrbody" ? "qremail" : "fieldEmail"); };
      var em0 = emailSel() || document.getElementById("fieldEmail");
      sage.checked = !!(em0 && /^sage$/i.test((em0.value || "").trim()));
      sage.addEventListener("change", function () {
        var em = emailSel() || document.getElementById("fieldEmail");
        if (!em) { return; }
        if (sage.checked) { em.__presage = em.value; em.value = "sage"; }
        else { em.value = (em.__presage && !/^sage$/i.test(em.__presage)) ? em.__presage : ""; }
        em.dispatchEvent(new Event("input", { bubbles: true }));  // qr.registerSync mirrors the twin field
      });
      sageLab.appendChild(sage); sageLab.appendChild(document.createTextNode("sage"));
      bar.appendChild(sageLab);
    }
    var count = document.createElement("span"); count.className = "rchan-charcount"; bar.appendChild(count);
    var upd = function () {
      var n = msg.value.length, lim = msgLimit();
      count.textContent = lim ? n + " / " + lim : n + " chars";
      count.classList.toggle("rchan-charwarn", !!(lim && n > lim * 0.9));
      pvUpdate();
    };
    msg.addEventListener("input", upd); upd();
    return bar;
  }
  // Board message limit: the engine renders it as #labelMessageLength ("4096")
  function msgLimit() {
    var lab = document.getElementById("labelMessageLength");
    var n = lab ? parseInt((lab.textContent || "").replace(/\D/g, ""), 10) : 0;
    if (!n) {
      var f = document.getElementById("fieldMessage");
      if (f && f.maxLength > 0) { n = f.maxLength; }
    }
    return n || 0;
  }
  // Quick Reply is built lazily by qr.js (innerHTML); the MutationObserver-driven
  // refresh() lands here once #qrbody exists. wrapSel/prefixLines dispatch an
  // "input" event, which qr.js's registerSync mirrors into #fieldMessage.
  // Staff flag-override twin inside the Quick Reply. The XHR hook only reads
  // the MAIN #rchan-flagoverride select, so the twin just mirrors into it
  // (both ways) — QR users get the same control without a second code path.
  // Separate from enhanceQuickReply's data-fmt guard: the main select is built
  // asynchronously (after /account.js confirms the role), usually later.
  function buildQrFlagOverride() {
    var main = document.getElementById("rchan-flagoverride");
    var body = document.getElementById("qrbody");
    if (!main || !body || document.getElementById("rchan-flagoverride-qr")) { return; }
    var row = document.createElement("div"); row.id = "rchan-qr-flagrow"; row.className = "rchan-flagrow";
    row.appendChild(document.createTextNode("Flag "));
    var sel = main.cloneNode(true);
    sel.id = "rchan-flagoverride-qr"; sel.removeAttribute("name");
    sel.value = main.value;
    sel.addEventListener("change", function () {
      main.value = sel.value;
      main.dispatchEvent(new Event("change"));           // runs the native-combobox sync
      var nat = document.getElementById("flagCombobox"), natQr = document.getElementById("qrFlagCombobox");
      if (nat && natQr) { natQr.value = nat.value; }     // keep the QR's board-flag combo honest too
    });
    main.addEventListener("change", function () { sel.value = main.value; });
    row.appendChild(sel);
    var bar = body.parentNode.querySelector(".rchan-fmtbar");
    body.parentNode.insertBefore(row, bar || body);
  }
  function enhanceQuickReply() {
    buildQrFlagOverride();
    var ta = document.getElementById("qrbody");
    if (!ta || ta.getAttribute("data-fmt")) { return; }
    ta.setAttribute("data-fmt", "1");
    ta.parentNode.insertBefore(buildFmtBar(ta), ta);
    // board flags are a visible identity choice on the main form but the QR
    // buries them in the collapsed "Extra" section — promote the row up next
    // to the rest of the visible fields
    var qrFlags = document.getElementById("qrFlagsDiv");
    if (qrFlags) {
      var tr = qrFlags.closest("tr");
      var moreRow = document.getElementById("qrFormMore");
      if (tr && moreRow && tr.parentNode && tr.parentNode.id === "qrExtra") {
        moreRow.parentNode.insertBefore(tr, moreRow);
      }
    }
    // paste an image straight into the QR textarea
    ta.addEventListener("paste", function (e) {
      var add = collectPastedFiles(e);
      if (add.length) { engineAddFiles(add); }
    });
    // and accept drops anywhere on the QR panel, not just its little dropzone
    var panel = document.getElementById("quick-reply");
    if (panel && !panel.getAttribute("data-drop")) {
      panel.setAttribute("data-drop", "1");
      panel.addEventListener("dragover", function (e) { e.preventDefault(); });
      panel.addEventListener("drop", function (e) {
        e.preventDefault();
        var fs = e.dataTransfer && e.dataTransfer.files;
        if (fs && fs.length) { engineAddFiles(Array.prototype.slice.call(fs)); }
      });
    }
  }

  /* ---------- ID petnames: IDs are colors — let them be people ----------
     On ID boards you track "the orange ID arguing with everyone" in your
     head. A tiny ✎ next to each pill names the ID locally (per board+thread —
     IDs recycle across threads), the name renders beside every pill of that
     ID, and it's folded into the find-bar's id: index so you can filter by
     it. Purely local; rides the rchan_ backup export. */
  var IDNAMES_KEY = "rchan_idnames", IDNAMES_MAX = 500;
  function idNamesAll() { try { return JSON.parse(localStorage.getItem(IDNAMES_KEY) || "{}"); } catch (e) { return {}; } }
  function idNameKey(id) { return getBoard() + "/" + curThreadId() + "/" + id.toLowerCase(); }
  function idNameOf(id) { return idNamesAll()[idNameKey(id)] || ""; }
  function setIdName(id, name) {
    var o = idNamesAll(), k = idNameKey(id);
    if (name) { o[k] = name.slice(0, 24); } else { delete o[k]; }
    var keys = Object.keys(o);
    if (keys.length > IDNAMES_MAX) {                     // FIFO-ish cap; names are cheap to re-add
      for (var i = 0; i < keys.length - IDNAMES_MAX; i++) { delete o[keys[i]]; }
    }
    try { localStorage.setItem(IDNAMES_KEY, JSON.stringify(o)); } catch (e) {}
    refreshIdNames(id);
  }
  function refreshIdNames(id) {
    var pills = document.getElementsByClassName("labelId");
    for (var i = 0; i < pills.length; i++) {
      if ((pills[i].textContent || "").replace(/\s*\(\d+\)\s*$/, "").trim().toLowerCase() !== id.toLowerCase()) { continue; }
      var tag = pills[i].parentNode.querySelector(".rchan-idname");
      var name = idNameOf(id);
      if (!tag && name) {
        tag = document.createElement("span");
        tag.className = "rchan-idname";
        pills[i].parentNode.insertBefore(tag, pills[i].nextSibling);
      }
      if (tag) {
        tag.textContent = name;
        tag.style.display = name ? "" : "none";
      }
      var cell = pills[i].closest(".postCell, .opCell");
      if (cell) { delete cell.__find; }                  // find-bar re-indexes with the new name
    }
  }
  function promptIdName(id) {
    var cur = idNameOf(id);
    var name = window.prompt("Name this ID (" + id + ") — empty clears:", cur);
    if (name === null) { return; }
    setIdName(id, name.trim());
  }
  /* ---------- Poster ID pills (boards with IDs on) ----------
     LynxChan IDs are 6 hex chars — use the ID itself as the pill colour,
     text black/white by luminance. Click-to-highlight + hover post count are
     native (posting.processIdLabel swaps .innerPost -> .markedPost); the CSS
     side makes .markedPost actually visible in our themes. */
  function decorateIdPills(root) {
    var ids = (root || document).getElementsByClassName("labelId");
    for (var i = 0; i < ids.length; i++) {
      var el = ids[i];
      if (el.getAttribute("data-pill")) { continue; }
      el.setAttribute("data-pill", "1");
      var id = (el.textContent || "").trim();
      var c;
      if (/^[0-9a-f]{6}$/i.test(id)) { c = id.toLowerCase(); }
      else {                                       // non-hex ID: stable hash -> colour
        var h = 0;
        for (var j = 0; j < id.length; j++) { h = (h * 31 + id.charCodeAt(j)) >>> 0; }
        c = ("00000" + (h & 0xffffff).toString(16)).slice(-6);
      }
      // Mute the raw ID colour (the engine inlines background:#<id>, which is
      // often neon): keep the HUE so IDs stay distinguishable, but cap
      // saturation and pin lightness to a soft band that sits with the cream
      // palette. Our style assignment overwrites the engine's inline value.
      var r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      var h = 0;
      if (d) {
        if (max === r) { h = ((g - b) / d) % 6; }
        else if (max === g) { h = (b - r) / d + 2; }
        else { h = (r - g) / d + 4; }
        h = Math.round(h * 60); if (h < 0) { h += 360; }
      }
      // Only the HUE is per-ID; each theme renders it at its own muted
      // saturation/lightness via CSS (see body .labelId / .theme_dark
      // .labelId), so pills sit on-palette in cream AND dark. The CSS
      // !important also beats the engine's inline neon background-color.
      el.classList.add("rchan-idpill");
      el.style.setProperty("--idh", h);
      el.style.backgroundColor = "";                       // drop the engine's inline neon
      // funnel: one-click "show only this ID" via the find-in-thread bar
      if (curThreadId() && !el.closest(".rchan-inline-quote") && !el.closest(".quoteTooltip")) {
        var fn = document.createElement("button");
        fn.type = "button"; fn.className = "rchan-idfunnel";
        fn.innerHTML = SVG_FUNNEL;
        fn.setAttribute("data-tooltip", "Show only this ID");
        fn.setAttribute("aria-label", "Show only posts by ID " + id);
        fn.addEventListener("click", (function (idText) {
          return function (ev) { ev.preventDefault(); ev.stopPropagation(); toggleFind("id:" + idText); };
        })(id.toLowerCase()));
        el.parentNode.insertBefore(fn, el.nextSibling);
        // petname: the local label for this ID, plus the ✎ to set it
        var pen = document.createElement("button");
        pen.type = "button"; pen.className = "rchan-idnamebtn";
        pen.innerHTML = SVG_PEN;
        pen.setAttribute("data-tooltip", "Name this ID (local only)");
        pen.setAttribute("aria-label", "Set a local name for ID " + id);
        pen.addEventListener("click", (function (idText) {
          return function (ev) { ev.preventDefault(); ev.stopPropagation(); promptIdName(idText); };
        })(id));
        el.parentNode.insertBefore(pen, fn.nextSibling);
        var existing = idNameOf(id);
        if (existing) {
          var tag = document.createElement("span");
          tag.className = "rchan-idname";
          tag.textContent = existing;
          el.parentNode.insertBefore(tag, el.nextSibling);
        }
      }
    }
  }
  /* ---------- Admin-only flag override (cosmetic half — the ENFORCEMENT is the
     flagoverride addon server-side). LynxChan serves one cached page to every
     role, so per-role markup can't be server-rendered; instead the dropdown is
     built only after /account.js confirms globalRole <= 1. A normal poster
     never gets the control, and hand-crafting the field is rejected by the
     addon's role check anyway. ---------- */
  function buildFlagOverride(form, msg) {
    if (document.getElementById("rchan-flagoverride")) { return; }
    fetch("/account.js?json=1").then(function (r) { return r.json(); }).then(function (acc) {
      if (!acc || acc.status !== "ok" || !acc.data) { return; }
      if (typeof acc.data.globalRole !== "number" || acc.data.globalRole > 1) { return; }
      document.body.classList.add("rchan-staff");   // reveals staff-only controls (e.g. "No location")
      try { refresh(); } catch (e0) {}              // class flip is an attribute change — the childList observer won't fire
      try { decorateQuickMod(document); } catch (e1) {}
      try { initReportBadge(); } catch (e2) {}      // same role gate; server enforces regardless
      if (document.getElementById("rchan-flagoverride")) { return; }
      fetch("/.rchan/flags.json").then(function (r) { return r.json(); }).then(function (codes) {
        var names; try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { names = null; }
        var row = document.createElement("div"); row.id = "rchan-flagrow";
        row.appendChild(document.createTextNode("Flag "));
        var sel = document.createElement("select"); sel.id = "rchan-flagoverride"; sel.name = "flagOverride";
        var auto = document.createElement("option"); auto.value = ""; auto.textContent = "Auto";
        sel.appendChild(auto);
        var natives = document.getElementById("flagCombobox");   // board custom flags (native field)
        if (natives && natives.options.length > 1) {
          var gB = document.createElement("optgroup"); gB.label = "Board flags";
          for (var i = 0; i < natives.options.length; i++) {
            var no = natives.options[i]; if (!no.value) { continue; }
            var ob = document.createElement("option"); ob.value = "b:" + no.value; ob.textContent = no.textContent;
            gB.appendChild(ob);
          }
          sel.appendChild(gB);
        }
        var gC = document.createElement("optgroup"); gC.label = "Countries";
        (codes || []).map(function (c) {
          var C = c.toUpperCase(), n = C;
          try { n = (names && names.of(C)) || C; } catch (e2) {}
          return { c: C, n: n };
        }).sort(function (a, b) { return a.n < b.n ? -1 : 1; }).forEach(function (o) {
          var op = document.createElement("option"); op.value = o.c; op.textContent = o.n;
          gC.appendChild(op);
        });
        sel.appendChild(gC);
        sel.addEventListener("change", function () {
          var v = sel.value;
          if (natives) { natives.value = v.indexOf("b:") === 0 ? v.slice(2) : ""; }
          // country codes ride the XHR hook; b: values only set the native combobox
        });
        row.appendChild(sel);
        (msg ? msg.parentNode : form).insertBefore(row, msg || null);
      }).catch(function () {});
    }).catch(function () {});
  }

