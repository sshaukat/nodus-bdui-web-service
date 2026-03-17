#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.server.pid}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"

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

if [[ ! -f "$PID_FILE" ]]; then
  PID_FROM_PORT=""
  if command -v lsof >/dev/null 2>&1; then
    PID_FROM_PORT="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  fi
  if [[ -n "${PID_FROM_PORT}" ]]; then
    CMD_FROM_PORT="$(ps -p "$PID_FROM_PORT" -o command= 2>/dev/null || true)"
    if [[ "${CMD_FROM_PORT}" == *"server.py"* && "${CMD_FROM_PORT}" == *"--port ${PORT}"* ]]; then
      stop_pid "$PID_FROM_PORT"
      echo "Service stopped (pid $PID_FROM_PORT)"
      exit 0
    fi
  fi
  echo "Service is not running (pid file not found: $PID_FILE)"
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"

if [[ -z "${PID}" ]]; then
  rm -f "$PID_FILE"
  echo "PID file was empty and has been removed"
else
  if kill -0 "$PID" 2>/dev/null; then
    stop_pid "$PID"
    rm -f "$PID_FILE"
    echo "Service stopped (pid $PID)"
    exit 0
  fi
  rm -f "$PID_FILE"
  echo "Service is not running (stale PID $PID removed)"
fi

if command -v lsof >/dev/null 2>&1; then
  PID_FROM_PORT="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${PID_FROM_PORT}" ]]; then
    CMD_FROM_PORT="$(ps -p "$PID_FROM_PORT" -o command= 2>/dev/null || true)"
    if [[ "${CMD_FROM_PORT}" == *"server.py"* && "${CMD_FROM_PORT}" == *"--port ${PORT}"* ]]; then
      stop_pid "$PID_FROM_PORT"
      echo "Service stopped (pid $PID_FROM_PORT)"
      exit 0
    fi
  fi
fi

echo "Service is not running"
