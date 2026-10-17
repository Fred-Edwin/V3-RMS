#!/usr/bin/env bash
# Workforce slice 1: prove the People backfill on a COPY of the lane database. Never touches the lane database itself.
#   usage: scripts/proof/people-backfill-proof.sh [--fixtures]
# Needs: psql, pg_dump, createdb, dropdb on PATH; backend/.env with DATABASE_URL pointing at the lane database.
set -euo pipefail

cd "$(dirname "$0")/../.."
MIG_DIR=$(ls -d prisma/schema/migrations/*_workforce_people | head -1)
MIG="$MIG_DIR/migration.sql"
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
SRC_DB=${DB_URL##*/}; SRC_DB=${SRC_DB%%\?*}
PROOF_DB="${SRC_DB}_proof"
ADMIN_URL="${DB_URL%/*}/postgres"
PROOF_URL="${DB_URL%/*}/${PROOF_DB}"
WITH_FIXTURES=0; [ "${1:-}" = "--fixtures" ] && WITH_FIXTURES=1

q() { psql "$PROOF_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }

echo "== copy $SRC_DB -> $PROOF_DB"
psql "$ADMIN_URL" -X -q -c "DROP DATABASE IF EXISTS \"$PROOF_DB\"" -c "CREATE DATABASE \"$PROOF_DB\""
pg_dump "$DB_URL" | grep -v '^SET transaction_timeout' | psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null

echo "== apply the migration's DDL and raw SQL only (everything before the backfill)"
sed '/^-- BEGIN PEOPLE BACKFILL/,$d' "$MIG" | psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null
grep -q '^-- END PEOPLE BACKFILL' "$MIG"

if [ "$WITH_FIXTURES" = 1 ]; then
  echo "== load fixtures"
  psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 -f scripts/proof/people-backfill-fixtures.sql >/dev/null
fi

counts() {
  q -c "
  SELECT 'users', count(*) FROM users UNION ALL
  SELECT 'employee_profiles', count(*) FROM employee_profiles UNION ALL
  SELECT 'hr_documents', count(*) FROM hr_documents UNION ALL
  SELECT 'hr_documents with employee_id', count(*) FROM hr_documents WHERE employee_id IS NOT NULL UNION ALL
  SELECT 'departments', count(*) FROM departments UNION ALL
  SELECT 'positions', count(*) FROM positions UNION ALL
  SELECT 'department_positions', count(*) FROM department_positions UNION ALL
  SELECT 'employees', count(*) FROM employees UNION ALL
  SELECT 'pay_profiles', count(*) FROM pay_profiles UNION ALL
  SELECT 'employment_spells', count(*) FROM employment_spells UNION ALL
  SELECT 'contracts', count(*) FROM contracts UNION ALL
  SELECT 'department_heads', count(*) FROM department_heads
  " | sed 's/|/ = /'
}
digest() {
  q -c "SELECT 'users md5 ' || md5(string_agg(u::text, '' ORDER BY id)) FROM users u" \
    -c "SELECT 'profiles md5 ' || coalesce(md5(string_agg(p::text, '' ORDER BY id)), 'none') FROM employee_profiles p" \
    -c "SELECT 'employees md5 ' || coalesce(md5(string_agg((e.id || e.employee_number || e.department_id || e.position_id)::text, '' ORDER BY e.id)), 'none') FROM employees e"
}
run_backfill() { sed -n '/^-- BEGIN PEOPLE BACKFILL/,/^-- END PEOPLE BACKFILL/p' "$MIG" | psql "$PROOF_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null; }

echo; echo "== BEFORE"; counts; digest > /tmp/people_proof_before.$$; cat /tmp/people_proof_before.$$
echo; echo "== run 1"; run_backfill
echo "== AFTER run 1"; counts; digest > /tmp/people_proof_after1.$$
echo; echo "== run 2 (must change nothing)"; run_backfill; counts > /tmp/people_proof_c2.$$; digest > /tmp/people_proof_after2.$$
if [ "$(grep employees /tmp/people_proof_after1.$$)" = "$(grep employees /tmp/people_proof_after2.$$)" ]; then echo "OK second run: employees unchanged"; else echo "FAIL second run changed employees"; exit 1; fi
diff <(counts) /tmp/people_proof_c2.$$ >/dev/null && echo "OK second run: all counts identical"

echo; echo "== assertions"
fail=0
check() { # name, sql returning offending rows
  out=$(q -c "$2"); if [ -z "$out" ]; then echo "OK   $1"; else echo "FAIL $1"; echo "$out"; fail=1; fi
}
check "every eligible user has exactly one employee" "
  SELECT u.email FROM users u WHERE u.is_active AND u.deleted_at IS NULL
    AND u.role::text NOT IN ('SYSTEM_ADMIN','KITCHEN_DISPLAY','BARISTA_DISPLAY')
    AND (SELECT count(*) FROM employees e WHERE e.user_id = u.id) <> 1"
check "every employee has one pay profile and one open spell" "
  SELECT e.employee_number FROM employees e
  WHERE (SELECT count(*) FROM pay_profiles p WHERE p.employee_id = e.id) <> 1
     OR (SELECT count(*) FROM employment_spells s WHERE s.employee_id = e.id AND s.ended_on IS NULL) <> 1"
check "profile fields equal employee and pay profile fields" "
  SELECT e.employee_number FROM employees e JOIN employee_profiles p ON p.id = e.legacy_profile_id
  JOIN pay_profiles pp ON pp.employee_id = e.id
  WHERE e.national_id IS DISTINCT FROM p.national_id OR e.kra_pin IS DISTINCT FROM p.kra_pin
     OR e.nssf_number IS DISTINCT FROM p.nssf_number OR e.sha_number IS DISTINCT FROM p.shif_nhif_number
     OR e.helb_number IS DISTINCT FROM p.helb_number OR e.emergency_name IS DISTINCT FROM p.emergency_name
     OR e.emergency_phone IS DISTINCT FROM p.emergency_phone OR e.emergency_relation IS DISTINCT FROM p.emergency_relation
     OR pp.bank_name IS DISTINCT FROM p.bank_name OR pp.account_number IS DISTINCT FROM p.account_number
     OR pp.account_name IS DISTINCT FROM p.account_name OR pp.bank_branch IS DISTINCT FROM p.bank_branch"
check "every document that had a profile has an employee_id" "
  SELECT d.id FROM hr_documents d WHERE d.employee_profile_id IS NOT NULL AND d.employee_id IS NULL"
check "employee numbers are unique and W-####" "
  SELECT employee_number FROM employees WHERE employee_number !~ '^W-[0-9]{4,}$'
  UNION ALL SELECT employee_number FROM employees GROUP BY company_id, employee_number HAVING count(*) > 1"
check "no pay amount was invented" "SELECT employee_id FROM pay_profiles WHERE amount IS NOT NULL"
check "at most one open head per department and per person" "
  SELECT department_id FROM department_heads WHERE ends_on IS NULL AND NOT is_acting GROUP BY department_id HAVING count(*) > 1
  UNION ALL SELECT employee_id FROM department_heads WHERE ends_on IS NULL GROUP BY employee_id HAVING count(*) > 1"
if [ "$(grep 'users md5' /tmp/people_proof_before.$$)" = "$(grep 'users md5' /tmp/people_proof_after2.$$)" ] \
 && [ "$(grep 'profiles md5' /tmp/people_proof_before.$$)" = "$(grep 'profiles md5' /tmp/people_proof_after2.$$)" ]; then
  echo "OK   users and employee_profiles checksums unchanged"
else echo "FAIL users or employee_profiles changed"; fail=1; fi

echo; echo "== not migrated (users with no employee)"
q -F ' | ' -c "SELECT u.email, u.role::text,
       CASE WHEN NOT u.is_active THEN 'inactive' WHEN u.deleted_at IS NOT NULL THEN 'deleted'
            WHEN u.role::text = 'SYSTEM_ADMIN' THEN 'system admin (no personal file)'
            WHEN u.role::text IN ('KITCHEN_DISPLAY','BARISTA_DISPLAY') THEN 'display account'
            ELSE 'no site and no hub' END
     FROM users u WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.user_id = u.id) ORDER BY 1"
echo "== heads created (start date is the account's last change, i.e. ESTIMATED)"
q -F ' | ' -c "SELECT d.name, o.name, u.email, h.starts_on FROM department_heads h JOIN departments d ON d.id=h.department_id
     JOIN organizations o ON o.id=d.organization_id JOIN employees e ON e.id=h.employee_id JOIN users u ON u.id=e.user_id ORDER BY 2,1"
echo "== heads flagged on users but NOT created"
q -F ' | ' -c "SELECT u.email, u.department_tag FROM users u WHERE u.is_department_head AND u.is_active
     AND NOT EXISTS (SELECT 1 FROM department_heads h JOIN employees e ON e.id=h.employee_id WHERE e.user_id=u.id AND h.ends_on IS NULL)"

echo; echo "== prisma migrate diff against the proof copy (must be empty)"
if npx prisma migrate diff --from-url "$PROOF_URL" --to-schema-datamodel prisma/schema --exit-code >/dev/null 2>&1; then
  echo "OK   no drift"
else echo "FAIL drift (or diff error)"; fail=1; fi

rm -f /tmp/people_proof_*.$$
[ "$fail" = 0 ] && echo "PROOF PASSED" || { echo "PROOF FAILED"; exit 1; }
