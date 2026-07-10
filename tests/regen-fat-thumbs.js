// One-off: re-encode the 12 oversized legacy PNG video thumbnails as webp.
// UPDATE-ONLY, ZERO DELETES:
//   - selects gridfs thumbs matching the scan criteria (t_* / image/png / >90KB)
//     whose referencing post file is a video (the exact 12 from scan-fat-thumbs.js),
//   - re-extracts a 25% frame from the SOURCE video, scales to fit 480
//     (current engine thumbSize), encodes webp (current engine thumbExtension),
//   - uploads under a NEW gridfs filename (old name + "w") — the old PNG stays
//     in gridfs as an orphan; a new URL is also a fresh CDN cache key, so no
//     Cloudflare purge and no thumbAssetVersion bump is needed,
//   - repoints files.<i>.thumb on the exact referencing doc (_id-scoped
//     updateOne) and clears its render caches (same set the old
//     regen-video-thumbs.js used) so the engine re-renders JIT.
// A fresh verified mongodump was taken before this run (CLAUDE.md).
const { MongoClient, GridFSBucket } = require("mongodb-legacy");
const fs = require("fs");
const cp = require("child_process");
const THUMB = 480, PCT = 0.25, QUALITY = 82;
function sh(c) { return cp.execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }

(async () => {
  const client = await MongoClient.connect("mongodb://mongo:27017");
  const db = client.db("lynxchan");
  const bucket = new GridFSBucket(db);

  const fat = await db.collection("fs.files")
    .find({ filename: /^\/\.media\/t_/, contentType: "image/png", length: { $gt: 90 * 1024 } })
    .project({ filename: 1, length: 1 }).sort({ length: -1 }).toArray();

  let done = 0, fail = 0, skip = 0;
  for (const t of fat) {
    const dest = t.filename + "w";
    let refs = [];
    for (const coll of ["threads", "posts"]) {
      (await db.collection(coll).find({ "files.thumb": t.filename }).toArray())
        .forEach(d => refs.push([coll, d]));
    }
    if (!refs.length) { console.log("SKIP " + t.filename.slice(0, 30) + "… unreferenced"); skip++; continue; }

    // source video = the file entry whose thumb points here (all refs share it)
    const f0 = refs[0][1].files.find(f => f.thumb === t.filename);
    if (!f0 || !/^video\//.test(f0.mime || "")) { console.log("SKIP " + t.filename.slice(0, 30) + "… source not video (" + (f0 && f0.mime) + ")"); skip++; continue; }

    const vid = "/tmp/rg-src", th = "/tmp/rg-thumb.webp";
    try {
      await new Promise((res, rej) =>
        bucket.openDownloadStreamByName(f0.path).pipe(fs.createWriteStream(vid)).on("finish", res).on("error", rej));
      const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${vid}`)) || 0;
      const seek = dur > 0 ? (dur * PCT).toFixed(2) : "1";
      sh(`ffmpeg -y -ss ${seek} -i ${vid} -vframes 1 -vf "scale=w=${THUMB}:h=${THUMB}:force_original_aspect_ratio=decrease" -c:v libwebp -quality ${QUALITY} ${th}`);
      if (!fs.existsSync(th) || fs.statSync(th).size < 100) { console.log("FAIL " + t.filename.slice(0, 30) + "… no thumb produced"); fail++; continue; }
      const newSize = fs.statSync(th).size;

      const hash = t.filename.replace(/^\/\.media\/t_/, "");
      if (!(await bucket.find({ filename: dest }).toArray()).length) {   // rerun-safe
        await new Promise((res, rej) => fs.createReadStream(th)
          .pipe(bucket.openUploadStream(dest, { contentType: "image/webp", metadata: { sha256: hash, type: "media", lastModified: new Date() } }))
          .on("finish", res).on("error", rej));
      }

      for (const [coll, doc] of refs) {
        const i = doc.files.findIndex(f => f.thumb === t.filename);
        if (i < 0) { continue; }
        const set = {}; set["files." + i + ".thumb"] = dest;
        const unset = { innerCache: "", outerCache: "", previewCache: "", clearCache: "", alternativeCaches: "", hashedCache: "", previewHashedCache: "", outerHashedCache: "", outerClearCache: "" };
        const r = await db.collection(coll).updateOne({ _id: doc._id }, { $set: set, $unset: unset });
        console.log("OK " + coll + " /" + doc.boardUri + "/" + (doc.threadId || "") + (doc.postId ? "#" + doc.postId : "") +
          " " + Math.round(t.length / 1024) + "KB png -> " + Math.round(newSize / 1024) + "KB webp (matched=" + r.matchedCount + ")");
      }
      done++;
    } catch (e) { console.log("FAIL " + t.filename.slice(0, 30) + "… " + (e && e.message)); fail++; }
    try { fs.unlinkSync(vid); } catch (e) {} try { fs.unlinkSync(th); } catch (e) {}
  }
  await client.close();
  console.log("regenerated=" + done + " failed=" + fail + " skipped=" + skip);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FATAL", e && e.stack || e); process.exit(1); });
