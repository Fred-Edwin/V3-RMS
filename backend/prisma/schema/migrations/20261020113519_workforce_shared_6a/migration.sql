-- Workforce segment 6, back end A. Additive only: new tables, no legacy table touched.
-- (Prisma also proposed dropping the hand-made payroll_payslip_seq; that is existing drift, not part of this change.)

-- CreateTable
CREATE TABLE "public"."workforce_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "workforce_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id_hash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "place_label" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "confirmedMode" TEXT,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "workforce_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_security_alerts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "kind" TEXT NOT NULL,
    "subject_user_id" TEXT,
    "device_id" TEXT,
    "device_label" TEXT,
    "place_label" TEXT,
    "detail" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audit_entry_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "cleared_by_id" TEXT,
    "cleared_at" TIMESTAMP(3),
    "clear_note" TEXT,
    "clear_key" TEXT,

    CONSTRAINT "workforce_security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_security_settings" (
    "company_id" TEXT NOT NULL,
    "alerts_started_at" TIMESTAMP(3),
    "started_by_id" TEXT,

    CONSTRAINT "workforce_security_settings_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "public"."workforce_security_flags" (
    "user_id" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_security_flags_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."workforce_pin_tries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_pin_tries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workforce_audit_entry_index" (
    "entry_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "seq" BIGINT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'WORKFORCE',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,

    CONSTRAINT "workforce_audit_entry_index_pkey" PRIMARY KEY ("entry_id")
);

-- CreateTable
CREATE TABLE "public"."workforce_needs_you_state" (
    "user_id" TEXT NOT NULL,
    "last_seen_home_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_needs_you_state_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."workforce_needs_you_reminders" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sent_by_id" TEXT NOT NULL,
    "sent_to_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_needs_you_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workforce_notifications_user_id_created_at_idx" ON "public"."workforce_notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_notifications_user_id_read_at_idx" ON "public"."workforce_notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_notifications_user_id_dedupe_key_key" ON "public"."workforce_notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "workforce_devices_user_id_removed_at_idx" ON "public"."workforce_devices"("user_id", "removed_at");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_devices_user_id_device_id_hash_key" ON "public"."workforce_devices"("user_id", "device_id_hash");

-- CreateIndex
CREATE INDEX "workforce_security_alerts_company_id_status_occurred_at_idx" ON "public"."workforce_security_alerts"("company_id", "status", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_security_alerts_subject_user_id_kind_occurred_at_idx" ON "public"."workforce_security_alerts"("subject_user_id", "kind", "occurred_at");

-- CreateIndex
CREATE INDEX "workforce_pin_tries_user_id_purpose_created_at_idx" ON "public"."workforce_pin_tries"("user_id", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "workforce_audit_entry_index_company_id_occurred_at_idx" ON "public"."workforce_audit_entry_index"("company_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_audit_entry_index_company_id_flagged_occurred_at_idx" ON "public"."workforce_audit_entry_index"("company_id", "flagged", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "workforce_audit_entry_index_company_id_area_occurred_at_idx" ON "public"."workforce_audit_entry_index"("company_id", "area", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "workforce_needs_you_reminders_item_id_day_key" ON "public"."workforce_needs_you_reminders"("item_id", "day");
