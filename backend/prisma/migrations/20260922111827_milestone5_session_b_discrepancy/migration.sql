-- CreateEnum
CREATE TYPE "public"."DiscrepancyStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."DiscrepancyOutcome" AS ENUM ('FOUND_REDELIVERED', 'TRANSIT_LOSS_WRITEOFF', 'MISCOUNT_CORRECTED');

-- CreateTable
CREATE TABLE "public"."discrepancies" (
    "id" TEXT NOT NULL,
    "dispatch_line_id" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "gap_qty" DECIMAL(12,4) NOT NULL,
    "status" "public"."DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "public"."DiscrepancyOutcome",
    "resolution_note" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "follow_up_dispatch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discrepancies_status_idx" ON "public"."discrepancies"("status");

-- CreateIndex
CREATE INDEX "discrepancies_dispatch_line_id_idx" ON "public"."discrepancies"("dispatch_line_id");

-- AddForeignKey
ALTER TABLE "public"."discrepancies" ADD CONSTRAINT "discrepancies_dispatch_line_id_fkey" FOREIGN KEY ("dispatch_line_id") REFERENCES "public"."dispatch_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discrepancies" ADD CONSTRAINT "discrepancies_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discrepancies" ADD CONSTRAINT "discrepancies_follow_up_dispatch_id_fkey" FOREIGN KEY ("follow_up_dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
