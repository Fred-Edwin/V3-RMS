# Rollback note: Block 2 replace migration (`20261009100000_block2_dispatch_replace`)

This migration REPLACES the Milestone Five and Six dispatch and discrepancy structures (it is not expand-only). Production had 0 dispatches and 0 discrepancies when it was written (owner's read-only queries, 8 Oct 2026); **re-run those two counts the week of release**. The migration refuses to run (raises an exception, nothing changes) if any `discrepancies` row exists or a dispatch has no matching department; if either is above 0, stop and ask the owner.

**Prefer a backup restore.** Take a fresh backup immediately before the release; to undo, restore it and deploy the previous image. The old code cannot run on the new columns, so an application-only rollback is not possible once this has run.

If the migration itself must be undone on a database that was restored for the purpose, and **no new-flow row has been written** (no carrier, no `DSP-` signed by the new code, no event), the structures can be rebuilt by hand in one transaction:

```sql
BEGIN;
DROP TABLE "discrepancy_events", "dispatch_events", "dispatch_photos";
DROP INDEX "dispatches_one_live_per_department";
ALTER TABLE "dispatches" DROP COLUMN "arrived_at", DROP COLUMN "cancel_reason", DROP COLUMN "cancelled_at", DROP COLUMN "cancelled_by_id",
  DROP COLUMN "carrier_id", DROP COLUMN "closed_at", DROP COLUMN "counted_at", DROP COLUMN "counted_by_id", DROP COLUMN "created_at",
  DROP COLUMN "on_behalf", DROP COLUMN "packed_at", DROP COLUMN "packed_by_id", DROP COLUMN "reference", DROP COLUMN "send_batch_id",
  DROP COLUMN "signed_at", DROP COLUMN "signed_by_id", DROP COLUMN "updated_at", DROP COLUMN "department_id";
-- then re-add department_tag, sequence_label, dispatched_*, confirmed_*, confirmed_on_behalf, the old enum values and the old
-- dispatch_lines and discrepancies columns from the previous migrations. The data of converted rows is in the backup only.
DROP TABLE "carriers";
DELETE FROM "reference_counters" WHERE "prefix" IN ('DSP', 'DSC');
COMMIT;
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261009100000_block2_dispatch_replace';
```

That is long and error-prone; the restore is the safe way.

What the migration did, for the record:
- `DispatchStatus` is now `TO_PACK, PACKING, ON_THE_WAY, CONFIRMED, CLOSED, CANCELLED`; an old row is converted in place (`AWAITING` to `TO_PACK`, `IN_TRANSIT` to `ON_THE_WAY`, `CONFIRMED` and `DISCREPANCY_OPEN` to `CONFIRMED`), keeping its id so every ledger link holds. A converted signed dispatch is numbered `DSP-<branch code>-nnnn` and the `DSP` counter moved past it.
- `DiscrepancyStatus` is `OPEN, RECORDED, REVERSED`; `DiscrepancyOutcome` is dropped.
- New: `carriers`, `dispatch_photos`, `dispatch_events`, `discrepancy_events`, and a partial unique index `dispatches_one_live_per_department` (one non-cancelled dispatch per department per requisition) that Prisma cannot express.
- `departmentTag` became `department_id`; `sequence_label` is gone (the `DSP-` reference replaces it).

Test on a restored copy of the production database before release (the owner does the production steps): `pnpm exec prisma migrate deploy` against the copy, then `RUN_DB_TESTS=1 pnpm test`.
