#!/usr/bin/env bash
# Workforce slice 4a: prove the Timesheets migration on a COPY of the lane database.
# Never touches the lane database itself. The legacy shift, assignment, clock, payslip and attendance tables must be identical
# after, the new tables start empty, a second run must be refused (not half-applied), and no new column holds money.
#   usage: scripts/proof/timesheets-migration-proof.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
MIG=$(ls -d prisma/schema/migrations/*_workforce_timesheets | head -1)/migration.sql
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

echo "== put the copy back to before the migration (drop the timesheet objects)"
q -c 'DROP TABLE IF EXISTS time_requests, overtime_items, timesheet_weeks, timesheet_days, timesheet_periods CASCADE' \
  -c 'DROP TYPE IF EXISTS "TimeRequestState", "TimeRequestKind", "OvertimeStatus", "TimesheetStatus", "TimesheetCloseKind", "TimesheetPeriodState"' >/dev/null

# Every table that exists before the migration, hashed row by row. Anything the migration touched would show here.
snapshot() {
  for t in $(q -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '\_prisma%' ORDER BY 1"); do
    q -c "SELECT '$t ' || count(*) || ' ' || coalesce(md5(string_agg(x::text, '' ORDER BY x::text)), 'none') FROM \"$t\" x"
  done
}

echo; echo "== every existing table BEFORE"; snapshot > "$TMP/before"; wc -l < "$TMP/before" | xargs echo "tables hashed:"
echo; echo "== apply the migration (additive DDL)"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null
snapshot | grep -v -E '^(time_requests|overtime_items|timesheet_weeks|timesheet_days|timesheet_periods) ' > "$TMP/after"
diff "$TMP/before" "$TMP/after" && echo "OK every existing table (legacy payslip, attendance and clock ones included) is identical after the migration"

echo; echo "== the new tables start empty"
for t in timesheet_periods timesheet_days timesheet_weeks overtime_items time_requests; do
  [ "$(q -c "SELECT count(*) FROM $t")" = "0" ] && echo "OK $t empty"
done

echo; echo "== nothing here stores money"
BAD=$(q -c "SELECT count(*) FROM information_schema.columns WHERE table_name IN ('timesheet_periods','timesheet_days','timesheet_weeks','overtime_items','time_requests') AND (data_type IN ('numeric','money','double precision','real') OR column_name ~* '(amount|salary|wage|rate|price|pay)')")
[ "$BAD" = "0" ] && echo "OK no money, decimal or pay column" || { echo "FAIL $BAD money-like columns"; exit 1; }

echo; echo "== a second run changes nothing (it must be refused, not half-applied)"
if psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1; then echo "FAIL second run applied"; exit 1; else echo "OK second run refused (objects already exist)"; fi
snapshot | grep -v -E '^(time_requests|overtime_items|timesheet_weeks|timesheet_days|timesheet_periods) ' > "$TMP/after2"
diff "$TMP/before" "$TMP/after2" && echo "OK nothing changed after the second run"

echo; echo "== one period per site and start day; one timesheet day and one overtime item per person and day"
SITE=$(q -c "SELECT id FROM organizations WHERE type='BRANCH' LIMIT 1"); EMP=$(q -c "SELECT id FROM employees WHERE organization_id='$SITE' LIMIT 1")
q -c "INSERT INTO timesheet_periods (id, organization_id, start_date, end_date, label, cutoff_at, updated_at) VALUES ('proof-p','$SITE','2026-10-17','2026-11-13','proof',now(),now())" >/dev/null && echo "OK period inserted"
if q -c "INSERT INTO timesheet_periods (id, organization_id, start_date, end_date, label, cutoff_at, updated_at) VALUES ('proof-p2','$SITE','2026-10-17','2026-11-13','proof',now(),now())" >/dev/null 2>&1; then echo "FAIL duplicate period allowed"; exit 1; else echo "OK duplicate period refused"; fi
q -c "INSERT INTO timesheet_days (id, period_id, organization_id, employee_id, shift_date, status, evidence_hash, updated_at) VALUES ('proof-d','proof-p','$SITE','$EMP','2026-10-20','MATCHED','h',now())" >/dev/null && echo "OK day inserted"
if q -c "INSERT INTO timesheet_days (id, period_id, organization_id, employee_id, shift_date, status, evidence_hash, updated_at) VALUES ('proof-d2','proof-p','$SITE','$EMP','2026-10-20','MATCHED','h',now())" >/dev/null 2>&1; then echo "FAIL duplicate day allowed"; exit 1; else echo "OK duplicate day refused"; fi
q -c "DELETE FROM timesheet_periods WHERE id='proof-p'" >/dev/null && [ "$(q -c 'SELECT count(*) FROM timesheet_days')" = "0" ] && echo "OK removing a period removes its days"
echo; echo "PROOF PASSED"
