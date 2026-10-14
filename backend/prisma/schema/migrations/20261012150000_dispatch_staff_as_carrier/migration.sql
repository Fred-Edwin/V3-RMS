-- Training row 1 (12 Oct 2026): a staff member can be the carrier of a dispatch. Additive only: one nullable column and one unique index.
-- A staff carrier is a hidden PERSON carrier row (user_id set), so no dispatch, delivery or discrepancy reader has to change.
ALTER TABLE "carriers" ADD COLUMN "user_id" TEXT;

ALTER TABLE "carriers" ADD CONSTRAINT "carriers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "carriers_organization_id_user_id_key" ON "carriers"("organization_id", "user_id");
