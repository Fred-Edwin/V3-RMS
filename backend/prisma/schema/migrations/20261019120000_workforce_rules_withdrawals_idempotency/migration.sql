-- Workforce 1B (Rules): a withdrawal row for a scheduled version, and an idempotency key on a version. Additive only.

-- AlterTable
ALTER TABLE "public"."workforce_rule_versions" ADD COLUMN     "idempotency_key" TEXT;

-- CreateTable
CREATE TABLE "public"."workforce_rule_version_withdrawals" (
    "id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "withdrawn_by_id" TEXT NOT NULL,
    "withdrawn_by_role" TEXT NOT NULL,
    "withdrawn_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,

    CONSTRAINT "workforce_rule_version_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workforce_rule_version_withdrawals_rule_version_id_key" ON "public"."workforce_rule_version_withdrawals"("rule_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_rule_versions_company_id_idempotency_key_key" ON "public"."workforce_rule_versions"("company_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "public"."workforce_rule_version_withdrawals" ADD CONSTRAINT "workforce_rule_version_withdrawals_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "public"."workforce_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
