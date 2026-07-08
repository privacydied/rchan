  /* ---------- Staff report badge: unhandled reports, visible from anywhere ----------
     Mod UX ended at quick-mod: staff learned about reports by opening the
     management pages. Poll /openReports.js?json=1 (auth-gated server-side;
     only wired up after the same globalRole check as everything staff) and
     bubble the count on the global-management nav icon. ---------- */
  function initReportBadge() {
    if (initReportBadge.__on) { return; }
    initReportBadge.__on = true;
    function tick() {
      if (document.hidden) { return; }
      fetch("/openReports.js?json=1").then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.status !== "ok") { return; }
        var x = d.data, n = null;
        if (Array.isArray(x)) { n = x.length; }
        else if (x && Array.isArray(x.reports)) { n = x.reports.length; }
        if (n === null) { return; }
        var host = document.getElementById("linkGlobalManagement");
        if (!host) { return; }
        var b = document.getElementById("rchan-repbadge");
        if (!b) {
          b = document.createElement("span"); b.id = "rchan-repbadge";
          host.style.position = "relative";
          host.appendChild(b);
          host.setAttribute("data-tooltip", "Global management" + (n ? " — " + n + " open report" + (n === 1 ? "" : "s") : ""));
        } else if (host.getAttribute("data-tooltip")) {
          host.setAttribute("data-tooltip", "Global management" + (n ? " — " + n + " open report" + (n === 1 ? "" : "s") : ""));
        }
        b.textContent = n ? (n > 99 ? "99+" : String(n)) : "";
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
      qrBox.style.display = "block";
      if (msg) { msg.focus(); }
    }
    // "Original Form" link (all pages): slides the classic inline form out.
    origLink = document.createElement("a");
    origLink.id = "rchan-origform"; origLink.href = "#"; origLink.textContent = "Original Form";
    form.parentNode.insertBefore(origLink, form);
    origLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (qrBox && qrBox.style.display === "block") {           // pull it out of the float
        qrBox.style.display = "none";
        origLink.parentNode.insertBefore(form, origLink.nextSibling);
        setCollapsed(false);
        return;
      }
      slideToggle();
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

