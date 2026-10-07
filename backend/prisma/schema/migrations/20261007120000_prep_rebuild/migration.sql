-- Prep rebuild: one migration for the whole rebuild (docs/features/inventory/prep-plan.md §1.4, Q-4).
-- Structure generated with `prisma migrate diff`; three hand edits:
--   1. the typical_yield_at_run_time DROP is moved AFTER the backfill that reads it,
--   2. the backfill of old runs (reference, expected figure, PREP counter),
--   3. the partial unique index "one main ingredient per recipe version".
-- Old runs: needs_look stays false (old flagged runs are not pushed into Needs a look, Q-3), status
-- RECORDED by default, ledger rows untouched (append-only trigger).

-- CreateEnum
CREATE TYPE "public"."PrepRecipeChangeReason" AS ENUM ('BETTER_RECIPE', 'PORTION_SIZE_CHANGED', 'NEW_SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PrepRunStatus" AS ENUM ('RECORDED', 'CORRECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PrepCorrectReason" AS ENUM ('TYPO', 'WRONG_ITEM', 'WRONG_QUANTITY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PrepCancelReason" AS ENUM ('ENTERED_TWICE', 'NEVER_MADE', 'WRONG_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PrepYieldReason" AS ENUM ('TRIMMED_MORE', 'SPILLAGE', 'BURNT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PrepExpectedSource" AS ENUM ('RECIPE', 'PAST_RUNS', 'NONE');

-- AlterTable
ALTER TABLE "public"."prep_run_input_lines" ADD COLUMN     "on_hand_at_run_time" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "public"."prep_runs" ADD COLUMN     "cancel_reason" "public"."PrepCancelReason",
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "closed_by_id" TEXT,
ADD COLUMN     "correction_reason" "public"."PrepCorrectReason",
ADD COLUMN     "expected_source" "public"."PrepExpectedSource" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "expected_yield" DECIMAL(12,4),
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "needs_look" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason_note" TEXT,
ADD COLUMN     "recipe_version_id" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "replaces_run_id" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT,
ADD COLUMN     "status" "public"."PrepRunStatus" NOT NULL DEFAULT 'RECORDED',
ADD COLUMN     "stock_flag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "yield_reason" "public"."PrepYieldReason";

-- Backfill 1: PREP-nnnn per site, oldest first (ties broken by id so the order is stable).
UPDATE "public"."prep_runs" r
SET "reference" = 'PREP-' || CASE WHEN n.num < 10000 THEN lpad(n.num::text, 4, '0') ELSE n.num::text END
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "organization_id" ORDER BY "created_at", "id") AS num
  FROM "public"."prep_runs"
) n
WHERE r."id" = n."id";

-- Backfill 2: the next new run continues each site's sequence.
INSERT INTO "public"."reference_counters" ("id", "organization_id", "prefix", "last_number", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "organization_id", 'PREP', count(*), now(), now()
FROM "public"."prep_runs"
GROUP BY "organization_id"
ON CONFLICT ("organization_id", "prefix") DO UPDATE SET "last_number" = EXCLUDED."last_number", "updated_at" = now();

-- Backfill 3: the figure the old run was judged against becomes its expected yield.
UPDATE "public"."prep_runs"
SET "expected_yield" = "typical_yield_at_run_time",
    "expected_source" = 'PAST_RUNS'
WHERE "typical_yield_at_run_time" IS NOT NULL;

-- Contract step: nothing reads the old column any more (production has no runs, plan §8).
ALTER TABLE "public"."prep_runs" DROP COLUMN "typical_yield_at_run_time";

-- CreateTable
CREATE TABLE "public"."prep_recipes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "output_item_id" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prep_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_recipe_versions" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "target_yield" DECIMAL(12,4) NOT NULL,
    "reason" "public"."PrepRecipeChangeReason",
    "reason_note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prep_recipe_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_recipe_lines" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "input_item_id" TEXT NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "line_order" INTEGER NOT NULL,

    CONSTRAINT "prep_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prep_recipes_organization_id_idx" ON "public"."prep_recipes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "prep_recipes_organization_id_output_item_id_key" ON "public"."prep_recipes"("organization_id", "output_item_id");

-- CreateIndex
CREATE INDEX "prep_recipe_versions_organization_id_idx" ON "public"."prep_recipe_versions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "prep_recipe_versions_recipe_id_version_key" ON "public"."prep_recipe_versions"("recipe_id", "version");

-- CreateIndex
CREATE INDEX "prep_recipe_lines_input_item_id_idx" ON "public"."prep_recipe_lines"("input_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "prep_recipe_lines_version_id_input_item_id_key" ON "public"."prep_recipe_lines"("version_id", "input_item_id");

-- Hand-written: exactly one main ingredient per recipe version (Prisma cannot express a partial index).
CREATE UNIQUE INDEX "prep_recipe_lines_one_main_per_version" ON "public"."prep_recipe_lines"("version_id") WHERE "is_main";

-- CreateIndex
CREATE UNIQUE INDEX "prep_runs_replaces_run_id_key" ON "public"."prep_runs"("replaces_run_id");

-- CreateIndex
CREATE INDEX "prep_runs_organization_id_status_created_at_idx" ON "public"."prep_runs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "prep_runs_organization_id_created_by_id_created_at_idx" ON "public"."prep_runs"("organization_id", "created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "prep_runs_organization_id_needs_look_idx" ON "public"."prep_runs"("organization_id", "needs_look");

-- CreateIndex
CREATE UNIQUE INDEX "prep_runs_organization_id_reference_key" ON "public"."prep_runs"("organization_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "prep_runs_organization_id_created_by_id_idempotency_key_key" ON "public"."prep_runs"("organization_id", "created_by_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "public"."prep_recipes" ADD CONSTRAINT "prep_recipes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipes" ADD CONSTRAINT "prep_recipes_output_item_id_fkey" FOREIGN KEY ("output_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_versions" ADD CONSTRAINT "prep_recipe_versions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."prep_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_versions" ADD CONSTRAINT "prep_recipe_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_versions" ADD CONSTRAINT "prep_recipe_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_lines" ADD CONSTRAINT "prep_recipe_lines_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."prep_recipe_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_lines" ADD CONSTRAINT "prep_recipe_lines_input_item_id_fkey" FOREIGN KEY ("input_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_replaces_run_id_fkey" FOREIGN KEY ("replaces_run_id") REFERENCES "public"."prep_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."prep_recipe_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
