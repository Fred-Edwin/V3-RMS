-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('CENTRAL_STORE', 'BRANCH_DEPARTMENT');

-- CreateEnum
CREATE TYPE "public"."DepartmentTag" AS ENUM ('KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING');

-- CreateEnum
CREATE TYPE "public"."InventoryItemType" AS ENUM ('RAW', 'PREPPED', 'PASS_THROUGH');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SupplierInvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "public"."StockCountStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "public"."WasteReason" AS ENUM ('SPOILED', 'PREP_ERROR', 'DROPPED', 'EXPIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."InventoryTransactionType" AS ENUM ('RECEIVE', 'PREP_CONSUME', 'PREP_PRODUCE', 'WASTE', 'ADJUSTMENT', 'DISPATCH_OUT', 'DISPATCH_IN', 'MARKET_RECEIVE', 'SALE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."UserRole" ADD VALUE 'STORE_MANAGER';
ALTER TYPE "public"."UserRole" ADD VALUE 'STORE_ATTENDANT';

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "public"."LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."InventoryItemType" NOT NULL,
    "buy_unit" TEXT NOT NULL,
    "usage_unit" TEXT NOT NULL,
    "conversion_factor" DECIMAL(12,4) NOT NULL,
    "reorder_level" DECIMAL(12,4) NOT NULL,
    "department_tags" "public"."DepartmentTag"[],
    "current_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_price" DECIMAL(12,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "ordered_qty" DECIMAL(12,4) NOT NULL,
    "received_qty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "invoice_price" DECIMAL(12,4),
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "reference_number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "public"."SupplierInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_recipes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "output_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expected_yield" DECIMAL(12,4) NOT NULL,
    "batch_label" TEXT,
    "instructions" TEXT,
    "promoted_from_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prep_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_recipe_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "prep_recipe_id" TEXT NOT NULL,
    "input_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "prep_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "output_item_id" TEXT NOT NULL,
    "actual_yield" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prep_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_record_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "prep_record_id" TEXT NOT NULL,
    "input_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "prep_record_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_counts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "public"."StockCountStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_count_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stock_count_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "expected_qty" DECIMAL(12,4),
    "counted_qty" DECIMAL(12,4),
    "gap_qty" DECIMAL(12,4),

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waste_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "reason" "public"."WasteReason" NOT NULL,
    "note" TEXT,
    "logged_by_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "type" "public"."InventoryTransactionType" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "reason" TEXT,
    "purchase_order_line_id" TEXT,
    "prep_record_id" TEXT,
    "waste_log_id" TEXT,
    "stock_count_line_id" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_organization_id_idx" ON "public"."locations"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_items_organization_id_idx" ON "public"."inventory_items"("organization_id");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "public"."suppliers"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_items_organization_id_idx" ON "public"."supplier_items"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_items_inventory_item_id_idx" ON "public"."supplier_items"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_items_supplier_id_inventory_item_id_key" ON "public"."supplier_items"("supplier_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_idx" ON "public"."purchase_orders"("organization_id");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "public"."purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_location_id_idx" ON "public"."purchase_orders"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organization_id_po_number_key" ON "public"."purchase_orders"("organization_id", "po_number");

-- CreateIndex
CREATE INDEX "purchase_order_lines_organization_id_idx" ON "public"."purchase_order_lines"("organization_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "public"."purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_inventory_item_id_idx" ON "public"."purchase_order_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_organization_id_idx" ON "public"."supplier_invoices"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_supplier_id_idx" ON "public"."supplier_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_purchase_order_id_idx" ON "public"."supplier_invoices"("purchase_order_id");

-- CreateIndex
CREATE INDEX "supplier_payments_organization_id_idx" ON "public"."supplier_payments"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_payments_supplier_invoice_id_idx" ON "public"."supplier_payments"("supplier_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "prep_recipes_promoted_from_id_key" ON "public"."prep_recipes"("promoted_from_id");

-- CreateIndex
CREATE INDEX "prep_recipes_organization_id_idx" ON "public"."prep_recipes"("organization_id");

-- CreateIndex
CREATE INDEX "prep_recipes_output_item_id_idx" ON "public"."prep_recipes"("output_item_id");

-- CreateIndex
CREATE INDEX "prep_recipe_lines_organization_id_idx" ON "public"."prep_recipe_lines"("organization_id");

-- CreateIndex
CREATE INDEX "prep_recipe_lines_prep_recipe_id_idx" ON "public"."prep_recipe_lines"("prep_recipe_id");

-- CreateIndex
CREATE INDEX "prep_recipe_lines_input_item_id_idx" ON "public"."prep_recipe_lines"("input_item_id");

-- CreateIndex
CREATE INDEX "prep_records_organization_id_idx" ON "public"."prep_records"("organization_id");

-- CreateIndex
CREATE INDEX "prep_records_location_id_idx" ON "public"."prep_records"("location_id");

-- CreateIndex
CREATE INDEX "prep_records_output_item_id_idx" ON "public"."prep_records"("output_item_id");

-- CreateIndex
CREATE INDEX "prep_record_lines_organization_id_idx" ON "public"."prep_record_lines"("organization_id");

-- CreateIndex
CREATE INDEX "prep_record_lines_prep_record_id_idx" ON "public"."prep_record_lines"("prep_record_id");

-- CreateIndex
CREATE INDEX "prep_record_lines_input_item_id_idx" ON "public"."prep_record_lines"("input_item_id");

-- CreateIndex
CREATE INDEX "stock_counts_organization_id_idx" ON "public"."stock_counts"("organization_id");

-- CreateIndex
CREATE INDEX "stock_counts_location_id_idx" ON "public"."stock_counts"("location_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_organization_id_idx" ON "public"."stock_count_lines"("organization_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_stock_count_id_idx" ON "public"."stock_count_lines"("stock_count_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_inventory_item_id_idx" ON "public"."stock_count_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "waste_logs_organization_id_idx" ON "public"."waste_logs"("organization_id");

-- CreateIndex
CREATE INDEX "waste_logs_location_id_idx" ON "public"."waste_logs"("location_id");

-- CreateIndex
CREATE INDEX "waste_logs_inventory_item_id_idx" ON "public"."waste_logs"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_organization_id_idx" ON "public"."inventory_transactions"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_location_id_idx" ON "public"."inventory_transactions"("location_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventory_item_id_idx" ON "public"."inventory_transactions"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_idx" ON "public"."inventory_transactions"("type");

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_items" ADD CONSTRAINT "supplier_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_items" ADD CONSTRAINT "supplier_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_items" ADD CONSTRAINT "supplier_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipes" ADD CONSTRAINT "prep_recipes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipes" ADD CONSTRAINT "prep_recipes_output_item_id_fkey" FOREIGN KEY ("output_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipes" ADD CONSTRAINT "prep_recipes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipes" ADD CONSTRAINT "prep_recipes_promoted_from_id_fkey" FOREIGN KEY ("promoted_from_id") REFERENCES "public"."prep_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_lines" ADD CONSTRAINT "prep_recipe_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_lines" ADD CONSTRAINT "prep_recipe_lines_prep_recipe_id_fkey" FOREIGN KEY ("prep_recipe_id") REFERENCES "public"."prep_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_recipe_lines" ADD CONSTRAINT "prep_recipe_lines_input_item_id_fkey" FOREIGN KEY ("input_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_records" ADD CONSTRAINT "prep_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_records" ADD CONSTRAINT "prep_records_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_records" ADD CONSTRAINT "prep_records_output_item_id_fkey" FOREIGN KEY ("output_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_records" ADD CONSTRAINT "prep_records_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_record_lines" ADD CONSTRAINT "prep_record_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_record_lines" ADD CONSTRAINT "prep_record_lines_prep_record_id_fkey" FOREIGN KEY ("prep_record_id") REFERENCES "public"."prep_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_record_lines" ADD CONSTRAINT "prep_record_lines_input_item_id_fkey" FOREIGN KEY ("input_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_counts" ADD CONSTRAINT "stock_counts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_count_lines" ADD CONSTRAINT "stock_count_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_count_lines" ADD CONSTRAINT "stock_count_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_prep_record_id_fkey" FOREIGN KEY ("prep_record_id") REFERENCES "public"."prep_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_waste_log_id_fkey" FOREIGN KEY ("waste_log_id") REFERENCES "public"."waste_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
