-- CreateEnum
CREATE TYPE "public"."PurchaseCollectedByKind" AS ENUM ('SUPPLIER_DELIVERS', 'CARRIER', 'STAFF', 'OTHER');

-- AlterEnum
ALTER TYPE "public"."PurchaseCancelReason" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "public"."purchase_orders" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "collected_by_carrier_id" TEXT,
ADD COLUMN     "collected_by_kind" "public"."PurchaseCollectedByKind",
ADD COLUMN     "collected_by_name" TEXT,
ADD COLUMN     "collected_by_set_at" TIMESTAMP(3),
ADD COLUMN     "collected_by_set_by_id" TEXT,
ADD COLUMN     "collected_by_user_id" TEXT;

-- Backfill: an order already CLOSED was closed by its last recorded invoice payment (the order's last change if it has none).
UPDATE "public"."purchase_orders" o
SET "closed_at" = COALESCE(
  (SELECT MAX(p."recorded_at") FROM "public"."purchase_payments" p WHERE p."order_id" = o."id" AND p."kind" = 'INVOICE' AND p."status" = 'RECORDED'),
  o."updated_at"
)
WHERE o."status" = 'CLOSED';

-- CreateTable
CREATE TABLE "public"."purchasing_notice_reads" (
    "user_id" TEXT NOT NULL,
    "notice_key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchasing_notice_reads_pkey" PRIMARY KEY ("user_id","notice_key")
);

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_status_closed_at_idx" ON "public"."purchase_orders"("organization_id", "status", "closed_at");

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_collected_by_carrier_id_fkey" FOREIGN KEY ("collected_by_carrier_id") REFERENCES "public"."carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_collected_by_user_id_fkey" FOREIGN KEY ("collected_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_collected_by_set_by_id_fkey" FOREIGN KEY ("collected_by_set_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchasing_notice_reads" ADD CONSTRAINT "purchasing_notice_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
