# stock

**Design:** approved (Paper: *Stock and Counting*, chapters 5–6) · **Code:** built to the old flow, **pending redo**.

Full approved wording: [../counting/DESIGN-NOTES.md](../counting/DESIGN-NOTES.md).

Where stock is and where it went: the stock position, the **Stock ledger** (one row per item with opening, in, sent out, Prep use, waste, adjusted, closing) and the **Stock card** per item.

## Who can do what
- **Store Manager** (and Branch Manager, Department Head within their scope): see values. **Accountant/Director** views wait for their shells.
- **Store Attendant**: no on-hand, no ledger, no values anywhere (server-enforced; waste hint shows no stock).

## Approved behaviour
- Ledger landing: filters date range (quick picks + two-month calendar), section, "Had adjustments", "Had waste", "Negative stock only", search by item or reference (ADJ-3402, CNT-2026-1013). Footer "Showing x of y"; export.
- Stock card: opening-to-closing strip, one row per day with source reference (ADJ, DSP, GRN), "By day" grouping; opening a day shows its entries. Quiet periods collapse.
- The ledger is never edited; a correction is a new linked entry.
- No all-items Journal (dropped 1 Oct 2026); the Audit log covers who/when/why.
- Strips: hub (items tracked, low or out, negative, today's count), all-items (tracked, low/out, negative, on-hand value).

## Built today vs approved
When rebuilt, strip responses with the shared blind rule (`_shared/blind-rule.ts`) instead of an `isAttendant` check: the Attendant sees costs but no stock figures.
Built in Milestone Six (stock hub, all items, ledger, hub KPI strip) to the older design. Gaps to close in the redo: ledger summary view with the opening→closing columns, Stock card, date picker with quick picks, "Had waste"/"Had adjustments" chips, attendant stripped of figures.

## Endpoints
3 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/stock` | STORE_MANAGER |
| GET | `/inventory/stock/summary` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/stock/items/:itemId/ledger` | STORE_MANAGER, MANAGER |

## Code map
`stock-controller.ts`, `stock-repository.ts`, `stock-routes.ts`, `stock-service.ts`, `stock-validators.ts`, `stock.types.ts`. 1 test files beside the code.

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
- Errors are `ValidationError` and `ConflictError` with messages a screen can show. `SALE` and `MARKET_RECEIVE` are refused: no flow posts them yet.

| Type | Stored sign | Source link |
|---|---|---|
| `RECEIVE` | + | `goodsReceiptLineId` |
| `PREP_PRODUCE` | + | `prepRecordId` |
| `PREP_CONSUME` | − | `prepRecordId` |
| `WASTE` | − | `wasteLogId` |
| `DISPATCH_IN` | + | `dispatchLineId` |
| `DISPATCH_OUT` | − | `dispatchLineId` |
| `ADJUSTMENT` | as given | one of `stockCountLineId`, `branchDayLineId`, `openingLineId`, `dispatchLineId` |

**Guard:** `ledger/ledger-guard.test.ts` fails on any direct ledger write (`create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`, or raw SQL) outside the door. Seed scripts in `src/scripts/` are not checked. The allow-list below only shrinks; lower the count when a rebuild moves the writer (the test also fails on a stale entry).

| File | Direct writes left | Moves with |
|---|---|---|
| `counting/count-service.ts` | 1 | Stock & counts rebuild |
| `dispatch/dispatch-service.ts` | 2 | Dispatch rebuild |
| `dispatch/discrepancy-service.ts` | 3 | Dispatch rebuild |
| `branch-day/branch-day-repository.ts` | 1 | Branch day rebuild |

Already on the door: **Waste** (`waste/waste-service.ts`), **Purchasing receiving** (the delivery lines) and **Prep** (`prep/record/` posts runs, `prep/fix/` posts the reversing rows).

**Tests:** `ledger-door.test.ts` (mocked: sign, link, cost, reference, every rejection), `ledger-guard.test.ts`, and `ledger-door.db.test.ts` against a real database (opt-in, `RUN_DB_TESTS=1`, run inside a lane with the lane's `DATABASE_URL`; it rolls back everything it writes). It also tests the trigger: update, delete and source-document delete are refused, and the seed bypass lasts one transaction.

## The database lock (migration `20261004120000_ledger_append_only_trigger`)
A trigger on `inventory_transactions` makes the database itself refuse `UPDATE` and `DELETE` (error `append-only`), so the rule holds even for code or a console session that bypasses the door. `INSERT` is untouched.
- **Source documents are protected too.** The ledger's foreign keys are `ON DELETE SET NULL`, which would rewrite a ledger row if its receipt, waste entry, count line and so on were deleted. The trigger blocks that, so a posted document cannot be deleted from under its ledger rows.
- **Dev-seed bypass.** Fixture scripts reset their data by deleting ledger rows. They call `allowLedgerEditsInThisTransaction(tx)` (`src/scripts/ledger-dev-bypass.ts`), which sets `wendo.allow_ledger_edit` for that one transaction. `ledger-guard.test.ts` fails if that setting appears anywhere outside `src/scripts`.
- **Not blocked:** `TRUNCATE` (nothing uses it; dev resets drop the schema). A superuser can still drop the trigger deliberately.
- **Correcting a mistake on production** is therefore always a new linked row through the door, never an SQL edit.

## Coupling
Uses `_shared/stock-scope`, `catalog/inventory-repository`, `counting/count-service`, `counting/count-calc`. The door uses `purchasing/receiving-repository` for the ADJ reference counter.
