-- The schema-level @@unique([organizationId, type]) on locations only enforces
-- one CENTRAL_STORE per organization — i.e. it would still allow one per
-- branch org. The Central Store is company-wide by design (feature plan D-1,
-- scoping design doc D-15): exactly one row may exist across ALL
-- organizations, owned by the hub org. Prisma's DSL cannot express a partial
-- unique index, so it lives here as raw SQL (mirrored by a comment on the
-- Location model).
CREATE UNIQUE INDEX "locations_single_central_store"
  ON "locations" ("type")
  WHERE "type" = 'CENTRAL_STORE';
