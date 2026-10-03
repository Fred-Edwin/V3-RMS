# Catalog, suppliers and restock levels — build plan

Status: APPROVED. Part A (Session 1) and Part B (Sessions 2 and 3, PR #54) are built; Part C (frontend) is planned as four sessions A to D (§5). Updated 3 Oct 2026.
Design: approved. Master = Approved designs file, page "Inventory . Catalog, suppliers and restock levels" (+ Purchasing page for cheque and supplier-name changes). Decisions: `../catalog-suppliers-restock-walkthrough-decisions.md`.

## 0. Assumptions to confirm

I asked 11 questions on 1 Oct 2026. The owner said "go ahead", so my recommendations are treated as accepted. Override any of them before approval:

| # | Assumed answer |
|---|---|
| 1 | Phone "Check the goods" keeps our item name only. |
| 2 | Adding a payment method needs a reason, is logged, tells the Accountant. No PIN. |
| 3 | Cheque number is required when paying by cheque. A duplicate number for the same supplier warns but does not block. |
| 4 | Supplier line key is supplier + item + buy unit + pack size. A receipt whose pack matches no line never guesses: it flags "Pack not on file". |
| 5 | A line with no supplier name falls back to our name on the LPO and WhatsApp message. |
| 6 | Search: exact match on supplier codes, partial match on names. |
| 7 | A Housekeeping department head role is added, reusing chapter 7's phone screens. |
| 8 | Step numbers get final numbers (1b, 9b, 18b become 2, 11, 21 …) in a separate design pass before the frontend starts. |
| 9 | Catalog master already pasted (2 Oct). Renumbering is done in the working file and re-pasted. |
| 10 | Closed purchase file, supplier statement and Purchasing audit log are not redrawn. Cheque shows through the generic "method · reference" line. The tab count comes from data. |
| 11 | "Needs setup" KPI and filter stay as drawn; sort oldest first as a build detail. |

## 1. What already exists (verified in `backend/prisma/schema.prisma`)

- `SupplierItem` already has `supplierItemName`, `supplierItemCode`, `buyUnit`, `packSize`, `lastPrice`, `isPreferred`. Unique today: `(supplierId, inventoryItemId)`.
- `DepartmentTag` already has `HOUSEKEEPING`.
- `InventoryItemType` is `STOCKED | RAW_INGREDIENT | PREPPED`, matching the owner's final labels. Only the labels in the UI change.
- `SupplierPayMethodType`: `BANK_TRANSFER, MPESA_PAYBILL, MPESA_TILL, MPESA_SEND_MONEY, CASH`. No cheque.
- `SupplierPaymentMethod` (payments): `BANK, CASH, MPESA`. No cheque.
- The working tree has uncommitted supplier work (`20260930120000_suppliers_expansion` and `supplier-*.ts`). The new migration must sort after it, and the agent must read that code first, not rewrite it.

## 2. Part A — migrations only (seeding can start after this)

One migration, generated with `npx prisma migrate dev --name catalog_cheque_and_pack_lines` and committed. Never `migrate dev` on production.

1. `ALTER TYPE "SupplierPayMethodType" ADD VALUE 'CHEQUE'`.
2. `ALTER TYPE "SupplierPaymentMethod" ADD VALUE 'CHEQUE'`. (New enum values cannot be used in the same transaction; no data is written here.)
3. `supplier_pay_methods`: add `note TEXT NULL` (cheque note). Cheque uses existing columns: payable to → `registeredName`, bank → `bankName`.
4. `supplier_items`: drop `@@unique([supplierId, inventoryItemId])`. Replace it with a unique index in raw SQL: `(supplier_id, inventory_item_id, COALESCE(buy_unit,''), COALESCE(pack_size,0))`, because Postgres treats NULLs as distinct. Keep an index on `(organization_id, inventory_item_id)` (exists) and add one on `(organization_id, supplier_item_code)` and `(organization_id, lower(supplier_item_name))` for search.
5. `supplier_items`: add `preferred_needs_confirm BOOLEAN NOT NULL DEFAULT false` (the "Preferred · confirm" flag seeding sets).
6. Prisma schema: remove the compound `@@unique` (it cannot express the COALESCE index; note it in a comment). Every `findUnique`/`upsert` that used `supplierId_inventoryItemId` in `backend/src` must change — grep for it. This is part B work but must compile before merge.
7. Update `docs/DATA_MODEL.md`.

Gate for Part A: `pnpm build`, `pnpm test`, migration applied to a fresh local DB and to a copy with existing rows, Postgres MCP query confirming the two enum values and the new index.

## 3. Part B — services and contracts (`backend/src/modules/inventory/`)

Rules: service logic in services, queries in repositories, Zod schema per endpoint, `organizationId` on every query, tests for each item.

| # | Change | Notes |
|---|---|---|
| B1 | Pay methods accept `CHEQUE` | validator: payable to required, bank required, note optional. Reason required (as today for payment details). Audit log line "cheque method added". Notify Accountant (existing path). |
| B2 | Payments accept `CHEQUE` | reference = cheque number, required for cheque. Warn (response flag, not error) on duplicate number for the supplier. Payment advice and closed file print "Cheque" with the number. |
| B3 | Several pack lines | create/update on the new key; clear 409 message naming the existing line. Add-one and Add-several both honour it. |
| B4 | Receiving price update matches on pack | match on `(supplier, item, buyUnit, packSize)`. No match → do not update any price; mark the receipt line "Pack not on file" and surface it on the supplier Catalog tab. Test: Samrat sugar 50 kg bag vs 2 kg packet. |
| B5 | Their name and code | optional fields on add-who-sells-it and add-one; returned on supplier Catalog tab, item page, purchase file lines. Bulk "Add several items" unchanged. |
| B6 | Catalog search | `q` also matches supplier code (exact) and supplier item name (partial). Response includes `matchedOn: { supplier, field, value }` so the list can show "Matched Samrat code 190035". |
| B7 | Supplier-facing documents | LPO print data and WhatsApp message body use supplier name + code first, ours second ("Our item: …"); fall back to ours. Internal endpoints return both names, ours primary. |
| B8 | Preferred confirm | `preferredNeedsConfirm` returned; setting preferred or confirming clears it; logged. |
| B9 | Housekeeping | accept `HOUSEKEEPING` in used-by and filters; Housekeeping department head role (check how Kitchen/Service heads are modelled in `User.role` or department tag; mirror it). |
| B10 | Store Manager sets any department's restock levels | endpoint takes `scope = CENTRAL_STORE | <DepartmentTag>`; each change logged with who and for whom; department heads still limited to their own. |
| B11 | KPI strips | counts for Catalog (items tracked, needs setup, low or out, added this week), Restock levels (out, low, no level, suggestions differ), Suppliers (active, on hold, profile not finished, owed), supplier Catalog tab (items they sell, price alerts, last receipt, spend 90 days). One endpoint per screen or a `summary` block on the list response; reuse existing queries. |
| B12 | Attendant item creation | only `STOCKED` and `RAW_INGREDIENT` accepted; `PREPPED` rejected with 403/422. |
| B13 | Review-a-change summary | when no stock, receipts or open orders exist, the summary returns those counts as zero so the UI can show the no-history wording (step "9b"). |

Contract: update `docs/API_CONTRACT.md` for every endpoint above before writing the code. Gate: `pnpm build && pnpm test`, plus Postgres MCP checks of each rule (cheque payment row, duplicate warning, two-pack unique key, no price write on pack mismatch).

## 4. Part C — frontend (`frontend/features/inventory/` and `components/ui2/`)

Build order follows the approved flow. Each screen is built, then checked with `visual-parity-protocol.md` before the next. Find Paper artboards by name in the master page (ids change on paste).

| Chapter | Screens (artboard names as captioned) | Tier |
|---|---|---|
| 0 | Type labels: Stocked / Raw ingredient (phone: "Raw") / Prepped everywhere; one shared label map | B |
| 1 | The catalog, with Needs setup (KPI strip, chips, search); Fill in the item drawer (3 types with explainers, Housekeeping chip); similar-item warning; Item added; **1b** Search finds it by their code | A, A, B, B, B |
| 2 | Item page (nobody sells yet; with history, their name and code, "To confirm"); Add who sells it (their name/code); Edit item; Review a risky change + **9b** no-history; Manage categories | A, A, A, A/B, A |
| 3 | All levels with suggestions (scope switch, KPI strip); Review before saving; Level history | A, A, A |
| 4 | Suppliers list (KPI strip); New supplier drawer (category optional, no map link); Finish the profile | A, A, A |
| 5 | Supplier page tabs: Overview, Payment (cheque row), Catalog (their names/codes, confirm marker, KPI strip), Contacts, Documents (filters); Change payment details; **18b** Add a payment method; Add several items | A each; 18b A |
| 6 | Attendant phone: Not found, Name it (Stocked / Raw ingredient only, Prepped note), Back to the delivery | A |
| 7 | Department head phone: levels, check, saved (+ Housekeeping head) | A |
| 8 | Retire / restore dialogs and drawer, duplicate-supplier warning, archive blocked, Audit log; reference tables are copy only | A/B |
| Purchasing | Record payment (Cheque, "Cheque number"), payment advice for cheque, LPO and WhatsApp with supplier names, internal screens with ours first | B |

Rules: no offline states; one states kit (loading / empty / error) with per-screen copy; attendants never see costs or stock; hooks stable per CLAUDE.md; the interaction baseline in `../milestone-6-plan.md` §4.2 applies to every screen; load `emil-design-eng`, `building-components`, `vercel-composition-patterns`, `web-design-guidelines`, `run-frontend-browser`.

### Retiring the old screens (part of Part C)

Approved Paper designs are the only target. Each old screen is **replaced in place when its new version passes the parity check**, never deleted up front, so the app keeps working in between. Each Part C session ends by deleting what it replaced:

- Old screens, hooks, services and mock data in `frontend/features/inventory/` for the pages rebuilt that session (list in the supplier backend summary: `supplier-form-screen`, `supplier-detail-screen`, `suppliers-ap-screen`, `use-new-purchase-form`, the API and mock services, `types/index.ts`).
- Old routes and nav links that point at them.
- After the last Part C session: remove the deprecated supplier keys (`contactName`, `phone`, `email`, `location`, `retiredAt`) and the legacy `DELETE /suppliers/:id` and `POST …/restore` aliases from the API, and update `API_CONTRACT.md`.
- Old Paper pages are not deleted; they stay labelled "SUPERSEDED".

## 5. Order of work and sessions

Sessions are numbered in the order they run. Part B took two sessions (2 and 3), and Part C takes four (4 to 7).

| # | What | Status |
|---|---|---|
| 0 | **Design housekeeping** (design agent, about 1 hour): renumber steps 1b, 9b, 18b, 20b, 21b; fix the stale "Payment 2" count; re-paste to the master. Blocks Session 4 only for the renumbered captions, so Session 4 may start first and read artboards by name. | open |
| 1 | Part A: migration, schema, `DATA_MODEL.md`, seeding unlock. | done (PRs #50, #51) |
| 2 | Part B, B1 to B8: cheque, pack lines, receipt price by pack, their names and codes, search, supplier documents, preferred confirm. | done (PR #52, `session-2-log.md`) |
| 3 | Part B, B9 to B13: Housekeeping, any-department restock levels with a change log, KPI strips, attendant item creation, change review. Contract = `API_CONTRACT.md` §29. | done (PR #54, `session-3-log.md`) |
| 4 | **Part C, Session A: catalog and items.** Chapter 0 (type labels), chapter 1 (catalog, Needs setup, add-item drawer, similar-item warning, 1b search match), chapter 2 (item page 3 states, add who sells it, edit item, review a risky change incl. no-history, manage categories). | done (PRs #55, #56, #57; `session-4-log.md`, `session-4b-log.md`, `session-4c-log.md`) |
| 5 | **Part C, Session B: restock levels.** Chapter 3: all levels with scope switch (Central Store / branch department) and strip, suggestions, review before saving, level history with Put back. First task: a small backend read endpoint for `restock_level_changes` plus the Put-back write (contract first, then code and tests). | done (PR #59, plus the backend batch in #60: item type and per-item days of cover; `session-5-log.md`). The history and put-back endpoints came with Session 4b. |
| 6 | **Part C, Session C: suppliers and Purchasing** (prompt: `session-6-prompt.md`). Chapters 4 and 5 (list with strip, new supplier, finish the profile, five tabs, payment details, add payment method with cheque, add several items) and the Purchasing changes (record payment with cheque, payment advice, LPO and WhatsApp with supplier names, ours-first internal screens). Split into suppliers / Purchasing if it runs long. | done: suppliers and the small Purchasing changes (cheque in Record payment, their names on receipt lines); the LPO, WhatsApp and payment advice wait for the Purchasing rebuild. Three small backend changes were approved (§30.9 to §30.11). `session-6-log.md` |
| 7 | **Part C, Session D: phones, cleanup, integration.** Chapters 6 to 8 (attendant phone, department head phone incl. Housekeeping head, retire / restore dialogs, duplicate-supplier warning, archive blocked, audit log), then the real-browser cross-role pass with Postgres checks, then delete every old screen and the deprecated supplier keys and aliases (§4). | planned |

After Session 7: module restructure (`../module-restructure-move-map.md`), production deploy and demo.

Each session writes `session-N-log.md` in this folder, and each Part C session ends by deleting the old screens it replaced.

### Decisions fixed by the owner (3 Oct 2026)
These are final; frontend sessions must not reopen them.

- Restock scope = `scope` + `branchId` (a department alone is ambiguous across branches).
- Suggested level = average daily use over the last 30 days x 15 days of cover for every item, needs 14 days of use first, "differs" at more than 20 %. Per-item days of cover is a later change.
- Needs setup = usage unit equals buy unit, no pack size, no conversion factor.
- Profile checklist = name, type, phone, address, contact person, payment details, KRA PIN (7).
- Attendant may set name, type, units, conversion and pack only; no money fields anywhere in their responses.
- Supplier Catalog tab price alerts = last 90 days.
Full definitions: `API_CONTRACT.md` §29 and `session-3-log.md`.

## 6. Risks

- Dropping the old unique key breaks every caller that used it; grep first, fix in the same PR.
- New enum values cannot be used in the migration that adds them; seeding must run after it is applied.
- Seeded items have placeholder units, so "Needs setup" starts large and the unit-change review (step 9b) is the common path.
- Uncommitted supplier work in the tree: do not start Part A on a dirty branch; commit or stash it with the owner first.
- Paper ids change on copy; agents find artboards by name.

## 7. Open items for the owner

- Confirm or override the 11 assumed answers in §0.
- Phone "Check the goods" showing supplier names was left out; confirm that stays out.
- Who commits the pending supplier work before Session 1 starts.
