#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.server.pid}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/.server.log}"

"$SCRIPT_DIR/stop-service.sh" >/dev/null 2>&1 || true

cd "$SCRIPT_DIR"
nohup python3 server.py --host "$HOST" --port "$PORT" >>"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" >"$PID_FILE"

sleep 0.4
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Failed to start service. Check log: $LOG_FILE"
  exit 1
fi

echo "Service restarted"
echo "PID: $PID"
echo "URL: http://$HOST:$PORT"
echo "Log: $LOG_FILE"
