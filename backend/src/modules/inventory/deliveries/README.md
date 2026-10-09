# deliveries

**Design:** Paper *Inventory · Requisition and dispatch*, chapter 6 (D7 to D12, D19), gap fix G2, Block 2 gaps (chapters 9 to 12), owner approved; contract `docs/features/inventory/dispatch-contract.md` with Amendment 1 (`dispatch-amendment-1.md`); flow in `discrepancies.md` ("At the branch"). **Code:** the branch side of Block 2 (back end D) is built: V1 to V6, photos, the 2-hour job and the notices. The store side is `../dispatch/`; the findings are `../discrepancies/`.

A department counts what arrived **blind**: the sent figure is never in a response before the confirm summary. A match passes silently, a difference is flagged once and counted again, the second count is final, a reason and optional photos follow, and the department signs with a PIN. Signing brings **what was counted** into the department's stock and holds the gap as unaccounted.

## Rules (what the code does)
- **Who counts** (`deliveries-service.ts`, `loadCaller`): an active member or the head of the receiving department, for that department only (`deliveries.count` is a department rule held by no role in the access table), or the Branch Manager for any department of their branch (`deliveries.confirm_on_behalf`). Anyone else (a hub user, a person with no department) is refused. The routes carry `authenticate` only, never a `requireRole` list.
- **V1 list**: `tab=waiting` is ON_THE_WAY, `tab=past` is CONFIRMED and CLOSED with `result` (MATCHED, GAP_OPEN, GAP_RESOLVED), `gapCount`, the confirmer and their title; `tabCounts` always carry both. The date range runs on the signature while waiting and on the count in History.
- **V2 count view**: item, unit, the saved count, `state`, `attempt`, `recountUsed`, `direction` (only after a check flagged the line), reason and photos. **`arrivedAt` is stamped by the first read by someone from the department** (a conditional update, so once); the Branch Manager looking in does not stamp it. Information only: the 2-hour clock runs from `signedAt`.
- **V3 save** stores what was typed and never says whether it matches; 0 is a valid count; a line already final is refused (`RECOUNT_USED`). **Check** compares every line: the first difference is `COUNT_AGAIN`, the second makes it `SHORT` or `EXTRA` and final; a match is final at once. The answer lists only differing lines by name, typed number and `direction`, never the sent figure or the size. The pure rules are `deliveries-state.ts` (table-tested).
- **V4 reason** only on a final difference (`LINE_NOT_DIFFERENT`). **Photos**: JPEG, PNG or WebP decided from the first bytes (`deliveries-photos.ts`), 5 MB (`PHOTO_TOO_LARGE`, 413, also at the multer limit), 3 per line (`TOO_MANY_PHOTOS`), kept in `DispatchPhoto`, stored through the same document storage as Supplier documents (`getDocumentStorage`, R2 in production). `DELETE /:id/photos/:photoId` removes a mistaken one before the confirm. `GET /photos/:photoId` is the **authenticated link** a photo's `url` points at: bytes, `private` cache, `nosniff`; the department, the Branch Manager of the branch and the hub readers of discrepancies may open it, anyone else gets 404.
- **V5 preview** is the one place the sent figure and the signed gap appear, and only once every line is final (`COUNT_AGAIN_PENDING`, `NOT_COUNTED` before that). `canConfirm` is false while a difference has no reason.
- **V6 confirm**: one transaction under a row lock on the dispatch. It claims the dispatch (ON_THE_WAY to CONFIRMED, so of two members signing at once exactly one wins and the other gets `ALREADY_CONFIRMED`), posts **`DISPATCH_IN` for the counted quantity** at the department's stock through `postStockMovement`, opens one `DSC-<branch code>-nnnn` per differing line (counter `DSC` on the branch site), and writes the dispatch events (`DELIVERY_CONFIRMED` or `DELIVERY_CONFIRMED_ON_BEHALF`, `DISCREPANCY_OPENED`). The gap is in neither stock. A repeated `idempotencyKey` by the same person returns the first result (`replayed: true`, 200). `ON_BEHALF_NOT_ALLOWED` for `onBehalf` by anyone but the Branch Manager; the Branch Manager's own department is not "on behalf". After the commit `closeIfComplete` runs (a delivery with nothing held becomes CLOSED, and the requisition when every department has).
- **A department with no stock location** (one added after the five were provisioned) gets its location created on the first confirm, in the same transaction (`ensureDepartmentLocation`), with the legacy tag kept in step. *Decision for the owner to confirm.*
- **A cancelled dispatch** is learned on the department's next call: `DISPATCH_CANCELLED` (no push).

## Endpoints (base `/inventory/deliveries`)
| # | Endpoint |
|---|---|
| V1 | `GET /mine?tab=&from=&to=&result=&page=&pageSize=` |
| V2 | `GET /:id/count` |
| V3 | `PUT /:id/count`, `POST /:id/check` |
| V4 | `PUT /:id/lines/:lineId/reason`, `POST /:id/photos` (multipart `lineId` + `file`), `DELETE /:id/photos/:photoId` |
| V5 | `GET /:id/confirm-preview` |
| V6 | `POST /:id/confirm` |
| | `GET /photos/:photoId` (the photo link) |

Error codes are `DELIVERY_ERROR_CODES` in the contract; the statuses are in `deliveries-errors.ts`.

## Notices, badges, sockets, jobs
All through `_shared/notify.ts` (`deliveries-notify.ts`); no Inbox row, titles not names.
- Confirmed with gaps: Store Manager and Director pushed (map row 17); badges on the branch and the hub; `dispatch:changed` and one `discrepancy:changed` per gap. Confirmed clean: badges only.
- **Waiting for the branch** (map row 20): the job `inventory-delivery-waiting.schedule` (`src/jobs/inventory-delivery-jobs.ts`, every 5 minutes in the report worker) finds ON_THE_WAY deliveries signed over 2 hours ago that nobody counted and pushes that branch's Branch Manager once. The claim is a conditional update of `waiting_notified_at`, so two workers, an overlapping run or a retry never send twice. The nudges reach browsers through the Block 1 Redis bridge.
- `GET /inventory/requisitions/badges` carries `deliveries` (waiting for the caller: the department's own, or the whole branch for the Branch Manager).
- A cancelled dispatch pushes nobody (map row 21).

## Data
`Dispatch` (`arrived_at`, `counted_by_id`, `counted_at`, `on_behalf`, `waiting_notified_at`), `DispatchLine` (`counted_qty`, `check_count`, `counted_twice`, `count_reason`, `count_reason_note`), `DispatchPhoto`. Migration `20261009150000_block2_back_end_d_counters` adds `check_count`, `waiting_notified_at` (and `discrepancies.reminder_sent_at`); additive.

## Code map
`deliveries-routes.ts`, `deliveries-controller.ts`, `deliveries-validators.ts`, `deliveries-service.ts`, `deliveries-repository.ts`, `deliveries-state.ts` (pure count rules), `deliveries-view.ts` (wire shapes, the blind rule), `deliveries-photos.ts`, `deliveries-errors.ts`, `deliveries-notify.ts`; contract in `_shared/deliveries-contract.ts` (+ fixtures and test). Tests: `deliveries-state.test.ts`, `deliveries-view.test.ts` (no sent figure in any pre-sign response), `deliveries-routes.test.ts`, `deliveries-notify.test.ts`, and the opt-in `deliveries.db.test.ts` (`RUN_DB_TESTS=1`, one file at a time, with Discrepancies).

## Coupling
`dispatch` (the dispatch rows, `photoUrl`, `stageOf`), `discrepancies` (opens them), `stock/ledger` (the door), `_shared/reference-counter`, `_shared/notify`, `counting/_shared/count-pin`, `requisitions` (`closeIfComplete`, the badges), `suppliers/supplier-storage` (document storage).
