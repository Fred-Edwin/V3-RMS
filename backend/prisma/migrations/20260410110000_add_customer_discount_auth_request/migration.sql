-- CreateEnum
CREATE TYPE "CustomerDiscountAuthStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "customer_discount_auth_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "discount_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "discount_fixed" DECIMAL(10,2),
    "original_amount" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "status" "CustomerDiscountAuthStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_discount_auth_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer_discount_auth_requests" ADD CONSTRAINT "customer_discount_auth_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_discount_auth_requests" ADD CONSTRAINT "customer_discount_auth_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_discount_auth_requests" ADD CONSTRAINT "customer_discount_auth_requests_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_discount_auth_requests" ADD CONSTRAINT "customer_discount_auth_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_discount_auth_requests" ADD CONSTRAINT "customer_discount_auth_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "customer_discount_auth_requests_organization_id_idx" ON "customer_discount_auth_requests"("organization_id");

-- CreateIndex
CREATE INDEX "customer_discount_auth_requests_order_id_idx" ON "customer_discount_auth_requests"("order_id");

-- CreateIndex
CREATE INDEX "customer_discount_auth_requests_status_idx" ON "customer_discount_auth_requests"("status");
