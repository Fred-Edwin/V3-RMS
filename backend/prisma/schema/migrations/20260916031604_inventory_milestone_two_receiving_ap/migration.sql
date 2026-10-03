/*
  Warnings:

  - You are about to drop the column `purchase_order_line_id` on the `inventory_transactions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."ExpectedDeliveryStatus" AS ENUM ('AWAITING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."GoodsReceiptStatus" AS ENUM ('DRAFT', 'RECEIVED_INVOICE_PENDING', 'RECEIVED_PAID', 'INVOICE_RECORDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SupplierInvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "public"."DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."SupplierPaymentMethod" AS ENUM ('BANK', 'CASH', 'MPESA');

-- AlterTable
ALTER TABLE "public"."inventory_transactions" DROP COLUMN "purchase_order_line_id",
ADD COLUMN     "goods_receipt_line_id" TEXT;

-- AlterTable
ALTER TABLE "public"."suppliers" ADD COLUMN     "payment_days" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "public"."reference_counters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expected_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "payment_terms" "public"."SupplierPaymentTerms" NOT NULL,
    "status" "public"."ExpectedDeliveryStatus" NOT NULL DEFAULT 'AWAITING',
    "expected_date" TIMESTAMP(3),
    "estimated_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expected_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expected_delivery_lines" (
    "id" TEXT NOT NULL,
    "expected_delivery_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "estimated_unit_price" DECIMAL(12,4) NOT NULL,
    "line_order" INTEGER NOT NULL,

    CONSTRAINT "expected_delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goods_receipts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "expected_delivery_id" TEXT,
    "payment_terms" "public"."SupplierPaymentTerms" NOT NULL,
    "status" "public"."GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier_doc_number" TEXT,
    "supplier_doc_date" TIMESTAMP(3),
    "receipt_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "location_id" TEXT NOT NULL,
    "signed_by_id" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity_buy_unit" DECIMAL(12,4) NOT NULL,
    "quantity_usage_unit" DECIMAL(12,4) NOT NULL,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "line_order" INTEGER NOT NULL,
    "price_alert_pct" DECIMAL(6,2),
    "price_alert_prev_price" DECIMAL(12,4),
    "price_alert_accepted_by_id" TEXT,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount_billed" DECIMAL(12,2) NOT NULL,
    "status" "public"."SupplierInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "dispute_status" "public"."DisputeStatus",
    "dispute_our_figure" DECIMAL(12,2),
    "dispute_reason" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_invoice_receipts" (
    "supplier_invoice_id" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,

    CONSTRAINT "supplier_invoice_receipts_pkey" PRIMARY KEY ("supplier_invoice_id","goods_receipt_id")
);

-- CreateTable
CREATE TABLE "public"."supplier_invoice_adjustments" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "method" "public"."SupplierPaymentMethod" NOT NULL,
    "reference" TEXT,
    "reversal_of_id" TEXT,
    "reversal_reason" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_payment_allocations" (
    "id" TEXT NOT NULL,
    "supplier_payment_id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reference_counters_organization_id_idx" ON "public"."reference_counters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "reference_counters_organization_id_prefix_key" ON "public"."reference_counters"("organization_id", "prefix");

-- CreateIndex
CREATE INDEX "expected_deliveries_organization_id_status_idx" ON "public"."expected_deliveries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "expected_deliveries_supplier_id_idx" ON "public"."expected_deliveries"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "expected_deliveries_organization_id_reference_key" ON "public"."expected_deliveries"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "expected_delivery_lines_expected_delivery_id_idx" ON "public"."expected_delivery_lines"("expected_delivery_id");

-- CreateIndex
CREATE INDEX "expected_delivery_lines_inventory_item_id_idx" ON "public"."expected_delivery_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "goods_receipts_organization_id_status_idx" ON "public"."goods_receipts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "public"."goods_receipts"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipts_expected_delivery_id_idx" ON "public"."goods_receipts"("expected_delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_organization_id_reference_key" ON "public"."goods_receipts"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_goods_receipt_id_idx" ON "public"."goods_receipt_lines"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_inventory_item_id_idx" ON "public"."goods_receipt_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_organization_id_status_idx" ON "public"."supplier_invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "supplier_invoices_supplier_id_due_date_idx" ON "public"."supplier_invoices"("supplier_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_organization_id_supplier_id_invoice_numbe_key" ON "public"."supplier_invoices"("organization_id", "supplier_id", "invoice_number");

-- CreateIndex
CREATE INDEX "supplier_invoice_receipts_goods_receipt_id_idx" ON "public"."supplier_invoice_receipts"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_adjustments_supplier_invoice_id_idx" ON "public"."supplier_invoice_adjustments"("supplier_invoice_id");

-- CreateIndex
CREATE INDEX "supplier_payments_organization_id_supplier_id_idx" ON "public"."supplier_payments"("organization_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_supplier_invoice_id_idx" ON "public"."supplier_payment_allocations"("supplier_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payment_allocations_supplier_payment_id_supplier_i_key" ON "public"."supplier_payment_allocations"("supplier_payment_id", "supplier_invoice_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_goods_receipt_line_id_idx" ON "public"."inventory_transactions"("goods_receipt_line_id");

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reference_counters" ADD CONSTRAINT "reference_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expected_deliveries" ADD CONSTRAINT "expected_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expected_deliveries" ADD CONSTRAINT "expected_deliveries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expected_deliveries" ADD CONSTRAINT "expected_deliveries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expected_delivery_lines" ADD CONSTRAINT "expected_delivery_lines_expected_delivery_id_fkey" FOREIGN KEY ("expected_delivery_id") REFERENCES "public"."expected_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expected_delivery_lines" ADD CONSTRAINT "expected_delivery_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_expected_delivery_id_fkey" FOREIGN KEY ("expected_delivery_id") REFERENCES "public"."expected_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_price_alert_accepted_by_id_fkey" FOREIGN KEY ("price_alert_accepted_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoices" ADD CONSTRAINT "supplier_invoices_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoice_receipts" ADD CONSTRAINT "supplier_invoice_receipts_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoice_receipts" ADD CONSTRAINT "supplier_invoice_receipts_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoice_adjustments" ADD CONSTRAINT "supplier_invoice_adjustments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_invoice_adjustments" ADD CONSTRAINT "supplier_invoice_adjustments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."supplier_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplier_payment_id_fkey" FOREIGN KEY ("supplier_payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
