-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CASUAL');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisciplinaryCategory" AS ENUM ('INSUBORDINATION', 'ATTENDANCE', 'MISCONDUCT', 'PERFORMANCE', 'POLICY_VIOLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DisciplinaryAction" AS ENUM ('VERBAL_WARNING', 'WRITTEN_WARNING', 'FINAL_WARNING', 'SUSPENSION', 'TERMINATION');

-- CreateEnum
CREATE TYPE "HrDocumentType" AS ENUM ('CONTRACT', 'ID_COPY', 'CERTIFICATE', 'MEDICAL_CERTIFICATE', 'INCIDENT_REPORT', 'WARNING_LETTER', 'OTHER');

-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "national_id" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "personal_phone" TEXT,
    "personal_email" TEXT,
    "physical_address" TEXT,
    "emergency_name" TEXT,
    "emergency_relation" TEXT,
    "emergency_phone" TEXT,
    "employment_type" "EmploymentType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "probation_end_date" TIMESTAMP(3),
    "job_title" TEXT,
    "reporting_manager_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "total_days" INTEGER NOT NULL,
    "used_days" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "pending_days" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "leave_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "leave_balance_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_days" DECIMAL(5,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_records" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "incident_date" TIMESTAMP(3) NOT NULL,
    "action_date" TIMESTAMP(3) NOT NULL,
    "category" "DisciplinaryCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "action_taken" "DisciplinaryAction" NOT NULL,
    "outcome" TEXT NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "witnesses" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "appealed" BOOLEAN NOT NULL DEFAULT false,
    "appeal_outcome" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplinary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_documents" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "leave_request_id" TEXT,
    "disciplinary_record_id" TEXT,
    "document_type" "HrDocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_user_id_key" ON "employee_profiles"("user_id");
CREATE INDEX "employee_profiles_user_id_idx" ON "employee_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_profile_id_leave_type_leave_year_key" ON "leave_balances"("employee_profile_id", "leave_type", "leave_year");
CREATE INDEX "leave_balances_employee_profile_id_idx" ON "leave_balances"("employee_profile_id");

-- CreateIndex
CREATE INDEX "leave_requests_organization_id_status_idx" ON "leave_requests"("organization_id", "status");
CREATE INDEX "leave_requests_employee_profile_id_idx" ON "leave_requests"("employee_profile_id");

-- CreateIndex
CREATE INDEX "disciplinary_records_organization_id_idx" ON "disciplinary_records"("organization_id");
CREATE INDEX "disciplinary_records_employee_profile_id_idx" ON "disciplinary_records"("employee_profile_id");

-- CreateIndex
CREATE INDEX "hr_documents_employee_profile_id_idx" ON "hr_documents"("employee_profile_id");
CREATE INDEX "hr_documents_leave_request_id_idx" ON "hr_documents"("leave_request_id");
CREATE INDEX "hr_documents_disciplinary_record_id_idx" ON "hr_documents"("disciplinary_record_id");

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_balance_id_fkey" FOREIGN KEY ("leave_balance_id") REFERENCES "leave_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_disciplinary_record_id_fkey" FOREIGN KEY ("disciplinary_record_id") REFERENCES "disciplinary_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
