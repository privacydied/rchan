
  /* ---------- Save thread: one self-contained HTML archive ----------
     An imageboard's defining property is that content dies — pruned off the
     last page, rotated out of a cyclic thread. Nothing else in the stack
     answers the moment a reader thinks "I want to keep this". saveThreadArchive
     fetches the thread JSON, inlines every post's text and a thumbnail (as a
     data: URI) into a single styled .html file, and downloads it. Each thumb
     links out to the full-res media; same-thread >>quotes are rewritten to
     in-document anchors so the archive navigates itself offline. No new chrome:
     it is reached from the command palette and the mobile long-press sheet. */
  var savingThread = false;
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;";
    });
  }
  // Fetch one media URL -> data: URI. Resolves to null on any failure so the
  // archive falls back to the remote URL rather than aborting the whole save.
  function toDataUri(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) { return null; }
      return r.blob();
    }).then(function (blob) {
      if (!blob || blob.size > 3 * 1024 * 1024) { return null; }  // skip oversized thumbs
      return new Promise(function (res) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { res(null); };
        fr.readAsDataURL(blob);
      });
    }).catch(function () { return null; });
  }
  // Bounded-concurrency map so a big thread doesn't open 300 sockets at once.
  function poolMap(items, worker, width) {
    return new Promise(function (resolve) {
      var out = new Array(items.length), i = 0, active = 0, done = 0;
      if (!items.length) { resolve(out); return; }
      function pump() {
        while (active < width && i < items.length) {
          (function (idx) {
            active++;
            Promise.resolve(worker(items[idx], idx)).then(function (v) {
              out[idx] = v; active--; done++;
              if (done === items.length) { resolve(out); } else { pump(); }
            });
          })(i++);
        }
      }
      pump();
    });
  }
  function saveThreadArchive() {
    if (savingThread) { return; }
    var b = getBoard(), t = curThreadId();
    if (!b || !t) { toast("Open a thread first to save it", true); return; }
    savingThread = true;
    okToast("Building thread archive…");
    fetch("/" + b + "/res/" + t + ".json").then(function (r) {
      if (!r.ok) { throw new Error("fetch"); }
      return r.json();
    }).then(function (d) {
      var op = { postId: d.threadId, subject: d.subject, name: d.name, flag: d.flag,
                 flagName: d.flagName, creation: d.creation, message: d.message,
                 markdown: d.markdown, id: d.id, files: d.files || [], isOp: true };
      var items = [op].concat(d.posts || []);
      // collect every thumbnail once (dedup by URL — same image can repeat)
      var thumbUrls = [], seen = {};
      items.forEach(function (p) {
        (p.files || []).forEach(function (f) {
          if (f.thumb && f.thumb.indexOf("/.static/") !== 0 && !seen[f.thumb]) {
            seen[f.thumb] = 1; thumbUrls.push(f.thumb);
          }
        });
      });
      return poolMap(thumbUrls, function (u) { return toDataUri(u); }, 6).then(function (uris) {
        var map = {};
        thumbUrls.forEach(function (u, i) { map[u] = uris[i]; });
        return buildAndDownload(d, items, map, b, t);
      });
    }).catch(function () {
      toast("Couldn't save the thread — the archive fetch failed", true);
    }).then(function () { savingThread = false; });
  }
  function buildAndDownload(d, items, thumbMap, b, t) {
    var origin = location.origin;
    // Rewrite same-thread quote links to in-doc anchors; absolutise everything else.
    function fixMsg(html) {
      var s = String(html || "");
      s = s.replace(/href="(\/[^"]*\/res\/\d+(?:\.html)?#(\d+))"/g, 'href="#p$2"');
      s = s.replace(/(href|src)="(\/[^"]*)"/g, function (m, a, path) {
        if (path.indexOf("//") === 0) { return m; }
        return a + '="' + origin + path + '"';
      });
      return s;
    }
    function fileBlock(p) {
      return (p.files || []).map(function (f) {
        var full = f.path && f.path.indexOf("//") !== 0 ? origin + f.path : (f.path || "#");
        var thumb = thumbMap[f.thumb] || (f.thumb ? origin + f.thumb : "");
        var dims = (f.width && f.height) ? (f.width + "×" + f.height) : "";
        var meta = [esc(f.originalName || "file"), dims, f.mime || ""].filter(Boolean).join(" · ");
        var img = thumb ? '<img loading="lazy" src="' + esc(thumb) + '" alt="' + esc(f.originalName || "") + '">'
                        : '<span class="noimg">[media]</span>';
        return '<figure><a href="' + esc(full) + '" target="_blank" rel="noopener">' + img +
               '</a><figcaption>' + meta + '</figcaption></figure>';
      }).join("");
    }
    function postBlock(p) {
      var head = '<span class="pn">' + (p.name ? esc(p.name) : "Anonymous") + '</span>' +
                 (p.subject ? ' <span class="ps">' + esc(p.subject) + '</span>' : "") +
                 (p.id ? ' <span class="pid">ID:' + esc(p.id) + '</span>' : "") +
                 ' <span class="pt">' + esc(p.creation || "") + '</span>' +
                 ' <a class="pno" href="#p' + esc(p.postId) + '">No.' + esc(p.postId) + '</a>';
      return '<article class="post' + (p.isOp ? " op" : "") + '" id="p' + esc(p.postId) + '">' +
             '<div class="ph">' + head + '</div>' +
             '<div class="files">' + fileBlock(p) + '</div>' +
             '<div class="msg">' + fixMsg(p.message) + '</div></article>';
    }
    var title = (d.subject || ("Thread " + t)).replace(/\s+/g, " ").trim();
    var css = "body{max-width:960px;margin:0 auto;padding:1em;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#1f1f1e;color:#e8e6df}" +
      "a{color:#e08b7a}h1{font-size:1.2em}.meta{opacity:.6;font-size:.85em;margin-bottom:1.5em}" +
      ".post{border:1px solid #3a3a38;border-radius:6px;padding:.6em .8em;margin:.5em 0;overflow:hidden}" +
      ".post.op{border-color:#c8102e55}.ph{font-size:.85em;margin-bottom:.4em}.pn{color:#8fb98f;font-weight:600}" +
      ".ps{color:#e8b96f;font-weight:600}.pid{opacity:.7}.pt{opacity:.55}.pno{opacity:.6;text-decoration:none}" +
      ".files{float:left;margin:0 .8em .3em 0}figure{margin:0 .5em .3em 0;display:inline-block;vertical-align:top}" +
      "figure img{max-width:180px;max-height:180px;border-radius:3px;display:block}figcaption{font-size:.72em;opacity:.6;max-width:180px}" +
      ".msg{white-space:pre-wrap;word-wrap:break-word}.msg .quoteLink,.msg a{color:#e08b7a}" +
      ".quote,.greenText{color:#789922}.noimg{opacity:.5}footer{opacity:.5;font-size:.8em;margin:2em 0 1em;text-align:center}";
    var doc = "<!doctype html><html lang=en><head><meta charset=utf-8>" +
      '<meta name=viewport content="width=device-width,initial-scale=1">' +
      "<title>" + esc(title) + " — /" + esc(b) + "/</title><style>" + css + "</style></head><body>" +
      "<h1>" + esc(title) + "</h1>" +
      '<div class=meta>Archived from ' + esc(origin) + "/" + esc(b) + "/res/" + esc(t) +
      " · " + items.length + " post" + (items.length === 1 ? "" : "s") +
      " · saved " + esc(new Date().toISOString().slice(0, 16).replace("T", " ")) + "</div>" +
      items.map(postBlock).join("") +
      "<footer>Self-contained archive built by rchan. Thumbnails are embedded; full media links out to the live site.</footer>" +
      "</body></html>";
    var blob = new Blob([doc], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var safe = (b + "-" + t + "-" + title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    a.href = url; a.download = safe + ".html";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    okToast("Thread saved — " + items.length + " posts");
  }
