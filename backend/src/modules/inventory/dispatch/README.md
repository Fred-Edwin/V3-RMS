# dispatch

**Design:** *Requisition and dispatch* page in Paper, **approved by the owner (8 Oct 2026)**; flows in `dispatch-flow.md` and `discrepancies.md` · **Code:** built to the old flow (Milestone Five, discrepancies in Six), **pending redo** (Block 2 of `docs/features/inventory/final-pass-build-plan.md`).

Fulfil approved requisitions at the Central Store, deliver, confirm at the branch, and record findings on gaps. Where the rules below disagree with Paper or `discrepancies.md`, Paper wins: the branch counts blind, a gap is held as unaccounted until the Store Manager records one of four findings, and the old outcomes (found and re-delivered, transit loss, miscount corrected) are gone.

## Block 2 contract in code (read this first; the rest of this file describes the OLD code until back end C replaces it)
The frozen contract for the rebuild is `_shared/dispatch-contract.ts` (Zod, P1 to P10, carriers included), with `dispatch-contract.fixtures.json` (byte-identical to `frontend/features/inventory/dispatch/_shared/types/`) and `dispatch-contract.test.ts`. The rebuilt routes will live under `/inventory/dispatch` (`dispatch-rebuild-routes.ts`, a placeholder that only authenticates) and `/inventory/carriers` (`carriers-routes.ts`, placeholder); the old router `dispatch-routes.ts` (paths `/dispatch`, `/deliveries`, `/discrepancies`) keeps running until back end C deletes it, together with the old services. Deliveries are in `../deliveries/`, discrepancies in `../discrepancies/`. Access rows: `dispatch.read`, `dispatch.pack`, `dispatch.cancel`, `carriers.read`, `carriers.manage` in `_shared/central-store-access.ts`.

Endpoints: P1 `GET /queue` · P2 `GET /pack/:requisitionId/departments/:departmentId` · P3 `PUT .../lines` · P4 `GET /pack/:requisitionId/review` · P5 `POST /pack/:requisitionId/sign` (`{ carrierId, pin, idempotencyKey, leaveOut? }`) · P6 `GET /:id` · P7 `GET /:id/print?copy=store|branch` · P8 `POST /:id/cancel` · P9 `GET /mine` · P10 `/carriers`. The sent figure is never shown to a branch-side caller before the department signs its count (`sentVisible`), and the branch copy of the delivery note has no quantities.

## Who can do what
- **Store Manager/Attendant**: fulfil per department, sign and dispatch; Store Manager resolves discrepancies.
- **Department Head** (phone): confirms and signs only their own lines.
- **Branch Manager**: sees incoming and unconfirmed dispatches, may confirm on behalf of a head; reads own branch discrepancies.

## Rules
- Approved requisitions appear as one card per branch, expandable by department, oldest first. Per line: requested vs available on hand; dispatched quantity is entered; partial is normal; shortfall = requested − dispatched.
- Signature is **per department**: each section has its own "Sign & dispatch"; stock leaves the store immediately (`DISPATCH_OUT`) and the dispatch is **In Transit**; a delivery note prints.
- Substitution: add a line, set the requested one to zero; the department sees both.
- Branch confirm: dispatched quantities prefilled; head corrects to what arrived and signs; `DISPATCH_IN` writes the confirmed quantity. Until confirmed, goods are still the store's. A dispatch closes only when all its departments confirm. Unconfirmed at end of day is flagged and blocks that department's close.
- Discrepancy (dispatched 20, arrived 18): confirm the actual; alert Store Manager, Branch Manager, Directors; the Store Manager resolves with a signed outcome — found & re-delivered, transit loss (write-off adjustment, ADJ reference, reason "Transit loss"), or miscount corrected (reason "Receiving miscount").
- Status progression visible: Awaiting → In Transit → Confirmed.
- No returns from branch to store.

## Open owner decisions
F1 (miscount-correction ledger effect) and F4 (attendant on-hand on fulfil): see decisions.md.

## Endpoints
12 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/dispatch/queue` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/dispatch/:requisitionId/fulfil` | STORE_MANAGER, STORE_ATTENDANT |
| POST | `/dispatch/:requisitionId/fulfil/:departmentTag` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/dispatch/:id/delivery-note` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/deliveries` | MANAGER |
| GET | `/deliveries/:id` | MANAGER |
| POST | `/deliveries/:id/confirm` | MANAGER |
| POST | `/deliveries/:id/confirm-on-behalf` | MANAGER |
| GET | `/deliveries/:id/delivery-note` | MANAGER |
| GET | `/discrepancies` | STORE_MANAGER, STORE_ATTENDANT, MANAGER |
| GET | `/discrepancies/:id` | STORE_MANAGER, STORE_ATTENDANT, MANAGER |
| POST | `/discrepancies/:id/resolve` | STORE_MANAGER |

## Code map
`discrepancy-repository.ts`, `discrepancy-service.ts`, `dispatch-controller.ts`, `dispatch-repository.ts`, `dispatch-routes.ts`, `dispatch-service.ts`, `dispatch-validators.ts`, `dispatch.types.ts`. 5 test files beside the code.

## Coupling
Uses `purchasing/receiving-repository`, `catalog/inventory-repository`.
