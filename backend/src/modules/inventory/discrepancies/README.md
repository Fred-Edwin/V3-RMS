# discrepancies

**Design:** approved (Paper *Inventory · Requisition and dispatch*, 7c, D14 to D16, D21) · **Code:** contract only (Block 2, contract in code). No service, repository or migration yet; back end D builds them after back end C's migration merges.

A discrepancy (`DSC-{branch code}-nnnn`) opens when a department signs a count that differs from what was sent, one per differing line. The gap is held as **unaccounted** until the Store Manager (or System Admin) records **one finding** with a PIN; a wrong finding is reversed by a new linked entry. No tolerance, no escalation, no "send the rest". Rules: `docs/features/inventory/discrepancies.md`, `dispatch-contract.md` §6.

## Contract (frozen when the owner says so)
`_shared/discrepancies-contract.ts` (Zod, Q1 to Q5, plus `FINDINGS_FOR`, `FINDING_PROFILE`, `FINDING_TEXT`), `discrepancies-contract.fixtures.json` (byte-identical to `frontend/features/inventory/discrepancies/_shared/types/`), `discrepancies-contract.test.ts`.

## Amendment 1 (owner approved 9 Oct 2026, `docs/features/inventory/dispatch-amendment-1.md`)
After a reversal the gap is held as unaccounted again: the status goes REVERSED and straight back to OPEN, a new finding may be recorded, and both entries stay in the events; a reversed discrepancy counts as Open. Q1 tabs `open` and `settled` carry `counts: { open, settled }` and a `departmentId` filter. Q4 and Q5 carry an `idempotencyKey` (a repeated key returns the first result, `replayed: true`). New code `FINDING_NOT_REVERSIBLE` (replaces `NO_FINDING_TO_REVERSE` and `ALREADY_REVERSED`). Photos are `{ id, url }`. Socket event `discrepancy:changed` per record. Money: the held gap and a LOSS finding show value only to holders of `requisitions.see_value`. The audit source `DISCREPANCIES` is back end D's; the `DSC-` reference on the ledger entry is decided in back end C.

## Findings
Short: packed short at the store (stock back to the store, a packing error, not a loss), lost or damaged on the way (written off at the cost frozen at dispatch, the carrier), branch counted wrong (department corrected up, the receiver), can't tell (written off, unexplained). Extra: packed more than recorded, branch counted wrong (corrected down), can't tell (taken in, unexplained). The Extra names are the contract's wording (not drawn in Paper; the owner confirms). Every posting goes through `postStockMovement` as a new linked entry carrying the `DSC-` number.

## Endpoints (under `/inventory/discrepancies`, placeholder router in `discrepancies-routes.ts`)
Q1 `GET /` (tab Open or Settled, branch, department, search, dates, pager) · Q2 `GET /:id` · Q3 `GET /:id/finding-preview?finding=` · Q4 `POST /:id/findings` · Q5 `POST /:id/reverse`.

## Access
`discrepancies.read` (every desktop role, a Branch Manager's own branch; department heads their own department by the department rule), `discrepancies.record`, `discrepancies.reverse` (Store Manager, System Admin). Money (`lossValueKes`, `valueKes`) follows `requisitions.see_value`.

The old router for `/discrepancies` lives in `dispatch/dispatch-routes.ts` and runs until back end C deletes it.
