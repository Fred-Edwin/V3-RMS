-- Allow multiple prep tickets per station per order (follow-up batches)

ALTER TABLE "public"."prep_tickets"
  ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "public"."prep_tickets_order_id_station_key";

CREATE UNIQUE INDEX "prep_tickets_order_id_station_sequence_key"
  ON "public"."prep_tickets"("order_id", "station", "sequence");

CREATE INDEX "prep_tickets_order_id_station_sequence_idx"
  ON "public"."prep_tickets"("order_id", "station", "sequence");
