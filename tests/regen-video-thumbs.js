// One-off: regenerate thumbnails for video posts that fell back to the generic thumb.
// Reads video from gridfs, extracts a 25% frame with ffmpeg, stores a real thumb, and
// fixes the post's thumb + width/height. UPDATES only — never deletes post data.
const { MongoClient, GridFSBucket } = require("mongodb-legacy");
const fs = require("fs");
const cp = require("child_process");
const THUMB = 256, PCT = 0.25;
function sh(c) { return cp.execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }

(async () => {
  const client = await MongoClient.connect("mongodb://mongo:27017");
  const db = client.db("lynxchan");
  const bucket = new GridFSBucket(db);
  const q = { files: { $elemMatch: { mime: /^video\//, thumb: "/genericThumb.png" } } };
  const items = (await db.collection("posts").find(q).toArray()).map(d => ["posts", d])
    .concat((await db.collection("threads").find(q).toArray()).map(d => ["threads", d]));

  let done = 0, fail = 0;
  for (const [coll, doc] of items) {
    for (let i = 0; i < doc.files.length; i++) {
      const f = doc.files[i];
      if (!/^video\//.test(f.mime || "") || f.thumb !== "/genericThumb.png") { continue; }
      const id = doc.postId || doc.threadId;
      const hash = f.path.replace(/^\/\.media\//, "").replace(/\.[^.]+$/, "");
      const vid = "/tmp/rg.mp4", th = "/tmp/rg.png";
      try {
        await new Promise((res, rej) =>
          bucket.openDownloadStreamByName(f.path).pipe(fs.createWriteStream(vid)).on("finish", res).on("error", rej));
        const wh = sh(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${vid}`).split(",");
        const w = parseInt(wh[0], 10), h = parseInt(wh[1], 10);
        const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${vid}`)) || 0;
        if (!w || !h) { console.log("  #" + id + ": no dimensions, skip"); fail++; continue; }
        let tw, tht;
        if (w > h) { tw = THUMB; tht = Math.floor(h * (THUMB / w)); } else { tht = THUMB; tw = Math.floor(w * (THUMB / h)); }
        const seek = dur > 0 ? (dur * PCT).toFixed(2) : "1";
        sh(`ffmpeg -y -ss ${seek} -i ${vid} -vframes 1 -vf scale=${tw}:${tht} ${th}`);
        if (!fs.existsSync(th) || fs.statSync(th).size < 100) { console.log("  #" + id + ": thumb not produced, skip"); fail++; continue; }
        const dest = "/.media/t_" + hash;
        const existing = await bucket.find({ filename: dest }).toArray();
        if (!existing.length) {
          await new Promise((res, rej) => fs.createReadStream(th)
            .pipe(bucket.openUploadStream(dest, { contentType: "image/png", metadata: { sha256: hash, type: "media", lastModified: new Date() } }))
            .on("finish", res).on("error", rej));
        }
        const set = {}; set["files." + i + ".thumb"] = dest; set["files." + i + ".width"] = w; set["files." + i + ".height"] = h;
        // Clear the post's cached rendered HTML (miscOps.individualCaches) so the generator
        // re-renders it with the new thumb instead of reusing the stale genericThumb markup.
        const unset = { innerCache: "", outerCache: "", previewCache: "", clearCache: "", alternativeCaches: "", hashedCache: "", previewHashedCache: "", outerHashedCache: "", outerClearCache: "" };
        await db.collection(coll).updateOne({ _id: doc._id }, { $set: set, $unset: unset });
        console.log("  OK #" + id + " " + f.mime + " " + w + "x" + h + " -> " + dest + " (frame @" + seek + "s)");
        done++;
      } catch (e) { console.log("  #" + id + ": ERROR " + (e && e.message)); fail++; }
      try { fs.unlinkSync(vid); } catch (e) {} try { fs.unlinkSync(th); } catch (e) {}
    }
  }
  await client.close();
  console.log("regenerated=" + done + " failed=" + fail);
  process.exit(0);
})().catch(e => { console.error("FATAL", e && e.stack || e); process.exit(1); });
