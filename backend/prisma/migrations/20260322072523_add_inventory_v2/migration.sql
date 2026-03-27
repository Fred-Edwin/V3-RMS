-- CreateEnum
CREATE TYPE "public"."RequisitionStatus" AS ENUM ('PENDING', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."StocktakeStation" AS ENUM ('KITCHEN', 'BARISTA', 'WAITER');

-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'STORE_MANAGER';

-- AlterTable
ALTER TABLE "public"."orders" ALTER COLUMN "split_type" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."raw_ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "current_stock_ck" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "reorder_threshold" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingredient_conversions" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "quantity_per_portion" DECIMAL(10,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_deliveries" (
    "id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requisitions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "status" "public"."RequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "is_mid_day" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requisition_items" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "requested_qty" INTEGER NOT NULL,
    "dispatched_qty" INTEGER,
    "received_qty" INTEGER,
    "has_discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branch_stock" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "current_qty" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consumables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "station" "public"."StocktakeStation" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consumable_stock" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "consumable_id" TEXT NOT NULL,
    "current_qty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stocktake_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conducted_by_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocktake_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stocktake_entries" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "station" "public"."StocktakeStation" NOT NULL,
    "menu_item_id" TEXT,
    "consumable_id" TEXT,
    "expected_qty" DECIMAL(10,2) NOT NULL,
    "actual_qty" DECIMAL(10,2) NOT NULL,
    "variance" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocktake_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raw_ingredients_name_key" ON "public"."raw_ingredients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_conversions_menu_item_id_ingredient_id_key" ON "public"."ingredient_conversions"("menu_item_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "supplier_deliveries_ingredient_id_idx" ON "public"."supplier_deliveries"("ingredient_id");

-- CreateIndex
CREATE INDEX "supplier_deliveries_supplier_id_idx" ON "public"."supplier_deliveries"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_deliveries_delivered_at_idx" ON "public"."supplier_deliveries"("delivered_at");

-- CreateIndex
CREATE INDEX "requisitions_organization_id_status_idx" ON "public"."requisitions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "requisitions_status_submitted_at_idx" ON "public"."requisitions"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "requisition_items_requisition_id_idx" ON "public"."requisition_items"("requisition_id");

-- CreateIndex
CREATE INDEX "branch_stock_organization_id_idx" ON "public"."branch_stock"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_stock_organization_id_menu_item_id_key" ON "public"."branch_stock"("organization_id", "menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumables_name_key" ON "public"."consumables"("name");

-- CreateIndex
CREATE INDEX "consumable_stock_organization_id_idx" ON "public"."consumable_stock"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_stock_organization_id_consumable_id_key" ON "public"."consumable_stock"("organization_id", "consumable_id");

-- CreateIndex
CREATE INDEX "stocktake_sessions_organization_id_idx" ON "public"."stocktake_sessions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stocktake_sessions_organization_id_date_key" ON "public"."stocktake_sessions"("organization_id", "date");

-- CreateIndex
CREATE INDEX "stocktake_entries_session_id_idx" ON "public"."stocktake_entries"("session_id");

-- AddForeignKey
ALTER TABLE "public"."ingredient_conversions" ADD CONSTRAINT "ingredient_conversions_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingredient_conversions" ADD CONSTRAINT "ingredient_conversions_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."raw_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_deliveries" ADD CONSTRAINT "supplier_deliveries_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."raw_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_deliveries" ADD CONSTRAINT "supplier_deliveries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_deliveries" ADD CONSTRAINT "supplier_deliveries_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_items" ADD CONSTRAINT "requisition_items_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisition_items" ADD CONSTRAINT "requisition_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_stock" ADD CONSTRAINT "branch_stock_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_stock" ADD CONSTRAINT "branch_stock_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumable_stock" ADD CONSTRAINT "consumable_stock_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumable_stock" ADD CONSTRAINT "consumable_stock_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "public"."consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocktake_sessions" ADD CONSTRAINT "stocktake_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocktake_sessions" ADD CONSTRAINT "stocktake_sessions_conducted_by_id_fkey" FOREIGN KEY ("conducted_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocktake_entries" ADD CONSTRAINT "stocktake_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."stocktake_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocktake_entries" ADD CONSTRAINT "stocktake_entries_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocktake_entries" ADD CONSTRAINT "stocktake_entries_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "public"."consumables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
