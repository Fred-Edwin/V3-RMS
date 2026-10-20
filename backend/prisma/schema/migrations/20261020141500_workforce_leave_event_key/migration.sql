-- AlterTable
ALTER TABLE "public"."leave_events" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "leave_events_application_id_idempotency_key_key" ON "public"."leave_events"("application_id", "idempotency_key");
