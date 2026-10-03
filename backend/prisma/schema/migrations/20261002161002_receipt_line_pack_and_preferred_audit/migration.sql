-- B8: audit actions for setting / confirming a preferred supplier line.
-- New enum values cannot be used in this transaction; nothing here writes them.
ALTER TYPE "public"."SupplierAuditAction" ADD VALUE 'PREFERRED_SET';
ALTER TYPE "public"."SupplierAuditAction" ADD VALUE 'PREFERRED_CONFIRMED';

-- B4: the pack a receipt line was bought in, and the "Pack not on file" stamp set at signing.
ALTER TABLE "public"."goods_receipt_lines" ADD COLUMN     "pack_buy_unit" TEXT,
ADD COLUMN     "pack_not_on_file" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pack_size" DECIMAL(12,4);
