// One-off: backfill country flags onto EXISTING posts/threads from their stored IP.
// Flags are normally stamped at post time; this retro-applies them so old posts show flags too.
// UPDATES only (adds flag/flagName/flagCode + clears the render cache); never deletes.
//
//   docker cp tests/backfill-flags.js rchan-lynxchan:/tmp/bf.js
//   docker exec -e NODE_PATH=/lynxchan/src/be/node_modules rchan-lynxchan node /tmp/bf.js
//   docker exec rchan-lynxchan rm -f /tmp/bf.js
// Then rebuild the affected threads (it prints the list).

const { MongoClient } = require("mongodb-legacy");
const geoip = require("geoip-lite");

var regionNames; try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) {}
function cname(c) { try { return (regionNames && regionNames.of(c)) || c; } catch (e) { return c; } }
function ipStr(ip) {
  if (!ip) { return null; }
  if (typeof ip === "string") { return ip; }
  if (Array.isArray(ip)) {
    if (ip.length === 4) { return ip.join("."); }
    if (ip.length === 16) { var p = []; for (var i = 0; i < 16; i += 2) { p.push(((ip[i] << 8) | ip[i + 1]).toString(16)); } return p.join(":"); }
  }
  return null;
}
const IND = { innerCache: "", outerCache: "", previewCache: "", clearCache: "", alternativeCaches: "", hashedCache: "", previewHashedCache: "", outerHashedCache: "", outerClearCache: "" };

(async () => {
  const client = await MongoClient.connect("mongodb://mongo:27017");
  const db = client.db("lynxchan");
  let done = 0, skip = 0;
  const threads = {};
  for (const coll of ["threads", "posts"]) {
    const docs = await db.collection(coll).find({ ip: { $exists: true }, flag: { $exists: false } }).toArray();
    for (const d of docs) {
      const s = ipStr(d.ip);
      const g = s && geoip.lookup(s);
      if (!g || !g.country) { skip++; continue; }               // local/unknown IP -> no flag
      const code = String(g.country).toUpperCase();
      await db.collection(coll).updateOne({ _id: d._id }, {
        $set: { flag: "/.static/flags/" + code.toLowerCase() + ".png", flagName: cname(code), flagCode: code },
        $unset: IND
      });
      done++;
      threads[d.boardUri + "/" + d.threadId] = 1;
    }
  }
  await client.close();
  console.log("backfilled=" + done + " skipped(local/unknown)=" + skip);
  console.log("affected threads: " + Object.keys(threads).join(" "));
  process.exit(0);
})().catch(e => { console.error("FATAL " + (e && e.message)); process.exit(1); });
