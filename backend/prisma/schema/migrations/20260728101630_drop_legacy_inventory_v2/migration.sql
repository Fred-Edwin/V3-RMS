-- Drops the orphaned remains of the reverted V2.1 inventory build (commit
-- 32580d5, merged + applied to production 2026-03, then reverted by 9506162,
-- which removed the migration files from the repo but left the schema live in
-- the production database). None of these tables or types are referenced by
-- current code; their contents are stale test-era data from March 2026,
-- preserved in the nightly production dumps. Without this cleanup, the Phase 1
-- inventory migration (20260728101631) fails on production: its
-- CREATE TABLE "suppliers" collides with the legacy table, and its
-- ALTER TYPE ADD VALUE 'STORE_MANAGER' collides with the legacy enum label
-- (Phase 1's enum additions are IF NOT EXISTS for the same reason).
-- Ordered child-first; IF EXISTS throughout so this is a no-op on fresh
-- databases that never had V2.1.

DROP TABLE IF EXISTS "public"."stocktake_entries" CASCADE;
DROP TABLE IF EXISTS "public"."stocktake_sessions" CASCADE;
DROP TABLE IF EXISTS "public"."consumable_stock" CASCADE;
DROP TABLE IF EXISTS "public"."consumables" CASCADE;
DROP TABLE IF EXISTS "public"."branch_stock" CASCADE;
DROP TABLE IF EXISTS "public"."requisition_items" CASCADE;
DROP TABLE IF EXISTS "public"."requisitions" CASCADE;
DROP TABLE IF EXISTS "public"."supplier_deliveries" CASCADE;
DROP TABLE IF EXISTS "public"."ingredient_conversions" CASCADE;
DROP TABLE IF EXISTS "public"."raw_ingredients" CASCADE;
DROP TABLE IF EXISTS "public"."suppliers" CASCADE;

DROP TYPE IF EXISTS "public"."RequisitionStatus";
DROP TYPE IF EXISTS "public"."StocktakeStation";

-- NOTE (patched 2026-08-21, Phase 2 Session 1): this migration originally
-- ended with `DELETE FROM "_prisma_migrations" WHERE "migration_name" =
-- '20260322072523_add_inventory_v2'` to tidy the orphaned V2.1 history row
-- out of the ledger. That statement is removed here: a migration writing to
-- Prisma's own `_prisma_migrations` bookkeeping table breaks `prisma migrate
-- dev`'s shadow-database replay (P1014, "the underlying table for model
-- `_prisma_migrations` does not exist") on ANY fresh database, including the
-- shadow DB every `migrate dev` run creates — this was blocking the migrate
-- workflow entirely, for every future migration, not just this one. It was
-- cosmetic (the STORE_MANAGER enum label it referenced can't be un-added
-- anyway — Postgres has no DROP VALUE — which is why 20260728101631 already
-- uses ADD VALUE IF NOT EXISTS and never depended on this row being gone).
-- The real production/local DB already had this DELETE applied when this
-- migration first ran; removing it from the file only affects future shadow-
-- DB and fresh-database replays, not the already-migrated real database.
