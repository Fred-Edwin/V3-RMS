/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,type,department_tag]` on the table `locations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."RequisitionStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING_FULFILMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DispatchStatus" AS ENUM ('PICKING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'DEPARTMENT_HEAD';

-- DropIndex
DROP INDEX "public"."locations_organization_id_type_key";

-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "dispatch_line_id" TEXT,
ADD COLUMN     "market_purchase_line_id" TEXT;

-- AlterTable
ALTER TABLE "public"."locations" ADD COLUMN     "department_tag" "public"."DepartmentTag";

-- AlterTable
ALTER TABLE "public"."payslips" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "nssf_tier1" DROP DEFAULT,
ALTER COLUMN "nssf_tier2" DROP DEFAULT,
ALTER COLUMN "sha" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "department_tag" "public"."DepartmentTag",
ADD COLUMN     "previous_role" "public"."UserRole";

-- CreateTable
CREATE TABLE "public"."requisitions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "status" "public"."RequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requisition_lines" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "requested_qty" DECIMAL(12,4) NOT NULL,
    "approved_qty" DECIMAL(12,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatches" (
    "id" TEXT NOT NULL,
    "from_organization_id" TEXT NOT NULL,
    "to_organization_id" TEXT NOT NULL,
    "requisition_id" TEXT,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "status" "public"."DispatchStatus" NOT NULL DEFAULT 'PICKING',
    "dispatched_by_id" TEXT,
    "dispatched_at" TIMESTAMP(3),
    "received_by_id" TEXT,
    "received_at" TIMESTAMP(3),
    "delivery_note_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatch_lines" (
    "id" TEXT NOT NULL,
    "dispatch_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "requested_qty" DECIMAL(12,4) NOT NULL,
    "dispatched_qty" DECIMAL(12,4),
    "received_qty" DECIMAL(12,4),
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_purchases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_purchase_lines" (
    "id" TEXT NOT NULL,
    "market_purchase_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,

    CONSTRAINT "market_purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."par_levels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "par_qty" DECIMAL(12,4) NOT NULL,
    "set_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "par_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requisitions_organization_id_idx" ON "public"."requisitions"("organization_id");

-- CreateIndex
CREATE INDEX "requisitions_location_id_idx" ON "public"."requisitions"("location_id");

-- CreateIndex
CREATE INDEX "requisitions_requested_by_id_idx" ON "public"."requisitions"("requested_by_id");

-- CreateIndex
CREATE INDEX "requisitions_status_idx" ON "public"."requisitions"("status");

-- CreateIndex
CREATE INDEX "requisition_lines_requisition_id_idx" ON "public"."requisition_lines"("requisition_id");

-- CreateIndex
CREATE INDEX "requisition_lines_inventory_item_id_idx" ON "public"."requisition_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "dispatches_from_organization_id_idx" ON "public"."dispatches"("from_organization_id");

-- CreateIndex
CREATE INDEX "dispatches_to_organization_id_idx" ON "public"."dispatches"("to_organization_id");

-- CreateIndex
CREATE INDEX "dispatches_requisition_id_idx" ON "public"."dispatches"("requisition_id");

-- CreateIndex
CREATE INDEX "dispatches_status_idx" ON "public"."dispatches"("status");

-- CreateIndex
CREATE INDEX "dispatch_lines_dispatch_id_idx" ON "public"."dispatch_lines"("dispatch_id");

-- CreateIndex
CREATE INDEX "dispatch_lines_inventory_item_id_idx" ON "public"."dispatch_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "market_purchases_organization_id_idx" ON "public"."market_purchases"("organization_id");

-- CreateIndex
CREATE INDEX "market_purchases_location_id_idx" ON "public"."market_purchases"("location_id");

-- CreateIndex
CREATE INDEX "market_purchases_recorded_by_id_idx" ON "public"."market_purchases"("recorded_by_id");

-- CreateIndex
CREATE INDEX "market_purchase_lines_market_purchase_id_idx" ON "public"."market_purchase_lines"("market_purchase_id");

-- CreateIndex
CREATE INDEX "market_purchase_lines_inventory_item_id_idx" ON "public"."market_purchase_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "par_levels_organization_id_idx" ON "public"."par_levels"("organization_id");

-- CreateIndex
CREATE INDEX "par_levels_inventory_item_id_idx" ON "public"."par_levels"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "par_levels_location_id_inventory_item_id_key" ON "public"."par_levels"("location_id", "inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_organization_id_type_department_tag_key" ON "public"."locations"("organization_id", "type", "department_tag");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_dispatch_line_id_fkey" FOREIGN KEY ("dispatch_line_id") REFERENCES "public"."dispatch_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_market_purchase_line_id_fkey" FOREIGN KEY ("market_purchase_line_id") REFERENCES "public"."market_purchase_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_lines" ADD CONSTRAINT "requisition_lines_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_lines" ADD CONSTRAINT "requisition_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_lines" ADD CONSTRAINT "requisition_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_to_organization_id_fkey" FOREIGN KEY ("to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_dispatched_by_id_fkey" FOREIGN KEY ("dispatched_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_lines" ADD CONSTRAINT "dispatch_lines_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_lines" ADD CONSTRAINT "dispatch_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchases" ADD CONSTRAINT "market_purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchases" ADD CONSTRAINT "market_purchases_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchases" ADD CONSTRAINT "market_purchases_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_lines" ADD CONSTRAINT "market_purchase_lines_market_purchase_id_fkey" FOREIGN KEY ("market_purchase_id") REFERENCES "public"."market_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_lines" ADD CONSTRAINT "market_purchase_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_lines" ADD CONSTRAINT "market_purchase_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."par_levels" ADD CONSTRAINT "par_levels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."par_levels" ADD CONSTRAINT "par_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."par_levels" ADD CONSTRAINT "par_levels_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."par_levels" ADD CONSTRAINT "par_levels_set_by_id_fkey" FOREIGN KEY ("set_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
