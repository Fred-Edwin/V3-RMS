-- Inventory Milestone One — Catalog, Suppliers & Restock Levels
-- Drop-and-recreate of the inventory schema per docs/features/inventory/05-plan.md §4.
-- All preconditions confirmed 2026-09-15 (§4): production holds only demo data,
-- exactly one hub org exists, exactly one CENTRAL_STORE location exists on it.
--
-- Order matters. Steps mirror the plan exactly:
--   1. Drop tables this milestone doesn't own but which FK into items/suppliers
--      (dropped now, rebuilt in their own milestone — plan §1.3).
--   2. Truncate inventory_transactions (37 demo rows found in production, §2),
--      drop its FK to inventory_items, then drop inventory_items and suppliers.
--   3. Drop the now-unreferenced status/reason enums.
--   4. Create the new InventoryItemType values and the new SupplierPaymentTerms enum.
--   5. Create categories, suppliers, inventory_items, restock_levels with FKs/indexes.
--   6. Hand-added raw SQL: partial unique indexes + the raw-ingredient CHECK constraint.
--   7. Re-add inventory_transactions' FK to the new inventory_items.

-- ============================================================================
-- Step 1: drop tables outside this milestone's scope that FK into items/suppliers
-- ============================================================================

-- inventory_transactions carries optional FKs into several of the tables this
-- step drops — must come down before the tables themselves, ahead of the
-- ledger-specific FK drop in Step 2 (which only handles the FK to inventory_items).
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_dispatch_line_id_fkey";
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_market_purchase_line_id_fkey";
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_prep_record_id_fkey";
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_purchase_order_line_id_fkey";
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_stock_count_line_id_fkey";
ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_waste_log_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."dispatch_lines" DROP CONSTRAINT "dispatch_lines_dispatch_id_fkey";
ALTER TABLE "public"."dispatch_lines" DROP CONSTRAINT "dispatch_lines_inventory_item_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_dispatched_by_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_from_location_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_from_organization_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_received_by_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_requisition_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_to_location_id_fkey";
ALTER TABLE "public"."dispatches" DROP CONSTRAINT "dispatches_to_organization_id_fkey";
ALTER TABLE "public"."market_purchase_lines" DROP CONSTRAINT "market_purchase_lines_inventory_item_id_fkey";
ALTER TABLE "public"."market_purchase_lines" DROP CONSTRAINT "market_purchase_lines_market_purchase_id_fkey";
ALTER TABLE "public"."market_purchase_lines" DROP CONSTRAINT "market_purchase_lines_organizationId_fkey";
ALTER TABLE "public"."market_purchases" DROP CONSTRAINT "market_purchases_location_id_fkey";
ALTER TABLE "public"."market_purchases" DROP CONSTRAINT "market_purchases_organization_id_fkey";
ALTER TABLE "public"."market_purchases" DROP CONSTRAINT "market_purchases_recorded_by_id_fkey";
ALTER TABLE "public"."par_levels" DROP CONSTRAINT "par_levels_inventory_item_id_fkey";
ALTER TABLE "public"."par_levels" DROP CONSTRAINT "par_levels_location_id_fkey";
ALTER TABLE "public"."par_levels" DROP CONSTRAINT "par_levels_organization_id_fkey";
ALTER TABLE "public"."par_levels" DROP CONSTRAINT "par_levels_set_by_id_fkey";
ALTER TABLE "public"."prep_recipe_lines" DROP CONSTRAINT "prep_recipe_lines_input_item_id_fkey";
ALTER TABLE "public"."prep_recipe_lines" DROP CONSTRAINT "prep_recipe_lines_organization_id_fkey";
ALTER TABLE "public"."prep_recipe_lines" DROP CONSTRAINT "prep_recipe_lines_prep_recipe_id_fkey";
ALTER TABLE "public"."prep_recipes" DROP CONSTRAINT "prep_recipes_created_by_id_fkey";
ALTER TABLE "public"."prep_recipes" DROP CONSTRAINT "prep_recipes_organization_id_fkey";
ALTER TABLE "public"."prep_recipes" DROP CONSTRAINT "prep_recipes_output_item_id_fkey";
ALTER TABLE "public"."prep_recipes" DROP CONSTRAINT "prep_recipes_promoted_from_id_fkey";
ALTER TABLE "public"."prep_record_lines" DROP CONSTRAINT "prep_record_lines_input_item_id_fkey";
ALTER TABLE "public"."prep_record_lines" DROP CONSTRAINT "prep_record_lines_organization_id_fkey";
ALTER TABLE "public"."prep_record_lines" DROP CONSTRAINT "prep_record_lines_prep_record_id_fkey";
ALTER TABLE "public"."prep_records" DROP CONSTRAINT "prep_records_location_id_fkey";
ALTER TABLE "public"."prep_records" DROP CONSTRAINT "prep_records_organization_id_fkey";
ALTER TABLE "public"."prep_records" DROP CONSTRAINT "prep_records_output_item_id_fkey";
ALTER TABLE "public"."prep_records" DROP CONSTRAINT "prep_records_recorded_by_id_fkey";
ALTER TABLE "public"."purchase_order_lines" DROP CONSTRAINT "purchase_order_lines_inventory_item_id_fkey";
ALTER TABLE "public"."purchase_order_lines" DROP CONSTRAINT "purchase_order_lines_organization_id_fkey";
ALTER TABLE "public"."purchase_order_lines" DROP CONSTRAINT "purchase_order_lines_purchase_order_id_fkey";
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT "purchase_orders_created_by_id_fkey";
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT "purchase_orders_location_id_fkey";
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT "purchase_orders_organization_id_fkey";
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT "purchase_orders_supplier_id_fkey";
ALTER TABLE "public"."requisition_lines" DROP CONSTRAINT "requisition_lines_inventory_item_id_fkey";
ALTER TABLE "public"."requisition_lines" DROP CONSTRAINT "requisition_lines_organizationId_fkey";
ALTER TABLE "public"."requisition_lines" DROP CONSTRAINT "requisition_lines_requisition_id_fkey";
ALTER TABLE "public"."requisitions" DROP CONSTRAINT "requisitions_approved_by_id_fkey";
ALTER TABLE "public"."requisitions" DROP CONSTRAINT "requisitions_location_id_fkey";
ALTER TABLE "public"."requisitions" DROP CONSTRAINT "requisitions_organization_id_fkey";
ALTER TABLE "public"."requisitions" DROP CONSTRAINT "requisitions_requested_by_id_fkey";
ALTER TABLE "public"."stock_count_lines" DROP CONSTRAINT "stock_count_lines_inventory_item_id_fkey";
ALTER TABLE "public"."stock_count_lines" DROP CONSTRAINT "stock_count_lines_organization_id_fkey";
ALTER TABLE "public"."stock_count_lines" DROP CONSTRAINT "stock_count_lines_stock_count_id_fkey";
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_approved_by_id_fkey";
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_created_by_id_fkey";
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_location_id_fkey";
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_organization_id_fkey";
ALTER TABLE "public"."stock_counts" DROP CONSTRAINT "stock_counts_submitted_by_id_fkey";
ALTER TABLE "public"."supplier_invoices" DROP CONSTRAINT "supplier_invoices_created_by_id_fkey";
ALTER TABLE "public"."supplier_invoices" DROP CONSTRAINT "supplier_invoices_organization_id_fkey";
ALTER TABLE "public"."supplier_invoices" DROP CONSTRAINT "supplier_invoices_purchase_order_id_fkey";
ALTER TABLE "public"."supplier_invoices" DROP CONSTRAINT "supplier_invoices_supplier_id_fkey";
ALTER TABLE "public"."supplier_items" DROP CONSTRAINT "supplier_items_inventory_item_id_fkey";
ALTER TABLE "public"."supplier_items" DROP CONSTRAINT "supplier_items_organization_id_fkey";
ALTER TABLE "public"."supplier_items" DROP CONSTRAINT "supplier_items_supplier_id_fkey";
ALTER TABLE "public"."supplier_payments" DROP CONSTRAINT "supplier_payments_organization_id_fkey";
ALTER TABLE "public"."supplier_payments" DROP CONSTRAINT "supplier_payments_recorded_by_id_fkey";
ALTER TABLE "public"."supplier_payments" DROP CONSTRAINT "supplier_payments_supplier_invoice_id_fkey";
ALTER TABLE "public"."waste_logs" DROP CONSTRAINT "waste_logs_inventory_item_id_fkey";
ALTER TABLE "public"."waste_logs" DROP CONSTRAINT "waste_logs_location_id_fkey";
ALTER TABLE "public"."waste_logs" DROP CONSTRAINT "waste_logs_logged_by_id_fkey";
ALTER TABLE "public"."waste_logs" DROP CONSTRAINT "waste_logs_organization_id_fkey";

-- DropTable
DROP TABLE "public"."dispatch_lines";
DROP TABLE "public"."dispatches";
DROP TABLE "public"."requisition_lines";
DROP TABLE "public"."requisitions";
DROP TABLE "public"."market_purchase_lines";
DROP TABLE "public"."market_purchases";
DROP TABLE "public"."waste_logs";
DROP TABLE "public"."stock_count_lines";
DROP TABLE "public"."stock_counts";
DROP TABLE "public"."prep_record_lines";
DROP TABLE "public"."prep_records";
DROP TABLE "public"."prep_recipe_lines";
DROP TABLE "public"."prep_recipes";
DROP TABLE "public"."supplier_payments";
DROP TABLE "public"."supplier_invoices";
DROP TABLE "public"."purchase_order_lines";
DROP TABLE "public"."purchase_orders";
DROP TABLE "public"."supplier_items";
DROP TABLE "public"."par_levels";

-- ============================================================================
-- Step 2: inventory_transactions holds 37 demo ledger rows (§2 finding) that
-- reference items about to be dropped — truncate before dropping the FK,
-- or this migration fails on a foreign-key constraint. The table itself is
-- preserved; only its rows are cleared (the ledger's own redo owns its schema).
-- ============================================================================

TRUNCATE TABLE "public"."inventory_transactions";

ALTER TABLE "public"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_inventory_item_id_fkey";

DROP TABLE "public"."inventory_items";
DROP TABLE "public"."suppliers";

-- ============================================================================
-- Step 3: drop the now-unreferenced status/reason enums
-- ============================================================================

DROP TYPE "public"."DispatchStatus";
DROP TYPE "public"."PurchaseOrderStatus";
DROP TYPE "public"."RequisitionStatus";
DROP TYPE "public"."StockCountStatus";
DROP TYPE "public"."SupplierInvoiceStatus";
DROP TYPE "public"."WasteReason";
DROP TYPE "public"."InventoryItemType";

-- ============================================================================
-- Step 4: create the new enums
-- ============================================================================

CREATE TYPE "public"."InventoryItemType" AS ENUM ('RAW_INGREDIENT', 'PREPPED', 'STOCKED');
CREATE TYPE "public"."SupplierPaymentTerms" AS ENUM ('INVOICE_TO_FOLLOW', 'PAY_NOW');

-- ============================================================================
-- Step 5: create categories, suppliers, inventory_items, restock_levels
-- ============================================================================

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "category_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "default_payment_terms" "public"."SupplierPaymentTerms" NOT NULL DEFAULT 'INVOICE_TO_FOLLOW',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."InventoryItemType" NOT NULL,
    "category_id" TEXT,
    "preferred_supplier_id" TEXT,
    "buy_unit" TEXT NOT NULL,
    "usage_unit" TEXT NOT NULL,
    "conversion_factor" DECIMAL(12,4),
    "pack_size" DECIMAL(12,4),
    "department_tags" "public"."DepartmentTag"[],
    "current_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."restock_levels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "level" DECIMAL(12,4) NOT NULL,
    "set_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_organization_id_idx" ON "public"."categories"("organization_id");
CREATE INDEX "suppliers_organization_id_idx" ON "public"."suppliers"("organization_id");
CREATE INDEX "suppliers_organization_id_deleted_at_idx" ON "public"."suppliers"("organization_id", "deleted_at");
CREATE INDEX "inventory_items_organization_id_idx" ON "public"."inventory_items"("organization_id");
CREATE INDEX "inventory_items_category_id_idx" ON "public"."inventory_items"("category_id");
CREATE INDEX "inventory_items_organization_id_deleted_at_idx" ON "public"."inventory_items"("organization_id", "deleted_at");
CREATE INDEX "restock_levels_organization_id_idx" ON "public"."restock_levels"("organization_id");
CREATE INDEX "restock_levels_inventory_item_id_idx" ON "public"."restock_levels"("inventory_item_id");
CREATE UNIQUE INDEX "restock_levels_location_id_inventory_item_id_key" ON "public"."restock_levels"("location_id", "inventory_item_id");

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."restock_levels" ADD CONSTRAINT "restock_levels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."restock_levels" ADD CONSTRAINT "restock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."restock_levels" ADD CONSTRAINT "restock_levels_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."restock_levels" ADD CONSTRAINT "restock_levels_set_by_id_fkey" FOREIGN KEY ("set_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Step 6: hand-added raw SQL — Prisma's DSL cannot express these
-- ============================================================================

-- Case-insensitive uniqueness among LIVE rows only (plan §3.2, §3.3). A
-- retired "Seasonal" category/supplier must not block creating a new one
-- with the same name.
CREATE UNIQUE INDEX "categories_org_name_live_key" ON "public"."categories" ("organization_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "suppliers_org_name_live_key" ON "public"."suppliers" ("organization_id", lower("name")) WHERE "deleted_at" IS NULL;

-- A raw ingredient may never carry department tags — the data-level layer of
-- the three-layer enforcement (Zod refinement + service guard + this CHECK).
-- This is what makes it a data rule rather than a convention (plan §3.2, §5.4).
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_raw_no_department" CHECK (type <> 'RAW_INGREDIENT' OR cardinality(department_tags) = 0);

-- ============================================================================
-- Step 7: re-add inventory_transactions' FK to the new inventory_items
-- ============================================================================

ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
