// One-off: backfill poster IDs onto EXISTING posts/threads from their stored IP.
// IDs are normally stamped at post time (postingOps: common.createId with the
// THREAD's salt); this retro-applies them so old posts show ID pills after a
// board enables IDs. UPDATES only ($set id + clears the render cache on docs
// that have an ip/bypassId and no id); never deletes. Boards with 'disableIds'
// still set are skipped entirely.
//
// The formula matches the engine EXACTLY (postingOps/common.js createId):
//   sha256(thread.salt + ip + boardUri).hex.slice(0, 6)
// where ip is the stored ARRAY — string-coerced to "a,b,c,d" like the engine's
// `salt + ip + boardUri` concatenation does.
//
//   docker cp tests/backfill-ids.js rchan-lynxchan:/tmp/bi.js
//   docker exec -e NODE_PATH=/lynxchan/src/be/node_modules rchan-lynxchan node /tmp/bi.js
//   docker exec rchan-lynxchan rm -f /tmp/bi.js
// Then rebuild the affected threads (it prints the list) — e.g. the lock
// on/off toggle via changeThreadSettings.js (see CLAUDE.md).

const { MongoClient } = require("mongodb-legacy");
const crypto = require("crypto");

function createId(salt, boardUri, ip, bypassId) {          // verbatim engine logic
  if (ip) {
    return crypto.createHash("sha256").update(salt + ip + boardUri).digest("hex").substring(0, 6);
  } else if (bypassId) {
    return crypto.createHash("sha256").update(salt + bypassId.toString() + boardUri).digest("hex").substring(0, 6);
  }
  return null;
}

const IND = { innerCache: "", outerCache: "", previewCache: "", clearCache: "", alternativeCaches: "", hashedCache: "", previewHashedCache: "", outerHashedCache: "", outerClearCache: "" };

(async () => {
  const client = await MongoClient.connect("mongodb://mongo:27017");
  const db = client.db("lynxchan");

  const idBoards = (await db.collection("boards")
    .find({ settings: { $ne: "disableIds" } }, { projection: { boardUri: 1 } }).toArray())
    .map(b => b.boardUri);
  console.log("boards with IDs enabled: " + (idBoards.join(" ") || "(none)"));

  let done = 0, skip = 0;
  const affected = {};

  for (const boardUri of idBoards) {
    const threads = await db.collection("threads")
      .find({ boardUri }, { projection: { threadId: 1, salt: 1, ip: 1, bypassId: 1, id: 1 } }).toArray();
    const saltOf = {};

    for (const t of threads) {
      saltOf[t.threadId] = t.salt;
      if (t.id || !t.salt) { continue; }                   // already has one / no salt to derive from
      const id = createId(t.salt, boardUri, t.ip, t.bypassId);
      if (!id) { skip++; continue; }                       // no ip AND no bypassId (e.g. Tor)
      await db.collection("threads").updateOne({ _id: t._id }, { $set: { id }, $unset: IND });
      done++; affected[boardUri + "/" + t.threadId] = 1;
    }

    const posts = await db.collection("posts")
      .find({ boardUri, id: null }, { projection: { threadId: 1, ip: 1, bypassId: 1 } }).toArray();
    for (const p of posts) {
      const salt = saltOf[p.threadId];
      if (!salt) { skip++; continue; }                     // orphan post, no thread salt
      const id = createId(salt, boardUri, p.ip, p.bypassId);
      if (!id) { skip++; continue; }
      await db.collection("posts").updateOne({ _id: p._id }, { $set: { id }, $unset: IND });
      done++; affected[boardUri + "/" + p.threadId] = 1;
    }
  }

  await client.close();
  console.log("backfilled=" + done + " skipped(no ip/bypass/salt)=" + skip);
  console.log("affected threads: " + Object.keys(affected).join(" "));
  process.exit(0);
})().catch(e => { console.error("FATAL " + (e && e.message)); process.exit(1); });
