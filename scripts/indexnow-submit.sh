#!/usr/bin/env bash
# IndexNow submission script.
#
# Tells participating search engines (Bing, Yandex, Seznam, Naver, ...)
# that one or more URLs have been added or updated. Google doesn't
# participate; Google Search Console covers that side.
#
# Usage:
#   ./scripts/indexnow-submit.sh https://midly.ai/foo https://midly.ai/bar
#   echo https://midly.ai/foo | ./scripts/indexnow-submit.sh
#   ./scripts/indexnow-submit.sh --all          # submit every public URL
#
# Notes on the key:
#   - The key value is intentionally public — it's hosted as a plain
#     text file at /<KEY>.txt and search engines verify ownership
#     by fetching that file. So checking it into the repo is fine.
#   - To rotate: pick a new random hex string, save it as
#     <NEWKEY>.txt at the repo root with the key as the file body,
#     update INDEXNOW_KEY below, delete the old keyfile, push.

set -euo pipefail

INDEXNOW_KEY="${INDEXNOW_KEY:-58ba14aed50dcd871830d20952526d42}"
HOST="${INDEXNOW_HOST:-midly.ai}"
ENDPOINT="${INDEXNOW_ENDPOINT:-https://api.indexnow.org/IndexNow}"
KEY_LOCATION="https://${HOST}/${INDEXNOW_KEY}.txt"

# Every public page on midly.ai — used when --all is passed.
# Keep in sync with sitemap.xml.
ALL_URLS=(
  "https://midly.ai/"
  "https://midly.ai/attorneys"
  "https://midly.ai/teams"
  "https://midly.ai/enterprise"
  "https://midly.ai/founders"
  "https://midly.ai/government"
  "https://midly.ai/how-it-works"
  "https://midly.ai/about"
  "https://midly.ai/security"
  "https://midly.ai/investor"
  "https://midly.ai/careers"
  "https://midly.ai/blog"
  "https://midly.ai/blog/counterparty-paper-15-minutes"
  "https://midly.ai/blog/grounded-ai-vs-generic"
  "https://midly.ai/blog/billable-time-captured-by-the-doc"
  "https://midly.ai/blog/client-portal-attorneys-actually-use"
  "https://midly.ai/blog/legacy-clm-broken-for-small-firms"
  "https://midly.ai/blog/7-deal-workflow-gaps"
  "https://midly.ai/blog/contracts-owned-by-legal"
  "https://midly.ai/blog/contract-workflow-cost"
  "https://midly.ai/blog/coordination-problem"
)

# Read URLs from args, stdin, or expand --all.
urls=()
if [[ "${1:-}" == "--all" ]]; then
  urls=("${ALL_URLS[@]}")
elif [[ $# -gt 0 ]]; then
  urls=("$@")
else
  # Read from stdin, one URL per line.
  while IFS= read -r line; do
    [[ -n "$line" ]] && urls+=("$line")
  done
fi

if [[ ${#urls[@]} -eq 0 ]]; then
  echo "[indexnow] No URLs to submit, exiting cleanly."
  exit 0
fi

# Cap at 10,000 URLs per IndexNow's documented limit. Anything past
# that gets quietly dropped.
if [[ ${#urls[@]} -gt 10000 ]]; then
  echo "[indexnow] WARNING: ${#urls[@]} URLs exceeds the 10,000 limit; truncating."
  urls=("${urls[@]:0:10000}")
fi

echo "[indexnow] Submitting ${#urls[@]} URL(s) to ${ENDPOINT}"
for u in "${urls[@]}"; do
  echo "  - $u"
done

# Build the JSON body. Use jq if available for safety; fall back to
# a hand-rolled join for environments without jq (CI runners usually
# have it, but local dev might not).
if command -v jq >/dev/null 2>&1; then
  body=$(jq -n --arg host "$HOST" --arg key "$INDEXNOW_KEY" --arg keyLoc "$KEY_LOCATION" \
    --argjson urls "$(printf '%s\n' "${urls[@]}" | jq -R . | jq -s .)" \
    '{host: $host, key: $key, keyLocation: $keyLoc, urlList: $urls}')
else
  # Hand-rolled join. URLs already validated above; quote them.
  url_json=""
  for u in "${urls[@]}"; do
    url_json+="\"${u//\"/\\\"}\","
  done
  url_json="[${url_json%,}]"
  body=$(cat <<EOF
{"host":"$HOST","key":"$INDEXNOW_KEY","keyLocation":"$KEY_LOCATION","urlList":$url_json}
EOF
)
fi

http_code=$(curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary "$body" \
  -o /tmp/indexnow-response.txt \
  -w "%{http_code}")

echo "[indexnow] Response: HTTP $http_code"
cat /tmp/indexnow-response.txt 2>/dev/null || true
echo

# IndexNow returns:
#   200 - submitted successfully
#   202 - accepted (queued; most common)
#   400 - bad request (invalid format)
#   403 - key not valid (key file not found or wrong content)
#   422 - URLs don't belong to the host
#   429 - too many requests
case "$http_code" in
  200|202)
    echo "[indexnow] OK"
    exit 0
    ;;
  *)
    echo "[indexnow] FAILED with HTTP $http_code"
    exit 1
    ;;
esac
