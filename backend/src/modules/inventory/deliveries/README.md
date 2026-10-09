# deliveries

**Design:** approved (Paper *Inventory · Requisition and dispatch*, chapter 6 D7 to D12, D19, gap fix G2) · **Code:** contract only (Block 2, contract in code). No service, repository or migration yet; back end D builds them after back end C's migration merges.

The branch side of a dispatch: a department member counts the delivery **blind**, the screen flags a mismatch, the second count is final, the person gives a reason and optional photos for what still differs, signs with a PIN, and the counted stock enters the department. The Branch Manager can confirm for a department ("on behalf", the real signer recorded). Rules: `docs/features/inventory/dispatch-contract.md`, `discrepancies.md`.

## Contract (frozen when the owner says so)
`_shared/deliveries-contract.ts` (Zod, V1 to V6), `deliveries-contract.fixtures.json` (one example per endpoint and the error cases, byte-identical to `frontend/features/inventory/deliveries/_shared/types/`), `deliveries-contract.test.ts` (parses every fixture, pins the blind rule). Shared pieces (photos, reasons, stages, error envelope) come from `dispatch/_shared/dispatch-contract.ts`.

## The blind rule, in the shape
Nothing in V1 to V4 carries the sent quantity, the gap, or any stand-in (a test pins the key names). A save stores what was typed and never says whether it matches; the check (`POST /check`) is the comparison: a differing line is `COUNT_AGAIN` once, then `SHORT` or `EXTRA` (direction only) and final. The sent figure first appears in V5 (the confirm preview). The branch never sees money.

## Endpoints (under `/inventory/deliveries`, placeholder router in `deliveries-routes.ts`)
V1 `GET /mine` · V2 `GET /:id/count` · V3 `PUT /:id/count`, `POST /:id/check` · V4 `PUT /:id/lines/:lineId/reason`, `POST /:id/photos` (multipart, 5 MB, 3 per line) · V5 `GET /:id/confirm-preview` · V6 `POST /:id/confirm` (`{ pin, onBehalf?, idempotencyKey }`).

## Access
Counting is the department rule in the service (`deliveries.count`, held by no role in the table); the Branch Manager confirms with `deliveries.confirm_on_behalf`. Never a new `requireRole` list.

The old router for `/deliveries` lives in `dispatch/dispatch-routes.ts` and runs until back end C deletes it.
