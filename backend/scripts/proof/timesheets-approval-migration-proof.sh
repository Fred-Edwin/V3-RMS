#!/usr/bin/env bash
# Workforce Segment 1A: prove the month-approval migrations on a COPY. Never touches the lane database itself.
# It builds a database in the shape BEFORE the two migrations (every earlier migration applied in order), puts old-shaped
# timesheet data in it (a signed closed period, an unsigned closed one, a closing one, an open one, with days, a week, overtime and
# a request), runs the schema migration and then the data migration, and checks: no day, item or request is lost, every other
# table (legacy payslip, attendance and clock tables included) is identical, a closed or signed period becomes APPROVED with its
# approver, time, a document number and a note that it predates the change, CLOSING becomes OPEN, OPEN stays OPEN, and a second run
# of the data migration changes nothing.
#   usage: scripts/proof/timesheets-approval-migration-proof.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
MIGS=prisma/schema/migrations
SCHEMA_MIG=$(ls -d $MIGS/*_workforce_month_approval | head -1)/migration.sql
DATA_MIG=$(ls -d $MIGS/*_workforce_month_approval_data | head -1)/migration.sql
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
SRC_DB=${DB_URL##*/}; SRC_DB=${SRC_DB%%\?*}
PROOF_DB="${SRC_DB}_approval_proof"
ADMIN_URL="${DB_URL%/*}/postgres"
PROOF_URL="${DB_URL%/*}/${PROOF_DB}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

q() { psql "$PROOF_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
ok() { echo "OK $1"; }
fail() { echo "FAIL $1"; exit 1; }

echo "== a database in the shape before the two migrations (every earlier migration, in order)"
psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" -c "CREATE DATABASE \"$PROOF_DB\""
COUNT=0
for dir in $(ls -d $MIGS/2*/ | sort); do
  case "$dir" in *_workforce_month_approval/|*_workforce_month_approval_data/) continue;; esac
  psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "${dir}migration.sql" >/dev/null 2>"$TMP/err" || { cat "$TMP/err"; fail "migration $dir did not apply"; }
  COUNT=$((COUNT + 1))
done
echo "applied $COUNT earlier migrations"
[ "$(q -c "SELECT count(*) FROM information_schema.columns WHERE table_name='timesheet_periods' AND column_name='approved_at'")" = "0" ] && ok "the copy really is the old shape" || fail "approval columns already exist"

echo "== old-shaped data"
q <<SQL >/dev/null
INSERT INTO companies (id, name, updated_at) VALUES ('ap-co', 'Proof Co', now());
INSERT INTO organizations (id, company_id, name, address, city, latitude, longitude, type, updated_at) VALUES ('ap-site', 'ap-co', 'Proof Branch', 'Proof Road', 'Nyeri', -0.42, 36.95, 'BRANCH', now());
INSERT INTO employees (id, company_id, organization_id, employee_number, name, pay_type, start_date, status, updated_at) VALUES ('ap-emp', 'ap-co', 'ap-site', 'AP-1', 'Proof Person', 'MONTHLY_SALARY', '2026-01-01', 'ACTIVE', now());
INSERT INTO users (id, email, password_hash, name, role, organization_id, updated_at) VALUES ('ap-signer', 'ap.signer@proof.test', 'x', 'Proof Signer', 'MANAGER', 'ap-site', now());
INSERT INTO timesheet_periods (id, organization_id, start_date, end_date, label, cutoff_at, state, closed_at, close_kind, signed_by_id, signed_at, updated_at) VALUES
  ('ap-p1', 'ap-site', '2026-07-01', '2026-07-31', 'July 2026', '2026-08-02 15:00', 'CLOSED', '2026-08-02 15:00', 'AUTO', 'ap-signer', '2026-08-03 08:00', now()),
  ('ap-p2', 'ap-site', '2026-08-01', '2026-08-31', 'August 2026', '2026-09-02 15:00', 'CLOSED', '2026-09-02 15:00', 'AUTO', NULL, NULL, now());
INSERT INTO timesheet_periods (id, organization_id, start_date, end_date, label, cutoff_at, state, updated_at) VALUES
  ('ap-p3', 'ap-site', '2026-09-01', '2026-09-30', 'September 2026', '2026-10-02 15:00', 'CLOSING', now()),
  ('ap-p4', 'ap-site', '2026-10-01', '2026-10-31', 'October 2026', '2026-11-02 15:00', 'OPEN', now());
INSERT INTO timesheet_days (id, period_id, organization_id, employee_id, shift_date, status, evidence_hash, scheduled_minutes, worked_minutes, updated_at) VALUES
  ('ap-d1', 'ap-p1', 'ap-site', 'ap-emp', '2026-07-10', 'AUTO_APPROVED', 'h', 480, 480, now()),
  ('ap-d2', 'ap-p2', 'ap-site', 'ap-emp', '2026-08-10', 'APPROVED',      'h', 480, 470, now()),
  ('ap-d3', 'ap-p3', 'ap-site', 'ap-emp', '2026-09-10', 'NEEDS_LOOK',    'h', 480, 400, now()),
  ('ap-d4', 'ap-p4', 'ap-site', 'ap-emp', '2026-10-10', 'AUTO_APPROVED', 'h', 480, 480, now());
INSERT INTO timesheet_weeks (id, period_id, organization_id, employee_id, week_start, status, scheduled_minutes, worked_minutes, updated_at) VALUES
  ('ap-w1', 'ap-p4', 'ap-site', 'ap-emp', '2026-10-05', 'AUTO_APPROVED', 480, 480, now());
INSERT INTO overtime_items (id, period_id, organization_id, employee_id, shift_date, raw_minutes, needs_minutes, authorised_minutes, status, evidence, limits, updated_at) VALUES
  ('ap-o1', 'ap-p2', 'ap-site', 'ap-emp', '2026-08-10', 40, 40, 40, 'APPROVED', '{}', '{}', now()),
  ('ap-o2', 'ap-p3', 'ap-site', 'ap-emp', '2026-09-10', 20, 20, 0, 'PENDING', '{}', '{}', now());
INSERT INTO time_requests (id, organization_id, employee_id, kind, shift_date, note, recorded, requested, waiting_on_role, updated_at) VALUES
  ('ap-r1', 'ap-site', 'ap-emp', 'ROTA_WRONG', '2026-09-10', 'proof', '{}', '{}', 'BRANCH_MANAGER', now());
SQL

# Every table except the timesheet and overtime ones, hashed row by row.
snapshot() {
  for t in $(q -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '\_prisma%' AND tablename NOT IN ('timesheet_periods','timesheet_exports','overtime_items') ORDER BY 1"); do
    q -c "SELECT '$t ' || count(*) || ' ' || coalesce(md5(string_agg(x::text, '' ORDER BY x::text)), 'none') FROM \"$t\" x"
  done
}
state() {
  q -c "SELECT p.id || ' ' || p.state || ' ' || coalesce(p.approved_by_id,'-') || ' ' || coalesce(p.approved_at::text,'-') || ' ' || coalesce(p.document_number::text,'-') || ' ' || coalesce(p.approval_note,'-') FROM timesheet_periods p ORDER BY p.start_date"
  q -c "SELECT 'item ' || id || ' ' || status || ' ' || authorised_minutes || ' v' || version FROM overtime_items ORDER BY id"
}

snapshot > "$TMP/before"; echo "tables hashed: $(wc -l < "$TMP/before")"
echo "== apply the schema migration, then the data migration"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$SCHEMA_MIG" >/dev/null
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$DATA_MIG" >/dev/null
snapshot > "$TMP/after"; state > "$TMP/state1"; cat "$TMP/state1"
# the new columns and the new table are additions: tables that gained columns are compared by the old columns only
diff <(grep -v -E '^(timesheet_exports|timesheet_periods|overtime_items) ' "$TMP/before") <(grep -v -E '^(timesheet_exports|timesheet_periods|overtime_items) ' "$TMP/after") >/dev/null && ok "every other table (legacy payslip, attendance and clock tables, days, weeks, requests included) is identical" || fail "another table changed"

echo; echo "== checks"
[ "$(q -c "SELECT count(*) FROM timesheet_days")" = "4" ] && [ "$(q -c "SELECT count(*) FROM timesheet_weeks")" = "1" ] && ok "all 4 days and the week kept" || fail "a day or week was lost"
[ "$(q -c "SELECT count(*) FROM overtime_items")" = "2" ] && [ "$(q -c "SELECT count(*) FROM time_requests")" = "1" ] && ok "both overtime items and the request kept" || fail "an item or request was lost"
[ "$(q -c "SELECT status || ' ' || authorised_minutes FROM overtime_items WHERE id='ap-o1'")" = "APPROVED 40" ] && ok "an approved overtime item keeps its answer (version 0)" || fail "overtime answer changed"
[ "$(q -c "SELECT state FROM timesheet_periods WHERE id='ap-p1'")" = "APPROVED" ] && [ "$(q -c "SELECT approved_by_id FROM timesheet_periods WHERE id='ap-p1'")" = "ap-signer" ] && [ "$(q -c "SELECT approved_at FROM timesheet_periods WHERE id='ap-p1'")" = "2026-08-03 08:00:00" ] && ok "the signed period is APPROVED by its signer, at the time it was signed" || fail "signed period"
[ "$(q -c "SELECT state || ' ' || coalesce(approved_by_id,'none') || ' ' || approved_at FROM timesheet_periods WHERE id='ap-p2'")" = "APPROVED none 2026-09-02 15:00:00" ] && ok "the unsigned closed period is APPROVED at its close time, with no approver named" || fail "unsigned closed period"
[ "$(q -c "SELECT document_number FROM timesheet_periods WHERE id='ap-p1'")" = "1" ] && [ "$(q -c "SELECT document_number FROM timesheet_periods WHERE id='ap-p2'")" = "2" ] && ok "document numbers follow the order of the months" || fail "document numbers"
[ "$(q -c "SELECT count(*) FROM timesheet_periods WHERE id IN ('ap-p1','ap-p2') AND approval_note LIKE 'Closed before month approval existed%'")" = "2" ] && ok "both carry the note that they predate the change" || fail "notes"
[ "$(q -c "SELECT state FROM timesheet_periods WHERE id='ap-p3'")" = "OPEN" ] && [ "$(q -c "SELECT state FROM timesheet_periods WHERE id='ap-p4'")" = "OPEN" ] && ok "CLOSING and OPEN are OPEN (nothing was locked)" || fail "open states"
[ "$(q -c "SELECT count(*) FROM timesheet_periods WHERE state IN ('CLOSED','CLOSING')")" = "0" ] && ok "no retired state is left" || fail "retired state left"
[ "$(q -c "SELECT status FROM timesheet_days WHERE id='ap-d3'")" = "NEEDS_LOOK" ] && ok "the open exception in the September month is still open" || fail "exception changed"
[ "$(q -c "SELECT last_value FROM timesheet_document_seq")" = "2" ] && ok "the sequence continues from 2: the next approval is TSH-0003" || fail "sequence"

echo; echo "== a second run of the data migration changes nothing"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$DATA_MIG" >/dev/null
state > "$TMP/state2"; snapshot > "$TMP/after2"
diff "$TMP/state1" "$TMP/state2" >/dev/null && diff "$TMP/after" "$TMP/after2" >/dev/null && ok "nothing changed after the second run" || fail "second run changed something"
[ "$(q -c "SELECT last_value FROM timesheet_document_seq")" = "2" ] && ok "and no number was spent" || fail "second run spent a number"

psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" >/dev/null
echo; echo "PROOF PASSED (copy dropped)"
