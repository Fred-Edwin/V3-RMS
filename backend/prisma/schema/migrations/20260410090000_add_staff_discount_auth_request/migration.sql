-- Migration: Add StaffDiscountAuthStatus enum and staff_discount_auth_requests table

CREATE TYPE "StaffDiscountAuthStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "staff_discount_auth_requests" (
  "id"               TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "organization_id"  TEXT          NOT NULL,
  "order_id"         TEXT          NOT NULL,
  "requested_by_id"  TEXT          NOT NULL,
  "discount_percent" DECIMAL(5, 2) NOT NULL,
  "original_amount"  DECIMAL(10, 2) NOT NULL,
  "discount_amount"  DECIMAL(10, 2) NOT NULL,
  "status"           "StaffDiscountAuthStatus" NOT NULL DEFAULT 'PENDING',
  "resolved_by_id"   TEXT,
  "resolved_at"      TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "staff_discount_auth_requests_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "staff_discount_auth_requests"
  ADD CONSTRAINT "staff_discount_auth_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_discount_auth_requests"
  ADD CONSTRAINT "staff_discount_auth_requests_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_discount_auth_requests"
  ADD CONSTRAINT "staff_discount_auth_requests_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_discount_auth_requests"
  ADD CONSTRAINT "staff_discount_auth_requests_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "staff_discount_auth_requests_organization_id_idx"
  ON "staff_discount_auth_requests"("organization_id");

CREATE INDEX "staff_discount_auth_requests_order_id_idx"
  ON "staff_discount_auth_requests"("order_id");

CREATE INDEX "staff_discount_auth_requests_status_idx"
  ON "staff_discount_auth_requests"("status");
