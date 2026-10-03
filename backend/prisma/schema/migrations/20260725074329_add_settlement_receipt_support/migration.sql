-- AlterEnum
ALTER TYPE "public"."ReceiptType" ADD VALUE 'SETTLEMENT';

-- AlterTable
ALTER TABLE "public"."print_jobs" ADD COLUMN     "corporate_account_settlement_id" TEXT;

-- CreateIndex
CREATE INDEX "print_jobs_corporate_account_settlement_id_idx" ON "public"."print_jobs"("corporate_account_settlement_id");

-- AddForeignKey
ALTER TABLE "public"."print_jobs" ADD CONSTRAINT "print_jobs_corporate_account_settlement_id_fkey" FOREIGN KEY ("corporate_account_settlement_id") REFERENCES "public"."corporate_account_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
