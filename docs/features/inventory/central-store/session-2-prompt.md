You are building Session 2 of the Central Store Catalog, suppliers and restock levels flow: Part B items B1 to B8 (services and contracts, backend only). B9 to B13 are Session 3. No frontend code. No new migration unless you stop and ask first.

Read first (only these parts)
CLAUDE.md (non-negotiables).
docs/features/inventory/central-store/catalog-suppliers-restock-plan.md §0 (all 11 assumed answers STAND, confirmed by the owner), §3 rows B1 to B8, §6.
docs/features/inventory/central-store/session-1-log.md (what the migration changed and why callers match on supplier + item for now).
docs/DATA_MODEL.md: SupplierItem, SupplierPayMethod, SupplierPayment sections.
docs/API_CONTRACT.md: the supplier, receiving and payment endpoints you will change.
backend/src/modules/inventory/supplier-*.ts, receiving-service.ts, receiving-validators.ts, and their tests. Read before changing any caller.

Step 0 — start state
Session 1 (migration catalog_cheque_and_pack_lines) is merged and deployed by the pipeline. git checkout main && git pull, confirm the migration is applied locally (npx prisma migrate status), then branch feat/central-store-catalog-services from main. Untracked owner files: do not touch or commit them.

Order of work
1. Contract first: update docs/API_CONTRACT.md for every endpoint/response change below, before any code.
2. Pack lines (B3, B4, B5). Replace the temporary "oldest line for (supplier, item)" lookup in supplier-repository.ts (findLineId) with real line-key matching on (supplier, item, buyUnit, packSize), treating NULL unit/pack as the DB index does (COALESCE to '' / 0).
   B3: create/update on the line key; a clash returns 409 with a message naming the existing line. Add-one and Add-several both honour it.
   B4: receipt-sign price update matches on the full line key. No match: write NO price, mark the receipt line "Pack not on file", surface it for the supplier Catalog tab. Test: Samrat sugar 50 kg bag vs 2 kg packet.
   B5: optional supplierItemName/supplierItemCode on add-who-sells-it and add-one; returned on supplier Catalog tab, item page, purchase file lines. Bulk "Add several" unchanged.
3. Cheque (B1, B2). B1: pay methods accept CHEQUE (payable to -> registeredName, bank -> bankName, optional note; reason required as today; audit line "cheque method added"; notify Accountant via the existing path). B2: payments accept CHEQUE; reference is the cheque number, required for cheque; a duplicate number for the same supplier returns a warning flag, not an error; payment advice and closed purchase file print "Cheque" with the number. Then widen the input schema and remove the read-only supplierPaymentMethodReadSchema workaround from Session 1 (one enum again), and update the frontend type only if it breaks the frontend build (no UI work).
4. B6 search: q also matches supplier code (exact) and supplier item name (partial, case-insensitive, uses the new indexes). Response includes matchedOn: { supplier, field, value }.
5. B7 supplier-facing documents: LPO print data and WhatsApp body use supplier name + code first, "Our item: ..." second, falling back to ours. Internal endpoints return both names, ours primary. Phone "Check the goods" keeps our name only.
6. B8 preferred confirm: return preferredNeedsConfirm; setting preferred or confirming clears it; logged.

Rules
TypeScript strict, no any. pnpm only. POSIX shell. Business logic in services, queries in repositories (a $transaction in a service is fine), organizationId in every repository query, a Zod schema per endpoint, authenticate + requireRole on every route. A feature without tests is not complete: every B item above gets tests.
Use a todo list and keep it updated.
Do not decide open questions. If the plan conflicts with the code, stop and ask the owner with a recommendation.
Do not run migrate dev or reset against production. Do not push. Do not merge. Deployments are automated by CI/CD after merge to main; the owner does not run server commands.
If a change seems to need a schema change, stop and ask first.

Gate before reporting done
cd backend && pnpm build && pnpm test pass (the whole working tree compiles, including the owner's untracked seed script).
Postgres MCP checks, with output pasted into the log: a cheque payment row exists with its number; the duplicate-number warning case; two pack lines for one supplier and item exist; a receipt with a non-matching pack wrote no price and was flagged; the search by supplier code returns the right item.
git diff --stat shows only inventory module code and tests, docs/API_CONTRACT.md, docs/DATA_MODEL.md if it changed, and the log.

Deliverables
Committed work on the branch, with the commit message ending in the attribution line from the session's system reminder.
docs/features/inventory/central-store/session-2-log.md: what changed, commands run, Postgres outputs, every file touched, anything surprising.
A short message to the owner: what merged branch to review, and that seeding is unblocked (it already is after Session 1) with any seeding-relevant behaviour changes.
Stop when done. Do not start B9 to B13.
