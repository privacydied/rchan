#!/bin/sh
# deploy-fe.sh — roll out fe-overrides changes.
#
# Cloudflare edge-caches /.rchan/* and /.static/js/* and ignores browser hard
# refreshes, so every meaningful change needs a new ?v= cache key; and EVERY
# single-file bind mount here (router AND engine) pins the old inode until
# ITS OWN container restarts — editing the host file in place does not make
# a running container see the new content. This script handles both:
#
#   1. rewrites the ?v= tokens in nginx/default.conf from md5(file)
#   2. restarts rchan-lynxchan FIRST when tooltips.js/catalog.js/themes.js
#      changed (re-binds ITS inodes — these are mounted straight into the
#      engine's own static dir, not served by the router at all) and waits
#      for it to answer again. Skipped when none of those three files
#      changed this run, since a full engine restart drops live WebSocket
#      connections board-wide — no reason to pay that for a ux.css-only
#      change.
#   3. restarts rchan-landing (re-binds its inodes: ux.css/js, theme CSS,
#      favicon.js, mod.js, predark.js — and starts the router pointing at
#      the new ?v= URLs). MUST come after step 2, not before: nginx begins
#      referencing e.g. catalog.js?v=NEWHASH the instant it restarts, and if
#      lynxchan hasn't rolled over to the matching content yet, any request
#      landing in that gap (including Cloudflare's own edge, which caches
#      /.static/js/* for up to an hour) gets the OLD content permanently
#      wired to the NEW url — the exact thing versioning exists to prevent.
#      Learned this the hard way: an out-of-order restart here once left one
#      Cloudflare PoP serving a stale catalog.js under a "fresh" hash for the
#      better part of an hour, invisible from the origin side.
#   4. smoke-checks that the versioned URLs serve 200 through the router
#
# Run it after ANY edit to fe-overrides/{src/*,ux.css,favicon.js,mod.js,
# tooltips.js,catalog.js,themes.js} instead of hand-bumping numbers:
#   ./deploy-fe.sh
set -e
cd "$(dirname "$0")"
CONF=nginx/default.conf

# ---- build: ux.js is generated from fe-overrides/src/*.js (numeric order) ----
# Edit the modules, never ux.js directly; the artifact stays committed because
# the router bind-mounts it. A failed parse aborts the deploy.
# Minified with esbuild when available (once: npm install --no-save esbuild) —
# whitespace+syntax only, identifiers KEPT so smoke canaries and stack traces
# stay readable. Falls back to unminified rather than failing the deploy.
if [ -d fe-overrides/src ]; then
  echo "building ux.js from fe-overrides/src/ ($(ls fe-overrides/src/*.js | wc -l | tr -d ' ') modules)..."
  cat fe-overrides/src/*.js > fe-overrides/ux.new.js
  node --check fe-overrides/ux.new.js
  if [ -x node_modules/.bin/esbuild ]; then
    node_modules/.bin/esbuild fe-overrides/ux.new.js --minify-whitespace --minify-syntax \
      --charset=utf8 --log-level=error --outfile=fe-overrides/ux.min.js
    node --check fe-overrides/ux.min.js
    mv fe-overrides/ux.min.js fe-overrides/ux.js
    rm -f fe-overrides/ux.new.js
    echo "  minified: $(wc -c < fe-overrides/ux.js | tr -d ' ') bytes (source $(cat fe-overrides/src/*.js | wc -c | tr -d ' '))"
  else
    echo "  (esbuild missing — serving unminified; npm install --no-save esbuild)"
    mv fe-overrides/ux.new.js fe-overrides/ux.js
  fi
fi

bump() { # $1 = URL path in the conf, $2 = source file
  v=$(md5sum "$2" | cut -c1-8)
  sed -i "s|$1?v=[A-Za-z0-9]*|$1?v=$v|g" "$CONF"
  echo "  $1 -> ?v=$v"
}

echo "cache-bust tokens:"
bump "/.rchan/ux.css"           fe-overrides/ux.css
bump "/.rchan/ux.js"            fe-overrides/ux.js
# Per-theme CSS layers (split out of ux.css). Their URLs live in the
# RCHAN_TCSS <head> map (theme-*.css?v=…), so the same bump() rewrite versions
# them there exactly like a <link>/<script> tag.
bump "/.rchan/theme-academia.css"  fe-overrides/theme-academia.css
bump "/.rchan/theme-brutalist.css" fe-overrides/theme-brutalist.css
bump "/.rchan/favicon.js"       fe-overrides/favicon.js
bump "/.rchan/mod.js"           fe-overrides/mod.js
bump "/.rchan/predark.js"       fe-overrides/predark.js
bump "/.static/js/tooltips.js"  fe-overrides/tooltips.js
bump "/.static/js/catalog.js"   fe-overrides/catalog.js
bump "/.static/js/themes.js"    fe-overrides/themes.js

# ---- engine restart FIRST: only for the 3 files actually bind-mounted into
# rchan-lynxchan (tooltips.js/catalog.js/themes.js). Tracked by hash in
# state/ so an unrelated deploy (ux.css, ux.js, favicon.js, ...) never
# restarts the engine — that drops every live WebSocket board-wide, so it's
# worth skipping whenever nothing engine-side actually changed. Must
# complete (and be serving the new content) BEFORE the router restart below
# starts pointing anyone at the new ?v= URLs — see the ordering note up top.
STATEFILE=state/deployed-engine-hashes
ENGINE_FILES="fe-overrides/tooltips.js fe-overrides/catalog.js fe-overrides/themes.js"
NEW_HASHES=$(md5sum $ENGINE_FILES 2>/dev/null)
OLD_HASHES=$(cat "$STATEFILE" 2>/dev/null || true)
if [ "$NEW_HASHES" != "$OLD_HASHES" ]; then
  echo "engine-mounted files changed — restarting lynxchan (drops live WS connections)..."
  sudo docker restart rchan-lynxchan >/dev/null
  echo "  waiting for lynxchan to answer..."
  ok=0
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: boards.rchan.xyz' "http://127.0.0.1:8081/gen/catalog" || true)
    if [ "$code" = "200" ]; then ok=1; break; fi
    sleep 1
  done
  [ "$ok" = "1" ] && echo "  lynxchan is back (${i}s)" || { echo "  FAILED — lynxchan did not come back within 30s"; exit 1; }
  echo "$NEW_HASHES" > "$STATEFILE"
else
  echo "engine-mounted files unchanged — skipping lynxchan restart"
fi

echo "restarting router..."
sudo docker restart rchan-landing >/dev/null
sleep 3

echo "smoke check:"
fail=0
for p in $(grep -o '/\.rchan/[a-z.-]*?v=[A-Za-z0-9]*' "$CONF" | sort -u); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: boards.rchan.xyz' "http://127.0.0.1:8081$p")
  echo "  $p -> $code"
  [ "$code" = "200" ] || fail=1
done
[ "$fail" = "0" ] && echo "OK" || { echo "FAILED — a versioned URL is not serving"; exit 1; }

echo "smoke tests:"
sh tests/fe-smoke.sh
