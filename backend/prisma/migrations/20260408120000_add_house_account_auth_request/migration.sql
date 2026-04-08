-- CreateEnum
CREATE TYPE "HouseAccountAuthStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TIMED_OUT');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_AUTHORIZATION';

-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'PAYMENT_REJECTED';

-- CreateTable
CREATE TABLE "house_account_auth_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "house_account_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "HouseAccountAuthStatus" NOT NULL DEFAULT 'PENDING',
    "bullmq_job_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "house_account_auth_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "house_account_auth_requests_organization_id_idx" ON "house_account_auth_requests"("organization_id");

-- CreateIndex
CREATE INDEX "house_account_auth_requests_order_id_idx" ON "house_account_auth_requests"("order_id");

-- CreateIndex
CREATE INDEX "house_account_auth_requests_house_account_id_idx" ON "house_account_auth_requests"("house_account_id");

-- CreateIndex
CREATE INDEX "house_account_auth_requests_status_idx" ON "house_account_auth_requests"("status");

-- AddForeignKey
ALTER TABLE "house_account_auth_requests" ADD CONSTRAINT "house_account_auth_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_account_auth_requests" ADD CONSTRAINT "house_account_auth_requests_house_account_id_fkey" FOREIGN KEY ("house_account_id") REFERENCES "house_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_account_auth_requests" ADD CONSTRAINT "house_account_auth_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_account_auth_requests" ADD CONSTRAINT "house_account_auth_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
