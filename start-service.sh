#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"

if command -v lsof >/dev/null 2>&1; then
  LISTEN_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${LISTEN_PID}" ]]; then
    LISTEN_CMD="$(ps -p "$LISTEN_PID" -o command= 2>/dev/null || true)"
    if [[ "${LISTEN_CMD}" == *"server.py"* && "${LISTEN_CMD}" == *"--port ${PORT}"* ]]; then
      echo "Service is already running on http://${HOST}:${PORT} (pid ${LISTEN_PID})"
      exit 0
    fi
    echo "Cannot start service: ${HOST}:${PORT} is already in use (pid ${LISTEN_PID})."
    echo "Stop it first or run ./restart-service.sh"
    exit 1
  fi
fi

cd "$SCRIPT_DIR"
exec python3 server.py --host "$HOST" --port "$PORT"
