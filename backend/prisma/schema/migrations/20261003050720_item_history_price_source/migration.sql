-- CreateEnum
CREATE TYPE "public"."InventoryItemChangeKind" AS ENUM ('CREATED', 'UPDATED', 'RETIRED', 'RESTORED', 'SUPPLIER_ADDED', 'SUPPLIER_PRICE_SET');

-- AlterEnum
ALTER TYPE "public"."SupplierAuditAction" ADD VALUE 'LINE_PRICE_SET';

-- AlterTable
ALTER TABLE "public"."supplier_items" ADD COLUMN     "last_price_set_by_id" TEXT;

-- CreateTable
CREATE TABLE "public"."inventory_item_changes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "kind" "public"."InventoryItemChangeKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_item_changes_organization_id_inventory_item_id_cr_idx" ON "public"."inventory_item_changes"("organization_id", "inventory_item_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_item_changes_organization_id_kind_created_at_idx" ON "public"."inventory_item_changes"("organization_id", "kind", "created_at");

-- AddForeignKey
ALTER TABLE "public"."supplier_items" ADD CONSTRAINT "supplier_items_last_price_set_by_id_fkey" FOREIGN KEY ("last_price_set_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_item_changes" ADD CONSTRAINT "inventory_item_changes_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_item_changes" ADD CONSTRAINT "inventory_item_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
