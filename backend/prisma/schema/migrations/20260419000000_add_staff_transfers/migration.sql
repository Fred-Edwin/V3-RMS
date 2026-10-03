-- CreateTable
CREATE TABLE "staff_transfers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_organization_id" TEXT NOT NULL,
    "to_organization_id" TEXT NOT NULL,
    "notes" TEXT,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorized_by_id" TEXT NOT NULL,

    CONSTRAINT "staff_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_transfers_user_id_idx" ON "staff_transfers"("user_id");

-- CreateIndex
CREATE INDEX "staff_transfers_from_organization_id_idx" ON "staff_transfers"("from_organization_id");

-- CreateIndex
CREATE INDEX "staff_transfers_to_organization_id_idx" ON "staff_transfers"("to_organization_id");

-- AddForeignKey
ALTER TABLE "staff_transfers" ADD CONSTRAINT "staff_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_transfers" ADD CONSTRAINT "staff_transfers_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_transfers" ADD CONSTRAINT "staff_transfers_to_organization_id_fkey" FOREIGN KEY ("to_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_transfers" ADD CONSTRAINT "staff_transfers_authorized_by_id_fkey" FOREIGN KEY ("authorized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
