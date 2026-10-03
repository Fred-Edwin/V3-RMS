-- CreateEnum
CREATE TYPE "public"."DispatchStatus" AS ENUM ('AWAITING', 'IN_TRANSIT', 'CONFIRMED', 'DISCREPANCY_OPEN');

-- CreateTable
CREATE TABLE "public"."dispatches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "to_organization_id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "department_tag" "public"."DepartmentTag" NOT NULL,
    "sequence_label" TEXT NOT NULL,
    "status" "public"."DispatchStatus" NOT NULL DEFAULT 'AWAITING',
    "dispatched_by_id" TEXT,
    "dispatched_at" TIMESTAMP(3),
    "confirmed_by_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_on_behalf" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatch_lines" (
    "id" TEXT NOT NULL,
    "dispatch_id" TEXT NOT NULL,
    "requisition_line_id" TEXT,
    "inventory_item_id" TEXT NOT NULL,
    "requested_qty" DECIMAL(12,4),
    "dispatched_qty" DECIMAL(12,4) NOT NULL,
    "confirmed_qty" DECIMAL(12,4),
    "cost_at_dispatch" DECIMAL(12,4) NOT NULL,
    "is_substitute" BOOLEAN NOT NULL DEFAULT false,
    "substitute_note" TEXT,

    CONSTRAINT "dispatch_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatches_organization_id_status_idx" ON "public"."dispatches"("organization_id", "status");

-- CreateIndex
CREATE INDEX "dispatches_to_organization_id_department_tag_status_idx" ON "public"."dispatches"("to_organization_id", "department_tag", "status");

-- CreateIndex
CREATE INDEX "dispatches_requisition_id_idx" ON "public"."dispatches"("requisition_id");

-- CreateIndex
CREATE INDEX "dispatch_lines_dispatch_id_idx" ON "public"."dispatch_lines"("dispatch_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_dispatch_line_id_idx" ON "public"."inventory_transactions"("dispatch_line_id");

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_to_organization_id_fkey" FOREIGN KEY ("to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_lines" ADD CONSTRAINT "dispatch_lines_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatch_lines" ADD CONSTRAINT "dispatch_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_dispatch_line_id_fkey" FOREIGN KEY ("dispatch_line_id") REFERENCES "public"."dispatch_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_dispatched_by_id_fkey" FOREIGN KEY ("dispatched_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
