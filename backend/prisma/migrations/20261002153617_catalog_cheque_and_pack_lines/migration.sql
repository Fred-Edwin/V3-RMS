-- AlterEnum
ALTER TYPE "public"."SupplierPayMethodType" ADD VALUE 'CHEQUE';

-- AlterEnum
ALTER TYPE "public"."SupplierPaymentMethod" ADD VALUE 'CHEQUE';

-- DropIndex
DROP INDEX "public"."supplier_items_supplier_id_inventory_item_id_key";

-- AlterTable
ALTER TABLE "public"."supplier_items" ADD COLUMN     "preferred_needs_confirm" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."supplier_pay_methods" ADD COLUMN     "note" TEXT;

-- Raw SQL: Prisma cannot express expression indexes.
-- Line key: one supplier line per item + buy unit + pack size. COALESCE makes NULL
-- units / pack sizes compare equal, so they cannot create duplicates.
-- Safe on existing rows: the dropped key was stricter (one row per supplier+item).
CREATE UNIQUE INDEX "supplier_items_line_key"
ON "public"."supplier_items" ("supplier_id", "inventory_item_id", COALESCE("buy_unit", ''), COALESCE("pack_size", 0));

-- Search: exact match on supplier code, case-insensitive match on supplier item name.
CREATE INDEX "supplier_items_org_code_idx"
ON "public"."supplier_items" ("organization_id", "supplier_item_code");

CREATE INDEX "supplier_items_org_lower_name_idx"
ON "public"."supplier_items" ("organization_id", lower("supplier_item_name"));
