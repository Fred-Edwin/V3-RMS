-- AlterEnum
ALTER TYPE "HrDocumentType" ADD VALUE IF NOT EXISTS 'NATIONAL_ID_FRONT';
ALTER TYPE "HrDocumentType" ADD VALUE IF NOT EXISTS 'NATIONAL_ID_BACK';

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN "shif_nhif_number" TEXT;
ALTER TABLE "employee_profiles" ADD COLUMN "nssf_number" TEXT;
