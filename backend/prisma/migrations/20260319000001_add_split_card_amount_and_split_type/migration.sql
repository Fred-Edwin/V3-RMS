-- AlterTable
ALTER TABLE "orders" ADD COLUMN "card_amount" DECIMAL(10,2),
ADD COLUMN "split_type" VARCHAR(20);
