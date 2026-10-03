-- Add waiter cancellation approval workflow.

ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_CANCELLATION_APPROVAL';

CREATE TYPE "CancellationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TYPE "IncidentType" ADD VALUE 'ORDER_CANCELLATION_REJECTED';

CREATE TABLE "order_cancellation_requests" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reason_detail" TEXT,
  "previous_status" "OrderStatus" NOT NULL,
  "status" "CancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "resolved_by_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "resolution_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "order_cancellation_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_cancellation_requests_organization_id_idx" ON "order_cancellation_requests"("organization_id");
CREATE INDEX "order_cancellation_requests_order_id_idx" ON "order_cancellation_requests"("order_id");
CREATE INDEX "order_cancellation_requests_requested_by_id_idx" ON "order_cancellation_requests"("requested_by_id");
CREATE INDEX "order_cancellation_requests_status_idx" ON "order_cancellation_requests"("status");
CREATE UNIQUE INDEX "order_cancellation_requests_one_pending_per_order" ON "order_cancellation_requests"("order_id") WHERE "status" = 'PENDING';

ALTER TABLE "order_cancellation_requests"
  ADD CONSTRAINT "order_cancellation_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_cancellation_requests"
  ADD CONSTRAINT "order_cancellation_requests_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_cancellation_requests"
  ADD CONSTRAINT "order_cancellation_requests_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_cancellation_requests"
  ADD CONSTRAINT "order_cancellation_requests_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
