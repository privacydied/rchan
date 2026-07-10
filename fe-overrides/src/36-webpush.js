  /* ---------- Web Push: notifications that survive the tab closing ----------
     The bell/watcher only fire while a tab is open. This layer registers a
     browser push subscription so the webpush addon can notify about replies
     (to you, or in a thread you watch) even with every tab shut. It rides the
     SAME on/off control as the bell — no new chrome — and keeps the server's
     copy of "what I watch / which posts are mine" in sync so it knows what to
     push. All of it degrades silently where Push isn't supported (iOS Safari
     outside an installed PWA, http, etc.). */
  var PUSH_EP_KEY = "rchan_push_ep";          // remember our endpoint for unsubscribe/sync
  function pushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window &&
           "Notification" in window && !!navigator.serviceWorker;
  }
  function urlB64ToUint8(b64) {
    var pad = "=".repeat((4 - (b64.length % 4)) % 4);
    var s = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(s), arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) { arr[i] = raw.charCodeAt(i); }
    return arr;
  }
  function pushApi(action, body) {
    return fetch("/addon.js/webpush?action=" + action, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin"
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  // Tell the server which threads I watch and which post ids are mine, so it
  // can match new posts. watchedData is per-board; rchan_you is a flat id list —
  // on a single-board site post ids don't collide, so attaching it to each
  // watched board (and the current one) is exact. (Multi-board deployments get
  // at worst a rare spurious "reply to you" if the same id exists on two boards.)
  function pushBoardsPayload() {
    var boards = {}, wd = {};
    try { wd = JSON.parse(localStorage.watchedData || "{}"); } catch (e) {}
    var you = load(YOU_KEY).map(Number).filter(function (n) { return n > 0; });
    Object.keys(wd).forEach(function (b) {
      if (!/^[a-zA-Z0-9]{1,32}$/.test(b)) { return; }
      var threads = Object.keys(wd[b] || {}).map(Number).filter(function (n) { return n > 0; });
      boards[b] = { threads: threads, you: you };
    });
    var cb = getBoard();
    if (cb && cb.charAt(0) !== "." && !boards[cb] && you.length) { boards[cb] = { threads: [], you: you }; }
    return boards;
  }
  var pushSyncT = null;
  function pushSync() {                        // debounced re-send of subscription + state
    if (!pushSupported() || Notification.permission !== "granted" ||
        localStorage.getItem(NOTIFY_KEY) !== "1") { return; }
    clearTimeout(pushSyncT);
    pushSyncT = setTimeout(function () {
      navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); })
        .then(function (sub) {
          if (!sub) { return; }
          try { localStorage.setItem(PUSH_EP_KEY, sub.endpoint); } catch (e) {}
          return pushApi("subscribe", { sub: sub.toJSON(), boards: pushBoardsPayload() });
        }).catch(function () {});
    }, 900);
  }
  function pushEnable() {                       // called once the bell grants permission
    if (!pushSupported()) { return; }
    pushApi("key").then(function (res) {
      if (!res || !res.key) { return; }         // addon disabled / no VAPID: bell still works tab-open
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (existing) {
          return existing || reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8(res.key)
          });
        });
      }).then(function (sub) {
        try { localStorage.setItem(PUSH_EP_KEY, sub.endpoint); } catch (e) {}
        return pushApi("subscribe", { sub: sub.toJSON(), boards: pushBoardsPayload() });
      }).then(function (r) {
        if (r && r.status === "ok" && typeof okToast === "function") {
          okToast("Notifications on — you'll be told about replies even with the tab closed");
        }
      }).catch(function () {});
    });
  }
  function pushDisable() {
    var ep = null; try { ep = localStorage.getItem(PUSH_EP_KEY); } catch (e) {}
    try { localStorage.removeItem(PUSH_EP_KEY); } catch (e2) {}
    if (!pushSupported()) { if (ep) { pushApi("unsubscribe", { endpoint: ep }); } return; }
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) {
        if (sub) { var e = sub.endpoint; return sub.unsubscribe().then(function () { return e; }).catch(function () { return e; }); }
        return ep;
      }).then(function (endpoint) {
        if (endpoint) { pushApi("unsubscribe", { endpoint: endpoint }); }
      }).catch(function () { if (ep) { pushApi("unsubscribe", { endpoint: ep }); } });
  }
  function initWebpush() {
    if (!pushSupported()) { return; }
    // Already opted in (bell on + permission granted): make sure a live
    // subscription exists and push the current watch/you state on load.
    if (Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "1") {
      pushEnable();
    }
    // Re-sync when another tab changes the watch/you set.
    window.addEventListener("storage", function (e) {
      if (e.key === "watchedData" || e.key === YOU_KEY) { pushSync(); }
    });
  }
