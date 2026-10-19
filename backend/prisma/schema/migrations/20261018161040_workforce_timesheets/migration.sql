-- CreateEnum
CREATE TYPE "public"."TimesheetPeriodState" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."TimesheetCloseKind" AS ENUM ('AUTO', 'EARLY');

-- CreateEnum
CREATE TYPE "public"."TimesheetStatus" AS ENUM ('MATCHED', 'AUTO_APPROVED', 'NEEDS_LOOK', 'APPROVED', 'HELD');

-- CreateEnum
CREATE TYPE "public"."OvertimeStatus" AS ENUM ('AUTO_AUTHORISED', 'PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "public"."TimeRequestKind" AS ENUM ('CLOCK_TIME_WRONG', 'WORKED_NOT_RECORDED', 'ROTA_WRONG', 'OVERTIME_MISSING', 'PAY_OTHER', 'CLOCKED_OUT_BY_MISTAKE');

-- CreateEnum
CREATE TYPE "public"."TimeRequestState" AS ENUM ('WAITING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "public"."timesheet_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "cutoff_at" TIMESTAMP(3) NOT NULL,
    "state" "public"."TimesheetPeriodState" NOT NULL DEFAULT 'OPEN',
    "report_number" SERIAL NOT NULL,
    "close_kind" "public"."TimesheetCloseKind",
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "signed_by_id" TEXT,
    "signed_at" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "reopened_by_id" TEXT,
    "reopen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."timesheet_days" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_date" DATE NOT NULL,
    "status" "public"."TimesheetStatus" NOT NULL,
    "reasons" TEXT[],
    "scheduled_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "minutes_late" INTEGER NOT NULL DEFAULT 0,
    "minutes_after_grace" INTEGER NOT NULL DEFAULT 0,
    "left_early_minutes" INTEGER NOT NULL DEFAULT 0,
    "after_end_minutes" INTEGER NOT NULL DEFAULT 0,
    "evidence_hash" TEXT NOT NULL,
    "late_excused" BOOLEAN NOT NULL DEFAULT false,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "carried_from_period_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."timesheet_weeks" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "public"."TimesheetStatus" NOT NULL,
    "scheduled_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."overtime_items" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_date" DATE NOT NULL,
    "raw_minutes" INTEGER NOT NULL,
    "service_tail_minutes" INTEGER NOT NULL DEFAULT 0,
    "auto_minutes" INTEGER NOT NULL DEFAULT 0,
    "needs_minutes" INTEGER NOT NULL DEFAULT 0,
    "authorised_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."OvertimeStatus" NOT NULL,
    "evidence" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."time_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kind" "public"."TimeRequestKind" NOT NULL,
    "shift_date" DATE NOT NULL,
    "state" "public"."TimeRequestState" NOT NULL DEFAULT 'WAITING',
    "note" TEXT NOT NULL,
    "recorded" JSONB NOT NULL,
    "requested" JSONB NOT NULL,
    "waiting_on_role" TEXT NOT NULL,
    "waiting_on_user_id" TEXT,
    "escalated_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "answer_after" JSONB,
    "applied_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheet_periods_organization_id_state_idx" ON "public"."timesheet_periods"("organization_id", "state");

-- CreateIndex
CREATE INDEX "timesheet_periods_state_cutoff_at_idx" ON "public"."timesheet_periods"("state", "cutoff_at");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_periods_organization_id_start_date_key" ON "public"."timesheet_periods"("organization_id", "start_date");

-- CreateIndex
CREATE INDEX "timesheet_days_period_id_status_idx" ON "public"."timesheet_days"("period_id", "status");

-- CreateIndex
CREATE INDEX "timesheet_days_organization_id_shift_date_idx" ON "public"."timesheet_days"("organization_id", "shift_date");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_days_employee_id_shift_date_key" ON "public"."timesheet_days"("employee_id", "shift_date");

-- CreateIndex
CREATE INDEX "timesheet_weeks_period_id_status_idx" ON "public"."timesheet_weeks"("period_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_weeks_employee_id_week_start_period_id_key" ON "public"."timesheet_weeks"("employee_id", "week_start", "period_id");

-- CreateIndex
CREATE INDEX "overtime_items_period_id_status_idx" ON "public"."overtime_items"("period_id", "status");

-- CreateIndex
CREATE INDEX "overtime_items_organization_id_status_idx" ON "public"."overtime_items"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_items_employee_id_shift_date_key" ON "public"."overtime_items"("employee_id", "shift_date");

-- CreateIndex
CREATE INDEX "time_requests_organization_id_state_created_at_idx" ON "public"."time_requests"("organization_id", "state", "created_at");

-- CreateIndex
CREATE INDEX "time_requests_employee_id_state_idx" ON "public"."time_requests"("employee_id", "state");

-- CreateIndex
CREATE INDEX "time_requests_state_created_at_idx" ON "public"."time_requests"("state", "created_at");

-- AddForeignKey
ALTER TABLE "public"."timesheet_periods" ADD CONSTRAINT "timesheet_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_days" ADD CONSTRAINT "timesheet_days_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_days" ADD CONSTRAINT "timesheet_days_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_days" ADD CONSTRAINT "timesheet_days_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_weeks" ADD CONSTRAINT "timesheet_weeks_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_weeks" ADD CONSTRAINT "timesheet_weeks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_weeks" ADD CONSTRAINT "timesheet_weeks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."overtime_items" ADD CONSTRAINT "overtime_items_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."timesheet_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."overtime_items" ADD CONSTRAINT "overtime_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."overtime_items" ADD CONSTRAINT "overtime_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_requests" ADD CONSTRAINT "time_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_requests" ADD CONSTRAINT "time_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
