#!/usr/bin/env bash
set -euo pipefail

METHOD="GET"
PATH_ONLY=""
DATA=""
BASE_URL="${TYPEFULLY_BASE_URL:-https://api.typefully.com}"

usage() {
  cat <<EOF
Usage:
  $0 --path "/v1/..." [--method GET|POST|PATCH|DELETE] [--data '{"k":"v"}']

Env:
  TYPEFULLY_API_KEY   (required)
  TYPEFULLY_BASE_URL  (optional, default: https://api.typefully.com)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --method)
      METHOD="$2"
      shift 2
      ;;
    --path)
      PATH_ONLY="$2"
      shift 2
      ;;
    --data)
      DATA="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${TYPEFULLY_API_KEY:-}" ]]; then
  echo "TYPEFULLY_API_KEY is required" >&2
  exit 1
fi

if [[ -z "$PATH_ONLY" ]]; then
  echo "--path is required" >&2
  exit 1
fi

URL="${BASE_URL}${PATH_ONLY}"

TMP_BODY="$(mktemp)"
TMP_STATUS="$(mktemp)"
trap 'rm -f "$TMP_BODY" "$TMP_STATUS"' EXIT

if [[ -n "$DATA" ]]; then
  curl -sS -X "$METHOD" "$URL" \
    -H "Authorization: Bearer ${TYPEFULLY_API_KEY}" \
    -H "Content-Type: application/json" \
    --data "$DATA" \
    -o "$TMP_BODY" \
    -w "%{http_code}" > "$TMP_STATUS"
else
  curl -sS -X "$METHOD" "$URL" \
    -H "Authorization: Bearer ${TYPEFULLY_API_KEY}" \
    -H "Content-Type: application/json" \
    -o "$TMP_BODY" \
    -w "%{http_code}" > "$TMP_STATUS"
fi

STATUS_CODE="$(cat "$TMP_STATUS")"
BODY="$(cat "$TMP_BODY")"

if [[ "$STATUS_CODE" -lt 200 || "$STATUS_CODE" -ge 300 ]]; then
  echo "Typefully API request failed" >&2
  echo "status=${STATUS_CODE} method=${METHOD} url=${URL}" >&2
  echo "$BODY" >&2
  exit 1
fi

echo "$BODY"
