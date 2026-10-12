-- Block 1, back end B.
-- 1. Amendment 2: the optional note that goes with Urgent (max 200 characters, checked by the API).
ALTER TABLE "public"."requisitions" ADD COLUMN     "urgent_note" TEXT;

-- 2. Production branch codes, fixed by name (the owner confirmed: Nyeri Town NYR, King'ong'o KNG, Wendo Nyahururu NYH).
--    The previous migration (unreleased) gave every branch a first-guess code and numbered the old requisitions with it, so the
--    references are renamed with the code: REQ-{old}-nnnn becomes REQ-{new}-nnnn. A branch that is not named here is left alone,
--    and so is a branch whose code is already right. Nothing is touched when the wanted code belongs to a different branch.
DO $$
DECLARE
  fix RECORD;
  site RECORD;
BEGIN
  FOR fix IN
    SELECT * FROM (VALUES
      ('nyeri town%', 'NYR'),
      ('king%ong%', 'KNG'),
      ('%nyahururu%', 'NYH')
    ) AS t(pattern, new_code)
  LOOP
    FOR site IN
      SELECT "id", "code" FROM "public"."organizations"
       WHERE "type" = 'BRANCH' AND lower(replace("name", '''', '')) LIKE fix.pattern
         AND "code" IS DISTINCT FROM fix.new_code
    LOOP
      IF NOT EXISTS (SELECT 1 FROM "public"."organizations" WHERE "code" = fix.new_code AND "id" <> site."id") THEN
        UPDATE "public"."organizations" SET "code" = fix.new_code WHERE "id" = site."id";
        IF site."code" IS NOT NULL THEN
          UPDATE "public"."requisitions"
             SET "reference" = 'REQ-' || fix.new_code || substr("reference", length('REQ-' || site."code") + 1)
           WHERE "organization_id" = site."id" AND "reference" LIKE 'REQ-' || site."code" || '-%';
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;
