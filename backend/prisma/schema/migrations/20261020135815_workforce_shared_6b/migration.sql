-- Workforce segment 6, back end B (audit read, documents door, verify). Additive only: new tables, new nullable columns on two Workforce
-- tables, no legacy table touched, nothing dropped. (Prisma also proposed dropping the hand-made payroll_payslip_seq; that is existing
-- drift and is deliberately left out.)

-- AlterTable
ALTER TABLE "public"."payslip_open_digests" ADD COLUMN     "first_at" TIMESTAMP(3),
ADD COLUMN     "last_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."workforce_audit_entry_index" ADD COLUMN     "actor_id" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "subject_user_id" TEXT;

-- CreateTable
CREATE TABLE "public"."workforce_audit_view_marks" (
    "user_id" TEXT NOT NULL,
    "last_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_audit_view_marks_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."workforce_record_answers" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "answer_key" TEXT NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_record_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "subject_user_id" TEXT,
    "signed_by_id" TEXT,
    "signed_by_name" TEXT NOT NULL,
    "signed_by_role" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "reviewed_by_name" TEXT,
    "reviewed_by_role" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'PIN',
    "hash_prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CURRENT',
    "replaced_by_version" INTEGER,
    "replaced_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_by_role" TEXT,
    "replaced_by_number" TEXT,
    "open_href" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_document_checks" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address_hash" TEXT NOT NULL,
    "device_label" TEXT,
    "user_id" TEXT,

    CONSTRAINT "workforce_document_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workforce_record_answers_entry_id_user_id_key" ON "public"."workforce_record_answers"("entry_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_record_answers_user_id_answer_key_key" ON "public"."workforce_record_answers"("user_id", "answer_key");

-- CreateIndex
CREATE INDEX "workforce_documents_company_id_signed_at_idx" ON "public"."workforce_documents"("company_id", "signed_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_documents_company_id_kind_signed_at_idx" ON "public"."workforce_documents"("company_id", "kind", "signed_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_documents_company_id_organization_id_signed_at_idx" ON "public"."workforce_documents"("company_id", "organization_id", "signed_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_documents_number_idx" ON "public"."workforce_documents"("number");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_documents_company_id_number_version_key" ON "public"."workforce_documents"("company_id", "number", "version");

-- CreateIndex
CREATE INDEX "workforce_document_checks_at_idx" ON "public"."workforce_document_checks"("at");

-- CreateIndex
CREATE INDEX "workforce_document_checks_kind_number_at_idx" ON "public"."workforce_document_checks"("kind", "number", "at");

-- CreateIndex
CREATE INDEX "payslip_open_digests_company_id_day_idx" ON "public"."payslip_open_digests"("company_id", "day");

-- CreateIndex
CREATE INDEX "workforce_audit_entry_index_company_id_category_occurred_at_idx" ON "public"."workforce_audit_entry_index"("company_id", "category", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_audit_entry_index_company_id_actor_id_occurred_at_idx" ON "public"."workforce_audit_entry_index"("company_id", "actor_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_audit_entry_index_subject_user_id_occurred_at_idx" ON "public"."workforce_audit_entry_index"("subject_user_id", "occurred_at" DESC);

-- Search as you type (A1): trigram indexes make `search_text LIKE '%oat%'` use an index on a very large log (pg_trgm is a trusted extension).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "workforce_audit_entry_index_search_text_trgm_idx" ON "public"."workforce_audit_entry_index" USING gin ("search_text" gin_trgm_ops);
CREATE INDEX "workforce_documents_search_text_trgm_idx" ON "public"."workforce_documents" USING gin ("search_text" gin_trgm_ops);

-- Fill the three new copied columns of index rows written by back end A. The append-only entry table is only read, never altered.
UPDATE "public"."workforce_audit_entry_index" AS i
SET "category" = e."category"::text, "actor_id" = e."actor_id", "subject_user_id" = e."subject_user_id"
FROM "public"."workforce_audit_entries" AS e
WHERE e."id" = i."entry_id" AND i."category" IS NULL;
