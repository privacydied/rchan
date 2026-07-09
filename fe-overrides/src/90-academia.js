  /* ==========================================================================
     ACADEMIA — theme-specific chrome (title eyebrow). The board-index/catalog
     infinite scroll used to live here as an Academia-only feature; it's now
     theme-agnostic and setting-gated — see 27-infinite-scroll.js.
     ========================================================================== */

  function academiaOn() {
    try { return document.body.classList.contains("theme_academia"); } catch (e) { return false; }
  }

  /* ---------- Title eyebrow: tiny sans caps over the serif headline ----------
     The signature "eyebrow-over-serif" move applied to the page title:
     "IMAGEBOARD · RCHAN" sits above "Catalog of /gen/" / the board name. */
  function decorateAcademiaChrome() {
    if (!academiaOn()) { return; }
    var title = document.getElementById("catalogId")
      || document.querySelector(".boardHeader p#labelName");
    if (!title || title.previousElementSibling && title.previousElementSibling.className === "rchan-title-eyebrow") { return; }
    if (document.querySelector(".rchan-title-eyebrow")) { return; }
    var eb = document.createElement("span");
    eb.className = "rchan-title-eyebrow";
    eb.textContent = "Imageboard · Rchan".toUpperCase();
    title.parentNode.insertBefore(eb, title);
  }
