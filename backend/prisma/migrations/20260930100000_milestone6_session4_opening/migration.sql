-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "opening_line_id" TEXT;

-- CreateTable
CREATE TABLE "public"."department_openings" (
    "id" TEXT NOT NULL,
    "branch_day_id" TEXT NOT NULL,
    "department_tag" "public"."DepartmentTag" NOT NULL,
    "location_id" TEXT NOT NULL,
    "accepted_by_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."department_opening_lines" (
    "id" TEXT NOT NULL,
    "opening_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "prefilled_qty" DECIMAL(12,4) NOT NULL,
    "accepted_qty" DECIMAL(12,4) NOT NULL,
    "overnight_variance" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_opening_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_openings_branch_day_id_department_tag_key" ON "public"."department_openings"("branch_day_id", "department_tag");

-- CreateIndex
CREATE INDEX "department_opening_lines_inventory_item_id_idx" ON "public"."department_opening_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_opening_lines_opening_id_inventory_item_id_key" ON "public"."department_opening_lines"("opening_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_opening_line_id_idx" ON "public"."inventory_transactions"("opening_line_id");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_opening_line_id_fkey" FOREIGN KEY ("opening_line_id") REFERENCES "public"."department_opening_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_openings" ADD CONSTRAINT "department_openings_branch_day_id_fkey" FOREIGN KEY ("branch_day_id") REFERENCES "public"."branch_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_openings" ADD CONSTRAINT "department_openings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_openings" ADD CONSTRAINT "department_openings_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_opening_lines" ADD CONSTRAINT "department_opening_lines_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "public"."department_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department_opening_lines" ADD CONSTRAINT "department_opening_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

