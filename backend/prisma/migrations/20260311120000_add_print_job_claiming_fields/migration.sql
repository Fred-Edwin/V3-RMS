-- Add print job claiming + audit fields
ALTER TABLE "public"."print_jobs"
  ADD COLUMN "active_key" TEXT,
  ADD COLUMN "claimed_by_station_id" TEXT,
  ADD COLUMN "claimed_at" TIMESTAMP(3),
  ADD COLUMN "lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "print_attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "printed_by_station_id" TEXT;

-- Backfill active_key for active jobs
UPDATE "public"."print_jobs"
SET "active_key" = "order_id" || ':' || "receipt_type"
WHERE "status" IN ('PENDING', 'PRINTING');

-- Ensure inactive jobs do not hold active keys
UPDATE "public"."print_jobs"
SET "active_key" = NULL
WHERE "status" IN ('COMPLETED', 'FAILED');

-- Foreign keys for claimed/printed station tracking
ALTER TABLE "public"."print_jobs"
  ADD CONSTRAINT "print_jobs_claimed_by_station_id_fkey"
  FOREIGN KEY ("claimed_by_station_id") REFERENCES "public"."print_stations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."print_jobs"
  ADD CONSTRAINT "print_jobs_printed_by_station_id_fkey"
  FOREIGN KEY ("printed_by_station_id") REFERENCES "public"."print_stations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique active key to prevent duplicate active jobs per order + receipt type
CREATE UNIQUE INDEX "print_jobs_active_key_key" ON "public"."print_jobs"("active_key");

-- Optional: index lease expiry for faster reclaim
CREATE INDEX "print_jobs_lease_expires_at_idx" ON "public"."print_jobs"("lease_expires_at");
