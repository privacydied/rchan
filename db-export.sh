#!/bin/bash
# rchan — export git-friendly JSON of the content collections and commit any change.
#
# Text only: NO media (gridfs stays in the Dropbox mongodump archives) and NO secrets
# — user passwords, poster IPs (ip/asn/bypassId/proxyIp) and per-board ipSalt are all
# excluded via field whitelists below. Output is sorted by _id and pretty-printed so
# git shows a real diff whenever board content changes.
set -euo pipefail
cd "$(dirname "$0")"

OUT=db-export
mkdir -p "$OUT"

exp() { # exp <collection> <comma-separated field whitelist>
  docker exec rchan-mongo mongoexport --quiet --db lynxchan --collection "$1" \
    --fields "$2" --sort '{_id:1}' --jsonArray --pretty > "$OUT/$1.json"
}

exp boards  'boardUri,boardName,boardDescription,owner,settings,volunteers,anonymousName,tags,specialSettings,captchaMode,rules,lastPostId,threadCount,uniqueIps,postsPerHour'
exp threads 'threadId,boardUri,creation,subject,message,name,email,flag,flagName,signedRole,id,files,pinned,locked,cyclic,autoSage,lastBump,postCount,fileCount,page'
exp posts   'postId,threadId,boardUri,creation,subject,message,name,email,flag,flagName,signedRole,id,files'
exp users   'login,globalRole,ownedBoards,volunteeredBoards'

git add "$OUT"
if git diff --cached --quiet; then
  echo "[db-export] no content changes"
else
  git commit -q -m "db-export: refresh content JSON ($(date '+%Y-%m-%d %H:%M'))"
  # Distinguish "no remote configured" (expected/benign) from an actual push
  # failure (auth expiry, network, rejection) -- these used to be reported
  # identically, which silently masked a real, growing local-vs-remote
  # divergence in a cron job nobody watches interactively.
  if ! git remote | grep -q .; then
    echo "[db-export] committed (no remote configured to push to)"
  elif push_err=$(git push --quiet 2>&1); then
    echo "[db-export] committed + pushed"
  else
    echo "[db-export] committed but PUSH FAILED: $(echo "$push_err" | tail -1)"
  fi
fi
