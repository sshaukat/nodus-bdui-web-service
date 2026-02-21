#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.server.pid}"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Service is not running (pid file not found: $PID_FILE)"
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"

if [[ -z "${PID}" ]]; then
  rm -f "$PID_FILE"
  echo "PID file was empty and has been removed"
  exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "Service is not running (stale PID $PID removed)"
  exit 0
fi

kill "$PID"

for _ in {1..25}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 0.2
done

if kill -0 "$PID" 2>/dev/null; then
  kill -9 "$PID"
fi

rm -f "$PID_FILE"
echo "Service stopped (pid $PID)"
