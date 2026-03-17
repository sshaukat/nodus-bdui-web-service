#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.server.pid}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/.server.log}"

stop_pid() {
  local target_pid="$1"
  if ! kill -0 "$target_pid" 2>/dev/null; then
    return 0
  fi

  kill "$target_pid"
  for _ in {1..25}; do
    if ! kill -0 "$target_pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  if kill -0 "$target_pid" 2>/dev/null; then
    kill -9 "$target_pid"
  fi
}

"$SCRIPT_DIR/stop-service.sh" >/dev/null 2>&1 || true

if command -v lsof >/dev/null 2>&1; then
  LISTEN_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${LISTEN_PID}" ]]; then
    LISTEN_CMD="$(ps -p "$LISTEN_PID" -o command= 2>/dev/null || true)"
    if [[ "${LISTEN_CMD}" == *"server.py"* && "${LISTEN_CMD}" == *"--port ${PORT}"* ]]; then
      stop_pid "$LISTEN_PID"
    else
      echo "Cannot restart service: ${HOST}:${PORT} is in use by pid ${LISTEN_PID}."
      echo "Process: ${LISTEN_CMD}"
      exit 1
    fi
  fi
fi

cd "$SCRIPT_DIR"
nohup python3 server.py --host "$HOST" --port "$PORT" >>"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" >"$PID_FILE"

sleep 0.4
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Failed to start service. Check log: $LOG_FILE"
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  HEALTH_URL="http://$HOST:$PORT/api/health"
  READY=0
  for _ in {1..20}; do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 0.2
  done

  if [[ "$READY" -ne 1 ]]; then
    echo "Process started but health check failed: $HEALTH_URL"
    echo "Check log: $LOG_FILE"
    exit 1
  fi
fi

echo "Service restarted"
echo "PID: $PID"
echo "URL: http://$HOST:$PORT"
echo "Log: $LOG_FILE"
