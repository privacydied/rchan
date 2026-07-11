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
# Run it after ANY edit to fe-overrides/{src/*,ux.css,favicon.js,mod.js,
# tooltips.js} instead of hand-bumping numbers:
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
