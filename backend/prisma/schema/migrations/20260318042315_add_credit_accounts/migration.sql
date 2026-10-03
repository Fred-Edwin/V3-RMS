-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentMethod" ADD VALUE 'HOUSE_ACCOUNT';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'CORPORATE_ACCOUNT';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'CUSTOMER_CREDIT';

-- DropForeignKey
ALTER TABLE "public"."incident_logs" DROP CONSTRAINT "incident_logs_actor_id_fkey";

-- DropIndex
DROP INDEX "public"."prep_tickets_order_id_station_sequence_idx";

-- DropIndex
DROP INDEX "public"."print_jobs_lease_expires_at_idx";

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "corporate_account_id" TEXT,
ADD COLUMN     "corporate_employee_ref" TEXT,
ADD COLUMN     "customer_credit_account_id" TEXT,
ADD COLUMN     "house_account_id" TEXT;

-- CreateTable
CREATE TABLE "public"."house_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credit_limit" DECIMAL(10,2),
    "current_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "granted_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "house_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."house_account_settlements" (
    "id" TEXT NOT NULL,
    "house_account_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "settled_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_account_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."corporate_accounts" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_email" TEXT,
    "credit_limit" DECIMAL(10,2),
    "current_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billing_cycle_day" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."corporate_account_settlements" (
    "id" TEXT NOT NULL,
    "corporate_account_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "settled_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_account_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_credit_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "credit_limit" DECIMAL(10,2) NOT NULL,
    "current_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_credit_settlements" (
    "id" TEXT NOT NULL,
    "customer_credit_account_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "settled_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credit_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "house_accounts_user_id_key" ON "public"."house_accounts"("user_id");

-- CreateIndex
CREATE INDEX "house_accounts_user_id_idx" ON "public"."house_accounts"("user_id");

-- CreateIndex
CREATE INDEX "house_accounts_is_active_idx" ON "public"."house_accounts"("is_active");

-- CreateIndex
CREATE INDEX "house_account_settlements_house_account_id_idx" ON "public"."house_account_settlements"("house_account_id");

-- CreateIndex
CREATE INDEX "corporate_accounts_is_active_idx" ON "public"."corporate_accounts"("is_active");

-- CreateIndex
CREATE INDEX "corporate_accounts_company_name_idx" ON "public"."corporate_accounts"("company_name");

-- CreateIndex
CREATE INDEX "corporate_account_settlements_corporate_account_id_idx" ON "public"."corporate_account_settlements"("corporate_account_id");

-- CreateIndex
CREATE INDEX "customer_credit_accounts_organization_id_idx" ON "public"."customer_credit_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "customer_credit_accounts_organization_id_is_active_idx" ON "public"."customer_credit_accounts"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "customer_credit_accounts_customer_phone_idx" ON "public"."customer_credit_accounts"("customer_phone");

-- CreateIndex
CREATE INDEX "customer_credit_settlements_customer_credit_account_id_idx" ON "public"."customer_credit_settlements"("customer_credit_account_id");

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_house_account_id_fkey" FOREIGN KEY ("house_account_id") REFERENCES "public"."house_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "public"."corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_credit_account_id_fkey" FOREIGN KEY ("customer_credit_account_id") REFERENCES "public"."customer_credit_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."incident_logs" ADD CONSTRAINT "incident_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."house_accounts" ADD CONSTRAINT "house_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."house_accounts" ADD CONSTRAINT "house_accounts_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."house_account_settlements" ADD CONSTRAINT "house_account_settlements_house_account_id_fkey" FOREIGN KEY ("house_account_id") REFERENCES "public"."house_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."house_account_settlements" ADD CONSTRAINT "house_account_settlements_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corporate_accounts" ADD CONSTRAINT "corporate_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corporate_account_settlements" ADD CONSTRAINT "corporate_account_settlements_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "public"."corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corporate_account_settlements" ADD CONSTRAINT "corporate_account_settlements_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_credit_accounts" ADD CONSTRAINT "customer_credit_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_credit_accounts" ADD CONSTRAINT "customer_credit_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_credit_settlements" ADD CONSTRAINT "customer_credit_settlements_customer_credit_account_id_fkey" FOREIGN KEY ("customer_credit_account_id") REFERENCES "public"."customer_credit_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_credit_settlements" ADD CONSTRAINT "customer_credit_settlements_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
