// One-off: regenerate VIDEO thumbnails at higher resolution (thumbSize bumped to 480;
// the earlier image regen never touched videos, which go through a separate ffmpeg
// frame-extraction path — fixvideothumbs.js). Mirrors regen-image-thumbs.js's safety
// pattern exactly: reads the original from gridfs, extracts a frame at the same seek
// percentage the engine uses (videoThumbPercentage), scales to fit 480x480 (shrink-only),
// replaces ONLY the thumb gridfs file (uploads new version first, then deletes the old
// _ids -- never a missing-image window), and clears the referencing posts'/threads'
// rendered-HTML caches. UPDATES/replaces thumbs only -- never touches originals or
// deletes post data.
//   DRY=1        -> report only, no writes
//   ONLY=<hash>  -> process just the thumb whose filename contains <hash>
const { MongoClient, GridFSBucket } = require("mongodb-legacy");
const fs = require("fs");
const cp = require("child_process");
const THUMB = 480, PCT = 0.25;   // matches settings/general.json videoThumbPercentage
const DRY = process.env.DRY === "1";
const ONLY = process.env.ONLY || "";
function sh(c) { return cp.execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }

(async () => {
  const client = await MongoClient.connect("mongodb://mongo:27017");
  const db = client.db("lynxchan");
  const bucket = new GridFSBucket(db);
  const q = { files: { $elemMatch: { mime: /^video\//, thumb: /^\/\.media\/t_/ } } };
  const docs = (await db.collection("posts").find(q).toArray()).map(d => ["posts", d])
    .concat((await db.collection("threads").find(q).toArray()).map(d => ["threads", d]));

  var byThumb = new Map();
  for (const [coll, doc] of docs) {
    doc.files.forEach((f, i) => {
      if (!/^video\//.test(f.mime || "") || !/^\/\.media\/t_/.test(f.thumb || "")) { return; }
      if (ONLY && f.thumb.indexOf(ONLY) === -1) { return; }
      if (!byThumb.has(f.thumb)) { byThumb.set(f.thumb, { file: f, refs: [] }); }
      byThumb.get(f.thumb).refs.push({ coll, doc, i });
    });
  }
  console.log("unique video thumbs to check: " + byThumb.size + (DRY ? "  (DRY RUN)" : ""));

  let done = 0, fail = 0, skip = 0;
  for (const [thumbName, { file, refs }] of byThumb) {
    const vid = "/tmp/rgv.mp4", th = "/tmp/rgv.png";
    try {
      const gdocs = await bucket.find({ filename: thumbName }).toArray();
      if (!gdocs.length) { console.log("  skip (no gridfs thumb) " + thumbName); skip++; continue; }

      // check current thumb size first -- skip if already >= THUMB on its long edge
      await new Promise((res, rej) => bucket.openDownloadStreamByName(thumbName, { revision: 0 })
        .pipe(fs.createWriteStream(th)).on("finish", res).on("error", rej));
      const curDim = sh("identify -format '%wx%h' '" + th + "'").split("x").map(Number);
      const curMax = Math.max(curDim[0] || 0, curDim[1] || 0);
      fs.unlinkSync(th);
      if (curMax >= THUMB) { console.log("  skip (already " + curDim.join("x") + ") " + thumbName.slice(9, 25)); skip++; continue; }

      await new Promise((res, rej) => bucket.openDownloadStreamByName(file.path, { revision: 0 })
        .pipe(fs.createWriteStream(vid)).on("finish", res).on("error", rej));
      const wh = sh("ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 " + vid).split(",");
      const w = parseInt(wh[0], 10), h = parseInt(wh[1], 10);
      const dur = parseFloat(sh("ffprobe -v error -show_entries format=duration -of csv=p=0 " + vid)) || 0;
      if (!w || !h) { console.log("  #" + thumbName.slice(9, 25) + ": no dimensions, skip"); fail++; continue; }
      let tw, tht;
      if (w > h) { tw = THUMB; tht = Math.floor(h * (THUMB / w)); } else { tht = THUMB; tw = Math.floor(w * (THUMB / h)); }
      const seek = dur > 0 ? (dur * PCT).toFixed(2) : "1";
      sh("ffmpeg -y -ss " + seek + " -i " + vid + " -vframes 1 -vf scale=" + tw + ":" + tht + " " + th);
      if (!fs.existsSync(th) || fs.statSync(th).size < 100) { console.log("  FAIL (no thumb produced) " + thumbName); fail++; continue; }
      const dim = sh("identify -format '%wx%h' '" + th + "'");
      const bytes = fs.statSync(th).size;

      if (DRY) {
        console.log("  DRY " + thumbName.slice(9, 25) + "…  " + dim + "  " + bytes + "b  refs=" + refs.length);
        done++; fs.unlinkSync(vid); fs.unlinkSync(th); continue;
      }

      const oldIds = gdocs.map(g => g._id);
      await new Promise((res, rej) => fs.createReadStream(th)
        .pipe(bucket.openUploadStream(thumbName, { contentType: "image/png", metadata: { sha256: file.sha256, type: "media", lastModified: new Date() } }))
        .on("finish", res).on("error", rej));
      for (const id of oldIds) { await bucket.delete(id); }

      const unset = { innerCache: "", outerCache: "", previewCache: "", clearCache: "", alternativeCaches: "", hashedCache: "", previewHashedCache: "", outerHashedCache: "", outerClearCache: "" };
      for (const r of refs) { await db.collection(r.coll).updateOne({ _id: r.doc._id }, { $unset: unset }); }

      console.log("  OK  " + thumbName.slice(9, 25) + "…  -> " + dim + "  " + bytes + "b  refs=" + refs.length);
      done++;
      fs.unlinkSync(vid); fs.unlinkSync(th);
    } catch (e) {
      console.log("  ERR " + thumbName + ": " + (e && e.message));
      fail++;
      try { fs.unlinkSync(vid); } catch (e2) {}
      try { fs.unlinkSync(th); } catch (e3) {}
    }
  }
  await client.close();
  console.log("done=" + done + " fail=" + fail + " skip=" + skip);
  process.exit(0);
})().catch(e => { console.error("FATAL", e && e.stack || e); process.exit(1); });
