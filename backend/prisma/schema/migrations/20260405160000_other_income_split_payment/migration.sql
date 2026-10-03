-- Add SPLIT to OtherIncomePaymentMethod enum
ALTER TYPE "OtherIncomePaymentMethod" ADD VALUE 'SPLIT';

-- Add split payment detail columns to other_income_entries
ALTER TABLE "other_income_entries"
  ADD COLUMN "mpesa_code"   TEXT,
  ADD COLUMN "mpesa_amount" DECIMAL(10,2),
  ADD COLUMN "cash_amount"  DECIMAL(10,2),
  ADD COLUMN "card_amount"  DECIMAL(10,2),
  ADD COLUMN "split_type"   TEXT;
