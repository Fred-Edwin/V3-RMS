#!/usr/bin/env bash
# Workforce slice 3: prove the Attendance migration on a COPY of the lane database.
# Never touches the lane database itself. The legacy shift, assignment and clock tables must be identical after, the switch
# defaults to off (no rows), a second run of the migration must fail cleanly or change nothing, and the events table is append-only.
#   usage: scripts/proof/attendance-migration-proof.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
MIG=$(ls -d prisma/schema/migrations/*_workforce_attendance | head -1)/migration.sql
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
SRC_DB=${DB_URL##*/}; SRC_DB=${SRC_DB%%\?*}
PROOF_DB="${SRC_DB}_proof"
ADMIN_URL="${DB_URL%/*}/postgres"
PROOF_URL="${DB_URL%/*}/${PROOF_DB}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

q() { psql "$PROOF_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }

echo "== copy $SRC_DB -> $PROOF_DB"
psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" -c "CREATE DATABASE \"$PROOF_DB\""
pg_dump "$DB_URL" | grep -v '^SET transaction_timeout' | psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null

echo "== put the copy back to before the migration (drop the attendance objects) and add legacy fixtures"
q -c 'DROP TABLE IF EXISTS shift_end_answers, attendance_site_switches, clock_events CASCADE' \
  -c 'DROP FUNCTION IF EXISTS clock_events_append_only() CASCADE' \
  -c 'DROP TYPE IF EXISTS "ShiftEndAnswerKind", "ClockEventSource", "ClockEventType"' >/dev/null
q -c "INSERT INTO shifts (id, organization_id, name, start_time, end_time, is_active, updated_at)
      SELECT 'proof-morning-' || o.id, o.id, 'Morning', '06:00', '14:00', true, now() FROM organizations o WHERE o.type = 'BRANCH' LIMIT 1" \
  -c "INSERT INTO shift_assignments (id, organization_id, shift_id, user_id, date, updated_at)
      SELECT 'proof-asg-' || e.id, e.organization_id, s.id, e.user_id, CURRENT_DATE, now()
      FROM employees e JOIN shifts s ON s.organization_id = e.organization_id AND s.id LIKE 'proof-morning-%'
      WHERE e.user_id IS NOT NULL AND e.tracks_time" \
  -c "INSERT INTO clock_records (id, organization_id, shift_assignment_id, user_id, clock_in_at, clock_in_method, updated_at)
      SELECT 'proof-clk-' || a.id, a.organization_id, a.id, a.user_id, now(), 'GPS', now() FROM shift_assignments a WHERE a.id LIKE 'proof-asg-%'" >/dev/null

legacy() {
  q -c "SELECT 'shifts ' || count(*) || ' ' || coalesce(md5(string_agg(s::text, '' ORDER BY id)), 'none') FROM shifts s" \
    -c "SELECT 'shift_assignments ' || count(*) || ' ' || coalesce(md5(string_agg(a::text, '' ORDER BY id)), 'none') FROM shift_assignments a" \
    -c "SELECT 'clock_records ' || count(*) || ' ' || coalesce(md5(string_agg(c::text, '' ORDER BY id)), 'none') FROM clock_records c" \
    -c "SELECT 'users ' || count(*) FROM users" -c "SELECT 'employees ' || count(*) FROM employees" -c "SELECT 'rota_entries ' || count(*) FROM rota_entries"
}

echo; echo "== legacy BEFORE"; legacy | tee "$TMP/before"
echo; echo "== apply the migration (additive DDL)"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null
legacy > "$TMP/after"
diff "$TMP/before" "$TMP/after" && echo "OK legacy tables identical after the migration"

echo; echo "== the switch defaults to off: no row for any site, and the new tables start empty"
[ "$(q -c 'SELECT count(*) FROM attendance_site_switches')" = "0" ] && echo "OK no switch rows (every site is off)"
[ "$(q -c 'SELECT count(*) FROM clock_events')" = "0" ] && echo "OK clock_events empty"

echo; echo "== a second run changes nothing (it must be refused, not half-applied)"
if psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1; then echo "FAIL second run applied"; exit 1; else echo "OK second run refused (objects already exist)"; fi
legacy > "$TMP/after2"
diff "$TMP/before" "$TMP/after2" && echo "OK nothing changed after the second run"

echo; echo "== the events table is append-only; a CORRECTION must name its target"
SITE=$(q -c "SELECT id FROM organizations WHERE type='BRANCH' LIMIT 1"); EMP=$(q -c "SELECT id FROM employees WHERE organization_id='$SITE' LIMIT 1")
q -c "INSERT INTO clock_events (id, organization_id, employee_id, shift_date, type, source, occurred_at) VALUES ('proof-ev','$SITE','$EMP',CURRENT_DATE,'IN','PHONE',now())" >/dev/null && echo "OK insert allowed"
if q -c "UPDATE clock_events SET reason='x' WHERE id='proof-ev'" >/dev/null 2>&1; then echo "FAIL update allowed"; exit 1; else echo "OK update refused"; fi
if q -c "DELETE FROM clock_events WHERE id='proof-ev'" >/dev/null 2>&1; then echo "FAIL delete allowed"; exit 1; else echo "OK delete refused"; fi
if q -c "TRUNCATE clock_events" >/dev/null 2>&1; then echo "FAIL truncate allowed"; exit 1; else echo "OK truncate refused"; fi
if q -c "INSERT INTO clock_events (id, organization_id, employee_id, shift_date, type, source, occurred_at) VALUES ('proof-c','$SITE','$EMP',CURRENT_DATE,'CORRECTION','MANAGER',now())" >/dev/null 2>&1; then echo "FAIL correction without target allowed"; exit 1; else echo "OK correction without a target refused"; fi
echo; echo "PROOF PASSED"
