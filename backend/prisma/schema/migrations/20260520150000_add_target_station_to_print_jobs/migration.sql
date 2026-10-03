-- Add optional print-job routing: a job may be pinned to one print station.
-- NULL = any station in the branch may claim the job (preserves prior behavior).

ALTER TABLE "print_jobs" ADD COLUMN "target_station_id" TEXT;

CREATE INDEX "print_jobs_organization_id_status_target_station_id_idx"
  ON "print_jobs"("organization_id", "status", "target_station_id");

ALTER TABLE "print_jobs"
  ADD CONSTRAINT "print_jobs_target_station_id_fkey"
  FOREIGN KEY ("target_station_id") REFERENCES "print_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
