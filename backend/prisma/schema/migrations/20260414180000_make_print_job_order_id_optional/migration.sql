-- Make order_id optional on print_jobs to support OtherIncomeEntry receipts
ALTER TABLE "public"."print_jobs" ALTER COLUMN "order_id" DROP NOT NULL;
