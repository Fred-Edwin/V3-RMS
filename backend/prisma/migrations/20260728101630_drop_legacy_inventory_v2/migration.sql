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

-- Remove the orphaned migration-history row so the ledger of applied
-- migrations matches the repo again. (The STORE_MANAGER enum label the V2.1
-- migration added cannot be removed — Postgres has no DROP VALUE — which is
-- why 20260728101631 adds it with IF NOT EXISTS instead.)
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260322072523_add_inventory_v2';
