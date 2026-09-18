#!/usr/bin/env bash
# Opens Prisma Studio connected to the production database via SSH tunnel.
# Tunnel is automatically opened before Studio starts and closed when Studio exits.
#
# Usage:
#   ./scripts/db-studio.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

read -rsp "Postgres password: " PG_PASSWORD
echo

echo "Opening SSH tunnel (localhost:5433 -> server:5433)..."
ssh -L 5433:localhost:5433 edwinfred@104.248.29.42 -N &
TUNNEL_PID=$!

cleanup() {
  echo
  echo "Closing SSH tunnel..."
  kill "$TUNNEL_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT

sleep 2

echo "Tunnel open (PID $TUNNEL_PID). Starting Prisma Studio..."
echo "Studio will open at http://localhost:5555"
echo

export DATABASE_URL="postgresql://wendo_user:${PG_PASSWORD}@localhost:5433/wendo_rms"
cd "$REPO_ROOT/backend"
pnpm prisma studio
