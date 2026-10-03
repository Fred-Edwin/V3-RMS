-- CreateEnum
CREATE TYPE "public"."RequisitionType" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'AD_HOC');

-- CreateEnum
CREATE TYPE "public"."RequisitionStatus" AS ENUM ('OPEN', 'PENDING_APPROVAL', 'APPROVED');

-- CreateEnum
CREATE TYPE "public"."RequisitionSectionStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED');

-- CreateTable
CREATE TABLE "public"."requisitions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "public"."RequisitionType" NOT NULL,
    "note" TEXT,
    "status" "public"."RequisitionStatus" NOT NULL DEFAULT 'OPEN',
    "opened_by_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requisition_sections" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "department_tag" "public"."DepartmentTag" NOT NULL,
    "status" "public"."RequisitionSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "returned_note" TEXT,
    "manager_note" TEXT,

    CONSTRAINT "requisition_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requisition_lines" (
    "id" TEXT NOT NULL,
    "requisition_section_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "par_at_request" DECIMAL(12,4),
    "requested_qty" DECIMAL(12,4),
    "approved_qty" DECIMAL(12,4),
    "added_from_note" BOOLEAN NOT NULL DEFAULT false,
    "edited_by_id" TEXT,
    "edit_reason" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requisitions_organization_id_status_idx" ON "public"."requisitions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "requisition_sections_requisition_id_department_tag_key" ON "public"."requisition_sections"("requisition_id", "department_tag");

-- CreateIndex
CREATE INDEX "requisition_lines_requisition_section_id_idx" ON "public"."requisition_lines"("requisition_section_id");

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_sections" ADD CONSTRAINT "requisition_sections_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_sections" ADD CONSTRAINT "requisition_sections_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_lines" ADD CONSTRAINT "requisition_lines_requisition_section_id_fkey" FOREIGN KEY ("requisition_section_id") REFERENCES "public"."requisition_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_lines" ADD CONSTRAINT "requisition_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_lines" ADD CONSTRAINT "requisition_lines_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
