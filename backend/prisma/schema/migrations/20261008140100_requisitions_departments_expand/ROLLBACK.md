# Rollback note: Block 1 expand migrations

Migrations `20261008140000_requisitions_enum_values` and `20261008140100_requisitions_departments_expand`. Expand only: nothing old was dropped, so the old code keeps running on the old columns and enum values.

**Prefer rolling the application back** (deploy the previous image): the old code ignores every new column and table. Roll the database back only if the migration itself must be undone, and only before any requisition is written by the new code.

Undo, in one transaction, on a database restored for the purpose (never by hand on production without a fresh backup):

```sql
BEGIN;
ALTER TABLE "requisition_lines" DROP COLUMN "addition_id", DROP COLUMN "on_hand_at_request", DROP COLUMN "suggested_qty", DROP COLUMN "unit_cost_at_approval";
DROP TABLE "requisition_events", "requisition_additions", "item_departments";
ALTER TABLE "requisition_sections" DROP COLUMN "department_id", DROP COLUMN "skipped_at", DROP COLUMN "skipped_by_id";
-- only if no section has a NULL department_tag (a department added after this migration has no legacy key):
ALTER TABLE "requisition_sections" ALTER COLUMN "department_tag" SET NOT NULL;
ALTER TABLE "requisitions" DROP COLUMN "approved_as_id", DROP COLUMN "cancel_reason", DROP COLUMN "cancelled_at", DROP COLUMN "cancelled_by_id",
  DROP COLUMN "closed_at", DROP COLUMN "idempotency_key", DROP COLUMN "reference", DROP COLUMN "urgent", DROP COLUMN "urgent_at", DROP COLUMN "urgent_escalated_at";
ALTER TABLE "users" DROP COLUMN "department_id";
ALTER TABLE "locations" DROP COLUMN "department_id";
DROP TABLE "departments";
ALTER TABLE "organizations" DROP COLUMN "code";
DROP TYPE "DepartmentStatus"; DROP TYPE "RequisitionAdditionStatus";
DELETE FROM "reference_counters" WHERE "prefix" = 'REQ';
COMMIT;
DELETE FROM "_prisma_migrations" WHERE "migration_name" IN ('20261008140100_requisitions_departments_expand', '20261008140000_requisitions_enum_values');
```

Not reversible by the SQL above, and not needed:
- The four enum values (`SKIPPED`, `CANCELLED`, `CLOSED`, `EXTRA`) stay in their types; unused, they are harmless.
- `EVENING` and `AD_HOC` requisitions were re-labelled `EXTRA`. To restore them, take the old labels from the backup (the only record); the old code shows `EXTRA` without trouble.
