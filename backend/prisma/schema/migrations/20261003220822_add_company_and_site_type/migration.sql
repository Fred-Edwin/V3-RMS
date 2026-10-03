/*
  Company and Site type foundation (additive; nothing is renamed or dropped).

  - New `companies` table. One row, "Wendo Coffee Bistro", owns every existing site.
  - `organizations.company_id`: added nullable, backfilled to that row, then made required.
  - `organizations.type` (SiteType): backfilled from the existing "isHub" flag.
    "isHub" and its one-Central-Store unique index are left exactly as they are.

  Safe on a database that already has data, and safe to re-run its statements.
*/

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "public"."SiteType" AS ENUM ('BRANCH', 'CENTRAL_STORE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- AlterTable: columns first, company_id nullable until the backfill below
ALTER TABLE "public"."organizations" ADD COLUMN IF NOT EXISTS "company_id" TEXT,
ADD COLUMN IF NOT EXISTS "type" "public"."SiteType" NOT NULL DEFAULT 'BRANCH';

-- Backfill: the one company, and every site belongs to it
INSERT INTO "public"."companies" ("id", "name", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'Wendo Coffee Bistro', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "public"."companies");

UPDATE "public"."organizations"
SET "company_id" = (SELECT "id" FROM "public"."companies" ORDER BY "created_at", "id" LIMIT 1)
WHERE "company_id" IS NULL;

UPDATE "public"."organizations"
SET "type" = 'CENTRAL_STORE'
WHERE "isHub" = true AND "type" <> 'CENTRAL_STORE';

-- Now that every row has a company, make it required
ALTER TABLE "public"."organizations" ALTER COLUMN "company_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "organizations_company_id_idx" ON "public"."organizations"("company_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
