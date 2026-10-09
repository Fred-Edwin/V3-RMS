-- Block 2 (Dispatch, deliveries and discrepancies), back end C: the REPLACE migration.
-- Spec: docs/features/inventory/dispatch-contract.md §2 with Amendment 1. Rollback: ROLLBACK.md beside this file.
--
-- Production has 0 dispatches and 0 discrepancies (owner's read-only queries, 8 Oct 2026), so the old DispatchStatus and
-- DiscrepancyOutcome values, the old Dispatch/DispatchLine columns and the old Discrepancy columns are REPLACED, not expanded.
-- A development database may still hold a few old dispatches (their ledger rows cannot be deleted: the ledger is append-only), so
-- dispatches are converted in place (same ids, so every ledger link holds). A database that holds a DISCREPANCY is refused: stop and ask.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."discrepancies") THEN
    RAISE EXCEPTION 'Block 2 replace migration refused: discrepancies exist (production must have 0). Stop and ask the owner.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "public"."dispatches" d
    WHERE NOT EXISTS (SELECT 1 FROM "public"."departments" dep WHERE dep."organization_id" = d."to_organization_id" AND dep."key" = d."department_tag")
  ) THEN
    RAISE EXCEPTION 'Block 2 replace migration refused: a dispatch has no matching department row. Stop and ask the owner.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "public"."DispatchCountReason" AS ENUM ('NOT_IN_THE_BOX', 'DAMAGED', 'WRONG_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CarrierKind" AS ENUM ('PERSON', 'VEHICLE', 'COMPANY');

-- CreateEnum
CREATE TYPE "public"."DiscrepancyFinding" AS ENUM ('PACKED_SHORT', 'PACKED_MORE', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL');

-- AlterEnum (discrepancies is empty: guarded above)
BEGIN;
CREATE TYPE "public"."DiscrepancyStatus_new" AS ENUM ('OPEN', 'RECORDED', 'REVERSED');
ALTER TABLE "public"."discrepancies" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."discrepancies" ALTER COLUMN "status" TYPE "public"."DiscrepancyStatus_new" USING ("status"::text::"public"."DiscrepancyStatus_new");
ALTER TYPE "public"."DiscrepancyStatus" RENAME TO "DiscrepancyStatus_old";
ALTER TYPE "public"."DiscrepancyStatus_new" RENAME TO "DiscrepancyStatus";
DROP TYPE "public"."DiscrepancyStatus_old";
ALTER TABLE "public"."discrepancies" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterEnum (an old dispatch keeps its meaning: AWAITING -> TO_PACK, IN_TRANSIT -> ON_THE_WAY, CONFIRMED and DISCREPANCY_OPEN -> CONFIRMED)
BEGIN;
CREATE TYPE "public"."DispatchStatus_new" AS ENUM ('TO_PACK', 'PACKING', 'ON_THE_WAY', 'CONFIRMED', 'CLOSED', 'CANCELLED');
ALTER TABLE "public"."dispatches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."dispatches" ALTER COLUMN "status" TYPE "public"."DispatchStatus_new" USING (
  CASE "status"::text
    WHEN 'AWAITING' THEN 'TO_PACK'
    WHEN 'IN_TRANSIT' THEN 'ON_THE_WAY'
    WHEN 'DISCREPANCY_OPEN' THEN 'CONFIRMED'
    ELSE "status"::text
  END::"public"."DispatchStatus_new");
ALTER TYPE "public"."DispatchStatus" RENAME TO "DispatchStatus_old";
ALTER TYPE "public"."DispatchStatus_new" RENAME TO "DispatchStatus";
DROP TYPE "public"."DispatchStatus_old";
ALTER TABLE "public"."dispatches" ALTER COLUMN "status" SET DEFAULT 'TO_PACK';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."discrepancies" DROP CONSTRAINT "discrepancies_follow_up_dispatch_id_fkey";
ALTER TABLE "public"."discrepancies" DROP CONSTRAINT "discrepancies_resolved_by_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_confirmed_by_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_dispatched_by_id_fkey";

-- DropIndex
DROP INDEX "public"."discrepancies_dispatch_line_id_idx";
DROP INDEX "public"."discrepancies_status_idx";
DROP INDEX "public"."dispatches_to_organization_id_department_tag_status_idx";

-- CreateTable
CREATE TABLE "public"."carriers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."CarrierKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- AlterTable dispatches: new columns first (department_id nullable until back-filled), then the in-place conversion, then the drops
ALTER TABLE "public"."dispatches"
ADD COLUMN     "arrived_at" TIMESTAMP(3),
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" TEXT,
ADD COLUMN     "carrier_id" TEXT,
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "counted_at" TIMESTAMP(3),
ADD COLUMN     "counted_by_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "on_behalf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packed_at" TIMESTAMP(3),
ADD COLUMN     "packed_by_id" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "send_batch_id" TEXT,
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "signed_by_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "public"."dispatches" d SET
  "department_id" = (SELECT dep."id" FROM "public"."departments" dep WHERE dep."organization_id" = d."to_organization_id" AND dep."key" = d."department_tag"),
  "packed_by_id" = d."dispatched_by_id",
  "packed_at" = d."dispatched_at",
  "signed_by_id" = d."dispatched_by_id",
  "signed_at" = d."dispatched_at",
  "counted_by_id" = d."confirmed_by_id",
  "counted_at" = d."confirmed_at",
  "on_behalf" = d."confirmed_on_behalf",
  "send_batch_id" = CASE WHEN d."dispatched_at" IS NULL THEN NULL ELSE gen_random_uuid()::text END;

-- A converted dispatch that was already signed gets its DSP- number (per branch, in signing order) and the counter moves past it.
WITH numbered AS (
  SELECT d."id", d."to_organization_id" AS branch,
         'DSP-' || COALESCE(o."code", 'BRN') || '-' || LPAD(ROW_NUMBER() OVER (PARTITION BY d."to_organization_id" ORDER BY d."signed_at", d."id")::text, 4, '0') AS ref,
         ROW_NUMBER() OVER (PARTITION BY d."to_organization_id" ORDER BY d."signed_at", d."id") AS n
  FROM "public"."dispatches" d JOIN "public"."organizations" o ON o."id" = d."to_organization_id"
  WHERE d."signed_at" IS NOT NULL
)
UPDATE "public"."dispatches" d SET "reference" = numbered.ref FROM numbered WHERE numbered."id" = d."id";

INSERT INTO "public"."reference_counters" ("id", "organization_id", "prefix", "last_number", "created_at", "updated_at")
SELECT gen_random_uuid()::text, d."to_organization_id", 'DSP', COUNT(*), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "public"."dispatches" d WHERE d."reference" IS NOT NULL GROUP BY d."to_organization_id"
ON CONFLICT ("organization_id", "prefix") DO UPDATE SET "last_number" = GREATEST("reference_counters"."last_number", EXCLUDED."last_number");

ALTER TABLE "public"."dispatches" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "public"."dispatches" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "public"."dispatches"
DROP COLUMN "confirmed_at",
DROP COLUMN "confirmed_by_id",
DROP COLUMN "confirmed_on_behalf",
DROP COLUMN "department_tag",
DROP COLUMN "dispatched_at",
DROP COLUMN "dispatched_by_id",
DROP COLUMN "sequence_label";

-- AlterTable dispatch_lines
ALTER TABLE "public"."dispatch_lines"
ADD COLUMN     "count_reason" "public"."DispatchCountReason",
ADD COLUMN     "count_reason_note" TEXT,
ADD COLUMN     "counted_qty" DECIMAL(12,4),
ADD COLUMN     "counted_twice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packed_tick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sent_qty" DECIMAL(12,4),
ADD COLUMN     "unit_cost_at_dispatch" DECIMAL(12,4);

UPDATE "public"."dispatch_lines" SET
  "sent_qty" = "dispatched_qty",
  "unit_cost_at_dispatch" = "cost_at_dispatch",
  "counted_qty" = "confirmed_qty",
  "requested_qty" = COALESCE("requested_qty", "dispatched_qty"),
  "packed_tick" = true;

ALTER TABLE "public"."dispatch_lines" ALTER COLUMN "sent_qty" SET NOT NULL;
ALTER TABLE "public"."dispatch_lines" ALTER COLUMN "requested_qty" SET NOT NULL;
ALTER TABLE "public"."dispatch_lines"
DROP COLUMN "confirmed_qty",
DROP COLUMN "cost_at_dispatch",
DROP COLUMN "dispatched_qty",
DROP COLUMN "is_substitute",
DROP COLUMN "substitute_note";

-- AlterTable discrepancies (empty: guarded above)
ALTER TABLE "public"."discrepancies"
DROP COLUMN "follow_up_dispatch_id",
DROP COLUMN "outcome",
DROP COLUMN "reference_number",
DROP COLUMN "resolution_note",
DROP COLUMN "resolved_at",
DROP COLUMN "resolved_by_id",
ADD COLUMN     "dispatch_id" TEXT NOT NULL,
ADD COLUMN     "finding" "public"."DiscrepancyFinding",
ADD COLUMN     "finding_note" TEXT,
ADD COLUMN     "loss_value" DECIMAL(14,2),
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "recorded_at" TIMESTAMP(3),
ADD COLUMN     "recorded_by_id" TEXT,
ADD COLUMN     "reference" TEXT NOT NULL,
ADD COLUMN     "reverse_reason" TEXT,
ADD COLUMN     "reversed_at" TIMESTAMP(3),
ADD COLUMN     "reversed_by_id" TEXT,
ADD COLUMN     "to_organization_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "public"."DiscrepancyOutcome";

-- CreateTable
CREATE TABLE "public"."dispatch_photos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "dispatch_line_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispatch_events" (
    "id" TEXT NOT NULL,
    "dispatch_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role_label" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "idempotency_key" TEXT,

    CONSTRAINT "dispatch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discrepancy_events" (
    "id" TEXT NOT NULL,
    "discrepancy_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role_label" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finding" "public"."DiscrepancyFinding",
    "note" TEXT,
    "reason" TEXT,
    "idempotency_key" TEXT,

    CONSTRAINT "discrepancy_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carriers_organization_id_active_idx" ON "public"."carriers"("organization_id", "active");
CREATE UNIQUE INDEX "carriers_organization_id_name_key" ON "public"."carriers"("organization_id", "name");
CREATE UNIQUE INDEX "dispatch_photos_object_key_key" ON "public"."dispatch_photos"("object_key");
CREATE INDEX "dispatch_photos_dispatch_line_id_idx" ON "public"."dispatch_photos"("dispatch_line_id");
CREATE INDEX "dispatch_events_dispatch_id_at_idx" ON "public"."dispatch_events"("dispatch_id", "at");
CREATE UNIQUE INDEX "dispatch_events_dispatch_id_actor_id_idempotency_key_key" ON "public"."dispatch_events"("dispatch_id", "actor_id", "idempotency_key");
CREATE INDEX "discrepancy_events_discrepancy_id_at_idx" ON "public"."discrepancy_events"("discrepancy_id", "at");
CREATE UNIQUE INDEX "discrepancy_events_discrepancy_id_actor_id_idempotency_key_key" ON "public"."discrepancy_events"("discrepancy_id", "actor_id", "idempotency_key");
CREATE UNIQUE INDEX "discrepancies_dispatch_line_id_key" ON "public"."discrepancies"("dispatch_line_id");
CREATE INDEX "discrepancies_organization_id_status_idx" ON "public"."discrepancies"("organization_id", "status");
CREATE INDEX "discrepancies_to_organization_id_status_idx" ON "public"."discrepancies"("to_organization_id", "status");
CREATE INDEX "discrepancies_dispatch_id_idx" ON "public"."discrepancies"("dispatch_id");
CREATE UNIQUE INDEX "discrepancies_to_organization_id_reference_key" ON "public"."discrepancies"("to_organization_id", "reference");
CREATE UNIQUE INDEX "dispatch_lines_dispatch_id_requisition_line_id_key" ON "public"."dispatch_lines"("dispatch_id", "requisition_line_id");
CREATE INDEX "dispatches_to_organization_id_department_id_status_idx" ON "public"."dispatches"("to_organization_id", "department_id", "status");
CREATE INDEX "dispatches_send_batch_id_idx" ON "public"."dispatches"("send_batch_id");
CREATE UNIQUE INDEX "dispatches_to_organization_id_reference_key" ON "public"."dispatches"("to_organization_id", "reference");

-- One live dispatch per department per requisition. A cancelled one is replaced by a new row (P8 returns the lines to the queue).
-- Prisma cannot express a partial index; it is kept here and in the schema comment.
CREATE UNIQUE INDEX "dispatches_one_live_per_department" ON "public"."dispatches"("requisition_id", "department_id") WHERE "status" <> 'CANCELLED';

-- AddForeignKey
ALTER TABLE "public"."carriers" ADD CONSTRAINT "carriers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_packed_by_id_fkey" FOREIGN KEY ("packed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."dispatches" ADD CONSTRAINT "dispatches_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."dispatch_photos" ADD CONSTRAINT "dispatch_photos_dispatch_line_id_fkey" FOREIGN KEY ("dispatch_line_id") REFERENCES "public"."dispatch_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."dispatch_photos" ADD CONSTRAINT "dispatch_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."dispatch_events" ADD CONSTRAINT "dispatch_events_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."dispatch_events" ADD CONSTRAINT "dispatch_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."discrepancies" ADD CONSTRAINT "discrepancies_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."discrepancies" ADD CONSTRAINT "discrepancies_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."discrepancies" ADD CONSTRAINT "discrepancies_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."discrepancy_events" ADD CONSTRAINT "discrepancy_events_discrepancy_id_fkey" FOREIGN KEY ("discrepancy_id") REFERENCES "public"."discrepancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."discrepancy_events" ADD CONSTRAINT "discrepancy_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
