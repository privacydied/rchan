// rchan mod-view helpers — served same-origin so LynxChan's CSP (script-src 'self')
// allows it. Adds IP geolocation lookup in the moderation panel.
(function () {
  var GEO_BASE = "https://ipinfo.io/"; // swap for another lookup tool if desired
  function geoUrl(ip) { return GEO_BASE + encodeURIComponent(ip); }

  // Clicking the IP number itself opens the lookup.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("labelIp")) {
      var ip = (t.textContent || "").trim();
      if (ip) { window.open(geoUrl(ip), "_blank", "noopener"); }
    }
  });

  // Add a 🌍 link next to each populated IP (idempotent via data-geo).
  function decorate() {
    var ips = document.getElementsByClassName("labelIp");
    for (var i = 0; i < ips.length; i++) {
      var el = ips[i];
      if (el.getAttribute("data-geo")) { continue; }
      var ip = (el.textContent || "").trim();
      if (!ip) { continue; }
      el.setAttribute("data-geo", "1");
      var a = document.createElement("a");
      a.href = geoUrl(ip);
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "IP geolocation";
      a.className = "geoLink";
      a.style.textDecoration = "none";
      a.appendChild(document.createTextNode(" 🌍")); // globe emoji
      if (el.parentNode) { el.parentNode.insertBefore(a, el.nextSibling); }
    }
  }

  var pending = false;
  function schedule() {
    if (pending) { return; }
    pending = true;
    setTimeout(function () { pending = false; decorate(); }, 60);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  // In mod mode the IPs are filled in client-side after load, so re-run on DOM changes.
  try {
    new MutationObserver(schedule).observe(
      document.documentElement, { subtree: true, childList: true });
  } catch (_) { /* no-op */ }
})();
