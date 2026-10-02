# Suppliers Expansion — Backend Session Handoff

Paste everything below the line into a fresh Claude Code session started in `~/Projects/V3-RMS`.

---

You are a senior backend engineer on Wendo RMS. Your job this session is the **backend** of the Suppliers expansion for the Inventory & Procurement feature: migration, models, repositories, services, controllers, routes, Zod validators, contract doc and tests. The Paper designs and the frontend are handled by other sessions; do not touch `frontend/` or Paper.

## Read first (only the parts named, do not read whole docs)

1. `CLAUDE.md` — non-negotiables (strict TS, no `any`, `authenticate` + `requireRole` on every route, `organizationId` in every repository query, business logic in services only, DB queries in repositories only, Zod on every endpoint, pnpm only, tests required).
2. `docs/features/inventory/suppliers-plan.md` — **the approved plan and your spec.** Sections 1 (decisions), 2 (record), 3 (data model), 4 (API), 7 (tests), 8 (loader) are yours. Sections 5 (screens) is for the design/frontend sessions.
3. `docs/CODING_STANDARDS.md` §4 (backend layout), §5 (validation/errors), §6 (Prisma), §8 (testing).
4. `docs/DATA_MODEL.md` §4.50 (current Supplier) — you will add §4.79+ for the new tables and amend §4.50.
5. `docs/API_CONTRACT.md` §21 (current supplier endpoints, `/inventory/suppliers*`) — you will extend it with a new section for this work, following the existing style.
6. `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` — hub-org scoping (D-15). All supplier data lives on the hub org.

## Where the existing code is

- Module: `backend/src/modules/inventory/` (files are flat: `inventory-routes.ts`, `inventory-controller.ts`, `inventory-service.ts`, `inventory-repository.ts`, `inventory-validators.ts`, `inventory.types.ts`). Supplier code today is in those; suppliers routes are at `inventory-routes.ts` ~line 50. Give the expanded supplier work its own files (`supplier-*.ts`) in the same folder rather than growing the inventory files, and wire routes in the same router.
- Schema: `backend/prisma/schema.prisma` — `model Supplier`, `model SupplierPaymentTerms` enum, `model ReferenceCounter` (used through `nextReference(tx, orgId, prefix, pad)` in `receiving-repository.ts` for `GRN-####`).
- Receiving price alert: `backend/src/modules/inventory/receiving-service.ts` (~lines 270–370: compares a line price with the item's last price, writes `priceAlertPct`/`priceAlertPrevPrice`). Signing a receipt is where supplier prices must be updated.
- Existing tests to keep passing and update where shapes change: `inventory-service.test.ts`, `inventory-contract.test.ts`, `receiving-service.test.ts`, `receiving-contract.test.ts`.
- Attendant-blindness contract tests (e.g. `count-contract.test.ts`) show how this codebase scans serialized responses for forbidden keys; copy that pattern for the supplier attendant list.

## What to build (summary; the plan is authoritative)

1. **Migration** (additive; see plan §3): extend `Supplier`; add `SupplierContact`, `SupplierPaymentMethod`, `SupplierItem`, `SupplierDocument`, `SupplierAuditLog`; new enums (status, type, payment-method type, document type). Includes a raw-SQL partial unique index for one primary contact per supplier and one default payment method per supplier, and unique `(organizationId, code)`. Backfill existing rows per plan §3 (code in creation order using `ReferenceCounter` prefix `SUPPLIER`, primary contact from old contact fields, `location` → `address`). Generate with `npx prisma migrate dev --name suppliers_expansion` locally and commit the migration. Never run migrate on production.
2. **Supplier CRUD, contacts, payment methods, catalog (supplier items), status, quick-add, summary** per plan §4, with the role matrix there. Attendant gets a stripped list (code, name, type, primary phone) and quick-add; payment methods, KRA PIN, credit limit and documents never reach them.
3. **Code generation** `SUPPLIER-0001` inside the create transaction via `nextReference`, pad 4. Never reuse codes.
4. **Duplicate check** on normalized name + phone (409 unless `confirmDuplicate`).
5. **Archive rule**: refuse (409) while the supplier has an unpaid supplier invoice; On hold / Archived suppliers excluded from receiving pickers.
6. **Price sync**: when a goods receipt is signed, upsert `SupplierItem.lastPrice/lastPriceAt` per line in the same transaction; price alert compares against the supplier's own last price, falling back to the item's current cost. Update `receiving-service` and its tests carefully; do not change existing alert behaviour for items with no supplier price.
7. **Preferred supplier**: keep `InventoryItem.preferredSupplierId` in sync with `SupplierItem.isPreferred` (one preferred per item). Do not remove the old column.
8. **Audit log** rows for payment-method create/update/delete/default change and status changes (who, when, before/after with account numbers masked in the log).
9. **Documents**: build the endpoints and the service against a small storage interface (`putObject`, `getSignedUrl`, `deleteObject`) with an in-memory/local fake used in tests and when R2 env vars are absent. The real Cloudflare R2 implementation (S3-compatible client) goes behind the same interface, configured through new optional env vars added to `backend/src/config/env.ts` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`), documented in `.env.example`. **The owner is creating the bucket; do not block on it.** Uploads: images and PDFs only, 10 MB max, type checked from file content (magic bytes), stored under `org/<orgId>/suppliers/<supplierId>/<uuid>`; downloads return a short-lived signed URL only after the same role and org check as the supplier. Use the existing `multer` dependency (memory storage, size limit).
10. **Real-data loader** is a later step; do not write it now.

## Rules that are easy to get wrong here

- Every repository query includes `organizationId`; sub-resources (contacts, methods, items, documents) are always reached through a supplier that is verified to belong to the caller's org.
- Business logic and role-dependent field stripping live in the service; the controller only parses (Zod), calls, and responds.
- A `prisma.$transaction` in a service is allowed; plain reads/writes are not.
- Money/quantity fields are `Decimal` and serialized as strings, like the rest of the inventory contract.
- Never log or return full bank account numbers in error messages, audit rows or list responses (detail responses to permitted roles may return them; lists must not).
- Response shapes are Zod schemas and are frozen by contract tests, as in other milestones.
- Existing production has 0 suppliers, but local dev DBs have some: the migration must run cleanly on a DB that has rows and on an empty one.

## Process

- Work on a new branch `feat/suppliers-backend` from up-to-date `main`. Commit only when the owner asks; never push or open a PR unless asked.
- Local dev only. Never touch production. Use the local Postgres MCP (`wendo_rms` on localhost:5433) to verify the migration and backfill on a DB with pre-existing suppliers.
- Todo list kept live as you go.
- Definition of done: `cd backend && pnpm build && pnpm test` green (also run the frontend build once at the end to confirm the changed supplier response does not break it: `cd frontend && pnpm build`; if it does, list the frontend files that need updating in your summary rather than fixing them, since the frontend session owns them); `docs/DATA_MODEL.md` and `docs/API_CONTRACT.md` updated; the plan's §7 tests all present.

## Backward compatibility with the current frontend

The existing Suppliers screens read `contactName`, `phone`, `email`, `location`, `defaultPaymentTerms`, `paymentDays`, `category`, `retiredAt`. Keep those keys in the supplier read model for now (derive `contactName`/`phone`/`email` from the primary contact and `location` from `address`) and add the new fields alongside, so the current UI keeps working until the frontend session replaces it. Mark the legacy keys as deprecated in the contract doc.

## Deliverables at the end

1. Migration file and a short note on how you verified it on a DB with existing suppliers and on an empty one.
2. The list of new endpoints with roles, matching plan §4 (call out any deviation and why).
3. Test summary and the `pnpm build` / `pnpm test` results.
4. Anything in the plan that turned out to be wrong or ambiguous, and what you decided (do not silently deviate: stop and ask if a change affects the API shape the design or frontend sessions depend on).
5. Frontend files that need updating because of contract changes (do not edit them).
