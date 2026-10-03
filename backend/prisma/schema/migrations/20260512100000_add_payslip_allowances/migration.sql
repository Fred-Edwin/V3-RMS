-- Add optional payroll allowances as an earnings addition.
ALTER TABLE "payslips" ADD COLUMN "allowances" DECIMAL(10,2);
