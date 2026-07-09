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
} catch (e) {}
