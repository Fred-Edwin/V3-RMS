-- Block 1 (Requisitions and the foundations), step 2 of 2: departments as data, Site.code, the requisition columns,
-- RequisitionAddition, RequisitionEvent, and every back-fill. EXPAND ONLY: no old column, enum value or table is dropped
-- (the one relaxation is requisition_sections.department_tag DROP NOT NULL, because a department added later has no legacy key).
-- Spec: docs/features/inventory/requisitions-contract.md §2. Rollback: ROLLBACK.md beside this file.

-- CreateEnum
CREATE TYPE "public"."DepartmentStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "public"."RequisitionAdditionStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."locations" ADD COLUMN     "department_id" TEXT;

-- AlterTable
ALTER TABLE "public"."organizations" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "public"."requisition_lines" ADD COLUMN     "addition_id" TEXT,
ADD COLUMN     "on_hand_at_request" DECIMAL(12,4),
ADD COLUMN     "suggested_qty" DECIMAL(12,4),
ADD COLUMN     "unit_cost_at_approval" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "public"."requisition_sections" ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "skipped_at" TIMESTAMP(3),
ADD COLUMN     "skipped_by_id" TEXT,
ALTER COLUMN "department_tag" DROP NOT NULL;

-- AlterTable (reference is added nullable, back-filled below, then made NOT NULL)
ALTER TABLE "public"."requisitions" ADD COLUMN     "approved_as_id" TEXT,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" TEXT,
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urgent_at" TIMESTAMP(3),
ADD COLUMN     "urgent_escalated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "department_id" TEXT;

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" "public"."DepartmentTag",
    "status" "public"."DepartmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."item_departments" (
    "item_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,

    CONSTRAINT "item_departments_pkey" PRIMARY KEY ("item_id","department_id")
);

-- CreateTable
CREATE TABLE "public"."requisition_additions" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "added_by_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_pin_signed_at" TIMESTAMP(3) NOT NULL,
    "status" "public"."RequisitionAdditionStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "requisition_additions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requisition_events" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "section_id" TEXT,
    "type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role_label" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_value" TEXT,
    "to_value" TEXT,
    "reason" TEXT,
    "line_id" TEXT,
    "idempotency_key" TEXT,

    CONSTRAINT "requisition_events_pkey" PRIMARY KEY ("id")
);

-- ───────────────────────── Back-fill ─────────────────────────

-- 1. Branch codes. NYR and KRT are placeholders the owner corrects in Settings before the first new requisition.
--    Any other branch gets its first three letters (a letter is changed on a clash) so every branch has a code.
UPDATE "public"."organizations" SET "code" = 'NYR'
 WHERE "type" = 'BRANCH' AND "code" IS NULL AND lower("name") = 'nyeri town';
UPDATE "public"."organizations" SET "code" = 'KRT'
 WHERE "type" = 'BRANCH' AND "code" IS NULL AND lower("name") LIKE 'karatina%';

DO $$
DECLARE
  s RECORD;
  base TEXT;
  candidate TEXT;
  i INT;
BEGIN
  FOR s IN SELECT "id", "name" FROM "public"."organizations" WHERE "type" = 'BRANCH' AND "code" IS NULL ORDER BY "created_at", "id" LOOP
    base := upper(left(regexp_replace(s."name", '[^A-Za-z]', '', 'g') || 'XXX', 3));
    candidate := base;
    i := 0;
    WHILE EXISTS (SELECT 1 FROM "public"."organizations" WHERE "code" = candidate) AND i < 26 LOOP
      candidate := left(base, 2) || chr(65 + i);
      i := i + 1;
    END LOOP;
    UPDATE "public"."organizations" SET "code" = candidate WHERE "id" = s."id";
  END LOOP;
END $$;

-- 2. Five departments per branch (Kitchen, Barista, Pastry, Service, Housekeeping), key = the enum value.
INSERT INTO "public"."departments" ("id", "organization_id", "name", "key", "status", "position", "created_at", "updated_at")
SELECT gen_random_uuid()::text, o."id", d."name", d."key"::"public"."DepartmentTag", 'ACTIVE', d."position", now(), now()
  FROM "public"."organizations" o
 CROSS JOIN (VALUES ('Kitchen', 'KITCHEN', 1), ('Barista', 'BARISTA', 2), ('Pastry', 'PASTRY', 3), ('Service', 'SERVICE', 4), ('Housekeeping', 'HOUSEKEEPING', 5))
        AS d("name", "key", "position")
 WHERE o."type" = 'BRANCH';

-- 3. ItemDepartment from InventoryItem.department_tags. A branch item maps to its own branch's department with the
--    same key; a Central Store (company) item maps to every branch's department with that key.
INSERT INTO "public"."item_departments" ("item_id", "department_id")
SELECT DISTINCT i."id", d."id"
  FROM "public"."inventory_items" i
 CROSS JOIN LATERAL unnest(i."department_tags") AS t("tag")
  JOIN "public"."departments" d ON d."key" = t."tag"
  JOIN "public"."organizations" io ON io."id" = i."organization_id"
 WHERE io."type" <> 'BRANCH' OR d."organization_id" = i."organization_id"
ON CONFLICT DO NOTHING;

-- 4. User.department_id, Location.department_id and RequisitionSection.department_id from the enum on the same branch.
UPDATE "public"."users" u SET "department_id" = d."id"
  FROM "public"."departments" d
 WHERE u."department_tag" IS NOT NULL AND d."organization_id" = u."organization_id" AND d."key" = u."department_tag";

UPDATE "public"."locations" l SET "department_id" = d."id"
  FROM "public"."departments" d
 WHERE l."department_tag" IS NOT NULL AND d."organization_id" = l."organization_id" AND d."key" = l."department_tag";

UPDATE "public"."requisition_sections" s SET "department_id" = d."id"
  FROM "public"."requisitions" r, "public"."departments" d
 WHERE r."id" = s."requisition_id" AND s."department_tag" IS NOT NULL
   AND d."organization_id" = r."organization_id" AND d."key" = s."department_tag";

-- 5. Cycles: EVENING and AD_HOC rows become EXTRA (owner confirms from the production counts).
UPDATE "public"."requisitions" SET "type" = 'EXTRA' WHERE "type" IN ('EVENING', 'AD_HOC');

-- 6. REQ- references, per branch in opened_at order, gap-free; then the branch's counter is set to the count.
UPDATE "public"."requisitions" r SET "reference" = 'REQ-' || COALESCE(o."code", 'UNK') || '-' || lpad(n."rn"::text, 4, '0')
  FROM (SELECT "id", row_number() OVER (PARTITION BY "organization_id" ORDER BY "opened_at", "id") AS "rn" FROM "public"."requisitions") n,
       "public"."organizations" o
 WHERE n."id" = r."id" AND o."id" = r."organization_id";

INSERT INTO "public"."reference_counters" ("id", "organization_id", "prefix", "last_number", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "organization_id", 'REQ', count(*)::int, now(), now()
  FROM "public"."requisitions" GROUP BY "organization_id"
ON CONFLICT ("organization_id", "prefix") DO UPDATE SET "last_number" = EXCLUDED."last_number", "updated_at" = now();

ALTER TABLE "public"."requisitions" ALTER COLUMN "reference" SET NOT NULL;

-- ───────────────────────── Indexes and keys ─────────────────────────

-- CreateIndex
CREATE INDEX "departments_organization_id_status_idx" ON "public"."departments"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "public"."departments"("organization_id", "name");

-- CreateIndex
CREATE INDEX "item_departments_department_id_idx" ON "public"."item_departments"("department_id");

-- CreateIndex
CREATE INDEX "requisition_additions_requisition_id_status_idx" ON "public"."requisition_additions"("requisition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "requisition_events_requisition_id_actor_id_idempotency_key_key" ON "public"."requisition_events"("requisition_id", "actor_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "requisition_events_requisition_id_at_idx" ON "public"."requisition_events"("requisition_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "public"."organizations"("code");

-- CreateIndex
CREATE INDEX "requisition_lines_addition_id_idx" ON "public"."requisition_lines"("addition_id");

-- CreateIndex
CREATE UNIQUE INDEX "requisition_sections_requisition_id_department_id_key" ON "public"."requisition_sections"("requisition_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "requisitions_organization_id_reference_key" ON "public"."requisitions"("organization_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "requisitions_organization_id_opened_by_id_idempotency_key_key" ON "public"."requisitions"("organization_id", "opened_by_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."item_departments" ADD CONSTRAINT "item_departments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."item_departments" ADD CONSTRAINT "item_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_approved_as_id_fkey" FOREIGN KEY ("approved_as_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_sections" ADD CONSTRAINT "requisition_sections_skipped_by_id_fkey" FOREIGN KEY ("skipped_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_sections" ADD CONSTRAINT "requisition_sections_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_lines" ADD CONSTRAINT "requisition_lines_addition_id_fkey" FOREIGN KEY ("addition_id") REFERENCES "public"."requisition_additions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_additions" ADD CONSTRAINT "requisition_additions_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_additions" ADD CONSTRAINT "requisition_additions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_additions" ADD CONSTRAINT "requisition_additions_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_additions" ADD CONSTRAINT "requisition_additions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_events" ADD CONSTRAINT "requisition_events_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_events" ADD CONSTRAINT "requisition_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
