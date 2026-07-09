  /* ---------- Staff report badge + inline queue ----------
     Mod UX ended at quick-mod: staff learned about reports by opening the
     management pages. Poll /openReports.js?json=1 (auth-gated server-side;
     only wired up after the same globalRole check as everything staff),
     bubble the count on the global-management nav icon, and let the bubble
     open an inline queue panel — board, reason, age, jump link per report —
     with the native page one click deeper for the actual closing. */
  var lastReports = [], reportsPanel = null;
  function renderReportsPanel() {
    if (!reportsPanel) { return; }
    var list = reportsPanel.lastChild;
    list.innerHTML = "";
    if (!lastReports.length) {
      var empty = document.createElement("div"); empty.className = "rchan-hist-empty";
      empty.textContent = "No open reports";
      list.appendChild(empty);
      return;
    }
    lastReports.forEach(function (r) {
      var row = document.createElement("a");
      row.className = "rchan-hist-row";
      var b = r.boardUri || "", t = r.threadId || "", p = r.postId || "";
      row.href = b && t ? ("/" + b + "/res/" + t + ".html" + (p ? "#" + p : "")) : "/openReports.js";
      var title = document.createElement("span"); title.className = "rchan-hist-title";
      title.textContent = (r.global ? "GLOBAL · " : "") + (b ? "/" + b + "/ " : "") +
        (p ? "No." + p : t ? "thread " + t : "") +
        (r.reason ? " — " + r.reason : " — no reason given");
      var meta = document.createElement("span"); meta.className = "rchan-hist-meta";
      var ts = Date.parse(r.creation) || 0;
      meta.textContent = ts ? fmtAgo(ts) : "";
      row.appendChild(title); row.appendChild(meta);
      list.appendChild(row);
    });
    var foot = document.createElement("a");
    foot.className = "rchan-reports-foot"; foot.href = "/openReports.js";
    foot.textContent = "Open the full report queue (close/ban there) →";
    list.appendChild(foot);
  }
  function toggleReportsPanel() {
    if (reportsPanel && reportsPanel.style.display === "block") {
      reportsPanel.style.display = "none"; dialogClosed(reportsPanel); return;
    }
    if (!reportsPanel) {
      reportsPanel = document.createElement("div"); reportsPanel.id = "rchan-reports";
      reportsPanel.setAttribute("role", "dialog"); reportsPanel.setAttribute("aria-label", "Open reports");
      var head = document.createElement("div"); head.className = "rchan-hist-head";
      var ttl = document.createElement("span"); ttl.textContent = "Open reports";
      var x = document.createElement("button"); x.type = "button"; x.className = "rchan-set-x";
      x.textContent = "×"; x.setAttribute("aria-label", "Close reports");
      x.addEventListener("click", function () { reportsPanel.style.display = "none"; dialogClosed(reportsPanel); });
      head.appendChild(ttl); head.appendChild(x);
      reportsPanel.appendChild(head);
      reportsPanel.appendChild(document.createElement("div"));   // list (lastChild)
      document.body.appendChild(reportsPanel);
      document.addEventListener("click", function (ev) {         // click-away closes
        if (reportsPanel.style.display !== "block") { return; }
        var t2 = ev.target;
        if (reportsPanel.contains(t2) || (t2.closest && t2.closest("#rchan-repbadge"))) { return; }
        reportsPanel.style.display = "none";
      }, true);
    }
    renderReportsPanel();
    reportsPanel.style.display = "block";
    dialogOpened(reportsPanel);
  }
  function initReportBadge() {
    if (initReportBadge.__on) { return; }
    initReportBadge.__on = true;
    function tick() {
      if (document.hidden) { return; }
      fetch("/openReports.js?json=1").then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.status !== "ok") { return; }
        var x = d.data, reports = null;
        if (Array.isArray(x)) { reports = x; }
        else if (x && Array.isArray(x.reports)) { reports = x.reports; }
        if (reports === null) { return; }
        lastReports = reports;
        var n = reports.length;
        var host = document.getElementById("linkGlobalManagement");
        if (!host) { return; }
        var b = document.getElementById("rchan-repbadge");
        if (!b) {
          b = document.createElement("span"); b.id = "rchan-repbadge";
          b.setAttribute("role", "button");
          b.setAttribute("aria-label", "Open the report queue");
          host.style.position = "relative";
          host.appendChild(b);
          b.addEventListener("click", function (e) {             // bubble opens the queue, link stays a link
            e.preventDefault(); e.stopPropagation();
            toggleReportsPanel();
          });
        }
        host.setAttribute("data-tooltip", "Global management" + (n ? " — " + n + " open report" + (n === 1 ? "" : "s") + " (click the bubble)" : ""));
        b.textContent = n ? (n > 99 ? "99+" : String(n)) : "";
        if (reportsPanel && reportsPanel.style.display === "block") { renderReportsPanel(); }
      }).catch(function () {});
    }
    tick();
    setInterval(tick, 120000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { tick(); } });
  }

  function enhancePostForm() {
    var form = document.getElementById("postingForm");
    if (!form || form.getAttribute("data-enh")) { return; }
    var msg = document.getElementById("fieldMessage");
    var input = document.getElementById("inputFiles");
    if (!msg && !input) { return; }
    form.setAttribute("data-enh", "1");
    buildFlagOverride(form, msg);

    // Collapsible posting form with a slide animation. The toggle sits *before* #postingForm
    // (so it survives the collapse and dodges the "#postingForm button" sizing). Collapse is a
    // grid-template-rows 1fr->0fr transition (animates true auto height); state is persisted.
    var COLLAPSE_KEY = "rchan_form_collapsed";
    var tog = document.createElement("button");
    tog.type = "button"; tog.id = "rchan-formtoggle";
    form.parentNode.insertBefore(tog, form);
    form.classList.add("rchan-form");
    var setCollapsed = function (c) {
      form.classList.toggle("rchan-collapsed", c);
      var L = formLabels();
      tog.textContent = c ? L.show : L.hide;
      tog.setAttribute("aria-expanded", c ? "false" : "true");
    };
    function slideToggle() {
      var collapse = !form.classList.contains("rchan-collapsed");   // visible now → collapse
      setCollapsed(collapse);
      try { collapse ? localStorage.setItem(COLLAPSE_KEY, "1") : localStorage.removeItem(COLLAPSE_KEY); } catch (e) {}
    }

    /* On board/catalog pages (no native quick reply there — qr.js is thread-only)
       the toggle opens the REAL posting form in a floating draggable/resizable
       box instead of sliding it inline; an "Original Form" link underneath keeps
       the classic slide-out behaviour. The form element itself is MOVED (not
       cloned), so captcha, file tray and fmtbar keep working. */
    var inThread = /\/res\//.test(location.pathname);
    var qrBox = null, origLink = null;
    // On the catalog/index the engine (catalog.js) hides #newPostFieldset and
    // shows a native #togglePosting "Post thread" button in its place — so just
    // un-collapsing our wrapper reveals only that button, forcing a second click.
    // Reveal the real fieldset ourselves whenever we open the form.
    function revealFieldset() {
      var npf = document.getElementById("newPostFieldset");
      if (!npf) { return; }
      var hidden = npf.style.display === "none" ||
                   (window.getComputedStyle && getComputedStyle(npf).display === "none");
      if (!hidden) { return; }
      var tp = document.getElementById("togglePosting");
      if (tp) { tp.style.display = "none"; }
      npf.style.display = "inline-block";
    }
    function closeFloatForm() {
      if (!qrBox) { return; }
      qrBox.style.display = "none";
      if (form.parentNode !== origLink.parentNode) {
        origLink.parentNode.insertBefore(form, origLink.nextSibling);  // put it back under the links
      }
      setCollapsed(true);
    }
    function openFloatForm() {
      if (!qrBox) {
        qrBox = document.createElement("div"); qrBox.id = "rchan-qr";
        var head = document.createElement("div"); head.id = "rchan-qr-header";
        var ttl = document.createElement("span"); ttl.textContent = "New Thread";
        var x = document.createElement("button"); x.type = "button"; x.id = "rchan-qr-close"; x.textContent = "✕"; x.title = "Close";
        x.addEventListener("click", closeFloatForm);
        head.appendChild(ttl); head.appendChild(x);
        qrBox.appendChild(head);
        var bodyDiv = document.createElement("div"); bodyDiv.id = "rchan-qr-body";
        qrBox.appendChild(bodyDiv);
        document.body.appendChild(qrBox);
        (function () {                                            // drag by the header
          var drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
          head.addEventListener("mousedown", function (e) {
            if (e.target === x) { return; }
            drag = true; sx = e.clientX; sy = e.clientY;
            var r = qrBox.getBoundingClientRect(); ox = r.left; oy = r.top;
            e.preventDefault();
          });
          document.addEventListener("mousemove", function (e) {
            if (!drag) { return; }
            qrBox.style.left = (ox + e.clientX - sx) + "px";
            qrBox.style.top = (oy + e.clientY - sy) + "px";
            qrBox.style.right = "auto";
          });
          document.addEventListener("mouseup", function () { drag = false; });
        })();
      }
      document.getElementById("rchan-qr-body").appendChild(form); // move the real form in
      form.classList.remove("rchan-collapsed");
      revealFieldset();                                          // un-hide the native fieldset, not just the wrapper
      qrBox.style.display = "block";
      if (msg) { msg.focus(); }
    }
    // "Original Form" link (all pages): slides the classic inline form out.
    origLink = document.createElement("a");
    origLink.id = "rchan-origform"; origLink.href = "#"; origLink.textContent = "Original Form";
    form.parentNode.insertBefore(origLink, form);
    origLink.addEventListener("click", function (e) {
      e.preventDefault();
      // "Original Form" should just slide the inline posting form OUT in one
      // click — never a toggle (which could collapse it / need a second click)
      // and never an intermediate step. Pull it back from the floating box if
      // it's in there, expand it, and drop the cursor in the message box.
      if (qrBox && qrBox.style.display === "block") {
        qrBox.style.display = "none";
        origLink.parentNode.insertBefore(form, origLink.nextSibling);
      }
      setCollapsed(false);
      revealFieldset();                                         // show the real fields, not just the "Post thread" button
      try { localStorage.removeItem(COLLAPSE_KEY); } catch (e3) {}
      try { form.scrollIntoView({ behavior: SB, block: "nearest" }); } catch (e4) {}
      if (msg) { try { msg.focus(); } catch (e5) {} }
    });
    if (!inThread) {
      tog.addEventListener("click", openFloatForm);             // our floating new-thread box
    } else {
      tog.addEventListener("click", function () {               // native floating quick reply
        var q = window.qr;
        if (q && q.qrPanel) {
          q.qrPanel.style.display = "block";                    // qr.showQr minus the ">>quote" insert
          if (q.qrPanel.getBoundingClientRect().top < 0) { q.qrPanel.style.top = "25px"; }
          var b = document.getElementById("qrbody");
          if (b) { b.focus(); }
        } else { slideToggle(); }                               // qr.js missing -> classic slide
      });
    }
    // start collapsed everywhere: the button's primary action is the floating box
    form.style.transition = "none"; setCollapsed(true); void form.offsetHeight; form.style.transition = "";
    if (msg) {
      msg.parentNode.insertBefore(buildFmtBar(msg), msg);
      if (input) {
        msg.addEventListener("paste", function (e) {
          var add = collectPastedFiles(e);
          if (add.length && !engineAddFiles(add)) { addFiles(input, add); }
        });
      }
    }
    if (input) {
      // drops anywhere on the form feed the engine's pipeline (the native
      // dropzone stopPropagation()s its own drops, so no double-add there)
      form.addEventListener("dragover", function (e) { e.preventDefault(); form.classList.add("rchan-dragover"); });
      form.addEventListener("dragleave", function (e) { if (e.target === form) { form.classList.remove("rchan-dragover"); } });
      form.addEventListener("drop", function (e) {
        e.preventDefault(); form.classList.remove("rchan-dragover");
        var fs = e.dataTransfer && e.dataTransfer.files;
        if (!fs || !fs.length) { return; }
        var arr = Array.prototype.slice.call(fs);
        if (!engineAddFiles(arr)) { addFiles(input, arr); }
      });
      // custom chip tray ONLY as the fallback UI — with the native pipeline the
      // engine renders its own .selectedCell chips (and resets input.files)
      if (!nativeFilePipe()) {
        var tray = document.createElement("div"); tray.id = "rchan-filetray"; tray.className = "rchan-filetray";
        (input.parentNode || form).appendChild(tray);
        input.addEventListener("change", function () { renderTray(input); });
        renderTray(input);
      }
    }
  }

