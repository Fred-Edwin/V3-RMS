-- Workforce Segment 2B: the checks and the lock that use the PUBLISHED and PAID values (see the migration before this one).

-- A signed month: approved, published and paid months all carry the Accountant's approval.
ALTER TABLE "public"."payroll_months" DROP CONSTRAINT IF EXISTS "payroll_months_approved_has_signature";
ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_approved_has_signature"
  CHECK ("state" NOT IN ('TO_PUBLISH', 'PUBLISHED', 'PAID') OR ("approved_by_id" IS NOT NULL AND "approved_at" IS NOT NULL AND "document_number" IS NOT NULL));

ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_published_has_publisher"
  CHECK ("state" NOT IN ('PUBLISHED', 'PAID') OR ("published_by_id" IS NOT NULL AND "published_at" IS NOT NULL));

-- Paid and locked are one fact: a paid month is locked, and only a paid month is.
ALTER TABLE "public"."payroll_months" ADD CONSTRAINT "payroll_months_paid_is_locked"
  CHECK (("state" = 'PAID') = ("locked_at" IS NOT NULL) AND ("state" <> 'PAID' OR ("paid_by_id" IS NOT NULL AND "paid_at" IS NOT NULL)));

ALTER TABLE "public"."pay_bank_files" ADD CONSTRAINT "pay_bank_files_void_has_reason"
  CHECK ("state" <> 'VOIDED' OR ("voided_at" IS NOT NULL AND "void_reason" IS NOT NULL));
ALTER TABLE "public"."pay_bank_files" ADD CONSTRAINT "pay_bank_files_total_nonneg" CHECK ("total" >= 0 AND "people" >= 0 AND "version" >= 1);

-- THE LOCK (E6, P24). Once a month is Paid, the database itself refuses every write to it and to everything that belongs to it:
-- the month row, runs, payslips (a correction is a new version row), lines, review lines, adjustments, left-out choices, snapshots
-- (a revision), the bank file rows, the payslip numbers and the site rows. A bug in a service cannot get around this.
-- A dev script that must tidy fixtures sets  SELECT set_config('wendo.allow_payroll_edit', 'on', true);  inside its own
-- transaction (src/scripts only; payroll-guard.test.ts fails if the setting appears in application code).
CREATE OR REPLACE FUNCTION "public"."payroll_locked_month_guard"() RETURNS trigger AS $$
DECLARE
  target_month text;
  is_locked boolean;
BEGIN
  IF current_setting('wendo.allow_payroll_edit', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'payroll_months' THEN
    is_locked := OLD."locked_at" IS NOT NULL;
  ELSE
    IF TG_TABLE_NAME = 'payroll_payslip_lines' THEN
      SELECT p."month_id" INTO target_month FROM "public"."payroll_payslips" p
        WHERE p."id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."payslip_id" ELSE NEW."payslip_id" END;
    ELSIF TG_OP = 'DELETE' THEN
      target_month := OLD."month_id";
    ELSE
      target_month := NEW."month_id";
    END IF;
    SELECT m."locked_at" IS NOT NULL INTO is_locked FROM "public"."payroll_months" m WHERE m."id" = target_month;
  END IF;

  IF COALESCE(is_locked, false) THEN
    RAISE EXCEPTION 'MONTH_LOCKED: % on % refused, the payroll month is paid and locked', TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payroll_months_locked_guard" BEFORE UPDATE OR DELETE ON "public"."payroll_months" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_month_sites_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_month_sites" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_runs_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_runs" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_payslips_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_payslips" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_payslip_lines_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_payslip_lines" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_review_lines_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_review_lines" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_adjustments_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_left_out_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_left_out" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_snapshots_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "pay_bank_files_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."pay_bank_files" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
CREATE TRIGGER "payroll_publications_locked_guard" BEFORE INSERT OR UPDATE OR DELETE ON "public"."payroll_publications" FOR EACH ROW EXECUTE FUNCTION "public"."payroll_locked_month_guard"();
