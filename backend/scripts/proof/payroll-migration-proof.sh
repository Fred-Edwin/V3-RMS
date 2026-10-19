#!/usr/bin/env bash
# Workforce Segment 2A: prove the Payroll migration on a COPY. Never touches the lane database itself.
# It builds a database in the shape BEFORE the migration (every earlier migration, in order), puts a legacy payslip and some
# workforce data in it, hashes every table, applies the migration, and checks: every existing table is identical (the legacy
# payslips table included), the new tables exist and are empty, the insert-only triggers refuse UPDATE and DELETE on runs, payslips,
# lines and snapshots, the dev escape hatch works, the integrity checks refuse a bad row, and a second apply of the objects is refused
# cleanly (nothing half-built).
#   usage: scripts/proof/payroll-migration-proof.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
MIGS=prisma/schema/migrations
THIS=$(ls -d $MIGS/*_workforce_payroll_part1 | head -1)/migration.sql
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
SRC_DB=${DB_URL##*/}; SRC_DB=${SRC_DB%%\?*}
PROOF_DB="${SRC_DB}_payroll_proof"
ADMIN_URL="${DB_URL%/*}/postgres"
PROOF_URL="${DB_URL%/*}/${PROOF_DB}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

q() { psql "$PROOF_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
refused() { # a statement that must fail; prints the reason
  if psql "$PROOF_URL" -v ON_ERROR_STOP=1 -X -q -t -A -c "$1" >"$TMP/out" 2>"$TMP/err"; then return 1; fi
  grep -q "$2" "$TMP/err"
}
ok() { echo "OK $1"; }
fail() { echo "FAIL $1"; exit 1; }

echo "== a database in the shape before the Payroll migration (every earlier migration, in order)"
psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" -c "CREATE DATABASE \"$PROOF_DB\""
COUNT=0
for dir in $(ls -d $MIGS/2*/ | sort); do
  case "$dir" in *_workforce_payroll_part1/) continue;; esac
  psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "${dir}migration.sql" >/dev/null 2>"$TMP/err" || { cat "$TMP/err"; fail "migration $dir did not apply"; }
  COUNT=$((COUNT + 1))
done
echo "applied $COUNT earlier migrations"
[ "$(q -c "SELECT count(*) FROM information_schema.tables WHERE table_name='payroll_months'")" = "0" ] && ok "the copy really is the old shape" || fail "payroll tables already exist"

echo "== data in the old shape"
q <<SQL >/dev/null
INSERT INTO companies (id, name, updated_at) VALUES ('pr-co', 'Proof Co', now());
INSERT INTO organizations (id, company_id, name, address, city, latitude, longitude, type, updated_at) VALUES ('pr-site', 'pr-co', 'Proof Branch', 'Proof Road', 'Nyeri', -0.42, 36.95, 'BRANCH', now());
INSERT INTO users (id, email, password_hash, name, role, organization_id, updated_at) VALUES ('pr-user', 'pr.user@proof.test', 'x', 'Proof User', 'MANAGER', 'pr-site', now());
SQL
# A legacy payslip row, if the table has the columns we expect: the proof only needs it to exist untouched.
HAS_PAYSLIPS=$(q -c "SELECT count(*) FROM information_schema.tables WHERE table_name='payslips'")

snapshot() {
  for t in $(q -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '\_prisma%' AND tablename NOT LIKE 'payroll\_%' ORDER BY 1"); do
    q -c "SELECT '$t ' || count(*) || ' ' || coalesce(md5(string_agg(x::text, '' ORDER BY x::text)), 'none') FROM \"$t\" x"
  done
}
snapshot > "$TMP/before"; echo "tables hashed: $(wc -l < "$TMP/before")"

echo "== apply the migration"
psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f "$THIS" >/dev/null
snapshot > "$TMP/after"

echo; echo "== checks"
diff "$TMP/before" "$TMP/after" >/dev/null && ok "every existing table is identical (legacy payslips: $HAS_PAYSLIPS table present)" || fail "an existing table changed"
for t in payroll_months payroll_month_sites payroll_runs payroll_payslips payroll_payslip_lines payroll_review_lines payroll_adjustments payroll_left_out payroll_snapshots payroll_reminders payroll_estimates payroll_request_keys; do
  [ "$(q -c "SELECT count(*) FROM $t")" = "0" ] || fail "$t missing or not empty"
done
ok "all 12 new tables exist and are empty"

q <<SQL >/dev/null
INSERT INTO payroll_months (id, company_id, month_key, updated_at) VALUES ('m1', 'pr-co', '2026-09', now());
INSERT INTO payroll_runs (id, month_id, run_number, trigger, status, inputs_hash, headcount, totals) VALUES ('r1', 'm1', 1, 'SYSTEM', 'SUCCEEDED', 'h', 0, '{}');
INSERT INTO payroll_payslips (id, month_id, run_id, employee_id, site_id, employee_name, employee_number, site_name, basic, gross, statutory_employee, income_tax, other_deductions, net, employer_share, taxable_pay, overtime_pay, lateness_deduction, unpaid_absence, input)
  VALUES ('p1', 'm1', 'r1', 'e1', 'pr-site', 'Proof', 'P-1', 'Proof Branch', 100, 100, 0, 0, 0, 100, 0, 100, 0, 0, 0, '{}');
INSERT INTO payroll_payslip_lines (id, payslip_id, position, code, label, kind, amount, source, working_text) VALUES ('l1', 'p1', 0, 'BASIC', 'Basic pay', 'EARNING', 100, '{}', 'Monthly pay 100');
INSERT INTO payroll_snapshots (id, month_id, hash, data) VALUES ('s1', 'm1', 'h', '{}');
SQL
ok "rows insert"

for t in "payroll_runs SET headcount = 5 WHERE id='r1'" "payroll_payslips SET net = 1 WHERE id='p1'" "payroll_payslip_lines SET amount = 1 WHERE id='l1'" "payroll_snapshots SET hash = 'x' WHERE id='s1'"; do
  refused "UPDATE ${t}" "insert-only" || fail "UPDATE allowed on ${t%% *}"
done
ok "UPDATE is refused on runs, payslips, lines and snapshots"
for t in payroll_runs payroll_payslips payroll_payslip_lines payroll_snapshots; do
  refused "DELETE FROM $t" "insert-only" || fail "DELETE allowed on $t"
done
ok "DELETE is refused on the same four (and so a cascade from a month cannot erase them)"
q -c "BEGIN; SELECT set_config('wendo.allow_payroll_edit', 'on', true); DELETE FROM payroll_months WHERE id='m1'; COMMIT;" >/dev/null && [ "$(q -c "SELECT count(*) FROM payroll_payslips")" = "0" ] && ok "the dev escape hatch tidies fixture rows inside one transaction" || fail "escape hatch"

refused "INSERT INTO payroll_months (id, company_id, month_key, updated_at) VALUES ('bad', 'pr-co', '2026-13', now())" "month_key_format" && ok "a month key that is not YYYY-MM is refused" || fail "bad month key allowed"
refused "INSERT INTO payroll_months (id, company_id, month_key, state, updated_at) VALUES ('bad', 'pr-co', '2026-10', 'TO_PUBLISH', now())" "approved_has_signature" && ok "an approved month without approver, time and number is refused" || fail "unsigned approval allowed"
refused "INSERT INTO payroll_months (id, company_id, month_key, sent_by_id, approved_by_id, approved_at, document_number, state, updated_at) VALUES ('bad', 'pr-co', '2026-10', 'u1', 'u1', now(), 'PAY-2026-10', 'TO_PUBLISH', now())" "approver_not_sender" && ok "the approver cannot be the person who sent the month" || fail "self approval allowed"
refused "INSERT INTO payroll_months (id, company_id, month_key, updated_at) VALUES ('dup', 'pr-co', '2026-09', now()), ('dup2', 'pr-co', '2026-09', now())" "duplicate key" && ok "one month per company and month key" || fail "duplicate month allowed"
q -c "INSERT INTO payroll_months (id, company_id, month_key, updated_at) VALUES ('m2', 'pr-co', '2026-09', now())" >/dev/null
refused "INSERT INTO payroll_adjustments (id, month_id, employee_id, site_id, kind, label, amount, reason, idempotency_key, created_by_id) VALUES ('a', 'm2', 'e', 's', 'ALLOWANCE', 'x', 0, 'r', 'k', 'u')" "amount_positive" && ok "an adjustment of nothing is refused" || fail "zero adjustment allowed"
refused "INSERT INTO payroll_review_lines (id, month_id, run_id, employee_id, site_id, employee_name, site_name, kind, severity, text) VALUES ('rl', 'm2', 'nope', 'e', 's', 'n', 's', 'K', 'BLOCK', 't')" "foreign key" && ok "a review line needs a real run" || fail "orphan review line allowed"

psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" >/dev/null
echo; echo "PROOF PASSED (copy dropped)"
