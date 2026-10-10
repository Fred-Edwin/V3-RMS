# stock

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 27 to 29 and 42) · **Code:** rebuilt to the frozen contract (Stock, Counting and Waste rebuild, Back end B). The old stock routes, controller, validators and repository are deleted.

Where stock is and where it went: the Overview, All items, the Stock ledger and the Stock card, plus the ledger door that posts every movement.

## Sub-modules
| Folder | Screens | Endpoints | README |
|---|---|---|---|
| `overview/` | Overview hub | S1 | [overview](overview/README.md) |
| `items/` | All items | S2 | [items](items/README.md) |
| `history/` | Stock ledger, CSV export, Stock card | S3, S4, S5 | [history](history/README.md) |
| `ledger/` | the door (below); not a screen | none | this file |
| `_shared/` | the frozen contract, `stock-repository`, `stock-status`, `stock-kpis`, `stock-sections`, `stock-text`, `stock-view`, `nairobi-time`, `person`, `movement-reference` | none | this file |

## Who can do what
All five endpoints need `stock.read`, held by the Store Manager, System Admin, Accountant, Director and Branch Manager. The **Store Attendant gets 403 on every one** (a refusal, not a stripped body). Money follows `catalog.see_costs` through `withoutStockCosts`. Stock is read only; everything that changes stock goes through the door.

## Endpoints
All under `/api/v1/inventory/stock`, mounted by `stock-hub-routes.ts`.

| # | Method and path | Capability |
|---|---|---|
| S1 | `GET /overview` | `stock.read` |
| S2 | `GET /items` | `stock.read` |
| S3 | `GET /ledger` | `stock.read` |
| S4 | `GET /ledger/export` (registered before S5) | `stock.read` |
| S5 | `GET /ledger/:itemId` | `stock.read` |

## Rules that hold across the folders
- On-hand is always Σ ledger quantity at the Central Store, never stored.
- The ledger values each movement at its own `unit_cost`; All items values stock at the item's **current cost** (latest-price costing). The two can differ.
- Status of an item: `NEGATIVE` (< 0), `OUT` (= 0, a restock level set), `LOW` (0 < on hand < level), else `OK` (`_shared/stock-status.ts`).
- Counting is read only through `counting/_shared/count-reads.ts`, with one flagged exception (the section filter, see `history/README.md`).
- Days are Africa/Nairobi days (`_shared/nairobi-time.ts`).

## The stock ledger door (`ledger/`, added 4 Oct 2026)
**Purpose:** the one way to post a stock movement. Every flow calls `postStockMovement(tx, input)` instead of writing `inventoryTransaction` itself. Other modules import it from `modules/inventory/index.ts`; sub-modules inside Inventory import `stock/ledger/ledger-door` directly.

```ts
postStockMovement(tx, {
  type, locationId, inventoryItemId, quantity, unitCost,
  reason?, userId, links: { <exactly one source link> }, reversesTransactionId?,
}): Promise<InventoryTransaction>
```

**Rules** (`ledger-rules.ts` is the one table; `ledger-door.ts` enforces it):
- **Same transaction as the caller.** `tx` is the caller's client; the door never opens one, so the row rolls back with the caller's work.
- **Append-only.** The door only creates. A correction is a new `ADJUSTMENT` row with `reversesTransactionId`; it must negate the original exactly, match its site, location and item, and a row can be reversed once (checked, and backed by the unique index).
- **A prep row is reversed by a row of its own type with the opposite sign** (7 Oct 2026; no new enum value). The caller passes the same positive quantity with `reversesTransactionId`; the door stores a reversed `PREP_CONSUME` positive and a reversed `PREP_PRODUCE` negative. The original must be a prep row of the same type at the same site, location and item, the stored quantity must be the exact opposite, one reversal per row, and a reversal is never reversed again. A correction or cancel of a Prep run posts these for every row of the run. Not yet built (Prep Slice 3, when the first reversal can happen): Stock's ledger label shows "· reversed" on both rows, and `currentCostSetAt` ignores reversal rows.
- **Sign comes from the type.** The caller passes a positive quantity; `ADJUSTMENT` keeps the caller's sign.
- **`siteId` is derived from the location**, not passed in. Central Store rows must be on the hub site, branch department rows on a non-hub site (D-15).
- **Exactly one source link**, allowed for the type, pointing at a document of that site (a dispatch line may belong to the hub or the receiving branch).
- **`ADJUSTMENT` gets `ADJ-####`** from the ReferenceCounter, in the same transaction.
- **A Branch day entry carries the day number instead** (10 Oct 2026, Block 4): `PostStockMovementInput.reference` is allowed only on an `ADJUSTMENT` linked by `branchDayLineId`; when given the door stores it (`DAY-NYR-0044`) and takes nothing from the `ADJ` counter. Any other use is refused. `ledger-door.test.ts` covers it.
- Errors are `ValidationError` and `ConflictError` with messages a screen can show. `SALE` and `MARKET_RECEIVE` are refused: no flow posts them yet.

| Type | Stored sign | Source link |
|---|---|---|
| `RECEIVE` | + | `goodsReceiptLineId` |
| `PREP_PRODUCE` | + | `prepRecordId` |
| `PREP_CONSUME` | − | `prepRecordId` |
| `WASTE` | − | `wasteLogId` |
| `DISPATCH_IN` | + | `dispatchLineId` |
| `DISPATCH_OUT` | − | `dispatchLineId` |
| `ADJUSTMENT` | as given | one of `countLineId` (the Counting rebuild), `branchDayLineId`, `openingLineId`, `dispatchLineId` |

A **waste row can be reversed** (Waste W4, no PIN): `reversal: 'WASTE'`, the same rule as Prep: the caller sends the same positive quantity with `reversesTransactionId`; the door stores it positive and the original must be a WASTE row at the same site, location and item with the exact opposite quantity (one reversal per row, a reversal is never reversed).

**Guard:** `ledger/ledger-guard.test.ts` fails on any direct ledger write (`create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`, or raw SQL) outside the door. Seed scripts in `src/scripts/` are not checked. The allow-list below only shrinks; lower the count when a rebuild moves the writer (the test also fails on a stale entry).

| File | Direct writes left | Moves with |
|---|---|---|
| `dispatch/dispatch-service.ts` | 2 | Dispatch rebuild |
| `dispatch/discrepancy-service.ts` | 3 | Dispatch rebuild |

Already on the door: **Branch day** (`branch-day/`: the close's usage entries, a correction and an opening recount), **Waste** (`waste/log/` posts, `waste/reverse/` reverses, and the Department Head's `waste/department/`), **Purchasing receiving** (the delivery lines) and **Prep** (`prep/record/` posts runs, `prep/fix/` posts the reversing rows).

**Tests:** `ledger-door.test.ts` (mocked: sign, link, cost, reference, every rejection), `ledger-guard.test.ts`, and `ledger-door.db.test.ts` against a real database (opt-in, `RUN_DB_TESTS=1`, run inside a lane with the lane's `DATABASE_URL`; it rolls back everything it writes). It also tests the trigger: update, delete and source-document delete are refused, and the seed bypass lasts one transaction.

## The database lock (migration `20261004120000_ledger_append_only_trigger`)
A trigger on `inventory_transactions` makes the database itself refuse `UPDATE` and `DELETE` (error `append-only`), so the rule holds even for code or a console session that bypasses the door. `INSERT` is untouched.
- **Source documents are protected too.** The ledger's foreign keys are `ON DELETE SET NULL`, which would rewrite a ledger row if its receipt, waste entry, count line and so on were deleted. The trigger blocks that, so a posted document cannot be deleted from under its ledger rows.
- **Dev-seed bypass.** Fixture scripts reset their data by deleting ledger rows. They call `allowLedgerEditsInThisTransaction(tx)` (`src/scripts/ledger-dev-bypass.ts`), which sets `wendo.allow_ledger_edit` for that one transaction. `ledger-guard.test.ts` fails if that setting appears anywhere outside `src/scripts`.
- **Not blocked:** `TRUNCATE` (nothing uses it; dev resets drop the schema). A superuser can still drop the trigger deliberately.
- **Correcting a mistake on production** is therefore always a new linked row through the door, never an SQL edit.

## Nothing of the old stock code remains
`stock-service.ts` (it held only `departmentLabel`, kept for the Branch day refactor) was deleted with the Branch day rebuild (10 Oct 2026).

## Coupling
Reads Counting only through `counting/_shared/count-reads.ts` (and the flagged section filter). Uses `_shared/{central-store-access,blind-rule,wire}`, `repositories/location-repository`. Prep imports `stock/_shared/stock-repository`; Waste imports the door and `stock/_shared`. The door uses `_shared/reference-counter` for the ADJ number.
