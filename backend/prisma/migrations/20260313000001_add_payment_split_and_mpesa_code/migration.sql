-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'SPLIT';

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "mpesa_code"   TEXT,
  ADD COLUMN "mpesa_amount" DECIMAL(10,2),
  ADD COLUMN "cash_amount"  DECIMAL(10,2);
