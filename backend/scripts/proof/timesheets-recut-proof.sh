#!/usr/bin/env bash
# Workforce slice 4a follow-up: prove the calendar-month re-cut on a COPY of the lane database.
# Never touches the lane database itself. It builds old-shaped data on the copy (a closed four-week period, two open
# four-week periods with days, a week and an overtime item), runs the re-cut migration, and checks: no day, exception or
# overtime item is lost, the closed period is untouched, months start after it, the other tables are identical, and a
# second run changes nothing.
#   usage: scripts/proof/timesheets-recut-proof.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
MIG=$(ls -d prisma/schema/migrations/*_workforce_timesheet_calendar_month | head -1)/migration.sql
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
SRC_DB=${DB_URL##*/}; SRC_DB=${SRC_DB%%\?*}
PROOF_DB="${SRC_DB}_recut_proof"
ADMIN_URL="${DB_URL%/*}/postgres"
PROOF_URL="${DB_URL%/*}/${PROOF_DB}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

q() { psql "$PROOF_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
ok() { echo "OK $1"; }
fail() { echo "FAIL $1"; exit 1; }

echo "== copy $SRC_DB -> $PROOF_DB"
psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" -c "CREATE DATABASE \"$PROOF_DB\""
pg_dump "$DB_URL" | grep -v '^SET transaction_timeout' | psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null

SITE=$(q -c "SELECT id FROM organizations WHERE type='BRANCH' LIMIT 1"); EMP=$(q -c "SELECT id FROM employees WHERE organization_id='$SITE' LIMIT 1")
[ -n "$SITE" ] && [ -n "$EMP" ] || fail "the lane database has no branch and employee to build the proof data on"

echo "== old-shaped data on the copy"
q <<SQL >/dev/null
DELETE FROM timesheet_periods;
INSERT INTO timesheet_periods (id, organization_id, start_date, end_date, label, cutoff_at, state, closed_at, close_kind, updated_at) VALUES
  ('rc-closed', '$SITE', '2026-09-21', '2026-10-16', '21 Sep to 18 Oct 2026', '2026-10-16 15:00', 'CLOSED', now(), 'AUTO', now());
INSERT INTO timesheet_periods (id, organization_id, start_date, end_date, label, cutoff_at, updated_at) VALUES
  ('rc-old1', '$SITE', '2026-10-17', '2026-11-13', '19 Oct to 15 Nov 2026', '2026-11-13 15:00', now()),
  ('rc-old2', '$SITE', '2026-11-14', '2026-12-11', '16 Nov to 13 Dec 2026', '2026-12-11 15:00', now());
INSERT INTO timesheet_days (id, period_id, organization_id, employee_id, shift_date, status, evidence_hash, scheduled_minutes, worked_minutes, updated_at) VALUES
  ('rc-d1', 'rc-closed', '$SITE', '$EMP', '2026-10-15', 'APPROVED',      'h', 480, 480, now()),
  ('rc-d2', 'rc-old1',   '$SITE', '$EMP', '2026-10-20', 'AUTO_APPROVED', 'h', 480, 480, now()),
  ('rc-d3', 'rc-old1',   '$SITE', '$EMP', '2026-10-31', 'NEEDS_LOOK',    'h', 480, 400, now()),
  ('rc-d4', 'rc-old1',   '$SITE', '$EMP', '2026-11-01', 'AUTO_APPROVED', 'h', 480, 480, now()),
  ('rc-d5', 'rc-old1',   '$SITE', '$EMP', '2026-11-13', 'HELD',          'h', 480, 480, now()),
  ('rc-d6', 'rc-old2',   '$SITE', '$EMP', '2026-11-14', 'AUTO_APPROVED', 'h', 480, 480, now());
INSERT INTO timesheet_weeks (id, period_id, organization_id, employee_id, week_start, status, scheduled_minutes, worked_minutes, updated_at) VALUES
  ('rc-w1', 'rc-old1', '$SITE', '$EMP', '2026-10-26', 'NEEDS_LOOK', 960, 880, now());
INSERT INTO overtime_items (id, period_id, organization_id, employee_id, shift_date, raw_minutes, needs_minutes, status, evidence, limits, updated_at) VALUES
  ('rc-o1', 'rc-old1', '$SITE', '$EMP', '2026-10-31', 40, 40, 'PENDING', '{}', '{}', now());
INSERT INTO time_requests (id, organization_id, employee_id, kind, shift_date, note, recorded, requested, waiting_on_role, updated_at) VALUES
  ('rc-r1', '$SITE', '$EMP', 'ROTA_WRONG', '2026-10-31', 'proof', '{}', '{}', 'BRANCH_MANAGER', now());
SQL

# Every table except the period, day, week and overtime ones, hashed row by row (the legacy payslip, attendance and clock tables, and requests, included).
snapshot() {
  for t in $(q -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '\_prisma%' AND tablename NOT IN ('timesheet_periods','timesheet_days','timesheet_weeks','overtime_items') ORDER BY 1"); do
    q -c "SELECT '$t ' || count(*) || ' ' || coalesce(md5(string_agg(x::text, '' ORDER BY x::text)), 'none') FROM \"$t\" x"
  done
}
# The timesheet tables by what they say (the new month periods get random ids, so they are read by date).
timesheet_state() {
  q -c "SELECT 'period ' || start_date || ' ' || end_date || ' ' || state || ' ' || label || ' ' || cutoff_at FROM timesheet_periods ORDER BY start_date"
  q -c "SELECT 'day ' || d.shift_date || ' ' || d.status || ' in ' || p.start_date FROM timesheet_days d JOIN timesheet_periods p ON p.id=d.period_id ORDER BY d.shift_date"
  q -c "SELECT 'week ' || w.week_start || ' ' || w.status || ' ' || w.scheduled_minutes || ' ' || w.worked_minutes || ' in ' || p.start_date FROM timesheet_weeks w JOIN timesheet_periods p ON p.id=w.period_id ORDER BY w.week_start, p.start_date"
  q -c "SELECT 'item ' || i.shift_date || ' ' || i.status || ' in ' || p.start_date FROM overtime_items i JOIN timesheet_periods p ON p.id=i.period_id ORDER BY i.shift_date"
}

snapshot > "$TMP/before"; echo "tables hashed: $(wc -l < "$TMP/before")"
echo; echo "== apply the re-cut"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null
snapshot > "$TMP/after"
diff "$TMP/before" "$TMP/after" >/dev/null && ok "every other table (legacy payslip, attendance and clock ones, requests included) is identical" || fail "another table changed"
timesheet_state > "$TMP/state1"; cat "$TMP/state1"

echo; echo "== checks"
[ "$(q -c "SELECT count(*) FROM timesheet_days")" = "6" ] && ok "all 6 days kept" || fail "a day was lost"
[ "$(q -c "SELECT count(*) FROM overtime_items")" = "1" ] && ok "the overtime item kept" || fail "overtime item lost"
[ "$(q -c "SELECT count(*) FROM time_requests")" = "1" ] && ok "the request kept" || fail "request lost"
[ "$(q -c "SELECT status FROM timesheet_days WHERE id='rc-d3'")" = "NEEDS_LOOK" ] && [ "$(q -c "SELECT status FROM timesheet_days WHERE id='rc-d5'")" = "HELD" ] && ok "exceptions and holds kept their status" || fail "a status changed"
[ "$(q -c "SELECT start_date||' '||end_date||' '||state FROM timesheet_periods WHERE id='rc-closed'")" = "2026-09-21 2026-10-16 CLOSED" ] && ok "the closed period is untouched" || fail "closed period changed"
[ "$(q -c "SELECT id FROM timesheet_days WHERE period_id='rc-closed'")" = "rc-d1" ] && ok "the closed period keeps its day" || fail "closed day moved"
[ "$(q -c "SELECT count(*) FROM timesheet_periods WHERE state='OPEN'")" = "3" ] && ok "three open month periods (17 to 31 Oct, Nov, Dec)" || fail "wrong number of open periods"
[ "$(q -c "SELECT start_date||' '||end_date FROM timesheet_periods WHERE label='October 2026'")" = "2026-10-17 2026-10-31" ] && ok "October starts the day after the closed period" || fail "October start"
[ "$(q -c "SELECT cutoff_at FROM timesheet_periods WHERE label='October 2026'")" = "2026-11-02 15:00:00" ] && ok "October closes 2 Nov 18:00 Nairobi (15:00 UTC)" || fail "October cut-off"
[ "$(q -c "SELECT p.label FROM timesheet_days d JOIN timesheet_periods p ON p.id=d.period_id WHERE d.id='rc-d4'")" = "November 2026" ] && ok "1 Nov lands in November" || fail "1 Nov"
[ "$(q -c "SELECT p.label FROM timesheet_days d JOIN timesheet_periods p ON p.id=d.period_id WHERE d.id='rc-d3'")" = "October 2026" ] && ok "31 Oct lands in October" || fail "31 Oct"
[ "$(q -c "SELECT count(*) FROM timesheet_periods WHERE start_date < '1900-01-01'")" = "0" ] && ok "no parked window is left" || fail "parked window left"

echo; echo "== a second run changes nothing"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null
timesheet_state > "$TMP/state2"; snapshot > "$TMP/after2"
diff "$TMP/state1" "$TMP/state2" >/dev/null && diff "$TMP/before" "$TMP/after2" >/dev/null && ok "nothing changed after the second run" || fail "second run changed something"

psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" >/dev/null
echo; echo "PROOF PASSED (copy dropped)"
