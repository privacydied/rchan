# tests / maintenance scripts

Ad-hoc integration tests and one-off repair scripts for the rchan stack. They run against
the **live** containers (mongo / lynxchan) over the Docker network. Most are **non-destructive**
— they never delete DB data (see the no-wipe rule in `../CLAUDE.md`). The exceptions —
`regen-image-thumbs.js`, `regen-image-thumbs-webp.js`, `regen-video-thumbs-480.js` — replace
gridfs thumbnail files in place and delete the superseded ones; each **defaults to a dry run**
(report only, no writes) and requires an explicit `DRY=0` to actually write/delete. Take a
fresh mongodump first when running any of them with `DRY=0`, per `../CLAUDE.md`.

## ws-live-update.js — WebSocket live-update integration test
Verifies that new activity in a thread is pushed to subscribed clients over the WebSocket
(`/.ws`). Subscribes a socket to a thread, edits an existing post to trigger a broadcast, and
asserts the socket receives it. Exit code 0 = delivered.

```sh
RP=$(grep ^ROOT_PASS= ../.env | cut -d= -f2-)
docker cp ws-live-update.js rchan-lynxchan:/tmp/ws-live-update.js
docker exec -e RP="$RP" -e NODE_PATH=/lynxchan/src/be/node_modules \
  rchan-lynxchan node /tmp/ws-live-update.js
docker exec rchan-lynxchan rm -f /tmp/ws-live-update.js
```
Configurable via env (`BOARD`, `THREAD`, `EDIT_POST`, `EDIT_MSG`, …) — see the header comment.
Note: the edit leaves an "edited by admin" marker on the target post (content unchanged).

## regen-video-thumbs.js — regenerate video thumbnails
Repairs video posts that fell back to `/genericThumb.png`: reads the video from gridfs,
extracts a frame with ffmpeg, stores a real thumb, fixes the post's thumb + dimensions, and
clears the post's render cache so the thread re-renders. UPDATES only, never deletes.

```sh
docker cp regen-video-thumbs.js rchan-lynxchan:/tmp/regen-video-thumbs.js
docker exec -e NODE_PATH=/lynxchan/src/be/node_modules \
  rchan-lynxchan node /tmp/regen-video-thumbs.js
docker exec rchan-lynxchan rm -f /tmp/regen-video-thumbs.js
```
After it runs, trigger a thread rebuild (see the "Regenerating a single thread's static HTML"
section in `../CLAUDE.md`).
