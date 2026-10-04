-- The stock ledger is append-only. The application door (postStockMovement) only ever INSERTs;
-- this trigger makes the database refuse UPDATE and DELETE on inventory_transactions as well, so the
-- rule holds even against code or a console session that bypasses the door. A correction is a new
-- row with reverses_transaction_id set.
--
-- Note: the ledger's foreign keys to source documents are ON DELETE SET NULL. Deleting a document
-- that a ledger row points at would rewrite that row; this trigger now blocks that too (a posted
-- document cannot be deleted out from under its ledger rows).
--
-- Escape hatch for dev seed scripts only (src/scripts): a transaction that runs
--   SELECT set_config('wendo.allow_ledger_edit', 'on', true);
-- may edit or delete ledger rows until it ends. ledger-guard.test.ts fails if that setting appears
-- anywhere in application code outside src/scripts.
--
-- No schema change: Prisma does not model triggers, so this migration adds no drift.

CREATE OR REPLACE FUNCTION "public"."inventory_transactions_append_only"() RETURNS trigger AS $$
BEGIN
  IF current_setting('wendo.allow_ledger_edit', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'inventory_transactions is append-only: % is not allowed. Post a linked correction through postStockMovement instead.', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventory_transactions_append_only"
  BEFORE UPDATE OR DELETE ON "public"."inventory_transactions"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."inventory_transactions_append_only"();
