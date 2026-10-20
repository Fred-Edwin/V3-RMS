-- CreateEnum
CREATE TYPE "public"."LeaveApplicationStatus" AS ENUM ('WAITING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."LeaveStage" AS ENUM ('MANAGER', 'HR', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "public"."LeaveOrigin" AS ENUM ('NEW', 'LEGACY');

-- CreateEnum
CREATE TYPE "public"."LeaveCountedIn" AS ENUM ('CALENDAR_DAYS', 'WORKING_DAYS');

-- CreateEnum
CREATE TYPE "public"."LeaveEntryKind" AS ENUM ('OPENING', 'CARRY_OVER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."LeaveEventKind" AS ENUM ('ASKED', 'MOVED_TO_HR', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."leave_applications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type_code" TEXT NOT NULL,
    "type_snapshot" JSONB NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "unpaid_tail_days" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" "public"."LeaveApplicationStatus" NOT NULL DEFAULT 'WAITING',
    "stage" "public"."LeaveStage" NOT NULL DEFAULT 'MANAGER',
    "routed_to_role" TEXT NOT NULL,
    "asked_at" TIMESTAMP(3) NOT NULL,
    "with_hr_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "decided_by" TEXT,
    "decider_role" TEXT,
    "decision_reason_code" TEXT,
    "decision_note" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancel_reason" TEXT,
    "slip_number" INTEGER,
    "slip_snapshot" JSONB,
    "slip_hash" TEXT,
    "balance_before" INTEGER,
    "balance_after" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "origin" "public"."LeaveOrigin" NOT NULL DEFAULT 'NEW',
    "legacy_request_id" TEXT,
    "counted_in" "public"."LeaveCountedIn" NOT NULL DEFAULT 'CALENDAR_DAYS',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leave_balance_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type_code" TEXT NOT NULL,
    "leave_year" INTEGER NOT NULL,
    "kind" "public"."LeaveEntryKind" NOT NULL,
    "days" INTEGER NOT NULL,
    "as_of" DATE NOT NULL,
    "reason_code" TEXT,
    "reason_note" TEXT,
    "by_user" TEXT,
    "corrects_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leave_events" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "kind" "public"."LeaveEventKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "by_user" TEXT,
    "role" TEXT,

    CONSTRAINT "leave_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_applications_slip_number_key" ON "public"."leave_applications"("slip_number");

-- CreateIndex
CREATE UNIQUE INDEX "leave_applications_legacy_request_id_key" ON "public"."leave_applications"("legacy_request_id");

-- CreateIndex
CREATE INDEX "leave_applications_organization_id_status_asked_at_idx" ON "public"."leave_applications"("organization_id", "status", "asked_at");

-- CreateIndex
CREATE INDEX "leave_applications_employee_id_start_date_idx" ON "public"."leave_applications"("employee_id", "start_date");

-- CreateIndex
CREATE INDEX "leave_applications_status_stage_asked_at_idx" ON "public"."leave_applications"("status", "stage", "asked_at");

-- CreateIndex
CREATE INDEX "leave_applications_company_id_status_start_date_idx" ON "public"."leave_applications"("company_id", "status", "start_date");

-- CreateIndex
CREATE INDEX "leave_applications_organization_id_start_date_end_date_idx" ON "public"."leave_applications"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_applications_employee_id_idempotency_key_key" ON "public"."leave_applications"("employee_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "leave_balance_entries_employee_id_type_code_leave_year_idx" ON "public"."leave_balance_entries"("employee_id", "type_code", "leave_year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balance_entries_employee_id_idempotency_key_key" ON "public"."leave_balance_entries"("employee_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "leave_events_application_id_at_idx" ON "public"."leave_events"("application_id", "at");

-- Hand-written SQL (Prisma does not model sequences, triggers, partial indexes or checks; none of this is schema drift).

-- The leave slip number LVE-nnnn: gaps allowed, like TSH-n.
CREATE SEQUENCE IF NOT EXISTS "public"."leave_document_seq" AS INTEGER START 1;

-- One OPENING and one CARRY_OVER per person, type and year, so a repeated carry or a repeated first read adds nothing.
CREATE UNIQUE INDEX "leave_balance_entries_once_per_year_key"
  ON "public"."leave_balance_entries"("employee_id", "type_code", "leave_year", "kind")
  WHERE "kind" IN ('OPENING', 'CARRY_OVER');

-- Sanity checks that hold for new and carried rows alike.
ALTER TABLE "public"."leave_applications"
  ADD CONSTRAINT "leave_applications_dates_check" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "leave_applications_days_check" CHECK ("days" >= 1 AND "unpaid_tail_days" >= 0 AND "unpaid_tail_days" <= "days"),
  ADD CONSTRAINT "leave_applications_slip_only_when_approved_check" CHECK ("slip_number" IS NULL OR "status" IN ('APPROVED', 'CANCELLED'));

-- The ledger is append-only: a wrong entry is fixed with a linked correcting entry (corrects_id), never by editing.
CREATE OR REPLACE FUNCTION "public"."leave_balance_entries_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'leave_balance_entries is append-only: % is not allowed.', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "leave_balance_entries_no_update_delete"
  BEFORE UPDATE OR DELETE ON "public"."leave_balance_entries"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."leave_balance_entries_append_only"();

CREATE TRIGGER "leave_balance_entries_no_truncate"
  BEFORE TRUNCATE ON "public"."leave_balance_entries"
  FOR EACH STATEMENT
  EXECUTE FUNCTION "public"."leave_balance_entries_append_only"();
