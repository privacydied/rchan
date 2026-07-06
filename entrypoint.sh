#!/bin/bash
# rchan / LynxChan entrypoint
set -euo pipefail

DB_HOST="${DB_HOST:-mongo}"
DB_PORT="${DB_PORT:-27017}"
BE=/lynxchan/src/be
STATE=/lynxchan/state
SENTINEL="${STATE}/.root-created"

cd "$BE"

echo "[rchan] waiting for mongo at ${DB_HOST}:${DB_PORT} ..."
until nc -z "$DB_HOST" "$DB_PORT"; do sleep 1; done
echo "[rchan] mongo reachable."

mkdir -p "$STATE"

# First-run only: create the root admin (global role 0). Guarded by a sentinel
# on the mounted ./state volume so it never runs twice.
if [ ! -f "$SENTINEL" ]; then
  if [ -n "${ROOT_USER:-}" ] && [ -n "${ROOT_PASS:-}" ]; then
    echo "[rchan] creating root account '${ROOT_USER}' ..."
    node boot.js -ca -l "$ROOT_USER" -p "$ROOT_PASS" -gr 0 -nd
    touch "$SENTINEL"
    echo "[rchan] root account created; sentinel written."
  else
    echo "[rchan] WARNING: ROOT_USER/ROOT_PASS not set — skipping root creation."
  fi
else
  echo "[rchan] root already provisioned (sentinel present)."
fi

echo "[rchan] starting LynxChan on :8080 ..."
# -rf rebuilds the front page on boot (shows the board list / stats). Requires
# topBoardsCount or frontPageStats set in settings/general.json. NOTE: this file is
# baked into the image (COPY in Dockerfile), so changes take effect on next rebuild.
exec node boot.js -rl -rb -rn -rt -ra -rs -rm -rmi -rf
