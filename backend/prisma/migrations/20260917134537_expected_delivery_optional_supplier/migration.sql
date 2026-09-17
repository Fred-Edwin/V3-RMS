-- DropForeignKey
ALTER TABLE "public"."expected_deliveries" DROP CONSTRAINT "expected_deliveries_supplier_id_fkey";

-- AlterTable
ALTER TABLE "public"."expected_deliveries" ALTER COLUMN "supplier_id" DROP NOT NULL,
ALTER COLUMN "payment_terms" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."expected_deliveries" ADD CONSTRAINT "expected_deliveries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
