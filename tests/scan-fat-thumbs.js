// READ-ONLY scan: oversized legacy thumbnails in gridfs.
// Lists every /.media/t_* thumb over SIZE_MIN bytes with its content type and
// the posts/threads that reference it (board/thread/post + source mime).
// No writes of any kind.
const { MongoClient } = require("mongodb-legacy");
const SIZE_MIN = 60 * 1024; // 60 KB — engine-standard 480px webp thumbs run ~10-30 KB

(async () => {
  const client = await MongoClient.connect("mongodb://mongo:27017");
  const db = client.db("lynxchan");
  const fat = await db.collection("fs.files")
    .find({ filename: /^\/\.media\/t_/, length: { $gt: SIZE_MIN } })
    .project({ filename: 1, length: 1, contentType: 1, uploadDate: 1 })
    .sort({ length: -1 }).toArray();

  let total = 0;
  for (const f of fat) {
    total += f.length;
    const refs = [];
    for (const coll of ["threads", "posts"]) {
      const docs = await db.collection(coll)
        .find({ "files.thumb": f.filename })
        .project({ boardUri: 1, threadId: 1, postId: 1, "files.$": 1 }).toArray();
      docs.forEach(d => refs.push(
        coll.slice(0, 1) + " /" + d.boardUri + "/" + (d.threadId || "?") + (d.postId ? "#" + d.postId : "") +
        " src=" + ((d.files && d.files[0] && d.files[0].mime) || "?") +
        " " + ((d.files && d.files[0] && d.files[0].path) || "")));
    }
    console.log(
      Math.round(f.length / 1024) + "KB\t" + (f.contentType || "?") + "\t" +
      f.filename.slice(0, 32) + "…\t" + (refs.join(" | ") || "UNREFERENCED"));
  }
  const all = await db.collection("fs.files")
    .aggregate([{ $match: { filename: /^\/\.media\/t_/ } },
                { $group: { _id: "$contentType", n: { $sum: 1 }, bytes: { $sum: "$length" } } },
                { $sort: { bytes: -1 } }]).toArray();
  console.log("---");
  all.forEach(g => console.log("thumbs " + g._id + ": " + g.n + " files, " + Math.round(g.bytes / 1024) + "KB total"));
  console.log("oversized(>" + Math.round(SIZE_MIN / 1024) + "KB): " + fat.length + " files, " + Math.round(total / 1024) + "KB");
  await client.close();
})().catch(e => { console.error("FATAL", e && e.message); process.exit(1); });
