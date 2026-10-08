-- CreateEnum
CREATE TYPE "public"."CountStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "public"."CountLineResult" AS ENUM ('MATCHES', 'WITHIN_RANGE', 'EXCEEDS', 'NOT_COUNTED');

-- CreateEnum
CREATE TYPE "public"."CountRecheck" AS ENUM ('NONE', 'RECOUNTED', 'KEPT');

-- CreateEnum
CREATE TYPE "public"."CountCause" AS ENUM ('PREP_NOT_LOGGED', 'SPOILAGE', 'MISCOUNT', 'LOSS', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CountMovementKind" AS ENUM ('DISPATCH', 'PREP_USE', 'DELIVERY', 'WASTE');

-- CreateEnum
CREATE TYPE "public"."CountDecisionKind" AS ENUM ('PENDING', 'ACCEPTED', 'WRITE_OFF', 'MOVEMENT_LOGGED', 'RECOUNT_ASKED');

-- CreateEnum
CREATE TYPE "public"."CountSectionKind" AS ENUM ('SUPPLIER', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."WasteReversalReason" AS ENUM ('WRONG_ITEM', 'WRONG_QUANTITY', 'OTHER');

-- AlterTable
ALTER TABLE "public"."counting_thresholds" ADD COLUMN     "flag_repeat_shortfalls" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "range_percent" DECIMAL(5,2) NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "public"."inventory_transactions" ADD COLUMN     "count_line_id" TEXT;

-- AlterTable
ALTER TABLE "public"."waste_logs" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "reversal_note" TEXT,
ADD COLUMN     "reversal_reason" "public"."WasteReversalReason",
ADD COLUMN     "reversed_at" TIMESTAMP(3),
ADD COLUMN     "reversed_by_id" TEXT;

-- CreateTable
CREATE TABLE "public"."counts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "public"."CountStatus" NOT NULL DEFAULT 'OPEN',
    "counter_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approver_id" TEXT,
    "self_signed" BOOLEAN NOT NULL DEFAULT false,
    "recount_of_line_id" TEXT,
    "expected_as_of" TIMESTAMP(3),
    "range_kes" INTEGER,
    "range_percent" DECIMAL(5,2),
    "director_alert_kes" INTEGER,
    "flag_repeat" BOOLEAN,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."count_scope_sections" (
    "id" TEXT NOT NULL,
    "count_id" TEXT NOT NULL,
    "section_id" TEXT,
    "section_name" TEXT NOT NULL,

    CONSTRAINT "count_scope_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."count_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "count_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "section_id" TEXT,
    "section_name" TEXT,
    "position" INTEGER NOT NULL,
    "counted_qty" DECIMAL(12,4),
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "recheck" "public"."CountRecheck" NOT NULL DEFAULT 'NONE',
    "first_counted_qty" DECIMAL(12,4),
    "recheck_offered" BOOLEAN NOT NULL DEFAULT false,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "expected_qty" DECIMAL(12,4),
    "unit_cost" DECIMAL(12,4),
    "result" "public"."CountLineResult",
    "short_streak" INTEGER NOT NULL DEFAULT 0,
    "decision" "public"."CountDecisionKind" NOT NULL DEFAULT 'PENDING',
    "cause" "public"."CountCause",
    "cause_note" TEXT,
    "movement_kind" "public"."CountMovementKind",
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "director_flagged" BOOLEAN NOT NULL DEFAULT false,
    "director_alert" BOOLEAN NOT NULL DEFAULT false,
    "director_seen_at" TIMESTAMP(3),
    "director_seen_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."count_sections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."CountSectionKind" NOT NULL,
    "supplier_id" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "count_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."count_section_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "added_by_id" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "count_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."count_item_moves" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "from_section_id" TEXT,
    "to_section_id" TEXT NOT NULL,
    "moved_by_id" TEXT NOT NULL,
    "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" TIMESTAMP(3),
    "undone_by_id" TEXT,

    CONSTRAINT "count_item_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."count_day_orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "section_ids" TEXT[],

    CONSTRAINT "count_day_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."count_setup_visits" (
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_visit_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "count_setup_visits_pkey" PRIMARY KEY ("organization_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."waste_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "counts_organization_id_status_started_at_idx" ON "public"."counts"("organization_id", "status", "started_at");

-- CreateIndex
CREATE INDEX "counts_counter_id_idx" ON "public"."counts"("counter_id");

-- CreateIndex
CREATE UNIQUE INDEX "counts_organization_id_reference_key" ON "public"."counts"("organization_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "counts_organization_id_counter_id_idempotency_key_key" ON "public"."counts"("organization_id", "counter_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "count_scope_sections_count_id_idx" ON "public"."count_scope_sections"("count_id");

-- CreateIndex
CREATE INDEX "count_scope_sections_section_id_idx" ON "public"."count_scope_sections"("section_id");

-- CreateIndex
CREATE INDEX "count_lines_inventory_item_id_created_at_idx" ON "public"."count_lines"("inventory_item_id", "created_at");

-- CreateIndex
CREATE INDEX "count_lines_organization_id_director_flagged_director_seen__idx" ON "public"."count_lines"("organization_id", "director_flagged", "director_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "count_lines_count_id_inventory_item_id_key" ON "public"."count_lines"("count_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "count_sections_organization_id_position_idx" ON "public"."count_sections"("organization_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "count_sections_organization_id_name_key" ON "public"."count_sections"("organization_id", "name");

-- CreateIndex
CREATE INDEX "count_section_items_section_id_position_idx" ON "public"."count_section_items"("section_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "count_section_items_organization_id_inventory_item_id_key" ON "public"."count_section_items"("organization_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "count_item_moves_organization_id_moved_at_idx" ON "public"."count_item_moves"("organization_id", "moved_at");

-- CreateIndex
CREATE INDEX "count_item_moves_inventory_item_id_idx" ON "public"."count_item_moves"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "count_day_orders_organization_id_user_id_day_key" ON "public"."count_day_orders"("organization_id", "user_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "waste_batches_organization_id_user_id_idempotency_key_key" ON "public"."waste_batches"("organization_id", "user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_transactions_count_line_id_idx" ON "public"."inventory_transactions"("count_line_id");

-- AddForeignKey
ALTER TABLE "public"."counts" ADD CONSTRAINT "counts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counts" ADD CONSTRAINT "counts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counts" ADD CONSTRAINT "counts_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counts" ADD CONSTRAINT "counts_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counts" ADD CONSTRAINT "counts_recount_of_line_id_fkey" FOREIGN KEY ("recount_of_line_id") REFERENCES "public"."count_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_scope_sections" ADD CONSTRAINT "count_scope_sections_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "public"."counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_scope_sections" ADD CONSTRAINT "count_scope_sections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."count_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_lines" ADD CONSTRAINT "count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "public"."counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_lines" ADD CONSTRAINT "count_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_lines" ADD CONSTRAINT "count_lines_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."count_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_lines" ADD CONSTRAINT "count_lines_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_lines" ADD CONSTRAINT "count_lines_director_seen_by_id_fkey" FOREIGN KEY ("director_seen_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_sections" ADD CONSTRAINT "count_sections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_sections" ADD CONSTRAINT "count_sections_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_section_items" ADD CONSTRAINT "count_section_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."count_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_section_items" ADD CONSTRAINT "count_section_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_item_moves" ADD CONSTRAINT "count_item_moves_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_item_moves" ADD CONSTRAINT "count_item_moves_from_section_id_fkey" FOREIGN KEY ("from_section_id") REFERENCES "public"."count_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_item_moves" ADD CONSTRAINT "count_item_moves_to_section_id_fkey" FOREIGN KEY ("to_section_id") REFERENCES "public"."count_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."count_item_moves" ADD CONSTRAINT "count_item_moves_moved_by_id_fkey" FOREIGN KEY ("moved_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_count_line_id_fkey" FOREIGN KEY ("count_line_id") REFERENCES "public"."count_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_batches" ADD CONSTRAINT "waste_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_batches" ADD CONSTRAINT "waste_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."waste_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_logs" ADD CONSTRAINT "waste_logs_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stock, Counting and Waste rebuild, migration A (docs/features/inventory/stock-count-waste-contract.md §2).
-- Structure above generated with `prisma migrate diff`; hand-written below: the two partial unique indexes
-- (§2.1) and the first-sections seed (§2.7). Additive only: no existing row, column or table is touched.

-- One OPEN count per person.
CREATE UNIQUE INDEX "count_open_per_counter_key" ON "public"."counts" ("organization_id", "counter_id") WHERE "status" = 'OPEN';

-- An item is in at most one OPEN count.
CREATE UNIQUE INDEX "count_line_open_item_key" ON "public"."count_lines" ("organization_id", "inventory_item_id") WHERE "is_open";

-- First sections, hub site only, idempotent (every INSERT is guarded by ON CONFLICT or NOT EXISTS).
-- (1) One SUPPLIER section per supplier that has at least one live item preferring it, ordered by name.
INSERT INTO "public"."count_sections" ("id", "organization_id", "name", "kind", "supplier_id", "position", "created_at")
SELECT gen_random_uuid()::text, s."organization_id", s."name", 'SUPPLIER', s."id",
       (SELECT COALESCE(MAX(cs."position"), -1) FROM "public"."count_sections" cs WHERE cs."organization_id" = s."organization_id")
         + ROW_NUMBER() OVER (ORDER BY s."name"),
       now()
FROM "public"."suppliers" s
JOIN "public"."organizations" o ON o."id" = s."organization_id" AND o."isHub"
WHERE EXISTS (
  SELECT 1 FROM "public"."inventory_items" i
  WHERE i."preferred_supplier_id" = s."id" AND i."organization_id" = s."organization_id" AND i."deleted_at" IS NULL
)
AND NOT EXISTS (SELECT 1 FROM "public"."count_sections" cs WHERE cs."organization_id" = s."organization_id" AND cs."supplier_id" = s."id")
ON CONFLICT ("organization_id", "name") DO NOTHING;

-- (2) "Others" and an empty "Packaging", after the supplier sections.
INSERT INTO "public"."count_sections" ("id", "organization_id", "name", "kind", "supplier_id", "position", "created_at")
SELECT gen_random_uuid()::text, o."id", 'Others', 'MANUAL', NULL,
       (SELECT COALESCE(MAX(cs."position"), -1) + 1 FROM "public"."count_sections" cs WHERE cs."organization_id" = o."id"), now()
FROM "public"."organizations" o WHERE o."isHub"
ON CONFLICT ("organization_id", "name") DO NOTHING;

INSERT INTO "public"."count_sections" ("id", "organization_id", "name", "kind", "supplier_id", "position", "created_at")
SELECT gen_random_uuid()::text, o."id", 'Packaging', 'MANUAL', NULL,
       (SELECT COALESCE(MAX(cs."position"), -1) + 1 FROM "public"."count_sections" cs WHERE cs."organization_id" = o."id"), now()
FROM "public"."organizations" o WHERE o."isHub"
ON CONFLICT ("organization_id", "name") DO NOTHING;

-- Live items go into their supplier's section, ordered by name; retired items (deleted_at set) get no row.
INSERT INTO "public"."count_section_items" ("id", "organization_id", "section_id", "inventory_item_id", "position", "added_at")
SELECT gen_random_uuid()::text, i."organization_id", cs."id", i."id",
       ROW_NUMBER() OVER (PARTITION BY cs."id" ORDER BY i."name", i."id") - 1, now()
FROM "public"."inventory_items" i
JOIN "public"."organizations" o ON o."id" = i."organization_id" AND o."isHub"
JOIN "public"."count_sections" cs ON cs."organization_id" = i."organization_id" AND cs."kind" = 'SUPPLIER' AND cs."supplier_id" = i."preferred_supplier_id"
WHERE i."deleted_at" IS NULL
ON CONFLICT ("organization_id", "inventory_item_id") DO NOTHING;

-- Every other live item (no preferred supplier) goes into "Others".
INSERT INTO "public"."count_section_items" ("id", "organization_id", "section_id", "inventory_item_id", "position", "added_at")
SELECT gen_random_uuid()::text, i."organization_id", cs."id", i."id",
       ROW_NUMBER() OVER (ORDER BY i."name", i."id") - 1, now()
FROM "public"."inventory_items" i
JOIN "public"."organizations" o ON o."id" = i."organization_id" AND o."isHub"
JOIN "public"."count_sections" cs ON cs."organization_id" = i."organization_id" AND cs."name" = 'Others'
WHERE i."deleted_at" IS NULL
AND NOT EXISTS (
  SELECT 1 FROM "public"."count_section_items" csi
  WHERE csi."organization_id" = i."organization_id" AND csi."inventory_item_id" = i."id"
)
ON CONFLICT ("organization_id", "inventory_item_id") DO NOTHING;

