-- CreateEnum
CREATE TYPE "public"."PayrollMonthState" AS ENUM ('WAITING', 'IN_REVIEW', 'TO_APPROVE', 'TO_PUBLISH');

-- CreateEnum
CREATE TYPE "public"."PayrollRunTrigger" AS ENUM ('SYSTEM', 'HR');

-- CreateEnum
CREATE TYPE "public"."PayrollRunStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PayslipStatus" AS ENUM ('READY');

-- CreateEnum
CREATE TYPE "public"."PayslipLineKind" AS ENUM ('EARNING', 'DEDUCTION', 'STATUTORY', 'MEMO');

-- CreateEnum
CREATE TYPE "public"."ReviewState" AS ENUM ('OPEN', 'CHECKED');

-- CreateTable
CREATE TABLE "public"."payroll_months" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "month_key" TEXT NOT NULL,
    "state" "public"."PayrollMonthState" NOT NULL DEFAULT 'WAITING',
    "state_version" INTEGER NOT NULL DEFAULT 0,
    "included_site_ids" TEXT[],
    "current_run_id" TEXT,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "tables_version" INTEGER,
    "tables_confirmed_at" TIMESTAMP(3),
    "tables_confirmed_by" TEXT,
    "rules_used" JSONB,
    "calculated_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_by_id" TEXT,
    "sent_back_at" TIMESTAMP(3),
    "sent_back_by_id" TEXT,
    "sent_back_reason" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "document_number" TEXT,
    "hand_checked" BOOLEAN NOT NULL DEFAULT false,
    "first_month_site_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_month_sites" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "timesheet_number" INTEGER NOT NULL,
    "timesheet_approved_at" TIMESTAMP(3) NOT NULL,
    "timesheet_approved_by_id" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_month_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_runs" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "run_number" INTEGER NOT NULL,
    "trigger" "public"."PayrollRunTrigger" NOT NULL,
    "status" "public"."PayrollRunStatus" NOT NULL,
    "by_id" TEXT,
    "inputs_hash" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "blocking" INTEGER NOT NULL DEFAULT 0,
    "totals" JSONB NOT NULL,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_payslips" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."PayslipStatus" NOT NULL DEFAULT 'READY',
    "employee_name" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "department" TEXT,
    "site_name" TEXT NOT NULL,
    "basic" DECIMAL(14,2) NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "statutory_employee" DECIMAL(14,2) NOT NULL,
    "income_tax" DECIMAL(14,2) NOT NULL,
    "other_deductions" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "employer_share" DECIMAL(14,2) NOT NULL,
    "taxable_pay" DECIMAL(14,2) NOT NULL,
    "overtime_pay" DECIMAL(14,2) NOT NULL,
    "lateness_deduction" DECIMAL(14,2) NOT NULL,
    "unpaid_absence" DECIMAL(14,2) NOT NULL,
    "input" JSONB NOT NULL,
    "payout_method" TEXT,
    "document_number" TEXT,
    "replaces_version" INTEGER,
    "diff" JSONB,
    "reason" TEXT,
    "corrected_by_id" TEXT,
    "corrected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_payslip_lines" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "public"."PayslipLineKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "base" TEXT,
    "base_amount" DECIMAL(14,2),
    "rate" TEXT,
    "bands_used" JSONB,
    "quantity" TEXT,
    "unit" TEXT,
    "source" JSONB NOT NULL,
    "working_text" TEXT NOT NULL,
    "table_code" TEXT,
    "share" TEXT,

    CONSTRAINT "payroll_payslip_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_review_lines" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "state" "public"."ReviewState" NOT NULL DEFAULT 'OPEN',
    "checked_by_id" TEXT,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_review_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_adjustments" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_by_id" TEXT,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_left_out" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_left_out_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_snapshots" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_reminders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "month_key" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "reminded_by_id" TEXT NOT NULL,
    "reminded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_estimates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "month_key" TEXT NOT NULL,
    "as_of" DATE NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "payroll_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_request_keys" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "month_key" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_request_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_months_company_id_state_idx" ON "public"."payroll_months"("company_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_months_company_id_month_key_key" ON "public"."payroll_months"("company_id", "month_key");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_months_company_id_document_number_key" ON "public"."payroll_months"("company_id", "document_number");

-- CreateIndex
CREATE INDEX "payroll_month_sites_site_id_idx" ON "public"."payroll_month_sites"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_month_sites_month_id_site_id_key" ON "public"."payroll_month_sites"("month_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_month_id_run_number_key" ON "public"."payroll_runs"("month_id", "run_number");

-- CreateIndex
CREATE INDEX "payroll_payslips_month_id_run_id_site_id_idx" ON "public"."payroll_payslips"("month_id", "run_id", "site_id");

-- CreateIndex
CREATE INDEX "payroll_payslips_employee_id_month_id_idx" ON "public"."payroll_payslips"("employee_id", "month_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payslips_run_id_employee_id_version_key" ON "public"."payroll_payslips"("run_id", "employee_id", "version");

-- CreateIndex
CREATE INDEX "payroll_payslip_lines_payslip_id_idx" ON "public"."payroll_payslip_lines"("payslip_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payslip_lines_payslip_id_position_key" ON "public"."payroll_payslip_lines"("payslip_id", "position");

-- CreateIndex
CREATE INDEX "payroll_review_lines_run_id_state_idx" ON "public"."payroll_review_lines"("run_id", "state");

-- CreateIndex
CREATE INDEX "payroll_review_lines_run_id_severity_state_idx" ON "public"."payroll_review_lines"("run_id", "severity", "state");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_review_lines_run_id_employee_id_kind_key" ON "public"."payroll_review_lines"("run_id", "employee_id", "kind");

-- CreateIndex
CREATE INDEX "payroll_adjustments_month_id_employee_id_idx" ON "public"."payroll_adjustments"("month_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_adjustments_month_id_idempotency_key_key" ON "public"."payroll_adjustments"("month_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payroll_left_out_employee_id_idx" ON "public"."payroll_left_out"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_left_out_month_id_employee_id_key" ON "public"."payroll_left_out"("month_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_snapshots_month_id_revision_key" ON "public"."payroll_snapshots"("month_id", "revision");

-- CreateIndex
CREATE INDEX "payroll_reminders_company_id_month_key_site_id_reminded_at_idx" ON "public"."payroll_reminders"("company_id", "month_key", "site_id", "reminded_at");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_estimates_company_id_month_key_key" ON "public"."payroll_estimates"("company_id", "month_key");

-- CreateIndex
CREATE INDEX "payroll_request_keys_company_id_month_key_action_idx" ON "public"."payroll_request_keys"("company_id", "month_key", "action");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_request_keys_company_id_key_key" ON "public"."payroll_request_keys"("company_id", "key");

-- AddForeignKey
ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_month_sites" ADD CONSTRAINT "payroll_month_sites_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_runs" ADD CONSTRAINT "payroll_runs_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_payslips" ADD CONSTRAINT "payroll_payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_payslip_lines" ADD CONSTRAINT "payroll_payslip_lines_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "public"."payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_review_lines" ADD CONSTRAINT "payroll_review_lines_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_left_out" ADD CONSTRAINT "payroll_left_out_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_snapshots" ADD CONSTRAINT "payroll_snapshots_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity checks Prisma cannot express (Segment 2A). Prisma does not model them, so they add no drift.
ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_month_key_format" CHECK ("month_key" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_state_version_nonneg" CHECK ("state_version" >= 0);
-- An approved month always has its approver, time and document number.
ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_approved_has_signature"
  CHECK ("state" <> 'TO_PUBLISH' OR ("approved_by_id" IS NOT NULL AND "approved_at" IS NOT NULL AND "document_number" IS NOT NULL));
-- The approver is never the person who sent the month.
ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_approver_not_sender"
  CHECK ("approved_by_id" IS NULL OR "sent_by_id" IS NULL OR "approved_by_id" <> "sent_by_id");
ALTER TABLE "public"."payroll_review_lines" ADD CONSTRAINT "payroll_review_lines_severity_known" CHECK ("severity" IN ('BLOCK', 'TICK'));
ALTER TABLE "public"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "public"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_kind_known"
  CHECK ("kind" IN ('ALLOWANCE', 'INCENTIVE', 'ARREARS', 'OTHER_EARNING', 'ADVANCE_REPAID', 'HELB', 'OTHER_DEDUCTION'));

-- Insert-only tables (E6, like the stock ledger): a run, a frozen payslip, its lines and the approval snapshot are never edited.
-- A fix is a new run, a new payslip version or a new snapshot revision. A dev script that must tidy fixture rows runs
--   SELECT set_config('wendo.allow_payroll_edit', 'on', true);
-- inside its own transaction (src/scripts only; payroll-guard.test.ts fails if the setting appears in application code).
CREATE OR REPLACE FUNCTION "public"."payroll_insert_only"() RETURNS trigger AS $$
BEGIN
  IF current_setting('wendo.allow_payroll_edit', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION '% is insert-only: % is not allowed. Add a new run, version or revision instead.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payroll_runs_insert_only" BEFORE UPDATE OR DELETE ON "public"."payroll_runs" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_insert_only"();
CREATE TRIGGER "payroll_payslips_insert_only" BEFORE UPDATE OR DELETE ON "public"."payroll_payslips" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_insert_only"();
CREATE TRIGGER "payroll_payslip_lines_insert_only" BEFORE UPDATE OR DELETE ON "public"."payroll_payslip_lines" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_insert_only"();
CREATE TRIGGER "payroll_snapshots_insert_only" BEFORE UPDATE OR DELETE ON "public"."payroll_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_insert_only"();
