-- CreateTable
CREATE TABLE "public"."prep_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "output_item_id" TEXT NOT NULL,
    "actual_yield" DECIMAL(12,4) NOT NULL,
    "output_unit_cost" DECIMAL(12,4) NOT NULL,
    "total_input_cost" DECIMAL(12,2) NOT NULL,
    "typical_yield_at_run_time" DECIMAL(12,4),
    "yield_variance_label" TEXT,
    "notified_store_manager" BOOLEAN NOT NULL DEFAULT false,
    "location_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prep_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_run_input_lines" (
    "id" TEXT NOT NULL,
    "prep_run_id" TEXT NOT NULL,
    "input_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost_at_run_time" DECIMAL(12,4) NOT NULL,
    "line_cost" DECIMAL(12,2) NOT NULL,
    "line_order" INTEGER NOT NULL,

    CONSTRAINT "prep_run_input_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prep_runs_organization_id_idx" ON "public"."prep_runs"("organization_id");

-- CreateIndex
CREATE INDEX "prep_runs_organization_id_output_item_id_idx" ON "public"."prep_runs"("organization_id", "output_item_id");

-- CreateIndex
CREATE INDEX "prep_runs_location_id_idx" ON "public"."prep_runs"("location_id");

-- CreateIndex
CREATE INDEX "prep_run_input_lines_prep_run_id_idx" ON "public"."prep_run_input_lines"("prep_run_id");

-- CreateIndex
CREATE INDEX "prep_run_input_lines_input_item_id_idx" ON "public"."prep_run_input_lines"("input_item_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_prep_record_id_idx" ON "public"."inventory_transactions"("prep_record_id");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_prep_record_id_fkey" FOREIGN KEY ("prep_record_id") REFERENCES "public"."prep_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_output_item_id_fkey" FOREIGN KEY ("output_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_runs" ADD CONSTRAINT "prep_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_run_input_lines" ADD CONSTRAINT "prep_run_input_lines_prep_run_id_fkey" FOREIGN KEY ("prep_run_id") REFERENCES "public"."prep_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_run_input_lines" ADD CONSTRAINT "prep_run_input_lines_input_item_id_fkey" FOREIGN KEY ("input_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
