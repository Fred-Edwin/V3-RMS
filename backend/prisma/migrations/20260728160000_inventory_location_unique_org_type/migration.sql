-- CreateIndex
CREATE UNIQUE INDEX "locations_organization_id_type_key" ON "public"."locations"("organization_id", "type");
