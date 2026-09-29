-- CreateEnum
CREATE TYPE "public"."BranchDayStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."BranchDayDepartmentStatus" AS ENUM ('NOT_STARTED', 'COUNTED');

-- CreateEnum
CREATE TYPE "public"."GapReason" AS ENUM ('CONSUMPTION', 'UNLOGGED_WASTE', 'WALK_IN_COMP', 'SUSPECTED_LOSS', 'OTHER');

-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "branch_day_line_id" TEXT;

-- CreateTable
CREATE TABLE "public"."branch_days" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_date" DATE NOT NULL,
    "status" "public"."BranchDayStatus" NOT NULL DEFAULT 'OPEN',
    "reference" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branch_day_departments" (
    "id" TEXT NOT NULL,
    "branch_day_id" TEXT NOT NULL,
    "department_tag" "public"."DepartmentTag" NOT NULL,
    "location_id" TEXT NOT NULL,
    "status" "public"."BranchDayDepartmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "counted_by_id" TEXT,
    "counted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_day_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branch_day_lines" (
    "id" TEXT NOT NULL,
    "branch_day_department_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "counted_qty" DECIMAL(12,4),
    "expected_qty" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "reason" "public"."GapReason",
    "reason_note" TEXT,
    "reason_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_day_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branch_day_reopens" (
    "id" TEXT NOT NULL,
    "branch_day_id" TEXT NOT NULL,
    "reopened_by_id" TEXT NOT NULL,
    "reopened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,

    CONSTRAINT "branch_day_reopens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_days_organization_id_status_idx" ON "public"."branch_days"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "branch_days_organization_id_business_date_key" ON "public"."branch_days"("organization_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "branch_day_departments_branch_day_id_department_tag_key" ON "public"."branch_day_departments"("branch_day_id", "department_tag");

-- CreateIndex
CREATE INDEX "branch_day_lines_inventory_item_id_idx" ON "public"."branch_day_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_day_lines_branch_day_department_id_inventory_item_id_key" ON "public"."branch_day_lines"("branch_day_department_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "branch_day_reopens_branch_day_id_idx" ON "public"."branch_day_reopens"("branch_day_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_branch_day_line_id_idx" ON "public"."inventory_transactions"("branch_day_line_id");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_branch_day_line_id_fkey" FOREIGN KEY ("branch_day_line_id") REFERENCES "public"."branch_day_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_days" ADD CONSTRAINT "branch_days_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_days" ADD CONSTRAINT "branch_days_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_departments" ADD CONSTRAINT "branch_day_departments_branch_day_id_fkey" FOREIGN KEY ("branch_day_id") REFERENCES "public"."branch_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_departments" ADD CONSTRAINT "branch_day_departments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_departments" ADD CONSTRAINT "branch_day_departments_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_lines" ADD CONSTRAINT "branch_day_lines_branch_day_department_id_fkey" FOREIGN KEY ("branch_day_department_id") REFERENCES "public"."branch_day_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_lines" ADD CONSTRAINT "branch_day_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_reopens" ADD CONSTRAINT "branch_day_reopens_branch_day_id_fkey" FOREIGN KEY ("branch_day_id") REFERENCES "public"."branch_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_day_reopens" ADD CONSTRAINT "branch_day_reopens_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

