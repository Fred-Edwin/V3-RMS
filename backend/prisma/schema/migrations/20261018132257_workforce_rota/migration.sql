-- CreateTable
CREATE TABLE "public"."shift_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "letter" VARCHAR(1),
    "colour" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "unpaid_break_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "retired_at" TIMESTAMP(3),
    "superseded_by_id" TEXT,
    "legacy_shift_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shift_template_departments" (
    "template_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,

    CONSTRAINT "shift_template_departments_pkey" PRIMARY KEY ("template_id","department_id")
);

-- CreateTable
CREATE TABLE "public"."rota_weeks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT,
    "week_start" DATE NOT NULL,
    "carried_from_legacy" BOOLEAN NOT NULL DEFAULT false,
    "touched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rota_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rota_entries" (
    "id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "template_id" TEXT NOT NULL,
    "override_reason" TEXT,
    "set_by_id" TEXT,
    "legacy_assignment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rota_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_legacy_shift_id_key" ON "public"."shift_templates"("legacy_shift_id");

-- CreateIndex
CREATE INDEX "shift_templates_company_id_organization_id_idx" ON "public"."shift_templates"("company_id", "organization_id");

-- CreateIndex
CREATE INDEX "shift_template_departments_department_id_idx" ON "public"."shift_template_departments"("department_id");

-- CreateIndex
CREATE INDEX "rota_weeks_organization_id_week_start_idx" ON "public"."rota_weeks"("organization_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "rota_entries_legacy_assignment_id_key" ON "public"."rota_entries"("legacy_assignment_id");

-- CreateIndex
CREATE INDEX "rota_entries_week_id_idx" ON "public"."rota_entries"("week_id");

-- CreateIndex
CREATE INDEX "rota_entries_organization_id_date_idx" ON "public"."rota_entries"("organization_id", "date");

-- CreateIndex
CREATE INDEX "rota_entries_employee_id_date_idx" ON "public"."rota_entries"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "rota_entries_employee_id_date_template_id_key" ON "public"."rota_entries"("employee_id", "date", "template_id");

-- AddForeignKey
ALTER TABLE "public"."shift_templates" ADD CONSTRAINT "shift_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_templates" ADD CONSTRAINT "shift_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_template_departments" ADD CONSTRAINT "shift_template_departments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_template_departments" ADD CONSTRAINT "shift_template_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rota_weeks" ADD CONSTRAINT "rota_weeks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rota_weeks" ADD CONSTRAINT "rota_weeks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rota_entries" ADD CONSTRAINT "rota_entries_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "public"."rota_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rota_entries" ADD CONSTRAINT "rota_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rota_entries" ADD CONSTRAINT "rota_entries_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."shift_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Raw SQL: one rota week per site, department and start day (a null department is its own group).
CREATE UNIQUE INDEX "rota_weeks_site_department_week_key" ON "public"."rota_weeks"("organization_id", "department_id", "week_start") WHERE "department_id" IS NOT NULL;
CREATE UNIQUE INDEX "rota_weeks_site_nodepartment_week_key" ON "public"."rota_weeks"("organization_id", "week_start") WHERE "department_id" IS NULL;

-- Raw SQL: no overnight shifts (the end is later than the start) and a sane unpaid break.
ALTER TABLE "public"."shift_templates" ADD CONSTRAINT "shift_templates_no_overnight" CHECK ("start_time" < "end_time");
ALTER TABLE "public"."shift_templates" ADD CONSTRAINT "shift_templates_break_range" CHECK ("unpaid_break_minutes" >= 0 AND "unpaid_break_minutes" <= 240);
