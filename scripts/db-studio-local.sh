#!/usr/bin/env bash
# Opens Prisma Studio connected to the local Docker PostgreSQL database.
#
# Usage:
#   ./scripts/db-studio-local.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting Prisma Studio for LOCAL database..."
echo "Database: backend/.env DATABASE_URL mapped to localhost:5433"
echo "Studio: http://localhost:5555"
echo

cd "$REPO_ROOT/backend"

database_url_line="$(grep '^DATABASE_URL=' .env | head -n1 || true)"
if [ -z "$database_url_line" ]; then
  echo "DATABASE_URL not found in backend/.env." >&2
  exit 1
fi

database_url="${database_url_line#DATABASE_URL=}"
# Backend containers use host `postgres:5432`; Prisma Studio from host must use exposed port `localhost:5433`.
export DATABASE_URL="${database_url/@postgres:5432/@localhost:5433}"

pnpm prisma studio
