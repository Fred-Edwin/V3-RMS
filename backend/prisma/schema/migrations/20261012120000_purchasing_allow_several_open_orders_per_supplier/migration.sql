-- Training fix 6 (12 Oct 2026): an open order to a supplier no longer blocks a new one. The people confirm in the app first.
-- The one-open-order rule was held by a partial unique index; it becomes a plain index (same columns, same filter), so lookups stay fast.
DROP INDEX IF EXISTS "purchase_orders_one_open_per_supplier";

CREATE INDEX IF NOT EXISTS "purchase_orders_open_by_supplier_idx"
  ON "purchase_orders" ("organization_id", "supplier_id")
  WHERE "status" IN ('DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT');
