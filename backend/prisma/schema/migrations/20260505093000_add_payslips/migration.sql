-- CreateTable
CREATE TABLE "public"."payslips" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pay_period" TEXT NOT NULL,
    "pay_date" TIMESTAMP(3) NOT NULL,
    "basic_salary" DECIMAL(10,2) NOT NULL,
    "house_allowance" DECIMAL(10,2),
    "transport_allowance" DECIMAL(10,2),
    "other_allowances" JSONB,
    "paye" DECIMAL(10,2) NOT NULL,
    "nssf" DECIMAL(10,2) NOT NULL,
    "housing_levy" DECIMAL(10,2) NOT NULL,
    "helb" DECIMAL(10,2),
    "other_deductions" JSONB,
    "gross_pay" DECIMAL(10,2) NOT NULL,
    "total_deductions" DECIMAL(10,2) NOT NULL,
    "net_pay" DECIMAL(10,2) NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payslips_organization_id_pay_period_idx" ON "public"."payslips"("organization_id", "pay_period");

-- CreateIndex
CREATE INDEX "payslips_user_id_idx" ON "public"."payslips"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_organization_id_user_id_pay_period_key" ON "public"."payslips"("organization_id", "user_id", "pay_period");

-- AddForeignKey
ALTER TABLE "public"."payslips" ADD CONSTRAINT "payslips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payslips" ADD CONSTRAINT "payslips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payslips" ADD CONSTRAINT "payslips_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
