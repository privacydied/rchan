  /* ---------- Image hover-zoom ---------- */
  var zoom = null;
  function isImg(h) { return /\.(jpe?g|png|gif|webp|bmp)$/i.test(h || ""); }
  function hideZoom() { if (zoom) { zoom.style.display = "none"; zoom.src = ""; } }
  // True when this <img> is LynxChan's already-expanded inline full image (click-to-expand
  // appends <img class="imgExpanded"> and hides the thumb). Don't float a duplicate over it.
  function isExpanded(img, a) {
    if (img.classList && img.classList.contains("imgExpanded")) { return true; }
    if (a && a.querySelector) {
      var exp = a.querySelector(".imgExpanded");
      if (exp && exp.style.display !== "none") { return true; }
    }
    return false;
  }
  // Full-image URL for a hovered thumbnail. Thread/index: the imgLink href IS the file.
  // Catalog: the linkThumb href points at the thread, so derive the file from the thumb
  // src (/.media/t_<hash>) plus the cell's data-filemime (/.media/<hash>.<ext>).
  var MIME_EXT = { "image/jpeg": "jpg", "image/pjpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp" };
  function resolveFull(img, a, href) {
    if (isImg(href)) { return href; }
    if (a && a.classList && a.classList.contains("linkThumb")) {
      var ext = MIME_EXT[(a.getAttribute("data-filemime") || "").toLowerCase()];
      // strip a possible "?v=<n>" cache-bust query (server-side thumb versioning)
      // before matching -- the hash must still be the END of the PATH, not the URL.
      var thumbPath = (img.getAttribute("src") || "").split("?")[0];
      var m = thumbPath.match(/\/\.media\/t_([a-z0-9]+)$/i);
      if (ext && m) { return "/.media/" + m[1] + "." + ext; }
    }
    return null;
  }
  function onOver(e) {
    if (!setOn("hoverzoom")) { return; }
    var img = e.target;
    if (!img || img.tagName !== "IMG") { return; }
    var a = (img.closest && img.closest("a")) || img.parentNode;
    var href = a && a.getAttribute ? a.getAttribute("href") : null;
    var full = resolveFull(img, a, href);
    if (!full || isExpanded(img, a)) { hideZoom(); return; }
    if (!zoom) { zoom = document.createElement("img"); zoom.id = "rchan-zoom"; document.body.appendChild(zoom); }
    zoom.src = full; zoom.style.display = "block"; onMove(e);
  }
  // Position a floating preview element (image or video) next to the cursor,
  // flipping sides / clamping so it stays on-screen.
  function placeFloat(el, e) {
    var pad = 16, x = e.clientX + pad, y = e.clientY + pad;
    if (x + el.offsetWidth > window.innerWidth) { x = e.clientX - el.offsetWidth - pad; }
    if (y + el.offsetHeight > window.innerHeight) { y = Math.max(4, window.innerHeight - el.offsetHeight - 4); }
    el.style.left = Math.max(4, x) + "px"; el.style.top = Math.max(4, y) + "px";
  }
  function onMove(e) {
    if (zoom && zoom.style.display === "block") { placeFloat(zoom, e); }
    if (vidzoom && vidzoom.style.display === "block") { placeFloat(vidzoom, e); }
  }
  function onOut(e) { if (e.target && e.target.tagName === "IMG") { hideZoom(); } }

  /* ---------- Video: floating autoplay pop-out on hover (mirrors image zoom) ----------
   * NOTE: LynxChan's native thumbs.js (setPlayer) rewrites every video/audio thumbnail at
   * load: it REMOVES the original <a class="imgLink" data-filemime="video/…"> and replaces
   * it with <span><a class="hideLink"/><video controls/><a href="/.media/x.mp4"><img
   * class="imgLink"></a></span>. So after load the anchor has NO imgLink class and NO
   * data-filemime — the only reliable signal is the anchor href's video extension. Catalog
   * (linkThumb) is NOT processed by thumbs.js, so it keeps data-filemime + a thread href. */
  var VID_EXT = { "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogg" };
  var VID_RE = /\.(mp4|webm|ogg)(?:\?|#|$)/i;
  var vidzoom = null;
  // Resolve the playable video URL for a hovered thumbnail <img>, or null if it isn't a video.
  function videoUrlFor(img) {
    var a = img.closest ? img.closest("a[href]") : null;
    if (!a) { return null; }
    var href = a.getAttribute("href") || "";
    if (VID_RE.test(href)) {                                       // thread/index (incl. native-processed)
      // .ogg/.webm can be audio; native setPlayer builds an <audio> sibling for those — skip them.
      var box = a.parentNode;
      if (box && box.getElementsByTagName && box.getElementsByTagName("audio").length) { return null; }
      return { a: a, url: href };
    }
    if (a.classList.contains("linkThumb")) {                       // catalog: derive from thumb src + mime
      var mime = (a.getAttribute("data-filemime") || "").toLowerCase();
      var ext = VID_EXT[mime];
      var thumbPath = (img.getAttribute("src") || "").split("?")[0];   // strip ?v=<n> cache-bust
      var m = thumbPath.match(/\/\.media\/t_([a-z0-9]+)$/i);
      if (/^video\//.test(mime) && ext && m) { return { a: a, url: "/.media/" + m[1] + "." + ext }; }
    }
    return null;
  }
  function hideVidZoom() {
    if (!vidzoom) { return; }
    try { vidzoom.pause(); } catch (e) {}
    vidzoom.style.display = "none";
    vidzoom.removeAttribute("src"); vidzoom.load();   // stop buffering the file
  }
  function onVidOver(e) {
    if (!setOn("vidpop")) { return; }
    if (dataSaver()) { return; }                          // Data Saver: don't autoload video on hover
    var img = e.target;
    if (!img || img.tagName !== "IMG") { return; }     // only the thumbnail image, like image-zoom
    var info = videoUrlFor(img); if (!info) { return; }
    var a = info.a, url = info.url;
    if (!vidzoom) {
      vidzoom = document.createElement("video");
      vidzoom.id = "rchan-vidzoom";
      vidzoom.muted = true; vidzoom.loop = true; vidzoom.autoplay = true; vidzoom.playsInline = true;
      vidzoom.setAttribute("muted", ""); vidzoom.setAttribute("playsinline", "");
      document.body.appendChild(vidzoom);
      // once dimensions are known, size to the video (capped to viewport) unless already sized from data-*
      vidzoom.addEventListener("loadedmetadata", function () {
        if (vidzoom.dataset.sized === "1" || !vidzoom.videoWidth) { return; }
        var s2 = Math.min(window.innerWidth * 0.9 / vidzoom.videoWidth, window.innerHeight * 0.9 / vidzoom.videoHeight, 1);
        vidzoom.style.width = Math.round(vidzoom.videoWidth * s2) + "px";
        vidzoom.style.height = Math.round(vidzoom.videoHeight * s2) + "px";
      });
    }
    if (vidzoom.getAttribute("src") !== url) { vidzoom.src = url; }
    // Size immediately from data-file dims when the anchor still carries them (catalog / unprocessed);
    // otherwise clear and let loadedmetadata size it. Either way it's capped by CSS max-width/height.
    var nw = parseInt(a.getAttribute("data-filewidth"), 10) || 0, nh = parseInt(a.getAttribute("data-fileheight"), 10) || 0;
    if (nw && nh) {
      var s = Math.min(window.innerWidth * 0.9 / nw, window.innerHeight * 0.9 / nh, 1);
      vidzoom.style.width = Math.round(nw * s) + "px"; vidzoom.style.height = Math.round(nh * s) + "px";
      vidzoom.dataset.sized = "1";
    } else { vidzoom.style.width = ""; vidzoom.style.height = ""; vidzoom.dataset.sized = "0"; }
    // opt-in sound on the hover preview; volume follows the site-wide saved level
    var snd = setOn("vidpopsound", false);
    vidzoom.muted = !snd;
    if (snd) {
      var sv = loadVol();
      try { vidzoom.volume = (sv && typeof sv.v === "number") ? sv.v : 0.5; } catch (e2) {}
    }
    vidzoom.style.display = "block";
    var p = vidzoom.play(); if (p && p.catch) { p.catch(function () {}); }
    placeFloat(vidzoom, e);
  }
  function onVidOut(e) { if (e.target && e.target.tagName === "IMG") { hideVidZoom(); } }

  /* ---------- Video QoL: volume + mute persist site-wide ----------
     The engine's players forget volume on every page. Remember the last
     volume/mute the user set on any native player and apply it the first
     time each player starts. (The hover pop-out is excluded: it manages
     its own muted state via the "Sound on video hover" setting.) */
  var VOL_KEY = "rchan_vol";
  function loadVol() { try { return JSON.parse(localStorage.getItem(VOL_KEY) || "null"); } catch (e) { return null; } }
  function hookVolumePersistence() {
    document.addEventListener("volumechange", function (e) {
      var el = e.target;
      if (!el || (el.tagName !== "VIDEO" && el.tagName !== "AUDIO") || el.id === "rchan-vidzoom") { return; }
      if (!el.__rchanVol) { return; }                  // ignore our own initial application
      try { localStorage.setItem(VOL_KEY, JSON.stringify({ v: el.volume, m: el.muted })); } catch (e2) {}
    }, true);
    document.addEventListener("play", function (e) {
      var el = e.target;
      if (!el || (el.tagName !== "VIDEO" && el.tagName !== "AUDIO") || el.id === "rchan-vidzoom") { return; }
      if (el.__rchanVol) { return; }
      var s = loadVol();
      if (s && typeof s.v === "number") { try { el.volume = s.v; el.muted = !!s.m; } catch (e2) {} }
      el.__rchanVol = true;                            // set AFTER applying: the apply above must not persist
    }, true);
  }

  /* ---------- qr.showQr patch: greentext EVERY line of the selection ----------
     Native showQr already appends the selection but only prefixes '>' on the
     first line; re-implement with per-line greentext (same side effects). */
  function patchShowQr() {
    var q = window.qr;
    if (!q || !q.showQr || q.__rchanShowQr) { return; }
    q.__rchanShowQr = true;
    q.showQr = function (quote) {
      q.qrPanel.style.display = "block";
      if (q.qrPanel.getBoundingClientRect().top < 0) { q.qrPanel.style.top = "25px"; }
      var body = document.getElementById("qrbody");
      var field = document.getElementById("fieldMessage");
      if (!body) { return; }
      var txt = ">>" + quote + "\n";
      var sel = String(window.getSelection() || "");
      if (sel.trim()) {
        txt += sel.replace(/\r/g, "").split("\n").map(function (l) { return ">" + l; }).join("\n") + "\n";
      }
      body.value += txt;
      if (field) { field.value = body.value; }
      body.dispatchEvent(new Event("input", { bubbles: true }));   // char counters + draft
      try { if (window.postCommon && postCommon.updateCurrentChar) { postCommon.updateCurrentChar(); } } catch (e) {}
      body.focus();
    };
  }

  /* ---------- thread.replyCallback patch: confirm + no-reload insert ----------
     Native behaviour after a successful post: clear the form fields, then
     `if (!thread.autoRefresh || !thread.socket) { thread.refreshPosts(true); }`
     — i.e. rely on the live WS to push the post, refetch only when it's down.
     This patch used to toast + location.reload() unconditionally, because at
     the time the WS listened on a bare port (8082) Cloudflare doesn't forward,
     so CDN visitors never got the socket push. That's obsolete: the WS now
     rides same-origin /.ws (05-core rewrites the URL), and refreshPosts()
     splices new posts into the DOM from res/N.json — no reload needed. So:
     let the native callback run, toast, then VERIFY the post actually landed
     (the API hands us its id; posting.addPost sets it as the cell's DOM id —
     the same id 10-drafts-you's flash-and-scroll watches for, so that fires
     unchanged). If it hasn't landed — WS hiccup, or the native refetch was
     served a ≤15s-stale edge-cached res/N.json — re-fetch cache-busted via
     softRefreshThread() on a widening schedule. A full reload survives only
     as the very last rung, so a poster is never stranded staring at a page
     that silently doesn't contain their post. */
  /* ---------- Optimistic own-post render ----------
     The reply API answering "ok" means the post EXISTS server-side — the only
     wait is for a refetch to render it (WS tick, native refresh, or the
     verification ladder below; the ≤15s edge-cached res/N.json can stretch
     that). Instead of staring at a cleared form, render the post NOW from the
     submitted text (renderMarkup, module 60 — the same client renderer the
     live preview uses, so it inherits every theme) as a dimmed pending cell,
     and drop it the instant the real render lands. The cell deliberately does
     NOT use the post's DOM id — the verification ladder polls getElementById
     to detect the REAL post, and the id must stay free for it. */
  function insertPendingPost(pid, msg, name, fileCount) {
    if (document.getElementById(pid) ||
        document.querySelector('[data-rchan-pending="' + pid + '"]')) { return; }
    var host = document.querySelector(".divPosts");
    if (!host) { return; }
    var cell = document.createElement("div");
    cell.className = "postCell";
    cell.setAttribute("data-rchan-pending", pid);
    var inner = document.createElement("div");
    inner.className = "innerPost rchan-you rchan-pending";
    inner.setAttribute("aria-busy", "true");
    var info = document.createElement("div");
    info.className = "postInfo title";
    var nm = document.createElement("a"); nm.className = "linkName noEmailName";
    nm.textContent = (name || "").trim() || "Anonymous";
    var created = document.createElement("span"); created.className = "labelCreated";
    created.textContent = "just now";
    var self = document.createElement("a"); self.className = "linkSelf"; self.textContent = "No.";
    var quote = document.createElement("a"); quote.className = "linkQuote"; quote.textContent = pid;
    info.appendChild(nm);
    info.appendChild(document.createTextNode(" "));
    info.appendChild(created);
    info.appendChild(document.createTextNode(" "));
    info.appendChild(self);
    info.appendChild(quote);
    var body = document.createElement("div");
    body.className = "divMessage";
    try { body.innerHTML = renderMarkup(msg || ""); } catch (e) { body.textContent = msg || ""; }
    if (fileCount > 0) {                     // files exist server-side; thumbs come with the real render
      var att = document.createElement("span");
      att.className = "rchan-pending-files";
      att.setAttribute("aria-label", fileCount + " attachment" + (fileCount > 1 ? "s" : "") + " — appears with the confirmed post");
      att.setAttribute("data-tooltip", fileCount + " attachment" + (fileCount > 1 ? "s" : "") + " — appears in a moment");
      att.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' +
                      (fileCount > 1 ? "<span>×" + fileCount + "</span>" : "");
      body.appendChild(att);
    }
    inner.appendChild(info);
    inner.appendChild(body);
    cell.appendChild(inner);
    host.appendChild(cell);
    try { cell.scrollIntoView({ behavior: SB, block: "center" }); } catch (e2) {}
  }
  function removePendingPost(pid) {
    var el = document.querySelector('[data-rchan-pending="' + pid + '"]');
    if (el && el.parentNode) { el.parentNode.removeChild(el); }
  }
  function patchReplyCallback() {
    var t = window.thread;
    if (!t || !t.replyCallback || t.__rchanReplyPatched) { return; }
    t.__rchanReplyPatched = true;
    var orig = t.replyCallback;
    t.replyCallback = function (status, data) {
      // capture the submitted text/name BEFORE the native callback clears the form
      var qrb = document.getElementById("qrbody"), fm = document.getElementById("fieldMessage");
      var sentMsg = (qrb && qrb.value) || (fm && fm.value) || "";
      var qn = document.getElementById("qrname"), fn = document.getElementById("fieldName");
      var sentName = (qn && qn.value) || (fn && fn.value) || "";
      var sentFiles = 0;
      try { sentFiles = (window.postCommon && postCommon.selectedFiles && postCommon.selectedFiles.length) || 0; } catch (eF) {}
      orig(status, data);
      if (status !== "ok") { return; }
      okToast("Post submitted");
      // reply API returns the new postId (number); be lenient about shape
      var pid = String((data && data.postId) || data || "").replace(/\D/g, "");
      if (!pid) {                                     // can't verify: one blind cache-busted refetch
        setTimeout(softRefreshThread, 900);
        return;
      }
      try { insertPendingPost(pid, sentMsg, sentName, sentFiles); } catch (eP) {}
      // fast watcher: the WS can splice the real post between verification
      // rungs — never show pending + real side by side for more than ~400ms
      var rmTimer = setInterval(function () {
        if (document.getElementById(pid)) { removePendingPost(pid); clearInterval(rmTimer); }
      }, 400);
      setTimeout(function () { clearInterval(rmTimer); removePendingPost(pid); }, 45000);   // absolute backstop
      var waits = [900, 2500, 6000, 12000], step = 0;
      (function ensure() {
        if (document.getElementById(pid)) { removePendingPost(pid); return; }   // real post is on the page — done
        if (step >= waits.length) { location.reload(); return; }    // last resort
        setTimeout(function () {
          if (document.getElementById(pid)) { removePendingPost(pid); return; } // WS/native refetch landed it
          if (!softRefreshThread()) { location.reload(); return; }  // no refresher on this page
          setTimeout(ensure, 700);                    // give the refetch time to render, then re-check
        }, waits[step++]);
      })();
    };
  }

