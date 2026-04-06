-- CreateEnum
CREATE TYPE "OtherIncomePaymentMethod" AS ENUM ('CASH', 'MPESA', 'CARD');

-- CreateTable
CREATE TABLE "other_income_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "other_income_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_income_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "OtherIncomePaymentMethod" NOT NULL,
    "description" TEXT,
    "entry_date" DATE NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "other_income_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "other_income_categories_organization_id_idx" ON "other_income_categories"("organization_id");

-- CreateIndex
CREATE INDEX "other_income_categories_branch_id_idx" ON "other_income_categories"("branch_id");

-- CreateIndex
CREATE INDEX "other_income_entries_organization_id_idx" ON "other_income_entries"("organization_id");

-- CreateIndex
CREATE INDEX "other_income_entries_branch_id_idx" ON "other_income_entries"("branch_id");

-- CreateIndex
CREATE INDEX "other_income_entries_organization_id_entry_date_idx" ON "other_income_entries"("organization_id", "entry_date");

-- CreateIndex
CREATE INDEX "other_income_entries_category_id_idx" ON "other_income_entries"("category_id");

-- AddForeignKey
ALTER TABLE "other_income_categories" ADD CONSTRAINT "other_income_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_income_categories" ADD CONSTRAINT "other_income_categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_income_entries" ADD CONSTRAINT "other_income_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_income_entries" ADD CONSTRAINT "other_income_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_income_entries" ADD CONSTRAINT "other_income_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "other_income_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_income_entries" ADD CONSTRAINT "other_income_entries_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
