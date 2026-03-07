#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SMOKE_PORT:-18080}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

export NODUS_DATA_DIR="${TMP_DIR}/data"
export NODUS_COMPONENTS_WRITE_TOKEN="smoke-token"
mkdir -p "${NODUS_DATA_DIR}/icons/custom"
cat > "${NODUS_DATA_DIR}/icons/custom/help.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-.9.8-1.6 1.2-1.6 2.6" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="12" cy="17.2" r="1" fill="currentColor"/>
</svg>
SVG

python3 "${ROOT_DIR}/server.py" --host 127.0.0.1 --port "${PORT}" >"${TMP_DIR}/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    break
  fi
  sleep 0.3
done

curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null

curl -sf -X POST "http://127.0.0.1:${PORT}/api/projects" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","name":"Demo"}' >/dev/null

curl -sf -X POST "http://127.0.0.1:${PORT}/api/contracts" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","contract_id":"main","name":"Main"}' >/dev/null

curl -sf -X POST "http://127.0.0.1:${PORT}/api/versions" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","contract_id":"main","version_id":"v0-2","default_schema_version":"v0_2"}' >/dev/null

curl -sf -X POST "http://127.0.0.1:${PORT}/api/screens" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","contract_id":"main","version_id":"v0-2","screen_id":"home","name":"Home","content_json":{"schemaVersion":"v0_2","type":"column","id":"form","children":[]}}' >/dev/null

curl -sf -X POST "http://127.0.0.1:${PORT}/api/publish" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","contract_id":"main","version_id":"v0-2"}' >/dev/null

curl -sf -X POST "http://127.0.0.1:${PORT}/api/components" \
  -H 'Content-Type: application/json' \
  -H 'X-Components-Token: smoke-token' \
  -d '{"type":"custom_text","title":{"ru":"Text","en":"Text"},"description":{"ru":"Desc","en":"Desc"},"fields":{"ru":"Fields","en":"Fields"},"template":{"type":"text","value":"Hi"}}' >/dev/null

curl -sf "http://127.0.0.1:${PORT}/api/components/export" >/dev/null

curl -sf -X POST "http://127.0.0.1:${PORT}/api/components/import?strategy=skip" \
  -H 'Content-Type: application/json' \
  -H 'X-Components-Token: smoke-token' \
  -d '{"items":[{"type":"custom_text","title":{"ru":"Text","en":"Text"},"description":{"ru":"Desc","en":"Desc"},"fields":{"ru":"Fields","en":"Fields"},"template":{"type":"text","value":"Hi"}}]}' >/dev/null

curl -sf "http://127.0.0.1:${PORT}/api/icons" | grep -q '"name": "help"'
curl -sf "http://127.0.0.1:${PORT}/assets/icons/custom/help" >/dev/null

curl -sf "http://127.0.0.1:${PORT}/metrics" | grep -q '^nodus_requests_total '
