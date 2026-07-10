#!/bin/sh
# fe-smoke.sh — post-deploy smoke tests for the front-end stack.
#
# Run standalone or from deploy-fe.sh. Checks, through the real router:
#   1. the key pages serve 200 (home, a live board catalog, a live thread,
#      the overboard) — board and thread discovered from the live JSON, so
#      nothing here goes stale when content churns,
#   2. the served (cache-busted) ux.js parses as JavaScript,
#   3. a canary list of feature entry points is present in the served bundle
#      (catches a bad module-concat order or a truncated build),
#   4. the router's sub_filter injection still places our script tags in HTML.
set -e
cd "$(dirname "$0")/.."
H='Host: boards.rchan.xyz'
B='http://127.0.0.1:8081'
fail=0

chk() { # $1 = path, $2 = expected status
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "$H" "$B$1")
  if [ "$code" = "$2" ]; then echo "  $1 -> $code"; else echo "  FAIL $1 -> $code (want $2)"; fail=1; fi
}

echo "pages:"
chk / 200
chk /overboard/ 200
board=$(curl -s -H "$H" "$B/boards.js?json=1" | grep -o '"boardUri":"[A-Za-z0-9]*"' | head -1 | cut -d'"' -f4)
if [ -n "$board" ]; then
  chk "/$board/catalog" 200
  thread=$(curl -s -H "$H" "$B/$board/catalog.json" | grep -o '"threadId":[0-9]*' | head -1 | grep -o '[0-9]*')
  # clean URL is the canonical spelling (SEO); the .html spelling must 301 to it
  [ -n "$thread" ] && chk "/$board/res/$thread" 200
  [ -n "$thread" ] && chk "/$board/res/$thread.html" 301
else
  echo "  FAIL couldn't discover a board from /boards.js"; fail=1
fi

echo "bundle:"
v=$(grep -o 'ux.js?v=[a-z0-9]*' nginx/default.conf | head -1)
tmp=$(mktemp /tmp/rchan-smoke-ux.XXXXXX.js)
curl -s -H "$H" "$B/.rchan/$v" > "$tmp"
if node --check "$tmp" 2>/dev/null; then echo "  ux.js parses"; else echo "  FAIL served ux.js does not parse"; fail=1; fi
for sym in buildNav openGallery openPalette toggleSetPanel markNewInThread \
           hookWatcherThrottle hookPostCapture initSitePresence toggleYoubox applyExtraFilters; do
  grep -q "$sym" "$tmp" || { echo "  FAIL canary missing: $sym"; fail=1; }
done
echo "  canaries present"
rm -f "$tmp"

echo "injection:"
if curl -s -H "$H" "$B/" | grep -q '/.rchan/ux.js?v='; then
  echo "  ux.js script tag injected"
else
  echo "  FAIL ux.js script tag missing from served HTML"; fail=1
fi

[ "$fail" = "0" ] && echo "SMOKE OK" || { echo "SMOKE FAILED"; exit 1; }
