-- CreateEnum
CREATE TYPE "public"."MarketPurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT_TO_MARKET', 'RECONCILING', 'COMPLETED', 'RECEIVED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."inventory_items" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "market_purchase_order_line_id" TEXT;

-- CreateTable
CREATE TABLE "public"."market_purchase_orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "public"."MarketPurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "reconciled_by_id" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_purchase_order_lines" (
    "id" TEXT NOT NULL,
    "market_purchase_order_id" TEXT NOT NULL,
    "department_tag" "public"."DepartmentTag" NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "requested_qty" DECIMAL(12,4) NOT NULL,
    "actual_qty" DECIMAL(12,4),
    "unit_price" DECIMAL(12,4),
    "confirmed_by_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_purchase_orders_organization_id_idx" ON "public"."market_purchase_orders"("organization_id");

-- CreateIndex
CREATE INDEX "market_purchase_orders_status_idx" ON "public"."market_purchase_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "market_purchase_orders_organization_id_order_number_key" ON "public"."market_purchase_orders"("organization_id", "order_number");

-- CreateIndex
CREATE INDEX "market_purchase_order_lines_market_purchase_order_id_idx" ON "public"."market_purchase_order_lines"("market_purchase_order_id");

-- CreateIndex
CREATE INDEX "market_purchase_order_lines_inventory_item_id_idx" ON "public"."market_purchase_order_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "market_purchase_order_lines_department_tag_idx" ON "public"."market_purchase_order_lines"("department_tag");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_market_purchase_order_line_id_fkey" FOREIGN KEY ("market_purchase_order_line_id") REFERENCES "public"."market_purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_orders" ADD CONSTRAINT "market_purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_orders" ADD CONSTRAINT "market_purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_orders" ADD CONSTRAINT "market_purchase_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_orders" ADD CONSTRAINT "market_purchase_orders_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_order_lines" ADD CONSTRAINT "market_purchase_order_lines_market_purchase_order_id_fkey" FOREIGN KEY ("market_purchase_order_id") REFERENCES "public"."market_purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_order_lines" ADD CONSTRAINT "market_purchase_order_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_order_lines" ADD CONSTRAINT "market_purchase_order_lines_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_purchase_order_lines" ADD CONSTRAINT "market_purchase_order_lines_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
