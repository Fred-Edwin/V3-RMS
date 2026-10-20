-- CreateEnum
CREATE TYPE "public"."ConductLevel" AS ENUM ('VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING');

-- CreateEnum
CREATE TYPE "public"."ConductAbout" AS ENUM ('LATENESS', 'ABSENCE', 'BEHAVIOUR', 'SAFETY_HYGIENE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ConductStatus" AS ENUM ('ISSUED', 'RECORDED', 'SIGNED', 'GIVEN_NOT_SIGNED', 'APPEALED', 'KEPT', 'REPLACED', 'WITHDRAWN', 'ENDED');

-- The WRN-nnnn series (written and final warnings only; gaps allowed).
CREATE SEQUENCE IF NOT EXISTS "public"."conduct_notice_seq" AS INTEGER START 1;

-- CreateTable
CREATE TABLE "public"."conduct_notices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "person_user_id" TEXT,
    "issuer_id" TEXT NOT NULL,
    "issuer_name" TEXT NOT NULL,
    "issuer_role" TEXT NOT NULL,
    "level" "public"."ConductLevel" NOT NULL,
    "about" "public"."ConductAbout" NOT NULL,
    "number" INTEGER,
    "verify_code" TEXT NOT NULL,
    "letter_version" TEXT NOT NULL,
    "letter_snapshot" JSONB,
    "facts_snapshot" JSONB,
    "own_line" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "ack_days" INTEGER NOT NULL,
    "appeal_days" INTEGER NOT NULL,
    "valid_for_months" INTEGER NOT NULL,
    "valid_until" DATE NOT NULL,
    "status" "public"."ConductStatus" NOT NULL,
    "signed_at" TIMESTAMP(3),
    "signed_device_id" TEXT,
    "not_signed_recorded_at" TIMESTAMP(3),
    "not_signed_reason" TEXT,
    "not_signed_by_id" TEXT,
    "witness_id" TEXT,
    "witness_asked_at" TIMESTAMP(3),
    "witness_confirmed_at" TIMESTAMP(3),
    "witness_declined_at" TIMESTAMP(3),
    "appealed_at" TIMESTAMP(3),
    "appeal_reason_key" TEXT,
    "appeal_text" TEXT,
    "appeal_decision_due_by" TIMESTAMP(3),
    "overdue_told_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "replaces_notice_id" TEXT,
    "replaced_by_id" TEXT,
    "document_version" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conduct_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conduct_notice_events" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "payload" JSONB,

    CONSTRAINT "conduct_notice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conduct_decisions" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "via_appeal" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "decided_by_id" TEXT NOT NULL,
    "decided_by_name" TEXT NOT NULL,
    "decided_by_role" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "new_notice_id" TEXT,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "conduct_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conduct_notice_documents" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "bytes" BYTEA NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conduct_notice_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conduct_notices_number_key" ON "public"."conduct_notices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "conduct_notices_verify_code_key" ON "public"."conduct_notices"("verify_code");

-- CreateIndex
CREATE UNIQUE INDEX "conduct_notices_replaces_notice_id_key" ON "public"."conduct_notices"("replaces_notice_id");

-- CreateIndex
CREATE UNIQUE INDEX "conduct_notices_replaced_by_id_key" ON "public"."conduct_notices"("replaced_by_id");

-- CreateIndex
CREATE INDEX "conduct_notices_organization_id_status_issued_at_idx" ON "public"."conduct_notices"("organization_id", "status", "issued_at");

-- CreateIndex
CREATE INDEX "conduct_notices_employee_id_status_idx" ON "public"."conduct_notices"("employee_id", "status");

-- CreateIndex
CREATE INDEX "conduct_notices_person_user_id_issued_at_idx" ON "public"."conduct_notices"("person_user_id", "issued_at");

-- CreateIndex
CREATE INDEX "conduct_notices_status_valid_until_idx" ON "public"."conduct_notices"("status", "valid_until");

-- CreateIndex
CREATE INDEX "conduct_notices_status_appeal_decision_due_by_idx" ON "public"."conduct_notices"("status", "appeal_decision_due_by");

-- CreateIndex
CREATE UNIQUE INDEX "conduct_notices_issuer_id_idempotency_key_key" ON "public"."conduct_notices"("issuer_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "conduct_notice_events_notice_id_at_idx" ON "public"."conduct_notice_events"("notice_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "conduct_decisions_notice_id_version_key" ON "public"."conduct_decisions"("notice_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "conduct_decisions_decided_by_id_idempotency_key_key" ON "public"."conduct_decisions"("decided_by_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "conduct_notice_documents_notice_id_version_withdrawn_key" ON "public"."conduct_notice_documents"("notice_id", "version", "withdrawn");

-- AddForeignKey
ALTER TABLE "public"."conduct_notice_events" ADD CONSTRAINT "conduct_notice_events_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."conduct_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conduct_decisions" ADD CONSTRAINT "conduct_decisions_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."conduct_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conduct_notice_documents" ADD CONSTRAINT "conduct_notice_documents_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."conduct_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
