#!/usr/bin/env bash
# Stream backend logs from the production server.
#
# Usage:
#   ./scripts/logs.sh          # streams api logs (default)
#   ./scripts/logs.sh worker   # streams worker logs
#   ./scripts/logs.sh api 100  # last 100 lines then stream

set -euo pipefail

SERVICE="${1:-api}"
TAIL="${2:-0}"

TAIL_FLAG=""
if [ "$TAIL" -gt 0 ] 2>/dev/null; then
  TAIL_FLAG="--tail=$TAIL"
fi

echo "Streaming logs for '$SERVICE' on production... (Ctrl+C to stop)"

ssh edwinfred@104.248.29.42 "cd ~/wendo-rms && docker compose logs $SERVICE -f $TAIL_FLAG"
