// Send rebuildMessage tasks to the RUNNING daemon's task socket (its own
// official cache-invalidation path). Protocol per taskListener.handleSocket:
// [int32BE totalLen][flag 0=json][json], totalLen includes the 5-byte header.
const net = require("net");
function frame(o) {
  const j = Buffer.from(JSON.stringify(o), "utf8");
  const b = Buffer.alloc(5 + j.length);
  b.writeInt32BE(5 + j.length, 0); b[4] = 0; j.copy(b, 5);
  return b;
}
const s = net.connect("/tmp/unix.socket");
s.on("connect", () => {
  s.write(frame({ type: "rebuildMessage", message: { board: "gen", buildAll: true } }));
  s.write(frame({ type: "rebuildMessage", message: { overboard: true } }));
  setTimeout(() => { console.log("tasks sent"); s.end(); process.exit(0); }, 500);
});
s.on("error", (e) => { console.error("socket error:", e.message); process.exit(1); });
