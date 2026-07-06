# CLAUDE.md — rchan (LynxChan imageboard stack)

## ⛔ ABSOLUTE RULE #1: NEVER WIPE OR DELETE THE DATABASE — NO EXCEPTIONS

**Under NO circumstances** delete, drop, wipe, truncate, or mass-remove any of the
imageboard's data. This applies to the whole `lynxchan` MongoDB, every collection
(`threads`, `posts`, `boards`, `users`, `fs.files`, `fs.chunks`, …), the gridfs media,
and the `mongo-data/` files on disk. There is **no scenario** — cleanup, testing,
"just a test thread", refactor, reset — where wiping the DB is acceptable.

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

## Before ANY database operation
- Default to **read-only**. Anything that writes → take a mongodump first.
- For writes, scope to exact documents by `_id` and confirm the affected count is what you expect.
- Backups exist (`backup` service + `db-export.sh`) — verify/use them, never bypass with a destructive shortcut.

## Backups (the safety net)
- **`backup` service** → nightly `mongodump` (full DB incl. media) to Dropbox `rchan-backups/`, keeps last 14.
- **`db-export.sh`** (cron, daily) → content-only JSON to `db-export/*.json`, committed to git (no media, no secrets/IPs).
- `mongo-data/` is the ONLY irreplaceable state — treat it accordingly.

## Project
LynxChan + MongoDB in Docker behind DSM reverse proxy + Cloudflare. See `README.md` for
architecture, routing, overrides in `fe-overrides/`, and restore steps.
