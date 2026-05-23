-- AlterTable
ALTER TABLE "corporate_account_settlements" ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH';

-- Remove default after backfill (column is required going forward)
ALTER TABLE "corporate_account_settlements" ALTER COLUMN "payment_method" DROP DEFAULT;
