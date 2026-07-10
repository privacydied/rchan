  /* ---------- Board title = one-click refresh (index/thread) ----------
     #labelName (the "/board/ - Name" heading) is otherwise inert on index and
     thread pages. Make it a refresh affordance: a click (or Enter/Space) runs
     the SAME routine as the native Refresh button — thread.refreshPosts on a
     thread, the catalog refresher on a catalog — so it respects auto-refresh
     state instead of hard-reloading; it falls back to location.reload() where
     neither exists. Skipped when the title is (or wraps) a link, so no existing
     anchor behaviour breaks. The affordance (pointer + accent hover) is in
     ux.css, gated on the class this adds. */
  function initTitleRefresh() {
    var t = document.getElementById("labelName");
    if (!t || t.__rchanRefresh) { return; }
    if (t.tagName === "A" || t.querySelector("a")) { return; }   // already a link: leave it
    t.__rchanRefresh = true;
    t.classList.add("rchan-titlerefresh");
    t.setAttribute("role", "button");
    t.setAttribute("tabindex", "0");
    t.setAttribute("aria-label", "Refresh this page");
    t.setAttribute("data-tooltip", "Refresh");
    function go() {
      if (window.thread && typeof thread.refreshPosts === "function") {
        try { thread.refreshPosts(true); return; } catch (e) {}
      }
      if (window.catalog && typeof catalog.refreshCatalog === "function") {
        try { catalog.refreshCatalog(true); return; } catch (e) {}
      }
      location.reload();
    }
    t.addEventListener("click", go);
    t.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  }
