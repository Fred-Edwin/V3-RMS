> **SEALED — Phase 8 Complete (2026-05-04)**
> This addendum file has been consolidated into the authoritative reference docs:
> - Architecture decisions → docs/TDD.md §§22-25
> - API endpoints → docs/API_CONTRACT.md §§13-17
> - Data model → docs/DATA_MODEL.md
> - Build order → docs/BUILD_ORDER.md §14
> 
> This file is preserved for historical context. Do not update it.

---
# Phase 3 Enhancement — Per-Item Prep Ticket Splitting

This file records the design, implementation, and decisions for the ticket-splitting enhancement applied to the Phase 3 Order Management system.

---

## Status
- [x] Enhancement In Progress
- [x] Enhancement Complete
- [x] Deployed to Production

---

## Problem Statement

The original Phase 3 implementation created one `PrepTicket` per station per order. An order with 4 items all going to the kitchen produced a single ticket. This meant one chef would work the entire ticket while others were free, creating workload imbalance. Performance/merit could not be fairly measured since one chef might complete 10 single-item tickets while another completed 2 heavy tickets in the same time.

**Solution:** One `PrepTicket` per order-item line per station. An order with 3 Lattes + 2 Teas + 2 Fries + 1 Pizza produces 4 tickets (2 BARISTA + 2 KITCHEN). Multiple staff can work the same order in parallel, and throughput is measured by tickets completed.

---

## Completed Tasks

### Backend

- [x] `backend/src/utils/order-utils.ts` — Added `buildPerItemTicketSnapshots(items, station)` which returns one `PrepTicketItemSnapshot[]` per order-item line for a station (instead of all items grouped into one array). The original `buildPrepTicketItemsSnapshot` is retained for any other consumers.
- [x] `backend/src/services/order-service.ts`:
  - Replaced `buildTicketSnapshotsByStation` with `buildPerItemTicketDescriptors` which calls `buildPerItemTicketSnapshots` and flattens into an array of `{ station, items }` descriptors — one per item line.
  - `create()` now maps `ticketDescriptors` to `prepTickets` on `createWithItemsAndTickets`, producing N tickets per station.
  - `updateItems()` reconciliation rewritten: instead of finding one editable ticket per station, it now matches each existing ticket to its specific item line by `menuItemId + notes` key. New items create new tickets; removed items reject their ticket; changed items update their ticket.
  - Added `deriveItemLabel(items)` helper and wired it into `serializePrepTicketSummary` to produce a display string (e.g. `"Latte x3"`) from the single-item JSON snapshot.
- [x] `backend/src/repositories/order-repository.ts`:
  - `createWithItemsAndTickets`: `createMany` now assigns per-station sequence numbers using a `stationSequence` map, preventing unique constraint violations on `(order_id, station, sequence)` when multiple tickets exist for the same station.
  - `orderSummaryInclude`: Extended `prepTickets` select to include `items` JSON so `itemLabel` can be derived at serialization time.
- [x] `backend/src/types/order.types.ts` — Added `itemLabel: string` to `PrepTicketSummaryRecord`.

### Frontend

- [x] `frontend/types/order.ts` — Added `itemLabel: string` to `PrepTicketSummary`.
- [x] `frontend/components/ui/OrderCard.tsx` — See `REFINEMENT_CONTEXT.md` for UI details.
- [x] `frontend/components/orders/OrderDetailBottomSheet.tsx` — See `REFINEMENT_CONTEXT.md` for UI details.
- [x] `frontend/components/orders/OrderHistoryRow.tsx` — History view retains station-level deduplication (one chip per station), which is appropriate for closed orders where granular item status is no longer relevant.

---

## Decisions Made

**One ticket per order-item line, not per individual unit of quantity.**
`Latte x3` becomes one ticket with `quantity: 3`, not three tickets with `quantity: 1`. A line item is a single unit of prep work — a barista making 3 lattes handles it as one task. This keeps the ticket count proportional to the menu variety of an order, not its size.

**No schema migration required.**
The `PrepTicket` schema already had `sequence Int @default(1)` and `@@unique([orderId, station, sequence])`, which was designed to support multiple tickets per station. The enhancement only changed application logic.

**`itemLabel` derived at serialization, not stored.**
`itemLabel` (e.g. `"Latte x3"`) is derived from the first item in the `items` JSON snapshot during `serializePrepTicketSummary`. It is not a database column. This keeps the schema clean and the label always consistent with the snapshot data.

**`updateItems` reconciliation matches by `menuItemId + notes` key.**
When a waiter edits a pending order, the service matches each new item line to an existing editable ticket using a `JSON.stringify([menuItemId, notes])` key. This is stable and deterministic: same item + same notes = same ticket. Tickets for removed items are rejected; tickets for new items are created; tickets for changed quantities are updated in-place.

**History view keeps station-level deduplication.**
`OrderHistoryRow` continues to show one chip per station for closed/paid orders. Showing 6 individual item tickets on a historical order row would add noise without value — the order is done and cannot be acted on.

---

## Verification

- [x] `pnpm build` (backend) — clean
- [x] `pnpm tsc -p tsconfig.json` (backend) — clean
- [x] `pnpm test` (backend) — 27 test files, 174 tests passed
- [x] `pnpm build` (frontend) — clean
- [x] `pnpm typecheck` (frontend) — clean
- [x] Manual QA: order creation with multi-item, multi-station order — correct number of tickets created and confirmed in Prisma Studio
- [x] Manual QA: waiter order card shows per-item coloured rows; drinks turn green while food remains in progress
- [x] Deployed to production via GitHub Actions (commit `aa9a7b4`)

---

## Gotchas / Watch Out For

- **`createMany` + sequence:** The unique constraint `(order_id, station, sequence)` will throw if you call `createMany` without explicitly setting `sequence`. The `stationSequence` map in `createWithItemsAndTickets` handles this. Any future bulk ticket creation must follow the same pattern.
- **`updateItems` additive-only path (started tickets):** When a station has an `IN_PROGRESS` or `READY` ticket, the reconciliation only allows adding new item lines. It blocks removal of any item that already has a started ticket. This is intentional — you cannot un-prep something already being made. See **Bug Fix** below for the same-item duplication edge case within this path.
- **KDS/BDS unchanged:** The kitchen and barista display screens were not modified. They already handle multiple tickets per station correctly — they just show more cards now.
- **Same item added twice — key collision bug (fixed 2026-04-08):** The original key `JSON.stringify([menuItemId, notes])` was non-unique when the same item appeared more than once (e.g. two Beef Wrap lines). In the PENDING path, `editableTicketsByKey` is a `Map` so the second `.set()` silently overwrote the first entry. In the IN_PROGRESS path, `allExistingKeys` is a `Set` so the second line's key already existed and no new ticket was created. Fixed by occurrence-indexing the key: the Nth instance of `(menuItemId, notes)` gets key `(menuItemId, notes, N)`. The "started items cannot be removed" guard was updated to use multiset count-comparison instead of key-set membership. File changed: `backend/src/services/order-service.ts`.
