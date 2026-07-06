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
  if git push --quiet 2>/dev/null; then
    echo "[db-export] committed + pushed"
  else
    echo "[db-export] committed (no remote configured to push to)"
  fi
fi
