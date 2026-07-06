// Integration test: verify live thread updates are delivered over the WebSocket.
//
// Subscribes a WS client to a thread through the same-origin /.ws path the router exposes
// (the "watching tab"), then triggers a broadcast and asserts the client receives it (the
// "posting tab"). Because board rdr uses captchaMode 2 (captcha on every post, admin
// included), we can't script a fresh reply, so we re-save an existing post with its exact
// text — an edit fires the same notifySockets broadcast and needs no captcha.
//
// Run it INSIDE the lynxchan container (it has the `ws` module):
//   RP=$(grep ^ROOT_PASS= .env | cut -d= -f2-)
//   docker cp tests/ws-live-update.js rchan-lynxchan:/tmp/ws-live-update.js
//   docker exec -e RP="$RP" -e NODE_PATH=/lynxchan/src/be/node_modules \
//     rchan-lynxchan node /tmp/ws-live-update.js
//
// Env (all optional except RP):
//   RP         admin (ROOT_PASS) password           [required]
//   HOSTNAME_  virtual host                          [boards.rchan.xyz]
//   ROUTER     router host:port on the docker net    [landing:80]
//   ENGINE     engine host:port                      [127.0.0.1:8080]
//   BOARD      board uri                             [rdr]
//   THREAD     thread id                             [54]
//   EDIT_POST  post id to re-save                    [61]
//   EDIT_MSG   its exact current message             [I really need to pee]
// Exit code 0 = live update received, non-zero = failure.

const http = require("http");
const WebSocket = require("ws");

const VHOST = process.env.HOSTNAME_ || "boards.rchan.xyz";
const [EHOST, EPORT] = (process.env.ENGINE || "127.0.0.1:8080").split(":");
const ROUTER = process.env.ROUTER || "landing:80";
const BOARD = process.env.BOARD || "rdr";
const THREAD = process.env.THREAD || "54";
const EDIT_POST = process.env.EDIT_POST || "61";
const EDIT_MSG = process.env.EDIT_MSG || "I really need to pee";

function post(path, body, cookie) {
  return new Promise((res, rej) => {
    const req = http.request({
      host: EHOST, port: +EPORT, path, method: "POST",
      headers: Object.assign({
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "Host": VHOST,
        "Referer": "http://" + VHOST + "/" + BOARD + "/res/" + THREAD + ".html"
      }, cookie ? { "Cookie": cookie } : {})
    }, r => { let b = ""; r.on("data", c => b += c); r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: b })); });
    req.on("error", rej); req.write(body); req.end();
  });
}

(async () => {
  if (!process.env.RP) { console.log("FATAL: set RP=<admin password>"); process.exit(1); }

  const lr = await post("/login.js?json=1", "login=admin&password=" + encodeURIComponent(process.env.RP));
  const cookie = (lr.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");
  console.log("LOGIN status=" + lr.status + " cookie=" + (cookie ? "yes" : "no"));

  const ws = new WebSocket("ws://" + ROUTER + "/.ws", { headers: { Host: VHOST } });
  let got = null;
  ws.on("open", () => { console.log("WS open -> subscribe " + BOARD + "-" + THREAD); ws.send(BOARD + "-" + THREAD); });
  ws.on("message", d => { got = d.toString(); console.log("WS <<< " + got); });
  ws.on("error", e => console.log("WS error " + e.message));

  await new Promise(r => setTimeout(r, 1500));
  const body = "boardUri=" + BOARD + "&postId=" + EDIT_POST + "&message=" + encodeURIComponent(EDIT_MSG);
  const pr = await post("/saveEdit.js?json=1", body, cookie);
  console.log("EDIT status=" + pr.status + " body=" + pr.body.slice(0, 140));

  await new Promise(r => setTimeout(r, 6000));
  console.log(got ? "RESULT: WS delivered the live update OK" : "RESULT: no WS message received");
  process.exit(got ? 0 : 2);
})().catch(e => { console.log("FATAL " + e.message); process.exit(1); });
