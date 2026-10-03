-- CreateEnum
CREATE TYPE "public"."SupplierStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."SupplierType" AS ENUM ('REGULAR', 'OCCASIONAL', 'ONE_OFF', 'MARKET');

-- CreateEnum
CREATE TYPE "public"."SupplierContactRole" AS ENUM ('SALES_REP', 'ACCOUNTS', 'DELIVERY', 'OWNER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SupplierPayMethodType" AS ENUM ('BANK_TRANSFER', 'MPESA_PAYBILL', 'MPESA_TILL', 'MPESA_SEND_MONEY', 'CASH');

-- CreateEnum
CREATE TYPE "public"."SupplierDocumentType" AS ENUM ('INVOICE', 'DELIVERY_NOTE', 'RECEIPT', 'PRICE_LIST', 'CONTRACT', 'TAX_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SupplierAuditAction" AS ENUM ('PAY_METHOD_CREATED', 'PAY_METHOD_UPDATED', 'PAY_METHOD_DELETED', 'PAY_METHOD_DEFAULT_CHANGED', 'STATUS_CHANGED');

-- AlterTable: additive columns first. code/address stay nullable until the
-- backfill below has filled them (safe on an empty table and on one with rows).
ALTER TABLE "public"."suppliers"
ADD COLUMN     "address" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "credit_limit" DECIMAL(12,2),
ADD COLUMN     "kra_pin" TEXT,
ADD COLUMN     "map_url" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "public"."SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "trading_name" TEXT,
ADD COLUMN     "type" "public"."SupplierType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "updated_by_id" TEXT,
ADD COLUMN     "vat_registered" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."supplier_contacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."SupplierContactRole" NOT NULL DEFAULT 'OTHER',
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_pay_methods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "type" "public"."SupplierPayMethodType" NOT NULL,
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "paybill_number" TEXT,
    "account_reference" TEXT,
    "till_number" TEXT,
    "phone" TEXT,
    "registered_name" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pay_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "supplier_item_name" TEXT,
    "supplier_item_code" TEXT,
    "buy_unit" TEXT,
    "pack_size" DECIMAL(12,4),
    "last_price" DECIMAL(12,4),
    "last_price_at" TIMESTAMP(3),
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "doc_type" "public"."SupplierDocumentType" NOT NULL,
    "doc_date" DATE,
    "note" TEXT,
    "goods_receipt_id" TEXT,
    "supplier_invoice_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "action" "public"."SupplierAuditAction" NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Backfill (existing rows: local/dev only; production has none).
-- 1. Codes in creation order, per organization, from the SUPPLIER counter.
WITH numbered AS (
  SELECT id, organization_id,
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at, id) AS n
  FROM "public"."suppliers"
)
UPDATE "public"."suppliers" s
SET "code" = 'SUPPLIER-' || LPAD(numbered.n::text, 4, '0')
FROM numbered WHERE numbered.id = s.id;

INSERT INTO "public"."reference_counters" ("id", "organization_id", "prefix", "last_number", "created_at", "updated_at")
SELECT gen_random_uuid()::text, organization_id, 'SUPPLIER', COUNT(*), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "public"."suppliers" GROUP BY organization_id
ON CONFLICT ("organization_id", "prefix") DO UPDATE SET "last_number" = EXCLUDED."last_number";

-- 2. location -> address (empty becomes an em dash); retired rows -> ARCHIVED.
UPDATE "public"."suppliers"
SET "address" = COALESCE(NULLIF(BTRIM("location"), ''), '—'),
    "status" = CASE WHEN "deleted_at" IS NOT NULL THEN 'ARCHIVED'::"public"."SupplierStatus" ELSE 'ACTIVE'::"public"."SupplierStatus" END;

-- 3. Old contact fields -> one primary contact.
INSERT INTO "public"."supplier_contacts" ("id", "organization_id", "supplier_id", "name", "role", "phone", "email", "is_primary", "created_at", "updated_at")
SELECT gen_random_uuid()::text, organization_id, id, COALESCE(NULLIF(BTRIM("contact_name"), ''), name), 'OTHER',
       NULLIF(BTRIM("phone"), ''), NULLIF(BTRIM("email"), ''), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "public"."suppliers"
WHERE NULLIF(BTRIM("contact_name"), '') IS NOT NULL OR NULLIF(BTRIM("phone"), '') IS NOT NULL OR NULLIF(BTRIM("email"), '') IS NOT NULL;

-- 4. Lock the new required columns and drop the migrated ones.
ALTER TABLE "public"."suppliers"
ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "address" SET NOT NULL,
DROP COLUMN "contact_name",
DROP COLUMN "email",
DROP COLUMN "location",
DROP COLUMN "phone";

-- CreateIndex
CREATE INDEX "supplier_contacts_organization_id_supplier_id_idx" ON "public"."supplier_contacts"("organization_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_pay_methods_organization_id_supplier_id_idx" ON "public"."supplier_pay_methods"("organization_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_items_organization_id_inventory_item_id_idx" ON "public"."supplier_items"("organization_id", "inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_items_supplier_id_inventory_item_id_key" ON "public"."supplier_items"("supplier_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "supplier_documents_organization_id_supplier_id_idx" ON "public"."supplier_documents"("organization_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_audit_logs_organization_id_supplier_id_created_at_idx" ON "public"."supplier_audit_logs"("organization_id", "supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_status_idx" ON "public"."suppliers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_code_key" ON "public"."suppliers"("organization_id", "code");

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_pay_methods" ADD CONSTRAINT "supplier_pay_methods_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_pay_methods" ADD CONSTRAINT "supplier_pay_methods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_items" ADD CONSTRAINT "supplier_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_items" ADD CONSTRAINT "supplier_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_documents" ADD CONSTRAINT "supplier_documents_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_documents" ADD CONSTRAINT "supplier_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_audit_logs" ADD CONSTRAINT "supplier_audit_logs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_audit_logs" ADD CONSTRAINT "supplier_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Partial unique indexes (not expressible in the Prisma DSL).
CREATE UNIQUE INDEX "supplier_contacts_one_primary_per_supplier" ON "public"."supplier_contacts"("supplier_id") WHERE "is_primary";
CREATE UNIQUE INDEX "supplier_pay_methods_one_default_per_supplier" ON "public"."supplier_pay_methods"("supplier_id") WHERE "is_default";
CREATE UNIQUE INDEX "supplier_items_one_preferred_per_item" ON "public"."supplier_items"("inventory_item_id") WHERE "is_preferred";

-- Backfill supplier_items.is_preferred from InventoryItem.preferred_supplier_id.
INSERT INTO "public"."supplier_items" ("id", "organization_id", "supplier_id", "inventory_item_id", "is_preferred", "created_at", "updated_at")
SELECT gen_random_uuid()::text, i.organization_id, i.preferred_supplier_id, i.id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "public"."inventory_items" i WHERE i.preferred_supplier_id IS NOT NULL;
