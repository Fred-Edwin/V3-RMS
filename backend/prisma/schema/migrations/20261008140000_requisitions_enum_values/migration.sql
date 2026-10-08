-- Block 1 (Requisitions and the foundations), step 1 of 2: new enum values only (expand; no value is dropped).
-- PostgreSQL cannot use a new enum value in the same transaction that adds it, so the values go in their own
-- migration and the data migration that maps old rows to EXTRA is the next one (20261008140100).
-- Rollback note: see 20261008140100_requisitions_departments_expand/ROLLBACK.md. Enum values cannot be removed once added;
-- they are harmless unused, and IF NOT EXISTS lets the migration run again after a rollback.

ALTER TYPE "public"."RequisitionSectionStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
ALTER TYPE "public"."RequisitionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "public"."RequisitionStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "public"."RequisitionType" ADD VALUE IF NOT EXISTS 'EXTRA';
