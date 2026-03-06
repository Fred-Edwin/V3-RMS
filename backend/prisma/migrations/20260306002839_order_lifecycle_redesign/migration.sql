-- CreateEnum
CREATE TYPE "public"."IncidentType" AS ENUM ('ORDER_CANCELLED', 'TICKET_REJECTED', 'MODIFICATION_REQUESTED', 'MODIFICATION_APPROVED', 'MODIFICATION_REJECTED', 'TICKET_UNCLAIMED', 'ORDER_STALE');

-- CreateEnum
CREATE TYPE "public"."ModificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "public"."PrepTicketStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_by_id" TEXT;

-- AlterTable
ALTER TABLE "public"."prep_tickets" ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by_id" TEXT,
ADD COLUMN     "rejected_reason" TEXT;

-- CreateTable
CREATE TABLE "public"."order_modification_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."ModificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_modification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."incident_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" "public"."IncidentType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_modification_requests_organization_id_idx" ON "public"."order_modification_requests"("organization_id");

-- CreateIndex
CREATE INDEX "order_modification_requests_order_id_idx" ON "public"."order_modification_requests"("order_id");

-- CreateIndex
CREATE INDEX "order_modification_requests_organization_id_status_idx" ON "public"."order_modification_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "incident_logs_organization_id_idx" ON "public"."incident_logs"("organization_id");

-- CreateIndex
CREATE INDEX "incident_logs_organization_id_type_idx" ON "public"."incident_logs"("organization_id", "type");

-- CreateIndex
CREATE INDEX "incident_logs_order_id_idx" ON "public"."incident_logs"("order_id");

-- CreateIndex
CREATE INDEX "incident_logs_created_at_idx" ON "public"."incident_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "public"."idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_key_idx" ON "public"."idempotency_keys"("key");

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_tickets" ADD CONSTRAINT "prep_tickets_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_modification_requests" ADD CONSTRAINT "order_modification_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_modification_requests" ADD CONSTRAINT "order_modification_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_modification_requests" ADD CONSTRAINT "order_modification_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."incident_logs" ADD CONSTRAINT "incident_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."incident_logs" ADD CONSTRAINT "incident_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."incident_logs" ADD CONSTRAINT "incident_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
