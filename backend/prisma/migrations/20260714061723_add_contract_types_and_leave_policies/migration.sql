-- AlterTable
ALTER TABLE "public"."employee_profiles" ADD COLUMN     "contract_type_id" TEXT,
ALTER COLUMN "employment_type" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."contract_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "duration_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leave_policies" (
    "id" TEXT NOT NULL,
    "contract_type_id" TEXT NOT NULL,
    "leave_type" "public"."LeaveType" NOT NULL,
    "total_days" INTEGER NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_types_organization_id_idx" ON "public"."contract_types"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_policies_contract_type_id_leave_type_key" ON "public"."leave_policies"("contract_type_id", "leave_type");

-- CreateIndex
CREATE INDEX "employee_profiles_contract_type_id_idx" ON "public"."employee_profiles"("contract_type_id");

-- AddForeignKey
ALTER TABLE "public"."employee_profiles" ADD CONSTRAINT "employee_profiles_contract_type_id_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "public"."contract_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contract_types" ADD CONSTRAINT "contract_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leave_policies" ADD CONSTRAINT "leave_policies_contract_type_id_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "public"."contract_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

