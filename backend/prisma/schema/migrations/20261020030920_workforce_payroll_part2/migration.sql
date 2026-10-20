-- Workforce Segment 2B (Payroll part 2): publish, corrections, the bank file, Mark as paid, exports.
-- The checks and the lock guard that use the new enum values are in the next migration (a new enum value cannot be used in the
-- transaction that adds it).

-- The payslip number PS-nnnn: one sequence for the company, issued at publish, gaps allowed.
CREATE SEQUENCE IF NOT EXISTS "public"."payroll_payslip_seq" AS INTEGER START 1;

-- CreateEnum
CREATE TYPE "public"."BankFileState" AS ENUM ('DOWNLOADED', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PayrollMonthState" ADD VALUE 'PUBLISHED';
ALTER TYPE "public"."PayrollMonthState" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "public"."payroll_months" ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "paid_by_id" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "published_by_id" TEXT;

-- CreateTable
CREATE TABLE "public"."payroll_publications" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT nextval('payroll_payslip_seq'),
    "published_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_bank_files" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "format_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "people" INTEGER NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "state" "public"."BankFileState" NOT NULL DEFAULT 'DOWNLOADED',
    "downloaded_by_id" TEXT NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "pay_bank_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_exports" (
    "id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "document_number" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_publications_number_key" ON "public"."payroll_publications"("number");

-- CreateIndex
CREATE INDEX "payroll_publications_employee_id_idx" ON "public"."payroll_publications"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_publications_month_id_employee_id_key" ON "public"."payroll_publications"("month_id", "employee_id");

-- CreateIndex
CREATE INDEX "pay_bank_files_month_id_state_idx" ON "public"."pay_bank_files"("month_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "pay_bank_files_month_id_downloaded_by_id_idempotency_key_key" ON "public"."pay_bank_files"("month_id", "downloaded_by_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payroll_exports_user_id_created_at_idx" ON "public"."payroll_exports"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_exports_user_id_idempotency_key_key" ON "public"."payroll_exports"("user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "public"."payroll_publications" ADD CONSTRAINT "payroll_publications_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pay_bank_files" ADD CONSTRAINT "pay_bank_files_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_exports" ADD CONSTRAINT "payroll_exports_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "public"."payroll_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;
