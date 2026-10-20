-- CreateEnum
CREATE TYPE "public"."CasualSheetStatus" AS ENUM ('DRAFT', 'SENT', 'SENT_BACK', 'APPROVED', 'VOID');

-- CreateTable
CREATE TABLE "public"."casual_workers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "national_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casual_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."casual_sheets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "status" "public"."CasualSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "rate" DECIMAL(12,2) NOT NULL,
    "rate_version" INTEGER NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "sent_by_id" TEXT,
    "sent_back_at" TIMESTAMP(3),
    "sent_back_by_id" TEXT,
    "sent_back_reason" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "number" INTEGER,
    "total" DECIMAL(12,2),
    "snapshot" JSONB,
    "document_hash" TEXT,
    "cash_holder_id" TEXT,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casual_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."casual_sheet_lines" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "received_at" TIMESTAMP(3),
    "received_name" TEXT,
    "received_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casual_sheet_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."casual_corrections" (
    "id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "original_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casual_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."casual_counters" (
    "company_id" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "casual_counters_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "public"."casual_request_keys" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casual_request_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payslip_code_tries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "confirmed" BOOLEAN NOT NULL,
    "alerted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_code_tries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payslip_unlocks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "payslip_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payslip_open_digests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "opener_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "payslip_open_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payslip_documents" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."p9_format_confirmations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "layout_version" INTEGER NOT NULL,
    "confirmed_by_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "p9_format_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."p9_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "layout_version" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "hash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "generated_by_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "p9_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "casual_workers_company_id_national_id_key" ON "public"."casual_workers"("company_id", "national_id");

-- CreateIndex
CREATE INDEX "casual_sheets_company_id_organization_id_work_date_idx" ON "public"."casual_sheets"("company_id", "organization_id", "work_date");

-- CreateIndex
CREATE INDEX "casual_sheets_company_id_status_work_date_idx" ON "public"."casual_sheets"("company_id", "status", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "casual_sheets_company_id_number_key" ON "public"."casual_sheets"("company_id", "number");

-- CreateIndex
CREATE INDEX "casual_sheet_lines_worker_id_idx" ON "public"."casual_sheet_lines"("worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "casual_sheet_lines_sheet_id_worker_id_key" ON "public"."casual_sheet_lines"("sheet_id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "casual_corrections_sheet_id_idempotency_key_key" ON "public"."casual_corrections"("sheet_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "casual_request_keys_company_id_key_key" ON "public"."casual_request_keys"("company_id", "key");

-- CreateIndex
CREATE INDEX "payslip_code_tries_user_id_created_at_idx" ON "public"."payslip_code_tries"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payslip_unlocks_token_hash_key" ON "public"."payslip_unlocks"("token_hash");

-- CreateIndex
CREATE INDEX "payslip_unlocks_user_id_device_id_idx" ON "public"."payslip_unlocks"("user_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslip_open_digests_opener_id_day_key" ON "public"."payslip_open_digests"("opener_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "payslip_documents_payslip_id_variant_key" ON "public"."payslip_documents"("payslip_id", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "p9_format_confirmations_company_id_layout_version_key" ON "public"."p9_format_confirmations"("company_id", "layout_version");

-- CreateIndex
CREATE INDEX "p9_documents_company_id_year_idx" ON "public"."p9_documents"("company_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "p9_documents_employee_id_year_layout_version_key" ON "public"."p9_documents"("employee_id", "year", "layout_version");

-- AddForeignKey
ALTER TABLE "public"."casual_sheet_lines" ADD CONSTRAINT "casual_sheet_lines_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "public"."casual_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."casual_sheet_lines" ADD CONSTRAINT "casual_sheet_lines_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."casual_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."casual_corrections" ADD CONSTRAINT "casual_corrections_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "public"."casual_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."casual_corrections" ADD CONSTRAINT "casual_corrections_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."casual_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One live (not void) sheet per department, site and day (PD21). A voided sheet frees the day for a new one.
CREATE UNIQUE INDEX "casual_sheets_one_live_per_day" ON "public"."casual_sheets" ("company_id", "organization_id", "department_id", "work_date") WHERE "status" <> 'VOID';

-- Sanity checks the services also make: a shift is 1 minute to 16 hours, an approved sheet has its number, hash and total.
ALTER TABLE "public"."casual_sheet_lines" ADD CONSTRAINT "casual_sheet_lines_span_ok" CHECK ("end_minute" > "start_minute" AND "end_minute" - "start_minute" <= 960 AND "minutes" = "end_minute" - "start_minute" AND "start_minute" >= 0 AND "start_minute" < 1440);
ALTER TABLE "public"."casual_sheets" ADD CONSTRAINT "casual_sheets_approved_has_number" CHECK ("status" NOT IN ('APPROVED') OR ("number" IS NOT NULL AND "total" IS NOT NULL AND "snapshot" IS NOT NULL AND "document_hash" IS NOT NULL AND "approved_by_id" IS NOT NULL));

-- Evidence is insert-only: a stored payslip file, a P9 and a code try can never be changed or removed (same idea as the payroll tables).
CREATE OR REPLACE FUNCTION "public"."payslips_refuse_change"() RETURNS trigger AS $$
BEGIN
  IF current_setting('wendo.allow_payslip_edit', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is insert-only (% refused)', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payslip_documents_insert_only" BEFORE UPDATE OR DELETE ON "public"."payslip_documents" FOR EACH ROW EXECUTE FUNCTION "public"."payslips_refuse_change"();
CREATE TRIGGER "p9_documents_insert_only" BEFORE UPDATE OR DELETE ON "public"."p9_documents" FOR EACH ROW EXECUTE FUNCTION "public"."payslips_refuse_change"();
CREATE TRIGGER "payslip_code_tries_insert_only" BEFORE DELETE ON "public"."payslip_code_tries" FOR EACH ROW EXECUTE FUNCTION "public"."payslips_refuse_change"();
