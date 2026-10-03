-- CreateEnum
CREATE TYPE "public"."StockCountKind" AS ENUM ('DAILY', 'SPOT');

-- CreateEnum
CREATE TYPE "public"."StockCountStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "public"."CountLineDecision" AS ENUM ('PENDING', 'ACCEPTED', 'QUERIED');

-- CreateEnum
CREATE TYPE "public"."CountReason" AS ENUM ('SUSPECTED_MISCOUNT', 'UNLOGGED_SPOILAGE', 'SUSPECTED_LOSS', 'WITHIN_NORMAL_RANGE', 'OTHER');

-- CreateTable
CREATE TABLE "public"."stock_counts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "kind" "public"."StockCountKind" NOT NULL,
    "count_date" DATE NOT NULL,
    "status" "public"."StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "reference" TEXT NOT NULL,
    "counter_id" TEXT NOT NULL,
    "counter_signed_at" TIMESTAMP(3),
    "verifier_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "return_note" TEXT,
    "returned_at" TIMESTAMP(3),
    "returned_by_id" TEXT,
    "director_notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_count_lines" (
    "id" TEXT NOT NULL,
    "stock_count_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "counted_qty" DECIMAL(12,4),
    "first_counted_qty" DECIMAL(12,4),
    "expected_qty" DECIMAL(12,4),
    "unit_cost" DECIMAL(12,4),
    "decision" "public"."CountLineDecision" NOT NULL DEFAULT 'PENDING',
    "reason" "public"."CountReason",
    "reason_note" TEXT,
    "reason_required" BOOLEAN NOT NULL DEFAULT false,
    "query_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."counting_thresholds" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reason_required_kes" INTEGER NOT NULL,
    "overnight_alert_kes" INTEGER,
    "director_alert_kes" INTEGER,
    "updated_by_id" TEXT,
    "director_updated_by_id" TEXT,
    "director_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counting_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_counts_organization_id_kind_status_idx" ON "public"."stock_counts"("organization_id", "kind", "status");

-- CreateIndex
CREATE INDEX "stock_counts_location_id_count_date_idx" ON "public"."stock_counts"("location_id", "count_date");

-- CreateIndex
CREATE INDEX "stock_count_lines_inventory_item_id_idx" ON "public"."stock_count_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_lines_stock_count_id_inventory_item_id_key" ON "public"."stock_count_lines"("stock_count_id", "inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "counting_thresholds_organization_id_key" ON "public"."counting_thresholds"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_stock_count_line_id_idx" ON "public"."inventory_transactions"("stock_count_line_id");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_stock_count_line_id_fkey" FOREIGN KEY ("stock_count_line_id") REFERENCES "public"."stock_count_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_count_lines" ADD CONSTRAINT "stock_count_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counting_thresholds" ADD CONSTRAINT "counting_thresholds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counting_thresholds" ADD CONSTRAINT "counting_thresholds_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counting_thresholds" ADD CONSTRAINT "counting_thresholds_director_updated_by_id_fkey" FOREIGN KEY ("director_updated_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One DAILY count per Central Store per business day (partial: SPOT counts are unconstrained).
CREATE UNIQUE INDEX "stock_counts_daily_unique" ON "stock_counts" ("location_id", "count_date") WHERE "kind" = 'DAILY';
