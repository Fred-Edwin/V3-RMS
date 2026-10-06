-- CreateEnum
CREATE TYPE "public"."RuleGroup" AS ENUM ('LATENESS', 'OVERTIME', 'ATTENDANCE', 'LEAVE', 'PROBATION', 'CASUAL_WORK', 'CONDUCT', 'STATUTORY', 'HOLIDAYS', 'WEEK_AND_BREAKS');

-- CreateEnum
CREATE TYPE "public"."AuditCategory" AS ENUM ('PEOPLE', 'TIME', 'LEAVE', 'PAY_SETUP', 'PAY_RUN_PREPARE', 'PAY_RUN_DECIDE', 'RULES_OPERATING', 'RULES_PAY', 'PAYSLIP_ACCESS', 'SENSITIVE_VIEW', 'DISCIPLINE', 'SECURITY', 'DOCUMENTS', 'LOG_ACCESS');

-- CreateEnum
CREATE TYPE "public"."AuditChannel" AS ENUM ('APP', 'SYSTEM', 'ASSISTANT');

-- CreateTable
CREATE TABLE "public"."workforce_audit_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "seq" BIGINT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_role" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "channel" "public"."AuditChannel" NOT NULL DEFAULT 'APP',
    "action" TEXT NOT NULL,
    "category" "public"."AuditCategory" NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "subject_user_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "device_label" TEXT,
    "place_label" TEXT,
    "prev_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "workforce_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_audit_chain_heads" (
    "company_id" TEXT NOT NULL,
    "last_seq" BIGINT NOT NULL DEFAULT 0,
    "last_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_audit_chain_heads_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "public"."workforce_rule_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "group" "public"."RuleGroup" NOT NULL,
    "version" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "values" JSONB NOT NULL,
    "values_schema_version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_by_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_rule_confirmations" (
    "id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "confirmed_by_id" TEXT NOT NULL,
    "confirmer_role" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "workforce_rule_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workforce_audit_entries_company_id_occurred_at_idx" ON "public"."workforce_audit_entries"("company_id", "occurred_at");

-- CreateIndex
CREATE INDEX "workforce_audit_entries_company_id_category_occurred_at_idx" ON "public"."workforce_audit_entries"("company_id", "category", "occurred_at");

-- CreateIndex
CREATE INDEX "workforce_audit_entries_organization_id_occurred_at_idx" ON "public"."workforce_audit_entries"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "workforce_audit_entries_subject_user_id_occurred_at_idx" ON "public"."workforce_audit_entries"("subject_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "workforce_audit_entries_subject_type_subject_id_idx" ON "public"."workforce_audit_entries"("subject_type", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_audit_entries_company_id_seq_key" ON "public"."workforce_audit_entries"("company_id", "seq");

-- CreateIndex
CREATE INDEX "workforce_rule_versions_company_id_group_effective_from_idx" ON "public"."workforce_rule_versions"("company_id", "group", "effective_from");

-- CreateIndex
CREATE INDEX "workforce_rule_versions_organization_id_group_effective_fro_idx" ON "public"."workforce_rule_versions"("organization_id", "group", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_rule_confirmations_rule_version_id_scope_key" ON "public"."workforce_rule_confirmations"("rule_version_id", "scope");

-- AddForeignKey
ALTER TABLE "public"."workforce_rule_confirmations" ADD CONSTRAINT "workforce_rule_confirmations_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "public"."workforce_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Hand-written SQL (Prisma does not model triggers or partial indexes, so none of this is schema drift).
-- Contract: docs/features/workforce/slice-0-contract.md sections 2.3 and 5.3.
-- ---------------------------------------------------------------------------------------------

-- Rule versions: one version number per (company, group) for company defaults, and per (company, site, group) for
-- site overrides. A plain unique index cannot express this because organization_id is NULL for company rows.
CREATE UNIQUE INDEX "workforce_rule_versions_company_default_version_key"
  ON "public"."workforce_rule_versions"("company_id", "group", "version")
  WHERE "organization_id" IS NULL;

CREATE UNIQUE INDEX "workforce_rule_versions_site_override_version_key"
  ON "public"."workforce_rule_versions"("company_id", "organization_id", "group", "version")
  WHERE "organization_id" IS NOT NULL;

-- The audit log is append-only. No escape hatch: nothing seeds audit rows, and a hatch is a hole.
-- A later archive job (slice 7) will get its own, documented exception.
CREATE OR REPLACE FUNCTION "public"."workforce_audit_entries_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'workforce_audit_entries is append-only: % is not allowed.', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "workforce_audit_entries_no_update_delete"
  BEFORE UPDATE OR DELETE ON "public"."workforce_audit_entries"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."workforce_audit_entries_append_only"();

CREATE TRIGGER "workforce_audit_entries_no_truncate"
  BEFORE TRUNCATE ON "public"."workforce_audit_entries"
  FOR EACH STATEMENT
  EXECUTE FUNCTION "public"."workforce_audit_entries_append_only"();

-- The chain head may only move forward by exactly one, and is never deleted or truncated.
CREATE OR REPLACE FUNCTION "public"."workforce_audit_chain_heads_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."company_id" <> OLD."company_id" THEN
      RAISE EXCEPTION 'workforce_audit_chain_heads: company_id cannot change.'
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW."last_seq" <> OLD."last_seq" + 1 THEN
      RAISE EXCEPTION 'workforce_audit_chain_heads: last_seq may only move from % to %, not to %.', OLD."last_seq", OLD."last_seq" + 1, NEW."last_seq"
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'workforce_audit_chain_heads: % is not allowed.', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "workforce_audit_chain_heads_guard_row"
  BEFORE UPDATE OR DELETE ON "public"."workforce_audit_chain_heads"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."workforce_audit_chain_heads_guard"();

CREATE TRIGGER "workforce_audit_chain_heads_no_truncate"
  BEFORE TRUNCATE ON "public"."workforce_audit_chain_heads"
  FOR EACH STATEMENT
  EXECUTE FUNCTION "public"."workforce_audit_chain_heads_guard"();
