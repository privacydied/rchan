// One-off: regenerate image thumbnails at higher resolution (thumbSize bumped to 480).
// Reads each original from gridfs, makes a new fit-480 thumb, replaces ONLY the thumb
// gridfs file (uploads new version first, then deletes the old _ids — never a missing
// window), and clears the referencing posts'/threads' rendered-HTML caches so they
// re-render with the new thumb dimensions. UPDATES/replaces thumbs only — never touches
// originals or deletes post data.
//   (default)    -> DRY RUN: report only, no writes, no deletes
//   DRY=0        -> LIVE: actually replace thumbs and delete the superseded gridfs docs.
//                   Per CLAUDE.md, take a fresh mongodump before running this way.
//   ONLY=<hash>  -> process just the thumbs whose filename contains <hash>
const { MongoClient, GridFSBucket } = require("mongodb-legacy");
const fs = require("fs");
const cp = require("child_process");
const THUMB = 480;
// Defaults to DRY (safe/report-only): this script's own live path deletes
// gridfs documents, so per CLAUDE.md's DB-safety rule it must default to
// read-only and require an explicit, deliberate opt-in (DRY=0) to write —
// not the other way around.
const DRY = process.env.DRY !== "0";
const ONLY = process.env.ONLY || "";
function sh(c) { return cp.execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }

(async () => {
  const client = await MongoClient.connect("mongodb://mongo:27017");
  const db = client.db("lynxchan");
  const bucket = new GridFSBucket(db);
  const q = { files: { $elemMatch: { mime: /^image\//, thumb: /^\/\.media\/t_/ } } };
  const docs = (await db.collection("posts").find(q).toArray()).map(d => ["posts", d])
    .concat((await db.collection("threads").find(q).toArray()).map(d => ["threads", d]));

  // group unique thumb filename -> { file, refs:[{coll,doc,i}] } (dedup: one image, many posts)
  const byThumb = new Map();
  for (const [coll, doc] of docs) {
    doc.files.forEach((f, i) => {
      if (!/^image\//.test(f.mime || "") || !/^\/\.media\/t_/.test(f.thumb || "")) { return; }
      if (ONLY && f.thumb.indexOf(ONLY) === -1) { return; }
      if (!byThumb.has(f.thumb)) { byThumb.set(f.thumb, { file: f, refs: [] }); }
      byThumb.get(f.thumb).refs.push({ coll, doc, i });
    });
  }
  console.log("unique image thumbs to process: " + byThumb.size + (DRY ? "  (DRY RUN)" : ""));

  let done = 0, fail = 0, skip = 0;
  for (const [thumbName, { file, refs }] of byThumb) {
    const ext = (file.path.match(/\.[^.]+$/) || [".bin"])[0];
    const orig = "/tmp/rgi_orig" + ext;
    try {
      const gdocs = await bucket.find({ filename: thumbName }).toArray();
      if (!gdocs.length) { console.log("  skip (no gridfs thumb) " + thumbName); skip++; continue; }
      const ctype = gdocs[0].contentType || "image/jpeg";
      const oext = ctype === "image/png" ? ".png" : (ctype === "image/gif" ? ".png" : ".jpg");
      const outp = "/tmp/rgi_thumb" + oext;

      await new Promise((res, rej) => bucket.openDownloadStreamByName(file.path, { revision: 0 })
        .pipe(fs.createWriteStream(orig)).on("finish", res).on("error", rej));

      // fit within 480x480, shrink-only (never upscale past the original)
      sh("convert '" + orig + "[0]' -auto-orient -strip -resize " + THUMB + "x" + THUMB + "\\> -quality 87 '" + outp + "'");
      if (!fs.existsSync(outp) || fs.statSync(outp).size < 80) { console.log("  FAIL (no thumb produced) " + thumbName); fail++; continue; }
      const dim = sh("identify -format '%wx%h' '" + outp + "'");
      const bytes = fs.statSync(outp).size;

      if (DRY) {
        console.log("  DRY " + thumbName.slice(9, 30) + "…  " + dim + "  " + bytes + "b  refs=" + refs.length);
        done++; fs.unlinkSync(orig); fs.unlinkSync(outp); continue;
      }

      // upload NEW version first (no missing-image window), then delete the OLD versions
      const oldIds = gdocs.map(g => g._id);
      await new Promise((res, rej) => fs.createReadStream(outp)
        .pipe(bucket.openUploadStream(thumbName, { contentType: ctype, metadata: { sha256: file.sha256, type: "media", lastModified: new Date() } }))
        .on("finish", res).on("error", rej));
      for (const id of oldIds) { await bucket.delete(id); }

      // clear rendered-HTML caches on every referencing post/thread so it re-renders @480
      const unset = { innerCache: "", outerCache: "", previewCache: "", clearCache: "", alternativeCaches: "", hashedCache: "", previewHashedCache: "", outerHashedCache: "", outerClearCache: "" };
      for (const r of refs) { await db.collection(r.coll).updateOne({ _id: r.doc._id }, { $unset: unset }); }

      console.log("  OK  " + thumbName.slice(9, 30) + "…  -> " + dim + "  " + bytes + "b  refs=" + refs.length);
      done++;
      fs.unlinkSync(orig); fs.unlinkSync(outp);
    } catch (e) {
      console.log("  ERR " + thumbName + ": " + (e && e.message));
      fail++;
      try { fs.unlinkSync(orig); } catch (e2) {}
    }
  }
  await client.close();
  console.log("done=" + done + " fail=" + fail + " skip=" + skip);
  process.exit(0);
})().catch(e => { console.error("FATAL", e && e.stack || e); process.exit(1); });
