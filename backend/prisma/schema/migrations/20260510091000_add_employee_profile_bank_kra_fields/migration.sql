-- AddColumn: bank and KRA details to employee_profiles
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "kra_pin" TEXT;
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "account_number" TEXT;
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "account_name" TEXT;
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "bank_branch" TEXT;
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "helb_number" TEXT;

-- AlterTable: change payslip id default from cuid to uuid
ALTER TABLE "payslips" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
