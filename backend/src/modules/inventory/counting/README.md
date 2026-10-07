# counting

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*) · **Code:** back end built (Counting back end A of the Stock, Counting and Waste rebuild); front end builds against the frozen contract. Spec: `docs/features/inventory/stock-count-waste-contract.md` (frozen shapes: `_shared/counting-contract.ts`).

Central Store counting: many counts a day, one **open** count per person, a section (an item) in one open count at a time. The Attendant counts blind and signs with their own PIN (SUBMITTED); the Store Manager reviews and approves with hers (APPROVED); when the Manager counts herself, **Sign applies every non-zero line** and flags the outside-range lines to the Director. Spot count and "accept / query" are gone. (The branch count is [branch-day](../branch-day/README.md), refactored next.)

## Sub-modules (each has its own README)
| Folder | Endpoints | What |
|---|---|---|
| [`counts/`](counts/README.md) | C1 to C5 | the Counts table, KPI strips, flagged lines, repeat shortfalls, one count |
| [`record/`](record/README.md) | C8 to C14 | start, save numbers, section-end check, sign with PIN, order for today |
| [`review/`](review/README.md) | C27 to C30 | decide lines, approve preview, approve with PIN, Mark seen |
| [`setup/`](setup/README.md) | C15 to C22 | sections, order, items, moves, undo, add-items search |
| [`settings/`](settings/README.md) | C23 to C26 | the range, repeat shortfalls, the Director alert amount, what-if preview |
| [`print/`](print/README.md) | C6, C7 | printed count record, blank sheet |
| `_shared/` | | the contract (frozen), the one view builder, state machine, story, PIN, numbers, notifications, reads |

All routes are under `/api/v1/inventory/stock` (`counting-routes.ts` mounts them: print, record, review, counts, then setup and settings, so `GET /counts/:id` is last). `counting-routes.test.ts` pins the §3.1 role grid for all 30 endpoints and the route order.

## The rules in one place
- **Judging** (`../_shared/variance-calc.ts`): within range = `|value| ≤ rangeKes` **and** `percent ≤ rangePercent` (ties within; expected ≤ 0 means any difference exceeds). `NOT_COUNTED` (skipped), `MATCHES`, `WITHIN_RANGE`, `EXCEEDS`.
- **The sign freezes** expected stock (the ledger on-hand at the sign time), item cost, the result, the repeat-shortfall streak, and the settings in force. A signed count is never edited; a wrong line is **counted again** (a new count linked to the old line).
- **The blind rule:** the Attendant never receives `COUNT_STOCK_FIGURE_KEYS` (expected, difference, result, story, decision, ...); `_shared/count-view.ts` is the only place that decides which keys exist, and `withoutCountFigures` strips them again at the end. They do see item cost and last counted as a date.
- **Ledger:** every adjustment is `postStockMovement` with `countLineId` (never `inventoryTransaction.create`); all the adjustments of a sign or an approval post in one transaction, or none. "Log a missing movement" and "Ask for a recount" write nothing.
- **The Director:** flagged lines (every outside-range line of a Manager's own count; Mark seen) and an alert push for a line at or above the alert amount. Quiet hours 22:00 to 05:00 Africa/Nairobi hold the push until 05:00 (a delayed queue job). No inbox row.
- **Idempotency:** start, sign and approve each take a client key, kept in order in `counts.idempotency_key` (`_shared/count-idempotency.ts`).

## Other sub-modules read Counting only through `_shared/count-reads.ts`
`todaysCounts`, `longestWithoutCount`, `lastCountedByItem`, `sectionNamesByItem`, `unsectionedCount` (Stock Overview and All items), never Counting's repositories.

## Kept for the branch-day refactor (marked in each file; delete when branch day is redone)
`count-calc.ts` (+ test), `counting-thresholds.ts`, `thresholds-{controller,service,repository,validators}.ts`, `thresholds.types.ts`, `thresholds-service.test.ts`, and `thresholds-routes.ts` (the Branch Manager's `GET`/`PUT /inventory/thresholds`). The new code imports none of them.

## Data
`counts`, `count_lines`, `count_scope_sections`, `count_sections`, `count_section_items`, `count_item_moves`, `count_day_orders`, `count_setup_visits` (schema `prisma/schema/inventory/counts.prisma`; migration `20261008100000_stock_count_waste_expand` also seeds the first sections: one per supplier with items, "Others", an empty "Packaging"). Two partial unique indexes enforce one open count per person and an item in at most one open count. The old `stock_counts` tables are dropped by the contract migration at release.

## Tests
Pure (variance, story, time, state, view, planning), service tests with mocked repositories, the route grid, and opt-in database tests (`RUN_DB_TESTS=1`, each cleans up after itself).
