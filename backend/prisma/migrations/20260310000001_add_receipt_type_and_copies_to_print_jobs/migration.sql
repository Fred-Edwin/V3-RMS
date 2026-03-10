-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('BILL', 'RECEIPT');

-- AlterTable
ALTER TABLE "print_jobs"
  ADD COLUMN "receipt_type" "ReceiptType" NOT NULL DEFAULT 'RECEIPT',
  ADD COLUMN "copies" INTEGER NOT NULL DEFAULT 1;
