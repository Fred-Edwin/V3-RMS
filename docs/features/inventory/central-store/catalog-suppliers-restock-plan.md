# Catalog, suppliers and restock levels — build plan

Status: DRAFT for owner approval (written 2 Oct 2026). No code changes until approved.
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

## 5. Order of work and sessions

0. **Design housekeeping (design agent, ~1 hour):** renumber steps 1b/9b/18b/20b/21b, fix the stale "Payment 2" count, re-paste to the master. Not blocking Part A.
1. **Session 1 — Part A + seeding unlock.** Migration, schema, `DATA_MODEL.md`. Seeding can run after merge.
2. **Session 2 — Part B.** Contract first, then services and tests.
3. **Session 3 — Part C, chapters 0 to 3** (catalog, item, restock).
4. **Session 4 — Part C, chapters 4 to 5 + Purchasing changes.**
5. **Session 5 — Part C, chapters 6 to 8, Housekeeping head, integration pass** (real browser, cross-role, Postgres checks).

Each session writes its outcome log in this folder (`session-N-log.md`).

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
