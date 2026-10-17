-- CreateEnum
CREATE TYPE "public"."PayType" AS ENUM ('MONTHLY_SALARY', 'DAILY_RATE');

-- CreateEnum
CREATE TYPE "public"."EmploymentStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'NOTICE', 'EXITED');

-- CreateEnum
CREATE TYPE "public"."ContractStatus" AS ENUM ('NONE', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "public"."PayoutMethod" AS ENUM ('BANK', 'MPESA', 'CASH');

-- CreateEnum
CREATE TYPE "public"."PayChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MoveKind" AS ENUM ('TRANSFER', 'LOAN');

-- CreateEnum
CREATE TYPE "public"."MoveStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."departments" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "public"."hr_documents" ADD COLUMN     "employee_id" TEXT,
ALTER COLUMN "employee_profile_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."positions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_tracks_time" BOOLEAN NOT NULL DEFAULT true,
    "login_role" "public"."UserRole",
    "casuals_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."department_positions" (
    "department_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,

    CONSTRAINT "department_positions_pkey" PRIMARY KEY ("department_id","position_id")
);

-- CreateTable
CREATE TABLE "public"."employees" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "employee_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" TEXT,
    "position_id" TEXT,
    "reports_to_id" TEXT,
    "status" "public"."EmploymentStatus" NOT NULL DEFAULT 'ONBOARDING',
    "pay_type" "public"."PayType" NOT NULL,
    "contract_status" "public"."ContractStatus" NOT NULL DEFAULT 'NONE',
    "tracks_time" BOOLEAN NOT NULL DEFAULT true,
    "tracks_time_override" BOOLEAN NOT NULL DEFAULT false,
    "start_date" DATE NOT NULL,
    "probation_ends_on" DATE,
    "probation_extensions" INTEGER NOT NULL DEFAULT 0,
    "probation_decided_on" DATE,
    "probation_confirmed_on" DATE,
    "exited_on" DATE,
    "photo_url" TEXT,
    "national_id" TEXT,
    "kra_pin" TEXT,
    "sha_number" TEXT,
    "nssf_number" TEXT,
    "helb_number" TEXT,
    "date_of_birth" DATE,
    "personal_phone" TEXT,
    "personal_email" TEXT,
    "physical_address" TEXT,
    "emergency_name" TEXT,
    "emergency_relation" TEXT,
    "emergency_phone" TEXT,
    "statutory_verified_at" TIMESTAMP(3),
    "statutory_verified_by_id" TEXT,
    "hired_by_id" TEXT,
    "legacy_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contracts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "contract_type_id" TEXT,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "status" "public"."ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "signed_document_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_profiles" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "overtime_eligible" BOOLEAN NOT NULL DEFAULT false,
    "standard_week_hours" DECIMAL(5,2),
    "standard_day_hours" DECIMAL(4,2),
    "payout_method" "public"."PayoutMethod",
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "mpesa_phone" TEXT,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_changes" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "public"."PayChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "pay_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employment_spells" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ended_on" DATE,
    "exit_reason" TEXT,
    "exit_note" TEXT,
    "uniform_returned" BOOLEAN NOT NULL DEFAULT false,
    "exit_snapshot" JSONB,
    "ended_by_id" TEXT,
    "ended_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_spells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_moves" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kind" "public"."MoveKind" NOT NULL,
    "status" "public"."MoveStatus" NOT NULL DEFAULT 'SCHEDULED',
    "from_site_id" TEXT NOT NULL,
    "to_site_id" TEXT NOT NULL,
    "from_department_id" TEXT,
    "to_department_id" TEXT,
    "to_position_id" TEXT,
    "to_reports_to_id" TEXT,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "summary" JSONB,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "employee_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."department_heads" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "is_acting" BOOLEAN NOT NULL DEFAULT false,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "assigned_by_id" TEXT,
    "ended_by_id" TEXT,
    "end_reason" TEXT,

    CONSTRAINT "department_heads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."file_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "asked_by_id" TEXT NOT NULL,
    "asked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "file_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."probation_notes" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_kind" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "probation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_drafts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "positions_company_id_name_key" ON "public"."positions"("company_id", "name");

-- CreateIndex
CREATE INDEX "department_positions_position_id_idx" ON "public"."department_positions"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "public"."employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_legacy_profile_id_key" ON "public"."employees"("legacy_profile_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_status_idx" ON "public"."employees"("organization_id", "status");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "public"."employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_position_id_idx" ON "public"."employees"("position_id");

-- CreateIndex
CREATE INDEX "employees_company_id_national_id_idx" ON "public"."employees"("company_id", "national_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_employee_number_key" ON "public"."employees"("company_id", "employee_number");

-- CreateIndex
CREATE INDEX "contracts_employee_id_status_idx" ON "public"."contracts"("employee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pay_profiles_employee_id_key" ON "public"."pay_profiles"("employee_id");

-- CreateIndex
CREATE INDEX "pay_changes_employee_id_effective_from_idx" ON "public"."pay_changes"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "pay_changes_status_requested_at_idx" ON "public"."pay_changes"("status", "requested_at");

-- CreateIndex
CREATE INDEX "employment_spells_employee_id_starts_on_idx" ON "public"."employment_spells"("employee_id", "starts_on");

-- CreateIndex
CREATE INDEX "employee_moves_employee_id_starts_on_idx" ON "public"."employee_moves"("employee_id", "starts_on");

-- CreateIndex
CREATE INDEX "employee_moves_status_starts_on_idx" ON "public"."employee_moves"("status", "starts_on");

-- CreateIndex
CREATE INDEX "department_heads_department_id_ends_on_idx" ON "public"."department_heads"("department_id", "ends_on");

-- CreateIndex
CREATE INDEX "department_heads_employee_id_ends_on_idx" ON "public"."department_heads"("employee_id", "ends_on");

-- CreateIndex
CREATE INDEX "file_requests_employee_id_resolved_at_idx" ON "public"."file_requests"("employee_id", "resolved_at");

-- CreateIndex
CREATE INDEX "probation_notes_employee_id_created_at_idx" ON "public"."probation_notes"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "employee_drafts_company_id_created_by_id_idx" ON "public"."employee_drafts"("company_id", "created_by_id");

-- CreateIndex
CREATE INDEX "hr_documents_employee_id_idx" ON "public"."hr_documents"("employee_id");

-- AddForeignKey
ALTER TABLE "public"."department_positions" ADD CONSTRAINT "department_positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_positions" ADD CONSTRAINT "department_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_contract_type_id_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "public"."contract_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pay_profiles" ADD CONSTRAINT "pay_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pay_changes" ADD CONSTRAINT "pay_changes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employment_spells" ADD CONSTRAINT "employment_spells_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_moves" ADD CONSTRAINT "employee_moves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_heads" ADD CONSTRAINT "department_heads_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_heads" ADD CONSTRAINT "department_heads_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."file_requests" ADD CONSTRAINT "file_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."probation_notes" ADD CONSTRAINT "probation_notes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hr_documents" ADD CONSTRAINT "hr_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------------------------
-- Raw SQL Prisma cannot express (Workforce slice 1a). "departments" is Inventory's table: its `key` is the
-- department tag and `status` the active flag, so the tag index sits on `key`.
-- ---------------------------------------------------------------------------------------------------------------

CREATE UNIQUE INDEX "departments_site_key_key"
  ON "public"."departments" ("organization_id", "key")
  WHERE "key" IS NOT NULL;

CREATE UNIQUE INDEX "department_heads_one_head_per_department"
  ON "public"."department_heads" ("department_id")
  WHERE "ends_on" IS NULL AND NOT "is_acting";

CREATE UNIQUE INDEX "department_heads_one_open_row_per_employee"
  ON "public"."department_heads" ("employee_id")
  WHERE "ends_on" IS NULL;

CREATE UNIQUE INDEX "pay_changes_one_pending_per_employee"
  ON "public"."pay_changes" ("employee_id")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "employee_moves_one_scheduled_transfer"
  ON "public"."employee_moves" ("employee_id")
  WHERE "kind" = 'TRANSFER' AND "status" = 'SCHEDULED';

CREATE UNIQUE INDEX "employment_spells_one_open_spell"
  ON "public"."employment_spells" ("employee_id")
  WHERE "ended_on" IS NULL;

ALTER TABLE "public"."contracts"
  ADD CONSTRAINT "contracts_dates_chk" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "public"."department_heads"
  ADD CONSTRAINT "department_heads_dates_chk" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "public"."employee_moves"
  ADD CONSTRAINT "employee_moves_dates_chk" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
  ADD CONSTRAINT "employee_moves_loan_sites_chk" CHECK ("kind" <> 'LOAN' OR "from_site_id" <> "to_site_id");
ALTER TABLE "public"."pay_profiles"
  ADD CONSTRAINT "pay_profiles_amount_chk" CHECK ("amount" IS NULL OR "amount" >= 0);
ALTER TABLE "public"."pay_changes"
  ADD CONSTRAINT "pay_changes_amount_chk" CHECK ("amount" >= 0);

-- BEGIN PEOPLE BACKFILL
-- Workforce slice 1: backfill People from User + EmployeeProfile.
-- Idempotent: every INSERT is guarded, every UPDATE only fills a NULL. Safe to run twice.
-- Writes only to the new tables and hr_documents.employee_id. Never writes to users or employee_profiles.
-- (The proof script people-backfill-proof.sh extracts everything between BEGIN and END and runs it on a copy.)

DROP TABLE IF EXISTS pg_temp._people_humans;
DROP TABLE IF EXISTS pg_temp._people_starters;
DROP TABLE IF EXISTS pg_temp._people_starter_depts;

-- A UTC-midnight timestamp (or any instant) -> its Nairobi calendar date.
CREATE OR REPLACE FUNCTION pg_temp.nairobi_date(ts timestamp) RETURNS date
  LANGUAGE sql IMMUTABLE AS $$ SELECT (ts AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Nairobi')::date $$;

-- Decision D2: who clocks in by default. Must equal defaultTracksTime() in workforce-access.ts (a test compares them).
CREATE OR REPLACE FUNCTION pg_temp.tracks_by_role(role_name text) RETURNS boolean
  LANGUAGE sql IMMUTABLE AS $$
    SELECT role_name IN ('WAITER','CHEF','BARISTA','STEWARD','HOUSEKEEPING','DEPARTMENT_HEAD','STORE_ATTENDANT','ACCOUNTANT')
  $$;

CREATE OR REPLACE FUNCTION pg_temp.dept_by_tag(site_id text, tag "DepartmentTag") RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT d.id FROM departments d WHERE d.organization_id = site_id AND d.key = tag $$;

CREATE OR REPLACE FUNCTION pg_temp.dept_by_name(site_id text, dept_name text) RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT d.id FROM departments d WHERE d.organization_id = site_id AND d.name = dept_name $$;

-- 1. Departments: five per active branch, two at the hub. Inventory already created the branch five, so for a branch
--    this only fills a gap; the hub's "Stores" and "Head office" are new. Existing rows are left alone.
INSERT INTO departments (id, organization_id, name, key, status, created_at, updated_at)
SELECT gen_random_uuid()::text, o.id, v.name, v.tag::"DepartmentTag", 'ACTIVE'::"DepartmentStatus", now(), now()
FROM organizations o
JOIN (VALUES
  ('BRANCH', 'Kitchen', 'KITCHEN'),
  ('BRANCH', 'Pastry', 'PASTRY'),
  ('BRANCH', 'Barista', 'BARISTA'),
  ('BRANCH', 'Service', 'SERVICE'),
  ('BRANCH', 'Housekeeping', 'HOUSEKEEPING'),
  ('CENTRAL_STORE', 'Stores', NULL),
  ('CENTRAL_STORE', 'Head office', NULL)
) AS v(site_type, name, tag) ON v.site_type = o.type::text
WHERE o."isActive"
ON CONFLICT DO NOTHING;

-- 2. Starter positions (names are examples HR can rename or retire).
CREATE TEMP TABLE _people_starters (name text, role_name text, tracks boolean, casuals boolean);
INSERT INTO _people_starters VALUES
  ('Waiter', 'WAITER', true, true),
  ('Chef', 'CHEF', true, true),
  ('Barista', 'BARISTA', true, true),
  ('Steward', 'STEWARD', true, true),
  ('Housekeeper', 'HOUSEKEEPING', true, true),
  ('Store Attendant', 'STORE_ATTENDANT', true, false),
  ('Store Manager', 'STORE_MANAGER', false, false),
  ('Branch Manager', 'MANAGER', false, false),
  ('Accountant', 'ACCOUNTANT', true, false),
  ('HR Manager', 'HR_MANAGER', false, false),
  ('Director', 'DIRECTOR', false, false);

CREATE TEMP TABLE _people_starter_depts (position_name text, tag text, dept_name text);
INSERT INTO _people_starter_depts VALUES
  ('Waiter', 'SERVICE', NULL),
  ('Chef', 'KITCHEN', NULL),
  ('Chef', 'PASTRY', NULL),
  ('Barista', 'BARISTA', NULL),
  ('Steward', 'HOUSEKEEPING', NULL),
  ('Housekeeper', 'HOUSEKEEPING', NULL),
  ('Store Attendant', NULL, 'Stores'),
  ('Store Manager', NULL, 'Stores'),
  ('Accountant', NULL, 'Head office'),
  ('HR Manager', NULL, 'Head office'),
  ('Director', NULL, 'Head office');

INSERT INTO positions (id, company_id, name, default_tracks_time, login_role, casuals_allowed, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, c.id, s.name, s.tracks, s.role_name::"UserRole", s.casuals, true, now(), now()
FROM companies c CROSS JOIN _people_starters s
WHERE c.is_active
ON CONFLICT (company_id, name) DO NOTHING;

-- 3. The people to bring across: active human users with no Employee yet.
--    Not migrated: the System Admin (no personal file, decision D15), display accounts, inactive or deleted users.
CREATE TEMP TABLE _people_humans AS
SELECT u.id AS user_id, u.name, u.role::text AS role_name, u.phone, u.department_tag, u.department_id AS user_department_id,
       u.is_department_head, u.created_at AS user_created_at,
       COALESCE(o.company_id, (SELECT c.id FROM companies c WHERE c.is_active ORDER BY c.created_at LIMIT 1)) AS company_id,
       COALESCE(o.id, (SELECT h.id FROM organizations h WHERE h.type = 'CENTRAL_STORE' AND h."isHub" ORDER BY h.created_at LIMIT 1)) AS site_id
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
WHERE u.is_active
  AND u.deleted_at IS NULL
  AND u.role NOT IN ('SYSTEM_ADMIN', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY')
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.user_id = u.id);

-- 3a. Custom positions: a job title in use that no starter already carries (compared ignoring case and spaces).
INSERT INTO positions (id, company_id, name, default_tracks_time, login_role, casuals_allowed, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, g.company_id, g.title, g.tracks, g.login_role, false, true, now(), now()
FROM (
  SELECT h.company_id,
         min(btrim(p.job_title)) AS title,
         bool_or(pg_temp.tracks_by_role(h.role_name) OR COALESCE(p.employment_type = 'CASUAL', false)) AS tracks,
         CASE WHEN count(DISTINCT h.role_name) = 1 THEN (array_agg(h.role_name))[1]::"UserRole" END AS login_role
  FROM _people_humans h
  JOIN employee_profiles p ON p.user_id = h.user_id
  WHERE p.job_title IS NOT NULL AND btrim(p.job_title) <> ''
  GROUP BY h.company_id, lower(btrim(p.job_title))
) g
WHERE g.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions x WHERE x.company_id = g.company_id AND lower(x.name) = lower(g.title))
ON CONFLICT (company_id, name) DO NOTHING;

-- 3b. Employees. Numbers continue after the highest "W-####" already issued for the company.
--     A department Inventory already linked to the user (users.department_id, same site) wins over the role rule.
WITH base AS (
  SELECT h.*, p.id AS profile_id, p.national_id, p.date_of_birth, p.personal_phone, p.personal_email, p.physical_address,
         p.emergency_name, p.emergency_relation, p.emergency_phone, p.employment_type::text AS employment_type,
         p.contract_type_id, p.start_date AS profile_start, p.probation_end_date, p.job_title,
         p.kra_pin, p.shif_nhif_number, p.nssf_number, p.helb_number
  FROM _people_humans h
  LEFT JOIN employee_profiles p ON p.user_id = h.user_id
  WHERE h.company_id IS NOT NULL AND h.site_id IS NOT NULL
), dated AS (
  SELECT b.*, COALESCE(pg_temp.nairobi_date(b.profile_start), pg_temp.nairobi_date(b.user_created_at)) AS start_on
  FROM base b
), numbered AS (
  SELECT d.*, row_number() OVER (PARTITION BY d.company_id ORDER BY d.start_on, d.user_created_at, d.user_id) AS rn
  FROM dated d
)
INSERT INTO employees (
  id, company_id, organization_id, user_id, employee_number, name, department_id, position_id, status, pay_type,
  contract_status, tracks_time, start_date, probation_ends_on, national_id, kra_pin, sha_number, nssf_number,
  helb_number, date_of_birth, personal_phone, personal_email, physical_address, emergency_name, emergency_relation,
  emergency_phone, legacy_profile_id, created_at, updated_at)
SELECT
  gen_random_uuid()::text, n.company_id, n.site_id, n.user_id,
  'W-' || lpad((n.rn + COALESCE((SELECT max(substring(e.employee_number FROM 3)::int)
                                 FROM employees e
                                 WHERE e.company_id = n.company_id AND e.employee_number ~ '^W-[0-9]+$'), 0))::text, 4, '0'),
  n.name,
  COALESCE(
    (SELECT d.id FROM departments d WHERE d.id = n.user_department_id AND d.organization_id = n.site_id),
    CASE
      WHEN n.is_department_head AND n.department_tag IS NOT NULL THEN pg_temp.dept_by_tag(n.site_id, n.department_tag)
      WHEN n.role_name = 'WAITER' THEN pg_temp.dept_by_tag(n.site_id, 'SERVICE')
      WHEN n.role_name = 'CHEF' THEN pg_temp.dept_by_tag(n.site_id, 'KITCHEN')
      WHEN n.role_name = 'BARISTA' THEN pg_temp.dept_by_tag(n.site_id, 'BARISTA')
      WHEN n.role_name IN ('STEWARD', 'HOUSEKEEPING') THEN pg_temp.dept_by_tag(n.site_id, 'HOUSEKEEPING')
      WHEN n.role_name IN ('STORE_MANAGER', 'STORE_ATTENDANT') THEN pg_temp.dept_by_name(n.site_id, 'Stores')
      WHEN n.role_name IN ('DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT') THEN pg_temp.dept_by_name(n.site_id, 'Head office')
      ELSE NULL
    END
  ),
  COALESCE(
    (SELECT x.id FROM positions x WHERE x.company_id = n.company_id AND n.job_title IS NOT NULL
        AND lower(x.name) = lower(btrim(n.job_title))),
    (SELECT x.id FROM positions x JOIN _people_starters s ON s.name = x.name
        WHERE x.company_id = n.company_id AND s.role_name = n.role_name)
  ),
  'ACTIVE'::"EmploymentStatus",
  (CASE WHEN n.employment_type = 'CASUAL' THEN 'DAILY_RATE' ELSE 'MONTHLY_SALARY' END)::"PayType",
  (CASE WHEN n.contract_type_id IS NOT NULL THEN 'ACTIVE' ELSE 'NONE' END)::"ContractStatus",
  (pg_temp.tracks_by_role(n.role_name) OR COALESCE(n.employment_type = 'CASUAL', false)),
  n.start_on,
  pg_temp.nairobi_date(n.probation_end_date),
  n.national_id, n.kra_pin, n.shif_nhif_number, n.nssf_number, n.helb_number,
  pg_temp.nairobi_date(n.date_of_birth),
  COALESCE(n.personal_phone, n.phone), n.personal_email, n.physical_address,
  n.emergency_name, n.emergency_relation, n.emergency_phone,
  n.profile_id, now(), now()
FROM numbered n;

-- 3c. Reporting lines, once everyone exists.
UPDATE employees e
SET reports_to_id = m.id
FROM employee_profiles p
JOIN employees m ON m.user_id = p.reporting_manager_id
WHERE e.legacy_profile_id = p.id AND e.reports_to_id IS NULL AND p.reporting_manager_id IS NOT NULL;

-- 4. An (empty) pay profile for everyone; bank details come across, pay amounts do not exist today.
INSERT INTO pay_profiles (id, employee_id, overtime_eligible, payout_method, bank_name, bank_branch, account_name, account_number, updated_at)
SELECT gen_random_uuid()::text, e.id, false,
       (CASE WHEN p.account_number IS NOT NULL AND btrim(p.account_number) <> '' THEN 'BANK' END)::"PayoutMethod",
       p.bank_name, p.bank_branch, p.account_name, p.account_number, now()
FROM employees e
LEFT JOIN employee_profiles p ON p.id = e.legacy_profile_id
WHERE NOT EXISTS (SELECT 1 FROM pay_profiles x WHERE x.employee_id = e.id);

-- 5. One employment spell each.
INSERT INTO employment_spells (id, employee_id, starts_on, created_at)
SELECT gen_random_uuid()::text, e.id, e.start_date, now()
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employment_spells s WHERE s.employee_id = e.id);

-- 6. A contract where the legacy profile already named a contract type (leave policy hangs off that type).
INSERT INTO contracts (id, employee_id, contract_type_id, starts_on, ends_on, status, created_at)
SELECT gen_random_uuid()::text, e.id, p.contract_type_id, e.start_date,
       (CASE WHEN p.end_date IS NOT NULL AND pg_temp.nairobi_date(p.end_date) >= e.start_date THEN pg_temp.nairobi_date(p.end_date) END),
       'ACTIVE'::"ContractStatus", now()
FROM employees e
JOIN employee_profiles p ON p.id = e.legacy_profile_id
WHERE p.contract_type_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.employee_id = e.id);

-- 7. Department heads from the flags. The real start date is unknown; the account's last change is used (flagged in the proof).
INSERT INTO department_heads (id, department_id, employee_id, is_acting, starts_on)
SELECT DISTINCT ON (d.id) gen_random_uuid()::text, d.id, e.id, false, pg_temp.nairobi_date(u.updated_at)
FROM users u
JOIN employees e ON e.user_id = u.id
JOIN departments d ON d.organization_id = e.organization_id AND d.key = u.department_tag
WHERE u.is_department_head AND u.department_tag IS NOT NULL AND u.is_active
  AND NOT EXISTS (SELECT 1 FROM department_heads h WHERE h.ends_on IS NULL AND (h.department_id = d.id OR h.employee_id = e.id))
ORDER BY d.id, u.updated_at DESC;

-- 8. Every held position is offered by the holder's department.
INSERT INTO department_positions (department_id, position_id)
SELECT d.id, p.id
FROM _people_starter_depts s
JOIN positions p ON p.name = s.position_name
JOIN organizations o ON o.company_id = p.company_id
JOIN departments d ON d.organization_id = o.id
 AND ((s.tag IS NOT NULL AND d.key = s.tag::"DepartmentTag") OR (s.tag IS NULL AND d.name = s.dept_name))
ON CONFLICT DO NOTHING;

INSERT INTO department_positions (department_id, position_id)
SELECT DISTINCT e.department_id, e.position_id
FROM employees e
WHERE e.department_id IS NOT NULL AND e.position_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 9. Documents already on file keep their link to the legacy profile and gain the new one.
UPDATE hr_documents d
SET employee_id = e.id
FROM employees e
WHERE e.legacy_profile_id = d.employee_profile_id AND d.employee_id IS NULL;

DROP TABLE _people_humans;
DROP TABLE _people_starters;
DROP TABLE _people_starter_depts;
-- END PEOPLE BACKFILL
