-- CreateTable
CREATE TABLE "order_counters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_counters_organization_id_idx" ON "order_counters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_counters_organization_id_order_date_key" ON "order_counters"("organization_id", "order_date");

-- AddForeignKey
ALTER TABLE "order_counters" ADD CONSTRAINT "order_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
