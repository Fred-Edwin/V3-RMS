# dispatch

**Design:** Paper "Inventory · Requisition and dispatch" chapters 5 to 8 (D1 to D21) and the gap fixes G2 to G4, owner approved; contract `docs/features/inventory/dispatch-contract.md` with Amendment 1 (`dispatch-amendment-1.md`); flows in `dispatch-flow.md` and `discrepancies.md`. **Code:** the store side of Block 2 (back end C) is built and replaces the Milestone Five dispatch entirely. Deliveries (branch count) and Discrepancies (findings) are back end D: `../deliveries/` and `../discrepancies/`.

Pack the departments of an approved requisition at the Central Store, give one final review and one signature, send. One `Dispatch` per department of the requisition (`DSP-<branch code>-nnnn`, counted per branch). The branch counts blind; a gap is held until the Store Manager records one finding.

## Rules (what the code does)
- **A dispatch row exists from the first look** at a department (status `TO_PACK`, no reference). Opening a department (P2/P3/P4/P5) builds or reconciles its lines from the requisition: the approved quantity (else the requested one), an addition still waiting for approval is left out, an approved one joins, a changed quantity follows while the department is unsigned. Sent quantity pre-fills with the requested quantity, or what the store holds when that is less. Any tick makes it `PACKING`.
- **P3 save** (last write wins): `OVER_REQUESTED` (422) above the requested quantity; `STOCK_CHANGED` (409, `details.lineIds`) when a ticked line sends more than the store holds; `ALREADY_SIGNED` on a signed department. Nothing is saved on an error.
- **P5 sign**: one transaction, serialised per hub by an advisory lock. Departments in `leaveOut` (and any not ready) stay in To pack. Errors `INVALID_PIN` (own PIN, through `countPin`), `CARRIER_INACTIVE`, `NOTHING_TO_SEND`, `NOT_ALL_PACKED` (`details.departmentIds`), `STOCK_CHANGED` (stock is checked per item across every department shipping now). Each shipped department gets `DSP-` from `ReferenceCounter` (prefix `DSP`, branch site), its line costs are frozen, `DISPATCH_OUT` is posted through `postStockMovement` (never `inventoryTransaction.create`), a `SIGNED_AND_SENT` event is written, and after commit the department's members are pushed and `dispatch:changed` is emitted. A repeated `idempotencyKey` by the same person returns the first result with `replayed: true`.
- **P8 cancel**: PIN-signed, `dispatch.cancel` (Store Manager, System Admin), only while `ON_THE_WAY` and not counted (`DISPATCH_ALREADY_COUNTED`, `NOT_SIGNED`, `DISPATCH_CANCELLED`). Locks that dispatch only. Stock goes back by a **linked reversing `DISPATCH_OUT` row** per line (the door's `DISPATCH` reversal: positive, `reversesTransactionId` set; the original stays). The note is voided and kept. The department's lines return to the queue as a fresh dispatch with ticks reset the next time it is opened (the partial unique index allows one live dispatch per department).
- **Blind and money rules** (decided in `dispatch-view.ts`): a Branch Manager reading P6 gets no `sentQty`, `gapQty`, short count or value before the department has counted (`sentVisible: false`); the branch copy of the note has no quantities and the store copy is refused to the branch before the count. Cost and value only for holders of `requisitions.see_value`; never the Attendant.
- **Read scope** (`dispatch-caller.ts`): `dispatch.read` is narrowed in the service: Branch Manager their own branch, Attendant only what they packed or signed, the other hub roles everything.

## The DSC- reference on the ledger (decision, Amendment 1 row 17)
The append-only ledger gets no new column. A finding's entries, its reversal and a cancellation post through the door as rows linked to the dispatch line by `dispatchLineId` (a finding's `ADJUSTMENT` keeps its own `ADJ-` number, which the door owns). There is one discrepancy per dispatch line, so the `DSC-` number is found through that link (`discrepancies.dispatch_line_id`) and shown as the entry's `source` (`stock/_shared/movement-reference.ts`, `discrepancyReference`); Stock search finds the item by `DSC-`, `DSP-` or `ADJ-`. Back end D posts the finding rows the same way.

## Endpoints (base `/inventory`; access rows in `_shared/central-store-access.ts`)
| # | Endpoint | Capability |
|---|---|---|
| P1 | `GET /dispatch/queue` | `dispatch.pack` |
| P2 | `GET /dispatch/pack/:requisitionId/departments/:departmentId` | `dispatch.pack` |
| P3 | `PUT /dispatch/pack/:requisitionId/departments/:departmentId/lines` | `dispatch.pack` |
| P4 | `GET /dispatch/pack/:requisitionId/review` | `dispatch.pack` |
| P5 | `POST /dispatch/pack/:requisitionId/sign` | `dispatch.pack` |
| P6 | `GET /dispatch/:id` | `dispatch.read` |
| P7 | `GET /dispatch/:id/print?copy=store\|branch` | `dispatch.read` |
| P8 | `POST /dispatch/:id/cancel` | `dispatch.cancel` |
| P9 | `GET /dispatch/mine?tab=&from=&to=&branchId=&page=&pageSize=` | `dispatch.pack` |
| P10 | `GET /carriers`, `POST /carriers`, `PATCH /carriers/:id` | `carriers.read` / `carriers.manage` |

## Hand-offs and roll-ups it fills
- `requisitions/requisitions-tabs.ts` `tabOf`: **To pack** (a Sent department with no signed live dispatch), **On the way**, **To confirm** (a department `ON_THE_WAY` more than 2 hours after `signedAt`), **Discrepancies** (any discrepancy Open or reversed), then Closed. One pure function, table-tested.
- The requisition file (R3) `dispatches` field and tracker "n of m sent" / "n counted" (`dispatch-roll-up.ts`); the printed requisition's `dispatchReference`; the Attendant's `dispatch` badge (branches to pack) on R2; `departments` on `GET /inventory/permissions/me`.
- `closeIfComplete` (CONFIRMED with no gap held becomes CLOSED; the requisition closes when every department has) and `attachAdditionToDispatch` (an approved addition joins the unsigned dispatch). Back end D calls `closeIfComplete` after a count and a settlement.
- Sockets: `dispatch:changed` per record (branch room, hub room, all-sites room) and the `inventory:badges` nudge, through `dispatch-notify.ts` and `_shared/notify.ts`.

## Data
`prisma/schema/inventory/dispatch.prisma`: `Dispatch`, `DispatchLine`, `DispatchPhoto`, `DispatchEvent`, `Carrier`, `Discrepancy`, `DiscrepancyEvent`. Migration `20261009100000_block2_dispatch_replace` (replace, with `ROLLBACK.md`). Production had 0 dispatches and 0 discrepancies on 8 Oct 2026: **re-run those two counts the week of release**; the migration refuses to run if any discrepancy exists.

## Built in back end D
Findings (Q1 to Q5) are in `../discrepancies/`; the branch count (V1 to V6), photos with the authenticated URL (`/inventory/deliveries/photos/:id`), the `DISPATCH_IN` posting and the 2-hour job are in `../deliveries/`; the 24-hour reminder is in `src/jobs/inventory-delivery-jobs.ts`; the `DISPATCH` and `DISCREPANCIES` audit sources are in `../audit-log/sources/`; `GET /inventory/requisitions/badges` carries `deliveries`. A finding posts its `ADJUSTMENT` rows linked to the dispatch line exactly as described above.

## Code map
`dispatch-routes.ts`, `carriers-routes.ts`, `dispatch-controller.ts`, `dispatch-validators.ts`, `dispatch-service.ts`, `carriers-service.ts`, `dispatch-repository.ts`, `carriers-repository.ts`, `dispatch-state.ts` (pure state rules), `dispatch-view.ts` (wire shapes, blind and money), `dispatch-roll-up.ts`, `dispatch-caller.ts`, `dispatch-errors.ts`, `dispatch-notify.ts`; contract in `_shared/dispatch-contract.ts` (+ fixtures and test). Tests: `dispatch-state.test.ts`, `dispatch-routes.test.ts`, `dispatch-roll-up.test.ts`, and the opt-in `dispatch.db.test.ts` (`RUN_DB_TESTS=1`).

## Coupling
Uses `stock/ledger` (the door), `_shared/reference-counter`, `_shared/notify`, `counting/_shared/count-pin`, `requisitions` (read through the pack repository; the requisition list reads the dispatch roll-up), `branch-day` and the count story read the new columns.
