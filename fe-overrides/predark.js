try {
  var st = null, md = null, wd = null;
  try {
    st = localStorage.getItem("selectedTheme");
    md = localStorage.getItem("manualDefault");
    wd = localStorage.getItem("rchan_warmdark");
  } catch (e) {}
  var warm;
  if (!st && !md) {
    // First-time visitor -> default to Cream (Dark). Persist best-effort, but the
    // VISUAL default must NOT depend on the write: Safari private mode (and some
    // locked-down setups) throw on localStorage.setItem, which used to make this
    // script bail before adding the class, so fresh private visits fell back to
    // plain cool dark. Apply the class from the in-memory decision regardless.
    try { localStorage.setItem("selectedTheme", "dark"); localStorage.setItem("rchan_warmdark", "1"); } catch (e) {}
    st = "dark";
    warm = true;
  } else {
    warm = wd === "1";   // existing visitor: warm only if they're explicitly on Cream (Dark)
  }
  if (st === "dark") {
    document.documentElement.className += warm ? " predark rchan-warmdark" : " predark";
  }
  // Per-theme CSS layers (theme-academia.css / theme-brutalist.css) are split
  // out of ux.css and only referenced from JS. This script runs synchronously
  // during <head> parsing, so a stylesheet <link> appended HERE is render-
  // blocking — a returning Academia/Brutalist user paints in their theme with
  // no flash of the base look. The URL map (with ?v= tokens) is injected by
  // the router as data-tcss-* attributes on this script's OWN tag (CSP is
  // script-src 'self' with no unsafe-inline, so it can't be an inline
  // <script>; document.currentScript reliably points at this tag because the
  // script is neither async nor a module).
  var ds = (document.currentScript && document.currentScript.dataset) || {};
  var tc = { academia: ds.tcssAcademia, brutalist: ds.tcssBrutalist };
  if (st && tc[st] && !document.getElementById("rchan-tcss-" + st)) {
    var l = document.createElement("link");
    l.id = "rchan-tcss-" + st; l.rel = "stylesheet"; l.href = tc[st];
    (document.head || document.documentElement).appendChild(l);
  }
} catch (e) {}
