#!/usr/bin/env bash
# Workforce slice 2: prove the Rota migration (and the legacy carry-over) on a COPY of the lane database.
# Never touches the lane database itself. The legacy shift, assignment and clock tables must be identical after.
#   usage: scripts/proof/rota-migration-proof.sh
# Needs: psql, pg_dump on PATH; backend/.env with DATABASE_URL pointing at the lane database.
set -euo pipefail

cd "$(dirname "$0")/../.."
MIG=$(ls -d prisma/schema/migrations/*_workforce_rota | head -1)/migration.sql
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
SRC_DB=${DB_URL##*/}; SRC_DB=${SRC_DB%%\?*}
PROOF_DB="${SRC_DB}_proof"
ADMIN_URL="${DB_URL%/*}/postgres"
PROOF_URL="${DB_URL%/*}/${PROOF_DB}"

q() { psql "$PROOF_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }

echo "== copy $SRC_DB -> $PROOF_DB"
psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" -c "CREATE DATABASE \"$PROOF_DB\""
pg_dump "$DB_URL" | grep -v '^SET transaction_timeout' | psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null

legacy() {
  q -c "SELECT 'shifts ' || count(*) || ' ' || coalesce(md5(string_agg(s::text, '' ORDER BY id)), 'none') FROM shifts s" \
    -c "SELECT 'shift_assignments ' || count(*) || ' ' || coalesce(md5(string_agg(a::text, '' ORDER BY id)), 'none') FROM shift_assignments a" \
    -c "SELECT 'clock_records ' || count(*) || ' ' || coalesce(md5(string_agg(c::text, '' ORDER BY id)), 'none') FROM clock_records c" \
    -c "SELECT 'users ' || count(*) FROM users" -c "SELECT 'employees ' || count(*) FROM employees"
}
rota() {
  q -c "SELECT 'shift_templates ' || count(*) FROM shift_templates" -c "SELECT 'rota_weeks ' || count(*) FROM rota_weeks" \
    -c "SELECT 'rota_entries ' || count(*) FROM rota_entries"
}

echo; echo "== legacy BEFORE"; legacy | tee /tmp/rota_proof_before.$$
echo; echo "== apply the migration (additive DDL, raw SQL)"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null
echo "== legacy AFTER migration"; legacy > /tmp/rota_proof_after_mig.$$
diff /tmp/rota_proof_before.$$ /tmp/rota_proof_after_mig.$$ && echo "OK legacy tables identical after the migration"

echo; echo "== carry-over, run 1 and run 2 (the second must change nothing)"
export DATABASE_URL="$PROOF_URL"
pnpm exec tsx src/scripts/rota-carry-over.ts
rota > /tmp/rota_proof_r1.$$; cat /tmp/rota_proof_r1.$$
pnpm exec tsx src/scripts/rota-carry-over.ts
rota > /tmp/rota_proof_r2.$$
diff /tmp/rota_proof_r1.$$ /tmp/rota_proof_r2.$$ && echo "OK second carry-over run changed nothing"
legacy > /tmp/rota_proof_after_co.$$
diff /tmp/rota_proof_before.$$ /tmp/rota_proof_after_co.$$ && echo "OK legacy tables identical after the carry-over"
echo; echo "PROOF PASSED"
