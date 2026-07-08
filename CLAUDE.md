# CLAUDE.md — rchan (LynxChan imageboard stack)

## ⛔ ABSOLUTE RULE #1: NEVER WIPE OR DELETE THE DATABASE — NO EXCEPTIONS

**Under NO circumstances** delete, drop, wipe, truncate, or mass-remove any of the
imageboard's data. This applies to the whole `lynxchan` MongoDB, every collection
(`threads`, `posts`, `boards`, `users`, `fs.files`, `fs.chunks`, …), the gridfs media,
and the `mongo-data/` files on disk. There is **no scenario** — cleanup, testing,
"just a test thread", refactor, reset — where wiping the DB is acceptable.

**This means: DO NOT RUN THE COMMAND.** The rule is about *execution*, not just intent.
Never type, paste, `docker exec`, script, schedule, or otherwise **run** any command
that could delete/overwrite DB data — not "to test", not "temporarily", not as a hidden
sub-step of a larger task, not even if you plan to restore it after. If a command *could*
wipe data, it does not get run. Full stop. When in doubt, don't run it — ask first.

**Forbidden** unless the user explicitly asks for that exact operation *in the moment*
**and** a fresh verified backup was just taken:
- `deleteMany`, `deleteOne`, `remove`, `drop()`, `dropDatabase()`
- `updateMany` / bulk `$set`/`$unset` that can lose data
- `mongorestore --drop`, replacing/deleting `mongo-data/`
- `docker compose down -v`, `docker volume rm`, or anything that drops the DB volume
- deleting media from gridfs, or `mongoexport`/scripts that write back destructively

If something *seems* to require removing data (e.g. a stray test thread):
1. **Do not run a broad delete.** Never scope a delete by `boardUri` or any broad filter.
2. Target the exact single document by `_id`, and **show the user what will be removed**.
3. Take a backup first:
   `sudo docker exec rchan-mongo mongodump --db lynxchan --gzip --archive > /volume1/cloud/Dropbox/rchan-backups/rchan-manual-$(date +%Y%m%d-%H%M%S).archive.gz`
4. Get **explicit confirmation**. If unsure at all, **do nothing and ask.**

> Why this rule exists: a `deleteMany({boardUri:"rdr"})` meant to remove one test thread
> wiped the board's real content. No backup existed, so it was unrecoverable. This must
> never happen again — treat the DB as sacred.

## Regenerating a single thread's static HTML (non-destructive)
LynxChan generates board/thread pages JIT and caches each post's **rendered HTML** inside
the post document (`miscOps.individualCaches`: innerCache/outerCache/clearCache/…). If you
edit a post's file/thumb data directly in Mongo, the page will keep showing the OLD render
until that cache is cleared **and** the thread is rebuilt. To force a correct rebuild without
touching post content or losing data:
1. Clear the render cache on the affected posts — one `updateOne` per exact `postId`:
   `db.posts.updateOne({boardUri:"rdr",postId:ID},{$unset:{innerCache:"",outerCache:"",previewCache:"",clearCache:"",alternativeCaches:"",hashedCache:"",previewHashedCache:"",outerHashedCache:"",outerClearCache:""}})`
2. Trigger the running engine to re-render (it does the correct compressed JIT rebuild).
   Log in as admin and toggle a thread setting on then off — net-zero content change:
   - `curl -c cj -d login=... -d password=... "http://<lynxchan-ip>:8080/login.js?json=1"`
   - `curl -b cj -e "http://<lynxchan-ip>:8080/x" -d boardUri=rdr -d threadId=54 -d lock=1 "http://<lynxchan-ip>:8080/changeThreadSettings.js?json=1"` then the same **without** `lock` to restore.
   - The `Referer` host MUST equal the `Host` header (CSRF check in `formOps.checkReferer`).
   `setNewThreadSettings` does `process.send({board,thread})` → master rebuilds the thread.
Do NOT try to init the engine in a side-script (`require('./kernel')` re-runs boot → crash),
and do NOT hand-edit the gridfs page (it's gzip-compressed with a `.gz` sibling + dedup).
`tests/regen-video-thumbs.js` already clears these caches after updating a thumb.

## Before ANY database operation
- Default to **read-only**. Anything that writes → take a mongodump first.
- For writes, scope to exact documents by `_id` and confirm the affected count is what you expect.
- Backups exist (`backup` service + `db-export.sh`) — verify/use them, never bypass with a destructive shortcut.

## Backups (the safety net)
- **`backup` service** → nightly `mongodump` (full DB incl. media) to Dropbox `rchan-backups/`, keeps last 14.
- **`db-export.sh`** (cron, daily) → content-only JSON to `db-export/*.json`, committed to git (no media, no secrets/IPs).
- `mongo-data/` is the ONLY irreplaceable state — treat it accordingly.

## Workflow
- **Always commit after every change** — as soon as a change is deployed and verified,
  commit it (small, focused commits in the style of the existing history). Don't wait
  to be asked, and don't batch unrelated changes together.
- When `fe-overrides/ux.js` / `ux.css` / `favicon.js` change meaningfully, bump their
  `?v=` query string in `nginx/default.conf` (Cloudflare edge-caches them and ignores
  browser refreshes) and restart `rchan-landing` (single-file bind mounts pin the old
  inode until restart).

## Project
LynxChan + MongoDB in Docker behind DSM reverse proxy + Cloudflare. See `README.md` for
architecture, routing, overrides in `fe-overrides/`, and restore steps.
