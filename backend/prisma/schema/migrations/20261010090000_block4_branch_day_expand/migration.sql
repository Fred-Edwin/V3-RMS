-- CreateEnum
CREATE TYPE "public"."BranchDayCorrectionReason" AS ENUM ('COUNTED_WRONGLY', 'ITEM_WAS_MISSED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."BranchDaySheetKind" AS ENUM ('AT_THE_CLOSE', 'AFTER_CORRECTION');

-- CreateEnum
CREATE TYPE "public"."OpeningKind" AS ENUM ('ACCEPTED', 'RECOUNTED');

-- AlterTable
ALTER TABLE "public"."branch_day_departments" ADD COLUMN     "count_idempotency_key" TEXT,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "on_behalf" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."branch_day_lines" ADD COLUMN     "opening_qty" DECIMAL(12,4),
ADD COLUMN     "received_qty" DECIMAL(12,4),
ADD COLUMN     "used_qty" DECIMAL(12,4),
ADD COLUMN     "waste_qty" DECIMAL(12,4),
ALTER COLUMN "expected_qty" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."branch_days" ADD COLUMN     "close_idempotency_key" TEXT,
ADD COLUMN     "closing_value" DECIMAL(14,2),
ADD COLUMN     "used_value" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "public"."department_openings" ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "kind" "public"."OpeningKind" NOT NULL DEFAULT 'ACCEPTED',
ADD COLUMN     "on_behalf" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."branch_day_corrections" (
    "id" TEXT NOT NULL,
    "branch_day_id" TEXT NOT NULL,
    "branch_day_line_id" TEXT NOT NULL,
    "from_closing_qty" DECIMAL(12,4) NOT NULL,
    "to_closing_qty" DECIMAL(12,4) NOT NULL,
    "from_used_qty" DECIMAL(12,4) NOT NULL,
    "to_used_qty" DECIMAL(12,4) NOT NULL,
    "reason" "public"."BranchDayCorrectionReason" NOT NULL,
    "note" TEXT,
    "corrected_by_id" TEXT NOT NULL,
    "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" TEXT NOT NULL,
    "sheet_version" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "branch_day_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branch_day_sheets" (
    "id" TEXT NOT NULL,
    "branch_day_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "public"."BranchDaySheetKind" NOT NULL,
    "pages" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_day_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_day_corrections_transaction_id_key" ON "public"."branch_day_corrections"("transaction_id");

-- CreateIndex
CREATE INDEX "branch_day_corrections_branch_day_line_id_idx" ON "public"."branch_day_corrections"("branch_day_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_day_corrections_branch_day_id_idempotency_key_key" ON "public"."branch_day_corrections"("branch_day_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "branch_day_sheets_branch_day_id_version_key" ON "public"."branch_day_sheets"("branch_day_id", "version");

-- CreateIndex
CREATE INDEX "branch_day_departments_department_id_idx" ON "public"."branch_day_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_day_departments_branch_day_id_department_id_key" ON "public"."branch_day_departments"("branch_day_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_days_organization_id_reference_key" ON "public"."branch_days"("organization_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "branch_days_organization_id_close_idempotency_key_key" ON "public"."branch_days"("organization_id", "close_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "department_openings_branch_day_id_department_id_key" ON "public"."department_openings"("branch_day_id", "department_id");

-- AddForeignKey
ALTER TABLE "public"."branch_day_departments" ADD CONSTRAINT "branch_day_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_corrections" ADD CONSTRAINT "branch_day_corrections_branch_day_id_fkey" FOREIGN KEY ("branch_day_id") REFERENCES "public"."branch_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_corrections" ADD CONSTRAINT "branch_day_corrections_branch_day_line_id_fkey" FOREIGN KEY ("branch_day_line_id") REFERENCES "public"."branch_day_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_corrections" ADD CONSTRAINT "branch_day_corrections_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_corrections" ADD CONSTRAINT "branch_day_corrections_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."inventory_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_sheets" ADD CONSTRAINT "branch_day_sheets_branch_day_id_fkey" FOREIGN KEY ("branch_day_id") REFERENCES "public"."branch_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_sheets" ADD CONSTRAINT "branch_day_sheets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_openings" ADD CONSTRAINT "department_openings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Back-fill (contract §10.1): the department rows link to Block 1's departments through the legacy key and the day's branch.
UPDATE "public"."branch_day_departments" bdd
SET "department_id" = d."id"
FROM "public"."branch_days" bd, "public"."departments" d
WHERE bdd."branch_day_id" = bd."id"
  AND d."organization_id" = bd."organization_id"
  AND d."key" = bdd."department_tag"
  AND bdd."department_id" IS NULL;

UPDATE "public"."department_openings" o
SET "department_id" = d."id"
FROM "public"."branch_days" bd, "public"."departments" d
WHERE o."branch_day_id" = bd."id"
  AND d."organization_id" = bd."organization_id"
  AND d."key" = o."department_tag"
  AND o."department_id" IS NULL;

-- An opening is RECOUNTED where any line differs from last night's figure.
UPDATE "public"."department_openings" o
SET "kind" = 'RECOUNTED'
WHERE EXISTS (SELECT 1 FROM "public"."department_opening_lines" l WHERE l."opening_id" = o."id" AND l."overnight_variance" <> 0);

-- Old closed days keep no Used value (contract §0.4); their closing stock value is what was counted at the stored unit cost.
UPDATE "public"."branch_days" bd
SET "closing_value" = COALESCE((
  SELECT ROUND(SUM(l."counted_qty" * l."unit_cost"), 2)
  FROM "public"."branch_day_departments" dep
  JOIN "public"."branch_day_lines" l ON l."branch_day_department_id" = dep."id"
  WHERE dep."branch_day_id" = bd."id" AND l."counted_qty" IS NOT NULL
), 0)
WHERE bd."status" = 'CLOSED';
