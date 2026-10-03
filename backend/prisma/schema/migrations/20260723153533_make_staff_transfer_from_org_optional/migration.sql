-- DropForeignKey
ALTER TABLE "public"."staff_transfers" DROP CONSTRAINT "staff_transfers_from_organization_id_fkey";

-- AlterTable
ALTER TABLE "public"."staff_transfers" ALTER COLUMN "from_organization_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."staff_transfers" ADD CONSTRAINT "staff_transfers_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
