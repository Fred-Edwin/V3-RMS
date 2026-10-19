-- Workforce Segment 1A: the month is approved by the site's manager (no automatic close, no reopen).
-- Additive only: new enum values, new columns, one new table and one sequence. Legacy tables are never touched.
-- The values are first used by the next migration (a new enum value cannot be used in the transaction that adds it).

-- AlterEnum
ALTER TYPE "public"."OvertimeStatus" ADD VALUE IF NOT EXISTS 'APPROVED_PART';

-- AlterEnum
ALTER TYPE "public"."TimesheetPeriodState" ADD VALUE IF NOT EXISTS 'APPROVED';

-- AlterTable
ALTER TABLE "public"."overtime_items" ADD COLUMN IF NOT EXISTS "head_note" JSONB,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."timesheet_periods" ADD COLUMN IF NOT EXISTS "approval_note" TEXT,
ADD COLUMN IF NOT EXISTS "approve_key" TEXT,
ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT,
ADD COLUMN IF NOT EXISTS "approved_snapshot" JSONB,
ADD COLUMN IF NOT EXISTS "approver_own_hours" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "document_hash" TEXT,
ADD COLUMN IF NOT EXISTS "document_number" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."timesheet_exports" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "range_from" DATE,
    "range_to" DATE,
    "idempotency_key" TEXT NOT NULL,
    "document_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timesheet_exports_user_id_created_at_idx" ON "public"."timesheet_exports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timesheet_exports_period_id_idx" ON "public"."timesheet_exports"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "timesheet_exports_user_id_idempotency_key_key" ON "public"."timesheet_exports"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "timesheet_periods_document_number_key" ON "public"."timesheet_periods"("document_number");

-- AddForeignKey
ALTER TABLE "public"."timesheet_exports" ADD CONSTRAINT "timesheet_exports_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document numbers TSH-n are issued at approval (gaps are allowed).
CREATE SEQUENCE IF NOT EXISTS "public"."timesheet_document_seq" AS INTEGER START 1;
