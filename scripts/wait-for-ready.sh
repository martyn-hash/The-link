#!/bin/bash
# wait-for-ready.sh - Wait for the app to be fully ready before running tests
# Usage: ./scripts/wait-for-ready.sh [timeout_seconds]
# Default timeout: 60 seconds

set -e

TIMEOUT=${1:-60}
PORT=${PORT:-5000}
INTERVAL=2
ELAPSED=0

echo "[wait-for-ready] Waiting for app to be ready on port $PORT (timeout: ${TIMEOUT}s)..."

# First wait for /healthz (server is listening)
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -sf "http://127.0.0.1:$PORT/healthz" > /dev/null 2>&1; then
    echo "[wait-for-ready] /healthz OK - server is listening"
    break
  fi
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  echo "[wait-for-ready] Waiting for /healthz... (${ELAPSED}s elapsed)"
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "[wait-for-ready] TIMEOUT: /healthz not responding after ${TIMEOUT}s"
  exit 1
fi

# Now wait for /readyz (app is fully initialized)
while [ $ELAPSED -lt $TIMEOUT ]; do
  RESPONSE=$(curl -sf "http://127.0.0.1:$PORT/readyz" 2>&1 || true)
  if echo "$RESPONSE" | grep -q '"status":"ready"'; then
    echo "[wait-for-ready] /readyz OK - app is fully ready"
    echo "[wait-for-ready] Total wait time: ${ELAPSED}s"
    exit 0
  fi
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  echo "[wait-for-ready] Waiting for /readyz... (${ELAPSED}s elapsed)"
done

echo "[wait-for-ready] TIMEOUT: /readyz not ready after ${TIMEOUT}s"
exit 1
