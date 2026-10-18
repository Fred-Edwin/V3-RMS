-- CreateEnum
CREATE TYPE "public"."ClockEventType" AS ENUM ('IN', 'OUT', 'AUTO_OUT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "public"."ClockEventSource" AS ENUM ('PHONE', 'HEAD', 'MANAGER', 'SYSTEM', 'LEGACY');

-- CreateEnum
CREATE TYPE "public"."ShiftEndAnswerKind" AS ENUM ('STAY_ON', 'FINISH_NOW');

-- CreateTable
CREATE TABLE "public"."clock_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "rota_entry_id" TEXT,
    "shift_date" DATE NOT NULL,
    "type" "public"."ClockEventType" NOT NULL,
    "source" "public"."ClockEventSource" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "device_at" TIMESTAMP(3),
    "server_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skew_minutes" INTEGER,
    "skew_flagged" BOOLEAN NOT NULL DEFAULT false,
    "client_event_id" TEXT,
    "corrects_event_id" TEXT,
    "voids_corrected" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "distance_metres" INTEGER,
    "reason_code" TEXT,
    "reason" TEXT,
    "recorded_by_id" TEXT,
    "legacy_clock_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clock_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attendance_site_switches" (
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabled_at" TIMESTAMP(3),
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_id" TEXT,

    CONSTRAINT "attendance_site_switches_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "public"."shift_end_answers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "rota_entry_id" TEXT NOT NULL,
    "answer" "public"."ShiftEndAnswerKind" NOT NULL,
    "reason_code" TEXT,
    "estimate_minutes" INTEGER,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_end_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clock_events_organization_id_occurred_at_idx" ON "public"."clock_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clock_events_employee_id_occurred_at_idx" ON "public"."clock_events"("employee_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clock_events_employee_id_shift_date_idx" ON "public"."clock_events"("employee_id", "shift_date");

-- CreateIndex
CREATE INDEX "clock_events_organization_id_shift_date_idx" ON "public"."clock_events"("organization_id", "shift_date");

-- CreateIndex
CREATE INDEX "clock_events_rota_entry_id_idx" ON "public"."clock_events"("rota_entry_id");

-- CreateIndex
CREATE INDEX "clock_events_corrects_event_id_idx" ON "public"."clock_events"("corrects_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "clock_events_employee_id_client_event_id_key" ON "public"."clock_events"("employee_id", "client_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "clock_events_legacy_clock_record_id_type_key" ON "public"."clock_events"("legacy_clock_record_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "shift_end_answers_rota_entry_id_key" ON "public"."shift_end_answers"("rota_entry_id");

-- CreateIndex
CREATE INDEX "shift_end_answers_organization_id_answered_at_idx" ON "public"."shift_end_answers"("organization_id", "answered_at");

-- AddForeignKey
ALTER TABLE "public"."clock_events" ADD CONSTRAINT "clock_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clock_events" ADD CONSTRAINT "clock_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clock_events" ADD CONSTRAINT "clock_events_rota_entry_id_fkey" FOREIGN KEY ("rota_entry_id") REFERENCES "public"."rota_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_site_switches" ADD CONSTRAINT "attendance_site_switches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_end_answers" ADD CONSTRAINT "shift_end_answers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_end_answers" ADD CONSTRAINT "shift_end_answers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_end_answers" ADD CONSTRAINT "shift_end_answers_rota_entry_id_fkey" FOREIGN KEY ("rota_entry_id") REFERENCES "public"."rota_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A correction always says which event it corrects.
ALTER TABLE "public"."clock_events" ADD CONSTRAINT "clock_events_correction_names_target"
  CHECK ("type" <> 'CORRECTION' OR "corrects_event_id" IS NOT NULL);

-- Clock events are append-only: nothing is edited or deleted, a fix is a new CORRECTION row. Two narrow exceptions:
--  1. the foreign key may null rota_entry_id when a rota edit removes the shift (shift_date still says which day it was);
--  2. a transaction that says SET LOCAL workforce.allow_clock_edits = 'on' (dev seed scripts and tests only; production
--     code never sets it, and workforce-layering.test.ts fails if it appears in source outside tests and scripts).
CREATE OR REPLACE FUNCTION "public"."clock_events_append_only"() RETURNS trigger AS $$
BEGIN
  IF current_setting('workforce.allow_clock_edits', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."rota_entry_id" IS NOT NULL AND NEW."rota_entry_id" IS NULL
     AND (to_jsonb(NEW) - 'rota_entry_id') = (to_jsonb(OLD) - 'rota_entry_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'clock_events is append-only: % is not allowed. Record a correction instead.', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "clock_events_no_update_delete"
  BEFORE UPDATE OR DELETE ON "public"."clock_events"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."clock_events_append_only"();

CREATE TRIGGER "clock_events_no_truncate"
  BEFORE TRUNCATE ON "public"."clock_events"
  FOR EACH STATEMENT
  EXECUTE FUNCTION "public"."clock_events_append_only"();
