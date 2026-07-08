#!/bin/sh
# deploy-fe.sh — roll out fe-overrides changes.
#
# Cloudflare edge-caches /.rchan/* and /.static/js/* and ignores browser hard
# refreshes, so every meaningful change needs a new ?v= cache key; and the
# router's single-file bind mounts pin the old inode until the container
# restarts. This script does both, deriving each token from the file's
# CONTENT hash (same content -> same token -> no pointless invalidation):
#
#   1. rewrites the ?v= tokens in nginx/default.conf from md5(file)
#   2. restarts rchan-landing (re-binds inodes, reloads the conf)
#   3. smoke-checks that the versioned URLs serve 200 through the router
#
# Run it after ANY edit to fe-overrides/{ux.css,ux.js,favicon.js,mod.js,
# tooltips.js} instead of hand-bumping numbers:
#   ./deploy-fe.sh
set -e
cd "$(dirname "$0")"
CONF=nginx/default.conf

bump() { # $1 = URL path in the conf, $2 = source file
  v=$(md5sum "$2" | cut -c1-8)
  sed -i "s|$1?v=[A-Za-z0-9]*|$1?v=$v|g" "$CONF"
  echo "  $1 -> ?v=$v"
}

echo "cache-bust tokens:"
bump "/.rchan/ux.css"           fe-overrides/ux.css
bump "/.rchan/ux.js"            fe-overrides/ux.js
bump "/.rchan/favicon.js"       fe-overrides/favicon.js
bump "/.rchan/mod.js"           fe-overrides/mod.js
bump "/.static/js/tooltips.js"  fe-overrides/tooltips.js

echo "restarting router..."
sudo docker restart rchan-landing >/dev/null
sleep 3

echo "smoke check:"
fail=0
for p in $(grep -o '/\.rchan/[a-z.]*?v=[A-Za-z0-9]*' "$CONF" | sort -u); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: boards.rchan.xyz' "http://127.0.0.1:8081$p")
  echo "  $p -> $code"
  [ "$code" = "200" ] || fail=1
done
[ "$fail" = "0" ] && echo "OK" || { echo "FAILED — a versioned URL is not serving"; exit 1; }
