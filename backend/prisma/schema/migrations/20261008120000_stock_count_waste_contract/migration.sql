/*
  Warnings:

  - You are about to drop the column `stock_count_line_id` on the `inventory_transactions` table. All the data in the column will be lost.
  - You are about to drop the `stock_count_lines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stock_counts` table. If the table is not empty, all the data it contains will be lost.

*/

-- Safety guard (owner-approved contract step, 8 Oct 2026): the old count tables were empty in production on 8 Oct 2026, so
-- nothing is converted. If any database still holds old counts, old count lines or ledger rows linked to them, STOP here
-- instead of destroying them. Nothing below runs, and the migration stays unapplied.
DO $$
DECLARE
  old_counts bigint;
  old_lines bigint;
  linked_rows bigint;
BEGIN
  SELECT count(*) INTO old_counts FROM "public"."stock_counts";
  SELECT count(*) INTO old_lines FROM "public"."stock_count_lines";
  SELECT count(*) INTO linked_rows FROM "public"."inventory_transactions" WHERE "stock_count_line_id" IS NOT NULL;
  IF old_counts > 0 OR old_lines > 0 OR linked_rows > 0 THEN
    RAISE EXCEPTION 'Refusing to drop the old count tables: % counts, % count lines and % ledger rows still point at them. Convert or archive them first.', old_counts, old_lines, linked_rows;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_stock_count_line_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_count_lines" DROP CONSTRAINT "stock_count_lines_inventory_item_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_count_lines" DROP CONSTRAINT "stock_count_lines_stock_count_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_counter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_location_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_returned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_verifier_id_fkey";

-- DropIndex
DROP INDEX "public"."inventory_transactions_stock_count_line_id_idx";

-- AlterTable
ALTER TABLE "public"."inventory_transactions" DROP COLUMN "stock_count_line_id";

-- DropTable
DROP TABLE "public"."stock_count_lines";

-- DropTable
DROP TABLE "public"."stock_counts";

-- DropEnum
DROP TYPE "public"."CountLineDecision";

-- DropEnum
DROP TYPE "public"."CountReason";

-- DropEnum
DROP TYPE "public"."StockCountKind";

-- DropEnum
DROP TYPE "public"."StockCountStatus";
