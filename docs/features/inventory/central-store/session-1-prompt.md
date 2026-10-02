# Session 1 prompt — Catalog, suppliers and restock levels: Part A (migration)

Paste everything below the line into a fresh Claude Code session started in `~/Projects/V3-RMS`.

---

You are building **Session 1 of the Central Store Catalog, suppliers and restock levels flow**: the database migration only. Seeding of real supplier data starts right after this session merges, so it must be small, correct and safe. **Do not write services, controllers, validators or frontend code.** Part B and C are later sessions.

## Read first (only these parts)

1. `CLAUDE.md` (non-negotiables, migration workflow: edit schema → `npx prisma migrate dev --name …` locally → commit the generated file → never `migrate dev` on production).
2. `docs/features/inventory/central-store/catalog-suppliers-restock-plan.md` §0 (assumed answers), §1 (what exists), §2 (Part A), §6 (risks).
3. `docs/DATA_MODEL.md`: the SupplierItem, SupplierPayMethod and SupplierPayment sections only.
4. `backend/prisma/schema.prisma`: enums `SupplierPayMethodType`, `SupplierPaymentMethod`; models `SupplierPayMethod`, `SupplierItem`.
5. `backend/prisma/migrations/20260930120000_suppliers_expansion/` to see how the last migration wrote raw SQL, partial indexes and enums.

## Step 0 — start state

The supplier backend and the M6 integration fixes are merged to `main` (PR #47, deployed 2 Oct 2026, migration `20260930120000_suppliers_expansion` applied by the pipeline). Run `git checkout main && git pull`, confirm `git status` is clean apart from untracked owner files (`docs/Item Catalog/`, `backend/src/scripts/seed-catalog-from-staging.ts` — do not touch or commit them), then branch `feat/central-store-catalog-migration` from main. Read the supplier code (`backend/src/modules/inventory/supplier-*.ts`, `receiving-service.ts`) before changing any caller.

## What to build

One migration named `catalog_cheque_and_pack_lines`, generated with `npx prisma migrate dev --name catalog_cheque_and_pack_lines` on the local DB (docker compose up postgres redis first), then hand-edited where Prisma cannot express the SQL:

1. `ALTER TYPE "SupplierPayMethodType" ADD VALUE 'CHEQUE'`.
2. `ALTER TYPE "SupplierPaymentMethod" ADD VALUE 'CHEQUE'`. Enum values added here must not be used in the same migration.
3. `supplier_pay_methods.note TEXT NULL`. Cheque reuses `registeredName` (payable to) and `bankName`.
4. `supplier_items`: remove the unique on `(supplier_id, inventory_item_id)`. Add a unique index in raw SQL on `(supplier_id, inventory_item_id, COALESCE(buy_unit,''), COALESCE(pack_size,0))` so NULL units cannot create duplicates. Add search indexes on `(organization_id, supplier_item_code)` and `(organization_id, lower(supplier_item_name))`.
5. `supplier_items.preferred_needs_confirm BOOLEAN NOT NULL DEFAULT false`.
6. Update `schema.prisma`: remove the compound `@@unique`, add the new fields, add a comment pointing to the raw-SQL index. The Prisma client no longer has the `supplierId_inventoryItemId` compound key, so grep `backend/src` and `backend/tests` for `supplierId_inventoryItemId` and fix every caller with the smallest change that keeps behaviour the same (for example `findFirst` on the four columns). Do not add new behaviour.
7. Update `docs/DATA_MODEL.md` (new enum values, the note column, the new key and its COALESCE rule, the confirm flag).

## Safety rules

- Check the existing data first with the Postgres MCP: does any row already have two `supplier_items` with the same `(supplier, item)`? (It cannot, today.) After the migration, confirm the new index rejects an exact duplicate and allows two different pack sizes.
- Test the migration twice: on a fresh DB (`docker compose down -v` then up) and on a copy of current local data. Both must apply cleanly.
- Never run `migrate dev` or `migrate reset` against production. Do not push. Do not merge. The owner applies it on the server with `migrate deploy` after the PR.

## Gate before reporting done

1. `cd backend && pnpm build && pnpm test` pass (all existing tests; fix only the compound-key callers).
2. Postgres MCP checks, with the output pasted into the log:
   - both enums list `CHEQUE`;
   - `supplier_pay_methods.note` exists;
   - inserting two identical `supplier_items` rows (same supplier, item, unit, pack) fails; two rows with different pack sizes succeed; two rows with NULL unit and pack and the same supplier and item fail;
   - the search indexes exist.
3. `git diff --stat` shows only: schema, the new migration folder, the compound-key callers, `docs/DATA_MODEL.md`, and the log below.
4. A short test added for the new key rule if the repo's test setup can reach the database; otherwise say so.

## Deliverables

- The committed migration and schema.
- `docs/features/inventory/central-store/session-1-log.md`: what changed, commands run, the Postgres outputs, every file touched, anything surprising.
- A short message to the owner: what to run on the server (`docker compose exec api npx prisma migrate deploy`), and that seeding can start once the migration is applied.

## Rules

- TypeScript strict, no `any`. pnpm only. POSIX shell.
- Use a todo list and keep it updated.
- Do not decide open questions. If anything in the plan conflicts with the code, stop and ask the owner with a recommendation.
- Commit message ends with the attribution line from the session's system reminder. Do not push unless the owner asks.
- Stop when done. Do not start Part B.
