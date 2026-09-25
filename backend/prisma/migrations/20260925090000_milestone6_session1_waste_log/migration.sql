-- CreateEnum
CREATE TYPE "public"."WasteReason" AS ENUM ('SPOILAGE', 'EXPIRY', 'DAMAGE_IN_STORE', 'PREP_ERROR');

-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "reference" TEXT,
ADD COLUMN     "reverses_transaction_id" TEXT;

-- CreateTable
CREATE TABLE "public"."waste_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "reason" "public"."WasteReason" NOT NULL,
    "note" TEXT,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "logged_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waste_logs_organization_id_created_at_idx" ON "public"."waste_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "waste_logs_location_id_created_at_idx" ON "public"."waste_logs"("location_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_reverses_transaction_id_key" ON "public"."inventory_transactions"("reverses_transaction_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_waste_log_id_idx" ON "public"."inventory_transactions"("waste_log_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_location_id_inventory_item_id_create_idx" ON "public"."inventory_transactions"("location_id", "inventory_item_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_waste_log_id_fkey" FOREIGN KEY ("waste_log_id") REFERENCES "public"."waste_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_reverses_transaction_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "public"."inventory_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

