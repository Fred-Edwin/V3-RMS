-- Migration: Add staff discount fields to orders table
-- These nullable columns store the discount percentage and amount when a staff discount is applied.
-- discounted_by_id references the manager who approved the discount.

ALTER TABLE "orders"
  ADD COLUMN "discount_percent" DECIMAL(5, 2),
  ADD COLUMN "discount_amount" DECIMAL(10, 2),
  ADD COLUMN "discounted_by_id" TEXT;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_discounted_by_id_fkey"
    FOREIGN KEY ("discounted_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
