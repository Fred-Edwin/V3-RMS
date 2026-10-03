-- CreateTable
CREATE TABLE "public"."restock_level_changes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "old_level" DECIMAL(12,4),
    "new_level" DECIMAL(12,4),
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restock_level_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restock_level_changes_location_id_inventory_item_id_created_idx" ON "public"."restock_level_changes"("location_id", "inventory_item_id", "created_at");

-- CreateIndex
CREATE INDEX "restock_level_changes_organization_id_idx" ON "public"."restock_level_changes"("organization_id");

-- AddForeignKey
ALTER TABLE "public"."restock_level_changes" ADD CONSTRAINT "restock_level_changes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."restock_level_changes" ADD CONSTRAINT "restock_level_changes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."restock_level_changes" ADD CONSTRAINT "restock_level_changes_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."restock_level_changes" ADD CONSTRAINT "restock_level_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
