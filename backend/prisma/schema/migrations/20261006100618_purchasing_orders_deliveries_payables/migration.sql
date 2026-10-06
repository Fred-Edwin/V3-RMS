-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT', 'DELIVERED', 'INVOICED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PurchaseSendVia" AS ENUM ('WHATSAPP', 'PRINT', 'LINK', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."PurchaseCancelReason" AS ENUM ('ORDERED_BY_MISTAKE', 'SUPPLIER_CANNOT_SUPPLY', 'NO_LONGER_NEEDED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PurchaseLineResult" AS ENUM ('AS_ORDERED', 'PRICE_CHANGED', 'SHORT', 'NOT_SUPPLIED');

-- CreateEnum
CREATE TYPE "public"."PurchaseInvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "public"."PurchaseVoidReason" AS ENUM ('WRONG_AMOUNT', 'WRONG_SUPPLIER_OR_ORDER', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PurchasePaymentKind" AS ENUM ('ADVANCE', 'INVOICE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "public"."PurchasePaymentStatus" AS ENUM ('RECORDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."PurchaseReverseReason" AS ENUM ('WRONG_AMOUNT', 'WRONG_REFERENCE', 'WRONG_INVOICE', 'PAYMENT_BOUNCED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PurchasingAuditArea" AS ENUM ('PURCHASING', 'PAYMENTS');

-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "purchase_delivery_line_id" TEXT;

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT,
    "supplier_id" TEXT NOT NULL,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "terms_days" INTEGER,
    "expected_date" DATE,
    "supplier_note" TEXT,
    "attendant_note" TEXT,
    "raised_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "returned_note" TEXT,
    "returned_by_id" TEXT,
    "returned_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_via" "public"."PurchaseSendVia",
    "sent_by_id" TEXT,
    "cancel_reason" "public"."PurchaseCancelReason",
    "cancel_note" TEXT,
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_lines" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "line_order" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "supplier_item_name" TEXT,
    "supplier_item_code" TEXT,
    "buy_unit" TEXT NOT NULL,
    "pack_size" DECIMAL(12,4),
    "ordered_qty" DECIMAL(12,4) NOT NULL,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "previous_price" DECIMAL(12,4),
    "received_qty" DECIMAL(12,4),
    "delivered_price" DECIMAL(12,4),
    "confirmed_price" DECIMAL(12,4),
    "result" "public"."PurchaseLineResult",

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "delivery_note_no" TEXT NOT NULL,
    "delivery_note_file_id" TEXT,
    "received_by_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_total" DECIMAL(12,2) NOT NULL,
    "not_supplied_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_delivery_lines" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "order_line_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity_buy_unit" DECIMAL(12,4) NOT NULL,
    "quantity_usage_unit" DECIMAL(12,4) NOT NULL,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "line_order" INTEGER NOT NULL,

    CONSTRAINT "purchase_delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "public"."PurchaseInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "variance_amount" DECIMAL(12,2),
    "variance_reason" TEXT,
    "settled_amount" DECIMAL(12,2),
    "settled_note" TEXT,
    "settled_by_id" TEXT,
    "settled_at" TIMESTAMP(3),
    "void_reason" "public"."PurchaseVoidReason",
    "voided_by_id" TEXT,
    "voided_at" TIMESTAMP(3),
    "file_id" TEXT,
    "entered_by_id" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" "public"."PurchasePaymentKind" NOT NULL,
    "status" "public"."PurchasePaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_on" DATE NOT NULL,
    "method" "public"."SupplierPayMethodType" NOT NULL,
    "method_ref" TEXT,
    "cheque_no" TEXT,
    "note" TEXT,
    "proof_file_id" TEXT,
    "reverses_id" TEXT,
    "reverse_reason" "public"."PurchaseReverseReason",
    "approved_by_id" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "added_by_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_files" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchasing_audit" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "area" "public"."PurchasingAuditArea" NOT NULL,
    "action" TEXT NOT NULL,
    "document" TEXT,
    "detail" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchasing_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_status_idx" ON "public"."purchase_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_supplier_id_status_idx" ON "public"."purchase_orders"("organization_id", "supplier_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_raised_by_id_idx" ON "public"."purchase_orders"("raised_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organization_id_reference_key" ON "public"."purchase_orders"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "purchase_order_lines_order_id_idx" ON "public"."purchase_order_lines"("order_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_inventory_item_id_idx" ON "public"."purchase_order_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_deliveries_order_id_key" ON "public"."purchase_deliveries"("order_id");

-- CreateIndex
CREATE INDEX "purchase_deliveries_organization_id_idx" ON "public"."purchase_deliveries"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_deliveries_organization_id_reference_key" ON "public"."purchase_deliveries"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "purchase_delivery_lines_delivery_id_idx" ON "public"."purchase_delivery_lines"("delivery_id");

-- CreateIndex
CREATE INDEX "purchase_delivery_lines_order_line_id_idx" ON "public"."purchase_delivery_lines"("order_line_id");

-- CreateIndex
CREATE INDEX "purchase_delivery_lines_inventory_item_id_idx" ON "public"."purchase_delivery_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_organization_id_supplier_id_due_date_idx" ON "public"."purchase_invoices"("organization_id", "supplier_id", "due_date");

-- CreateIndex
CREATE INDEX "purchase_invoices_order_id_idx" ON "public"."purchase_invoices"("order_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_organization_id_supplier_id_number_idx" ON "public"."purchase_invoices"("organization_id", "supplier_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_payments_reverses_id_key" ON "public"."purchase_payments"("reverses_id");

-- CreateIndex
CREATE INDEX "purchase_payments_organization_id_supplier_id_paid_on_idx" ON "public"."purchase_payments"("organization_id", "supplier_id", "paid_on");

-- CreateIndex
CREATE INDEX "purchase_payments_order_id_idx" ON "public"."purchase_payments"("order_id");

-- CreateIndex
CREATE INDEX "purchase_payments_invoice_id_idx" ON "public"."purchase_payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_payments_organization_id_reference_key" ON "public"."purchase_payments"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "purchase_documents_order_id_idx" ON "public"."purchase_documents"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_files_object_key_key" ON "public"."purchase_files"("object_key");

-- CreateIndex
CREATE INDEX "purchase_files_organization_id_idx" ON "public"."purchase_files"("organization_id");

-- CreateIndex
CREATE INDEX "purchasing_audit_organization_id_at_idx" ON "public"."purchasing_audit"("organization_id", "at");

-- CreateIndex
CREATE INDEX "purchasing_audit_order_id_at_idx" ON "public"."purchasing_audit"("order_id", "at");

-- CreateIndex
CREATE INDEX "purchasing_audit_organization_id_area_at_idx" ON "public"."purchasing_audit"("organization_id", "area", "at");

-- CreateIndex
CREATE INDEX "inventory_transactions_purchase_delivery_line_id_idx" ON "public"."inventory_transactions"("purchase_delivery_line_id");

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_delivery_note_file_id_fkey" FOREIGN KEY ("delivery_note_file_id") REFERENCES "public"."purchase_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_delivery_lines" ADD CONSTRAINT "purchase_delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."purchase_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_delivery_lines" ADD CONSTRAINT "purchase_delivery_lines_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_delivery_lines" ADD CONSTRAINT "purchase_delivery_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."purchase_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "public"."purchase_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "public"."purchase_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_payments" ADD CONSTRAINT "purchase_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_documents" ADD CONSTRAINT "purchase_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_documents" ADD CONSTRAINT "purchase_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_documents" ADD CONSTRAINT "purchase_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."purchase_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_documents" ADD CONSTRAINT "purchase_documents_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_files" ADD CONSTRAINT "purchase_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_files" ADD CONSTRAINT "purchase_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchasing_audit" ADD CONSTRAINT "purchasing_audit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchasing_audit" ADD CONSTRAINT "purchasing_audit_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchasing_audit" ADD CONSTRAINT "purchasing_audit_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchasing_audit" ADD CONSTRAINT "purchasing_audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_delivery_line_id_fkey" FOREIGN KEY ("purchase_delivery_line_id") REFERENCES "public"."purchase_delivery_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One open order per supplier (DRAFT to SENT: nothing received yet). The service checks first for a friendly error;
-- this index makes two people raising at once safe.
CREATE UNIQUE INDEX "purchase_orders_one_open_per_supplier"
  ON "public"."purchase_orders" ("organization_id", "supplier_id")
  WHERE "status" IN ('DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT');

-- One live invoice per order. A voided invoice is kept, so only rows that are not VOIDED count.
CREATE UNIQUE INDEX "purchase_invoices_one_live_per_order"
  ON "public"."purchase_invoices" ("order_id")
  WHERE "status" <> 'VOIDED';
