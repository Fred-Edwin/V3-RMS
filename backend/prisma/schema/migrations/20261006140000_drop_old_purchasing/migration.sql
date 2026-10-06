-- Drop the old Milestone Two purchasing tables (expected deliveries, goods receipts, supplier invoices and
-- payments). The redone Purchasing (purchase_orders, purchase_deliveries, purchase_invoices, purchase_payments)
-- replaced them. Production holds no data in these tables (checked 6 Oct 2026).

-- supplier_documents.goods_receipt_id / supplier_invoice_id now point at purchase_deliveries / purchase_invoices
-- (same column names). Clear any old link first so the new foreign keys can be added.
UPDATE "public"."supplier_documents" SET "goods_receipt_id" = NULL, "supplier_invoice_id" = NULL;

-- DropForeignKey
ALTER TABLE "public"."supplier_documents" DROP CONSTRAINT "supplier_documents_goods_receipt_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_documents" DROP CONSTRAINT "supplier_documents_supplier_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."expected_deliveries" DROP CONSTRAINT "expected_deliveries_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."expected_deliveries" DROP CONSTRAINT "expected_deliveries_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."expected_deliveries" DROP CONSTRAINT "expected_deliveries_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."expected_delivery_lines" DROP CONSTRAINT "expected_delivery_lines_expected_delivery_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."expected_delivery_lines" DROP CONSTRAINT "expected_delivery_lines_inventory_item_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipt_lines" DROP CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipt_lines" DROP CONSTRAINT "goods_receipt_lines_inventory_item_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipt_lines" DROP CONSTRAINT "goods_receipt_lines_price_alert_accepted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipts" DROP CONSTRAINT "goods_receipts_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipts" DROP CONSTRAINT "goods_receipts_expected_delivery_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipts" DROP CONSTRAINT "goods_receipts_location_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipts" DROP CONSTRAINT "goods_receipts_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipts" DROP CONSTRAINT "goods_receipts_signed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."goods_receipts" DROP CONSTRAINT "goods_receipts_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_goods_receipt_line_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_invoice_adjustments" DROP CONSTRAINT "supplier_invoice_adjustments_recorded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_invoice_adjustments" DROP CONSTRAINT "supplier_invoice_adjustments_supplier_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_invoice_receipts" DROP CONSTRAINT "supplier_invoice_receipts_goods_receipt_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_invoice_receipts" DROP CONSTRAINT "supplier_invoice_receipts_supplier_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_invoices" DROP CONSTRAINT "supplier_invoices_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_invoices" DROP CONSTRAINT "supplier_invoices_recorded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_invoices" DROP CONSTRAINT "supplier_invoices_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_payment_allocations" DROP CONSTRAINT "supplier_payment_allocations_supplier_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_payment_allocations" DROP CONSTRAINT "supplier_payment_allocations_supplier_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_payments" DROP CONSTRAINT "supplier_payments_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_payments" DROP CONSTRAINT "supplier_payments_recorded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_payments" DROP CONSTRAINT "supplier_payments_reversal_of_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."supplier_payments" DROP CONSTRAINT "supplier_payments_supplier_id_fkey";

-- DropIndex
DROP INDEX "public"."inventory_transactions_goods_receipt_line_id_idx";

-- AlterTable
ALTER TABLE "public"."inventory_transactions" DROP COLUMN "goods_receipt_line_id";

-- DropTable
DROP TABLE "public"."expected_deliveries";

-- DropTable
DROP TABLE "public"."expected_delivery_lines";

-- DropTable
DROP TABLE "public"."goods_receipt_lines";

-- DropTable
DROP TABLE "public"."goods_receipts";

-- DropTable
DROP TABLE "public"."supplier_invoice_adjustments";

-- DropTable
DROP TABLE "public"."supplier_invoice_receipts";

-- DropTable
DROP TABLE "public"."supplier_invoices";

-- DropTable
DROP TABLE "public"."supplier_payment_allocations";

-- DropTable
DROP TABLE "public"."supplier_payments";

-- DropEnum
DROP TYPE "public"."DisputeStatus";

-- DropEnum
DROP TYPE "public"."ExpectedDeliveryStatus";

-- DropEnum
DROP TYPE "public"."GoodsReceiptStatus";

-- DropEnum
DROP TYPE "public"."SupplierInvoiceStatus";

-- DropEnum
DROP TYPE "public"."SupplierPaymentMethod";

-- AddForeignKey
ALTER TABLE "public"."supplier_documents" ADD CONSTRAINT "supplier_documents_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."purchase_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
