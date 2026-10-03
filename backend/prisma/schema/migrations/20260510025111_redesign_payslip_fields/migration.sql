/*
  Warnings:

  - You are about to drop the column `basic_salary` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `house_allowance` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `nssf` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `other_allowances` on the `payslips` table. All the data in the column will be lost.
  - You are about to drop the column `transport_allowance` on the `payslips` table. All the data in the column will be lost.
  - Added the required column `nssf_tier1` to the `payslips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nssf_tier2` to the `payslips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sha` to the `payslips` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."leave_requests" DROP CONSTRAINT "leave_requests_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."print_jobs" DROP CONSTRAINT "print_jobs_order_id_fkey";

-- AlterTable
ALTER TABLE "public"."orders" ALTER COLUMN "split_type" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."payslips" DROP COLUMN "basic_salary",
DROP COLUMN "house_allowance",
DROP COLUMN "nssf",
DROP COLUMN "other_allowances",
DROP COLUMN "transport_allowance",
ADD COLUMN     "advance" DECIMAL(10,2),
ADD COLUMN     "incentives" DECIMAL(10,2),
ADD COLUMN     "nssf_tier1" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "nssf_tier2" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "overtime" DECIMAL(10,2),
ADD COLUMN     "sha" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."staff_discount_auth_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."print_jobs" ADD CONSTRAINT "print_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leave_requests" ADD CONSTRAINT "leave_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."direct_conversations_organization_id_participant_a_id_partic_ke" RENAME TO "direct_conversations_organization_id_participant_a_id_parti_key";
